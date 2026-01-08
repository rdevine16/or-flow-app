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

interface CaseListViewProps {
  cases: Case[]
}

const getStatusVariant = (status: string | undefined): 'default' | 'success' | 'warning' | 'error' | 'info' => {
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

const formatStatus = (status: string | undefined): string => {
  if (!status) return 'Unknown'
  return status.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

const formatTime = (time: string | null): string => {
  if (!time) return '-'
  const parts = time.split(':')
  const hour = parseInt(parts[0])
  const minutes = parts[1]
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return displayHour + ':' + minutes + ' ' + ampm
}

const getValue = (data: { name: string }[] | { name: string } | null): string | null => {
  if (!data) return null
  if (Array.isArray(data)) return data[0]?.name || null
  return data.name
}

export default function CaseListView({ cases }: CaseListViewProps) {
  if (cases.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-slate-900 mb-1">No cases scheduled</h3>
        <p className="text-slate-500">There are no cases scheduled for today.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-slate-50 border-b border-slate-200">
        <div className="col-span-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">Time</div>
        <div className="col-span-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Case #</div>
        <div className="col-span-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Room</div>
        <div className="col-span-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Procedure</div>
        <div className="col-span-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</div>
        <div className="col-span-2 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</div>
      </div>

      <div className="divide-y divide-slate-100">
        {cases.map((caseItem) => {
          const roomName = getValue(caseItem.or_rooms)
          const procedureName = getValue(caseItem.procedure_types)
          const statusName = getValue(caseItem.case_statuses)
          const caseUrl = '/cases/' + caseItem.id

          return (
            <div key={caseItem.id} className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-slate-50 transition-colors">
              <div className="col-span-1">
                <span className="text-sm font-semibold text-slate-900">{formatTime(caseItem.start_time)}</span>
              </div>
              <div className="col-span-2">
                <span className="font-semibold text-slate-900">{caseItem.case_number}</span>
              </div>
              <div className="col-span-2">
                <span className="inline-flex items-center gap-1.5 text-slate-600">
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  {roomName || 'Unassigned'}
                </span>
              </div>
              <div className="col-span-4">
                <span className="text-slate-700">{procedureName || 'Not specified'}</span>
              </div>
              <div className="col-span-1">
                <Badge variant={getStatusVariant(statusName || undefined)}>
                  {formatStatus(statusName || undefined)}
                </Badge>
              </div>
              <div className="col-span-2 text-right">
                <a href={caseUrl} className="text-sm font-medium text-teal-600 hover:text-teal-700 transition-colors">
                  View details
                </a>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
