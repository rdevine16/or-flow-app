// components/block-schedule/AssignedSurgeonBadge.tsx
// Surgeon chip displayed in a room-day cell with optional remove button

import { X } from 'lucide-react'
import type { RoomDateAssignment } from '@/types/room-scheduling'

interface AssignedSurgeonBadgeProps {
  assignment: RoomDateAssignment
  onRemove?: (assignmentId: string) => void
}

export function AssignedSurgeonBadge({ assignment, onRemove }: AssignedSurgeonBadgeProps) {
  return (
    <div className="group flex items-center gap-1 px-2 py-1 bg-blue-50 border border-blue-200 rounded text-xs">
      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
      <span className="font-medium text-blue-800 truncate flex-1">
        Dr. {assignment.surgeon?.last_name ?? 'Unknown'}
      </span>
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRemove(assignment.id)
          }}
          className="opacity-0 group-hover:opacity-100 p-0.5 -mr-1 text-blue-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
          title={`Remove Dr. ${assignment.surgeon?.last_name ?? 'Unknown'}`}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}
