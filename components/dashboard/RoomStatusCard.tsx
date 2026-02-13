// components/dashboard/RoomStatusCard.tsx
// Compact room status card for the facility admin dashboard right column.
// Shows room name, current status, current/next case, and progress indicator.

'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import type { RoomStatusData, RoomStatus } from '@/lib/hooks/useTodayStatus'

// ============================================
// Status config
// ============================================

const STATUS_CONFIG: Record<RoomStatus, { label: string; dot: string; text: string; bg: string }> = {
  in_case: { label: 'In Case', dot: 'bg-green-500', text: 'text-green-700', bg: 'bg-green-50' },
  turning_over: { label: 'Turning Over', dot: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50' },
  idle: { label: 'Idle', dot: 'bg-slate-400', text: 'text-slate-600', bg: 'bg-slate-50' },
  done: { label: 'Done', dot: 'bg-blue-500', text: 'text-blue-700', bg: 'bg-blue-50' },
}

// ============================================
// Components
// ============================================

interface RoomStatusCardProps {
  room: RoomStatusData
}

export function RoomStatusCard({ room }: RoomStatusCardProps) {
  const config = STATUS_CONFIG[room.status]

  return (
    <Link
      href="/rooms"
      className="block bg-white rounded-lg border border-slate-100 p-4 hover:shadow-sm hover:border-slate-200 transition-all duration-200 group"
    >
      {/* Header: room name + status badge */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-slate-900">{room.roomName}</h3>
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${config.text} ${config.bg}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
          {config.label}
        </span>
      </div>

      {/* Current case info */}
      {room.currentCase ? (
        <div className="mb-2">
          <p className="text-sm text-slate-700 font-medium truncate">{room.currentCase.surgeonName}</p>
          <p className="text-xs text-slate-500 truncate">{room.currentCase.procedureName}</p>
        </div>
      ) : room.nextCase ? (
        <div className="mb-2">
          <p className="text-xs text-slate-500">
            Next: <span className="text-slate-700 font-medium">{room.nextCase.surgeonName}</span>
            {room.nextCase.startTime && (
              <span className="text-slate-400"> at {room.nextCase.startTime}</span>
            )}
          </p>
        </div>
      ) : (
        <div className="mb-2">
          <p className="text-xs text-slate-400">No more cases</p>
        </div>
      )}

      {/* Progress bar + count */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-500"
            style={{
              width: room.totalCases > 0
                ? `${(room.completedCases / room.totalCases) * 100}%`
                : '0%',
            }}
          />
        </div>
        <span className="text-xs text-slate-400 tabular-nums shrink-0">
          {room.completedCases}/{room.totalCases}
        </span>
        <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 transition-colors shrink-0" />
      </div>
    </Link>
  )
}

// ============================================
// Loading skeleton
// ============================================

export function RoomStatusCardSkeleton() {
  return (
    <div className="bg-white rounded-lg border border-slate-100 p-4 animate-pulse">
      <div className="flex items-center justify-between mb-2">
        <div className="h-4 w-16 bg-slate-200 rounded" />
        <div className="h-5 w-20 bg-slate-100 rounded-full" />
      </div>
      <div className="mb-2">
        <div className="h-4 w-28 bg-slate-200 rounded mb-1" />
        <div className="h-3 w-36 bg-slate-100 rounded" />
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-slate-100 rounded-full" />
        <div className="h-3 w-8 bg-slate-100 rounded" />
      </div>
    </div>
  )
}
