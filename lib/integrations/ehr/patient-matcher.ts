/**
 * Patient Matcher
 *
 * Matches HL7v2 patient references to ORbit patients.
 * Strategy: MRN match → if demographics differ, flag for review → create new if no match.
 * Does NOT use fuzzy matching — patient matching must be exact (HIPAA).
 */

import type { AnySupabaseClient } from '@/lib/dal'
import { logger } from '@/lib/logger'

const log = logger('patient-matcher')

export interface PatientMatchResult {
  matched: boolean
  patientId: string | null
  isNewPatient: boolean
  demographicsMismatch: DemographicsMismatch | null
}

export interface DemographicsMismatch {
  field: string
  expected: string
  received: string
}

export interface PatientData {
  mrn: string
  firstName: string
  lastName: string
  dateOfBirth: string | null
  gender: string
  externalPatientId?: string
}

/**
 * Match or create a patient from HL7v2 data.
 *
 * Rules:
 * 1. MRN match → if demographics match, return existing patient
 * 2. MRN match → if demographics differ, return existing patient but flag demographics mismatch
 * 3. No MRN match → create new patient, return new ID
 *
 * @param supabase - Supabase client (service role for Edge Function)
 * @param facilityId - Facility ID for scoping
 * @param patient - Patient data from parsed SIU message
 */
export async function matchOrCreatePatient(
  supabase: AnySupabaseClient,
  facilityId: string,
  patient: PatientData,
): Promise<PatientMatchResult> {
  if (!patient.mrn) {
    // No MRN — create a new patient record
    log.info('No MRN provided, creating new patient', { firstName: patient.firstName, lastName: patient.lastName })
    return createNewPatient(supabase, facilityId, patient)
  }

  // 1. Try to match by MRN
  const { data: existingPatient, error: queryError } = await supabase
    .from('patients')
    .select('id, first_name, last_name, date_of_birth, is_active')
    .eq('facility_id', facilityId)
    .eq('mrn', patient.mrn)
    .maybeSingle()

  if (queryError) {
    log.error('Error querying patient by MRN', { mrn: patient.mrn, error: queryError.message })
    throw new Error(`Patient lookup failed: ${queryError.message}`)
  }

  if (existingPatient) {
    // Check demographics match
    const mismatch = checkDemographics(existingPatient, patient)

    if (mismatch) {
      log.info('Patient MRN matched but demographics differ', {
        mrn: patient.mrn,
        mismatchField: mismatch.field,
      })
      return {
        matched: true,
        patientId: existingPatient.id,
        isNewPatient: false,
        demographicsMismatch: mismatch,
      }
    }

    log.debug('Patient matched by MRN', { mrn: patient.mrn, patientId: existingPatient.id })
    return {
      matched: true,
      patientId: existingPatient.id,
      isNewPatient: false,
      demographicsMismatch: null,
    }
  }

  // 2. No MRN match — create new patient
  log.info('No patient found for MRN, creating new', { mrn: patient.mrn })
  return createNewPatient(supabase, facilityId, patient)
}

/**
 * Check if existing patient demographics match the incoming HL7v2 data.
 * Returns the first mismatch found, or null if all match.
 */
function checkDemographics(
  existing: { first_name: string | null; last_name: string | null; date_of_birth: string | null },
  incoming: PatientData,
): DemographicsMismatch | null {
  // Compare last name (case-insensitive)
  if (
    existing.last_name &&
    incoming.lastName &&
    existing.last_name.toLowerCase() !== incoming.lastName.toLowerCase()
  ) {
    return {
      field: 'last_name',
      expected: existing.last_name,
      received: incoming.lastName,
    }
  }

  // Compare first name (case-insensitive)
  if (
    existing.first_name &&
    incoming.firstName &&
    existing.first_name.toLowerCase() !== incoming.firstName.toLowerCase()
  ) {
    return {
      field: 'first_name',
      expected: existing.first_name,
      received: incoming.firstName,
    }
  }

  // Compare DOB
  if (existing.date_of_birth && incoming.dateOfBirth) {
    // Normalize both to YYYY-MM-DD for comparison
    const existingDob = existing.date_of_birth.substring(0, 10)
    const incomingDob = incoming.dateOfBirth.substring(0, 10)
    if (existingDob !== incomingDob) {
      return {
        field: 'date_of_birth',
        expected: existingDob,
        received: incomingDob,
      }
    }
  }

  return null
}

/**
 * Create a new patient record.
 */
async function createNewPatient(
  supabase: AnySupabaseClient,
  facilityId: string,
  patient: PatientData,
): Promise<PatientMatchResult> {
  const { data: newPatient, error } = await supabase
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
    .single()

  if (error || !newPatient) {
    log.error('Failed to create patient', { mrn: patient.mrn, error: error?.message })
    throw new Error(`Patient creation failed: ${error?.message || 'Unknown error'}`)
  }

  log.info('Created new patient', { patientId: newPatient.id, mrn: patient.mrn })
  return {
    matched: true,
    patientId: newPatient.id,
    isNewPatient: true,
    demographicsMismatch: null,
  }
}
