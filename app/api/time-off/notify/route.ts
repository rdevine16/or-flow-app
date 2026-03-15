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
  staffUserId: z.string().uuid().optional(),
  reviewerName: z.string().min(1),
  requestType: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  reviewNotes: z.string().nullable(),
  facilityName: z.string().min(1),
})

/**
 * POST /api/time-off/notify
 * Sends email and/or push notification to staff member when their time-off request is reviewed.
 * Checks facility_notification_settings channels before sending each type.
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

  const notificationType = params.status === 'approved' ? 'time_off_approved' : 'time_off_denied'

  // Check which channels are enabled for this notification type
  const { data: settings } = await supabase
    .from('facility_notification_settings')
    .select('channels')
    .eq('facility_id', params.facilityId)
    .eq('notification_type', notificationType)
    .eq('is_active', true)
    .eq('is_enabled', true)
    .single()

  const channels: string[] = settings?.channels ?? []
  const emailEnabled = channels.includes('email')
  const pushEnabled = channels.includes('push')

  if (!emailEnabled && !pushEnabled) {
    log.info('No channels enabled for time-off notification', {
      facilityId: params.facilityId,
      type: notificationType,
    })
    return NextResponse.json({ sent: false, reason: 'no_channels_enabled' })
  }

  const results: {
    email?: { sent: boolean; messageId?: string; error?: string }
    push?: { sent: boolean; error?: string }
  } = {}

  // Send email if enabled
  if (emailEnabled) {
    const emailResult = await sendTimeOffReviewedEmail(
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

    if (emailResult.success) {
      log.info('Time-off review email sent', {
        messageId: emailResult.messageId,
        status: params.status,
        staffEmail: params.staffEmail,
      })
      results.email = { sent: true, messageId: emailResult.messageId }
    } else {
      log.error('Failed to send time-off review email', {
        error: emailResult.error,
        staffEmail: params.staffEmail,
      })
      results.email = { sent: false, error: emailResult.error }
    }
  }

  // Send push notification if enabled and staff user ID is provided
  if (pushEnabled && params.staffUserId) {
    const statusLabel = params.status === 'approved' ? 'Approved' : 'Denied'
    const typeLabel = params.requestType.toUpperCase() === 'PTO'
      ? 'PTO'
      : params.requestType.charAt(0).toUpperCase() + params.requestType.slice(1)

    try {
      const { error: pushError } = await supabase.functions.invoke('send-push-notification', {
        body: {
          facility_id: params.facilityId,
          target_user_id: params.staffUserId,
          title: `Time-Off Request ${statusLabel}`,
          body: `Your ${typeLabel} request for ${params.startDate} to ${params.endDate} has been ${params.status} by ${params.reviewerName}`,
          data: {
            type: 'time_off_review',
            status: params.status,
            link_to: '/staff-management?tab=time-off-calendar',
          },
        },
      })

      if (pushError) {
        log.error('Failed to send time-off review push', {
          error: String(pushError),
          staffUserId: params.staffUserId,
        })
        results.push = { sent: false, error: String(pushError) }
      } else {
        log.info('Time-off review push sent', {
          status: params.status,
          staffUserId: params.staffUserId,
        })
        results.push = { sent: true }
      }
    } catch (pushErr) {
      log.error('Push notification call failed', {
        error: String(pushErr),
        staffUserId: params.staffUserId,
      })
      results.push = { sent: false, error: String(pushErr) }
    }
  }

  const anySent = results.email?.sent || results.push?.sent
  return NextResponse.json({ sent: anySent, ...results })
})
