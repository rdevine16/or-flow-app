// components/cases/CaseDrawerMilestones.tsx
// Revamped milestones tab with horizontal swimlane timeline, per-interval
// surgeon/facility benchmarking, time allocation bar, and comparison toggle.

'use client'

import { useMemo } from 'react'
import { useMilestoneComparison } from '@/lib/hooks/useMilestoneComparison'
import { DeltaBadge } from '@/components/ui/DeltaBadge'
import { formatMinutes } from '@/lib/utils/milestoneAnalytics'
import MilestoneComparisonToggle from '@/components/cases/MilestoneComparisonToggle'
import MilestoneTimeline from '@/components/cases/MilestoneTimeline'
import MilestoneDetailRow from '@/components/cases/MilestoneDetailRow'
import TimeAllocationBar from '@/components/cases/TimeAllocationBar'
import {
  Clock,
  Loader2,
  AlertTriangle,
} from 'lucide-react'

// ============================================
// TYPES
// ============================================

interface CaseDrawerMilestonesProps {
  caseId: string
  surgeonId: string | null
  procedureTypeId: string | null
  facilityId: string | null
  caseStatus: string
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function CaseDrawerMilestones({
  caseId,
  surgeonId,
  procedureTypeId,
  facilityId,
  caseStatus,
}: CaseDrawerMilestonesProps) {
  const {
    data,
    loading,
    error,
    comparisonSource,
    setComparisonSource,
    surgeonCaseCount,
    facilityCaseCount,
  } = useMilestoneComparison({
    caseId,
    surgeonId,
    procedureTypeId,
    facilityId,
  })

  // Determine which milestones are "missing" (unrecorded with later milestones recorded)
  const missingFlags = useMemo(() => {
    if (!data?.intervals) return []
    const intervals = data.intervals
    const lastRecordedIdx = intervals.reduce(
      (last, iv, idx) => (iv.recorded_at ? idx : last),
      -1,
    )
    return intervals.map((iv, idx) => !iv.recorded_at && idx < lastRecordedIdx)
  }, [data])

  const isCompleted = caseStatus === 'completed'

  // Loading state
  if (loading && !data) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-4 bg-slate-200 rounded w-1/4" />
        <div className="h-8 bg-slate-100 rounded-full" />
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-14 bg-slate-50 rounded-lg" />
          ))}
        </div>
        <div className="h-6 bg-slate-100 rounded" />
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-sm text-red-600">Failed to load milestone data</p>
        <p className="text-xs text-slate-500 mt-1">{error}</p>
      </div>
    )
  }

  // Empty state — no milestones configured
  if (!data || data.intervals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
          <Clock className="w-6 h-6 text-slate-400" />
        </div>
        <p className="text-sm font-medium text-slate-900">No milestones</p>
        <p className="text-xs text-slate-500 mt-1">
          No milestones are configured for this procedure
        </p>
      </div>
    )
  }

  const recordedCount = data.intervals.filter((iv) => iv.recorded_at).length

  return (
    <div className="space-y-5">
      {/* Header: title + toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            Milestone Timeline
          </span>
          <span className="text-xs text-slate-400">
            {recordedCount}/{data.intervals.length} recorded
          </span>
          {loading && <Loader2 className="w-3 h-3 text-slate-400 animate-spin" />}
        </div>
        <MilestoneComparisonToggle
          comparisonSource={comparisonSource}
          onSourceChange={setComparisonSource}
          surgeonCaseCount={surgeonCaseCount}
          facilityCaseCount={facilityCaseCount}
        />
      </div>

      {/* Missing milestone alert banner */}
      {isCompleted && data.missing_milestones.length > 0 && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200">
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-amber-800">
              {data.missing_milestones.length} milestone{data.missing_milestones.length > 1 ? 's' : ''} not recorded
            </p>
            <p className="text-[11px] text-amber-600 mt-0.5">
              {data.missing_milestones.join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* Horizontal swimlane timeline */}
      <MilestoneTimeline
        intervals={data.intervals}
        totalCaseMinutes={data.total_case_minutes}
        comparisonSource={comparisonSource}
      />

      {/* Detail rows */}
      <div className="space-y-0.5">
        {data.intervals.map((interval, idx) => (
          <MilestoneDetailRow
            key={interval.facility_milestone_id}
            interval={interval}
            index={idx}
            comparisonSource={comparisonSource}
            surgeonCaseCount={surgeonCaseCount}
            facilityCaseCount={facilityCaseCount}
            isMissing={missingFlags[idx] ?? false}
          />
        ))}
      </div>

      {/* Time allocation bar */}
      {data.time_allocation.length > 0 && (
        <div className="border-t border-slate-200 pt-4">
          <TimeAllocationBar allocations={data.time_allocation} />
        </div>
      )}

      {/* Summary footer */}
      <SummaryFooter
        totalCaseMinutes={data.total_case_minutes}
        totalSurgicalMinutes={data.total_surgical_minutes}
        intervals={data.intervals}
        comparisonSource={comparisonSource}
      />
    </div>
  )
}

// ============================================
// SUMMARY FOOTER
// ============================================

function SummaryFooter({
  totalCaseMinutes,
  totalSurgicalMinutes,
  intervals,
  comparisonSource,
}: {
  totalCaseMinutes: number | null
  totalSurgicalMinutes: number | null
  intervals: import('@/lib/utils/milestoneAnalytics').MilestoneInterval[]
  comparisonSource: 'surgeon' | 'facility'
}) {
  // Compute total median for comparison
  const medianKey = comparisonSource === 'surgeon' ? 'surgeon_median_minutes' : 'facility_median_minutes'
  const totalMedian = useMemo(() => {
    const sum = intervals
      .filter((iv) => iv[medianKey] != null)
      .reduce((s, iv) => s + (iv[medianKey] ?? 0), 0)
    return sum > 0 ? sum : null
  }, [intervals, medianKey])

  const totalDelta = totalCaseMinutes != null && totalMedian != null
    ? totalCaseMinutes - totalMedian
    : null

  // Compute surgical median
  const surgicalIntervals = intervals.filter((iv) => iv.phase_group === 'surgical')
  const surgicalMedian = useMemo(() => {
    const sum = surgicalIntervals
      .filter((iv) => iv[medianKey] != null)
      .reduce((s, iv) => s + (iv[medianKey] ?? 0), 0)
    return sum > 0 ? sum : null
  }, [surgicalIntervals, medianKey])

  const surgicalDelta = totalSurgicalMinutes != null && surgicalMedian != null
    ? totalSurgicalMinutes - surgicalMedian
    : null

  const stats = [
    {
      label: 'Total Case Time',
      value: totalCaseMinutes,
      delta: totalDelta,
      median: totalMedian,
    },
    {
      label: 'Surgical Time',
      value: totalSurgicalMinutes,
      delta: surgicalDelta,
      median: surgicalMedian,
    },
  ]

  if (totalCaseMinutes == null && totalSurgicalMinutes == null) return null

  return (
    <div className="border-t border-slate-200 pt-4">
      <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
        Duration Summary
      </span>
      <div className="bg-slate-50 rounded-lg p-3 mt-2 divide-y divide-slate-200">
        {stats.map((stat) => (
          <div key={stat.label} className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
            <div>
              <span className="text-sm font-medium text-slate-700">{stat.label}</span>
              <span className="text-sm text-slate-900 ml-2 font-semibold">
                {formatMinutes(stat.value)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {stat.median != null && (
                <span className="text-[10px] text-slate-400">
                  median {formatMinutes(stat.median)}
                </span>
              )}
              {stat.delta != null && (
                <DeltaBadge
                  delta={stat.delta}
                  format="time"
                  invert
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
