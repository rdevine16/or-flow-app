// lib/hooks/useFlagAnalytics.ts
// Data fetching hook for the flag analytics page.
// Calls the get_flag_analytics RPC and returns typed FlagAnalyticsData.

'use client'

import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import type {
  FlagAnalyticsData,
  FlagAnalyticsRPCResponse,
  FlagSummaryKPIs,
  FlagSparklineData,
} from '@/types/flag-analytics'

// ============================================
// Types
// ============================================

export interface UseFlagAnalyticsOptions {
  facilityId: string | null
  startDate: string | null
  endDate: string | null
  enabled?: boolean
}

export interface UseFlagAnalyticsReturn {
  data: FlagAnalyticsData | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

// ============================================
// Empty defaults (for zero-data states)
// ============================================

const EMPTY_SUMMARY: FlagSummaryKPIs = {
  totalCases: 0,
  flaggedCases: 0,
  flagRate: 0,
  flagRateTrend: 0,
  delayedCases: 0,
  delayRate: 0,
  delayRateTrend: 0,
  criticalCount: 0,
  warningCount: 0,
  infoCount: 0,
  totalFlags: 0,
  avgFlagsPerCase: 0,
}

const EMPTY_SPARKLINE: FlagSparklineData = {
  flagRate: [],
  delayRate: [],
}

// ============================================
// Hook
// ============================================

export function useFlagAnalytics(options: UseFlagAnalyticsOptions): UseFlagAnalyticsReturn {
  const { facilityId, startDate, endDate, enabled = true } = options

  const canFetch = enabled && !!facilityId && !!startDate && !!endDate

  const { data, loading, error, refetch } = useSupabaseQuery<FlagAnalyticsData>(
    async (supabase) => {
      if (!facilityId || !startDate || !endDate) {
        throw new Error('Missing required parameters')
      }

      const { data: rpcData, error: rpcError } = await supabase.rpc('get_flag_analytics', {
        p_facility_id: facilityId,
        p_start_date: startDate,
        p_end_date: endDate,
      })

      if (rpcError) throw rpcError

      const raw = rpcData as unknown as FlagAnalyticsRPCResponse | null

      // Normalize the response — handle nulls from empty datasets
      const normalized: FlagAnalyticsRPCResponse = {
        summary: raw?.summary ?? EMPTY_SUMMARY,
        sparklineData: raw?.sparklineData ?? EMPTY_SPARKLINE,
        weeklyTrend: raw?.weeklyTrend ?? [],
        dayOfWeekHeatmap: raw?.dayOfWeekHeatmap ?? [],
        flagRuleBreakdown: raw?.flagRuleBreakdown ?? [],
        delayTypeBreakdown: raw?.delayTypeBreakdown ?? [],
        surgeonFlags: raw?.surgeonFlags ?? [],
        roomFlags: raw?.roomFlags ?? [],
        recentFlaggedCases: raw?.recentFlaggedCases ?? [],
      }

      return {
        ...normalized,
        // Pattern detection is computed client-side in Phase 5.
        // Placeholder empty array for now — the patterns field exists
        // in the type so consuming components can reference it.
        patterns: [],
      }
    },
    { deps: [facilityId, startDate, endDate], enabled: canFetch }
  )

  return { data, loading, error, refetch }
}
