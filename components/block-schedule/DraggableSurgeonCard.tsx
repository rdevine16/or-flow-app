// components/block-schedule/DraggableSurgeonCard.tsx
// Surgeon card for room schedule sidebar — shows name with optional block-time badge
// Phase 6 will add dnd-kit useDraggable hook

import type { Surgeon } from '@/hooks/useLookups'

interface DraggableSurgeonCardProps {
  surgeon: Surgeon
  hasBlockTime: boolean
}

export function DraggableSurgeonCard({
  surgeon,
  hasBlockTime,
}: DraggableSurgeonCardProps) {
  return (
    <div
      className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-blue-50 cursor-grab active:cursor-grabbing transition-colors group"
      data-surgeon-id={surgeon.id}
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

      {/* Block-time badge */}
      {hasBlockTime && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 bg-blue-100 rounded flex-shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          Block
        </span>
      )}
    </div>
  )
}
