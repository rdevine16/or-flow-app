'use client'

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import SurgeonAvatar from '@/components/ui/SurgeonAvatar'
import FloatingActionButton from '@/components/ui/FloatingActionButton'
import CallNextPatientModal from '@/components/CallNextPatientModal'
import CasesFilterBar, { FilterState } from '@/components/filters/CaseFilterBar'
import { getLocalDateString } from '@/lib/date-utils'
import { getImpersonationState } from '@/lib/impersonation'
import { extractName } from '@/lib/formatters'
import { useSurgeons, useProcedureTypes, useRooms } from '@/hooks'
import { EmptyState, EmptyStateIcons } from '@/components/ui/EmptyState'
import { DeleteConfirm } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast/ToastProvider'


// ============================================================================
// TYPES
// ============================================================================

interface Case {
  id: string
  case_number: string
  scheduled_date: string
  start_time: string | null
  operative_side: string | null
  or_rooms: { name: string }[] | { name: string } | null
  procedure_types: { name: string }[] | { name: string } | null
  case_statuses: { name: string }[] | { name: string } | null
  surgeon: { first_name: string; last_name: string }[] | { first_name: string; last_name: string } | null
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

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
  
  if (caseDate.getTime() === today.getTime()) {
    return 'Today'
  }
  
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (caseDate.getTime() === yesterday.getTime()) {
    return 'Yesterday'
  }
  
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

function getDateRange(filter: string): { start?: string; end?: string } {
  const today = getLocalDateString()
  const todayDate = new Date()
  
  switch (filter) {
    case 'today':
      return { start: today, end: today }
    case 'yesterday': {
      const yesterday = new Date(todayDate)
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = getLocalDateString(yesterday)
      return { start: yesterdayStr, end: yesterdayStr }
    }
    case 'week': {
      const weekStart = new Date(todayDate)
      weekStart.setDate(weekStart.getDate() - 7)
      return { start: getLocalDateString(weekStart), end: today }
    }
    case 'month': {
      const monthStart = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1)
      return { start: getLocalDateString(monthStart), end: today }
    }
    case 'quarter': {
      const quarterStart = new Date(todayDate.getFullYear(), Math.floor(todayDate.getMonth() / 3) * 3, 1)
      return { start: getLocalDateString(quarterStart), end: today }
    }
    case 'all':
    default:
      return {}
  }
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

function CasesPageContent() {
  const router = useRouter()
  const supabase = createClient()
  
  // Core state
  const [cases, setCases] = useState<Case[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { showToast } = useToast()
  const [deleteTarget, setDeleteTarget] = useState<Case | null>(null)
  const [effectiveFacilityId, setEffectiveFacilityId] = useState<string | null>(null)
  const [noFacilitySelected, setNoFacilitySelected] = useState(false)
  
  // Filter options (fetched from DB)
  const { data: surgeons } = useSurgeons(effectiveFacilityId)
  const { data: rooms } = useRooms(effectiveFacilityId)
  const { data: procedureTypes } = useProcedureTypes(effectiveFacilityId)

  // Current filters (managed by CasesFilterBar)
  const [currentFilters, setCurrentFilters] = useState<FilterState>({
    dateRange: 'week',
    status: [],
    surgeonIds: [],
    roomIds: [],
    procedureIds: [],
    search: '',
  })
  
  // User info for FAB/Modal
  const [userId, setUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  
  // Call Next Patient modal
  const [showCallNextPatient, setShowCallNextPatient] = useState(false)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [perPage, setPerPage] = useState(25)
  const perPageOptions = [10, 25, 50, 100]

  // ============================================================================
  // PAGINATION
  // ============================================================================

  const totalPages = useMemo(() => Math.max(1, Math.ceil(cases.length / perPage)), [cases.length, perPage])

  // Clamp currentPage if it exceeds totalPages (e.g. after filter change reduces results)
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [totalPages, currentPage])

  const paginatedCases = useMemo(() => {
    const start = (currentPage - 1) * perPage
    return cases.slice(start, start + perPage)
  }, [cases, currentPage, perPage])

  // Generate page numbers to display (smart windowing)
  const pageNumbers = useMemo(() => {
    const pages: (number | 'ellipsis')[] = []
    if (totalPages <= 7) {
      // Show all pages if 7 or fewer
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      // Always show first page
      pages.push(1)
      
      if (currentPage > 3) pages.push('ellipsis')
      
      // Show pages around current
      const start = Math.max(2, currentPage - 1)
      const end = Math.min(totalPages - 1, currentPage + 1)
      for (let i = start; i <= end; i++) pages.push(i)
      
      if (currentPage < totalPages - 2) pages.push('ellipsis')
      
      // Always show last page
      pages.push(totalPages)
    }
    return pages
  }, [currentPage, totalPages])

  // ============================================================================
  // FACILITY INITIALIZATION
  // ============================================================================

  useEffect(() => {
    async function fetchUserFacility() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        
        if (authError) throw authError
        
        if (!user) {
          setLoading(false)
          return
        }

        setUserId(user.id)
        setUserEmail(user.email || null)

        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('facility_id, access_level')
          .eq('id', user.id)
          .single()

        if (userError) throw userError

        if (userData?.access_level === 'global_admin') {
          const impersonation = getImpersonationState()
          if (impersonation?.facilityId) {
            setEffectiveFacilityId(impersonation.facilityId)
          } else {
            setNoFacilitySelected(true)
            setLoading(false)
          }
          return
        }

        if (userData?.facility_id) {
          setEffectiveFacilityId(userData.facility_id)
        } else {
          setLoading(false)
        }
      } catch (err) {
        setError('Failed to load user information. Please refresh the page.')
        showToast({
          type: 'error',
          title: 'Failed to load user',
          message: 'Please refresh the page'
        })
        setLoading(false)
      }
    }

    fetchUserFacility()
  }, [supabase, showToast])

  // ============================================================================
  // FETCH CASES (with filters applied)
  // ============================================================================

  const fetchCases = useCallback(async (filters: FilterState) => {
    if (!effectiveFacilityId) return
    
    try {
      setLoading(true)
      setError(null)

      // Build base query
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

      // Apply date range
      const dateRange = getDateRange(filters.dateRange)
      if (dateRange.start && dateRange.end) {
        query = query.gte('scheduled_date', dateRange.start).lte('scheduled_date', dateRange.end)
      }

      // Apply status filter
      if (filters.status.length > 0) {
        const { data: statusData, error: statusError } = await supabase
          .from('case_statuses')
          .select('id, name')
          .in('name', filters.status)
        
        if (statusError) throw statusError
        
        if (statusData && statusData.length > 0) {
          query = query.in('status_id', statusData.map(s => s.id))
        }
      }

      // Apply surgeon filter
      if (filters.surgeonIds.length > 0) {
        query = query.in('surgeon_id', filters.surgeonIds)
      }

      // Apply room filter
      if (filters.roomIds.length > 0) {
        query = query.in('or_room_id', filters.roomIds)
      }

      // Apply procedure filter
      if (filters.procedureIds.length > 0) {
        query = query.in('procedure_type_id', filters.procedureIds)
      }

      const { data, error: casesError } = await query
      
      if (casesError) throw casesError
      
      let filteredData = (data as unknown as Case[]) || []

      // Apply text search (client-side for flexibility)
      if (filters.search) {
        const searchLower = filters.search.toLowerCase()
        filteredData = filteredData.filter(c => {
          const caseNumber = c.case_number.toLowerCase()
          const procedure = extractName(c.procedure_types)?.toLowerCase() || ''
          const surgeon = getSurgeon(c.surgeon).fullName.toLowerCase()
          const room = extractName(c.or_rooms)?.toLowerCase() || ''
          
          return (
            caseNumber.includes(searchLower) ||
            procedure.includes(searchLower) ||
            surgeon.includes(searchLower) ||
            room.includes(searchLower)
          )
        })
      }

      setCases(filteredData)
    } catch (err) {
      setError('Failed to load cases. Please try again.')
      showToast({
        type: 'error',
        title: 'Failed to load cases',
        message: 'Please try again or contact support'
      })
    } finally {
      setLoading(false)
    }
  }, [effectiveFacilityId, supabase, showToast])

  // Fetch cases when facility or filters change
  useEffect(() => {
    if (effectiveFacilityId) {
      fetchCases(currentFilters)
    }
  }, [effectiveFacilityId, currentFilters, fetchCases])

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleFiltersChange = useCallback((filters: FilterState) => {
    setCurrentFilters(filters)
    setCurrentPage(1) // Reset to first page on filter change
  }, [])

  const handleDelete = async (id: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('cases')
        .delete()
        .eq('id', id)
      
      if (deleteError) throw deleteError
      
      setCases(cases.filter(c => c.id !== id))
      setDeleteTarget(null)
      
      showToast({
        type: 'success',
        title: 'Case deleted',
        message: 'The case has been removed successfully'
      })
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Failed to delete case',
        message: 'Please try again'
      })
    }
  }

  // ============================================================================
  // RENDER - NO FACILITY SELECTED STATE
  // ============================================================================

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

  // ============================================================================
  // RENDER - MAIN
  // ============================================================================

  return (
    <DashboardLayout>
      {/* Error Banner */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">{error}</p>
            <button
              onClick={() => {
                setError(null)
                fetchCases(currentFilters)
              }}
              className="mt-2 text-sm text-red-600 underline hover:text-red-700"
            >
              Try again
            </button>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-600"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

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

      {/* Professional Filter Bar */}
      <div className="mb-6">
        <CasesFilterBar
          surgeons={surgeons}
          rooms={rooms}
          procedureTypes={procedureTypes}
          cases={cases.map(c => ({
            id: c.id,
            case_number: c.case_number,
            procedure_name: extractName(c.procedure_types) || undefined,
            surgeon_name: getSurgeon(c.surgeon).name,
            room_name: extractName(c.or_rooms) || undefined,
          }))}
          totalCount={cases.length}
          filteredCount={cases.length}
          onFiltersChange={handleFiltersChange}
          onCaseSelect={(id) => router.push(`/cases/${id}`)}
        />
      </div>

      {/* Cases Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : cases.length === 0 ? (
          <EmptyState
            icon={EmptyStateIcons.Clipboard}
            title="No cases found"
            description="Try adjusting your filters or create a new case"
            className="py-20"
          />
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
              {paginatedCases.map((c) => {
                const roomName = extractName(c.or_rooms)
                const procedureName = extractName(c.procedure_types)
                const statusName = extractName(c.case_statuses)
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
                      <span className="text-sm text-slate-700 font-mono">{formatTime(c.start_time)}</span>
                    </div>
                    
                    {/* Case Number */}
                    <div className="col-span-2">
                      <Link 
                        href={`/cases/${c.id}`}
                        className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                      >
                        Case #{c.case_number}
                      </Link>
                    </div>
                    
                    {/* Room */}
                    <div className="col-span-1">
                      <span className="text-sm text-slate-600">{roomName || '—'}</span>
                    </div>
                    
                    {/* Surgeon */}
                    <div className="col-span-2 flex items-center gap-2">
                      <SurgeonAvatar name={surgeon.fullName} size="sm" />
                      <span className="text-sm text-slate-700">{surgeon.name}</span>
                    </div>
                    
                    {/* Procedure */}
                    <div className="col-span-2">
                      <span className="text-sm text-slate-700">{procedureName || '—'}</span>
                    </div>
                    
                    {/* Status */}
                    <div className="col-span-2">
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full ${statusConfig.bgColor} ${statusConfig.borderColor} border`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${statusConfig.dotColor}`}></div>
                        <span className={`text-xs font-medium ${statusConfig.textColor}`}>{statusConfig.label}</span>
                      </div>
                    </div>
                    
                    {/* Actions */}
                    <div className="col-span-1 flex justify-end">
                      <button
                        onClick={() => setDeleteTarget(c)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all duration-200"
                        title="Delete case"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                {/* Per-page selector */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-600">Show</span>
                  <select
                    value={perPage}
                    onChange={(e) => {
                      setPerPage(Number(e.target.value))
                      setCurrentPage(1)
                    }}
                    className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {perPageOptions.map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                  <span className="text-sm text-slate-600">
                    of {cases.length} {cases.length === 1 ? 'case' : 'cases'}
                  </span>
                </div>

                {/* Page buttons */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>

                  {pageNumbers.map((page, idx) => (
                    page === 'ellipsis' ? (
                      <span key={`ellipsis-${idx}`} className="px-3 py-1 text-slate-400">...</span>
                    ) : (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`
                          px-3 py-1 rounded-lg text-sm font-medium transition-colors
                          ${page === currentPage 
                            ? 'bg-blue-600 text-white' 
                            : 'text-slate-600 hover:bg-slate-100'
                          }
                        `}
                      >
                        {page}
                      </button>
                    )
                  ))}

                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Floating Action Button */}
      {effectiveFacilityId && userId && userEmail && (
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

      <DeleteConfirm
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget) await handleDelete(deleteTarget.id)
        }}
        itemName={deleteTarget ? `Case #${deleteTarget.case_number}` : ''}
        itemType="case"
      />
    </DashboardLayout>
  )
}

// ============================================================================
// EXPORT WITH SUSPENSE BOUNDARY
// ============================================================================

export default function CasesPage() {
  return (
    <Suspense fallback={
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    }>
      <CasesPageContent />
    </Suspense>
  )
}