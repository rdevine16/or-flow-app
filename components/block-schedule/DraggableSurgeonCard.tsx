// components/block-schedule/DraggableSurgeonCard.tsx
// Surgeon card for room schedule sidebar — draggable via dnd-kit

import { useDraggable } from '@dnd-kit/core'
import type { Surgeon } from '@/hooks/useLookups'
import type { SurgeonDragData } from '@/types/room-scheduling'

const DAY_LABELS_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

interface DraggableSurgeonCardProps {
  surgeon: Surgeon
  /** Day-of-week indices (0=Sun..6=Sat) where this surgeon has block time this week */
  blockDays: number[]
}

export function DraggableSurgeonCard({
  surgeon,
  blockDays,
}: DraggableSurgeonCardProps) {
  const dragData: SurgeonDragData = {
    type: 'surgeon',
    surgeonId: surgeon.id,
    surgeon: {
      id: surgeon.id,
      first_name: surgeon.first_name,
      last_name: surgeon.last_name,
    },
  }

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `surgeon-${surgeon.id}`,
    data: dragData,
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-blue-50 cursor-grab active:cursor-grabbing transition-colors group ${
        isDragging ? 'opacity-40' : ''
      }`}
    >
      {/* Surgeon icon */}
      <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
        <span className="text-[10px] font-semibold text-blue-700">
          {surgeon.first_name[0]}{surgeon.last_name[0]}
        </span>
      </div>

      {/* Name */}
      <span className="text-sm text-slate-700 truncate flex-1">
        Dr. {surgeon.last_name}
      </span>

      {/* Block-time day badges */}
      {blockDays.length > 0 && (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 bg-blue-50 rounded flex-shrink-0">
          {blockDays.map(d => (
            <span key={d} className="w-4 text-center">{DAY_LABELS_SHORT[d]}</span>
          ))}
        </span>
      )}
    </div>
  )
}
