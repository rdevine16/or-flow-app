// components/block-schedule/RoomDayCell.tsx
// Individual cell in the room schedule grid — droppable target for surgeons + staff

import { useDroppable } from '@dnd-kit/core'
import { Plus, Lock } from 'lucide-react'
import type { RoomDayCellData, RoomDayDropData } from '@/types/room-scheduling'
import { AssignedSurgeonBadge } from './AssignedSurgeonBadge'
import { AssignedStaffBadge } from './AssignedStaffBadge'

interface RoomDayCellProps {
  cellData: RoomDayCellData | null
  isToday: boolean
  isClosed: boolean
  roomId: string
  date: string
  roomName: string
  onRemoveSurgeon?: (assignmentId: string) => void
  onRemoveStaff?: (staffId: string) => void
  onRequestAssign?: (roomId: string, date: string) => void
}

export function RoomDayCell({
  cellData,
  isToday,
  isClosed,
  roomId,
  date,
  roomName,
  onRemoveSurgeon,
  onRemoveStaff,
  onRequestAssign,
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
    disabled: isClosed,
  })

  const hasSurgeons = cellData && cellData.surgeons.length > 0
  const hasStaff = cellData && cellData.staff.length > 0
  const isEmpty = !hasSurgeons && !hasStaff

  // Closed room — gray out, no drops allowed
  if (isClosed) {
    return (
      <div
        ref={setNodeRef}
        className="min-h-[80px] p-2 border-r border-b border-slate-200 bg-slate-100/80"
        aria-label={`${roomName} closed on ${date}`}
      >
        <div className="h-full flex items-center justify-center">
          <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
            <Lock className="h-3 w-3" />
            Closed
          </span>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      className={`
        group/cell min-h-[80px] p-2 border-r border-b border-slate-200 transition-colors relative
        ${isToday ? 'bg-blue-50/50' : 'bg-white'}
        ${isOver ? 'bg-blue-100/70 ring-2 ring-inset ring-blue-400' : ''}
        ${isEmpty && !isOver ? 'hover:bg-slate-50' : ''}
      `}
      aria-label={`${roomName} on ${date}${isEmpty ? ', empty' : ''}`}
    >
      {isEmpty ? (
        <div className="h-full flex items-center justify-center">
          {isOver ? (
            <span className="text-xs text-blue-500 font-medium">Drop here</span>
          ) : onRequestAssign ? (
            <button
              onClick={() => onRequestAssign(roomId, date)}
              className="opacity-0 group-hover/cell:opacity-100 focus:opacity-100 p-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-500 hover:bg-blue-100 transition-all"
              title={`Assign to ${roomName}`}
              aria-label={`Assign surgeon or staff to ${roomName} on ${date}`}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
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

          {/* Click-to-assign button (keyboard accessible fallback) */}
          {onRequestAssign && !isOver && (
            <button
              onClick={() => onRequestAssign(roomId, date)}
              className="opacity-0 group-hover/cell:opacity-100 focus:opacity-100 w-full flex items-center justify-center gap-1 py-0.5 text-[10px] text-slate-400 hover:text-blue-500 rounded transition-all"
              title="Add surgeon or staff"
              aria-label={`Add surgeon or staff to ${roomName} on ${date}`}
            >
              <Plus className="h-3 w-3" />
              Add
            </button>
          )}
        </div>
      )}
    </div>
  )
}
