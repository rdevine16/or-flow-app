// components/analytics/InsightPanelUtilization.tsx
// Utilization drill-through panel for InsightSlideOver.
// Shows room status summary, per-room utilization bars with target lines,
// flags rooms using default availability hours, sorted lowest-first.

'use client'

import { useMemo } from 'react'
import type { ORUtilizationResult, FacilityAnalyticsConfig } from '@/lib/analyticsV2'

// ============================================
// PROPS
// ============================================

interface InsightPanelUtilizationProps {
  orUtilization: ORUtilizationResult
  config: FacilityAnalyticsConfig
}

// ============================================
// COMPONENT
// ============================================

export default function InsightPanelUtilization({ orUtilization, config }: InsightPanelUtilizationProps) {
  const { roomBreakdown, roomsWithRealHours, roomsWithDefaultHours } = orUtilization
  const target = config.utilizationTargetPercent
  const nearTarget = target * 0.8

  // Sort rooms lowest utilization first
  const sortedRooms = useMemo(
    () => [...roomBreakdown].sort((a, b) => a.utilization - b.utilization),
    [roomBreakdown],
  )

  // Bucket counts
  const aboveTarget = roomBreakdown.filter(r => r.utilization >= target).length
  const nearTargetCount = roomBreakdown.filter(r => r.utilization >= nearTarget && r.utilization < target).length
  const belowNear = roomBreakdown.filter(r => r.utilization < nearTarget).length

  if (roomBreakdown.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 bg-slate-100 rounded-xl flex items-center justify-center mb-4">
          <span className="text-2xl text-slate-400">&#9639;</span>
        </div>
        <h3 className="text-sm font-semibold text-slate-900 mb-1">No utilization data</h3>
        <p className="text-sm text-slate-400">No rooms with case data found in this period.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Room hours info */}
      <p className="text-xs text-slate-400">
        {roomsWithRealHours > 0 && roomsWithDefaultHours > 0
          ? `${roomsWithRealHours} room${roomsWithRealHours !== 1 ? 's' : ''} configured \u00b7 ${roomsWithDefaultHours} using default (10h)`
          : roomsWithDefaultHours === roomBreakdown.length
          ? 'All rooms using default 10h availability \u2014 configure in Settings'
          : `All ${roomsWithRealHours} room${roomsWithRealHours !== 1 ? 's' : ''} have configured hours`}
      </p>

      {/* Room Status Summary */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200/60 text-center">
          <div className="text-2xl font-semibold text-emerald-600">{aboveTarget}</div>
          <div className="text-[10px] text-emerald-600 font-medium">Above Target</div>
        </div>
        <div className="p-3 bg-amber-50 rounded-lg border border-amber-200/60 text-center">
          <div className="text-2xl font-semibold text-amber-700">{nearTargetCount}</div>
          <div className="text-[10px] text-amber-700 font-medium">Near Target</div>
        </div>
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/60 text-center">
          <div className="text-2xl font-semibold text-slate-600">{belowNear}</div>
          <div className="text-[10px] text-slate-500 font-medium">Below {Math.round(nearTarget)}%</div>
        </div>
      </div>

      {/* Per-room cards (sorted lowest utilization first) */}
      <div className="space-y-3">
        {sortedRooms.map((room) => {
          const barColor = room.utilization >= target
            ? 'bg-emerald-500'
            : room.utilization >= nearTarget
            ? 'bg-amber-500'
            : 'bg-slate-400'
          const textColor = room.utilization >= target
            ? 'text-emerald-600'
            : room.utilization >= nearTarget
            ? 'text-amber-700'
            : 'text-slate-600'

          const avgHoursPerDay = room.daysActive > 0
            ? Math.round(room.usedMinutes / room.daysActive / 60 * 10) / 10
            : 0

          return (
            <div key={room.roomId} className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              {/* Room name + utilization % */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-900">{room.roomName}</span>
                  {!room.usingRealHours && (
                    <span className="px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700 rounded">
                      Default hours
                    </span>
                  )}
                </div>
                <span className={`text-xl font-semibold ${textColor}`}>
                  {room.utilization}%
                </span>
              </div>

              {/* Utilization bar with target marker */}
              <div className="relative w-full h-2 bg-slate-200 rounded-full mb-3">
                <div
                  className={`${barColor} h-2 rounded-full transition-all duration-500`}
                  style={{ width: `${Math.min(room.utilization, 100)}%` }}
                />
                {/* Target line */}
                <div
                  className="absolute top-[-3px] w-0.5 h-[14px] bg-slate-900/60 rounded-full"
                  style={{ left: `${Math.min(target, 100)}%` }}
                  title={`Target: ${target}%`}
                />
              </div>

              {/* Stats row */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                <span>{room.caseCount} cases</span>
                <span className="text-slate-300">&middot;</span>
                <span>{room.daysActive} days active</span>
                <span className="text-slate-300">&middot;</span>
                <span>~{avgHoursPerDay}h avg/day of {room.availableHours}h</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
