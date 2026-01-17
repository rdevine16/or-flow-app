'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '../../lib/supabase'
import DashboardLayout from '../../components/layouts/DashboardLayout'
import SurgeonAvatar from '../../components/ui/SurgeonAvatar'
import { getLocalDateString } from '../../lib/date-utils'
import { getImpersonationState } from '../../lib/impersonation'

// =====================================================
// TYPES
// =====================================================

interface SPDCase {
  id: string
  case_number: string
  scheduled_date: string
  start_time: string | null
  or_rooms: { name: string } | null
  procedure_types: { name: string; requires_rep: boolean } | null
  case_statuses: { name: string } | null
  surgeon: { first_name: string; last_name: string } | null
  rep_required_override: boolean | null
  case_device_companies: CaseDeviceCompany[]
}

interface CaseDeviceCompany {
  id: string
  implant_company_id: string
  tray_status: 'pending' | 'consignment' | 'loaners_confirmed' | 'delivered'
  loaner_tray_count: number | null
  delivered_tray_count: number | null
  confirmed_at: string | null
  delivered_at: string | null
  implant_companies: { name: string }
}

type DateFilter = 'today' | 'tomorrow' | '3days'
type TrayStatusFilter = 'all' | 'awaiting_response' | 'awaiting_delivery' | 'ready' | 'no_rep_needed'

// =====================================================
// HELPER FUNCTIONS
// =====================================================

const formatTime = (time: string | null): string => {
  if (!time) return '--:--'
  const parts = time.split(':')
  const hour = parseInt(parts[0])
  const minutes = parts[1]
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${minutes} ${ampm}`
}

const formatDateLabel = (dateString: string): string => {
  const [year, month, day] = dateString.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const caseDate = new Date(year, month - 1, day)
  
  if (caseDate.getTime() === today.getTime()) return 'Today'
  
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (caseDate.getTime() === tomorrow.getTime()) return 'Tomorrow'
  
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

// Determine if case requires rep based on override and procedure default
const caseRequiresRep = (caseData: SPDCase): boolean => {
  if (caseData.rep_required_override !== null) {
    return caseData.rep_required_override
  }
  return caseData.procedure_types?.requires_rep ?? false
}

// Get the overall tray status for a case
const getCaseTrayStatus = (caseData: SPDCase): TrayStatusFilter => {
  const requiresRep = caseRequiresRep(caseData)
  
  if (!requiresRep) return 'no_rep_needed'
  
  const companies = caseData.case_device_companies || []
  if (companies.length === 0) return 'awaiting_response' // No company assigned but rep required
  
  const allReady = companies.every(c => c.tray_status === 'consignment' || c.tray_status === 'delivered')
  const anyPending = companies.some(c => c.tray_status === 'pending')
  const anyAwaitingDelivery = companies.some(c => c.tray_status === 'loaners_confirmed')
  
  if (allReady) return 'ready'
  if (anyPending) return 'awaiting_response'
  if (anyAwaitingDelivery) return 'awaiting_delivery'
  return 'ready'
}

// Get status display config
const getTrayStatusConfig = (status: TrayStatusFilter) => {
  switch (status) {
    case 'awaiting_response':
      return {
        label: 'Awaiting Response',
        bgColor: 'bg-amber-50',
        textColor: 'text-amber-700',
        borderColor: 'border-amber-200',
        dotColor: 'bg-amber-500',
        icon: '⚠️'
      }
    case 'awaiting_delivery':
      return {
        label: 'Awaiting Delivery',
        bgColor: 'bg-blue-50',
        textColor: 'text-blue-700',
        borderColor: 'border-blue-200',
        dotColor: 'bg-blue-500',
        icon: '📦'
      }
    case 'ready':
      return {
        label: 'Ready',
        bgColor: 'bg-emerald-50',
        textColor: 'text-emerald-700',
        borderColor: 'border-emerald-200',
        dotColor: 'bg-emerald-500',
        icon: '✓'
      }
    case 'no_rep_needed':
    default:
      return {
        label: 'No Rep Needed',
        bgColor: 'bg-slate-50',
        textColor: 'text-slate-600',
        borderColor: 'border-slate-200',
        dotColor: 'bg-slate-400',
        icon: '—'
      }
  }
}

// Get date range based on filter
function getDateRange(filter: DateFilter): { start: string; end: string } {
  const today = getLocalDateString()
  const todayDate = new Date()
  
  switch (filter) {
    case 'today':
      return { start: today, end: today }
    case 'tomorrow': {
      const tomorrow = new Date(todayDate)
      tomorrow.setDate(tomorrow.getDate() + 1)
      const tomorrowStr = tomorrow.toISOString().split('T')[0]
      return { start: tomorrowStr, end: tomorrowStr }
    }
    case '3days':
    default: {
      const threeDays = new Date(todayDate)
      threeDays.setDate(threeDays.getDate() + 2)
      return { start: today, end: threeDays.toISOString().split('T')[0] }
    }
  }
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export default function SPDDashboardPage() {
  const router = useRouter()
  const supabase = createClient()
  
  // State
  const [cases, setCases] = useState<SPDCase[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFilter, setDateFilter] = useState<DateFilter>('3days')
  const [statusFilter, setStatusFilter] = useState<TrayStatusFilter>('all')
  const [effectiveFacilityId, setEffectiveFacilityId] = useState<string | null>(null)
  const [noFacilitySelected, setNoFacilitySelected] = useState(false)

  // Get effective facility ID (handles impersonation)
  useEffect(() => {
    async function getFacilityId() {
      const impersonation = getImpersonationState()
      if (impersonation?.facilityId) {
        setEffectiveFacilityId(impersonation.facilityId)
        return
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: userData } = await supabase
        .from('users')
        .select('facility_id, access_level')
        .eq('id', user.id)
        .single()

      if (userData?.access_level === 'global_admin' && !userData?.facility_id) {
        setNoFacilitySelected(true)
      } else if (userData?.facility_id) {
        setEffectiveFacilityId(userData.facility_id)
      }
    }
    getFacilityId()
  }, [supabase])

  // Fetch cases
  const fetchCases = useCallback(async () => {
    if (!effectiveFacilityId) return

    setLoading(true)
    const { start, end } = getDateRange(dateFilter)

    const { data, error } = await supabase
      .from('cases')
      .select(`
        id,
        case_number,
        scheduled_date,
        start_time,
        rep_required_override,
        or_rooms(name),
        procedure_types(name, requires_rep),
        case_statuses(name),
        surgeon:users!cases_surgeon_id_fkey(first_name, last_name),
        case_device_companies(
          id,
          implant_company_id,
          tray_status,
          loaner_tray_count,
          delivered_tray_count,
          confirmed_at,
          delivered_at,
          implant_companies(name)
        )
      `)
      .eq('facility_id', effectiveFacilityId)
      .gte('scheduled_date', start)
      .lte('scheduled_date', end)
      .neq('case_statuses.name', 'cancelled')
      .order('scheduled_date', { ascending: true })
      .order('start_time', { ascending: true })

    if (error) {
      console.error('Error fetching SPD cases:', error)
    } else {
      setCases((data as unknown as SPDCase[]) || [])
    }
    setLoading(false)
  }, [supabase, effectiveFacilityId, dateFilter])

  useEffect(() => {
    fetchCases()
  }, [fetchCases])

  // Filter cases by tray status
  const filteredCases = cases.filter(c => {
    if (statusFilter === 'all') return true
    return getCaseTrayStatus(c) === statusFilter
  })

  // Calculate summary stats
  const stats = {
    totalRepCases: cases.filter(c => caseRequiresRep(c)).length,
    confirmed: cases.filter(c => getCaseTrayStatus(c) === 'ready').length,
    pending: cases.filter(c => getCaseTrayStatus(c) === 'awaiting_response').length,
    awaitingDelivery: cases.filter(c => getCaseTrayStatus(c) === 'awaiting_delivery').length,
    totalTraysExpected: cases.reduce((sum, c) => {
      return sum + (c.case_device_companies || []).reduce((cSum, cdc) => {
        return cSum + (cdc.loaner_tray_count || 0)
      }, 0)
    }, 0)
  }

  // Handle remind rep (placeholder for now)
  const handleRemindRep = async (caseId: string, companyId: string) => {
    // TODO: Implement push notification to rep
    console.log('Remind rep for case:', caseId, 'company:', companyId)
    alert('Reminder sent to device rep')
  }

  // =====================================================
  // RENDER
  // =====================================================

  // No facility selected (global admin without impersonation)
  if (noFacilitySelected) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-slate-800 mb-2">No Facility Selected</h2>
          <p className="text-slate-500 mb-6 max-w-md">
            As a global admin, you need to impersonate a facility to view the SPD dashboard.
          </p>
          <Link
            href="/admin/facilities"
            className="px-4 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
          >
            Go to Facilities
          </Link>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">SPD Dashboard</h1>
            <p className="text-slate-500 mt-1">Monitor instrument tray requirements and delivery status</p>
          </div>
          <button
            onClick={() => fetchCases()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Date Filter Pills */}
      <div className="flex items-center gap-2 mb-6">
        {(['today', 'tomorrow', '3days'] as DateFilter[]).map((filter) => (
          <button
            key={filter}
            onClick={() => setDateFilter(filter)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              dateFilter === filter
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {filter === 'today' && 'Today'}
            {filter === 'tomorrow' && 'Tomorrow'}
            {filter === '3days' && 'Next 3 Days'}
            {dateFilter === filter && (
              <span className="ml-2 px-1.5 py-0.5 text-xs bg-white/20 rounded-md">
                {filteredCases.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Rep Cases</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">{stats.totalRepCases}</p>
            </div>
            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Confirmed</p>
              <p className="text-3xl font-bold text-emerald-600 mt-1">{stats.confirmed}</p>
            </div>
            <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Pending</p>
              <p className="text-3xl font-bold text-amber-600 mt-1">{stats.pending}</p>
            </div>
            <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Trays Expected</p>
              <p className="text-3xl font-bold text-blue-600 mt-1">{stats.totalTraysExpected}</p>
            </div>
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Status Filter Pills */}
      <div className="flex items-center gap-2 mb-4">
        {([
          { value: 'all', label: 'All Cases' },
          { value: 'awaiting_response', label: '⚠️ Awaiting Response' },
          { value: 'awaiting_delivery', label: '📦 Awaiting Delivery' },
          { value: 'ready', label: '✓ Ready' },
          { value: 'no_rep_needed', label: 'No Rep Needed' },
        ] as { value: TrayStatusFilter; label: string }[]).map((filter) => (
          <button
            key={filter.value}
            onClick={() => setStatusFilter(filter.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              statusFilter === filter.value
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Cases Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-slate-50 border-b border-slate-200">
          <div className="col-span-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</div>
          <div className="col-span-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">Time</div>
          <div className="col-span-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">Room</div>
          <div className="col-span-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Procedure</div>
          <div className="col-span-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Surgeon</div>
          <div className="col-span-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Device Company</div>
          <div className="col-span-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tray Status</div>
          <div className="col-span-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="px-6 py-12 text-center">
            <div className="inline-flex items-center gap-3 text-slate-500">
              <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <span>Loading cases...</span>
            </div>
          </div>
        ) : filteredCases.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-800 mb-1">No cases found</h3>
            <p className="text-slate-500">No cases match the selected filters.</p>
          </div>
        ) : (
          /* Case Rows */
          <div className="divide-y divide-slate-100">
            {filteredCases.map((c) => {
              const trayStatus = getCaseTrayStatus(c)
              const statusConfig = getTrayStatusConfig(trayStatus)
              const surgeon = c.surgeon 
                ? { name: `Dr. ${c.surgeon.last_name}`, fullName: `${c.surgeon.first_name} ${c.surgeon.last_name}` }
                : { name: 'Unassigned', fullName: 'Unassigned' }
              const roomName = c.or_rooms?.name || '—'
              const procedureName = c.procedure_types?.name || 'Not specified'
              const deviceCompanies = c.case_device_companies || []
              const requiresRep = caseRequiresRep(c)

              return (
                <div
                  key={c.id}
                  className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-slate-50/50 transition-colors group relative"
                >
                  {/* Hover indicator */}
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                    trayStatus === 'awaiting_response' ? 'bg-amber-500' :
                    trayStatus === 'awaiting_delivery' ? 'bg-blue-500' :
                    trayStatus === 'ready' ? 'bg-emerald-500' : 'bg-slate-300'
                  } opacity-0 group-hover:opacity-100 transition-opacity`}></div>

                  {/* Date */}
                  <div className="col-span-1">
                    <span className="text-sm font-medium text-slate-600">{formatDateLabel(c.scheduled_date)}</span>
                  </div>

                  {/* Time */}
                  <div className="col-span-1">
                    <span className="text-sm font-semibold text-slate-900 font-mono">{formatTime(c.start_time)}</span>
                  </div>

                  {/* Room */}
                  <div className="col-span-1">
                    <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-slate-100 rounded-lg">
                      <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      <span className="text-xs font-medium text-slate-600">{roomName}</span>
                    </div>
                  </div>

                  {/* Procedure */}
                  <div className="col-span-2">
                    <span className="text-sm text-slate-700 truncate block">{procedureName}</span>
                    <span className="text-xs text-slate-400">{c.case_number}</span>
                  </div>

                  {/* Surgeon */}
                  <div className="col-span-2">
                    <div className="flex items-center gap-2.5">
                      <SurgeonAvatar name={surgeon.fullName} size="sm" />
                      <span className="text-sm font-medium text-slate-700 truncate">{surgeon.name}</span>
                    </div>
                  </div>

                  {/* Device Company */}
                  <div className="col-span-2">
                    {!requiresRep ? (
                      <span className="text-sm text-slate-400 italic">No rep required</span>
                    ) : deviceCompanies.length === 0 ? (
                      <span className="text-sm text-amber-600 font-medium">⚠️ None assigned</span>
                    ) : (
                      <div className="space-y-1">
                        {deviceCompanies.map((dc) => (
                          <div key={dc.id} className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-700">{dc.implant_companies?.name}</span>
                            {dc.tray_status === 'loaners_confirmed' && dc.loaner_tray_count && (
                              <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                {dc.loaner_tray_count} trays
                              </span>
                            )}
                            {dc.tray_status === 'delivered' && (
                              <span className="text-xs text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                                ✓ Delivered
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Tray Status */}
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
                      {/* View Case */}
                      <Link
                        href={`/cases/${c.id}`}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200"
                        title="View Case"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </Link>

                      {/* Remind Rep (only for pending) */}
                      {trayStatus === 'awaiting_response' && deviceCompanies.length > 0 && (
                        <button
                          onClick={() => handleRemindRep(c.id, deviceCompanies[0].implant_company_id)}
                          className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all duration-200"
                          title="Send Reminder"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Table Footer */}
        {!loading && filteredCases.length > 0 && (
          <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-200/80">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">
                Showing <span className="font-semibold text-slate-700">{filteredCases.length}</span> of <span className="font-semibold text-slate-700">{cases.length}</span> cases
              </span>
              <div className="flex items-center gap-4 text-sm text-slate-500">
                <span className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                  {stats.confirmed} ready
                </span>
                <span className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                  {stats.pending} pending
                </span>
                <span className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  {stats.awaitingDelivery} awaiting delivery
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}