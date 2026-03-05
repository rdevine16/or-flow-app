import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler } from '@/lib/errorHandling'
import { validate } from '@/lib/validation/schemas'
import { Resend } from 'resend'

// Validation schema — matches what PageClient sends
const sendRepInviteSchema = z.object({
  email: z.string().email('Invalid email'),
  facilityName: z.string().min(1, 'Facility name required'),
  companyName: z.string().min(1, 'Company name required'),
  inviteToken: z.string().uuid('Invalid invite token'),
})

export const POST = withErrorHandler(async (req: NextRequest) => {
  const body = await req.json()
  const validated = validate(sendRepInviteSchema, body)

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { error: 'Email service not configured' },
      { status: 503 }
    )
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || '').trim()
  const inviteUrl = `${baseUrl}/invite/accept/${validated.inviteToken}`
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@orbitsurgical.com'

  await resend.emails.send({
    from: `ORbit <${fromEmail}>`,
    to: validated.email,
    subject: `Device Rep Invitation - ${validated.facilityName}`,
    html: [
      '<h2>You\'ve been invited as a Device Representative</h2>',
      `<p><strong>${validated.facilityName}</strong> has invited you to access their cases on ORbit as a representative for <strong>${validated.companyName}</strong>.</p>`,
      '<p>Click the link below to accept the invitation and create your account:</p>',
      `<p><a href="${inviteUrl}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">Accept Invitation</a></p>`,
      `<p style="color:#64748b;font-size:14px;">Or copy this link: ${inviteUrl}</p>`,
      '<p style="color:#64748b;font-size:14px;">This invitation expires in 7 days.</p>',
    ].join('\n'),
  })

  return NextResponse.json({ success: true }, { status: 200 })
})
