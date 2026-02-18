// lib/hooks/useAnalyticsConfig.ts
// Shared hook to fetch facility analytics settings + or_hourly_rate
// and merge into a single FacilityAnalyticsConfig object.
//
// Usage:
//   const { config, loading, refetch } = useAnalyticsConfig()
//   // config is always non-null (defaults applied), loading indicates fetch state

import { useUser } from '@/lib/UserContext'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import {
  type FacilityAnalyticsConfig,
  ANALYTICS_CONFIG_DEFAULTS,
} from '@/lib/analyticsV2'

/** Raw row shape from facility_analytics_settings (snake_case DB columns) */
interface AnalyticsSettingsRow {
  fcots_milestone: string
  fcots_grace_minutes: number
  fcots_target_percent: number
  turnover_target_same_surgeon: number
  turnover_target_flip_room: number
  turnover_threshold_minutes: number
  turnover_compliance_target_percent: number
  utilization_target_percent: number
  cancellation_target_percent: number
  idle_combined_target_minutes: number
  idle_flip_target_minutes: number
  idle_same_room_target_minutes: number
  tardiness_target_minutes: number
  non_op_warn_minutes: number
  non_op_bad_minutes: number
  operating_days_per_year: number
}

interface FacilityRow {
  or_hourly_rate: number | null
}

interface UseAnalyticsConfigReturn {
  config: FacilityAnalyticsConfig
  loading: boolean
  refetch: () => Promise<void>
}

/** Map a DB settings row to a FacilityAnalyticsConfig, applying defaults for any missing values */
export function mapRowToConfig(
  row: Partial<AnalyticsSettingsRow> | null,
  orHourlyRate: number | null
): FacilityAnalyticsConfig {
  const d = ANALYTICS_CONFIG_DEFAULTS
  return {
    fcotsMilestone: (row?.fcots_milestone === 'incision' ? 'incision' : 'patient_in'),
    fcotsGraceMinutes: row?.fcots_grace_minutes ?? d.fcotsGraceMinutes,
    fcotsTargetPercent: row?.fcots_target_percent ?? d.fcotsTargetPercent,
    sameRoomTurnoverTarget: row?.turnover_target_same_surgeon ?? d.sameRoomTurnoverTarget,
    flipRoomTurnoverTarget: row?.turnover_target_flip_room ?? d.flipRoomTurnoverTarget,
    turnoverThresholdMinutes: row?.turnover_threshold_minutes ?? d.turnoverThresholdMinutes,
    turnoverComplianceTarget: row?.turnover_compliance_target_percent ?? d.turnoverComplianceTarget,
    utilizationTargetPercent: row?.utilization_target_percent ?? d.utilizationTargetPercent,
    cancellationTargetPercent: row?.cancellation_target_percent ?? d.cancellationTargetPercent,
    idleCombinedTargetMinutes: row?.idle_combined_target_minutes ?? d.idleCombinedTargetMinutes,
    idleFlipTargetMinutes: row?.idle_flip_target_minutes ?? d.idleFlipTargetMinutes,
    idleSameRoomTargetMinutes: row?.idle_same_room_target_minutes ?? d.idleSameRoomTargetMinutes,
    tardinessTargetMinutes: row?.tardiness_target_minutes ?? d.tardinessTargetMinutes,
    nonOpWarnMinutes: row?.non_op_warn_minutes ?? d.nonOpWarnMinutes,
    nonOpBadMinutes: row?.non_op_bad_minutes ?? d.nonOpBadMinutes,
    operatingDaysPerYear: row?.operating_days_per_year ?? d.operatingDaysPerYear,
    orHourlyRate: orHourlyRate ?? d.orHourlyRate,
  }
}

/**
 * Fetch facility analytics config from DB and merge with defaults.
 * Combines facility_analytics_settings + facilities.or_hourly_rate.
 *
 * Returns config immediately with defaults — loading indicates whether
 * the DB fetch has completed (config will update when it does).
 */
export function useAnalyticsConfig(): UseAnalyticsConfigReturn {
  const { effectiveFacilityId, loading: userLoading } = useUser()

  const { data, loading: queryLoading, refetch } = useSupabaseQuery<{
    settings: Partial<AnalyticsSettingsRow> | null
    orHourlyRate: number | null
  }>(
    async (supabase) => {
      // Fetch both in parallel
      const [settingsResult, facilityResult] = await Promise.all([
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

      // Settings row may not exist yet (PGRST116 = no rows)
      const settings: Partial<AnalyticsSettingsRow> | null =
        settingsResult.error?.code === 'PGRST116'
          ? null
          : settingsResult.error
            ? (() => { throw settingsResult.error })()
            : (settingsResult.data as AnalyticsSettingsRow)

      if (facilityResult.error) throw facilityResult.error

      return {
        settings,
        orHourlyRate: (facilityResult.data as FacilityRow).or_hourly_rate,
      }
    },
    {
      deps: [effectiveFacilityId],
      enabled: !userLoading && !!effectiveFacilityId,
    }
  )

  const config = data
    ? mapRowToConfig(data.settings, data.orHourlyRate)
    : ANALYTICS_CONFIG_DEFAULTS

  return {
    config,
    loading: userLoading || queryLoading,
    refetch,
  }
}
