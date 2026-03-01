/**
 * Epic Patient Search Route
 *
 * GET /api/epic/patients/search?facility_id=xxx&name=xxx
 * GET /api/epic/patients/search?facility_id=xxx&patient_id=xxx
 *
 * Searches Epic FHIR for patients by name, or fetches a patient by FHIR ID.
 * Falls back to direct ID lookup when name search returns 403 (missing Patient.s scope).
 */

import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, AuthorizationError } from '@/lib/errorHandling'
import { createClient } from '@/lib/supabase-server'
import { epicDAL } from '@/lib/dal'
import { searchPatients, getPatient } from '@/lib/epic/fhir-client'
import { logger } from '@/lib/logger'
import type { FhirPatient, FhirHumanName, FhirIdentifier } from '@/lib/epic/types'

const log = logger('epic-patients-search')

/** Format a FHIR patient name for display */
function formatPatientName(names?: FhirHumanName[]): string | null {
  if (!names || names.length === 0) return null
  const name = names.find(n => n.use === 'official') ?? names[0]
  const parts: string[] = []
  if (name.given) parts.push(...name.given)
  if (name.family) parts.push(name.family)
  return parts.length > 0 ? parts.join(' ') : (name.text ?? null)
}

/** Extract MRN from identifiers */
function extractMrn(identifiers?: FhirIdentifier[]): string | null {
  if (!identifiers) return null
  const mrn = identifiers.find(
    i => i.type?.coding?.some(c => c.code === 'MR') || i.system?.includes('MRN')
  )
  return mrn?.value ?? identifiers[0]?.value ?? null
}

/** Map a FHIR patient to a simplified search result */
function mapPatientToResult(patient: FhirPatient) {
  return {
    id: patient.id,
    name: formatPatientName(patient.name),
    birthDate: patient.birthDate ?? null,
    gender: patient.gender ?? null,
    mrn: extractMrn(patient.identifier),
  }
}

export const GET = withErrorHandler(async (req: NextRequest) => {
  const supabase = await createClient()

  // Auth check
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    throw new AuthorizationError('Must be logged in')
  }

  // Parse params
  const facilityId = req.nextUrl.searchParams.get('facility_id')
  const name = req.nextUrl.searchParams.get('name') ?? undefined
  const identifier = req.nextUrl.searchParams.get('identifier') ?? undefined
  const patientId = req.nextUrl.searchParams.get('patient_id') ?? undefined

  if (!facilityId) {
    return NextResponse.json(
      { error: 'facility_id is required' },
      { status: 400 }
    )
  }

  if (!name && !identifier && !patientId) {
    return NextResponse.json(
      { error: 'name, identifier, or patient_id is required' },
      { status: 400 }
    )
  }

  // Verify facility access
  const { data: userProfile } = await supabase
    .from('users')
    .select('access_level, facility_id')
    .eq('id', user.id)
    .single()

  if (!userProfile) {
    throw new AuthorizationError('User profile not found')
  }

  if (userProfile.access_level !== 'global_admin' && userProfile.facility_id !== facilityId) {
    throw new AuthorizationError('Cannot access Epic data for another facility')
  }

  // Verify Epic connection
  const { data: connection } = await epicDAL.getConnection(supabase, facilityId)
  if (!connection || connection.status !== 'connected') {
    return NextResponse.json(
      { error: 'No active Epic connection' },
      { status: 400 }
    )
  }

  // Mode 1: Direct patient ID lookup (always works with Patient.read scope)
  if (patientId) {
    const { data: patient, error: fetchError } = await getPatient(supabase, facilityId, patientId)

    if (fetchError) {
      log.warn('Patient ID lookup failed', { facilityId, patientId, error: fetchError })
      return NextResponse.json(
        { error: `Patient not found: ${fetchError}` },
        { status: 404 }
      )
    }

    if (!patient) {
      return NextResponse.json({ data: [], total: 0 })
    }

    return NextResponse.json({
      data: [mapPatientToResult(patient)],
      total: 1,
    })
  }

  // Mode 2: Name/identifier search (requires Patient.search scope)
  const { data: patients, error: searchError } = await searchPatients(
    supabase,
    facilityId,
    { name, identifier }
  )

  if (searchError) {
    // If 403, the token lacks Patient.search scope — tell user to use ID lookup
    if (searchError.includes('403')) {
      log.warn('Patient search denied (missing Patient.s scope)', { facilityId })
      return NextResponse.json(
        { error: 'Patient name search is not available. Your Epic connection does not include Patient search permissions. Use a Patient FHIR ID instead.', scopeError: true },
        { status: 403 }
      )
    }

    log.error('FHIR patient search failed', { facilityId, error: searchError })
    return NextResponse.json(
      { error: `Failed to search patients: ${searchError}` },
      { status: 502 }
    )
  }

  log.info('Patient search complete', { facilityId, query: name ?? identifier, results: patients.length })

  return NextResponse.json({
    data: patients.map(mapPatientToResult),
    total: patients.length,
  })
})
