/**
 * Epic Case Import Route
 *
 * POST /api/epic/cases/import
 * Body: { facility_id, appointments: [{ fhirAppointmentId, ... }] }
 *
 * Imports selected appointments as ORbit cases. Creates patient records,
 * logs all operations to epic_import_log, and produces audit trail.
 */

import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, AuthorizationError } from '@/lib/errorHandling'
import { createClient } from '@/lib/supabase-server'
import { epicDAL } from '@/lib/dal'
import { resolveAppointmentDetails } from '@/lib/epic/fhir-client'
import { mapAppointmentToPreview, createCaseFromImport } from '@/lib/epic/case-mapper'
import { epicAudit } from '@/lib/audit-logger'
import { epicFhirRequest } from '@/lib/epic/token-manager'
import { logger } from '@/lib/logger'
import type { FhirAppointment } from '@/lib/epic/types'

const log = logger('epic-cases-import')

interface ImportRequestBody {
  facility_id: string
  appointments: Array<{
    fhirAppointmentId: string
  }>
}

interface ImportResultItem {
  fhirAppointmentId: string
  success: boolean
  caseId: string | null
  caseNumber: string | null
  error: string | null
}

export const POST = withErrorHandler(async (req: NextRequest) => {
  const supabase = await createClient()

  // Auth check
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    throw new AuthorizationError('Must be logged in')
  }

  const body = (await req.json()) as ImportRequestBody
  const { facility_id: facilityId, appointments } = body

  if (!facilityId || !appointments?.length) {
    return NextResponse.json(
      { error: 'facility_id and appointments array are required' },
      { status: 400 }
    )
  }

  // Verify facility admin access
  const { data: userProfile } = await supabase
    .from('users')
    .select('access_level, facility_id')
    .eq('id', user.id)
    .single()

  if (!userProfile || !['facility_admin', 'global_admin'].includes(userProfile.access_level)) {
    throw new AuthorizationError('Only facility admins can import cases')
  }

  if (userProfile.access_level === 'facility_admin' && userProfile.facility_id !== facilityId) {
    throw new AuthorizationError('Cannot import cases for another facility')
  }

  // Verify Epic connection
  const { data: connection } = await epicDAL.getConnection(supabase, facilityId)
  if (!connection || connection.status !== 'connected') {
    return NextResponse.json(
      { error: 'No active Epic connection' },
      { status: 400 }
    )
  }

  // Get "Scheduled" status ID for new cases
  const { data: scheduledStatus } = await supabase
    .from('case_statuses')
    .select('id')
    .eq('name', 'scheduled')
    .single()

  if (!scheduledStatus) {
    return NextResponse.json(
      { error: 'Could not find "scheduled" case status' },
      { status: 500 }
    )
  }

  // Load entity mappings
  const { data: entityMappings } = await epicDAL.listEntityMappings(supabase, connection.id)

  // Get already-imported IDs
  const { data: existingImports } = await epicDAL.listImportLog(supabase, facilityId, { limit: 5000 })
  const importedIds = new Set(
    existingImports
      .filter(entry => entry.status === 'success')
      .map(entry => entry.fhir_appointment_id)
      .filter((id): id is string => id !== null)
  )

  // Import sequentially with per-case results
  const results: ImportResultItem[] = []
  let successCount = 0
  let failedCount = 0

  for (const item of appointments) {
    const { fhirAppointmentId } = item

    // Check duplicate
    if (importedIds.has(fhirAppointmentId)) {
      // Log as duplicate
      await epicDAL.createImportLogEntry(supabase, {
        facility_id: facilityId,
        connection_id: connection.id,
        fhir_appointment_id: fhirAppointmentId,
        status: 'duplicate',
        error_message: 'Already imported',
        imported_by: user.id,
      })

      results.push({
        fhirAppointmentId,
        success: false,
        caseId: null,
        caseNumber: null,
        error: 'Already imported',
      })
      failedCount++
      continue
    }

    try {
      // Fetch the appointment from FHIR
      const { data: appointment, error: fetchError } = await epicFhirRequest<FhirAppointment>(
        supabase,
        facilityId,
        `Appointment/${fhirAppointmentId}`
      )

      if (fetchError || !appointment) {
        await epicDAL.createImportLogEntry(supabase, {
          facility_id: facilityId,
          connection_id: connection.id,
          fhir_appointment_id: fhirAppointmentId,
          status: 'failed',
          error_message: fetchError ?? 'Failed to fetch appointment',
          imported_by: user.id,
        })

        results.push({
          fhirAppointmentId,
          success: false,
          caseId: null,
          caseNumber: null,
          error: fetchError ?? 'Failed to fetch appointment',
        })
        failedCount++

        await epicAudit.caseImportFailed(
          supabase,
          facilityId,
          fhirAppointmentId,
          fetchError ?? 'Failed to fetch appointment'
        )
        continue
      }

      // Resolve all referenced resources
      const resolved = await resolveAppointmentDetails(supabase, facilityId, appointment)

      // Generate preview (for mapping resolution)
      const preview = await mapAppointmentToPreview(
        supabase,
        facilityId,
        connection.id,
        resolved,
        entityMappings,
        importedIds
      )

      // Block if missing required mappings
      if (preview.status === 'missing_mappings') {
        await epicDAL.createImportLogEntry(supabase, {
          facility_id: facilityId,
          connection_id: connection.id,
          fhir_appointment_id: fhirAppointmentId,
          status: 'skipped',
          error_message: `Missing mappings: ${preview.missingMappings.join(', ')}`,
          imported_by: user.id,
        })

        results.push({
          fhirAppointmentId,
          success: false,
          caseId: null,
          caseNumber: null,
          error: `Missing mappings: ${preview.missingMappings.join(', ')}`,
        })
        failedCount++
        continue
      }

      // Create the case
      const importResult = await createCaseFromImport(
        supabase,
        facilityId,
        connection.id,
        preview,
        user.id,
        scheduledStatus.id
      )

      if (importResult.success) {
        successCount++
        importedIds.add(fhirAppointmentId) // Prevent duplicate within same batch

        results.push({
          fhirAppointmentId,
          success: true,
          caseId: importResult.caseId,
          caseNumber: `EPIC-${fhirAppointmentId}`,
          error: null,
        })
      } else {
        failedCount++

        // Log failure
        await epicDAL.createImportLogEntry(supabase, {
          facility_id: facilityId,
          connection_id: connection.id,
          fhir_appointment_id: fhirAppointmentId,
          status: 'failed',
          error_message: importResult.error ?? 'Unknown error',
          imported_by: user.id,
        })

        await epicAudit.caseImportFailed(
          supabase,
          facilityId,
          fhirAppointmentId,
          importResult.error ?? 'Unknown error'
        )

        results.push({
          fhirAppointmentId,
          success: false,
          caseId: null,
          caseNumber: null,
          error: importResult.error,
        })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      failedCount++

      await epicDAL.createImportLogEntry(supabase, {
        facility_id: facilityId,
        connection_id: connection.id,
        fhir_appointment_id: fhirAppointmentId,
        status: 'failed',
        error_message: message,
        imported_by: user.id,
      })

      await epicAudit.caseImportFailed(supabase, facilityId, fhirAppointmentId, message)

      results.push({
        fhirAppointmentId,
        success: false,
        caseId: null,
        caseNumber: null,
        error: message,
      })
    }
  }

  // Audit log the batch import
  await epicAudit.casesImported(
    supabase,
    facilityId,
    appointments.length,
    successCount,
    failedCount
  )

  log.info('Epic case import complete', {
    facilityId,
    total: appointments.length,
    success: successCount,
    failed: failedCount,
  })

  return NextResponse.json({
    results,
    summary: {
      total: appointments.length,
      success: successCount,
      failed: failedCount,
    },
  })
})
