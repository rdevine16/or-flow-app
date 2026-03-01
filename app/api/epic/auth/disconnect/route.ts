/**
 * Epic Disconnect Route
 *
 * POST /api/epic/auth/disconnect
 * Body: { facility_id: string }
 *
 * Clears tokens, sets status to 'disconnected', and logs audit event.
 */

import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, AuthorizationError } from '@/lib/errorHandling'
import { createClient } from '@/lib/supabase-server'
import { clearEpicToken } from '@/lib/epic/token-manager'
import { epicAudit } from '@/lib/audit-logger'
import { logger } from '@/lib/logger'

const log = logger('epic-auth-disconnect')

export const POST = withErrorHandler(async (req: NextRequest) => {
  const supabase = await createClient()

  // Verify authentication
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
    throw new AuthorizationError('Only facility admins can disconnect Epic')
  }

  // Get facility_id from body
  const body = await req.json() as { facility_id?: string }
  const facilityId = body.facility_id

  if (!facilityId) {
    return NextResponse.json({ error: 'facility_id is required' }, { status: 400 })
  }

  // Verify user has access to this facility
  if (userProfile.access_level === 'facility_admin' && userProfile.facility_id !== facilityId) {
    throw new AuthorizationError('Cannot disconnect Epic for another facility')
  }

  // Clear tokens and set status
  const { success, error: clearError } = await clearEpicToken(supabase, facilityId)

  if (!success) {
    log.error('Failed to clear Epic token', { facilityId, error: clearError })
    return NextResponse.json(
      { error: 'Failed to disconnect from Epic' },
      { status: 500 }
    )
  }

  // Log audit event
  await epicAudit.disconnected(supabase, facilityId)

  log.info('Epic disconnected', { facilityId })
  return NextResponse.json({ success: true })
})
