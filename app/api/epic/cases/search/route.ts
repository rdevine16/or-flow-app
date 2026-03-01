/**
 * Epic Case Search Route
 *
 * GET /api/epic/cases/search?facility_id=xxx&date_from=YYYY-MM-DD&date_to=YYYY-MM-DD&practitioner_id=xxx
 *
 * Searches Epic FHIR for surgical appointments in a date range,
 * resolves referenced resources, and returns previews with mapping status.
 */

import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, AuthorizationError } from '@/lib/errorHandling'
import { createClient } from '@/lib/supabase-server'
import { epicDAL } from '@/lib/dal'
import { searchSurgicalAppointments, resolveAppointmentDetails } from '@/lib/epic/fhir-client'
import { mapAppointmentToPreview, type CaseImportPreview } from '@/lib/epic/case-mapper'
import { logger } from '@/lib/logger'

const log = logger('epic-cases-search')

/** Max forward-looking days for date range */
const MAX_DATE_RANGE_DAYS = 30

export const GET = withErrorHandler(async (req: NextRequest) => {
  const supabase = await createClient()

  // Auth check
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    throw new AuthorizationError('Must be logged in')
  }

  // Parse params
  const facilityId = req.nextUrl.searchParams.get('facility_id')
  const dateFrom = req.nextUrl.searchParams.get('date_from')
  const dateTo = req.nextUrl.searchParams.get('date_to')
  const practitionerId = req.nextUrl.searchParams.get('practitioner_id') ?? undefined

  if (!facilityId || !dateFrom || !dateTo) {
    return NextResponse.json(
      { error: 'facility_id, date_from, and date_to are required' },
      { status: 400 }
    )
  }

  // Validate date range: forward only, max 30 days
  const fromDate = new Date(dateFrom)
  const toDate = new Date(dateTo)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (fromDate < today) {
    return NextResponse.json(
      { error: 'date_from must be today or in the future' },
      { status: 400 }
    )
  }

  const daysDiff = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24))
  if (daysDiff > MAX_DATE_RANGE_DAYS) {
    return NextResponse.json(
      { error: `Date range cannot exceed ${MAX_DATE_RANGE_DAYS} days` },
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

  // Verify Epic connection exists and is active
  const { data: connection } = await epicDAL.getConnection(supabase, facilityId)
  if (!connection || connection.status !== 'connected') {
    return NextResponse.json(
      { error: 'No active Epic connection. Please connect to Epic first.' },
      { status: 400 }
    )
  }

  // Search FHIR for appointments
  const { data: appointments, error: searchError } = await searchSurgicalAppointments(
    supabase,
    facilityId,
    { dateFrom, dateTo, practitionerId }
  )

  if (searchError) {
    log.error('FHIR appointment search failed', { facilityId, error: searchError })
    return NextResponse.json(
      { error: `Failed to search Epic appointments: ${searchError}` },
      { status: 502 }
    )
  }

  if (appointments.length === 0) {
    return NextResponse.json({ data: [], total: 0 })
  }

  // Load entity mappings for this connection
  const { data: entityMappings } = await epicDAL.listEntityMappings(supabase, connection.id)

  // Get already-imported appointment IDs
  const { data: importLog } = await epicDAL.listImportLog(supabase, facilityId, { limit: 1000 })
  const importedIds = new Set(
    importLog
      .filter(entry => entry.status === 'success')
      .map(entry => entry.fhir_appointment_id)
      .filter((id): id is string => id !== null)
  )

  // Resolve appointment details and generate previews
  const previews: CaseImportPreview[] = []

  for (const appointment of appointments) {
    try {
      const resolved = await resolveAppointmentDetails(supabase, facilityId, appointment)
      const preview = await mapAppointmentToPreview(
        supabase,
        facilityId,
        connection.id,
        resolved,
        entityMappings,
        importedIds
      )
      previews.push(preview)
    } catch (err) {
      log.warn('Failed to resolve appointment', {
        facilityId,
        appointmentId: appointment.id,
        error: err instanceof Error ? err.message : 'Unknown error',
      })
      // Skip invalid — continue with others
    }
  }

  // Sort by date/time
  previews.sort((a, b) => {
    const dateA = a.scheduledDate ?? ''
    const dateB = b.scheduledDate ?? ''
    if (dateA !== dateB) return dateA.localeCompare(dateB)
    return (a.startTime ?? '').localeCompare(b.startTime ?? '')
  })

  log.info('Epic appointment search complete', {
    facilityId,
    total: appointments.length,
    previewed: previews.length,
    ready: previews.filter(p => p.status === 'ready').length,
    missingMappings: previews.filter(p => p.status === 'missing_mappings').length,
    alreadyImported: previews.filter(p => p.status === 'already_imported').length,
  })

  return NextResponse.json({
    data: previews.map(p => ({
      fhirAppointmentId: p.fhirAppointmentId,
      scheduledDate: p.scheduledDate,
      startTime: p.startTime,
      patientName: p.patientName,
      patientMrn: p.patientMrn,
      patientDob: p.patientDob,
      surgeonName: p.surgeonName,
      surgeonId: p.surgeonId,
      roomName: p.roomName,
      roomId: p.roomId,
      procedureName: p.procedureName,
      procedureTypeId: p.procedureTypeId,
      epicPractitionerId: p.epicPractitionerId,
      epicLocationId: p.epicLocationId,
      epicServiceType: p.epicServiceType,
      status: p.status,
      missingMappings: p.missingMappings,
    })),
    total: previews.length,
  })
})
