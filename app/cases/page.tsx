'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '../../lib/supabase'
import DashboardLayout from '../../components/layouts/DashboardLayout'
import SurgeonAvatar from '../../components/ui/SurgeonAvatar'
import FloatingActionButton from '../../components/ui/FloatingActionButton'
import CallNextPatientModal from '../../components/CallNextPatientModal'
import { getLocalDateString } from '../../lib/date-utils'
import { getImpersonationState } from '../../lib/impersonation'

interface Case {
  id: string
  case_number: string
  scheduled_date: string
  start_time: string | null
  operative_side: string | null  // ADD THIS
  or_rooms: { name: string }[] | { name: string } | null
  procedure_types: { name: string }[] | { name: string } | null
  case_statuses: { name: string }[] | { name: string } | null
  surgeon: { first_name: string; last_name: string }[] | { first_name: string; last_name: string } | null
}

type StatusFilter = 'active' | 'all' | 'completed' | 'cancelled'
type DateFilter = 'today' | 'week' | 'month' | 'all'

const ACTIVE_STATUSES = ['scheduled', 'in_progress', 'delayed']

const getValue = (data: { name: string }[] | { name: string } | null): string | null => {
  if (!data) return null
  if (Array.isArray(data)) return data[0]?.name || null
  return data.name
}

const getSurgeon = (data: { first_name: string; last_name: string }[] | { first_name: string; last_name: string } | null): { name: string; fullName: string } => {
  if (!data) return { name: 'Unassigned', fullName: 'Unassigned' }
  const surgeon = Array.isArray(data) ? data[0] : data
  if (!surgeon) return { name: 'Unassigned', fullName: 'Unassigned' }
  return { 
    name: `Dr. ${surgeon.last_name}`,
    fullName: `${surgeon.first_name} ${surgeon.last_name}`
  }
}

const formatTime = (time: string | null): string => {
  if (!time) return '--:--'
  const parts = time.split(':')
  const hour = parseInt(parts[0])
  const minutes = parts[1]
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${minutes} ${ampm}`
}

const formatDate = (dateString: string): string => {
  const [year, month, day] = dateString.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const caseDate = new Date(year, month - 1, day)
  
  // Check if it's today
  if (caseDate.getTime() === today.getTime()) {
    return 'Today'
  }
  
  // Check if it's yesterday
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (caseDate.getTime() === yesterday.getTime()) {
    return 'Yesterday'
  }
  
  // Check if it's tomorrow
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (caseDate.getTime() === tomorrow.getTime()) {
    return 'Tomorrow'
  }
  
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

const getStatusConfig = (status: string | null) => {
  switch (status) {
    case 'in_progress':
      return {
        label: 'In Progress',
        bgColor: 'bg-emerald-50',
        textColor: 'text-emerald-700',
        borderColor: 'border-emerald-200',
        dotColor: 'bg-emerald-500',
        lineColor: 'bg-emerald-500'
      }
    case 'completed':
      return {
        label: 'Completed',
        bgColor: 'bg-slate-50',
        textColor: 'text-slate-600',
        borderColor: 'border-slate-200',
        dotColor: 'bg-slate-400',
        lineColor: 'bg-slate-400'
      }
    case 'delayed':
      return {
        label: 'Delayed',
        bgColor: 'bg-amber-50',
        textColor: 'text-amber-700',
        borderColor: 'border-amber-200',
        dotColor: 'bg-amber-500',
        lineColor: 'bg-amber-500'
      }
    case 'cancelled':
      return {
        label: 'Cancelled',
        bgColor: 'bg-red-50',
        textColor: 'text-red-700',
        borderColor: 'border-red-200',
        dotColor: 'bg-red-500',
        lineColor: 'bg-red-500'
      }
    case 'scheduled':
    default:
      return {
        label: 'Scheduled',
        bgColor: 'bg-blue-50',
        textColor: 'text-blue-700',
        borderColor: 'border-blue-200',
        dotColor: 'bg-blue-500',
        lineColor: 'bg-blue-500'
      }
  }
}

function getDateRange(filter: DateFilter): { start?: string; end?: string } {
  const today = getLocalDateString()
  const todayDate = new Date()
  
  switch (filter) {
    case 'today':
      return { start: today, end: today }
    case 'week': {
      const weekStart = new Date(todayDate)
      weekStart.setDate(todayDate.getDate() - todayDate.getDay())
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekStart.getDate() + 6)
      return {
        start: weekStart.toISOString().split('T')[0],
        end: weekEnd.toISOString().split('T')[0]
      }
    }
    case 'month': {
      const monthStart = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1)
      const monthEnd = new Date(todayDate.getFullYear(), todayDate.getMonth() + 1, 0)
      return {
        start: monthStart.toISOString().split('T')[0],
        end: monthEnd.toISOString().split('T')[0]
      }
    }
    case 'all':
    default:
      return {}
  }
}

export default function CasesPage() {
  const router = useRouter()
  const supabase = createClient()
  const [cases, setCases] = useState<Case[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFilter, setDateFilter] = useState<DateFilter>('week')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [effectiveFacilityId, setEffectiveFacilityId] = useState<string | null>(null)
  const [noFacilitySelected, setNoFacilitySelected] = useState(false)
  
  // User info for FAB/Modal
  const [userId, setUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  
  // Call Next Patient modal
  const [showCallNextPatient, setShowCallNextPatient] = useState(false)

  // Get the effective facility ID (handles impersonation for global admins)
  useEffect(() => {
    async function fetchUserFacility() {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        setLoading(false)
        return
      }

      // Store user info for modal
      setUserId(user.id)
      setUserEmail(user.email || null)

      const { data: userData } = await supabase
        .from('users')
        .select('facility_id, access_level')
        .eq('id', user.id)
        .single()

      // Check if global admin
      if (userData?.access_level === 'global_admin') {
        // Check for impersonation
        const impersonation = getImpersonationState()
        if (impersonation?.facilityId) {
          setEffectiveFacilityId(impersonation.facilityId)
        } else {
          // Global admin not viewing a facility
          setNoFacilitySelected(true)
          setLoading(false)
        }
        return
      }

      // Regular user - use their facility_id
      if (userData?.facility_id) {
        setEffectiveFacilityId(userData.facility_id)
      } else {
        setLoading(false)
      }
    }

    fetchUserFacility()
  }, [supabase])

  const fetchCases = async (dateRange: { start?: string; end?: string }) => {
    if (!effectiveFacilityId) return
    
    setLoading(true)

let query = supabase
  .from('cases')
  .select(`
    id,
    case_number,
    scheduled_date,
    start_time,
    operative_side,
    or_rooms (name),
    procedure_types (name),
    case_statuses (name),
    surgeon:users!cases_surgeon_id_fkey (first_name, last_name)
  `)
      .eq('facility_id', effectiveFacilityId)
      .order('scheduled_date', { ascending: false })
      .order('start_time', { ascending: true })

    if (dateRange.start && dateRange.end) {
      query = query.gte('scheduled_date', dateRange.start).lte('scheduled_date', dateRange.end)
    }

    const { data } = await query
    setCases((data as unknown as Case[]) || [])
    setLoading(false)
  }

  // Fetch cases when facility ID or date filter changes
  useEffect(() => {
    if (effectiveFacilityId) {
      const dateRange = getDateRange(dateFilter)
      fetchCases(dateRange)
    }
  }, [effectiveFacilityId, dateFilter])

  const handleDelete = async (id: string) => {
    await supabase.from('cases').delete().eq('id', id)
    setCases(cases.filter(c => c.id !== id))
    setDeleteConfirm(null)
  }

  // Filter cases by status
  const filteredCases = cases.filter(c => {
    const status = getValue(c.case_statuses)
    switch (statusFilter) {
      case 'active':
        return ACTIVE_STATUSES.includes(status || '')
      case 'completed':
        return status === 'completed'
      case 'cancelled':
        return status === 'cancelled'
      case 'all':
      default:
        return true
    }
  })

  // Count stats
  const statusCounts = {
    active: cases.filter(c => ACTIVE_STATUSES.includes(getValue(c.case_statuses) || '')).length,
    completed: cases.filter(c => getValue(c.case_statuses) === 'completed').length,
    cancelled: cases.filter(c => getValue(c.case_statuses) === 'cancelled').length,
  }

  if (noFacilitySelected) {
    return (
      <DashboardLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">No Facility Selected</h2>
            <p className="text-slate-500 mb-6">Select a facility from the Admin panel to view its cases.</p>
            <Link
              href="/admin/facilities"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              View Facilities
            </Link>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Cases</h1>
          <p className="text-slate-500 text-sm mt-1">Manage surgical cases and track progress</p>
        </div>
        <Link
          href="/cases/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-all duration-200 shadow-sm hover:shadow-md"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Case
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Date Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-500">Date:</span>
            <div className="flex rounded-lg border border-slate-200 overflow-hidden">
              {(['today', 'week', 'month', 'all'] as DateFilter[]).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setDateFilter(filter)}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors
                    ${dateFilter === filter
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-slate-600 hover:bg-slate-50'
                    }
                    ${filter !== 'all' ? 'border-r border-slate-200' : ''}
                  `}
                >
                  {filter === 'today' ? 'Today' : filter === 'week' ? 'This Week' : filter === 'month' ? 'This Month' : 'All Time'}
                </button>
              ))}
            </div>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-500">Status:</span>
            <div className="flex rounded-lg border border-slate-200 overflow-hidden">
              {([
                { key: 'active' as StatusFilter, label: 'Active', count: statusCounts.active },
                { key: 'completed' as StatusFilter, label: 'Completed', count: statusCounts.completed },
                { key: 'cancelled' as StatusFilter, label: 'Cancelled', count: statusCounts.cancelled },
                { key: 'all' as StatusFilter, label: 'All', count: cases.length },
              ]).map((filter, idx) => (
                <button
                  key={filter.key}
                  onClick={() => setStatusFilter(filter.key)}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors flex items-center gap-1.5
                    ${statusFilter === filter.key
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-slate-600 hover:bg-slate-50'
                    }
                    ${idx !== 3 ? 'border-r border-slate-200' : ''}
                  `}
                >
                  {filter.label}
                  <span className={`text-xs px-1.5 py-0.5 rounded-full
                    ${statusFilter === filter.key
                      ? 'bg-blue-500 text-blue-100'
                      : 'bg-slate-100 text-slate-500'
                    }
                  `}>
                    {filter.count}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Cases Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredCases.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">No cases found</h3>
            <p className="text-slate-500 text-sm mb-4">Try adjusting your filters or create a new case</p>
            {statusFilter !== 'all' && (
              <button
                onClick={() => setStatusFilter('all')}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-slate-50/80 border-b border-slate-200/80">
              <div className="col-span-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Date</div>
              <div className="col-span-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Time</div>
              <div className="col-span-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Case</div>
              <div className="col-span-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Room</div>
              <div className="col-span-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Surgeon</div>
              <div className="col-span-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Procedure</div>
              <div className="col-span-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Status</div>
              <div className="col-span-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</div>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-slate-100">
              {filteredCases.map((c) => {
                const roomName = getValue(c.or_rooms)
                const procedureName = getValue(c.procedure_types)
                const statusName = getValue(c.case_statuses)
                const surgeon = getSurgeon(c.surgeon)
                const statusConfig = getStatusConfig(statusName)

                return (
                  <div 
                    key={c.id} 
                    className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-slate-50/80 transition-all duration-200 group relative"
                  >
                    {/* Hover indicator */}
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${statusConfig.lineColor} opacity-0 group-hover:opacity-100 transition-opacity`}></div>
                    
                    {/* Date */}
                    <div className="col-span-1">
                      <span className="text-sm font-medium text-slate-600">{formatDate(c.scheduled_date)}</span>
                    </div>
                    
                    {/* Time */}
                    <div className="col-span-1">
                      <span className="text-sm font-semibold text-slate-900 font-mono">{formatTime(c.start_time)}</span>
                    </div>
                    
                    {/* Case Number */}
                    <div className="col-span-2">
                      <Link
                        href={`/cases/${c.id}`}
                        className="text-sm font-semibold text-slate-900 hover:text-blue-600 transition-colors"
                      >
                        {c.case_number}
                      </Link>
                    </div>
                    
                    {/* Room */}
                    <div className="col-span-1">
                      <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-slate-100 rounded-lg">
                        <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        <span className="text-xs font-medium text-slate-600">{roomName || '—'}</span>
                      </div>
                    </div>
                    
                    {/* Surgeon */}
                    <div className="col-span-2">
                      <div className="flex items-center gap-2.5">
                        <SurgeonAvatar name={surgeon.fullName} size="sm" />
                        <span className="text-sm font-medium text-slate-700 truncate">{surgeon.name}</span>
                      </div>
                    </div>
                    
                    {/* Procedure */}
                    <div className="col-span-2">
                      <span className="text-sm text-slate-600 truncate block">{procedureName || 'Not specified'}</span>
                    </div>
                    
                    {/* Status */}
                    <div className="col-span-2">
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${statusConfig.bgColor} ${statusConfig.borderColor}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${statusConfig.dotColor}`}></div>
                        <span className={`text-xs font-semibold ${statusConfig.textColor}`}>
                          {statusConfig.label}
                        </span>
                      </div>
                    </div>
                    
  {/* Actions */}
                    <div className="col-span-1">
                      <div className="flex items-center justify-end gap-1">
                        {/* View button - ALWAYS visible */}
                        <Link
                          href={`/cases/${c.id}`}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200"
                          title="View"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </Link>
                        
                        {/* ================================================== */}
                        {/* ONLY SHOW EDIT/DELETE IF NOT COMPLETED OR CANCELLED */}
                        {/* ================================================== */}
                        {statusName !== 'completed' && statusName !== 'cancelled' && (
                          <>
                            {/* Edit button */}
                            <button
                              onClick={() => router.push(`/cases/${c.id}/edit`)}
                              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all duration-200"
                              title="Edit"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            
                            {/* Delete button with confirmation */}
                            {deleteConfirm === c.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleDelete(c.id)}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
                                  title="Confirm Delete"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => setDeleteConfirm(null)}
                                  className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition-all duration-200"
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
                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all duration-200"
                                title="Delete"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Table Footer */}
            <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-200/80">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">
                  Showing <span className="font-semibold text-slate-700">{filteredCases.length}</span> of <span className="font-semibold text-slate-700">{cases.length}</span> cases
                </span>
                <div className="flex items-center gap-4 text-sm text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                    {statusCounts.active - cases.filter(c => getValue(c.case_statuses) === 'scheduled').length} in progress
                  </span>
                  <span className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    {cases.filter(c => getValue(c.case_statuses) === 'scheduled').length} scheduled
                  </span>
                  <span className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-slate-400"></div>
                    {statusCounts.completed} completed
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Floating Action Button */}
      {effectiveFacilityId && (
        <FloatingActionButton 
          actions={[
            {
              id: 'call-next-patient',
              label: 'Call Next Patient',
              icon: 'megaphone',
              onClick: () => setShowCallNextPatient(true)
            }
          ]}
        />
      )}

      {/* Call Next Patient Modal */}
      {effectiveFacilityId && userId && userEmail && (
        <CallNextPatientModal
          isOpen={showCallNextPatient}
          onClose={() => setShowCallNextPatient(false)}
          facilityId={effectiveFacilityId}
          userId={userId}
          userEmail={userEmail}
        />
      )}
    </DashboardLayout>
  )
}
