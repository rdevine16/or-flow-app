// app/admin/facilities/page.tsx
// Admin Facilities List - View and manage all facilities

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '../../../lib/supabase'
import { useUser } from '../../../lib/UserContext'
import DashboardLayout from '../../../components/layouts/DashboardLayout'
import { startImpersonation } from '../../../lib/impersonation'
import { adminAudit } from '../../../lib/audit-logger'
import DeleteFacilityModal from '../../../components/modals/DeleteFacilityModal'

interface Facility {
  id: string
  name: string
  address: string | null
  subscription_status: string
  trial_ends_at: string | null
  is_demo: boolean
  created_at: string
  user_count: number
  case_count: number
}

type StatusFilter = 'all' | 'active' | 'trial' | 'past_due' | 'disabled' | 'demo'

export default function FacilitiesListPage() {
  const router = useRouter()
  const supabase = createClient()
  const { userData, isGlobalAdmin, loading: userLoading, refreshImpersonation } = useUser()

  const [facilities, setFacilities] = useState<Facility[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  
  // Delete modal state
  const [facilityToDelete, setFacilityToDelete] = useState<Facility | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Redirect non-admins
  useEffect(() => {
    if (!userLoading && !isGlobalAdmin) {
      router.push('/dashboard')
    }
  }, [userLoading, isGlobalAdmin, router])

  // Fetch facilities
  const fetchFacilities = async () => {
    setLoading(true)

    try {
      // Fetch all facilities
      const { data: facilitiesData, error } = await supabase
        .from('facilities')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      // Fetch user counts per facility
      const { data: userCounts } = await supabase
        .from('users')
        .select('facility_id')

      // Fetch case counts (last 30 days)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const { data: caseCounts } = await supabase
        .from('cases')
        .select('facility_id, created_at')
        .gte('created_at', thirtyDaysAgo.toISOString())

      // Combine data
      const facilitiesWithCounts = (facilitiesData || []).map(facility => {
        const userCount = (userCounts || []).filter(u => u.facility_id === facility.id).length
        const caseCount = (caseCounts || []).filter(c => c.facility_id === facility.id).length

        return {
          ...facility,
          user_count: userCount,
          case_count: caseCount,
        }
      })

      setFacilities(facilitiesWithCounts)
    } catch (error) {
      console.error('Error fetching facilities:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isGlobalAdmin) return
    fetchFacilities()
  }, [isGlobalAdmin, supabase])

  // Handle impersonation
  const handleImpersonate = async (facility: Facility) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const result = await startImpersonation(
      supabase,
      user.id,
      facility.id,
      facility.name
    )

    if (result.success) {
      // Log the action
      await adminAudit.impersonationStarted(supabase, facility.name, facility.id)

      // Update the context immediately so all pages pick up the new facility
      refreshImpersonation()

      // Redirect to dashboard with the impersonated facility
      router.push('/dashboard')
      router.refresh()
    }
  }

  // Handle delete button click
  const handleDeleteClick = (facility: Facility) => {
    setFacilityToDelete(facility)
  }

  // Handle successful deletion
  const handleDeleteSuccess = () => {
    const deletedName = facilityToDelete?.name
    setFacilityToDelete(null)
    // Show success message
    setSuccessMessage(`"${deletedName}" has been permanently deleted`)
    // Auto-hide after 5 seconds
    setTimeout(() => setSuccessMessage(null), 5000)
    // Refresh the list
    fetchFacilities()
  }

  // Filter facilities
  const filteredFacilities = facilities.filter(facility => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      if (!facility.name.toLowerCase().includes(query) &&
          !facility.address?.toLowerCase().includes(query)) {
        return false
      }
    }

    // Status filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'demo') {
        return facility.is_demo
      }
      return facility.subscription_status === statusFilter
    }

    return true
  })

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  // Get days until trial ends
  const getDaysUntilTrialEnds = (trialEndsAt: string | null) => {
    if (!trialEndsAt) return null
    const now = new Date()
    const endDate = new Date(trialEndsAt)
    const diffMs = endDate.getTime() - now.getTime()
    const diffDays = Math.ceil(diffMs / 86400000)
    return diffDays
  }

  // Status badge component
  const StatusBadge = ({ status, isDemo }: { status: string; isDemo: boolean }) => {
    if (isDemo) {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
          Demo
        </span>
      )
    }

    const styles: Record<string, string> = {
      active: 'bg-emerald-100 text-emerald-800',
      trial: 'bg-blue-100 text-blue-800',
      past_due: 'bg-red-100 text-red-800',
      cancelled: 'bg-slate-100 text-slate-800',
      disabled: 'bg-slate-100 text-slate-600',
    }

    const labels: Record<string, string> = {
      active: 'Active',
      trial: 'Trial',
      past_due: 'Past Due',
      cancelled: 'Cancelled',
      disabled: 'Disabled',
    }

    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${styles[status] || styles.disabled}`}>
        {labels[status] || status}
      </span>
    )
  }

  // Loading state
  if (userLoading || loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-slate-500">Loading facilities...</p>
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Facilities</h1>
          <p className="text-slate-500 mt-1">Manage all customer facilities</p>
        </div>
        <Link
          href="/admin/facilities/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors shadow-lg shadow-blue-600/25"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Facility
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <svg className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search facilities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          {/* Status Filter */}
          <div className="flex gap-2 flex-wrap">
            {(['all', 'active', 'trial', 'past_due', 'disabled', 'demo'] as StatusFilter[]).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  statusFilter === status
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {status === 'all' ? 'All' :
                 status === 'past_due' ? 'Past Due' :
                 status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Facilities Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Facility
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Trial Ends
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Users
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Cases (30d)
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredFacilities.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    <p className="text-slate-500">No facilities found</p>
                  </td>
                </tr>
              ) : (
                filteredFacilities.map((facility) => {
                  const daysUntilEnd = getDaysUntilTrialEnds(facility.trial_ends_at)

                  return (
                    <tr key={facility.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-semibold text-slate-900">{facility.name}</p>
                          {facility.address && (
                            <p className="text-sm text-slate-500 mt-0.5">{facility.address}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={facility.subscription_status} isDemo={facility.is_demo} />
                      </td>
                      <td className="px-6 py-4">
                        {facility.subscription_status === 'trial' && facility.trial_ends_at ? (
                          <div>
                            <p className="text-sm text-slate-900">{formatDate(facility.trial_ends_at)}</p>
                            {daysUntilEnd !== null && (
                              <p className={`text-xs mt-0.5 ${
                                daysUntilEnd <= 3 ? 'text-red-600 font-medium' :
                                daysUntilEnd <= 7 ? 'text-amber-600' :
                                'text-slate-500'
                              }`}>
                                {daysUntilEnd <= 0 ? 'Expired' : `${daysUntilEnd} days left`}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="font-medium text-slate-900">{facility.user_count}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="font-medium text-slate-900">{facility.case_count}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-600">{formatDate(facility.created_at)}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/admin/facilities/${facility.id}`}
                            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            title="View details"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </Link>
                          <button
                            onClick={() => handleImpersonate(facility)}
                            className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                            title="View as this facility"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteClick(facility)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete facility"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Footer */}
      <div className="mt-4 text-sm text-slate-500 text-center">
        Showing {filteredFacilities.length} of {facilities.length} facilities
      </div>

      {/* Success Toast */}
      {successMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 text-emerald-800 px-5 py-4 rounded-xl shadow-lg">
            <div className="flex-shrink-0 w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="font-medium">{successMessage}</p>
            <button
              onClick={() => setSuccessMessage(null)}
              className="ml-2 text-emerald-600 hover:text-emerald-800"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {facilityToDelete && (
        <DeleteFacilityModal
          facility={facilityToDelete}
          onClose={() => setFacilityToDelete(null)}
          onDeleted={handleDeleteSuccess}
        />
      )}
    </DashboardLayout>
  )
}