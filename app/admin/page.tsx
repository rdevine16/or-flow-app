// app/admin/page.tsx
// Admin Dashboard - Overview with metrics and recent activity

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import { formatAuditAction } from '@/lib/audit'
import { useToast } from '@/components/ui/Toast/ToastProvider'

interface FacilityMetrics {
  total: number
  active: number
  trial: number
  pastDue: number
  disabled: number
}

interface UserMetrics {
  total: number
}

interface CaseMetrics {
  thisMonth: number
}

interface AuditEntry {
  id: string
  user_email: string
  action: string
  facility_id: string | null
  target_type: string | null
  created_at: string
  success: boolean
  facility?: { name: string } | null
}

export default function AdminDashboardPage() {
  const router = useRouter()
  const supabase = createClient()
  const { isGlobalAdmin, loading: userLoading } = useUser()
const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [facilityMetrics, setFacilityMetrics] = useState<FacilityMetrics>({
    total: 0,
    active: 0,
    trial: 0,
    pastDue: 0,
    disabled: 0,
  })
  const [userMetrics, setUserMetrics] = useState<UserMetrics>({ total: 0 })
  const [caseMetrics, setCaseMetrics] = useState<CaseMetrics>({ thisMonth: 0 })
  const [recentActivity, setRecentActivity] = useState<AuditEntry[]>([])

  // Redirect non-admins
  useEffect(() => {
    if (!userLoading && !isGlobalAdmin) {
      router.push('/dashboard')
    }
  }, [userLoading, isGlobalAdmin, router])

  // Fetch dashboard data
  useEffect(() => {
    if (!isGlobalAdmin) return

    async function fetchData() {
      setLoading(true)

      try {
        // Fetch facility metrics
        const { data: facilities } = await supabase
          .from('facilities')
          .select('subscription_status')

        if (facilities) {
          setFacilityMetrics({
            total: facilities.length,
            active: facilities.filter(f => f.subscription_status === 'active').length,
            trial: facilities.filter(f => f.subscription_status === 'trial').length,
            pastDue: facilities.filter(f => f.subscription_status === 'past_due').length,
            disabled: facilities.filter(f => f.subscription_status === 'disabled').length,
          })
        }

        // Fetch user count
        const { count: userCount } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })

        setUserMetrics({ total: userCount || 0 })

        // Fetch cases this month
        const startOfMonth = new Date()
        startOfMonth.setDate(1)
        startOfMonth.setHours(0, 0, 0, 0)

        const { count: caseCount } = await supabase
          .from('cases')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', startOfMonth.toISOString())

        setCaseMetrics({ thisMonth: caseCount || 0 })

        // Fetch recent audit activity
        const { data: auditData } = await supabase
          .from('audit_log')
          .select(`
            id,
            user_email,
            action,
            facility_id,
            target_type,
            created_at,
            success,
            facility:facilities(name)
          `)
          .order('created_at', { ascending: false })
          .limit(10)

        if (auditData) {
          setRecentActivity(auditData as unknown as AuditEntry[])
        }
      } catch (error) {
        showToast({
  type: 'error',
  title: 'Error fetching admin dashboard data:',
  message: error instanceof Error ? error.message : 'Error fetching admin dashboard data:'
})
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [isGlobalAdmin, supabase])

  // Format relative time
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  // Loading state
  if (userLoading || loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-slate-500">Loading admin dashboard...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  // Not authorized
  if (!isGlobalAdmin) {
    return null
  }

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
          <p className="text-slate-500 mt-1">Monitor and manage your ORbit platform</p>
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

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Total Facilities */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{facilityMetrics.total}</p>
              <p className="text-sm text-slate-500">Total Facilities</p>
            </div>
          </div>
        </div>

        {/* Active Facilities */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{facilityMetrics.active}</p>
              <p className="text-sm text-slate-500">Active</p>
            </div>
          </div>
        </div>

        {/* Total Users */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{userMetrics.total}</p>
              <p className="text-sm text-slate-500">Total Users</p>
            </div>
          </div>
        </div>

        {/* Cases This Month */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{caseMetrics.thisMonth}</p>
              <p className="text-sm text-slate-500">Cases This Month</p>
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Quick Actions</h2>
            </div>
            <div className="p-3 space-y-1">
              <Link
                href="/admin/facilities/new"
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors group"
              >
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-slate-900">Create Facility</p>
                  <p className="text-sm text-slate-500">Onboard a new customer</p>
                </div>
              </Link>

              <Link
                href="/admin/facilities"
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors group"
              >
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center group-hover:bg-slate-200 transition-colors">
                  <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-slate-900">View Facilities</p>
                  <p className="text-sm text-slate-500">Manage all customers</p>
                </div>
              </Link>

              <Link
                href="/admin/audit-log"
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors group"
              >
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center group-hover:bg-slate-200 transition-colors">
                  <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-slate-900">Audit Log</p>
                  <p className="text-sm text-slate-500">View all activity</p>
                </div>
              </Link>

              {/* Divider */}
              <div className="pt-2 pb-1">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider px-3">Global Settings</p>
              </div>

              {/* NEW: Milestones Link */}
              <Link
                href="/admin/settings/milestones"
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors group"
              >
                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-slate-900">Milestones</p>
                  <p className="text-sm text-slate-500">Global milestone templates</p>
                </div>
              </Link>

              <Link
                href="/admin/settings/procedures"
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors group"
              >
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-slate-900">Procedure Types</p>
                  <p className="text-sm text-slate-500">THA, TKA, ACL, etc.</p>
                </div>
              </Link>

              <Link
                href="/admin/settings/implant-companies"
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors group"
              >
                <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center group-hover:bg-indigo-200 transition-colors">
                  <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-slate-900">Implant Companies</p>
                  <p className="text-sm text-slate-500">Stryker, Zimmer, etc.</p>
                </div>
              </Link>

              <Link
                href="/admin/settings/delay-types"
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors group"
              >
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center group-hover:bg-amber-200 transition-colors">
                  <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-slate-900">Delay Types</p>
                  <p className="text-sm text-slate-500">Standard delay reasons</p>
                </div>
              </Link>
            </div>
          </div>

          {/* Alerts */}
          {(facilityMetrics.pastDue > 0 || facilityMetrics.trial > 0) && (
            <div className="mt-6 bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="font-semibold text-slate-900">Attention Needed</h2>
              </div>
              <div className="p-4 space-y-3">
                {facilityMetrics.pastDue > 0 && (
                  <div className="flex items-center gap-3 p-3 bg-red-50 rounded-xl">
                    <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-red-900">{facilityMetrics.pastDue} past due</p>
                      <p className="text-xs text-red-700">Payment issues</p>
                    </div>
                  </div>
                )}
                {facilityMetrics.trial > 0 && (
                  <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-xl">
                    <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-amber-900">{facilityMetrics.trial} in trial</p>
                      <p className="text-xs text-amber-700">Follow up to convert</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">Recent Activity</h2>
              <Link
                href="/admin/audit-log"
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                View all
              </Link>
            </div>
            <div className="divide-y divide-slate-100">
              {recentActivity.length === 0 ? (
                <div className="p-8 text-center">
                  <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-slate-500">No activity yet</p>
                </div>
              ) : (
                recentActivity.map((entry) => (
                  <div key={entry.id} className="px-5 py-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          entry.success ? 'bg-slate-100' : 'bg-red-100'
                        }`}>
                          {entry.success ? (
                            <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                          )}
                        </div>
                        <div>
                          <p className="text-sm text-slate-900">
                            <span className="font-medium">{entry.user_email}</span>
                            {' '}
                            <span className="text-slate-600">{formatAuditAction(entry.action as any)}</span>
                          </p>
                          {entry.facility && (
                            <p className="text-xs text-slate-500 mt-0.5">
                              {(entry.facility as any).name}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-slate-400 whitespace-nowrap">
                        {formatRelativeTime(entry.created_at)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
