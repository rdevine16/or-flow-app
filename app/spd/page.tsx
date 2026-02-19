// app/spd/page.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import SurgeonAvatar from '@/components/ui/SurgeonAvatar'
import { getLocalDateString } from '@/lib/date-utils'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { PageLoader } from '@/components/ui/Loading'
import { AlertTriangle, ArrowRight, Bell, Box, Building2, Eye, MessageSquare, Minus, X } from 'lucide-react'

// =====================================================
// TYPES
// =====================================================

interface SPDCase {
  id: string
  case_number: string
  scheduled_date: string
  start_time: string | null
  operative_side: string | null
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
  rep_notes: string | null
  implant_companies: { name: string }
}

interface TrayActivity {
  id: string
  activity_type: string
  message: string
  created_at: string
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

const formatDateFull = (dateString: string): string => {
  const [year, month, day] = dateString.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

const formatDateTime = (isoString: string | null): string => {
  if (!isoString) return '—'
  const date = new Date(isoString)
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

const formatOperativeSide = (side: string | null): string => {
  if (!side) return ''
  switch (side.toLowerCase()) {
    case 'left': return 'Left'
    case 'right': return 'Right'
    case 'bilateral': return 'Bilateral'
    default: return side
  }
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
        bgColor: 'bg-green-50',
        textColor: 'text-green-600',
        borderColor: 'border-green-200',
        dotColor: 'bg-green-500',
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

// Get individual device company status config
const getDeviceStatusConfig = (status: string) => {
  switch (status) {
    case 'pending':
      return { label: 'Pending', color: 'text-amber-700', bg: 'bg-amber-50', icon: '⏳' }
    case 'consignment':
      return { label: 'Consignment', color: 'text-green-600', bg: 'bg-green-50', icon: '✓' }
    case 'loaners_confirmed':
      return { label: 'Loaners Confirmed', color: 'text-blue-600', bg: 'bg-blue-50', icon: '📦' }
    case 'delivered':
      return { label: 'Delivered', color: 'text-green-600', bg: 'bg-green-50', icon: '✓' }
    default:
      return { label: status, color: 'text-slate-600', bg: 'bg-slate-50', icon: '—' }
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
      const tomorrowStr = getLocalDateString(tomorrow)
      return { start: tomorrowStr, end: tomorrowStr }
    }
    case '3days':
    default: {
      const threeDays = new Date(todayDate)
      threeDays.setDate(threeDays.getDate() + 2)
      return { start: today, end: getLocalDateString(threeDays) }
    }
  }
}

// =====================================================
// SLIDEOUT PANEL COMPONENT
// =====================================================

interface SlideoutPanelProps {
  caseData: SPDCase | null
  isOpen: boolean
  onClose: () => void
  activities: TrayActivity[]
  loadingActivities: boolean
}

function SlideoutPanel({ caseData, isOpen, onClose, activities, loadingActivities }: SlideoutPanelProps) {
  if (!caseData) return null

  const requiresRep = caseRequiresRep(caseData)
  const trayStatus = getCaseTrayStatus(caseData)
  const statusConfig = getTrayStatusConfig(trayStatus)
  const surgeon = caseData.surgeon 
    ? `Dr. ${caseData.surgeon.first_name} ${caseData.surgeon.last_name}`
    : 'Unassigned'
  const procedureName = caseData.procedure_types?.name || 'Not specified'
  const roomName = caseData.or_rooms?.name || '—'
  const deviceCompanies = caseData.case_device_companies || []

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />
      
      {/* Slideout Panel */}
      <div 
        className={`fixed right-0 top-0 bottom-0 w-full max-w-lg bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Case Details</h2>
            <p className="text-sm text-slate-500">{caseData.case_number}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto h-[calc(100vh-140px)] p-6 space-y-6">
          {/* Case Info Section */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-slate-900">{procedureName}</h3>
                {caseData.operative_side && (
                  <span className="text-sm text-slate-500">({formatOperativeSide(caseData.operative_side)})</span>
                )}
              </div>
              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${statusConfig.bgColor} ${statusConfig.borderColor}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${statusConfig.dotColor}`}></div>
                <span className={`text-xs font-semibold ${statusConfig.textColor}`}>
                  {statusConfig.label}
                </span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-slate-500">Date</span>
                <p className="font-medium text-slate-900">{formatDateFull(caseData.scheduled_date)}</p>
              </div>
              <div>
                <span className="text-slate-500">Time</span>
                <p className="font-medium text-slate-900">{formatTime(caseData.start_time)}</p>
              </div>
              <div>
                <span className="text-slate-500">Room</span>
                <p className="font-medium text-slate-900">{roomName}</p>
              </div>
              <div>
                <span className="text-slate-500">Surgeon</span>
                <p className="font-medium text-slate-900">{surgeon}</p>
              </div>
            </div>
          </div>

          {/* Tray Status Section */}
          <div>
            <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3">
              Tray Status
            </h4>
            
            {!requiresRep ? (
              <div className="bg-slate-50 rounded-xl p-6 text-center">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Minus className="w-6 h-6 text-slate-400" />
                </div>
                <p className="text-slate-600 font-medium">No Rep Required</p>
                <p className="text-sm text-slate-400 mt-1">This case does not require device rep involvement</p>
              </div>
            ) : deviceCompanies.length === 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-medium text-amber-800">No Device Company Assigned</p>
                    <p className="text-sm text-amber-700 mt-1">This case requires rep but no company has been assigned.</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {deviceCompanies.map((dc) => {
                  const dcStatus = getDeviceStatusConfig(dc.tray_status)
                  return (
                    <div key={dc.id} className="bg-white border border-slate-200 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-semibold text-slate-900">{dc.implant_companies?.name}</span>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${dcStatus.color} ${dcStatus.bg}`}>
                          {dcStatus.icon} {dcStatus.label}
                        </span>
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        {dc.tray_status === 'loaners_confirmed' && dc.loaner_tray_count && (
                          <div className="flex justify-between">
                            <span className="text-slate-500">Trays Confirmed</span>
                            <span className="font-medium text-slate-900">{dc.loaner_tray_count} tray{dc.loaner_tray_count > 1 ? 's' : ''}</span>
                          </div>
                        )}
                        {dc.tray_status === 'delivered' && (
                          <div className="flex justify-between">
                            <span className="text-slate-500">Trays Delivered</span>
                            <span className="font-medium text-slate-900">{dc.delivered_tray_count || dc.loaner_tray_count || 0} tray{(dc.delivered_tray_count || dc.loaner_tray_count || 0) > 1 ? 's' : ''}</span>
                          </div>
                        )}
                        {dc.confirmed_at && (
                          <div className="flex justify-between">
                            <span className="text-slate-500">Confirmed</span>
                            <span className="font-medium text-slate-900">{formatDateTime(dc.confirmed_at)}</span>
                          </div>
                        )}
                        {dc.delivered_at && (
                          <div className="flex justify-between">
                            <span className="text-slate-500">Delivered</span>
                            <span className="font-medium text-slate-900">{formatDateTime(dc.delivered_at)}</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Rep Notes */}
                      {dc.rep_notes && (
                        <div className="mt-3 pt-3 border-t border-slate-100">
                          <div className="flex items-start gap-2">
                            <MessageSquare className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Rep Notes</p>
                              <p className="text-sm text-slate-700 mt-1">{dc.rep_notes}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Activity History */}
          {requiresRep && deviceCompanies.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3">
                Activity History
              </h4>
              
              {loadingActivities ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : activities.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">No activity recorded yet</p>
              ) : (
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="space-y-3">
                    {activities.map((activity, idx) => (
                      <div key={activity.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className={`w-2.5 h-2.5 rounded-full ${
                            activity.activity_type === 'trays_delivered' || activity.activity_type === 'consignment_confirmed'
                              ? 'bg-green-500'
                              : activity.activity_type === 'loaners_confirmed'
                              ? 'bg-blue-500'
                              : activity.activity_type === 'status_reset'
                              ? 'bg-amber-500'
                              : 'bg-slate-400'
                          }`} />
                          {idx < activities.length - 1 && (
                            <div className="w-0.5 h-full bg-slate-200 mt-1" />
                          )}
                        </div>
                        <div className="pb-3">
                          <p className="text-sm text-slate-700">{activity.message}</p>
                          <p className="text-xs text-slate-400">{formatDateTime(activity.created_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 px-6 py-4 bg-white border-t border-slate-200">
          <Link
            href={`/cases/${caseData.id}`}
            className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors"
          >
            View Full Case Details
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </>
  )
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export default function SPDDashboardPage() {
  const supabase = createClient()
  const { showToast } = useToast()
  const { loading: userLoading, isGlobalAdmin, effectiveFacilityId } = useUser()
  // State
  const [cases, setCases] = useState<SPDCase[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dateFilter, setDateFilter] = useState<DateFilter>('3days')
  const [statusFilter, setStatusFilter] = useState<TrayStatusFilter>('all')
  
  // Slideout state
  const [selectedCase, setSelectedCase] = useState<SPDCase | null>(null)
  const [slideoutOpen, setSlideoutOpen] = useState(false)
  const [activities, setActivities] = useState<TrayActivity[]>([])
  const [loadingActivities, setLoadingActivities] = useState(false)

  // Fetch cases
  const fetchCases = useCallback(async () => {
    if (!effectiveFacilityId) return

    setLoading(true)
    setError(null)
    const { start, end } = getDateRange(dateFilter)

    try {
      const { data, error: fetchError } = await supabase
        .from('cases')
        .select(`
          id,
          case_number,
          scheduled_date,
          start_time,
          operative_side,
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
            rep_notes,
            implant_companies(name)
          )
        `)
        .eq('facility_id', effectiveFacilityId)
        .gte('scheduled_date', start)
        .lte('scheduled_date', end)
        .neq('case_statuses.name', 'cancelled')
        .order('scheduled_date', { ascending: true })
        .order('start_time', { ascending: true })

      if (fetchError) throw fetchError
      setCases((data as unknown as SPDCase[]) || [])
    } catch (err) {
      setError('Failed to load SPD cases. Please try again.')
      showToast({
        type: 'error',
        title: 'Failed to load SPD cases',
        message: err instanceof Error ? err.message : 'Please try again'
      })
    } finally {
      setLoading(false)
    }
  }, [supabase, effectiveFacilityId, dateFilter, showToast])

  useEffect(() => {
    fetchCases()
  }, [fetchCases])

  // Fetch activities when a case is selected
  const fetchActivities = useCallback(async (caseId: string, companyIds: string[]) => {
    if (companyIds.length === 0) {
      setActivities([])
      return
    }

    setLoadingActivities(true)
    
    const { data, error } = await supabase
      .from('case_device_activity')
      .select('id, activity_type, message, created_at')
      .eq('case_id', caseId)
      .in('implant_company_id', companyIds)
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) {
      showToast({
  type: 'error',
  title: 'Error fetching activities:',
  message: error instanceof Error ? error.message : 'Error fetching activities:'
})
      setActivities([])
    } else {
      setActivities(data || [])
    }
    setLoadingActivities(false)
  }, [supabase, showToast])

  // Handle row click
  const handleRowClick = (caseData: SPDCase) => {
    setSelectedCase(caseData)
    setSlideoutOpen(true)
    
    // Fetch activities for this case
    const companyIds = caseData.case_device_companies?.map(dc => dc.implant_company_id) || []
    fetchActivities(caseData.id, companyIds)
  }

  // Handle slideout close
  const handleSlideoutClose = () => {
    setSlideoutOpen(false)
    // Clear selection after animation
    setTimeout(() => setSelectedCase(null), 300)
  }

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
const handleRemindRep = async (caseId: string, companyId: string, e: React.MouseEvent) => {
  e.stopPropagation() // Prevent row click
  
  // TODO: Implement push notification to rep
  showToast({
    type: 'success',
    title: 'Reminder Sent',
    message: 'Device rep has been notified'
  })
}

  // =====================================================
  // RENDER
  // =====================================================

  // No facility selected (global admin without impersonation)
  if (!effectiveFacilityId && isGlobalAdmin && !userLoading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-xl flex items-center justify-center mb-4">
            <Building2 className="w-8 h-8 text-slate-400" />
          </div>
          <h2 className="text-xl font-semibold text-slate-800 mb-2">No Facility Selected</h2>
          <p className="text-slate-500 mb-6 max-w-md">
            As a global admin, you need to impersonate a facility to view the SPD dashboard.
          </p>
        </div>
      </DashboardLayout>
    )
  }

  if (userLoading) {
    return (
      <DashboardLayout>
        <PageLoader message="Loading SPD dashboard..." />
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <ErrorBanner message={error} onRetry={fetchCases} onDismiss={() => setError(null)} />
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">SPD Dashboard</h1>
          <p className="text-slate-500 mt-1">Track instrument tray status for upcoming cases</p>
        </div>
        
        {/* Quick Stats */}
        <div className="flex items-center gap-6">
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{stats.confirmed}</p>
            <p className="text-xs text-slate-500 uppercase tracking-wider">Ready</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-amber-700">{stats.pending}</p>
            <p className="text-xs text-slate-500 uppercase tracking-wider">Pending</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">{stats.awaitingDelivery}</p>
            <p className="text-xs text-slate-500 uppercase tracking-wider">Awaiting</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-slate-700">{stats.totalTraysExpected}</p>
            <p className="text-xs text-slate-500 uppercase tracking-wider">Trays Expected</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between mb-4">
        {/* Date Filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">Date:</span>
          <div className="flex items-center bg-slate-100 rounded-lg p-1">
            {(['today', 'tomorrow', '3days'] as DateFilter[]).map((filter) => (
              <button
                key={filter}
                onClick={() => setDateFilter(filter)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                  dateFilter === filter
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {filter === 'today' ? 'Today' : filter === 'tomorrow' ? 'Tomorrow' : 'Next 3 Days'}
              </button>
            ))}
          </div>
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">Status:</span>
          <div className="flex items-center gap-1">
            {([
              { value: 'all', label: 'All' },
              { value: 'awaiting_response', label: 'Awaiting Response' },
              { value: 'awaiting_delivery', label: 'Awaiting Delivery' },
              { value: 'ready', label: 'Ready' },
              { value: 'no_rep_needed', label: 'No Rep' },
            ] as { value: TrayStatusFilter; label: string }[]).map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setStatusFilter(value)}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
                  statusFilter === value
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-slate-50 border-b border-slate-200">
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
          <EmptyState
            icon={
              <Box className="w-8 h-8 text-slate-400" />
            }
            title="No cases found"
            description="No cases match the selected filters."
          />
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
                  onClick={() => handleRowClick(c)}
                  className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-slate-50/50 transition-colors group relative cursor-pointer"
                >
                  {/* Hover indicator */}
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                    trayStatus === 'awaiting_response' ? 'bg-amber-500' :
                    trayStatus === 'awaiting_delivery' ? 'bg-blue-500' :
                    trayStatus === 'ready' ? 'bg-green-500' : 'bg-slate-300'
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
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
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
                      <span className="text-sm text-amber-700 font-medium">⚠️ None assigned</span>
                    ) : (
                      <div className="space-y-1">
                        {deviceCompanies.map((dc) => (
                          <div key={dc.id} className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-700">{dc.implant_companies?.name}</span>
                            {dc.tray_status === 'pending' && (
                              <span className="text-xs text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                                ⏳ Pending
                              </span>
                            )}
                            {dc.tray_status === 'consignment' && (
                              <span className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                                ✓ Consignment
                              </span>
                            )}
                            {dc.tray_status === 'loaners_confirmed' && dc.loaner_tray_count && (
                              <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                📦 {dc.loaner_tray_count} trays
                              </span>
                            )}
                            {dc.tray_status === 'delivered' && (
                              <span className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                                ✓ {dc.delivered_tray_count || dc.loaner_tray_count || ''} Delivered
                              </span>
                            )}
                            {dc.rep_notes && (
                              <span className="text-xs text-slate-400" title="Has notes">
                                💬
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
                      {/* View Details (slideout) */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRowClick(c)
                        }}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {/* Remind Rep (only for pending) */}
                      {trayStatus === 'awaiting_response' && deviceCompanies.length > 0 && (
                        <button
                          onClick={(e) => handleRemindRep(c.id, deviceCompanies[0].implant_company_id, e)}
                          className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all duration-200"
                          title="Send Reminder"
                        >
                          <Bell className="w-4 h-4" />
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
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
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

      {/* Slideout Panel */}
      <SlideoutPanel
        caseData={selectedCase}
        isOpen={slideoutOpen}
        onClose={handleSlideoutClose}
        activities={activities}
        loadingActivities={loadingActivities}
      />
    </DashboardLayout>
  )
}