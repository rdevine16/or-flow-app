'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '../../../lib/supabase'
import DashboardLayout from '../../../components/layouts/DashboardLayout'
import { formatAuditAction, getActionCategory } from '../../../lib/audit'

interface AuditEntry {
  id: string
  user_id: string
  user_email: string
  user_name: string | null
  facility_id: string | null
  facility_name: string | null
  action: string
  target_type: string | null
  target_id: string | null
  target_label: string | null
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  success: boolean
  error_message: string | null
  ip_address: string | null
  user_agent: string | null
  impersonating_user_id: string | null
  impersonating_user_email: string | null
  impersonator_name: string | null
  created_at: string
}

interface FilterState {
  search: string
  category: string
  action: string
  userId: string
  dateFrom: string
  dateTo: string
  success: 'all' | 'success' | 'failed'
}

const CATEGORIES = [
  { value: '', label: 'All Categories' },
  { value: 'auth', label: 'Authentication' },
  { value: 'user', label: 'User Management' },
  { value: 'facility', label: 'Facility' },
  { value: 'case', label: 'Cases' },
  { value: 'milestone', label: 'Milestones' },
  { value: 'case_staff', label: 'Staff Assignments' },
  { value: 'delay', label: 'Delays' },
  { value: 'room', label: 'Rooms' },
  { value: 'procedure_type', label: 'Procedures' },
  { value: 'admin', label: 'Admin Actions' },
]

const PAGE_SIZE = 50

export default function AuditLogPage() {
  const supabase = createClient()
  
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(0)
  const [users, setUsers] = useState<{ id: string; name: string; email: string }[]>([])
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    category: '',
    action: '',
    userId: '',
    dateFrom: '',
    dateTo: '',
    success: 'all',
  })

  // Fetch users for filter dropdown
  useEffect(() => {
    async function fetchUsers() {
      const { data } = await supabase
        .from('users')
        .select('id, first_name, last_name, email')
        .order('first_name')
      
      if (data) {
        setUsers(data.map(u => ({
          id: u.id,
          name: `${u.first_name} ${u.last_name}`.trim(),
          email: u.email,
        })))
      }
    }
    fetchUsers()
  }, [supabase])

  // Fetch audit entries
  const fetchEntries = useCallback(async () => {
    setLoading(true)
    
    let query = supabase
      .from('audit_log_with_users')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    // Apply filters
    if (filters.category) {
      query = query.like('action', `${filters.category}.%`)
    }
    
    if (filters.action) {
      query = query.eq('action', filters.action)
    }
    
    if (filters.userId) {
      query = query.eq('user_id', filters.userId)
    }
    
    if (filters.dateFrom) {
      query = query.gte('created_at', `${filters.dateFrom}T00:00:00`)
    }
    
    if (filters.dateTo) {
      query = query.lte('created_at', `${filters.dateTo}T23:59:59`)
    }
    
    if (filters.success === 'success') {
      query = query.eq('success', true)
    } else if (filters.success === 'failed') {
      query = query.eq('success', false)
    }
    
    if (filters.search) {
      query = query.or(`user_email.ilike.%${filters.search}%,target_label.ilike.%${filters.search}%,action.ilike.%${filters.search}%`)
    }

    const { data, count, error } = await query

    if (error) {
      console.error('Error fetching audit log:', error)
    } else {
      setEntries(data || [])
      setTotalCount(count || 0)
    }
    
    setLoading(false)
  }, [supabase, page, filters])

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  // Reset page when filters change
  useEffect(() => {
    setPage(0)
  }, [filters])

  // Export to CSV
  const handleExport = async () => {
    setExporting(true)
    
    try {
      let query = supabase
        .from('audit_log_with_users')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10000) // Max export

      // Apply same filters
      if (filters.category) query = query.like('action', `${filters.category}.%`)
      if (filters.userId) query = query.eq('user_id', filters.userId)
      if (filters.dateFrom) query = query.gte('created_at', `${filters.dateFrom}T00:00:00`)
      if (filters.dateTo) query = query.lte('created_at', `${filters.dateTo}T23:59:59`)
      if (filters.success === 'success') query = query.eq('success', true)
      else if (filters.success === 'failed') query = query.eq('success', false)

      const { data } = await query

      if (data && data.length > 0) {
        const csv = [
          ['Timestamp', 'User', 'Email', 'Action', 'Target', 'Success', 'IP Address'].join(','),
          ...data.map(e => [
            new Date(e.created_at).toISOString(),
            `"${e.user_name || ''}"`,
            e.user_email,
            e.action,
            `"${e.target_label || ''}"`,
            e.success ? 'Yes' : 'No',
            e.ip_address || '',
          ].join(','))
        ].join('\n')

        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (err) {
      console.error('Export error:', err)
    } finally {
      setExporting(false)
    }
  }

  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    let relative = ''
    if (diffMins < 1) relative = 'Just now'
    else if (diffMins < 60) relative = `${diffMins}m ago`
    else if (diffHours < 24) relative = `${diffHours}h ago`
    else if (diffDays < 7) relative = `${diffDays}d ago`
    else relative = date.toLocaleDateString()

    return {
      relative,
      full: date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    }
  }

  // Get action icon and color
  const getActionStyle = (action: string, success: boolean) => {
    if (!success) {
      return { bg: 'bg-red-100', text: 'text-red-700', icon: '✕' }
    }
    
    const category = action.split('.')[0]
    const styles: Record<string, { bg: string; text: string; icon: string }> = {
      auth: { bg: 'bg-blue-100', text: 'text-blue-700', icon: '🔐' },
      user: { bg: 'bg-purple-100', text: 'text-purple-700', icon: '👤' },
      facility: { bg: 'bg-indigo-100', text: 'text-indigo-700', icon: '🏥' },
      case: { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: '📋' },
      milestone: { bg: 'bg-teal-100', text: 'text-teal-700', icon: '⏱️' },
      case_staff: { bg: 'bg-cyan-100', text: 'text-cyan-700', icon: '👥' },
      delay: { bg: 'bg-amber-100', text: 'text-amber-700', icon: '⚠️' },
      room: { bg: 'bg-orange-100', text: 'text-orange-700', icon: '🚪' },
      procedure_type: { bg: 'bg-pink-100', text: 'text-pink-700', icon: '🔧' },
      admin: { bg: 'bg-slate-100', text: 'text-slate-700', icon: '⚙️' },
    }
    return styles[category] || { bg: 'bg-slate-100', text: 'text-slate-700', icon: '•' }
  }

  // Render change details
  const renderChanges = (entry: AuditEntry) => {
    const hasOld = entry.old_values && Object.keys(entry.old_values).length > 0
    const hasNew = entry.new_values && Object.keys(entry.new_values).length > 0
    
    if (!hasOld && !hasNew) return null

    return (
      <div className="mt-3 pt-3 border-t border-slate-100">
        <p className="text-xs font-medium text-slate-500 mb-2">Changes</p>
        <div className="grid grid-cols-2 gap-4 text-xs">
          {hasOld && (
            <div>
              <p className="text-slate-400 mb-1">Before</p>
              <pre className="bg-red-50 text-red-800 p-2 rounded-lg overflow-x-auto">
                {JSON.stringify(entry.old_values, null, 2)}
              </pre>
            </div>
          )}
          {hasNew && (
            <div>
              <p className="text-slate-400 mb-1">After</p>
              <pre className="bg-emerald-50 text-emerald-800 p-2 rounded-lg overflow-x-auto">
                {JSON.stringify(entry.new_values, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    )
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Audit Log</h1>
            <p className="text-slate-500 mt-1">Track all system activity and changes</p>
          </div>
          <button
            onClick={handleExport}
            disabled={exporting || entries.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {exporting ? (
              <>
                <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                Exporting...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export CSV
              </>
            )}
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Events</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{totalCount.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Today</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {entries.filter(e => new Date(e.created_at).toDateString() === new Date().toDateString()).length}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">This Week</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {entries.filter(e => {
                const d = new Date(e.created_at)
                const weekAgo = new Date()
                weekAgo.setDate(weekAgo.getDate() - 7)
                return d > weekAgo
              }).length}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Failed Actions</p>
            <p className="text-2xl font-bold text-red-600 mt-1">
              {entries.filter(e => !e.success).length}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div className="lg:col-span-2">
              <label className="block text-xs font-medium text-slate-500 mb-1">Search</label>
              <div className="relative">
                <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search by email, action, or target..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Category</label>
              <select
                value={filters.category}
                onChange={(e) => setFilters({ ...filters, category: e.target.value, action: '' })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>

            {/* User */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">User</label>
              <select
                value={filters.userId}
                onChange={(e) => setFilters({ ...filters, userId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="">All Users</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>{user.name || user.email}</option>
                ))}
              </select>
            </div>

            {/* Date From */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">From Date</label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            {/* Date To */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">To Date</label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
              <select
                value={filters.success}
                onChange={(e) => setFilters({ ...filters, success: e.target.value as FilterState['success'] })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="all">All</option>
                <option value="success">Successful</option>
                <option value="failed">Failed</option>
              </select>
            </div>

            {/* Clear Filters */}
            <div className="flex items-end">
              <button
                onClick={() => setFilters({
                  search: '',
                  category: '',
                  action: '',
                  userId: '',
                  dateFrom: '',
                  dateTo: '',
                  success: 'all',
                })}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-sm text-slate-500">Loading audit log...</p>
            </div>
          ) : entries.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-slate-600 font-medium">No audit entries found</p>
              <p className="text-sm text-slate-400 mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            <>
              {/* Entries List */}
              <div className="divide-y divide-slate-100">
                {entries.map((entry) => {
                  const timestamp = formatTimestamp(entry.created_at)
                  const style = getActionStyle(entry.action, entry.success)
                  const isExpanded = expandedEntry === entry.id
                  
                  return (
                    <div
                      key={entry.id}
                      className={`p-4 hover:bg-slate-50 transition-colors cursor-pointer ${isExpanded ? 'bg-slate-50' : ''}`}
                      onClick={() => setExpandedEntry(isExpanded ? null : entry.id)}
                    >
                      <div className="flex items-start gap-4">
                        {/* Icon */}
                        <div className={`w-10 h-10 rounded-xl ${style.bg} flex items-center justify-center flex-shrink-0`}>
                          <span className="text-lg">{style.icon}</span>
                        </div>
                        
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              {/* Action */}
                              <p className="font-medium text-slate-900">
                                {formatAuditAction(entry.action as any)}
                              </p>
                              
                              {/* Target */}
                              {entry.target_label && (
                                <p className="text-sm text-slate-600 mt-0.5">
                                  {entry.target_label}
                                </p>
                              )}
                              
                              {/* User */}
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-sm text-slate-500">
                                  by {entry.user_name || entry.user_email}
                                </span>
                                {entry.impersonating_user_id && (
                                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                                    via {entry.impersonator_name || entry.impersonating_user_email}
                                  </span>
                                )}
                                {!entry.success && (
                                  <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                                    Failed
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            {/* Timestamp */}
                            <div className="text-right flex-shrink-0">
                              <p className="text-sm font-medium text-slate-600">{timestamp.relative}</p>
                              <p className="text-xs text-slate-400">{timestamp.full}</p>
                            </div>
                          </div>
                          
                          {/* Expanded Details */}
                          {isExpanded && (
                            <div className="mt-4 pt-4 border-t border-slate-200">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                  <p className="text-xs font-medium text-slate-400 uppercase">Action Code</p>
                                  <p className="font-mono text-slate-700 mt-1">{entry.action}</p>
                                </div>
                                <div>
                                  <p className="text-xs font-medium text-slate-400 uppercase">Category</p>
                                  <p className="text-slate-700 mt-1">{getActionCategory(entry.action as any)}</p>
                                </div>
                                <div>
                                  <p className="text-xs font-medium text-slate-400 uppercase">IP Address</p>
                                  <p className="font-mono text-slate-700 mt-1">{entry.ip_address || '—'}</p>
                                </div>
                                <div>
                                  <p className="text-xs font-medium text-slate-400 uppercase">Entry ID</p>
                                  <p className="font-mono text-xs text-slate-500 mt-1 truncate">{entry.id}</p>
                                </div>
                              </div>
                              
                              {/* Error Message */}
                              {entry.error_message && (
                                <div className="mt-3 p-3 bg-red-50 rounded-lg">
                                  <p className="text-xs font-medium text-red-800">Error Message</p>
                                  <p className="text-sm text-red-700 mt-1">{entry.error_message}</p>
                                </div>
                              )}
                              
                              {/* Changes */}
                              {renderChanges(entry)}
                              
                              {/* Metadata */}
                              {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                                <div className="mt-3 pt-3 border-t border-slate-100">
                                  <p className="text-xs font-medium text-slate-500 mb-2">Additional Info</p>
                                  <pre className="bg-slate-100 text-slate-700 p-2 rounded-lg text-xs overflow-x-auto">
                                    {JSON.stringify(entry.metadata, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        
                        {/* Expand Icon */}
                        <svg 
                          className={`w-5 h-5 text-slate-400 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  )
                })}
              </div>
              
              {/* Pagination */}
              <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between">
                <p className="text-sm text-slate-500">
                  Showing {page * PAGE_SIZE + 1} to {Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount.toLocaleString()} entries
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(Math.max(0, page - 1))}
                    disabled={page === 0}
                    className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-slate-600">
                    Page {page + 1} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                    disabled={page >= totalPages - 1}
                    className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* HIPAA Notice */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-blue-900">HIPAA Compliance</p>
              <p className="text-sm text-blue-700 mt-1">
                Audit logs are retained for 6 years per HIPAA requirements. Logs cannot be modified or deleted. 
                All access to this page is also logged.
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
