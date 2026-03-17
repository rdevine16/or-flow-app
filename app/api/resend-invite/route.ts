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

  // Get current user's name for the email
  const { data: { user } } = await supabase.auth.getUser()
  let inviterName = 'An administrator'
  if (user) {
    const { data: inviter } = await supabase
      .from('users')
      .select('first_name, last_name')
      .eq('id', user.id)
      .single()
    if (inviter) inviterName = `${inviter.first_name} ${inviter.last_name}`
  }

  const facilityName = (invite.facilities as unknown as { name: string }[] | null)?.[0]?.name || 'ORbit'
  const accessLevel = (invite.access_level === 'facility_admin' || invite.access_level === 'user')
    ? invite.access_level
    : 'user' as const

  const emailResult = await sendUserInviteEmail(
    invite.email,
    invite.first_name,
    facilityName,
    inviterName,
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
