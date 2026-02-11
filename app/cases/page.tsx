'use client'

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import SurgeonAvatar from '@/components/ui/SurgeonAvatar'
import FloatingActionButton from '@/components/ui/FloatingActionButton'
import CallNextPatientModal from '@/components/CallNextPatientModal'
import CasesFilterBar, { FilterState } from '@/components/filters/CaseFilterBar'
import { Pagination } from '@/components/ui/Pagination'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Plus, Trash2 } from 'lucide-react'
import { NoFacilitySelected } from '@/components/ui/NoFacilitySelected'
import { PageLoader } from '@/components/ui/Loading'
import { StatusBadgeDot } from '@/components/ui/StatusBadge'
import { EmptyState, EmptyStateIcons } from '@/components/ui/EmptyState'
import { DeleteConfirm } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { getLocalDateString } from '@/lib/date-utils'
import {
  extractName,
  formatSurgeonName,
  formatDisplayTime,
  formatRelativeDate,
} from '@/lib/formatters'
import { useSurgeons, useProcedureTypes, useRooms } from '@/hooks'


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
// HELPERS
// ============================================================================

function getDateRange(filter: string): { start?: string; end?: string } {
  const today = getLocalDateString()
  const todayDate = new Date()

  switch (filter) {
    case 'today':
      return { start: today, end: today }
    case 'yesterday': {
      const yesterday = new Date(todayDate)
      yesterday.setDate(yesterday.getDate() - 1)
      return { start: getLocalDateString(yesterday), end: getLocalDateString(yesterday) }
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
  const { showToast } = useToast()

  // User context — replaces manual facility init boilerplate
  const {
    userData,
    loading: userLoading,
    effectiveFacilityId,
    isGlobalAdmin,
    isImpersonating,
  } = useUser()

  // Core state
  const [cases, setCases] = useState<Case[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Case | null>(null)

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

  // Call Next Patient modal
  const [showCallNextPatient, setShowCallNextPatient] = useState(false)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [perPage, setPerPage] = useState(25)

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(cases.length / perPage)),
    [cases.length, perPage]
  )

  // Clamp currentPage if it exceeds totalPages (e.g. after filter reduces results)
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [totalPages, currentPage])

  const paginatedCases = useMemo(() => {
    const start = (currentPage - 1) * perPage
    return cases.slice(start, start + perPage)
  }, [cases, currentPage, perPage])

  // ============================================================================
  // FETCH CASES
  // ============================================================================

  const fetchCases = useCallback(async (filters: FilterState) => {
    if (!effectiveFacilityId) return

    try {
      setLoading(true)
      setError(null)

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
          const surgeon = formatSurgeonName(c.surgeon, { format: 'full' }).toLowerCase()
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
        message: 'Please try again or contact support',
      })
    } finally {
      setLoading(false)
    }
  }, [effectiveFacilityId, supabase, showToast])

  // Fetch cases when facility or filters change
  useEffect(() => {
    if (effectiveFacilityId) {
      fetchCases(currentFilters)
    } else if (!userLoading) {
      setLoading(false)
    }
  }, [effectiveFacilityId, currentFilters, fetchCases, userLoading])

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleFiltersChange = useCallback((filters: FilterState) => {
    setCurrentFilters(filters)
    setCurrentPage(1)
  }, [])

  const handleDelete = async (id: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('cases')
        .delete()
        .eq('id', id)

      if (deleteError) throw deleteError

      setCases(prev => prev.filter(c => c.id !== id))
      setDeleteTarget(null)

      showToast({
        type: 'success',
        title: 'Case deleted',
        message: 'The case has been removed successfully',
      })
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Failed to delete case',
        message: 'Please try again',
      })
    }
  }

  // ============================================================================
  // RENDER — NO FACILITY STATE
  // ============================================================================

  if (isGlobalAdmin && !isImpersonating) {
    return (
      <DashboardLayout>
        <NoFacilitySelected />
      </DashboardLayout>
    )
  }

  // ============================================================================
  // RENDER — MAIN
  // ============================================================================

  return (
    <DashboardLayout>
      {/* Error Banner */}
      <ErrorBanner
        message={error}
        onRetry={() => {
          setError(null)
          fetchCases(currentFilters)
        }}
        onDismiss={() => setError(null)}
        className="mb-6"
      />

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
          <Plus className="w-4 h-4" />
          New Case
        </Link>
      </div>

      {/* Filter Bar */}
      <div className="mb-6">
        <CasesFilterBar
          surgeons={surgeons}
          rooms={rooms}
          procedureTypes={procedureTypes}
          cases={cases.map(c => ({
            id: c.id,
            case_number: c.case_number,
            procedure_name: extractName(c.procedure_types) || undefined,
            surgeon_name: formatSurgeonName(c.surgeon),
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
          <PageLoader message="Loading cases..." />
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
                const surgeonShort = formatSurgeonName(c.surgeon)
                const surgeonFull = formatSurgeonName(c.surgeon, { format: 'full' })

                return (
                  <div
                    key={c.id}
                    className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-slate-50/80 transition-all duration-200 group"
                  >
                    {/* Date */}
                    <div className="col-span-1">
                      <span className="text-sm font-medium text-slate-600">
                        {formatRelativeDate(c.scheduled_date)}
                      </span>
                    </div>

                    {/* Time */}
                    <div className="col-span-1">
                      <span className="text-sm text-slate-700 font-mono">
                        {formatDisplayTime(c.start_time, { fallback: '--:--' })}
                      </span>
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
                      <SurgeonAvatar name={surgeonFull} size="sm" />
                      <span className="text-sm text-slate-700">{surgeonShort}</span>
                    </div>

                    {/* Procedure */}
                    <div className="col-span-2">
                      <span className="text-sm text-slate-700">{procedureName || '—'}</span>
                    </div>

                    {/* Status */}
                    <div className="col-span-2">
                      <StatusBadgeDot status={statusName || 'scheduled'} />
                    </div>

                    {/* Actions */}
                    <div className="col-span-1 flex justify-end">
                      <button
                        onClick={() => setDeleteTarget(c)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all duration-200"
                        title="Delete case"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Pagination */}
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={cases.length}
              perPage={perPage}
              onPageChange={setCurrentPage}
              onPerPageChange={(n) => {
                setPerPage(n)
                setCurrentPage(1)
              }}
            />
          </>
        )}
      </div>

      {/* Floating Action Button */}
      {effectiveFacilityId && userData.userId && userData.userEmail && (
        <FloatingActionButton
          actions={[
            {
              id: 'call-next-patient',
              label: 'Call Next Patient',
              icon: 'megaphone',
              onClick: () => setShowCallNextPatient(true),
            },
          ]}
        />
      )}

      {/* Call Next Patient Modal */}
      {effectiveFacilityId && userData.userId && userData.userEmail && (
        <CallNextPatientModal
          isOpen={showCallNextPatient}
          onClose={() => setShowCallNextPatient(false)}
          facilityId={effectiveFacilityId}
          userId={userData.userId}
          userEmail={userData.userEmail}
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
        <PageLoader />
      </DashboardLayout>
    }>
      <CasesPageContent />
    </Suspense>
  )
}
