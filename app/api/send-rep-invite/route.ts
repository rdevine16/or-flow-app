import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler, handleSupabaseError } from '@/lib/errorHandling'
import { validate } from '@/lib/validation/schemas'
import { createClient } from '@/lib/supabase-server'
import { nowUTC } from '@/lib/dateFactory'
import { Resend } from 'resend'

// Validation schema
const sendRepInviteSchema = z.object({
  email: z.string().email('Invalid email'),
  facilityId: z.string().uuid('Invalid facility ID'),
  implantCompanyId: z.string().uuid('Invalid company ID'),
})

export const POST = withErrorHandler(async (req: NextRequest) => {
  const supabase = await createClient()
  const body = await req.json()
  const validated = validate(sendRepInviteSchema, body)

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
  expiresAt.setDate(expiresAt.getDate() + 7) // 7 days from now

  // Create invite
  const { data: invite, error: inviteError } = await supabase
    .from('device_rep_invites')
    .insert({
      email: validated.email,
      facility_id: validated.facilityId,
      implant_company_id: validated.implantCompanyId,
      token,
      expires_at: expiresAt.toISOString(),
      created_at: nowUTC(),
    })
    .select('id, facilities(name)')
    .single()

  if (inviteError) handleSupabaseError(inviteError)

  // Send email
  const resend = new Resend(process.env.RESEND_API_KEY)
  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/rep-signup?token=${token}`

  try {
    await resend.emails.send({
      from: 'ORbit <noreply@yourdomain.com>',
      to: validated.email,
      subject: `Device Rep Invitation - ${invite.facilities?.[0]?.name || 'ORbit'}`,
      html: `
        <h2>You've been invited as a Device Representative</h2>
        <p>Click the link below to create your account:</p>
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