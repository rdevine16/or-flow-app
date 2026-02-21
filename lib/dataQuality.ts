// ============================================
// lib/dataQuality.ts
// ============================================
// Data quality issue detection and resolution utilities
// Includes stale/orphan case detection
// ============================================

import { SupabaseClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'
import { getLocalDateString } from '@/lib/date-utils'

const log = logger('dataQuality')

// ============================================
// METRIC REQUIREMENTS
// ============================================

/** What metrics require which milestones */
export const METRIC_REQUIREMENTS: Record<string, { name: string; requires: string[] }> = {
  case_count: {
    name: 'Case Count',
    requires: [] // Always calculable - just counting the case
  },
  total_case_time: {
    name: 'Total Case Time',
    requires: ['patient_in', 'patient_out']
  },
  fcots: {
    name: 'First Case On-Time Start (FCOTS)',
    requires: ['patient_in']
  },
  surgical_time: {
    name: 'Surgical Time',
    requires: ['incision', 'closing']
  },
  anesthesia_duration: {
    name: 'Anesthesia Duration',
    requires: ['anes_start', 'anes_end']
  },
  pre_incision_time: {
    name: 'Pre-Incision Time',
    requires: ['patient_in', 'incision']
  },
  closing_time: {
    name: 'Closing Duration',
    requires: ['closing', 'closing_complete']
  },
  emergence_time: {
    name: 'Emergence Time',
    requires: ['closing_complete', 'patient_out']
  }
}

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
  milestone_id: string | null
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
      facility_milestone?: { name: string; display_name: string } | null
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

interface StaleCase {
  case_id: string
  case_number: string
  facility_id: string
  issue_type: 'stale_in_progress' | 'abandoned_scheduled' | 'no_activity'
  details: {
    hours_elapsed?: number
    days_overdue?: number
    last_activity?: string
  }
}

interface StaleDetectionResult {
  detected: number
  created: number
  errors: string[]
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
    log.error('Error fetching issue types:', error)
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
    log.error('Error fetching resolution types:', error)
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
          facility_milestone:facility_milestones(name, display_name)
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
    log.error('Error fetching metric issues:', error)
    return []
  }

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
    
    if (issue.expires_at && new Date(issue.expires_at as string) < oneWeekFromNow) {
      expiringThisWeek++
    }
  })

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
  const { data: resType } = await supabase
    .from('resolution_types')
    .select('id')
    .eq('name', resolutionTypeName)
    .single()

  if (!resType) {
    log.error('Resolution type not found:', resolutionTypeName)
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
    log.error('Error resolving issue:', error)
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
  const { data: resType } = await supabase
    .from('resolution_types')
    .select('id')
    .eq('name', resolutionTypeName)
    .single()

  if (!resType) {
    log.error('Resolution type not found:', resolutionTypeName)
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
    log.error('Error resolving issues:', error)
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
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    })
    .eq('id', issueId)

  if (error) {
    log.error('Error reopening issue:', error)
    return false
  }

  return true
}

// ============================================
// DETECTION FUNCTIONS
// ============================================

/**
 * Run issue detection for a single case (calls Postgres function)
 */
export async function runDetectionForCase(
  supabase: SupabaseClient,
  caseId: string
): Promise<number> {
  const { data, error } = await supabase
    .rpc('run_issue_detection_for_case', { p_case_id: caseId })

  if (error) {
    log.error('Error running detection for case:', error)
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
    log.error('Error expiring old issues:', error)
    return 0
  }

  return data || 0
}

/**
 * Run detection for all recent cases in a facility
 * Includes both milestone detection AND stale case detection
 */
export async function runDetectionForFacility(
  supabase: SupabaseClient,
  facilityId: string,
  daysBack: number = 7
): Promise<{ casesChecked: number; issuesFound: number; staleCasesFound: number }> {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - daysBack)

  // Get cases from the last N days
  const { data: cases, error: casesError } = await supabase
    .from('cases')
    .select('id')
    .eq('facility_id', facilityId)
    .gte('scheduled_date', getLocalDateString(startDate))

  if (casesError || !cases) {
    log.error('Error fetching cases:', casesError)
    return { casesChecked: 0, issuesFound: 0, staleCasesFound: 0 }
  }

  // Run milestone detection for each case
  let totalIssues = 0
  for (const caseRow of cases) {
    const issueCount = await runDetectionForCase(supabase, caseRow.id)
    totalIssues += issueCount
  }

  // Run stale case detection
  const staleResult = await detectStaleCases(supabase, facilityId)
  log.info(`Stale cases: ${staleResult.detected} found, ${staleResult.created} created`)

  return { 
    casesChecked: cases.length, 
    issuesFound: totalIssues + staleResult.created,
    staleCasesFound: staleResult.created
  }
}

// ============================================
// STALE CASE DETECTION
// ============================================

/**
 * Detect all types of stale/orphaned cases for a facility
 */
export async function detectStaleCases(
  supabase: SupabaseClient,
  facilityId: string
): Promise<StaleDetectionResult> {
  const results: StaleDetectionResult = { detected: 0, created: 0, errors: [] }
  
  // Get issue type IDs for stale cases
  const { data: issueTypes } = await supabase
    .from('issue_types')
    .select('id, name')
    .in('name', ['stale_in_progress', 'abandoned_scheduled', 'no_activity'])
  
  const issueTypeMap = new Map(issueTypes?.map(it => [it.name, it.id]) || [])
  
  // If issue types don't exist yet, skip stale detection
  if (issueTypeMap.size === 0) {
    log.info('Stale case issue types not found in database - skipping stale detection')
    return results
  }
  
  // Run all detections
  const staleCases: StaleCase[] = []
  
  // 1. Stale In-Progress (over 24 hours)
  const staleInProgress = await detectStaleInProgress(supabase, facilityId)
  staleCases.push(...staleInProgress)
  
  // 2. Abandoned Scheduled (2+ days past scheduled date)
  const abandoned = await detectAbandonedScheduled(supabase, facilityId)
  staleCases.push(...abandoned)
  
  // 3. No Activity (4+ hours since last milestone)
  const noActivity = await detectNoActivity(supabase, facilityId)
  staleCases.push(...noActivity)
  
  results.detected = staleCases.length
  
  // Create issues for each stale case
  for (const staleCase of staleCases) {
    const issueTypeId = issueTypeMap.get(staleCase.issue_type)
    if (!issueTypeId) {
      results.errors.push(`Unknown issue type: ${staleCase.issue_type}`)
      continue
    }
    
    // Check if issue already exists
    const { data: existing } = await supabase
      .from('metric_issues')
      .select('id')
      .eq('case_id', staleCase.case_id)
      .eq('issue_type_id', issueTypeId)
      .is('resolved_at', null)
      .maybeSingle()
    
    if (existing) continue // Skip if already flagged
    
    // Create the issue
    const { error } = await supabase
      .from('metric_issues')
      .insert({
        case_id: staleCase.case_id,
        facility_id: staleCase.facility_id,
        issue_type_id: issueTypeId,
        facility_milestone_id: null, // Stale cases aren't milestone-specific
        detected_value: JSON.stringify(staleCase.details),
        detected_at: new Date().toISOString(),
        expires_at: null // Stale cases don't auto-expire
      })
    
    if (error) {
      results.errors.push(`Failed to create issue for ${staleCase.case_number}: ${error.message}`)
    } else {
      results.created++
      
      // Invalidate case data
      await supabase
        .from('cases')
        .update({ data_validated: false })
        .eq('id', staleCase.case_id)
    }
  }
  
  return results
}

/**
 * Find cases that have been "in_progress" for over 24 hours
 */
async function detectStaleInProgress(
  supabase: SupabaseClient,
  facilityId: string
): Promise<StaleCase[]> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  
  // Get in_progress status ID
  const { data: statusData } = await supabase
    .from('case_statuses')
    .select('id')
    .eq('name', 'in_progress')
    .single()
  
  if (!statusData) return []
  
  // Find Patient In milestone for this facility
  const { data: patientInMilestone } = await supabase
    .from('facility_milestones')
    .select('id')
    .eq('facility_id', facilityId)
    .eq('name', 'patient_in')
    .single()
  
  if (!patientInMilestone) return []
  
  // Find stale cases
  const { data: cases } = await supabase
    .from('cases')
    .select(`
      id,
      case_number,
      facility_id,
      case_milestones!inner(recorded_at, facility_milestone_id)
    `)
    .eq('facility_id', facilityId)
    .eq('status_id', statusData.id)
    .eq('case_milestones.facility_milestone_id', patientInMilestone.id)
    .lt('case_milestones.recorded_at', twentyFourHoursAgo)
  
  return (cases || []).map(c => {
    const patientInTime = Array.isArray(c.case_milestones)
      ? c.case_milestones[0]?.recorded_at
      : (c.case_milestones as { recorded_at?: string })?.recorded_at
    
    const hoursElapsed = patientInTime 
      ? (Date.now() - new Date(patientInTime).getTime()) / (1000 * 60 * 60)
      : 0
    
    return {
      case_id: c.id,
      case_number: c.case_number,
      facility_id: c.facility_id,
      issue_type: 'stale_in_progress' as const,
      details: { hours_elapsed: Math.round(hoursElapsed * 10) / 10 }
    }
  })
}

/**
 * Find scheduled cases that are 2+ days past their scheduled date
 */
async function detectAbandonedScheduled(
  supabase: SupabaseClient,
  facilityId: string
): Promise<StaleCase[]> {
  const twoDaysAgo = getLocalDateString(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000))
  
  // Get scheduled status ID
  const { data: statusData } = await supabase
    .from('case_statuses')
    .select('id')
    .eq('name', 'scheduled')
    .single()
  
  if (!statusData) return []
  
  const { data: cases } = await supabase
    .from('cases')
    .select('id, case_number, facility_id, scheduled_date')
    .eq('facility_id', facilityId)
    .eq('status_id', statusData.id)
    .lt('scheduled_date', twoDaysAgo)
  
  return (cases || []).map(c => {
    const scheduledDate = new Date(c.scheduled_date)
    const daysOverdue = Math.floor((Date.now() - scheduledDate.getTime()) / (1000 * 60 * 60 * 24))
    
    return {
      case_id: c.id,
      case_number: c.case_number,
      facility_id: c.facility_id,
      issue_type: 'abandoned_scheduled' as const,
      details: { days_overdue: daysOverdue }
    }
  })
}

/**
 * Find in-progress cases with no milestone activity for 4+ hours
 */
async function detectNoActivity(
  supabase: SupabaseClient,
  facilityId: string
): Promise<StaleCase[]> {
  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
  
  // Get in_progress status ID
  const { data: statusData } = await supabase
    .from('case_statuses')
    .select('id')
    .eq('name', 'in_progress')
    .single()
  
  if (!statusData) return []
  
  // Get all in-progress cases
  const { data: cases } = await supabase
    .from('cases')
    .select(`
      id,
      case_number,
      facility_id,
      case_milestones(recorded_at)
    `)
    .eq('facility_id', facilityId)
    .eq('status_id', statusData.id)
  
  const staleCases: StaleCase[] = []
  
  for (const c of cases || []) {
    const milestones = Array.isArray(c.case_milestones) ? c.case_milestones : []
    const recordedMilestones = milestones.filter((m: { recorded_at: string | null }) => m.recorded_at)
    
    if (recordedMilestones.length === 0) continue // Skip if no milestones at all
    
    // Find most recent activity
    const lastActivity = recordedMilestones.reduce((latest: string | null, m: { recorded_at: string | null }) => {
      if (!latest || (m.recorded_at && m.recorded_at > latest)) return m.recorded_at
      return latest
    }, null)
    
    if (lastActivity && lastActivity < fourHoursAgo) {
      const hoursSinceActivity = (Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60)
      
      staleCases.push({
        case_id: c.id,
        case_number: c.case_number,
        facility_id: c.facility_id,
        issue_type: 'no_activity',
        details: { 
          hours_elapsed: Math.round(hoursSinceActivity * 10) / 10,
          last_activity: lastActivity 
        }
      })
    }
  }
  
  return staleCases
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
 * Get issue type icon name
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
    case 'stale_in_progress': return 'clock'
    case 'abandoned_scheduled': return 'calendar-x'
    case 'no_activity': return 'pause-circle'
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
export function formatDetectedValue(issue: MetricIssue): string {
  if (issue.detected_value === null) return 'N/A'
  
  const value = Math.round(issue.detected_value)
  const details = issue.details as Record<string, unknown> | null
  
  if (details?.days_overdue !== undefined) {
    return `${value} day${value !== 1 ? 's' : ''} overdue`
  }
  
  if (details?.hours_since_activity !== undefined) {
    return `${value} hour${value !== 1 ? 's' : ''} since activity`
  }
  
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