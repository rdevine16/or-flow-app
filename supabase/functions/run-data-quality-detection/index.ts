// Supabase Edge Function: run-data-quality-detection
// Runs nightly to detect data quality issues across all facilities
// 
// Deploy with: supabase functions deploy run-data-quality-detection
// 
// Set up cron trigger in Supabase Dashboard:
// - Go to Database → Extensions → Enable pg_cron if not already
// - Go to SQL Editor and run the cron setup SQL below

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ============================================
// ISSUE TYPE NAMES
// ============================================

const ISSUE_TYPES = {
  MISSING: 'missing',
  IMPOSSIBLE: 'impossible_value',
  NEGATIVE: 'negative_duration',
  OUT_OF_SEQUENCE: 'out_of_sequence',
  STALE: 'stale_case',
  INCOMPLETE: 'incomplete_case',
  // Stale case types
  STALE_IN_PROGRESS: 'stale_in_progress',
  ABANDONED_SCHEDULED: 'abandoned_scheduled',
  NO_ACTIVITY: 'no_activity'
}

// ============================================
// INTERFACES
// ============================================

interface DetectionResult {
  facilityId: string
  facilityName: string
  casesChecked: number
  issuesFound: number
  expiredCount: number
  // Stale case counts
  staleCasesDetected: number
  staleCasesCreated: number
  staleErrors: string[]
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
// MAIN HANDLER
// ============================================

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client with service role (bypasses RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    console.log('Starting nightly data quality detection...')
    
    // Get all active facilities
    const { data: facilities, error: facilitiesError } = await supabase
      .from('facilities')
      .select('id, name')
    
    if (facilitiesError) {
      throw new Error(`Failed to fetch facilities: ${facilitiesError.message}`)
    }
    
    const results: DetectionResult[] = []
    
    for (const facility of facilities || []) {
      console.log(`Processing facility: ${facility.name}`)
      
      try {
        // 1. Expire old issues (older than 30 days)
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        
        const { data: expiredData } = await supabase
          .from('metric_issues')
          .update({
            resolved_at: new Date().toISOString(),
            resolution_type_id: await getResolutionTypeId(supabase, 'expired'),
            resolution_notes: 'Auto-expired after 30 days'
          })
          .eq('facility_id', facility.id)
          .is('resolved_at', null)
          .lt('expires_at', new Date().toISOString())
          .select('id')
        
        const expiredCount = expiredData?.length || 0
        
        // 2. Get recent cases (last 7 days)
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
        
        const { data: cases, error: casesError } = await supabase
          .from('cases')
          .select(`
            id,
            case_number,
            scheduled_date,
            start_time,
            status_id,
            case_statuses(name),
            case_milestones(
              id,
              recorded_at,
              facility_milestone_id,
              facility_milestones(id, name, display_name, min_minutes, max_minutes, display_order)
            )
          `)
          .eq('facility_id', facility.id)
          .gte('scheduled_date', sevenDaysAgo.toISOString().split('T')[0])
          .order('scheduled_date', { ascending: false })
        
        if (casesError) {
          console.error(`Error fetching cases for ${facility.name}:`, casesError)
          continue
        }
        
        let issuesFound = 0
        
        // Get issue types
        const issueTypeIds = await getIssueTypeIds(supabase)
        
        // 3. Check each case for issues
        for (const caseData of cases || []) {
          const milestones = caseData.case_milestones || []
          const statusName = normalizeJoin(caseData.case_statuses)?.name
          
          // Skip cancelled cases
          if (statusName === 'cancelled') continue
          
          // Build milestone map
          const milestoneMap = new Map<string, { recorded_at: string; facility_milestone_id: string }>()
          milestones.forEach((m: Record<string, unknown>) => {
            const fm = normalizeJoin(m.facility_milestones)
            if (fm?.name) {
              milestoneMap.set(fm.name, {
                recorded_at: m.recorded_at,
                facility_milestone_id: m.facility_milestone_id
              })
            }
          })
          
          // Check for missing required milestones (for completed cases)
          if (statusName === 'completed') {
            const requiredMilestones = ['patient_in', 'incision', 'closing', 'patient_out']
            for (const required of requiredMilestones) {
              if (!milestoneMap.has(required)) {
                const created = await createIssueIfNotExists(supabase, {
                  facilityId: facility.id,
                  caseId: caseData.id,
                  issueTypeId: issueTypeIds[ISSUE_TYPES.MISSING],
                  facilityMilestoneId: await getFacilityMilestoneId(supabase, facility.id, required),
                  detectedValue: null,
                  expectedMin: null,
                  expectedMax: null
                })
                if (created) issuesFound++
              }
            }
          }
          
          // Check for negative durations
          const checkPairs = [
            ['patient_in', 'patient_out'],
            ['anes_start', 'anes_end'],
            ['incision', 'closing'],
            ['closing', 'closing_complete']
          ]
          
          for (const [start, end] of checkPairs) {
            const startData = milestoneMap.get(start)
            const endData = milestoneMap.get(end)
            
            if (startData && endData) {
              const startTime = new Date(startData.recorded_at).getTime()
              const endTime = new Date(endData.recorded_at).getTime()
              const durationMin = (endTime - startTime) / 60000
              
              if (durationMin < 0) {
                const created = await createIssueIfNotExists(supabase, {
                  facilityId: facility.id,
                  caseId: caseData.id,
                  issueTypeId: issueTypeIds[ISSUE_TYPES.NEGATIVE],
                  facilityMilestoneId: endData.facility_milestone_id,
                  detectedValue: durationMin,
                  expectedMin: 0,
                  expectedMax: null
                })
                if (created) issuesFound++
              }
            }
          }
          
          // Check for impossible values (e.g., > 24 hours)
          const patientIn = milestoneMap.get('patient_in')
          const patientOut = milestoneMap.get('patient_out')
          
          if (patientIn && patientOut) {
            const totalMin = (new Date(patientOut.recorded_at).getTime() - new Date(patientIn.recorded_at).getTime()) / 60000
            
            if (totalMin > 1440) { // > 24 hours
              const created = await createIssueIfNotExists(supabase, {
                facilityId: facility.id,
                caseId: caseData.id,
                issueTypeId: issueTypeIds[ISSUE_TYPES.IMPOSSIBLE],
                facilityMilestoneId: patientOut.facility_milestone_id,
                detectedValue: totalMin,
                expectedMin: null,
                expectedMax: 1440
              })
              if (created) issuesFound++
            }
          }
        }
        
        // ============================================
        // 4. STALE CASE DETECTION
        // ============================================
        const staleResults = await detectStaleCases(supabase, facility.id)
        console.log(`Stale cases for ${facility.name}: ${staleResults.detected} found, ${staleResults.created} created`)
        
        if (staleResults.errors.length > 0) {
          console.error(`Stale detection errors for ${facility.name}:`, staleResults.errors)
        }
        
        results.push({
          facilityId: facility.id,
          facilityName: facility.name,
          casesChecked: cases?.length || 0,
          issuesFound,
          expiredCount,
          staleCasesDetected: staleResults.detected,
          staleCasesCreated: staleResults.created,
          staleErrors: staleResults.errors
        })
        
        console.log(`Facility ${facility.name}: ${cases?.length || 0} cases, ${issuesFound} issues found, ${expiredCount} expired`)
        
      } catch (facilityError) {
        console.error(`Error processing facility ${facility.name}:`, facilityError)
      }
    }
    
    // Log summary
    const totalIssues = results.reduce((sum, r) => sum + r.issuesFound, 0)
    const totalCases = results.reduce((sum, r) => sum + r.casesChecked, 0)
    const totalExpired = results.reduce((sum, r) => sum + r.expiredCount, 0)
    const totalStaleDetected = results.reduce((sum, r) => sum + r.staleCasesDetected, 0)
    const totalStaleCreated = results.reduce((sum, r) => sum + r.staleCasesCreated, 0)
    
    console.log(`\nNightly detection complete:`)
    console.log(`- Facilities processed: ${results.length}`)
    console.log(`- Total cases checked: ${totalCases}`)
    console.log(`- Total issues found: ${totalIssues}`)
    console.log(`- Total issues expired: ${totalExpired}`)
    console.log(`- Total stale cases detected: ${totalStaleDetected}`)
    console.log(`- Total stale issues created: ${totalStaleCreated}`)
    
    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          facilitiesProcessed: results.length,
          totalCasesChecked: totalCases,
          totalIssuesFound: totalIssues,
          totalIssuesExpired: totalExpired,
          totalStaleCasesDetected: totalStaleDetected,
          totalStaleCasesCreated: totalStaleCreated
        },
        results
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
    
  } catch (error) {
    console.error('Error in nightly detection:', error)
    
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})

// ============================================
// ORIGINAL HELPER FUNCTIONS
// ============================================

function normalizeJoin<T>(data: T | T[] | null): T | null {
  if (Array.isArray(data)) return data[0] || null
  return data
}

async function getIssueTypeIds(supabase: SupabaseClient): Promise<Record<string, string>> {
  const { data } = await supabase
    .from('issue_types')
    .select('id, name')
  
  const map: Record<string, string> = {}
  data?.forEach((t: Record<string, unknown>) => {
    if (typeof t.name === 'string' && typeof t.id === 'string') {
      map[t.name] = t.id
    }
  })
  return map
}

async function getResolutionTypeId(supabase: SupabaseClient, name: string): Promise<string | null> {
  const { data } = await supabase
    .from('resolution_types')
    .select('id')
    .eq('name', name)
    .single()
  
  return data?.id || null
}

async function getFacilityMilestoneId(supabase: SupabaseClient, facilityId: string, milestoneName: string): Promise<string | null> {
  const { data } = await supabase
    .from('facility_milestones')
    .select('id')
    .eq('facility_id', facilityId)
    .eq('name', milestoneName)
    .single()
  
  return data?.id || null
}

async function createIssueIfNotExists(supabase: SupabaseClient, params: {
  facilityId: string
  caseId: string
  issueTypeId: string
  facilityMilestoneId: string | null
  detectedValue: number | null
  expectedMin: number | null
  expectedMax: number | null
}): Promise<boolean> {
  // Check if issue already exists (not resolved)
  const { data: existing } = await supabase
    .from('metric_issues')
    .select('id')
    .eq('case_id', params.caseId)
    .eq('issue_type_id', params.issueTypeId)
    .eq('facility_milestone_id', params.facilityMilestoneId)
    .is('resolved_at', null)
    .single()
  
  if (existing) {
    return false // Already exists
  }
  
  // Create expiration date (30 days from now)
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 30)
  
  const { error } = await supabase
    .from('metric_issues')
    .insert({
      facility_id: params.facilityId,
      case_id: params.caseId,
      issue_type_id: params.issueTypeId,
      facility_milestone_id: params.facilityMilestoneId,
      detected_value: params.detectedValue,
      expected_min: params.expectedMin,
      expected_max: params.expectedMax,
      detected_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString()
    })
  
  return !error
}

// ============================================
// STALE CASE DETECTION FUNCTIONS
// ============================================

/**
 * Detect all types of stale/orphaned cases for a facility
 */
async function detectStaleCases(
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
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  
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
    const recordedMilestones = milestones.filter((m: { recorded_at?: string }) => m.recorded_at)

    if (recordedMilestones.length === 0) continue // Skip if no milestones at all

    // Find most recent activity
    const lastActivity = recordedMilestones.reduce((latest: string | null, m: { recorded_at?: string }) => {
      if (!latest || m.recorded_at > latest) return m.recorded_at
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