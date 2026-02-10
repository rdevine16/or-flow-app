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
      const yd = yesterday.toISOString().split('T')[0]
      return { start: yd, end: yd }
    }
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
    case 'quarter': {
      const quarterStart = new Date(todayDate.getFullYear(), Math.floor(todayDate.getMonth() / 3) * 3, 1)
      const quarterEnd = new Date(todayDate.getFullYear(), Math.floor(todayDate.getMonth() / 3) * 3 + 3, 0)
      return {
        start: quarterStart.toISOString().split('T')[0],
        end: quarterEnd.toISOString().split('T')[0]
      }
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

  // ============================================================================
  // FETCH CASES (with filters applied)
  // ============================================================================

  const fetchCases = useCallback(async (filters: FilterState) => {
    if (!effectiveFacilityId) return
    
    setLoading(true)

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
      const { data: statusData } = await supabase
        .from('case_statuses')
        .select('id, name')
        .in('name', filters.status)
      
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

    const { data } = await query
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
    setLoading(false)
  }, [effectiveFacilityId, supabase])

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
    await supabase.from('cases').delete().eq('id', id)
    setCases(cases.filter(c => c.id !== id))
    setDeleteTarget(null)
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
                        
                        {/* Only show edit/delete if not completed or cancelled */}
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
                            
                            <button
                                onClick={() => setDeleteTarget(c)}
                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all duration-200"
                                title="Delete"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Table Footer - Pagination */}
            <div className="px-6 py-3 bg-slate-50/50 border-t border-slate-200/80">
              <div className="flex items-center justify-between">
                {/* Left: Per-page selector + result count */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-500">Show</span>
                    <select
                      value={perPage}
                      onChange={(e) => {
                        setPerPage(Number(e.target.value))
                        setCurrentPage(1)
                      }}
                      className="px-2.5 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors cursor-pointer appearance-none pr-7"
                      style={{ 
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 6px center'
                      }}
                    >
                      {perPageOptions.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                    <span className="text-sm text-slate-500">per page</span>
                  </div>
                  
                  <div className="h-4 w-px bg-slate-200" />
                  
                  <span className="text-sm text-slate-500">
                    Showing{' '}
                    <span className="font-semibold text-slate-700">
                      {Math.min((currentPage - 1) * perPage + 1, cases.length)}
                    </span>
                    –
                    <span className="font-semibold text-slate-700">
                      {Math.min(currentPage * perPage, cases.length)}
                    </span>
                    {' '}of{' '}
                    <span className="font-semibold text-slate-700">{cases.length}</span> cases
                  </span>
                </div>

                {/* Right: Page navigation */}
                {totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    {/* Previous button */}
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-white rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-400"
                      title="Previous page"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>

                    {/* Page numbers */}
                    {pageNumbers.map((page, idx) =>
                      page === 'ellipsis' ? (
                        <span key={`ellipsis-${idx}`} className="px-1 text-sm text-slate-400">
                          ···
                        </span>
                      ) : (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`min-w-[32px] h-8 px-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                            page === currentPage
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'text-slate-600 hover:bg-white hover:text-slate-900'
                          }`}
                        >
                          {page}
                        </button>
                      )
                    )}

                    {/* Next button */}
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-white rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-400"
                      title="Next page"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                )}
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