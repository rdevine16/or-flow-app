import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler, AuthorizationError } from '@/lib/errorHandling'
import { validate } from '@/lib/validation/schemas'
import { createClient } from '@/lib/supabase-server'
import { sendTimeOffReviewedEmail } from '@/lib/email'
import { logger } from '@/lib/logger'

const log = logger('api:time-off-notify')

const notifySchema = z.object({
  facilityId: z.string().uuid(),
  status: z.enum(['approved', 'denied']),
  staffEmail: z.string().email(),
  staffFirstName: z.string().min(1),
  reviewerName: z.string().min(1),
  requestType: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  reviewNotes: z.string().nullable(),
  facilityName: z.string().min(1),
})

/**
 * POST /api/time-off/notify
 * Sends email notification to staff member when their time-off request is reviewed.
 * Checks facility_notification_settings to see if email channel is enabled.
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const supabase = await createClient()

  // Auth check — must be logged in admin
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    throw new AuthorizationError('Must be logged in')
  }

  const { data: userProfile } = await supabase
    .from('users')
    .select('access_level')
    .eq('id', user.id)
    .single()

  if (!userProfile || !['facility_admin', 'global_admin'].includes(userProfile.access_level)) {
    throw new AuthorizationError('Only admins can trigger time-off notifications')
  }

  const body = await req.json()
  const params = validate(notifySchema, body)

  // Check if email channel is enabled for this notification type
  const notificationType = params.status === 'approved' ? 'time_off_approved' : 'time_off_denied'

  const { data: settings } = await supabase
    .from('facility_notification_settings')
    .select('channels')
    .eq('facility_id', params.facilityId)
    .eq('notification_type', notificationType)
    .eq('is_active', true)
    .eq('is_enabled', true)
    .single()

  if (!settings || !settings.channels?.includes('email')) {
    log.info('Email channel not enabled for time-off notification', {
      facilityId: params.facilityId,
      type: notificationType,
    })
    return NextResponse.json({ sent: false, reason: 'email_channel_disabled' })
  }

  // Send the email
  const result = await sendTimeOffReviewedEmail(
    params.staffEmail,
    params.staffFirstName,
    params.reviewerName,
    params.status,
    params.requestType,
    params.startDate,
    params.endDate,
    params.reviewNotes,
    params.facilityName,
  )

  if (!result.success) {
    log.error('Failed to send time-off review email', {
      error: result.error,
      staffEmail: params.staffEmail,
    })
    return NextResponse.json({ sent: false, error: result.error }, { status: 500 })
  }

  log.info('Time-off review email sent', {
    messageId: result.messageId,
    status: params.status,
    staffEmail: params.staffEmail,
  })

  return NextResponse.json({ sent: true, messageId: result.messageId })
})
