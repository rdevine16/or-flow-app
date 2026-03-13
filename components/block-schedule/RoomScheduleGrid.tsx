// components/block-schedule/RoomScheduleGrid.tsx
// Main room schedule grid: rooms (rows) x days of week (columns) with week navigation

import { useMemo, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Copy, CalendarDays, Download } from 'lucide-react'
import Link from 'next/link'
import { useRooms, type Room } from '@/hooks/useLookups'
import { buildAssignmentMap, roomDateKey } from '@/types/room-scheduling'
import type { RoomDateAssignment, RoomDateStaff } from '@/types/room-scheduling'
import type { RoomDaySchedule } from '@/hooks/useRoomSchedules'
import type { DateClosureInfo } from '@/hooks/useFacilityClosures'
import { getDefaultWeekSchedule } from '@/hooks/useRoomSchedules'
import { exportRoomSchedulePdf } from '@/lib/exportRoomSchedulePdf'
import { RoomDayCell } from './RoomDayCell'

// =====================================================
// DATE HELPERS (pure, no mutation)
// =====================================================

function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function getWeekStart(date: Date): Date {
  const result = new Date(date)
  result.setDate(result.getDate() - result.getDay())
  return result
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// =====================================================
// COMPONENT
// =====================================================

interface RoomScheduleGridProps {
  facilityId: string | null
  currentWeekStart: Date
  onWeekChange: (weekStart: Date) => void
  assignments: RoomDateAssignment[]
  staffAssignments: RoomDateStaff[]
  assignmentsLoading: boolean
  assignmentsError: string | null
  onRemoveSurgeon?: (assignmentId: string) => void
  onRemoveStaff?: (staffId: string) => void
  onCloneWeek?: (sourceWeekStart: string, targetWeekStart: string) => void
  onCloneDay?: (sourceDate: string, targetDate: string) => void
  /** Room schedules map: roomId -> 7-day schedule (for closed room detection) */
  allRoomSchedules?: Map<string, RoomDaySchedule[]>
  /** Callback for click-to-assign (keyboard accessible fallback) */
  onRequestAssign?: (roomId: string, date: string, roomName: string) => void
  /** Whether to show weekend columns (Saturday/Sunday) */
  showWeekends: boolean
  /** Toggle weekend visibility */
  onToggleWeekends: () => void
  /** Facility name for PDF export header */
  facilityName?: string
  /** Facility-level closure check (holidays + one-off closures) */
  isFacilityDateClosed?: (date: Date) => boolean
  /** Rich facility closure info for tooltip display */
  getDateClosureInfo?: (date: Date) => DateClosureInfo
}

export function RoomScheduleGrid({
  facilityId,
  currentWeekStart,
  onWeekChange,
  assignments,
  staffAssignments,
  assignmentsLoading,
  assignmentsError,
  onRemoveSurgeon,
  onRemoveStaff,
  onCloneWeek,
  onCloneDay,
  allRoomSchedules,
  onRequestAssign,
  showWeekends,
  onToggleWeekends,
  facilityName,
  isFacilityDateClosed,
  getDateClosureInfo,
}: RoomScheduleGridProps) {
  const { data: rooms, loading: roomsLoading } = useRooms(facilityId)

  // Default schedule for rooms without explicit schedules
  const defaultSchedule = useMemo(() => getDefaultWeekSchedule(), [])

  // Build dates for the current week (optionally excluding weekends)
  const weekDates = useMemo(() => {
    const allDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i))
    if (!showWeekends) {
      return allDays.filter(d => d.getDay() !== 0 && d.getDay() !== 6)
    }
    return allDays
  }, [currentWeekStart, showWeekends])

  const today = useMemo(() => new Date(), [])

  // Build assignment map for fast cell lookup
  const assignmentMap = useMemo(
    () => buildAssignmentMap(assignments, staffAssignments),
    [assignments, staffAssignments]
  )

  // Check if a room is closed on a specific day of week
  const isRoomClosedOnDay = (roomId: string, dayOfWeek: number): boolean => {
    const schedule = allRoomSchedules?.get(roomId) ?? defaultSchedule
    return schedule[dayOfWeek]?.isClosed ?? false
  }

  // Navigation
  const goToPreviousWeek = () => onWeekChange(addDays(currentWeekStart, -7))
  const goToNextWeek = () => onWeekChange(addDays(currentWeekStart, 7))
  const goToToday = () => onWeekChange(getWeekStart(new Date()))

  // Week header format
  const formatWeekHeader = () => {
    const weekEnd = addDays(currentWeekStart, 6)
    const startMonth = currentWeekStart.toLocaleDateString('en-US', { month: 'long' })
    const endMonth = weekEnd.toLocaleDateString('en-US', { month: 'long' })
    const year = weekEnd.getFullYear()
    if (startMonth === endMonth) return `${startMonth} ${year}`
    return `${startMonth} – ${endMonth} ${year}`
  }

  // PDF export
  const handleExportPdf = useCallback(() => {
    exportRoomSchedulePdf({
      facilityName: facilityName ?? 'Room Schedule',
      weekLabel: formatWeekHeader(),
      weekDates,
      rooms,
      assignmentMap,
      isRoomClosedOnDay,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facilityName, weekDates, rooms, assignmentMap, isRoomClosedOnDay])

  const loading = roomsLoading || assignmentsLoading

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
      {/* Navigation Header */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-slate-100 bg-white flex-shrink-0">
        <button
          onClick={goToToday}
          className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
          title="Go to today (T)"
        >
          Today
        </button>
        <div className="flex items-center">
          <button
            onClick={goToPreviousWeek}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
            title="Previous week"
          >
            <ChevronLeft className="h-5 w-5 text-slate-600" />
          </button>
          <button
            onClick={goToNextWeek}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
            title="Next week"
          >
            <ChevronRight className="h-5 w-5 text-slate-600" />
          </button>
        </div>
        <h2 className="text-xl font-normal text-slate-800">
          {formatWeekHeader()}
        </h2>
        {loading && (
          <div className="ml-auto mr-2">
            <div className="h-4 w-4 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={handleExportPdf}
            disabled={loading || rooms.length === 0}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-300 rounded-md hover:bg-slate-50 hover:text-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            title="Export schedule as PDF"
          >
            <Download className="h-3.5 w-3.5" />
            Export PDF
          </button>
          <button
            onClick={onToggleWeekends}
            className={`px-3 py-1.5 text-xs font-medium border rounded-md transition-colors flex items-center gap-1.5 ${
              showWeekends
                ? 'text-blue-600 border-blue-300 bg-blue-50 hover:bg-blue-100'
                : 'text-slate-600 border-slate-300 hover:bg-slate-50 hover:text-slate-800'
            }`}
            title={showWeekends ? 'Hide weekends' : 'Show weekends'}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            Weekends
          </button>
          {onCloneWeek && (
            <button
              onClick={() => {
                const prevWeekStart = formatDate(addDays(currentWeekStart, -7))
                const targetWeekStart = formatDate(currentWeekStart)
                onCloneWeek(prevWeekStart, targetWeekStart)
              }}
              disabled={loading}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-300 rounded-md hover:bg-slate-50 hover:text-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              title="Copy all assignments from the previous week to this week"
            >
              <Copy className="h-3.5 w-3.5" />
              Clone previous week
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {assignmentsError && (
        <div className="px-4 py-2 bg-red-50 text-red-600 text-sm border-b border-red-200">
          {assignmentsError}
        </div>
      )}

      {/* Grid */}
      <div className="flex-1 overflow-auto min-h-0">
        {rooms.length === 0 && !roomsLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-sm text-slate-500 mb-1">No rooms configured</p>
              <p className="text-xs text-slate-400 mb-3">
                Add operating rooms to start scheduling
              </p>
              <Link
                href="/settings/rooms"
                className="text-xs text-blue-500 hover:text-blue-700 underline underline-offset-2"
              >
                Configure rooms in Settings
              </Link>
            </div>
          </div>
        ) : (
          <table className="w-full border-collapse table-fixed">
            <thead className="sticky top-0 z-10 bg-white">
              <tr>
                {/* Room column header */}
                <th style={{ width: 120 }} className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-r border-slate-200 bg-slate-50 align-middle">
                  Room
                </th>
                {/* Day column headers */}
                {weekDates.map((date, i) => {
                  const isToday = isSameDay(date, today)
                  const dateStr = formatDate(date)
                  const dayOfWeek = date.getDay()
                  const prevWeekSameDay = formatDate(addDays(date, -7))
                  const facilityClosedFull = isFacilityDateClosed?.(date) ?? false
                  const closureInfo = getDateClosureInfo?.(date)
                  const holidayLabel = closureInfo?.holidayName
                    ?? (closureInfo?.closureReason ? closureInfo.closureReason : null)
                  return (
                    <th
                      key={i}
                      className={`px-2 py-2 text-center text-xs border-b border-r border-slate-200 align-middle ${
                        facilityClosedFull ? 'bg-slate-100' : closureInfo?.isPartialHoliday ? 'bg-amber-50' : isToday ? 'bg-blue-50' : 'bg-slate-50'
                      }`}
                      title={
                        closureInfo?.isPartialHoliday
                          ? `${closureInfo.holidayName} — Partial, closes early`
                          : facilityClosedFull && holidayLabel
                            ? `${holidayLabel} — Full day closure`
                            : undefined
                      }
                    >
                      <div className={`font-semibold ${
                        facilityClosedFull ? 'text-slate-400' : isToday ? 'text-blue-600' : 'text-slate-500'
                      }`}>
                        {DAY_LABELS[dayOfWeek]}
                      </div>
                      <div className={`text-[11px] ${
                        facilityClosedFull ? 'text-slate-400' : isToday ? 'text-blue-500' : 'text-slate-400'
                      }`}>
                        {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                      {(facilityClosedFull || closureInfo?.isPartialHoliday) && holidayLabel && (
                        <div className={`text-[10px] mt-0.5 truncate ${
                          closureInfo?.isPartialHoliday ? 'text-amber-500' : 'text-slate-400'
                        }`}>
                          {holidayLabel}
                        </div>
                      )}
                      {!facilityClosedFull && onCloneDay && (
                        <button
                          onClick={() => onCloneDay(prevWeekSameDay, dateStr)}
                          className="mt-0.5 text-[10px] text-slate-400 hover:text-blue-500 transition-colors"
                          title={`Clone from last ${DAY_LABELS[i]}`}
                        >
                          Clone
                        </button>
                      )}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {rooms.map((room: Room) => (
                <tr key={room.id}>
                  {/* Room name */}
                  <td className="px-3 py-2 text-sm font-medium text-slate-700 border-r border-b border-slate-200 bg-slate-50/50 whitespace-nowrap align-top overflow-hidden text-ellipsis">
                    {room.name}
                  </td>
                  {/* Day cells */}
                  {weekDates.map((date, i) => {
                    const dateStr = formatDate(date)
                    const key = roomDateKey(room.id, dateStr)
                    const cellData = assignmentMap[key] ?? null
                    const isToday = isSameDay(date, today)
                    const roomClosed = isRoomClosedOnDay(room.id, date.getDay())
                    const facilityClosed = isFacilityDateClosed?.(date) ?? false
                    const isClosed = roomClosed || facilityClosed

                    return (
                      <td key={i} className={`p-0 align-top border-b border-r border-slate-200 ${isToday && !isClosed ? 'bg-blue-50/50' : ''}`}>
                        <RoomDayCell
                          cellData={cellData}
                          isToday={isToday}
                          isClosed={isClosed}
                          roomId={room.id}
                          date={dateStr}
                          roomName={room.name}
                          onRemoveSurgeon={onRemoveSurgeon}
                          onRemoveStaff={onRemoveStaff}
                          onRequestAssign={isClosed || !onRequestAssign ? undefined : (rId, d) => onRequestAssign(rId, d, room.name)}
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
