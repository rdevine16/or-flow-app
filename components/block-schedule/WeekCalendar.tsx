// components/block-schedule/WeekCalendar.tsx
'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
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

  // Refs for stable access inside document-level listeners
  const isDraggingRef = useRef(false)
  const dragStartRef = useRef<{ day: number; hour: number } | null>(null)
  const dragEndRef = useRef<{ day: number; hour: number } | null>(null)

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
  const getTimeFromY = useCallback((y: number): number => {
    const rect = gridRef.current?.getBoundingClientRect()
    if (!rect) return DEFAULT_SCROLL_HOUR
    const relativeY = y - rect.top
    const rawHour = relativeY / HOUR_HEIGHT
    const snappedHour = Math.round(rawHour * 4) / 4
    return Math.max(0, Math.min(24, snappedHour))
  }, [])

  // Get day from X position
  const getDayFromX = useCallback((x: number): number => {
    const rect = gridRef.current?.getBoundingClientRect()
    if (!rect) return 0
    const relativeX = x - rect.left - 60
    const dayWidth = (rect.width - 60) / 7
    const day = Math.floor(relativeX / dayWidth)
    return Math.max(0, Math.min(6, day))
  }, [])

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

  // =====================================================
  // AUTO-SCROLL: Smooth, speed ramps near edges
  // =====================================================
  const SCROLL_ZONE = 80 // pixels from edge to trigger scroll
  const SCROLL_SPEED_MIN = 3
  const SCROLL_SPEED_MAX = 14

  const startAutoScroll = useCallback((direction: 'up' | 'down') => {
    // Always restart — direction may have changed
    if (autoScrollRef.current) {
      cancelAnimationFrame(autoScrollRef.current)
      autoScrollRef.current = null
    }

    const scroll = () => {
      if (!scrollContainerRef.current || !gridRef.current) return
      if (!isDraggingRef.current) return // Stop if drag ended

      const containerRect = scrollContainerRef.current.getBoundingClientRect()
      const mouseY = lastMouseYRef.current

      // Calculate scroll speed based on distance from edge (closer = faster)
      let distFromEdge: number
      if (direction === 'up') {
        distFromEdge = containerRect.top + SCROLL_ZONE - mouseY
      } else {
        distFromEdge = mouseY - (containerRect.bottom - SCROLL_ZONE)
      }
      const ratio = Math.min(1, Math.max(0, distFromEdge / SCROLL_ZONE))
      const speed = SCROLL_SPEED_MIN + ratio * (SCROLL_SPEED_MAX - SCROLL_SPEED_MIN)

      const delta = direction === 'up' ? -speed : speed
      scrollContainerRef.current.scrollTop += delta

      // Update drag end position based on new scroll + mouse position
      const gridRect = gridRef.current.getBoundingClientRect()
      const relativeY = mouseY - gridRect.top
      const rawHour = relativeY / HOUR_HEIGHT
      const snappedHour = Math.round(rawHour * 4) / 4
      const newHour = Math.max(0, Math.min(24, snappedHour))

      setDragEnd(prev => prev ? { ...prev, hour: newHour } : null)

      autoScrollRef.current = requestAnimationFrame(scroll)
    }

    autoScrollRef.current = requestAnimationFrame(scroll)
  }, [])

  const stopAutoScroll = useCallback(() => {
    if (autoScrollRef.current) {
      cancelAnimationFrame(autoScrollRef.current)
      autoScrollRef.current = null
    }
  }, [])

  // Cleanup auto-scroll on unmount
  useEffect(() => {
    return () => stopAutoScroll()
  }, [stopAutoScroll])

  // =====================================================
  // DRAG HANDLERS: Use document-level move/up so drag
  // survives leaving the grid element
  // =====================================================
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    if ((e.target as HTMLElement).closest('.block-card')) return

    const day = getDayFromX(e.clientX)
    const hour = getTimeFromY(e.clientY)

    if (isDateClosed(weekDays[day])) return

    e.preventDefault() // Prevent text selection during drag

    isDraggingRef.current = true
    dragStartRef.current = { day, hour }
    dragEndRef.current = { day, hour: hour + 0.5 }

    setIsDragging(true)
    setDragStart({ day, hour })
    setDragEnd({ day, hour: hour + 0.5 }) // Default to 30 min
    lastMouseYRef.current = e.clientY
  }

  // Document-level mousemove — works even when cursor leaves the grid
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const handleDocumentMouseMove = useCallback((e: MouseEvent) => {
    if (!isDraggingRef.current || !dragStartRef.current) return

    lastMouseYRef.current = e.clientY

    const hour = getTimeFromY(e.clientY)
    const newEnd = { day: dragStartRef.current.day, hour }
    dragEndRef.current = newEnd
    setDragEnd(newEnd)

    // Auto-scroll when near edges of the scroll container
    if (scrollContainerRef.current) {
      const rect = scrollContainerRef.current.getBoundingClientRect()

      if (e.clientY < rect.top + SCROLL_ZONE && scrollContainerRef.current.scrollTop > 0) {
        startAutoScroll('up')
      } else if (
        e.clientY > rect.bottom - SCROLL_ZONE &&
        scrollContainerRef.current.scrollTop < scrollContainerRef.current.scrollHeight - rect.height
      ) {
        startAutoScroll('down')
      } else {
        stopAutoScroll()
      }
    }
  }, [getTimeFromY, startAutoScroll, stopAutoScroll])

  // Document-level mouseup — always fires, even outside the grid
  // Uses the continuously-updated drag state instead of recalculating
  // from cursor Y to avoid bugs when cursor is outside the grid
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const handleDocumentMouseUp = useCallback((e: MouseEvent) => {
    if (!isDraggingRef.current) return

    stopAutoScroll()

    const start = dragStartRef.current
    if (start) {
      // Try to get end from current cursor position, but fall back to
      // the last known good drag-end if the cursor is outside the grid
      let endHour: number
      const rect = gridRef.current?.getBoundingClientRect()
      if (rect && e.clientY >= rect.top && e.clientY <= rect.bottom) {
        endHour = getTimeFromY(e.clientY)
      } else {
        // Cursor is outside grid — use the last dragEnd we tracked during mousemove
        endHour = dragEndRef.current?.hour ?? start.hour + 0.5
      }

      const startHour = Math.min(start.hour, endHour)
      const rawEndHour = Math.max(start.hour, endHour)

      // Ensure minimum 30-min block
      const finalEndHour = rawEndHour <= startHour + 0.25 ? startHour + 0.5 : rawEndHour

      const startTime = hourToTimeString(startHour)
      const endTime = hourToTimeString(finalEndHour)

      // Position the popover near the mouse, clamped to viewport
      const popX = Math.min(e.clientX, window.innerWidth - 400)
      const popY = Math.min(e.clientY, window.innerHeight - 300)

      onDragSelect(start.day, startTime, endTime, { x: popX, y: popY })
    }

    isDraggingRef.current = false
    dragStartRef.current = null
    dragEndRef.current = null
    setIsDragging(false)
    setDragStart(null)
    setDragEnd(null)
  }, [getTimeFromY, onDragSelect, stopAutoScroll])

  // Register/unregister document listeners when dragging starts/stops
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleDocumentMouseMove)
      document.addEventListener('mouseup', handleDocumentMouseUp)
    }
    return () => {
      document.removeEventListener('mousemove', handleDocumentMouseMove)
      document.removeEventListener('mouseup', handleDocumentMouseUp)
    }
  }, [isDragging, handleDocumentMouseMove, handleDocumentMouseUp])

  const handleBlockClick = (block: ExpandedBlock, e: React.MouseEvent) => {
    e.stopPropagation()
    // Position popover clamped to viewport
    const popX = Math.min(e.clientX, window.innerWidth - 400)
    const popY = Math.min(e.clientY, window.innerHeight - 300)
    onBlockClick(block, { x: popX, y: popY })
  }

  // Helper to check if date string matches a weekDay
  const dateMatchesWeekDay = (dateStr: string, weekDay: Date): boolean => {
    const [year, month, day] = dateStr.split('-').map(Number)
    return (
      weekDay.getFullYear() === year &&
      weekDay.getMonth() === month - 1 &&
      weekDay.getDate() === day
    )
  }

  // Group blocks by day index (0-6) based on actual week dates
  const blocksByDay: Record<number, ExpandedBlock[]> = {}
  blocks.forEach(block => {
    weekDays.forEach((weekDay, dayIndex) => {
      if (dateMatchesWeekDay(block.block_date, weekDay)) {
        if (!blocksByDay[dayIndex]) blocksByDay[dayIndex] = []
        blocksByDay[dayIndex].push(block)
      }
    })
  })

  // Calculate overlap columns for blocks (Google Calendar style)
  const calculateBlockLayout = (dayBlocks: ExpandedBlock[]): Map<string, { columnIndex: number; totalColumns: number; isSameStart: boolean }> => {
    const layout = new Map<string, { columnIndex: number; totalColumns: number; isSameStart: boolean }>()

    if (dayBlocks.length === 0) return layout

    // First, group blocks by exact start time
    const byStartTime = new Map<string, ExpandedBlock[]>()
    dayBlocks.forEach(block => {
      const key = block.start_time
      if (!byStartTime.has(key)) byStartTime.set(key, [])
      byStartTime.get(key)!.push(block)
    })

    // Blocks with same start time get equal columns (side by side)
    byStartTime.forEach((group) => {
      group.forEach((block, index) => {
        layout.set(block.block_id, {
          columnIndex: index,
          totalColumns: group.length,
          isSameStart: group.length > 1
        })
      })
    })

    // Handle cascading for different start times
    const sorted = [...dayBlocks].sort((a, b) => a.start_time.localeCompare(b.start_time))

    sorted.forEach((block, i) => {
      const currentLayout = layout.get(block.block_id)

      if (currentLayout && currentLayout.totalColumns === 1) {
        const [startH, startM] = block.start_time.split(':').map(Number)
        const blockStart = startH * 60 + startM

        let cascadeOffset = 0
        for (let j = 0; j < i; j++) {
          const prevBlock = sorted[j]
          const [pEndH, pEndM] = prevBlock.end_time.split(':').map(Number)
          const prevEnd = pEndH * 60 + pEndM

          if (prevEnd > blockStart) {
            cascadeOffset++
          }
        }

        if (cascadeOffset > 0) {
          layout.set(block.block_id, {
            columnIndex: cascadeOffset,
            totalColumns: 1,
            isSameStart: false
          })
        }
      }
    })

    return layout
  }

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
          // No onMouseMove/onMouseUp/onMouseLeave — handled at document level
        >
          {/* Time Labels - Google style */}
          <div className="w-[60px] flex-shrink-0 bg-white sticky left-0 z-10 border-r border-slate-100">
            {HOURS.map(hour => (
              <div
                key={hour}
                className="h-[60px] pr-3 text-right relative"
              >
                <span className="absolute -top-2.5 right-3 text-xs text-slate-400 font-medium">
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
                {/* Hour lines */}
                {HOURS.map(hour => (
                  <div
                    key={hour}
                    className="h-[60px] border-b border-slate-100"
                  />
                ))}

                {/* Closed overlay */}
                {isClosed && (
                  <div className="absolute inset-0 bg-slate-100/50 pointer-events-none">
                    <div className="absolute inset-0 opacity-[0.07]" style={{
                      backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, currentColor 10px, currentColor 11px)',
                    }} />
                    <div className="flex items-start justify-center pt-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 bg-white/80 px-2 py-0.5 rounded">
                        Closed
                      </span>
                    </div>
                  </div>
                )}

                {/* Blocks - with overlap handling (hidden on closed days) */}
                {!isClosed && (() => {
                  const blockLayout = calculateBlockLayout(dayBlocks)
                  return dayBlocks.map(block => {
                    const layout = blockLayout.get(block.block_id) || { columnIndex: 0, totalColumns: 1, isSameStart: false }
                    return (
                      <BlockCard
                        key={block.block_id}
                        block={block}
                        color={colorMap[block.surgeon_id] || '#3B82F6'}
                        hourHeight={HOUR_HEIGHT}
                        startHour={0}
                        onClick={(e) => handleBlockClick(block, e)}
                        columnIndex={layout.columnIndex}
                        totalColumns={layout.totalColumns}
                        isSameStart={layout.isSameStart}
                      />
                    )
                  })
                })()}

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
