// lib/audit-logger.ts
// Simplified audit logging - easy to use throughout the app
// Just import and call: await auditLog.caseCreated(supabase, caseData)

import { SupabaseClient } from '@supabase/supabase-js'

interface AuditContext {
  userId: string
  userEmail: string
  facilityId: string | null
}

// Get current user context for audit logging
export async function getAuditContext(supabase: SupabaseClient): Promise<AuditContext | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: userData } = await supabase
    .from('users')
    .select('facility_id')
    .eq('id', user.id)
    .single()

  return {
    userId: user.id,
    userEmail: user.email || '',
    facilityId: userData?.facility_id || null,
  }
}

// Core logging function
async function log(
  supabase: SupabaseClient,
  action: string,
  options: {
    targetType?: string
    targetId?: string
    targetLabel?: string
    oldValues?: Record<string, unknown>
    newValues?: Record<string, unknown>
    metadata?: Record<string, unknown>
    success?: boolean
    errorMessage?: string
  } = {}
) {
  const context = await getAuditContext(supabase)
  if (!context) {
    console.warn('[AUDIT] No user context available')
    return
  }

  const entry = {
    user_id: context.userId,
    user_email: context.userEmail,
    facility_id: context.facilityId,
    action,
    target_type: options.targetType,
    target_id: options.targetId,
    target_label: options.targetLabel,
    old_values: options.oldValues,
    new_values: options.newValues,
    metadata: options.metadata,
    success: options.success ?? true,
    error_message: options.errorMessage,
  }

  const { error } = await supabase.from('audit_log').insert(entry)
  
  if (error) {
    console.error('[AUDIT] Failed to log:', error)
    console.error('[AUDIT] Entry:', entry)
  }
}

// ============================================
// AUTHENTICATION
// ============================================

export const authAudit = {
  async login(supabase: SupabaseClient, email: string, success: boolean, errorMessage?: string) {
    // For login, we need to manually set user info since they might not be authenticated yet
    const entry = {
      user_id: '00000000-0000-0000-0000-000000000000', // Will be updated after login
      user_email: email,
      facility_id: null,
      action: success ? 'auth.login' : 'auth.login_failed',
      success,
      error_message: errorMessage,
    }
    
    await supabase.from('audit_log').insert(entry)
  },

  async logout(supabase: SupabaseClient) {
    await log(supabase, 'auth.logout')
  },

  async passwordChanged(supabase: SupabaseClient) {
    await log(supabase, 'auth.password_changed')
  },

  async passwordReset(supabase: SupabaseClient, email: string) {
    await log(supabase, 'auth.password_reset', {
      metadata: { email },
    })
  },
}

// ============================================
// CASES
// ============================================

export const caseAudit = {
  async created(supabase: SupabaseClient, caseData: { id: string; case_number: string; procedure_name?: string }) {
    await log(supabase, 'case.created', {
      targetType: 'case',
      targetId: caseData.id,
      targetLabel: `Case #${caseData.case_number}${caseData.procedure_name ? ` - ${caseData.procedure_name}` : ''}`,
      newValues: caseData as Record<string, unknown>,
    })
  },

  async updated(
    supabase: SupabaseClient,
    caseData: { id: string; case_number: string },
    oldValues: Record<string, unknown>,
    newValues: Record<string, unknown>
  ) {
    await log(supabase, 'case.updated', {
      targetType: 'case',
      targetId: caseData.id,
      targetLabel: `Case #${caseData.case_number}`,
      oldValues,
      newValues,
    })
  },

  async deleted(supabase: SupabaseClient, caseData: { id: string; case_number: string }) {
    await log(supabase, 'case.deleted', {
      targetType: 'case',
      targetId: caseData.id,
      targetLabel: `Case #${caseData.case_number}`,
    })
  },

  async statusChanged(
    supabase: SupabaseClient,
    caseData: { id: string; case_number: string },
    oldStatus: string,
    newStatus: string
  ) {
    await log(supabase, 'case.updated', {
      targetType: 'case',
      targetId: caseData.id,
      targetLabel: `Case #${caseData.case_number}`,
      oldValues: { status: oldStatus },
      newValues: { status: newStatus },
      metadata: { field: 'status' },
    })
  },
}

// ============================================
// MILESTONES
// ============================================

export const milestoneAudit = {
  async recorded(
    supabase: SupabaseClient,
    caseNumber: string,
    milestoneName: string,
    milestoneId: string,
    timestamp: string
  ) {
    await log(supabase, 'milestone.recorded', {
      targetType: 'milestone',
      targetId: milestoneId,
      targetLabel: `${milestoneName} on Case #${caseNumber}`,
      newValues: { milestone: milestoneName, recorded_at: timestamp },
    })
  },

  async updated(
    supabase: SupabaseClient,
    caseNumber: string,
    milestoneName: string,
    milestoneId: string,
    oldTimestamp: string,
    newTimestamp: string
  ) {
    await log(supabase, 'milestone.updated', {
      targetType: 'milestone',
      targetId: milestoneId,
      targetLabel: `${milestoneName} on Case #${caseNumber}`,
      oldValues: { recorded_at: oldTimestamp },
      newValues: { recorded_at: newTimestamp },
    })
  },

  async deleted(
    supabase: SupabaseClient,
    caseNumber: string,
    milestoneName: string,
    milestoneId: string
  ) {
    await log(supabase, 'milestone.deleted', {
      targetType: 'milestone',
      targetId: milestoneId,
      targetLabel: `${milestoneName} on Case #${caseNumber}`,
    })
  },
}

// ============================================
// CASE STAFF
// ============================================

export const staffAudit = {
  async added(
    supabase: SupabaseClient,
    caseNumber: string,
    staffName: string,
    staffRole: string,
    assignmentId: string
  ) {
    await log(supabase, 'case_staff.added', {
      targetType: 'case_staff',
      targetId: assignmentId,
      targetLabel: `${staffName} (${staffRole}) to Case #${caseNumber}`,
      newValues: { staff_name: staffName, role: staffRole },
    })
  },

  async removed(
    supabase: SupabaseClient,
    caseNumber: string,
    staffName: string,
    staffRole: string,
    assignmentId: string
  ) {
    await log(supabase, 'case_staff.removed', {
      targetType: 'case_staff',
      targetId: assignmentId,
      targetLabel: `${staffName} (${staffRole}) from Case #${caseNumber}`,
    })
  },
}

// ============================================
// DELAYS
// ============================================

export const delayAudit = {
  async added(
    supabase: SupabaseClient,
    caseNumber: string,
    delayType: string,
    delayId: string,
    duration?: number
  ) {
    await log(supabase, 'delay.added', {
      targetType: 'delay',
      targetId: delayId,
      targetLabel: `${delayType} delay on Case #${caseNumber}`,
      newValues: { delay_type: delayType, duration_minutes: duration },
    })
  },

  async deleted(
    supabase: SupabaseClient,
    caseNumber: string,
    delayType: string,
    delayId: string
  ) {
    await log(supabase, 'delay.deleted', {
      targetType: 'delay',
      targetId: delayId,
      targetLabel: `${delayType} delay from Case #${caseNumber}`,
    })
  },
}

// ============================================
// ROOMS
// ============================================

export const roomAudit = {
  async created(supabase: SupabaseClient, roomName: string, roomId: string) {
    await log(supabase, 'room.created', {
      targetType: 'room',
      targetId: roomId,
      targetLabel: roomName,
      newValues: { name: roomName },
    })
  },

  async updated(
    supabase: SupabaseClient,
    roomId: string,
    oldName: string,
    newName: string
  ) {
    await log(supabase, 'room.updated', {
      targetType: 'room',
      targetId: roomId,
      targetLabel: newName,
      oldValues: { name: oldName },
      newValues: { name: newName },
    })
  },

  async deleted(supabase: SupabaseClient, roomName: string, roomId: string) {
    await log(supabase, 'room.deleted', {
      targetType: 'room',
      targetId: roomId,
      targetLabel: roomName,
    })
  },
}

// ============================================
// PROCEDURE TYPES
// ============================================

export const procedureAudit = {
  async created(supabase: SupabaseClient, procedureName: string, procedureId: string) {
    await log(supabase, 'procedure_type.created', {
      targetType: 'procedure_type',
      targetId: procedureId,
      targetLabel: procedureName,
      newValues: { name: procedureName },
    })
  },

  async updated(
    supabase: SupabaseClient,
    procedureId: string,
    oldName: string,
    newName: string
  ) {
    await log(supabase, 'procedure_type.updated', {
      targetType: 'procedure_type',
      targetId: procedureId,
      targetLabel: newName,
      oldValues: { name: oldName },
      newValues: { name: newName },
    })
  },

  async deleted(supabase: SupabaseClient, procedureName: string, procedureId: string) {
    await log(supabase, 'procedure_type.deleted', {
      targetType: 'procedure_type',
      targetId: procedureId,
      targetLabel: procedureName,
    })
  },
}

// ============================================
// USERS
// ============================================

export const userAudit = {
  async created(supabase: SupabaseClient, userName: string, userEmail: string, userId: string) {
    await log(supabase, 'user.created', {
      targetType: 'user',
      targetId: userId,
      targetLabel: `${userName} (${userEmail})`,
      newValues: { name: userName, email: userEmail },
    })
  },

  async invited(supabase: SupabaseClient, inviteeEmail: string, inviteeId: string) {
    await log(supabase, 'user.invited', {
      targetType: 'user',
      targetId: inviteeId,
      targetLabel: inviteeEmail,
      metadata: { invited_email: inviteeEmail },
    })
  },

  async invitationAccepted(supabase: SupabaseClient, userName: string, userId: string) {
    await log(supabase, 'user.invitation_accepted', {
      targetType: 'user',
      targetId: userId,
      targetLabel: userName,
    })
  },

  async deactivated(supabase: SupabaseClient, userName: string, userEmail: string, userId: string) {
    await log(supabase, 'user.deactivated', {
      targetType: 'user',
      targetId: userId,
      targetLabel: `${userName} (${userEmail})`,
    })
  },

  async reactivated(supabase: SupabaseClient, userName: string, userEmail: string, userId: string) {
    await log(supabase, 'user.reactivated', {
      targetType: 'user',
      targetId: userId,
      targetLabel: `${userName} (${userEmail})`,
    })
  },

  async roleChanged(
    supabase: SupabaseClient,
    userName: string,
    userId: string,
    oldRole: string,
    newRole: string
  ) {
    await log(supabase, 'user.role_changed', {
      targetType: 'user',
      targetId: userId,
      targetLabel: userName,
      oldValues: { access_level: oldRole },
      newValues: { access_level: newRole },
    })
  },

  async updated(
    supabase: SupabaseClient,
    userName: string,
    userEmail: string,
    userId: string,
    changes?: Record<string, { old: string; new: string }>
  ) {
    await log(supabase, 'user.updated', {
      targetType: 'user',
      targetId: userId,
      targetLabel: `${userName} (${userEmail})`,
      oldValues: changes ? Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v.old])) : undefined,
      newValues: changes ? Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v.new])) : undefined,
    })
  },

  async deleted(supabase: SupabaseClient, userName: string, userEmail: string, userId: string) {
    await log(supabase, 'user.deleted', {
      targetType: 'user',
      targetId: userId,
      targetLabel: `${userName} (${userEmail})`,
    })
  },
}

// ============================================
// FACILITY
// ============================================

export const facilityAudit = {
  async created(supabase: SupabaseClient, facilityName: string, facilityId: string) {
    await log(supabase, 'facility.created', {
      targetType: 'facility',
      targetId: facilityId,
      targetLabel: facilityName,
      newValues: { name: facilityName },
    })
  },

  async updated(
    supabase: SupabaseClient,
    facilityName: string,
    facilityId: string,
    changes: Record<string, unknown>
  ) {
    await log(supabase, 'facility.updated', {
      targetType: 'facility',
      targetId: facilityId,
      targetLabel: facilityName,
      newValues: changes,
    })
  },

  async subscriptionChanged(
    supabase: SupabaseClient,
    facilityName: string,
    facilityId: string,
    oldStatus: string,
    newStatus: string
  ) {
    await log(supabase, 'facility.subscription_changed', {
      targetType: 'facility',
      targetId: facilityId,
      targetLabel: facilityName,
      oldValues: { subscription_status: oldStatus },
      newValues: { subscription_status: newStatus },
    })
  },
}

// ============================================
// ADMIN ACTIONS
// ============================================

export const adminAudit = {
  async impersonationStarted(supabase: SupabaseClient, facilityName: string, facilityId: string) {
    await log(supabase, 'admin.impersonation_started', {
      targetType: 'facility',
      targetId: facilityId,
      targetLabel: facilityName,
    })
  },

  async impersonationEnded(supabase: SupabaseClient, facilityName: string, facilityId: string) {
    await log(supabase, 'admin.impersonation_ended', {
      targetType: 'facility',
      targetId: facilityId,
      targetLabel: facilityName,
    })
  },
}

// ============================================
// GENERIC LOG (for custom actions)
// ============================================

export async function genericAuditLog(
  supabase: SupabaseClient,
  action: string,
  options: {
    targetType?: string
    targetId?: string
    targetLabel?: string
    oldValues?: Record<string, unknown>
    newValues?: Record<string, unknown>
    metadata?: Record<string, unknown>
  } = {}
) {
  await log(supabase, action, options)
}
