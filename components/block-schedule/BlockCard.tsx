// components/block-schedule/BlockCard.tsx
'use client'

import { ExpandedBlock, formatTime12Hour, RECURRENCE_LABELS } from '@/types/block-scheduling'

interface BlockCardProps {
  block: ExpandedBlock
  color: string
  hourHeight: number
  startHour: number
  onClick: () => void
}

export function BlockCard({ block, color, hourHeight, startHour, onClick }: BlockCardProps) {
  // Parse times
  const [startH, startM] = block.start_time.split(':').map(Number)
  const [endH, endM] = block.end_time.split(':').map(Number)

  // Calculate position
  const top = (startH - startHour + startM / 60) * hourHeight
  const height = (endH - startH + (endM - startM) / 60) * hourHeight

  // Determine if we have enough space for details
  const showDetails = height >= 60

  return (
    <div
      className="block-card absolute left-1 right-1 rounded-lg overflow-hidden cursor-pointer 
                 transition-all hover:shadow-lg hover:scale-[1.02] hover:z-10"
      style={{
        top: `${top}px`,
        height: `${height}px`,
        backgroundColor: `${color}20`,
        borderLeft: `4px solid ${color}`,
      }}
      onClick={onClick}
    >
      <div className="p-2 h-full flex flex-col">
        <div className="font-medium text-sm truncate" style={{ color }}>
          Dr. {block.surgeon_last_name}
        </div>
        {showDetails && (
          <>
            <div className="text-xs text-gray-600 mt-0.5">
              {formatTime12Hour(block.start_time)} - {formatTime12Hour(block.end_time)}
            </div>
            <div className="text-xs text-gray-400 mt-auto truncate">
              {block.recurrence_type === 'weekly' 
                ? 'Every week' 
                : RECURRENCE_LABELS[block.recurrence_type]}
            </div>
          </>
        )}
      </div>
    </div>
  )
}