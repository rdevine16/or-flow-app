/**
 * Epic Auto-Match Route
 *
 * POST /api/epic/mappings/auto-match
 *
 * Triggers fuzzy name matching between Epic entities and ORbit entities.
 * Returns results with confidence scores. High-confidence matches (>=0.90)
 * are auto-applied; medium matches (0.70-0.89) are returned as suggestions.
 */

import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, AuthorizationError } from '@/lib/errorHandling'
import { createClient } from '@/lib/supabase-server'
import { epicDAL, facilitiesDAL, usersDAL, lookupsDAL } from '@/lib/dal'
import { autoMatchSurgeons, autoMatchRooms, autoMatchProcedures } from '@/lib/epic/auto-matcher'
import { epicAudit } from '@/lib/audit-logger'
import { logger } from '@/lib/logger'

const log = logger('epic-auto-match')

export const POST = withErrorHandler(async (req: NextRequest) => {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    throw new AuthorizationError('Must be logged in')
  }

  // Verify facility admin
  const { data: userProfile } = await supabase
    .from('users')
    .select('access_level, facility_id, email')
    .eq('id', user.id)
    .single()

  if (!userProfile || !['facility_admin', 'global_admin'].includes(userProfile.access_level)) {
    throw new AuthorizationError('Only facility admins can run auto-matching')
  }

  const body = await req.json()
  const { facility_id, mapping_type } = body as { facility_id?: string; mapping_type?: string }

  if (!facility_id) {
    return NextResponse.json({ error: 'facility_id is required' }, { status: 400 })
  }

  // Verify facility access
  if (userProfile.access_level === 'facility_admin' && userProfile.facility_id !== facility_id) {
    throw new AuthorizationError('Cannot run auto-matching for another facility')
  }

  // Get the facility's Epic connection
  const { data: connection } = await epicDAL.getConnection(supabase, facility_id)
  if (!connection) {
    return NextResponse.json({ error: 'No Epic connection found' }, { status: 404 })
  }

  // Load ORbit entities for matching
  const [surgeonsResult, roomsResult, proceduresResult] = await Promise.all([
    usersDAL.listSurgeons(supabase, facility_id),
    facilitiesDAL.getRooms(supabase, facility_id),
    lookupsDAL.procedureTypes(supabase, facility_id),
  ])

  const results = []

  // Run auto-matching for requested type(s) — if no type specified, run all
  const typesToMatch = mapping_type
    ? [mapping_type]
    : ['surgeon', 'room', 'procedure']

  for (const type of typesToMatch) {
    switch (type) {
      case 'surgeon': {
        const summary = await autoMatchSurgeons(
          supabase,
          connection.id,
          facility_id,
          surgeonsResult.data.map(s => ({
            id: s.id,
            first_name: s.first_name,
            last_name: s.last_name,
          }))
        )
        results.push(summary)
        break
      }
      case 'room': {
        const summary = await autoMatchRooms(
          supabase,
          connection.id,
          facility_id,
          roomsResult.data.map(r => ({ id: r.id, name: r.name }))
        )
        results.push(summary)
        break
      }
      case 'procedure': {
        const summary = await autoMatchProcedures(
          supabase,
          connection.id,
          facility_id,
          proceduresResult.data.map(p => ({ id: p.id, name: p.name }))
        )
        results.push(summary)
        break
      }
    }
  }

  // Log audit event per mapping type
  for (const summary of results) {
    await epicAudit.autoMatchRun(
      supabase,
      facility_id,
      summary.mappingType,
      summary.autoApplied,
      summary.suggested
    )
  }

  const totalAutoApplied = results.reduce((s, r) => s + r.autoApplied, 0)
  const totalSuggested = results.reduce((s, r) => s + r.suggested, 0)

  log.info('Auto-match completed', {
    facilityId: facility_id,
    autoApplied: totalAutoApplied,
    suggested: totalSuggested,
  })

  return NextResponse.json({ data: results })
})
