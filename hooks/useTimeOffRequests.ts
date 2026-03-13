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
import type { FacilityHoliday } from '@/types/block-scheduling'
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
  holidays: FacilityHoliday[]
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

  // Fetch facility holidays for holiday-aware PTO calculation
  const {
    data: holidays,
    loading: holidaysLoading,
    refetch: refetchHolidays,
  } = useSupabaseQuery<FacilityHoliday[]>(
    async (supabase) => {
      if (!facilityId) return []
      const { data, error } = await supabase
        .from('facility_holidays')
        .select('*')
        .eq('facility_id', facilityId)
        .eq('is_active', true)
      if (error) throw error
      return (data as FacilityHoliday[]) || []
    },
    {
      deps: [facilityId],
      enabled: !!facilityId,
      initialData: [],
    },
  )

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

  // Fetch per-user totals (holiday-aware when holidays are loaded)
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
        holidays ?? [],
      )
      if (error) throw error
      return data
    },
    {
      deps: [facilityId, year, holidays],
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
    await Promise.all([refetchRequests(), refetchTotals(), refetchHolidays()])
  }, [refetchRequests, refetchTotals, refetchHolidays])

  return {
    requests: requests ?? [],
    totals: totals ?? [],
    holidays: holidays ?? [],
    loading: requestsLoading || totalsLoading || holidaysLoading,
    error: requestsError || totalsError,
    refetch,
    reviewRequest,
    filterByStatus,
    filterByUser,
    activeFilters: filters,
  }
}
