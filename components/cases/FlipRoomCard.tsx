// components/cases/FlipRoomCard.tsx
// Flip room status card — shows surgeon's next case in a different room
// Displays room name, procedure, current milestone, elapsed time, and callback status

import { ArrowRightLeft, Megaphone, Check } from 'lucide-react'
import { formatTimestamp, formatElapsedMs } from '@/lib/formatters'

// ============================================================================
// TYPES
// ============================================================================

interface FlipRoomCardProps {
  caseNumber: string
  roomName: string
  procedureName: string
  lastMilestoneDisplayName: string | null
  lastMilestoneRecordedAt: string | null
  calledBackAt: string | null
  currentTime: number
  timeZone?: string
  onCallBack: () => void
  onUndoCallBack: () => void
  callingBack: boolean
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function FlipRoomCard({
  caseNumber,
  roomName,
  procedureName,
  lastMilestoneDisplayName,
  lastMilestoneRecordedAt,
  calledBackAt,
  currentTime,
  timeZone,
  onCallBack,
  onUndoCallBack,
  callingBack,
}: FlipRoomCardProps) {
  const elapsedMs = lastMilestoneRecordedAt
    ? currentTime - new Date(lastMilestoneRecordedAt).getTime()
    : 0

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="w-4 h-4 text-indigo-500" />
          <h3 className="text-sm font-semibold text-slate-900">Flip Room</h3>
        </div>
        <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
          {roomName}
        </span>
      </div>

      {/* Content */}
      <div className="p-3 space-y-2.5">
        {/* Procedure + Case Number */}
        <div>
          <p className="text-sm text-slate-700 font-medium">{procedureName}</p>
          <p className="text-xs text-slate-400">{caseNumber}</p>
        </div>

        {/* Current Milestone */}
        {lastMilestoneDisplayName ? (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs font-medium text-slate-600">
              {lastMilestoneDisplayName}
            </span>
            <span className="text-xs text-slate-400 tabular-nums">
              {formatElapsedMs(elapsedMs)}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-slate-300 rounded-full" />
            <span className="text-xs text-slate-400">Not started</span>
          </div>
        )}

        {/* Call-back Status / Button */}
        {calledBackAt ? (
          <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-3 py-2">
            <div className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-green-500" />
              <span className="text-xs font-medium text-green-800">
                Patient Called {formatTimestamp(calledBackAt, { timeZone })}
              </span>
            </div>
            <button
              onClick={onUndoCallBack}
              disabled={callingBack}
              className="text-xs text-green-600 hover:text-green-800 font-medium px-2 py-0.5 rounded hover:bg-green-100 transition-colors disabled:opacity-50"
            >
              Undo
            </button>
          </div>
        ) : (
          <button
            onClick={onCallBack}
            disabled={callingBack}
            className="w-full py-2 px-3 text-sm font-semibold rounded-xl transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-blue-500 text-white hover:from-indigo-600 hover:to-blue-600 shadow-sm hover:shadow disabled:opacity-50"
          >
            {callingBack ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Calling...
              </>
            ) : (
              <>
                <Megaphone className="w-4 h-4" />
                Call Patient Back
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
