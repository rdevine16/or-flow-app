'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'
import DashboardLayout from '../../components/layouts/DashboardLayout'
import Badge from '../../components/ui/Badge'
import DateFilter from '../../components/ui/DateFilter'
import { getLocalDateString } from '../../lib/date-utils'

interface Case {
  id: string
  case_number: string
  scheduled_date: string
  start_time: string | null
  or_rooms: { name: string }[] | { name: string } | null
  procedure_types: { name: string }[] | { name: string } | null
  case_statuses: { name: string }[] | { name: string } | null
  surgeon: { first_name: string; last_name: string }[] | { first_name: string; last_name: string } | null
}

type StatusFilter = 'active' | 'all' | 'completed' | 'cancelled'

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'all', label: 'All' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

// Which statuses count as "active"
const ACTIVE_STATUSES = ['scheduled', 'in_progress', 'delayed']

const getValue = (data: { name: string }[] | { name: string } | null): string | null => {
  if (!data) return null
  if (Array.isArray(data)) return data[0]?.name || null
  return data.name
}

const getSurgeonName = (data: { first_name: string; last_name: string }[] | { first_name: string; last_name: string } | null): string | null => {
  if (!data) return null
  if (Array.isArray(data)) {
    const surgeon = data[0]
    return surgeon ? `Dr. ${surgeon.first_name} ${surgeon.last_name}` : null
  }
  return `Dr. ${data.first_name} ${data.last_name}`
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

const formatDate = (dateString: string): string => {
  const [year, month, day] = dateString.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const getStatusVariant = (status: string | null): 'default' | 'success' | 'warning' | 'error' | 'info' => {
  switch (status) {
    case 'completed': return 'success'
    case 'in_progress': return 'warning'
    case 'delayed': return 'error'
    case 'cancelled': return 'error'
    case 'scheduled': return 'info'
    default: return 'default'
  }
}

const formatStatus = (status: string | null): string => {
  if (!status) return 'Unknown'
  return status.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function CasesPage() {
  const router = useRouter()
  const supabase = createClient()
  const [cases, setCases] = useState<Case[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFilter, setDateFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // Store current date range for re-filtering
  const [currentDateRange, setCurrentDateRange] = useState<{ start?: string; end?: string }>({})

  const fetchCases = async (startDate?: string, endDate?: string) => {
    setLoading(true)

    let query = supabase
      .from('cases')
      .select(`
        id,
        case_number,
        scheduled_date,
        start_time,
        or_rooms (name),
        procedure_types (name),
        case_statuses (name),
        surgeon:users!cases_surgeon_id_fkey (first_name, last_name)
      `)
      .eq('facility_id', 'a1111111-1111-1111-1111-111111111111')
      .order('scheduled_date', { ascending: false })

    if (startDate && endDate) {
      query = query.gte('scheduled_date', startDate).lte('scheduled_date', endDate)
    }

    const { data } = await query
    setCases((data as unknown as Case[]) || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchCases()
  }, [])

  const handleFilterChange = (filter: string, startDate?: string, endDate?: string) => {
    setDateFilter(filter)
    setCurrentDateRange({ start: startDate, end: endDate })
    fetchCases(startDate, endDate)
  }

  const handleDelete = async (caseId: string) => {
    await supabase.from('cases').delete().eq('id', caseId)
    setCases(cases.filter(c => c.id !== caseId))
    setDeleteConfirm(null)
  }

  // Filter cases by status (client-side filtering)
  const filteredCases = cases.filter(c => {
    const statusName = getValue(c.case_statuses)
    
    switch (statusFilter) {
      case 'active':
        return statusName ? ACTIVE_STATUSES.includes(statusName) : true
      case 'completed':
        return statusName === 'completed'
      case 'cancelled':
        return statusName === 'cancelled'
      case 'all':
      default:
        return true
    }
  })

  // Count cases by status for filter badges
  const statusCounts = {
    active: cases.filter(c => {
      const status = getValue(c.case_statuses)
      return status ? ACTIVE_STATUSES.includes(status) : true
    }).length,
    all: cases.length,
    completed: cases.filter(c => getValue(c.case_statuses) === 'completed').length,
    cancelled: cases.filter(c => getValue(c.case_statuses) === 'cancelled').length,
  }

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">All Cases</h1>
          <p className="text-sm text-slate-500">
            {filteredCases.length} {filteredCases.length === 1 ? 'case' : 'cases'} 
            {statusFilter !== 'all' && ` (${statusFilter})`}
            {cases.length !== filteredCases.length && ` of ${cases.length} total`}
          </p>
        </div>
        <button
          onClick={() => router.push('/cases/new')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Case
        </button>
      </div>

      {/* Filters */}
      <div className="mb-6 space-y-4">
        {/* Date Filter */}
        <DateFilter selectedFilter={dateFilter} onFilterChange={handleFilterChange} />
        
        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-600 mr-2">Status:</span>
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setStatusFilter(value)}
                className={`
                  inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors
                  ${statusFilter === value
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }
                `}
              >
                {label}
                <span className={`
                  text-xs px-1.5 py-0.5 rounded-full
                  ${statusFilter === value
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-100 text-slate-500'
                  }
                `}>
                  {statusCounts[value]}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Cases Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <svg className="animate-spin h-6 w-6 text-blue-600" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        ) : filteredCases.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-slate-900 mb-1">
              {cases.length === 0 ? 'No cases found' : `No ${statusFilter} cases`}
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              {cases.length === 0 
                ? 'Try adjusting your date filter or create a new case.'
                : `Try selecting a different status filter.`
              }
            </p>
            {cases.length === 0 ? (
              <button
                onClick={() => router.push('/cases/new')}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Create your first case →
              </button>
            ) : (
              <button
                onClick={() => setStatusFilter('all')}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                View all cases →
              </button>
            )}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Time</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Case #</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Room</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Procedure</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Surgeon</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCases.map((c) => {
                const roomName = getValue(c.or_rooms)
                const procedureName = getValue(c.procedure_types)
                const statusName = getValue(c.case_statuses)
                const surgeonName = getSurgeonName(c.surgeon)

                return (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {formatDate(c.scheduled_date)}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">
                      {formatTime(c.start_time)}
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={`/cases/${c.id}`}
                        className="text-sm font-semibold text-slate-900 hover:text-blue-600 transition-colors"
                      >
                        {c.case_number}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {roomName || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {procedureName || 'Not specified'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {surgeonName || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={getStatusVariant(statusName)} size="sm">
                        {formatStatus(statusName)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => router.push(`/cases/${c.id}/edit`)}
                          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        {deleteConfirm === c.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDelete(c.id)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Confirm Delete"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"
                              title="Cancel"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(c.id)}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </DashboardLayout>
  )
}
