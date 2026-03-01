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
  const dateFrom = req.nextUrl.searchParams.get('date_from') ?? undefined
  const dateTo = req.nextUrl.searchParams.get('date_to') ?? undefined
  const patientId = req.nextUrl.searchParams.get('patient_id') ?? undefined
  const practitionerId = req.nextUrl.searchParams.get('practitioner_id') ?? undefined

  if (!facilityId) {
    return NextResponse.json(
      { error: 'facility_id is required' },
      { status: 400 }
    )
  }

  // Validate date range if both provided: max 30 days span
  if (dateFrom && dateTo) {
    const fromDate = new Date(dateFrom + 'T00:00:00')
    const toDate = new Date(dateTo + 'T00:00:00')

    const daysDiff = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24))
    if (daysDiff > MAX_DATE_RANGE_DAYS) {
      return NextResponse.json(
        { error: `Date range cannot exceed ${MAX_DATE_RANGE_DAYS} days` },
        { status: 400 }
      )
    }
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

  // Search FHIR for appointments (Epic requires patient parameter)
  const { data: appointments, error: searchError } = await searchSurgicalAppointments(
    supabase,
    facilityId,
    { dateFrom, dateTo, patientId, practitionerId }
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

  // Auto-register discovered Epic entities as unmapped entity mapping rows.
  // This populates the mappings page so the user can map them before importing.
  const existingKeys = new Set(
    entityMappings.map(m => `${m.mapping_type}:${m.epic_resource_id}`)
  )

  const upsertPromises: Promise<unknown>[] = []

  for (const p of previews) {
    // Register practitioners
    if (p.epicPractitionerId && !existingKeys.has(`surgeon:${p.epicPractitionerId}`)) {
      existingKeys.add(`surgeon:${p.epicPractitionerId}`)
      upsertPromises.push(
        epicDAL.upsertEntityMapping(supabase, {
          facility_id: facilityId,
          connection_id: connection.id,
          mapping_type: 'surgeon',
          epic_resource_type: 'Practitioner',
          epic_resource_id: p.epicPractitionerId,
          epic_display_name: p.surgeonName ?? undefined,
        })
      )
    }

    // Register locations
    if (p.epicLocationId && !existingKeys.has(`room:${p.epicLocationId}`)) {
      existingKeys.add(`room:${p.epicLocationId}`)
      upsertPromises.push(
        epicDAL.upsertEntityMapping(supabase, {
          facility_id: facilityId,
          connection_id: connection.id,
          mapping_type: 'room',
          epic_resource_type: 'Location',
          epic_resource_id: p.epicLocationId,
          epic_display_name: p.roomName ?? undefined,
        })
      )
    }

    // Register service types as procedures
    if (p.epicServiceType && !existingKeys.has(`procedure:${p.epicServiceType}`)) {
      existingKeys.add(`procedure:${p.epicServiceType}`)
      upsertPromises.push(
        epicDAL.upsertEntityMapping(supabase, {
          facility_id: facilityId,
          connection_id: connection.id,
          mapping_type: 'procedure',
          epic_resource_type: 'ServiceType',
          epic_resource_id: p.epicServiceType,
          epic_display_name: p.epicServiceType,
        })
      )
    }
  }

  if (upsertPromises.length > 0) {
    await Promise.allSettled(upsertPromises)
    log.info('Auto-registered Epic entities', {
      facilityId,
      count: upsertPromises.length,
    })
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
