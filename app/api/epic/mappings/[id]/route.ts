/**
 * Epic Entity Mapping Delete Route
 *
 * DELETE /api/epic/mappings/:id
 *
 * Removes a single entity mapping by its ID.
 */

import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, AuthorizationError } from '@/lib/errorHandling'
import { createClient } from '@/lib/supabase-server'
import { epicDAL } from '@/lib/dal'
import { logger } from '@/lib/logger'

const log = logger('epic-mappings-delete')

export const DELETE = withErrorHandler(async (
  req: NextRequest,
  context: unknown
) => {
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
    throw new AuthorizationError('Only facility admins can delete entity mappings')
  }

  // Extract ID from the route params
  const { params } = context as { params: Promise<{ id: string }> }
  const { id } = await params

  if (!id) {
    return NextResponse.json({ error: 'Mapping ID is required' }, { status: 400 })
  }

  // Verify the mapping belongs to the user's facility before deleting
  const { data: mapping, error: fetchError } = await supabase
    .from('epic_entity_mappings')
    .select('id, facility_id')
    .eq('id', id)
    .single()

  if (fetchError || !mapping) {
    return NextResponse.json({ error: 'Mapping not found' }, { status: 404 })
  }

  if (userProfile.access_level === 'facility_admin' && userProfile.facility_id !== mapping.facility_id) {
    throw new AuthorizationError('Cannot delete mappings from another facility')
  }

  const { error } = await epicDAL.deleteEntityMapping(supabase, id)

  if (error) {
    log.error('Failed to delete entity mapping', { id, error: error.message })
    return NextResponse.json({ error: 'Failed to delete mapping' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
})
