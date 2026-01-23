// ============================================
// DATA VALIDATION UTILITIES
// ============================================
// Use these functions when:
// 1. Detection finds issues → invalidateCase()
// 2. User resolves issues → validateCase()
// ============================================

import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Marks a case as NOT validated when issues are detected.
 * Call this from your detection logic after inserting issues.
 */
export async function invalidateCaseData(
  supabase: SupabaseClient,
  caseId: string
): Promise<void> {
  await supabase
    .from('cases')
    .update({
      data_validated: false,
      validated_at: null,
      validated_by: null
    })
    .eq('id', caseId)
}

/**
 * Marks a case as validated after issues are resolved.
 * Call this from Data Quality page after resolution.
 */
export async function validateCaseData(
  supabase: SupabaseClient,
  caseId: string,
  userId: string
): Promise<void> {
  await supabase
    .from('cases')
    .update({
      data_validated: true,
      validated_at: new Date().toISOString(),
      validated_by: userId
    })
    .eq('id', caseId)
}

/**
 * Auto-validate a case if it has no issues.
 * Call this after detection completes.
 */
export async function autoValidateIfClean(
  supabase: SupabaseClient,
  caseId: string
): Promise<boolean> {
  // Check if case has any unresolved issues
  const { count } = await supabase
    .from('metric_issues')
    .select('*', { count: 'exact', head: true })
    .eq('case_id', caseId)
    .is('resolved_at', null)
  
  if (count === 0) {
    // No issues - auto-validate
    await supabase
      .from('cases')
      .update({
        data_validated: true,
        validated_at: new Date().toISOString(),
        validated_by: null  // System auto-validation
      })
      .eq('id', caseId)
    return true
  } else {
    // Has issues - invalidate
    await invalidateCaseData(supabase, caseId)
    return false
  }
}

/**
 * Bulk invalidate cases when detection finds issues.
 * More efficient for batch operations.
 */
export async function invalidateMultipleCases(
  supabase: SupabaseClient,
  caseIds: string[]
): Promise<void> {
  if (caseIds.length === 0) return
  
  await supabase
    .from('cases')
    .update({
      data_validated: false,
      validated_at: null,
      validated_by: null
    })
    .in('id', caseIds)
}