// components/block-schedule/RoomScheduleDragOverlay.tsx
// Floating drag preview shown while dragging a surgeon or staff card

import type { Active } from '@dnd-kit/core'
import type { SurgeonDragData, StaffDragData } from '@/types/room-scheduling'

interface RoomScheduleDragOverlayProps {
  active: Active | null
}

export function RoomScheduleDragOverlay({ active }: RoomScheduleDragOverlayProps) {
  if (!active) return null

  const data = active.data.current as SurgeonDragData | StaffDragData | undefined
  if (!data) return null

  if (data.type === 'surgeon') {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-white border-2 border-blue-400 rounded-lg shadow-lg">
        <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
          <span className="text-[10px] font-semibold text-blue-700">
            {data.surgeon.first_name[0]}{data.surgeon.last_name[0]}
          </span>
        </div>
        <span className="text-sm font-medium text-blue-800">
          Dr. {data.surgeon.last_name}
        </span>
      </div>
    )
  }

  if (data.type === 'staff') {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-white border-2 border-slate-400 rounded-lg shadow-lg">
        <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
          <span className="text-[10px] font-semibold text-slate-600">
            {data.user.first_name[0]}{data.user.last_name[0]}
          </span>
        </div>
        <span className="text-sm font-medium text-slate-700">
          {data.user.first_name} {data.user.last_name}
        </span>
        <span className="text-[10px] text-slate-400">{data.roleName}</span>
      </div>
    )
  }

  return null
}
