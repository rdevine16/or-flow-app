'use client'

import { useState } from 'react'
import { Clock } from 'lucide-react'
import { formatTimestamp } from '@/lib/formatters'
import FlagBadge from './FlagBadge'
import DelayNode from './DelayNode'
import AddDelayForm, { type DelayTypeOption } from './AddDelayForm'

// ============================================================================
// TYPES
// ============================================================================

interface FacilityMilestone {
  id: string
  name: string
  display_name: string
  display_order: number
  pair_with_id: string | null
  pair_position: 'start' | 'end' | null
  source_milestone_type_id: string | null
}

interface CaseMilestone {
  id: string
  facility_milestone_id: string
  recorded_at: string | null
}

export interface CaseFlagForTimeline {
  id: string
  flag_type: 'threshold' | 'delay'
  severity: 'critical' | 'warning' | 'info'
  label: string
  detail: string | null
  facility_milestone_id: string | null
  duration_minutes: number | null
  note: string | null
  created_by: string | null
}

export interface MilestoneTimelineProps {
  milestoneTypes: FacilityMilestone[]
  caseMilestones: CaseMilestone[]
  onRecord: (milestoneTypeId: string) => void
  onUndo: (milestoneId: string) => void
  recordingMilestoneIds: Set<string>
  canManage: boolean
  timeZone?: string
  // Phase 4: Flags & delays
  caseFlags?: CaseFlagForTimeline[]
  delayTypes?: DelayTypeOption[]
  onAddDelay?: (data: {
    delayTypeId: string
    durationMinutes: number | null
    note: string | null
    facilityMilestoneId: string
  }) => Promise<void>
  onRemoveDelay?: (flagId: string) => void
  canCreateFlags?: boolean
  currentUserId?: string | null
}

// ============================================================================
// HELPERS
// ============================================================================

type NodeState = 'completed' | 'next' | 'pending'

function getNodeState(
  milestone: FacilityMilestone,
  recorded: CaseMilestone | undefined,
  isFirstPending: boolean
): NodeState {
  if (recorded?.recorded_at) return 'completed'
  if (isFirstPending) return 'next'
  return 'pending'
}

// ============================================================================
// TIMELINE NODE — SVG circle for each milestone
// ============================================================================

function TimelineNode({ state }: { state: NodeState }) {
  if (state === 'completed') {
    return (
      <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm shadow-emerald-200 flex-shrink-0 z-10">
        <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      </div>
    )
  }

  if (state === 'next') {
    return (
      <div className="w-[34px] h-[34px] rounded-full bg-indigo-500 flex items-center justify-center shadow-[0_0_0_5px_rgba(99,102,241,0.12),0_4px_12px_rgba(99,102,241,0.2)] flex-shrink-0 z-10 -ml-[3px]">
        <div className="relative">
          <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" />
          <div className="absolute inset-0 w-2.5 h-2.5 bg-white rounded-full animate-ping opacity-30" />
        </div>
      </div>
    )
  }

  // pending
  return (
    <div className="w-7 h-7 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center flex-shrink-0 z-10 bg-white">
      <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
    </div>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function MilestoneTimelineV2({
  milestoneTypes,
  caseMilestones,
  onRecord,
  onUndo,
  recordingMilestoneIds,
  canManage,
  timeZone,
  caseFlags = [],
  delayTypes = [],
  onAddDelay,
  onRemoveDelay,
  canCreateFlags = false,
  currentUserId = null,
}: MilestoneTimelineProps) {
  const [openDelayFormMilestoneId, setOpenDelayFormMilestoneId] = useState<string | null>(null)

  const getRecorded = (typeId: string): CaseMilestone | undefined =>
    caseMilestones.find(cm => cm.facility_milestone_id === typeId)

  // Group flags by milestone
  const flagsByMilestone = new Map<string, CaseFlagForTimeline[]>()
  for (const flag of caseFlags) {
    if (flag.facility_milestone_id) {
      const existing = flagsByMilestone.get(flag.facility_milestone_id) || []
      existing.push(flag)
      flagsByMilestone.set(flag.facility_milestone_id, existing)
    }
  }

  // Separate threshold flags from delay flags per milestone
  const getThresholdFlags = (milestoneId: string) =>
    (flagsByMilestone.get(milestoneId) || []).filter(f => f.flag_type === 'threshold')

  const getDelayFlags = (milestoneId: string) =>
    (flagsByMilestone.get(milestoneId) || []).filter(f => f.flag_type === 'delay')

  // Determine the first pending milestone index
  const firstPendingIndex = milestoneTypes.findIndex(mt => {
    const rec = getRecorded(mt.id)
    return !rec?.recorded_at
  })

  const toggleDelayForm = (milestoneId: string) => {
    setOpenDelayFormMilestoneId(prev => (prev === milestoneId ? null : milestoneId))
  }

  return (
    <div className="relative">
      {milestoneTypes.map((mt, index) => {
        const recorded = getRecorded(mt.id)
        const isFirstPending = index === firstPendingIndex
        const state = getNodeState(mt, recorded, isFirstPending)
        const isLast = index === milestoneTypes.length - 1
        const loading = recordingMilestoneIds.has(mt.id)

        const thresholdFlags = getThresholdFlags(mt.id)
        const delayFlags = getDelayFlags(mt.id)
        const showDelayForm = openDelayFormMilestoneId === mt.id

        // Determine connecting line style
        const nextMt = !isLast ? milestoneTypes[index + 1] : null
        const nextRecorded = nextMt ? getRecorded(nextMt.id) : null
        const nextIsCompleted = !!nextRecorded?.recorded_at

        let lineClass = 'bg-slate-200/40' // default: pending-to-pending
        if (state === 'completed' && nextIsCompleted) {
          lineClass = 'bg-emerald-400' // completed-to-completed
        } else if (state === 'completed' && !nextIsCompleted) {
          lineClass = 'bg-gradient-to-b from-emerald-400 to-slate-200/40' // completed-to-next/pending
        }

        // Can log delay on completed or next milestones
        const canLogDelay = canCreateFlags && (state === 'completed' || state === 'next') && onAddDelay && delayTypes.length > 0

        return (
          <div key={mt.id}>
            {/* Milestone row */}
            <div className="flex gap-4 relative group">
              {/* Left column: node + connecting line */}
              <div className="flex flex-col items-center w-10 flex-shrink-0">
                <TimelineNode state={state} />
                {(!isLast || delayFlags.length > 0) && (
                  <div className={`w-0.5 flex-1 min-h-[16px] ${isLast && delayFlags.length > 0 ? 'bg-slate-200/40' : lineClass}`} />
                )}
              </div>

              {/* Right column: content */}
              <div
                className={`flex-1 pb-5 ${isLast && delayFlags.length === 0 ? 'pb-0' : ''} ${
                  state === 'next'
                    ? 'bg-indigo-50/60 border border-indigo-200/50 rounded-lg px-3 py-2.5 -mt-0.5 mb-3'
                    : ''
                } relative overflow-visible`}
              >
                <div className="flex items-center justify-between gap-2 min-h-[28px]">
                  {/* Name + time + flag badges */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span
                        className={`text-[13.5px] leading-tight ${
                          state === 'completed'
                            ? 'font-medium text-slate-700'
                            : state === 'next'
                              ? 'font-bold text-indigo-950'
                              : 'font-normal text-slate-400'
                        }`}
                      >
                        {mt.display_name}
                      </span>

                      {/* Recorded time — inline with name */}
                      {state === 'completed' && recorded?.recorded_at && (
                        <span className="text-[11.5px] text-slate-400 font-mono tabular-nums font-medium">
                          {formatTimestamp(recorded.recorded_at, { timeZone })}
                        </span>
                      )}

                      {/* Threshold flag badges inline */}
                      {thresholdFlags.map(flag => (
                        <FlagBadge
                          key={flag.id}
                          severity={flag.severity}
                          label={flag.label}
                          detail={flag.detail}
                        />
                      ))}
                    </div>

                    {state === 'next' && (
                      <span className="text-xs text-indigo-400 font-medium mt-0.5 block">
                        Next milestone — ready to record
                      </span>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {/* Clock button — log delay (completed/next milestones, on hover) */}
                    {canLogDelay && (
                      <button
                        onClick={() => toggleDelayForm(mt.id)}
                        className={`p-1.5 rounded-lg transition-all ${
                          showDelayForm
                            ? 'text-amber-600 bg-amber-50'
                            : state === 'next'
                              ? 'text-indigo-400 hover:text-amber-600 hover:bg-amber-50'
                              : 'opacity-0 group-hover:opacity-100 text-slate-300 hover:text-amber-600 hover:bg-amber-50'
                        }`}
                        title={`Log delay at ${mt.display_name}`}
                      >
                        <Clock className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Undo button — completed milestones, shown on hover */}
                    {state === 'completed' && recorded && canManage && (
                      <button
                        onClick={() => onUndo(recorded.id)}
                        disabled={loading}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-300 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all disabled:opacity-50"
                        title={`Undo ${mt.display_name}`}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                        </svg>
                      </button>
                    )}

                    {/* Record button — "next" milestone gets primary style */}
                    {state === 'next' && canManage && (
                      <button
                        onClick={() => onRecord(mt.id)}
                        disabled={loading}
                        className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all active:scale-[0.97] ${
                          loading
                            ? 'bg-slate-300 text-white cursor-not-allowed'
                            : 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-sm shadow-indigo-300/40 hover:shadow-md hover:shadow-indigo-400/40'
                        }`}
                      >
                        {loading ? 'Recording...' : 'Record'}
                      </button>
                    )}

                    {/* Record button — other pending milestones, shown on hover */}
                    {state === 'pending' && canManage && (
                      <button
                        onClick={() => onRecord(mt.id)}
                        disabled={loading}
                        className="opacity-0 group-hover:opacity-100 px-3 py-1.5 text-xs font-semibold text-slate-500 border border-slate-200 rounded-lg hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all disabled:opacity-50"
                      >
                        {loading ? 'Recording...' : 'Record'}
                      </button>
                    )}
                  </div>
                </div>

                {/* AddDelayForm popover — positioned below the milestone row */}
                {showDelayForm && onAddDelay && (
                  <AddDelayForm
                    delayTypes={delayTypes}
                    milestoneId={mt.id}
                    milestoneName={mt.display_name}
                    onSubmit={onAddDelay}
                    onClose={() => setOpenDelayFormMilestoneId(null)}
                  />
                )}
              </div>
            </div>

            {/* Delay nodes — rendered between this milestone and the next */}
            {delayFlags.map(delay => (
              <DelayNode
                key={delay.id}
                id={delay.id}
                delayTypeName={delay.label}
                durationMinutes={delay.duration_minutes}
                note={delay.note}
                canRemove={!!onRemoveDelay && delay.created_by === currentUserId}
                onRemove={onRemoveDelay}
              />
            ))}
          </div>
        )
      })}
    </div>
  )
}
