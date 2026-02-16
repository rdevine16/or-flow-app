'use client'

import { formatTimestamp } from '@/lib/formatters'

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

export interface MilestoneTimelineProps {
  milestoneTypes: FacilityMilestone[]
  caseMilestones: CaseMilestone[]
  onRecord: (milestoneTypeId: string) => void
  onUndo: (milestoneId: string) => void
  recordingMilestoneIds: Set<string>
  canManage: boolean
  timeZone?: string
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
      <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center shadow-md shadow-indigo-300/50 flex-shrink-0 z-10 -ml-0.5">
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
}: MilestoneTimelineProps) {
  const getRecorded = (typeId: string): CaseMilestone | undefined =>
    caseMilestones.find(cm => cm.facility_milestone_id === typeId)

  // Determine the first pending milestone index
  const firstPendingIndex = milestoneTypes.findIndex(mt => {
    const rec = getRecorded(mt.id)
    return !rec?.recorded_at
  })

  return (
    <div className="relative">
      {milestoneTypes.map((mt, index) => {
        const recorded = getRecorded(mt.id)
        const isFirstPending = index === firstPendingIndex
        const state = getNodeState(mt, recorded, isFirstPending)
        const isLast = index === milestoneTypes.length - 1
        const loading = recordingMilestoneIds.has(mt.id)

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

        return (
          <div key={mt.id} className="flex gap-3 relative group">
            {/* Left column: node + connecting line */}
            <div className="flex flex-col items-center w-8 flex-shrink-0">
              <TimelineNode state={state} />
              {!isLast && (
                <div className={`w-0.5 flex-1 min-h-[16px] ${lineClass}`} />
              )}
            </div>

            {/* Right column: content */}
            <div
              className={`flex-1 pb-5 ${isLast ? 'pb-0' : ''} ${
                state === 'next'
                  ? 'bg-indigo-50/60 border border-indigo-200/50 rounded-lg px-3 py-2.5 -mt-0.5 mb-3'
                  : ''
              }`}
            >
              <div className="flex items-center justify-between gap-2 min-h-[28px]">
                {/* Name + time */}
                <div className="min-w-0">
                  <span
                    className={`text-sm leading-tight block ${
                      state === 'completed'
                        ? 'font-medium text-slate-800'
                        : state === 'next'
                          ? 'font-bold text-indigo-900'
                          : 'font-normal text-slate-400'
                    }`}
                  >
                    {mt.display_name}
                  </span>

                  {state === 'completed' && recorded?.recorded_at && (
                    <span className="text-xs text-slate-400 font-mono tabular-nums">
                      {formatTimestamp(recorded.recorded_at, { timeZone })}
                    </span>
                  )}

                  {state === 'next' && (
                    <span className="text-xs text-indigo-500 font-medium">
                      Next milestone
                    </span>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
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
            </div>
          </div>
        )
      })}
    </div>
  )
}
