// app/admin/audit-log/page.tsx
// This is the main page for the global audit log. It displays a list of all audit log entries across all facilities, with filters and pagination. Only accessible by global admins.
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import { Spinner } from '@/components/ui/Loading'
import { usePagination } from '@/hooks/usePagination'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { AlertTriangle, CheckCircle2, ChevronDown, Download, FileText, Loader2, Search, XCircle } from 'lucide-react'
import { getLocalDateString } from '@/lib/date-utils'

interface AuditLogEntry {
  id: string
  user_id: string
  user_email: string
  facility_id: string | null
  action: string
  target_type: string | null
  target_id: string | null
  target_label: string | null
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  success: boolean
  error_message: string | null
  created_at: string
  facility?: { name: string } | null
}

interface Facility {
  id: string
  name: string
}

const ACTION_CATEGORIES: Record<string, string[]> = {
  'Authentication': ['auth.login', 'auth.login_failed', 'auth.logout', 'auth.password_changed'],
  'Cases': ['case.created', 'case.updated', 'case.deleted', 'case.status_changed'],
  'Milestones': ['milestone.recorded', 'milestone.updated', 'milestone.deleted'],
  'Staff': ['case_staff.added', 'case_staff.removed'],
  'Delays': ['delay.added', 'delay.deleted'],
  'Rooms': ['room.created', 'room.updated', 'room.deleted'],
  'Procedures': ['procedure_type.created', 'procedure_type.updated', 'procedure_type.deleted'],
  'Users': ['user.created', 'user.invited', 'user.invitation_accepted', 'user.updated', 'user.deleted', 'user.deactivated', 'user.reactivated', 'user.role_changed'],
  'Facilities': ['facility.created', 'facility.updated', 'facility.deleted', 'facility.subscription_changed'],
  'Settings': ['milestone_type.created', 'milestone_type.updated', 'milestone_type.deleted', 'milestone_type.reordered'],
  'Admin': ['admin.impersonation_started', 'admin.impersonation_ended', 'admin.procedure_template_created', 'admin.procedure_template_updated', 'admin.procedure_template_deleted'],
}

const getActionColor = (action: string): string => {
  if (action.includes('login_failed') || action.includes('deleted') || action.includes('removed')) {
    return 'text-red-600 bg-red-50'
  }
  if (action.includes('created') || action.includes('added') || action.includes('login')) {
    return 'text-green-600 bg-green-50'
  }
  if (action.includes('updated') || action.includes('changed')) {
    return 'text-blue-600 bg-blue-50'
  }
  if (action.includes('admin.')) {
    return 'text-purple-600 bg-purple-50'
  }
  return 'text-slate-600 bg-slate-50'
}

const formatAction = (action: string): string => {
  return action
    .replace(/_/g, ' ')
    .replace(/\./g, ' → ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const formatTime = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export default function GlobalAuditLogPage() {
  const router = useRouter()
  const supabase = createClient()
  const { isGlobalAdmin, loading: userLoading } = useUser()

  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totalCount, setTotalCount] = useState(0)
  const [expandedLog, setExpandedLog] = useState<string | null>(null)
  
  // Pagination (for server-side API calls)
  const pagination = usePagination({
    totalItems: totalCount,
    itemsPerPage: 50,
  })

  // Filters
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [facilityFilter, setFacilityFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [successFilter, setSuccessFilter] = useState<string>('')

  // Redirect non-admins
  useEffect(() => {
    if (!userLoading && !isGlobalAdmin) {
      router.push('/dashboard')
    }
  }, [userLoading, isGlobalAdmin, router])

  const fetchFacilities = useCallback(async () => {
    const { data } = await supabase
      .from('facilities')
      .select('id, name')
      .order('name')

    if (data) {
      setFacilities(data)
    }
  }, [supabase])

  const fetchLogs = useCallback(async () => {
    setLoading(true)

    let query = supabase
      .from('audit_log')
      .select('*, facility:facilities(name)', { count: 'exact' })
      .order('created_at', { ascending: false })

    // Apply filters
    if (dateFrom) {
      query = query.gte('created_at', `${dateFrom}T00:00:00`)
    }
    if (dateTo) {
      query = query.lte('created_at', `${dateTo}T23:59:59`)
    }
    if (actionFilter) {
      query = query.eq('action', actionFilter)
    }
    if (facilityFilter) {
      query = query.eq('facility_id', facilityFilter)
    }
    if (successFilter === 'success') {
      query = query.eq('success', true)
    } else if (successFilter === 'failed') {
      query = query.eq('success', false)
    }

    // Pagination
    const from = (pagination.currentPage - 1) * pagination.itemsPerPage
    const to = from + pagination.itemsPerPage - 1
    query = query.range(from, to)

    const { data, count, error } = await query

    if (!error) {
      setLogs(data || [])
      setTotalCount(count || 0)
    }

    setLoading(false)
  }, [pagination.currentPage, pagination.itemsPerPage, dateFrom, dateTo, actionFilter, facilityFilter, successFilter, supabase])

  useEffect(() => {
    if (isGlobalAdmin) {
      fetchFacilities()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGlobalAdmin])

  useEffect(() => {
    if (isGlobalAdmin) {
      fetchLogs()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGlobalAdmin, pagination.currentPage, dateFrom, dateTo, actionFilter, facilityFilter, successFilter])

  const exportToCSV = async () => {
    // Fetch all matching logs for export (up to 10000)
    let query = supabase
      .from('audit_log')
      .select('*, facility:facilities(name)')
      .order('created_at', { ascending: false })
      .limit(10000)

    if (dateFrom) query = query.gte('created_at', `${dateFrom}T00:00:00`)
    if (dateTo) query = query.lte('created_at', `${dateTo}T23:59:59`)
    if (actionFilter) query = query.eq('action', actionFilter)
    if (facilityFilter) query = query.eq('facility_id', facilityFilter)
    if (successFilter === 'success') query = query.eq('success', true)
    else if (successFilter === 'failed') query = query.eq('success', false)

    const { data } = await query

    if (!data) return

   const headers = ['Date', 'Time', 'Facility', 'User', 'Action', 'Target', 'Old Values', 'New Values', 'Success', 'Error']
const rows = data.map((log: AuditLogEntry) => [
  formatDate(log.created_at),
  formatTime(log.created_at),
  (log.facility as { name: string } | null)?.name || 'Global',
  log.user_email,
  log.action,
  log.target_label || '',
  log.old_values ? JSON.stringify(log.old_values) : '',
  log.new_values ? JSON.stringify(log.new_values) : '',
  log.success ? 'Yes' : 'No',
  log.error_message || '',
])

const csvContent = [
  headers.join(','),
  ...rows.map((row: string[]) => row.map((cell: string) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `audit-log-global-${getLocalDateString()}.csv`
    link.click()
  }


  // Filter logs by search query (client-side)
  const filteredLogs = searchQuery
    ? logs.filter(log =>
        log.target_label?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.user_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (log.facility as { name: string } | null)?.name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : logs

  if (userLoading || (!isGlobalAdmin && !userLoading)) {
    return (
      <DashboardLayout>
        <Container className="py-8">
          <ErrorBanner message={error} onDismiss={() => setError(null)} />
          <div className="flex items-center justify-center h-64">
<Spinner size="md" />
          </div>
        </Container>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <Container className="py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-900">Global Audit Log</h1>
          <p className="text-slate-500 mt-1">View all system activity across all facilities</p>
        </div>

        {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <p className="text-sm text-slate-500">Total Entries</p>
          <p className="text-2xl font-bold text-slate-900">{totalCount.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <p className="text-sm text-slate-500">Facilities</p>
          <p className="text-2xl font-bold text-blue-600">{facilities.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <p className="text-sm text-slate-500">Failed Actions</p>
          <p className="text-2xl font-bold text-red-600">
            {logs.filter(l => !l.success).length}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <p className="text-sm text-slate-500">Page</p>
          <p className="text-2xl font-bold text-slate-600">{pagination.currentPage} / {pagination.totalPages || 1}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 shadow-sm">
        <div className="flex flex-wrap gap-4">
          {/* Date Range */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600">From:</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); pagination.reset() }}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600">To:</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); pagination.reset() }}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          {/* Facility Filter */}
          <select
            value={facilityFilter}
            onChange={(e) => { setFacilityFilter(e.target.value); pagination.reset() }}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          >
            <option value="">All Facilities</option>
            {facilities.map(facility => (
              <option key={facility.id} value={facility.id}>{facility.name}</option>
            ))}
          </select>

          {/* Action Filter */}
          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); pagination.reset() }}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          >
            <option value="">All Actions</option>
            {Object.entries(ACTION_CATEGORIES).map(([category, actions]) => (
              <optgroup key={category} label={category}>
                {actions.map(action => (
                  <option key={action} value={action}>{formatAction(action)}</option>
                ))}
              </optgroup>
            ))}
          </select>

          {/* Success Filter */}
          <select
            value={successFilter}
            onChange={(e) => { setSuccessFilter(e.target.value); pagination.reset() }}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          >
            <option value="">All Status</option>
            <option value="success">Successful Only</option>
            <option value="failed">Failed Only</option>
          </select>

          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          {/* Export Button */}
          <button
            onClick={exportToCSV}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No audit log entries found</p>
            <p className="text-slate-400 text-sm mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <>
            {/* Table Header */}
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-4 text-xs font-medium text-slate-500 uppercase tracking-wider">
              <div className="w-32">Date/Time</div>
              <div className="w-36">Facility</div>
              <div className="w-48">User</div>
              <div className="w-48">Action</div>
              <div className="flex-1">Target</div>
              <div className="w-16">Status</div>
              <div className="w-8"></div>
            </div>

            <div className="divide-y divide-slate-100">
              {filteredLogs.map((log) => (
                <div key={log.id} className="hover:bg-slate-50 transition-colors">
                  <div
                    className="px-4 py-3 flex items-center gap-4 cursor-pointer"
                    onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                  >
                    {/* Timestamp */}
                    <div className="w-32 flex-shrink-0">
                      <p className="text-sm font-medium text-slate-900">{formatDate(log.created_at)}</p>
                      <p className="text-xs text-slate-500">{formatTime(log.created_at)}</p>
                    </div>

                    {/* Facility */}
                    <div className="w-36 flex-shrink-0">
                      <p className="text-sm text-slate-600 truncate">
                        {(log.facility as { name: string } | null)?.name || <span className="text-slate-400 italic">Global</span>}
                      </p>
                    </div>

                    {/* User */}
                    <div className="w-48 flex-shrink-0">
                      <p className="text-sm text-slate-700 truncate">{log.user_email}</p>
                    </div>

                    {/* Action Badge */}
                    <div className="w-48 flex-shrink-0">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${getActionColor(log.action)}`}>
                        {formatAction(log.action)}
                      </span>
                    </div>

                    {/* Target */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-600 truncate">
                        {log.target_label || '—'}
                      </p>
                    </div>

                    {/* Success/Fail */}
                    <div className="w-16 flex-shrink-0">
                      {log.success ? (
                        <span className="inline-flex items-center text-green-600">
                          <CheckCircle2 className="w-4 h-4" />
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-red-600">
                          <XCircle className="w-4 h-4" />
                        </span>
                      )}
                    </div>

                    {/* Expand Arrow */}
                    <div className="w-8 flex-shrink-0">
                      <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${expandedLog === log.id ? 'rotate-180' : ''}`} />
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {expandedLog === log.id && (
                    <div className="px-4 pb-4 pt-0 bg-slate-50">
                      <div className="grid grid-cols-2 gap-4 p-4 bg-white rounded-lg border border-slate-200">
                        <div>
                          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">User ID</p>
                          <p className="text-sm text-slate-700 font-mono">{log.user_id}</p>
                        </div>
                        {log.target_type && (
                          <div>
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Target Type</p>
                            <p className="text-sm text-slate-700">{log.target_type}</p>
                          </div>
                        )}
                        {log.target_id && (
                          <div>
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Target ID</p>
                            <p className="text-sm text-slate-700 font-mono text-xs">{log.target_id}</p>
                          </div>
                        )}
                        {log.facility_id && (
                          <div>
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Facility ID</p>
                            <p className="text-sm text-slate-700 font-mono text-xs">{log.facility_id}</p>
                          </div>
                        )}
                        {log.old_values && Object.keys(log.old_values).length > 0 && (
                          <div className="col-span-2">
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Previous Values</p>
                            <pre className="text-xs text-slate-600 bg-slate-50 p-2 rounded overflow-x-auto">
                              {JSON.stringify(log.old_values, null, 2)}
                            </pre>
                          </div>
                        )}
                        {log.new_values && Object.keys(log.new_values).length > 0 && (
                          <div className="col-span-2">
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">New Values</p>
                            <pre className="text-xs text-slate-600 bg-slate-50 p-2 rounded overflow-x-auto">
                              {JSON.stringify(log.new_values, null, 2)}
                            </pre>
                          </div>
                        )}
                        {log.metadata && Object.keys(log.metadata).length > 0 && (
                          <div className="col-span-2">
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Metadata</p>
                            <pre className="text-xs text-slate-600 bg-slate-50 p-2 rounded overflow-x-auto">
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          </div>
                        )}
                        {log.error_message && (
                          <div className="col-span-2">
                            <p className="text-xs font-medium text-red-600 uppercase tracking-wider mb-1">Error Message</p>
                            <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{log.error_message}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-slate-500">
            Showing {((pagination.currentPage - 1) * pagination.itemsPerPage) + 1} - {Math.min(pagination.currentPage * pagination.itemsPerPage, totalCount)} of {totalCount.toLocaleString()}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => pagination.goToPage(1)}
              disabled={!pagination.canGoPrev}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              First
            </button>
            <button
              onClick={pagination.prevPage}
              disabled={!pagination.canGoPrev}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="px-3 py-1.5 text-sm text-slate-600">
              Page {pagination.currentPage} of {pagination.totalPages}
            </span>
            <button
              onClick={pagination.nextPage}
              disabled={!pagination.canGoNext}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
            <button
              onClick={() => pagination.goToPage(pagination.totalPages)}
              disabled={!pagination.canGoNext}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Last
            </button>
          </div>
        </div>
      )}

      {/* HIPAA Notice */}
      <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">HIPAA Compliance Notice</p>
            <p className="text-sm text-amber-700 mt-0.5">
              Audit logs are retained for a minimum of 6 years per HIPAA requirements (45 CFR § 164.530(j)). 
              These logs are immutable and cannot be modified or deleted. Regular review of audit logs is required 
              to maintain compliance.
            </p>
          </div>
        </div>
      </div>
            </Container>
    </DashboardLayout>
  )
}