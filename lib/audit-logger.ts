// lib/audit-logger.ts
// Unified audit logging for ORbit
// Usage: import { caseAudit, deviceRepAudit } from '@/lib/audit-logger'

import { SupabaseClient } from '@supabase/supabase-js'

// =====================================================
// TYPES
// =====================================================

interface AuditContext {
  userId: string
  userEmail: string
  facilityId: string | null
}

// All audit action types for type safety
export type AuditAction =
  // Auth
  | 'auth.login'
  | 'auth.login_failed'
  | 'auth.logout'
  | 'auth.password_changed'
  | 'auth.password_reset'
  // Cases
  | 'case.created'
  | 'case.updated'
  | 'case.deleted'
  | 'case.status_changed'
  | 'case.implant_company_added'
  | 'case.implant_company_removed'
  // Milestones
  | 'milestone.recorded'
  | 'milestone.updated'
  | 'milestone.deleted'
  // Case Staff
  | 'case_staff.added'
  | 'case_staff.removed'
  // Delays
  | 'delay.added'
  | 'delay.deleted'
  // Milestone Types
  | 'milestone_type.created'
  | 'milestone_type.updated'
  | 'milestone_type.deleted'
  | 'milestone_type.reordered'
  | 'milestone_type.linked'
  | 'milestone_type.unlinked' 
  | 'milestone_type.restored'
  // Rooms
  | 'room.created'
  | 'room.updated'
  | 'room.deleted'
  // Procedure Types
  | 'procedure_type.created'
  | 'procedure_type.updated'
  | 'procedure_type.deleted'
  // Users
  | 'user.created'
  | 'user.invited'
  | 'user.invitation_accepted'
  | 'user.deactivated'
  | 'user.reactivated'
  | 'user.role_changed'
  | 'user.updated'
  | 'user.deleted'
  // Facility
  | 'facility.created'
  | 'facility.updated'
  | 'facility.deleted'
  | 'facility.subscription_changed'
  // Implant Companies
  | 'implant_company.created'
  | 'implant_company.updated'
  | 'implant_company.deleted'
  // Device Reps
  | 'device_rep.invited'
  | 'device_rep.invite_accepted'
  | 'device_rep.access_revoked'
  | 'device_rep.viewed_case'
  // Surgeon Preferences
  | 'surgeon_preference.created'
  | 'surgeon_preference.updated'
  | 'surgeon_preference.deleted'
  // Delay Types
  | 'delay_type.created'
  | 'delay_type.updated'
  | 'delay_type.deleted'
  // Admin Actions
  | 'admin.impersonation_started'
  | 'admin.impersonation_ended'
  | 'admin.default_procedure_created'
  | 'admin.default_procedure_updated'
  | 'admin.default_procedure_deleted'
  | 'admin.implant_company_created'
  | 'admin.implant_company_updated'
  | 'admin.implant_company_deleted'
  | 'admin.delay_type_created'
  | 'admin.delay_type_updated'
  | 'admin.delay_type_deleted'
  | 'admin.procedure_type_created'
  | 'admin.procedure_type_updated'
  | 'admin.procedure_type_deleted'

// Human-readable labels for audit log display
export const auditActionLabels: Record<AuditAction, string> = {
  // Auth
  'auth.login': 'logged in',
  'auth.login_failed': 'failed login attempt',
  'auth.logout': 'logged out',
  'auth.password_changed': 'changed password',
  'auth.password_reset': 'requested password reset',
  // Cases
  'case.created': 'created a case',
  'case.updated': 'updated a case',
  'case.deleted': 'deleted a case',
  'case.status_changed': 'changed case status',
  'case.implant_company_added': 'added implant company to case',
  'case.implant_company_removed': 'removed implant company from case',
  // Milestones
  'milestone.recorded': 'recorded a milestone',
  'milestone.updated': 'updated a milestone',
  'milestone.deleted': 'deleted a milestone',
  // Case Staff
  'case_staff.added': 'assigned staff to case',
  'case_staff.removed': 'removed staff from case',
  // Delays
  'delay.added': 'recorded a delay',
  'delay.deleted': 'removed a delay',
  // Milestone Types
  'milestone_type.created': 'created a milestone type',
  'milestone_type.updated': 'updated a milestone type',
  'milestone_type.deleted': 'deleted a milestone type',
  'milestone_type.reordered': 'reordered milestone types',
    'milestone_type.linked': 'linked milestone types',
  'milestone_type.unlinked': 'unlinked milestone types',
    'milestone_type.restored': 'restored a milestone type',  
  // Rooms
  'room.created': 'created an OR room',
  'room.updated': 'updated an OR room',
  'room.deleted': 'deleted an OR room',
  // Procedure Types
  'procedure_type.created': 'created a procedure type',
  'procedure_type.updated': 'updated a procedure type',
  'procedure_type.deleted': 'deleted a procedure type',
  // Users
  'user.created': 'created a user',
  'user.invited': 'invited a user',
  'user.invitation_accepted': 'accepted invitation',
  'user.deactivated': 'deactivated a user',
  'user.reactivated': 'reactivated a user',
  'user.role_changed': 'changed user role',
  'user.updated': 'updated a user',
  'user.deleted': 'deleted a user',
  // Facility
  'facility.created': 'created a facility',
  'facility.updated': 'updated facility settings',
  'facility.deleted': 'deleted a facility',
  'facility.subscription_changed': 'changed subscription',
  // Implant Companies
  'implant_company.created': 'created an implant company',
  'implant_company.updated': 'updated an implant company',
  'implant_company.deleted': 'deleted an implant company',
  // Device Reps
  'device_rep.invited': 'invited a device rep',
  'device_rep.invite_accepted': 'accepted facility access',
  'device_rep.access_revoked': 'revoked device rep access',
  'device_rep.viewed_case': 'viewed case details',
  // Surgeon Preferences
  'surgeon_preference.created': 'created a surgeon preference',
  'surgeon_preference.updated': 'updated a surgeon preference',
  'surgeon_preference.deleted': 'deleted a surgeon preference',
  // Delay Types
  'delay_type.created': 'created a delay type',
  'delay_type.updated': 'updated a delay type',
  'delay_type.deleted': 'deleted a delay type',
  // Admin Actions
  'admin.impersonation_started': 'started facility impersonation',
  'admin.impersonation_ended': 'ended facility impersonation',
  'admin.default_procedure_created': 'created a default procedure',
  'admin.default_procedure_updated': 'updated a default procedure',
  'admin.default_procedure_deleted': 'deleted a default procedure',
  'admin.implant_company_created': 'created a global implant company',
  'admin.implant_company_updated': 'updated a global implant company',
  'admin.implant_company_deleted': 'deleted a global implant company',
  'admin.delay_type_created': 'created a global delay type',
  'admin.delay_type_updated': 'updated a global delay type',
  'admin.delay_type_deleted': 'deleted a global delay type',
  'admin.procedure_type_created': 'created a global procedure type',
  'admin.procedure_type_updated': 'updated a global procedure type',
  'admin.procedure_type_deleted': 'deleted a global procedure type',
}

// =====================================================
// CORE LOGGING FUNCTION (single source of truth)
// =====================================================

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

async function log(
  supabase: SupabaseClient,
  action: AuditAction | string,
  options: {
    targetType?: string
    targetId?: string
    targetLabel?: string
    oldValues?: Record<string, unknown>
    newValues?: Record<string, unknown>
    metadata?: Record<string, unknown>
    success?: boolean
    errorMessage?: string
    facilityId?: string // Override facility_id if needed
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
    facility_id: options.facilityId || context.facilityId,
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
  }
}

// =====================================================
// AUTHENTICATION
// =====================================================

export const authAudit = {
  async login(supabase: SupabaseClient, email: string, success: boolean, errorMessage?: string) {
    const entry = {
      user_id: '00000000-0000-0000-0000-000000000000',
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
    await log(supabase, 'auth.password_reset', { metadata: { email } })
  },
}

// =====================================================
// CASES
// =====================================================

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
    await log(supabase, 'case.status_changed', {
      targetType: 'case',
      targetId: caseData.id,
      targetLabel: `Case #${caseData.case_number}`,
      oldValues: { status: oldStatus },
      newValues: { status: newStatus },
    })
  },

  async implantCompanyAdded(
    supabase: SupabaseClient,
    caseId: string,
    caseNumber: string,
    companyName: string,
    companyId: string,
    facilityId?: string
  ) {
    await log(supabase, 'case.implant_company_added', {
      targetType: 'case',
      targetId: caseId,
      targetLabel: `Case #${caseNumber}`,
      facilityId,
      newValues: { implant_company: companyName, implant_company_id: companyId },
    })
  },

  async implantCompanyRemoved(
    supabase: SupabaseClient,
    caseId: string,
    caseNumber: string,
    companyName: string,
    companyId: string,
    facilityId?: string
  ) {
    await log(supabase, 'case.implant_company_removed', {
      targetType: 'case',
      targetId: caseId,
      targetLabel: `Case #${caseNumber}`,
      facilityId,
      oldValues: { implant_company: companyName, implant_company_id: companyId },
    })
  },
}

// =====================================================
// MILESTONES
// =====================================================

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
  milestoneId: string,
  recordedAt?: string  // ADD THIS PARAMETER
) {
  await log(supabase, 'milestone.deleted', {
    targetType: 'milestone',
    targetId: milestoneId,
    targetLabel: `${milestoneName} on Case #${caseNumber}`,
    oldValues: recordedAt ? { recorded_at: recordedAt } : undefined,  // ADD THIS
  })
},
}

// =====================================================
// CASE STAFF
// =====================================================

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

// =====================================================
// DELAYS
// =====================================================

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

// =====================================================
// MILESTONE TYPES
// =====================================================

export const milestoneTypeAudit = {
  async created(supabase: SupabaseClient, displayName: string, milestoneTypeId: string) {
    await log(supabase, 'milestone_type.created', {
      targetType: 'milestone_type',
      targetId: milestoneTypeId,
      targetLabel: displayName,
      newValues: { display_name: displayName },
    })
  },

  async updated(
    supabase: SupabaseClient,
    milestoneTypeId: string,
    oldDisplayName: string,
    newDisplayName: string
  ) {
    await log(supabase, 'milestone_type.updated', {
      targetType: 'milestone_type',
      targetId: milestoneTypeId,
      targetLabel: newDisplayName,
      oldValues: { display_name: oldDisplayName },
      newValues: { display_name: newDisplayName },
    })
  },

  async deleted(supabase: SupabaseClient, displayName: string, milestoneTypeId: string) {
    await log(supabase, 'milestone_type.deleted', {
      targetType: 'milestone_type',
      targetId: milestoneTypeId,
      targetLabel: displayName,
    })
  },

  async reordered(supabase: SupabaseClient, count: number) {
    await log(supabase, 'milestone_type.reordered', {
      targetType: 'milestone_type',
      metadata: { items_reordered: count },
    })
  },

  // ADD THESE TWO FUNCTIONS:
  async linked(supabase: SupabaseClient, milestoneName: string, partnerName: string) {
    await log(supabase, 'milestone_type.linked', {
      targetType: 'milestone_type',
      targetLabel: `${milestoneName} ↔ ${partnerName}`,
      newValues: { milestone: milestoneName, paired_with: partnerName },
    })
  },

  async unlinked(supabase: SupabaseClient, milestoneName: string, partnerName: string) {
    await log(supabase, 'milestone_type.unlinked', {
      targetType: 'milestone_type',
      targetLabel: `${milestoneName} ↔ ${partnerName}`,
      oldValues: { milestone: milestoneName, was_paired_with: partnerName },
    })
  },
    async restored(supabase: SupabaseClient, milestoneName: string, milestoneId: string) {
    await log(supabase, 'milestone_type.restored', {
      targetType: 'milestone_type',
      targetId: milestoneId,
      targetLabel: milestoneName,
      newValues: { restored: true },
    })
  },
}

// =====================================================
// ROOMS
// =====================================================

export const roomAudit = {
  async created(supabase: SupabaseClient, roomName: string, roomId: string) {
    await log(supabase, 'room.created', {
      targetType: 'room',
      targetId: roomId,
      targetLabel: roomName,
      newValues: { name: roomName },
    })
  },

  async updated(supabase: SupabaseClient, roomId: string, oldName: string, newName: string) {
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

// =====================================================
// PROCEDURE TYPES
// =====================================================

export const procedureAudit = {
  async created(supabase: SupabaseClient, procedureName: string, procedureId: string) {
    await log(supabase, 'procedure_type.created', {
      targetType: 'procedure_type',
      targetId: procedureId,
      targetLabel: procedureName,
      newValues: { name: procedureName },
    })
  },

  async updated(supabase: SupabaseClient, procedureId: string, oldName: string, newName: string) {
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

// =====================================================
// USERS
// =====================================================

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

// =====================================================
// FACILITY
// =====================================================

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

  async deleted(supabase: SupabaseClient, facilityName: string, facilityId: string) {
    await log(supabase, 'facility.deleted', {
      targetType: 'facility',
      targetId: facilityId,
      targetLabel: facilityName,
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

// =====================================================
// IMPLANT COMPANIES
// =====================================================

export const implantCompanyAudit = {
  async created(supabase: SupabaseClient, companyName: string, companyId: string, facilityId?: string) {
    await log(supabase, 'implant_company.created', {
      targetType: 'implant_company',
      targetId: companyId,
      targetLabel: companyName,
      facilityId,
      newValues: { name: companyName },
    })
  },

  async updated(supabase: SupabaseClient, companyId: string, oldName: string, newName: string, facilityId?: string) {
    await log(supabase, 'implant_company.updated', {
      targetType: 'implant_company',
      targetId: companyId,
      targetLabel: newName,
      facilityId,
      oldValues: { name: oldName },
      newValues: { name: newName },
    })
  },

  async deleted(supabase: SupabaseClient, companyName: string, companyId: string, facilityId?: string) {
    await log(supabase, 'implant_company.deleted', {
      targetType: 'implant_company',
      targetId: companyId,
      targetLabel: companyName,
      facilityId,
    })
  },

  // Global admin versions
  async adminCreated(supabase: SupabaseClient, companyName: string, companyId: string) {
    await log(supabase, 'admin.implant_company_created', {
      targetType: 'implant_company',
      targetId: companyId,
      targetLabel: companyName,
      newValues: { name: companyName, scope: 'global' },
    })
  },

  async adminUpdated(supabase: SupabaseClient, companyId: string, oldName: string, newName: string) {
    await log(supabase, 'admin.implant_company_updated', {
      targetType: 'implant_company',
      targetId: companyId,
      targetLabel: newName,
      oldValues: { name: oldName },
      newValues: { name: newName, scope: 'global' },
    })
  },

  async adminDeleted(supabase: SupabaseClient, companyName: string, companyId: string) {
    await log(supabase, 'admin.implant_company_deleted', {
      targetType: 'implant_company',
      targetId: companyId,
      targetLabel: companyName,
    })
  },
}

// =====================================================
// DEVICE REPS
// =====================================================

export const deviceRepAudit = {
  async invited(
    supabase: SupabaseClient,
    repEmail: string,
    companyName: string,
    facilityId: string,
    facilityName: string
  ) {
    await log(supabase, 'device_rep.invited', {
      targetType: 'device_rep_invite',
      targetLabel: `${repEmail} (${companyName}) to ${facilityName}`,
      facilityId,
      newValues: { rep_email: repEmail, implant_company: companyName, facility_name: facilityName },
    })
  },

  async inviteAccepted(
    supabase: SupabaseClient,
    repId: string,
    repEmail: string,
    facilityId: string,
    facilityName: string
  ) {
    await log(supabase, 'device_rep.invite_accepted', {
      targetType: 'facility_device_rep',
      targetId: repId,
      targetLabel: `${repEmail} accepted ${facilityName}`,
      facilityId,
      newValues: { rep_email: repEmail, facility_name: facilityName },
    })
  },

  async accessRevoked(
    supabase: SupabaseClient,
    repId: string,
    repEmail: string,
    repName: string,
    companyName: string,
    facilityId: string
  ) {
    await log(supabase, 'device_rep.access_revoked', {
      targetType: 'facility_device_rep',
      targetId: repId,
      targetLabel: `${repName} (${companyName})`,
      facilityId,
      oldValues: { rep_name: repName, rep_email: repEmail, implant_company: companyName },
    })
  },

  async viewedCase(
    supabase: SupabaseClient,
    caseId: string,
    caseNumber: string,
    facilityId: string,
    facilityName: string
  ) {
    await log(supabase, 'device_rep.viewed_case', {
      targetType: 'case',
      targetId: caseId,
      targetLabel: `Case #${caseNumber} at ${facilityName}`,
      facilityId,
      metadata: { case_number: caseNumber, facility_name: facilityName },
    })
  },
}

// =====================================================
// SURGEON PREFERENCES
// =====================================================

export const surgeonPrefAudit = {
  async created(
    supabase: SupabaseClient,
    preferenceId: string,
    surgeonName: string,
    procedureName: string,
    companyNames: string[],
    facilityId: string
  ) {
    await log(supabase, 'surgeon_preference.created', {
      targetType: 'surgeon_preference',
      targetId: preferenceId,
      targetLabel: `${surgeonName} - ${procedureName}`,
      facilityId,
      newValues: { surgeon: surgeonName, procedure: procedureName, implant_companies: companyNames },
    })
  },

  async updated(
    supabase: SupabaseClient,
    preferenceId: string,
    surgeonName: string,
    oldValues: { procedure?: string; companies?: string[] },
    newValues: { procedure?: string; companies?: string[] },
    facilityId: string
  ) {
    await log(supabase, 'surgeon_preference.updated', {
      targetType: 'surgeon_preference',
      targetId: preferenceId,
      targetLabel: surgeonName,
      facilityId,
      oldValues,
      newValues,
    })
  },

  async deleted(
    supabase: SupabaseClient,
    preferenceId: string,
    surgeonName: string,
    procedureName: string,
    facilityId: string
  ) {
    await log(supabase, 'surgeon_preference.deleted', {
      targetType: 'surgeon_preference',
      targetId: preferenceId,
      targetLabel: `${surgeonName} - ${procedureName}`,
      facilityId,
    })
  },
}

// =====================================================
// DELAY TYPES
// =====================================================

export const delayTypeAudit = {
  async created(supabase: SupabaseClient, delayTypeName: string, delayTypeId: string, facilityId: string) {
    await log(supabase, 'delay_type.created', {
      targetType: 'delay_type',
      targetId: delayTypeId,
      targetLabel: delayTypeName,
      facilityId,
      newValues: { name: delayTypeName },
    })
  },

  async updated(supabase: SupabaseClient, delayTypeId: string, oldName: string, newName: string, facilityId: string) {
    await log(supabase, 'delay_type.updated', {
      targetType: 'delay_type',
      targetId: delayTypeId,
      targetLabel: newName,
      facilityId,
      oldValues: { name: oldName },
      newValues: { name: newName },
    })
  },

  async deleted(supabase: SupabaseClient, delayTypeName: string, delayTypeId: string, facilityId: string) {
    await log(supabase, 'delay_type.deleted', {
      targetType: 'delay_type',
      targetId: delayTypeId,
      targetLabel: delayTypeName,
      facilityId,
    })
  },

  // Global admin versions
  async adminCreated(supabase: SupabaseClient, delayTypeName: string, delayTypeId: string) {
    await log(supabase, 'admin.delay_type_created', {
      targetType: 'delay_type',
      targetId: delayTypeId,
      targetLabel: delayTypeName,
      newValues: { name: delayTypeName, scope: 'global' },
    })
  },

  async adminUpdated(supabase: SupabaseClient, delayTypeId: string, oldName: string, newName: string) {
    await log(supabase, 'admin.delay_type_updated', {
      targetType: 'delay_type',
      targetId: delayTypeId,
      targetLabel: newName,
      oldValues: { name: oldName },
      newValues: { name: newName, scope: 'global' },
    })
  },

  async adminDeleted(supabase: SupabaseClient, delayTypeName: string, delayTypeId: string) {
    await log(supabase, 'admin.delay_type_deleted', {
      targetType: 'delay_type',
      targetId: delayTypeId,
      targetLabel: delayTypeName,
    })
  },
}

// =====================================================
// ADMIN ACTIONS
// =====================================================

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

  async defaultProcedureCreated(supabase: SupabaseClient, procedureName: string, procedureId: string) {
    await log(supabase, 'admin.default_procedure_created', {
      targetType: 'default_procedure',
      targetId: procedureId,
      targetLabel: procedureName,
      newValues: { name: procedureName },
    })
  },

  async defaultProcedureUpdated(
    supabase: SupabaseClient,
    procedureName: string,
    procedureId: string,
    changes?: Record<string, unknown>
  ) {
    await log(supabase, 'admin.default_procedure_updated', {
      targetType: 'default_procedure',
      targetId: procedureId,
      targetLabel: procedureName,
      newValues: changes,
    })
  },

  async defaultProcedureDeleted(supabase: SupabaseClient, procedureName: string, procedureId: string) {
    await log(supabase, 'admin.default_procedure_deleted', {
      targetType: 'default_procedure',
      targetId: procedureId,
      targetLabel: procedureName,
    })
  },
}

// =====================================================
// GENERIC LOG (for custom actions)
// =====================================================

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
    facilityId?: string
  } = {}
) {
  await log(supabase, action, options)
}
