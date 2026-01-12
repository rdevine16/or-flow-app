'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'
import { useUser } from '../../lib/UserContext'
import DashboardLayout from '../../components/layouts/DashboardLayout'
import Container from '../../components/ui/Container'
import DateFilter from '../../components/ui/DateFilter'
import AnalyticsLayout from '../../components/analytics/AnalyticsLayout'
import {
  getMilestoneMap,
  getTotalCaseTime,
  getSurgicalTime,
  getPreOpTime,
  getAnesthesiaTime,
  getClosingTime,
  getClosedToWheelsOut,
  calculateAverage,
  calculateStdDev,
  formatSecondsToHHMMSS,
  formatSecondsHuman,
  analyzeFirstCaseStarts,
  analyzeOnTimeStarts,
  analyzeTurnovers,
  analyzeRoomUtilization,
  analyzeSurgeonPerformance,
  analyzeProcedures,
  getCaseVolumeByDayOfWeek,
} from '../../lib/analytics'
import type {
  CaseWithMilestones,
  FirstCaseAnalysis,
  OnTimeAnalysis,
  TurnoverAnalysis,
  SurgeonPerformance,
} from '../../lib/analytics'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts'

// ============================================
// METRIC CARD COMPONENT
// ============================================

interface MetricCardProps {
  title: string
  value: string | number
  subtitle?: string
  trend?: {
    value: number
    improved: boolean
  }
  target?: {
    value: number
    met: boolean
  }
  highlighted?: boolean
  drillable?: boolean
  onClick?: () => void
  size?: 'default' | 'large'
  icon?: React.ReactNode
}

function MetricCard({ 
  title, 
  value, 
  subtitle, 
  trend,
  target,
  highlighted = false, 
  drillable = false,
  onClick,
  size = 'default',
  icon
}: MetricCardProps) {
  const isLarge = size === 'large'
  
  return (
    <div 
      className={`
        rounded-xl border p-5 transition-all
        ${highlighted ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200'}
        ${drillable ? 'cursor-pointer hover:shadow-md hover:border-blue-300' : ''}
      `}
      onClick={drillable ? onClick : undefined}
    >
      <div className="flex items-start justify-between mb-2">
        <p className="text-sm font-medium text-slate-600">{title}</p>
        {icon && <div className="text-slate-400">{icon}</div>}
      </div>
      
      <div className="flex items-end gap-3">
        <p className={`font-bold ${highlighted ? 'text-blue-600' : 'text-slate-900'} ${isLarge ? 'text-3xl' : 'text-2xl'}`}>
          {value}
        </p>
        
        {trend && (
          <div className={`flex items-center gap-1 text-sm font-medium ${trend.improved ? 'text-emerald-600' : 'text-red-500'}`}>
            {trend.improved ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            )}
            {Math.abs(trend.value)}%
          </div>
        )}
      </div>
      
      {target && (
        <div className="mt-2 flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${target.met ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          <span className="text-xs text-slate-500">Target: {target.value}%</span>
        </div>
      )}
      
      {subtitle && (
        <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
      )}
      
      {drillable && (
        <div className="mt-3 flex items-center text-xs font-medium text-blue-600">
          View details
          <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      )}
    </div>
  )
}

// ============================================
// SECTION HEADER COMPONENT
// ============================================

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
    </div>
  )
}

// ============================================
// DRILL-DOWN MODAL COMPONENT
// ============================================

interface DrillDownModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}

function DrillDownModal({ isOpen, onClose, title, children }: DrillDownModalProps) {
  if (!isOpen) return null
  
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={onClose} />
        
        {/* Modal */}
        <div className="relative bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
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
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================
// MAIN PAGE COMPONENT
// ============================================

export default function AnalyticsOverviewPage() {
  const router = useRouter()
  const supabase = createClient()
  const { userData, loading: userLoading } = useUser()
  const facilityId = userData.facilityId
  
  const [cases, setCases] = useState<CaseWithMilestones[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFilter, setDateFilter] = useState('month')
  
  // Drill-down modals
  const [showFirstCaseDrill, setShowFirstCaseDrill] = useState(false)
  const [showOnTimeDrill, setShowOnTimeDrill] = useState(false)
  const [showTurnoverDrill, setShowTurnoverDrill] = useState(false)
  const [showSurgeonDrill, setShowSurgeonDrill] = useState(false)

  const fetchData = async (startDate?: string, endDate?: string) => {
    setLoading(true)

    let query = supabase
      .from('cases')
      .select(`
        id,
        case_number,
        scheduled_date,
        start_time,
        surgeon_id,
        surgeon:users!cases_surgeon_id_fkey (first_name, last_name),
        procedure_types (id, name),
        or_rooms (id, name),
        case_milestones (
          milestone_type_id,
          recorded_at,
          milestone_types (name)
        )
      `)
      .eq('facility_id', facilityId)
      .order('scheduled_date', { ascending: false })

    if (startDate && endDate) {
      query = query.gte('scheduled_date', startDate).lte('scheduled_date', endDate)
    }

    const { data: casesData } = await query
    setCases((casesData as unknown as CaseWithMilestones[]) || [])
    setLoading(false)
  }

  useEffect(() => {
    if (!facilityId) return
    const today = new Date()
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    fetchData(monthStart.toISOString().split('T')[0], today.toISOString().split('T')[0])
  }, [facilityId])

  const handleFilterChange = (filter: string, startDate?: string, endDate?: string) => {
    setDateFilter(filter)
    fetchData(startDate, endDate)
  }

  // ============================================
  // CALCULATE ALL METRICS
  // ============================================
  
  const metrics = useMemo(() => {
    // Completed cases (have patient_in and patient_out)
    const completedCases = cases.filter(c => {
      const milestones = getMilestoneMap(c)
      return milestones.patient_in && milestones.patient_out
    })

    // Time metrics (in seconds)
    const totalCaseTimes = completedCases.map(c => getTotalCaseTime(getMilestoneMap(c)))
    const surgicalTimes = completedCases.map(c => getSurgicalTime(getMilestoneMap(c)))
    const preOpTimes = completedCases.map(c => getPreOpTime(getMilestoneMap(c)))
    const anesthesiaTimes = completedCases.map(c => getAnesthesiaTime(getMilestoneMap(c)))
    const closingTimes = completedCases.map(c => getClosingTime(getMilestoneMap(c)))
    const postClosingTimes = completedCases.map(c => getClosedToWheelsOut(getMilestoneMap(c)))

    // Averages
    const avgTotalTime = calculateAverage(totalCaseTimes)
    const avgSurgicalTime = calculateAverage(surgicalTimes)
    const avgPreOpTime = calculateAverage(preOpTimes)
    const avgAnesthesiaTime = calculateAverage(anesthesiaTimes)
    const avgClosingTime = calculateAverage(closingTimes)
    const avgPostClosingTime = calculateAverage(postClosingTimes)
    const caseTimeVariance = calculateStdDev(totalCaseTimes)

    // On-time start analysis
    const firstCaseAnalysis = analyzeFirstCaseStarts(cases)
    const onTimeAnalysis = analyzeOnTimeStarts(cases)
    
    // Turnover analysis
    const turnoverAnalysis = analyzeTurnovers(cases)
    
    // Room utilization
    const utilizationAnalysis = analyzeRoomUtilization(cases)
    
    // Surgeon performance
    const surgeonPerformance = analyzeSurgeonPerformance(cases)
    
    // Procedure analytics
    const procedureAnalytics = analyzeProcedures(cases)
    
    // Volume by day of week
    const volumeByDay = getCaseVolumeByDayOfWeek(cases)
    
    // Cases by date trend
    const casesByDate = cases.reduce((acc: { [key: string]: number }, c) => {
      acc[c.scheduled_date] = (acc[c.scheduled_date] || 0) + 1
      return acc
    }, {})
    
    const casesTrend = Object.entries(casesByDate)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-14)

    return {
      // Counts
      totalCases: cases.length,
      completedCases: completedCases.length,
      
      // Time averages
      avgTotalTime,
      avgSurgicalTime,
      avgPreOpTime,
      avgAnesthesiaTime,
      avgClosingTime,
      avgPostClosingTime,
      caseTimeVariance,
      
      // Analysis objects
      firstCaseAnalysis,
      onTimeAnalysis,
      turnoverAnalysis,
      utilizationAnalysis,
      surgeonPerformance,
      procedureAnalytics,
      
      // Trends
      volumeByDay,
      casesTrend,
    }
  }, [cases])

  // Phase data for chart
  const phaseData = [
    { phase: 'Pre-Op', avgTime: metrics.avgPreOpTime ? Math.round(metrics.avgPreOpTime / 60) : 0 },
    { phase: 'Anesthesia', avgTime: metrics.avgAnesthesiaTime ? Math.round(metrics.avgAnesthesiaTime / 60) : 0 },
    { phase: 'Surgical', avgTime: metrics.avgSurgicalTime ? Math.round(metrics.avgSurgicalTime / 60) : 0 },
    { phase: 'Closing', avgTime: metrics.avgClosingTime ? Math.round(metrics.avgClosingTime / 60) : 0 },
    { phase: 'Post-Close', avgTime: metrics.avgPostClosingTime ? Math.round(metrics.avgPostClosingTime / 60) : 0 },
  ]

  // Early return for loading/no facility
  if (userLoading) {
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

  if (!facilityId) {
    return (
      <DashboardLayout>
        <div className="text-center py-24 text-slate-500">
          No facility assigned to your account.
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <Container className="py-8">
        <AnalyticsLayout
          title="Analytics Overview"
          description={`${metrics.completedCases} completed cases analyzed`}
          actions={
            <DateFilter selectedFilter={dateFilter} onFilterChange={handleFilterChange} />
          }
        >
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <svg className="animate-spin h-8 w-8 text-blue-600" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          ) : (
            <>
              {/* ============================================ */}
              {/* KEY PERFORMANCE INDICATORS */}
              {/* ============================================ */}
              <div className="mb-8">
                <SectionHeader 
                  title="Key Performance Indicators" 
                  subtitle="Click any metric to drill down into details"
                />
                
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* First Case On-Time Start */}
                  <MetricCard
                    title="First Case On-Time"
                    value={`${metrics.firstCaseAnalysis.onTimeRate}%`}
                    subtitle={`${metrics.firstCaseAnalysis.lateCount} late of ${metrics.firstCaseAnalysis.totalFirstCases}`}
                    target={{ value: 85, met: metrics.firstCaseAnalysis.onTimeRate >= 85 }}
                    highlighted
                    drillable
                    onClick={() => setShowFirstCaseDrill(true)}
                  />
                  
                  {/* Overall On-Time Start */}
                  <MetricCard
                    title="Overall On-Time Start"
                    value={`${metrics.onTimeAnalysis.onTimeRate}%`}
                    subtitle={`${metrics.onTimeAnalysis.lateCount} late of ${metrics.onTimeAnalysis.totalCases}`}
                    target={{ value: 80, met: metrics.onTimeAnalysis.onTimeRate >= 80 }}
                    highlighted
                    drillable
                    onClick={() => setShowOnTimeDrill(true)}
                  />
                  
                  {/* Average Turnover */}
                  <MetricCard
                    title="Avg Turnover Time"
                    value={metrics.turnoverAnalysis.avgTurnoverSeconds ? formatSecondsToHHMMSS(metrics.turnoverAnalysis.avgTurnoverSeconds) : '-'}
                    subtitle={`${metrics.turnoverAnalysis.complianceRate}% under 30 min`}
                    target={{ value: 80, met: metrics.turnoverAnalysis.complianceRate >= 80 }}
                    highlighted
                    drillable
                    onClick={() => setShowTurnoverDrill(true)}
                  />
                  
                  {/* Room Utilization */}
                  <MetricCard
                    title="Room Utilization"
                    value={`${metrics.utilizationAnalysis.overallUtilization}%`}
                    subtitle={`Across ${metrics.utilizationAnalysis.totalRooms} rooms`}
                    target={{ value: 75, met: metrics.utilizationAnalysis.overallUtilization >= 75 }}
                    highlighted
                  />
                </div>
              </div>

              {/* ============================================ */}
              {/* TIME METRICS */}
              {/* ============================================ */}
              <div className="mb-8">
                <SectionHeader 
                  title="Time Metrics" 
                  subtitle="Average durations across all completed cases"
                />
                
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <MetricCard
                    title="Total Case Time"
                    value={formatSecondsToHHMMSS(metrics.avgTotalTime)}
                    subtitle="Patient In → Out"
                  />
                  <MetricCard
                    title="Surgical Time"
                    value={formatSecondsToHHMMSS(metrics.avgSurgicalTime)}
                    subtitle="Incision → Closing"
                  />
                  <MetricCard
                    title="Pre-Op Time"
                    value={formatSecondsToHHMMSS(metrics.avgPreOpTime)}
                    subtitle="Patient In → Incision"
                  />
                  <MetricCard
                    title="Anesthesia Time"
                    value={formatSecondsToHHMMSS(metrics.avgAnesthesiaTime)}
                    subtitle="Anes Start → End"
                  />
                  <MetricCard
                    title="Closing Time"
                    value={formatSecondsToHHMMSS(metrics.avgClosingTime)}
                    subtitle="Closing → Complete"
                  />
                  <MetricCard
                    title="Variance"
                    value={metrics.caseTimeVariance ? `±${Math.round(metrics.caseTimeVariance / 60)}m` : '-'}
                    subtitle="Case time spread"
                  />
                </div>
              </div>

              {/* ============================================ */}
              {/* CHARTS ROW */}
              {/* ============================================ */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Phase Breakdown */}
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Average Time by Phase (minutes)</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={phaseData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="phase" stroke="#334155" fontSize={12} tick={{ fill: '#334155' }} />
                      <YAxis stroke="#334155" fontSize={12} tick={{ fill: '#334155' }} unit="m" />
                      <Tooltip
                        formatter={(value) => [`${value} min`, 'Avg Time']}
                        contentStyle={{ 
                          borderRadius: '8px', 
                          border: '1px solid #e2e8f0',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                        }}
                      />
                      <Bar dataKey="avgTime" fill="#2563eb" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Case Volume Trend */}
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Case Volume Trend</h3>
                  {metrics.casesTrend.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <LineChart data={metrics.casesTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                          dataKey="date"
                          stroke="#334155"
                          fontSize={12}
                          tick={{ fill: '#334155' }}
                          tickFormatter={(date) => {
                            const [year, month, day] = date.split('-').map(Number)
                            return new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                          }}
                        />
                        <YAxis stroke="#334155" fontSize={12} tick={{ fill: '#334155' }} />
                        <Tooltip
                          labelFormatter={(date) => {
                            const [year, month, day] = (date as string).split('-').map(Number)
                            return new Date(year, month - 1, day).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
                          }}
                          formatter={(value) => [value, 'Cases']}
                          contentStyle={{ 
                            borderRadius: '8px', 
                            border: '1px solid #e2e8f0'
                          }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="count" 
                          stroke="#2563eb" 
                          strokeWidth={2} 
                          dot={{ fill: '#2563eb', strokeWidth: 2 }} 
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[280px] flex items-center justify-center text-slate-500">
                      No data available
                    </div>
                  )}
                </div>
              </div>

              {/* ============================================ */}
              {/* SURGEON PERFORMANCE */}
              {/* ============================================ */}
              <div className="mb-8">
                <SectionHeader 
                  title="Surgeon Performance" 
                  subtitle="Case counts and on-time start rates by surgeon"
                />
                
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Surgeon</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Cases</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Avg Case Time</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Avg Surgical</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">On-Time Rate</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Late Starts</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {metrics.surgeonPerformance.slice(0, 10).map((surgeon) => (
                        <tr key={surgeon.surgeonId} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-sm font-medium text-slate-900">{surgeon.surgeonName}</td>
                          <td className="px-4 py-3 text-sm text-slate-600 text-center">{surgeon.caseCount}</td>
                          <td className="px-4 py-3 text-sm text-slate-600 text-center">
                            {formatSecondsToHHMMSS(surgeon.avgCaseTime)}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600 text-center">
                            {formatSecondsToHHMMSS(surgeon.avgSurgicalTime)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              surgeon.onTimeRate >= 85 
                                ? 'bg-emerald-100 text-emerald-800' 
                                : surgeon.onTimeRate >= 70 
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-red-100 text-red-800'
                            }`}>
                              {surgeon.onTimeRate}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-center">
                            {surgeon.lateStartCount > 0 ? (
                              <span className="text-red-600 font-medium">{surgeon.lateStartCount}</span>
                            ) : (
                              <span className="text-emerald-600">0</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  
                  {metrics.surgeonPerformance.length > 10 && (
                    <div className="px-4 py-3 bg-slate-50 border-t border-slate-200">
                      <button 
                        onClick={() => setShowSurgeonDrill(true)}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        View all {metrics.surgeonPerformance.length} surgeons →
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* ============================================ */}
              {/* QUICK STATS ROW */}
              {/* ============================================ */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard
                  title="Total Cases"
                  value={metrics.totalCases}
                  subtitle="In selected period"
                />
                <MetricCard
                  title="Completed"
                  value={metrics.completedCases}
                  subtitle={`${metrics.totalCases > 0 ? Math.round((metrics.completedCases / metrics.totalCases) * 100) : 0}% of total`}
                />
                <MetricCard
                  title="Total Turnovers"
                  value={metrics.turnoverAnalysis.totalTurnovers}
                  subtitle={`${metrics.turnoverAnalysis.exceededTargetCount} exceeded target`}
                />
                <MetricCard
                  title="Procedures"
                  value={metrics.procedureAnalytics.length}
                  subtitle="Unique types performed"
                />
              </div>

              {/* ============================================ */}
              {/* DRILL-DOWN MODALS */}
              {/* ============================================ */}
              
              {/* First Case On-Time Drill-Down */}
              <DrillDownModal
                isOpen={showFirstCaseDrill}
                onClose={() => setShowFirstCaseDrill(false)}
                title="First Case On-Time Start Details"
              >
                <div className="space-y-6">
                  {/* Summary */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-slate-50 rounded-lg p-4">
                      <p className="text-sm text-slate-500">Total First Cases</p>
                      <p className="text-2xl font-bold text-slate-900">{metrics.firstCaseAnalysis.totalFirstCases}</p>
                    </div>
                    <div className="bg-emerald-50 rounded-lg p-4">
                      <p className="text-sm text-emerald-600">On Time</p>
                      <p className="text-2xl font-bold text-emerald-700">{metrics.firstCaseAnalysis.onTimeCount}</p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-4">
                      <p className="text-sm text-red-600">Late</p>
                      <p className="text-2xl font-bold text-red-700">{metrics.firstCaseAnalysis.lateCount}</p>
                    </div>
                  </div>
                  
                  {/* Late Cases List */}
                  {metrics.firstCaseAnalysis.lateCases.length > 0 && (
                    <div>
                      <h4 className="font-medium text-slate-900 mb-3">Late First Case Starts</h4>
                      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                        <table className="w-full">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                              <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Date</th>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Case #</th>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Room</th>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Surgeon</th>
                              <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Delay</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {metrics.firstCaseAnalysis.lateCases.slice(0, 20).map((lateCase, idx) => (
                              <tr key={idx} className="hover:bg-slate-50">
                                <td className="px-4 py-2 text-sm text-slate-600">{lateCase.caseData.scheduled_date}</td>
                                <td className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700">
                                  <a href={`/cases/${lateCase.caseData.id}`}>{lateCase.caseData.case_number}</a>
                                </td>
                                <td className="px-4 py-2 text-sm text-slate-600">{lateCase.roomName}</td>
                                <td className="px-4 py-2 text-sm text-slate-600">{lateCase.surgeonName}</td>
                                <td className="px-4 py-2 text-sm text-right">
                                  <span className="text-red-600 font-medium">+{lateCase.delayMinutes} min</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </DrillDownModal>

              {/* Overall On-Time Drill-Down */}
              <DrillDownModal
                isOpen={showOnTimeDrill}
                onClose={() => setShowOnTimeDrill(false)}
                title="Overall On-Time Start Details"
              >
                <div className="space-y-6">
                  {/* Summary */}
                  <div className="grid grid-cols-4 gap-4">
                    <div className="bg-slate-50 rounded-lg p-4">
                      <p className="text-sm text-slate-500">Total Cases</p>
                      <p className="text-2xl font-bold text-slate-900">{metrics.onTimeAnalysis.totalCases}</p>
                    </div>
                    <div className="bg-emerald-50 rounded-lg p-4">
                      <p className="text-sm text-emerald-600">On Time</p>
                      <p className="text-2xl font-bold text-emerald-700">{metrics.onTimeAnalysis.onTimeCount}</p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-4">
                      <p className="text-sm text-red-600">Late</p>
                      <p className="text-2xl font-bold text-red-700">{metrics.onTimeAnalysis.lateCount}</p>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-4">
                      <p className="text-sm text-amber-600">Avg Delay</p>
                      <p className="text-2xl font-bold text-amber-700">
                        {metrics.onTimeAnalysis.avgDelayMinutes ? `${metrics.onTimeAnalysis.avgDelayMinutes}m` : '-'}
                      </p>
                    </div>
                  </div>
                  
                  {/* Late Cases by First Case vs Non-First */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white rounded-lg border border-slate-200 p-4">
                      <h4 className="font-medium text-slate-900 mb-2">First Case Late Starts</h4>
                      <p className="text-3xl font-bold text-slate-900">
                        {metrics.onTimeAnalysis.lateCases.filter(c => c.isFirstCase).length}
                      </p>
                    </div>
                    <div className="bg-white rounded-lg border border-slate-200 p-4">
                      <h4 className="font-medium text-slate-900 mb-2">Subsequent Case Late Starts</h4>
                      <p className="text-3xl font-bold text-slate-900">
                        {metrics.onTimeAnalysis.lateCases.filter(c => !c.isFirstCase).length}
                      </p>
                    </div>
                  </div>
                  
                  {/* Late Cases List */}
                  {metrics.onTimeAnalysis.lateCases.length > 0 && (
                    <div>
                      <h4 className="font-medium text-slate-900 mb-3">All Late Starts (sorted by delay)</h4>
                      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden max-h-80 overflow-y-auto">
                        <table className="w-full">
                          <thead className="sticky top-0 bg-slate-50">
                            <tr className="border-b border-slate-200">
                              <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Case #</th>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Room</th>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Surgeon</th>
                              <th className="px-4 py-2 text-center text-xs font-semibold text-slate-500 uppercase">First?</th>
                              <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Delay</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {metrics.onTimeAnalysis.lateCases.map((lateCase, idx) => (
                              <tr key={idx} className="hover:bg-slate-50">
                                <td className="px-4 py-2 text-sm font-medium text-blue-600">
                                  <a href={`/cases/${lateCase.caseData.id}`}>{lateCase.caseData.case_number}</a>
                                </td>
                                <td className="px-4 py-2 text-sm text-slate-600">{lateCase.roomName}</td>
                                <td className="px-4 py-2 text-sm text-slate-600">{lateCase.surgeonName}</td>
                                <td className="px-4 py-2 text-sm text-center">
                                  {lateCase.isFirstCase ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">Yes</span>
                                  ) : (
                                    <span className="text-slate-400">No</span>
                                  )}
                                </td>
                                <td className="px-4 py-2 text-sm text-right">
                                  <span className="text-red-600 font-medium">+{lateCase.delayMinutes} min</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </DrillDownModal>

              {/* Turnover Drill-Down */}
              <DrillDownModal
                isOpen={showTurnoverDrill}
                onClose={() => setShowTurnoverDrill(false)}
                title="Turnover Time Details"
              >
                <div className="space-y-6">
                  {/* Summary */}
                  <div className="grid grid-cols-4 gap-4">
                    <div className="bg-slate-50 rounded-lg p-4">
                      <p className="text-sm text-slate-500">Total Turnovers</p>
                      <p className="text-2xl font-bold text-slate-900">{metrics.turnoverAnalysis.totalTurnovers}</p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-4">
                      <p className="text-sm text-blue-600">Average</p>
                      <p className="text-2xl font-bold text-blue-700">
                        {formatSecondsToHHMMSS(metrics.turnoverAnalysis.avgTurnoverSeconds)}
                      </p>
                    </div>
                    <div className="bg-emerald-50 rounded-lg p-4">
                      <p className="text-sm text-emerald-600">Met Target (&lt;30m)</p>
                      <p className="text-2xl font-bold text-emerald-700">{metrics.turnoverAnalysis.metTargetCount}</p>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-4">
                      <p className="text-sm text-amber-600">Exceeded Target</p>
                      <p className="text-2xl font-bold text-amber-700">{metrics.turnoverAnalysis.exceededTargetCount}</p>
                    </div>
                  </div>
                  
                  {/* Turnovers List */}
                  {metrics.turnoverAnalysis.turnovers.length > 0 && (
                    <div>
                      <h4 className="font-medium text-slate-900 mb-3">All Turnovers (longest first)</h4>
                      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden max-h-80 overflow-y-auto">
                        <table className="w-full">
                          <thead className="sticky top-0 bg-slate-50">
                            <tr className="border-b border-slate-200">
                              <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Date</th>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Room</th>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">From Case</th>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">To Case</th>
                              <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Duration</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {metrics.turnoverAnalysis.turnovers.map((turnover, idx) => (
                              <tr key={idx} className="hover:bg-slate-50">
                                <td className="px-4 py-2 text-sm text-slate-600">{turnover.date}</td>
                                <td className="px-4 py-2 text-sm text-slate-600">{turnover.roomName}</td>
                                <td className="px-4 py-2 text-sm font-medium text-blue-600">
                                  <a href={`/cases/${turnover.fromCase.id}`}>{turnover.fromCase.case_number}</a>
                                </td>
                                <td className="px-4 py-2 text-sm font-medium text-blue-600">
                                  <a href={`/cases/${turnover.toCase.id}`}>{turnover.toCase.case_number}</a>
                                </td>
                                <td className="px-4 py-2 text-sm text-right">
                                  <span className={`font-medium ${turnover.metTarget ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {formatSecondsToHHMMSS(turnover.turnoverSeconds)}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </DrillDownModal>

              {/* Surgeon Performance Drill-Down */}
              <DrillDownModal
                isOpen={showSurgeonDrill}
                onClose={() => setShowSurgeonDrill(false)}
                title="All Surgeon Performance"
              >
                <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                  <table className="w-full">
                    <thead className="sticky top-0 bg-slate-50">
                      <tr className="border-b border-slate-200">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Surgeon</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Cases</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Avg Case Time</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Avg Surgical</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">On-Time Rate</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Late Starts</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {metrics.surgeonPerformance.map((surgeon) => (
                        <tr key={surgeon.surgeonId} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-sm font-medium text-slate-900">{surgeon.surgeonName}</td>
                          <td className="px-4 py-3 text-sm text-slate-600 text-center">{surgeon.caseCount}</td>
                          <td className="px-4 py-3 text-sm text-slate-600 text-center">
                            {formatSecondsToHHMMSS(surgeon.avgCaseTime)}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600 text-center">
                            {formatSecondsToHHMMSS(surgeon.avgSurgicalTime)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              surgeon.onTimeRate >= 85 
                                ? 'bg-emerald-100 text-emerald-800' 
                                : surgeon.onTimeRate >= 70 
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-red-100 text-red-800'
                            }`}>
                              {surgeon.onTimeRate}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-center">
                            {surgeon.lateStartCount > 0 ? (
                              <span className="text-red-600 font-medium">{surgeon.lateStartCount}</span>
                            ) : (
                              <span className="text-emerald-600">0</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </DrillDownModal>
            </>
          )}
        </AnalyticsLayout>
      </Container>
    </DashboardLayout>
  )
}
