/**
 * Epic FHIR Client
 *
 * Typed FHIR resource fetching for surgical appointments, patients,
 * practitioners, and locations. Uses the token manager for authenticated
 * requests against the facility's Epic FHIR server.
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { epicFhirRequest } from './token-manager'
import { logger } from '@/lib/logger'
import type {
  FhirBundle,
  FhirAppointment,
  FhirPatient,
  FhirPractitioner,
  FhirLocation,
} from './types'

const log = logger('epic-fhir-client')

// =====================================================
// TYPES
// =====================================================

/** Resolved appointment with all referenced resources fetched */
export interface ResolvedAppointment {
  appointment: FhirAppointment
  patient: FhirPatient | null
  practitioner: FhirPractitioner | null
  location: FhirLocation | null
}

/** Search parameters for surgical appointments */
export interface AppointmentSearchParams {
  dateFrom: string   // YYYY-MM-DD
  dateTo: string     // YYYY-MM-DD
  practitionerId?: string  // Epic Practitioner FHIR ID
}

// =====================================================
// HELPERS
// =====================================================

/** Extract resource ID from a FHIR reference string (e.g., "Patient/abc123" → "abc123") */
function extractResourceId(reference: string): string | null {
  const parts = reference.split('/')
  return parts.length >= 2 ? parts[parts.length - 1] : null
}

/** Extract participant reference by resource type from an appointment */
function findParticipantRef(
  appointment: FhirAppointment,
  resourceType: string
): string | null {
  for (const p of appointment.participant) {
    const ref = p.actor?.reference
    if (ref && ref.startsWith(`${resourceType}/`)) {
      return extractResourceId(ref)
    }
  }
  return null
}

/** Extract entries from a FHIR Bundle, returning empty array if none */
function extractBundleEntries<T>(bundle: FhirBundle<T> | null): T[] {
  if (!bundle?.entry) return []
  return bundle.entry.map(e => e.resource)
}

// =====================================================
// FHIR CLIENT FUNCTIONS
// =====================================================

/**
 * Search for surgical appointments within a date range.
 * Optionally filter by practitioner (surgeon).
 */
export async function searchSurgicalAppointments(
  supabase: SupabaseClient,
  facilityId: string,
  params: AppointmentSearchParams
): Promise<{ data: FhirAppointment[]; error: string | null }> {
  const searchParams = new URLSearchParams({
    date: `ge${params.dateFrom}`,
    _count: '100',
    'service-type': 'http://snomed.info/sct|387713003', // Surgical procedure
  })

  // Add end date bound
  searchParams.append('date', `le${params.dateTo}`)

  // Optional practitioner filter
  if (params.practitionerId) {
    searchParams.set('practitioner', `Practitioner/${params.practitionerId}`)
  }

  const { data: bundle, error } = await epicFhirRequest<FhirBundle<FhirAppointment>>(
    supabase,
    facilityId,
    `Appointment?${searchParams.toString()}`
  )

  if (error) {
    log.error('Failed to search appointments', { facilityId, error })
    return { data: [], error }
  }

  const appointments = extractBundleEntries(bundle)

  // Filter to only booked/arrived/pending appointments (not cancelled/noshow)
  const activeAppointments = appointments.filter(a =>
    ['booked', 'arrived', 'pending', 'proposed'].includes(a.status)
  )

  log.info('Fetched surgical appointments', {
    facilityId,
    total: appointments.length,
    active: activeAppointments.length,
    dateRange: `${params.dateFrom} to ${params.dateTo}`,
  })

  return { data: activeAppointments, error: null }
}

/**
 * Get a single patient by FHIR ID.
 */
export async function getPatient(
  supabase: SupabaseClient,
  facilityId: string,
  patientId: string
): Promise<{ data: FhirPatient | null; error: string | null }> {
  const { data, error } = await epicFhirRequest<FhirPatient>(
    supabase,
    facilityId,
    `Patient/${patientId}`
  )

  if (error) {
    log.warn('Failed to fetch patient', { facilityId, patientId, error })
  }

  return { data, error }
}

/**
 * Get a single practitioner by FHIR ID.
 */
export async function getPractitioner(
  supabase: SupabaseClient,
  facilityId: string,
  practitionerId: string
): Promise<{ data: FhirPractitioner | null; error: string | null }> {
  const { data, error } = await epicFhirRequest<FhirPractitioner>(
    supabase,
    facilityId,
    `Practitioner/${practitionerId}`
  )

  if (error) {
    log.warn('Failed to fetch practitioner', { facilityId, practitionerId, error })
  }

  return { data, error }
}

/**
 * Search practitioners by name.
 */
export async function searchPractitioners(
  supabase: SupabaseClient,
  facilityId: string,
  params?: { name?: string }
): Promise<{ data: FhirPractitioner[]; error: string | null }> {
  const searchParams = new URLSearchParams({ _count: '200' })

  if (params?.name) {
    searchParams.set('name', params.name)
  }

  const { data: bundle, error } = await epicFhirRequest<FhirBundle<FhirPractitioner>>(
    supabase,
    facilityId,
    `Practitioner?${searchParams.toString()}`
  )

  if (error) {
    return { data: [], error }
  }

  return { data: extractBundleEntries(bundle), error: null }
}

/**
 * Search all locations (operating rooms).
 */
export async function searchLocations(
  supabase: SupabaseClient,
  facilityId: string
): Promise<{ data: FhirLocation[]; error: string | null }> {
  const { data: bundle, error } = await epicFhirRequest<FhirBundle<FhirLocation>>(
    supabase,
    facilityId,
    'Location?_count=200'
  )

  if (error) {
    return { data: [], error }
  }

  return { data: extractBundleEntries(bundle), error: null }
}

/**
 * Resolve all referenced resources for an appointment.
 * Fetches patient, practitioner, and location in parallel.
 */
export async function resolveAppointmentDetails(
  supabase: SupabaseClient,
  facilityId: string,
  appointment: FhirAppointment
): Promise<ResolvedAppointment> {
  const patientId = findParticipantRef(appointment, 'Patient')
  const practitionerId = findParticipantRef(appointment, 'Practitioner')
  const locationId = findParticipantRef(appointment, 'Location')

  // Fetch all referenced resources in parallel
  const [patientResult, practitionerResult, locationResult] = await Promise.all([
    patientId
      ? getPatient(supabase, facilityId, patientId)
      : Promise.resolve({ data: null, error: null }),
    practitionerId
      ? getPractitioner(supabase, facilityId, practitionerId)
      : Promise.resolve({ data: null, error: null }),
    locationId
      ? epicFhirRequest<FhirLocation>(supabase, facilityId, `Location/${locationId}`)
      : Promise.resolve({ data: null, error: null }),
  ])

  return {
    appointment,
    patient: patientResult.data,
    practitioner: practitionerResult.data,
    location: locationResult.data,
  }
}
