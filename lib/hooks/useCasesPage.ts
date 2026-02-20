// lib/hooks/useCasesPage.ts
// Main page hook for the Cases page.
// Manages tab state (URL-synced), date range, status ID mapping, tab counts,
// table data fetching, sort/pagination state, and flag summaries.

'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { casesDAL, type CasesPageTab, type CaseFlagSummary } from '@/lib/dal'
import type { CaseListItem, CasesFilterParams } from '@/lib/dal/cases'
import type { SortParams } from '@/lib/dal'
import { useCaseStatuses, useSurgeons, useRooms, useProcedureTypes } from '@/hooks/useLookups'
import { useProcedureCategories } from '@/hooks/useLookups'
import { getPresetDates } from '@/components/ui/DateRangeSelector'
import { createClient } from '@/lib/supabase'

// ============================================
// TYPES
// ============================================

export interface DateRangeState {
  preset: string
  start: string
  end: string
}

/** Filter state for the search and filter bar */
export interface CasesFilterState {
  search: string
  surgeonIds: string[]
  roomIds: string[]
  procedureIds: string[]
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

  // Filter state
  filters: CasesFilterState
  searchInput: string
  setSearchInput: (value: string) => void
  setSurgeonIds: (ids: string[]) => void
  setRoomIds: (ids: string[]) => void
  setProcedureIds: (ids: string[]) => void
  clearAllFilters: () => void
  hasActiveFilters: boolean

  // Lookup data (for filter dropdowns)
  surgeons: Array<{ id: string; first_name: string; last_name: string }>
  rooms: Array<{ id: string; name: string }>
  procedureTypes: Array<{ id: string; name: string }>

  // Table data
  cases: CaseListItem[]
  casesLoading: boolean
  casesError: string | null
  totalCount: number
  refetchCases: () => Promise<void>

  // Sort state
  sort: SortParams
  setSort: (sort: SortParams) => void

  // Pagination state
  page: number
  pageSize: number
  setPage: (page: number) => void
  totalPages: number

  // Flags
  flagSummaries: Map<string, CaseFlagSummary>

  // DQ validation state (case IDs with unresolved metric_issues)
  dqCaseIds: Set<string>

  // Procedure category lookup (id → name) for icons
  categoryNameById: Map<string, string>

  // Row selection
  selectedRows: Set<string>
  setSelectedRows: (rows: Set<string>) => void
  toggleRow: (id: string) => void
  toggleAllRows: () => void
  clearSelection: () => void

  // Actions
  refreshAll: () => Promise<void>
  exportCases: (selectedCaseIds?: string[]) => Promise<void>
}

// ============================================
// VALID TABS
// ============================================

const VALID_TABS: CasesPageTab[] = [
  'all', 'today', 'scheduled', 'in_progress', 'completed', 'data_quality',
]

function isValidTab(value: string | null): value is CasesPageTab {
  return value !== null && VALID_TABS.includes(value as CasesPageTab)
}

const EMPTY_COUNTS: Record<CasesPageTab, number> = {
  all: 0, today: 0, scheduled: 0, in_progress: 0, completed: 0, data_quality: 0,
}

const DEFAULT_PAGE_SIZE = 25

// ============================================
// HOOK
// ============================================

export function useCasesPage(facilityId: string | null): UseCasesPageReturn {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  // --- Row Selection (declared first because other callbacks reference setSelectedRows) ---
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())

  const toggleRow = useCallback((id: string) => {
    setSelectedRows(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedRows(new Set())
  }, [])

  // --- Sort State ---
  const [sort, setSort] = useState<SortParams>({ sortBy: 'date', sortDirection: 'desc' })

  // --- Pagination State (declared before callbacks that reference setPage) ---
  const [page, setPageState] = useState(1)
  const pageSize = DEFAULT_PAGE_SIZE

  const setPage = useCallback((newPage: number) => {
    setPageState(newPage)
    setSelectedRows(new Set())
  }, [])

  // --- Tab State (URL-synced via ?tab= query param) ---
  const activeTab: CasesPageTab = useMemo(() => {
    const tabParam = searchParams.get('tab')
    return isValidTab(tabParam) ? tabParam : 'today'
  }, [searchParams])

  const setActiveTab = useCallback((tab: CasesPageTab) => {
    const params = new URLSearchParams(searchParams.toString())
    if (tab === 'today') {
      params.delete('tab')
    } else {
      params.set('tab', tab)
    }
    // Reset to page 1 when switching tabs
    params.delete('page')
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
    setSelectedRows(new Set())
  }, [router, pathname, searchParams])

  // --- Date Range State (default: Last 30 Days) ---
  const [dateRange, setDateRangeState] = useState<DateRangeState>(() => {
    const defaultPreset = 'last_30'
    const { start, end } = getPresetDates(defaultPreset)
    return { preset: defaultPreset, start, end }
  })

  const setDateRange = useCallback((preset: string, start: string, end: string) => {
    setDateRangeState({ preset, start, end })
    setPage(1)
    setSelectedRows(new Set())
  }, [setPage])

  // --- Filter State (search + entity filters, URL-synced) ---
  const [searchInput, setSearchInputState] = useState(() => searchParams.get('q') || '')
  const [debouncedSearch, setDebouncedSearch] = useState(() => searchParams.get('q') || '')
  const [surgeonIds, setSurgeonIdsState] = useState<string[]>(() => searchParams.getAll('surgeon'))
  const [roomIds, setRoomIdsState] = useState<string[]>(() => searchParams.getAll('room'))
  const [procedureIds, setProcedureIdsState] = useState<string[]>(() => searchParams.getAll('procedure'))

  // Debounce search input (300ms)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const setSearchInput = useCallback((value: string) => {
    setSearchInputState(value)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(value)
      setPage(1)
      setSelectedRows(new Set())
    }, 300)
  }, [setPage])

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [])

  const setSurgeonIds = useCallback((ids: string[]) => {
    setSurgeonIdsState(ids)
    setPage(1)
    setSelectedRows(new Set())
  }, [setPage])

  const setRoomIds = useCallback((ids: string[]) => {
    setRoomIdsState(ids)
    setPage(1)
    setSelectedRows(new Set())
  }, [setPage])

  const setProcedureIds = useCallback((ids: string[]) => {
    setProcedureIdsState(ids)
    setPage(1)
    setSelectedRows(new Set())
  }, [setPage])

  const clearAllFilters = useCallback(() => {
    setSearchInputState('')
    setDebouncedSearch('')
    setSurgeonIdsState([])
    setRoomIdsState([])
    setProcedureIdsState([])
    setPage(1)
    setSelectedRows(new Set())
  }, [setPage])

  const hasActiveFilters = debouncedSearch !== '' || surgeonIds.length > 0 || roomIds.length > 0 || procedureIds.length > 0

  // Build filter params for DAL queries
  const dalFilters: CasesFilterParams | undefined = useMemo(() => {
    if (!hasActiveFilters) return undefined
    return {
      search: debouncedSearch || undefined,
      surgeonIds: surgeonIds.length > 0 ? surgeonIds : undefined,
      roomIds: roomIds.length > 0 ? roomIds : undefined,
      procedureIds: procedureIds.length > 0 ? procedureIds : undefined,
    }
  }, [debouncedSearch, surgeonIds, roomIds, procedureIds, hasActiveFilters])

  // URL sync for filters (replaceState to avoid navigation)
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())

    // Clear old filter params
    params.delete('q')
    params.delete('surgeon')
    params.delete('room')
    params.delete('procedure')

    // Set new filter params
    if (debouncedSearch) params.set('q', debouncedSearch)
    surgeonIds.forEach(id => params.append('surgeon', id))
    roomIds.forEach(id => params.append('room', id))
    procedureIds.forEach(id => params.append('procedure', id))

    const qs = params.toString()
    const newUrl = qs ? `${pathname}?${qs}` : pathname
    window.history.replaceState(null, '', newUrl)
  }, [debouncedSearch, surgeonIds, roomIds, procedureIds, pathname, searchParams])

  // Aggregate filter state for the component
  const filters: CasesFilterState = useMemo(() => ({
    search: debouncedSearch,
    surgeonIds,
    roomIds,
    procedureIds,
  }), [debouncedSearch, surgeonIds, roomIds, procedureIds])

  // --- Lookup Data (for filter dropdowns) ---
  const { data: surgeonsData } = useSurgeons(facilityId)
  const { data: roomsData } = useRooms(facilityId)
  const { data: procedureTypesData } = useProcedureTypes(facilityId)

  const surgeons = useMemo(() => surgeonsData ?? [], [surgeonsData])
  const rooms = useMemo(() => roomsData ?? [], [roomsData])
  const procedureTypes = useMemo(() => procedureTypesData ?? [], [procedureTypesData])

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

  // --- Procedure Categories Lookup (for icon mapping) ---
  const { data: procedureCategories } = useProcedureCategories()

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>()
    if (procedureCategories) {
      for (const cat of procedureCategories) {
        map.set(cat.id, cat.name)
      }
    }
    return map
  }, [procedureCategories])

  // --- Tab Counts ---
  const { data: tabCounts, loading: tabCountsLoading, refetch: refetchTabCounts } = useSupabaseQuery<Record<CasesPageTab, number>>(
    async (supabase) => {
      if (!facilityId || !statusIdsReady) return EMPTY_COUNTS

      const { data, error } = await casesDAL.countByTab(
        supabase,
        facilityId,
        { start: dateRange.start, end: dateRange.end },
        statusIds,
        dalFilters,
      )
      if (error) throw error
      return data
    },
    {
      deps: [facilityId, dateRange.start, dateRange.end, statusIdsReady, debouncedSearch, surgeonIds.join(','), roomIds.join(','), procedureIds.join(',')],
      enabled: !!facilityId && statusIdsReady,
    }
  )

  // --- Table Data ---
  const {
    data: casesResult,
    loading: casesLoading,
    error: casesError,
    refetch: refetchCases,
  } = useSupabaseQuery<{ items: CaseListItem[]; total: number }>(
    async (supabase) => {
      if (!facilityId || !statusIdsReady) return { items: [], total: 0 }

      const { data, error, count } = await casesDAL.listForCasesPage(
        supabase,
        facilityId,
        { start: dateRange.start, end: dateRange.end },
        activeTab,
        { page, pageSize },
        sort,
        statusIds,
        dalFilters,
      )
      if (error) throw error
      return { items: data, total: count ?? 0 }
    },
    {
      deps: [facilityId, dateRange.start, dateRange.end, activeTab, page, sort.sortBy, sort.sortDirection, statusIdsReady, debouncedSearch, surgeonIds.join(','), roomIds.join(','), procedureIds.join(',')],
      enabled: !!facilityId && statusIdsReady,
    }
  )

  const cases = useMemo(() => casesResult?.items ?? [], [casesResult])
  const totalCount = casesResult?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  // --- Flag Summaries (batch query for visible case IDs) ---
  const caseIds = useMemo(() => cases.map(c => c.id), [cases])

  const { data: flagSummariesData } = useSupabaseQuery<CaseFlagSummary[]>(
    async (supabase) => {
      if (caseIds.length === 0) return []
      const { data, error } = await casesDAL.flagsByCase(supabase, caseIds)
      if (error) throw error
      return data
    },
    {
      deps: [caseIds.join(',')],
      enabled: caseIds.length > 0,
    }
  )

  const flagSummaries = useMemo(() => {
    const map = new Map<string, CaseFlagSummary>()
    if (flagSummariesData) {
      for (const f of flagSummariesData) {
        map.set(f.case_id, f)
      }
    }
    return map
  }, [flagSummariesData])

  // --- DQ Validation Status (case IDs with unresolved metric_issues) ---
  const { data: dqCaseIdsData } = useSupabaseQuery<string[]>(
    async (supabase) => {
      if (!facilityId) return []
      const { data, error } = await casesDAL.getCaseIdsWithUnresolvedIssues(supabase, facilityId)
      if (error) throw error
      return data ?? []
    },
    {
      deps: [facilityId],
      enabled: !!facilityId,
    }
  )

  const dqCaseIds = useMemo(() => new Set(dqCaseIdsData ?? []), [dqCaseIdsData])

  // --- Toggle All Rows (on current page) ---
  const toggleAllRows = useCallback(() => {
    if (selectedRows.size === cases.length) {
      setSelectedRows(new Set())
    } else {
      setSelectedRows(new Set(cases.map(c => c.id)))
    }
  }, [cases, selectedRows.size])

  // --- Actions ---
  const refreshAll = useCallback(async () => {
    await Promise.all([refetchCases(), refetchTabCounts()])
  }, [refetchCases, refetchTabCounts])

  const exportCases = useCallback(async (selectedCaseIds?: string[]) => {
    const supabase = createClient()
    if (!facilityId || !statusIdsReady) return

    // If specific IDs selected, filter from current data; otherwise fetch all
    let exportData: CaseListItem[]
    if (selectedCaseIds && selectedCaseIds.length > 0) {
      exportData = cases.filter(c => selectedCaseIds.includes(c.id))
    } else {
      const { data } = await casesDAL.listForExport(
        supabase,
        facilityId,
        { start: dateRange.start, end: dateRange.end },
        activeTab,
        sort,
        statusIds,
        dalFilters,
      )
      exportData = data
    }

    if (exportData.length === 0) return

    // Format as CSV
    const headers = ['Case ID', 'Case Number', 'Procedure', 'Surgeon', 'Room', 'Date', 'Time', 'Status', 'Validated']
    const rows = exportData.map(c => [
      c.id,
      c.case_number,
      c.procedure_type?.name ?? '',
      c.surgeon ? `Dr. ${c.surgeon.last_name}` : '',
      c.or_room?.name ?? '',
      c.scheduled_date,
      c.start_time ?? '',
      c.case_status?.name ?? '',
      c.data_validated ? 'Yes' : 'No',
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n')

    // Trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `cases-${activeTab}-${dateRange.start}-to-${dateRange.end}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, [facilityId, statusIdsReady, cases, activeTab, dateRange, sort, statusIds, dalFilters])

  return {
    activeTab,
    setActiveTab,
    tabCounts: tabCounts ?? EMPTY_COUNTS,
    tabCountsLoading,
    dateRange,
    setDateRange,
    statusIds,
    statusIdsReady,
    filters,
    searchInput,
    setSearchInput,
    setSurgeonIds,
    setRoomIds,
    setProcedureIds,
    clearAllFilters,
    hasActiveFilters,
    surgeons,
    rooms,
    procedureTypes,
    cases,
    casesLoading,
    casesError,
    totalCount,
    refetchCases,
    sort,
    setSort,
    page,
    pageSize,
    setPage,
    totalPages,
    flagSummaries,
    dqCaseIds,
    categoryNameById,
    selectedRows,
    setSelectedRows,
    toggleRow,
    toggleAllRows,
    clearSelection,
    refreshAll,
    exportCases,
  }
}
