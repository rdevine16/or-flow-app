// components/block-schedule/AssignedStaffBadge.tsx
// Staff badge: name + colored role badge, full role name in tooltip

import { X } from 'lucide-react'
import type { RoomDateStaff } from '@/types/room-scheduling'
import { getRoleStyle } from '@/lib/roleStyles'

interface AssignedStaffBadgeProps {
  staff: RoomDateStaff
  onRemove?: (staffId: string) => void
}

export function AssignedStaffBadge({ staff, onRemove }: AssignedStaffBadgeProps) {
  const displayName = staff.user
    ? `${staff.user.first_name?.[0] ?? ''}. ${staff.user.last_name ?? 'Unknown'}`
    : 'Unknown'
  const fullName = staff.user
    ? `${staff.user.first_name ?? ''} ${staff.user.last_name ?? ''}`.trim()
    : 'Unknown'
  const roleName = staff.role?.name ?? ''
  const style = getRoleStyle(roleName)

  const tooltip = roleName ? `${fullName} — ${roleName}` : fullName

  return (
    <div
      className="group flex items-center gap-1 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50 rounded transition-colors"
      title={tooltip}
    >
      {/* Name */}
      <span className="truncate flex-1">{displayName}</span>

      {/* Colored role badge */}
      <span className={`inline-flex items-center gap-1 px-1.5 py-0 text-[10px] font-medium rounded flex-shrink-0 ${style.bgClass} ${style.textClass}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${style.dotClass}`} />
        {style.abbrev}
      </span>

      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRemove(staff.id)
          }}
          className="opacity-0 group-hover:opacity-100 p-0.5 -mr-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
          title={`Remove ${fullName}`}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}
