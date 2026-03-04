// app/analytics/page.tsx
'use client'
 
import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import DateRangeSelector from '@/components/ui/DateRangeSelector'
import { PageLoader } from '@/components/ui/Loading'
import AccessDenied from '@/components/ui/AccessDenied'
import { getLocalDateString } from '@/lib/date-utils'

// Recharts
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

// Analytics functions
import {
  calculateAnalyticsOverview,
  calculateAvgCaseTime,
  calculateSurgeonLeaderboard,
  getMilestoneMap,
  getTimeDiffMinutes,
  formatMinutes,
  type CaseWithMilestones,
  type RoomHoursMap,
} from '@/lib/analyticsV2'
import { useAnalyticsConfig } from '@/lib/hooks/useAnalyticsConfig'

import Sparkline, { dailyDataToSparkline } from '@/components/ui/Sparkline'
import FlagsCompactBanner from '@/components/analytics/FlagsCompactBanner'
import SurgeonLeaderboardTable from '@/components/analytics/SurgeonLeaderboardTable'
import ProcedureMixCard from '@/components/analytics/ProcedureMixCard'
import RoomUtilizationCard from '@/components/analytics/RoomUtilizationCard'
import RecentCasesTable, { type RecentCaseRow } from '@/components/analytics/RecentCasesTable'
import CaseDrawer from '@/components/cases/CaseDrawer'
import { useProcedureCategories } from '@/hooks/useLookups'

import { ArrowRight, BarChart3, CalendarDays, DollarSign, Flag, Presentation, Star, User } from 'lucide-react'

// ============================================
// TYPES
// ============================================

interface ProcedureCategory {
  id: string
  name: string
  display_name: string
}

// ============================================
// REPORT NAVIGATION CARD
// ============================================

interface ReportCardProps {
  title: string
  description: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  accentColor: 'blue' | 'green' | 'violet' | 'amber' | 'rose' | 'cyan'
  badge?: string
  stats?: { label: string; value: string }[]
}

function ReportCard({ title, description, href, icon: Icon, accentColor, badge, stats }: ReportCardProps) {
  const colorClasses = {
    blue: {
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      hoverBorder: 'hover:border-blue-300',
      badgeBg: 'bg-blue-50',
      badgeText: 'text-blue-700',
    },
    green: {
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600',
      hoverBorder: 'hover:border-green-300',
      badgeBg: 'bg-green-50',
      badgeText: 'text-green-600',
    },
    violet: {
      iconBg: 'bg-violet-100',
      iconColor: 'text-violet-600',
      hoverBorder: 'hover:border-violet-300',
      badgeBg: 'bg-violet-50',
      badgeText: 'text-violet-700',
    },
    amber: {
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
      hoverBorder: 'hover:border-amber-300',
      badgeBg: 'bg-amber-50',
      badgeText: 'text-amber-700',
    },
    rose: {
      iconBg: 'bg-rose-100',
      iconColor: 'text-rose-600',
      hoverBorder: 'hover:border-rose-300',
      badgeBg: 'bg-rose-50',
      badgeText: 'text-rose-700',
    },
    cyan: {
      iconBg: 'bg-cyan-100',
      iconColor: 'text-cyan-600',
      hoverBorder: 'hover:border-cyan-300',
      badgeBg: 'bg-cyan-50',
      badgeText: 'text-cyan-700',
    },
  }

  const colors = colorClasses[accentColor]

  return (
    <Link
      href={href}
      className={`
        group block bg-white rounded-xl border border-slate-200/60 
        shadow-sm hover:shadow-md transition-all duration-200
        ${colors.hoverBorder}
      `}
    >
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className={`p-2.5 rounded-xl ${colors.iconBg}`}>
            <Icon className={`w-5 h-5 ${colors.iconColor}`} />
          </div>
          {badge && (
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors.badgeBg} ${colors.badgeText}`}>
              {badge}
            </span>
          )}
        </div>
        
        <h3 className="text-base font-semibold text-slate-900 mb-1 group-hover:text-slate-700">
          {title}
        </h3>
        <p className="text-sm text-slate-500 mb-4 line-clamp-2">
          {description}
        </p>

        {stats && stats.length > 0 && (
          <div className="flex items-center gap-4 pt-3 border-t border-slate-100">
            {stats.map((stat, i) => (
              <div key={i}>
                <p className="text-xs text-slate-400">{stat.label}</p>
                <p className="text-sm font-semibold text-slate-900">{stat.value}</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center text-sm font-medium text-slate-600 group-hover:text-blue-600 mt-3">
          View report
          <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>
    </Link>
  )
}

// ============================================
// QUICK STAT CARD (for overview row)
// ============================================

function QuickStatCard({
  title,
  value,
  subtitle,
  target,
  trend,
  trendType,
  sparklineData,
  sparklineColor,
}: {
  title: string
  value: string
  subtitle?: string
  target?: string
  trend?: number
  trendType?: 'up' | 'down'
  sparklineData?: number[]
  sparklineColor?: string
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-slate-500 font-medium">{title}</span>
        {trend !== undefined && trendType && (
          <span className={`
            text-[11px] font-semibold px-[7px] py-[2px] rounded-full inline-flex items-center gap-0.5
            ${trend === 0
              ? 'text-slate-500 bg-slate-100'
              : trendType === 'up'
                ? 'text-green-600 bg-green-50'
                : 'text-rose-700 bg-rose-50'
            }
          `}>
            {trend === 0 ? '—' : trendType === 'up' ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-2xl font-bold text-slate-900 font-mono tracking-tight">{value}</p>
          {target && <p className="text-[11px] text-slate-400 mt-0.5">Target: {target}</p>}
          {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        {sparklineData && sparklineData.length > 1 && (
          <div className="opacity-70">
            <Sparkline data={sparklineData} color={sparklineColor || '#94a3b8'} width={72} height={24} showArea={false} />
          </div>
        )}
      </div>
    </div>
  )
}

function CombinedTurnoverCard({
  sameRoomValue,
  flipRoomValue,
  target,
}: {
  sameRoomValue: string
  flipRoomValue: string
  target: string
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-slate-500 font-medium">Room Turnover</span>
      </div>
      <div className="flex gap-4">
        <div className="flex-1">
          <p className="text-xl font-bold text-slate-900 font-mono tracking-tight">{sameRoomValue}</p>
          <p className="text-[10px] text-slate-400 font-medium mt-0.5">Same Room</p>
        </div>
        <div className="w-px bg-slate-100" />
        <div className="flex-1">
          <p className="text-xl font-bold text-slate-900 font-mono tracking-tight">{flipRoomValue}</p>
          <p className="text-[10px] text-slate-400 font-medium mt-0.5">Flip Room</p>
        </div>
      </div>
      <p className="text-[11px] text-slate-400 mt-1">Target: {target}</p>
    </div>
  )
}


// ============================================
// SECTION HEADER
// ============================================

function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

// ============================================
// CHART TOOLTIPS
// ============================================

interface ChartTooltipPayload {
  name: string
  value: number
  color?: string
  fill?: string
}

function CaseVolumeTooltip({ active, payload, label }: { active?: boolean; payload?: ChartTooltipPayload[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-3.5 py-2.5 shadow-lg">
      <p className="text-[11px] font-semibold text-slate-500 mb-1">{label}</p>
      <p className="text-xs text-slate-700">
        <span className="font-semibold">{payload[0].value}</span> completed cases
      </p>
    </div>
  )
}


// ============================================
// MAIN PAGE COMPONENT
// ============================================

export default function AnalyticsHubPage() {
  const supabase = createClient()
  const { loading: userLoading, isGlobalAdmin, effectiveFacilityId, can } = useUser()
  
  const [cases, setCases] = useState<CaseWithMilestones[]>([])
  const [previousPeriodCases, setPreviousPeriodCases] = useState<CaseWithMilestones[]>([])
  const [procedureCategories, setProcedureCategories] = useState<ProcedureCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFilter, setDateFilter] = useState('month')
  const [currentStartDate, setCurrentStartDate] = useState<string | undefined>()
  const [currentEndDate, setCurrentEndDate] = useState<string | undefined>()
  
  const [roomHoursMap, setRoomHoursMap] = useState<RoomHoursMap>({})
  const { config } = useAnalyticsConfig()

  // Fetch room available hours when facility changes
  useEffect(() => {
    if (!effectiveFacilityId) return

    const fetchRoomHours = async () => {
      const { data } = await supabase
        .from('or_rooms')
        .select('id, available_hours')
        .eq('facility_id', effectiveFacilityId)
        .is('deleted_at', null)
      if (data) {
        const map: RoomHoursMap = {}
        data.forEach((r: { id: string; available_hours?: number }) => {
          if (r.available_hours) map[r.id] = r.available_hours
        })
        setRoomHoursMap(map)
      }
    }

    fetchRoomHours()
  }, [effectiveFacilityId, supabase])

  // Case drawer state
  const [drawerCaseId, setDrawerCaseId] = useState<string | null>(null)
  const { data: procCatsForDrawer } = useProcedureCategories()
  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>()
    if (procCatsForDrawer) {
      for (const cat of procCatsForDrawer) {
        map.set(cat.id, cat.name)
      }
    }
    return map
  }, [procCatsForDrawer])

  const handleCaseClick = useCallback((caseId: string) => {
    setDrawerCaseId(caseId)
  }, [])

  const handleDrawerClose = useCallback(() => {
    setDrawerCaseId(null)
  }, [])

  // Fetch procedure categories
  useEffect(() => {
    async function fetchLookups() {
      const { data } = await supabase.from('procedure_categories').select('id, name, display_name').order('display_order')
      if (data) setProcedureCategories(data)
    }
    fetchLookups()
  }, [supabase])

  // Fetch data
  const fetchData = useCallback(async (startDate?: string, endDate?: string) => {
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
        surgeon_left_at,
        cancelled_at,
        is_excluded_from_metrics,
        surgeon:users!cases_surgeon_id_fkey (first_name, last_name),
        procedure_types (
          id,
          name,
          procedure_category_id,
          technique_id,
          procedure_categories (id, name, display_name),
          procedure_techniques (id, name, display_name)
        ),
        or_rooms (id, name),
        case_statuses (name),
        case_milestones (
          facility_milestone_id,
          recorded_at,
          facility_milestones (name)
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
          surgeon_left_at,
          cancelled_at,
          is_excluded_from_metrics,
          surgeon:users!cases_surgeon_id_fkey (first_name, last_name),
          procedure_types (
            id,
            name,
            procedure_category_id,
            technique_id,
            procedure_categories (id, name, display_name),
            procedure_techniques (id, name, display_name)
          ),
          or_rooms (id, name),
          case_statuses (name),
          case_milestones (
            facility_milestone_id,
            recorded_at,
            facility_milestones (name)
          )
        `)
        .eq('facility_id', effectiveFacilityId)
        .gte('scheduled_date', getLocalDateString(prevStart))
        .lte('scheduled_date', getLocalDateString(prevEnd))
      
      setPreviousPeriodCases((prevData as unknown as CaseWithMilestones[]) || [])
    }

    setLoading(false)
  }, [effectiveFacilityId, supabase])

  useEffect(() => {
    if (!effectiveFacilityId) return
    const today = new Date()
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    const start = getLocalDateString(monthStart)
    const end = getLocalDateString(today)
    // eslint-disable-next-line
    setCurrentStartDate(start)
    setCurrentEndDate(end)
    fetchData(start, end)
  }, [effectiveFacilityId, fetchData])

  const handleFilterChange = (filter: string, startDate: string, endDate: string) => {
    setDateFilter(filter)
    setCurrentStartDate(startDate)
    setCurrentEndDate(endDate)
    fetchData(startDate, endDate)
  }

  // Calculate all analytics
  const analytics = useMemo(() => {
    return calculateAnalyticsOverview(cases, previousPeriodCases, config, roomHoursMap)
  }, [cases, previousPeriodCases, config, roomHoursMap])

  // Calculate avg case time with delta
  const avgCaseTimeKPIData = useMemo(() => {
    return calculateAvgCaseTime(cases, previousPeriodCases)
  }, [cases, previousPeriodCases])

  // Surgeon leaderboard (top 5)
  const surgeonLeaderboard = useMemo(() => {
    return calculateSurgeonLeaderboard(cases).slice(0, 5)
  }, [cases])

  // Recent completed cases (top 6)
  const recentCases = useMemo<RecentCaseRow[]>(() => {
    return cases
      .filter(c => {
        const status = Array.isArray(c.case_statuses) ? c.case_statuses[0] : c.case_statuses
        return status?.name === 'completed'
      })
      .sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date))
      .slice(0, 6)
      .map(c => {
        const surgeon = Array.isArray(c.surgeon) ? c.surgeon[0] : c.surgeon
        const procType = Array.isArray(c.procedure_types) ? c.procedure_types[0] : c.procedure_types
        const room = Array.isArray(c.or_rooms) ? c.or_rooms[0] : c.or_rooms
        const ms = getMilestoneMap(c)
        const totalMin = getTimeDiffMinutes(ms.patient_in, ms.patient_out)
        return {
          id: c.id,
          caseNumber: c.case_number,
          surgeonName: surgeon ? `Dr. ${surgeon.last_name}` : '--',
          procedureName: procType?.name || '--',
          roomName: room?.name || '--',
          time: totalMin !== null ? formatMinutes(totalMin) : '--',
          status: 'completed',
          flagCount: 0, // Flags loaded separately by FlagsCompactBanner
        }
      })
  }, [cases])

  // ============================================
  // CHART DATA CALCULATIONS
  // ============================================

  // Daily Case Volume Trend Data
  const dailyCaseTrendData = useMemo(() => {
    const byDate: { [key: string]: number } = {}
    
    cases.forEach(c => {
      const status = Array.isArray(c.case_statuses) ? c.case_statuses[0] : c.case_statuses
      if (status?.name === 'completed') {
        const date = c.scheduled_date
        byDate[date] = (byDate[date] || 0) + 1
      }
    })

    return Object.entries(byDate)
      .map(([date, count]) => ({
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        rawDate: date,
        'Completed Cases': count,
      }))
      .sort((a, b) => a.rawDate.localeCompare(b.rawDate))
  }, [cases])

  // Procedure Type Volume Data — individual procedures, not categories
  const procedureCategoryData = useMemo(() => {
    const byProcType: { [key: string]: { count: number; name: string } } = {}

    cases.forEach(c => {
      const status = Array.isArray(c.case_statuses) ? c.case_statuses[0] : c.case_statuses
      if (status?.name !== 'completed') return

      const procType = Array.isArray(c.procedure_types) ? c.procedure_types[0] : c.procedure_types
      if (!procType) return

      const procId = procType.id
      const procName = procType.name || 'Unknown'
      if (!byProcType[procId]) {
        byProcType[procId] = { count: 0, name: procName }
      }
      byProcType[procId].count++
    })

    return Object.values(byProcType)
      .map(p => ({ name: p.name, cases: p.count }))
      .sort((a, b) => b.cases - a.cases)
      .slice(0, 10) // Top 10 procedure types
  }, [cases])

  const categoryChartColors = ['#3b82f6', '#06b6d4', '#6366f1', '#8b5cf6', '#d946ef', '#ec4899', '#22c55e', '#f59e0b', '#ef4444', '#64748b']


  // Report cards configuration
  const reportCards: ReportCardProps[] = [
    {
      title: 'ORbit Score',
      description: 'Composite surgeon performance scores based on controllable operational metrics',
      href: '/analytics/orbit-score',
      icon: Star,
      accentColor: 'violet',
      badge: 'New',
    },
    {
      title: 'KPI Overview',
      description: 'Complete dashboard with all key performance indicators, targets, and daily trends',
      href: '/analytics/kpi',
      icon: Presentation,
      accentColor: 'blue',
      badge: 'Full Report',
    },
    {
      title: 'Financial Analytics',
      description: 'Profitability metrics, cost analysis, and revenue insights',
      href: '/analytics/financials',
      icon: DollarSign,
      accentColor: 'green',
    },
    {
      title: 'Surgeon Performance',
      description: 'Compare surgeon metrics, case times, and efficiency across procedures',
      href: '/analytics/surgeons',
      icon: User,
      accentColor: 'green',
    },
    {
      title: 'Block Utilization',
      description: 'Block time usage by surgeon, capacity gaps, and case-fitting opportunities',
      href: '/analytics/block-utilization',
      icon: CalendarDays,
      accentColor: 'blue',
    },
    {
      title: 'Case Flags',
      description: 'Review flagged cases, timing anomalies, and reported delays across your facility',
      href: '/analytics/flags',
      icon: Flag,
      accentColor: 'rose',
      badge: 'New',
    },
  ]

  // Loading state
  if (userLoading) {
    return (
      <DashboardLayout>
        <PageLoader message="Loading analytics..." />
      </DashboardLayout>
    )
  }

  if (!can('analytics.view')) {
    return (
      <DashboardLayout>
        <AccessDenied />
      </DashboardLayout>
    )
  }

  // No facility selected (global admin)
  if (!effectiveFacilityId && isGlobalAdmin) {
    return (
      <DashboardLayout>
        <Container className="py-12">
          <div className="max-w-md mx-auto text-center">
            <div className="w-16 h-16 bg-blue-50 rounded-xl flex items-center justify-center mx-auto mb-4">
              <BarChart3 className="w-8 h-8 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">No Facility Selected</h2>
            <p className="text-slate-500 mb-6">Select a facility to view analytics and performance metrics.</p>
            <Link
              href="/admin/facilities"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              View Facilities
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </Container>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
          {/* Page Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Analytics</h1>
              <p className="text-slate-500 text-sm mt-1">
                Performance insights and operational metrics
              </p>
            </div>
            <DateRangeSelector value={dateFilter} onChange={handleFilterChange} />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-slate-500">Calculating metrics...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* KPI STRIP — 6 across */}
              <section>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  <QuickStatCard
                    title="Completed Cases"
                    value={analytics.completedCases.toString()}
                    trend={analytics.caseVolume.delta}
                    trendType={analytics.caseVolume.deltaType === 'increase' ? 'up' : analytics.caseVolume.deltaType === 'decrease' ? 'down' : undefined}
                    sparklineData={dailyDataToSparkline(analytics.caseVolume.dailyData)}
                    sparklineColor="#3b82f6"
                  />
                  <QuickStatCard
                    title="FCOTS Rate"
                    value={analytics.fcots.displayValue}
                    target={`${config.fcotsTargetPercent}%`}
                    trend={analytics.fcots.delta}
                    trendType={analytics.fcots.deltaType === 'increase' ? 'up' : analytics.fcots.deltaType === 'decrease' ? 'down' : undefined}
                    sparklineData={dailyDataToSparkline(analytics.fcots.dailyData)}
                    sparklineColor="#f59e0b"
                  />
                  <CombinedTurnoverCard
                    sameRoomValue={analytics.sameRoomTurnover.displayValue}
                    flipRoomValue={analytics.flipRoomTurnover.displayValue}
                    target={`\u2264${config.turnoverThresholdMinutes} min / \u2264${config.flipRoomTurnoverTarget} min`}
                  />
                  <QuickStatCard
                    title="OR Utilization"
                    value={analytics.orUtilization.displayValue}
                    target={`\u2265${config.utilizationTargetPercent}%`}
                    trend={analytics.orUtilization.delta}
                    trendType={analytics.orUtilization.deltaType === 'increase' ? 'up' : analytics.orUtilization.deltaType === 'decrease' ? 'down' : undefined}
                  />
                  <QuickStatCard
                    title="Avg Case Time"
                    value={avgCaseTimeKPIData.displayValue}
                    trend={avgCaseTimeKPIData.delta}
                    trendType={avgCaseTimeKPIData.deltaType === 'increase' ? 'up' : avgCaseTimeKPIData.deltaType === 'decrease' ? 'down' : undefined}
                  />
                  <QuickStatCard
                    title="Cancellation"
                    value={analytics.cancellationRate.displayValue}
                    target={`<${config.cancellationTargetPercent}%`}
                    trend={analytics.cancellationRate.delta}
                    trendType={analytics.cancellationRate.deltaType === 'increase' ? 'up' : analytics.cancellationRate.deltaType === 'decrease' ? 'down' : undefined}
                  />
                </div>
              </section>

              {/* FLAGS COMPACT BANNER */}
              {effectiveFacilityId && (
                <section>
                  <FlagsCompactBanner
                    facilityId={effectiveFacilityId}
                    startDate={currentStartDate}
                    endDate={currentEndDate}
                  />
                </section>
              )}

              {/* ROW 1: Case Volume Trend + Surgeon Leaderboard */}
              <section>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Case Volume Trend */}
                  <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">Case Volume Trend</h3>
                        <p className="text-xs text-slate-400 mt-0.5">Completed cases over time</p>
                      </div>
                    </div>
                    <div className="p-5">
                      {dailyCaseTrendData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={dailyCaseTrendData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                            <Tooltip content={<CaseVolumeTooltip />} />
                            <Bar dataKey="Completed Cases" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-56 text-slate-400">
                          <div className="text-center">
                            <BarChart3 className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                            <p>No data available</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Surgeon Leaderboard */}
                  <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">Surgeon Leaderboard</h3>
                        <p className="text-xs text-slate-400 mt-0.5">Top performers this period</p>
                      </div>
                    </div>
                    <SurgeonLeaderboardTable data={surgeonLeaderboard} />
                  </div>
                </div>
              </section>

              {/* ROW 2: Procedure Mix + Room Utilization */}
              <section>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Procedure Mix */}
                  <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-slate-100">
                      <h3 className="text-sm font-semibold text-slate-900">Procedure Mix</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Case distribution by procedure type</p>
                    </div>
                    <div className="p-5">
                      <ProcedureMixCard data={procedureCategoryData} colors={categoryChartColors} />
                    </div>
                  </div>

                  {/* Room Utilization */}
                  <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">Room Utilization</h3>
                        <p className="text-xs text-slate-400 mt-0.5">Utilization & same-room turnover</p>
                      </div>
                    </div>
                    <RoomUtilizationCard rooms={analytics.orUtilization.roomBreakdown} />
                  </div>
                </div>
              </section>


              {/* RECENT CASES TABLE */}
              <section>
                <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">Recent Cases</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Latest completed cases</p>
                    </div>
                  </div>
                  <RecentCasesTable cases={recentCases} onCaseClick={handleCaseClick} />
                </div>
              </section>

              {/* REPORTS GRID */}
              <section>
                <SectionHeader
                  title="Detailed Reports"
                  subtitle="Dive deeper into specific areas of OR performance"
                />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {reportCards.map((card) => (
                    <ReportCard key={card.href} {...card} />
                  ))}
                </div>
              </section>

              {/* CASE DRAWER */}
              <CaseDrawer
                caseId={drawerCaseId}
                onClose={handleDrawerClose}
                categoryNameById={categoryNameById}
              />
            </div>
          )}
    </DashboardLayout>
  )
}