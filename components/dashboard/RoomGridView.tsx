'use client'

import { extractName } from '@/lib/formatters'
import { EmptyState } from '@/components/ui/EmptyState'

interface Case {
  id: string
  case_number: string
  scheduled_date: string
  start_time: string | null
  or_rooms: { name: string }[] | { name: string } | null
  procedure_types: { name: string }[] | { name: string } | null
  case_statuses: { name: string }[] | { name: string } | null
  surgeon?: { first_name: string; last_name: string }[] | { first_name: string; last_name: string } | null
}

interface Room {
  id: string
  name: string
}

interface RoomGridViewProps {
  rooms: Room[]
  cases: Case[]
}

const getSurgeonName = (data: { first_name: string; last_name: string }[] | { first_name: string; last_name: string } | null | undefined): string | null => {
  if (!data) return null
  if (Array.isArray(data)) {
    const surgeon = data[0]
    return surgeon ? `Dr. ${surgeon.last_name}` : null
  }
  return `Dr. ${data.last_name}`
}

const formatTime = (time: string | null): string => {
  if (!time) return ''
  const [hours, minutes] = time.split(':')
  const hour = parseInt(hours)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${minutes} ${ampm}`
}

const getStatusColor = (status: string | null): string => {
  switch (status) {
    case 'in_progress':
      return 'bg-amber-500'
    case 'completed':
      return 'bg-emerald-500'
    case 'delayed':
      return 'bg-red-500'
    case 'cancelled':
      return 'bg-slate-400'
    case 'scheduled':
      return 'bg-blue-500'
    default:
      return 'bg-slate-300'
  }
}

const getStatusBgColor = (status: string | null): string => {
  switch (status) {
    case 'in_progress':
      return 'bg-amber-50 border-amber-200'
    case 'completed':
      return 'bg-emerald-50 border-emerald-200'
    case 'delayed':
      return 'bg-red-50 border-red-200'
    default:
      return 'bg-white border-slate-200'
  }
}

export default function RoomGridView({ rooms, cases }: RoomGridViewProps) {
  const getCasesForRoom = (roomName: string) => {
    return cases
      .filter(c => extractName(c.or_rooms) === roomName)
      .sort((a, b) => {
        if (!a.start_time) return 1
        if (!b.start_time) return -1
        return a.start_time.localeCompare(b.start_time)
      })
  }

  const getActiveCase = (roomCases: Case[]) => {
    return roomCases.find(c => extractName(c.case_statuses) === 'in_progress')
  }

  const getUpNextCases = (roomCases: Case[]) => {
    return roomCases.filter(c => extractName(c.case_statuses) === 'scheduled').slice(0, 3)
  }

  const getCompletedCount = (roomCases: Case[]) => {
    return roomCases.filter(c => extractName(c.case_statuses) === 'completed').length
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {rooms.map((room) => {
        const roomCases = getCasesForRoom(room.name)
        const activeCase = getActiveCase(roomCases)
        const upNextCases = getUpNextCases(roomCases)
        const completedCount = getCompletedCount(roomCases)
        const totalCases = roomCases.length

        return (
          <div
            key={room.id}
            className="bg-white rounded-lg border border-slate-200 overflow-hidden"
          >
            {/* Room Header */}
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">{room.name}</h3>
              <span className="text-xs text-slate-500">
                {completedCount}/{totalCases} done
              </span>
            </div>

            {/* Room Content */}
            <div className="p-4 space-y-4">
              {/* Active Case */}
              {activeCase ? (
                <div className={`rounded-lg border p-3 ${getStatusBgColor(extractName(activeCase.case_statuses))}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-amber-700 uppercase tracking-wider">Active</span>
                    <div className={`w-2.5 h-2.5 rounded-full ${getStatusColor(extractName(activeCase.case_statuses))}`} title="In Progress" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <a
                        href={`/cases/${activeCase.id}`}
                        className="font-semibold text-slate-900 hover:text-blue-600 transition-colors"
                      >
                        {activeCase.case_number}
                      </a>
                      <span className="text-xs text-slate-500">{formatTime(activeCase.start_time)}</span>
                    </div>
                    <p className="text-sm text-slate-700 truncate">
                      {extractName(activeCase.procedure_types) || 'No procedure'}
                    </p>
                    <p className="text-sm text-slate-500">
                      {getSurgeonName(activeCase.surgeon) || 'No surgeon'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-200 p-3 text-center">
                  <p className="text-sm text-slate-400">No active case</p>
                </div>
              )}

              {/* Up Next */}
              {upNextCases.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Up Next</p>
                  <div className="space-y-2">
                    {upNextCases.map((c) => {
                      const status = extractName(c.case_statuses)
                      return (
                        <div
                          key={c.id}
                          className="flex items-start gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors group"
                        >
                          <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${getStatusColor(status)}`} title={status || 'Unknown'} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <a
                                href={`/cases/${c.id}`}
                                className="text-sm font-medium text-slate-900 hover:text-blue-600 transition-colors truncate"
                              >
                                {c.case_number}
                              </a>
                              <span className="text-xs text-slate-400 flex-shrink-0">
                                {formatTime(c.start_time)}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 truncate">
                              {extractName(c.procedure_types) || 'No procedure'}
                            </p>
                            <p className="text-xs text-slate-400 truncate">
                              {getSurgeonName(c.surgeon) || 'No surgeon'}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Empty State */}
              {!activeCase && upNextCases.length === 0 && (
                <EmptyState
                  icon={
                    <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 12H4" />
                    </svg>
                  }
                  title="No cases scheduled"
                  className="py-4"
                />
              )}

              {/* Completed Summary */}
              {completedCount > 0 && (
                <div className="pt-2 border-t border-slate-100">
                  <p className="text-xs text-slate-400">
                    {completedCount} case{completedCount !== 1 ? 's' : ''} completed today
                  </p>
                </div>
              )}
            </div>
          </div>
        )
      })}

      {/* Empty Rooms State */}
      {rooms.length === 0 && (
        <EmptyState
          icon={
            <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          }
          title="No OR rooms configured"
          action={
            <a href="/settings/rooms" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              Add rooms in Settings →
            </a>
          }
          className="col-span-full"
        />
      )}
    </div>
  )
}