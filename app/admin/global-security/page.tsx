'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { AlertCircle, FileText, Lock, Users } from 'lucide-react'

type TimeRange = '24h' | '7d' | '30d'
type ViewMode = 'aggregate' | 'facility' | 'comparison'

interface Facility {
  id: string
  name: string
  city: string
  state: string
}

interface ErrorLog {
  id: string
  severity: string
  category: string
  message: string
  created_at: string
  context?: any
  facility_id?: string
}

interface AuditLog {
  id: string
  user_id: string
  action: string
  target_label: string
  success: boolean
  created_at: string
  metadata?: any
  facility_id?: string
}

interface SessionInfo {
  id: string
  user_id: string
  remember_me: boolean
  expires_at: string
  last_activity: string
  user_agent: string
  ip_address: string
  users?: {
    email?: string
    full_name?: string
    facility_id?: string
  }
}

interface FacilityStats {
  facilityId: string
  facilityName: string
  errors: number
  criticalErrors: number
  audits: number
  failedLogins: number
  activeSessions: number
}

export default function GlobalSecurityDashboard() {
  const [timeRange, setTimeRange] = useState<TimeRange>('24h')
  const [viewMode, setViewMode] = useState<ViewMode>('aggregate')
  const [selectedFacility, setSelectedFacility] = useState<string | 'all'>('all')
  const { showToast } = useToast()
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [activeSessions, setActiveSessions] = useState<SessionInfo[]>([])
  const [facilityStats, setFacilityStats] = useState<FacilityStats[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'errors' | 'audits' | 'sessions' | 'failed-logins'>('errors')
  
  const supabase = createClient()

  useEffect(() => {
    loadFacilities()
  }, [])

  useEffect(() => {
    if (facilities.length > 0) {
      loadDashboardData()
    }
  }, [timeRange, selectedFacility, facilities])

  useEffect(() => {
    const interval = setInterval(() => {
      if (facilities.length > 0) {
        loadDashboardData()
      }
    }, 30000)
    return () => clearInterval(interval)
  }, [timeRange, selectedFacility, facilities])

  const loadFacilities = async () => {
    const { data } = await supabase
      .from('facilities')
      .select('id, name, city, state')
      .order('name')
    
    setFacilities(data || [])
  }

  const loadDashboardData = async () => {
    setLoading(true)
    
    const now = new Date()
    const timeRangeMap = {
      '24h': new Date(now.getTime() - 24 * 60 * 60 * 1000),
      '7d': new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      '30d': new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
    }
    const startTime = timeRangeMap[timeRange]

    try {
      const facilityFilter = selectedFacility === 'all' ? {} : { facility_id: selectedFacility }

      const { data: errors } = await supabase
        .from('error_logs')
        .select('*')
        .match(facilityFilter)
        .gte('created_at', startTime.toISOString())
        .order('created_at', { ascending: false })
        .limit(200)

      const { data: audits } = await supabase
        .from('audit_log')
        .select('*')
        .match(facilityFilter)
        .gte('created_at', startTime.toISOString())
        .order('created_at', { ascending: false })
        .limit(200)

      const { data: sessions } = await supabase
        .from('user_sessions')
        .select('*, users(full_name, email, facility_id)')
        .match(facilityFilter)
        .gt('expires_at', new Date().toISOString())
        .order('last_activity', { ascending: false })

      const stats: FacilityStats[] = facilities.map(facility => {
        const facilityErrors = (errors || []).filter(e => e.facility_id === facility.id)
        const facilityAudits = (audits || []).filter(a => a.facility_id === facility.id)
        const facilitySessions = (sessions || []).filter(s => s.users?.facility_id === facility.id)
        
        return {
          facilityId: facility.id,
          facilityName: facility.name,
          errors: facilityErrors.length,
          criticalErrors: facilityErrors.filter(e => 
            e.severity === 'critical' || e.severity === 'error'
          ).length,
          audits: facilityAudits.length,
          failedLogins: facilityAudits.filter(a => 
            a.action === 'auth.login_failed' || (a.action === 'login' && !a.success)
          ).length,
          activeSessions: facilitySessions.length,
        }
      })

      setErrorLogs(errors || [])
      setAuditLogs(audits || [])
      setActiveSessions(sessions || [])
      setFacilityStats(stats)
    } catch (error) {
      showToast({
  type: 'error',
  title: 'Failed to load dashboard data:',
  message: error instanceof Error ? error.message : 'Failed to load dashboard data:'
})
    } finally {
      setLoading(false)
    }
  }

  const aggregateStats = {
    totalErrors: errorLogs.length,
    criticalErrors: errorLogs.filter(e => e.severity === 'critical' || e.severity === 'error').length,
    totalAudits: auditLogs.length,
    successfulAudits: auditLogs.filter(a => a.success).length,
    failedAudits: auditLogs.filter(a => !a.success).length,
    failedLogins: auditLogs.filter(a => a.action === 'auth.login_failed' || (a.action === 'login' && !a.success)).length,
    totalSessions: activeSessions.length,
    savedSessions: activeSessions.filter(s => s.remember_me).length,
  }

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Global Security Dashboard</h1>
          <p className="text-slate-500 mt-1">
            Monitor security, errors, and activity across all facilities
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
              <select
                value={selectedFacility}
                onChange={(e) => setSelectedFacility(e.target.value)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Facilities ({facilities.length})</option>
                {facilities.map((facility) => (
                  <option key={facility.id} value={facility.id}>
                    {facility.name} - {facility.city}, {facility.state}
                  </option>
                ))}
              </select>

              <div className="flex gap-2 bg-slate-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('aggregate')}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    viewMode === 'aggregate'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Aggregate
                </button>
                <button
                  onClick={() => setViewMode('facility')}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    viewMode === 'facility'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  By Facility
                </button>
                <button
                  onClick={() => setViewMode('comparison')}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    viewMode === 'comparison'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Compare
                </button>
              </div>

              <div className="flex gap-2">
                {(['24h', '7d', '30d'] as TimeRange[]).map((range) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      timeRange === range
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {range === '24h' ? '24h' : range === '7d' ? '7d' : '30d'}
                  </button>
                ))}
              </div>
            </div>
          </div>

      {/* Content */}
      {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <>
            {viewMode === 'aggregate' && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-medium text-slate-600">System Errors</h3>
                      <AlertCircle className="w-5 h-5 text-red-600" />
                    </div>
                    <div className="text-3xl font-bold text-slate-900 mb-2">{aggregateStats.totalErrors}</div>
                    <div className="text-sm text-red-600">{aggregateStats.criticalErrors} critical/error</div>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-medium text-slate-600">User Actions</h3>
                      <FileText className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="text-3xl font-bold text-slate-900 mb-2">{aggregateStats.totalAudits}</div>
                    <div className="flex gap-3 text-sm">
                      <span className="text-green-600">{aggregateStats.successfulAudits} success</span>
                      <span className="text-red-600">{aggregateStats.failedAudits} failed</span>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-medium text-slate-600">Active Users</h3>
                      <Users className="w-5 h-5 text-green-500" />
                    </div>
                    <div className="text-3xl font-bold text-slate-900 mb-2">{aggregateStats.totalSessions}</div>
                    <div className="text-sm text-slate-600">{aggregateStats.savedSessions} with remember me</div>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-medium text-slate-600">Failed Logins</h3>
                      <Lock className="w-5 h-5 text-orange-500" />
                    </div>
                    <div className="text-3xl font-bold text-slate-900 mb-2">{aggregateStats.failedLogins}</div>
                    <div className="text-sm text-orange-600">Across all facilities</div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200">
                  <div className="border-b border-slate-200">
                    <nav className="flex gap-8 px-6" aria-label="Tabs">
                      {[
                        { id: 'errors', label: 'Error Logs', count: errorLogs.length },
                        { id: 'audits', label: 'Audit Logs', count: auditLogs.length },
                        { id: 'sessions', label: 'Active Sessions', count: activeSessions.length },
                        { id: 'failed-logins', label: 'Failed Logins', count: aggregateStats.failedLogins },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id as any)}
                          className={`py-4 px-1 border-b-2 text-sm font-medium transition-colors ${
                            activeTab === tab.id
                              ? 'border-blue-600 text-blue-600'
                              : 'border-transparent text-slate-500 hover:text-slate-700'
                          }`}
                        >
                          {tab.label}
                          <span className="ml-2 text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                            {tab.count}
                          </span>
                        </button>
                      ))}
                    </nav>
                  </div>

                  <div className="p-6">
                    {activeTab === 'errors' && (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                              <th className="pb-3">Severity</th>
                              <th className="pb-3">Facility</th>
                              <th className="pb-3">Category</th>
                              <th className="pb-3">Message</th>
                              <th className="pb-3">Time</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {errorLogs.slice(0, 50).map((log) => (
                              <tr key={log.id} className="hover:bg-slate-50">
                                <td className="py-4">
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    log.severity === 'critical' ? 'bg-red-100 text-red-800' :
                                    log.severity === 'error' ? 'bg-orange-100 text-orange-800' :
                                    log.severity === 'warning' ? 'bg-amber-100 text-amber-800' :
                                    'bg-blue-100 text-blue-800'
                                  }`}>
                                    {log.severity}
                                  </span>
                                </td>
                                <td className="py-4">
                                  <span className="text-sm text-slate-900">
                                    {log.facility_id === null 
                                      ? 'Global Admin' 
                                      : facilities.find(f => f.id === log.facility_id)?.name || 'Unknown'}
                                  </span>
                                </td>
                                <td className="py-4">
                                  <span className="text-sm text-slate-900 capitalize">
                                    {log.category || 'general'}
                                  </span>
                                </td>
                                <td className="py-4">
                                  <span className="text-sm text-slate-600 max-w-md truncate block">
                                    {log.message}
                                  </span>
                                </td>
                                <td className="py-4">
                                  <span className="text-sm text-slate-500">
                                    {new Date(log.created_at).toLocaleString()}
                                  </span>
                                </td>
                              </tr>
                            ))}
                            {errorLogs.length === 0 && (
                              <tr>
                                <td colSpan={5} className="py-8 text-center text-slate-500">
                                  No errors found - great job! 🎉
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {activeTab === 'audits' && (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                              <th className="pb-3">User</th>
                              <th className="pb-3">Facility</th>
                              <th className="pb-3">Action</th>
                              <th className="pb-3">Resource</th>
                              <th className="pb-3">Status</th>
                              <th className="pb-3">Time</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {auditLogs.slice(0, 50).map((log) => (
                              <tr key={log.id} className="hover:bg-slate-50">
                                <td className="py-4">
                                  <span className="text-sm text-slate-900">
                                    {log.metadata?.email?.split('@')[0] || 'Unknown'}
                                  </span>
                                </td>
                                <td className="py-4">
                                  <span className="text-sm text-slate-600">
                                    {log.facility_id === null
                                      ? 'Global Admin'
                                      : facilities.find(f => f.id === log.facility_id)?.name || 'Unknown'}
                                  </span>
                                </td>
                                <td className="py-4">
                                  <span className="text-sm font-medium text-slate-900">{log.action}</span>
                                </td>
                                <td className="py-4">
                                  <span className="text-sm text-slate-600">{log.target_label || '-'}</span>
                                </td>
                                <td className="py-4">
                                  {log.success ? (
                                    <span className="text-green-600 text-sm">✓ Success</span>
                                  ) : (
                                    <span className="text-red-600 text-sm">✗ Failed</span>
                                  )}
                                </td>
                                <td className="py-4">
                                  <span className="text-sm text-slate-500">
                                    {new Date(log.created_at).toLocaleString()}
                                  </span>
                                </td>
                              </tr>
                            ))}
                            {auditLogs.length === 0 && (
                              <tr>
                                <td colSpan={6} className="py-8 text-center text-slate-500">
                                  No audit logs found
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {activeTab === 'sessions' && (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                              <th className="pb-3">User</th>
                              <th className="pb-3">Facility</th>
                              <th className="pb-3">Device</th>
                              <th className="pb-3">Last Activity</th>
                              <th className="pb-3">Expires</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {activeSessions.map((session) => (
                              <tr key={session.id} className="hover:bg-slate-50">
                                <td className="py-4">
                                  <span className="text-sm text-slate-900">
                                    {session.users?.email?.split('@')[0] || 'Unknown'}
                                  </span>
                                </td>
                                <td className="py-4">
                                  <span className="text-sm text-slate-600">
                                    {session.users?.facility_id === null
                                      ? 'Global Admin'
                                      : facilities.find(f => f.id === session.users?.facility_id)?.name || 'Unknown'}
                                  </span>
                                </td>
                                <td className="py-4">
                                  <span className="text-sm text-slate-600">
                                    {session.user_agent?.includes('iPhone') ? '📱 iPhone' :
                                     session.user_agent?.includes('iPad') ? '📱 iPad' :
                                     session.user_agent?.includes('Android') ? '📱 Android' :
                                     session.user_agent?.includes('Mac') ? '💻 Mac' :
                                     '💻 Desktop'}
                                  </span>
                                </td>
                                <td className="py-4">
                                  <span className="text-sm text-slate-500">
                                    {new Date(session.last_activity).toLocaleString()}
                                  </span>
                                </td>
                                <td className="py-4">
                                  <span className="text-sm text-slate-500">
                                    {new Date(session.expires_at).toLocaleDateString()}
                                    {session.remember_me && ' 🔒'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                            {activeSessions.length === 0 && (
                              <tr>
                                <td colSpan={5} className="py-8 text-center text-slate-500">
                                  No active sessions
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {activeTab === 'failed-logins' && (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                              <th className="pb-3">Email</th>
                              <th className="pb-3">Facility</th>
                              <th className="pb-3">Reason</th>
                              <th className="pb-3">IP Address</th>
                              <th className="pb-3">Time</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {auditLogs
                              .filter(log => log.action === 'auth.login_failed' || (log.action === 'login' && !log.success))
                              .slice(0, 50)
                              .map((log) => (
                                <tr key={log.id} className="hover:bg-slate-50">
                                  <td className="py-4">
                                    <span className="text-sm text-slate-900">
                                      {log.metadata?.email?.split('@')[0]}@...
                                    </span>
                                  </td>
                                  <td className="py-4">
                                    <span className="text-sm text-slate-600">
                                      {facilities.find(f => f.id === log.facility_id)?.name || 'Unknown'}
                                    </span>
                                  </td>
                                  <td className="py-4">
                                    <span className="text-sm text-red-600">
                                      {log.metadata?.reason || 'Invalid credentials'}
                                    </span>
                                  </td>
                                  <td className="py-4">
                                    <span className="text-sm text-slate-500">
                                      {log.metadata?.ip_address || '-'}
                                    </span>
                                  </td>
                                  <td className="py-4">
                                    <span className="text-sm text-slate-500">
                                      {new Date(log.created_at).toLocaleString()}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            {aggregateStats.failedLogins === 0 && (
                              <tr>
                                <td colSpan={5} className="py-8 text-center text-slate-500">
                                  No failed logins - excellent security! 🔒
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {viewMode === 'facility' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {facilityStats
                  .sort((a, b) => b.errors - a.errors)
                  .map((stat) => (
                    <div key={stat.facilityId} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                      <h3 className="text-lg font-semibold text-slate-900 mb-4">{stat.facilityName}</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-2xl font-bold text-red-600">{stat.errors}</div>
                          <div className="text-xs text-slate-500">Errors</div>
                          <div className="text-xs text-slate-400 mt-1">{stat.criticalErrors} critical</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-blue-600">{stat.audits}</div>
                          <div className="text-xs text-slate-500">Actions</div>
                          <div className="text-xs text-slate-400 mt-1">{stat.failedLogins} failed logins</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-green-600">{stat.activeSessions}</div>
                          <div className="text-xs text-slate-500">Active Users</div>
                        </div>
                        <div className="flex items-center">
                          <button
                            onClick={() => {
                              setSelectedFacility(stat.facilityId)
                              setViewMode('aggregate')
                            }}
                            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                          >
                            View Details →
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {viewMode === 'comparison' && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-6">Facility Comparison</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider border-b">
                        <th className="pb-3">Facility</th>
                        <th className="pb-3 text-right">Errors</th>
                        <th className="pb-3 text-right">Critical</th>
                        <th className="pb-3 text-right">Actions</th>
                        <th className="pb-3 text-right">Failed Logins</th>
                        <th className="pb-3 text-right">Active Users</th>
                        <th className="pb-3 text-right">Health Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {facilityStats
                        .sort((a, b) => {
                          const scoreA = Math.max(0, 100 - (a.criticalErrors * 10) - (a.failedLogins * 5))
                          const scoreB = Math.max(0, 100 - (b.criticalErrors * 10) - (b.failedLogins * 5))
                          return scoreB - scoreA
                        })
                        .map((stat) => {
                          const healthScore = Math.max(0, 100 - (stat.criticalErrors * 10) - (stat.failedLogins * 5))
                          const healthColor = 
                            healthScore >= 90 ? 'text-green-600' :
                            healthScore >= 70 ? 'text-amber-600' :
                            'text-red-600'
                          
                          return (
                            <tr key={stat.facilityId} className="hover:bg-slate-50">
                              <td className="py-4">
                                <span className="text-sm font-medium text-slate-900">{stat.facilityName}</span>
                              </td>
                              <td className="py-4 text-right">
                                <span className="text-sm text-slate-900">{stat.errors}</span>
                              </td>
                              <td className="py-4 text-right">
                                <span className={`text-sm font-medium ${stat.criticalErrors > 0 ? 'text-red-600' : 'text-slate-500'}`}>
                                  {stat.criticalErrors}
                                </span>
                              </td>
                              <td className="py-4 text-right">
                                <span className="text-sm text-slate-900">{stat.audits}</span>
                              </td>
                              <td className="py-4 text-right">
                                <span className={`text-sm ${stat.failedLogins > 5 ? 'text-orange-600 font-medium' : 'text-slate-500'}`}>
                                  {stat.failedLogins}
                                </span>
                              </td>
                              <td className="py-4 text-right">
                                <span className="text-sm text-green-600 font-medium">{stat.activeSessions}</span>
                              </td>
                              <td className="py-4 text-right">
                                <span className={`text-sm font-bold ${healthColor}`}>
                                  {healthScore}%
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
    </DashboardLayout>
  )
}