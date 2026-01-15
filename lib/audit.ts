// lib/audit.ts
// HIPAA-compliant audit logging helper
// All actions are logged with who, what, when, and outcome

import { SupabaseClient } from '@supabase/supabase-js'

// Audit action categories
export type AuditAction =
  // Authentication
  | 'auth.login'
  | 'auth.logout'
  | 'auth.login_failed'
  | 'auth.password_reset'
  | 'auth.password_changed'
  // User management
  | 'user.created'
  | 'user.updated'
  | 'user.deactivated'
  | 'user.reactivated'
  | 'user.role_changed'
  | 'user.invited'
  | 'user.invitation_accepted'
  | 'user.deleted'
  // Facility management
  | 'facility.created'
  | 'facility.updated'
  | 'facility.disabled'
  | 'facility.enabled'
  | 'facility.trial_extended'
  | 'facility.subscription_changed'
  // Case management
  | 'case.viewed'
  | 'case.created'
  | 'case.updated'
  | 'case.deleted'
  // Milestones
  | 'milestone.recorded'
  | 'milestone.updated'
  | 'milestone.deleted'
  // Patient Calls
  | 'patient_call.created'
  | 'patient_call.resent'
  | 'patient_call.cancelled'
  // Staff assignments
  | 'case_staff.added'
  | 'case_staff.removed'
  // Delays
  | 'delay.added'
  | 'delay.updated'
  | 'delay.deleted'
  // Facility settings
  | 'room.created'
  | 'room.updated'
  | 'room.deleted'
  | 'procedure_type.created'
  | 'procedure_type.updated'
  | 'procedure_type.deleted'
  // Admin actions
  | 'admin.impersonation_started'
  | 'admin.impersonation_ended'
  | 'admin.default_procedure_added'
  | 'admin.default_procedure_updated'
  | 'admin.default_procedure_removed'

export type TargetType = 
  | 'user' 
  | 'facility' 
  | 'case' 
  | 'milestone' 
  | 'case_staff' 
  | 'delay' 
  | 'room' 
  | 'procedure_type'
  | 'admin_session'
  | 'patient_call'

export interface AuditLogEntry {
  user_id: string
  user_email: string
  action: AuditAction
  facility_id?: string | null
  target_type?: TargetType | null
  target_id?: string | null
  target_label?: string | null
  old_values?: Record<string, unknown> | null
  new_values?: Record<string, unknown> | null
  metadata?: Record<string, unknown> | null
  ip_address?: string | null
  user_agent?: string | null
  success?: boolean
  error_message?: string | null
  // Impersonation fields
  impersonating_user_id?: string | null
  impersonating_user_email?: string | null
}

export interface AuditContext {
  supabase: SupabaseClient
  userId: string
  userEmail: string
  facilityId?: string | null
  ipAddress?: string | null
  userAgent?: string | null
  // If currently impersonating
  impersonatingUserId?: string | null
  impersonatingUserEmail?: string | null
}

/**
 * Create an audit logger instance with context
 * Use this at the start of an API route or server action
 */
export function createAuditLogger(context: AuditContext) {
  return {
    /**
     * Log a successful action
     */
    async log(
      action: AuditAction,
      options: {
        targetType?: TargetType
        targetId?: string
        targetLabel?: string
        oldValues?: Record<string, unknown>
        newValues?: Record<string, unknown>
        metadata?: Record<string, unknown>
      } = {}
    ): Promise<void> {
      const entry: AuditLogEntry = {
        user_id: context.userId,
        user_email: context.userEmail,
        action,
        facility_id: context.facilityId,
        target_type: options.targetType,
        target_id: options.targetId,
        target_label: options.targetLabel,
        old_values: options.oldValues,
        new_values: options.newValues,
        metadata: options.metadata,
        ip_address: context.ipAddress,
        user_agent: context.userAgent,
        success: true,
        impersonating_user_id: context.impersonatingUserId,
        impersonating_user_email: context.impersonatingUserEmail,
      }

      await insertAuditLog(context.supabase, entry)
    },

    /**
     * Log a failed action
     */
    async logError(
      action: AuditAction,
      errorMessage: string,
      options: {
        targetType?: TargetType
        targetId?: string
        targetLabel?: string
        metadata?: Record<string, unknown>
      } = {}
    ): Promise<void> {
      const entry: AuditLogEntry = {
        user_id: context.userId,
        user_email: context.userEmail,
        action,
        facility_id: context.facilityId,
        target_type: options.targetType,
        target_id: options.targetId,
        target_label: options.targetLabel,
        metadata: options.metadata,
        ip_address: context.ipAddress,
        user_agent: context.userAgent,
        success: false,
        error_message: errorMessage,
        impersonating_user_id: context.impersonatingUserId,
        impersonating_user_email: context.impersonatingUserEmail,
      }

      await insertAuditLog(context.supabase, entry)
    },
  }
}

/**
 * Insert audit log entry directly
 * Use this for simple one-off logging
 */
export async function insertAuditLog(
  supabase: SupabaseClient,
  entry: AuditLogEntry
): Promise<void> {
  try {
    const { error } = await supabase.from('audit_log').insert(entry)

    if (error) {
      // Log to console as fallback - audit logs should never silently fail
      console.error('[AUDIT LOG ERROR] Failed to insert audit log:', error)
      console.error('[AUDIT LOG ENTRY]', JSON.stringify(entry, null, 2))
    }
  } catch (err) {
    // Log to console as fallback
    console.error('[AUDIT LOG ERROR] Exception inserting audit log:', err)
    console.error('[AUDIT LOG ENTRY]', JSON.stringify(entry, null, 2))
  }
}

/**
 * Quick audit log for simple actions
 * Convenience function when you don't need a full context
 */
export async function quickAuditLog(
  supabase: SupabaseClient,
  userId: string,
  userEmail: string,
  action: AuditAction,
  options: {
    facilityId?: string
    targetType?: TargetType
    targetId?: string
    targetLabel?: string
    oldValues?: Record<string, unknown>
    newValues?: Record<string, unknown>
    metadata?: Record<string, unknown>
    success?: boolean
    errorMessage?: string
  } = {}
): Promise<void> {
  const entry: AuditLogEntry = {
    user_id: userId,
    user_email: userEmail,
    action,
    facility_id: options.facilityId,
    target_type: options.targetType,
    target_id: options.targetId,
    target_label: options.targetLabel,
    old_values: options.oldValues,
    new_values: options.newValues,
    metadata: options.metadata,
    success: options.success ?? true,
    error_message: options.errorMessage,
  }

  await insertAuditLog(supabase, entry)
}

/**
 * Get client IP address from request headers
 * Works with Vercel, Cloudflare, and standard proxies
 */
export function getClientIP(headers: Headers): string | null {
  // Vercel
  const forwardedFor = headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }

  // Cloudflare
  const cfConnectingIP = headers.get('cf-connecting-ip')
  if (cfConnectingIP) {
    return cfConnectingIP
  }

  // Standard
  const realIP = headers.get('x-real-ip')
  if (realIP) {
    return realIP
  }

  return null
}

/**
 * Format audit log entry for display
 */
export function formatAuditAction(action: AuditAction | string): string {
  const actionMap: Record<string, string> = {
    'auth.login': 'Logged in',
    'auth.logout': 'Logged out',
    'auth.login_failed': 'Failed login attempt',
    'auth.password_reset': 'Password reset requested',
    'auth.password_changed': 'Password changed',
    'user.created': 'User created',
    'user.updated': 'User updated',
    'user.deactivated': 'User deactivated',
    'user.reactivated': 'User reactivated',
    'user.role_changed': 'User role changed',
    'user.invited': 'User invited',
    'user.invitation_accepted': 'Invitation accepted',
    'user.deleted': 'User deleted',
    'facility.created': 'Facility created',
    'facility.updated': 'Facility updated',
    'facility.disabled': 'Facility disabled',
    'facility.enabled': 'Facility enabled',
    'facility.trial_extended': 'Trial extended',
    'facility.subscription_changed': 'Subscription changed',
    'case.viewed': 'Case viewed',
    'case.created': 'Case created',
    'case.updated': 'Case updated',
    'case.deleted': 'Case deleted',
    'milestone.recorded': 'Milestone recorded',
    'milestone.updated': 'Milestone updated',
    'milestone.deleted': 'Milestone deleted',
    // Patient Call actions
    'patient_call.created': 'Patient Call → Created',
    'patient_call.resent': 'Patient Call → Resent',
    'patient_call.cancelled': 'Patient Call → Cancelled',
    // Staff assignments
    'case_staff.added': 'Staff added to case',
    'case_staff.removed': 'Staff removed from case',
    'delay.added': 'Delay recorded',
    'delay.updated': 'Delay updated',
    'delay.deleted': 'Delay deleted',
    'room.created': 'Room created',
    'room.updated': 'Room updated',
    'room.deleted': 'Room deleted',
    'procedure_type.created': 'Procedure type created',
    'procedure_type.updated': 'Procedure type updated',
    'procedure_type.deleted': 'Procedure type deleted',
    'admin.impersonation_started': 'Started impersonation',
    'admin.impersonation_ended': 'Ended impersonation',
    'admin.default_procedure_added': 'Default procedure added',
    'admin.default_procedure_updated': 'Default procedure updated',
    'admin.default_procedure_removed': 'Default procedure removed',
  }

  return actionMap[action] || action
}

/**
 * Get action category for filtering
 */
export function getActionCategory(action: AuditAction | string): string {
  const prefix = action.split('.')[0]
  const categoryMap: Record<string, string> = {
    auth: 'Authentication',
    user: 'User Management',
    facility: 'Facility Management',
    case: 'Cases',
    milestone: 'Milestones',
    patient_call: 'Patient Calls',
    case_staff: 'Staff Assignments',
    delay: 'Delays',
    room: 'Rooms',
    procedure_type: 'Procedures',
    admin: 'Admin Actions',
  }
  return categoryMap[prefix] || 'Other'
}
