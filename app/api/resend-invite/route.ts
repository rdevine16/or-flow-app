// app/api/resend-invite/route.ts
// 
// REPLACEMENT: Works with user_invites table + lib/email.ts
// NO MORE Supabase inviteUserByEmail()
//
// This handles resending invites for both:
// - user_invites (facility admins and staff)
// - device_rep_invites (device representatives)

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendUserInviteEmail } from '@/lib/email'
import { Resend } from 'resend'
import crypto from 'crypto'

// Initialize clients
const resend = new Resend(process.env.RESEND_API_KEY)

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)

// Config
const DEFAULT_FROM = 'ORbit <noreply@orbitsurgical.com>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.orbitsurgical.com'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    const normalizedEmail = email.trim().toLowerCase()

    // First, check if there's a pending invite in user_invites
    const { data: userInvite } = await supabaseAdmin
      .from('user_invites')
      .select(`
        id,
        first_name,
        last_name,
        facility_id,
        access_level,
        facilities (name)
      `)
      .eq('email', normalizedEmail)
      .is('accepted_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (userInvite) {
      return await resendUserInvite(normalizedEmail, userInvite)
    }

    // Check device_rep_invites table
    const { data: repInvite } = await supabaseAdmin
      .from('device_rep_invites')
      .select(`
        id,
        facility_id,
        implant_company_id,
        facilities (name),
        implant_companies (name)
      `)
      .eq('email', normalizedEmail)
      .is('accepted_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (repInvite) {
      return await resendDeviceRepInvite(normalizedEmail, repInvite)
    }

    // No pending invite found in either table
    return NextResponse.json(
      { error: 'No pending invite found for this email' },
      { status: 404 }
    )

  } catch (error) {
    console.error('Resend invite error:', error)
    return NextResponse.json(
      { error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}

// ============================================
// RESEND USER INVITE (facility admin/staff)
// ============================================
async function resendUserInvite(email: string, invite: any) {
  // Generate new token and update expiry
  const newToken = crypto.randomUUID()
  const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  // Update the invite with new token and expiry
  const { error: updateError } = await supabaseAdmin
    .from('user_invites')
    .update({
      invite_token: newToken,
      expires_at: newExpiry,
    })
    .eq('id', invite.id)

  if (updateError) {
    console.error('Failed to update invite:', updateError)
    return NextResponse.json(
      { error: 'Failed to refresh invite token' },
      { status: 500 }
    )
  }

  // Get facility name (handle Supabase's array/object return)
  const facilityName = Array.isArray(invite.facilities) 
    ? invite.facilities[0]?.name 
    : invite.facilities?.name || 'your facility'

  // Send email using lib/email.ts
  const emailResult = await sendUserInviteEmail(
    email,
    invite.first_name,
    facilityName,
    'Your administrator', // Generic since we don't track original inviter on resend
    newToken,
    invite.access_level || 'user'
  )

  if (!emailResult.success) {
    console.error('Failed to send email:', emailResult.error)
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    message: 'Invite resent successfully',
  })
}

// ============================================
// RESEND DEVICE REP INVITE
// ============================================
async function resendDeviceRepInvite(email: string, invite: any) {
  // Generate new token and update expiry
  const newToken = crypto.randomUUID()
  const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  // Update the invite
  const { error: updateError } = await supabaseAdmin
    .from('device_rep_invites')
    .update({
      invite_token: newToken,
      expires_at: newExpiry,
    })
    .eq('id', invite.id)

  if (updateError) {
    console.error('Failed to update invite:', updateError)
    return NextResponse.json(
      { error: 'Failed to refresh invite token' },
      { status: 500 }
    )
  }

  // Get names (handle Supabase's array/object return)
  const facilityName = Array.isArray(invite.facilities) 
    ? invite.facilities[0]?.name 
    : invite.facilities?.name || 'the facility'

  const companyName = Array.isArray(invite.implant_companies) 
    ? invite.implant_companies[0]?.name 
    : invite.implant_companies?.name || 'your company'

  // Build invite URL for device reps
  const inviteUrl = `${APP_URL}/invite/accept/${newToken}`

  // Send email via Resend directly (device rep has different format)
  const { error: emailError } = await resend.emails.send({
    from: DEFAULT_FROM,
    to: [email],
    subject: `Reminder: You're invited to access ${facilityName} on ORbit`,
    html: generateDeviceRepInviteHtml({ facilityName, companyName, inviteUrl }),
    text: generateDeviceRepInviteText({ facilityName, companyName, inviteUrl }),
  })

  if (emailError) {
    console.error('Failed to send email:', emailError)
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    message: 'Invite resent successfully',
  })
}

// ============================================
// DEVICE REP EMAIL TEMPLATES
// (keeping consistent with route (5).ts pattern)
// ============================================

function generateDeviceRepInviteHtml({ facilityName, companyName, inviteUrl }: { facilityName: string, companyName: string, inviteUrl: string }): string {
  return `
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
    <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #0f172a;">Reminder: Device Rep Invitation</h1>
  </div>
  
  <p style="margin: 0 0 16px;">Hi,</p>
  
  <p style="margin: 0 0 16px;">This is a reminder that you've been invited to access surgical case information at <strong>${facilityName}</strong> as a <strong>${companyName}</strong> device representative.</p>
  
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
  
  <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 12px; padding: 16px; margin: 24px 0;">
    <p style="margin: 0; color: #92400e; font-size: 14px;">
      <strong>⏰ Note:</strong> This invitation expires in 7 days.
    </p>
  </div>
  
  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0;">
  
  <p style="margin: 0; color: #94a3b8; font-size: 12px; text-align: center;">
    © ${new Date().getFullYear()} ORbit Surgical. All rights reserved.
  </p>
</body>
</html>
`
}

function generateDeviceRepInviteText({ facilityName, companyName, inviteUrl }: { facilityName: string, companyName: string, inviteUrl: string }): string {
  return `
Reminder: Device Rep Access Invitation

Hi,

This is a reminder that you've been invited to access surgical case information at ${facilityName} as a ${companyName} device representative.

As a device rep, you'll be able to:
- View cases using ${companyName} implants
- See case schedule, surgeon, and OR room
- Receive notifications for case updates

Click the link below to accept your invitation:
${inviteUrl}

Note: This invitation expires in 7 days.

© ${new Date().getFullYear()} ORbit Surgical
  `.trim()
}
