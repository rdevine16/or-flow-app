// lib/hooks/useCaseMetrics.ts
// Server-side aggregation queries for tab-specific summary metric cards.
// Each tab gets 3 contextual metrics computed from parallel Supabase queries.

'use client'

import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import type { AnySupabaseClient, CasesPageTab } from '@/lib/dal'
import { getLocalDateString } from '@/lib/date-utils'
import type { metricColors } from '@/lib/design-tokens'

// ============================================
// TYPES
// ============================================

export interface CaseMetricCard {
  title: string
  value: number
  suffix?: string
  prefix?: string
  decimals?: number
  color?: keyof typeof metricColors
}

export interface UseCaseMetricsReturn {
  metrics: CaseMetricCard[]
  loading: boolean
}

// ============================================
// UTILITIES
// ============================================

/** Compute median of a numeric array */
function computeMedian(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2)
}

/** Days between a date string and today (minimum 0) */
function daysAgo(dateStr: string): number {
  const d = new Date(dateStr)
  const now = new Date()
  return Math.max(0, Math.floor((now.getTime() - d.getTime()) / 86_400_000))
}

// ============================================
// HOOK
// ============================================

export function useCaseMetrics(
  facilityId: string | null,
  activeTab: CasesPageTab,
  dateRange: { start: string; end: string },
  statusIds: Record<string, string>,
): UseCaseMetricsReturn {
  const statusIdsReady = Object.keys(statusIds).length > 0

  const { data: metrics, loading } = useSupabaseQuery<CaseMetricCard[]>(
    async (supabase) => {
      if (!facilityId || !statusIdsReady) return []

      // Today tab overrides date range to just today
      const today = getLocalDateString()
      const start = activeTab === 'today' ? today : dateRange.start
      const end = activeTab === 'today' ? today : dateRange.end

      const client = supabase as AnySupabaseClient

      switch (activeTab) {
        case 'all':
        case 'today':
          return fetchAllTodayMetrics(client, facilityId, start, end, statusIds)
        case 'completed':
          return fetchCompletedMetrics(client, facilityId, start, end, statusIds)
        case 'data_quality':
          return fetchNeedsValidationMetrics(client, facilityId, start, end, statusIds)
        case 'scheduled':
          return fetchScheduledMetrics(client, facilityId, start, end, statusIds)
        case 'in_progress':
          return fetchInProgressMetrics(client, facilityId, start, end, statusIds)
        default:
          return []
      }
    },
    {
      deps: [facilityId, activeTab, dateRange.start, dateRange.end, JSON.stringify(statusIds)],
      enabled: !!facilityId && statusIdsReady,
    },
  )

  return { metrics: metrics ?? [], loading }
}

// ============================================
// ALL / TODAY — Completed vs Scheduled, Median Duration, On-Time Start %
// ============================================

async function fetchAllTodayMetrics(
  supabase: AnySupabaseClient,
  facilityId: string,
  start: string,
  end: string,
  statusIds: Record<string, string>,
): Promise<CaseMetricCard[]> {
  const [completedR, scheduledR, durationsR, onTimeR] = await Promise.all([
    // Completed count
    statusIds.completed
      ? supabase.from('cases').select('id', { count: 'exact', head: true })
          .eq('facility_id', facilityId)
          .gte('scheduled_date', start).lte('scheduled_date', end)
          .eq('status_id', statusIds.completed)
      : Promise.resolve({ count: 0, error: null }),
    // Scheduled count
    statusIds.scheduled
      ? supabase.from('cases').select('id', { count: 'exact', head: true })
          .eq('facility_id', facilityId)
          .gte('scheduled_date', start).lte('scheduled_date', end)
          .eq('status_id', statusIds.scheduled)
      : Promise.resolve({ count: 0, error: null }),
    // Completed case durations from case_completion_stats
    supabase.from('case_completion_stats')
      .select('total_duration_minutes')
      .eq('facility_id', facilityId)
      .gte('case_date', start).lte('case_date', end)
      .not('total_duration_minutes', 'is', null),
    // On-time start data (scheduled vs actual patient-in)
    (() => {
      let q = supabase.from('cases').select('scheduled_date, start_time, patient_in_at')
        .eq('facility_id', facilityId)
        .gte('scheduled_date', start).lte('scheduled_date', end)
        .not('start_time', 'is', null)
        .not('patient_in_at', 'is', null)
      if (statusIds.completed) q = q.eq('status_id', statusIds.completed)
      return q
    })(),
  ])

  const completedCount = (completedR.count ?? 0) as number
  const scheduledCount = (scheduledR.count ?? 0) as number

  // Median duration
  const durations = ((durationsR.data ?? []) as Array<{ total_duration_minutes: number }>)
    .map(d => d.total_duration_minutes)
  const medianDuration = computeMedian(durations)

  // On-Time Start %: patient arrived within 15 min of scheduled start
  const rows = (onTimeR.data ?? []) as Array<{
    scheduled_date: string
    start_time: string
    patient_in_at: string
  }>
  let onTimeCount = 0
  for (const r of rows) {
    const scheduled = new Date(`${r.scheduled_date}T${r.start_time}`).getTime()
    const actual = new Date(r.patient_in_at).getTime()
    if (!isNaN(scheduled) && !isNaN(actual) && (actual - scheduled) / 60_000 <= 15) {
      onTimeCount++
    }
  }
  const onTimePct = rows.length > 0 ? Math.round((onTimeCount / rows.length) * 100) : 0

  return [
    { title: 'Completed', value: completedCount, color: 'green' },
    { title: 'Scheduled', value: scheduledCount, color: 'blue' },
    { title: 'Median Duration', value: medianDuration, suffix: ' min', color: 'green' },
    { title: 'On-Time Start', value: onTimePct, suffix: '%', color: 'amber' },
  ]
}

// ============================================
// COMPLETED — Total Cases, Median Duration, Total Profit
// ============================================

async function fetchCompletedMetrics(
  _supabase: AnySupabaseClient,
  _facilityId: string,
  _start: string,
  _end: string,
  _statusIds: Record<string, string>,
): Promise<CaseMetricCard[]> {
  return []
}

// ============================================
// NEEDS VALIDATION — Count, Oldest Unvalidated, Data Completeness %
// ============================================

async function fetchNeedsValidationMetrics(
  supabase: AnySupabaseClient,
  facilityId: string,
  start: string,
  end: string,
  statusIds: Record<string, string>,
): Promise<CaseMetricCard[]> {
  if (!statusIds.completed) {
    return [
      { title: 'Needs Validation', value: 0, color: 'amber' },
      { title: 'Oldest Unvalidated', value: 0, suffix: ' days', color: 'red' },
      { title: 'Data Completeness', value: 0, suffix: '%', color: 'green' },
    ]
  }

  const [unvalidatedR, validatedCountR, totalCompletedCountR] = await Promise.all([
    // Unvalidated cases (fetch dates for oldest calculation)
    supabase.from('cases').select('scheduled_date')
      .eq('facility_id', facilityId)
      .gte('scheduled_date', start).lte('scheduled_date', end)
      .eq('status_id', statusIds.completed)
      .eq('data_validated', false)
      .order('scheduled_date', { ascending: true }),
    // Validated count
    supabase.from('cases').select('id', { count: 'exact', head: true })
      .eq('facility_id', facilityId)
      .gte('scheduled_date', start).lte('scheduled_date', end)
      .eq('status_id', statusIds.completed)
      .eq('data_validated', true),
    // Total completed count
    supabase.from('cases').select('id', { count: 'exact', head: true })
      .eq('facility_id', facilityId)
      .gte('scheduled_date', start).lte('scheduled_date', end)
      .eq('status_id', statusIds.completed),
  ])

  const unvalidated = (unvalidatedR.data ?? []) as Array<{ scheduled_date: string }>
  const unvalidatedCount = unvalidated.length
  const oldestDays = unvalidated.length > 0 ? daysAgo(unvalidated[0].scheduled_date) : 0

  const validatedCount = (validatedCountR.count ?? 0) as number
  const totalCompleted = (totalCompletedCountR.count ?? 0) as number
  const completeness = totalCompleted > 0 ? Math.round((validatedCount / totalCompleted) * 100) : 0

  return [
    { title: 'Needs Validation', value: unvalidatedCount, color: 'amber' },
    { title: 'Oldest Unvalidated', value: oldestDays, suffix: ' days', color: 'red' },
    { title: 'Data Completeness', value: completeness, suffix: '%', color: 'green' },
  ]
}

// ============================================
// SCHEDULED — Cases Scheduled, Total OR Time, Surgeons Operating
// ============================================

async function fetchScheduledMetrics(
  supabase: AnySupabaseClient,
  facilityId: string,
  start: string,
  end: string,
  statusIds: Record<string, string>,
): Promise<CaseMetricCard[]> {
  if (!statusIds.scheduled) {
    return [
      { title: 'Cases Scheduled', value: 0, color: 'blue' },
      { title: 'Total OR Time', value: 0, suffix: ' hrs', decimals: 1, color: 'green' },
      { title: 'Surgeons Operating', value: 0, color: 'slate' },
    ]
  }

  const [casesR, overridesR] = await Promise.all([
    supabase.from('cases')
      .select('surgeon_id, procedure_type_id, procedure_types(expected_duration_minutes)')
      .eq('facility_id', facilityId)
      .gte('scheduled_date', start).lte('scheduled_date', end)
      .eq('status_id', statusIds.scheduled),
    supabase.from('surgeon_procedure_duration')
      .select('surgeon_id, procedure_type_id, expected_duration_minutes')
      .eq('facility_id', facilityId),
  ])

  const cases = (casesR.data ?? []) as unknown as Array<{
    surgeon_id: string | null
    procedure_type_id: string | null
    procedure_types: { expected_duration_minutes: number | null } | null
  }>

  // Build surgeon override map
  const overrideMap = new Map<string, number>()
  if (overridesR.data) {
    for (const o of overridesR.data as Array<{ surgeon_id: string; procedure_type_id: string; expected_duration_minutes: number }>) {
      overrideMap.set(`${o.surgeon_id}::${o.procedure_type_id}`, o.expected_duration_minutes)
    }
  }

  const totalScheduled = cases.length
  const totalMinutes = cases.reduce((sum, c) => {
    const surgeonOverride = (c.surgeon_id && c.procedure_type_id) ? overrideMap.get(`${c.surgeon_id}::${c.procedure_type_id}`) ?? null : null
    const procDuration = c.procedure_types?.expected_duration_minutes ?? null
    return sum + (surgeonOverride ?? procDuration ?? 0)
  }, 0)
  const totalHours = Math.round((totalMinutes / 60) * 10) / 10
  const uniqueSurgeons = new Set(cases.map(c => c.surgeon_id).filter(Boolean)).size

  return [
    { title: 'Cases Scheduled', value: totalScheduled, color: 'blue' },
    { title: 'Total OR Time', value: totalHours, suffix: ' hrs', decimals: 1, color: 'green' },
    { title: 'Surgeons Operating', value: uniqueSurgeons, color: 'slate' },
  ]
}

// ============================================
// IN PROGRESS — Active Cases, Avg Progress %, Rooms In Use
// ============================================

async function fetchInProgressMetrics(
  supabase: AnySupabaseClient,
  facilityId: string,
  start: string,
  end: string,
  statusIds: Record<string, string>,
): Promise<CaseMetricCard[]> {
  if (!statusIds.in_progress) {
    return [
      { title: 'Active Cases', value: 0, color: 'green' },
      { title: 'Avg Progress', value: 0, suffix: '%', color: 'blue' },
      { title: 'Rooms In Use', value: 0, color: 'slate' },
    ]
  }

  // Get in-progress cases
  const casesR = await supabase.from('cases')
    .select('id, or_room_id')
    .eq('facility_id', facilityId)
    .gte('scheduled_date', start).lte('scheduled_date', end)
    .eq('status_id', statusIds.in_progress)

  const cases = (casesR.data ?? []) as Array<{ id: string; or_room_id: string | null }>
  const activeCount = cases.length
  const uniqueRooms = new Set(cases.map(c => c.or_room_id).filter(Boolean)).size

  // Avg Progress: recorded milestones / total expected milestones per case
  let avgProgress = 0
  const caseIds = cases.map(c => c.id)

  if (caseIds.length > 0) {
    const [milestonesR, totalMilestonesR] = await Promise.all([
      supabase.from('case_milestones').select('case_id')
        .in('case_id', caseIds)
        .not('recorded_at', 'is', null),
      supabase.from('facility_milestones').select('id', { count: 'exact', head: true })
        .eq('facility_id', facilityId)
        .eq('is_active', true),
    ])

    const totalExpected = (totalMilestonesR.count ?? 0) as number
    if (totalExpected > 0) {
      const milestoneCounts = new Map<string, number>()
      for (const m of (milestonesR.data ?? []) as Array<{ case_id: string }>) {
        milestoneCounts.set(m.case_id, (milestoneCounts.get(m.case_id) ?? 0) + 1)
      }
      let totalProgress = 0
      for (const id of caseIds) {
        const recorded = milestoneCounts.get(id) ?? 0
        totalProgress += Math.min(100, (recorded / totalExpected) * 100)
      }
      avgProgress = Math.round(totalProgress / caseIds.length)
    }
  }

  return [
    { title: 'Active Cases', value: activeCount, color: 'green' },
    { title: 'Avg Progress', value: avgProgress, suffix: '%', color: 'blue' },
    { title: 'Rooms In Use', value: uniqueRooms, color: 'slate' },
  ]
}
