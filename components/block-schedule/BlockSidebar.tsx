// components/block-schedule/BlockSidebar.tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Plus, Check, MoreVertical } from 'lucide-react'

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
  onColorChange?: (surgeonId: string, color: string) => void
}

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

// Google Calendar color palette
const COLOR_PALETTE = [
  '#D50000', '#E67C73', '#F4511E', '#F6BF26', '#33B679', '#0B8043',
  '#039BE5', '#3F51B5', '#7986CB', '#8E24AA', '#616161', '#795548',
  '#EF5350', '#FF7043', '#FFCA28', '#66BB6A', '#26A69A', '#42A5F5',
  '#5C6BC0', '#AB47BC', '#EC407A', '#78909C', '#8D6E63', '#BDBDBD',
]

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
  onColorChange,
}: BlockSidebarProps) {
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date(currentWeekStart)
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  
  // Color picker state
  const [colorPickerOpen, setColorPickerOpen] = useState<string | null>(null)
  const colorPickerRef = useRef<HTMLDivElement>(null)

  // Close color picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setColorPickerOpen(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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

  const handleColorSelect = (surgeonId: string, color: string) => {
    if (onColorChange) {
      onColorChange(surgeonId, color)
    }
    setColorPickerOpen(null)
  }

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

        <div className="space-y-0.5">
          {surgeons.map(surgeon => {
            const isSelected = selectedSurgeonIds.has(surgeon.id)
            const color = colorMap[surgeon.id] || '#3B82F6'

            return (
              <div key={surgeon.id} className="relative group flex items-center">
                <button
                  onClick={() => onToggleSurgeon(surgeon.id)}
                  className="flex-1 flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-slate-50 transition-colors text-left"
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
                  <span className={`text-sm truncate ${isSelected ? 'text-slate-800' : 'text-slate-500'}`}>
                    Dr. {surgeon.last_name}
                  </span>
                </button>
                
                {/* Three dot menu for color picker */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setColorPickerOpen(colorPickerOpen === surgeon.id ? null : surgeon.id)
                  }}
                  className="p-1 opacity-0 group-hover:opacity-100 hover:bg-slate-100 rounded transition-all"
                >
                  <MoreVertical className="h-4 w-4 text-slate-400" />
                </button>

                {/* Color Picker Dropdown */}
                {colorPickerOpen === surgeon.id && (
                  <div 
                    ref={colorPickerRef}
                    className="absolute left-full top-0 ml-2 bg-white rounded-lg shadow-xl border border-slate-200 p-3 z-[100]"
                    style={{ width: '200px' }}
                  >
                    <div className="text-sm font-medium text-slate-700 mb-2">Display this only</div>
                    <div className="text-sm text-slate-500 mb-3 pb-3 border-b border-slate-100">Settings and sharing</div>
                    <div className="grid grid-cols-6 gap-1.5">
                      {COLOR_PALETTE.map((paletteColor) => (
                        <button
                          key={paletteColor}
                          onClick={() => handleColorSelect(surgeon.id, paletteColor)}
                          className={`w-6 h-6 rounded-full transition-transform hover:scale-110 ${
                            color === paletteColor ? 'ring-2 ring-offset-2 ring-blue-500' : ''
                          }`}
                          style={{ backgroundColor: paletteColor }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
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