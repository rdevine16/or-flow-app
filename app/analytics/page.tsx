'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import { getImpersonationState } from '@/lib/impersonation'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import DateFilter from '@/components/ui/DateFilter'

// Custom components
import { Tracker } from '@/components/analytics/Tracker'
import { KPICard, SimpleMetricCard, SurgeonIdleTimeCard } from '@/components/analytics/KPICard'

// Charts (you already have Recharts)
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

// Analytics functions
import {
  calculateAnalyticsOverview,
  formatMinutes,
  type CaseWithMilestones,
  type FlipRoomAnalysis,
} from '@/lib/analyticsV2'

// ============================================
// SECTION HEADER
// ============================================

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
    </div>
  )
}

// ============================================
// FLIP ROOM MODAL
// ============================================

function FlipRoomModal({ 
  isOpen, 
  onClose, 
  data 
}: { 
  isOpen: boolean
  onClose: () => void
  data: FlipRoomAnalysis[]
}) {
  if (!isOpen) return null
  
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={onClose} />
        
        {/* Modal */}
        <div className="relative bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Flip Room Analysis</h3>
              <p className="text-sm text-slate-500">Surgeon idle time between room transitions</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(85vh-80px)]">
            {data.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <p className="text-slate-600 font-medium">No flip room patterns detected</p>
                <p className="text-sm text-slate-500 mt-2">
                  Flip rooms occur when a surgeon operates in multiple rooms on the same day.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {data.map((analysis, idx) => (
                  <div key={idx} className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                    {/* Surgeon Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="font-semibold text-slate-900">{analysis.surgeonName}</p>
                        <p className="text-sm text-slate-500">{analysis.date}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500">Total idle time</p>
                        <p className="text-xl font-bold text-amber-600">
                          {Math.round(analysis.totalIdleTime)} min
                        </p>
                      </div>
                    </div>
                    
                    {/* Room Sequence */}
                    <div className="mb-4">
                      <p className="text-sm font-medium text-slate-600 mb-2">Room Sequence</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        {analysis.cases.map((c, i) => (
                          <div key={c.caseId} className="flex items-center">
                            <div className="px-3 py-1.5 bg-white rounded-lg border border-slate-200 text-sm">
                              <span className="font-medium text-slate-900">{c.roomName}</span>
                              <span className="text-slate-500 ml-2">{c.scheduledStart}</span>
                            </div>
                            {i < analysis.cases.length - 1 && (
                              <svg className="w-4 h-4 mx-1 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Transition Gaps */}
                    {analysis.idleGaps.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-slate-600 mb-2">Transition Gaps</p>
                        <div className="space-y-2">
                          {analysis.idleGaps.map((gap, i) => (
                            <div key={i} className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-slate-700">{gap.fromCase}</span>
                                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                </svg>
                                <span className="text-sm font-medium text-slate-700">{gap.toCase}</span>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="text-right">
                                  <p className="text-xs text-slate-500">Idle time</p>
                                  <p className={`font-semibold ${gap.idleMinutes > 10 ? 'text-red-600' : 'text-amber-600'}`}>
                                    {Math.round(gap.idleMinutes)} min
                                  </p>
                                </div>
                                {gap.optimalCallDelta > 0 && (
                                  <div className="text-right pl-4 border-l border-slate-200">
                                    <p className="text-xs text-blue-600">Call earlier by</p>
                                    <p className="font-semibold text-blue-600">
                                      {Math.round(gap.optimalCallDelta)} min
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================
// CHART COLORS
// ============================================

const CHART_COLORS = ['#3b82f6', '#64748b', '#94a3b8', '#cbd5e1']

// ============================================
// MAIN PAGE COMPONENT
// ============================================

export default function AnalyticsOverviewPage() {
  const supabase = createClient()
  const { userData, loading: userLoading, isGlobalAdmin } = useUser()
  
  const [effectiveFacilityId, setEffectiveFacilityId] = useState<string | null>(null)
  const [noFacilitySelected, setNoFacilitySelected] = useState(false)
  const [facilityCheckComplete, setFacilityCheckComplete] = useState(false)
  
  const [cases, setCases] = useState<CaseWithMilestones[]>([])
  const [previousPeriodCases, setPreviousPeriodCases] = useState<CaseWithMilestones[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFilter, setDateFilter] = useState('month')
  
  // Modal state
  const [showFlipRoomModal, setShowFlipRoomModal] = useState(false)

  // Determine effective facility ID
  useEffect(() => {
    if (userLoading) return
    
    if (isGlobalAdmin || userData.accessLevel === 'global_admin') {
      const impersonation = getImpersonationState()
      if (impersonation?.facilityId) {
        setEffectiveFacilityId(impersonation.facilityId)
      } else {
        setNoFacilitySelected(true)
      }
    } else if (userData.facilityId) {
      setEffectiveFacilityId(userData.facilityId)
    }
    
    setFacilityCheckComplete(true)
  }, [userLoading, isGlobalAdmin, userData.accessLevel, userData.facilityId])

  // Fetch data
  const fetchData = async (startDate?: string, endDate?: string) => {
    if (!effectiveFacilityId) return
    
    setLoading(true)

    let query = supabase
      .from('cases')
      .select(`
        id,
        case_number,
        facility_id,
        scheduled_date,
        start_time,
        surgeon_id,
        or_room_id,
        status_id,
        surgeon:users!cases_surgeon_id_fkey (first_name, last_name),
        procedure_types (id, name),
        or_rooms (id, name),
        case_statuses (name),
        case_milestones (
          milestone_type_id,
          recorded_at,
          milestone_types (name)
        )
      `)
      .eq('facility_id', effectiveFacilityId)
      .order('scheduled_date', { ascending: false })

    if (startDate && endDate) {
      query = query.gte('scheduled_date', startDate).lte('scheduled_date', endDate)
    }

    const { data: casesData } = await query
    setCases((casesData as unknown as CaseWithMilestones[]) || [])
    
    // Fetch previous period for comparison
    if (startDate && endDate) {
      const start = new Date(startDate)
      const end = new Date(endDate)
      const periodLength = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
      
      const prevEnd = new Date(start)
      prevEnd.setDate(prevEnd.getDate() - 1)
      const prevStart = new Date(prevEnd)
      prevStart.setDate(prevStart.getDate() - periodLength)
      
      const { data: prevData } = await supabase
        .from('cases')
        .select(`
          id,
          case_number,
          facility_id,
          scheduled_date,
          start_time,
          surgeon_id,
          or_room_id,
          status_id,
          surgeon:users!cases_surgeon_id_fkey (first_name, last_name),
          procedure_types (id, name),
          or_rooms (id, name),
          case_statuses (name),
          case_milestones (
            milestone_type_id,
            recorded_at,
            milestone_types (name)
          )
        `)
        .eq('facility_id', effectiveFacilityId)
        .gte('scheduled_date', prevStart.toISOString().split('T')[0])
        .lte('scheduled_date', prevEnd.toISOString().split('T')[0])
      
      setPreviousPeriodCases((prevData as unknown as CaseWithMilestones[]) || [])
    }
    
    setLoading(false)
  }

  useEffect(() => {
    if (!effectiveFacilityId) return
    const today = new Date()
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    fetchData(monthStart.toISOString().split('T')[0], today.toISOString().split('T')[0])
  }, [effectiveFacilityId])

  const handleFilterChange = (filter: string, startDate?: string, endDate?: string) => {
    setDateFilter(filter)
    fetchData(startDate, endDate)
  }

  // Calculate all analytics
  const analytics = useMemo(() => {
    return calculateAnalyticsOverview(cases, previousPeriodCases)
  }, [cases, previousPeriodCases])

  // Chart data
  const phaseData = [
    { name: 'Pre-Op', value: Math.round(analytics.avgPreOpTime) },
    { name: 'Surgical', value: Math.round(analytics.avgSurgicalTime) },
    { name: 'Closing', value: Math.round(analytics.avgClosingTime) },
    { name: 'Emergence', value: Math.round(analytics.avgEmergenceTime) },
  ].filter(d => d.value > 0)

  // Loading state
  if (userLoading || !facilityCheckComplete) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-24">
          <svg className="animate-spin h-8 w-8 text-blue-600" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
      </DashboardLayout>
    )
  }

  // No facility selected (global admin)
  if (noFacilitySelected) {
    return (
      <DashboardLayout>
        <Container className="py-8">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">No Facility Selected</h3>
              <p className="text-slate-500 mb-6 max-w-sm mx-auto">
                As a global admin, select a facility to view their analytics.
              </p>
              <Link
                href="/admin/facilities"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                View Facilities
              </Link>
            </div>
          </div>
        </Container>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <Container className="py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Analytics Overview</h1>
            <p className="text-slate-500 mt-1">{analytics.completedCases} completed cases analyzed</p>
          </div>
          <DateFilter selectedFilter={dateFilter} onFilterChange={handleFilterChange} />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <svg className="animate-spin h-8 w-8 text-blue-600" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        ) : (
          <>
            {/* ================================================
                ROW 1: KEY PERFORMANCE INDICATORS (The Big 4)
                ================================================ */}
            <div className="mb-8">
              <SectionHeader 
                title="Key Performance Indicators" 
                subtitle="Click any metric to drill down into details"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard 
                  title="First Case On-Time" 
                  kpi={analytics.fcots}
                  highlighted
                />
                <KPICard 
                  title="Avg Turnover Time" 
                  kpi={analytics.turnoverTime}
                  highlighted
                />
                <KPICard 
                  title="OR Utilization" 
                  kpi={analytics.orUtilization}
                  highlighted
                />
                <KPICard 
                  title="Case Volume" 
                  kpi={analytics.caseVolume}
                  showTracker={false}
                />
              </div>
            </div>

            {/* ================================================
                ROW 2: EFFICIENCY INDICATORS
                ================================================ */}
            <div className="mb-8">
              <SectionHeader 
                title="Efficiency Indicators" 
                subtitle="Secondary metrics that drive performance"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard 
                  title="Same-Day Cancellation" 
                  kpi={analytics.cancellationRate}
                  invertDelta
                />
                <KPICard 
                  title="Cumulative Tardiness" 
                  kpi={analytics.cumulativeTardiness}
                  showTracker={false}
                />
                <KPICard 
                  title="Non-Operative Time" 
                  kpi={analytics.nonOperativeTime}
                  showTracker={false}
                />
                <SurgeonIdleTimeCard 
                  kpi={analytics.surgeonIdleTime}
                  onClick={() => setShowFlipRoomModal(true)}
                />
              </div>
            </div>

            {/* ================================================
                ROW 3: TIME BREAKDOWN
                ================================================ */}
            <div className="mb-8">
              <SectionHeader 
                title="Time Breakdown" 
                subtitle="Average durations across all completed cases"
              />
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <SimpleMetricCard
                  title="Total Case Time"
                  value={formatMinutes(analytics.avgTotalCaseTime)}
                  subtitle="Patient In → Out"
                />
                <SimpleMetricCard
                  title="Surgical Time"
                  value={formatMinutes(analytics.avgSurgicalTime)}
                  subtitle="Incision → Closing"
                />
                <SimpleMetricCard
                  title="Pre-Op Time"
                  value={formatMinutes(analytics.avgPreOpTime)}
                  subtitle="Patient In → Incision"
                />
                <SimpleMetricCard
                  title="Anesthesia Time"
                  value={formatMinutes(analytics.avgAnesthesiaTime)}
                  subtitle="Anes Start → End"
                />
                <SimpleMetricCard
                  title="Closing Time"
                  value={formatMinutes(analytics.avgClosingTime)}
                  subtitle="Closing → Complete"
                />
                <SimpleMetricCard
                  title="Emergence"
                  value={formatMinutes(analytics.avgEmergenceTime)}
                  subtitle="Close → Patient Out"
                />
              </div>
            </div>

            {/* ================================================
                ROW 4: CHARTS
                ================================================ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Phase Duration Bar Chart */}
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-1">Average Time by Phase</h3>
                <p className="text-sm text-slate-500 mb-4">Minutes spent in each surgical phase</p>
                {phaseData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={phaseData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={true} vertical={false} />
                      <XAxis type="number" stroke="#64748b" fontSize={12} tickFormatter={(v) => `${v}m`} />
                      <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={12} width={80} />
                      <Tooltip
                        formatter={(value) => [`${value} min`, 'Duration']}
                        contentStyle={{ 
                          borderRadius: '8px', 
                          border: '1px solid #e2e8f0',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                        }}
                      />
                      <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[280px] text-slate-400">
                    No data available
                  </div>
                )}
              </div>

              {/* Time Distribution Pie Chart */}
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-1">Time Distribution</h3>
                <p className="text-sm text-slate-500 mb-4">Proportion of case time by phase</p>
                {phaseData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={phaseData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {phaseData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => [`${value} min`, 'Duration']}
                        contentStyle={{ 
                          borderRadius: '8px', 
                          border: '1px solid #e2e8f0',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[280px] text-slate-400">
                    No data available
                  </div>
                )}
              </div>
            </div>

            {/* ================================================
                FLIP ROOM MODAL
                ================================================ */}
            <FlipRoomModal
              isOpen={showFlipRoomModal}
              onClose={() => setShowFlipRoomModal(false)}
              data={analytics.flipRoomAnalysis}
            />
          </>
        )}
      </Container>
    </DashboardLayout>
  )
}