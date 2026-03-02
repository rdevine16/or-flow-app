/**
 * useCaseHistory — Lazy-loads case history entries for the History tab.
 *
 * Uses useSupabaseQuery with `enabled` guard so the query only fires
 * when the History tab is active. FK fields are batch-resolved to
 * human-readable names via the DAL.
 */

'use client'

import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { caseHistoryDAL } from '@/lib/dal/case-history'
import type { CaseHistoryEntry } from '@/lib/integrations/shared/integration-types'

interface UseCaseHistoryOptions {
  /** Only fetch when true (e.g., activeTab === 'history') */
  enabled: boolean
  /** Page size — defaults to 50 */
  limit?: number
}

interface UseCaseHistoryReturn {
  entries: CaseHistoryEntry[]
  loading: boolean
  error: string | null
  totalCount: number | null
  refetch: () => Promise<void>
  loadMore: () => void
  hasMore: boolean
}

export function useCaseHistory(
  caseId: string | null,
  options: UseCaseHistoryOptions,
): UseCaseHistoryReturn {
  const { enabled, limit = 50 } = options

  // Fetch history entries with FK resolution
  const {
    data,
    loading,
    error,
    refetch,
    setData,
  } = useSupabaseQuery<{ entries: CaseHistoryEntry[]; totalCount: number }>(
    async (supabase) => {
      if (!caseId) return { entries: [], totalCount: 0 }

      // Fetch entries + count in parallel
      const [historyResult, countResult] = await Promise.all([
        caseHistoryDAL.getCaseHistory(supabase, caseId, limit, 0),
        caseHistoryDAL.getCaseHistoryCount(supabase, caseId),
      ])

      if (historyResult.error) throw new Error(historyResult.error.message)

      // Resolve FK UUIDs to display names
      const resolved = await caseHistoryDAL.resolveChangedFieldNames(
        supabase,
        historyResult.data,
      )

      return {
        entries: resolved,
        totalCount: countResult.count,
      }
    },
    {
      deps: [caseId, enabled],
      enabled: enabled && !!caseId,
    },
  )

  // Load more handler — appends next page
  const loadMore = () => {
    if (!data || !caseId) return
    const currentCount = data.entries.length

    // Manually fetch next page via a separate query
    // We use setData to append results
    void (async () => {
      const { createClient } = await import('@/lib/supabase')
      const supabase = createClient()
      const result = await caseHistoryDAL.getCaseHistory(supabase, caseId, limit, currentCount)
      if (result.error || result.data.length === 0) return

      const resolved = await caseHistoryDAL.resolveChangedFieldNames(supabase, result.data)

      setData(prev => {
        if (!prev) return prev
        return {
          entries: [...prev.entries, ...resolved],
          totalCount: prev.totalCount,
        }
      })
    })()
  }

  const entries = data?.entries ?? []
  const totalCount = data?.totalCount ?? null
  const hasMore = totalCount !== null && entries.length < totalCount

  return { entries, loading, error, totalCount, refetch, loadMore, hasMore }
}
