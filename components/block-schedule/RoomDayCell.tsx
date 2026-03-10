// components/block-schedule/RoomDayCell.tsx
// Individual cell in the room schedule grid — droppable target for surgeons + staff

import { useDroppable } from '@dnd-kit/core'
import type { RoomDayCellData, RoomDayDropData } from '@/types/room-scheduling'

interface RoomDayCellProps {
  cellData: RoomDayCellData | null
  isToday: boolean
  roomId: string
  date: string
  roomName: string
}

export function RoomDayCell({ cellData, isToday, roomId, date, roomName }: RoomDayCellProps) {
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
            <div
              key={a.id}
              className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 border border-blue-200 rounded text-xs"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
              <span className="font-medium text-blue-800 truncate">
                Dr. {a.surgeon?.last_name ?? 'Unknown'}
              </span>
            </div>
          ))}

          {/* Staff */}
          {cellData?.staff.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-1.5 px-2 py-0.5 text-xs text-slate-600"
            >
              <span className="truncate">
                {s.user?.first_name?.[0]}. {s.user?.last_name ?? 'Unknown'}
              </span>
              {s.role?.name && (
                <span className="text-[10px] text-slate-400 flex-shrink-0">
                  {s.role.name}
                </span>
              )}
            </div>
          ))}

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
