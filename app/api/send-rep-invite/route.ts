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

function buildInviteEmail(params: {
  facilityName: string
  companyName: string
  inviteUrl: string
  logoUrl: string
}) {
  const { facilityName, companyName, inviteUrl, logoUrl } = params

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ORbit Invitation</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

          <!-- Header with logo -->
          <tr>
            <td style="background-color:#0f172a;padding:32px 40px;text-align:center;">
              <img src="${logoUrl}" alt="ORbit" width="48" height="48" style="display:inline-block;margin-bottom:12px;border-radius:12px;" />
              <div style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">ORbit</div>
              <div style="color:#94a3b8;font-size:13px;margin-top:4px;">Surgical Case Management</div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px 24px;">
              <h1 style="margin:0 0 8px;font-size:20px;font-weight:600;color:#0f172a;">You're Invited</h1>
              <p style="margin:0;font-size:15px;color:#475569;line-height:1.6;">
                <strong>${facilityName}</strong> has invited you to join ORbit as a device representative for <strong>${companyName}</strong>.
              </p>
            </td>
          </tr>

          <!-- What you'll be able to do -->
          <tr>
            <td style="padding:0 40px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;">
                <tr>
                  <td style="padding:20px 24px;">
                    <div style="font-size:13px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px;">As a device rep, you'll be able to:</div>
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:4px 0;font-size:14px;color:#334155;line-height:1.5;">
                          <span style="color:#22c55e;margin-right:8px;">&#10003;</span> View cases using ${companyName} implants
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;font-size:14px;color:#334155;line-height:1.5;">
                          <span style="color:#22c55e;margin-right:8px;">&#10003;</span> Confirm tray availability and delivery
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;font-size:14px;color:#334155;line-height:1.5;">
                          <span style="color:#22c55e;margin-right:8px;">&#10003;</span> Record implant sizes and details
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;font-size:14px;color:#334155;line-height:1.5;">
                          <span style="color:#22c55e;margin-right:8px;">&#10003;</span> Receive notifications for case updates
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="padding:0 40px 16px;text-align:center;">
              <a href="${inviteUrl}" style="display:inline-block;padding:14px 36px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:10px;font-size:15px;font-weight:600;letter-spacing:-0.2px;">Accept Invitation</a>
            </td>
          </tr>

          <!-- Fallback link -->
          <tr>
            <td style="padding:0 40px 32px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5;">
                Or copy this link into your browser:<br />
                <a href="${inviteUrl}" style="color:#2563eb;word-break:break-all;">${inviteUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 40px;">
              <div style="border-top:1px solid #e2e8f0;"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px 32px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5;">
                This invitation expires in 7 days.<br />
                If you didn't expect this email, you can safely ignore it.
              </p>
              <p style="margin:16px 0 0;font-size:11px;color:#cbd5e1;">
                &copy; ${new Date().getFullYear()} ORbit Surgical &middot; All rights reserved
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

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
  const logoUrl = `${baseUrl}/images/orbitcircle.png`
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@orbitsurgical.com'

  const html = buildInviteEmail({
    facilityName: validated.facilityName,
    companyName: validated.companyName,
    inviteUrl,
    logoUrl,
  })

  await resend.emails.send({
    from: `ORbit <${fromEmail}>`,
    to: validated.email,
    subject: `You're invited to ORbit — ${validated.facilityName}`,
    html,
  })

  return NextResponse.json({ success: true }, { status: 200 })
})
