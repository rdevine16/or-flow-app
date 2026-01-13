'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '../../../lib/supabase'
import { useUser } from '../../../lib/UserContext'
import DashboardLayout from '../../../components/layouts/DashboardLayout'

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
  'Admin': ['admin.impersonation_started', 'admin.impersonation_ended', 'admin.default_procedure_created', 'admin.default_procedure_updated', 'admin.default_procedure_deleted'],
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
  const [totalCount, setTotalCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [expandedLog, setExpandedLog] = useState<string | null>(null)
  const pageSize = 50

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

  useEffect(() => {
    if (isGlobalAdmin) {
      fetchFacilities()
    }
  }, [isGlobalAdmin])

  useEffect(() => {
    if (isGlobalAdmin) {
      fetchLogs()
    }
  }, [isGlobalAdmin, currentPage, dateFrom, dateTo, actionFilter, facilityFilter, successFilter])

  const fetchFacilities = async () => {
    const { data } = await supabase
      .from('facilities')
      .select('id, name')
      .order('name')

    if (data) {
      setFacilities(data)
    }
  }

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
    const from = (currentPage - 1) * pageSize
    const to = from + pageSize - 1
    query = query.range(from, to)

    const { data, count, error } = await query

    if (!error) {
      setLogs(data || [])
      setTotalCount(count || 0)
    }

    setLoading(false)
  }, [currentPage, dateFrom, dateTo, actionFilter, facilityFilter, successFilter, supabase])

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
    link.download = `audit-log-global-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  const totalPages = Math.ceil(totalCount / pageSize)

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
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-2">
          <Link
            href="/admin"
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Global Audit Log</h1>
            <p className="text-slate-500">View all system activity across all facilities</p>
          </div>
        </div>
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
          <p className="text-2xl font-bold text-slate-600">{currentPage} / {totalPages || 1}</p>
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
              onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1) }}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600">To:</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1) }}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          {/* Facility Filter */}
          <select
            value={facilityFilter}
            onChange={(e) => { setFacilityFilter(e.target.value); setCurrentPage(1) }}
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
            onChange={(e) => { setActionFilter(e.target.value); setCurrentPage(1) }}
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
            onChange={(e) => { setSuccessFilter(e.target.value); setCurrentPage(1) }}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          >
            <option value="">All Status</option>
            <option value="success">Successful Only</option>
            <option value="failed">Failed Only</option>
          </select>

          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
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
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <svg className="animate-spin h-8 w-8 text-blue-500" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
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
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-red-600">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                        </span>
                      )}
                    </div>

                    {/* Expand Arrow */}
                    <div className="w-8 flex-shrink-0">
                      <svg
                        className={`w-5 h-5 text-slate-400 transition-transform ${expandedLog === log.id ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
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
                            <p className="text-xs font-medium text-red-500 uppercase tracking-wider mb-1">Error Message</p>
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
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-slate-500">
            Showing {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, totalCount)} of {totalCount.toLocaleString()}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              First
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="px-3 py-1.5 text-sm text-slate-600">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
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
          <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
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
    </DashboardLayout>
  )
}
