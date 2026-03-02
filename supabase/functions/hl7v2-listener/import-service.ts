/**
 * Case Import Service — Deno Edge Function Version
 *
 * Adapted from lib/integrations/epic/case-import-service.ts for Deno runtime.
 * Inlines all dependencies: matchers, DAL operations, logger, similarity scoring.
 *
 * Main orchestrator for processing SIU messages into ORbit cases.
 * Routes by trigger event: S12 → create, S13/S14 → update, S15/S16 → cancel.
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type {
  SIUMessage,
  EhrIntegration,
  EhrIntegrationLog,
  EntitySuggestion,
  ReviewNotes,
} from './types.ts';

// =====================================================
// CONSTANTS
// =====================================================

const AUTO_MAP_THRESHOLD = 0.90;
const SUGGEST_THRESHOLD = 0.70;

// =====================================================
// CHANGE TRACKING
// =====================================================

/**
 * Tag the most recent case_history entry for a case with the correct
 * change_source and ehr_integration_log_id.
 * Uses the tag_latest_case_history RPC (SECURITY DEFINER, bypasses RLS).
 */
async function tagCaseHistoryEntry(
  supabase: SupabaseClient,
  caseId: string,
  logEntryId: string,
): Promise<void> {
  const { error } = await supabase.rpc('tag_latest_case_history', {
    p_case_id: caseId,
    p_change_source: 'epic_hl7v2',
    p_ehr_log_id: logEntryId,
  });
  if (error) {
    console.warn('[import] Failed to tag case history:', error.message);
  }
}

// =====================================================
// PUBLIC TYPES
// =====================================================

export interface ImportResult {
  success: boolean;
  action: 'created' | 'updated' | 'cancelled' | 'pending_review' | 'duplicate' | 'ignored' | 'error';
  caseId: string | null;
  logEntryId: string | null;
  errorMessage: string | null;
}

// =====================================================
// INTERNAL TYPES
// =====================================================

interface PatientData {
  mrn: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  gender: string;
  externalPatientId?: string;
}

interface DemographicsMismatch {
  field: string;
  expected: string;
  received: string;
}

interface PatientMatchResult {
  patientId: string | null;
  demographicsMismatch: DemographicsMismatch | null;
}

interface ProviderMatchResult {
  matched: boolean;
  orbitSurgeonId: string | null;
  orbitDisplayName: string | null;
  confidence: number | null;
  matchSource: 'mapping' | 'fuzzy' | 'none';
  suggestions: EntitySuggestion[];
}

interface ProcedureMatchResult {
  matched: boolean;
  orbitProcedureId: string | null;
  orbitDisplayName: string | null;
  confidence: number | null;
  matchSource: 'mapping' | 'fuzzy' | 'none';
  suggestions: EntitySuggestion[];
}

interface RoomMatchResult {
  matched: boolean;
  orbitRoomId: string | null;
  orbitDisplayName: string | null;
  confidence: number | null;
  matchSource: 'mapping' | 'exact' | 'fuzzy' | 'none';
  suggestions: EntitySuggestion[];
}

interface AllMatchResults {
  patient: PatientMatchResult;
  surgeon: ProviderMatchResult;
  procedure: ProcedureMatchResult;
  room: RoomMatchResult;
}

interface ExtractedCaseData {
  externalCaseId: string;
  scheduledDate: string;
  startTime: string | null;
  notes: string | null;
  diagnosisCode: string | null;
  diagnosisDesc: string | null;
  patient: PatientData;
  surgeonInfo: { npi: string; lastName: string; firstName: string; middleName: string };
  procedureInfo: { cptCode: string; procedureName: string };
  roomInfo: { roomCode: string; roomDescription: string };
}

interface UnmatchedEntities {
  surgeon?: { name: string; npi?: string; suggestions: EntitySuggestion[] };
  procedure?: { cpt: string; name: string; suggestions: EntitySuggestion[] };
  room?: { name: string; suggestions: EntitySuggestion[] };
  demographicsMismatch?: DemographicsMismatch;
}

// =====================================================
// MAIN ENTRY POINT
// =====================================================

export async function handleSIUMessage(
  supabase: SupabaseClient,
  siu: SIUMessage,
  integration: EhrIntegration,
  rawMessage: string,
): Promise<ImportResult> {
  const facilityId = integration.facility_id;
  const integrationId = integration.id;

  try {
    // 1. Check message dedup (MSH-10)
    if (siu.msh.messageControlId) {
      const existing = await checkDuplicateMessage(supabase, integrationId, siu.msh.messageControlId);
      if (existing) {
        console.log('[import] Duplicate message detected:', siu.msh.messageControlId);
        return {
          success: true,
          action: 'duplicate',
          caseId: existing.case_id,
          logEntryId: existing.id,
          errorMessage: null,
        };
      }
    }

    // 2. Log message as 'received'
    const externalCaseId = siu.sch.placerAppointmentId;
    const logEntry = await createLogEntry(supabase, {
      facility_id: facilityId,
      integration_id: integrationId,
      message_type: `SIU^${siu.triggerEvent}`,
      message_control_id: siu.msh.messageControlId || null,
      raw_message: rawMessage,
      parsed_data: buildParsedData(siu),
      processing_status: 'received',
      external_case_id: externalCaseId || null,
    });

    if (!logEntry) {
      return { success: false, action: 'error', caseId: null, logEntryId: null, errorMessage: 'Failed to create log entry' };
    }

    // Update integration timestamp
    await updateIntegrationTimestamp(supabase, integrationId);

    // 3. Route by trigger event
    return routeByTriggerEvent(supabase, siu, integration, logEntry, rawMessage);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error during import';
    console.error('[import] Case import failed:', errorMsg);
    return { success: false, action: 'error', caseId: null, logEntryId: null, errorMessage: errorMsg };
  }
}

// =====================================================
// TRIGGER EVENT ROUTING
// =====================================================

async function routeByTriggerEvent(
  supabase: SupabaseClient,
  siu: SIUMessage,
  integration: EhrIntegration,
  logEntry: EhrIntegrationLog,
  _rawMessage: string,
): Promise<ImportResult> {
  switch (siu.triggerEvent) {
    case 'S12':
      return handleCreate(supabase, siu, integration, logEntry);
    case 'S13':
    case 'S14':
      return handleUpdate(supabase, siu, integration, logEntry);
    case 'S15':
    case 'S16':
      return handleCancel(supabase, siu, integration, logEntry);
    default:
      await updateLogStatus(supabase, logEntry.id, 'ignored', `Unsupported trigger event: ${siu.triggerEvent}`);
      return { success: true, action: 'ignored', caseId: null, logEntryId: logEntry.id, errorMessage: null };
  }
}

// =====================================================
// S12 — CREATE NEW CASE
// =====================================================

async function handleCreate(
  supabase: SupabaseClient,
  siu: SIUMessage,
  integration: EhrIntegration,
  logEntry: EhrIntegrationLog,
): Promise<ImportResult> {
  const facilityId = integration.facility_id;
  const integrationId = integration.id;

  try {
    const caseData = extractCaseData(siu);

    // Check case-level dedup
    const { data: existingCase } = await supabase
      .from('cases')
      .select('id')
      .eq('facility_id', facilityId)
      .eq('external_case_id', caseData.externalCaseId)
      .eq('external_system', 'epic_hl7v2')
      .maybeSingle();

    if (existingCase) {
      console.log('[import] Case already exists, treating as update:', caseData.externalCaseId);
      return handleUpdate(supabase, siu, integration, logEntry);
    }

    // Match entities
    const matchResults = await matchAllEntities(supabase, integrationId, facilityId, caseData);

    // Check for unmatched
    const unmatched = collectUnmatched(caseData, matchResults);
    const hasUnmatched = !!(unmatched.surgeon || unmatched.procedure || unmatched.room || unmatched.demographicsMismatch);

    if (hasUnmatched) {
      await updateLogPendingReview(supabase, logEntry.id, unmatched);
      return { success: true, action: 'pending_review', caseId: null, logEntryId: logEntry.id, errorMessage: null };
    }

    // Create case
    const caseId = await createCase(supabase, facilityId, caseData, matchResults);

    // Tag case_history entries with HL7v2 attribution
    await tagCaseHistoryEntry(supabase, caseId, logEntry.id);

    // Auto-save high-confidence mappings
    await saveAutoMappings(supabase, integrationId, facilityId, caseData, matchResults);

    await updateLogProcessed(supabase, logEntry.id, caseId);
    console.log('[import] Case created:', caseId);

    return { success: true, action: 'created', caseId, logEntryId: logEntry.id, errorMessage: null };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error creating case';
    await updateLogStatus(supabase, logEntry.id, 'error', errorMsg);
    return { success: false, action: 'error', caseId: null, logEntryId: logEntry.id, errorMessage: errorMsg };
  }
}

// =====================================================
// S13/S14 — UPDATE EXISTING CASE
// =====================================================

async function handleUpdate(
  supabase: SupabaseClient,
  siu: SIUMessage,
  integration: EhrIntegration,
  logEntry: EhrIntegrationLog,
): Promise<ImportResult> {
  const facilityId = integration.facility_id;
  const integrationId = integration.id;
  const externalCaseId = siu.sch.placerAppointmentId;

  try {
    const { data: existingCase } = await supabase
      .from('cases')
      .select('id')
      .eq('facility_id', facilityId)
      .eq('external_case_id', externalCaseId)
      .eq('external_system', 'epic_hl7v2')
      .maybeSingle();

    if (!existingCase) {
      console.log('[import] Case not found for update, treating as create:', externalCaseId);
      return handleCreate(supabase, siu, integration, logEntry);
    }

    const caseData = extractCaseData(siu);
    const matchResults = await matchAllEntities(supabase, integrationId, facilityId, caseData);

    const unmatched = collectUnmatched(caseData, matchResults);
    const hasUnmatched = !!(unmatched.surgeon || unmatched.procedure || unmatched.room || unmatched.demographicsMismatch);

    if (hasUnmatched) {
      await updateLogPendingReview(supabase, logEntry.id, unmatched);
      return { success: true, action: 'pending_review', caseId: existingCase.id, logEntryId: logEntry.id, errorMessage: null };
    }

    // Build update payload
    const updates: Record<string, unknown> = {};
    if (caseData.scheduledDate) updates.scheduled_date = caseData.scheduledDate;
    if (caseData.startTime) updates.start_time = caseData.startTime;
    if (matchResults.surgeon.orbitSurgeonId) updates.surgeon_id = matchResults.surgeon.orbitSurgeonId;
    if (matchResults.procedure.orbitProcedureId) updates.procedure_type_id = matchResults.procedure.orbitProcedureId;
    if (matchResults.room.orbitRoomId) updates.or_room_id = matchResults.room.orbitRoomId;
    if (caseData.diagnosisCode) updates.primary_diagnosis_code = caseData.diagnosisCode;
    if (caseData.diagnosisDesc) updates.primary_diagnosis_desc = caseData.diagnosisDesc;
    if (caseData.notes) updates.notes = caseData.notes;
    if (matchResults.patient.patientId) updates.patient_id = matchResults.patient.patientId;

    const { error: updateError } = await supabase
      .from('cases')
      .update(updates)
      .eq('id', existingCase.id);

    if (updateError) {
      throw new Error(`Case update failed: ${updateError.message}`);
    }

    // Tag case_history entry with HL7v2 attribution
    await tagCaseHistoryEntry(supabase, existingCase.id, logEntry.id);

    await saveAutoMappings(supabase, integrationId, facilityId, caseData, matchResults);
    await updateLogProcessed(supabase, logEntry.id, existingCase.id);

    return { success: true, action: 'updated', caseId: existingCase.id, logEntryId: logEntry.id, errorMessage: null };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error updating case';
    await updateLogStatus(supabase, logEntry.id, 'error', errorMsg);
    return { success: false, action: 'error', caseId: null, logEntryId: logEntry.id, errorMessage: errorMsg };
  }
}

// =====================================================
// S15/S16 — CANCEL CASE
// =====================================================

async function handleCancel(
  supabase: SupabaseClient,
  siu: SIUMessage,
  integration: EhrIntegration,
  logEntry: EhrIntegrationLog,
): Promise<ImportResult> {
  const facilityId = integration.facility_id;
  const externalCaseId = siu.sch.placerAppointmentId;

  try {
    const { data: existingCase } = await supabase
      .from('cases')
      .select('id')
      .eq('facility_id', facilityId)
      .eq('external_case_id', externalCaseId)
      .eq('external_system', 'epic_hl7v2')
      .maybeSingle();

    if (!existingCase) {
      console.log('[import] Case not found for cancellation, ignoring:', externalCaseId);
      await updateLogStatus(supabase, logEntry.id, 'ignored', `Case not found for cancellation: ${externalCaseId}`);
      return { success: true, action: 'ignored', caseId: null, logEntryId: logEntry.id, errorMessage: null };
    }

    const { data: cancelledStatus } = await supabase
      .from('case_statuses')
      .select('id')
      .eq('name', 'cancelled')
      .maybeSingle();

    if (!cancelledStatus) {
      throw new Error('Could not find "cancelled" status in case_statuses');
    }

    const { error: updateError } = await supabase
      .from('cases')
      .update({ status_id: cancelledStatus.id })
      .eq('id', existingCase.id);

    if (updateError) {
      throw new Error(`Case cancellation failed: ${updateError.message}`);
    }

    // Tag case_history entry with HL7v2 attribution
    await tagCaseHistoryEntry(supabase, existingCase.id, logEntry.id);

    await updateLogProcessed(supabase, logEntry.id, existingCase.id);
    return { success: true, action: 'cancelled', caseId: existingCase.id, logEntryId: logEntry.id, errorMessage: null };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error cancelling case';
    await updateLogStatus(supabase, logEntry.id, 'error', errorMsg);
    return { success: false, action: 'error', caseId: null, logEntryId: logEntry.id, errorMessage: errorMsg };
  }
}

// =====================================================
// ENTITY MATCHING
// =====================================================

async function matchAllEntities(
  supabase: SupabaseClient,
  integrationId: string,
  facilityId: string,
  caseData: ExtractedCaseData,
): Promise<AllMatchResults> {
  const [patientResult, surgeonResult, procedureResult, roomResult] = await Promise.all([
    matchOrCreatePatient(supabase, facilityId, caseData.patient),
    matchSurgeon(supabase, integrationId, facilityId, caseData.surgeonInfo),
    matchProcedure(supabase, integrationId, facilityId, caseData.procedureInfo),
    matchRoom(supabase, integrationId, facilityId, caseData.roomInfo),
  ]);

  return {
    patient: patientResult,
    surgeon: surgeonResult,
    procedure: procedureResult,
    room: roomResult,
  };
}

// ── Patient Matcher ─────────────────────────────────────────────────────────

async function matchOrCreatePatient(
  supabase: SupabaseClient,
  facilityId: string,
  patient: PatientData,
): Promise<PatientMatchResult> {
  if (!patient.mrn) {
    const newId = await createNewPatient(supabase, facilityId, patient);
    return { patientId: newId, demographicsMismatch: null };
  }

  const { data: existing, error } = await supabase
    .from('patients')
    .select('id, first_name, last_name, date_of_birth, is_active')
    .eq('facility_id', facilityId)
    .eq('mrn', patient.mrn)
    .maybeSingle();

  if (error) throw new Error(`Patient lookup failed: ${error.message}`);

  if (existing) {
    const mismatch = checkDemographics(existing, patient);
    return { patientId: existing.id, demographicsMismatch: mismatch };
  }

  const newId = await createNewPatient(supabase, facilityId, patient);
  return { patientId: newId, demographicsMismatch: null };
}

function checkDemographics(
  existing: { first_name: string | null; last_name: string | null; date_of_birth: string | null },
  incoming: PatientData,
): DemographicsMismatch | null {
  if (existing.last_name && incoming.lastName &&
      existing.last_name.toLowerCase() !== incoming.lastName.toLowerCase()) {
    return { field: 'last_name', expected: existing.last_name, received: incoming.lastName };
  }
  if (existing.first_name && incoming.firstName &&
      existing.first_name.toLowerCase() !== incoming.firstName.toLowerCase()) {
    return { field: 'first_name', expected: existing.first_name, received: incoming.firstName };
  }
  if (existing.date_of_birth && incoming.dateOfBirth) {
    const existingDob = existing.date_of_birth.substring(0, 10);
    const incomingDob = incoming.dateOfBirth.substring(0, 10);
    if (existingDob !== incomingDob) {
      return { field: 'date_of_birth', expected: existingDob, received: incomingDob };
    }
  }
  return null;
}

async function createNewPatient(
  supabase: SupabaseClient,
  facilityId: string,
  patient: PatientData,
): Promise<string> {
  const { data, error } = await supabase
    .from('patients')
    .insert({
      facility_id: facilityId,
      first_name: patient.firstName || null,
      last_name: patient.lastName || null,
      mrn: patient.mrn || null,
      date_of_birth: patient.dateOfBirth || null,
      external_patient_id: patient.externalPatientId || null,
    })
    .select('id')
    .single();

  if (error || !data) throw new Error(`Patient creation failed: ${error?.message || 'Unknown error'}`);
  return data.id;
}

// ── Surgeon Matcher ─────────────────────────────────────────────────────────

async function matchSurgeon(
  supabase: SupabaseClient,
  integrationId: string,
  facilityId: string,
  info: ExtractedCaseData['surgeonInfo'],
): Promise<ProviderMatchResult> {
  const displayName = buildProviderDisplayName(info.lastName, info.firstName, info.middleName);
  const primaryIdentifier = info.npi || displayName;

  if (!primaryIdentifier) {
    return { matched: false, orbitSurgeonId: null, orbitDisplayName: null, confidence: null, matchSource: 'none', suggestions: [] };
  }

  // Check entity mappings
  const identifiers = [info.npi, displayName].filter(Boolean);
  for (const identifier of identifiers) {
    const mapping = await getEntityMapping(supabase, integrationId, 'surgeon', identifier);
    if (mapping?.orbit_entity_id) {
      return { matched: true, orbitSurgeonId: mapping.orbit_entity_id, orbitDisplayName: mapping.orbit_display_name, confidence: 1.0, matchSource: 'mapping', suggestions: [] };
    }
  }

  // Get surgeons for facility
  const surgeons = await listSurgeons(supabase, facilityId);
  if (surgeons.length === 0) {
    return { matched: false, orbitSurgeonId: null, orbitDisplayName: null, confidence: null, matchSource: 'none', suggestions: [] };
  }

  // Fuzzy match
  let bestMatch: { id: string; first_name: string; last_name: string } | null = null;
  let bestScore = 0;

  for (const surgeon of surgeons) {
    const orbitName = `${surgeon.last_name}, ${surgeon.first_name}`;
    const score = similarityScore(displayName, orbitName);
    if (score > bestScore) { bestScore = score; bestMatch = surgeon; }

    const scoreAlt = similarityScore(`${info.firstName} ${info.lastName}`, `${surgeon.first_name} ${surgeon.last_name}`);
    if (scoreAlt > bestScore) { bestScore = scoreAlt; bestMatch = surgeon; }
  }

  // Build suggestions
  const suggestions: EntitySuggestion[] = [];
  for (const surgeon of surgeons) {
    const orbitName = `${surgeon.last_name}, ${surgeon.first_name}`;
    const maxScore = Math.max(
      similarityScore(displayName, orbitName),
      similarityScore(`${info.firstName} ${info.lastName}`, `${surgeon.first_name} ${surgeon.last_name}`),
    );
    if (maxScore >= SUGGEST_THRESHOLD) {
      suggestions.push({
        orbit_entity_id: surgeon.id,
        orbit_display_name: orbitName,
        confidence: Math.round(maxScore * 100) / 100,
        match_reason: `Name similarity: "${displayName}" → "${orbitName}"`,
      });
    }
  }
  suggestions.sort((a, b) => b.confidence - a.confidence);

  if (bestMatch && bestScore >= AUTO_MAP_THRESHOLD) {
    const orbitName = `${bestMatch.last_name}, ${bestMatch.first_name}`;
    return { matched: true, orbitSurgeonId: bestMatch.id, orbitDisplayName: orbitName, confidence: Math.round(bestScore * 100) / 100, matchSource: 'fuzzy', suggestions };
  }

  return { matched: false, orbitSurgeonId: null, orbitDisplayName: null, confidence: bestScore > 0 ? Math.round(bestScore * 100) / 100 : null, matchSource: 'none', suggestions };
}

// ── Procedure Matcher ───────────────────────────────────────────────────────

async function matchProcedure(
  supabase: SupabaseClient,
  integrationId: string,
  facilityId: string,
  info: ExtractedCaseData['procedureInfo'],
): Promise<ProcedureMatchResult> {
  const primaryIdentifier = info.cptCode || info.procedureName;
  if (!primaryIdentifier) {
    return { matched: false, orbitProcedureId: null, orbitDisplayName: null, confidence: null, matchSource: 'none', suggestions: [] };
  }

  // Check entity mappings
  const identifiers = [info.cptCode, info.procedureName].filter(Boolean);
  for (const identifier of identifiers) {
    const mapping = await getEntityMapping(supabase, integrationId, 'procedure', identifier);
    if (mapping?.orbit_entity_id) {
      return { matched: true, orbitProcedureId: mapping.orbit_entity_id, orbitDisplayName: mapping.orbit_display_name, confidence: 1.0, matchSource: 'mapping', suggestions: [] };
    }
  }

  // Get procedures for facility
  const procedures = await listProcedureTypes(supabase, facilityId);
  if (procedures.length === 0) {
    return { matched: false, orbitProcedureId: null, orbitDisplayName: null, confidence: null, matchSource: 'none', suggestions: [] };
  }

  // Fuzzy match
  let bestMatch: { id: string; name: string } | null = null;
  let bestScore = 0;

  for (const proc of procedures) {
    const score = similarityScore(info.procedureName, proc.name);
    if (score > bestScore) { bestScore = score; bestMatch = proc; }
  }

  const suggestions: EntitySuggestion[] = [];
  for (const proc of procedures) {
    const score = similarityScore(info.procedureName, proc.name);
    if (score >= SUGGEST_THRESHOLD) {
      suggestions.push({
        orbit_entity_id: proc.id,
        orbit_display_name: proc.name,
        confidence: Math.round(score * 100) / 100,
        match_reason: `Name similarity: "${info.procedureName}" → "${proc.name}"`,
      });
    }
  }
  suggestions.sort((a, b) => b.confidence - a.confidence);

  if (bestMatch && bestScore >= AUTO_MAP_THRESHOLD) {
    return { matched: true, orbitProcedureId: bestMatch.id, orbitDisplayName: bestMatch.name, confidence: Math.round(bestScore * 100) / 100, matchSource: 'fuzzy', suggestions };
  }

  return { matched: false, orbitProcedureId: null, orbitDisplayName: null, confidence: bestScore > 0 ? Math.round(bestScore * 100) / 100 : null, matchSource: 'none', suggestions };
}

// ── Room Matcher ────────────────────────────────────────────────────────────

async function matchRoom(
  supabase: SupabaseClient,
  integrationId: string,
  facilityId: string,
  info: ExtractedCaseData['roomInfo'],
): Promise<RoomMatchResult> {
  const externalIdentifier = info.roomCode || info.roomDescription;
  if (!externalIdentifier) {
    return { matched: false, orbitRoomId: null, orbitDisplayName: null, confidence: null, matchSource: 'none', suggestions: [] };
  }

  // Check entity mappings
  const mapping = await getEntityMapping(supabase, integrationId, 'room', externalIdentifier);
  if (mapping?.orbit_entity_id) {
    return { matched: true, orbitRoomId: mapping.orbit_entity_id, orbitDisplayName: mapping.orbit_display_name, confidence: 1.0, matchSource: 'mapping', suggestions: [] };
  }

  // Get rooms for facility
  const rooms = await listRooms(supabase, facilityId);
  if (rooms.length === 0) {
    return { matched: false, orbitRoomId: null, orbitDisplayName: null, confidence: null, matchSource: 'none', suggestions: [] };
  }

  // Normalized exact match
  const normalizedInput = normalizeRoomName(info.roomDescription || info.roomCode);
  for (const room of rooms) {
    if (normalizeRoomName(room.name) === normalizedInput) {
      return { matched: true, orbitRoomId: room.id, orbitDisplayName: room.name, confidence: 1.0, matchSource: 'exact', suggestions: [] };
    }
  }

  // Fuzzy match
  const candidates = [info.roomCode, info.roomDescription].filter(Boolean);
  let bestMatch: { id: string; name: string } | null = null;
  let bestScore = 0;

  for (const candidate of candidates) {
    for (const room of rooms) {
      const score = similarityScore(normalizeRoomName(candidate), normalizeRoomName(room.name));
      if (score > bestScore) { bestScore = score; bestMatch = room; }
    }
  }

  const suggestions: EntitySuggestion[] = [];
  for (const room of rooms) {
    const maxScore = Math.max(...candidates.map(c => similarityScore(normalizeRoomName(c), normalizeRoomName(room.name))));
    if (maxScore >= SUGGEST_THRESHOLD) {
      suggestions.push({
        orbit_entity_id: room.id,
        orbit_display_name: room.name,
        confidence: Math.round(maxScore * 100) / 100,
        match_reason: `Fuzzy match: "${info.roomDescription || info.roomCode}" → "${room.name}"`,
      });
    }
  }
  suggestions.sort((a, b) => b.confidence - a.confidence);

  if (bestMatch && bestScore >= AUTO_MAP_THRESHOLD) {
    return { matched: true, orbitRoomId: bestMatch.id, orbitDisplayName: bestMatch.name, confidence: Math.round(bestScore * 100) / 100, matchSource: 'fuzzy', suggestions };
  }

  return { matched: false, orbitRoomId: null, orbitDisplayName: null, confidence: bestScore > 0 ? Math.round(bestScore * 100) / 100 : null, matchSource: 'none', suggestions };
}

// =====================================================
// CASE CREATION
// =====================================================

async function createCase(
  supabase: SupabaseClient,
  facilityId: string,
  caseData: ExtractedCaseData,
  matchResults: AllMatchResults,
): Promise<string> {
  const { data: scheduledStatus } = await supabase
    .from('case_statuses')
    .select('id')
    .eq('name', 'scheduled')
    .maybeSingle();

  if (!scheduledStatus) throw new Error('Could not find "scheduled" status in case_statuses');

  const caseNumber = `HL7-${caseData.externalCaseId}`;

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
    p_source: 'epic',
  });

  if (rpcError || !caseId) {
    throw new Error(`create_case_with_milestones failed: ${rpcError?.message || 'No case ID returned'}`);
  }

  // Set external tracking columns
  const { error: updateError } = await supabase
    .from('cases')
    .update({
      external_case_id: caseData.externalCaseId,
      external_system: 'epic_hl7v2',
      import_source: 'hl7v2',
      primary_diagnosis_code: caseData.diagnosisCode,
      primary_diagnosis_desc: caseData.diagnosisDesc,
    })
    .eq('id', caseId);

  if (updateError) {
    console.warn('[import] Failed to set external tracking columns:', updateError.message);
  }

  return caseId as string;
}

// =====================================================
// AUTO-MAPPING PERSISTENCE
// =====================================================

async function saveAutoMappings(
  supabase: SupabaseClient,
  integrationId: string,
  facilityId: string,
  caseData: ExtractedCaseData,
  results: AllMatchResults,
): Promise<void> {
  const mappings: Array<{
    entity_type: 'surgeon' | 'procedure' | 'room';
    external_identifier: string;
    external_display_name: string;
    orbit_entity_id: string;
    orbit_display_name: string;
    confidence: number;
  }> = [];

  if (results.surgeon.matched && results.surgeon.matchSource === 'fuzzy' &&
      results.surgeon.confidence && results.surgeon.confidence >= AUTO_MAP_THRESHOLD && results.surgeon.orbitSurgeonId) {
    const identifier = caseData.surgeonInfo.npi || `${caseData.surgeonInfo.lastName}, ${caseData.surgeonInfo.firstName}`;
    mappings.push({
      entity_type: 'surgeon',
      external_identifier: identifier,
      external_display_name: `${caseData.surgeonInfo.lastName}, ${caseData.surgeonInfo.firstName}`,
      orbit_entity_id: results.surgeon.orbitSurgeonId,
      orbit_display_name: results.surgeon.orbitDisplayName || '',
      confidence: results.surgeon.confidence,
    });
  }

  if (results.procedure.matched && results.procedure.matchSource === 'fuzzy' &&
      results.procedure.confidence && results.procedure.confidence >= AUTO_MAP_THRESHOLD && results.procedure.orbitProcedureId) {
    const identifier = caseData.procedureInfo.cptCode || caseData.procedureInfo.procedureName;
    mappings.push({
      entity_type: 'procedure',
      external_identifier: identifier,
      external_display_name: caseData.procedureInfo.procedureName,
      orbit_entity_id: results.procedure.orbitProcedureId,
      orbit_display_name: results.procedure.orbitDisplayName || '',
      confidence: results.procedure.confidence,
    });
  }

  if (results.room.matched && results.room.matchSource === 'fuzzy' &&
      results.room.confidence && results.room.confidence >= AUTO_MAP_THRESHOLD && results.room.orbitRoomId) {
    const identifier = caseData.roomInfo.roomCode || caseData.roomInfo.roomDescription;
    mappings.push({
      entity_type: 'room',
      external_identifier: identifier,
      external_display_name: caseData.roomInfo.roomDescription || caseData.roomInfo.roomCode,
      orbit_entity_id: results.room.orbitRoomId,
      orbit_display_name: results.room.orbitDisplayName || '',
      confidence: results.room.confidence,
    });
  }

  await Promise.all(
    mappings.map(m =>
      supabase
        .from('ehr_entity_mappings')
        .upsert({
          facility_id: facilityId,
          integration_id: integrationId,
          entity_type: m.entity_type,
          external_identifier: m.external_identifier,
          external_display_name: m.external_display_name,
          orbit_entity_id: m.orbit_entity_id,
          orbit_display_name: m.orbit_display_name,
          match_method: 'auto',
          match_confidence: m.confidence,
        }, { onConflict: 'integration_id,entity_type,external_identifier' })
    ),
  );
}

// =====================================================
// UNMATCHED COLLECTION
// =====================================================

function collectUnmatched(caseData: ExtractedCaseData, results: AllMatchResults): UnmatchedEntities {
  const unmatched: UnmatchedEntities = {};

  if (!results.surgeon.matched) {
    unmatched.surgeon = {
      name: `${caseData.surgeonInfo.lastName}, ${caseData.surgeonInfo.firstName}`,
      npi: caseData.surgeonInfo.npi || undefined,
      suggestions: results.surgeon.suggestions,
    };
  }
  if (!results.procedure.matched) {
    unmatched.procedure = {
      cpt: caseData.procedureInfo.cptCode,
      name: caseData.procedureInfo.procedureName,
      suggestions: results.procedure.suggestions,
    };
  }
  if (!results.room.matched) {
    unmatched.room = {
      name: caseData.roomInfo.roomDescription || caseData.roomInfo.roomCode,
      suggestions: results.room.suggestions,
    };
  }
  if (results.patient.demographicsMismatch) {
    unmatched.demographicsMismatch = results.patient.demographicsMismatch;
  }

  return unmatched;
}

// =====================================================
// DATA EXTRACTION
// =====================================================

function extractCaseData(siu: SIUMessage): ExtractedCaseData {
  const surgeonAip = siu.aip.find(a => a.role.toUpperCase() === 'SURGEON');

  let surgeonInfo: ExtractedCaseData['surgeonInfo'];
  if (surgeonAip) {
    surgeonInfo = { npi: surgeonAip.personnelNPI, lastName: surgeonAip.personnelLastName, firstName: surgeonAip.personnelFirstName, middleName: surgeonAip.personnelMiddleName };
  } else if (siu.pv1.attendingDoctor) {
    surgeonInfo = { npi: siu.pv1.attendingDoctor.npi, lastName: siu.pv1.attendingDoctor.lastName, firstName: siu.pv1.attendingDoctor.firstName, middleName: siu.pv1.attendingDoctor.middleName };
  } else {
    surgeonInfo = { npi: '', lastName: '', firstName: '', middleName: '' };
  }

  const startDateTimeIso = siu.sch.startDateTime || siu.ais?.startDateTime || null;
  let scheduledDate = '';
  let startTime: string | null = null;

  if (startDateTimeIso) {
    scheduledDate = startDateTimeIso.substring(0, 10);
    if (startDateTimeIso.length > 10) {
      startTime = startDateTimeIso.substring(11, 19);
    }
  }

  const primaryDiagnosis = siu.dg1.length > 0 ? siu.dg1[0] : null;
  const roomCode = siu.ail?.locationCode || siu.pv1.assignedLocation || '';
  const roomDescription = siu.ail?.locationDescription || '';

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
      externalPatientId: siu.pid.patientId,
    },
    surgeonInfo,
    procedureInfo: {
      cptCode: siu.ais?.procedureCode || '',
      procedureName: siu.ais?.procedureDescription || '',
    },
    roomInfo: { roomCode, roomDescription },
  };
}

function buildParsedData(siu: SIUMessage): Record<string, unknown> {
  const surgeonAip = siu.aip.find(a => a.role.toUpperCase() === 'SURGEON');
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
    surgeon: surgeonAip
      ? { id: surgeonAip.personnelId, npi: surgeonAip.personnelNPI, name: `${surgeonAip.personnelLastName}, ${surgeonAip.personnelFirstName}` }
      : siu.pv1.attendingDoctor
        ? { id: siu.pv1.attendingDoctor.id, npi: siu.pv1.attendingDoctor.npi, name: `${siu.pv1.attendingDoctor.lastName}, ${siu.pv1.attendingDoctor.firstName}` }
        : null,
    procedure: siu.ais
      ? { cptCode: siu.ais.procedureCode, name: siu.ais.procedureDescription }
      : null,
    room: siu.ail
      ? { code: siu.ail.locationCode, name: siu.ail.locationDescription }
      : { code: siu.pv1.assignedLocation, name: '' },
    diagnoses: siu.dg1.map(d => ({ code: d.diagnosisCode, description: d.diagnosisDescription, codeSystem: d.diagnosisCodeSystem })),
    personnel: siu.aip.map(a => ({ id: a.personnelId, name: `${a.personnelLastName}, ${a.personnelFirstName}`, npi: a.personnelNPI, role: a.role })),
  };
}

// =====================================================
// INLINED DAL OPERATIONS
// =====================================================

async function checkDuplicateMessage(
  supabase: SupabaseClient,
  integrationId: string,
  messageControlId: string,
): Promise<EhrIntegrationLog | null> {
  const { data } = await supabase
    .from('ehr_integration_log')
    .select('*')
    .eq('integration_id', integrationId)
    .eq('message_control_id', messageControlId)
    .in('processing_status', ['processed', 'pending_review'])
    .maybeSingle();

  return data as unknown as EhrIntegrationLog | null;
}

async function createLogEntry(
  supabase: SupabaseClient,
  entry: Record<string, unknown>,
): Promise<EhrIntegrationLog | null> {
  const { data, error } = await supabase
    .from('ehr_integration_log')
    .insert(entry)
    .select('*')
    .single();

  if (error) {
    console.error('[import] Failed to create log entry:', error.message);
    return null;
  }
  return data as unknown as EhrIntegrationLog;
}

async function updateLogProcessed(
  supabase: SupabaseClient,
  logId: string,
  caseId: string,
): Promise<void> {
  await supabase
    .from('ehr_integration_log')
    .update({ processing_status: 'processed', case_id: caseId, processed_at: new Date().toISOString() })
    .eq('id', logId);
}

async function updateLogPendingReview(
  supabase: SupabaseClient,
  logId: string,
  unmatched: UnmatchedEntities,
): Promise<void> {
  const reviewNotes: ReviewNotes = {};
  if (unmatched.surgeon) reviewNotes.unmatched_surgeon = { name: unmatched.surgeon.name, npi: unmatched.surgeon.npi, suggestions: unmatched.surgeon.suggestions };
  if (unmatched.procedure) reviewNotes.unmatched_procedure = { cpt: unmatched.procedure.cpt, name: unmatched.procedure.name, suggestions: unmatched.procedure.suggestions };
  if (unmatched.room) reviewNotes.unmatched_room = { name: unmatched.room.name, suggestions: unmatched.room.suggestions };
  if (unmatched.demographicsMismatch) reviewNotes.demographics_mismatch = unmatched.demographicsMismatch;

  await supabase
    .from('ehr_integration_log')
    .update({ processing_status: 'pending_review', review_notes: reviewNotes })
    .eq('id', logId);
}

async function updateLogStatus(
  supabase: SupabaseClient,
  logId: string,
  status: string,
  errorMessage?: string,
): Promise<void> {
  const updates: Record<string, unknown> = { processing_status: status };
  if (errorMessage) updates.error_message = errorMessage;
  if (status === 'processed') updates.processed_at = new Date().toISOString();

  await supabase
    .from('ehr_integration_log')
    .update(updates)
    .eq('id', logId);
}

async function updateIntegrationTimestamp(
  supabase: SupabaseClient,
  integrationId: string,
): Promise<void> {
  await supabase
    .from('ehr_integrations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', integrationId);
}

async function getEntityMapping(
  supabase: SupabaseClient,
  integrationId: string,
  entityType: string,
  externalIdentifier: string,
): Promise<{ orbit_entity_id: string | null; orbit_display_name: string | null } | null> {
  const { data } = await supabase
    .from('ehr_entity_mappings')
    .select('orbit_entity_id, orbit_display_name')
    .eq('integration_id', integrationId)
    .eq('entity_type', entityType)
    .eq('external_identifier', externalIdentifier)
    .maybeSingle();

  return data;
}

async function listSurgeons(
  supabase: SupabaseClient,
  facilityId: string,
): Promise<Array<{ id: string; first_name: string; last_name: string }>> {
  const { data: role } = await supabase
    .from('user_roles')
    .select('id')
    .eq('name', 'surgeon')
    .single();

  if (!role) return [];

  const { data } = await supabase
    .from('users')
    .select('id, first_name, last_name')
    .eq('facility_id', facilityId)
    .eq('role_id', role.id)
    .eq('is_active', true)
    .order('last_name');

  return (data as Array<{ id: string; first_name: string; last_name: string }>) || [];
}

async function listProcedureTypes(
  supabase: SupabaseClient,
  facilityId: string,
): Promise<Array<{ id: string; name: string }>> {
  const { data } = await supabase
    .from('procedure_types')
    .select('id, name')
    .eq('facility_id', facilityId)
    .eq('is_active', true)
    .order('name');

  return (data as Array<{ id: string; name: string }>) || [];
}

async function listRooms(
  supabase: SupabaseClient,
  facilityId: string,
): Promise<Array<{ id: string; name: string }>> {
  const { data } = await supabase
    .from('or_rooms')
    .select('id, name')
    .eq('facility_id', facilityId)
    .eq('is_active', true)
    .order('display_order');

  return (data as Array<{ id: string; name: string }>) || [];
}

// =====================================================
// INLINED UTILITY FUNCTIONS
// =====================================================

function buildProviderDisplayName(lastName: string, firstName: string, middleName?: string): string {
  const parts = [lastName, firstName].filter(Boolean);
  if (middleName) parts.push(middleName);
  return parts.length >= 2 ? `${parts[0]}, ${parts.slice(1).join(' ')}` : parts[0] || '';
}

function normalizeRoomName(name: string): string {
  let n = name.trim().toLowerCase();
  n = n.replace(/operating\s+room/gi, 'or');
  n = n.replace(/([a-z])(\d)/g, '$1 $2');
  n = n.replace(/\s+/g, ' ');
  return n.trim();
}

/**
 * Levenshtein distance between two strings (inlined from lib/epic/auto-matcher.ts).
 */
function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  if (m === 0) return n;
  if (n === 0) return m;

  const prev = new Array<number>(n + 1);
  const curr = new Array<number>(n + 1);

  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,      // deletion
        curr[j - 1] + 1,  // insertion
        prev[j - 1] + cost, // substitution
      );
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }

  return prev[n];
}

/**
 * Similarity score 0-1 using Levenshtein distance (inlined from lib/epic/auto-matcher.ts).
 */
function similarityScore(a: string, b: string): number {
  const normA = a.trim().toLowerCase();
  const normB = b.trim().toLowerCase();

  if (normA === normB) return 1.0;
  if (normA.length === 0 || normB.length === 0) return 0.0;

  const distance = levenshteinDistance(normA, normB);
  const maxLen = Math.max(normA.length, normB.length);

  return 1 - distance / maxLen;
}
