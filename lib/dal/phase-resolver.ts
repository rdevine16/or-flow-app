/**
 * Phase Resolver — Template-Based Phase Boundary Resolution
 *
 * Replaces direct `phase_definitions` queries with template-based resolution.
 * Calls the `resolve_template_phase_boundaries` SQL function via RPC
 * and reshapes the flat result into `PhaseDefinitionWithMilestones[]`.
 *
 * Exported functions:
 *   - resolvePhaseDefsFromTemplate(supabase, templateId)
 *   - resolveDefaultPhaseDefsForFacility(supabase, facilityId)
 *   - resolveTemplateForCase(supabase, caseInfo)
 *   - batchResolveTemplatesForCases(supabase, cases, facilityId)
 */

import type { AnySupabaseClient } from './index'
import type { PhaseDefinitionWithMilestones } from '@/lib/utils/milestoneAnalytics'

// ============================================
// TYPES
// ============================================

/** Row returned by the resolve_template_phase_boundaries SQL function */
interface PhaseResolverRow {
  phase_id: string
  phase_name: string
  phase_display_name: string
  color_key: string | null
  display_order: number
  parent_phase_id: string | null
  start_milestone_id: string
  start_milestone_name: string
  start_milestone_display_name: string | null
  start_milestone_display_order: number
  end_milestone_id: string
  end_milestone_name: string
  end_milestone_display_name: string | null
  end_milestone_display_order: number
}

/** Minimal case info needed to resolve a template via cascade */
export interface CaseTemplateInfo {
  milestone_template_id?: string | null
  surgeon_id?: string | null
  procedure_type_id?: string | null
  facility_id: string
}

// ============================================
// CORE RESOLVER
// ============================================

/**
 * Resolve phase boundaries from a milestone template.
 * Calls the `resolve_template_phase_boundaries` SQL function and reshapes
 * the flat result into `PhaseDefinitionWithMilestones[]`.
 *
 * Returns empty array if templateId is null/undefined or the function returns no rows.
 */
export async function resolvePhaseDefsFromTemplate(
  supabase: AnySupabaseClient,
  templateId: string | null | undefined,
): Promise<PhaseDefinitionWithMilestones[]> {
  if (!templateId) return []

  const { data, error } = await supabase.rpc('resolve_template_phase_boundaries', {
    p_template_id: templateId,
  })

  if (error) {
    throw new Error(`resolve_template_phase_boundaries failed: ${error.message}`)
  }

  const rows = (data ?? []) as PhaseResolverRow[]

  return rows.map((row) => ({
    id: row.phase_id,
    name: row.phase_name,
    display_name: row.phase_display_name,
    display_order: row.display_order,
    color_key: row.color_key,
    parent_phase_id: row.parent_phase_id,
    start_milestone_id: row.start_milestone_id,
    end_milestone_id: row.end_milestone_id,
    start_milestone: {
      id: row.start_milestone_id,
      name: row.start_milestone_name,
      display_name: row.start_milestone_display_name,
      display_order: row.start_milestone_display_order,
    },
    end_milestone: {
      id: row.end_milestone_id,
      name: row.end_milestone_name,
      display_name: row.end_milestone_display_name,
      display_order: row.end_milestone_display_order,
    },
  }))
}

// ============================================
// CONVENIENCE: FACILITY DEFAULT
// ============================================

/**
 * Resolve phase boundaries using the facility's default milestone template.
 * Returns empty array if no default template is found.
 */
export async function resolveDefaultPhaseDefsForFacility(
  supabase: AnySupabaseClient,
  facilityId: string,
): Promise<PhaseDefinitionWithMilestones[]> {
  const { data: defaultTemplate } = await supabase
    .from('milestone_templates')
    .select('id')
    .eq('facility_id', facilityId)
    .eq('is_default', true)
    .eq('is_active', true)
    .single()

  if (!defaultTemplate?.id) return []

  return resolvePhaseDefsFromTemplate(supabase, defaultTemplate.id)
}

// ============================================
// TEMPLATE CASCADE RESOLUTION
// ============================================

/**
 * Resolve the milestone template ID for a single case via cascade:
 *   1. case.milestone_template_id (if set)
 *   2. surgeon_template_overrides (surgeon + procedure_type)
 *   3. procedure_types.milestone_template_id
 *   4. facility default milestone_template
 */
export async function resolveTemplateForCase(
  supabase: AnySupabaseClient,
  caseInfo: CaseTemplateInfo,
): Promise<string | null> {
  // 1. Case snapshot
  if (caseInfo.milestone_template_id) {
    return caseInfo.milestone_template_id
  }

  // 2. Surgeon override
  if (caseInfo.surgeon_id && caseInfo.procedure_type_id) {
    const { data: override } = await supabase
      .from('surgeon_template_overrides')
      .select('milestone_template_id')
      .eq('surgeon_id', caseInfo.surgeon_id)
      .eq('procedure_type_id', caseInfo.procedure_type_id)
      .single()

    if (override?.milestone_template_id) return override.milestone_template_id
  }

  // 3. Procedure type template
  if (caseInfo.procedure_type_id) {
    const { data: procType } = await supabase
      .from('procedure_types')
      .select('milestone_template_id')
      .eq('id', caseInfo.procedure_type_id)
      .single()

    if (procType?.milestone_template_id) return procType.milestone_template_id
  }

  // 4. Facility default
  const { data: defaultTemplate } = await supabase
    .from('milestone_templates')
    .select('id')
    .eq('facility_id', caseInfo.facility_id)
    .eq('is_default', true)
    .eq('is_active', true)
    .single()

  return defaultTemplate?.id ?? null
}

// ============================================
// BATCH RESOLUTION (for multi-case pages)
// ============================================

/** Cascade data pre-fetched in batch for efficient per-case resolution */
interface CascadeData {
  surgeonOverrides: Map<string, string> // "surgeonId:procedureTypeId" → templateId
  procedureTemplates: Map<string, string> // procedureTypeId → templateId
  facilityDefaultTemplateId: string | null
}

/**
 * Batch-resolve template IDs for multiple cases.
 * Pre-fetches cascade data in 3 queries, then resolves per case in memory.
 *
 * Returns a Map<caseId, templateId>. Cases that resolve to no template
 * will have a null value.
 *
 * The `cases` parameter must include: id, milestone_template_id, surgeon_id,
 * procedure_type_id (procedure_types.id).
 */
export async function batchResolveTemplatesForCases(
  supabase: AnySupabaseClient,
  cases: Array<{
    id: string
    milestone_template_id?: string | null
    surgeon_id?: string | null
    procedure_type_id?: string | null
  }>,
  facilityId: string,
): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>()

  // Short-circuit: all cases already have a template_id
  const needsCascade = cases.filter((c) => !c.milestone_template_id)
  if (needsCascade.length === 0) {
    for (const c of cases) {
      result.set(c.id, c.milestone_template_id ?? null)
    }
    return result
  }

  // Collect unique surgeon_ids and procedure_type_ids that need cascade
  const surgeonIds = [...new Set(needsCascade.map((c) => c.surgeon_id).filter(Boolean))] as string[]
  const procedureTypeIds = [...new Set(needsCascade.map((c) => c.procedure_type_id).filter(Boolean))] as string[]

  // Batch-fetch cascade data (3 parallel queries)
  const [overridesRes, procTypesRes, defaultRes] = await Promise.all([
    // Surgeon overrides
    surgeonIds.length > 0 && procedureTypeIds.length > 0
      ? supabase
          .from('surgeon_template_overrides')
          .select('surgeon_id, procedure_type_id, milestone_template_id')
          .in('surgeon_id', surgeonIds)
          .in('procedure_type_id', procedureTypeIds)
      : Promise.resolve({ data: [] as Array<{ surgeon_id: string; procedure_type_id: string; milestone_template_id: string }> }),

    // Procedure type templates
    procedureTypeIds.length > 0
      ? supabase
          .from('procedure_types')
          .select('id, milestone_template_id')
          .in('id', procedureTypeIds)
      : Promise.resolve({ data: [] as Array<{ id: string; milestone_template_id: string | null }> }),

    // Facility default template
    supabase
      .from('milestone_templates')
      .select('id')
      .eq('facility_id', facilityId)
      .eq('is_default', true)
      .eq('is_active', true)
      .single(),
  ])

  const cascade: CascadeData = {
    surgeonOverrides: new Map(),
    procedureTemplates: new Map(),
    facilityDefaultTemplateId: defaultRes.data?.id ?? null,
  }

  for (const row of (overridesRes.data ?? []) as Array<{ surgeon_id: string; procedure_type_id: string; milestone_template_id: string }>) {
    cascade.surgeonOverrides.set(`${row.surgeon_id}:${row.procedure_type_id}`, row.milestone_template_id)
  }

  for (const row of (procTypesRes.data ?? []) as Array<{ id: string; milestone_template_id: string | null }>) {
    if (row.milestone_template_id) {
      cascade.procedureTemplates.set(row.id, row.milestone_template_id)
    }
  }

  // Resolve per case
  for (const c of cases) {
    if (c.milestone_template_id) {
      result.set(c.id, c.milestone_template_id)
      continue
    }

    // Surgeon override
    if (c.surgeon_id && c.procedure_type_id) {
      const overrideKey = `${c.surgeon_id}:${c.procedure_type_id}`
      const overrideTemplate = cascade.surgeonOverrides.get(overrideKey)
      if (overrideTemplate) {
        result.set(c.id, overrideTemplate)
        continue
      }
    }

    // Procedure type template
    if (c.procedure_type_id) {
      const procTemplate = cascade.procedureTemplates.get(c.procedure_type_id)
      if (procTemplate) {
        result.set(c.id, procTemplate)
        continue
      }
    }

    // Facility default
    result.set(c.id, cascade.facilityDefaultTemplateId)
  }

  return result
}
