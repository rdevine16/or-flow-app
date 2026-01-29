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
  | 'payer.created'
| 'payer.updated'
| 'payer.deleted'
| 'payer.restored'
  // Patient Check-In
  | 'checkin.patient_checked_in'
  | 'checkin.status_updated'
  | 'checkin.checklist_completed'
  | 'checkin.escort_link_generated'
  | 'checkin.escort_link_viewed'
  | 'checkin.escort_info_updated'
  | 'checkin.arrival_settings_updated'
  | 'checkin.checklist_field_created'
  | 'checkin.checklist_field_updated'
  | 'checkin.checklist_field_deleted'
  | 'checkin.checklist_field_reordered'
  // Features
  | 'feature.enabled'
  | 'feature.disabled'
  | 'feature.trial_started'
  // Notification Settings
  | 'notification_settings.updated'
  | 'notification_settings.category_enabled'
  | 'notification_settings.category_disabled'
  | 'notification_settings.quiet_hours_updated'
  | 'notification_settings.recipients_updated'
| 'procedure_reimbursement.created'
| 'procedure_reimbursement.updated'
| 'procedure_reimbursement.deleted'
| 'facility.or_rate_updated'
| 'procedure_type.costs_updated'
  // Case Device/Tray Management
  | 'case_device.company_assigned'
  | 'case_device.company_removed'
  | 'case_device.consignment_confirmed'
  | 'case_device.loaners_confirmed'
  | 'case_device.trays_delivered'
  | 'case_device.reminder_sent'
  | 'case_device.status_reset'  
// Device Rep Tray Actions
| 'device_rep.tray_consignment_confirmed'
| 'device_rep.tray_loaners_confirmed'
| 'device_rep.trays_delivered'
| 'device_rep.tray_status_reset'
| 'device_rep.tray_status_changed'
| 'device_rep.notes_updated'
| 'device_rep.tray_updated'
  // Cases
  | 'case.created'
  | 'case.updated'
  | 'case.deleted'
  | 'case.status_changed'
  | 'case.implant_company_added'
  | 'case.implant_company_removed'
  | 'case.cancelled'
  | 'case.restored'
  | 'cancellation_reason.created'
  | 'cancellation_reason.updated'
  | 'cancellation_reason.deleted'
  | 'cancellation_reason.restored'
  | 'admin.cancellation_reason_template_created'
  | 'admin.cancellation_reason_template_updated'
  | 'admin.cancellation_reason_template_deleted'
  // Body Regions
  | 'admin.body_region_created'
  | 'admin.body_region_updated'
  | 'admin.body_region_deleted'
  
  // Procedure Categories
  | 'admin.procedure_category_created'
  | 'admin.procedure_category_updated'
  | 'admin.procedure_category_deleted'
  | 'admin.procedure_category_reordered'
   // Data Quality
  | 'data_quality.issue_resolved'
  | 'data_quality.issue_excluded'
  | 'data_quality.issue_approved'
  | 'data_quality.detection_run'
  | 'data_quality.bulk_resolved'
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
  | 'room.restored'
  | 'room.reordered'
  // Procedure Types
  | 'procedure_type.created'
  | 'procedure_type.updated'
  | 'procedure_type.deleted'
  | 'procedure_type.restored'
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
  | 'delay_type.restored'
   // Block Schedules
  | 'block_schedule.created'
  | 'block_schedule.updated'
  | 'block_schedule.deleted'
  | 'block_schedule.restored'
  // Facility Holidays
  | 'facility_holiday.created'
  | 'facility_holiday.updated'
  | 'facility_holiday.deleted'
  | 'facility_holiday.toggled'
  // Facility Closures
  | 'facility_closure.created'
  | 'facility_closure.deleted'
  // Surgeon Colors
  | 'surgeon_color.assigned'
  | 'surgeon_color.changed'
  // Admin Actions
  | 'admin.impersonation_started'
  | 'admin.impersonation_ended'
  | 'admin.procedure_template_created'
  | 'admin.procedure_template_updated'
  | 'admin.procedure_template_deleted'
  | 'admin.implant_company_created'
  | 'admin.implant_company_updated'
  | 'admin.implant_company_deleted'
  | 'admin.delay_type_created'
  | 'admin.delay_type_updated'
  | 'admin.delay_type_deleted'
  | 'admin.procedure_type_created'
  | 'admin.procedure_type_updated'
  | 'admin.procedure_type_deleted'
// Cost Categories (Facility)
  | 'cost_category.created'
  | 'cost_category.updated'
  | 'cost_category.deleted'
  | 'cost_category.restored'      
  | 'cost_category.activated'     
  | 'cost_category.deactivated' 
  // Cost Categories (Global Admin)
  | 'admin.cost_category_created'
  | 'admin.cost_category_updated'
  | 'admin.cost_category_deleted'
  // Procedure Cost Items
  | 'procedure_cost_item.created'
  | 'procedure_cost_item.updated'
  | 'procedure_cost_item.deleted'
  // Surgeon Cost Items (Variance)
  | 'surgeon_cost_item.created'
  | 'surgeon_cost_item.updated'
  | 'surgeon_cost_item.deleted'
// Human-readable labels for audit log display
export const auditActionLabels: Record<AuditAction, string> = {
    // Block Schedules
  'block_schedule.created': 'created a block schedule',
  'block_schedule.updated': 'updated a block schedule',
  'block_schedule.deleted': 'deleted a block schedule',
  'block_schedule.restored': 'restored a block schedule',
    // Patient Check-In
  'checkin.patient_checked_in': 'checked in a patient',
  'checkin.status_updated': 'updated patient status',
  'checkin.checklist_completed': 'completed pre-op checklist',
  'checkin.escort_link_generated': 'generated escort status link',
  'checkin.escort_link_viewed': 'escort viewed status link',
  'checkin.escort_info_updated': 'updated escort information',
  'checkin.arrival_settings_updated': 'updated arrival time settings',
  'checkin.checklist_field_created': 'created checklist field',
  'checkin.checklist_field_updated': 'updated checklist field',
  'checkin.checklist_field_deleted': 'deleted checklist field',
  'checkin.checklist_field_reordered': 'reordered checklist fields',
  // Features
  'feature.enabled': 'enabled a feature',
  'feature.disabled': 'disabled a feature',
  'feature.trial_started': 'started feature trial',
  // Facility Holidays
  'facility_holiday.created': 'created a facility holiday',
  'facility_holiday.updated': 'updated a facility holiday',
  'facility_holiday.deleted': 'deleted a facility holiday',
  'facility_holiday.toggled': 'toggled a facility holiday',
    // Notification Settings
  'notification_settings.updated': 'updated notification settings',
  'notification_settings.category_enabled': 'enabled notification category',
  'notification_settings.category_disabled': 'disabled notification category',
  'notification_settings.quiet_hours_updated': 'updated quiet hours',
  'notification_settings.recipients_updated': 'updated notification recipients',
  // Facility Closures
  'facility_closure.created': 'created a facility closure',
  'facility_closure.deleted': 'deleted a facility closure',
  // Surgeon Colors
  'surgeon_color.assigned': 'assigned surgeon color',
  'surgeon_color.changed': 'changed surgeon color',
  // Auth
  'auth.login': 'logged in',
  'auth.login_failed': 'failed login attempt',
  'auth.logout': 'logged out',
  'auth.password_changed': 'changed password',
  'auth.password_reset': 'requested password reset',
  // Procedure Categories
  'admin.procedure_category_created': 'created a procedure category',
  'admin.procedure_category_updated': 'updated a procedure category',
  'admin.procedure_category_deleted': 'deleted a procedure category',
  'admin.procedure_category_reordered': 'reordered procedure categories',
  // Cases
  'case.created': 'created a case',
  'case.updated': 'updated a case',
  'case.deleted': 'deleted a case',
  'case.status_changed': 'changed case status',
  'case.implant_company_added': 'added implant company to case',
  'case.implant_company_removed': 'removed implant company from case',
  // Device Rep Tray Actions
'device_rep.tray_consignment_confirmed': 'confirmed consignment trays',
'device_rep.tray_loaners_confirmed': 'confirmed loaner trays',
'device_rep.trays_delivered': 'delivered trays',
'device_rep.tray_status_reset': 'reset tray status',
'device_rep.tray_status_changed': 'changed tray status',
'device_rep.notes_updated': 'updated rep notes',
'device_rep.tray_updated': 'updated tray info',  
  // Body Regions
  'admin.body_region_created': 'created a body region',
'admin.body_region_updated': 'updated a body region',
'admin.body_region_deleted': 'deleted a body region',
  // Case Device/Tray Management
  'case_device.company_assigned': 'assigned device company to case',
  'case_device.company_removed': 'removed device company from case',
  'case_device.consignment_confirmed': 'confirmed consignment available',
  'case_device.loaners_confirmed': 'confirmed loaner trays coming',
  'case_device.trays_delivered': 'confirmed tray delivery',
  'case_device.reminder_sent': 'sent tray reminder',
  'case_device.status_reset': 'reset tray status',  
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
  'room.restored': 'restored an OR room',
  'room.reordered': 'reordered OR rooms',


  // Procedure Types
  'procedure_type.created': 'created a procedure type',
  'procedure_type.updated': 'updated a procedure type',
  'procedure_type.deleted': 'deleted a procedure type',
  'procedure_type.restored': 'restored a procedure type',
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
  'delay_type.restored': 'restored a delay type',
  // Admin Actions
  'admin.impersonation_started': 'started facility impersonation',
  'admin.impersonation_ended': 'ended facility impersonation',
  'admin.procedure_template_created': 'created a default procedure',
  'admin.procedure_template_updated': 'updated a default procedure',
  'admin.procedure_template_deleted': 'deleted a default procedure',
  'admin.implant_company_created': 'created a global implant company',
  'admin.implant_company_updated': 'updated a global implant company',
  'admin.implant_company_deleted': 'deleted a global implant company',
  'admin.delay_type_created': 'created a global delay type',
  'admin.delay_type_updated': 'updated a global delay type',
  'admin.delay_type_deleted': 'deleted a global delay type',
  'admin.procedure_type_created': 'created a global procedure type',
  'admin.procedure_type_updated': 'updated a global procedure type',
  'admin.procedure_type_deleted': 'deleted a global procedure type',
  // Financials
'payer.created': 'created a payer',
'payer.updated': 'updated a payer',
'payer.deleted': 'deleted a payer',
'payer.restored': 'restored a payer',
'procedure_reimbursement.created': 'created a reimbursement rate',
'procedure_reimbursement.updated': 'updated a reimbursement rate',
'procedure_reimbursement.deleted': 'deleted a reimbursement rate',
'facility.or_rate_updated': 'updated OR hourly rate',
'procedure_type.costs_updated': 'updated procedure costs',
// Cost Categories (Facility)
'cost_category.created': 'created a cost category',
'cost_category.updated': 'updated a cost category',
'cost_category.deleted': 'deleted a cost category',
'cost_category.restored': 'restored a cost category',
'cost_category.activated': 'activated a cost category',
'cost_category.deactivated': 'deactivated a cost category', 
  // Cost Categories (Global Admin)
  'admin.cost_category_created': 'created a default cost category',
  'admin.cost_category_updated': 'updated a default cost category',
  'admin.cost_category_deleted': 'deleted a default cost category',
  // Procedure Cost Items
  'procedure_cost_item.created': 'added cost item to procedure',
  'procedure_cost_item.updated': 'updated procedure cost item',
  'procedure_cost_item.deleted': 'removed cost item from procedure',
  // Surgeon Cost Items (Variance)
  'surgeon_cost_item.created': 'created surgeon cost variance',
  'surgeon_cost_item.updated': 'updated surgeon cost variance',
  'surgeon_cost_item.deleted': 'deleted surgeon cost variance',
// Data Quality
  'data_quality.issue_resolved': 'resolved a data quality issue',
  'data_quality.issue_excluded': 'excluded a data quality issue',
  'data_quality.issue_approved': 'approved a flagged metric',
  'data_quality.detection_run': 'ran data quality detection',
  'data_quality.bulk_resolved': 'bulk resolved data quality issues',
  // Cases
  'case.cancelled': 'cancelled a case',
  'case.restored': 'restored a cancelled case',
  
  // Cancellation Reasons (Facility)
  'cancellation_reason.created': 'created a cancellation reason',
  'cancellation_reason.updated': 'updated a cancellation reason',
  'cancellation_reason.deleted': 'deleted a cancellation reason',
  'cancellation_reason.restored': 'restored a cancellation reason',
  
  // Cancellation Reasons (Global Admin Templates)
  'admin.cancellation_reason_template_created': 'created a cancellation reason template',
  'admin.cancellation_reason_template_updated': 'updated a cancellation reason template',
  'admin.cancellation_reason_template_deleted': 'deleted a cancellation reason template',
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
// CASE DEVICE / TRAY MANAGEMENT
// =====================================================

export const caseDeviceAudit = {
  async companyAssigned(
    supabase: SupabaseClient,
    caseId: string,
    caseNumber: string,
    companyName: string,
    companyId: string,
    facilityId: string
  ) {
    await log(supabase, 'case_device.company_assigned', {
      targetType: 'case',
      targetId: caseId,
      targetLabel: `Case #${caseNumber}`,
      facilityId,
      newValues: { 
        implant_company: companyName,
        implant_company_id: companyId
      },
    })
  },

  async companyRemoved(
    supabase: SupabaseClient,
    caseId: string,
    caseNumber: string,
    companyName: string,
    companyId: string,
    facilityId: string
  ) {
    await log(supabase, 'case_device.company_removed', {
      targetType: 'case',
      targetId: caseId,
      targetLabel: `Case #${caseNumber}`,
      facilityId,
      oldValues: { 
        implant_company: companyName,
        implant_company_id: companyId
      },
    })
  },

  async consignmentConfirmed(
    supabase: SupabaseClient,
    caseId: string,
    caseNumber: string,
    companyName: string,
    facilityId: string,
    repNotes?: string
  ) {
    await log(supabase, 'case_device.consignment_confirmed', {
      targetType: 'case',
      targetId: caseId,
      targetLabel: `Case #${caseNumber}`,
      facilityId,
      newValues: { 
        implant_company: companyName,
        tray_status: 'consignment',
        rep_notes: repNotes
      },
    })
  },

  async loanersConfirmed(
    supabase: SupabaseClient,
    caseId: string,
    caseNumber: string,
    companyName: string,
    trayCount: number,
    facilityId: string,
    repNotes?: string
  ) {
    await log(supabase, 'case_device.loaners_confirmed', {
      targetType: 'case',
      targetId: caseId,
      targetLabel: `Case #${caseNumber}`,
      facilityId,
      newValues: { 
        implant_company: companyName,
        tray_status: 'loaners_confirmed',
        loaner_tray_count: trayCount,
        rep_notes: repNotes
      },
    })
  },

  async traysDelivered(
    supabase: SupabaseClient,
    caseId: string,
    caseNumber: string,
    companyName: string,
    deliveredCount: number,
    expectedCount: number,
    facilityId: string
  ) {
    await log(supabase, 'case_device.trays_delivered', {
      targetType: 'case',
      targetId: caseId,
      targetLabel: `Case #${caseNumber}`,
      facilityId,
      newValues: { 
        implant_company: companyName,
        tray_status: 'delivered',
        delivered_tray_count: deliveredCount,
        expected_tray_count: expectedCount
      },
    })
  },

  async reminderSent(
    supabase: SupabaseClient,
    caseId: string,
    caseNumber: string,
    companyName: string,
    reminderType: 'tray_confirmation' | 'delivery_confirmation',
    facilityId: string
  ) {
    await log(supabase, 'case_device.reminder_sent', {
      targetType: 'case',
      targetId: caseId,
      targetLabel: `Case #${caseNumber}`,
      facilityId,
      metadata: { 
        implant_company: companyName,
        reminder_type: reminderType
      },
    })
  },

  async statusReset(
    supabase: SupabaseClient,
    caseId: string,
    caseNumber: string,
    companyName: string,
    oldStatus: string,
    facilityId: string
  ) {
    await log(supabase, 'case_device.status_reset', {
      targetType: 'case',
      targetId: caseId,
      targetLabel: `Case #${caseNumber}`,
      facilityId,
      oldValues: { 
        implant_company: companyName,
        tray_status: oldStatus
      },
newValues: {
        tray_status: 'pending'
      },
    })
  },
}
// =====================================================
// BLOCK SCHEDULES
// =====================================================

export const blockScheduleAudit = {
  async created(
    supabase: SupabaseClient,
    blockId: string,
    surgeonName: string,
    dayOfWeek: string,
    startTime: string,
    endTime: string,
    recurrenceType: string,
    facilityId: string
  ) {
    await log(supabase, 'block_schedule.created', {
      targetType: 'block_schedule',
      targetId: blockId,
      targetLabel: `${surgeonName} - ${dayOfWeek}`,
      facilityId,
      newValues: {
        surgeon: surgeonName,
        day_of_week: dayOfWeek,
        start_time: startTime,
        end_time: endTime,
        recurrence: recurrenceType,
      },
    })
  },

  async updated(
    supabase: SupabaseClient,
    blockId: string,
    surgeonName: string,
    oldValues: {
      day_of_week?: string
      start_time?: string
      end_time?: string
      recurrence?: string
      effective_end?: string | null
    },
    newValues: {
      day_of_week?: string
      start_time?: string
      end_time?: string
      recurrence?: string
      effective_end?: string | null
    },
    facilityId: string
  ) {
    await log(supabase, 'block_schedule.updated', {
      targetType: 'block_schedule',
      targetId: blockId,
      targetLabel: surgeonName,
      facilityId,
      oldValues,
      newValues,
    })
  },

  async deleted(
    supabase: SupabaseClient,
    blockId: string,
    surgeonName: string,
    dayOfWeek: string,
    facilityId: string
  ) {
    await log(supabase, 'block_schedule.deleted', {
      targetType: 'block_schedule',
      targetId: blockId,
      targetLabel: `${surgeonName} - ${dayOfWeek}`,
      facilityId,
    })
  },

  async restored(
    supabase: SupabaseClient,
    blockId: string,
    surgeonName: string,
    dayOfWeek: string,
    facilityId: string
  ) {
    await log(supabase, 'block_schedule.restored', {
      targetType: 'block_schedule',
      targetId: blockId,
      targetLabel: `${surgeonName} - ${dayOfWeek}`,
      facilityId,
    })
  },
}

// =====================================================
// FACILITY HOLIDAYS
// =====================================================

export const facilityHolidayAudit = {
  async created(
    supabase: SupabaseClient,
    holidayId: string,
    holidayName: string,
    dateDescription: string,
    facilityId: string
  ) {
    await log(supabase, 'facility_holiday.created', {
      targetType: 'facility_holiday',
      targetId: holidayId,
      targetLabel: holidayName,
      facilityId,
      newValues: {
        name: holidayName,
        date_rule: dateDescription,
      },
    })
  },

  async updated(
    supabase: SupabaseClient,
    holidayId: string,
    holidayName: string,
    oldValues: { name?: string; date_rule?: string },
    newValues: { name?: string; date_rule?: string },
    facilityId: string
  ) {
    await log(supabase, 'facility_holiday.updated', {
      targetType: 'facility_holiday',
      targetId: holidayId,
      targetLabel: holidayName,
      facilityId,
      oldValues,
      newValues,
    })
  },

  async deleted(
    supabase: SupabaseClient,
    holidayId: string,
    holidayName: string,
    facilityId: string
  ) {
    await log(supabase, 'facility_holiday.deleted', {
      targetType: 'facility_holiday',
      targetId: holidayId,
      targetLabel: holidayName,
      facilityId,
    })
  },

  async toggled(
    supabase: SupabaseClient,
    holidayId: string,
    holidayName: string,
    isActive: boolean,
    facilityId: string
  ) {
    await log(supabase, 'facility_holiday.toggled', {
      targetType: 'facility_holiday',
      targetId: holidayId,
      targetLabel: holidayName,
      facilityId,
      newValues: { is_active: isActive },
    })
  },
}

// =====================================================
// FACILITY CLOSURES
// =====================================================

export const facilityClosureAudit = {
  async created(
    supabase: SupabaseClient,
    closureId: string,
    closureDate: string,
    reason: string | null,
    facilityId: string
  ) {
    await log(supabase, 'facility_closure.created', {
      targetType: 'facility_closure',
      targetId: closureId,
      targetLabel: closureDate,
      facilityId,
      newValues: {
        date: closureDate,
        reason: reason,
      },
    })
  },

  async deleted(
    supabase: SupabaseClient,
    closureId: string,
    closureDate: string,
    facilityId: string
  ) {
    await log(supabase, 'facility_closure.deleted', {
      targetType: 'facility_closure',
      targetId: closureId,
      targetLabel: closureDate,
      facilityId,
    })
  },
}

// =====================================================
// SURGEON COLORS
// =====================================================

export const surgeonColorAudit = {
  async assigned(
    supabase: SupabaseClient,
    surgeonId: string,
    surgeonName: string,
    color: string,
    facilityId: string
  ) {
    await log(supabase, 'surgeon_color.assigned', {
      targetType: 'surgeon_color',
      targetId: surgeonId,
      targetLabel: surgeonName,
      facilityId,
      newValues: { color },
    })
  },

  async changed(
    supabase: SupabaseClient,
    surgeonId: string,
    surgeonName: string,
    oldColor: string,
    newColor: string,
    facilityId: string
  ) {
    await log(supabase, 'surgeon_color.changed', {
      targetType: 'surgeon_color',
      targetId: surgeonId,
      targetLabel: surgeonName,
      facilityId,
      oldValues: { color: oldColor },
      newValues: { color: newColor },
    })
  },
}
// =====================================================
// BODY REGIONS
// =====================================================

export const bodyRegionAudit = {
  async created(supabase: SupabaseClient, regionName: string, regionId: string) {
    await log(supabase, 'admin.body_region_created', {
      targetType: 'body_region',
      targetId: regionId,
      targetLabel: regionName,
      newValues: { name: regionName },
    })
  },

  async updated(supabase: SupabaseClient, regionId: string, oldName: string, newName: string) {
    await log(supabase, 'admin.body_region_updated', {
      targetType: 'body_region',
      targetId: regionId,
      targetLabel: newName,
      oldValues: { name: oldName },
      newValues: { name: newName },
    })
  },

  async deleted(supabase: SupabaseClient, regionName: string, regionId: string) {
    await log(supabase, 'admin.body_region_deleted', {
      targetType: 'body_region',
      targetId: regionId,
      targetLabel: regionName,
    })
  },
}

// =====================================================
// PROCEDURE CATEGORIES (Global Admin)
// =====================================================

export const procedureCategoryAudit = {
  async created(
    supabase: SupabaseClient,
    categoryName: string,
    categoryId: string,
    bodyRegion?: string
  ) {
    await log(supabase, 'admin.procedure_category_created', {
      targetType: 'procedure_category',
      targetId: categoryId,
      targetLabel: categoryName,
      newValues: { 
        name: categoryName,
        body_region: bodyRegion || null,
        scope: 'global' 
      },
    })
  },

  async updated(
    supabase: SupabaseClient,
    categoryId: string,
    categoryName: string,
    oldValues: Record<string, unknown>,
    newValues: Record<string, unknown>
  ) {
    await log(supabase, 'admin.procedure_category_updated', {
      targetType: 'procedure_category',
      targetId: categoryId,
      targetLabel: categoryName,
      oldValues,
      newValues: { ...newValues, scope: 'global' },
    })
  },

  async deleted(
    supabase: SupabaseClient,
    categoryName: string,
    categoryId: string
  ) {
    await log(supabase, 'admin.procedure_category_deleted', {
      targetType: 'procedure_category',
      targetId: categoryId,
      targetLabel: categoryName,
    })
  },

  async reordered(
    supabase: SupabaseClient,
    changes: { id: string; name: string; oldOrder: number; newOrder: number }[]
  ) {
    await log(supabase, 'admin.procedure_category_reordered', {
      targetType: 'procedure_category',
      metadata: { 
        changes: changes.map(c => ({
          name: c.name,
          from: c.oldOrder,
          to: c.newOrder
        }))
      },
    })
  },
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

  async cancelled(
    supabase: SupabaseClient,
    caseData: { id: string; case_number: string },
    reasonName: string,
    reasonCategory: string,
    hadMilestones: boolean,
    milestoneCount: number,
    facilityId?: string,
    notes?: string
  ) {
    await log(supabase, 'case.cancelled', {
      targetType: 'case',
      targetId: caseData.id,
      targetLabel: `Case #${caseData.case_number}`,
      facilityId,
      newValues: {
        status: 'cancelled',
        cancellation_reason: reasonName,
        cancellation_category: reasonCategory,
        had_milestones: hadMilestones,
        milestone_count: milestoneCount,
        cancellation_notes: notes || null,
      },
    })
  },

  async restored(
    supabase: SupabaseClient,
    caseData: { id: string; case_number: string },
    facilityId?: string
  ) {
    await log(supabase, 'case.restored', {
      targetType: 'case',
      targetId: caseData.id,
      targetLabel: `Case #${caseData.case_number}`,
      facilityId,
      newValues: {
        status: 'scheduled',
        restored: true,
      },
    })
  },
}
// =====================================================
// DATA QUALITY
// =====================================================

export const dataQualityAudit = {
  async issueResolved(
    supabase: SupabaseClient,
    issueId: string,
    issueType: string,
    caseNumber: string,
    resolutionType: 'corrected' | 'excluded' | 'approved',
    facilityId: string,
    notes?: string
  ) {
    const actionMap = {
      corrected: 'data_quality.issue_resolved',
      excluded: 'data_quality.issue_excluded',
      approved: 'data_quality.issue_approved',
    } as const
    
    await log(supabase, actionMap[resolutionType], {
      targetType: 'metric_issue',
      targetId: issueId,
      targetLabel: `${issueType} on Case #${caseNumber}`,
      facilityId,
      newValues: { 
        resolution_type: resolutionType,
        notes: notes || null 
      },
    })
  },

  async bulkResolved(
    supabase: SupabaseClient,
    issueCount: number,
    resolutionType: 'corrected' | 'excluded' | 'approved',
    facilityId: string,
    notes?: string
  ) {
    await log(supabase, 'data_quality.bulk_resolved', {
      targetType: 'metric_issue',
      targetLabel: `${issueCount} issues`,
      facilityId,
      newValues: { 
        count: issueCount,
        resolution_type: resolutionType,
        notes: notes || null 
      },
    })
  },

  async detectionRun(
    supabase: SupabaseClient,
    facilityId: string,
    daysScanned: number,
    issuesFound: number,
    issuesExpired: number
  ) {
    await log(supabase, 'data_quality.detection_run', {
      targetType: 'facility',
      targetId: facilityId,
      targetLabel: `${issuesFound} issues found`,
      facilityId,
      metadata: {
        days_scanned: daysScanned,
        issues_found: issuesFound,
        issues_expired: issuesExpired,
      },
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
// COST CATEGORIES (Facility-Level)
// =====================================================

export const costCategoryAudit = {
  async created(
    supabase: SupabaseClient,
    categoryName: string,
    categoryId: string,
    categoryType: 'credit' | 'debit',
    facilityId: string
  ) {
    await log(supabase, 'cost_category.created', {
      targetType: 'cost_category',
      targetId: categoryId,
      targetLabel: categoryName,
      facilityId,
      newValues: { name: categoryName, type: categoryType },
    })
  },

  async updated(
    supabase: SupabaseClient,
    categoryId: string,
    oldValues: { name?: string; type?: string; description?: string },
    newValues: { name?: string; type?: string; description?: string },
    facilityId: string
  ) {
    await log(supabase, 'cost_category.updated', {
      targetType: 'cost_category',
      targetId: categoryId,
      targetLabel: newValues.name || oldValues.name || 'Cost Category',
      facilityId,
      oldValues,
      newValues,
    })
  },

  async deleted(
    supabase: SupabaseClient,
    categoryName: string,
    categoryId: string,
    facilityId: string
  ) {
    await log(supabase, 'cost_category.deleted', {
      targetType: 'cost_category',
      targetId: categoryId,
      targetLabel: categoryName,
      facilityId,
    })
  },

  // Global admin versions
  async adminCreated(
    supabase: SupabaseClient,
    categoryName: string,
    categoryId: string,
    categoryType: 'credit' | 'debit'
  ) {
    await log(supabase, 'admin.cost_category_created', {
      targetType: 'cost_category_template',
      targetId: categoryId,
      targetLabel: categoryName,
      newValues: { name: categoryName, type: categoryType, scope: 'global' },
    })
  },

  async adminUpdated(
  supabase: SupabaseClient,
  categoryId: string,
  oldValues: { name?: string; type?: string; description?: string; is_active?: boolean },
  newValues: { name?: string; type?: string; description?: string; is_active?: boolean }
) {
    await log(supabase, 'admin.cost_category_updated', {
      targetType: 'cost_category_template',
      targetId: categoryId,
      targetLabel: newValues.name || oldValues.name || 'Cost Category',
      oldValues,
      newValues: { ...newValues, scope: 'global' },
    })
  },

  async adminDeleted(
    supabase: SupabaseClient,
    categoryName: string,
    categoryId: string
  ) {
    await log(supabase, 'admin.cost_category_deleted', {
      targetType: 'cost_category_template',
      targetId: categoryId,
      targetLabel: categoryName,
    })
  },
}


// =====================================================
// PROCEDURE COST ITEMS
// =====================================================

export const procedureCostItemAudit = {
  async created(
    supabase: SupabaseClient,
    procedureName: string,
    categoryName: string,
    amount: number,
    itemId: string,
    facilityId: string
  ) {
    await log(supabase, 'procedure_cost_item.created', {
      targetType: 'procedure_cost_item',
      targetId: itemId,
      targetLabel: `${procedureName} - ${categoryName}`,
      facilityId,
      newValues: { procedure: procedureName, category: categoryName, amount },
    })
  },

  async updated(
    supabase: SupabaseClient,
    procedureName: string,
    categoryName: string,
    oldAmount: number,
    newAmount: number,
    itemId: string,
    facilityId: string
  ) {
    await log(supabase, 'procedure_cost_item.updated', {
      targetType: 'procedure_cost_item',
      targetId: itemId,
      targetLabel: `${procedureName} - ${categoryName}`,
      facilityId,
      oldValues: { amount: oldAmount },
      newValues: { amount: newAmount },
    })
  },

  async deleted(
    supabase: SupabaseClient,
    procedureName: string,
    categoryName: string,
    itemId: string,
    facilityId: string
  ) {
    await log(supabase, 'procedure_cost_item.deleted', {
      targetType: 'procedure_cost_item',
      targetId: itemId,
      targetLabel: `${procedureName} - ${categoryName}`,
      facilityId,
    })
  },
}


// =====================================================
// SURGEON COST ITEMS (Variance)
// =====================================================

export const surgeonCostItemAudit = {
  async created(
    supabase: SupabaseClient,
    surgeonName: string,
    procedureName: string,
    categoryName: string,
    amount: number,
    itemId: string,
    facilityId: string
  ) {
    await log(supabase, 'surgeon_cost_item.created', {
      targetType: 'surgeon_cost_item',
      targetId: itemId,
      targetLabel: `${surgeonName} - ${procedureName} - ${categoryName}`,
      facilityId,
      newValues: { surgeon: surgeonName, procedure: procedureName, category: categoryName, amount },
    })
  },

  async updated(
    supabase: SupabaseClient,
    surgeonName: string,
    procedureName: string,
    categoryName: string,
    oldAmount: number,
    newAmount: number,
    itemId: string,
    facilityId: string
  ) {
    await log(supabase, 'surgeon_cost_item.updated', {
      targetType: 'surgeon_cost_item',
      targetId: itemId,
      targetLabel: `${surgeonName} - ${procedureName} - ${categoryName}`,
      facilityId,
      oldValues: { amount: oldAmount },
      newValues: { amount: newAmount },
    })
  },

  async deleted(
    supabase: SupabaseClient,
    surgeonName: string,
    procedureName: string,
    categoryName: string,
    itemId: string,
    facilityId: string
  ) {
    await log(supabase, 'surgeon_cost_item.deleted', {
      targetType: 'surgeon_cost_item',
      targetId: itemId,
      targetLabel: `${surgeonName} - ${procedureName} - ${categoryName}`,
      facilityId,
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

  async restored(supabase: SupabaseClient, roomName: string, roomId: string) {
    await log(supabase, 'room.restored', {
      targetType: 'room',
      targetId: roomId,
      targetLabel: roomName,
      newValues: { restored: true },
    })
  },
}

// =====================================================
// PROCEDURE TYPES
// =====================================================

export const procedureAudit = {
  async created(
    supabase: SupabaseClient,
    name: string,
    id: string
  ) {
    await log(supabase, 'procedure_type.created', {
      targetType: 'procedure_type',
      targetId: id,
      targetLabel: name,
      newValues: { name },
    })
  },

  async updated(
    supabase: SupabaseClient,
    id: string,
    oldName: string,
    newName: string
  ) {
    await log(supabase, 'procedure_type.updated', {
      targetType: 'procedure_type',
      targetId: id,
      targetLabel: newName,
      oldValues: { name: oldName },
      newValues: { name: newName },
    })
  },

  async deleted(
    supabase: SupabaseClient,
    name: string,
    id: string
  ) {
    await log(supabase, 'procedure_type.deleted', {
      targetType: 'procedure_type',
      targetId: id,
      targetLabel: name,
    })
  },

  // NEW: Add this method
  async restored(
    supabase: SupabaseClient,
    name: string,
    id: string
  ) {
    await log(supabase, 'procedure_type.restored', {
      targetType: 'procedure_type',
      targetId: id,
      targetLabel: name,
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
// CANCELLATION REASONS
// =====================================================

export const cancellationReasonAudit = {
  async created(
    supabase: SupabaseClient,
    reasonName: string,
    reasonId: string,
    category: string,
    facilityId: string
  ) {
    await log(supabase, 'cancellation_reason.created', {
      targetType: 'cancellation_reason',
      targetId: reasonId,
      targetLabel: reasonName,
      facilityId,
      newValues: { name: reasonName, category },
    })
  },

  async updated(
    supabase: SupabaseClient,
    reasonId: string,
    oldName: string,
    newName: string,
    facilityId: string
  ) {
    await log(supabase, 'cancellation_reason.updated', {
      targetType: 'cancellation_reason',
      targetId: reasonId,
      targetLabel: newName,
      facilityId,
      oldValues: { name: oldName },
      newValues: { name: newName },
    })
  },

  async deleted(
    supabase: SupabaseClient,
    reasonName: string,
    reasonId: string,
    facilityId: string
  ) {
    await log(supabase, 'cancellation_reason.deleted', {
      targetType: 'cancellation_reason',
      targetId: reasonId,
      targetLabel: reasonName,
      facilityId,
    })
  },

  async restored(
    supabase: SupabaseClient,
    reasonName: string,
    reasonId: string,
    facilityId: string
  ) {
    await log(supabase, 'cancellation_reason.restored', {
      targetType: 'cancellation_reason',
      targetId: reasonId,
      targetLabel: reasonName,
      facilityId,
    })
  },

  // Global admin template versions
  async adminCreated(
    supabase: SupabaseClient,
    reasonName: string,
    reasonId: string,
    category: string
  ) {
    await log(supabase, 'admin.cancellation_reason_template_created', {
      targetType: 'cancellation_reason_template',
      targetId: reasonId,
      targetLabel: reasonName,
      newValues: { name: reasonName, category, scope: 'global' },
    })
  },

  async adminUpdated(
    supabase: SupabaseClient,
    reasonId: string,
    oldName: string,
    newName: string,
    category?: string
  ) {
    await log(supabase, 'admin.cancellation_reason_template_updated', {
      targetType: 'cancellation_reason_template',
      targetId: reasonId,
      targetLabel: newName,
      oldValues: { name: oldName },
      newValues: { name: newName, category, scope: 'global' },
    })
  },

  async adminDeleted(
    supabase: SupabaseClient,
    reasonName: string,
    reasonId: string
  ) {
    await log(supabase, 'admin.cancellation_reason_template_deleted', {
      targetType: 'cancellation_reason_template',
      targetId: reasonId,
      targetLabel: reasonName,
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
    await log(supabase, 'admin.procedure_template_created', {
      targetType: 'procedure_template',
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
    await log(supabase, 'admin.procedure_template_updated', {
      targetType: 'procedure_template',
      targetId: procedureId,
      targetLabel: procedureName,
      newValues: changes,
    })
  },

  async defaultProcedureDeleted(supabase: SupabaseClient, procedureName: string, procedureId: string) {
    await log(supabase, 'admin.procedure_template_deleted', {
      targetType: 'procedure_template',
      targetId: procedureId,
      targetLabel: procedureName,
    })
  },

  async facilityDeleted(supabase: SupabaseClient, facilityName: string, facilityId: string) {
    await log(supabase, 'facility.deleted', {
      targetType: 'facility',
      targetId: facilityId,
      targetLabel: facilityName,
    })
  },

  // Body Regions
  async bodyRegionCreated(supabase: SupabaseClient, regionName: string, regionId: string) {
    await log(supabase, 'admin.body_region_created', {
      targetType: 'body_region',
      targetId: regionId,
      targetLabel: regionName,
      newValues: { name: regionName },
    })
  },

  async bodyRegionUpdated(
    supabase: SupabaseClient,
    regionId: string,
    oldName: string,
    newName: string
  ) {
    await log(supabase, 'admin.body_region_updated', {
      targetType: 'body_region',
      targetId: regionId,
      targetLabel: newName,
      oldValues: { name: oldName },
      newValues: { name: newName },
    })
  },

  async bodyRegionDeleted(supabase: SupabaseClient, regionName: string, regionId: string) {
    await log(supabase, 'admin.body_region_deleted', {
      targetType: 'body_region',
      targetId: regionId,
      targetLabel: regionName,
    })
  },
}
// =====================================================
// NOTIFICATION SETTINGS
// =====================================================

export const notificationSettingsAudit = {
  async updated(
    supabase: SupabaseClient,
    facilityId: string,
    settingName: string,
    oldValue: unknown,
    newValue: unknown
  ) {
    await log(supabase, 'notification_settings.updated', {
      targetType: 'notification_setting',
      targetLabel: settingName,
      facilityId,
      oldValues: { value: oldValue },
      newValues: { value: newValue },
    })
  },

  async categoryEnabled(
    supabase: SupabaseClient,
    facilityId: string,
    categoryName: string
  ) {
    await log(supabase, 'notification_settings.category_enabled', {
      targetType: 'notification_category',
      targetLabel: categoryName,
      facilityId,
      newValues: { enabled: true },
    })
  },

  async categoryDisabled(
    supabase: SupabaseClient,
    facilityId: string,
    categoryName: string
  ) {
    await log(supabase, 'notification_settings.category_disabled', {
      targetType: 'notification_category',
      targetLabel: categoryName,
      facilityId,
      newValues: { enabled: false },
    })
  },

  async quietHoursUpdated(
    supabase: SupabaseClient,
    facilityId: string,
    oldHours: { start: string; end: string; enabled: boolean } | null,
    newHours: { start: string; end: string; enabled: boolean }
  ) {
    await log(supabase, 'notification_settings.quiet_hours_updated', {
      targetType: 'quiet_hours',
      targetLabel: 'Quiet Hours',
      facilityId,
      oldValues: oldHours ? { 
        start: oldHours.start, 
        end: oldHours.end, 
        enabled: oldHours.enabled 
      } : undefined,
      newValues: { 
        start: newHours.start, 
        end: newHours.end, 
        enabled: newHours.enabled 
      },
    })
  },

  async recipientsUpdated(
    supabase: SupabaseClient,
    facilityId: string,
    notificationType: string,
    oldRoles: string[],
    newRoles: string[]
  ) {
    await log(supabase, 'notification_settings.recipients_updated', {
      targetType: 'notification_recipients',
      targetLabel: notificationType,
      facilityId,
      oldValues: { roles: oldRoles },
      newValues: { roles: newRoles },
    })
  },
}
// =====================================================
// PATIENT CHECK-IN AUDIT
// =====================================================

export const checkinAudit = {
  async patientCheckedIn(
    supabase: SupabaseClient,
    caseNumber: string,
    checkinId: string,
    facilityId: string
  ) {
    await log(supabase, 'checkin.patient_checked_in', {
      targetType: 'patient_checkin',
      targetId: checkinId,
      targetLabel: `Case #${caseNumber}`,
      facilityId,
    })
  },

  async statusUpdated(
    supabase: SupabaseClient,
    caseNumber: string,
    checkinId: string,
    oldStatus: string,
    newStatus: string,
    facilityId: string
  ) {
    await log(supabase, 'checkin.status_updated', {
      targetType: 'patient_checkin',
      targetId: checkinId,
      targetLabel: `Case #${caseNumber}`,
      facilityId,
      oldValues: { status: oldStatus },
      newValues: { status: newStatus },
    })
  },

  async checklistCompleted(
    supabase: SupabaseClient,
    caseNumber: string,
    checkinId: string,
    facilityId: string,
    fieldCount: number
  ) {
    await log(supabase, 'checkin.checklist_completed', {
      targetType: 'patient_checkin',
      targetId: checkinId,
      targetLabel: `Case #${caseNumber}`,
      facilityId,
      metadata: { fields_completed: fieldCount },
    })
  },

  async escortLinkGenerated(
    supabase: SupabaseClient,
    caseNumber: string,
    checkinId: string,
    linkId: string,
    facilityId: string,
    expiresHours: number
  ) {
    await log(supabase, 'checkin.escort_link_generated', {
      targetType: 'escort_status_link',
      targetId: linkId,
      targetLabel: `Case #${caseNumber}`,
      facilityId,
      metadata: { expires_hours: expiresHours },
    })
  },

  async escortInfoUpdated(
    supabase: SupabaseClient,
    caseNumber: string,
    checkinId: string,
    facilityId: string,
    escortName: string
  ) {
    await log(supabase, 'checkin.escort_info_updated', {
      targetType: 'patient_checkin',
      targetId: checkinId,
      targetLabel: `Case #${caseNumber}`,
      facilityId,
      newValues: { escort_name: escortName },
    })
  },

  async arrivalSettingsUpdated(
    supabase: SupabaseClient,
    facilityId: string,
    oldLeadTime: number | null,
    newLeadTime: number
  ) {
    await log(supabase, 'checkin.arrival_settings_updated', {
      targetType: 'facility',
      targetId: facilityId,
      targetLabel: 'Arrival time settings',
      facilityId,
      oldValues: oldLeadTime ? { lead_time_minutes: oldLeadTime } : undefined,
      newValues: { lead_time_minutes: newLeadTime },
    })
  },

  async checklistFieldCreated(
    supabase: SupabaseClient,
    fieldLabel: string,
    fieldId: string,
    facilityId: string
  ) {
    await log(supabase, 'checkin.checklist_field_created', {
      targetType: 'preop_checklist_field',
      targetId: fieldId,
      targetLabel: fieldLabel,
      facilityId,
    })
  },

  async checklistFieldUpdated(
    supabase: SupabaseClient,
    fieldId: string,
    oldLabel: string,
    newLabel: string,
    facilityId: string
  ) {
    await log(supabase, 'checkin.checklist_field_updated', {
      targetType: 'preop_checklist_field',
      targetId: fieldId,
      targetLabel: newLabel,
      facilityId,
      oldValues: { label: oldLabel },
      newValues: { label: newLabel },
    })
  },

  async checklistFieldDeleted(
    supabase: SupabaseClient,
    fieldLabel: string,
    fieldId: string,
    facilityId: string
  ) {
    await log(supabase, 'checkin.checklist_field_deleted', {
      targetType: 'preop_checklist_field',
      targetId: fieldId,
      targetLabel: fieldLabel,
      facilityId,
    })
  },

  async checklistFieldsReordered(
    supabase: SupabaseClient,
    facilityId: string,
    fieldCount: number
  ) {
    await log(supabase, 'checkin.checklist_field_reordered', {
      targetType: 'preop_checklist_field',
      targetLabel: `${fieldCount} fields`,
      facilityId,
    })
  },
}

// =====================================================
// FEATURE AUDIT
// =====================================================

export const featureAudit = {
  async enabled(
    supabase: SupabaseClient,
    featureName: string,
    featureDisplayName: string,
    facilityId: string,
    facilityName: string,
    trialDays?: number
  ) {
    await log(supabase, trialDays ? 'feature.trial_started' : 'feature.enabled', {
      targetType: 'facility_feature',
      targetLabel: `${featureDisplayName} for ${facilityName}`,
      facilityId,
      newValues: {
        feature: featureName,
        facility: facilityName,
        ...(trialDays && { trial_days: trialDays }),
      },
    })
  },

  async disabled(
    supabase: SupabaseClient,
    featureName: string,
    featureDisplayName: string,
    facilityId: string,
    facilityName: string
  ) {
    await log(supabase, 'feature.disabled', {
      targetType: 'facility_feature',
      targetLabel: `${featureDisplayName} for ${facilityName}`,
      facilityId,
      oldValues: {
        feature: featureName,
        facility: facilityName,
      },
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