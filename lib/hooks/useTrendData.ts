// lib/hooks/useTrendData.ts
// Fetches 30 days of case data and computes daily metric values for the trend chart.
// Each metric is derived from the same case dataset, grouped by scheduled_date.

import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { useUser } from '@/lib/UserContext'
import { getLocalDateString } from '@/lib/date-utils'
import {
  calculateORUtilization,
  calculateTurnoverTime,
  calculateCancellationRate,
  calculateFCOTS,
  type CaseWithMilestones,
  type RoomHoursMap,
} from '@/lib/analyticsV2'
import { computeFacilityScore } from '@/lib/facilityScoreStub'

// ============================================
// Types
// ============================================

export type TrendMetric = 'utilization' | 'turnover' | 'caseVolume' | 'facilityScore'

export interface TrendDataPoint {
  date: string
  value: number
}

export interface TrendMetricOption {
  value: TrendMetric
  label: string
  unit: string
}

export const TREND_METRIC_OPTIONS: TrendMetricOption[] = [
  { value: 'utilization', label: 'OR Utilization', unit: '%' },
  { value: 'turnover', label: 'Median Turnover', unit: 'min' },
  { value: 'caseVolume', label: 'Case Volume', unit: 'cases' },
  { value: 'facilityScore', label: 'Facility Score', unit: 'pts' },
]

// ============================================
// Helpers
// ============================================

const TREND_CASE_SELECT = `
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

function getLast30DaysRange(): { start: string; end: string } {
  const today = new Date()
  const thirtyDaysAgo = new Date(today)
  thirtyDaysAgo.setDate(today.getDate() - 30)
  return {
    start: getLocalDateString(thirtyDaysAgo),
    end: getLocalDateString(today),
  }
}

/** @internal Exported for testing */
export function groupCasesByDate(cases: CaseWithMilestones[]): Map<string, CaseWithMilestones[]> {
  const grouped = new Map<string, CaseWithMilestones[]>()
  for (const c of cases) {
    const date = c.scheduled_date
    const existing = grouped.get(date) ?? []
    existing.push(c)
    grouped.set(date, existing)
  }
  return grouped
}

/** @internal Exported for testing */
export function computeDailyMetric(
  metric: TrendMetric,
  dailyCases: CaseWithMilestones[],
  roomHoursMap?: RoomHoursMap
): number {
  switch (metric) {
    case 'utilization': {
      const result = calculateORUtilization(dailyCases, 10, undefined, roomHoursMap)
      return result.value
    }
    case 'turnover': {
      const result = calculateTurnoverTime(dailyCases)
      return result.value
    }
    case 'caseVolume': {
      return dailyCases.filter(
        (c) => c.case_statuses?.name === 'completed'
      ).length
    }
    case 'facilityScore': {
      const util = calculateORUtilization(dailyCases, 10, undefined, roomHoursMap)
      const turnover = calculateTurnoverTime(dailyCases)
      const fcots = calculateFCOTS(dailyCases)
      const cancellation = calculateCancellationRate(dailyCases)
      const score = computeFacilityScore({
        utilizationPct: util.value,
        medianTurnoverMinutes: turnover.value,
        fcotsPct: fcots.value,
        cancellationRate: cancellation.sameDayRate,
      })
      return score.score
    }
  }
}

// ============================================
// Hook
// ============================================

export function useTrendData(metric: TrendMetric) {
  const { effectiveFacilityId } = useUser()
  const range = getLast30DaysRange()

  return useSupabaseQuery<TrendDataPoint[]>(
    async (supabase) => {
      const [casesResult, roomsResult] = await Promise.all([
        supabase
          .from('cases')
          .select(TREND_CASE_SELECT)
          .eq('facility_id', effectiveFacilityId!)
          .gte('scheduled_date', range.start)
          .lte('scheduled_date', range.end)
          .order('scheduled_date', { ascending: true }),
        supabase
          .from('or_rooms')
          .select('id, available_hours')
          .eq('facility_id', effectiveFacilityId!)
          .eq('is_active', true),
      ])

      if (casesResult.error) throw casesResult.error
      if (roomsResult.error) throw roomsResult.error

      // Build room hours map for accurate utilization calculation
      const roomHoursMap: RoomHoursMap = {}
      for (const room of (roomsResult.data as { id: string; available_hours: number }[])) {
        roomHoursMap[room.id] = room.available_hours
      }

      const cases = (casesResult.data as unknown as CaseWithMilestones[]) ?? []
      const grouped = groupCasesByDate(cases)

      // Build data points for each day that has cases
      const points: TrendDataPoint[] = []
      const sortedDates = Array.from(grouped.keys()).sort()

      for (const date of sortedDates) {
        const dailyCases = grouped.get(date)!
        const value = computeDailyMetric(metric, dailyCases, roomHoursMap)
        points.push({ date, value })
      }

      return points
    },
    {
      deps: [metric, effectiveFacilityId, range.start],
      enabled: !!effectiveFacilityId,
    }
  )
}
