'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import { getImpersonationState } from '@/lib/impersonation'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import { AnalyticsPageHeader } from '@/components/analytics/AnalyticsBreadcrumb'
import { formatTimeInTimezone } from '@/lib/date-utils'
import { UserIcon, XMarkIcon, CalendarDaysIcon, ChartBarIcon } from '@heroicons/react/24/outline'

// Tremor components
import {
  AreaChart,
  BarChart,
  BarList,
  DonutChart,
  Tracker,
  Legend,
  type Color,
  type EventProps,
} from '@tremor/react'

import {
  getMilestoneMap,
  getTotalORTime,
  getWheelsInToIncision,
  getIncisionToClosing,
  getClosingTime,
  getClosedToWheelsOut,
  calculateAverage,
  calculateSum,
  formatMinutesToHHMMSS,
  getAllSurgicalTurnovers,
  CaseWithMilestones,
} from '@/lib/analytics'

// ============================================
// TYPES
// ============================================

interface Surgeon {
  id: string
  first_name: string
  last_name: string
}

interface DailyMetric {
  date: string
  rawDate: string
  cases: number
  avgORTime: number
  avgSurgicalTime: number
  avgTurnover: number
  uptime: number
}

interface TrackerDay {
  color: Color
  tooltip: string
  date: string
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getLocalDateString(date?: Date): string {
  const d = date || new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDateDisplay(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatDateShort(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getDateRange(period: string): { startDate: Date; endDate: Date; label: string } {
  const today = new Date()
  let startDate: Date
  let label: string

  switch (period) {
    case 'week':
      startDate = new Date(today)
      startDate.setDate(today.getDate() - 7)
      label = 'Last 7 Days'
      break
    case 'month':
      startDate = new Date(today)
      startDate.setDate(today.getDate() - 30)
      label = 'Last 30 Days'
      break
    case 'quarter':
      startDate = new Date(today)
      startDate.setDate(today.getDate() - 90)
      label = 'Last 90 Days'
      break
    case 'year':
      startDate = new Date(today)
      startDate.setFullYear(today.getFullYear() - 1)
      label = 'Last Year'
      break
    default:
      startDate = new Date(today)
      startDate.setDate(today.getDate() - 30)
      label = 'Last 30 Days'
  }

  return { startDate, endDate: today, label }
}

// ============================================
// KPI CARD COMPONENT
// ============================================

function KPICard({ 
  title, 
  value, 
  subtitle, 
  trend,
  icon: Icon,
}: { 
  title: string
  value: string
  subtitle?: string
  trend?: { value: number; label: string }
  icon?: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="text-2xl font-semibold text-slate-900 mt-1">{value}</p>
          {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
          {trend && (
            <p className={`text-sm font-medium mt-2 ${trend.value >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}% {trend.label}
            </p>
          )}
        </div>
        {Icon && (
          <div className="p-2 rounded-lg bg-slate-100">
            <Icon className="w-5 h-5 text-slate-600" />
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================
// DAY DETAIL PANEL (Slide-out)
// ============================================

interface DayDetailPanelProps {
  isOpen: boolean
  onClose: () => void
  date: string
  cases: CaseWithMilestones[]
  facilityTimezone?: string
}

function DayDetailPanel({ isOpen, onClose, date, cases, facilityTimezone }: DayDetailPanelProps) {
  if (!isOpen) return null

  const completedCases = cases.filter(c => {
    const m = getMilestoneMap(c)
    return m.patient_in && m.patient_out
  })

  const caseBreakdown = completedCases.map((c, idx) => {
    const m = getMilestoneMap(c)
    const proc = Array.isArray(c.procedure_types) ? c.procedure_types[0] : c.procedure_types
    return {
      id: c.id,
      caseNumber: c.case_number,
      procedure: proc?.name || 'Unknown',
      totalTime: getTotalORTime(m) || 0,
      preOp: getWheelsInToIncision(m) || 0,
      surgical: getIncisionToClosing(m) || 0,
      closing: getClosingTime(m) || 0,
      emergence: getClosedToWheelsOut(m) || 0,
      startTime: m.patient_in,
    }
  })

  const totalORTime = calculateSum(caseBreakdown.map(c => c.totalTime)) || 0
  const totalSurgical = calculateSum(caseBreakdown.map(c => c.surgical)) || 0
  const turnovers = getAllSurgicalTurnovers(completedCases)
  const avgTurnover = calculateAverage(turnovers)

  // Phase breakdown for donut chart
  const phaseData = [
    { name: 'Pre-Op', value: calculateSum(caseBreakdown.map(c => c.preOp)) || 0 },
    { name: 'Surgical', value: calculateSum(caseBreakdown.map(c => c.surgical)) || 0 },
    { name: 'Closing', value: calculateSum(caseBreakdown.map(c => c.closing)) || 0 },
    { name: 'Emergence', value: calculateSum(caseBreakdown.map(c => c.emergence)) || 0 },
  ].filter(d => d.value > 0)

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Panel */}
      <div className="absolute inset-y-0 right-0 w-full max-w-lg bg-white shadow-2xl overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{formatDateDisplay(date)}</h2>
            <p className="text-sm text-slate-500">{completedCases.length} cases completed</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {completedCases.length === 0 ? (
            <div className="text-center py-12">
              <CalendarDaysIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No completed cases on this day</p>
            </div>
          ) : (
            <>
              {/* Day Summary Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-sm text-slate-500">Total OR Time</p>
                  <p className="text-xl font-bold text-slate-900">{formatMinutesToHHMMSS(totalORTime)}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-sm text-slate-500">Surgical Time</p>
                  <p className="text-xl font-bold text-slate-900">{formatMinutesToHHMMSS(totalSurgical)}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-sm text-slate-500">Avg Turnover</p>
                  <p className="text-xl font-bold text-slate-900">
                    {turnovers.length > 0 ? formatMinutesToHHMMSS(avgTurnover) : 'N/A'}
                  </p>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-sm text-slate-500">OR Uptime</p>
                  <p className="text-xl font-bold text-slate-900">
                    {totalORTime > 0 ? `${Math.round((totalSurgical / totalORTime) * 100)}%` : '--'}
                  </p>
                </div>
              </div>

              {/* Phase Distribution */}
              {phaseData.length > 0 && (
                <div className="bg-white rounded-lg border border-slate-200 p-4">
                  <h3 className="text-sm font-semibold text-slate-900 mb-3">Time Distribution</h3>
                  <div className="flex items-center gap-6">
                    <DonutChart
                      data={phaseData}
                      index="name"
                      category="value"
                      colors={['blue', 'cyan', 'emerald', 'amber']}
                      className="h-32 w-32"
                      showLabel={false}
                      showAnimation={true}
                    />
                    <Legend
                      categories={phaseData.map(d => d.name)}
                      colors={['blue', 'cyan', 'emerald', 'amber']}
                      className="flex-col"
                    />
                  </div>
                </div>
              )}

              {/* Cases List */}
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Cases</h3>
                <div className="space-y-3">
                  {caseBreakdown.map((c, idx) => (
                    <Link
                      key={c.id}
                      href={`/cases/${c.id}`}
                      className="block bg-white rounded-lg border border-slate-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-xs font-bold text-blue-600">
                            {idx + 1}
                          </span>
                          <div>
                            <p className="text-sm font-medium text-slate-900">{c.procedure}</p>
                            <p className="text-xs text-slate-400">{c.caseNumber}</p>
                          </div>
                        </div>
                        <span className="text-sm font-semibold text-slate-900">
                          {formatMinutesToHHMMSS(c.totalTime)}
                        </span>
                      </div>
                      
                      {/* Mini phase bar */}
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden flex">
                        {c.preOp > 0 && (
                          <div className="h-full bg-blue-500" style={{ width: `${(c.preOp / c.totalTime) * 100}%` }} />
                        )}
                        {c.surgical > 0 && (
                          <div className="h-full bg-cyan-500" style={{ width: `${(c.surgical / c.totalTime) * 100}%` }} />
                        )}
                        {c.closing > 0 && (
                          <div className="h-full bg-emerald-500" style={{ width: `${(c.closing / c.totalTime) * 100}%` }} />
                        )}
                        {c.emergence > 0 && (
                          <div className="h-full bg-amber-500" style={{ width: `${(c.emergence / c.totalTime) * 100}%` }} />
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================
// MAIN PAGE COMPONENT
// ============================================

export default function SurgeonPerformancePage() {
  const supabase = createClient()
  const { userData, loading: userLoading, isGlobalAdmin } = useUser()
  
  const [effectiveFacilityId, setEffectiveFacilityId] = useState<string | null>(null)
  const [surgeons, setSurgeons] = useState<Surgeon[]>([])
  const [selectedSurgeon, setSelectedSurgeon] = useState<string | null>(null)
  const [timePeriod, setTimePeriod] = useState('month')
  
  const [allCases, setAllCases] = useState<CaseWithMilestones[]>([])
  const [loading, setLoading] = useState(true)
  const [initialLoading, setInitialLoading] = useState(true)
  
  // Day detail panel
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [selectedDayCases, setSelectedDayCases] = useState<CaseWithMilestones[]>([])

  // Determine facility
  useEffect(() => {
    if (userLoading) return
    
    if (isGlobalAdmin || userData.accessLevel === 'global_admin') {
      const impersonation = getImpersonationState()
      if (impersonation?.facilityId) {
        setEffectiveFacilityId(impersonation.facilityId)
      }
    } else if (userData.facilityId) {
      setEffectiveFacilityId(userData.facilityId)
    }
  }, [userLoading, isGlobalAdmin, userData])

  // Fetch surgeons
  useEffect(() => {
    if (!effectiveFacilityId) return
    
    async function fetchSurgeons() {
      const { data: surgeonRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('name', 'surgeon')
        .single()

      const { data: surgeonsData } = await supabase
        .from('users')
        .select('id, first_name, last_name, role_id')
        .eq('facility_id', effectiveFacilityId)

      setSurgeons(
        (surgeonsData?.filter(u => u.role_id === surgeonRole?.id) as Surgeon[]) || []
      )
      setInitialLoading(false)
    }
    fetchSurgeons()
  }, [effectiveFacilityId])

  // Fetch cases for selected period
  useEffect(() => {
    if (!selectedSurgeon || !effectiveFacilityId) {
      setAllCases([])
      setLoading(false)
      return
    }

    async function fetchCases() {
      setLoading(true)
      
      const { startDate, endDate } = getDateRange(timePeriod)

      const { data } = await supabase
        .from('cases')
        .select(`
          id, case_number, scheduled_date, start_time, surgeon_id,
          surgeon:users!cases_surgeon_id_fkey (first_name, last_name),
          procedure_types (id, name),
          or_rooms (id, name),
          case_milestones (milestone_type_id, recorded_at, milestone_types (name))
        `)
        .eq('facility_id', effectiveFacilityId)
        .eq('surgeon_id', selectedSurgeon)
        .gte('scheduled_date', getLocalDateString(startDate))
        .lte('scheduled_date', getLocalDateString(endDate))
        .order('scheduled_date', { ascending: true })

      setAllCases((data as unknown as CaseWithMilestones[]) || [])
      setLoading(false)
    }

    fetchCases()
  }, [selectedSurgeon, timePeriod, effectiveFacilityId])

  // Calculate daily metrics
  const dailyMetrics = useMemo((): DailyMetric[] => {
    const byDate: { [key: string]: CaseWithMilestones[] } = {}
    
    allCases.forEach(c => {
      const date = c.scheduled_date
      if (!byDate[date]) byDate[date] = []
      byDate[date].push(c)
    })

    return Object.entries(byDate).map(([date, dayCases]) => {
      const completed = dayCases.filter(c => {
        const m = getMilestoneMap(c)
        return m.patient_in && m.patient_out
      })
      
      const orTimes = completed.map(c => getTotalORTime(getMilestoneMap(c)))
      const surgicalTimes = completed.map(c => getIncisionToClosing(getMilestoneMap(c)))
      const turnovers = getAllSurgicalTurnovers(completed)
      
      const totalOR = calculateSum(orTimes) || 0
      const totalSurgical = calculateSum(surgicalTimes) || 0
      
      return {
        date: formatDateShort(date),
        rawDate: date,
        cases: completed.length,
        avgORTime: calculateAverage(orTimes) || 0,
        avgSurgicalTime: calculateAverage(surgicalTimes) || 0,
        avgTurnover: calculateAverage(turnovers) || 0,
        uptime: totalOR > 0 ? Math.round((totalSurgical / totalOR) * 100) : 0,
      }
    }).sort((a, b) => a.rawDate.localeCompare(b.rawDate))
  }, [allCases])

  // Tracker data with click handler
  const trackerData: TrackerDay[] = useMemo(() => {
    const turnoverTarget = 15
    
    return dailyMetrics.map(d => {
      let color: Color = 'slate'
      
      if (d.cases === 0) {
        color = 'slate'
      } else if (d.avgTurnover === 0 || d.cases < 2) {
        color = 'blue' // Has cases but no turnover data
      } else if (d.avgTurnover <= turnoverTarget) {
        color = 'emerald'
      } else if (d.avgTurnover <= turnoverTarget * 1.5) {
        color = 'amber'
      } else {
        color = 'rose'
      }
      
      return {
        color,
        tooltip: `${d.date}: ${d.cases} cases${d.avgTurnover > 0 ? `, ${formatMinutesToHHMMSS(d.avgTurnover)} avg turnover` : ''}`,
        date: d.rawDate,
      }
    })
  }, [dailyMetrics])

  // Period totals
  const periodStats = useMemo(() => {
    const completed = allCases.filter(c => {
      const m = getMilestoneMap(c)
      return m.patient_in && m.patient_out
    })
    
    const orTimes = completed.map(c => getTotalORTime(getMilestoneMap(c)))
    const surgicalTimes = completed.map(c => getIncisionToClosing(getMilestoneMap(c)))
    const turnovers = getAllSurgicalTurnovers(completed)
    
    return {
      totalCases: completed.length,
      avgORTime: calculateAverage(orTimes) || 0,
      avgSurgicalTime: calculateAverage(surgicalTimes) || 0,
      avgTurnover: calculateAverage(turnovers) || 0,
      turnoverCount: turnovers.length,
      totalORTime: calculateSum(orTimes) || 0,
    }
  }, [allCases])

  // Procedure breakdown
  const procedureBreakdown = useMemo(() => {
    const completed = allCases.filter(c => {
      const m = getMilestoneMap(c)
      return m.patient_in && m.patient_out
    })
    
    const byProcedure: { [key: string]: { times: number[]; count: number } } = {}
    
    completed.forEach(c => {
      const proc = Array.isArray(c.procedure_types) ? c.procedure_types[0] : c.procedure_types
      const name = proc?.name || 'Unknown'
      if (!byProcedure[name]) byProcedure[name] = { times: [], count: 0 }
      byProcedure[name].times.push(getTotalORTime(getMilestoneMap(c)) || 0)
      byProcedure[name].count++
    })

    return Object.entries(byProcedure)
      .map(([name, data]) => ({
        name,
        value: data.count,
        avgTime: calculateAverage(data.times) || 0,
      }))
      .sort((a, b) => b.value - a.value)
  }, [allCases])

  // Handle day click
  const handleDayClick = useCallback((date: string) => {
    const dayCases = allCases.filter(c => c.scheduled_date === date)
    setSelectedDayCases(dayCases)
    setSelectedDay(date)
  }, [allCases])

  const selectedSurgeonData = surgeons.find(s => s.id === selectedSurgeon)
  const { label: periodLabel } = getDateRange(timePeriod)

  // Filters component
  const FiltersComponent = (
    <div className="flex items-center gap-3">
      <select
        value={selectedSurgeon || ''}
        onChange={(e) => setSelectedSurgeon(e.target.value || null)}
        className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
      >
        <option value="">Choose surgeon...</option>
        {surgeons.map(s => (
          <option key={s.id} value={s.id}>Dr. {s.first_name} {s.last_name}</option>
        ))}
      </select>
      
      <select
        value={timePeriod}
        onChange={(e) => setTimePeriod(e.target.value)}
        className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
      >
        <option value="week">Last 7 Days</option>
        <option value="month">Last 30 Days</option>
        <option value="quarter">Last 90 Days</option>
        <option value="year">Last Year</option>
      </select>
    </div>
  )

  // Loading states
  if (userLoading || initialLoading) {
    return (
      <DashboardLayout>
        <div className="min-h-screen bg-slate-50/50">
          <Container className="py-8">
            <div className="flex items-center justify-center py-24">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          </Container>
        </div>
      </DashboardLayout>
    )
  }

  if (!effectiveFacilityId) {
    return (
      <DashboardLayout>
        <div className="min-h-screen bg-slate-50/50">
          <Container className="py-8">
            <AnalyticsPageHeader title="Surgeon Performance" icon={UserIcon} />
            <div className="text-center py-24 text-slate-500">
              {isGlobalAdmin ? 'Select a facility to view surgeon analytics.' : 'No facility assigned.'}
            </div>
          </Container>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-slate-50/50">
        <Container className="py-8">
          <AnalyticsPageHeader
            title="Surgeon Performance"
            description="Track trends over time — click any day to see details"
            icon={UserIcon}
            actions={FiltersComponent}
          />

          {!selectedSurgeon ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <UserIcon className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">Select a Surgeon</h3>
              <p className="text-slate-500">Choose a surgeon to view their performance trends</p>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Surgeon Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                    <span className="text-xl font-bold text-white">
                      {selectedSurgeonData?.first_name?.charAt(0)}{selectedSurgeonData?.last_name?.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      Dr. {selectedSurgeonData?.first_name} {selectedSurgeonData?.last_name}
                    </h2>
                    <p className="text-sm text-slate-500">{periodLabel}</p>
                  </div>
                </div>
              </div>

              {/* KPI Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KPICard
                  title="Total Cases"
                  value={periodStats.totalCases.toString()}
                  subtitle={`${periodLabel.toLowerCase()}`}
                  icon={CalendarDaysIcon}
                />
                <KPICard
                  title="Avg OR Time"
                  value={formatMinutesToHHMMSS(periodStats.avgORTime)}
                  subtitle="per case"
                  icon={ChartBarIcon}
                />
                <KPICard
                  title="Avg Turnover"
                  value={periodStats.turnoverCount > 0 ? formatMinutesToHHMMSS(periodStats.avgTurnover) : 'N/A'}
                  subtitle={periodStats.turnoverCount > 0 ? `${periodStats.turnoverCount} turnovers` : 'Need 2+ cases/day'}
                />
                <KPICard
                  title="Total OR Time"
                  value={formatMinutesToHHMMSS(periodStats.totalORTime)}
                  subtitle="cumulative"
                />
              </div>

              {/* Performance Tracker - Clickable! */}
              <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">Daily Performance</h3>
                    <p className="text-sm text-slate-500">Click any day to see case details</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-sm bg-emerald-500" />
                      <span>On target</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-sm bg-amber-500" />
                      <span>Near target</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-sm bg-rose-500" />
                      <span>Over target</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-sm bg-blue-500" />
                      <span>No turnover data</span>
                    </div>
                  </div>
                </div>
                
                {/* Custom clickable tracker */}
                <div className="flex flex-wrap gap-1">
                  {trackerData.map((day, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleDayClick(day.date)}
                      className={`
                        w-4 h-8 rounded-sm transition-all hover:scale-110 hover:ring-2 hover:ring-offset-1
                        ${day.color === 'emerald' ? 'bg-emerald-500 hover:ring-emerald-300' : ''}
                        ${day.color === 'amber' ? 'bg-amber-500 hover:ring-amber-300' : ''}
                        ${day.color === 'rose' ? 'bg-rose-500 hover:ring-rose-300' : ''}
                        ${day.color === 'blue' ? 'bg-blue-500 hover:ring-blue-300' : ''}
                        ${day.color === 'slate' ? 'bg-slate-200 hover:ring-slate-300' : ''}
                      `}
                      title={day.tooltip}
                    />
                  ))}
                </div>
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Trend Chart */}
                <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm p-6">
                  <h3 className="text-base font-semibold text-slate-900 mb-1">Trends Over Time</h3>
                  <p className="text-sm text-slate-500 mb-4">Click chart points to see day details</p>
                  
                  {dailyMetrics.length > 0 ? (
                    <>
                      <AreaChart
                        className="h-56"
                        data={dailyMetrics}
                        index="date"
                        categories={['avgORTime', 'avgTurnover']}
                        colors={['blue', 'emerald']}
                        valueFormatter={(v: number) => formatMinutesToHHMMSS(v)}
                        showLegend={false}
                        showAnimation={true}
                        curveType="monotone"
                        onValueChange={(v: EventProps) => {
                          if (v?.eventType === 'dot' && v.categoryClicked) {
                            const metric = dailyMetrics.find(d => d.date === v.categoryClicked)
                            if (metric) handleDayClick(metric.rawDate)
                          }
                        }}
                      />
                      <Legend
                        className="mt-4"
                        categories={['Avg OR Time', 'Avg Turnover']}
                        colors={['blue', 'emerald']}
                      />
                    </>
                  ) : (
                    <div className="h-56 flex items-center justify-center text-slate-400">
                      No data for this period
                    </div>
                  )}
                </div>

                {/* Procedure Breakdown */}
                <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm p-6">
                  <h3 className="text-base font-semibold text-slate-900 mb-1">Procedure Mix</h3>
                  <p className="text-sm text-slate-500 mb-4">Cases by procedure type</p>
                  
                  {procedureBreakdown.length > 0 ? (
                    <BarList
                      data={procedureBreakdown.slice(0, 8).map(p => ({
                        name: p.name,
                        value: p.value,
                        href: '#',
                      }))}
                      valueFormatter={(v: number) => `${v} cases`}
                      color="blue"
                    />
                  ) : (
                    <div className="py-8 text-center text-slate-400">
                      No procedures found
                    </div>
                  )}
                </div>
              </div>

              {/* Cases by Day Bar Chart */}
              <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm p-6">
                <h3 className="text-base font-semibold text-slate-900 mb-1">Cases per Day</h3>
                <p className="text-sm text-slate-500 mb-4">Daily case volume — click bars to see details</p>
                
                {dailyMetrics.length > 0 ? (
                  <BarChart
                    className="h-48"
                    data={dailyMetrics}
                    index="date"
                    categories={['cases']}
                    colors={['blue']}
                    valueFormatter={(v: number) => `${v} cases`}
                    showLegend={false}
                    showAnimation={true}
                    onValueChange={(v: EventProps) => {
                      if (v?.eventType === 'bar' && v.categoryClicked) {
                        const metric = dailyMetrics.find(d => d.date === v.categoryClicked)
                        if (metric) handleDayClick(metric.rawDate)
                      }
                    }}
                  />
                ) : (
                  <div className="h-48 flex items-center justify-center text-slate-400">
                    No data for this period
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Day Detail Panel */}
          <DayDetailPanel
            isOpen={selectedDay !== null}
            onClose={() => setSelectedDay(null)}
            date={selectedDay || ''}
            cases={selectedDayCases}
            facilityTimezone={userData.facilityTimezone}
          />
        </Container>
      </div>
    </DashboardLayout>
  )
}