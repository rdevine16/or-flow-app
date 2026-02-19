// components/dashboard/ScheduleAdherenceTimeline.tsx
// Schedule Adherence Gantt chart — shows scheduled vs actual case bars per OR room.
// Uses custom SVG rendering for precise Gantt positioning within a responsive container.

'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Clock, CheckCircle2, AlertTriangle, CalendarClock } from 'lucide-react'
import type {
  ScheduleTimelineData,
  TimelineCase,
} from '@/lib/hooks/useScheduleTimeline'

// ============================================
// Props
// ============================================

interface ScheduleAdherenceTimelineProps {
  data: ScheduleTimelineData | null
  loading?: boolean
}

// ============================================
// Constants
// ============================================

const LEFT_GUTTER = 80    // px for room labels
const RIGHT_PAD = 16      // px right padding
const TOP_PAD = 8         // px top padding
const BOTTOM_PAD = 24     // px for time axis labels
const LANE_HEIGHT = 48    // px per room lane
const LANE_GAP = 4        // px gap between lanes
const BAR_HEIGHT = 24     // px bar thickness
const BAR_RADIUS = 4      // px border radius

// ============================================
// Time formatting
// ============================================

function formatHour(hour: number): string {
  const h = Math.floor(hour)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const displayH = h % 12 || 12
  return `${displayH}${ampm}`
}

function formatTimeDetailed(hours: number): string {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const displayH = h % 12 || 12
  return `${displayH}:${m.toString().padStart(2, '0')} ${ampm}`
}

// ============================================
// Tooltip
// ============================================

interface TooltipState {
  x: number
  y: number
  caseData: TimelineCase
}

function GanttTooltip({ tooltip }: { tooltip: TooltipState }) {
  const { caseData } = tooltip

  const statusLabel =
    caseData.status === 'late' ? 'Late'
    : caseData.status === 'in_progress' ? 'In Progress'
    : caseData.status === 'completed' ? 'Completed'
    : 'Upcoming'

  const statusColor =
    caseData.status === 'late' ? 'text-rose-600'
    : caseData.status === 'in_progress' ? 'text-emerald-600'
    : caseData.status === 'completed' ? 'text-emerald-600'
    : 'text-slate-500'

  // Drift calculation (minutes)
  const driftMinutes = caseData.actualStart !== null
    ? Math.round((caseData.actualStart - caseData.scheduledStart) * 60)
    : null
  const driftLabel = driftMinutes !== null && driftMinutes !== 0
    ? driftMinutes > 0
      ? `+${driftMinutes} min late`
      : `${driftMinutes} min early`
    : null

  // Projected end (for in_progress)
  const projectedEndHour = caseData.actualStart !== null && caseData.durationMinutes !== null && caseData.actualEnd === null
    ? caseData.actualStart + caseData.durationMinutes / 60
    : null

  return (
    <div
      className="absolute z-50 bg-white rounded-lg shadow-lg border border-slate-200 px-3 py-2.5 pointer-events-none min-w-[200px]"
      style={{
        left: tooltip.x,
        top: tooltip.y - 8,
        transform: 'translate(-50%, -100%)',
      }}
    >
      <p className="text-sm font-semibold text-slate-900 mb-0.5">
        {caseData.procedureName}
      </p>
      <p className="text-xs text-slate-500 mb-1.5">{caseData.surgeonName}</p>
      <div className="flex items-center gap-2 text-xs">
        <span className="text-slate-500">
          Sched: {formatTimeDetailed(caseData.scheduledStart)}
          {caseData.scheduledEnd ? ` - ${formatTimeDetailed(caseData.scheduledEnd)}` : ''}
        </span>
      </div>
      {caseData.actualStart !== null && (
        <div className="flex items-center gap-2 text-xs mt-0.5">
          <span className="text-slate-500">
            Actual: {formatTimeDetailed(caseData.actualStart)}
            {caseData.actualEnd !== null ? ` - ${formatTimeDetailed(caseData.actualEnd)}` : ' - ongoing'}
          </span>
        </div>
      )}
      {driftLabel && (
        <div className={`text-xs font-medium mt-0.5 ${driftMinutes! > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
          {driftLabel}
        </div>
      )}
      {projectedEndHour !== null && (
        <div className="text-xs text-slate-400 mt-0.5">
          Projected end: {formatTimeDetailed(projectedEndHour)}
        </div>
      )}
      <div className={`text-xs font-medium mt-1 ${statusColor}`}>
        {statusLabel}
      </div>
    </div>
  )
}

// ============================================
// Gantt SVG chart
// ============================================

interface GanttChartProps {
  data: ScheduleTimelineData
}

function GanttChart({ data }: GanttChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  // Responsive width tracking
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width)
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const { rooms, axisStartHour, axisEndHour } = data
  const totalHours = axisEndHour - axisStartHour

  // Chart dimensions
  const chartWidth = containerWidth - LEFT_GUTTER - RIGHT_PAD
  const chartHeight = rooms.length * (LANE_HEIGHT + LANE_GAP) + TOP_PAD + BOTTOM_PAD
  const totalSvgWidth = containerWidth
  const totalSvgHeight = chartHeight

  // Scale: hours → pixels
  const hourToX = useCallback(
    (hour: number) => LEFT_GUTTER + ((hour - axisStartHour) / totalHours) * chartWidth,
    [axisStartHour, totalHours, chartWidth]
  )

  // Current time marker
  const now = new Date()
  const nowHours = now.getHours() + now.getMinutes() / 60
  const showNowLine = nowHours >= axisStartHour && nowHours <= axisEndHour

  // Time axis ticks (every hour)
  const ticks: number[] = []
  for (let h = axisStartHour; h <= axisEndHour; h++) {
    ticks.push(h)
  }

  if (chartWidth <= 0) {
    return <div ref={containerRef} className="w-full h-[200px]" />
  }

  return (
    <div ref={containerRef} className="w-full relative">
      <svg
        width={totalSvgWidth}
        height={totalSvgHeight}
        className="overflow-visible"
      >
        {/* Grid lines (vertical, one per hour) */}
        {ticks.map((h) => (
          <line
            key={`grid-${h}`}
            x1={hourToX(h)}
            y1={TOP_PAD}
            x2={hourToX(h)}
            y2={totalSvgHeight - BOTTOM_PAD}
            stroke="#f1f5f9"
            strokeWidth={1}
          />
        ))}

        {/* Room lanes */}
        {rooms.map((room, roomIdx) => {
          const laneY = TOP_PAD + roomIdx * (LANE_HEIGHT + LANE_GAP)
          const barY = laneY + (LANE_HEIGHT - BAR_HEIGHT) / 2

          return (
            <g key={room.roomId}>
              {/* Room label */}
              <text
                x={LEFT_GUTTER - 12}
                y={laneY + LANE_HEIGHT / 2}
                textAnchor="end"
                dominantBaseline="middle"
                className="text-xs fill-slate-600 font-medium"
              >
                {room.roomName}
              </text>

              {/* Lane background */}
              <rect
                x={LEFT_GUTTER}
                y={laneY}
                width={chartWidth}
                height={LANE_HEIGHT}
                fill={roomIdx % 2 === 0 ? '#fafbfc' : '#ffffff'}
                rx={2}
              />

              {/* Cases */}
              {room.cases.map((c) => {
                // === Position calculations ===
                const scheduledStartX = hourToX(c.scheduledStart)
                const scheduledWidth = c.scheduledEnd !== null
                  ? hourToX(c.scheduledEnd) - scheduledStartX
                  : 0

                const hasActual = c.actualStart !== null
                const isLate = c.status === 'late'
                const isCompleted = c.actualEnd !== null
                const isInProgress = hasActual && !isCompleted
                const fillColor = isLate ? '#f43f5e' : '#10b981'

                // Actual bar positions
                const actualStartX = hasActual ? hourToX(c.actualStart!) : 0
                const actualEndHour = isCompleted
                  ? c.actualEnd!
                  : isInProgress
                    ? nowHours
                    : null
                const actualEndX = actualEndHour !== null ? hourToX(actualEndHour) : null
                const actualWidth = hasActual && actualEndX !== null
                  ? Math.max(actualEndX - actualStartX, 2)
                  : 0

                // Projected duration pill (full expected duration from actual start)
                const projectedEndHour = isInProgress && c.durationMinutes !== null
                  ? c.actualStart! + c.durationMinutes / 60
                  : null
                const projectedEndX = projectedEndHour !== null ? hourToX(projectedEndHour) : null
                const projectedWidth = isInProgress && projectedEndX !== null
                  ? Math.max(projectedEndX - actualStartX, 2)
                  : 0
                const showProjectedPill = isInProgress && projectedWidth > 0

                // Label: use projected pill (in_progress), actual bar (completed), or scheduled (upcoming)
                const labelBarX = showProjectedPill ? actualStartX : hasActual ? actualStartX : scheduledStartX
                const labelBarWidth = showProjectedPill ? projectedWidth : hasActual ? actualWidth : scheduledWidth

                return (
                  <g
                    key={c.caseId}
                    onMouseEnter={(e) => {
                      const rect = containerRef.current?.getBoundingClientRect()
                      if (!rect) return
                      setTooltip({
                        x: e.clientX - rect.left,
                        y: barY,
                        caseData: c,
                      })
                    }}
                    onMouseMove={(e) => {
                      const rect = containerRef.current?.getBoundingClientRect()
                      if (!rect) return
                      setTooltip((prev) =>
                        prev ? { ...prev, x: e.clientX - rect.left, y: barY } : null
                      )
                    }}
                    onMouseLeave={() => setTooltip(null)}
                    className="cursor-pointer"
                  >
                    {/* ── UPCOMING: dashed outline at scheduled position ── */}
                    {!hasActual && scheduledWidth > 0 && (
                      <>
                        <rect
                          x={scheduledStartX}
                          y={barY}
                          width={Math.max(scheduledWidth, 2)}
                          height={BAR_HEIGHT}
                          fill="#e2e8f0"
                          opacity={0.3}
                          rx={BAR_RADIUS}
                        />
                        <rect
                          x={scheduledStartX}
                          y={barY}
                          width={Math.max(scheduledWidth, 2)}
                          height={BAR_HEIGHT}
                          fill="none"
                          stroke="#94a3b8"
                          strokeWidth={1.5}
                          strokeDasharray="4 3"
                          rx={BAR_RADIUS}
                        />
                      </>
                    )}

                    {/* UPCOMING: tick for cases with no duration */}
                    {!hasActual && scheduledWidth === 0 && (
                      <line
                        x1={scheduledStartX}
                        y1={barY}
                        x2={scheduledStartX}
                        y2={barY + BAR_HEIGHT}
                        stroke="#94a3b8"
                        strokeWidth={2}
                        strokeLinecap="round"
                      />
                    )}

                    {/* ── IN PROGRESS: projected duration pill at 70% opacity ── */}
                    {showProjectedPill && (
                      <rect
                        x={actualStartX}
                        y={barY}
                        width={projectedWidth}
                        height={BAR_HEIGHT}
                        fill={fillColor}
                        opacity={0.7}
                        rx={BAR_RADIUS}
                      />
                    )}

                    {/* ── STARTED: actual progress bar at full opacity ── */}
                    {hasActual && actualWidth > 0 && (
                      <rect
                        x={actualStartX}
                        y={barY}
                        width={actualWidth}
                        height={BAR_HEIGHT}
                        fill={fillColor}
                        rx={BAR_RADIUS}
                      />
                    )}

                    {/* ── Procedure label ── */}
                    {labelBarWidth > 30 && (() => {
                      const padding = 12
                      const charWidth = 6
                      const maxChars = Math.floor((labelBarWidth - padding) / charWidth)
                      const label = c.procedureName.length > maxChars
                        ? c.procedureName.slice(0, Math.max(maxChars - 1, 1)) + '…'
                        : c.procedureName
                      const textFill = hasActual ? '#ffffff' : '#334155'
                      return (
                        <text
                          x={labelBarX + labelBarWidth / 2}
                          y={barY + BAR_HEIGHT / 2}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill={textFill}
                          className="text-[10px] font-bold pointer-events-none select-none"
                        >
                          {label}
                        </text>
                      )
                    })()}
                  </g>
                )
              })}
            </g>
          )
        })}

        {/* Current time marker */}
        {showNowLine && (
          <g>
            <line
              x1={hourToX(nowHours)}
              y1={TOP_PAD - 2}
              x2={hourToX(nowHours)}
              y2={totalSvgHeight - BOTTOM_PAD + 2}
              stroke="#3b82f6"
              strokeWidth={2}
              strokeDasharray="4 2"
            />
            <circle
              cx={hourToX(nowHours)}
              cy={TOP_PAD - 4}
              r={4}
              fill="#3b82f6"
            />
          </g>
        )}

        {/* Time axis labels */}
        {ticks.map((h) => (
          <text
            key={`label-${h}`}
            x={hourToX(h)}
            y={totalSvgHeight - 4}
            textAnchor="middle"
            className="text-[11px] fill-slate-400"
          >
            {formatHour(h)}
          </text>
        ))}
      </svg>

      {/* Tooltip overlay */}
      {tooltip && <GanttTooltip tooltip={tooltip} />}
    </div>
  )
}

// ============================================
// Skeleton
// ============================================

function TimelineSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="h-5 w-56 bg-slate-200 rounded animate-pulse" />
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-6 w-20 bg-slate-100 rounded-full animate-pulse" />
          ))}
        </div>
      </div>
      <div className="h-[200px] bg-slate-50 rounded-lg animate-pulse" />
    </div>
  )
}

// ============================================
// Summary badges
// ============================================

interface SummaryBadgesProps {
  data: ScheduleTimelineData
}

function SummaryBadges({ data }: SummaryBadgesProps) {
  const { summary } = data

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
        <CheckCircle2 className="w-3.5 h-3.5" />
        {summary.onTimeCount} on time
      </span>
      {summary.lateCount > 0 && (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-700">
          <AlertTriangle className="w-3.5 h-3.5" />
          {summary.lateCount} late{summary.avgDriftMinutes > 0 && ` \u00b7 avg drift ${summary.avgDriftMinutes} min`}
        </span>
      )}
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
        <CalendarClock className="w-3.5 h-3.5" />
        {summary.upcomingCount} upcoming
      </span>
    </div>
  )
}

// ============================================
// Legend
// ============================================

function GanttLegend() {
  return (
    <div className="flex items-center gap-4 text-xs text-slate-500">
      <span className="flex items-center gap-1.5">
        <span className="w-3 h-2 rounded-sm bg-emerald-500" />
        On-time
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-3 h-2 rounded-sm bg-rose-500" />
        Late
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-3 h-2 rounded-sm border border-slate-400 border-dashed" />
        Upcoming
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-0.5 h-3 bg-blue-500" />
        Now
      </span>
    </div>
  )
}

// ============================================
// Main component
// ============================================

export function ScheduleAdherenceTimeline({ data, loading }: ScheduleAdherenceTimelineProps) {
  if (loading) return <TimelineSkeleton />

  // Empty state
  if (!data || data.rooms.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Clock className="w-5 h-5 text-slate-400" />
          <h2 className="text-base font-semibold text-slate-900">Schedule Adherence</h2>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <CalendarClock className="w-10 h-10 text-slate-300 mb-3" />
          <p className="text-sm text-slate-400">No cases scheduled today</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-slate-400" />
          <div>
            <h2 className="text-base font-semibold text-slate-900">Schedule Adherence</h2>
            <p className="text-xs text-slate-500 mt-0.5">Scheduled vs actual case times by room</p>
          </div>
        </div>
        <SummaryBadges data={data} />
      </div>

      {/* Legend */}
      <div className="mb-3">
        <GanttLegend />
      </div>

      {/* Gantt chart */}
      <GanttChart data={data} />
    </div>
  )
}
