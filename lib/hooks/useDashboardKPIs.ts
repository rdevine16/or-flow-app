// lib/hooks/useDashboardKPIs.ts
// Data fetching hook for the facility admin dashboard KPI cards.
// Fetches cases for current and prior periods, then computes KPIs
// using analyticsV2 calculation functions.

import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { useUser } from '@/lib/UserContext'
import { getLocalDateString } from '@/lib/date-utils'
import {
  calculateFCOTS,
  calculateTurnoverTime,
  calculateORUtilization,
  calculateCancellationRate,
  type CaseWithMilestones,
  type KPIResult,
  type ORUtilizationResult,
  type CancellationResult,
} from '@/lib/analyticsV2'
import { computeFacilityScore, type FacilityScoreResult } from '@/lib/facilityScoreStub'

// ============================================
// Types
// ============================================

export type TimeRange = 'today' | 'week' | 'month'

export interface DashboardKPIs {
  utilization: ORUtilizationResult
  casesCompleted: number
  casesScheduled: number
  medianTurnover: KPIResult
  onTimeStartPct: KPIResult
  facilityScore: FacilityScoreResult
  cancellation: CancellationResult
}

// ============================================
// Date range helpers
// ============================================

interface DateRangePair {
  current: { start: string; end: string }
  previous: { start: string; end: string }
}

function getDateRanges(timeRange: TimeRange): DateRangePair {
  const today = new Date()
  const todayStr = getLocalDateString(today)

  switch (timeRange) {
    case 'today': {
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      return {
        current: { start: todayStr, end: todayStr },
        previous: { start: getLocalDateString(yesterday), end: getLocalDateString(yesterday) },
      }
    }
    case 'week': {
      // Current week: Monday through today
      const dayOfWeek = today.getDay()
      const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1
      const monday = new Date(today)
      monday.setDate(today.getDate() - mondayOffset)

      // Previous week: prior Monday through prior Sunday
      const prevMonday = new Date(monday)
      prevMonday.setDate(monday.getDate() - 7)
      const prevSunday = new Date(monday)
      prevSunday.setDate(monday.getDate() - 1)

      return {
        current: { start: getLocalDateString(monday), end: todayStr },
        previous: { start: getLocalDateString(prevMonday), end: getLocalDateString(prevSunday) },
      }
    }
    case 'month': {
      // Current month: 1st through today
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)

      // Previous month: full prior month
      const prevMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)
      const prevMonthStart = new Date(prevMonthEnd.getFullYear(), prevMonthEnd.getMonth(), 1)

      return {
        current: { start: getLocalDateString(monthStart), end: todayStr },
        previous: { start: getLocalDateString(prevMonthStart), end: getLocalDateString(prevMonthEnd) },
      }
    }
  }
}

// ============================================
// Case query select string
// ============================================

const DASHBOARD_CASE_SELECT = `
  id,
  case_number,
  facility_id,
  scheduled_date,
  start_time,
  surgeon_id,
  or_room_id,
  status_id,
  surgeon_left_at,
  cancelled_at,
  is_excluded_from_metrics,
  surgeon:users!cases_surgeon_id_fkey (first_name, last_name),
  or_rooms (id, name),
  case_statuses (name),
  case_milestones (
    facility_milestone_id,
    recorded_at,
    facility_milestones (name)
  )
` as const

// ============================================
// Hook
// ============================================

export function useDashboardKPIs(timeRange: TimeRange) {
  const { effectiveFacilityId } = useUser()
  const ranges = getDateRanges(timeRange)

  return useSupabaseQuery<DashboardKPIs>(
    async (supabase) => {
      // Fetch current and prior period cases in parallel
      const [currentResult, previousResult] = await Promise.all([
        supabase
          .from('cases')
          .select(DASHBOARD_CASE_SELECT)
          .eq('facility_id', effectiveFacilityId!)
          .gte('scheduled_date', ranges.current.start)
          .lte('scheduled_date', ranges.current.end)
          .order('scheduled_date', { ascending: false }),
        supabase
          .from('cases')
          .select(DASHBOARD_CASE_SELECT)
          .eq('facility_id', effectiveFacilityId!)
          .gte('scheduled_date', ranges.previous.start)
          .lte('scheduled_date', ranges.previous.end)
          .order('scheduled_date', { ascending: false }),
      ])

      if (currentResult.error) throw currentResult.error
      if (previousResult.error) throw previousResult.error

      const cases = (currentResult.data as unknown as CaseWithMilestones[]) || []
      const prevCases = (previousResult.data as unknown as CaseWithMilestones[]) || []

      // Count cases by status
      const casesScheduled = cases.length
      const casesCompleted = cases.filter(
        (c) => c.case_statuses?.name === 'completed'
      ).length

      // Calculate KPIs using analyticsV2 functions
      const utilization = calculateORUtilization(cases, 10, prevCases)
      const medianTurnover = calculateTurnoverTime(cases, prevCases)
      const onTimeStartPct = calculateFCOTS(cases, prevCases)
      const cancellation = calculateCancellationRate(cases, prevCases)

      // Compute facility score stub from KPI results
      const facilityScore = computeFacilityScore({
        utilizationPct: utilization.value,
        medianTurnoverMinutes: medianTurnover.value,
        fcotsPct: onTimeStartPct.value,
        cancellationRate: cancellation.sameDayRate,
      })

      return {
        utilization,
        casesCompleted,
        casesScheduled,
        medianTurnover,
        onTimeStartPct,
        facilityScore,
        cancellation,
      }
    },
    {
      deps: [timeRange, effectiveFacilityId, ranges.current.start, ranges.current.end],
      enabled: !!effectiveFacilityId,
    }
  )
}
