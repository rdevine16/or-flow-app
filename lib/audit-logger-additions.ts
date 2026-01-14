// =====================================================
// AUDIT LOGGER ADDITIONS FOR PHASE 1
// =====================================================
// Add these to your existing lib/audit-logger.ts file
// =====================================================

import { SupabaseClient } from '@supabase/supabase-js'

// =====================================================
// NEW AUDIT EVENT TYPES
// =====================================================

// Add these to your existing AuditAction type:
export type NewAuditActions =
  // Implant Companies
  | 'implant_company.created'
  | 'implant_company.updated'
  | 'implant_company.deleted'
  // Global Admin Implant Companies
  | 'admin.implant_company_created'
  | 'admin.implant_company_updated'
  | 'admin.implant_company_deleted'
  // Case Implant Companies
  | 'case.implant_company_added'
  | 'case.implant_company_removed'
  // Device Rep Access
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
  // Global Admin Delay Types
  | 'admin.delay_type_created'
  | 'admin.delay_type_updated'
  | 'admin.delay_type_deleted'
  // Global Admin Procedure Types (already exists but adding for completeness)
  | 'admin.procedure_type_created'
  | 'admin.procedure_type_updated'
  | 'admin.procedure_type_deleted'

// =====================================================
// FORMAT AUDIT ACTION (Add to existing formatAuditAction)
// =====================================================

export const newAuditActionLabels: Record<NewAuditActions, string> = {
  // Implant Companies
  'implant_company.created': 'created an implant company',
  'implant_company.updated': 'updated an implant company',
  'implant_company.deleted': 'deleted an implant company',
  'admin.implant_company_created': 'created a global implant company',
  'admin.implant_company_updated': 'updated a global implant company',
  'admin.implant_company_deleted': 'deleted a global implant company',
  // Case Implant Companies
  'case.implant_company_added': 'added implant company to case',
  'case.implant_company_removed': 'removed implant company from case',
  // Device Rep Access
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
  'admin.delay_type_created': 'created a global delay type',
  'admin.delay_type_updated': 'updated a global delay type',
  'admin.delay_type_deleted': 'deleted a global delay type',
  // Procedure Types (global admin)
  'admin.procedure_type_created': 'created a global procedure type',
  'admin.procedure_type_updated': 'updated a global procedure type',
  'admin.procedure_type_deleted': 'deleted a global procedure type',
}

// =====================================================
// IMPLANT COMPANY AUDIT HELPERS
// =====================================================

export const implantCompanyAudit = {
  /**
   * Log creation of a facility-specific implant company
   */
  async created(
    supabase: SupabaseClient,
    companyName: string,
    companyId: string,
    facilityId?: string
  ) {
    return logAudit(supabase, {
      action: 'implant_company.created',
      targetType: 'implant_company',
      targetId: companyId,
      facilityId,
      newValues: { name: companyName },
    })
  },

  /**
   * Log update of a facility-specific implant company
   */
  async updated(
    supabase: SupabaseClient,
    companyId: string,
    oldName: string,
    newName: string,
    facilityId?: string
  ) {
    return logAudit(supabase, {
      action: 'implant_company.updated',
      targetType: 'implant_company',
      targetId: companyId,
      facilityId,
      oldValues: { name: oldName },
      newValues: { name: newName },
    })
  },

  /**
   * Log deletion of a facility-specific implant company
   */
  async deleted(
    supabase: SupabaseClient,
    companyName: string,
    companyId: string,
    facilityId?: string
  ) {
    return logAudit(supabase, {
      action: 'implant_company.deleted',
      targetType: 'implant_company',
      targetId: companyId,
      facilityId,
      oldValues: { name: companyName },
    })
  },

  // Global admin versions
  async adminCreated(supabase: SupabaseClient, companyName: string, companyId: string) {
    return logAudit(supabase, {
      action: 'admin.implant_company_created',
      targetType: 'implant_company',
      targetId: companyId,
      newValues: { name: companyName, scope: 'global' },
    })
  },

  async adminUpdated(supabase: SupabaseClient, companyId: string, oldName: string, newName: string) {
    return logAudit(supabase, {
      action: 'admin.implant_company_updated',
      targetType: 'implant_company',
      targetId: companyId,
      oldValues: { name: oldName },
      newValues: { name: newName, scope: 'global' },
    })
  },

  async adminDeleted(supabase: SupabaseClient, companyName: string, companyId: string) {
    return logAudit(supabase, {
      action: 'admin.implant_company_deleted',
      targetType: 'implant_company',
      targetId: companyId,
      oldValues: { name: companyName, scope: 'global' },
    })
  },
}

// =====================================================
// CASE IMPLANT COMPANY AUDIT HELPERS
// =====================================================

export const caseImplantAudit = {
  /**
   * Log adding an implant company to a case
   */
  async added(
    supabase: SupabaseClient,
    caseId: string,
    caseNumber: string,
    companyName: string,
    companyId: string,
    facilityId: string
  ) {
    return logAudit(supabase, {
      action: 'case.implant_company_added',
      targetType: 'case',
      targetId: caseId,
      facilityId,
      newValues: {
        case_number: caseNumber,
        implant_company: companyName,
        implant_company_id: companyId,
      },
    })
  },

  /**
   * Log removing an implant company from a case
   */
  async removed(
    supabase: SupabaseClient,
    caseId: string,
    caseNumber: string,
    companyName: string,
    companyId: string,
    facilityId: string
  ) {
    return logAudit(supabase, {
      action: 'case.implant_company_removed',
      targetType: 'case',
      targetId: caseId,
      facilityId,
      oldValues: {
        case_number: caseNumber,
        implant_company: companyName,
        implant_company_id: companyId,
      },
    })
  },
}

// =====================================================
// DEVICE REP AUDIT HELPERS
// =====================================================

export const deviceRepAudit = {
  /**
   * Log inviting a device rep to a facility
   */
  async invited(
    supabase: SupabaseClient,
    repEmail: string,
    companyName: string,
    facilityId: string,
    facilityName: string
  ) {
    return logAudit(supabase, {
      action: 'device_rep.invited',
      targetType: 'device_rep_invite',
      facilityId,
      newValues: {
        rep_email: repEmail,
        implant_company: companyName,
        facility_name: facilityName,
      },
    })
  },

  /**
   * Log a device rep accepting a facility invite
   */
  async acceptedInvite(
    supabase: SupabaseClient,
    repId: string,
    repEmail: string,
    facilityId: string,
    facilityName: string,
    ipAddress?: string
  ) {
    return logAudit(supabase, {
      action: 'device_rep.invite_accepted',
      targetType: 'facility_device_rep',
      targetId: repId,
      facilityId,
      ipAddress,
      newValues: {
        rep_email: repEmail,
        facility_name: facilityName,
        accepted_at: new Date().toISOString(),
      },
    })
  },

  /**
   * Log revoking a device rep's access
   */
  async accessRevoked(
    supabase: SupabaseClient,
    repId: string,
    repEmail: string,
    repName: string,
    companyName: string,
    facilityId: string
  ) {
    return logAudit(supabase, {
      action: 'device_rep.access_revoked',
      targetType: 'facility_device_rep',
      targetId: repId,
      facilityId,
      oldValues: {
        rep_name: repName,
        rep_email: repEmail,
        implant_company: companyName,
      },
    })
  },

  /**
   * Log a device rep viewing a case
   */
  async viewedCase(
    supabase: SupabaseClient,
    repId: string,
    caseId: string,
    caseNumber: string,
    facilityId: string,
    facilityName: string
  ) {
    return logAudit(supabase, {
      action: 'device_rep.viewed_case',
      targetType: 'case',
      targetId: caseId,
      facilityId,
      newValues: {
        case_number: caseNumber,
        facility_name: facilityName,
        viewed_at: new Date().toISOString(),
      },
    })
  },
}

// =====================================================
// SURGEON PREFERENCE AUDIT HELPERS
// =====================================================

export const surgeonPrefAudit = {
  /**
   * Log creation of a surgeon preference
   */
  async created(
    supabase: SupabaseClient,
    preferenceId: string,
    surgeonName: string,
    procedureName: string,
    companyNames: string[],
    facilityId: string
  ) {
    return logAudit(supabase, {
      action: 'surgeon_preference.created',
      targetType: 'surgeon_preference',
      targetId: preferenceId,
      facilityId,
      newValues: {
        surgeon: surgeonName,
        procedure: procedureName,
        implant_companies: companyNames,
      },
    })
  },

  /**
   * Log update of a surgeon preference
   */
  async updated(
    supabase: SupabaseClient,
    preferenceId: string,
    surgeonName: string,
    oldValues: { procedure?: string; companies?: string[] },
    newValues: { procedure?: string; companies?: string[] },
    facilityId: string
  ) {
    return logAudit(supabase, {
      action: 'surgeon_preference.updated',
      targetType: 'surgeon_preference',
      targetId: preferenceId,
      facilityId,
      oldValues: { surgeon: surgeonName, ...oldValues },
      newValues: { surgeon: surgeonName, ...newValues },
    })
  },

  /**
   * Log deletion of a surgeon preference
   */
  async deleted(
    supabase: SupabaseClient,
    preferenceId: string,
    surgeonName: string,
    procedureName: string,
    facilityId: string
  ) {
    return logAudit(supabase, {
      action: 'surgeon_preference.deleted',
      targetType: 'surgeon_preference',
      targetId: preferenceId,
      facilityId,
      oldValues: {
        surgeon: surgeonName,
        procedure: procedureName,
      },
    })
  },
}

// =====================================================
// DELAY TYPE AUDIT HELPERS
// =====================================================

export const delayTypeAudit = {
  /**
   * Log creation of a facility-specific delay type
   */
  async created(
    supabase: SupabaseClient,
    delayTypeName: string,
    delayTypeId: string,
    facilityId: string
  ) {
    return logAudit(supabase, {
      action: 'delay_type.created',
      targetType: 'delay_type',
      targetId: delayTypeId,
      facilityId,
      newValues: { name: delayTypeName },
    })
  },

  /**
   * Log update of a facility-specific delay type
   */
  async updated(
    supabase: SupabaseClient,
    delayTypeId: string,
    oldName: string,
    newName: string,
    facilityId: string
  ) {
    return logAudit(supabase, {
      action: 'delay_type.updated',
      targetType: 'delay_type',
      targetId: delayTypeId,
      facilityId,
      oldValues: { name: oldName },
      newValues: { name: newName },
    })
  },

  /**
   * Log deletion of a facility-specific delay type
   */
  async deleted(
    supabase: SupabaseClient,
    delayTypeName: string,
    delayTypeId: string,
    facilityId: string
  ) {
    return logAudit(supabase, {
      action: 'delay_type.deleted',
      targetType: 'delay_type',
      targetId: delayTypeId,
      facilityId,
      oldValues: { name: delayTypeName },
    })
  },

  // Global admin versions
  async adminCreated(supabase: SupabaseClient, delayTypeName: string, delayTypeId: string) {
    return logAudit(supabase, {
      action: 'admin.delay_type_created',
      targetType: 'delay_type',
      targetId: delayTypeId,
      newValues: { name: delayTypeName, scope: 'global' },
    })
  },

  async adminUpdated(supabase: SupabaseClient, delayTypeId: string, oldName: string, newName: string) {
    return logAudit(supabase, {
      action: 'admin.delay_type_updated',
      targetType: 'delay_type',
      targetId: delayTypeId,
      oldValues: { name: oldName },
      newValues: { name: newName, scope: 'global' },
    })
  },

  async adminDeleted(supabase: SupabaseClient, delayTypeName: string, delayTypeId: string) {
    return logAudit(supabase, {
      action: 'admin.delay_type_deleted',
      targetType: 'delay_type',
      targetId: delayTypeId,
      oldValues: { name: delayTypeName, scope: 'global' },
    })
  },
}

// =====================================================
// CORE LOGGING FUNCTION
// =====================================================
// This should match your existing logAudit function structure
// Adjust parameters as needed to match your implementation

interface LogAuditParams {
  action: string
  targetType?: string
  targetId?: string
  facilityId?: string
  oldValues?: Record<string, any>
  newValues?: Record<string, any>
  ipAddress?: string
}

async function logAudit(supabase: SupabaseClient, params: LogAuditParams) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      console.warn('Audit log: No user found')
      return
    }

    // Get user details
    const { data: userData } = await supabase
      .from('users')
      .select('email, facility_id')
      .eq('id', user.id)
      .single()

    const { error } = await supabase.from('audit_log').insert({
      user_id: user.id,
      user_email: userData?.email || user.email,
      facility_id: params.facilityId || userData?.facility_id,
      action: params.action,
      target_type: params.targetType,
      target_id: params.targetId,
      old_values: params.oldValues,
      new_values: params.newValues,
      ip_address: params.ipAddress,
      success: true,
    })

    if (error) {
      console.error('Failed to write audit log:', error)
    }
  } catch (err) {
    console.error('Audit logging error:', err)
  }
}

// =====================================================
// EXPORTS
// =====================================================

export {
  logAudit,
  implantCompanyAudit,
  caseImplantAudit,
  deviceRepAudit,
  surgeonPrefAudit,
  delayTypeAudit,
}
