// lib/hooks/useCasesPage.ts
// Main page hook for the Cases page.
// Manages tab state (URL-synced), date range, status ID mapping, and tab counts.

'use client'

import { useCallback, useMemo, useState } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { casesDAL, type CasesPageTab } from '@/lib/dal'
import { useCaseStatuses } from '@/hooks/useLookups'
import { getPresetDates } from '@/components/ui/DateRangeSelector'

// ============================================
// TYPES
// ============================================

export interface DateRangeState {
  preset: string
  start: string
  end: string
}

export interface UseCasesPageReturn {
  // Tab state
  activeTab: CasesPageTab
  setActiveTab: (tab: CasesPageTab) => void

  // Tab counts
  tabCounts: Record<CasesPageTab, number>
  tabCountsLoading: boolean

  // Date range state
  dateRange: DateRangeState
  setDateRange: (preset: string, start: string, end: string) => void

  // Status lookup (for passing to DAL)
  statusIds: Record<string, string>
  statusIdsReady: boolean
}

// ============================================
// VALID TABS
// ============================================

const VALID_TABS: CasesPageTab[] = [
  'all', 'today', 'scheduled', 'in_progress', 'completed', 'needs_validation',
]

function isValidTab(value: string | null): value is CasesPageTab {
  return value !== null && VALID_TABS.includes(value as CasesPageTab)
}

const EMPTY_COUNTS: Record<CasesPageTab, number> = {
  all: 0, today: 0, scheduled: 0, in_progress: 0, completed: 0, needs_validation: 0,
}

// ============================================
// HOOK
// ============================================

export function useCasesPage(facilityId: string | null): UseCasesPageReturn {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  // --- Tab State (URL-synced via ?tab= query param) ---
  const activeTab: CasesPageTab = useMemo(() => {
    const tabParam = searchParams.get('tab')
    return isValidTab(tabParam) ? tabParam : 'all'
  }, [searchParams])

  const setActiveTab = useCallback((tab: CasesPageTab) => {
    const params = new URLSearchParams(searchParams.toString())
    if (tab === 'all') {
      params.delete('tab')
    } else {
      params.set('tab', tab)
    }
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }, [router, pathname, searchParams])

  // --- Date Range State (default: Last 30 Days) ---
  const [dateRange, setDateRangeState] = useState<DateRangeState>(() => {
    const defaultPreset = 'last_30'
    const { start, end } = getPresetDates(defaultPreset)
    return { preset: defaultPreset, start, end }
  })

  const setDateRange = useCallback((preset: string, start: string, end: string) => {
    setDateRangeState({ preset, start, end })
  }, [])

  // --- Status ID Mapping (case_statuses name → UUID) ---
  const { data: caseStatuses } = useCaseStatuses()

  const statusIds = useMemo(() => {
    if (!caseStatuses || caseStatuses.length === 0) return {}
    return caseStatuses.reduce<Record<string, string>>((acc, status) => {
      const key = status.name.toLowerCase().replace(/\s+/g, '_')
      acc[key] = status.id
      return acc
    }, {})
  }, [caseStatuses])

  const statusIdsReady = Object.keys(statusIds).length > 0

  // --- Tab Counts ---
  const { data: tabCounts, loading: tabCountsLoading } = useSupabaseQuery<Record<CasesPageTab, number>>(
    async (supabase) => {
      if (!facilityId || !statusIdsReady) return EMPTY_COUNTS

      const { data, error } = await casesDAL.countByTab(
        supabase,
        facilityId,
        { start: dateRange.start, end: dateRange.end },
        statusIds,
      )
      if (error) throw error
      return data
    },
    {
      deps: [facilityId, dateRange.start, dateRange.end, statusIdsReady],
      enabled: !!facilityId && statusIdsReady,
    }
  )

  return {
    activeTab,
    setActiveTab,
    tabCounts: tabCounts ?? EMPTY_COUNTS,
    tabCountsLoading,
    dateRange,
    setDateRange,
    statusIds,
    statusIdsReady,
  }
}
