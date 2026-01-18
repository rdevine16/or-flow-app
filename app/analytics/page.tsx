'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import { getImpersonationState } from '@/lib/impersonation'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import DateFilter from '@/components/ui/DateFilter'

// Tremor components
import {
  Card,
  Metric,
  Text,
  Title,
  Subtitle,
  Flex,
  Grid,
  BadgeDelta,
  ProgressBar,
  Tracker,
  BarChart,
  DonutChart,
  Legend,
  type Color,
} from '@tremor/react'

// Analytics functions
import {
  calculateAnalyticsOverview,
  formatMinutes,
  type CaseWithMilestones,
  type FlipRoomAnalysis,
} from '@/lib/analyticsV2'

// Icons
import { 
  ClockIcon, 
  ChartBarIcon, 
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  UserGroupIcon,
  CalendarDaysIcon,
  SparklesIcon,
  ArrowRightIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'

// ============================================
// TYPES
// ============================================

interface KPIData {
  value: number
  displayValue: string
  subtitle: string
  target?: number
  targetMet?: boolean
  delta?: number
  deltaType?: 'increase' | 'decrease' | 'unchanged'
  dailyData?: Array<{ color: Color; tooltip: string }>
}

// ============================================
// ENTERPRISE KPI CARD
// ============================================

function KPICard({ 
  title, 
  kpi, 
  icon: Icon,
  accentColor = 'blue',
  showTracker = true,
  onClick,
  invertDelta = false
}: { 
  title: string
  kpi: KPIData
  icon?: React.ComponentType<{ className?: string }>
  accentColor?: 'blue' | 'emerald' | 'amber' | 'rose' | 'violet'
  showTracker?: boolean
  onClick?: () => void
  invertDelta?: boolean
}) {
  const getDeltaType = () => {
    if (!kpi.deltaType || kpi.deltaType === 'unchanged') return 'unchanged'
    if (invertDelta) {
      return kpi.deltaType === 'decrease' ? 'increase' : 'decrease'
    }
    return kpi.deltaType
  }

  const accentColors = {
    blue: {
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      ring: 'ring-blue-500/20',
      metricColor: 'text-slate-900',
    },
    emerald: {
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      ring: 'ring-emerald-500/20',
      metricColor: 'text-slate-900',
    },
    amber: {
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
      ring: 'ring-amber-500/20',
      metricColor: 'text-slate-900',
    },
    rose: {
      iconBg: 'bg-rose-50',
      iconColor: 'text-rose-600',
      ring: 'ring-rose-500/20',
      metricColor: 'text-slate-900',
    },
    violet: {
      iconBg: 'bg-violet-50',
      iconColor: 'text-violet-600',
      ring: 'ring-violet-500/20',
      metricColor: 'text-slate-900',
    },
  }

  const colors = accentColors[accentColor]

  return (
    <div 
      className={`
        relative bg-white rounded-xl border border-slate-200/60 
        shadow-sm hover:shadow-md transition-all duration-200
        ${onClick ? 'cursor-pointer hover:border-slate-300' : ''}
      `}
      onClick={onClick}
    >
      {/* Subtle top accent line */}
      <div className={`absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-${accentColor}-500/40 to-transparent`} />
      
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className={`p-2 rounded-lg ${colors.iconBg}`}>
                <Icon className={`w-4 h-4 ${colors.iconColor}`} />
              </div>
            )}
            <Text className="font-medium text-slate-600">{title}</Text>
          </div>
          {kpi.delta !== undefined && kpi.deltaType && kpi.deltaType !== 'unchanged' && (
            <div className={`
              flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium
              ${getDeltaType() === 'increase' 
                ? 'bg-emerald-50 text-emerald-700' 
                : 'bg-rose-50 text-rose-700'
              }
            `}>
              {getDeltaType() === 'increase' ? (
                <ArrowTrendingUpIcon className="w-3 h-3" />
              ) : (
                <ArrowTrendingDownIcon className="w-3 h-3" />
              )}
              {Math.abs(kpi.delta)}%
            </div>
          )}
        </div>

        {/* Metric */}
        <div className="mb-2">
          <span className={`text-3xl font-semibold tracking-tight ${colors.metricColor}`}>
            {kpi.displayValue}
          </span>
        </div>

        {/* Target indicator */}
        {kpi.target !== undefined && (
          <div className="flex items-center gap-2 mb-3">
            <div className={`
              flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium
              ${kpi.targetMet 
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' 
                : 'bg-amber-50 text-amber-700 border border-amber-200/60'
              }
            `}>
              {kpi.targetMet ? (
                <CheckCircleIcon className="w-3.5 h-3.5" />
              ) : (
                <ExclamationTriangleIcon className="w-3.5 h-3.5" />
              )}
              Target: {title.includes('Cancellation') ? `<${kpi.target}%` : `${kpi.target}%`}
            </div>
          </div>
        )}

        {/* Subtitle */}
        {kpi.subtitle && (
          <Text className="text-slate-500 text-sm">{kpi.subtitle}</Text>
        )}

        {/* Tracker */}
        {showTracker && kpi.dailyData && kpi.dailyData.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="flex justify-between items-center mb-2">
              <Text className="text-xs text-slate-400 font-medium uppercase tracking-wide">
                Daily Trend
              </Text>
              <Text className="text-xs text-slate-400">
                {kpi.dailyData.length} days
              </Text>
            </div>
            <Tracker data={kpi.dailyData} className="h-8" />
          </div>
        )}

        {/* Click indicator */}
        {onClick && (
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center text-xs font-medium text-blue-600 hover:text-blue-700">
            View details
            <ArrowRightIcon className="w-3 h-3 ml-1" />
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================
// SURGEON IDLE TIME CARD (Insight Card)
// ============================================

function SurgeonIdleTimeCard({ 
  kpi, 
  onClick 
}: { 
  kpi: KPIData
  onClick?: () => void 
}) {
  return (
    <div 
      className="relative bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200/60 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden"
      onClick={onClick}
    >
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-indigo-500/5 rounded-full translate-y-1/2 -translate-x-1/2" />
      
      <div className="relative p-5">
        {/* Header with badge */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <SparklesIcon className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <Text className="font-medium text-slate-700">Surgeon Idle Time</Text>
            </div>
          </div>
          <span className="px-2.5 py-1 text-xs font-semibold bg-blue-600 text-white rounded-full shadow-sm">
            AI Insight
          </span>
        </div>

        {/* Metric */}
        <div className="mb-2">
          <span className="text-3xl font-semibold tracking-tight text-blue-900">
            {kpi.displayValue}
          </span>
        </div>

        <Text className="text-blue-700/70 text-sm mb-4">Avg wait between rooms</Text>

        {/* Insight box */}
        {kpi.subtitle && kpi.subtitle !== 'No optimization needed' && kpi.value > 0 ? (
          <div className="p-3 bg-white/60 backdrop-blur-sm rounded-lg border border-blue-200/40">
            <div className="flex items-start gap-2">
              <div className="p-1 rounded bg-blue-100 mt-0.5">
                <SparklesIcon className="w-3 h-3 text-blue-600" />
              </div>
              <Text className="text-blue-800 text-sm font-medium">{kpi.subtitle}</Text>
            </div>
          </div>
        ) : (kpi.targetMet || kpi.value <= 5) && (
          <div className="p-3 bg-emerald-50/80 backdrop-blur-sm rounded-lg border border-emerald-200/40">
            <div className="flex items-start gap-2">
              <CheckCircleIcon className="w-4 h-4 text-emerald-600 mt-0.5" />
              <Text className="text-emerald-800 text-sm font-medium">Excellent! Minimal surgeon wait time</Text>
            </div>
          </div>
        )}

        {/* Click indicator */}
        <div className="mt-4 pt-3 border-t border-blue-200/40 flex items-center text-xs font-medium text-blue-700 hover:text-blue-800">
          View flip room analysis
          <ArrowRightIcon className="w-3 h-3 ml-1" />
        </div>
      </div>
    </div>
  )
}

// ============================================
// TIME METRIC CARD (Compact)
// ============================================

function TimeMetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
}: {
  title: string
  value: string
  subtitle: string
  icon?: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm p-4 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center gap-2 mb-2">
        {Icon && (
          <div className="p-1.5 rounded-md bg-slate-100">
            <Icon className="w-3.5 h-3.5 text-slate-600" />
          </div>
        )}
        <Text className="text-slate-600 font-medium text-sm">{title}</Text>
      </div>
      <div className="text-2xl font-semibold text-slate-900 mb-1">{value}</div>
      <Text className="text-slate-400 text-xs">{subtitle}</Text>
    </div>
  )
}

// ============================================
// CHART CARD WRAPPER
// ============================================

function ChartCard({
  title,
  subtitle,
  children,
  action,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
          </div>
          {action}
        </div>
      </div>
      <div className="p-6">
        {children}
      </div>
    </div>
  )
}

// ============================================
// SECTION HEADER
// ============================================

function SectionHeader({
  title,
  subtitle,
  badge,
}: {
  title: string
  subtitle: string
  badge?: string
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-1">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {badge && (
          <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 rounded-full">
            {badge}
          </span>
        )}
      </div>
      <p className="text-sm text-slate-500">{subtitle}</p>
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
        
        <div className="relative bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden border border-slate-200">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <SparklesIcon className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Flip Room Analysis</h2>
                <p className="text-sm text-slate-500">Surgeon idle time between room transitions</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
          
          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(85vh-80px)]">
            {data.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <CalendarDaysIcon className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-base font-semibold text-slate-900 mb-1">No flip room patterns detected</h3>
                <p className="text-sm text-slate-500 max-w-sm mx-auto">
                  Flip rooms occur when a surgeon operates in multiple rooms on the same day.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {data.map((analysis, idx) => (
                  <div key={idx} className="bg-slate-50 rounded-xl border border-slate-200 p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-sm font-semibold text-slate-700">
                          {analysis.surgeonName.replace('Dr. ', '').charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{analysis.surgeonName}</p>
                          <p className="text-sm text-slate-500">{analysis.date}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Total Idle</p>
                        <p className="text-2xl font-semibold text-amber-600">{Math.round(analysis.totalIdleTime)} min</p>
                      </div>
                    </div>
                    
                    {/* Room sequence */}
                    <div className="mb-4">
                      <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-2">Room Sequence</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        {analysis.cases.map((c, i) => (
                          <div key={c.caseId} className="flex items-center">
                            <div className="px-3 py-2 bg-white rounded-lg border border-slate-200 shadow-sm">
                              <span className="font-semibold text-slate-900">{c.roomName}</span>
                              <span className="text-slate-400 ml-2 text-sm">{c.scheduledStart}</span>
                            </div>
                            {i < analysis.cases.length - 1 && (
                              <ArrowRightIcon className="w-4 h-4 mx-2 text-slate-300" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Gaps */}
                    {analysis.idleGaps.length > 0 && (
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-2">Transition Gaps</p>
                        <div className="space-y-2">
                          {analysis.idleGaps.map((gap, i) => (
                            <div key={i} className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-slate-700">{gap.fromCase}</span>
                                <ArrowRightIcon className="w-4 h-4 text-slate-300" />
                                <span className="font-medium text-slate-700">{gap.toCase}</span>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="text-right">
                                  <p className="text-xs text-slate-400">Idle</p>
                                  <p className={`font-semibold ${gap.idleMinutes > 10 ? 'text-rose-600' : 'text-amber-600'}`}>
                                    {Math.round(gap.idleMinutes)} min
                                  </p>
                                </div>
                                {gap.optimalCallDelta > 0 && (
                                  <div className="text-right pl-4 border-l border-slate-200">
                                    <p className="text-xs text-blue-600">Call earlier</p>
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
  const phaseChartData = [
    { name: 'Pre-Op', minutes: Math.round(analytics.avgPreOpTime) },
    { name: 'Surgical', minutes: Math.round(analytics.avgSurgicalTime) },
    { name: 'Closing', minutes: Math.round(analytics.avgClosingTime) },
    { name: 'Emergence', minutes: Math.round(analytics.avgEmergenceTime) },
  ].filter(d => d.minutes > 0)

  const totalPhaseTime = phaseChartData.reduce((sum, d) => sum + d.minutes, 0)

  // Chart colors - professional blue palette
  const chartColors: Color[] = ['blue', 'cyan', 'indigo', 'violet']

  // Loading state
  if (userLoading || !facilityCheckComplete) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-500">Loading analytics...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  // No facility selected (global admin)
  if (noFacilitySelected) {
    return (
      <DashboardLayout>
        <Container className="py-12">
          <div className="max-w-md mx-auto text-center">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <ChartBarIcon className="w-8 h-8 text-blue-500" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">No Facility Selected</h2>
            <p className="text-slate-500 mb-6">Select a facility to view analytics and performance metrics.</p>
            <Link
              href="/admin/facilities"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              View Facilities
              <ArrowRightIcon className="w-4 h-4" />
            </Link>
          </div>
        </Container>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-slate-50/50">
        <Container className="py-8">
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Analytics Overview</h1>
              <p className="text-slate-500 mt-1">
                {analytics.completedCases} completed cases analyzed
                {analytics.totalCases > analytics.completedCases && (
                  <span className="text-slate-400"> · {analytics.totalCases} total</span>
                )}
              </p>
            </div>
            <DateFilter selectedFilter={dateFilter} onFilterChange={handleFilterChange} />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-slate-500">Calculating metrics...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {/* ROW 1: KEY PERFORMANCE INDICATORS */}
              <section>
                <SectionHeader
                  title="Key Performance Indicators"
                  subtitle="Primary metrics for OR efficiency"
                  badge="Core KPIs"
                />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <KPICard 
                    title="First Case On-Time" 
                    kpi={analytics.fcots}
                    icon={ClockIcon}
                    accentColor="blue"
                  />
                  <KPICard 
                    title="Avg Turnover Time" 
                    kpi={analytics.turnoverTime}
                    icon={ClockIcon}
                    accentColor="emerald"
                  />
                  <KPICard 
                    title="OR Utilization" 
                    kpi={analytics.orUtilization}
                    icon={ChartBarIcon}
                    accentColor="violet"
                  />
                  <KPICard 
                    title="Case Volume" 
                    kpi={analytics.caseVolume}
                    icon={CalendarDaysIcon}
                    accentColor="amber"
                    showTracker={false}
                  />
                </div>
              </section>

              {/* ROW 2: EFFICIENCY INDICATORS */}
              <section>
                <SectionHeader
                  title="Efficiency Indicators"
                  subtitle="Secondary metrics that drive performance"
                />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <KPICard 
                    title="Same-Day Cancellation" 
                    kpi={analytics.cancellationRate}
                    icon={ExclamationTriangleIcon}
                    accentColor="rose"
                    invertDelta
                  />
                  <KPICard 
                    title="Cumulative Tardiness" 
                    kpi={analytics.cumulativeTardiness}
                    icon={ClockIcon}
                    accentColor="amber"
                    showTracker={false}
                  />
                  <KPICard 
                    title="Non-Operative Time" 
                    kpi={analytics.nonOperativeTime}
                    icon={ClockIcon}
                    accentColor="blue"
                    showTracker={false}
                  />
                  <SurgeonIdleTimeCard 
                    kpi={analytics.surgeonIdleTime}
                    onClick={() => setShowFlipRoomModal(true)}
                  />
                </div>
              </section>

              {/* ROW 3: TIME BREAKDOWN */}
              <section>
                <SectionHeader
                  title="Time Breakdown"
                  subtitle="Average durations across all completed cases"
                />
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <TimeMetricCard
                    title="Total Case Time"
                    value={formatMinutes(analytics.avgTotalCaseTime)}
                    subtitle="Patient In → Out"
                    icon={ClockIcon}
                  />
                  <TimeMetricCard
                    title="Surgical Time"
                    value={formatMinutes(analytics.avgSurgicalTime)}
                    subtitle="Incision → Closing"
                    icon={ClockIcon}
                  />
                  <TimeMetricCard
                    title="Pre-Op Time"
                    value={formatMinutes(analytics.avgPreOpTime)}
                    subtitle="Patient In → Incision"
                    icon={ClockIcon}
                  />
                  <TimeMetricCard
                    title="Anesthesia Time"
                    value={formatMinutes(analytics.avgAnesthesiaTime)}
                    subtitle="Anes Start → End"
                    icon={ClockIcon}
                  />
                  <TimeMetricCard
                    title="Closing Time"
                    value={formatMinutes(analytics.avgClosingTime)}
                    subtitle="Closing → Complete"
                    icon={ClockIcon}
                  />
                  <TimeMetricCard
                    title="Emergence"
                    value={formatMinutes(analytics.avgEmergenceTime)}
                    subtitle="Close → Patient Out"
                    icon={ClockIcon}
                  />
                </div>
              </section>

              {/* ROW 4: CHARTS */}
              <section>
                <SectionHeader
                  title="Visual Analytics"
                  subtitle="Time distribution and phase analysis"
                />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Bar Chart */}
                  <ChartCard
                    title="Average Time by Phase"
                    subtitle="Minutes spent in each surgical phase"
                  >
                    {phaseChartData.length > 0 ? (
                      <BarChart
                        className="h-72"
                        data={phaseChartData}
                        index="name"
                        categories={['minutes']}
                        colors={['blue']}
                        valueFormatter={(v) => `${v} min`}
                        yAxisWidth={48}
                        showAnimation={true}
                        showGridLines={true}
                        showLegend={false}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-72 text-slate-400">
                        <div className="text-center">
                          <ChartBarIcon className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                          <p>No data available</p>
                        </div>
                      </div>
                    )}
                  </ChartCard>

                  {/* Donut Chart */}
                  <ChartCard
                    title="Time Distribution"
                    subtitle="Proportion of case time by phase"
                  >
                    {phaseChartData.length > 0 ? (
                      <div className="flex flex-col items-center">
                        <DonutChart
                          className="h-60"
                          data={phaseChartData}
                          index="name"
                          category="minutes"
                          colors={chartColors}
                          valueFormatter={(v) => `${v} min`}
                          showAnimation={true}
                          showTooltip={true}
                          label={`${totalPhaseTime} min`}
                        />
                        <Legend
                          className="mt-4"
                          categories={phaseChartData.map(d => d.name)}
                          colors={chartColors}
                        />
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-72 text-slate-400">
                        <div className="text-center">
                          <ChartBarIcon className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                          <p>No data available</p>
                        </div>
                      </div>
                    )}
                  </ChartCard>
                </div>
              </section>

              {/* FLIP ROOM MODAL */}
              <FlipRoomModal
                isOpen={showFlipRoomModal}
                onClose={() => setShowFlipRoomModal(false)}
                data={analytics.flipRoomAnalysis}
              />
            </div>
          )}
        </Container>
      </div>
    </DashboardLayout>
  )
}