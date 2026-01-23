// components/block-schedule/BlockSidebar.tsx
'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Check } from 'lucide-react'

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
  onAddBlock: () => void
  showHolidays: boolean
  onToggleHolidays: () => void
}

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export function BlockSidebar({
  surgeons,
  selectedSurgeonIds,
  colorMap,
  onToggleSurgeon,
  onSelectAll,
  onDeselectAll,
  currentWeekStart,
  onDateSelect,
  onAddBlock,
  showHolidays,
  onToggleHolidays,
}: BlockSidebarProps) {
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date(currentWeekStart)
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })

  // Generate calendar days
  const generateCalendarDays = () => {
    const year = calendarMonth.getFullYear()
    const month = calendarMonth.getMonth()
    
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startPadding = firstDay.getDay()
    const totalDays = lastDay.getDate()
    
    const days: (Date | null)[] = []
    
    // Previous month padding
    for (let i = 0; i < startPadding; i++) {
      days.push(null)
    }
    
    // Current month days
    for (let i = 1; i <= totalDays; i++) {
      days.push(new Date(year, month, i))
    }
    
    return days
  }

  const calendarDays = generateCalendarDays()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const isInCurrentWeek = (date: Date) => {
    const weekEnd = new Date(currentWeekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)
    return date >= currentWeekStart && date <= weekEnd
  }

  const isToday = (date: Date) => {
    return date.toDateString() === today.toDateString()
  }

  const prevMonth = () => {
    setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }

  const nextMonth = () => {
    setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }

  const monthYear = calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div className="w-64 flex-shrink-0 border-r border-slate-200 bg-white flex flex-col">
      {/* Create Button - Google Style */}
      <div className="p-4">
        <button
          onClick={onAddBlock}
          className="flex items-center gap-3 px-6 py-3 bg-white border border-slate-200 rounded-2xl shadow-md hover:shadow-lg hover:bg-slate-50 transition-all group"
        >
          <Plus className="h-6 w-6 text-slate-600 group-hover:text-blue-600 transition-colors" />
          <span className="text-sm font-medium text-slate-700">Create</span>
        </button>
      </div>

      {/* Mini Calendar */}
      <div className="px-4 pb-4">
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-slate-800">{monthYear}</span>
          <div className="flex items-center">
            <button
              onClick={prevMonth}
              className="p-1 hover:bg-slate-100 rounded-full transition-colors"
            >
              <ChevronLeft className="h-4 w-4 text-slate-600" />
            </button>
            <button
              onClick={nextMonth}
              className="p-1 hover:bg-slate-100 rounded-full transition-colors"
            >
              <ChevronRight className="h-4 w-4 text-slate-600" />
            </button>
          </div>
        </div>

        {/* Day Headers */}
        <div className="grid grid-cols-7 mb-1">
          {DAYS.map((day, i) => (
            <div key={i} className="text-center text-xs font-medium text-slate-400 py-1">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7">
          {calendarDays.map((date, i) => {
            if (!date) {
              return <div key={i} className="h-7" />
            }

            const inWeek = isInCurrentWeek(date)
            const isTodayDate = isToday(date)

            return (
              <button
                key={i}
                onClick={() => onDateSelect(date)}
                className={`h-7 w-7 mx-auto text-xs font-medium rounded-full transition-colors ${
                  isTodayDate
                    ? 'bg-blue-600 text-white'
                    : inWeek
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {date.getDate()}
              </button>
            )
          })}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-slate-100 mx-4" />

      {/* Surgeons Section */}
      <div className="flex-1 overflow-auto px-4 py-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Surgeons</span>
          <div className="flex items-center gap-1 text-xs">
            <button
              onClick={onSelectAll}
              className="text-blue-600 hover:text-blue-700 font-medium px-1"
            >
              All
            </button>
            <span className="text-slate-300">|</span>
            <button
              onClick={onDeselectAll}
              className="text-blue-600 hover:text-blue-700 font-medium px-1"
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
                className="w-full flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-slate-50 transition-colors text-left"
              >
                {/* Colored Checkbox */}
                <div
                  className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-colors"
                  style={{
                    backgroundColor: isSelected ? color : 'transparent',
                    border: `2px solid ${color}`,
                  }}
                >
                  {isSelected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                </div>
                <span className={`text-sm ${isSelected ? 'text-slate-800' : 'text-slate-500'}`}>
                  Dr. {surgeon.last_name}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-slate-100 mx-4" />

      {/* Other Calendars Section */}
      <div className="px-4 py-4">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-3">
          Other
        </span>
        <button
          onClick={onToggleHolidays}
          className="w-full flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-slate-50 transition-colors text-left"
        >
          {/* Holiday Checkbox */}
          <div
            className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-colors ${
              showHolidays ? 'bg-emerald-500' : 'border-2 border-emerald-500'
            }`}
          >
            {showHolidays && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
          </div>
          <span className={`text-sm ${showHolidays ? 'text-slate-800' : 'text-slate-500'}`}>
            Facility Holidays
          </span>
        </button>
      </div>
    </div>
  )
}