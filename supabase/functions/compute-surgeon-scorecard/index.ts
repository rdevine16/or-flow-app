// Supabase Edge Function: compute-surgeon-scorecard
// Computes a surgeon's ORbit Score on-demand using the shared scoring engine.
//
// POST body: { surgeon_id, facility_id, start_date?, end_date? }
// Returns: SurgeonScorecard JSON matching iOS CodingKeys
// 404 if surgeon has < MIN_CASE_THRESHOLD completed cases
//
// Deploy with: supabase functions deploy compute-surgeon-scorecard

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  calculateORbitScores,
  MIN_CASE_THRESHOLD,
} from './orbitScoreEngine.ts'
import type {
  ScorecardCase,
  ScorecardFinancials,
  ScorecardFlag,
  ScorecardSettings,
  ScorecardInput,
} from './orbitScoreEngine.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify caller is authenticated
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'unauthorized', message: 'Missing authorization header' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 },
      )
    }

    // Parse request body
    const body = await req.json()
    const { surgeon_id, facility_id, start_date, end_date } = body

    if (!surgeon_id || !facility_id) {
      return new Response(
        JSON.stringify({ error: 'bad_request', message: 'surgeon_id and facility_id are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
      )
    }

    // Service role client for data access (peer comparison needs ALL facility surgeons)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Date range: default last 90 days
    const endDt = end_date || new Date().toISOString().split('T')[0]
    const startDt = start_date || (() => {
      const d = new Date()
      d.setDate(d.getDate() - 90)
      return d.toISOString().split('T')[0]
    })()

    // Previous period (same length, immediately before) for trend calculation
    const periodMs = new Date(endDt).getTime() - new Date(startDt).getTime()
    const periodDays = Math.round(periodMs / (1000 * 60 * 60 * 24))
    const prevStartDt = (() => {
      const d = new Date(startDt)
      d.setDate(d.getDate() - periodDays)
      return d.toISOString().split('T')[0]
    })()

    // 1. Facility timezone
    const { data: facilityData } = await supabase
      .from('facilities')
      .select('timezone')
      .eq('id', facility_id)
      .single()

    const timezone = facilityData?.timezone || 'America/Chicago'

    // 2. Facility analytics settings (with fallback defaults)
    const { data: settingsData } = await supabase
      .from('facility_analytics_settings')
      .select('*')
      .eq('facility_id', facility_id)
      .single()

    const settings: ScorecardSettings = {
      start_time_milestone: settingsData?.start_time_milestone || 'patient_in',
      start_time_grace_minutes: settingsData?.start_time_grace_minutes ?? 3,
      start_time_floor_minutes: settingsData?.start_time_floor_minutes ?? 20,
      waiting_on_surgeon_minutes: settingsData?.waiting_on_surgeon_minutes ?? 3,
      waiting_on_surgeon_floor_minutes: settingsData?.waiting_on_surgeon_floor_minutes ?? 10,
      min_procedure_cases: settingsData?.min_procedure_cases ?? 3,
    }

    // 3. Fetch ALL facility completed cases for both periods (peer comparison needs everyone)
    const allCases = await fetchCases(supabase, facility_id, prevStartDt, endDt)

    // Split into current and previous periods
    const currentCases = allCases.filter(c => c.scheduled_date >= startDt && c.scheduled_date <= endDt)
    const previousCases = allCases.filter(c => c.scheduled_date >= prevStartDt && c.scheduled_date < startDt)

    // Early exit: check if target surgeon has enough cases
    const surgeonCaseCount = currentCases.filter(c => c.surgeon_id === surgeon_id).length
    if (surgeonCaseCount < MIN_CASE_THRESHOLD) {
      return new Response(
        JSON.stringify({
          error: 'insufficient_cases',
          message: `Surgeon has ${surgeonCaseCount} completed cases in the period (minimum ${MIN_CASE_THRESHOLD} required)`,
          case_count: surgeonCaseCount,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 },
      )
    }

    // 4. Fetch financials (batched by 100 case IDs)
    const allCaseIds = allCases.map(c => c.id)
    const allFinancials = await fetchFinancials(supabase, allCaseIds)
    const currentFinancials = allFinancials.filter(f => currentCases.some(c => c.id === f.case_id))
    const previousFinancials = allFinancials.filter(f => previousCases.some(c => c.id === f.case_id))

    // 5. Fetch flags (batched by 100 case IDs)
    const allFlags = await fetchFlags(supabase, allCaseIds)
    const currentFlags = allFlags.filter(f => currentCases.some(c => c.id === f.case_id))
    const previousFlags = allFlags.filter(f => previousCases.some(c => c.id === f.case_id))

    // 6. Compute scores
    const input: ScorecardInput = {
      cases: currentCases,
      financials: currentFinancials,
      flags: currentFlags,
      settings,
      dateRange: { start: startDt, end: endDt },
      timezone,
      previousPeriodCases: previousCases.length > 0 ? previousCases : undefined,
      previousPeriodFinancials: previousFinancials.length > 0 ? previousFinancials : undefined,
      previousPeriodFlags: previousFlags.length > 0 ? previousFlags : undefined,
    }

    const scorecards = calculateORbitScores(input)

    // 7. Find target surgeon's scorecard
    const surgeonScorecard = scorecards.find(s => s.surgeonId === surgeon_id)

    if (!surgeonScorecard) {
      return new Response(
        JSON.stringify({
          error: 'scorecard_not_generated',
          message: 'Scorecard could not be generated for this surgeon',
          case_count: surgeonCaseCount,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 },
      )
    }

    // 8. Map to iOS SurgeonScorecard CodingKeys format
    const response = {
      id: crypto.randomUUID(),
      facility_id,
      surgeon_id,
      composite_score: surgeonScorecard.composite,
      profitability_score: surgeonScorecard.pillars.profitability,
      consistency_score: surgeonScorecard.pillars.consistency,
      sched_adherence_score: surgeonScorecard.pillars.schedAdherence,
      availability_score: surgeonScorecard.pillars.availability,
      case_count: surgeonScorecard.caseCount,
      trend: surgeonScorecard.trend,
      previous_composite: surgeonScorecard.previousComposite,
      created_at: new Date().toISOString(),
    }

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    )

  } catch (error) {
    console.error('Error computing scorecard:', error)

    return new Response(
      JSON.stringify({ error: 'internal_error', message: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
    )
  }
})


// ─── DATA FETCHING HELPERS ──────────────────────────────────

/**
 * Fetch all completed, data-validated cases for a facility across a date range.
 * Joins: surgeon (users), procedure_types, case_milestones → facility_milestones, case_statuses.
 */
async function fetchCases(
  supabase: ReturnType<typeof createClient>,
  facilityId: string,
  startDate: string,
  endDate: string,
): Promise<ScorecardCase[]> {
  const { data, error } = await supabase
    .from('cases')
    .select(`
      id,
      surgeon_id,
      procedure_type_id,
      or_room_id,
      scheduled_date,
      start_time,
      users!surgeon_id(first_name, last_name),
      procedure_types(name),
      case_milestones(recorded_at, facility_milestones(name)),
      case_statuses(name)
    `)
    .eq('facility_id', facilityId)
    .eq('data_validated', true)
    .gte('scheduled_date', startDate)
    .lte('scheduled_date', endDate)

  if (error) throw new Error(`Failed to fetch cases: ${error.message}`)

  return (data || [])
    .filter((c: any) => {
      const status = normalizeJoin(c.case_statuses)
      return status?.name === 'completed'
    })
    .map((c: any) => {
      const user = normalizeJoin(c.users)
      const procType = normalizeJoin(c.procedure_types)
      const milestones = c.case_milestones || []

      // Build milestone timestamp map
      const milestoneMap: Record<string, string | null> = {}
      for (const m of milestones) {
        const fm = normalizeJoin(m.facility_milestones)
        if (fm?.name && m.recorded_at) {
          milestoneMap[fm.name] = m.recorded_at
        }
      }

      return {
        id: c.id,
        surgeon_id: c.surgeon_id,
        surgeon_first_name: user?.first_name || '',
        surgeon_last_name: user?.last_name || '',
        procedure_type_id: c.procedure_type_id,
        procedure_name: procType?.name || 'Unknown',
        or_room_id: c.or_room_id,
        scheduled_date: c.scheduled_date,
        start_time: c.start_time,
        patient_in_at: milestoneMap['patient_in'] || null,
        incision_at: milestoneMap['incision'] || null,
        prep_drape_complete_at: milestoneMap['prep_drape_complete'] || null,
        closing_at: milestoneMap['closing'] || null,
        patient_out_at: milestoneMap['patient_out'] || null,
      } as ScorecardCase
    })
}

/**
 * Fetch case_completion_stats in batches of 100.
 */
async function fetchFinancials(
  supabase: ReturnType<typeof createClient>,
  caseIds: string[],
): Promise<ScorecardFinancials[]> {
  const results: ScorecardFinancials[] = []

  for (let i = 0; i < caseIds.length; i += 100) {
    const batch = caseIds.slice(i, i + 100)
    const { data, error } = await supabase
      .from('case_completion_stats')
      .select('case_id, profit, reimbursement, or_time_cost')
      .in('case_id', batch)

    if (!error && data) results.push(...data)
  }

  return results
}

/**
 * Fetch case_flags in batches of 100.
 */
async function fetchFlags(
  supabase: ReturnType<typeof createClient>,
  caseIds: string[],
): Promise<ScorecardFlag[]> {
  const results: ScorecardFlag[] = []

  for (let i = 0; i < caseIds.length; i += 100) {
    const batch = caseIds.slice(i, i + 100)
    const { data, error } = await supabase
      .from('case_flags')
      .select('case_id, flag_type, severity, delay_types(name), created_by')
      .in('case_id', batch)

    if (!error && data) {
      results.push(...data.map((f: any) => ({
        case_id: f.case_id,
        flag_type: f.flag_type,
        severity: f.severity,
        delay_type_name: normalizeJoin(f.delay_types)?.name || null,
        created_by: f.created_by,
      })))
    }
  }

  return results
}

/**
 * Normalize Supabase join data (single row or array).
 */
function normalizeJoin<T>(data: T | T[] | null): T | null {
  if (Array.isArray(data)) return data[0] || null
  return data
}
