'use client'

import type { RoomFlagRow } from '@/types/flag-analytics'

// ============================================
// Types
// ============================================

interface RoomAnalysisCardsProps {
  data: RoomFlagRow[]
  /** Click handler for drill-through (Phase 5 will provide this) */
  onRoomClick?: (roomId: string) => void
}

// ============================================
// Rate badge + bar color helpers
// ============================================

function getRateColors(rate: number): { badge: string; bar: string } {
  if (rate > 40) {
    return { badge: 'bg-rose-50 text-rose-600', bar: 'bg-rose-500' }
  }
  if (rate > 25) {
    return { badge: 'bg-amber-50 text-amber-600', bar: 'bg-amber-500' }
  }
  return { badge: 'bg-emerald-50 text-emerald-600', bar: 'bg-emerald-500' }
}

// ============================================
// RoomAnalysisCards
// ============================================

export default function RoomAnalysisCards({ data, onRoomClick }: RoomAnalysisCardsProps) {
  if (data.length === 0) return null

  // Sort by flag rate descending (Q25)
  const sorted = [...data].sort((a, b) => b.rate - a.rate)

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {sorted.map((room) => {
        const colors = getRateColors(room.rate)
        return (
          <div
            key={room.roomId}
            className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
            onClick={() => onRoomClick?.(room.roomId)}
          >
            {/* Room name + rate badge */}
            <div className="flex justify-between items-center mb-3">
              <span className="text-[15px] font-bold text-slate-900">{room.room}</span>
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded ${colors.badge}`}
              >
                {room.rate.toFixed(0)}%
              </span>
            </div>

            {/* Progress bar */}
            <div className="h-1 bg-slate-100 rounded-full overflow-hidden mb-3.5">
              <div
                className={`h-full rounded-full opacity-70 transition-[width] duration-500 ease-out ${colors.bar}`}
                style={{ width: `${Math.min(room.rate, 100)}%` }}
              />
            </div>

            {/* Counts */}
            <div className="text-xs text-slate-500 mb-2">
              <span className="font-semibold text-slate-900">{room.flags}</span> flags
              across{' '}
              <span className="font-semibold text-slate-900">{room.cases}</span> cases
            </div>

            {/* Top flag + top delay */}
            <div className="flex flex-col gap-1 text-[11px]">
              {room.topIssue && (
                <div className="text-slate-500">
                  <span className="text-slate-400">Top auto:</span>{' '}
                  <span className="text-violet-600 font-medium">{room.topIssue}</span>
                </div>
              )}
              {room.topDelay && (
                <div className="text-slate-500">
                  <span className="text-slate-400">Top delay:</span>{' '}
                  <span className="text-orange-600 font-medium">{room.topDelay}</span>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
