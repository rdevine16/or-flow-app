// components/block-schedule/BlockCard.tsx
'use client'

import { ExpandedBlock, formatTime12Hour, RECURRENCE_LABELS } from '@/types/block-scheduling'

interface BlockCardProps {
  block: ExpandedBlock
  color: string
  hourHeight: number
  startHour: number
  onClick: (e: React.MouseEvent) => void
  // For handling overlapping blocks
  columnIndex?: number
  totalColumns?: number
  isSameStart?: boolean // true = side by side, false = cascading
}

export function BlockCard({ 
  block, 
  color, 
  hourHeight, 
  startHour, 
  onClick,
  columnIndex = 0,
  totalColumns = 1,
  isSameStart = false,
}: BlockCardProps) {
  // Parse times
  const [startH, startM] = block.start_time.split(':').map(Number)
  const [endH, endM] = block.end_time.split(':').map(Number)

  // Calculate position
  const top = (startH - startHour + startM / 60) * hourHeight
  const height = (endH - startH + (endM - startM) / 60) * hourHeight

  // Layout depends on whether blocks have same start time
  let leftPercent: number
  let rightPercent: number
  let widthStyle: string | undefined
  
  if (isSameStart && totalColumns > 1) {
    // Same start time: side by side (equal width columns)
    const columnWidth = (100 - 4) / totalColumns // 4% for margins
    leftPercent = 2 + (columnIndex * columnWidth)
    widthStyle = `${columnWidth - 1}%`
    rightPercent = undefined as any // Use width instead
  } else if (columnIndex > 0) {
    // Different start times, overlapping: cascading/staggered
    const offsetPercent = columnIndex * 12  // Each block offset 12% more
    leftPercent = 2 + offsetPercent
    rightPercent = 2  // All blocks end at same right edge
  } else {
    // Single block or first block in cascade
    leftPercent = 2
    rightPercent = 2
  }

  // Determine if we have enough space for details
  const showTime = height >= 40
  const showRecurrence = height >= 70

  const style: React.CSSProperties = {
    top: `${top}px`,
    height: `${Math.max(height, 24)}px`,
    left: `${leftPercent}%`,
    backgroundColor: color,
    borderLeft: `4px solid ${adjustColor(color, -30)}`,
    zIndex: 10 + columnIndex,
  }
  
  if (widthStyle) {
    style.width = widthStyle
  } else {
    style.right = `${rightPercent}%`
  }

  return (
    <div
      className="block-card absolute rounded-lg overflow-hidden cursor-pointer 
                 transition-all hover:shadow-lg hover:brightness-95 hover:z-30"
      style={style}
      onClick={onClick}
    >
      <div className="p-2 h-full flex flex-col text-white overflow-hidden">
        <div className="font-semibold text-sm truncate leading-tight">
          Dr. {block.surgeon_last_name}
        </div>
        {showTime && (
          <div className="text-xs opacity-90 mt-0.5 truncate">
            {formatTimeShort(block.start_time)} - {formatTimeShort(block.end_time)}
          </div>
        )}
        {showRecurrence && (
          <div className="text-xs opacity-75 mt-auto truncate">
            {block.recurrence_type === 'weekly' 
              ? 'Every week' 
              : RECURRENCE_LABELS[block.recurrence_type as keyof typeof RECURRENCE_LABELS] || block.recurrence_type}
          </div>
        )}
      </div>
    </div>
  )
}

// Helper to darken color for border
function adjustColor(hex: string, amount: number): string {
  if (!hex || !hex.startsWith('#')) return '#4B5563'
  
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.max(0, Math.min(255, (num >> 16) + amount))
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amount))
  const b = Math.max(0, Math.min(255, (num & 0x0000FF) + amount))
  return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`
}

// Shorter time format like Google Calendar
function formatTimeShort(time: string): string {
  const [hours, minutes] = time.split(':').map(Number)
  const period = hours >= 12 ? 'pm' : 'am'
  const hour12 = hours % 12 || 12
  if (minutes === 0) {
    return `${hour12}${period}`
  }
  return `${hour12}:${minutes.toString().padStart(2, '0')}${period}`
}