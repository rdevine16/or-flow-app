// components/block-schedule/RoomScheduleGrid.tsx
// Main room schedule grid: rooms (rows) x days of week (columns) with week navigation

import { useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useRooms, type Room } from '@/hooks/useLookups'
import { buildAssignmentMap, roomDateKey } from '@/types/room-scheduling'
import type { RoomDateAssignment, RoomDateStaff } from '@/types/room-scheduling'
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
}

export function RoomScheduleGrid({
  facilityId,
  currentWeekStart,
  onWeekChange,
  assignments,
  staffAssignments,
  assignmentsLoading,
  assignmentsError,
}: RoomScheduleGridProps) {
  const { data: rooms, loading: roomsLoading } = useRooms(facilityId)

  // Build the 7 dates for the current week
  const weekDates = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i))
  }, [currentWeekStart])

  const today = useMemo(() => new Date(), [])

  // Build assignment map for fast cell lookup
  const assignmentMap = useMemo(
    () => buildAssignmentMap(assignments, staffAssignments),
    [assignments, staffAssignments]
  )

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
          <div className="ml-auto">
            <div className="h-4 w-4 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
          </div>
        )}
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
              <p className="text-xs text-slate-400">
                Add rooms in Settings to start scheduling
              </p>
            </div>
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10 bg-white">
              <tr>
                {/* Room column header */}
                <th className="w-[120px] min-w-[120px] px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-r border-slate-200 bg-slate-50">
                  Room
                </th>
                {/* Day column headers */}
                {weekDates.map((date, i) => {
                  const isToday = isSameDay(date, today)
                  return (
                    <th
                      key={i}
                      className={`px-2 py-2 text-center text-xs border-b border-r border-slate-200 ${
                        isToday ? 'bg-blue-50' : 'bg-slate-50'
                      }`}
                    >
                      <div className={`font-semibold ${isToday ? 'text-blue-600' : 'text-slate-500'}`}>
                        {DAY_LABELS[i]}
                      </div>
                      <div className={`text-[11px] ${isToday ? 'text-blue-500' : 'text-slate-400'}`}>
                        {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {rooms.map((room: Room) => (
                <tr key={room.id}>
                  {/* Room name */}
                  <td className="px-3 py-2 text-sm font-medium text-slate-700 border-r border-b border-slate-200 bg-slate-50/50 whitespace-nowrap">
                    {room.name}
                  </td>
                  {/* Day cells */}
                  {weekDates.map((date, i) => {
                    const dateStr = formatDate(date)
                    const key = roomDateKey(room.id, dateStr)
                    const cellData = assignmentMap[key] ?? null
                    const isToday = isSameDay(date, today)

                    return (
                      <td key={i} className="p-0">
                        <RoomDayCell
                          cellData={cellData}
                          isToday={isToday}
                          roomId={room.id}
                          date={dateStr}
                          roomName={room.name}
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
