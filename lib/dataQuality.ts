// ============================================
// lib/dataQuality.ts
// ============================================
// Data quality issue detection and resolution utilities
// Add this file to your lib/ directory
// ============================================

import { SupabaseClient } from '@supabase/supabase-js'

// ============================================
// TYPES
// ============================================

export interface IssueType {
  id: string
  name: string
  display_name: string
  description: string | null
  severity: 'info' | 'warning' | 'error'
}

export interface ResolutionType {
  id: string
  name: string
  display_name: string
  description: string | null
}

export interface MetricIssue {
  id: string
  facility_id: string
  case_id: string
  issue_type_id: string
  facility_milestone_id: string | null
  milestone_id: string | null  // <-- ADDED: Links to the specific case_milestone that caused the issue
  detected_value: number | null
  expected_min: number | null
  expected_max: number | null
  details: Record<string, unknown> | null
  resolution_type_id: string | null
  resolved_at: string | null
  resolved_by: string | null
  resolution_notes: string | null
  detected_at: string
  expires_at: string
  created_at: string
  // Joined data - Supabase returns these as arrays when using .select() with joins
  // We normalize them to single objects in the fetch function
  issue_type?: IssueType | null
  resolution_type?: ResolutionType | null
  facility_milestone?: {
    name: string
    display_name: string
  } | null
  cases?: {
    case_number: string
    scheduled_date: string
    start_time?: string | null
    operative_side?: string | null
    procedure_types?: { name: string } | null
    surgeon?: { first_name: string; last_name: string } | null
    or_rooms?: { name: string } | null
    case_milestones?: Array<{
      id: string
      recorded_at: string
      milestone_types?: { name: string; display_name: string } | null
    }>
  } | null
  resolved_by_user?: {
    first_name: string
    last_name: string
  } | null
}

export interface DataQualitySummary {
  totalUnresolved: number
  byType: Record<string, number>
  bySeverity: Record<string, number>
  qualityScore: number
  expiringThisWeek: number
}

// ============================================
// FETCH FUNCTIONS
// ============================================

/**
 * Fetch all issue types (lookup table)
 */
export async function fetchIssueTypes(supabase: SupabaseClient): Promise<IssueType[]> {
  const { data, error } = await supabase
    .from('issue_types')
    .select('*')
    .order('severity')

  if (error) {
    console.error('Error fetching issue types:', error)
    return []
  }
  return data || []
}

/**
 * Fetch all resolution types (lookup table)
 */
export async function fetchResolutionTypes(supabase: SupabaseClient): Promise<ResolutionType[]> {
  const { data, error } = await supabase
    .from('resolution_types')
    .select('*')
    .order('name')

  if (error) {
    console.error('Error fetching resolution types:', error)
    return []
  }
  return data || []
}

/**
 * Fetch metric issues for a facility
 */
export async function fetchMetricIssues(
  supabase: SupabaseClient,
  facilityId: string,
  options?: {
    unresolvedOnly?: boolean
    issueTypeName?: string
    caseId?: string
    limit?: number
  }
): Promise<MetricIssue[]> {
  let query = supabase
    .from('metric_issues')
    .select(`
      *,
      issue_type:issue_types(*),
      resolution_type:resolution_types(*),
      facility_milestone:facility_milestones(name, display_name),
      cases(
        case_number,
        scheduled_date,
        start_time,
        operative_side,
        procedure_types(name),
        surgeon:users!cases_surgeon_id_fkey(first_name, last_name),
        or_rooms(name),
        case_milestones(
          id,
          recorded_at,
          milestone_types(name, display_name)
        )
      ),
      resolved_by_user:users!metric_issues_resolved_by_fkey(first_name, last_name)
    `)
    .eq('facility_id', facilityId)
    .order('detected_at', { ascending: false })

  if (options?.unresolvedOnly) {
    query = query.is('resolved_at', null)
  }

  if (options?.issueTypeName) {
    // Need to filter by issue_type name via subquery
    const { data: issueType } = await supabase
      .from('issue_types')
      .select('id')
      .eq('name', options.issueTypeName)
      .single()
    
    if (issueType) {
      query = query.eq('issue_type_id', issueType.id)
    }
  }

  if (options?.caseId) {
    query = query.eq('case_id', options.caseId)
  }

  if (options?.limit) {
    query = query.limit(options.limit)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching metric issues:', error)
    return []
  }

  // Normalize joined data (Supabase sometimes returns arrays for 1:1 joins)
  const normalizedData = (data || []).map((issue: Record<string, unknown>) => ({
    ...issue,
    issue_type: Array.isArray(issue.issue_type) ? issue.issue_type[0] : issue.issue_type,
    resolution_type: Array.isArray(issue.resolution_type) ? issue.resolution_type[0] : issue.resolution_type,
    facility_milestone: Array.isArray(issue.facility_milestone) ? issue.facility_milestone[0] : issue.facility_milestone,
    cases: Array.isArray(issue.cases) ? issue.cases[0] : issue.cases,
    resolved_by_user: Array.isArray(issue.resolved_by_user) ? issue.resolved_by_user[0] : issue.resolved_by_user,
  })) as MetricIssue[]

  return normalizedData
}

/**
 * Calculate data quality summary for a facility
 */
export async function calculateDataQualitySummary(
  supabase: SupabaseClient,
  facilityId: string
): Promise<DataQualitySummary> {
  // Fetch unresolved issues
  const { data: issues, error } = await supabase
    .from('metric_issues')
    .select(`
      id,
      expires_at,
      issue_type:issue_types(name, severity)
    `)
    .eq('facility_id', facilityId)
    .is('resolved_at', null)

  if (error || !issues) {
    return {
      totalUnresolved: 0,
      byType: {},
      bySeverity: { info: 0, warning: 0, error: 0 },
      qualityScore: 100,
      expiringThisWeek: 0
    }
  }

  const byType: Record<string, number> = {}
  const bySeverity: Record<string, number> = { info: 0, warning: 0, error: 0 }
  const oneWeekFromNow = new Date()
  oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7)
  let expiringThisWeek = 0

  issues.forEach((issue: Record<string, unknown>) => {
    // Normalize issue_type (may come as array)
    const rawIssueType = issue.issue_type
    const issueType = Array.isArray(rawIssueType) ? rawIssueType[0] : rawIssueType
    
    if (issueType && typeof issueType === 'object') {
      const typedIssue = issueType as { name?: string; severity?: string }
      if (typedIssue.name) {
        byType[typedIssue.name] = (byType[typedIssue.name] || 0) + 1
      }
      if (typedIssue.severity && typedIssue.severity in bySeverity) {
        bySeverity[typedIssue.severity] = (bySeverity[typedIssue.severity] || 0) + 1
      }
    }
    
    if (new Date(issue.expires_at as string) < oneWeekFromNow) {
      expiringThisWeek++
    }
  })

  // Calculate quality score (100 - penalty for issues)
  // Errors = 10 points each, Warnings = 3 points, Info = 1 point
  const penalty = (bySeverity.error * 10) + (bySeverity.warning * 3) + (bySeverity.info * 1)
  const qualityScore = Math.max(0, Math.min(100, 100 - penalty))

  return {
    totalUnresolved: issues.length,
    byType,
    bySeverity,
    qualityScore,
    expiringThisWeek
  }
}

// ============================================
// RESOLUTION FUNCTIONS
// ============================================

/**
 * Resolve an issue
 */
export async function resolveIssue(
  supabase: SupabaseClient,
  issueId: string,
  userId: string,
  resolutionTypeName: string,
  notes?: string
): Promise<boolean> {
  // Get resolution type ID
  const { data: resType } = await supabase
    .from('resolution_types')
    .select('id')
    .eq('name', resolutionTypeName)
    .single()

  if (!resType) {
    console.error('Resolution type not found:', resolutionTypeName)
    return false
  }

  const { error } = await supabase
    .from('metric_issues')
    .update({
      resolution_type_id: resType.id,
      resolved_at: new Date().toISOString(),
      resolved_by: userId,
      resolution_notes: notes || null
    })
    .eq('id', issueId)

  if (error) {
    console.error('Error resolving issue:', error)
    return false
  }

  return true
}

/**
 * Bulk resolve multiple issues
 */
export async function resolveMultipleIssues(
  supabase: SupabaseClient,
  issueIds: string[],
  userId: string,
  resolutionTypeName: string,
  notes?: string
): Promise<number> {
  // Get resolution type ID
  const { data: resType } = await supabase
    .from('resolution_types')
    .select('id')
    .eq('name', resolutionTypeName)
    .single()

  if (!resType) {
    console.error('Resolution type not found:', resolutionTypeName)
    return 0
  }

  const { data, error } = await supabase
    .from('metric_issues')
    .update({
      resolution_type_id: resType.id,
      resolved_at: new Date().toISOString(),
      resolved_by: userId,
      resolution_notes: notes || null
    })
    .in('id', issueIds)
    .select('id')

  if (error) {
    console.error('Error resolving issues:', error)
    return 0
  }

  return data?.length || 0
}

/**
 * Reopen a resolved issue
 */
export async function reopenIssue(
  supabase: SupabaseClient,
  issueId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('metric_issues')
    .update({
      resolution_type_id: null,
      resolved_at: null,
      resolved_by: null,
      resolution_notes: null,
      // Reset expiration to 30 days from now
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    })
    .eq('id', issueId)

  if (error) {
    console.error('Error reopening issue:', error)
    return false
  }

  return true
}

// ============================================
// DETECTION FUNCTIONS
// ============================================

/**
 * Run issue detection for a single case
 */
export async function runDetectionForCase(
  supabase: SupabaseClient,
  caseId: string
): Promise<number> {
  const { data, error } = await supabase
    .rpc('run_issue_detection_for_case', { p_case_id: caseId })

  if (error) {
    console.error('Error running detection for case:', error)
    return 0
  }

  return data || 0
}

/**
 * Expire old unresolved issues
 */
export async function expireOldIssues(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase.rpc('expire_old_issues')

  if (error) {
    console.error('Error expiring old issues:', error)
    return 0
  }

  return data || 0
}

/**
 * Run detection for all recent cases in a facility
 */
export async function runDetectionForFacility(
  supabase: SupabaseClient,
  facilityId: string,
  daysBack: number = 7
): Promise<{ casesChecked: number; issuesFound: number }> {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - daysBack)

  // Get cases from the last N days
  const { data: cases, error: casesError } = await supabase
    .from('cases')
    .select('id')
    .eq('facility_id', facilityId)
    .gte('scheduled_date', startDate.toISOString().split('T')[0])

  if (casesError || !cases) {
    console.error('Error fetching cases:', casesError)
    return { casesChecked: 0, issuesFound: 0 }
  }

  let totalIssues = 0
  for (const caseRow of cases) {
    const issueCount = await runDetectionForCase(supabase, caseRow.id)
    totalIssues += issueCount
  }

  return { casesChecked: cases.length, issuesFound: totalIssues }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get severity badge color classes
 */
export function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'error': return 'bg-red-100 text-slate-900 border-red-200'
    case 'warning': return 'bg-amber-100 text-slate-900 border-amber-200'
    case 'info': return 'bg-blue-100 text-slate-900 border-blue-200'
    default: return 'bg-slate-100 text-slate-900 border-slate-200'
  }
}

/**
 * Get issue type icon name (for your icon system)
 */
export function getIssueTypeIcon(typeName: string): string {
  switch (typeName) {
    case 'missing': return 'alert-circle'
    case 'timeout': return 'clock'
    case 'too_fast': return 'zap'
    case 'impossible': return 'x-circle'
    case 'outlier': return 'trending-up'
    case 'stale': return 'archive'
    case 'incomplete': return 'loader'
    default: return 'help-circle'
  }
}

/**
 * Format time ago string
 */
export function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

/**
 * Calculate days until expiration
 */
export function getDaysUntilExpiration(expiresAt: string): number {
  const expires = new Date(expiresAt)
  const now = new Date()
  const diffMs = expires.getTime() - now.getTime()
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
}

/**
 * Format detected value with context
 */
export function formatDetectedValue(
  issue: MetricIssue
): string {
  if (issue.detected_value === null) return 'N/A'
  
  const value = Math.round(issue.detected_value)
  const details = issue.details as Record<string, unknown> | null
  
  // For stale cases, it's days
  if (details?.days_overdue !== undefined) {
    return `${value} day${value !== 1 ? 's' : ''} overdue`
  }
  
  // For incomplete cases, it's hours
  if (details?.hours_since_activity !== undefined) {
    return `${value} hour${value !== 1 ? 's' : ''} since activity`
  }
  
  // For milestone durations, it's minutes
  const min = issue.expected_min !== null ? Math.round(issue.expected_min) : null
  const max = issue.expected_max !== null ? Math.round(issue.expected_max) : null
  
  let rangeStr = ''
  if (min !== null && max !== null) {
    rangeStr = ` (expected ${min}-${max} min)`
  } else if (max !== null) {
    rangeStr = ` (expected ≤${max} min)`
  } else if (min !== null) {
    rangeStr = ` (expected ≥${min} min)`
  }
  
  return `${value} min${rangeStr}`
}