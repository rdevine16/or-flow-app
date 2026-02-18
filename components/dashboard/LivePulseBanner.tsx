// components/dashboard/LivePulseBanner.tsx
// Full-width banner showing real-time OR room status and case progress.
// Consumes useTodayStatus() — no polling, updates on navigation/reload.

'use client'

import { Activity, Clock } from 'lucide-react'
import type { TodayStatusData, RoomStatus } from '@/lib/hooks/useTodayStatus'

interface LivePulseBannerProps {
  data: TodayStatusData | null
  loading?: boolean
}

const STATUS_CONFIG: Record<RoomStatus, { label: string; dotColor: string; pillBg: string; pillText: string }> = {
  in_case: { label: 'In Surgery', dotColor: 'bg-emerald-500', pillBg: 'bg-emerald-50', pillText: 'text-emerald-700' },
  turning_over: { label: 'Turnover', dotColor: 'bg-amber-500', pillBg: 'bg-amber-50', pillText: 'text-amber-700' },
  idle: { label: 'Available', dotColor: 'bg-slate-400', pillBg: 'bg-slate-50', pillText: 'text-slate-600' },
  done: { label: 'Done', dotColor: 'bg-blue-500', pillBg: 'bg-blue-50', pillText: 'text-blue-700' },
}

export function LivePulseBanner({ data, loading = false }: LivePulseBannerProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
        <div className="animate-pulse flex items-center gap-6">
          <div className="h-5 w-24 bg-slate-200 rounded" />
          <div className="h-5 w-32 bg-slate-100 rounded" />
          <div className="h-5 w-32 bg-slate-100 rounded" />
          <div className="flex-1" />
          <div className="h-5 w-40 bg-slate-100 rounded" />
        </div>
      </div>
    )
  }

  if (!data || data.rooms.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
        <div className="flex items-center gap-3 text-slate-400">
          <Activity className="w-4 h-4" />
          <span className="text-sm font-medium">No cases scheduled today</span>
        </div>
      </div>
    )
  }

  // Count rooms by status
  const statusCounts = new Map<RoomStatus, number>()
  for (const room of data.rooms) {
    statusCounts.set(room.status, (statusCounts.get(room.status) ?? 0) + 1)
  }

  // Case progress
  const totalCases = data.rooms.reduce((sum, r) => sum + r.totalCases, 0)
  const completedCases = data.rooms.reduce((sum, r) => sum + r.completedCases, 0)

  // Find next scheduled case across all rooms
  const nextCase = data.rooms
    .filter(r => r.nextCase)
    .sort((a, b) => (a.nextCase?.startTime ?? '').localeCompare(b.nextCase?.startTime ?? ''))
    [0]?.nextCase

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        {/* Live indicator */}
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
          <span className="text-sm font-semibold text-slate-900">Live</span>
        </div>

        {/* Status pills */}
        <div className="flex items-center gap-2">
          {(['in_case', 'turning_over', 'idle', 'done'] as RoomStatus[]).map((status) => {
            const count = statusCounts.get(status) ?? 0
            if (count === 0) return null
            const config = STATUS_CONFIG[status]
            return (
              <span
                key={status}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.pillBg} ${config.pillText}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${config.dotColor}`} />
                {count} {config.label}
              </span>
            )
          })}
        </div>

        <div className="flex-1" />

        {/* Case progress + next case */}
        <div className="flex items-center gap-4 text-sm">
          <span className="text-slate-600">
            <span className="font-semibold text-slate-900">{completedCases}</span>
            <span className="text-slate-400"> / {totalCases} cases</span>
          </span>
          {nextCase && (
            <span className="flex items-center gap-1.5 text-slate-500">
              <Clock className="w-3.5 h-3.5" />
              Next: {nextCase.surgeonName} @ {nextCase.startTime}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
