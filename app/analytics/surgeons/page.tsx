'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import { getImpersonationState } from '@/lib/impersonation'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import AccessDenied from '@/components/ui/AccessDenied'
import { AnalyticsPageHeader } from '@/components/analytics/AnalyticsBreadcrumb'
import { formatTimeInTimezone } from '@/lib/date-utils'

import { buildPhaseTree, resolvePhaseHex, resolveSubphaseHex } from '@/lib/milestone-phase-config'
import DateRangeSelector, { getPresetDates, getPrevPeriodDates } from '@/components/ui/DateRangeSelector'
import DatePickerCalendar from '@/components/ui/DatePickerCalendar'


// Tremor components
import {
  AreaChart,
  BarChart,
} from '@tremor/react'

import {
  getMilestoneMap,
  getTotalORTime,
  getSurgicalTime,
  getWheelsInToIncision,
  getIncisionToClosing,
  getClosingTime,
  getClosedToWheelsOut,
  calculateAverage,
  calculateMedian,
  calculateSum,
  formatMinutesToHHMMSS,
  formatSecondsToHHMMSS,
  getAllSameRoomTurnovers,
  getAllSameRoomSurgicalTurnovers,
  computePhaseDurations,
  buildMilestoneTimestampMap,
  computeSubphaseOffsets,
  type CaseWithMilestones,
  type PhaseDefInput,
} from '@/lib/analyticsV2'

import {
  detectCaseFlags,
  computeProcedureMedians,
  aggregateDayFlags,
  type CaseFlag,
} from '@/lib/flag-detection'

// Enterprise analytics components
import { Archive, BarChart3, Building2, ChevronLeft, ChevronRight, ClipboardList, Clock, Info, RefreshCw, TrendingUp, User as UserIcon } from 'lucide-react'
import {
  SectionHeader,
  EnhancedMetricCard,
  SurgeonSelector,
  ConsistencyBadge,
  EmptyState,
  FlagCountPills,
  DayTimeline,
  CasePhaseBarNested,
  PhaseMedianComparison,
  CaseDetailPanel,
  SidebarFlagList,
  PhaseTreeLegend,
  type TimelineCaseData,
  type TimelineCasePhase,
  type TimelineCaseSubphase,
  SkeletonMetricCards,
  SkeletonTable,
  SkeletonChart,
  SkeletonDayAnalysis,
} from '@/components/analytics/AnalyticsComponents'

// ============================================
// TYPES
// ============================================

interface Surgeon {
  id: string
  first_name: string
  last_name: string
}

interface ProcedureTechnique {
  id: string
  name: string
  display_name: string
}

interface ProcedureBreakdown {
  procedure_id: string
  procedure_name: string
  case_count: number
  avg_surgical_seconds: number | null
  stddev_surgical_seconds: number | null
  avg_total_seconds: number | null
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
  return date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })
}

function getConsistencyLabel(avgSeconds: number | null, stddevSeconds: number | null): { label: string; color: string } {
  if (!avgSeconds || !stddevSeconds || avgSeconds === 0) {
    return { label: 'N/A', color: 'text-slate-400' }
  }
  const cv = (stddevSeconds / avgSeconds) * 100
  if (cv < 10) return { label: 'Very Consistent', color: 'text-green-600' }
  if (cv < 20) return { label: 'Consistent', color: 'text-blue-600' }
  return { label: 'Variable', color: 'text-amber-700' }
}

function getConsistencyLevel(avgSeconds: number | null, stddevSeconds: number | null): 'very_consistent' | 'consistent' | 'variable' | 'na' {
  if (!avgSeconds || !stddevSeconds || avgSeconds === 0) return 'na'
  const cv = (stddevSeconds / avgSeconds) * 100
  if (cv < 10) return 'very_consistent'
  if (cv < 20) return 'consistent'
  return 'variable'
}

// ============================================
// CONDENSED HEADER COMPONENTS
// ============================================

function CompactStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">{label}</span>
      <span className="text-[15px] font-bold text-slate-900 tabular-nums">{value}</span>
      {sub && <span className="text-[11px] text-slate-400">{sub}</span>}
    </div>
  )
}

function StatDivider() {
  return <div className="w-px h-[18px] bg-slate-200 flex-shrink-0" />
}

function MiniUptimeRing({ percent }: { percent: number }) {
  const r = 11
  const circ = 2 * Math.PI * r
  const clamped = Math.min(Math.max(percent, 0), 100)
  const offset = circ - (clamped / 100) * circ
  return (
    <div className="relative w-[30px] h-[30px]">
      <svg width={30} height={30} viewBox="0 0 30 30" className="-rotate-90">
        <circle cx={15} cy={15} r={r} fill="none" stroke="#e5e7eb" strokeWidth={3} />
        <circle cx={15} cy={15} r={r} fill="none" stroke="#2563eb" strokeWidth={3}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[8px] font-bold text-slate-900">{Math.round(clamped)}%</span>
      </div>
    </div>
  )
}

// ============================================
// MAIN PAGE COMPONENT
// ============================================

export default function SurgeonPerformancePage() {
  const supabase = createClient()
  const { userData, loading: userLoading, isGlobalAdmin, can } = useUser()
  
  // State
  const [effectiveFacilityId, setEffectiveFacilityId] = useState<string | null>(null)
  const [facilityTimezone, setFacilityTimezone] = useState<string>('America/New_York')
  const [surgeons, setSurgeons] = useState<Surgeon[]>([])
  const [procedureTechniques, setProcedureTechniques] = useState<ProcedureTechnique[]>([])
  const [selectedSurgeon, setSelectedSurgeon] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'day'>('overview')
  const [phaseDefinitions, setPhaseDefinitions] = useState<PhaseDefInput[]>([])
  
  // Overview tab state
  const [dateRange, setDateRange] = useState('mtd')
  const [overviewStart, setOverviewStart] = useState(() => {
  const { start } = getPresetDates('mtd'); return start
  })
  const [overviewEnd, setOverviewEnd] = useState(() => {
  const { end } = getPresetDates('mtd'); return end
})
  const [periodCases, setPeriodCases] = useState<CaseWithMilestones[]>([])
  const [prevPeriodCases, setPrevPeriodCases] = useState<CaseWithMilestones[]>([])
  const [procedureBreakdown, setProcedureBreakdown] = useState<ProcedureBreakdown[]>([])
  
  // Day Analysis tab state
  const [selectedDate, setSelectedDate] = useState(getLocalDateString())
  const [dayCases, setDayCases] = useState<CaseWithMilestones[]>([])
  const [last30DaysCases, setLast30DaysCases] = useState<CaseWithMilestones[]>([])
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null)
  const [surgeonCaseDates, setSurgeonCaseDates] = useState<Set<string>>(new Set())


  const [loading, setLoading] = useState(true)
  const [initialLoading, setInitialLoading] = useState(true)

  // Determine facility
  useEffect(() => {
    if (userLoading) return
    if (isGlobalAdmin || userData.accessLevel === 'global_admin') {
      const impersonation = getImpersonationState()
      if (impersonation?.facilityId) {
        // eslint-disable-next-line
        setEffectiveFacilityId(impersonation.facilityId)
      }
    } else if (userData.facilityId) {
      setEffectiveFacilityId(userData.facilityId)
    }
  }, [userLoading, isGlobalAdmin, userData])

  // Fetch facility timezone
  useEffect(() => {
    if (!effectiveFacilityId) return
    const fetchTimezone = async () => {
      const { data } = await supabase
        .from('facilities')
        .select('timezone')
        .eq('id', effectiveFacilityId)
        .single()
      if (data?.timezone) setFacilityTimezone(data.timezone)
    }
    fetchTimezone()
  }, [effectiveFacilityId, supabase])

  // Fetch surgeons, procedures, and techniques
  useEffect(() => {
    if (!effectiveFacilityId) return
    
    async function fetchData() {
      const { data: surgeonRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('name', 'surgeon')
        .single()

      const [surgeonsRes, techniquesRes, phaseDefsRes] = await Promise.all([
        supabase
          .from('users')
          .select('id, first_name, last_name, role_id')
          .eq('facility_id', effectiveFacilityId)
          .order('last_name'),
        supabase
          .from('procedure_techniques')
          .select('id, name, display_name')
          .order('display_order'),
        supabase
          .from('phase_definitions')
          .select('id, name, display_name, display_order, color_key, parent_phase_id, start_milestone_id, end_milestone_id')
          .eq('facility_id', effectiveFacilityId)
          .eq('is_active', true)
          .order('display_order'),
      ])

      setSurgeons((surgeonsRes.data?.filter(u => u.role_id === surgeonRole?.id) as Surgeon[]) || [])
      setProcedureTechniques(techniquesRes.data || [])
      setPhaseDefinitions((phaseDefsRes.data as PhaseDefInput[]) || [])
      setInitialLoading(false)
    }
    fetchData()
  }, [effectiveFacilityId, supabase])

  // Fetch distinct case dates for the selected surgeon (for calendar dot indicators)
  useEffect(() => {
    if (!selectedSurgeon || !effectiveFacilityId) {
      setSurgeonCaseDates(new Set())
      return
    }

    async function fetchCaseDates() {
      const { data } = await supabase
        .from('cases')
        .select('scheduled_date')
        .eq('facility_id', effectiveFacilityId!)
        .eq('surgeon_id', selectedSurgeon!)

      if (data) {
        setSurgeonCaseDates(new Set(data.map(r => r.scheduled_date)))
      }
    }
    fetchCaseDates()
  }, [selectedSurgeon, effectiveFacilityId, supabase])

  // Helper to get date range (handles custom dates)
  const getEffectiveDateRange = useCallback(() => {
  const { prevStart, prevEnd } = getPrevPeriodDates(overviewStart, overviewEnd)
  const { label } = getPresetDates(dateRange)
  return {
startDate: overviewStart,
endDate: overviewEnd,
prevStartDate: prevStart,
prevEndDate: prevEnd,
label: dateRange === 'custom'
? `${formatDateDisplay(overviewStart)} – ${formatDateDisplay(overviewEnd)}`
: label,
   }
 }, [overviewStart, overviewEnd, dateRange])

  // Get completed cases
  const getCompletedCases = useCallback((cases: CaseWithMilestones[]) => {
    return cases.filter(c => {
      const m = getMilestoneMap(c)
      return m.patient_in && m.patient_out
    })
  }, [])

  // Calculate procedure breakdown for overview
  const calculateProcedureBreakdown = useCallback((cases: CaseWithMilestones[]) => {
    const procedureMap = new Map<string, { id: string; name: string; surgicalTimes: number[]; totalTimes: number[] }>()

    cases.forEach(c => {
      const proc = Array.isArray(c.procedure_types) ? c.procedure_types[0] : c.procedure_types
      if (!proc) return

      if (!procedureMap.has(proc.id)) {
        procedureMap.set(proc.id, { id: proc.id, name: proc.name, surgicalTimes: [], totalTimes: [] })
      }

      const entry = procedureMap.get(proc.id)!
      const m = getMilestoneMap(c)

      const surgicalTime = getIncisionToClosing(m)
      const totalTime = getTotalORTime(m)

      if (surgicalTime && surgicalTime > 0 && surgicalTime < 36000) entry.surgicalTimes.push(surgicalTime)
      if (totalTime && totalTime > 0 && totalTime < 36000) entry.totalTimes.push(totalTime)
    })

    const breakdown: ProcedureBreakdown[] = Array.from(procedureMap.values())
      .map(proc => {
        const avgSurgical = proc.surgicalTimes.length > 0
          ? proc.surgicalTimes.reduce((a, b) => a + b, 0) / proc.surgicalTimes.length
          : null
        const avgTotal = proc.totalTimes.length > 0
          ? proc.totalTimes.reduce((a, b) => a + b, 0) / proc.totalTimes.length
          : null

        let stddev: number | null = null
        if (proc.surgicalTimes.length > 1 && avgSurgical) {
          const squaredDiffs = proc.surgicalTimes.map(t => Math.pow(t - avgSurgical, 2))
          stddev = Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / proc.surgicalTimes.length)
        }

        return {
          procedure_id: proc.id,
          procedure_name: proc.name,
          case_count: proc.surgicalTimes.length,
          avg_surgical_seconds: avgSurgical,
          stddev_surgical_seconds: stddev,
          avg_total_seconds: avgTotal,
        }
      })
      .filter(p => p.case_count > 0)
      .sort((a, b) => b.case_count - a.case_count)

    setProcedureBreakdown(breakdown)
  }, [])

  // Fetch Overview data
  useEffect(() => {
    if (!selectedSurgeon || !effectiveFacilityId || activeTab !== 'overview') return

    async function fetchOverviewData() {
      setLoading(true)
      const { startDate, endDate, prevStartDate, prevEndDate } = getEffectiveDateRange()

      const { data: currentData } = await supabase
        .from('cases')
        .select(`
          id, case_number, scheduled_date, start_time, surgeon_id,
          procedure_types (id, name, technique_id),
          or_rooms (id, name),
case_milestones (facility_milestone_id, recorded_at, facility_milestones (name))
        `)
        .eq('facility_id', effectiveFacilityId)
        .eq('surgeon_id', selectedSurgeon)
        .gte('scheduled_date', startDate)
        .lte('scheduled_date', endDate)
        .order('scheduled_date', { ascending: true })

      const { data: prevData } = await supabase
        .from('cases')
        .select(`
          id, case_number, scheduled_date, start_time, surgeon_id,
          procedure_types (id, name, technique_id),
case_milestones (facility_milestone_id, recorded_at, facility_milestones (name))
        `)
        .eq('facility_id', effectiveFacilityId)
        .eq('surgeon_id', selectedSurgeon)
        .gte('scheduled_date', prevStartDate)
        .lte('scheduled_date', prevEndDate)

      setPeriodCases((currentData as unknown as CaseWithMilestones[]) || [])
      setPrevPeriodCases((prevData as unknown as CaseWithMilestones[]) || [])
      
      calculateProcedureBreakdown((currentData as unknown as CaseWithMilestones[]) || [])
      
      setLoading(false)
    }

    fetchOverviewData()
}, [selectedSurgeon, overviewStart, overviewEnd, effectiveFacilityId, activeTab, calculateProcedureBreakdown, supabase, getEffectiveDateRange])
  // Handle custom date change
const handleDateRangeChange = (range: string, startDate: string, endDate: string) => {
  setDateRange(range)
  setOverviewStart(startDate)
  setOverviewEnd(endDate)
}

  // Fetch Day Analysis data
  useEffect(() => {
    if (!selectedSurgeon || !effectiveFacilityId || activeTab !== 'day') {
      // eslint-disable-next-line
      setDayCases([])
      setLast30DaysCases([])
      return
    }

    async function fetchDayData() {
      setLoading(true)
      const today = new Date()
      const thirtyDaysAgo = new Date(today)
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const caseSelect = `
        id, case_number, scheduled_date, start_time, surgeon_id,
        surgeon:users!cases_surgeon_id_fkey (first_name, last_name),
        procedure_types (id, name, technique_id),
        or_rooms (id, name),
case_milestones (facility_milestone_id, recorded_at, facility_milestones (name))
      `

      const [dayRes, last30Res] = await Promise.all([
        supabase.from('cases').select(caseSelect)
          .eq('facility_id', effectiveFacilityId)
          .eq('surgeon_id', selectedSurgeon)
          .eq('scheduled_date', selectedDate)
          .order('start_time', { ascending: true }),
        supabase.from('cases').select(caseSelect)
          .eq('facility_id', effectiveFacilityId)
          .eq('surgeon_id', selectedSurgeon)
          .gte('scheduled_date', getLocalDateString(thirtyDaysAgo))
          .lte('scheduled_date', getLocalDateString(today)),
      ])

      setDayCases((dayRes.data as unknown as CaseWithMilestones[]) || [])
      setLast30DaysCases((last30Res.data as unknown as CaseWithMilestones[]) || [])
      setLoading(false)
    }

    fetchDayData()
  }, [selectedSurgeon, selectedDate, effectiveFacilityId, activeTab, supabase])

  // Helper to get surgical time from milestones (in minutes)
  const getSurgicalTimeMinutes = (caseData: CaseWithMilestones): number | null => {
    const milestones = caseData.case_milestones || []
    let incisionTimestamp: number | null = null
    let closingTimestamp: number | null = null

    milestones.forEach(m => {
const mType = Array.isArray(m.facility_milestones) ? m.facility_milestones[0] : m.facility_milestones
      if (mType?.name === 'incision') {
        incisionTimestamp = new Date(m.recorded_at).getTime()
      } else if (mType?.name === 'closing' || mType?.name === 'closing_complete') {
        closingTimestamp = new Date(m.recorded_at).getTime()
      }
    })

    if (incisionTimestamp !== null && closingTimestamp !== null) {
      return Math.round((closingTimestamp - incisionTimestamp) / (1000 * 60))
    }
    return null
  }

  // ============================================
  // ROBOTIC VS TRADITIONAL COMPARISON DATA
  // ============================================

  const roboticTechniqueId = procedureTechniques.find(t => t.name === 'robotic')?.id
  const manualTechniqueId = procedureTechniques.find(t => t.name === 'manual')?.id

  const tkaComparisonData = useMemo(() => {
    if (!roboticTechniqueId || !manualTechniqueId) return []

    const byDate: { [key: string]: { robotic: number[]; traditional: number[] } } = {}

    periodCases.forEach(c => {
      const procType = Array.isArray(c.procedure_types) ? c.procedure_types[0] : c.procedure_types
      if (!procType) return

      const procName = procType.name?.toUpperCase() || ''
      if (!procName.includes('TKA')) return

      const surgicalTime = getSurgicalTimeMinutes(c)
      if (!surgicalTime || surgicalTime <= 0 || surgicalTime > 600) return

      const date = c.scheduled_date
      if (!byDate[date]) {
        byDate[date] = { robotic: [], traditional: [] }
      }

      if (procType.technique_id === roboticTechniqueId) {
        byDate[date].robotic.push(surgicalTime)
      } else if (procType.technique_id === manualTechniqueId) {
        byDate[date].traditional.push(surgicalTime)
      }
    })

    return Object.entries(byDate)
      .map(([date, times]) => ({
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        rawDate: date,
        'Robotic (Mako)': times.robotic.length > 0 
          ? Math.round(times.robotic.reduce((a, b) => a + b, 0) / times.robotic.length) 
          : null,
        'Traditional': times.traditional.length > 0 
          ? Math.round(times.traditional.reduce((a, b) => a + b, 0) / times.traditional.length) 
          : null,
      }))
      .filter(d => d['Robotic (Mako)'] !== null || d['Traditional'] !== null)
      .sort((a, b) => a.rawDate.localeCompare(b.rawDate))
  }, [periodCases, roboticTechniqueId, manualTechniqueId])

  const thaComparisonData = useMemo(() => {
    if (!roboticTechniqueId || !manualTechniqueId) return []

    const byDate: { [key: string]: { robotic: number[]; traditional: number[] } } = {}

    periodCases.forEach(c => {
      const procType = Array.isArray(c.procedure_types) ? c.procedure_types[0] : c.procedure_types
      if (!procType) return

      const procName = procType.name?.toUpperCase() || ''
      if (!procName.includes('THA')) return

      const surgicalTime = getSurgicalTimeMinutes(c)
      if (!surgicalTime || surgicalTime <= 0 || surgicalTime > 600) return

      const date = c.scheduled_date
      if (!byDate[date]) {
        byDate[date] = { robotic: [], traditional: [] }
      }

      if (procType.technique_id === roboticTechniqueId) {
        byDate[date].robotic.push(surgicalTime)
      } else if (procType.technique_id === manualTechniqueId) {
        byDate[date].traditional.push(surgicalTime)
      }
    })

    return Object.entries(byDate)
      .map(([date, times]) => ({
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        rawDate: date,
        'Robotic (Mako)': times.robotic.length > 0 
          ? Math.round(times.robotic.reduce((a, b) => a + b, 0) / times.robotic.length) 
          : null,
        'Traditional': times.traditional.length > 0 
          ? Math.round(times.traditional.reduce((a, b) => a + b, 0) / times.traditional.length) 
          : null,
      }))
      .filter(d => d['Robotic (Mako)'] !== null || d['Traditional'] !== null)
      .sort((a, b) => a.rawDate.localeCompare(b.rawDate))
  }, [periodCases, roboticTechniqueId, manualTechniqueId])

  const hasComparisonData = tkaComparisonData.length > 0 || thaComparisonData.length > 0

  // Calculate metrics for day analysis
  const calculateDayMetrics = useCallback((cases: CaseWithMilestones[]) => {
    const completed = getCompletedCases(cases)
    
    const orTimes = completed.map(c => getTotalORTime(getMilestoneMap(c)))
    const surgicalTimes = completed.map(c => getSurgicalTime(getMilestoneMap(c)))
    const incisionToClosingTimes = completed.map(c => getIncisionToClosing(getMilestoneMap(c)))
    const wheelsInToIncisionTimes = completed.map(c => getWheelsInToIncision(getMilestoneMap(c)))
    const closingTimes = completed.map(c => getClosingTime(getMilestoneMap(c)))
    const closedToWheelsOutTimes = completed.map(c => getClosedToWheelsOut(getMilestoneMap(c)))
    
    const firstCase = completed.length > 0 ? completed[0] : null
    const firstCaseTime = firstCase ? getMilestoneMap(firstCase).patient_in : null
    const firstCaseScheduledTime = firstCase?.start_time || null

    const roomTurnovers = getAllSameRoomTurnovers(completed)
    const surgicalTurnovers = getAllSameRoomSurgicalTurnovers(completed)

    const totalORTime = calculateSum(orTimes) || 0
    const totalSurgicalTime = calculateSum(incisionToClosingTimes) || 0
    const uptimePercent = totalORTime > 0 ? Math.round((totalSurgicalTime / totalORTime) * 100) : 0

    return {
      totalCases: completed.length,
      firstCaseStartTime: firstCaseTime,
      firstCaseScheduledTime,
      totalORTime,
      totalSurgicalTime,
      uptimePercent,
      avgORTime: calculateAverage(orTimes),
      avgSurgicalTime: calculateAverage(surgicalTimes),
      avgWheelsInToIncision: calculateAverage(wheelsInToIncisionTimes),
      avgIncisionToClosing: calculateAverage(incisionToClosingTimes),
      avgClosingTime: calculateAverage(closingTimes),
      avgClosedToWheelsOut: calculateAverage(closedToWheelsOutTimes),
      avgRoomTurnover: calculateAverage(roomTurnovers),
      avgSurgicalTurnover: calculateAverage(surgicalTurnovers),
      roomTurnoverCount: roomTurnovers.length,
      surgicalTurnoverCount: surgicalTurnovers.length,
    }
  }, [getCompletedCases])

  // Overview metrics
  const overviewMetrics = useMemo(() => {
    const completed = getCompletedCases(periodCases)
    const prevCompleted = getCompletedCases(prevPeriodCases)
    
    const orTimes = completed.map(c => getTotalORTime(getMilestoneMap(c)))
    const surgicalTimes = completed.map(c => getIncisionToClosing(getMilestoneMap(c)))
    const turnovers = getAllSameRoomSurgicalTurnovers(completed)
    
    const prevOrTimes = prevCompleted.map(c => getTotalORTime(getMilestoneMap(c)))
    const prevTurnovers = getAllSameRoomSurgicalTurnovers(prevCompleted)

    return {
      totalCases: completed.length,
      prevCases: prevCompleted.length,
      avgORTime: calculateAverage(orTimes),
      prevAvgORTime: calculateAverage(prevOrTimes),
      avgSurgicalTime: calculateAverage(surgicalTimes),
      avgTurnover: calculateAverage(turnovers),
      prevAvgTurnover: calculateAverage(prevTurnovers),
      totalORTime: calculateSum(orTimes) || 0,
    }
  }, [periodCases, prevPeriodCases, getCompletedCases])

  // Day metrics
  const dayMetrics = useMemo(() => calculateDayMetrics(dayCases), [dayCases, calculateDayMetrics])
  // Case breakdown for day analysis — dynamic phases from phase_definitions
  const phaseTree = useMemo(() => buildPhaseTree(phaseDefinitions), [phaseDefinitions])

  // Procedure medians from last 30 days (for flag detection)
  const procedureMedians = useMemo(
    () => computeProcedureMedians(last30DaysCases, phaseDefinitions),
    [last30DaysCases, phaseDefinitions],
  )

  // Flag detection per case
  const caseFlagsMap = useMemo(() => {
    const completedCases = getCompletedCases(dayCases)
    const map: Record<string, CaseFlag[]> = {}
    completedCases.forEach((c, idx) => {
      map[c.id] = detectCaseFlags(c, idx, completedCases, procedureMedians, phaseDefinitions)
    })
    return map
  }, [dayCases, getCompletedCases, procedureMedians, phaseDefinitions])

  // Aggregated day flags for sidebar
  const allDayFlags = useMemo(
    () => aggregateDayFlags(getCompletedCases(dayCases), caseFlagsMap),
    [dayCases, getCompletedCases, caseFlagsMap],
  )

  // Flag counts for summary strip
  const flagCounts = useMemo(() => {
    let warningCount = 0
    let positiveCount = 0
    for (const flags of Object.values(caseFlagsMap)) {
      for (const f of flags) {
        if (f.severity === 'warning' || f.severity === 'caution') warningCount++
        if (f.severity === 'positive') positiveCount++
      }
    }
    return { warningCount, positiveCount }
  }, [caseFlagsMap])

  // Day medians — median per phase/sub-phase from today's cases
  const dayMedians = useMemo(() => {
    const completedCases = getCompletedCases(dayCases)
    const buckets = new Map<string, number[]>()

    for (const c of completedCases) {
      const timestampMap = buildMilestoneTimestampMap(c.case_milestones || [])
      const durations = computePhaseDurations(phaseDefinitions, timestampMap)
      for (const phase of durations) {
        if (phase.durationSeconds === null || phase.durationSeconds <= 0) continue
        const existing = buckets.get(phase.phaseId) || []
        existing.push(phase.durationSeconds)
        buckets.set(phase.phaseId, existing)
      }
    }

    const result: Record<string, number> = {}
    for (const [key, values] of buckets) {
      const median = calculateMedian(values)
      if (median !== null) result[key] = median
    }
    return result
  }, [dayCases, getCompletedCases, phaseDefinitions])

  // Historical medians for phase comparison sidebar (keyed by phaseId, not procedureId:phaseId)
  const historicalPhaseMedians = useMemo(() => {
    const buckets = new Map<string, number[]>()

    for (const c of last30DaysCases) {
      const completedCheck = getMilestoneMap(c)
      if (!completedCheck.patient_in || !completedCheck.patient_out) continue
      const timestampMap = buildMilestoneTimestampMap(c.case_milestones || [])
      const durations = computePhaseDurations(phaseDefinitions, timestampMap)
      for (const phase of durations) {
        if (phase.durationSeconds === null || phase.durationSeconds <= 0) continue
        const existing = buckets.get(phase.phaseId) || []
        existing.push(phase.durationSeconds)
        buckets.set(phase.phaseId, existing)
      }
    }

    const result: Record<string, number> = {}
    for (const [key, values] of buckets) {
      const median = calculateMedian(values)
      if (median !== null) result[key] = median
    }
    return result
  }, [last30DaysCases, phaseDefinitions])

  // Timeline case data — transforms caseBreakdown into TimelineCaseData[] with sub-phase offsets
  const timelineCases = useMemo((): TimelineCaseData[] => {
    const completedCases = getCompletedCases(dayCases)

    return completedCases.map(c => {
      const m = getMilestoneMap(c)
      const proc = Array.isArray(c.procedure_types) ? c.procedure_types[0] : c.procedure_types
      const timestampMap = buildMilestoneTimestampMap(c.case_milestones || [])
      const durations = computePhaseDurations(phaseDefinitions, timestampMap)
      const subphaseOffsets = computeSubphaseOffsets(phaseDefinitions, durations, timestampMap, resolveSubphaseHex)

      // Build a lookup of subphase offsets by parent phase ID
      const subphaseByParent = new Map(subphaseOffsets.map(p => [p.phaseId, p.subphases]))

      // Compute actual start/end timestamps for each phase (for timing-overlap detection)
      const phaseTimings = new Map<string, { startMs: number; endMs: number }>()
      for (const phaseDef of phaseDefinitions) {
        const startTs = timestampMap.get(phaseDef.start_milestone_id)
        const endTs = timestampMap.get(phaseDef.end_milestone_id)
        if (startTs && endTs) {
          const startMs = new Date(startTs).getTime()
          const endMs = new Date(endTs).getTime()
          if (!isNaN(startMs) && !isNaN(endMs) && endMs > startMs) {
            phaseTimings.set(phaseDef.id, { startMs, endMs })
          }
        }
      }

      // Build initial phases from phaseTree (includes all top-level nodes)
      const allPhases: TimelineCasePhase[] = phaseTree.map(node => {
        const dur = durations.find(d => d.phaseId === node.phase.id)
        const subs = (subphaseByParent.get(node.phase.id) || []).map(sub => ({
          phaseId: sub.phaseId,
          label: sub.label,
          color: sub.color,
          durationSeconds: sub.durationSeconds,
          offsetSeconds: sub.offsetSeconds,
        }))

        return {
          phaseId: node.phase.id,
          label: dur?.displayName ?? node.phase.display_name,
          color: resolvePhaseHex(dur?.colorKey ?? (node.phase as typeof node.phase & { color_key?: string | null }).color_key),
          durationSeconds: dur?.durationSeconds ?? 0,
          subphases: subs,
        }
      }).filter(p => p.durationSeconds > 0)

      // Detect timing containment: if phase A's time span is fully within phase B's,
      // merge A into B as a sub-phase (handles cases where parent_phase_id isn't set)
      const childIds = new Set<string>()
      const mergedSubs = new Map<string, TimelineCaseSubphase[]>()

      for (const phaseA of allPhases) {
        const timingA = phaseTimings.get(phaseA.phaseId)
        if (!timingA) continue

        for (const phaseB of allPhases) {
          if (phaseA.phaseId === phaseB.phaseId) continue
          const timingB = phaseTimings.get(phaseB.phaseId)
          if (!timingB) continue

          // Check if A is fully contained within B
          if (timingA.startMs >= timingB.startMs && timingA.endMs <= timingB.endMs) {
            childIds.add(phaseA.phaseId)
            const offsetSeconds = (timingA.startMs - timingB.startMs) / 1000
            const existing = mergedSubs.get(phaseB.phaseId) || []
            existing.push({
              phaseId: phaseA.phaseId,
              label: phaseA.label,
              color: phaseA.color,
              durationSeconds: phaseA.durationSeconds,
              offsetSeconds,
            })
            mergedSubs.set(phaseB.phaseId, existing)
            break // A can only be child of one parent
          }
        }
      }

      // Build final phases: remove children from top-level, add merged sub-phases
      const phases = allPhases
        .filter(p => !childIds.has(p.phaseId))
        .map(p => {
          const additional = mergedSubs.get(p.phaseId) || []
          if (additional.length > 0 && p.subphases.length === 0) {
            return { ...p, subphases: additional }
          }
          return p
        })

      const startTime = m.patient_in ?? new Date()
      const endTime = m.patient_out ?? new Date()

      return {
        id: c.id,
        caseNumber: c.case_number,
        procedure: proc?.name || 'Unknown',
        room: c.or_rooms?.name || 'Unknown',
        startTime,
        endTime,
        phases,
      }
    })
  }, [dayCases, getCompletedCases, phaseDefinitions, phaseTree])

  // Max total seconds for the case breakdown bar scaling
  const maxTimelineCaseSeconds = useMemo(() => {
    return Math.max(...timelineCases.map(c => c.phases.reduce((s, p) => s + p.durationSeconds, 0)), 1)
  }, [timelineCases])

  // Convert procedureMedians to Record<string, number> keyed by phaseId for CaseDetailPanel
  const selectedCaseMedians = useMemo((): Record<string, number> => {
    if (!selectedCaseId) return {}
    const selectedCase = getCompletedCases(dayCases).find(c => c.id === selectedCaseId)
    if (!selectedCase) return {}
    const proc = Array.isArray(selectedCase.procedure_types) ? selectedCase.procedure_types[0] : selectedCase.procedure_types
    if (!proc) return {}

    const result: Record<string, number> = {}
    for (const [key, value] of procedureMedians) {
      // Keys are `procedureId:phaseId` — only include matching procedure
      if (key.startsWith(`${proc.id}:`)) {
        const phaseId = key.slice(proc.id.length + 1)
        result[phaseId] = value
      }
    }
    return result
  }, [selectedCaseId, dayCases, getCompletedCases, procedureMedians])

  // Daily trend data for overview chart
  const dailyTrendData = useMemo(() => {
    const byDate: { [key: string]: CaseWithMilestones[] } = {}
    periodCases.forEach(c => {
      if (!byDate[c.scheduled_date]) byDate[c.scheduled_date] = []
      byDate[c.scheduled_date].push(c)
    })

    return Object.entries(byDate)
      .map(([date, cases]) => {
        const completed = getCompletedCases(cases)
        const orTimes = completed.map(c => getTotalORTime(getMilestoneMap(c)))
        return {
          date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          rawDate: date,
          'Cases': completed.length,
          avgORTime: Math.round((calculateAverage(orTimes) || 0) / 60),
        }
      })
      .sort((a, b) => a.rawDate.localeCompare(b.rawDate))
  }, [periodCases, getCompletedCases])

  // ============================================
  // RENDER
  // ============================================

  // Loading states
  if (!userLoading && !can('analytics.view')) {
    return (
      <DashboardLayout>
        <AccessDenied />
      </DashboardLayout>
    )
  }

  if (userLoading || initialLoading) {
    return (
      <DashboardLayout>
        <div className="min-h-screen bg-slate-50/50">
          <Container className="py-8">
            <SkeletonMetricCards count={4} />
            <div className="mt-6">
              <SkeletonChart height={200} />
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
            <EmptyState
              icon={
                <Building2 className="w-8 h-8 text-slate-400" />
              }
              title={isGlobalAdmin ? 'Select a Facility' : 'No Facility Assigned'}
              description={isGlobalAdmin ? 'Choose a facility from the top bar to view surgeon analytics.' : 'Contact your administrator to be assigned to a facility.'}
            />
          </Container>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-slate-50/50">
        <Container className="py-8">
          {/* Condensed Header */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-6">
            {/* Row 1: Surgeon selector + View toggle + Date nav */}
            <div className="flex items-center px-4 py-2.5 gap-3 border-b border-slate-100">
              {/* Surgeon selector */}
              <SurgeonSelector
                surgeons={surgeons}
                selectedId={selectedSurgeon}
                onChange={setSelectedSurgeon}
                placeholder="Choose surgeon..."
              />

              {selectedSurgeon && (
                <>
                  {/* Divider */}
                  <div className="w-px h-6 bg-slate-200 flex-shrink-0" />

                  {/* View toggle */}
                  <div className="flex border border-slate-200 rounded-md overflow-hidden">
                    <button
                      onClick={() => setActiveTab('overview')}
                      className={`px-3 py-1 text-xs font-medium transition-colors ${
                        activeTab === 'overview'
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-500 hover:text-slate-700 bg-white'
                      }`}
                    >
                      Overview
                    </button>
                    <button
                      onClick={() => setActiveTab('day')}
                      className={`px-3 py-1 text-xs font-medium transition-colors ${
                        activeTab === 'day'
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-500 hover:text-slate-700 bg-white'
                      }`}
                    >
                      Day Analysis
                    </button>
                  </div>

                  {/* Date nav — pushed right */}
                  <div className="flex items-center gap-2 ml-auto">
                    {activeTab === 'day' ? (
                      <>
                        <button
                          onClick={() => {
                            const d = new Date(selectedDate)
                            d.setDate(d.getDate() - 1)
                            setSelectedDate(getLocalDateString(d))
                          }}
                          className="w-7 h-7 flex items-center justify-center border border-slate-200 rounded-md hover:bg-slate-50 text-slate-500 transition-colors"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <DatePickerCalendar value={selectedDate} onChange={setSelectedDate} highlightedDates={surgeonCaseDates} />
                        <button
                          onClick={() => {
                            const d = new Date(selectedDate)
                            d.setDate(d.getDate() + 1)
                            setSelectedDate(getLocalDateString(d))
                          }}
                          className="w-7 h-7 flex items-center justify-center border border-slate-200 rounded-md hover:bg-slate-50 text-slate-500 transition-colors"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setSelectedDate(getLocalDateString())}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-700 ml-1"
                        >
                          Today
                        </button>
                      </>
                    ) : (
                      <DateRangeSelector value={dateRange} onChange={handleDateRangeChange} />
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Row 2: Compact inline stats (Day Analysis only) */}
            {selectedSurgeon && activeTab === 'day' && !loading && (
              <div className="flex items-center px-4 py-2 gap-4">
                <CompactStat
                  label="First Case"
                  value={formatTimeInTimezone(dayMetrics.firstCaseStartTime?.toISOString() ?? null, facilityTimezone) || '--'}
                  sub={dayMetrics.firstCaseScheduledTime
                    ? `(sched ${(() => {
                        const [hours, minutes] = dayMetrics.firstCaseScheduledTime.split(':')
                        const h = parseInt(hours)
                        const suffix = h >= 12 ? 'p' : 'a'
                        const displayHour = h > 12 ? h - 12 : (h === 0 ? 12 : h)
                        return `${displayHour}:${minutes}${suffix}`
                      })()})`
                    : undefined}
                />
                <StatDivider />
                <CompactStat label="Cases" value={dayMetrics.totalCases.toString()} />
                <StatDivider />
                <CompactStat label="OR Time" value={formatMinutesToHHMMSS(dayMetrics.totalORTime)} />
                <StatDivider />
                <CompactStat label="Surgical" value={formatMinutesToHHMMSS(dayMetrics.totalSurgicalTime)} />
                <StatDivider />
                <FlagCountPills warningCount={flagCounts.warningCount} positiveCount={flagCounts.positiveCount} />

                {/* Surgical uptime — pushed right */}
                <div className="ml-auto flex items-center gap-1.5">
                  <MiniUptimeRing percent={dayMetrics.uptimePercent} />
                  <span className="text-[11px] text-slate-500 font-medium">Surgical</span>
                </div>
              </div>
            )}
          </div>

          {!selectedSurgeon ? (
            <EmptyState
              icon={
                <UserIcon className="w-8 h-8 text-slate-400" />
              }
              title="Select a Surgeon"
              description="Choose a surgeon above to view their performance metrics and trends."
            />
          ) : (
            <div className="space-y-6">
              {loading ? (
                activeTab === 'overview' ? (
                  <div className="space-y-6">
                    <SkeletonMetricCards count={4} />
                    <SkeletonChart height={200} />
                    <SkeletonTable rows={4} />
                  </div>
                ) : (
                  <SkeletonDayAnalysis />
                )
              ) : activeTab === 'overview' ? (
                /* ============================================ */
                /* OVERVIEW TAB */
                /* ============================================ */
                <div className="space-y-6">

                  {/* KPI Cards */}
                  <div className="grid grid-cols-4 gap-4">
                    <EnhancedMetricCard
                      title="Total Cases"
                      value={overviewMetrics.totalCases.toString()}
                      accentColor="blue"
                      icon={
                        <ClipboardList className="w-4 h-4" />
                      }
                      trend={overviewMetrics.prevCases > 0 ? {
                        value: Math.abs(Math.round(((overviewMetrics.totalCases - overviewMetrics.prevCases) / overviewMetrics.prevCases) * 100)),
                        improved: overviewMetrics.totalCases >= overviewMetrics.prevCases,
                        label: 'vs prev period',
                      } : undefined}
                    />
                    <EnhancedMetricCard
                      title="Avg OR Time"
                      value={formatMinutesToHHMMSS(overviewMetrics.avgORTime)}
                      accentColor="green"
                      subtitle="per case"
                      icon={
                        <Clock className="w-4 h-4" />
                      }
                    />
                    <EnhancedMetricCard
                      title="Avg Turnover"
                      value={overviewMetrics.avgTurnover ? formatMinutesToHHMMSS(overviewMetrics.avgTurnover) : 'N/A'}
                      accentColor="amber"
                      icon={
                        <RefreshCw className="w-4 h-4" />
                      }
                      trend={overviewMetrics.prevAvgTurnover && overviewMetrics.avgTurnover ? {
                        value: Math.abs(Math.round(((overviewMetrics.avgTurnover - overviewMetrics.prevAvgTurnover) / overviewMetrics.prevAvgTurnover) * 100)),
                        improved: overviewMetrics.avgTurnover <= overviewMetrics.prevAvgTurnover,
                        label: 'vs prev period',
                      } : undefined}
                    />
                    <EnhancedMetricCard
                      title="Total OR Time"
                      value={formatMinutesToHHMMSS(overviewMetrics.totalORTime)}
                      accentColor="violet"
                      subtitle="cumulative"
                      icon={
                        <Clock className="w-4 h-4" />
                      }
                    />
                  </div>

                  {/* Trend Chart */}
                  {dailyTrendData.length > 0 && (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                      <SectionHeader
                        title="Daily Case Volume"
                        subtitle="Cases per day over the selected period"
                        accentColor="blue"
                        icon={
                          <BarChart3 className="w-4 h-4" />
                        }
                      />
                      <BarChart
                        className="h-48 mt-4"
                        data={dailyTrendData}
                        index="date"
                        categories={['Cases']}
                        colors={['blue']}
                        valueFormatter={(v: number) => v.toString()}
                        yAxisWidth={32}
                        showLegend={false}
                        showAnimation={true}
                      />
                    </div>
                  )}

                  {/* Procedure Breakdown + Comparison Charts */}
                  <div className={`grid gap-6 ${hasComparisonData ? 'grid-cols-1 lg:grid-cols-3' : 'grid-cols-1'}`}>
                    {/* Procedure Breakdown */}
                    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm p-6 ${hasComparisonData ? '' : 'lg:col-span-3'}`}>
                      <SectionHeader
                        title="Procedure Breakdown"
                        subtitle="Performance by procedure type"
                        accentColor="green"
                        icon={
                          <Archive className="w-4 h-4" />
                        }
                      />
                      
                      {procedureBreakdown.length > 0 ? (
                        <div className="space-y-3 mt-4">
                          {procedureBreakdown.map(proc => {
                            const consistencyLevel = getConsistencyLevel(proc.avg_surgical_seconds, proc.stddev_surgical_seconds)
                            const consistency = getConsistencyLabel(proc.avg_surgical_seconds, proc.stddev_surgical_seconds)
                            return (
                              <div key={proc.procedure_id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100/80 transition-colors">
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium text-slate-900 truncate">{proc.procedure_name}</p>
                                  <p className="text-sm text-slate-500">{proc.case_count} case{proc.case_count !== 1 ? 's' : ''}</p>
                                </div>
                                <div className="flex items-center gap-4 ml-4">
                                  <ConsistencyBadge label={consistency.label} level={consistencyLevel} />
                                  <span className="font-mono font-semibold text-slate-900 tabular-nums text-right min-w-[80px]">
                                    {proc.avg_surgical_seconds ? formatSecondsToHHMMSS(Math.round(proc.avg_surgical_seconds)) : '--'}
                                  </span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="mt-4">
                          <EmptyState
                            icon={
                              <Archive className="w-6 h-6 text-slate-400" />
                            }
                            title="No Procedure Data"
                            description="No completed procedures found for the selected period."
                          />
                        </div>
                      )}
                    </div>

                    {/* TKA Comparison Chart */}
                    {tkaComparisonData.length > 0 && (
                      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                        <SectionHeader
                          title="TKA Surgical Time"
                          subtitle="Robotic vs Traditional (minutes)"
                          accentColor="blue"
                          icon={
                            <TrendingUp className="w-4 h-4" />
                          }
                        />
                        <AreaChart
                          className="h-52 mt-4"
                          data={tkaComparisonData}
                          index="date"
                          categories={['Robotic (Mako)', 'Traditional']}
                          colors={['cyan', 'rose']}
                          valueFormatter={(v) => v.toString()}
                          yAxisWidth={40}
                          showAnimation={true}
                          connectNulls={true}
                          showLegend={true}
                        />
                      </div>
                    )}

                    {/* THA Comparison Chart */}
                    {thaComparisonData.length > 0 && (
                      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                        <SectionHeader
                          title="THA Surgical Time"
                          subtitle="Robotic vs Traditional (minutes)"
                          accentColor="blue"
                          icon={
                            <TrendingUp className="w-4 h-4" />
                          }
                        />
                        <AreaChart
                          className="h-52 mt-4"
                          data={thaComparisonData}
                          index="date"
                          categories={['Robotic (Mako)', 'Traditional']}
                          colors={['cyan', 'rose']}
                          valueFormatter={(v) => v.toString()}
                          yAxisWidth={40}
                          showAnimation={true}
                          connectNulls={true}
                          showLegend={true}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* ============================================ */
                /* DAY ANALYSIS TAB */
                /* ============================================ */
                <div className="space-y-6">
                  {/* 1. Timeline Card */}
                  {timelineCases.length > 0 && (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-slate-900">OR Timeline</h3>
                        <PhaseTreeLegend
                          phaseTree={phaseTree}
                          resolveHex={resolvePhaseHex}
                          resolveSubHex={resolveSubphaseHex}
                        />
                      </div>
                      <DayTimeline
                        cases={timelineCases}
                        caseFlags={caseFlagsMap}
                      />
                    </div>
                  )}

                  {/* 3. Bottom Split — Case Breakdown + Sidebar */}
                  <div className="flex flex-col lg:flex-row gap-4">
                    {/* Case Breakdown (flex-1) */}
                    <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                      <SectionHeader
                        title="Case Breakdown"
                        subtitle={`${dayMetrics.totalCases} case${dayMetrics.totalCases !== 1 ? 's' : ''} completed`}
                        accentColor="blue"
                        icon={<ClipboardList className="w-4 h-4" />}
                      />

                      {phaseDefinitions.length === 0 ? (
                        <div className="mt-4">
                          <EmptyState
                            icon={<Info className="w-6 h-6 text-slate-400" />}
                            title="No Phases Configured"
                            description="This facility has no phase definitions configured. Set up phases in Settings to see case breakdowns."
                          />
                        </div>
                      ) : timelineCases.length === 0 ? (
                        <div className="mt-4">
                          <EmptyState
                            icon={<ClipboardList className="w-6 h-6 text-slate-400" />}
                            title="No Cases"
                            description="No completed cases for this date."
                          />
                        </div>
                      ) : (
                        <div className="space-y-1 mt-3">
                          {timelineCases.map(c => {
                            const totalSeconds = c.phases.reduce((s, p) => s + p.durationSeconds, 0)
                            return (
                              <CasePhaseBarNested
                                key={c.id}
                                caseNumber={c.caseNumber}
                                procedureName={c.procedure}
                                phases={c.phases}
                                totalSeconds={totalSeconds}
                                maxTotalSeconds={maxTimelineCaseSeconds}
                                isSelected={selectedCaseId === c.id}
                                onSelect={() => setSelectedCaseId(prev => prev === c.id ? null : c.id)}
                                flags={caseFlagsMap[c.id] || []}
                              />
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {/* Sidebar (425px) */}
                    <div className="lg:w-[425px] w-full space-y-4">
                      {/* Phase Medians Card (always visible) */}
                      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                        <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-3">Phase Medians</h4>
                        <PhaseMedianComparison
                          dayMedians={dayMedians}
                          historicalMedians={historicalPhaseMedians}
                          phaseTree={phaseTree}
                          resolveHex={resolvePhaseHex}
                        />
                      </div>

                      {/* Contextual Card — case detail or flag list */}
                      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 transition-all duration-200">
                        {selectedCaseId && timelineCases.find(c => c.id === selectedCaseId) ? (
                          <>
                            <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-3">Case Detail</h4>
                            <CaseDetailPanel
                              caseData={timelineCases.find(c => c.id === selectedCaseId)!}
                              flags={caseFlagsMap[selectedCaseId] || []}
                              procedureMedians={selectedCaseMedians}
                            />
                          </>
                        ) : (
                          <>
                            <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-3">Day Flags</h4>
                            <SidebarFlagList flags={allDayFlags} />
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                </div>
              )}
            </div>
          )}
        </Container>
      </div>
    </DashboardLayout>
  )
}