import Badge from '../ui/Badge'
import Link from 'next/link'

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
    case 'completed': return 'success'
    case 'in_progress': return 'warning'
    case 'delayed': return 'error'
    case 'cancelled': return 'error'
    case 'scheduled': return 'info'
    default: return 'default'
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
      <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
        <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <p className="text-sm font-medium text-slate-900">No cases scheduled</p>
        <p className="text-sm text-slate-500 mt-1">There are no cases scheduled for today.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Time</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Case #</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Room</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Procedure</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {cases.map((caseItem) => {
            const roomName = getValue(caseItem.or_rooms)
            const procedureName = getValue(caseItem.procedure_types)
            const statusName = getValue(caseItem.case_statuses)

            return (
              <tr key={caseItem.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3">
                  <span className="text-sm font-medium text-slate-900">{formatTime(caseItem.start_time)}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm font-medium text-slate-900">{caseItem.case_number}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-slate-600">{roomName || '-'}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-slate-600">{procedureName || '-'}</span>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={getStatusVariant(statusName || undefined)} size="sm">
                    {formatStatus(statusName || undefined)}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={'/cases/' + caseItem.id}
                    className="text-sm font-medium text-blue-600 hover:text-blue-700"
                  >
                    View
                  </Link>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}