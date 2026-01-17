// lib/email.ts
// Email sending utilities using Resend
// 
// Setup required:
// 1. Install Resend: npm install resend
// 2. Add RESEND_API_KEY to environment variables
// 3. Verify your domain in Resend dashboard

import { Resend } from 'resend'

// Initialize Resend client
let resend: Resend | null = null

function getResendClient() {
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY)
  }
  return resend
}

// Default sender - update with your verified domain
const DEFAULT_FROM = 'ORbit <noreply@orbitsurgical.com>'

// App URL for links
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.orbitsurgical.com'

export interface EmailResult {
  success: boolean
  messageId?: string
  error?: string
}

/**
 * Send welcome email to new facility admin
 * Includes their temporary password
 * @deprecated Use sendUserInviteEmail instead for new invites
 */
export async function sendWelcomeEmail(
  to: string,
  firstName: string,
  facilityName: string,
  temporaryPassword: string
): Promise<EmailResult> {
  try {
    const { data, error } = await getResendClient().emails.send({
      from: DEFAULT_FROM,
      to: [to],
      subject: 'Welcome to ORbit — Your account is ready',
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
            <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #0f172a;">Welcome to ORbit</h1>
          </div>
          
          <p style="margin: 0 0 16px;">Hi ${firstName},</p>
          
          <p style="margin: 0 0 16px;">Your ORbit account has been created for <strong>${facilityName}</strong>.</p>
          
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin: 24px 0;">
            <p style="margin: 0 0 12px; font-size: 14px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Your Login Credentials</p>
            <p style="margin: 0 0 8px;"><strong>Login URL:</strong> <a href="${APP_URL}" style="color: #2563eb;">${APP_URL}</a></p>
            <p style="margin: 0 0 8px;"><strong>Email:</strong> ${to}</p>
            <p style="margin: 0;"><strong>Temporary Password:</strong> <code style="background: #e2e8f0; padding: 2px 8px; border-radius: 4px; font-family: monospace;">${temporaryPassword}</code></p>
          </div>
          
          <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 12px; padding: 16px; margin: 24px 0;">
            <p style="margin: 0; color: #92400e; font-size: 14px;">
              <strong>⚠️ Important:</strong> Please log in and change your password immediately.
            </p>
          </div>
          
          <p style="margin: 0 0 16px;">As the administrator for your facility, you can:</p>
          <ul style="margin: 0 0 24px; padding-left: 20px; color: #475569;">
            <li>Invite your OR staff</li>
            <li>Configure your operating rooms</li>
            <li>Add your procedure types</li>
            <li>Track surgical case efficiency</li>
          </ul>
          
          <div style="text-align: center; margin: 32px 0;">
            <a href="${APP_URL}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 600; font-size: 16px;">Log In to ORbit</a>
          </div>
          
          <p style="margin: 24px 0 0; color: #64748b; font-size: 14px;">Questions? Reply to this email and we'll help you get started.</p>
          
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0;">
          
          <p style="margin: 0; color: #94a3b8; font-size: 12px; text-align: center;">
            © ${new Date().getFullYear()} ORbit Surgical. All rights reserved.
          </p>
        </body>
        </html>
      `,
      text: `
Welcome to ORbit

Hi ${firstName},

Your ORbit account has been created for ${facilityName}.

Your Login Credentials:
- Login URL: ${APP_URL}
- Email: ${to}
- Temporary Password: ${temporaryPassword}

IMPORTANT: Please log in and change your password immediately.

As the administrator for your facility, you can:
- Invite your OR staff
- Configure your operating rooms
- Add your procedure types
- Track surgical case efficiency

Questions? Reply to this email and we'll help you get started.

© ${new Date().getFullYear()} ORbit Surgical
      `.trim(),
    })

    if (error) {
      console.error('[EMAIL ERROR] Failed to send welcome email:', error)
      return { success: false, error: error.message }
    }

    return { success: true, messageId: data?.id }
  } catch (err) {
    console.error('[EMAIL ERROR] Exception sending welcome email:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

/**
 * Send invitation email to new facility user (admin or staff)
 * Uses token-based flow - user clicks link to set their password
 * 
 * @param to - Email address
 * @param firstName - User's first name
 * @param facilityName - Name of the facility
 * @param invitedByName - Name of person who sent invite
 * @param invitationToken - Unique token for the invite
 * @param accessLevel - 'facility_admin' or 'user' (optional, for customizing email content)
 */
export async function sendUserInviteEmail(
  to: string,
  firstName: string,
  facilityName: string,
  invitedByName: string,
  invitationToken: string,
  accessLevel: 'facility_admin' | 'user' = 'user'
): Promise<EmailResult> {
  // IMPORTANT: This URL must match the page at app/invite/user/[token]/page.tsx
  const inviteUrl = `${APP_URL}/invite/user/${invitationToken}`

  const isAdmin = accessLevel === 'facility_admin'
  const roleDescription = isAdmin 
    ? 'As an administrator, you\'ll have full access to manage your facility.'
    : 'You\'ll be able to view cases and record milestones during procedures.'

  try {
    const { data, error } = await getResendClient().emails.send({
      from: DEFAULT_FROM,
      to: [to],
      subject: `You're invited to join ${facilityName} on ORbit`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc;">
            <tr>
              <td align="center" style="padding: 40px 20px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 520px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                  
                  <!-- Header -->
                  <tr>
                    <td style="padding: 40px 40px 24px 40px; text-align: center;">
                      <div style="display: inline-block; width: 56px; height: 56px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border-radius: 14px; line-height: 56px;">
                        <span style="color: white; font-size: 28px; font-weight: bold;">O</span>
                      </div>
                    </td>
                  </tr>
                  
                  <!-- Title -->
                  <tr>
                    <td style="padding: 0 40px 16px 40px; text-align: center;">
                      <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #0f172a;">You're Invited!</h1>
                    </td>
                  </tr>
                  
                  <!-- Message -->
                  <tr>
                    <td style="padding: 0 40px 24px 40px;">
                      <p style="margin: 0 0 16px; font-size: 16px; color: #475569; line-height: 1.6;">
                        Hi ${firstName},
                      </p>
                      <p style="margin: 0; font-size: 16px; color: #475569; line-height: 1.6;">
                        ${invitedByName} has invited you to join <strong style="color: #0f172a;">${facilityName}</strong> on ORbit — the surgical case management platform.
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Role Badge -->
                  <tr>
                    <td style="padding: 0 40px 24px 40px; text-align: center;">
                      <span style="display: inline-block; padding: 6px 12px; background: ${isAdmin ? '#f3e8ff' : '#dbeafe'}; color: ${isAdmin ? '#7c3aed' : '#2563eb'}; font-size: 13px; font-weight: 600; border-radius: 20px;">
                        ${isAdmin ? '👑 Administrator' : '👤 Staff Member'}
                      </span>
                    </td>
                  </tr>
                  
                  <!-- CTA Button -->
                  <tr>
                    <td style="padding: 0 40px 32px 40px; text-align: center;">
                      <a href="${inviteUrl}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);">
                        Accept Invitation
                      </a>
                    </td>
                  </tr>
                  
                  <!-- What you'll be able to do -->
                  <tr>
                    <td style="padding: 0 40px 32px 40px;">
                      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px;">
                        <p style="margin: 0 0 12px; font-weight: 600; color: #0f172a; font-size: 14px;">
                          What you'll be able to do:
                        </p>
                        <ul style="margin: 0; padding-left: 20px; color: #475569; font-size: 14px; line-height: 1.8;">
                          ${isAdmin ? `
                            <li>Manage your facility's settings and users</li>
                            <li>Create and manage surgical cases</li>
                            <li>View analytics and reports</li>
                            <li>Invite staff members</li>
                          ` : `
                            <li>View your surgical case schedule</li>
                            <li>Track cases in real-time</li>
                            <li>Record milestones during procedures</li>
                            <li>Receive push notifications for updates</li>
                          `}
                        </ul>
                      </div>
                    </td>
                  </tr>
                  
                  <!-- Expiry notice -->
                  <tr>
                    <td style="padding: 0 40px 24px 40px;">
                      <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 12px; padding: 16px;">
                        <p style="margin: 0; color: #92400e; font-size: 14px;">
                          <strong>⏰ Note:</strong> This invitation expires in 7 days.
                        </p>
                      </div>
                    </td>
                  </tr>
                  
                  <!-- Fallback link -->
                  <tr>
                    <td style="padding: 0 40px 32px 40px; text-align: center;">
                      <p style="margin: 0; color: #64748b; font-size: 13px;">
                        Or copy and paste this link into your browser:<br>
                        <a href="${inviteUrl}" style="color: #2563eb; word-break: break-all; font-size: 12px;">${inviteUrl}</a>
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="padding: 24px 40px; border-top: 1px solid #e2e8f0; text-align: center;">
                      <p style="margin: 0; color: #94a3b8; font-size: 12px;">
                        © ${new Date().getFullYear()} ORbit Surgical. All rights reserved.
                      </p>
                      <p style="margin: 8px 0 0; color: #94a3b8; font-size: 12px;">
                        If you didn't expect this invitation, you can safely ignore this email.
                      </p>
                    </td>
                  </tr>
                  
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
      text: `
You're Invited to ORbit!

Hi ${firstName},

${invitedByName} has invited you to join ${facilityName} on ORbit — the surgical case management platform.

You've been invited as: ${isAdmin ? 'Administrator' : 'Staff Member'}

Click the link below to accept your invitation and create your account:
${inviteUrl}

${isAdmin ? `
What you'll be able to do:
- Manage your facility's settings and users
- Create and manage surgical cases
- View analytics and reports
- Invite staff members
` : `
What you'll be able to do:
- View your surgical case schedule
- Track cases in real-time
- Record milestones during procedures
- Receive push notifications for updates
`}

Note: This invitation expires in 7 days.

If you didn't expect this invitation, you can safely ignore this email.

© ${new Date().getFullYear()} ORbit Surgical
      `.trim(),
    })

    if (error) {
      console.error('[EMAIL ERROR] Failed to send user invite email:', error)
      return { success: false, error: error.message }
    }

    return { success: true, messageId: data?.id }
  } catch (err) {
    console.error('[EMAIL ERROR] Exception sending user invite email:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

/**
 * Send invitation email to new user
 * @deprecated Use sendUserInviteEmail instead - this version uses wrong URL path
 */
export async function sendInvitationEmail(
  to: string,
  firstName: string,
  facilityName: string,
  invitedByName: string,
  invitationToken: string
): Promise<EmailResult> {
  // Forward to new function for backwards compatibility
  return sendUserInviteEmail(to, firstName, facilityName, invitedByName, invitationToken, 'user')
}

/**
 * Send trial expiration warning email
 */
export async function sendTrialWarningEmail(
  to: string,
  firstName: string,
  facilityName: string,
  daysRemaining: number
): Promise<EmailResult> {
  try {
    const { data, error } = await getResendClient().emails.send({
      from: DEFAULT_FROM,
      to: [to],
      subject: `Your ORbit trial expires in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <div style="display: inline-block; width: 48px; height: 48px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 12px; margin-bottom: 16px;">
              <span style="color: white; font-size: 24px; line-height: 48px;">⏰</span>
            </div>
            <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #0f172a;">Trial Expiring Soon</h1>
          </div>
          
          <p style="margin: 0 0 16px;">Hi ${firstName},</p>
          
          <p style="margin: 0 0 16px;">Your ORbit trial for <strong>${facilityName}</strong> expires in <strong>${daysRemaining} day${daysRemaining === 1 ? '' : 's'}</strong>.</p>
          
          <p style="margin: 0 0 16px;">To continue using ORbit and keep your data, please contact us to activate your subscription.</p>
          
          <div style="text-align: center; margin: 32px 0;">
            <a href="mailto:sales@orbitsurgical.com?subject=Activate%20ORbit%20for%20${encodeURIComponent(facilityName)}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 600; font-size: 16px;">Contact Us</a>
          </div>
          
          <p style="margin: 24px 0 0; color: #64748b; font-size: 14px;">Questions? Reply to this email and we'll be happy to help.</p>
          
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0;">
          
          <p style="margin: 0; color: #94a3b8; font-size: 12px; text-align: center;">
            © ${new Date().getFullYear()} ORbit Surgical. All rights reserved.
          </p>
        </body>
        </html>
      `,
      text: `
Trial Expiring Soon

Hi ${firstName},

Your ORbit trial for ${facilityName} expires in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}.

To continue using ORbit and keep your data, please contact us to activate your subscription.

Email us at: sales@orbitsurgical.com

Questions? Reply to this email and we'll be happy to help.

© ${new Date().getFullYear()} ORbit Surgical
      `.trim(),
    })

    if (error) {
      console.error('[EMAIL ERROR] Failed to send trial warning email:', error)
      return { success: false, error: error.message }
    }

    return { success: true, messageId: data?.id }
  } catch (err) {
    console.error('[EMAIL ERROR] Exception sending trial warning email:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
  to: string,
  firstName: string,
  resetToken: string
): Promise<EmailResult> {
  const resetUrl = `${APP_URL}/auth/reset-password/${resetToken}`

  try {
    const { data, error } = await getResendClient().emails.send({
      from: DEFAULT_FROM,
      to: [to],
      subject: 'Reset your ORbit password',
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
              <span style="color: white; font-size: 24px; line-height: 48px;">🔐</span>
            </div>
            <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #0f172a;">Reset Your Password</h1>
          </div>
          
          <p style="margin: 0 0 16px;">Hi ${firstName},</p>
          
          <p style="margin: 0 0 16px;">We received a request to reset your ORbit password. Click the button below to choose a new password:</p>
          
          <div style="text-align: center; margin: 32px 0;">
            <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 600; font-size: 16px;">Reset Password</a>
          </div>
          
          <p style="margin: 0 0 16px; color: #64748b; font-size: 14px;">This link expires in 1 hour.</p>
          
          <p style="margin: 24px 0 0; color: #64748b; font-size: 14px;">If you didn't request a password reset, you can safely ignore this email.</p>
          
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0;">
          
          <p style="margin: 0; color: #94a3b8; font-size: 12px; text-align: center;">
            © ${new Date().getFullYear()} ORbit Surgical. All rights reserved.
          </p>
        </body>
        </html>
      `,
      text: `
Reset Your Password

Hi ${firstName},

We received a request to reset your ORbit password. Click the link below to choose a new password:

${resetUrl}

This link expires in 1 hour.

If you didn't request a password reset, you can safely ignore this email.

© ${new Date().getFullYear()} ORbit Surgical
      `.trim(),
    })

    if (error) {
      console.error('[EMAIL ERROR] Failed to send password reset email:', error)
      return { success: false, error: error.message }
    }

    return { success: true, messageId: data?.id }
  } catch (err) {
    console.error('[EMAIL ERROR] Exception sending password reset email:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
