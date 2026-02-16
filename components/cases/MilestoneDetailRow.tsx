// components/cases/MilestoneDetailRow.tsx
// Structured 6-column milestone data table.
// Replaces the card-based MilestoneDetailRow with a table layout.
// Columns: [Status Icon] [Milestone Name] [Time] [Interval] [Median] [Delta]

'use client'

import { useMemo } from 'react'
import { DeltaBadge } from '@/components/ui/DeltaBadge'
import { formatMinutes } from '@/lib/utils/milestoneAnalytics'
import type { MilestoneInterval } from '@/lib/utils/milestoneAnalytics'
import { AlertTriangle, CheckCircle2, Circle } from 'lucide-react'

// ============================================
// TYPES
// ============================================

interface MilestoneTableProps {
  intervals: MilestoneInterval[]
  comparisonSource: 'surgeon' | 'facility'
  surgeonCaseCount: number
  facilityCaseCount: number
  /** Indexes of milestones that are "missing" (unrecorded with later ones recorded) */
  missingFlags: boolean[]
  totalCaseMinutes: number | null
  totalSurgicalMinutes: number | null
}

// ============================================
// HELPERS
// ============================================

function formatTimestamp(isoString: string | null): string {
  if (!isoString) return '—'
  const date = new Date(isoString)
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

// ============================================
// MAIN TABLE COMPONENT
// ============================================

export function MilestoneTable({
  intervals,
  comparisonSource,
  surgeonCaseCount,
  facilityCaseCount,
  missingFlags,
  totalCaseMinutes,
  totalSurgicalMinutes,
}: MilestoneTableProps) {
  const medianLabel = comparisonSource === 'surgeon' ? 'Surg Med' : 'Fac Med'
  const caseCount = comparisonSource === 'surgeon' ? surgeonCaseCount : facilityCaseCount
  const medianKey = comparisonSource === 'surgeon' ? 'surgeon_median_minutes' : 'facility_median_minutes' as const
  const deltaKey = comparisonSource === 'surgeon' ? 'delta_from_surgeon' : 'delta_from_facility' as const

  // Compute footer totals
  const footerTotals = useMemo(() => {
    const totalInterval = intervals.reduce(
      (sum, iv) => sum + (iv.interval_minutes ?? 0),
      0,
    )
    const totalMedian = intervals
      .filter((iv) => iv[medianKey] != null)
      .reduce((sum, iv) => sum + (iv[medianKey] ?? 0), 0)
    const totalDelta = totalCaseMinutes != null && totalMedian > 0
      ? totalCaseMinutes - totalMedian
      : null

    return { totalInterval, totalMedian: totalMedian > 0 ? totalMedian : null, totalDelta }
  }, [intervals, medianKey, totalCaseMinutes])

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      {/* Header row */}
      <div className="grid grid-cols-[28px_1fr_72px_68px_72px_80px] bg-slate-50 border-b border-slate-200 px-3 py-2">
        <span />
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
          Milestone
        </span>
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-center">
          Time
        </span>
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-center">
          Interval
        </span>
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-center">
          {medianLabel}
        </span>
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-right">
          Delta
        </span>
      </div>

      {/* Data rows */}
      {intervals.map((iv, idx) => {
        const isMissing = missingFlags[idx] ?? false
        const isRecorded = !!iv.recorded_at
        const isFirst = idx === 0
        const activeMedian = iv[medianKey]
        const activeDelta = iv[deltaKey]

        return (
          <div
            key={iv.facility_milestone_id}
            className={`grid grid-cols-[28px_1fr_72px_68px_72px_80px] items-center px-3 py-2 border-b border-slate-100 last:border-b-0 ${
              isMissing ? 'bg-amber-50/60' : ''
            }`}
          >
            {/* Status icon */}
            <div className="flex items-center justify-center">
              {isMissing ? (
                <div className="w-4 h-4 rounded-sm bg-amber-100 flex items-center justify-center">
                  <AlertTriangle className="w-3 h-3 text-amber-500" />
                </div>
              ) : isRecorded ? (
                <CheckCircle2 className="w-4 h-4 text-teal-500" />
              ) : (
                <Circle className="w-4 h-4 text-slate-300" />
              )}
            </div>

            {/* Milestone name */}
            <div className="min-w-0">
              <span className={`text-xs font-medium truncate block ${
                isRecorded ? 'text-slate-900' : isMissing ? 'text-amber-700' : 'text-slate-400'
              }`}>
                {iv.milestone_name}
              </span>
            </div>

            {/* Time */}
            <span className={`text-xs text-center ${
              isRecorded ? 'text-slate-700' : isMissing ? 'text-amber-600' : 'text-slate-400'
            }`}>
              {isMissing ? (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-amber-100 text-amber-700">
                  N/R
                </span>
              ) : (
                formatTimestamp(iv.recorded_at)
              )}
            </span>

            {/* Interval */}
            <span className="text-xs text-center text-slate-700">
              {!isFirst && iv.interval_minutes != null
                ? `${Math.round(iv.interval_minutes)}m`
                : '—'}
            </span>

            {/* Median */}
            <span className="text-xs text-center text-slate-500">
              {!isFirst && activeMedian != null
                ? `${Math.round(activeMedian)}m`
                : '—'}
            </span>

            {/* Delta */}
            <div className="flex justify-end">
              {!isFirst && activeDelta != null && iv.delta_severity ? (
                <DeltaBadge
                  delta={activeDelta}
                  format="time"
                  invert
                  severity={iv.delta_severity}
                />
              ) : (
                <span className="text-xs text-slate-400">—</span>
              )}
            </div>
          </div>
        )
      })}

      {/* Summary footer row */}
      {totalCaseMinutes != null && (
        <div className="grid grid-cols-[28px_1fr_72px_68px_72px_80px] items-center px-3 py-2.5 bg-slate-50 border-t-2 border-slate-200">
          <span />
          <span className="text-xs font-semibold text-slate-900">
            Total Case Time
          </span>
          <span />
          <span className="text-xs font-semibold text-center text-slate-900">
            {formatMinutes(totalCaseMinutes)}
          </span>
          <span className="text-xs font-semibold text-center text-slate-600">
            {footerTotals.totalMedian != null
              ? formatMinutes(footerTotals.totalMedian)
              : '—'}
          </span>
          <div className="flex justify-end">
            {footerTotals.totalDelta != null ? (
              <DeltaBadge
                delta={footerTotals.totalDelta}
                format="time"
                invert
              />
            ) : (
              <span className="text-xs text-slate-400">—</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Default export aliased for backward compatibility
export default MilestoneTable
