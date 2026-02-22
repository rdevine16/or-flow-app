// app/admin/facilities/new/actions.ts
// Submission logic for the facility creation wizard

import type { SupabaseClient } from '@supabase/supabase-js'
import type { FacilityData, AdminData, TemplateConfig } from './types'
import { buildFullAddress } from './types'
import { facilityAudit } from '@/lib/audit-logger'
import { logger } from '@/lib/logger'

const log = logger('FacilityCreation')

export interface CreateFacilityParams {
  supabase: SupabaseClient
  facilityData: FacilityData
  adminData: AdminData
  templateConfig: TemplateConfig
  sendWelcomeEmail: boolean
}

export interface CreateFacilityResult {
  success: boolean
  facilityId?: string
  error?: string
  inviteWarning?: string
}

/**
 * Creates a facility with all selected templates via the seed_facility_with_templates RPC.
 *
 * Flow:
 * 1. INSERT facility record
 * 2. Call seed_facility_with_templates(facility_id, template_config) RPC
 * 3. Send admin invite email (if enabled)
 * 4. Log audit event
 */
export async function createFacilityWithTemplates(
  params: CreateFacilityParams
): Promise<CreateFacilityResult> {
  const { supabase, facilityData, adminData, templateConfig, sendWelcomeEmail } = params

  try {
    // Calculate trial end date
    const trialEndsAt =
      facilityData.subscriptionStatus === 'trial'
        ? new Date(Date.now() + facilityData.trialDays * 86400000).toISOString()
        : null

    const fullAddress = buildFullAddress(facilityData)

    // Step 1: Create facility
    const { data: facility, error: facilityError } = await supabase
      .from('facilities')
      .insert({
        name: facilityData.name.trim(),
        address: fullAddress || null,
        street_address: facilityData.streetAddress.trim() || null,
        street_address_2: facilityData.streetAddress2.trim() || null,
        city: facilityData.city.trim() || null,
        state: facilityData.state || null,
        zip_code: facilityData.zipCode.trim() || null,
        phone: facilityData.phone.replace(/\D/g, '') || null,
        facility_type: facilityData.facilityType || null,
        timezone: facilityData.timezone,
        subscription_status: facilityData.subscriptionStatus,
        trial_ends_at: trialEndsAt,
        subscription_started_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (facilityError || !facility) {
      log.error('Failed to create facility', { error: facilityError })
      return { success: false, error: `Failed to create facility: ${facilityError?.message}` }
    }

    // Step 2: Seed templates via RPC
    const { error: rpcError } = await supabase.rpc('seed_facility_with_templates', {
      target_facility_id: facility.id,
      template_config: {
        milestones: templateConfig.milestones,
        procedures: templateConfig.procedures,
        procedure_milestone_config: templateConfig.procedureMilestoneConfig,
        delay_types: templateConfig.delayTypes,
        cancellation_reasons: templateConfig.cancellationReasons,
        complexities: templateConfig.complexities,
        preop_checklist_fields: templateConfig.checklistFields,
        cost_categories: templateConfig.costCategories,
        implant_companies: templateConfig.implantCompanies,
        payers: templateConfig.payers,
        analytics_settings: templateConfig.analyticsSettings,
        flag_rules: templateConfig.flagRules,
        phase_definitions: templateConfig.phaseDefinitions,
        notification_settings: templateConfig.notificationSettings,
      },
    })

    if (rpcError) {
      log.error('Failed to seed templates', { error: rpcError, facilityId: facility.id })
      return {
        success: false,
        facilityId: facility.id,
        error: `Facility created but template seeding failed: ${rpcError.message}`,
      }
    }

    // Step 3: Send admin invite
    let inviteWarning: string | undefined
    if (sendWelcomeEmail) {
      try {
        const { data: session } = await supabase.auth.getSession()
        const inviteResponse = await fetch('/api/admin/invite', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.session?.access_token}`,
          },
          body: JSON.stringify({
            email: adminData.email.trim(),
            firstName: adminData.firstName.trim(),
            lastName: adminData.lastName.trim(),
            accessLevel: 'facility_admin',
            facilityId: facility.id,
            roleId: adminData.roleId,
          }),
        })

        if (!inviteResponse.ok) {
          const result = await inviteResponse.json()
          inviteWarning = result?.error || result?.message || 'Failed to send invitation'
          log.warn('Admin invite failed', { facilityId: facility.id, warning: inviteWarning })
        }
      } catch (inviteErr) {
        inviteWarning = 'Failed to send invitation email'
        log.warn('Admin invite exception', { facilityId: facility.id, error: inviteErr })
      }
    }

    // Step 4: Audit log
    await facilityAudit.created(supabase, facilityData.name.trim(), facility.id)

    return {
      success: true,
      facilityId: facility.id,
      inviteWarning,
    }
  } catch (err) {
    log.error('Unexpected error creating facility', { error: err })
    return {
      success: false,
      error: err instanceof Error ? err.message : 'An unexpected error occurred',
    }
  }
}
