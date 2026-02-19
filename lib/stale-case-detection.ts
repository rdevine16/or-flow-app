// ============================================
// STALE CASE DETECTION
// ============================================
// Add this to your existing detection scan or
// run as a separate scheduled job
// ============================================

import { SupabaseClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'
import { getLocalDateString } from '@/lib/date-utils'

const log = logger('stale-case-detection')

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

interface DetectionResult {
  detected: number
  created: number
  errors: string[]
}

/**
 * Detect all types of stale/orphaned cases for a facility
 */
export async function detectStaleCases(
  supabase: SupabaseClient,
  facilityId: string
): Promise<DetectionResult> {
  const results: DetectionResult = { detected: 0, created: 0, errors: [] }
  
  // Get issue type IDs
  const { data: issueTypes } = await supabase
    .from('issue_types')
    .select('id, name')
    .in('name', ['stale_in_progress', 'abandoned_scheduled', 'no_activity'])
  
  const issueTypeMap = new Map(issueTypes?.map(it => [it.name, it.id]) || [])
  
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
      .single()
    
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

/**
 * Run stale detection for all facilities (for scheduled job)
 */
export async function detectStaleCasesAllFacilities(
  supabase: SupabaseClient
): Promise<Map<string, DetectionResult>> {
  const results = new Map<string, DetectionResult>()
  
  const { data: facilities } = await supabase
    .from('facilities')
    .select('id, name')
  
  for (const facility of facilities || []) {
    const result = await detectStaleCases(supabase, facility.id)
    results.set(facility.id, result)
    log.info(`Stale detection for ${facility.name}: ${result.detected} found, ${result.created} created`)
  }
  
  return results
}