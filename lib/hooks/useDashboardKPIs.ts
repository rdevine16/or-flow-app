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
  type FacilityAnalyticsConfig,
  type KPIResult,
  type ORUtilizationResult,
  type CancellationResult,
} from '@/lib/analyticsV2'
import { mapRowToConfig } from '@/lib/hooks/useAnalyticsConfig'
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
      // Fetch cases, analytics settings, and facility hourly rate in parallel
      const [currentResult, previousResult, settingsResult, facilityResult] = await Promise.all([
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
        supabase
          .from('facility_analytics_settings')
          .select('fcots_milestone, fcots_grace_minutes, fcots_target_percent, turnover_target_same_surgeon, turnover_target_flip_room, turnover_threshold_minutes, turnover_compliance_target_percent, utilization_target_percent, cancellation_target_percent, idle_combined_target_minutes, idle_flip_target_minutes, idle_same_room_target_minutes, tardiness_target_minutes, non_op_warn_minutes, non_op_bad_minutes, operating_days_per_year')
          .eq('facility_id', effectiveFacilityId!)
          .single(),
        supabase
          .from('facilities')
          .select('or_hourly_rate')
          .eq('id', effectiveFacilityId!)
          .single(),
      ])

      if (currentResult.error) throw currentResult.error
      if (previousResult.error) throw previousResult.error
      // Settings row may not exist yet (PGRST116 = no rows) — use defaults
      const settingsRow = settingsResult.error?.code === 'PGRST116'
        ? null
        : settingsResult.error
          ? (() => { throw settingsResult.error })()
          : settingsResult.data
      if (facilityResult.error) throw facilityResult.error

      // Build facility analytics config
      const config: FacilityAnalyticsConfig = mapRowToConfig(
        settingsRow as Record<string, unknown> | null,
        (facilityResult.data as { or_hourly_rate: number | null }).or_hourly_rate
      )

      const cases = (currentResult.data as unknown as CaseWithMilestones[]) || []
      const prevCases = (previousResult.data as unknown as CaseWithMilestones[]) || []

      // Count cases by status
      const casesScheduled = cases.length
      const casesCompleted = cases.filter(
        (c) => c.case_statuses?.name === 'completed'
      ).length

      // Calculate KPIs using analyticsV2 functions with facility config
      const utilization = calculateORUtilization(cases, 10, prevCases, undefined, {
        utilizationTargetPercent: config.utilizationTargetPercent,
      })
      const medianTurnover = calculateTurnoverTime(cases, prevCases, {
        turnoverThresholdMinutes: config.turnoverThresholdMinutes,
        turnoverComplianceTarget: config.turnoverComplianceTarget,
      })
      const onTimeStartPct = calculateFCOTS(cases, prevCases, {
        milestone: config.fcotsMilestone,
        graceMinutes: config.fcotsGraceMinutes,
        targetPercent: config.fcotsTargetPercent,
      })
      const cancellation = calculateCancellationRate(cases, prevCases, {
        cancellationTargetPercent: config.cancellationTargetPercent,
      })

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
