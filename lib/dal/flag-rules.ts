/**
 * Data Access Layer — Flag Rules
 *
 * CRUD operations for flag_rules table.
 * Used by the Flag Rules settings page for built-in + custom rule management.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { query, mutate } from './core'
import type { DalResult } from './core'
import type { FlagRule, CustomRuleFormState } from '@/types/flag-settings'
import { getMetricById } from '@/lib/constants/metrics-catalog'

// =====================================================
// QUERIES
// =====================================================

/** Fetch all active (non-archived) flag rules for a facility, ordered by display_order. */
export async function listActiveByFacility(
  supabase: SupabaseClient,
  facilityId: string
): Promise<DalResult<FlagRule[]>> {
  return query('flagRules.listActiveByFacility', async () =>
    await supabase
      .from('flag_rules')
      .select('*')
      .eq('facility_id', facilityId)
      .eq('is_active', true)
      .order('display_order', { ascending: true })
  )
}

/** Fetch all archived flag rules for a facility. */
export async function listArchivedByFacility(
  supabase: SupabaseClient,
  facilityId: string
): Promise<DalResult<FlagRule[]>> {
  return query('flagRules.listArchivedByFacility', async () =>
    await supabase
      .from('flag_rules')
      .select('*')
      .eq('facility_id', facilityId)
      .eq('is_active', false)
      .order('updated_at', { ascending: false })
  )
}

/** Fetch all flag rules linked to a specific cost category. */
export async function getRulesByCostCategory(
  supabase: SupabaseClient,
  costCategoryId: string
): Promise<DalResult<FlagRule[]>> {
  return query('flagRules.getRulesByCostCategory', async () =>
    await supabase
      .from('flag_rules')
      .select('*')
      .eq('cost_category_id', costCategoryId)
      .eq('is_active', true)
  )
}

// =====================================================
// MUTATIONS
// =====================================================

/** Create a custom flag rule from builder form state. Returns the created rule. */
export async function createCustomRule(
  supabase: SupabaseClient,
  facilityId: string,
  form: CustomRuleFormState
): Promise<DalResult<FlagRule>> {
  // Get next display_order
  const { data: maxOrderRow } = await supabase
    .from('flag_rules')
    .select('display_order')
    .eq('facility_id', facilityId)
    .order('display_order', { ascending: false })
    .limit(1)
    .single()

  const nextOrder = (maxOrderRow?.display_order ?? 0) + 1

  // Resolve category from metrics catalog or default to 'financial'
  const metric = getMetricById(form.metricId)
  const category = metric?.category ?? 'financial'

  // Resolve milestone pair from catalog
  const startMilestone = metric?.startMilestone ?? null
  const endMilestone = metric?.endMilestone ?? null

  return query('flagRules.createCustomRule', async () =>
    await supabase
      .from('flag_rules')
      .insert({
        facility_id: facilityId,
        name: form.name.trim(),
        description: form.description.trim() || null,
        category,
        metric: form.metricId,
        start_milestone: startMilestone,
        end_milestone: endMilestone,
        operator: form.operator,
        threshold_type: form.thresholdType,
        threshold_value: form.thresholdValue,
        threshold_value_max: form.thresholdValueMax,
        comparison_scope: form.comparisonScope,
        severity: form.severity,
        display_order: nextOrder,
        is_built_in: false,
        is_enabled: true,
        is_active: true,
        cost_category_id: form.costCategoryId,
      })
      .select()
      .single()
  )
}

/** Update one or more fields on a flag rule. */
export async function updateRule(
  supabase: SupabaseClient,
  ruleId: string,
  fields: Partial<Pick<FlagRule,
    'is_enabled' | 'severity' | 'threshold_type' | 'threshold_value' |
    'threshold_value_max' | 'operator' | 'comparison_scope' | 'name' | 'description'
  >>
) {
  return mutate('flagRules.updateRule', async () =>
    await supabase
      .from('flag_rules')
      .update(fields)
      .eq('id', ruleId)
  )
}

/** Archive a custom rule (soft delete). Sets is_active = false. */
export async function archiveRule(
  supabase: SupabaseClient,
  ruleId: string
) {
  return mutate('flagRules.archiveRule', async () =>
    await supabase
      .from('flag_rules')
      .update({ is_active: false })
      .eq('id', ruleId)
  )
}

/** Restore an archived rule. Sets is_active = true. */
export async function restoreRule(
  supabase: SupabaseClient,
  ruleId: string
) {
  return mutate('flagRules.restoreRule', async () =>
    await supabase
      .from('flag_rules')
      .update({ is_active: true })
      .eq('id', ruleId)
  )
}

/** Batch archive all flag rules linked to a cost category. */
export async function archiveByCostCategory(
  supabase: SupabaseClient,
  costCategoryId: string
) {
  return mutate('flagRules.archiveByCostCategory', async () =>
    await supabase
      .from('flag_rules')
      .update({ is_active: false })
      .eq('cost_category_id', costCategoryId)
      .eq('is_active', true)
  )
}
