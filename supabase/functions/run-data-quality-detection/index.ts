// Supabase Edge Function: run-data-quality-detection
// Runs nightly to detect data quality issues across all facilities
// 
// Deploy with: supabase functions deploy run-data-quality-detection
// 
// Set up cron trigger in Supabase Dashboard:
// - Go to Database → Extensions → Enable pg_cron if not already
// - Go to SQL Editor and run the cron setup SQL below

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Issue type names
const ISSUE_TYPES = {
  MISSING: 'missing',
  IMPOSSIBLE: 'impossible_value',
  NEGATIVE: 'negative_duration',
  OUT_OF_SEQUENCE: 'out_of_sequence',
  STALE: 'stale_case',
  INCOMPLETE: 'incomplete_case'
}

interface DetectionResult {
  facilityId: string
  facilityName: string
  casesChecked: number
  issuesFound: number
  expiredCount: number
}

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
          milestones.forEach((m: any) => {
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
        
        results.push({
          facilityId: facility.id,
          facilityName: facility.name,
          casesChecked: cases?.length || 0,
          issuesFound,
          expiredCount
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
    
    console.log(`\nNightly detection complete:`)
    console.log(`- Facilities processed: ${results.length}`)
    console.log(`- Total cases checked: ${totalCases}`)
    console.log(`- Total issues found: ${totalIssues}`)
    console.log(`- Total issues expired: ${totalExpired}`)
    
    // Optionally: Send notification if issues were found
    // await sendNotificationIfNeeded(supabase, results)
    
    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          facilitiesProcessed: results.length,
          totalCasesChecked: totalCases,
          totalIssuesFound: totalIssues,
          totalIssuesExpired: totalExpired
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

// Helper functions

function normalizeJoin<T>(data: T | T[] | null): T | null {
  if (Array.isArray(data)) return data[0] || null
  return data
}

async function getIssueTypeIds(supabase: any): Promise<Record<string, string>> {
  const { data } = await supabase
    .from('issue_types')
    .select('id, name')
  
  const map: Record<string, string> = {}
  data?.forEach((t: any) => {
    map[t.name] = t.id
  })
  return map
}

async function getResolutionTypeId(supabase: any, name: string): Promise<string | null> {
  const { data } = await supabase
    .from('resolution_types')
    .select('id')
    .eq('name', name)
    .single()
  
  return data?.id || null
}

async function getFacilityMilestoneId(supabase: any, facilityId: string, milestoneName: string): Promise<string | null> {
  const { data } = await supabase
    .from('facility_milestones')
    .select('id')
    .eq('facility_id', facilityId)
    .eq('name', milestoneName)
    .single()
  
  return data?.id || null
}

async function createIssueIfNotExists(supabase: any, params: {
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