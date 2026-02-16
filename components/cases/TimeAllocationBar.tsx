// components/cases/TimeAllocationBar.tsx
// Stacked horizontal bar showing time allocation across phase groups.
// "Where did the time go?" — Pre-Op, Surgical, Closing, Post-Op, Idle/Gap.

'use client'

import { formatMinutes, type TimeAllocation } from '@/lib/utils/milestoneAnalytics'

interface TimeAllocationBarProps {
  allocations: TimeAllocation[]
  /** Facility median allocation for the largest phase (for insight text) */
  facilityMedianPercentage?: number | null
}

export default function TimeAllocationBar({
  allocations,
  facilityMedianPercentage,
}: TimeAllocationBarProps) {
  if (allocations.length === 0) return null

  // Find the largest phase for insight text
  const largest = allocations.reduce((max, a) => (a.percentage > max.percentage ? a : max), allocations[0])

  return (
    <div className="space-y-2">
      <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
        Where did the time go?
      </span>

      {/* Stacked bar */}
      <div className="flex h-6 w-full rounded-md overflow-hidden">
        {allocations.map((alloc) => (
          <div
            key={alloc.phase_group}
            className={`${alloc.color} relative group transition-opacity hover:opacity-90`}
            style={{ width: `${alloc.percentage}%` }}
          >
            {/* Label — only show if segment is wide enough */}
            {alloc.percentage >= 15 && (
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-white truncate px-1">
                {alloc.label} {alloc.percentage}%
              </span>
            )}

            {/* Tooltip on hover */}
            <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 whitespace-nowrap bg-slate-800 text-white text-[11px] px-2.5 py-1.5 rounded-md shadow-lg">
              {alloc.label}: {formatMinutes(alloc.minutes)} ({alloc.percentage}%)
            </div>
          </div>
        ))}
      </div>

      {/* Legend below bar */}
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {allocations.map((alloc) => (
          <span key={alloc.phase_group} className="flex items-center gap-1 text-[10px] text-slate-600">
            <span className={`w-2 h-2 rounded-sm ${alloc.color}`} />
            {alloc.label}: {formatMinutes(alloc.minutes)} ({alloc.percentage}%)
          </span>
        ))}
      </div>

      {/* Insight text */}
      {largest && largest.percentage >= 30 && (
        <p className="text-[11px] text-slate-500 italic">
          {largest.label} took {largest.percentage}% of total case time
          {facilityMedianPercentage != null && facilityMedianPercentage > 0 && (
            <> — facility median is {facilityMedianPercentage}%</>
          )}
        </p>
      )}
    </div>
  )
}
