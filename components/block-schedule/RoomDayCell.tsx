// components/block-schedule/RoomDayCell.tsx
// Individual cell in the room schedule grid — droppable target for surgeons + staff

import { useDroppable } from '@dnd-kit/core'
import type { RoomDayCellData, RoomDayDropData } from '@/types/room-scheduling'
import { AssignedSurgeonBadge } from './AssignedSurgeonBadge'
import { AssignedStaffBadge } from './AssignedStaffBadge'

interface RoomDayCellProps {
  cellData: RoomDayCellData | null
  isToday: boolean
  roomId: string
  date: string
  roomName: string
  onRemoveSurgeon?: (assignmentId: string) => void
  onRemoveStaff?: (staffId: string) => void
}

export function RoomDayCell({
  cellData,
  isToday,
  roomId,
  date,
  roomName,
  onRemoveSurgeon,
  onRemoveStaff,
}: RoomDayCellProps) {
  const dropData: RoomDayDropData = {
    type: 'room-day',
    roomId,
    date,
    roomName,
  }

  const { setNodeRef, isOver } = useDroppable({
    id: `cell-${roomId}-${date}`,
    data: dropData,
  })

  const hasSurgeons = cellData && cellData.surgeons.length > 0
  const hasStaff = cellData && cellData.staff.length > 0
  const isEmpty = !hasSurgeons && !hasStaff

  return (
    <div
      ref={setNodeRef}
      className={`
        min-h-[80px] p-2 border-r border-b border-slate-200 transition-colors
        ${isToday ? 'bg-blue-50/50' : 'bg-white'}
        ${isOver ? 'bg-blue-100/70 ring-2 ring-inset ring-blue-400' : ''}
        ${isEmpty && !isOver ? 'hover:bg-slate-50' : ''}
      `}
    >
      {isEmpty ? (
        <div className="h-full flex items-center justify-center">
          {isOver ? (
            <span className="text-xs text-blue-500 font-medium">Drop here</span>
          ) : (
            <span className="text-xs text-slate-300">&mdash;</span>
          )}
        </div>
      ) : (
        <div className="space-y-1">
          {/* Surgeons */}
          {cellData?.surgeons.map((a) => (
            <AssignedSurgeonBadge
              key={a.id}
              assignment={a}
              onRemove={onRemoveSurgeon}
            />
          ))}

          {/* Staff */}
          {cellData?.staff.map((s) => (
            <AssignedStaffBadge
              key={s.id}
              staff={s}
              onRemove={onRemoveStaff}
            />
          ))}

          {/* Hint when surgeons assigned but no staff */}
          {hasSurgeons && !hasStaff && !isOver && (
            <div className="text-[10px] text-slate-300 text-center pt-0.5 italic">
              + Add staff
            </div>
          )}

          {/* Drop hint when hovering over non-empty cell */}
          {isOver && (
            <div className="text-[10px] text-blue-500 text-center pt-0.5">
              + Add here
            </div>
          )}
        </div>
      )}
    </div>
  )
}
