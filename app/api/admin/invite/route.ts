import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler, handleSupabaseError, AuthorizationError } from '@/lib/errorHandling'
import { validate } from '@/lib/validation/schemas'
import { createClient } from '@/lib/supabase-server'
import { nowUTC } from '@/lib/dateFactory'
import { Resend } from 'resend'

// Validation schema
const createInviteSchema = z.object({
  email: z.string().email('Invalid email'),
  facilityId: z.string().uuid('Invalid facility ID'),
  role: z.enum(['user', 'facility_admin', 'global_admin']),
})

export const POST = withErrorHandler(async (req: NextRequest) => {
  const supabase = await createClient()

  // Check if user is admin
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
    throw new AuthorizationError('Only admins can send invitations')
  }

  // Validate input
  const body = await req.json()
  const validated = validate(createInviteSchema, body)

  // Check if user already exists
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('email', validated.email)
    .single()

  if (existingUser) {
    return NextResponse.json(
      { error: 'User with this email already exists' },
      { status: 400 }
    )
  }

  // Generate token
  const token = crypto.randomUUID()
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7)

  // Create invite
  const { data: invite, error: inviteError } = await supabase
    .from('invites')
    .insert({
      email: validated.email,
      facility_id: validated.facilityId,
      role: validated.role,
      token,
      invited_by: user.id,
      expires_at: expiresAt.toISOString(),
      created_at: nowUTC(),
    })
    .select('id, facilities(name)')
    .single()

  if (inviteError) handleSupabaseError(inviteError)

  // Send email
  const resend = new Resend(process.env.RESEND_API_KEY)
  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/accept/${token}`

  try {
    await resend.emails.send({
      from: 'ORbit <noreply@yourdomain.com>',
      to: validated.email,
      subject: `Invitation to join ${invite.facilities?.[0]?.name || 'ORbit'}`,
      html: `
        <h2>You've been invited to ORbit</h2>
        <p>You've been invited as a ${validated.role.replace('_', ' ')}.</p>
        <p>Click the link below to accept your invitation:</p>
        <a href="${inviteUrl}">${inviteUrl}</a>
        <p>This invitation expires in 7 days.</p>
      `,
    })
  } catch (emailError: any) {
    throw new Error(`Failed to send email: ${emailError.message}`)
  }

  return NextResponse.json({
    success: true,
    inviteId: invite.id,
  }, { status: 201 })
})