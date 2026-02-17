'use client'

// ============================================================================
// DEVICE REP SECTION - Shows tray status and rep notes for a case
// ============================================================================
// Used in both active case detail and completed case view
// Fetches data from case_device_companies and shows status, notes, history

import { useState, useEffect } from 'react'
import { SupabaseClient } from '@supabase/supabase-js'

// ============================================================================
// TYPES
// ============================================================================

interface DeviceCompany {
  id: string
  implant_company_id: string
  tray_status: 'pending' | 'consignment' | 'loaners_confirmed' | 'delivered'
  loaner_tray_count: number | null
  delivered_tray_count: number | null
  rep_notes: string | null
  confirmed_at: string | null
  confirmed_by: string | null
  delivered_at: string | null
  delivered_by: string | null
  companyName: string
  confirmedByName: string | null
  deliveredByName: string | null
}

interface TrayActivity {
  id: string
  activity_type: string
  message: string
  created_at: string
  users: {
    first_name: string
    last_name: string
  } | null
}

interface DeviceRepSectionProps {
  caseId: string
  supabase: SupabaseClient
  // If true, show a more compact version for completed cases
  compact?: boolean
}

// ============================================================================
// STATUS CONFIGURATION
// ============================================================================

function getStatusConfig(status: string) {
  switch (status) {
    case 'pending':
      return {
        label: 'Pending',
        icon: '⏳',
        bgColor: 'bg-amber-50',
        textColor: 'text-amber-700',
        borderColor: 'border-amber-200',
        dotColor: 'bg-amber-500',
      }
    case 'consignment':
      return {
        label: 'Consignment',
        icon: '✓',
        bgColor: 'bg-green-50',
        textColor: 'text-green-600',
        borderColor: 'border-green-200',
        dotColor: 'bg-green-500',
      }
    case 'loaners_confirmed':
      return {
        label: 'Loaners Confirmed',
        icon: '📦',
        bgColor: 'bg-blue-50',
        textColor: 'text-blue-700',
        borderColor: 'border-blue-200',
        dotColor: 'bg-blue-500',
      }
    case 'delivered':
      return {
        label: 'Delivered',
        icon: '✓',
        bgColor: 'bg-green-50',
        textColor: 'text-green-600',
        borderColor: 'border-green-200',
        dotColor: 'bg-green-500',
      }
    default:
      return {
        label: status,
        icon: '•',
        bgColor: 'bg-slate-50',
        textColor: 'text-slate-700',
        borderColor: 'border-slate-200',
        dotColor: 'bg-slate-500',
      }
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function formatDateTime(isoString: string | null): string {
  if (!isoString) return '—'
  const date = new Date(isoString)
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

function formatTimeAgo(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return `${diffDays}d ago`
}

function getActivityIcon(type: string): string {
  switch (type) {
    case 'consignment_confirmed':
      return '✓'
    case 'loaners_confirmed':
      return '📦'
    case 'trays_delivered':
      return '🚚'
    case 'status_reset':
      return '↩️'
    default:
      return '•'
  }
}

function getActivityColor(type: string): string {
  switch (type) {
    case 'consignment_confirmed':
    case 'trays_delivered':
      return 'text-green-600'
    case 'loaners_confirmed':
      return 'text-blue-600'
    case 'status_reset':
      return 'text-amber-700'
    default:
      return 'text-slate-600'
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function DeviceRepSection({ caseId, supabase, compact = false }: DeviceRepSectionProps) {
  const [deviceCompanies, setDeviceCompanies] = useState<DeviceCompany[]>([])
  const [activities, setActivities] = useState<TrayActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)

      // Fetch device companies for this case
      const { data: companies, error } = await supabase
        .from('case_device_companies')
        .select(`
          id,
          implant_company_id,
          tray_status,
          loaner_tray_count,
          delivered_tray_count,
          rep_notes,
          confirmed_at,
          confirmed_by,
          delivered_at,
          delivered_by,
          implant_companies (name),
          confirmed_by_user:users!case_device_companies_confirmed_by_fkey (first_name, last_name),
          delivered_by_user:users!case_device_companies_delivered_by_fkey (first_name, last_name)
        `)
        .eq('case_id', caseId)

      if (!error && companies) {
        // Transform Supabase response to our cleaner interface
        const transformed: DeviceCompany[] = companies.map((c: {
          id: string
          implant_company_id: string
          implant_companies: { id: string; name: string; display_name: string } | { id: string; name: string; display_name: string }[]
          device_rep_id: string | null
          device_rep_name: string | null
          was_present: boolean
          tray_count: number
          loan_status: string
          tray_delivered_at: string | null
          tray_confirmed_at: string | null
          delivered_by: string | null
          confirmed_by: string | null
          delivered_by_user: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null
          confirmed_by_user: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null
          notes: string | null
        }) => {
          // Handle nested objects - Supabase may return single object or array
          const implantCompany = Array.isArray(c.implant_companies)
            ? c.implant_companies[0]
            : c.implant_companies
          const confirmedUser = Array.isArray(c.confirmed_by_user)
            ? c.confirmed_by_user[0]
            : c.confirmed_by_user
          const deliveredUser = Array.isArray(c.delivered_by_user)
            ? c.delivered_by_user[0]
            : c.delivered_by_user

          return {
            id: c.id,
            implant_company_id: c.implant_company_id,
            tray_status: c.tray_status,
            loaner_tray_count: c.loaner_tray_count,
            delivered_tray_count: c.delivered_tray_count,
            rep_notes: c.rep_notes,
            confirmed_at: c.confirmed_at,
            confirmed_by: c.confirmed_by,
            delivered_at: c.delivered_at,
            delivered_by: c.delivered_by,
            companyName: implantCompany?.name || 'Unknown Company',
            confirmedByName: confirmedUser 
              ? `${confirmedUser.first_name} ${confirmedUser.last_name}` 
              : null,
            deliveredByName: deliveredUser 
              ? `${deliveredUser.first_name} ${deliveredUser.last_name}` 
              : null,
          }
        })
        setDeviceCompanies(transformed)
      }

      // Fetch activity history
      const { data: activityData } = await supabase
        .from('case_device_activity')
        .select(`
          id,
          activity_type,
          message,
          created_at,
          users (first_name, last_name)
        `)
        .eq('case_id', caseId)
        .order('created_at', { ascending: false })
        .limit(10)

      if (activityData) {
        // Transform activity data too
        const transformedActivities: TrayActivity[] = activityData.map((a: {
          id: string
          activity_type: string
          message: string
          created_at: string
          users: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null
        }) => {
          const user = Array.isArray(a.users) ? a.users[0] : a.users
          return {
            id: a.id,
            activity_type: a.activity_type,
            message: a.message,
            created_at: a.created_at,
            users: user || null,
          }
        })
        setActivities(transformedActivities)
      }

      setLoading(false)
    }

    fetchData()
  }, [caseId, supabase])

  // Don't render if no device companies
  if (!loading && deviceCompanies.length === 0) {
    return null
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-slate-200 rounded w-1/3 mb-3"></div>
          <div className="h-12 bg-slate-100 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <h3 className="text-sm font-semibold text-slate-900">Device Rep / Trays</h3>
          </div>
          {activities.length > 0 && !compact && (
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              {showHistory ? 'Hide History' : 'Show History'}
            </button>
          )}
        </div>
      </div>

      {/* Device Companies */}
      <div className="p-4 space-y-3">
        {deviceCompanies.map((company) => {
          const status = getStatusConfig(company.tray_status)

          return (
            <div key={company.id} className="space-y-2">
              {/* Company Header Row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-900">{company.companyName}</span>
                </div>
                <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border ${status.bgColor} ${status.borderColor}`}>
                  <span className="text-xs">{status.icon}</span>
                  <span className={`text-xs font-semibold ${status.textColor}`}>
                    {status.label}
                    {company.tray_status === 'loaners_confirmed' && company.loaner_tray_count && (
                      <span className="ml-1">({company.loaner_tray_count})</span>
                    )}
                    {company.tray_status === 'delivered' && company.delivered_tray_count && (
                      <span className="ml-1">({company.delivered_tray_count} trays)</span>
                    )}
                  </span>
                </div>
              </div>

              {/* Details Grid */}
              {!compact && (company.confirmed_at || company.delivered_at) && (
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {company.confirmed_at && (
                    <div>
                      <span className="text-slate-500">Confirmed: </span>
                      <span className="text-slate-700 font-medium">
                        {formatDateTime(company.confirmed_at)}
                      </span>
                      {company.confirmedByName && (
                        <span className="text-slate-500 ml-1">
                          by {company.confirmedByName}
                        </span>
                      )}
                    </div>
                  )}
                  {company.delivered_at && (
                    <div>
                      <span className="text-slate-500">Delivered: </span>
                      <span className="text-slate-700 font-medium">
                        {formatDateTime(company.delivered_at)}
                      </span>
                      {company.deliveredByName && (
                        <span className="text-slate-500 ml-1">
                          by {company.deliveredByName}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Rep Notes */}
              {company.rep_notes && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                  <div className="flex items-start gap-2">
                    <span className="text-blue-500 mt-0.5">💬</span>
                    <div>
                      <p className="text-xs font-medium text-blue-700 mb-0.5">Rep Notes</p>
                      <p className="text-xs text-blue-800">{company.rep_notes}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Divider between companies */}
              {deviceCompanies.length > 1 && deviceCompanies.indexOf(company) < deviceCompanies.length - 1 && (
                <div className="border-b border-slate-100 pt-2"></div>
              )}
            </div>
          )
        })}
      </div>

      {/* Activity History (expandable) */}
      {showHistory && activities.length > 0 && (
        <div className="border-t border-slate-100 bg-slate-50/30 px-4 py-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Activity History</p>
          <div className="space-y-2">
            {activities.map((activity) => (
              <div key={activity.id} className="flex items-start gap-2">
                <span className={`text-sm ${getActivityColor(activity.activity_type)}`}>
                  {getActivityIcon(activity.activity_type)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-700">{activity.message}</p>
                  <p className="text-xs text-slate-400">
                    {formatTimeAgo(activity.created_at)}
                    {activity.users && (
                      <span> • {activity.users.first_name} {activity.users.last_name}</span>
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}