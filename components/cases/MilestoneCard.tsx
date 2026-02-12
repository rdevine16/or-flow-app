// components/cases/MilestoneCard.tsx
// Milestone recording card with paired milestone support
// Extracted from cases/[id]/page.tsx

'use client'

import { formatTimestamp, formatTimestamp24 } from '@/lib/formatters'
import { type MilestonePaceInfo, MIN_SAMPLE_SIZE } from '@/lib/pace-utils'

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

export interface MilestoneCardData {
  milestone: FacilityMilestone
  recorded: CaseMilestone | undefined
  isPaired: boolean
  partner: FacilityMilestone | undefined
  partnerRecorded: CaseMilestone | undefined
  elapsedDisplay: string
  displayName: string
  isComplete: boolean
  isInProgress: boolean
}

interface MilestoneCardProps {
  card: MilestoneCardData
  onRecord: () => void
  onRecordEnd: () => void
  onUndo: () => void
  onUndoEnd: () => void
  loading?: boolean
  timeZone?: string
  paceInfo?: MilestonePaceInfo | null
}

export default function MilestoneCard({ card, onRecord, onRecordEnd, onUndo, onUndoEnd, loading = false, timeZone, paceInfo }: MilestoneCardProps) {
  const { recorded, isPaired, partnerRecorded, elapsedDisplay, displayName, isComplete, isInProgress } = card

  const isNotStarted = !recorded?.recorded_at
  const showUndo = isComplete || isInProgress

  return (
    <div className={`
      relative rounded-2xl transition-all duration-300 overflow-hidden
      ${isComplete 
        ? 'bg-gradient-to-br from-emerald-50 to-emerald-100/50 shadow-sm shadow-emerald-200/50' 
        : isInProgress 
          ? 'bg-gradient-to-br from-blue-50 to-indigo-50 shadow-md shadow-blue-200/50 ring-2 ring-blue-400/30' 
          : 'bg-white shadow-sm hover:shadow-md border border-slate-200/60'
      }
    `}>
      {/* Top accent bar */}
      <div className={`h-1 w-full ${
        isComplete 
          ? 'bg-gradient-to-r from-emerald-400 to-teal-400' 
          : isInProgress 
            ? 'bg-gradient-to-r from-blue-400 to-indigo-400' 
            : 'bg-slate-200'
      }`} />

      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between mb-3">
          <div className={`
            w-10 h-10 rounded-xl flex items-center justify-center shadow-sm
            ${isComplete 
              ? 'bg-gradient-to-br from-emerald-500 to-teal-500' 
              : isInProgress 
                ? 'bg-gradient-to-br from-blue-500 to-indigo-500' 
                : 'bg-slate-100'
            }
          `}>
            {isComplete ? (
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            ) : isInProgress ? (
              <div className="relative">
                <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
                <div className="absolute inset-0 w-3 h-3 bg-white rounded-full animate-ping opacity-30" />
              </div>
            ) : (
              <div className="w-3 h-3 border-2 border-slate-300 rounded-full" />
            )}
          </div>

          {showUndo && (
            <button
              onClick={isComplete && isPaired ? onUndoEnd : onUndo}
              disabled={loading}
              className="p-2 -m-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              title="Undo"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
            </button>
          )}
        </div>

        {/* Title */}
        <h4 className={`text-sm font-bold mb-1 ${
          isComplete ? 'text-emerald-900' : isInProgress ? 'text-blue-900' : 'text-slate-800'
        }`}>
          {displayName}
        </h4>

        {/* Time display */}
        {isComplete && (
          <div className="flex items-center gap-1.5 text-emerald-700">
            <svg className="w-3.5 h-3.5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {isPaired ? (
              <span className="text-xs font-semibold">
                {formatTimestamp24(recorded?.recorded_at, { timeZone })} → {formatTimestamp24(partnerRecorded?.recorded_at, { timeZone })}
                <span className="ml-1.5 px-1.5 py-0.5 bg-emerald-200/50 rounded text-emerald-800">{elapsedDisplay}</span>
              </span>
            ) : (
              <span className="text-xs font-semibold">{formatTimestamp(recorded?.recorded_at, { timeZone })}</span>
            )}
          </div>
        )}

        {/* Per-milestone pace comparison */}
        {isComplete && paceInfo && paceInfo.sampleSize >= MIN_SAMPLE_SIZE && (
          <p className="text-[10px] text-slate-400 mt-1">
            {paceInfo.actualMinutes}m vs {paceInfo.expectedMinutes}m exp
            <span className={`font-semibold ml-1 ${
              paceInfo.varianceMinutes > 5 ? 'text-emerald-600' :
              paceInfo.varianceMinutes < -5 ? 'text-red-500' :
              paceInfo.varianceMinutes < 0 ? 'text-amber-500' :
              'text-blue-500'
            }`}>
              {paceInfo.varianceMinutes > 0
                ? `${paceInfo.varianceMinutes}m ahead`
                : paceInfo.varianceMinutes < 0
                  ? `${Math.abs(paceInfo.varianceMinutes)}m behind`
                  : 'on pace'}
            </span>
          </p>
        )}

        {isInProgress && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-blue-600">Started {formatTimestamp(recorded?.recorded_at, { timeZone })}</span>
            <span className="text-sm font-bold text-blue-700 tabular-nums animate-pulse">{elapsedDisplay}</span>
          </div>
        )}

        {isNotStarted && (
          <p className="text-xs text-slate-400">Waiting to record</p>
        )}

        {/* Action buttons */}
        {isNotStarted && (
          <button
            onClick={onRecord}
            disabled={loading}
            className={`mt-4 w-full py-2.5 px-4 text-sm font-bold text-white rounded-xl transition-all active:scale-[0.98] ${
              loading
                ? 'bg-slate-400 cursor-not-allowed shadow-none'
                : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40'
            }`}
          >
            {loading ? 'Recording...' : 'Record'}
          </button>
        )}

        {isInProgress && isPaired && (
          <button
            onClick={onRecordEnd}
            disabled={loading}
            className={`mt-4 w-full py-2.5 px-4 text-sm font-bold text-white rounded-xl transition-all active:scale-[0.98] ${
              loading
                ? 'bg-slate-400 cursor-not-allowed shadow-none'
                : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40'
            }`}
          >
            {loading ? 'Completing...' : 'Complete'}
          </button>
        )}
      </div>
    </div>
  )
}
