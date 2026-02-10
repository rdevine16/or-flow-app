import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler, handleSupabaseError, ValidationError } from '@/lib/errorHandling'
import { validate } from '@/lib/validation/schemas'
import { createClient } from '@/lib/supabase-server'
import { Resend } from 'resend'

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
    .from('invites')
    .select('id, email, facility_id, role, token, facilities(name)')
    .eq('id', validated.inviteId)
    .is('accepted_at', null)
    .single()

  if (inviteError) handleSupabaseError(inviteError)

  if (!invite) {
    throw new ValidationError('Invite not found or already accepted')
  }

  // Send email
  const resend = new Resend(process.env.RESEND_API_KEY)
  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/accept/${invite.token}`

  try {
    await resend.emails.send({
      from: 'ORbit <noreply@yourdomain.com>',
      to: invite.email,
      subject: `Invitation to join ${invite.facilities?.[0]?.name || 'ORbit'}`,
      html: `
        <h2>You've been invited!</h2>
        <p>Click the link below to accept your invitation:</p>
        <a href="${inviteUrl}">${inviteUrl}</a>
      `,
    })
  } catch (emailError: any) {
    throw new Error(`Failed to send email: ${emailError.message}`)
  }

  return NextResponse.json({
    success: true,
    message: 'Invitation resent successfully',
  })
})