// components/cases/CaseDrawerMilestones.tsx
// Revamped milestones tab with horizontal swimlane timeline, structured 6-column
// data table with collapsible phase headers, time allocation bar, and comparison toggle.

'use client'

import { useMemo } from 'react'
import { useMilestoneComparison } from '@/lib/hooks/useMilestoneComparison'
import MilestoneComparisonToggle from '@/components/cases/MilestoneComparisonToggle'
import MilestoneTimeline from '@/components/cases/MilestoneTimeline'
import { MilestoneTable } from '@/components/cases/MilestoneDetailRow'
import TimeAllocationBar from '@/components/cases/TimeAllocationBar'
import {
  Clock,
  Loader2,
} from 'lucide-react'

// ============================================
// TYPES
// ============================================

interface CaseDrawerMilestonesProps {
  caseId: string
  surgeonId: string | null
  procedureTypeId: string | null
  facilityId: string | null
  milestoneTemplateId?: string | null
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
  milestoneTemplateId,
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
    milestoneTemplateId,
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

  // Loading state
  if (loading && !data) {
    return (
      <div className="space-y-4 animate-pulse">
        {/* Toggle bar + counter */}
        <div className="flex items-center justify-between">
          <div className="h-4 bg-slate-200 rounded w-36" />
          <div className="h-7 bg-slate-100 rounded-lg w-48" />
        </div>
        {/* Timeline bar with node circles */}
        <div className="relative pt-6 pb-4">
          <div className="flex items-center gap-0.5 w-full">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex-1 flex items-center">
                <div className="w-3 h-3 rounded-full bg-slate-200 flex-shrink-0" />
                {i < 6 && <div className="flex-1 h-2 bg-slate-100 rounded-full mx-0.5" />}
              </div>
            ))}
          </div>
        </div>
        {/* Table: header + 8 shimmer rows */}
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <div className="grid grid-cols-[28px_1fr_72px_60px_68px_80px] gap-2 px-3 py-2 bg-slate-50">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-3 bg-slate-200 rounded" />
            ))}
          </div>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="grid grid-cols-[28px_1fr_72px_60px_68px_80px] gap-2 px-3 py-2.5 border-t border-slate-100">
              <div className="w-4 h-4 rounded-full bg-slate-100" />
              <div className="h-4 bg-slate-100 rounded w-3/4" />
              <div className="h-4 bg-slate-100 rounded w-2/3 ml-auto" />
              <div className="h-4 bg-slate-100 rounded w-1/2 ml-auto" />
              <div className="h-4 bg-slate-100 rounded w-1/2 ml-auto" />
              <div className="h-5 bg-slate-100 rounded w-full ml-auto" />
            </div>
          ))}
        </div>
        {/* Allocation bar */}
        <div className="space-y-2">
          <div className="h-3 bg-slate-100 rounded w-36" />
          <div className="h-6 bg-slate-100 rounded-md" />
          <div className="flex gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-3 bg-slate-100 rounded w-16" />
            ))}
          </div>
        </div>
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

  // Empty state — differentiate "not started" vs "not configured"
  if (!data || data.intervals.length === 0) {
    const isScheduled = caseStatus === 'scheduled'
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
          <Clock className="w-6 h-6 text-slate-400" />
        </div>
        <p className="text-sm font-medium text-slate-900">
          {isScheduled ? 'Case not started' : 'No milestones'}
        </p>
        <p className="text-xs text-slate-500 mt-1">
          {isScheduled
            ? 'Milestone data will appear once the case begins'
            : 'No milestones are configured for this procedure'}
        </p>
      </div>
    )
  }

  const recordedCount = data.intervals.filter((iv) => iv.recorded_at).length
  const totalCount = data.intervals.length
  const allRecorded = recordedCount === totalCount

  return (
    <div className="space-y-4">
      {/* Header: milestone counter (left) + comparison toggle (right) */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium ${allRecorded ? 'text-slate-600' : 'text-amber-600'}`}>
            {recordedCount}/{totalCount} milestones recorded
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

      {/* Horizontal swimlane timeline */}
      <MilestoneTimeline
        intervals={data.intervals}
        totalCaseMinutes={data.total_case_minutes}
        comparisonSource={comparisonSource}
      />

      {/* Structured milestone table with phase headers */}
      <MilestoneTable
        intervals={data.intervals}
        comparisonSource={comparisonSource}
        surgeonCaseCount={surgeonCaseCount}
        facilityCaseCount={facilityCaseCount}
        missingFlags={missingFlags}
        totalCaseMinutes={data.total_case_minutes}
        totalSurgicalMinutes={data.total_surgical_minutes}
        phaseGroups={data.phase_groups}
      />

      {/* Time allocation bar */}
      {data.time_allocation.length > 0 && (
        <TimeAllocationBar allocations={data.time_allocation} />
      )}
    </div>
  )
}
