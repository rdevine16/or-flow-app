'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import { getImpersonationState } from '@/lib/impersonation'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import { AnalyticsPageHeader } from '@/components/analytics/AnalyticsBreadcrumb'
import { formatTimeInTimezone } from '@/lib/date-utils'

import { useSurgeons, useProcedureTypes } from '@/hooks'
import DateRangeSelector, { getPresetDates, getPrevPeriodDates } from '@/components/ui/DateRangeSelector'


// Tremor components
import {
  AreaChart,
  BarChart,
  DonutChart,
  BarList,
  Legend,
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
  calculateSum,
  calculatePercentageChange,
  formatMinutesToHHMMSS,
  formatSecondsToHHMMSS,
  getAllTurnovers,
  getAllSurgicalTurnovers,
  type CaseWithMilestones,
} from '@/lib/analyticsV2'

// Enterprise analytics components
import {
import { Archive, BarChart3, Building2, ChevronLeft, ChevronRight, ClipboardList, Clock, Pencil, RefreshCw, TrendingUp, User } from 'lucide-react'
  SectionHeader,
  EnhancedMetricCard,
  TrendPill,
  RadialProgress,
  SurgeonSelector,
  ConsistencyBadge,
  InlineBar,
  CasePhaseBar,
  PhaseLegend,
  InsightCard,
  EmptyState,
  ProcedureComparisonChart,
  type ProcedureComparisonData,
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

interface ProcedureType {
  id: string
  name: string
  technique_id?: string
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
  if (cv < 10) return { label: 'Very Consistent', color: 'text-emerald-600' }
  if (cv < 20) return { label: 'Consistent', color: 'text-blue-600' }
  return { label: 'Variable', color: 'text-amber-600' }
}

function getConsistencyLevel(avgSeconds: number | null, stddevSeconds: number | null): 'very_consistent' | 'consistent' | 'variable' | 'na' {
  if (!avgSeconds || !stddevSeconds || avgSeconds === 0) return 'na'
  const cv = (stddevSeconds / avgSeconds) * 100
  if (cv < 10) return 'very_consistent'
  if (cv < 20) return 'consistent'
  return 'variable'
}

// ============================================
// TAB BUTTON COMPONENT
// ============================================

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
        active
          ? 'bg-white text-slate-900 shadow-sm'
          : 'text-slate-500 hover:text-slate-700'
      }`}
    >
      {children}
    </button>
  )
}

// ============================================
// PHASE COLORS (shared constants)
// ============================================

const PHASE_COLORS = {
  preOp: '#2563EB',     // blue-600
  surgical: '#60A5FA',  // blue-400
  closing: '#10B981',   // emerald-500
  emergence: '#FBBF24', // amber-400
}

const PHASE_LEGEND_ITEMS = [
  { label: 'Pre-Op', color: PHASE_COLORS.preOp },
  { label: 'Surgical', color: PHASE_COLORS.surgical },
  { label: 'Closing', color: PHASE_COLORS.closing },
  { label: 'Emergence', color: PHASE_COLORS.emergence },
]

// ============================================
// MAIN PAGE COMPONENT
// ============================================

export default function SurgeonPerformancePage() {
  const supabase = createClient()
  const { userData, loading: userLoading, isGlobalAdmin } = useUser()
  
  // State
  const [effectiveFacilityId, setEffectiveFacilityId] = useState<string | null>(null)
  const [facilityTimezone, setFacilityTimezone] = useState<string>('America/New_York')
  const [surgeons, setSurgeons] = useState<Surgeon[]>([])
  const [procedures, setProcedures] = useState<ProcedureType[]>([])
  const [procedureTechniques, setProcedureTechniques] = useState<ProcedureTechnique[]>([])
  const [selectedSurgeon, setSelectedSurgeon] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'day'>('overview')
  
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
  const [allTimeCases, setAllTimeCases] = useState<CaseWithMilestones[]>([])

  
  const [loading, setLoading] = useState(true)
  const [initialLoading, setInitialLoading] = useState(true)

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
  }, [effectiveFacilityId])

  // Fetch surgeons, procedures, and techniques
  useEffect(() => {
    if (!effectiveFacilityId) return
    
    async function fetchData() {
      const { data: surgeonRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('name', 'surgeon')
        .single()

      const [surgeonsRes, proceduresRes, techniquesRes] = await Promise.all([
        supabase
          .from('users')
          .select('id, first_name, last_name, role_id')
          .eq('facility_id', effectiveFacilityId)
          .order('last_name'),
        supabase
          .from('procedure_types')
          .select('id, name, technique_id')
          .eq('facility_id', effectiveFacilityId)
          .order('name'),
        supabase
          .from('procedure_techniques')
          .select('id, name, display_name')
          .order('display_order'),
      ])

      setSurgeons((surgeonsRes.data?.filter(u => u.role_id === surgeonRole?.id) as Surgeon[]) || [])
      setProcedures(proceduresRes.data || [])
      setProcedureTechniques(techniquesRes.data || [])
      setInitialLoading(false)
    }
    fetchData()
  }, [effectiveFacilityId])

  // Helper to get date range (handles custom dates)
  const getEffectiveDateRange = () => {
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
 }

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
}, [selectedSurgeon, overviewStart, overviewEnd, effectiveFacilityId, activeTab])
  // Handle custom date change
const handleDateRangeChange = (range: string, startDate: string, endDate: string) => {
  setDateRange(range)
  setOverviewStart(startDate)
  setOverviewEnd(endDate)
}

  // Fetch Day Analysis data
  useEffect(() => {
    if (!selectedSurgeon || !effectiveFacilityId || activeTab !== 'day') {
      setDayCases([])
      setLast30DaysCases([])
      setAllTimeCases([])
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

      const [dayRes, last30Res, allTimeRes] = await Promise.all([
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
        supabase.from('cases').select(caseSelect)
          .eq('facility_id', effectiveFacilityId)
          .eq('surgeon_id', selectedSurgeon),
      ])

      setDayCases((dayRes.data as unknown as CaseWithMilestones[]) || [])
      setLast30DaysCases((last30Res.data as unknown as CaseWithMilestones[]) || [])
      setAllTimeCases((allTimeRes.data as unknown as CaseWithMilestones[]) || [])
      setLoading(false)
    }

    fetchDayData()
  }, [selectedSurgeon, selectedDate, effectiveFacilityId, activeTab])

  // Calculate procedure breakdown for overview
  const calculateProcedureBreakdown = (cases: CaseWithMilestones[]) => {
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
  }

  // Get completed cases
  const getCompletedCases = (cases: CaseWithMilestones[]) => {
    return cases.filter(c => {
      const m = getMilestoneMap(c)
      return m.patient_in && m.patient_out
    })
  }

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
  const calculateDayMetrics = (cases: CaseWithMilestones[]) => {
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

    const roomTurnovers = getAllTurnovers(completed)
    const surgicalTurnovers = getAllSurgicalTurnovers(completed)

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
  }

  // Overview metrics
  const overviewMetrics = useMemo(() => {
    const completed = getCompletedCases(periodCases)
    const prevCompleted = getCompletedCases(prevPeriodCases)
    
    const orTimes = completed.map(c => getTotalORTime(getMilestoneMap(c)))
    const surgicalTimes = completed.map(c => getIncisionToClosing(getMilestoneMap(c)))
    const turnovers = getAllSurgicalTurnovers(completed)
    
    const prevOrTimes = prevCompleted.map(c => getTotalORTime(getMilestoneMap(c)))
    const prevTurnovers = getAllSurgicalTurnovers(prevCompleted)

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
  }, [periodCases, prevPeriodCases])

  // Day metrics
  const dayMetrics = useMemo(() => calculateDayMetrics(dayCases), [dayCases])
  const last30Metrics = useMemo(() => calculateDayMetrics(last30DaysCases), [last30DaysCases])
  const allTimeMetrics = useMemo(() => calculateDayMetrics(allTimeCases), [allTimeCases])

  // Percentage changes for day analysis
  const turnoverVs30Day = calculatePercentageChange(dayMetrics.avgRoomTurnover, last30Metrics.avgRoomTurnover)
  const surgicalTurnoverVs30Day = calculatePercentageChange(dayMetrics.avgSurgicalTurnover, last30Metrics.avgSurgicalTurnover)
  const uptimeImprovement = allTimeMetrics.uptimePercent > 0 ? dayMetrics.uptimePercent - allTimeMetrics.uptimePercent : null

  // Case breakdown for day analysis
  const caseBreakdown = useMemo(() => {
    const completed = getCompletedCases(dayCases)
    return completed.map(c => {
      const m = getMilestoneMap(c)
      const proc = Array.isArray(c.procedure_types) ? c.procedure_types[0] : c.procedure_types
      return {
        id: c.id,
        caseNumber: c.case_number,
        procedureName: proc?.name || 'Unknown',
        totalORTime: getTotalORTime(m) || 0,
        wheelsInToIncision: getWheelsInToIncision(m) || 0,
        incisionToClosing: getIncisionToClosing(m) || 0,
        closingTime: getClosingTime(m) || 0,
        closedToWheelsOut: getClosedToWheelsOut(m) || 0,
      }
    })
  }, [dayCases])

  const maxCaseTime = Math.max(...caseBreakdown.map(c => c.totalORTime), 1)

  // Procedure performance for day analysis
  const getProcedurePerformance = (): ProcedureComparisonData[] => {
    const completedCases = getCompletedCases(dayCases)
    const completed30DayCases = getCompletedCases(last30DaysCases)
    
    // Group today's cases by procedure type
    const byProcedure = new Map<string, { name: string; cases: CaseWithMilestones[] }>()
    
    completedCases.forEach(c => {
      const proc = Array.isArray(c.procedure_types) ? c.procedure_types[0] : c.procedure_types
      if (!proc?.id) return
      if (!byProcedure.has(proc.id)) {
        byProcedure.set(proc.id, { name: proc.name, cases: [] })
      }
      byProcedure.get(proc.id)!.cases.push(c)
    })

    return Array.from(byProcedure.entries()).map(([procId, { name, cases }]) => {
      // Today's averages for this procedure
      const todayOrTimes = cases.map(c => getTotalORTime(getMilestoneMap(c)))
      const todaySurgTimes = cases.map(c => getSurgicalTime(getMilestoneMap(c)))

      // 30-day averages for this procedure (exclude today's cases)
      const baseline30Day = completed30DayCases.filter(c => {
        const proc = Array.isArray(c.procedure_types) ? c.procedure_types[0] : c.procedure_types
        return proc?.id === procId
      })
      const baselineOrTimes = baseline30Day.map(c => getTotalORTime(getMilestoneMap(c)))
      const baselineSurgTimes = baseline30Day.map(c => getSurgicalTime(getMilestoneMap(c)))

      return {
        procedureName: name,
        procedureId: procId,
        caseCount: cases.length,
        todayORTime: calculateAverage(todayOrTimes) || 0,
        avgORTime: calculateAverage(baselineOrTimes) || 0,
        todaySurgicalTime: calculateAverage(todaySurgTimes) || 0,
        avgSurgicalTime: calculateAverage(baselineSurgTimes) || 0,
      }
    })
  }

  const procedurePerformance = useMemo(() => getProcedurePerformance(), [dayCases, last30DaysCases])

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
  }, [periodCases])

  const selectedSurgeonData = surgeons.find(s => s.id === selectedSurgeon)
  const { label: periodLabel } = getEffectiveDateRange()

  // ============================================
  // RENDER
  // ============================================

  // Loading states
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
          <AnalyticsPageHeader
            title="Surgeon Performance"
            description="Track individual surgeon metrics and trends"
            icon={UserIcon}
            actions={
              <SurgeonSelector
                surgeons={surgeons}
                selectedId={selectedSurgeon}
                onChange={setSelectedSurgeon}
                placeholder="Choose surgeon..."
              />
            }
          />

          {!selectedSurgeon ? (
            <EmptyState
              icon={
                <User className="w-8 h-8 text-slate-400" />
              }
              title="Select a Surgeon"
              description="Choose a surgeon above to view their performance metrics and trends."
            />
          ) : (
            <div className="space-y-6">
              {/* Surgeon Header + Tabs */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                      <span className="text-lg font-bold text-white">
                        {selectedSurgeonData?.first_name?.charAt(0)}{selectedSurgeonData?.last_name?.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">
                        Dr. {selectedSurgeonData?.first_name} {selectedSurgeonData?.last_name}
                      </h2>
                      <p className="text-sm text-slate-500">
                        {activeTab === 'overview' ? periodLabel : formatDateDisplay(selectedDate)}
                      </p>
                    </div>
                  </div>
                  
                  {/* Tabs */}
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                    <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')}>
                      Overview
                    </TabButton>
                    <TabButton active={activeTab === 'day'} onClick={() => setActiveTab('day')}>
                      Day Analysis
                    </TabButton>
                  </div>
                </div>
              </div>

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
                  {/* Period Selector */}
                  <div className="flex justify-end">
<DateRangeSelector value={dateRange} onChange={handleDateRangeChange} />
                  </div>

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
                      accentColor="emerald"
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
                        accentColor="emerald"
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
                  {/* Date Picker */}
                  <div className="flex justify-end">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const d = new Date(selectedDate)
                          d.setDate(d.getDate() - 1)
                          setSelectedDate(getLocalDateString(d))
                        }}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-shadow"
                      />
                      <button
                        onClick={() => {
                          const d = new Date(selectedDate)
                          d.setDate(d.getDate() + 1)
                          setSelectedDate(getLocalDateString(d))
                        }}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => setSelectedDate(getLocalDateString())}
                        className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        Today
                      </button>
                    </div>
                  </div>

                  {/* Day Overview Section */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <SectionHeader
                      title="Day Overview"
                      subtitle="Track efficiency by measuring key time metrics"
                      accentColor="blue"
                      icon={
                        <Pencil className="w-4 h-4" />
                      }
                    />

                    {/* Top Metrics Row */}
                    <div className="grid grid-cols-4 gap-4 mt-6">
                      <div className="bg-slate-50/80 rounded-lg p-4">
                        <div className="flex items-center gap-2 text-slate-500 text-sm mb-1.5">
                          <Clock className="w-4 h-4 text-blue-500" />
                          First Case Start
                        </div>
                        <div className="text-2xl font-bold text-slate-900 tabular-nums">
                          {formatTimeInTimezone(dayMetrics.firstCaseStartTime?.toISOString() ?? null, facilityTimezone)}
                        </div>
                        {dayMetrics.firstCaseScheduledTime && (
                          <div className="text-xs text-slate-500 mt-1">
                            Scheduled: {(() => {
                              const [hours, minutes] = dayMetrics.firstCaseScheduledTime.split(':')
                              const h = parseInt(hours)
                              const suffix = h >= 12 ? 'pm' : 'am'
                              const displayHour = h > 12 ? h - 12 : (h === 0 ? 12 : h)
                              return `${displayHour}:${minutes} ${suffix}`
                            })()}
                          </div>
                        )}
                      </div>
                      <div className="bg-slate-50/80 rounded-lg p-4">
                        <div className="flex items-center gap-2 text-slate-500 text-sm mb-1.5">
                          <ClipboardList className="w-4 h-4 text-blue-500" />
                          Cases
                        </div>
                        <div className="text-2xl font-bold text-slate-900 tabular-nums">{dayMetrics.totalCases}</div>
                      </div>
                      <div className="bg-slate-50/80 rounded-lg p-4">
                        <div className="flex items-center gap-2 text-slate-500 text-sm mb-1.5">
                          <Clock className="w-4 h-4 text-emerald-500" />
                          Total OR Time
                        </div>
                        <div className="text-2xl font-bold text-slate-900 tabular-nums">{formatMinutesToHHMMSS(dayMetrics.totalORTime)}</div>
                      </div>
                      <div className="bg-slate-50/80 rounded-lg p-4">
                        <div className="flex items-center gap-2 text-slate-500 text-sm mb-1.5">
                          <Clock className="w-4 h-4 text-violet-500" />
                          Total Surgical Time
                        </div>
                        <div className="text-2xl font-bold text-slate-900 tabular-nums">{formatMinutesToHHMMSS(dayMetrics.totalSurgicalTime)}</div>
                      </div>
                    </div>

                    {/* Second Row - Turnovers and Uptime */}
                    <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-100">
                      {/* Surgical Turnover */}
                      <div className="bg-slate-50/80 rounded-lg p-4">
                        <div className="flex items-center gap-2 text-slate-500 text-sm mb-1.5">
                          <RefreshCw className="w-4 h-4 text-amber-500" />
                          Surgical Turnover
                        </div>
                        {dayMetrics.surgicalTurnoverCount > 0 ? (
                          <>
                            <div className="text-2xl font-bold text-slate-900 tabular-nums">{formatMinutesToHHMMSS(dayMetrics.avgSurgicalTurnover)}</div>
                            <div className="flex items-center gap-3 mt-2 text-sm">
                              {surgicalTurnoverVs30Day !== null && (
                                <TrendPill value={Math.abs(surgicalTurnoverVs30Day)} improved={surgicalTurnoverVs30Day >= 0} />
                              )}
                              <span className="text-slate-400 text-xs">avg. {formatMinutesToHHMMSS(last30Metrics.avgSurgicalTurnover)}</span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-xl font-bold text-slate-400 tabular-nums">N/A</div>
                            <div className="text-xs text-slate-400 mt-1">Requires 2+ cases in same room</div>
                          </>
                        )}
                      </div>

                      {/* Room Turnover */}
                      <div className="bg-slate-50/80 rounded-lg p-4">
                        <div className="flex items-center gap-2 text-slate-500 text-sm mb-1.5">
                          <RefreshCw className="w-4 h-4 text-amber-500" />
                          Room Turnover
                        </div>
                        {dayMetrics.roomTurnoverCount > 0 ? (
                          <>
                            <div className="text-2xl font-bold text-slate-900 tabular-nums">{formatMinutesToHHMMSS(dayMetrics.avgRoomTurnover)}</div>
                            <div className="flex items-center gap-3 mt-2 text-sm">
                              {turnoverVs30Day !== null && (
                                <TrendPill value={Math.abs(turnoverVs30Day)} improved={turnoverVs30Day >= 0} />
                              )}
                              <span className="text-slate-400 text-xs">avg. {formatMinutesToHHMMSS(last30Metrics.avgRoomTurnover)}</span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-xl font-bold text-slate-400 tabular-nums">N/A</div>
                            <div className="text-xs text-slate-400 mt-1">Requires 2+ cases in same room</div>
                          </>
                        )}
                      </div>
                      
                      {/* Uptime vs Downtime */}
                      <div className="bg-slate-50/80 rounded-lg p-4 col-span-2">
                        <div className="flex items-center gap-2 text-slate-500 text-sm mb-1.5">
                          <BarChart3 className="w-4 h-4 text-blue-500" />
                          Uptime vs Downtime
                        </div>
                        
                        {dayMetrics.totalORTime > 0 ? (
                          <>
                            <div className="flex items-baseline gap-2 mb-3">
                              <span className="text-2xl font-bold text-slate-900 tabular-nums">{dayMetrics.uptimePercent}%</span>
                              <span className="text-slate-300">·</span>
                              <span className="text-lg font-semibold text-slate-500 tabular-nums">{100 - dayMetrics.uptimePercent}%</span>
                              {uptimeImprovement !== null && (
                                <div className="ml-2">
                                  <TrendPill value={Math.abs(parseFloat(uptimeImprovement.toFixed(1)))} improved={uptimeImprovement >= 0} />
                                </div>
                              )}
                            </div>
                            <div className="h-3 w-full rounded-full overflow-hidden flex bg-slate-100">
                              <div className="h-full bg-blue-600 rounded-l-full transition-all duration-500" style={{ width: `${dayMetrics.uptimePercent}%` }} />
                              <div className="h-full bg-red-400 rounded-r-full transition-all duration-500" style={{ width: `${100 - dayMetrics.uptimePercent}%` }} />
                            </div>
                            <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                              <div className="flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                                <span>Surgical ({formatMinutesToHHMMSS(dayMetrics.totalSurgicalTime)})</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                                <span>Other ({formatMinutesToHHMMSS(dayMetrics.totalORTime - dayMetrics.totalSurgicalTime)})</span>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="text-xl font-bold text-slate-400 tabular-nums">--</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Cases and Procedure Performance */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Cases List with Enhanced Stacked Bars */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                      <SectionHeader
                        title="Case Breakdown"
                        subtitle={`${dayMetrics.totalCases} case${dayMetrics.totalCases !== 1 ? 's' : ''} completed`}
                        accentColor="blue"
                        icon={
                          <ClipboardList className="w-4 h-4" />
                        }
                      />

                      {caseBreakdown.length === 0 ? (
                        <div className="mt-4">
                          <EmptyState
                            icon={
                              <ClipboardList className="w-6 h-6 text-slate-400" />
                            }
                            title="No Cases"
                            description="No completed cases for this date."
                          />
                        </div>
                      ) : (
                        <>
                          <div className="mt-3 mb-3">
                            <PhaseLegend items={PHASE_LEGEND_ITEMS} />
                          </div>
                          <div className="space-y-2">
                            {caseBreakdown.map(c => (
                              <CasePhaseBar
                                key={c.id}
                                caseNumber={c.caseNumber}
                                procedureName={c.procedureName}
                                totalValue={c.totalORTime}
                                maxValue={maxCaseTime}
                                caseId={c.id}
                                formatValue={formatSecondsToHHMMSS}
                                phases={[
                                  { label: 'Pre-Op', value: c.wheelsInToIncision, color: PHASE_COLORS.preOp },
                                  { label: 'Surgical', value: c.incisionToClosing, color: PHASE_COLORS.surgical },
                                  { label: 'Closing', value: c.closingTime, color: PHASE_COLORS.closing },
                                  { label: 'Emergence', value: c.closedToWheelsOut, color: PHASE_COLORS.emergence },
                                ]}
                              />
                            ))}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Procedure Performance */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                      <SectionHeader
                        title="Procedure Performance"
                        subtitle="Today vs 30-day average by procedure"
                        accentColor="emerald"
                        icon={
                          <BarChart3 className="w-4 h-4" />
                        }
                      />

                      <div className="mt-5">
                        <ProcedureComparisonChart 
                          data={procedurePerformance} 
                          formatValue={formatSecondsToHHMMSS}
                        />
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