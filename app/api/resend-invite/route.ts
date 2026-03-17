import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler, handleSupabaseError, ValidationError } from '@/lib/errorHandling'
import { validate } from '@/lib/validation/schemas'
import { createClient } from '@/lib/supabase-server'
import { sendUserInviteEmail } from '@/lib/email'

// Validation schema
const resendInviteSchema = z.object({
  inviteId: z.string().uuid('Invalid invite ID'),
})

export const POST = withErrorHandler(async (req: NextRequest) => {
  const supabase = await createClient()
  const body = await req.json()
  const validated = validate(resendInviteSchema, body)

  // Get invite details
  const { data: invite, error: inviteError } = await supabase
    .from('user_invites')
    .select('id, email, first_name, facility_id, access_level, invite_token, facilities(name)')
    .eq('id', validated.inviteId)
    .is('accepted_at', null)
    .single()

  if (inviteError) handleSupabaseError(inviteError)

  if (!invite) {
    throw new ValidationError('Invite not found or already accepted')
  }

  const facilityName = (invite.facilities as unknown as { name: string }[] | null)?.[0]?.name || 'ORbit'
  const accessLevel = (invite.access_level === 'facility_admin' || invite.access_level === 'user')
    ? invite.access_level
    : 'user' as const

  const emailResult = await sendUserInviteEmail(
    invite.email,
    invite.first_name,
    facilityName,
    invite.invite_token,
    accessLevel,
  )

  if (!emailResult.success) {
    throw new Error(`Failed to send email: ${emailResult.error}`)
  }

  return NextResponse.json({
    success: true,
    message: 'Invitation resent successfully',
  })
})
