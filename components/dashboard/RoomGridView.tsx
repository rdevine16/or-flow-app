import Badge from '../ui/Badge'

interface Case {
  id: string
  case_number: string
  scheduled_date: string
  start_time: string | null
  or_rooms: { name: string }[] | { name: string } | null
  procedure_types: { name: string }[] | { name: string } | null
  case_statuses: { name: string }[] | { name: string } | null
}

interface Room {
  id: string
  name: string
}

interface RoomGridViewProps {
  rooms: Room[]
  cases: Case[]
}

const getValue = <T extends { name: string }>(data: T[] | T | null): string | null => {
  if (!data) return null
  if (Array.isArray(data)) return data[0]?.name || null
  return data.name
}

const getStatusVariant = (status: string | null): 'default' | 'success' | 'warning' | 'error' | 'info' => {
  switch (status) {
    case 'completed':
      return 'success'
    case 'in_progress':
      return 'warning'
    case 'delayed':
      return 'error'
    case 'cancelled':
      return 'error'
    case 'scheduled':
    default:
      return 'info'
  }
}

const getRoomStatusColor = (cases: Case[]): string => {
  const inProgress = cases.find(c => getValue(c.case_statuses) === 'in_progress')
  if (inProgress) return 'border-amber-400 bg-amber-50'

  const hasScheduled = cases.some(c => getValue(c.case_statuses) === 'scheduled')
  if (hasScheduled) return 'border-sky-400 bg-sky-50'

  const allCompleted = cases.length > 0 && cases.every(c => getValue(c.case_statuses) === 'completed')
  if (allCompleted) return 'border-emerald-400 bg-emerald-50'

  return 'border-slate-200 bg-white'
}

export default function RoomGridView({ rooms, cases }: RoomGridViewProps) {
  const casesByRoom = rooms.map(room => ({
    room,
    cases: cases.filter(c => getValue(c.or_rooms) === room.name)
  }))

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {casesByRoom.map(({ room, cases: roomCases }) => {
        const currentCase = roomCases.find(c => getValue(c.case_statuses) === 'in_progress')
        const upcomingCases = roomCases.filter(c => getValue(c.case_statuses) === 'scheduled')
        const completedCases = roomCases.filter(c => getValue(c.case_statuses) === 'completed')

        return (
          <div
            key={room.id}
            className={`rounded-xl border-2 p-5 transition-all duration-300 ${getRoomStatusColor(roomCases)}`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  currentCase ? 'bg-amber-400 text-white' : 'bg-slate-200 text-slate-600'
                }`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-slate-900">{room.name}</h3>
              </div>
              {currentCase && (
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                  <span className="text-xs font-medium text-amber-700">LIVE</span>
                </span>
              )}
            </div>

            {currentCase ? (
              <div className="mb-4 p-3 bg-white rounded-lg border border-amber-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-slate-900">{currentCase.case_number}</span>
                  <Badge variant="warning" size="sm">In Progress</Badge>
                </div>
                <p className="text-sm text-slate-600 line-clamp-1">{getValue(currentCase.procedure_types)}</p>
              </div>
            ) : (
              <div className="mb-4 p-3 bg-slate-100/50 rounded-lg border border-dashed border-slate-300">
                <p className="text-sm text-slate-500 text-center">No active case</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-2 bg-white/60 rounded-lg">
                <p className="text-2xl font-bold text-slate-900">{upcomingCases.length}</p>
                <p className="text-xs text-slate-500">Upcoming</p>
              </div>
              <div className="text-center p-2 bg-white/60 rounded-lg">
                <p className="text-2xl font-bold text-slate-900">{completedCases.length}</p>
                <p className="text-xs text-slate-500">Completed</p>
              </div>
            </div>

            {upcomingCases.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-200/50">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Up Next</p>
                <div className="space-y-2">
                  {upcomingCases.slice(0, 2).map((c) => (
                    <div key={c.id} className="flex items-center justify-between text-sm">
                      <span className="text-slate-700 truncate">{c.case_number}</span>
                      <Badge variant="info" size="sm">Scheduled</Badge>
                    </div>
                  ))}
                  {upcomingCases.length > 2 && (
                    <p className="text-xs text-slate-400">+{upcomingCases.length - 2} more</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}