// components/block-schedule/WeekCalendar.tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { ExpandedBlock, formatTime12Hour, DAY_OF_WEEK_SHORT } from '@/types/block-scheduling'
import { BlockCard } from './BlockCard'

interface WeekCalendarProps {
  weekStart: Date
  blocks: ExpandedBlock[]
  colorMap: Record<string, string>
  isDateClosed: (date: Date) => boolean
  onDragSelect: (dayOfWeek: number, startTime: string, endTime: string, clickPosition?: { x: number; y: number }) => void
  onBlockClick: (block: ExpandedBlock, clickPosition?: { x: number; y: number }) => void
  // Keep selection visible while popover is open
  activeSelection?: {
    dayOfWeek: number
    startTime: string
    endTime: string
  } | null
}

// Full 24 hours
const HOURS = Array.from({ length: 24 }, (_, i) => i)
const HOUR_HEIGHT = 60
const DEFAULT_SCROLL_HOUR = 6

export function WeekCalendar({
  weekStart,
  blocks,
  colorMap,
  isDateClosed,
  onDragSelect,
  onBlockClick,
  activeSelection,
}: WeekCalendarProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState<{ day: number; hour: number } | null>(null)
  const [dragEnd, setDragEnd] = useState<{ day: number; hour: number } | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const autoScrollRef = useRef<number | null>(null)
  const lastMouseYRef = useRef<number>(0)

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

  // Get time from Y position with 15-min snapping for precision
  const getTimeFromY = (y: number): number => {
    const rect = gridRef.current?.getBoundingClientRect()
    if (!rect) return DEFAULT_SCROLL_HOUR
    const relativeY = y - rect.top
    // Snap to 15-minute increments
    const rawHour = relativeY / HOUR_HEIGHT
    const snappedHour = Math.round(rawHour * 4) / 4 // Round to nearest 0.25
    return Math.max(0, Math.min(24, snappedHour))
  }

  // Get day from X position
  const getDayFromX = (x: number): number => {
    const rect = gridRef.current?.getBoundingClientRect()
    if (!rect) return 0
    const relativeX = x - rect.left - 60
    const dayWidth = (rect.width - 60) / 7
    const day = Math.floor(relativeX / dayWidth)
    return Math.max(0, Math.min(6, day))
  }

  // Format hour to time string
  const hourToTimeString = (hour: number): string => {
    const h = Math.floor(hour)
    const m = Math.round((hour % 1) * 60)
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:00`
  }

  // Format duration nicely
  const formatDuration = (hours: number): string => {
    if (hours < 1) {
      return `${Math.round(hours * 60)} min`
    }
    const h = Math.floor(hours)
    const m = Math.round((hours % 1) * 60)
    if (m === 0) {
      return `${h} hr${h !== 1 ? 's' : ''}`
    }
    return `${h}h ${m}m`
  }

  // Auto-scroll when dragging near edges
  const SCROLL_ZONE = 60 // pixels from edge to trigger scroll
  const SCROLL_SPEED = 8 // pixels per frame

  const startAutoScroll = (direction: 'up' | 'down') => {
    if (autoScrollRef.current) return

    const scroll = () => {
      if (!scrollContainerRef.current || !gridRef.current) return
      
      const delta = direction === 'up' ? -SCROLL_SPEED : SCROLL_SPEED
      scrollContainerRef.current.scrollTop += delta

      // Update drag end position based on scroll position and last mouse Y
      const gridRect = gridRef.current.getBoundingClientRect()
      const relativeY = lastMouseYRef.current - gridRect.top
      const rawHour = relativeY / HOUR_HEIGHT
      const snappedHour = Math.round(rawHour * 4) / 4
      const newHour = Math.max(0, Math.min(24, snappedHour))
      
      setDragEnd(prev => prev ? { ...prev, hour: newHour } : null)

      autoScrollRef.current = requestAnimationFrame(scroll)
    }

    autoScrollRef.current = requestAnimationFrame(scroll)
  }

  const stopAutoScroll = () => {
    if (autoScrollRef.current) {
      cancelAnimationFrame(autoScrollRef.current)
      autoScrollRef.current = null
    }
  }

  // Cleanup auto-scroll on unmount
  useEffect(() => {
    return () => stopAutoScroll()
  }, [])

  // Mouse handlers for drag selection
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    if ((e.target as HTMLElement).closest('.block-card')) return

    const day = getDayFromX(e.clientX)
    const hour = getTimeFromY(e.clientY)

    if (isDateClosed(weekDays[day])) return

    setIsDragging(true)
    setDragStart({ day, hour })
    setDragEnd({ day, hour: hour + 1 })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !dragStart) return

    // Track mouse position for auto-scroll
    lastMouseYRef.current = e.clientY

    const hour = getTimeFromY(e.clientY)
    // Allow dragging in both directions
    setDragEnd({ day: dragStart.day, hour })

    // Check if near edges for auto-scroll
    if (scrollContainerRef.current) {
      const rect = scrollContainerRef.current.getBoundingClientRect()
      const mouseY = e.clientY

      if (mouseY < rect.top + SCROLL_ZONE && scrollContainerRef.current.scrollTop > 0) {
        // Near top edge - scroll up
        startAutoScroll('up')
      } else if (mouseY > rect.bottom - SCROLL_ZONE && 
                 scrollContainerRef.current.scrollTop < scrollContainerRef.current.scrollHeight - rect.height) {
        // Near bottom edge - scroll down
        startAutoScroll('down')
      } else {
        // Not near edge - stop auto-scroll
        stopAutoScroll()
      }
    }
  }

  const handleMouseUp = (e: React.MouseEvent) => {
    stopAutoScroll() // Always stop auto-scroll on mouse up
    
    if (isDragging && dragStart && dragEnd) {
      const startHour = Math.min(dragStart.hour, dragEnd.hour)
      const endHour = Math.max(dragStart.hour, dragEnd.hour)

      // Ensure minimum 30-min block
      const finalEndHour = endHour <= startHour + 0.25 ? startHour + 0.5 : endHour

      const startTime = hourToTimeString(startHour)
      const endTime = hourToTimeString(finalEndHour)

      onDragSelect(dragStart.day, startTime, endTime, { x: e.clientX, y: e.clientY })
    }

    setIsDragging(false)
    setDragStart(null)
    setDragEnd(null)
  }

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

  // Calculate drag selection display values (handle dragging up or down)
  const dragStartHour = dragStart && dragEnd 
    ? Math.min(dragStart.hour, dragEnd.hour) 
    : dragStart?.hour ?? 0
  const dragEndHour = dragStart && dragEnd 
    ? Math.max(dragStart.hour, dragEnd.hour) 
    : (dragStart?.hour ?? 0) + 1
  const dragDuration = Math.max(dragEndHour - dragStartHour, 0.25)

  return (
    <div className="flex flex-col h-full">
      {/* Day Headers - Google Calendar Style */}
      <div className="flex border-b border-slate-200 bg-white flex-shrink-0">
        <div className="w-[60px] flex-shrink-0" />
        {weekDays.map((date, i) => {
          const isToday = isSameDay(date, new Date())
          const isClosed = isDateClosed(date)

          return (
            <div
              key={i}
              className="flex-1 py-3 text-center"
            >
              <div className={`text-xs font-medium uppercase tracking-wide ${
                isToday ? 'text-blue-600' : 'text-slate-500'
              }`}>
                {DAY_OF_WEEK_SHORT[i]}
              </div>
              <div
                className={`text-2xl font-normal mt-0.5 ${
                  isToday
                    ? 'text-white bg-blue-600 rounded-full w-10 h-10 flex items-center justify-center mx-auto'
                    : isClosed
                    ? 'text-slate-300'
                    : 'text-slate-800'
                }`}
              >
                {date.getDate()}
              </div>
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
            stopAutoScroll()
            if (isDragging) {
              setIsDragging(false)
              setDragStart(null)
              setDragEnd(null)
            }
          }}
        >
          {/* Time Labels - Google style */}
          <div className="w-[60px] flex-shrink-0 bg-white sticky left-0 z-10 border-r border-slate-100">
            {HOURS.map(hour => (
              <div
                key={hour}
                className="h-[60px] pr-3 text-right relative"
              >
                <span className="absolute -top-2.5 right-3 text-[11px] text-slate-400 font-medium">
                  {hour === 0 ? '' : formatTime12Hour(`${hour.toString().padStart(2, '0')}:00:00`).replace(':00', '')}
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
                className={`flex-1 relative ${
                  isClosed ? 'bg-slate-50 cursor-not-allowed' : 'bg-white cursor-crosshair'
                }`}
              >
                {/* Hour lines - subtle like Google */}
                {HOURS.map(hour => (
                  <div
                    key={hour}
                    className="h-[60px] border-b border-slate-100"
                  />
                ))}

                {/* Closed overlay */}
                {isClosed && (
                  <div className="absolute inset-0 bg-slate-100/70 pointer-events-none">
                    <div className="absolute inset-0 opacity-10" style={{
                      backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, currentColor 10px, currentColor 11px)',
                    }} />
                  </div>
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

                {/* Drag selection preview with live time display */}
                {isDragging && dragStart?.day === dayIndex && (
                  <div
                    className="absolute left-1 right-1 bg-blue-500 rounded-lg pointer-events-none z-20 overflow-hidden"
                    style={{
                      top: `${dragStartHour * HOUR_HEIGHT}px`,
                      height: `${Math.max(dragDuration * HOUR_HEIGHT, 20)}px`,
                      opacity: 0.9,
                    }}
                  >
                    {/* Time badge - always visible */}
                    <div className="absolute inset-x-0 top-0 p-2">
                      <div className="text-white text-sm font-semibold">
                        {formatTime12Hour(hourToTimeString(dragStartHour))} – {formatTime12Hour(hourToTimeString(dragEndHour))}
                      </div>
                      {dragDuration >= 0.5 && (
                        <div className="text-white/80 text-xs mt-0.5">
                          {formatDuration(dragDuration)}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Active selection (shown while popover is open) */}
                {!isDragging && activeSelection && activeSelection.dayOfWeek === dayIndex && (() => {
                  const [startH, startM] = activeSelection.startTime.split(':').map(Number)
                  const [endH, endM] = activeSelection.endTime.split(':').map(Number)
                  const selectionStartHour = startH + startM / 60
                  const selectionEndHour = endH + endM / 60
                  const selectionDuration = selectionEndHour - selectionStartHour

                  return (
                    <div
                      className="absolute left-1 right-1 bg-blue-500 rounded-lg pointer-events-none z-20 overflow-hidden"
                      style={{
                        top: `${selectionStartHour * HOUR_HEIGHT}px`,
                        height: `${Math.max(selectionDuration * HOUR_HEIGHT, 20)}px`,
                        opacity: 0.9,
                      }}
                    >
                      <div className="absolute inset-x-0 top-0 p-2">
                        <div className="text-white text-sm font-semibold">
                          {formatTime12Hour(activeSelection.startTime)} – {formatTime12Hour(activeSelection.endTime)}
                        </div>
                        {selectionDuration >= 0.5 && (
                          <div className="text-white/80 text-xs mt-0.5">
                            {formatDuration(selectionDuration)}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })()}
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