/**
 * Epic Connection Status Route
 *
 * GET /api/epic/status?facility_id=xxx
 *
 * Returns connection status + entity mapping stats for a facility.
 */

import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, AuthorizationError } from '@/lib/errorHandling'
import { createClient } from '@/lib/supabase-server'
import { epicDAL } from '@/lib/dal'
import { logger } from '@/lib/logger'

const log = logger('epic-status')

/** Aggregated mapping stats by type */
interface MappingStatsResult {
  surgeon: { total: number; mapped: number }
  room: { total: number; mapped: number }
  procedure: { total: number; mapped: number }
}

export const GET = withErrorHandler(async (req: NextRequest) => {
  const supabase = await createClient()

  // Verify authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    throw new AuthorizationError('Must be logged in')
  }

  const facilityId = req.nextUrl.searchParams.get('facility_id')
  if (!facilityId) {
    return NextResponse.json({ error: 'facility_id is required' }, { status: 400 })
  }

  // Verify user has access to this facility
  const { data: userProfile } = await supabase
    .from('users')
    .select('access_level, facility_id')
    .eq('id', user.id)
    .single()

  if (!userProfile) {
    throw new AuthorizationError('User profile not found')
  }

  if (userProfile.access_level !== 'global_admin' && userProfile.facility_id !== facilityId) {
    throw new AuthorizationError('Cannot access Epic status for another facility')
  }

  // Get connection status
  const { data: connection, error: connError } = await epicDAL.getConnectionStatus(supabase, facilityId)

  if (connError && connError.code !== 'PGRST116') {
    log.error('Failed to fetch connection status', { facilityId, error: connError.message })
    return NextResponse.json({ error: 'Failed to fetch connection status' }, { status: 500 })
  }

  // No connection yet — return disconnected state
  if (!connection) {
    return NextResponse.json({
      connection: null,
      mappingStats: null,
    })
  }

  // Get mapping stats
  const stats: MappingStatsResult = {
    surgeon: { total: 0, mapped: 0 },
    room: { total: 0, mapped: 0 },
    procedure: { total: 0, mapped: 0 },
  }

  const { data: mappingRows } = await epicDAL.getMappingStats(supabase, connection.id)
  for (const row of mappingRows) {
    const type = row.mapping_type as keyof MappingStatsResult
    if (stats[type]) {
      stats[type].total++
      if (row.orbit_entity_id) {
        stats[type].mapped++
      }
    }
  }

  return NextResponse.json({
    connection,
    mappingStats: stats,
  })
})
