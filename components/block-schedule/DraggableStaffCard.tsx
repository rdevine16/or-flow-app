// components/block-schedule/DraggableStaffCard.tsx
// Staff card for room schedule sidebar — shows name with role indicator
// Phase 6 will add dnd-kit useDraggable hook

import type { StaffMember } from '@/types/staff-assignment'

interface DraggableStaffCardProps {
  staff: StaffMember
}

export function DraggableStaffCard({ staff }: DraggableStaffCardProps) {
  const roleName = staff.user_roles?.name ?? 'Staff'
  const initials = `${staff.first_name[0]}${staff.last_name[0]}`

  return (
    <div
      className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50 cursor-grab active:cursor-grabbing transition-colors group"
      data-staff-id={staff.id}
      data-role-id={staff.role_id}
    >
      {/* Staff avatar */}
      <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
        <span className="text-[10px] font-semibold text-slate-600">
          {initials}
        </span>
      </div>

      {/* Name */}
      <span className="text-sm text-slate-700 truncate flex-1">
        {staff.first_name} {staff.last_name}
      </span>

      {/* Role badge (visible on hover) */}
      <span className="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        {roleName}
      </span>
    </div>
  )
}
