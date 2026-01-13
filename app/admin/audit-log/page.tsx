// app/admin/audit-log/page.tsx
// Audit Log Viewer - HIPAA-compliant activity logging

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../lib/supabase'
import { useUser } from '../../../lib/UserContext'
import DashboardLayout from '../../../components/layouts/DashboardLayout'
import { formatAuditAction, getActionCategory } from '../../../lib/audit'

interface AuditEntry {
  id: string
  user_id: string
  user_email: string
  action: string
  facility_id: string | null
  target_type: string | null
  target_id: string | null
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  ip_address: string | null
  user_agent: string | null
  success: boolean
  error_message: string | null
  impersonating_user_id: string | null
  impersonating_user_email: string | null
  created_at: string
  facility?: { name: string } | null
}

interface Facility {
  id: string
  name: string
}

type ActionFilter = 'all' | 'auth' | 'user' | 'facility' | 'case' | 'milestone' | 'admin'

export default function AuditLogPage() {
  const router = useRouter()
  const supabase = createClient()
  const { isGlobalAdmin, loading: userLoading } = useUser()

  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)

  // Filters
  const [facilityFilter, setFacilityFilter] = useState<string>('all')
  const [actionFilter, setActionFilter] = useState<ActionFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Pagination
  const PAGE_SIZE = 50
  const [offset, setOffset] = useState(0)

  // Redirect non-admins
  useEffect(() => {
    if (!userLoading && !isGlobalAdmin) {
      router.push('/dashboard')
    }
  }, [userLoading, isGlobalAdmin, router])

  // Fetch facilities for filter
  useEffect(() => {
    async function fetchFacilities() {
      const { data } = await supabase
        .from('facilities')
        .select('id, name')
        .order('name')

      if (data) {
        setFacilities(data)
      }
    }

    if (isGlobalAdmin) {
      fetchFacilities()
    }
  }, [isGlobalAdmin, supabase])

  // Fetch audit entries
  useEffect(() => {
    if (!isGlobalAdmin) return

    async function fetchEntries() {
      setLoading(true)
      setOffset(0)

      try {
        let query = supabase
          .from('audit_log')
          .select(`
            *,
            facility:facilities(name)
          `)
          .order('created_at', { ascending: false })
          .range(0, PAGE_SIZE - 1)

        // Apply filters
        if (facilityFilter !== 'all') {
          query = query.eq('facility_id', facilityFilter)
        }

        if (actionFilter !== 'all') {
          query = query.like('action', `${actionFilter}.%`)
        }

        if (searchQuery) {
          query = query.or(`user_email.ilike.%${searchQuery}%,action.ilike.%${searchQuery}%`)
        }

        if (startDate) {
          query = query.gte('created_at', new Date(startDate).toISOString())
        }

        if (endDate) {
          const end = new Date(endDate)
          end.setHours(23, 59, 59, 999)
          query = query.lte('created_at', end.toISOString())
        }

        const { data, error } = await query

        if (error) throw error

        setEntries(data || [])
        setHasMore((data?.length || 0) === PAGE_SIZE)
        setOffset(PAGE_SIZE)
      } catch (error) {
        console.error('Error fetching audit log:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchEntries()
  }, [isGlobalAdmin, facilityFilter, actionFilter, searchQuery, startDate, endDate, supabase])

  // Load more entries
  const loadMore = async () => {
    if (loadingMore || !hasMore) return

    setLoadingMore(true)

    try {
      let query = supabase
        .from('audit_log')
        .select(`
          *,
          facility:facilities(name)
        `)
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1)

      // Apply same filters
      if (facilityFilter !== 'all') {
        query = query.eq('facility_id', facilityFilter)
      }

      if (actionFilter !== 'all') {
        query = query.like('action', `${actionFilter}.%`)
      }

      if (searchQuery) {
        query = query.or(`user_email.ilike.%${searchQuery}%,action.ilike.%${searchQuery}%`)
      }

      if (startDate) {
        query = query.gte('created_at', new Date(startDate).toISOString())
      }

      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        query = query.lte('created_at', end.toISOString())
      }

      const { data, error } = await query

      if (error) throw error

      setEntries(prev => [...prev, ...(data || [])])
      setHasMore((data?.length || 0) === PAGE_SIZE)
      setOffset(prev => prev + PAGE_SIZE)
    } catch (error) {
      console.error('Error loading more audit entries:', error)
    } finally {
      setLoadingMore(false)
    }
  }

  // Format timestamp
  const formatTimestamp = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  // Loading state
  if (userLoading || loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-slate-500">Loading audit log...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (!isGlobalAdmin) {
    return null
  }

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Audit Log</h1>
        <p className="text-slate-500 mt-1">HIPAA-compliant activity tracking for all system events</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Search */}
          <div className="relative">
            <svg className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search email or action..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
            />
          </div>

          {/* Facility Filter */}
          <select
            value={facilityFilter}
            onChange={(e) => setFacilityFilter(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
          >
            <option value="all">All Facilities</option>
            {facilities.map((facility) => (
              <option key={facility.id} value={facility.id}>
                {facility.name}
              </option>
            ))}
          </select>

          {/* Action Filter */}
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value as ActionFilter)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
          >
            <option value="all">All Actions</option>
            <option value="auth">Authentication</option>
            <option value="user">User Management</option>
            <option value="facility">Facilities</option>
            <option value="case">Cases</option>
            <option value="milestone">Milestones</option>
            <option value="admin">Admin Actions</option>
          </select>

          {/* Start Date */}
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
            placeholder="Start Date"
          />

          {/* End Date */}
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
            placeholder="End Date"
          />
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Timestamp
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  User
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Action
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Facility
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  IP Address
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-slate-500">No audit entries found</p>
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-900 whitespace-nowrap">
                        {formatTimestamp(entry.created_at)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{entry.user_email}</p>
                        {entry.impersonating_user_email && (
                          <p className="text-xs text-amber-600 mt-0.5">
                            via {entry.impersonating_user_email}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm text-slate-900">{formatAuditAction(entry.action as any)}</p>
                        <p className="text-xs text-slate-500">{getActionCategory(entry.action as any)}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-600">
                        {(entry.facility as any)?.name || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {entry.success ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                          Success
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          Failed
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-500 font-mono">
                        {entry.ip_address || '—'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Load More */}
        {hasMore && entries.length > 0 && (
          <div className="px-4 py-4 border-t border-slate-100 text-center">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="px-6 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
            >
              {loadingMore ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  Loading...
                </span>
              ) : (
                'Load More'
              )}
            </button>
          </div>
        )}
      </div>

      {/* Entry Count */}
      <div className="mt-4 text-sm text-slate-500 text-center">
        Showing {entries.length} entries
      </div>
    </DashboardLayout>
  )
}
