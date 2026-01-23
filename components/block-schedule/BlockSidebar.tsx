// components/block-schedule/BlockSidebar.tsx
'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { DAY_OF_WEEK_SHORT } from '@/types/block-scheduling'

interface Surgeon {
  id: string
  first_name: string
  last_name: string
}

interface BlockSidebarProps {
  surgeons: Surgeon[]
  selectedSurgeonIds: Set<string>
  colorMap: Record<string, string>
  onToggleSurgeon: (surgeonId: string) => void
  onSelectAll: () => void
  onDeselectAll: () => void
  currentWeekStart: Date
  onDateSelect: (date: Date) => void
}

export function BlockSidebar({
  surgeons,
  selectedSurgeonIds,
  colorMap,
  onToggleSurgeon,
  onSelectAll,
  onDeselectAll,
  currentWeekStart,
  onDateSelect,
}: BlockSidebarProps) {
  const [miniCalendarMonth, setMiniCalendarMonth] = useState(new Date())

  return (
    <div className="w-64 border-r border-gray-200 bg-white flex flex-col">
      {/* Mini Calendar */}
      <div className="p-4 border-b border-gray-200">
        <MiniCalendar
          month={miniCalendarMonth}
          onMonthChange={setMiniCalendarMonth}
          selectedWeekStart={currentWeekStart}
          onDateSelect={onDateSelect}
        />
      </div>

      {/* Surgeon Filter */}
      <div className="flex-1 overflow-auto p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">Surgeons</h3>
          <div className="flex gap-1">
            <button
              onClick={onSelectAll}
              className="text-xs text-blue-600 hover:text-blue-700"
            >
              All
            </button>
            <span className="text-xs text-gray-300">|</span>
            <button
              onClick={onDeselectAll}
              className="text-xs text-blue-600 hover:text-blue-700"
            >
              None
            </button>
          </div>
        </div>

        <div className="space-y-1">
          {surgeons.map(surgeon => {
            const isSelected = selectedSurgeonIds.has(surgeon.id)
            const color = colorMap[surgeon.id] || '#6B7280'

            return (
              <button
                key={surgeon.id}
                onClick={() => onToggleSurgeon(surgeon.id)}
                className={`w-full flex items-center gap-3 px-2 py-2 rounded-lg transition-colors ${
                  isSelected ? 'bg-gray-50' : 'hover:bg-gray-50 opacity-50'
                }`}
              >
                <div
                  className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: isSelected ? color : 'transparent', border: `2px solid ${color}` }}
                >
                  {isSelected && <Check className="h-3 w-3 text-white" />}
                </div>
                <span className="text-sm text-gray-700 truncate">
                  Dr. {surgeon.last_name}
                </span>
              </button>
            )
          })}

          {surgeons.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">
              No surgeons found
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// Mini Calendar Component
function MiniCalendar({
  month,
  onMonthChange,
  selectedWeekStart,
  onDateSelect,
}: {
  month: Date
  onMonthChange: (date: Date) => void
  selectedWeekStart: Date
  onDateSelect: (date: Date) => void
}) {
  const year = month.getFullYear()
  const monthIndex = month.getMonth()

  // Get first day of month and total days
  const firstDay = new Date(year, monthIndex, 1)
  const lastDay = new Date(year, monthIndex + 1, 0)
  const startPadding = firstDay.getDay()
  const totalDays = lastDay.getDate()

  // Generate calendar days
  const days: (number | null)[] = []
  for (let i = 0; i < startPadding; i++) days.push(null)
  for (let i = 1; i <= totalDays; i++) days.push(i)

  const prevMonth = () => {
    onMonthChange(new Date(year, monthIndex - 1, 1))
  }

  const nextMonth = () => {
    onMonthChange(new Date(year, monthIndex + 1, 1))
  }

  const isInSelectedWeek = (day: number): boolean => {
    const date = new Date(year, monthIndex, day)
    const weekEnd = new Date(selectedWeekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)
    return date >= selectedWeekStart && date <= weekEnd
  }

  const isToday = (day: number): boolean => {
    const today = new Date()
    return (
      day === today.getDate() &&
      monthIndex === today.getMonth() &&
      year === today.getFullYear()
    )
  }

  return (
    <div>
      {/* Month header */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={prevMonth}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
        >
          <ChevronLeft className="h-4 w-4 text-gray-600" />
        </button>
        <span className="text-sm font-medium text-gray-900">
          {month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </span>
        <button
          onClick={nextMonth}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
        >
          <ChevronRight className="h-4 w-4 text-gray-600" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {Object.values(DAY_OF_WEEK_SHORT).map(day => (
          <div key={day} className="text-center text-xs text-gray-500 py-1">
            {day.charAt(0)}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((day, i) => {
          if (day === null) {
            return <div key={i} className="h-7" />
          }

          const inSelectedWeek = isInSelectedWeek(day)
          const today = isToday(day)

          return (
            <button
              key={i}
              onClick={() => onDateSelect(new Date(year, monthIndex, day))}
              className={`h-7 text-xs rounded transition-colors ${
                inSelectedWeek
                  ? 'bg-blue-100 text-blue-700 font-medium'
                  : 'hover:bg-gray-100 text-gray-700'
              } ${today ? 'ring-1 ring-blue-500' : ''}`}
            >
              {day}
            </button>
          )
        })}
      </div>
    </div>
  )
}