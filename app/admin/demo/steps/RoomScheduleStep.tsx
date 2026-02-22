// app/admin/demo/steps/RoomScheduleStep.tsx
// Step 3: Visual day/room grid per surgeon — click to toggle room assignments

'use client'

import { useCallback } from 'react'
import { LayoutGrid, AlertTriangle, ArrowLeftRight } from 'lucide-react'
import type {
  DemoSurgeon,
  DemoORRoom,
  SurgeonProfile,
  DayOfWeek,
} from '../types'
import { WEEKDAY_LABELS, isRoomScheduleStepValid } from '../types'

// ============================================================================
// PROPS
// ============================================================================

export interface RoomScheduleStepProps {
  surgeons: DemoSurgeon[]
  rooms: DemoORRoom[]
  profiles: Record<string, SurgeonProfile>
  onUpdateProfile: (surgeonId: string, updates: Partial<SurgeonProfile>) => void
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function RoomScheduleStep({
  surgeons,
  rooms,
  profiles,
  onUpdateProfile,
}: RoomScheduleStepProps) {
  const includedSurgeons = surgeons.filter((s) => !!profiles[s.id])
  const validation = isRoomScheduleStepValid(profiles)

  // Toggle a room for a surgeon on a specific day (max 2 rooms per day)
  const handleRoomToggle = useCallback(
    (surgeonId: string, day: DayOfWeek, roomId: string) => {
      const profile = profiles[surgeonId]
      if (!profile) return

      const currentRooms = profile.dayRoomAssignments[day] || []
      let newRooms: string[]

      if (currentRooms.includes(roomId)) {
        // Remove this room
        newRooms = currentRooms.filter((id) => id !== roomId)
      } else if (currentRooms.length >= 2) {
        // Already at max — replace the second room
        newRooms = [currentRooms[0], roomId]
      } else {
        // Add the room
        newRooms = [...currentRooms, roomId]
      }

      onUpdateProfile(surgeonId, {
        dayRoomAssignments: {
          ...profile.dayRoomAssignments,
          [day]: newRooms,
        },
      })
    },
    [profiles, onUpdateProfile],
  )

  // Quick action: assign same room(s) to all operating days
  const handleApplyToAllDays = useCallback(
    (surgeonId: string, sourceDay: DayOfWeek) => {
      const profile = profiles[surgeonId]
      if (!profile) return

      const sourceRooms = profile.dayRoomAssignments[sourceDay] || []
      if (sourceRooms.length === 0) return

      const newAssignments = { ...profile.dayRoomAssignments }
      for (const day of profile.operatingDays) {
        newAssignments[day] = [...sourceRooms]
      }
      onUpdateProfile(surgeonId, { dayRoomAssignments: newAssignments })
    },
    [profiles, onUpdateProfile],
  )

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100">
          <h2 className="text-[17px] font-semibold text-slate-900">Room Schedule</h2>
          <p className="text-[13px] text-slate-500 mt-1">
            Assign operating rooms per day for each surgeon. Max 2 rooms per day (enables flip room pattern).
          </p>
        </div>
        {!validation.valid && (
          <div className="px-6 py-3 bg-amber-50 border-b border-amber-200 flex items-center gap-2 text-xs text-amber-700">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{validation.errors[0]}</span>
          </div>
        )}
      </div>

      {/* Per-Surgeon Room Grids */}
      {includedSurgeons.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <LayoutGrid className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-700">No surgeons configured</p>
          <p className="text-xs text-slate-400 mt-1">
            Go back to Step 2 to add surgeons.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {includedSurgeons.map((surgeon) => {
            const profile = profiles[surgeon.id]
            if (!profile) return null

            return (
              <SurgeonRoomGrid
                key={surgeon.id}
                surgeon={surgeon}
                profile={profile}
                rooms={rooms}
                onRoomToggle={(day, roomId) => handleRoomToggle(surgeon.id, day, roomId)}
                onApplyToAllDays={(sourceDay) => handleApplyToAllDays(surgeon.id, sourceDay)}
              />
            )
          })}
        </div>
      )}

      {/* Combined Weekly Schedule Preview */}
      {includedSurgeons.length > 0 && rooms.length > 0 && (
        <CombinedSchedulePreview
          surgeons={includedSurgeons}
          profiles={profiles}
          rooms={rooms}
        />
      )}
    </div>
  )
}

// ============================================================================
// SURGEON ROOM GRID
// ============================================================================

interface SurgeonRoomGridProps {
  surgeon: DemoSurgeon
  profile: SurgeonProfile
  rooms: DemoORRoom[]
  onRoomToggle: (day: DayOfWeek, roomId: string) => void
  onApplyToAllDays: (sourceDay: DayOfWeek) => void
}

function SurgeonRoomGrid({
  surgeon,
  profile,
  rooms,
  onRoomToggle,
  onApplyToAllDays,
}: SurgeonRoomGridProps) {
  const operatingDays = profile.operatingDays

  if (operatingDays.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-sm font-semibold text-slate-900 mb-1">
          Dr. {surgeon.first_name} {surgeon.last_name}
        </h3>
        <p className="text-xs text-slate-400">No operating days configured — go back to Step 2.</p>
      </div>
    )
  }

  return (
    <div
      className="bg-white rounded-xl border border-slate-200 overflow-hidden"
      data-testid={`room-grid-${surgeon.id}`}
    >
      {/* Surgeon Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Dr. {surgeon.first_name} {surgeon.last_name}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5 capitalize">
            {profile.speedProfile} &middot; {operatingDays.length} operating days
          </p>
        </div>
        {/* Flip room indicator */}
        {operatingDays.some((d) => (profile.dayRoomAssignments[d]?.length || 0) >= 2) && (
          <div className="flex items-center gap-1.5 text-xs text-purple-600 bg-purple-50 rounded-lg px-2.5 py-1.5">
            <ArrowLeftRight className="w-3.5 h-3.5" />
            Flip room enabled
          </div>
        )}
      </div>

      {/* Room Grid: days (rows) x rooms (columns) */}
      <div className="p-5">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left text-[11px] font-medium text-slate-400 uppercase tracking-wider pb-2 pr-3 w-24">
                  Day
                </th>
                {rooms.map((room) => (
                  <th
                    key={room.id}
                    className="text-center text-[11px] font-medium text-slate-400 uppercase tracking-wider pb-2 px-1 min-w-[72px]"
                  >
                    {room.name}
                  </th>
                ))}
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {operatingDays.map((day) => {
                const dayRooms = profile.dayRoomAssignments[day] || []
                const isMissingRoom = dayRooms.length === 0
                const isFlipRoom = dayRooms.length >= 2

                return (
                  <tr key={day} className={isMissingRoom ? 'bg-red-50/50' : ''}>
                    <td className="py-1.5 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-700 w-8">
                          {WEEKDAY_LABELS[day - 1]}
                        </span>
                        {isMissingRoom && (
                          <AlertTriangle className="w-3 h-3 text-red-500" />
                        )}
                        {isFlipRoom && (
                          <ArrowLeftRight className="w-3 h-3 text-purple-500" />
                        )}
                      </div>
                    </td>
                    {rooms.map((room) => {
                      const isAssigned = dayRooms.includes(room.id)
                      const atMax = dayRooms.length >= 2 && !isAssigned

                      return (
                        <td key={room.id} className="py-1.5 px-1 text-center">
                          <button
                            type="button"
                            onClick={() => onRoomToggle(day, room.id)}
                            data-testid={`room-cell-${surgeon.id}-${day}-${room.id}`}
                            className={`w-full h-9 rounded-lg border text-xs font-medium transition-all ${
                              isAssigned
                                ? isFlipRoom
                                  ? 'bg-purple-100 border-purple-300 text-purple-700'
                                  : 'bg-blue-100 border-blue-300 text-blue-700'
                                : atMax
                                ? 'bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed'
                                : 'bg-white border-slate-200 text-slate-400 hover:border-blue-300 hover:text-blue-500'
                            }`}
                            title={
                              atMax
                                ? 'Max 2 rooms per day — remove one first'
                                : isAssigned
                                ? 'Click to remove'
                                : 'Click to assign'
                            }
                          >
                            {isAssigned ? (dayRooms.indexOf(room.id) === 0 ? 'P' : 'F') : '\u00B7'}
                          </button>
                        </td>
                      )
                    })}
                    <td className="py-1.5 pl-1">
                      {dayRooms.length > 0 && operatingDays.length > 1 && (
                        <button
                          type="button"
                          onClick={() => onApplyToAllDays(day)}
                          title={`Apply ${WEEKDAY_LABELS[day - 1]}'s rooms to all days`}
                          className="text-[10px] text-blue-500 hover:text-blue-700 whitespace-nowrap"
                        >
                          All
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-4 text-[10px] text-slate-400">
          <span className="flex items-center gap-1">
            <span className="w-5 h-5 rounded bg-blue-100 border border-blue-300 flex items-center justify-center text-[9px] font-bold text-blue-700">P</span>
            Primary
          </span>
          <span className="flex items-center gap-1">
            <span className="w-5 h-5 rounded bg-purple-100 border border-purple-300 flex items-center justify-center text-[9px] font-bold text-purple-700">F</span>
            Flip
          </span>
          <span className="flex items-center gap-1">
            <ArrowLeftRight className="w-3 h-3 text-purple-500" />
            Flip room day
          </span>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// COMBINED WEEKLY SCHEDULE PREVIEW
// ============================================================================

interface CombinedSchedulePreviewProps {
  surgeons: DemoSurgeon[]
  profiles: Record<string, SurgeonProfile>
  rooms: DemoORRoom[]
}

function CombinedSchedulePreview({
  surgeons,
  profiles,
  rooms,
}: CombinedSchedulePreviewProps) {
  // Build schedule: for each day x room, list surgeons assigned
  const allDays: DayOfWeek[] = [1, 2, 3, 4, 5]

  // Detect conflicts: more than one surgeon in the same room on the same day
  const schedule: Record<string, string[]> = {} // key: "day-roomId", value: surgeon names
  for (const surgeon of surgeons) {
    const profile = profiles[surgeon.id]
    if (!profile) continue
    for (const day of profile.operatingDays) {
      const dayRooms = profile.dayRoomAssignments[day] || []
      for (const roomId of dayRooms) {
        const key = `${day}-${roomId}`
        if (!schedule[key]) schedule[key] = []
        schedule[key].push(`${surgeon.last_name}`)
      }
    }
  }

  const hasConflicts = Object.values(schedule).some((names) => names.length > 1)

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h2 className="text-[17px] font-semibold text-slate-900">Weekly OR Schedule</h2>
          <p className="text-[13px] text-slate-500 mt-1">Combined view — spot room conflicts</p>
        </div>
        {hasConflicts && (
          <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 rounded-lg px-2.5 py-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            Room conflicts detected
          </div>
        )}
      </div>
      <div className="p-5 overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="text-left text-[11px] font-medium text-slate-400 uppercase tracking-wider pb-2 pr-3 w-24">
                Room
              </th>
              {allDays.map((day) => (
                <th
                  key={day}
                  className="text-center text-[11px] font-medium text-slate-400 uppercase tracking-wider pb-2 px-1 min-w-[100px]"
                >
                  {WEEKDAY_LABELS[day - 1]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rooms.map((room) => (
              <tr key={room.id}>
                <td className="py-1.5 pr-3 text-xs font-semibold text-slate-700">
                  {room.name}
                </td>
                {allDays.map((day) => {
                  const key = `${day}-${room.id}`
                  const names = schedule[key] || []
                  const isConflict = names.length > 1

                  return (
                    <td key={day} className="py-1.5 px-1 text-center">
                      <div
                        className={`rounded-lg border px-2 py-1.5 min-h-[32px] text-[11px] ${
                          isConflict
                            ? 'bg-amber-50 border-amber-300 text-amber-700 font-semibold'
                            : names.length > 0
                            ? 'bg-slate-50 border-slate-200 text-slate-600'
                            : 'border-transparent text-slate-300'
                        }`}
                      >
                        {names.length > 0 ? names.join(', ') : '\u2014'}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
