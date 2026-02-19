// components/analytics/flags/RecentFlaggedCases.tsx
// Displays recent flagged cases with flag badges.
// Initially shows 5 cases, "View All" expands inline to show all.

'use client'

import { useState, useCallback } from 'react'
import type { RecentFlaggedCase } from '@/types/flag-analytics'

// ============================================
// Severity badge config
// ============================================

const SEVERITY_BADGE: Record<string, { bg: string; text: string; border: string }> = {
  critical: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  warning: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  info: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
}

const INITIAL_COUNT = 5

// ============================================
// Component
// ============================================

interface RecentFlaggedCasesProps {
  cases: RecentFlaggedCase[]
  onCaseClick?: (caseId: string) => void
}

export default function RecentFlaggedCases({ cases, onCaseClick }: RecentFlaggedCasesProps) {
  const [expanded, setExpanded] = useState(false)

  const toggleExpanded = useCallback(() => setExpanded((prev) => !prev), [])

  if (cases.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-slate-400">
        No flagged cases in this period.
      </div>
    )
  }

  const visible = expanded ? cases : cases.slice(0, INITIAL_COUNT)
  const hasMore = cases.length > INITIAL_COUNT

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50/50">
        <div>
          <h3 className="text-[15px] font-bold text-slate-900">Recent Flagged Cases</h3>
          <p className="text-xs text-slate-500 mt-0.5">Latest cases with flags attached</p>
        </div>
        {hasMore && (
          <button
            onClick={toggleExpanded}
            className="px-3.5 py-1.5 rounded-md text-xs font-semibold bg-sky-500 text-white hover:bg-sky-600 transition-colors shadow-sm"
          >
            {expanded ? 'Show Less' : `View All ${cases.length} →`}
          </button>
        )}
      </div>

      {/* Case rows */}
      <div className={expanded ? 'max-h-[500px] overflow-y-auto' : undefined}>
        {visible.map((c, i) => (
          <div
            key={c.caseId}
            className={`flex items-center gap-4 px-5 py-3 cursor-pointer hover:bg-slate-50 transition-colors ${
              i < visible.length - 1 ? 'border-b border-slate-100' : ''
            }`}
            onClick={() => onCaseClick?.(c.caseId)}
          >
            {/* Case number */}
            <div className="w-[115px] flex-shrink-0">
              <span className="text-[13px] font-semibold text-sky-600 font-mono">{c.caseNumber}</span>
            </div>

            {/* Date */}
            <div className="w-14 flex-shrink-0 text-xs text-slate-400">{c.date}</div>

            {/* Surgeon */}
            <div className="w-[120px] flex-shrink-0 text-[13px] font-medium text-slate-900 truncate">
              {c.surgeon}
            </div>

            {/* Procedure */}
            <div className="w-[150px] flex-shrink-0 text-xs text-slate-500 truncate">{c.procedure}</div>

            {/* Flag badges */}
            <div className="flex gap-1.5 flex-wrap flex-1">
              {c.flags.map((f, j) => {
                const config = SEVERITY_BADGE[f.severity] ?? SEVERITY_BADGE.info
                return (
                  <span
                    key={j}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border whitespace-nowrap ${config.bg} ${config.text} ${config.border}`}
                  >
                    <span className="text-[9px] opacity-70">{f.type === 'delay' ? '◷' : '⚡'}</span>
                    {f.name}
                  </span>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
