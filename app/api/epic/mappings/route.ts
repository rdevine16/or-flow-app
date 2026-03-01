/**
 * Epic Entity Mappings Routes
 *
 * GET  /api/epic/mappings?facility_id=xxx&mapping_type=surgeon
 * POST /api/epic/mappings  { facility_id, connection_id, mapping_type, ... }
 *
 * Lists and upserts entity mappings for a facility's Epic connection.
 */

import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, AuthorizationError } from '@/lib/errorHandling'
import { createClient } from '@/lib/supabase-server'
import { epicDAL } from '@/lib/dal'
import { logger } from '@/lib/logger'
import type { EpicMappingType } from '@/lib/epic/types'

const log = logger('epic-mappings')

export const GET = withErrorHandler(async (req: NextRequest) => {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    throw new AuthorizationError('Must be logged in')
  }

  const facilityId = req.nextUrl.searchParams.get('facility_id')
  if (!facilityId) {
    return NextResponse.json({ error: 'facility_id is required' }, { status: 400 })
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
    throw new AuthorizationError('Cannot access mappings for another facility')
  }

  // Need connection_id — get from the facility's connection
  const { data: connection } = await epicDAL.getConnection(supabase, facilityId)
  if (!connection) {
    return NextResponse.json({ data: [] })
  }

  const mappingType = req.nextUrl.searchParams.get('mapping_type') as EpicMappingType | null

  const { data: mappings, error } = await epicDAL.listEntityMappings(
    supabase,
    connection.id,
    mappingType || undefined
  )

  if (error) {
    log.error('Failed to list entity mappings', { facilityId, error: error.message })
    return NextResponse.json({ error: 'Failed to fetch mappings' }, { status: 500 })
  }

  return NextResponse.json({ data: mappings })
})

export const POST = withErrorHandler(async (req: NextRequest) => {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    throw new AuthorizationError('Must be logged in')
  }

  // Verify facility admin
  const { data: userProfile } = await supabase
    .from('users')
    .select('access_level, facility_id')
    .eq('id', user.id)
    .single()

  if (!userProfile || !['facility_admin', 'global_admin'].includes(userProfile.access_level)) {
    throw new AuthorizationError('Only facility admins can manage entity mappings')
  }

  const body = await req.json()
  const { facility_id, connection_id, mapping_type, epic_resource_type, epic_resource_id, epic_display_name, orbit_entity_id } = body

  if (!facility_id || !connection_id || !mapping_type || !epic_resource_type || !epic_resource_id) {
    return NextResponse.json(
      { error: 'Missing required fields: facility_id, connection_id, mapping_type, epic_resource_type, epic_resource_id' },
      { status: 400 }
    )
  }

  // Verify facility access
  if (userProfile.access_level === 'facility_admin' && userProfile.facility_id !== facility_id) {
    throw new AuthorizationError('Cannot manage mappings for another facility')
  }

  const { data: mapping, error } = await epicDAL.upsertEntityMapping(supabase, {
    facility_id,
    connection_id,
    mapping_type,
    epic_resource_type,
    epic_resource_id,
    epic_display_name,
    orbit_entity_id: orbit_entity_id || null,
    match_method: 'manual',
  })

  if (error) {
    log.error('Failed to upsert entity mapping', { facility_id, error: error.message })
    return NextResponse.json({ error: 'Failed to save mapping' }, { status: 500 })
  }

  return NextResponse.json({ data: mapping })
})
