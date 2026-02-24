// components/cases/MilestoneDetailRow.tsx
// Structured 6-column milestone data table with collapsible phase headers.
// Parent phases are collapsible; subphases render as indented sub-headers within
// their parent when expanded. Shared boundary milestones appear in both phases.
// Columns: [Status Icon] [Milestone Name] [Time] [Duration] [Median] [Delta]

'use client'

import { useMemo, useState, useCallback } from 'react'
import { DeltaBadge } from '@/components/ui/DeltaBadge'
import { formatMinutes, calculateDeltaSeverity } from '@/lib/utils/milestoneAnalytics'
import type { MilestoneInterval, PhaseGroupData } from '@/lib/utils/milestoneAnalytics'
import { resolveColorKey } from '@/lib/milestone-phase-config'
import { AlertTriangle, CheckCircle2, Circle, ChevronDown, ChevronRight } from 'lucide-react'

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
  /** Phase group data for collapsible phase headers */
  phaseGroups?: PhaseGroupData[]
}

// ============================================
// N-COUNT THRESHOLD
// ============================================

const N_COUNT_THRESHOLD = 5

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
// MILESTONE ROW COMPONENT
// ============================================

function MilestoneRow({
  iv,
  isLast,
  isMissing,
  medianKey,
  deltaKey,
  isLowN,
  indent,
}: {
  iv: MilestoneInterval
  isLast: boolean
  isMissing: boolean
  medianKey: 'surgeon_median_minutes' | 'facility_median_minutes'
  deltaKey: 'delta_from_surgeon' | 'delta_from_facility'
  isLowN: boolean
  indent?: boolean
}) {
  const isRecorded = !!iv.recorded_at
  const activeMedian = iv[medianKey]
  const activeDelta = iv[deltaKey]

  return (
    <div
      className={`grid grid-cols-[28px_1fr_72px_68px_72px_80px] items-center px-3 py-2 border-b border-slate-100 last:border-b-0 ${
        isMissing ? 'bg-amber-50/60' : ''
      } ${indent ? 'pl-7' : ''}`}
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

      {/* Duration */}
      <span className="text-xs text-center text-slate-700">
        {!isLast && iv.interval_minutes != null
          ? `${Math.round(iv.interval_minutes)}m`
          : '—'}
      </span>

      {/* Median — grey out when below threshold */}
      <span className={`text-xs text-center ${isLowN ? 'text-slate-300' : 'text-slate-500'}`}>
        {!isLast && activeMedian != null
          ? `${Math.round(activeMedian)}m`
          : '—'}
      </span>

      {/* Delta */}
      <div className="flex justify-end">
        {!isLast && activeDelta != null && iv.delta_severity && !isLowN ? (
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
}

// ============================================
// PHASE HEADER ROW COMPONENT
// ============================================

function PhaseHeaderRow({
  phase,
  isExpanded,
  onToggle,
  comparisonSource,
  isSubphase,
}: {
  phase: PhaseGroupData
  isExpanded: boolean
  onToggle: () => void
  comparisonSource: 'surgeon' | 'facility'
  isSubphase?: boolean
}) {
  const colorConfig = resolveColorKey(phase.colorKey)
  const activeMedian = phase.medianMinutes
  const delta = phase.durationMinutes != null && activeMedian != null
    ? phase.durationMinutes - activeMedian
    : null
  const severity = calculateDeltaSeverity(phase.durationMinutes, activeMedian)
  const activeN = comparisonSource === 'surgeon' ? phase.surgeonN : phase.facilityN
  const isLowN = comparisonSource === 'facility' && activeN < N_COUNT_THRESHOLD

  if (isSubphase) {
    // Subphase: indented with colored left accent, lighter background
    return (
      <div
        className={`grid grid-cols-[28px_1fr_72px_68px_72px_80px] items-center pl-6 pr-3 py-2 border-b border-slate-100 ${colorConfig.headerBg}`}
      >
        {/* Colored accent dot */}
        <div className="flex items-center justify-center">
          <span className={`w-2 h-2 rounded-full ${colorConfig.accentBg} ring-2 ring-white`} />
        </div>
        <div className="min-w-0 flex items-center gap-1">
          <span className={`text-[11px] font-semibold ${colorConfig.accentText}`}>
            {phase.phaseDisplayName}
          </span>
          {activeN > 0 && (
            <span className={`text-[9px] ${isLowN ? 'text-slate-300' : 'text-slate-400'}`}>
              (n={activeN})
            </span>
          )}
        </div>
        <span />
        <span className="text-[11px] font-semibold text-center text-slate-600">
          {phase.durationMinutes != null ? formatMinutes(phase.durationMinutes) : '—'}
        </span>
        <span className={`text-[11px] font-medium text-center ${isLowN ? 'text-slate-300' : 'text-slate-400'}`}>
          {activeMedian != null ? formatMinutes(activeMedian) : '—'}
        </span>
        <div className="flex justify-end">
          {delta != null && severity && !isLowN ? (
            <DeltaBadge delta={delta} format="time" invert severity={severity} />
          ) : (
            <span className="text-xs text-slate-400">—</span>
          )}
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={onToggle}
      className={`w-full grid grid-cols-[28px_1fr_72px_68px_72px_80px] items-center px-3 py-2.5 border-b border-slate-200 hover:bg-slate-50/50 transition-colors cursor-pointer border-l-3 ${colorConfig.borderColor}`}
      aria-expanded={isExpanded}
    >
      {/* Expand/collapse icon */}
      <div className="flex items-center justify-center">
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-slate-500" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-500" />
        )}
      </div>

      {/* Phase name */}
      <div className="min-w-0 flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-sm ${colorConfig.accentBg}`} />
        <span className={`text-xs font-semibold ${colorConfig.accentText}`}>
          {phase.phaseDisplayName}
        </span>
        {activeN > 0 && (
          <span className={`text-[9px] ${isLowN ? 'text-slate-300' : 'text-slate-400'}`}>
            (n={activeN})
          </span>
        )}
      </div>

      {/* Spacer for Time column */}
      <span />

      {/* Phase duration */}
      <span className="text-xs font-semibold text-center text-slate-700">
        {phase.durationMinutes != null
          ? formatMinutes(phase.durationMinutes)
          : '—'}
      </span>

      {/* Phase median */}
      <span className={`text-xs font-medium text-center ${isLowN ? 'text-slate-300' : 'text-slate-500'}`}>
        {activeMedian != null
          ? formatMinutes(activeMedian)
          : '—'}
      </span>

      {/* Phase delta */}
      <div className="flex justify-end">
        {delta != null && severity && !isLowN ? (
          <DeltaBadge
            delta={delta}
            format="time"
            invert
            severity={severity}
          />
        ) : (
          <span className="text-xs text-slate-400">—</span>
        )}
      </div>
    </button>
  )
}

// ============================================
// EXPANDED PHASE CONTENT — interleaves subphase sections with parent milestones
// ============================================

function PhaseContent({
  phase,
  children,
  missingFlagMap,
  lastMilestoneIds,
  medianKey,
  deltaKey,
  comparisonSource,
}: {
  phase: PhaseGroupData
  children: PhaseGroupData[]
  missingFlagMap: Map<string, boolean>
  lastMilestoneIds: Set<string>
  medianKey: 'surgeon_median_minutes' | 'facility_median_minutes'
  deltaKey: 'delta_from_surgeon' | 'delta_from_facility'
  comparisonSource: 'surgeon' | 'facility'
}) {
  const phaseIsLowN = comparisonSource === 'facility' && phase.facilityN < N_COUNT_THRESHOLD

  // No subphases: render milestones flat
  if (children.length === 0) {
    return (
      <>
        {phase.intervals.map((iv) => (
          <MilestoneRow
            key={iv.facility_milestone_id}
            iv={iv}
            isLast={lastMilestoneIds.has(iv.facility_milestone_id)}
            isMissing={missingFlagMap.get(iv.facility_milestone_id) ?? false}
            medianKey={medianKey}
            deltaKey={deltaKey}
            isLowN={phaseIsLowN}
          />
        ))}
      </>
    )
  }

  // Merge parent milestones + subphase groups into display_order sequence.
  // Subphase milestones are assigned to the subphase (not parent), so parent.intervals
  // only contains milestones NOT in any subphase. We interleave by display_order.
  type Segment =
    | { type: 'milestone'; iv: MilestoneInterval; order: number }
    | { type: 'subphase'; child: PhaseGroupData; order: number }

  const segments: Segment[] = []

  // Add parent milestones
  for (const iv of phase.intervals) {
    segments.push({ type: 'milestone', iv, order: iv.display_order })
  }

  // Add subphase groups at their start_milestone display_order position
  const sortedChildren = [...children].sort((a, b) => a.displayOrder - b.displayOrder)
  for (const child of sortedChildren) {
    const firstOrder = child.intervals[0]?.display_order ?? child.displayOrder
    segments.push({ type: 'subphase', child, order: firstOrder })
  }

  // Sort by display_order so everything renders in temporal sequence
  segments.sort((a, b) => a.order - b.order)

  return (
    <>
      {segments.map((seg) => {
        if (seg.type === 'subphase') {
          const childIsLowN = comparisonSource === 'facility' && seg.child.facilityN < N_COUNT_THRESHOLD
          return (
            <div key={`sub-${seg.child.phaseId}`}>
              <PhaseHeaderRow
                phase={seg.child}
                isExpanded={false}
                onToggle={() => {}}
                comparisonSource={comparisonSource}
                isSubphase
              />
              {seg.child.intervals.map((iv) => (
                <MilestoneRow
                  key={iv.facility_milestone_id}
                  iv={iv}
                  isLast={lastMilestoneIds.has(iv.facility_milestone_id)}
                  isMissing={missingFlagMap.get(iv.facility_milestone_id) ?? false}
                  medianKey={medianKey}
                  deltaKey={deltaKey}
                  isLowN={childIsLowN}
                  indent
                />
              ))}
            </div>
          )
        }
        return (
          <MilestoneRow
            key={seg.iv.facility_milestone_id}
            iv={seg.iv}
            isLast={lastMilestoneIds.has(seg.iv.facility_milestone_id)}
            isMissing={missingFlagMap.get(seg.iv.facility_milestone_id) ?? false}
            medianKey={medianKey}
            deltaKey={deltaKey}
            isLowN={phaseIsLowN}
          />
        )
      })}
    </>
  )
}

// ============================================
// MAIN TABLE COMPONENT
// ============================================

export function MilestoneTable({
  intervals,
  comparisonSource,
  facilityCaseCount,
  missingFlags,
  totalCaseMinutes,
  phaseGroups,
}: MilestoneTableProps) {
  const medianLabel = comparisonSource === 'surgeon' ? 'Surg Med' : 'Fac Med'
  const medianKey = comparisonSource === 'surgeon' ? 'surgeon_median_minutes' : 'facility_median_minutes' as const
  const deltaKey = comparisonSource === 'surgeon' ? 'delta_from_surgeon' : 'delta_from_facility' as const

  // Low n-count detection for milestone-level medians
  const isLowN = comparisonSource === 'facility' && facilityCaseCount < N_COUNT_THRESHOLD

  // Build parent → children map
  const { parentPhases, childrenMap } = useMemo(() => {
    if (!phaseGroups || phaseGroups.length === 0) {
      return { parentPhases: [] as PhaseGroupData[], childrenMap: new Map<string, PhaseGroupData[]>() }
    }
    const parents = phaseGroups.filter((pg) => !pg.parentPhaseId)
    const cMap = new Map<string, PhaseGroupData[]>()
    for (const pg of phaseGroups) {
      if (pg.parentPhaseId) {
        const existing = cMap.get(pg.parentPhaseId) ?? []
        existing.push(pg)
        cMap.set(pg.parentPhaseId, existing)
      }
    }
    return { parentPhases: parents, childrenMap: cMap }
  }, [phaseGroups])

  // Track expanded/collapsed phases (default: all collapsed)
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(() => new Set())

  const togglePhase = useCallback((phaseId: string) => {
    setExpandedPhases((prev) => {
      const next = new Set(prev)
      if (next.has(phaseId)) {
        next.delete(phaseId)
      } else {
        next.add(phaseId)
      }
      return next
    })
  }, [])

  // Build missing flags lookup by facility_milestone_id for phase-grouped rendering
  const missingFlagMap = useMemo(() => {
    const map = new Map<string, boolean>()
    intervals.forEach((iv, idx) => {
      map.set(iv.facility_milestone_id, missingFlags[idx] ?? false)
    })
    return map
  }, [intervals, missingFlags])

  // Find the last milestone for "isLast" logic (last milestone shows no duration)
  const lastMilestoneIds = useMemo(() => {
    const set = new Set<string>()
    if (intervals.length > 0) {
      set.add(intervals[intervals.length - 1].facility_milestone_id)
    }
    return set
  }, [intervals])

  // Footer shows total case duration only — no summed median or delta.
  // Phase-level and interval-level medians are statistically independent
  // (median of sums ≠ sum of medians), so summing them would be misleading.

  const hasPhaseGroups = parentPhases.length > 0

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
          Duration
        </span>
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-center">
          {medianLabel}
        </span>
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-right">
          Delta
        </span>
      </div>

      {/* Phase-grouped data rows — parent phases only at top level */}
      {hasPhaseGroups ? (
        <>
          {parentPhases.map((phase) => {
            const isExpanded = expandedPhases.has(phase.phaseId)
            const children = childrenMap.get(phase.phaseId) ?? []

            return (
              <div key={phase.phaseId}>
                <PhaseHeaderRow
                  phase={phase}
                  isExpanded={isExpanded}
                  onToggle={() => togglePhase(phase.phaseId)}
                  comparisonSource={comparisonSource}
                />
                {isExpanded && (
                  <PhaseContent
                    phase={phase}
                    children={children}
                    missingFlagMap={missingFlagMap}
                    lastMilestoneIds={lastMilestoneIds}
                    medianKey={medianKey}
                    deltaKey={deltaKey}
                    comparisonSource={comparisonSource}
                  />
                )}
              </div>
            )
          })}
        </>
      ) : (
        /* Flat list fallback when no phase definitions */
        intervals.map((iv, idx) => (
          <MilestoneRow
            key={iv.facility_milestone_id}
            iv={iv}
            isLast={idx === intervals.length - 1}
            isMissing={missingFlags[idx] ?? false}
            medianKey={medianKey}
            deltaKey={deltaKey}
            isLowN={isLowN}
          />
        ))
      )}

      {/* Summary footer row — duration only, no summed median/delta */}
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
          <span />
          <span />
        </div>
      )}
    </div>
  )
}

// Default export aliased for backward compatibility
export default MilestoneTable
