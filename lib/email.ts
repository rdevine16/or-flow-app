// lib/email.ts
// Email sending utilities using Resend
// 
// Setup required:
// 1. Install Resend: npm install resend
// 2. Add RESEND_API_KEY to environment variables
// 3. Verify your domain in Resend dashboard

import { Resend } from 'resend'

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY)

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
 */
export async function sendWelcomeEmail(
  to: string,
  firstName: string,
  facilityName: string,
  temporaryPassword: string
): Promise<EmailResult> {
  try {
    const { data, error } = await resend.emails.send({
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
 * Send invitation email to new user
 * Includes a link to accept the invitation and set their password
 */
export async function sendInvitationEmail(
  to: string,
  firstName: string,
  facilityName: string,
  invitedByName: string,
  invitationToken: string
): Promise<EmailResult> {
  const inviteUrl = `${APP_URL}/invite/${invitationToken}`

  try {
    const { data, error } = await resend.emails.send({
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
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <div style="display: inline-block; width: 48px; height: 48px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border-radius: 12px; margin-bottom: 16px;">
              <span style="color: white; font-size: 24px; line-height: 48px;">⏱</span>
            </div>
            <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #0f172a;">You're Invited!</h1>
          </div>
          
          <p style="margin: 0 0 16px;">Hi ${firstName},</p>
          
          <p style="margin: 0 0 16px;">${invitedByName} has invited you to join <strong>${facilityName}</strong> on ORbit — the surgical case management platform.</p>
          
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
You're Invited to ORbit!

Hi ${firstName},

${invitedByName} has invited you to join ${facilityName} on ORbit — the surgical case management platform.

Click the link below to accept your invitation and create your account:
${inviteUrl}

Note: This invitation expires in 7 days.

If you didn't expect this invitation, you can safely ignore this email.

© ${new Date().getFullYear()} ORbit Surgical
      `.trim(),
    })

    if (error) {
      console.error('[EMAIL ERROR] Failed to send invitation email:', error)
      return { success: false, error: error.message }
    }

    return { success: true, messageId: data?.id }
  } catch (err) {
    console.error('[EMAIL ERROR] Exception sending invitation email:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
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
    const { data, error } = await resend.emails.send({
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
    const { data, error } = await resend.emails.send({
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
