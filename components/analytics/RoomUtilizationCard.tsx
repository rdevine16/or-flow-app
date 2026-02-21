'use client'

import Link from 'next/link'
import type { RoomUtilizationDetail } from '@/lib/analyticsV2'

interface RoomUtilizationCardProps {
  rooms: RoomUtilizationDetail[]
}

function turnoverColor(minutes: number | null, threshold: number): string {
  if (minutes === null) return 'text-slate-400'
  if (minutes <= threshold) return 'text-green-600 font-semibold'
  if (minutes <= threshold * 1.33) return 'text-amber-600 font-semibold'
  return 'text-red-500 font-semibold'
}

function barColor(utilization: number): string {
  if (utilization >= 75) return 'bg-green-500'
  if (utilization >= 50) return 'bg-blue-500'
  if (utilization >= 30) return 'bg-amber-500'
  return 'bg-red-500'
}

function valueColor(utilization: number): string {
  if (utilization >= 75) return 'text-green-600'
  if (utilization >= 50) return 'text-slate-900'
  return 'text-amber-600'
}

export default function RoomUtilizationCard({ rooms }: RoomUtilizationCardProps) {
  // Sort by utilization descending for display
  const sorted = [...rooms].sort((a, b) => b.utilization - a.utilization)

  if (sorted.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <p className="text-sm">No room data available</p>
      </div>
    )
  }

  return (
    <div>
      <div className="px-5 py-2 space-y-0">
        {sorted.map((room, i) => (
          <div
            key={room.roomId}
            className={`py-2.5 ${i < sorted.length - 1 ? 'border-b border-slate-50' : ''}`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-slate-900">{room.roomName}</span>
                <span className="text-[11px] text-slate-400">{room.caseCount} cases</span>
              </div>
              <div className="flex items-center gap-3">
                {room.sameRoomTurnoverMedian !== null && (
                  <span className="text-[11px] text-slate-400">
                    SR:{' '}
                    <span className={turnoverColor(room.sameRoomTurnoverMedian, 30)}>
                      {Math.round(room.sameRoomTurnoverMedian)}m
                    </span>
                  </span>
                )}
                <span className={`text-[13px] font-bold font-mono min-w-[40px] text-right ${valueColor(room.utilization)}`}>
                  {room.utilization}%
                </span>
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-600 ${barColor(room.utilization)}`}
                style={{ width: `${Math.min(room.utilization, 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="px-5 py-2 border-t border-slate-100">
        <Link
          href="/analytics/block-utilization"
          className="text-xs font-medium text-blue-500 hover:bg-blue-50 px-2 py-1 rounded-md transition-colors"
        >
          Block details &rarr;
        </Link>
      </div>
    </div>
  )
}
