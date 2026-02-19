// lib/hooks/useDashboardInsights.ts
// Lazy-loaded insights for the dashboard "What should we fix?" section.
// Only fetches when enabled=true (triggered by IntersectionObserver in InsightsSection).
// Caches results via useSupabaseQuery — won't re-fetch on scroll in/out.

import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { useUser } from '@/lib/UserContext'
import { getDateRanges, type TimeRange } from '@/lib/hooks/useDashboardKPIs'
import {
  calculateAnalyticsOverview,
  type CaseWithMilestonesAndSurgeon,
  type FacilityAnalyticsConfig,
  type RoomHoursMap,
} from '@/lib/analyticsV2'
import { mapRowToConfig } from '@/lib/hooks/useAnalyticsConfig'
import { generateInsights, type Insight } from '@/lib/insightsEngine'

// ============================================
// Types
// ============================================

export interface DashboardInsightsResult {
  insights: Insight[]
}

// ============================================
// Case query — same fields as useDashboardKPIs
// ============================================

const INSIGHTS_CASE_SELECT = `
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

export function useDashboardInsights(timeRange: TimeRange, enabled: boolean) {
  const { effectiveFacilityId } = useUser()
  const ranges = getDateRanges(timeRange)

  return useSupabaseQuery<DashboardInsightsResult>(
    async (supabase) => {
      // Fetch cases (current + previous), settings, facility rate, and room hours in parallel
      const [currentResult, previousResult, settingsResult, facilityResult, roomsResult] = await Promise.all([
        supabase
          .from('cases')
          .select(INSIGHTS_CASE_SELECT)
          .eq('facility_id', effectiveFacilityId!)
          .gte('scheduled_date', ranges.current.start)
          .lte('scheduled_date', ranges.current.end)
          .order('scheduled_date', { ascending: false }),
        supabase
          .from('cases')
          .select(INSIGHTS_CASE_SELECT)
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
        supabase
          .from('or_rooms')
          .select('id, available_hours')
          .eq('facility_id', effectiveFacilityId!)
          .eq('is_active', true),
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
      if (roomsResult.error) throw roomsResult.error

      // Build facility analytics config
      const config: FacilityAnalyticsConfig = mapRowToConfig(
        settingsRow as Record<string, unknown> | null,
        (facilityResult.data as { or_hourly_rate: number | null }).or_hourly_rate
      )

      // Build room hours map for accurate utilization calculation
      const roomHoursMap: RoomHoursMap = {}
      for (const room of (roomsResult.data as { id: string; available_hours: number }[])) {
        roomHoursMap[room.id] = room.available_hours
      }

      const cases = (currentResult.data as unknown as CaseWithMilestonesAndSurgeon[]) || []
      const prevCases = (previousResult.data as unknown as CaseWithMilestonesAndSurgeon[]) || []

      // Calculate full analytics overview, then generate insights
      const analytics = calculateAnalyticsOverview(cases, prevCases, config, roomHoursMap)
      const insights = generateInsights(analytics, {
        orHourlyRate: config.orHourlyRate,
        operatingDaysPerYear: config.operatingDaysPerYear,
      })

      return { insights }
    },
    {
      deps: [timeRange, effectiveFacilityId, ranges.current.start, ranges.current.end],
      enabled: enabled && !!effectiveFacilityId,
    }
  )
}
