// components/cases/MilestoneDetailRow.tsx
// Individual milestone row showing name, timestamp, interval,
// surgeon/facility medians, delta badge, and cohort context.

'use client'

import { DeltaBadge } from '@/components/ui/DeltaBadge'
import { formatMinutes } from '@/lib/utils/milestoneAnalytics'
import type { MilestoneInterval } from '@/lib/utils/milestoneAnalytics'
import { AlertTriangle, CheckCircle2, Circle, Clock } from 'lucide-react'

interface MilestoneDetailRowProps {
  interval: MilestoneInterval
  index: number
  comparisonSource: 'surgeon' | 'facility'
  surgeonCaseCount: number
  facilityCaseCount: number
  /** Whether a later milestone has been recorded (makes unrecorded ones "missing") */
  isMissing: boolean
}

function formatTimestamp(isoString: string | null): string {
  if (!isoString) return '—'
  const date = new Date(isoString)
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export default function MilestoneDetailRow({
  interval,
  index,
  comparisonSource,
  surgeonCaseCount,
  facilityCaseCount,
  isMissing,
}: MilestoneDetailRowProps) {
  const isRecorded = !!interval.recorded_at
  const isFirstMilestone = index === 0
  const activeDelta = comparisonSource === 'surgeon'
    ? interval.delta_from_surgeon
    : interval.delta_from_facility
  const activeMedian = comparisonSource === 'surgeon'
    ? interval.surgeon_median_minutes
    : interval.facility_median_minutes
  const caseCount = comparisonSource === 'surgeon' ? surgeonCaseCount : facilityCaseCount

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
        isMissing ? 'bg-amber-50/60' : isRecorded ? 'hover:bg-slate-50' : ''
      }`}
    >
      {/* Status icon */}
      <div className="flex-shrink-0">
        {isMissing ? (
          <AlertTriangle className="w-4 h-4 text-amber-500" />
        ) : isRecorded ? (
          <CheckCircle2 className="w-4 h-4 text-teal-500" />
        ) : (
          <Circle className="w-4 h-4 text-slate-300" />
        )}
      </div>

      {/* Name + timestamp */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className={`text-sm font-medium truncate ${
            isRecorded ? 'text-slate-900' : isMissing ? 'text-amber-700' : 'text-slate-400'
          }`}>
            {interval.milestone_name}
          </span>
          <span className={`text-xs ml-2 flex-shrink-0 ${
            isRecorded ? 'text-slate-500' : 'text-slate-400'
          }`}>
            {isMissing ? (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700">
                Not Recorded
              </span>
            ) : (
              formatTimestamp(interval.recorded_at)
            )}
          </span>
        </div>

        {/* Interval + median + delta row (skip for first milestone) */}
        {!isFirstMilestone && isRecorded && interval.interval_minutes != null && (
          <div className="flex items-center gap-2 mt-1">
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <Clock className="w-3 h-3" />
              {formatMinutes(interval.interval_minutes)}
            </span>
            {activeMedian != null && (
              <>
                <span className="text-[10px] text-slate-400">
                  median {formatMinutes(activeMedian)}
                </span>
                {activeDelta != null && interval.delta_severity && (
                  <DeltaBadge
                    delta={activeDelta}
                    format="time"
                    invert
                    severity={interval.delta_severity}
                  />
                )}
              </>
            )}
          </div>
        )}

        {/* Cohort context */}
        {!isFirstMilestone && isRecorded && activeMedian != null && caseCount > 0 && (
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            Based on {caseCount} {comparisonSource === 'surgeon' ? 'surgeon' : 'facility'} cases
          </span>
        )}
      </div>
    </div>
  )
}
