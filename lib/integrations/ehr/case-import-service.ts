/**
 * Case Import Service
 *
 * Main orchestrator for processing SIU messages into ORbit cases.
 * Routes by trigger event: S12 → create, S13/S14 → update, S15/S16 → cancel.
 * Handles entity matching, deduplication, and review queue flow.
 */

import type { AnySupabaseClient } from '@/lib/dal'
import { ehrDAL } from '@/lib/dal/ehr'
import type { SIUMessage } from '@/lib/hl7v2/types'
import type { EhrIntegration, EhrIntegrationLog, EhrIntegrationType } from '@/lib/integrations/shared/integration-types'
import { matchOrCreatePatient, type PatientData } from './patient-matcher'
import { matchSurgeon, type ProviderMatchResult } from './provider-matcher'
import { matchProcedure, type ProcedureMatchResult } from './procedure-matcher'
import { matchRoom, type RoomMatchResult } from './room-matcher'
import { extractSurgeonInfo } from './field-preferences'
import {
  logMessageReceived,
  logMessageProcessed,
  logMessagePendingReview,
  logMessageError,
  logMessageIgnored,
  updateIntegrationTimestamp,
  type UnmatchedEntities,
} from '@/lib/integrations/shared/integration-logger'
import { logger } from '@/lib/logger'

const log = logger('case-import-service')

const AUTO_MAP_THRESHOLD = 0.90

/** Map integration_type to the short source name used in the cases.source column */
const INTEGRATION_SOURCE_NAMES: Record<string, string> = {
  epic_hl7v2: 'epic',
  cerner_hl7v2: 'cerner',
  meditech_hl7v2: 'meditech',
}

// =====================================================
// CHANGE TRACKING
// =====================================================

/**
 * Tag the most recent case_history entry for a case with the correct
 * change_source and ehr_integration_log_id.
 *
 * PostgREST runs each request as a separate transaction, so SET LOCAL
 * session config won't persist across calls. Instead, we use a post-hoc
 * correction: the trigger writes the history entry with defaults, then
 * this RPC updates it with the correct attribution.
 */
async function tagCaseHistoryEntry(
  supabase: AnySupabaseClient,
  caseId: string,
  logEntryId: string,
  integrationType: EhrIntegrationType,
): Promise<void> {
  await supabase.rpc('tag_latest_case_history', {
    p_case_id: caseId,
    p_change_source: integrationType,
    p_ehr_log_id: logEntryId,
  })
}

// =====================================================
// TYPES
// =====================================================

export interface ImportResult {
  success: boolean
  action: 'created' | 'updated' | 'cancelled' | 'pending_review' | 'duplicate' | 'ignored' | 'error'
  caseId: string | null
  logEntryId: string | null
  errorMessage: string | null
}

interface ExtractedCaseData {
  externalCaseId: string
  scheduledDate: string
  startTime: string | null
  notes: string | null
  diagnosisCode: string | null
  diagnosisDesc: string | null
  patient: PatientData
  surgeonInfo: { npi: string; lastName: string; firstName: string; middleName: string }
  procedureInfo: { cptCode: string; procedureName: string }
  roomInfo: { roomCode: string; roomDescription: string }
}

// =====================================================
// MAIN ENTRY POINT
// =====================================================

/**
 * Handle an incoming SIU message.
 * This is the primary entry point for the import pipeline.
 *
 * Flow:
 * 1. Check message dedup (MSH-10)
 * 2. Log message as 'received'
 * 3. Route by trigger event
 * 4. Match entities (surgeon, procedure, room, patient)
 * 5. Create/update/cancel case or queue for review
 */
export async function handleSIUMessage(
  supabase: AnySupabaseClient,
  siu: SIUMessage,
  integration: EhrIntegration,
  rawMessage: string,
): Promise<ImportResult> {
  const facilityId = integration.facility_id
  const integrationId = integration.id

  try {
    // 1. Check message dedup (MSH-10)
    if (siu.msh.messageControlId) {
      const { data: existing } = await ehrDAL.checkDuplicateMessage(
        supabase,
        integrationId,
        siu.msh.messageControlId,
      )

      if (existing) {
        log.info('Duplicate message detected, returning cached result', {
          messageControlId: siu.msh.messageControlId,
          existingLogId: existing.id,
        })
        return {
          success: true,
          action: 'duplicate',
          caseId: existing.case_id,
          logEntryId: existing.id,
          errorMessage: null,
        }
      }
    }

    // 2. Log message as 'received'
    const externalCaseId = siu.sch.placerAppointmentId
    const logEntry = await logMessageReceived(supabase, {
      facilityId,
      integrationId,
      messageType: `SIU^${siu.triggerEvent}`,
      messageControlId: siu.msh.messageControlId || null,
      rawMessage,
      parsedData: buildParsedData(siu),
      externalCaseId: externalCaseId || null,
    })

    if (!logEntry) {
      return { success: false, action: 'error', caseId: null, logEntryId: null, errorMessage: 'Failed to create log entry' }
    }

    // Update integration timestamp
    await updateIntegrationTimestamp(supabase, integrationId)

    // 3. Route by trigger event
    const result = await routeByTriggerEvent(supabase, siu, integration, logEntry, rawMessage)
    return result
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error during import'
    log.error('Case import failed', { error: errorMsg, triggerEvent: siu.triggerEvent })
    return { success: false, action: 'error', caseId: null, logEntryId: null, errorMessage: errorMsg }
  }
}

// =====================================================
// TRIGGER EVENT ROUTING
// =====================================================

async function routeByTriggerEvent(
  supabase: AnySupabaseClient,
  siu: SIUMessage,
  integration: EhrIntegration,
  logEntry: EhrIntegrationLog,
  _rawMessage: string,
): Promise<ImportResult> {
  switch (siu.triggerEvent) {
    case 'S12':
      return handleCreate(supabase, siu, integration, logEntry)
    case 'S13':
    case 'S14':
      return handleUpdate(supabase, siu, integration, logEntry)
    case 'S15':
    case 'S16':
      return handleCancel(supabase, siu, integration, logEntry)
    default:
      await logMessageIgnored(supabase, logEntry.id, `Unsupported trigger event: ${siu.triggerEvent}`)
      return { success: true, action: 'ignored', caseId: null, logEntryId: logEntry.id, errorMessage: null }
  }
}

// =====================================================
// S12 — CREATE NEW CASE
// =====================================================

async function handleCreate(
  supabase: AnySupabaseClient,
  siu: SIUMessage,
  integration: EhrIntegration,
  logEntry: EhrIntegrationLog,
): Promise<ImportResult> {
  const facilityId = integration.facility_id
  const integrationId = integration.id

  const integrationType = integration.integration_type

  try {
    // Extract case data from SIU message
    const caseData = extractCaseData(siu, integrationType)

    // Check case-level dedup (external_case_id + facility_id)
    const { data: existingCase } = await supabase
      .from('cases')
      .select('id')
      .eq('facility_id', facilityId)
      .eq('external_case_id', caseData.externalCaseId)
      .eq('external_system', integrationType)
      .maybeSingle()

    if (existingCase) {
      log.info('Case already exists for external_case_id, treating as update', {
        externalCaseId: caseData.externalCaseId,
        caseId: existingCase.id,
      })
      return handleUpdate(supabase, siu, integration, logEntry)
    }

    // Match entities
    const matchResults = await matchAllEntities(supabase, integrationId, facilityId, caseData)

    // Check if any entity needs review
    const unmatched = collectUnmatched(caseData, matchResults)
    const hasUnmatched = !!(unmatched.surgeon || unmatched.procedure || unmatched.room || unmatched.demographicsMismatch)

    if (hasUnmatched) {
      await logMessagePendingReview(supabase, logEntry.id, unmatched)
      log.info('Message queued for review', { externalCaseId: caseData.externalCaseId, unmatched: Object.keys(unmatched) })
      return { success: true, action: 'pending_review', caseId: null, logEntryId: logEntry.id, errorMessage: null }
    }

    // All entities matched — create the case
    const caseId = await createCase(supabase, facilityId, integrationType, caseData, matchResults)

    // Tag case_history entries (created + external tracking update) with HL7v2 attribution
    await tagCaseHistoryEntry(supabase, caseId, logEntry.id, integrationType)

    // Auto-save high-confidence fuzzy matches to entity mappings for future auto-resolution
    await saveAutoMappings(supabase, integrationId, facilityId, caseData, matchResults)

    await logMessageProcessed(supabase, logEntry.id, caseId)
    log.info('Case created successfully', { caseId, externalCaseId: caseData.externalCaseId })

    return { success: true, action: 'created', caseId, logEntryId: logEntry.id, errorMessage: null }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error creating case'
    await logMessageError(supabase, logEntry.id, errorMsg)
    log.error('Case creation failed', { error: errorMsg })
    return { success: false, action: 'error', caseId: null, logEntryId: logEntry.id, errorMessage: errorMsg }
  }
}

// =====================================================
// S13/S14 — UPDATE EXISTING CASE
// =====================================================

async function handleUpdate(
  supabase: AnySupabaseClient,
  siu: SIUMessage,
  integration: EhrIntegration,
  logEntry: EhrIntegrationLog,
): Promise<ImportResult> {
  const facilityId = integration.facility_id
  const integrationId = integration.id
  const integrationType = integration.integration_type
  const externalCaseId = siu.sch.placerAppointmentId

  try {
    // Find existing case
    const { data: existingCase } = await supabase
      .from('cases')
      .select('id')
      .eq('facility_id', facilityId)
      .eq('external_case_id', externalCaseId)
      .eq('external_system', integrationType)
      .maybeSingle()

    if (!existingCase) {
      // Case not found — treat as new (S12)
      log.info('Case not found for update, treating as create', { externalCaseId })
      return handleCreate(supabase, siu, integration, logEntry)
    }

    // Extract and match entities
    const caseData = extractCaseData(siu, integrationType)
    const matchResults = await matchAllEntities(supabase, integrationId, facilityId, caseData)

    // Check for unmatched entities
    const unmatched = collectUnmatched(caseData, matchResults)
    const hasUnmatched = !!(unmatched.surgeon || unmatched.procedure || unmatched.room || unmatched.demographicsMismatch)

    if (hasUnmatched) {
      await logMessagePendingReview(supabase, logEntry.id, unmatched)
      return { success: true, action: 'pending_review', caseId: existingCase.id, logEntryId: logEntry.id, errorMessage: null }
    }

    // Build update payload
    const updates: Record<string, unknown> = {}

    if (caseData.scheduledDate) updates.scheduled_date = caseData.scheduledDate
    if (caseData.startTime) updates.start_time = caseData.startTime
    if (matchResults.surgeon.orbitSurgeonId) updates.surgeon_id = matchResults.surgeon.orbitSurgeonId
    if (matchResults.procedure.orbitProcedureId) updates.procedure_type_id = matchResults.procedure.orbitProcedureId
    if (matchResults.room.orbitRoomId) updates.or_room_id = matchResults.room.orbitRoomId
    if (caseData.diagnosisCode) updates.primary_diagnosis_code = caseData.diagnosisCode
    if (caseData.diagnosisDesc) updates.primary_diagnosis_desc = caseData.diagnosisDesc
    if (caseData.notes) updates.notes = caseData.notes

    // Update patient if matched
    if (matchResults.patient.patientId) {
      updates.patient_id = matchResults.patient.patientId
    }

    const { error: updateError } = await supabase
      .from('cases')
      .update(updates)
      .eq('id', existingCase.id)

    if (updateError) {
      throw new Error(`Case update failed: ${updateError.message}`)
    }

    // Tag case_history entry with HL7v2 attribution
    await tagCaseHistoryEntry(supabase, existingCase.id, logEntry.id, integrationType)

    await saveAutoMappings(supabase, integrationId, facilityId, caseData, matchResults)
    await logMessageProcessed(supabase, logEntry.id, existingCase.id)

    log.info('Case updated successfully', { caseId: existingCase.id, externalCaseId })
    return { success: true, action: 'updated', caseId: existingCase.id, logEntryId: logEntry.id, errorMessage: null }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error updating case'
    await logMessageError(supabase, logEntry.id, errorMsg)
    return { success: false, action: 'error', caseId: null, logEntryId: logEntry.id, errorMessage: errorMsg }
  }
}

// =====================================================
// S15/S16 — CANCEL CASE
// =====================================================

async function handleCancel(
  supabase: AnySupabaseClient,
  siu: SIUMessage,
  integration: EhrIntegration,
  logEntry: EhrIntegrationLog,
): Promise<ImportResult> {
  const facilityId = integration.facility_id
  const integrationType = integration.integration_type
  const externalCaseId = siu.sch.placerAppointmentId

  try {
    // Find existing case
    const { data: existingCase } = await supabase
      .from('cases')
      .select('id')
      .eq('facility_id', facilityId)
      .eq('external_case_id', externalCaseId)
      .eq('external_system', integrationType)
      .maybeSingle()

    if (!existingCase) {
      log.info('Case not found for cancellation, ignoring', { externalCaseId })
      await logMessageIgnored(supabase, logEntry.id, `Case not found for cancellation: ${externalCaseId}`)
      return { success: true, action: 'ignored', caseId: null, logEntryId: logEntry.id, errorMessage: null }
    }

    // Find the 'cancelled' status ID
    const { data: cancelledStatus } = await supabase
      .from('case_statuses')
      .select('id')
      .eq('name', 'cancelled')
      .maybeSingle()

    if (!cancelledStatus) {
      throw new Error('Could not find "cancelled" status in case_statuses')
    }

    const { error: updateError } = await supabase
      .from('cases')
      .update({ status_id: cancelledStatus.id })
      .eq('id', existingCase.id)

    if (updateError) {
      throw new Error(`Case cancellation failed: ${updateError.message}`)
    }

    // Tag case_history entry with HL7v2 attribution
    await tagCaseHistoryEntry(supabase, existingCase.id, logEntry.id, integrationType)

    await logMessageProcessed(supabase, logEntry.id, existingCase.id)

    log.info('Case cancelled successfully', { caseId: existingCase.id, externalCaseId })
    return { success: true, action: 'cancelled', caseId: existingCase.id, logEntryId: logEntry.id, errorMessage: null }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error cancelling case'
    await logMessageError(supabase, logEntry.id, errorMsg)
    return { success: false, action: 'error', caseId: null, logEntryId: logEntry.id, errorMessage: errorMsg }
  }
}

// =====================================================
// ENTITY MATCHING
// =====================================================

interface AllMatchResults {
  patient: { patientId: string | null; demographicsMismatch: { field: string; expected: string; received: string } | null }
  surgeon: ProviderMatchResult
  procedure: ProcedureMatchResult
  room: RoomMatchResult
}

async function matchAllEntities(
  supabase: AnySupabaseClient,
  integrationId: string,
  facilityId: string,
  caseData: ExtractedCaseData,
): Promise<AllMatchResults> {
  // Run all matches in parallel
  const [patientResult, surgeonResult, procedureResult, roomResult] = await Promise.all([
    matchOrCreatePatient(supabase, facilityId, caseData.patient),
    matchSurgeon(
      supabase, integrationId, facilityId,
      caseData.surgeonInfo.npi,
      caseData.surgeonInfo.lastName,
      caseData.surgeonInfo.firstName,
      caseData.surgeonInfo.middleName,
    ),
    matchProcedure(
      supabase, integrationId, facilityId,
      caseData.procedureInfo.cptCode,
      caseData.procedureInfo.procedureName,
    ),
    matchRoom(
      supabase, integrationId, facilityId,
      caseData.roomInfo.roomCode,
      caseData.roomInfo.roomDescription,
    ),
  ])

  return {
    patient: {
      patientId: patientResult.patientId,
      demographicsMismatch: patientResult.demographicsMismatch,
    },
    surgeon: surgeonResult,
    procedure: procedureResult,
    room: roomResult,
  }
}

/**
 * Collect unmatched entities for review notes.
 */
function collectUnmatched(
  caseData: ExtractedCaseData,
  results: AllMatchResults,
): UnmatchedEntities {
  const unmatched: UnmatchedEntities = {}

  if (!results.surgeon.matched) {
    unmatched.surgeon = {
      name: `${caseData.surgeonInfo.lastName}, ${caseData.surgeonInfo.firstName}`,
      npi: caseData.surgeonInfo.npi || undefined,
      suggestions: results.surgeon.suggestions,
    }
  }

  if (!results.procedure.matched) {
    unmatched.procedure = {
      cpt: caseData.procedureInfo.cptCode,
      name: caseData.procedureInfo.procedureName,
      suggestions: results.procedure.suggestions,
    }
  }

  if (!results.room.matched) {
    unmatched.room = {
      name: caseData.roomInfo.roomDescription || caseData.roomInfo.roomCode,
      suggestions: results.room.suggestions,
    }
  }

  if (results.patient.demographicsMismatch) {
    unmatched.demographicsMismatch = results.patient.demographicsMismatch
  }

  return unmatched
}

// =====================================================
// CASE CREATION
// =====================================================

async function createCase(
  supabase: AnySupabaseClient,
  facilityId: string,
  integrationType: EhrIntegrationType,
  caseData: ExtractedCaseData,
  matchResults: AllMatchResults,
): Promise<string> {
  // Get scheduled status ID
  const { data: scheduledStatus } = await supabase
    .from('case_statuses')
    .select('id')
    .eq('name', 'scheduled')
    .maybeSingle()

  if (!scheduledStatus) {
    throw new Error('Could not find "scheduled" status in case_statuses')
  }

  const caseNumber = `HL7-${caseData.externalCaseId}`

  // Use create_case_with_milestones RPC (fires full trigger pipeline)
  const { data: caseId, error: rpcError } = await supabase.rpc('create_case_with_milestones', {
    p_case_number: caseNumber,
    p_scheduled_date: caseData.scheduledDate,
    p_start_time: caseData.startTime,
    p_or_room_id: matchResults.room.orbitRoomId,
    p_procedure_type_id: matchResults.procedure.orbitProcedureId,
    p_status_id: scheduledStatus.id,
    p_surgeon_id: matchResults.surgeon.orbitSurgeonId,
    p_facility_id: facilityId,
    p_created_by: null,
    p_operative_side: null,
    p_payer_id: null,
    p_notes: caseData.notes,
    p_rep_required_override: null,
    p_is_draft: false,
    p_staff_assignments: null,
    p_patient_id: matchResults.patient.patientId,
    p_source: INTEGRATION_SOURCE_NAMES[integrationType] || integrationType,
  })

  if (rpcError || !caseId) {
    throw new Error(`create_case_with_milestones failed: ${rpcError?.message || 'No case ID returned'}`)
  }

  // Set external tracking columns (not part of RPC)
  const { error: updateError } = await supabase
    .from('cases')
    .update({
      external_case_id: caseData.externalCaseId,
      external_system: integrationType,
      import_source: 'hl7v2',
      primary_diagnosis_code: caseData.diagnosisCode,
      primary_diagnosis_desc: caseData.diagnosisDesc,
    })
    .eq('id', caseId)

  if (updateError) {
    log.warn('Failed to set external tracking columns', { caseId, error: updateError.message })
  }

  return caseId as string
}

// =====================================================
// AUTO-MAPPING PERSISTENCE
// =====================================================

/**
 * Save high-confidence fuzzy matches to ehr_entity_mappings
 * for future auto-resolution.
 */
async function saveAutoMappings(
  supabase: AnySupabaseClient,
  integrationId: string,
  facilityId: string,
  caseData: ExtractedCaseData,
  results: AllMatchResults,
): Promise<void> {
  const mappingsToSave: Array<{
    entity_type: 'surgeon' | 'procedure' | 'room'
    external_identifier: string
    external_display_name: string
    orbit_entity_id: string
    orbit_display_name: string
    confidence: number
  }> = []

  // Surgeon: save NPI mapping if matched via fuzzy with high confidence
  if (
    results.surgeon.matched &&
    results.surgeon.matchSource === 'fuzzy' &&
    results.surgeon.confidence &&
    results.surgeon.confidence >= AUTO_MAP_THRESHOLD &&
    results.surgeon.orbitSurgeonId
  ) {
    const identifier = caseData.surgeonInfo.npi || `${caseData.surgeonInfo.lastName}, ${caseData.surgeonInfo.firstName}`
    mappingsToSave.push({
      entity_type: 'surgeon',
      external_identifier: identifier,
      external_display_name: `${caseData.surgeonInfo.lastName}, ${caseData.surgeonInfo.firstName}`,
      orbit_entity_id: results.surgeon.orbitSurgeonId,
      orbit_display_name: results.surgeon.orbitDisplayName || '',
      confidence: results.surgeon.confidence,
    })
  }

  // Procedure: save CPT mapping if matched via fuzzy
  if (
    results.procedure.matched &&
    results.procedure.matchSource === 'fuzzy' &&
    results.procedure.confidence &&
    results.procedure.confidence >= AUTO_MAP_THRESHOLD &&
    results.procedure.orbitProcedureId
  ) {
    const identifier = caseData.procedureInfo.cptCode || caseData.procedureInfo.procedureName
    mappingsToSave.push({
      entity_type: 'procedure',
      external_identifier: identifier,
      external_display_name: caseData.procedureInfo.procedureName,
      orbit_entity_id: results.procedure.orbitProcedureId,
      orbit_display_name: results.procedure.orbitDisplayName || '',
      confidence: results.procedure.confidence,
    })
  }

  // Room: save room code mapping if matched via fuzzy
  if (
    results.room.matched &&
    results.room.matchSource === 'fuzzy' &&
    results.room.confidence &&
    results.room.confidence >= AUTO_MAP_THRESHOLD &&
    results.room.orbitRoomId
  ) {
    const identifier = caseData.roomInfo.roomCode || caseData.roomInfo.roomDescription
    mappingsToSave.push({
      entity_type: 'room',
      external_identifier: identifier,
      external_display_name: caseData.roomInfo.roomDescription || caseData.roomInfo.roomCode,
      orbit_entity_id: results.room.orbitRoomId,
      orbit_display_name: results.room.orbitDisplayName || '',
      confidence: results.room.confidence,
    })
  }

  // Save all mappings in parallel
  await Promise.all(
    mappingsToSave.map(m =>
      ehrDAL.saveEntityMapping(supabase, {
        facility_id: facilityId,
        integration_id: integrationId,
        entity_type: m.entity_type,
        external_identifier: m.external_identifier,
        external_display_name: m.external_display_name,
        orbit_entity_id: m.orbit_entity_id,
        orbit_display_name: m.orbit_display_name,
        match_method: 'auto',
        match_confidence: m.confidence,
      }),
    ),
  )
}

// =====================================================
// DATA EXTRACTION HELPERS
// =====================================================

/**
 * Extract case data from a parsed SIU message.
 * Uses system-specific field preferences for surgeon extraction.
 */
function extractCaseData(siu: SIUMessage, integrationType: EhrIntegrationType): ExtractedCaseData {
  // Extract surgeon using system-specific field priority
  const surgeonInfo = extractSurgeonInfo(siu, integrationType)

  // Extract scheduled date and time from SCH-11 or AIS
  const startDateTimeIso = siu.sch.startDateTime || siu.ais?.startDateTime || null
  let scheduledDate = ''
  let startTime: string | null = null

  if (startDateTimeIso) {
    // ISO format: "2026-03-15T08:00:00" or "2026-03-15"
    scheduledDate = startDateTimeIso.substring(0, 10) // YYYY-MM-DD
    if (startDateTimeIso.length > 10) {
      startTime = startDateTimeIso.substring(11, 19) // HH:MM:SS
    }
  }

  // Primary diagnosis (first DG1 segment)
  const primaryDiagnosis = siu.dg1.length > 0 ? siu.dg1[0] : null

  // Room info from AIL or PV1
  const roomCode = siu.ail?.locationCode || siu.pv1.assignedLocation || ''
  const roomDescription = siu.ail?.locationDescription || ''

  return {
    externalCaseId: siu.sch.placerAppointmentId,
    scheduledDate,
    startTime,
    notes: siu.sch.appointmentReason || null,
    diagnosisCode: primaryDiagnosis?.diagnosisCode || null,
    diagnosisDesc: primaryDiagnosis?.diagnosisDescription || null,
    patient: {
      mrn: siu.pid.patientId,
      firstName: siu.pid.firstName,
      lastName: siu.pid.lastName,
      dateOfBirth: siu.pid.dateOfBirth,
      gender: siu.pid.gender,
      externalPatientId: siu.pid.patientId, // Use MRN as external ID
    },
    surgeonInfo,
    procedureInfo: {
      cptCode: siu.ais?.procedureCode || '',
      procedureName: siu.ais?.procedureDescription || '',
    },
    roomInfo: {
      roomCode,
      roomDescription,
    },
  }
}

/**
 * Build parsed_data JSONB from SIU message for log storage.
 */
function buildParsedData(siu: SIUMessage): Record<string, unknown> {
  return {
    triggerEvent: siu.triggerEvent,
    messageType: siu.msh.messageType,
    messageControlId: siu.msh.messageControlId,
    sendingApplication: siu.msh.sendingApplication,
    sendingFacility: siu.msh.sendingFacility,
    externalCaseId: siu.sch.placerAppointmentId,
    fillerAppointmentId: siu.sch.fillerAppointmentId,
    scheduledStart: siu.sch.startDateTime,
    scheduledEnd: siu.sch.endDateTime,
    status: siu.sch.fillerStatusCode,
    patient: {
      mrn: siu.pid.patientId,
      firstName: siu.pid.firstName,
      lastName: siu.pid.lastName,
      dateOfBirth: siu.pid.dateOfBirth,
      gender: siu.pid.gender,
    },
    surgeon: siu.aip.find(a => a.role.toUpperCase() === 'SURGEON')
      ? {
          id: siu.aip.find(a => a.role.toUpperCase() === 'SURGEON')!.personnelId,
          npi: siu.aip.find(a => a.role.toUpperCase() === 'SURGEON')!.personnelNPI,
          name: `${siu.aip.find(a => a.role.toUpperCase() === 'SURGEON')!.personnelLastName}, ${siu.aip.find(a => a.role.toUpperCase() === 'SURGEON')!.personnelFirstName}`,
        }
      : siu.pv1.attendingDoctor
        ? { id: siu.pv1.attendingDoctor.id, npi: siu.pv1.attendingDoctor.npi, name: `${siu.pv1.attendingDoctor.lastName}, ${siu.pv1.attendingDoctor.firstName}` }
        : null,
    procedure: siu.ais
      ? { cptCode: siu.ais.procedureCode, name: siu.ais.procedureDescription }
      : null,
    room: siu.ail
      ? { code: siu.ail.locationCode, name: siu.ail.locationDescription }
      : { code: siu.pv1.assignedLocation, name: '' },
    diagnoses: siu.dg1.map(d => ({
      code: d.diagnosisCode,
      description: d.diagnosisDescription,
      codeSystem: d.diagnosisCodeSystem,
    })),
    personnel: siu.aip.map(a => ({
      id: a.personnelId,
      name: `${a.personnelLastName}, ${a.personnelFirstName}`,
      npi: a.personnelNPI,
      role: a.role,
    })),
  }
}
