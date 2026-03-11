// components/block-schedule/AssignedStaffBadge.tsx
// Staff chip displayed in a room-day cell with role label and optional remove button

import { X } from 'lucide-react'
import type { RoomDateStaff } from '@/types/room-scheduling'

interface AssignedStaffBadgeProps {
  staff: RoomDateStaff
  onRemove?: (staffId: string) => void
}

export function AssignedStaffBadge({ staff, onRemove }: AssignedStaffBadgeProps) {
  const displayName = staff.user
    ? `${staff.user.first_name?.[0] ?? ''}. ${staff.user.last_name ?? 'Unknown'}`
    : 'Unknown'

  return (
    <div className="group flex items-center gap-1 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50 rounded transition-colors">
      <span className="truncate flex-1">{displayName}</span>
      {staff.role?.name && (
        <span className="text-[10px] text-slate-400 flex-shrink-0 bg-slate-100 px-1 rounded">
          {staff.role.name}
        </span>
      )}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRemove(staff.id)
          }}
          className="opacity-0 group-hover:opacity-100 p-0.5 -mr-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
          title={`Remove ${displayName}`}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}
