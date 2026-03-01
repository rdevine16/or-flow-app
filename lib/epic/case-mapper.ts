/**
 * Epic Case Mapper
 *
 * Transforms FHIR Appointment data into ORbit case creation payloads.
 * Reads field mappings from epic_field_mappings table at import time (fully dynamic).
 * Uses entity mappings to resolve FHIR references to ORbit UUIDs.
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { epicDAL } from '@/lib/dal'
import { logger } from '@/lib/logger'
import type {
  EpicFieldMapping,
  EpicEntityMapping,
  FhirAppointment,
  FhirHumanName,
  FhirIdentifier,
} from './types'
import type { ResolvedAppointment } from './fhir-client'

const log = logger('epic-case-mapper')

// =====================================================
// TYPES
// =====================================================

/** Preview row shown in the import table before user confirms */
export interface CaseImportPreview {
  fhirAppointmentId: string
  scheduledDate: string | null
  startTime: string | null
  patientName: string | null
  patientMrn: string | null
  patientDob: string | null
  surgeonName: string | null
  surgeonId: string | null        // ORbit UUID (null if unmapped)
  roomName: string | null
  roomId: string | null            // ORbit UUID (null if unmapped)
  procedureName: string | null
  procedureTypeId: string | null   // ORbit UUID (null if unmapped)
  epicPractitionerId: string | null
  epicLocationId: string | null
  epicServiceType: string | null
  status: 'ready' | 'missing_mappings' | 'already_imported'
  missingMappings: string[]        // Which mappings are missing
  resolved: ResolvedAppointment
}

/** Parameters for creating a case from an import preview */
export interface CaseImportResult {
  success: boolean
  caseId: string | null
  patientId: string | null
  error: string | null
}

// =====================================================
// FIELD EXTRACTION HELPERS
// =====================================================

/** Get the official or first name from a FHIR HumanName array */
function extractName(names: FhirHumanName[] | undefined): { given: string | null; family: string | null } {
  if (!names || names.length === 0) return { given: null, family: null }

  // Prefer 'official' use, fall back to first name
  const name = names.find(n => n.use === 'official') ?? names[0]
  return {
    given: name.given?.[0] ?? null,
    family: name.family ?? null,
  }
}

/** Extract MRN from FHIR identifiers */
function extractMrn(identifiers: FhirIdentifier[] | undefined): string | null {
  if (!identifiers) return null

  // Look for MRN type code
  const mrnIdentifier = identifiers.find(id => {
    const typeCoding = id.type?.coding
    if (typeCoding) {
      return typeCoding.some(c => c.code === 'MR' || c.code === 'MRN')
    }
    // Fall back to system check
    return id.system?.includes('mrn') || id.system?.includes('MRN')
  })

  return mrnIdentifier?.value ?? identifiers[0]?.value ?? null
}

/** Extract participant reference ID by resource type */
function extractParticipantId(appointment: FhirAppointment, resourceType: string): string | null {
  for (const p of appointment.participant) {
    const ref = p.actor?.reference
    if (ref?.startsWith(`${resourceType}/`)) {
      return ref.split('/').pop() ?? null
    }
  }
  return null
}

/** Extract participant display name by resource type */
function extractParticipantDisplay(appointment: FhirAppointment, resourceType: string): string | null {
  for (const p of appointment.participant) {
    const ref = p.actor?.reference
    if (ref?.startsWith(`${resourceType}/`)) {
      return p.actor?.display ?? null
    }
  }
  return null
}

/** Parse ISO datetime to date string (YYYY-MM-DD) */
function isoToDate(isoStr: string | undefined): string | null {
  if (!isoStr) return null
  try {
    const date = new Date(isoStr)
    return date.toISOString().split('T')[0]
  } catch {
    return null
  }
}

/** Parse ISO datetime to time string (HH:MM:SS) */
function isoToTime(isoStr: string | undefined): string | null {
  if (!isoStr) return null
  try {
    const date = new Date(isoStr)
    return date.toTimeString().split(' ')[0]  // HH:MM:SS
  } catch {
    return null
  }
}

/** Extract service type display text from appointment */
function extractServiceType(appointment: FhirAppointment): string | null {
  if (!appointment.serviceType?.length) return null
  const st = appointment.serviceType[0]
  return st.text ?? st.coding?.[0]?.display ?? null
}

// =====================================================
// MAPPER FUNCTIONS
// =====================================================

/**
 * Load active field mappings from the database.
 * Called at import time so admin changes are reflected immediately.
 */
async function loadFieldMappings(supabase: SupabaseClient): Promise<EpicFieldMapping[]> {
  const { data } = await epicDAL.listFieldMappings(supabase, true)
  return data
}

/**
 * Look up entity mapping for a given Epic resource.
 * Returns the ORbit entity UUID if mapped, null if not.
 */
function findEntityMapping(
  entityMappings: EpicEntityMapping[],
  mappingType: string,
  epicResourceId: string
): EpicEntityMapping | null {
  return entityMappings.find(
    m => m.mapping_type === mappingType && m.epic_resource_id === epicResourceId
  ) ?? null
}

/**
 * Generate an import preview for a resolved appointment.
 * Checks entity mappings and duplicate status.
 */
export async function mapAppointmentToPreview(
  supabase: SupabaseClient,
  facilityId: string,
  connectionId: string,
  resolved: ResolvedAppointment,
  entityMappings: EpicEntityMapping[],
  importedAppointmentIds: Set<string>
): Promise<CaseImportPreview> {
  const { appointment, patient, practitioner, location } = resolved

  // Extract participant IDs from appointment references
  const epicPractitionerId = extractParticipantId(appointment, 'Practitioner')
  const epicLocationId = extractParticipantId(appointment, 'Location')

  // Patient data
  const patientName = patient ? extractName(patient.name) : { given: null, family: null }
  const patientMrn = patient ? extractMrn(patient.identifier) : null

  // Practitioner name
  const practitionerName = practitioner
    ? extractName(practitioner.name)
    : { given: null, family: null }
  const surgeonDisplayName = practitionerName.family
    ? `${practitionerName.family}, ${practitionerName.given ?? ''}`.trim()
    : extractParticipantDisplay(appointment, 'Practitioner')

  // Location name
  const roomName = location?.name ?? extractParticipantDisplay(appointment, 'Location')

  // Service type / procedure
  const epicServiceType = extractServiceType(appointment)

  // Look up entity mappings
  const surgeonMapping = epicPractitionerId
    ? findEntityMapping(entityMappings, 'surgeon', epicPractitionerId)
    : null
  const roomMapping = epicLocationId
    ? findEntityMapping(entityMappings, 'room', epicLocationId)
    : null
  const procedureMapping = epicServiceType
    ? findEntityMapping(entityMappings, 'procedure', epicServiceType)
    : null

  // Determine missing mappings
  const missingMappings: string[] = []
  if (epicPractitionerId && !surgeonMapping?.orbit_entity_id) {
    missingMappings.push('surgeon')
  }
  if (epicLocationId && !roomMapping?.orbit_entity_id) {
    missingMappings.push('room')
  }

  // Determine status
  let status: CaseImportPreview['status'] = 'ready'
  if (importedAppointmentIds.has(appointment.id)) {
    status = 'already_imported'
  } else if (missingMappings.length > 0) {
    status = 'missing_mappings'
  }

  return {
    fhirAppointmentId: appointment.id,
    scheduledDate: isoToDate(appointment.start),
    startTime: isoToTime(appointment.start),
    patientName: patientName.family
      ? `${patientName.family}, ${patientName.given ?? ''}`.trim()
      : null,
    patientMrn: patientMrn,
    patientDob: patient?.birthDate ?? null,
    surgeonName: surgeonDisplayName,
    surgeonId: surgeonMapping?.orbit_entity_id ?? null,
    roomName: roomName,
    roomId: roomMapping?.orbit_entity_id ?? null,
    procedureName: epicServiceType,
    procedureTypeId: procedureMapping?.orbit_entity_id ?? null,
    epicPractitionerId,
    epicLocationId,
    epicServiceType,
    status,
    missingMappings,
    resolved,
  }
}

/**
 * Create an ORbit case from an import preview.
 * Creates patient record if needed, then creates case via RPC.
 */
export async function createCaseFromImport(
  supabase: SupabaseClient,
  facilityId: string,
  connectionId: string,
  preview: CaseImportPreview,
  importedBy: string,
  scheduledStatusId: string
): Promise<CaseImportResult> {
  try {
    // Load field mappings (dynamic — reads from DB each time)
    const fieldMappings = await loadFieldMappings(supabase)

    // 1. Resolve or create patient
    let patientId: string | null = null

    if (preview.resolved.patient) {
      const patient = preview.resolved.patient
      const nameInfo = extractName(patient.name)
      const mrn = extractMrn(patient.identifier)

      if (nameInfo.given || nameInfo.family) {
        // Check if patient with this MRN already exists in the facility
        if (mrn) {
          const { data: existingPatient } = await supabase
            .from('patients')
            .select('id')
            .eq('facility_id', facilityId)
            .eq('mrn', mrn)
            .maybeSingle()

          if (existingPatient) {
            patientId = existingPatient.id
            log.info('Linked to existing patient by MRN', { facilityId, mrn, patientId })
          }
        }

        // Create new patient if not found by MRN
        if (!patientId) {
          const { data: newPatient, error: patientError } = await supabase
            .from('patients')
            .insert({
              facility_id: facilityId,
              first_name: nameInfo.given,
              last_name: nameInfo.family,
              mrn: mrn,
              date_of_birth: patient.birthDate ?? null,
            })
            .select('id')
            .single()

          if (patientError) {
            log.error('Failed to create patient', { facilityId, error: patientError.message })
            return { success: false, caseId: null, patientId: null, error: `Patient creation failed: ${patientError.message}` }
          }

          patientId = newPatient.id
          log.info('Created new patient from FHIR', { facilityId, patientId })
        }
      }
    }

    // 2. Generate case number: EPIC-{fhir_appointment_id}
    const caseNumber = `EPIC-${preview.fhirAppointmentId}`

    // 3. Create case via RPC
    const { data: caseId, error: rpcError } = await supabase.rpc('create_case_with_milestones', {
      p_case_number: caseNumber,
      p_scheduled_date: preview.scheduledDate,
      p_start_time: preview.startTime,
      p_or_room_id: preview.roomId,
      p_procedure_type_id: preview.procedureTypeId,
      p_status_id: scheduledStatusId,
      p_surgeon_id: preview.surgeonId,
      p_facility_id: facilityId,
      p_created_by: importedBy,
      p_operative_side: null,
      p_payer_id: null,
      p_notes: null,
      p_rep_required_override: null,
      p_staff_assignments: null,
      p_patient_id: patientId,
      p_source: 'epic',
    })

    if (rpcError) {
      log.error('Failed to create case from import', {
        facilityId,
        fhirAppointmentId: preview.fhirAppointmentId,
        error: rpcError.message,
      })
      return { success: false, caseId: null, patientId, error: `Case creation failed: ${rpcError.message}` }
    }

    // 4. Log to epic_import_log
    const appliedMappings = fieldMappings.reduce<Record<string, string>>((acc, m) => {
      acc[`${m.fhir_resource_type}.${m.fhir_field_path}`] = `${m.orbit_table}.${m.orbit_column}`
      return acc
    }, {})

    await epicDAL.createImportLogEntry(supabase, {
      facility_id: facilityId,
      connection_id: connectionId,
      fhir_appointment_id: preview.fhirAppointmentId,
      orbit_case_id: caseId as string,
      status: 'success',
      fhir_resource_snapshot: {
        appointment: preview.resolved.appointment,
        patient: preview.resolved.patient,
        practitioner: preview.resolved.practitioner,
        location: preview.resolved.location,
      } as Record<string, unknown>,
      field_mapping_applied: appliedMappings,
      imported_by: importedBy,
    })

    log.info('Case imported from Epic', {
      facilityId,
      caseId,
      caseNumber,
      fhirAppointmentId: preview.fhirAppointmentId,
    })

    return { success: true, caseId: caseId as string, patientId, error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    log.error('Case import threw', {
      facilityId,
      fhirAppointmentId: preview.fhirAppointmentId,
      error: message,
    })
    return { success: false, caseId: null, patientId: null, error: message }
  }
}
