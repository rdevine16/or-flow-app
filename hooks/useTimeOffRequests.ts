// hooks/useTimeOffRequests.ts
// Hook for fetching and managing time-off requests (admin view).
// Uses useSupabaseQuery pattern — all data fetched through timeOffDAL.

import { useState, useCallback } from 'react'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { timeOffDAL } from '@/lib/dal'
import type {
  TimeOffRequest,
  TimeOffStatus,
  TimeOffFilterParams,
  TimeOffReviewInput,
  UserTimeOffSummary,
} from '@/types/time-off'
import { createClient } from '@/lib/supabase'

// ============================================
// Types
// ============================================

interface UseTimeOffRequestsOptions {
  facilityId: string | null | undefined
  filters?: TimeOffFilterParams
  year?: number
}

interface UseTimeOffRequestsReturn {
  requests: TimeOffRequest[]
  totals: UserTimeOffSummary[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  reviewRequest: (
    requestId: string,
    review: TimeOffReviewInput,
  ) => Promise<{ success: boolean; error?: string }>
  filterByStatus: (status: TimeOffStatus | undefined) => void
  filterByUser: (userId: string | undefined) => void
  activeFilters: TimeOffFilterParams
}

// ============================================
// Hook
// ============================================

export function useTimeOffRequests(options: UseTimeOffRequestsOptions): UseTimeOffRequestsReturn {
  const { facilityId, year = new Date().getFullYear() } = options

  const [filters, setFilters] = useState<TimeOffFilterParams>(options.filters ?? {})

  // Fetch requests
  const {
    data: requests,
    loading: requestsLoading,
    error: requestsError,
    refetch: refetchRequests,
  } = useSupabaseQuery<TimeOffRequest[]>(
    async (supabase) => {
      if (!facilityId) return []
      const { data, error } = await timeOffDAL.fetchFacilityRequests(
        supabase,
        facilityId,
        filters,
      )
      if (error) throw error
      return data
    },
    {
      deps: [facilityId, filters.status, filters.userId, filters.dateRange?.start, filters.dateRange?.end],
      enabled: !!facilityId,
      initialData: [],
    },
  )

  // Fetch per-user totals
  const {
    data: totals,
    loading: totalsLoading,
    error: totalsError,
    refetch: refetchTotals,
  } = useSupabaseQuery<UserTimeOffSummary[]>(
    async (supabase) => {
      if (!facilityId) return []
      const { data, error } = await timeOffDAL.fetchUserTimeOffTotals(
        supabase,
        facilityId,
        year,
      )
      if (error) throw error
      return data
    },
    {
      deps: [facilityId, year],
      enabled: !!facilityId,
      initialData: [],
    },
  )

  // Review action (approve/deny)
  const reviewRequest = useCallback(
    async (
      requestId: string,
      review: TimeOffReviewInput,
    ): Promise<{ success: boolean; error?: string }> => {
      if (!facilityId) return { success: false, error: 'No facility' }

      const supabase = createClient()
      const { error } = await timeOffDAL.reviewRequest(
        supabase,
        facilityId,
        requestId,
        review,
      )

      if (error) {
        return { success: false, error: error.message }
      }

      // Refresh both queries after review
      await Promise.all([refetchRequests(), refetchTotals()])
      return { success: true }
    },
    [facilityId, refetchRequests, refetchTotals],
  )

  // Filter helpers
  const filterByStatus = useCallback((status: TimeOffStatus | undefined) => {
    setFilters((prev) => ({ ...prev, status }))
  }, [])

  const filterByUser = useCallback((userId: string | undefined) => {
    setFilters((prev) => ({ ...prev, userId }))
  }, [])

  // Combined refetch
  const refetch = useCallback(async () => {
    await Promise.all([refetchRequests(), refetchTotals()])
  }, [refetchRequests, refetchTotals])

  return {
    requests: requests ?? [],
    totals: totals ?? [],
    loading: requestsLoading || totalsLoading,
    error: requestsError || totalsError,
    refetch,
    reviewRequest,
    filterByStatus,
    filterByUser,
    activeFilters: filters,
  }
}
