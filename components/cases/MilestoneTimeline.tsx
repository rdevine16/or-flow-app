// components/cases/MilestoneTimeline.tsx
// Horizontal swimlane timeline showing proportional milestone segments.
// Each milestone is a node; segments between them are proportional to milestone duration.
// Includes surgeon/facility median overlay as dashed line markers.

'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import {
  calculateSwimlaneSections,
  formatMinutes,
  type MilestoneInterval,
} from '@/lib/utils/milestoneAnalytics'

interface MilestoneTimelineProps {
  intervals: MilestoneInterval[]
  totalCaseMinutes: number | null
  comparisonSource: 'surgeon' | 'facility'
}

type NodeState = 'recorded' | 'in-progress' | 'pending' | 'missing'

const NODE_STYLES: Record<NodeState, string> = {
  recorded: 'bg-teal-500 border-teal-500',
  'in-progress': 'bg-blue-400 border-blue-400 animate-pulse',
  pending: 'bg-white border-slate-300',
  missing: 'bg-amber-100 border-amber-400',
}

export default function MilestoneTimeline({
  intervals,
  totalCaseMinutes,
  comparisonSource,
}: MilestoneTimelineProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const sections = useMemo(
    () => calculateSwimlaneSections(intervals, totalCaseMinutes),
    [intervals, totalCaseMinutes],
  )

  // Determine node states — if a later milestone is recorded but this one isn't, mark as missing
  const nodeStates = useMemo(() => {
    const lastRecordedIdx = intervals.reduce(
      (last, iv, idx) => (iv.recorded_at ? idx : last),
      -1,
    )
    return intervals.map((iv, idx): NodeState => {
      if (iv.recorded_at) return 'recorded'
      if (idx < lastRecordedIdx) return 'missing'
      return 'pending'
    })
  }, [intervals])

  // Pre-compute cumulative positions for node placement
  // Last node is clamped to 100% so it sits at the right edge of the bar
  const nodePositions = useMemo(() => {
    const positions = sections.reduce<number[]>((acc, section, idx) => {
      if (idx === 0) {
        acc.push(0)
      } else {
        acc.push(acc[idx - 1] + sections[idx - 1].width_percent)
      }
      return acc
    }, [])
    if (positions.length > 1) {
      positions[positions.length - 1] = 100
    }
    return positions
  }, [sections])

  // Calculate median node positions (cumulative median durations as % of total median)
  const medianPositions = useMemo(() => {
    const getMedian = (iv: MilestoneInterval) =>
      comparisonSource === 'surgeon' ? iv.surgeon_median_minutes : iv.facility_median_minutes
    const totalMedian = intervals.reduce((s: number, iv) => s + (getMedian(iv) ?? 0), 0)
    if (totalMedian <= 0) return null

    let cumulative = 0
    // Each position marks the boundary after a milestone's median duration
    return intervals.slice(0, -1).map((iv) => {
      cumulative += getMedian(iv) ?? 0
      return (cumulative / totalMedian) * 100
    })
  }, [intervals, comparisonSource])

  if (intervals.length === 0) return null

  return (
    <div className="space-y-2">
      {/* Timeline bar */}
      <div className="relative pt-6 pb-4">
        {/* Segments container */}
        <div className="flex items-center w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
          {sections.map((section, idx) => {
            if (idx === sections.length - 1) return null // Last node has no following segment
            const currState = nodeStates[idx]
            const nextState = nodeStates[idx + 1]
            const isRecordedSegment = currState === 'recorded' && nextState === 'recorded'
            const isMissing = currState === 'missing' || nextState === 'missing'

            return (
              <div
                key={section.facility_milestone_id}
                className={`h-full transition-opacity ${
                  isRecordedSegment
                    ? 'bg-teal-400'
                    : isMissing
                    ? 'bg-amber-200'
                    : 'bg-slate-200'
                } ${hoveredIndex === idx ? 'opacity-80' : ''}`}
                style={{ width: `${section.width_percent}%` }}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
            )
          })}
        </div>

        {/* Nodes overlaid on the timeline */}
        <div className="absolute inset-x-0 top-6 flex items-center" style={{ height: '8px' }}>
          {sections.map((section, idx) => {
            const position = nodePositions[idx]
            const state = nodeStates[idx]
            const iv = intervals[idx]
            const nodeAriaLabel = (() => {
              const timeStr = iv.recorded_at
                ? `recorded at ${new Date(iv.recorded_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`
                : state === 'missing' ? 'not recorded' : 'pending'
              const durationStr = idx < sections.length - 1 && iv.interval_minutes != null
                ? `, ${Math.round(iv.interval_minutes)} minutes duration`
                : ''
              return `${section.milestone_name} milestone, ${timeStr}${durationStr}`
            })()

            const isFirst = idx === 0
            const isLast = idx === sections.length - 1
            const showLabel = isFirst || isLast || hoveredIndex === idx

            // Label alignment: left-align first, right-align last, center middle
            const labelAlign = isFirst
              ? 'left-0'
              : isLast
              ? 'right-0'
              : 'left-1/2 -translate-x-1/2'

            return (
              <div
                key={section.facility_milestone_id}
                className="absolute -translate-x-1/2"
                style={{ left: `${position}%` }}
                role="img"
                aria-label={nodeAriaLabel}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {/* Invisible hit area for smoother hover */}
                <div className="absolute -inset-2" aria-hidden="true" />

                {/* Node */}
                {state === 'missing' ? (
                  <div className={`w-4 h-4 -mt-1 flex items-center justify-center transition-transform duration-150 ease-out ${hoveredIndex === idx ? 'scale-[1.4]' : ''}`} aria-hidden="true">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  </div>
                ) : (
                  <div
                    className={`w-3 h-3 -mt-0.5 rounded-full border-2 transition-transform duration-150 ease-out ${NODE_STYLES[state]} ${hoveredIndex === idx ? 'scale-[1.4]' : ''}`}
                    aria-hidden="true"
                  />
                )}

                {/* Name label above — only first, last, and hovered */}
                {showLabel && (
                  <div className={`absolute bottom-full mb-1 whitespace-nowrap ${labelAlign}`}>
                    <span className={`text-[10px] font-medium ${
                      state === 'recorded' ? 'text-slate-700' :
                      state === 'missing' ? 'text-amber-600' :
                      'text-slate-400'
                    }`}>
                      {section.milestone_name}
                    </span>
                  </div>
                )}

                {/* Tooltip on hover */}
                {hoveredIndex === idx && idx < sections.length - 1 && (
                  <div className={`absolute top-full mt-2 z-10 whitespace-nowrap bg-slate-800 text-white text-[11px] px-2.5 py-1.5 rounded-md shadow-lg ${
                    isLast ? 'right-0' : 'left-1/2 -translate-x-1/2'
                  }`}>
                    <div className="font-medium">
                      {section.milestone_name} → {intervals[idx + 1]?.milestone_name}
                    </div>
                    <div className="text-slate-300 mt-0.5">
                      {formatMinutes(intervals[idx].interval_minutes)}
                      {intervals[idx][comparisonSource === 'surgeon' ? 'surgeon_median_minutes' : 'facility_median_minutes'] != null && (
                        <span>
                          {' '}(Median: {formatMinutes(
                            intervals[idx][comparisonSource === 'surgeon' ? 'surgeon_median_minutes' : 'facility_median_minutes']
                          )})
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Median overlay — dashed line markers */}
        {medianPositions && (
          <div className="absolute inset-x-0 top-6" style={{ height: '8px' }}>
            {medianPositions.map((pos, idx) => (
              <div
                key={`median-${idx}`}
                className="absolute top-0 h-4 -mt-1 border-l border-dashed border-slate-400/50"
                style={{ left: `${pos}%` }}
                aria-hidden="true"
              />
            ))}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px] text-slate-500">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-teal-500" /> Recorded
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-white border border-slate-300" /> Pending
        </span>
        <span className="flex items-center gap-1">
          <AlertTriangle className="w-2.5 h-2.5 text-amber-500" /> Missing
        </span>
        {medianPositions && (
          <span className="flex items-center gap-1">
            <span className="w-3 h-0 border-t border-dashed border-slate-400" /> Median
          </span>
        )}
      </div>
    </div>
  )
}
