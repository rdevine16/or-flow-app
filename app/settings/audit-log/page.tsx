// app/settings/audit-log/page.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import SettingsLayout from '@/components/settings/SettingsLayout'
import { PageLoader } from '@/components/ui/Loading'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { ChevronDown, Download, FileText, Info, Loader2, Search } from 'lucide-react'

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
  'Settings': ['milestone_type.created', 'milestone_type.updated', 'milestone_type.deleted', 'milestone_type.reordered'],
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

export default function AuditLogPage() {
  const supabase = createClient()
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totalCount, setTotalCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [expandedLog, setExpandedLog] = useState<string | null>(null)
  const pageSize = 25

  // Filters
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [userFilter, setUserFilter] = useState('')

  // Available users for filter
  const [users, setUsers] = useState<{ id: string; email: string; name: string }[]>([])

  useEffect(() => {
    fetchUsers()
  }, [])

  useEffect(() => {
    fetchLogs()
  }, [currentPage, dateFrom, dateTo, actionFilter, userFilter])

  const fetchUsers = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: userData } = await supabase
      .from('users')
      .select('facility_id')
      .eq('id', user.id)
      .single()

    if (userData?.facility_id) {
      const { data } = await supabase
        .from('users')
        .select('id, email, first_name, last_name')
        .eq('facility_id', userData.facility_id)
        .order('last_name')

      if (data) {
        setUsers(data.map(u => ({
          id: u.id,
          email: u.email,
          name: `${u.first_name} ${u.last_name}`,
        })))
      }
    }
  }

  const fetchLogs = useCallback(async () => {
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: userData } = await supabase
      .from('users')
      .select('facility_id')
      .eq('id', user.id)
      .single()

    if (!userData?.facility_id) {
      setLoading(false)
      return
    }

    let query = supabase
      .from('audit_log')
      .select('*', { count: 'exact' })
      .eq('facility_id', userData.facility_id)
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
    if (userFilter) {
      query = query.eq('user_id', userFilter)
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
  }, [currentPage, dateFrom, dateTo, actionFilter, userFilter, supabase])

  const exportToCSV = () => {
    const headers = ['Date', 'Time', 'User', 'Action', 'Target', 'Details', 'Success']
    const rows = logs.map(log => [
      formatDate(log.created_at),
      formatTime(log.created_at),
      log.user_email,
      log.action,
      log.target_label || '',
      log.new_values ? JSON.stringify(log.new_values) : '',
      log.success ? 'Yes' : 'No',
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  const totalPages = Math.ceil(totalCount / pageSize)

  // Filter logs by search query (client-side for target_label)
  const filteredLogs = searchQuery
    ? logs.filter(log =>
        log.target_label?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.user_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.action.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : logs

  return (
    <DashboardLayout>
      <Container className="py-8">
          <ErrorBanner message={error} onDismiss={() => setError(null)} />
        <SettingsLayout
          title="Audit Log"
          description="View a history of all actions taken in the system."
        >
          {/* Filters */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 shadow-sm">
            <div className="flex flex-wrap gap-4">
              {/* Date Range */}
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-600">From:</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-600">To:</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

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

              {/* User Filter */}
              <select
                value={userFilter}
                onChange={(e) => { setUserFilter(e.target.value); setCurrentPage(1) }}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="">All Users</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>{user.name}</option>
                ))}
              </select>

              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search targets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              {/* Export Button */}
              <button
                onClick={exportToCSV}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            </div>
          </div>

          {/* Results Count */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-slate-500">
              {totalCount} total entries
              {searchQuery && ` (showing ${filteredLogs.length} matching "${searchQuery}")`}
            </p>
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

                      {/* Success/Fail indicator */}
                      {!log.success && (
                        <span className="px-2 py-0.5 bg-red-100 text-red-600 text-xs rounded">Failed</span>
                      )}

                      {/* Expand Arrow */}
                      <ChevronDown
                        className={`w-5 h-5 text-slate-400 transition-transform ${expandedLog === log.id ? 'rotate-180' : ''}`}
                      />
                    </div>

                    {/* Expanded Details */}
                    {expandedLog === log.id && (
                      <div className="px-4 pb-4 pt-0">
                        <div className="ml-32 pl-4 border-l-2 border-slate-200 space-y-3">
                          {log.target_type && (
                            <div>
                              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Target Type</p>
                              <p className="text-sm text-slate-700">{log.target_type}</p>
                            </div>
                          )}
                          {log.target_id && (
                            <div>
                              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Target ID</p>
                              <p className="text-sm text-slate-700 font-mono text-xs">{log.target_id}</p>
                            </div>
                          )}
                          {log.old_values && Object.keys(log.old_values).length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Previous Values</p>
                              <pre className="text-xs text-slate-600 bg-slate-50 p-2 rounded mt-1 overflow-x-auto">
                                {JSON.stringify(log.old_values, null, 2)}
                              </pre>
                            </div>
                          )}
                          {log.new_values && Object.keys(log.new_values).length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">New Values</p>
                              <pre className="text-xs text-slate-600 bg-slate-50 p-2 rounded mt-1 overflow-x-auto">
                                {JSON.stringify(log.new_values, null, 2)}
                              </pre>
                            </div>
                          )}
                          {log.metadata && Object.keys(log.metadata).length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Metadata</p>
                              <pre className="text-xs text-slate-600 bg-slate-50 p-2 rounded mt-1 overflow-x-auto">
                                {JSON.stringify(log.metadata, null, 2)}
                              </pre>
                            </div>
                          )}
                          {log.error_message && (
                            <div>
                              <p className="text-xs font-medium text-red-600 uppercase tracking-wider">Error</p>
                              <p className="text-sm text-red-600">{log.error_message}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-slate-500">
                Page {currentPage} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {/* HIPAA Notice */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-800">Compliance Notice</p>
                <p className="text-sm text-blue-700 mt-0.5">
                  Audit logs are retained for 6 years per HIPAA requirements. These logs are read-only and cannot be modified or deleted.
                </p>
              </div>
            </div>
          </div>
        </SettingsLayout>
      </Container>
    </DashboardLayout>
  )
}