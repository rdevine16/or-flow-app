// components/block-schedule/RoomDayCell.tsx
// Individual cell in the room schedule grid — shows surgeons + staff for a room-date

import type { RoomDayCellData } from '@/types/room-scheduling'

interface RoomDayCellProps {
  cellData: RoomDayCellData | null
  isToday: boolean
}

export function RoomDayCell({ cellData, isToday }: RoomDayCellProps) {
  const hasSurgeons = cellData && cellData.surgeons.length > 0
  const hasStaff = cellData && cellData.staff.length > 0
  const isEmpty = !hasSurgeons && !hasStaff

  return (
    <div
      className={`
        min-h-[80px] p-2 border-r border-b border-slate-200 transition-colors
        ${isToday ? 'bg-blue-50/50' : 'bg-white'}
        ${isEmpty ? 'hover:bg-slate-50' : ''}
      `}
    >
      {isEmpty ? (
        <div className="h-full flex items-center justify-center">
          <span className="text-xs text-slate-300">—</span>
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
        </div>
      )}
    </div>
  )
}
