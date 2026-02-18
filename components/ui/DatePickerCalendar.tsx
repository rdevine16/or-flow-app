'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'

interface DatePickerCalendarProps {
  value: string // "YYYY-MM-DD"
  onChange: (date: string) => void
  highlightedDates?: Set<string> // Set of "YYYY-MM-DD" strings to show a dot indicator
  className?: string
}

const DAYS_OF_WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function buildCalendarGrid(year: number, month: number): { day: number; month: number; year: number; isCurrentMonth: boolean }[] {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, month, 0).getDate()

  const cells: { day: number; month: number; year: number; isCurrentMonth: boolean }[] = []

  // Previous month fill
  for (let i = firstDay - 1; i >= 0; i--) {
    const prevMonth = month === 0 ? 11 : month - 1
    const prevYear = month === 0 ? year - 1 : year
    cells.push({ day: daysInPrevMonth - i, month: prevMonth, year: prevYear, isCurrentMonth: false })
  }

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, month, year, isCurrentMonth: true })
  }

  // Next month fill to 42 cells (6 rows)
  const remaining = 42 - cells.length
  for (let d = 1; d <= remaining; d++) {
    const nextMonth = month === 11 ? 0 : month + 1
    const nextYear = month === 11 ? year + 1 : year
    cells.push({ day: d, month: nextMonth, year: nextYear, isCurrentMonth: false })
  }

  return cells
}

function formatCellDate(cell: { day: number; month: number; year: number }): string {
  return `${cell.year}-${String(cell.month + 1).padStart(2, '0')}-${String(cell.day).padStart(2, '0')}`
}

function formatDisplayDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function DatePickerCalendar({ value, onChange, highlightedDates, className }: DatePickerCalendarProps) {
  const [isOpen, setIsOpen] = useState(false)

  // Internal view state — month navigation never triggers onChange
  const [viewYear, setViewYear] = useState(() => {
    const [y] = value.split('-').map(Number)
    return y
  })
  const [viewMonth, setViewMonth] = useState(() => {
    const parts = value.split('-').map(Number)
    return parts[1] - 1 // 0-indexed
  })

  const popoverRef = useRef<HTMLDivElement>(null)

  // Sync view to selected date when popover opens
  useEffect(() => {
    if (isOpen) {
      const [y, m] = value.split('-').map(Number)
      setViewYear(y)
      setViewMonth(m - 1)
    }
  }, [isOpen, value])

  // Click-outside close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Escape key close
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  const goToPrevMonth = useCallback(() => {
    setViewMonth(prev => {
      if (prev === 0) {
        setViewYear(y => y - 1)
        return 11
      }
      return prev - 1
    })
  }, [])

  const goToNextMonth = useCallback(() => {
    setViewMonth(prev => {
      if (prev === 11) {
        setViewYear(y => y + 1)
        return 0
      }
      return prev + 1
    })
  }, [])

  const handleDayClick = useCallback((cell: { day: number; month: number; year: number }) => {
    const dateStr = formatCellDate(cell)
    onChange(dateStr)
    setIsOpen(false)
  }, [onChange])

  const handleTodayClick = useCallback(() => {
    const now = new Date()
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    onChange(dateStr)
    setIsOpen(false)
  }, [onChange])

  const grid = buildCalendarGrid(viewYear, viewMonth)
  const monthLabel = new Date(viewYear, viewMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  // Today's date string for comparison
  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  return (
    <div className={`relative ${className ?? ''}`} ref={popoverRef}>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="h-7 flex items-center gap-1.5 px-2.5 border border-slate-200 rounded-md text-xs text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
      >
        <Calendar className="w-3 h-3 text-slate-400" />
        <span>{formatDisplayDate(value)}</span>
      </button>

      {/* Popover panel */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-1.5 w-[280px] bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
          {/* Month/year header */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-100">
            <button
              onClick={goToPrevMonth}
              className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-500 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-semibold text-slate-800">{monthLabel}</span>
            <button
              onClick={goToNextMonth}
              className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-500 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Day-of-week header */}
          <div className="grid grid-cols-7 px-2 pt-2">
            {DAYS_OF_WEEK.map(d => (
              <div key={d} className="h-7 flex items-center justify-center text-[11px] font-medium text-slate-400 uppercase">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 px-2 pb-2">
            {grid.map((cell, idx) => {
              const cellDate = formatCellDate(cell)
              const isSelected = cellDate === value
              const isToday = cellDate === todayStr && !isSelected
              const hasData = highlightedDates?.has(cellDate) ?? false

              let cellClass = 'h-9 w-full flex flex-col items-center justify-center text-xs rounded-md cursor-pointer transition-colors '

              if (isSelected) {
                cellClass += 'bg-blue-600 text-white font-semibold hover:bg-blue-700'
              } else if (isToday) {
                cellClass += 'ring-1 ring-blue-400 text-blue-600 font-medium hover:bg-blue-50'
              } else if (cell.isCurrentMonth) {
                cellClass += 'text-slate-700 hover:bg-slate-100'
              } else {
                cellClass += 'text-slate-300 hover:bg-slate-50'
              }

              return (
                <button
                  key={idx}
                  onClick={() => handleDayClick(cell)}
                  className={cellClass}
                >
                  <span>{cell.day}</span>
                  {hasData && (
                    <span className={`w-1 h-1 rounded-full mt-0.5 ${isSelected ? 'bg-white' : 'bg-blue-500'}`} />
                  )}
                </button>
              )
            })}
          </div>

          {/* Today footer */}
          <div className="border-t border-slate-100 px-3 py-2">
            <button
              onClick={handleTodayClick}
              className="w-full text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md py-1.5 transition-colors"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
