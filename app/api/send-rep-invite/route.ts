import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const DEFAULT_FROM = 'ORbit <noreply@orbitsurgical.com>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.orbitsurgical.com'

export async function POST(request: NextRequest) {
  try {
    const { email, facilityName, companyName, inviteToken } = await request.json()

    // Validate input
    if (!email || !facilityName || !companyName || !inviteToken) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const inviteUrl = `${APP_URL}/invite/accept/${inviteToken}`

    const { data, error } = await resend.emails.send({
      from: DEFAULT_FROM,
      to: [email],
      subject: `You're invited to access ${facilityName} on ORbit`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <div style="display: inline-block; width: 48px; height: 48px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border-radius: 12px; margin-bottom: 16px;">
              <span style="color: white; font-size: 24px; line-height: 48px;">⏱</span>
            </div>
            <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #0f172a;">Device Rep Access Invitation</h1>
          </div>
          
          <p style="margin: 0 0 16px;">Hi,</p>
          
          <p style="margin: 0 0 16px;">You've been invited to access surgical case information at <strong>${facilityName}</strong> as a <strong>${companyName}</strong> device representative.</p>
          
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 24px 0;">
            <p style="margin: 0 0 12px; font-weight: 600; color: #0f172a;">As a device rep, you'll be able to:</p>
            <ul style="margin: 0; padding-left: 20px; color: #475569;">
              <li>View cases using ${companyName} implants</li>
              <li>See case schedule, surgeon, and OR room</li>
              <li>Receive notifications for case updates</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 32px 0;">
            <a href="${inviteUrl}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 600; font-size: 16px;">Accept Invitation</a>
          </div>
          
          <p style="margin: 0 0 16px; color: #64748b; font-size: 14px; text-align: center;">
            Or copy and paste this link into your browser:<br>
            <a href="${inviteUrl}" style="color: #2563eb; word-break: break-all;">${inviteUrl}</a>
          </p>
          
          <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 12px; padding: 16px; margin: 24px 0;">
            <p style="margin: 0; color: #92400e; font-size: 14px;">
              <strong>⏰ Note:</strong> This invitation expires in 7 days.
            </p>
          </div>
          
          <p style="margin: 24px 0 0; color: #64748b; font-size: 14px;">If you didn't expect this invitation, you can safely ignore this email.</p>
          
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0;">
          
          <p style="margin: 0; color: #94a3b8; font-size: 12px; text-align: center;">
            © ${new Date().getFullYear()} ORbit Surgical. All rights reserved.
          </p>
        </body>
        </html>
      `,
      text: `
Device Rep Access Invitation

Hi,

You've been invited to access surgical case information at ${facilityName} as a ${companyName} device representative.

As a device rep, you'll be able to:
- View cases using ${companyName} implants
- See case schedule, surgeon, and OR room
- Receive notifications for case updates

Click the link below to accept your invitation:
${inviteUrl}

Note: This invitation expires in 7 days.

If you didn't expect this invitation, you can safely ignore this email.

© ${new Date().getFullYear()} ORbit Surgical
      `.trim(),
    })

    if (error) {
      console.error('[EMAIL ERROR] Failed to send device rep invite:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true,
      messageId: data?.id 
    })

  } catch (error) {
    console.error('[EMAIL ERROR] Exception sending device rep invite:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
