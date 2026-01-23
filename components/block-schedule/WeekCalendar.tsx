// components/block-schedule/WeekCalendar.tsx
'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { ExpandedBlock, formatTime12Hour, DAY_OF_WEEK_SHORT } from '@/types/block-scheduling'
import { BlockCard } from './BlockCard'

interface WeekCalendarProps {
  weekStart: Date
  blocks: ExpandedBlock[]
  colorMap: Record<string, string>
  isDateClosed: (date: Date) => boolean
  onDragSelect: (dayOfWeek: number, startTime: string, endTime: string, clickPosition?: { x: number; y: number }) => void
  onBlockClick: (block: ExpandedBlock, clickPosition?: { x: number; y: number }) => void
}

// Full 24 hours
const HOURS = Array.from({ length: 24 }, (_, i) => i) // 0 (12 AM) to 23 (11 PM)
const HOUR_HEIGHT = 60 // pixels per hour
const DEFAULT_SCROLL_HOUR = 6 // Scroll to 6 AM on load

export function WeekCalendar({
  weekStart,
  blocks,
  colorMap,
  isDateClosed,
  onDragSelect,
  onBlockClick,
}: WeekCalendarProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState<{ day: number; hour: number } | null>(null)
  const [dragEnd, setDragEnd] = useState<{ day: number; hour: number } | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Generate week days
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart)
    date.setDate(date.getDate() + i)
    return date
  })

  // Auto-scroll to default hour on mount
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = DEFAULT_SCROLL_HOUR * HOUR_HEIGHT
    }
  }, [])

  // Get time from Y position (now supports 0-23)
  const getTimeFromY = (y: number): number => {
    const rect = gridRef.current?.getBoundingClientRect()
    if (!rect) return DEFAULT_SCROLL_HOUR
    const relativeY = y - rect.top
    const hour = Math.floor(relativeY / HOUR_HEIGHT)
    return Math.max(0, Math.min(23, hour))
  }

  // Get day from X position
  const getDayFromX = (x: number): number => {
    const rect = gridRef.current?.getBoundingClientRect()
    if (!rect) return 0
    const relativeX = x - rect.left - 60 // Account for time column
    const dayWidth = (rect.width - 60) / 7
    const day = Math.floor(relativeX / dayWidth)
    return Math.max(0, Math.min(6, day))
  }

  // Mouse handlers for drag selection
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return // Only left click
    if ((e.target as HTMLElement).closest('.block-card')) return // Don't start drag on blocks

    const day = getDayFromX(e.clientX)
    const hour = getTimeFromY(e.clientY)

    // Don't allow selection on closed days
    if (isDateClosed(weekDays[day])) return

    setIsDragging(true)
    setDragStart({ day, hour })
    setDragEnd({ day, hour: hour + 1 })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !dragStart) return

    const hour = getTimeFromY(e.clientY)
    // Keep same day, only adjust time
    setDragEnd({ day: dragStart.day, hour: Math.max(dragStart.hour + 1, hour + 1) })
  }

  const handleMouseUp = (e: React.MouseEvent) => {
    if (isDragging && dragStart && dragEnd) {
      const startHour = Math.min(dragStart.hour, dragEnd.hour - 1)
      const endHour = Math.max(dragStart.hour + 1, dragEnd.hour)

      const startTime = `${startHour.toString().padStart(2, '0')}:00:00`
      const endTime = `${endHour.toString().padStart(2, '0')}:00:00`

      // Pass click position for popover positioning
      onDragSelect(dragStart.day, startTime, endTime, { x: e.clientX, y: e.clientY })
    }

    setIsDragging(false)
    setDragStart(null)
    setDragEnd(null)
  }

  // Handle block click with position
  const handleBlockClick = (block: ExpandedBlock, e: React.MouseEvent) => {
    e.stopPropagation()
    onBlockClick(block, { x: e.clientX, y: e.clientY })
  }

  // Group blocks by day
  const blocksByDay: Record<number, ExpandedBlock[]> = {}
  blocks.forEach(block => {
    const date = new Date(block.block_date)
    const day = date.getDay()
    if (!blocksByDay[day]) blocksByDay[day] = []
    blocksByDay[day].push(block)
  })

  return (
    <div className="flex flex-col h-full">
      {/* Day Headers - Fixed */}
      <div className="flex border-b border-gray-200 bg-gray-50 flex-shrink-0">
        <div className="w-[60px] flex-shrink-0" /> {/* Time column spacer */}
        {weekDays.map((date, i) => {
          const isToday = isSameDay(date, new Date())
          const isClosed = isDateClosed(date)

          return (
            <div
              key={i}
              className={`flex-1 py-3 text-center border-l border-gray-200 ${
                isClosed ? 'bg-gray-100' : ''
              }`}
            >
              <div className={`text-xs font-medium ${isToday ? 'text-blue-600' : 'text-gray-500'}`}>
                {DAY_OF_WEEK_SHORT[i]}
              </div>
              <div
                className={`text-lg font-semibold mt-0.5 ${
                  isToday
                    ? 'text-white bg-blue-600 rounded-full w-8 h-8 flex items-center justify-center mx-auto'
                    : isClosed
                    ? 'text-gray-400'
                    : 'text-gray-900'
                }`}
              >
                {date.getDate()}
              </div>
              {isClosed && (
                <div className="text-xs text-gray-400 mt-1">Closed</div>
              )}
            </div>
          )
        })}
      </div>

      {/* Scrollable Time Grid */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-auto"
      >
        <div
          ref={gridRef}
          className="flex relative select-none"
          style={{ height: `${HOURS.length * HOUR_HEIGHT}px` }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            if (isDragging) {
              setIsDragging(false)
              setDragStart(null)
              setDragEnd(null)
            }
          }}
        >
          {/* Time Labels */}
          <div className="w-[60px] flex-shrink-0 bg-white sticky left-0 z-10">
            {HOURS.map(hour => (
              <div
                key={hour}
                className="h-[60px] pr-2 text-right text-xs text-gray-500 relative"
              >
                <span className="absolute -top-2 right-2">
                  {formatTime12Hour(`${hour.toString().padStart(2, '0')}:00:00`)}
                </span>
              </div>
            ))}
          </div>

          {/* Day Columns */}
          {weekDays.map((date, dayIndex) => {
            const isClosed = isDateClosed(date)
            const dayBlocks = blocksByDay[dayIndex] || []

            return (
              <div
                key={dayIndex}
                className={`flex-1 border-l border-gray-200 relative ${
                  isClosed ? 'bg-gray-100 cursor-not-allowed' : 'bg-white cursor-crosshair'
                }`}
              >
                {/* Hour lines */}
                {HOURS.map(hour => (
                  <div
                    key={hour}
                    className={`h-[60px] border-b border-gray-100 ${
                      hour === 12 ? 'border-gray-200' : '' // Slightly darker line at noon
                    }`}
                  />
                ))}

                {/* Closed overlay */}
                {isClosed && (
                  <div className="absolute inset-0 bg-gray-100/50 bg-stripes pointer-events-none" />
                )}

                {/* Blocks */}
                {!isClosed && dayBlocks.map(block => (
                  <BlockCard
                    key={block.block_id}
                    block={block}
                    color={colorMap[block.surgeon_id] || '#6B7280'}
                    hourHeight={HOUR_HEIGHT}
                    startHour={0}
                    onClick={(e) => handleBlockClick(block, e)}
                  />
                ))}

                {/* Drag selection preview */}
                {isDragging && dragStart?.day === dayIndex && dragEnd && (
                  <div
                    className="absolute left-1 right-1 bg-blue-200/50 border-2 border-blue-400 border-dashed rounded-lg pointer-events-none z-20"
                    style={{
                      top: `${Math.min(dragStart.hour, dragEnd.hour - 1) * HOUR_HEIGHT}px`,
                      height: `${Math.abs(dragEnd.hour - dragStart.hour) * HOUR_HEIGHT}px`,
                    }}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  )
}