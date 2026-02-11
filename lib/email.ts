// lib/email.ts
// Email sending utilities using Resend
// 
// Setup required:
// 1. Install Resend: npm install resend
// 2. Add RESEND_API_KEY to environment variables
// 3. Verify your domain in Resend dashboard

import { Resend } from 'resend'
import { logger } from '@/lib/logger'

const log = logger('email')

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
      log.error('[EMAIL ERROR] Failed to send welcome email:', error)
      return { success: false, error: error.message }
    }

    return { success: true, messageId: data?.id }
  } catch (err) {
    log.error('[EMAIL ERROR] Exception sending welcome email:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// REPLACE the sendUserInviteEmail function in lib/email.ts with this version
// Find the function starting at "export async function sendUserInviteEmail"
// and replace it entirely with this code:

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

  try {
    const { data, error } = await getResendClient().emails.send({
      from: DEFAULT_FROM,
      to: [to],
      subject: `You've been invited to join ${facilityName} on ORbit`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9;">
            <tr>
              <td align="center" style="padding: 48px 20px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 480px;">
                  
                  <!-- Logo Header -->
                  <tr>
                    <td style="padding-bottom: 32px; text-align: center;">
                      <div style="display: inline-block; width: 48px; height: 48px; background: #2563eb; border-radius: 12px; line-height: 48px;">
                        <span style="color: white; font-size: 24px; font-weight: 700;">O</span>
                      </div>
                    </td>
                  </tr>
                  
                  <!-- Main Card -->
                  <tr>
                    <td style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                        
                        <!-- Card Content -->
                        <tr>
                          <td style="padding: 40px;">
                            
                            <!-- Greeting -->
                            <p style="margin: 0 0 24px; font-size: 15px; color: #334155; line-height: 1.6;">
                              Hi ${firstName},
                            </p>
                            
                            <!-- Main Message -->
                            <p style="margin: 0 0 24px; font-size: 15px; color: #334155; line-height: 1.6;">
                              <strong style="color: #0f172a;">${invitedByName}</strong> has invited you to join <strong style="color: #0f172a;">${facilityName}</strong> on ORbit, the surgical case management platform.
                            </p>
                            
                            <!-- Role Info -->
                            <div style="background: #f8fafc; border-left: 3px solid ${isAdmin ? '#2563eb' : '#64748b'}; padding: 16px 20px; margin: 0 0 28px; border-radius: 0 8px 8px 0;">
                              <p style="margin: 0 0 4px; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">
                                Your Role
                              </p>
                              <p style="margin: 0; font-size: 15px; font-weight: 600; color: #0f172a;">
                                ${isAdmin ? 'Facility Administrator' : 'Staff Member'}
                              </p>
                            </div>
                            
                            <!-- CTA Button -->
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                              <tr>
                                <td align="center" style="padding: 4px 0 28px;">
                                  <a href="${inviteUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-weight: 600; font-size: 15px;">
                                    Accept Invitation
                                  </a>
                                </td>
                              </tr>
                            </table>
                            
                            <!-- What you can do -->
                            <p style="margin: 0 0 12px; font-size: 13px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">
                              What you'll be able to do
                            </p>
                            <table role="presentation" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                              ${isAdmin ? `
                              <tr>
                                <td style="padding: 6px 0; font-size: 14px; color: #475569;">• Manage facility settings and users</td>
                              </tr>
                              <tr>
                                <td style="padding: 6px 0; font-size: 14px; color: #475569;">• Create and manage surgical cases</td>
                              </tr>
                              <tr>
                                <td style="padding: 6px 0; font-size: 14px; color: #475569;">• View analytics and reports</td>
                              </tr>
                              <tr>
                                <td style="padding: 6px 0; font-size: 14px; color: #475569;">• Invite additional staff members</td>
                              </tr>
                              ` : `
                              <tr>
                                <td style="padding: 6px 0; font-size: 14px; color: #475569;">• View your surgical case schedule</td>
                              </tr>
                              <tr>
                                <td style="padding: 6px 0; font-size: 14px; color: #475569;">• Track cases in real-time</td>
                              </tr>
                              <tr>
                                <td style="padding: 6px 0; font-size: 14px; color: #475569;">• Record milestones during procedures</td>
                              </tr>
                              <tr>
                                <td style="padding: 6px 0; font-size: 14px; color: #475569;">• Receive notifications for updates</td>
                              </tr>
                              `}
                            </table>
                            
                            <!-- Expiry Notice -->
                            <p style="margin: 0; padding: 12px 16px; background: #fefce8; border-radius: 6px; font-size: 13px; color: #854d0e;">
                              This invitation expires in 7 days.
                            </p>
                            
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="padding: 32px 20px; text-align: center;">
                      <p style="margin: 0 0 8px; font-size: 12px; color: #94a3b8;">
                        If you didn't expect this invitation, you can safely ignore this email.
                      </p>
                      <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                        © ${new Date().getFullYear()} ORbit Surgical
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
Hi ${firstName},

${invitedByName} has invited you to join ${facilityName} on ORbit, the surgical case management platform.

Your Role: ${isAdmin ? 'Facility Administrator' : 'Staff Member'}

Click the link below to accept your invitation and create your account:
${inviteUrl}

${isAdmin ? `
What you'll be able to do:
- Manage facility settings and users
- Create and manage surgical cases
- View analytics and reports
- Invite additional staff members
` : `
What you'll be able to do:
- View your surgical case schedule
- Track cases in real-time
- Record milestones during procedures
- Receive notifications for updates
`}

This invitation expires in 7 days.

If you didn't expect this invitation, you can safely ignore this email.

© ${new Date().getFullYear()} ORbit Surgical
      `.trim(),
    })

    if (error) {
      log.error('[EMAIL ERROR] Failed to send user invite email:', error)
      return { success: false, error: error.message }
    }

    return { success: true, messageId: data?.id }
  } catch (err) {
    log.error('[EMAIL ERROR] Exception sending user invite email:', err)
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
      log.error('[EMAIL ERROR] Failed to send trial warning email:', error)
      return { success: false, error: error.message }
    }

    return { success: true, messageId: data?.id }
  } catch (err) {
    log.error('[EMAIL ERROR] Exception sending trial warning email:', err)
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
      log.error('[EMAIL ERROR] Failed to send password reset email:', error)
      return { success: false, error: error.message }
    }

    return { success: true, messageId: data?.id }
  } catch (err) {
    log.error('[EMAIL ERROR] Exception sending password reset email:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
