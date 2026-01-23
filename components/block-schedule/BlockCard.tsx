// components/block-schedule/BlockCard.tsx
'use client'

import { ExpandedBlock, formatTime12Hour, RECURRENCE_LABELS } from '@/types/block-scheduling'

interface BlockCardProps {
  block: ExpandedBlock
  color: string
  hourHeight: number
  startHour: number
  onClick: (e: React.MouseEvent) => void
  // For handling overlapping blocks - Google Calendar cascading style
  columnIndex?: number
  totalColumns?: number
}

export function BlockCard({ 
  block, 
  color, 
  hourHeight, 
  startHour, 
  onClick,
  columnIndex = 0,
  totalColumns = 1,
}: BlockCardProps) {
  // Parse times
  const [startH, startM] = block.start_time.split(':').map(Number)
  const [endH, endM] = block.end_time.split(':').map(Number)

  // Calculate position
  const top = (startH - startHour + startM / 60) * hourHeight
  const height = (endH - startH + (endM - startM) / 60) * hourHeight

  // Google Calendar cascading style:
  // - First block: starts at 2%, width 96%
  // - Each subsequent overlapping block: offset 8% more from left, same right edge
  // This creates a cascading/staggered effect
  const offsetPercent = columnIndex * 8  // Each block offset 8% more
  const leftPercent = 2 + offsetPercent
  const rightPercent = 2  // All blocks end at same right edge
  
  // Minimum width to ensure readability
  const minWidthPercent = 25

  // Determine if we have enough space for details
  const showTime = height >= 40
  const showRecurrence = height >= 70

  return (
    <div
      className="block-card absolute rounded-lg overflow-hidden cursor-pointer 
                 transition-all hover:shadow-lg hover:brightness-95 hover:z-30"
      style={{
        top: `${top}px`,
        height: `${Math.max(height, 24)}px`,
        left: `${leftPercent}%`,
        right: `${rightPercent}%`,
        backgroundColor: color,
        borderLeft: `4px solid ${adjustColor(color, -30)}`,
        zIndex: 10 + columnIndex, // Later blocks appear on top
      }}
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
  // Handle invalid hex
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