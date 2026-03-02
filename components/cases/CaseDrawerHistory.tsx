/**
 * CaseDrawerHistory — History tab content for the case drawer.
 *
 * Fetches case history via useCaseHistory hook and renders a vertical
 * timeline with change entries. Supports pagination with "Load more".
 */

'use client'

import { History, Loader2 } from 'lucide-react'
import CaseHistoryTimeline from '@/components/cases/CaseHistoryTimeline'
import type { CaseHistoryEntry } from '@/lib/integrations/shared/integration-types'

interface CaseDrawerHistoryProps {
  entries: CaseHistoryEntry[]
  loading: boolean
  error: string | null
  hasMore: boolean
  onLoadMore: () => void
}

export default function CaseDrawerHistory({
  entries,
  loading,
  error,
  hasMore,
  onLoadMore,
}: CaseDrawerHistoryProps) {
  // Loading state (initial load, no entries yet)
  if (loading && entries.length === 0) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-slate-200 mt-1 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="flex gap-2">
                <div className="h-4 w-16 bg-slate-200 rounded" />
                <div className="h-4 w-12 bg-slate-100 rounded" />
              </div>
              <div className="h-3 w-48 bg-slate-100 rounded" />
              <div className="h-3 w-32 bg-slate-50 rounded" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="text-center py-6">
        <History className="w-5 h-5 text-slate-300 mx-auto mb-2" />
        <p className="text-xs text-red-500">Failed to load history</p>
        <p className="text-[10px] text-slate-400 mt-1">{error}</p>
      </div>
    )
  }

  return (
    <div>
      <CaseHistoryTimeline entries={entries} />

      {/* Load more button */}
      {hasMore && (
        <div className="mt-3 text-center">
          <button
            onClick={onLoadMore}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-50"
          >
            {loading && <Loader2 className="w-3 h-3 animate-spin" />}
            Load more
          </button>
        </div>
      )}
    </div>
  )
}
