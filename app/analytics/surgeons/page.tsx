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
import { UserIcon } from '@heroicons/react/24/outline'

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

function getDateRange(period: string): { startDate: string; endDate: string; prevStartDate: string; prevEndDate: string; label: string } {
  const today = new Date()
  let startDate: Date
  let endDate = today
  let prevStartDate: Date
  let prevEndDate: Date
  let label: string

  switch (period) {
    case 'week':
      startDate = new Date(today)
      startDate.setDate(today.getDate() - 7)
      prevEndDate = new Date(startDate)
      prevEndDate.setDate(prevEndDate.getDate() - 1)
      prevStartDate = new Date(prevEndDate)
      prevStartDate.setDate(prevEndDate.getDate() - 6)
      label = 'Last 7 Days'
      break
    case 'month':
      startDate = new Date(today.getFullYear(), today.getMonth(), 1)
      prevEndDate = new Date(startDate)
      prevEndDate.setDate(prevEndDate.getDate() - 1)
      prevStartDate = new Date(prevEndDate.getFullYear(), prevEndDate.getMonth(), 1)
      label = 'This Month'
      break
    case 'quarter':
      const currentQuarter = Math.floor(today.getMonth() / 3)
      startDate = new Date(today.getFullYear(), currentQuarter * 3, 1)
      prevEndDate = new Date(startDate)
      prevEndDate.setDate(prevEndDate.getDate() - 1)
      prevStartDate = new Date(prevEndDate.getFullYear(), Math.floor(prevEndDate.getMonth() / 3) * 3, 1)
      label = 'This Quarter'
      break
    case 'year':
      startDate = new Date(today.getFullYear(), 0, 1)
      prevEndDate = new Date(startDate)
      prevEndDate.setDate(prevEndDate.getDate() - 1)
      prevStartDate = new Date(prevEndDate.getFullYear(), 0, 1)
      label = 'This Year'
      break
    default:
      startDate = new Date(today.getFullYear(), today.getMonth(), 1)
      prevEndDate = new Date(startDate)
      prevEndDate.setDate(prevEndDate.getDate() - 1)
      prevStartDate = new Date(prevEndDate.getFullYear(), prevEndDate.getMonth(), 1)
      label = 'This Month'
  }

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
    prevStartDate: prevStartDate.toISOString().split('T')[0],
    prevEndDate: prevEndDate.toISOString().split('T')[0],
    label,
  }
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

// ============================================
// TAB BUTTON COMPONENT
// ============================================

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
        active
          ? 'bg-blue-600 text-white shadow-sm'
          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
      }`}
    >
      {children}
    </button>
  )
}

// ============================================
// DATE FILTER WITH CUSTOM OPTION
// ============================================

interface DateFilterProps {
  selectedPeriod: string
  onPeriodChange: (period: string) => void
  customStartDate?: string
  customEndDate?: string
  onCustomDateChange?: (start: string, end: string) => void
}

function PeriodSelectorWithCustom({ 
  selectedPeriod, 
  onPeriodChange,
  customStartDate,
  customEndDate,
  onCustomDateChange 
}: DateFilterProps) {
  const [showCustom, setShowCustom] = useState(selectedPeriod === 'custom')
  const [localStart, setLocalStart] = useState(customStartDate || '')
  const [localEnd, setLocalEnd] = useState(customEndDate || '')

  const handlePresetChange = (value: string) => {
    if (value === 'custom') {
      setShowCustom(true)
    } else {
      setShowCustom(false)
      onPeriodChange(value)
    }
  }

  const handleApplyCustom = () => {
    if (localStart && localEnd && onCustomDateChange) {
      onCustomDateChange(localStart, localEnd)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <select
        value={showCustom ? 'custom' : selectedPeriod}
        onChange={(e) => handlePresetChange(e.target.value)}
        className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
      >
        <option value="week">Last 7 Days</option>
        <option value="month">This Month</option>
        <option value="quarter">This Quarter</option>
        <option value="year">This Year</option>
        <option value="custom">Custom Range</option>
      </select>

      {showCustom && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={localStart}
            onChange={(e) => setLocalStart(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
          <span className="text-slate-400 text-sm">to</span>
          <input
            type="date"
            value={localEnd}
            onChange={(e) => setLocalEnd(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
          <button
            onClick={handleApplyCustom}
            disabled={!localStart || !localEnd}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  )
}

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
  const [timePeriod, setTimePeriod] = useState('month')
  const [customStartDate, setCustomStartDate] = useState<string>('')
  const [customEndDate, setCustomEndDate] = useState<string>('')
  const [periodCases, setPeriodCases] = useState<CaseWithMilestones[]>([])
  const [prevPeriodCases, setPrevPeriodCases] = useState<CaseWithMilestones[]>([])
  const [procedureBreakdown, setProcedureBreakdown] = useState<ProcedureBreakdown[]>([])
  
  // Day Analysis tab state
  const [selectedDate, setSelectedDate] = useState(getLocalDateString())
  const [dayCases, setDayCases] = useState<CaseWithMilestones[]>([])
  const [last30DaysCases, setLast30DaysCases] = useState<CaseWithMilestones[]>([])
  const [allTimeCases, setAllTimeCases] = useState<CaseWithMilestones[]>([])
  const [selectedProcedureFilter, setSelectedProcedureFilter] = useState<string>('all')
  
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
    if (timePeriod === 'custom' && customStartDate && customEndDate) {
      const start = new Date(customStartDate)
      const end = new Date(customEndDate)
      const periodLength = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
      
      const prevEnd = new Date(start)
      prevEnd.setDate(prevEnd.getDate() - 1)
      const prevStart = new Date(prevEnd)
      prevStart.setDate(prevStart.getDate() - periodLength)

      return {
        startDate: customStartDate,
        endDate: customEndDate,
        prevStartDate: prevStart.toISOString().split('T')[0],
        prevEndDate: prevEnd.toISOString().split('T')[0],
        label: `${formatDateDisplay(customStartDate)} - ${formatDateDisplay(customEndDate)}`,
      }
    }
    return getDateRange(timePeriod)
  }

  // Fetch Overview data
  useEffect(() => {
    if (!selectedSurgeon || !effectiveFacilityId || activeTab !== 'overview') return

    async function fetchOverviewData() {
      setLoading(true)
      const { startDate, endDate, prevStartDate, prevEndDate } = getEffectiveDateRange()

      // Current period cases - include technique info
      const { data: currentData } = await supabase
        .from('cases')
        .select(`
          id, case_number, scheduled_date, start_time, surgeon_id,
          procedure_types (id, name, technique_id),
          or_rooms (id, name),
          case_milestones (milestone_type_id, recorded_at, milestone_types (name))
        `)
        .eq('facility_id', effectiveFacilityId)
        .eq('surgeon_id', selectedSurgeon)
        .gte('scheduled_date', startDate)
        .lte('scheduled_date', endDate)
        .order('scheduled_date', { ascending: true })

      // Previous period cases
      const { data: prevData } = await supabase
        .from('cases')
        .select(`
          id, case_number, scheduled_date, start_time, surgeon_id,
          procedure_types (id, name, technique_id),
          case_milestones (milestone_type_id, recorded_at, milestone_types (name))
        `)
        .eq('facility_id', effectiveFacilityId)
        .eq('surgeon_id', selectedSurgeon)
        .gte('scheduled_date', prevStartDate)
        .lte('scheduled_date', prevEndDate)

      setPeriodCases((currentData as unknown as CaseWithMilestones[]) || [])
      setPrevPeriodCases((prevData as unknown as CaseWithMilestones[]) || [])
      
      // Calculate procedure breakdown
      calculateProcedureBreakdown((currentData as unknown as CaseWithMilestones[]) || [])
      
      setLoading(false)
    }

    fetchOverviewData()
  }, [selectedSurgeon, timePeriod, customStartDate, customEndDate, effectiveFacilityId, activeTab])

  // Handle custom date change
  const handleCustomDateChange = (start: string, end: string) => {
    setCustomStartDate(start)
    setCustomEndDate(end)
    setTimePeriod('custom')
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
        case_milestones (milestone_type_id, recorded_at, milestone_types (name))
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
      const mType = Array.isArray(m.milestone_types) ? m.milestone_types[0] : m.milestone_types
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

  // Get robotic technique ID
  const roboticTechniqueId = procedureTechniques.find(t => t.name === 'robotic')?.id
  const manualTechniqueId = procedureTechniques.find(t => t.name === 'manual')?.id

  // TKA Comparison Data (Robotic vs Traditional) - for this surgeon
  const tkaComparisonData = useMemo(() => {
    if (!roboticTechniqueId || !manualTechniqueId) return []

    const byDate: { [key: string]: { robotic: number[]; traditional: number[] } } = {}

    periodCases.forEach(c => {
      const procType = Array.isArray(c.procedure_types) ? c.procedure_types[0] : c.procedure_types
      if (!procType) return

      // Check if this is a TKA (name contains TKA)
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

  // THA Comparison Data (Robotic vs Traditional) - for this surgeon
  const thaComparisonData = useMemo(() => {
    if (!roboticTechniqueId || !manualTechniqueId) return []

    const byDate: { [key: string]: { robotic: number[]; traditional: number[] } } = {}

    periodCases.forEach(c => {
      const procType = Array.isArray(c.procedure_types) ? c.procedure_types[0] : c.procedure_types
      if (!procType) return

      // Check if this is a THA (name contains THA)
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

  // Check if we have comparison data to show
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
  const getProcedurePerformance = () => {
    const completedCases = getCompletedCases(dayCases)
    const completed30DayCases = getCompletedCases(last30DaysCases)
    
    const filteredCases = selectedProcedureFilter === 'all' 
      ? completedCases 
      : completedCases.filter(c => {
          const proc = Array.isArray(c.procedure_types) ? c.procedure_types[0] : c.procedure_types
          return proc?.id === selectedProcedureFilter
        })

    const filteredOrTimes = filteredCases.map(c => getTotalORTime(getMilestoneMap(c)))
    const filteredSurgicalTimes = filteredCases.map(c => getSurgicalTime(getMilestoneMap(c)))

    const baselineCases = selectedProcedureFilter === 'all' ? completed30DayCases : completedCases
    const baselineOrTimes = baselineCases.map(c => getTotalORTime(getMilestoneMap(c)))
    const baselineSurgicalTimes = baselineCases.map(c => getSurgicalTime(getMilestoneMap(c)))

    return {
      procedure: {
        avgORTime: calculateAverage(filteredOrTimes),
        avgSurgicalTime: calculateAverage(filteredSurgicalTimes),
      },
      baseline: {
        avgORTime: calculateAverage(baselineOrTimes),
        avgSurgicalTime: calculateAverage(baselineSurgicalTimes),
      },
      baselineLabel: selectedProcedureFilter === 'all' ? '30-Day Avg' : 'Day Average'
    }
  }

  const procedurePerformance = useMemo(() => getProcedurePerformance(), [dayCases, last30DaysCases, selectedProcedureFilter])

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
            description="Track individual surgeon metrics and trends"
            icon={UserIcon}
            actions={
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
            }
          />

          {!selectedSurgeon ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <UserIcon className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">Select a Surgeon</h3>
              <p className="text-slate-500">Choose a surgeon to view their performance</p>
            </div>
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
                  <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
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
                <div className="flex items-center justify-center py-24">
                  <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : activeTab === 'overview' ? (
                /* ============================================ */
                /* OVERVIEW TAB */
                /* ============================================ */
                <div className="space-y-6">
                  {/* Period Selector with Custom Date Option */}
                  <div className="flex justify-end">
                    <PeriodSelectorWithCustom
                      selectedPeriod={timePeriod}
                      onPeriodChange={setTimePeriod}
                      customStartDate={customStartDate}
                      customEndDate={customEndDate}
                      onCustomDateChange={handleCustomDateChange}
                    />
                  </div>

                  {/* KPI Cards */}
                  <div className="grid grid-cols-4 gap-4">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                      <p className="text-sm text-slate-500">Total Cases</p>
                      <p className="text-3xl font-bold text-slate-900 mt-1">{overviewMetrics.totalCases}</p>
                      {overviewMetrics.prevCases > 0 && (
                        <p className={`text-sm mt-2 ${overviewMetrics.totalCases >= overviewMetrics.prevCases ? 'text-emerald-600' : 'text-red-600'}`}>
                          {overviewMetrics.totalCases >= overviewMetrics.prevCases ? '↑' : '↓'} {Math.abs(Math.round(((overviewMetrics.totalCases - overviewMetrics.prevCases) / overviewMetrics.prevCases) * 100))}% vs prev period
                        </p>
                      )}
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                      <p className="text-sm text-slate-500">Avg OR Time</p>
                      <p className="text-3xl font-bold text-slate-900 mt-1">{formatMinutesToHHMMSS(overviewMetrics.avgORTime)}</p>
                      <p className="text-sm text-slate-400 mt-2">per case</p>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                      <p className="text-sm text-slate-500">Avg Turnover</p>
                      <p className="text-3xl font-bold text-slate-900 mt-1">
                        {overviewMetrics.avgTurnover ? formatMinutesToHHMMSS(overviewMetrics.avgTurnover) : 'N/A'}
                      </p>
                      {overviewMetrics.prevAvgTurnover && overviewMetrics.avgTurnover && (
                        <p className={`text-sm mt-2 ${overviewMetrics.avgTurnover <= overviewMetrics.prevAvgTurnover ? 'text-emerald-600' : 'text-red-600'}`}>
                          {overviewMetrics.avgTurnover <= overviewMetrics.prevAvgTurnover ? '↓' : '↑'} vs prev period
                        </p>
                      )}
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                      <p className="text-sm text-slate-500">Total OR Time</p>
                      <p className="text-3xl font-bold text-slate-900 mt-1">{formatMinutesToHHMMSS(overviewMetrics.totalORTime)}</p>
                      <p className="text-sm text-slate-400 mt-2">cumulative</p>
                    </div>
                  </div>

                  {/* Trend Chart */}
                  {dailyTrendData.length > 0 && (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                      <h3 className="text-base font-semibold text-slate-900 mb-1">Daily Case Volume</h3>
                      <p className="text-sm text-slate-500 mb-4">Cases per day over the selected period</p>
                      <BarChart
                        className="h-48"
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

                  {/* Procedure Breakdown + Comparison Charts Row */}
                  <div className={`grid gap-6 ${hasComparisonData ? 'grid-cols-1 lg:grid-cols-3' : 'grid-cols-1'}`}>
                    {/* Procedure Breakdown - narrower when comparison charts exist */}
                    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm p-6 ${hasComparisonData ? '' : 'lg:col-span-3'}`}>
                      <h3 className="text-base font-semibold text-slate-900 mb-1">Procedure Breakdown</h3>
                      <p className="text-sm text-slate-500 mb-4">Performance by procedure type</p>
                      
                      {procedureBreakdown.length > 0 ? (
                        <div className="space-y-3">
                          {procedureBreakdown.map(proc => {
                            const consistency = getConsistencyLabel(proc.avg_surgical_seconds, proc.stddev_surgical_seconds)
                            return (
                              <div key={proc.procedure_id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                                <div>
                                  <p className="font-medium text-slate-900">{proc.procedure_name}</p>
                                  <p className="text-sm text-slate-500">{proc.case_count} cases</p>
                                </div>
                                <div className="text-right">
                                  <p className="font-mono font-semibold text-slate-900">
                                    {proc.avg_surgical_seconds ? formatSecondsToHHMMSS(Math.round(proc.avg_surgical_seconds)) : '--'}
                                  </p>
                                  <p className={`text-sm ${consistency.color}`}>{consistency.label}</p>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-slate-400">No procedure data available</div>
                      )}
                    </div>

                    {/* TKA Comparison Chart */}
                    {tkaComparisonData.length > 0 && (
                      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                        <h3 className="text-base font-semibold text-slate-900 mb-1">TKA Surgical Time</h3>
                        <p className="text-sm text-slate-500 mb-4">Robotic vs Traditional (minutes)</p>
                        <AreaChart
                          className="h-52"
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
                        <h3 className="text-base font-semibold text-slate-900 mb-1">THA Surgical Time</h3>
                        <p className="text-sm text-slate-500 mb-4">Robotic vs Traditional (minutes)</p>
                        <AreaChart
                          className="h-52"
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
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  {/* Day Overview Section */}
                  <div className="bg-white rounded-xl border border-slate-200 p-6">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-slate-900">Day Overview</h3>
                        <p className="text-sm text-slate-500">Track efficiency by measuring key time metrics</p>
                      </div>
                    </div>

                    {/* Top Metrics Row */}
                    <div className="grid grid-cols-4 gap-4 mt-6">
                      <div>
                        <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          First Case Start Time
                        </div>
<div className="text-3xl font-bold text-slate-900">
  {formatTimeInTimezone(dayMetrics.firstCaseStartTime?.toISOString() ?? null, facilityTimezone)}
</div>
                        {dayMetrics.firstCaseScheduledTime && (
                          <div className="text-sm text-slate-500 mt-1">
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
                      <div>
                        <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                          Total Case Count
                        </div>
                        <div className="text-3xl font-bold text-slate-900">{dayMetrics.totalCases}</div>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Total OR Time
                        </div>
                        <div className="text-3xl font-bold text-slate-900">{formatMinutesToHHMMSS(dayMetrics.totalORTime)}</div>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Total Surgical Time
                        </div>
                        <div className="text-3xl font-bold text-slate-900">{formatMinutesToHHMMSS(dayMetrics.totalSurgicalTime)}</div>
                      </div>
                    </div>

                    {/* Second Row - Turnovers and Uptime */}
                    <div className="grid grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100">
                      {/* Surgical Turnover */}
                      <div className="bg-slate-50 rounded-lg p-4">
                        <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Avg. Surgical Turnover
                        </div>
                        {dayMetrics.surgicalTurnoverCount > 0 ? (
                          <>
                            <div className="text-3xl font-bold text-slate-900">{formatMinutesToHHMMSS(dayMetrics.avgSurgicalTurnover)}</div>
                            <div className="flex items-center gap-4 mt-2 text-sm">
                              {surgicalTurnoverVs30Day !== null && (
                                <span className={`flex items-center gap-1 ${surgicalTurnoverVs30Day >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                  {surgicalTurnoverVs30Day >= 0 ? '↑' : '↓'} {Math.abs(surgicalTurnoverVs30Day)}%
                                </span>
                              )}
                              <span className="text-slate-400">vs. avg. {formatMinutesToHHMMSS(last30Metrics.avgSurgicalTurnover)}</span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-2xl font-bold text-slate-400">N/A</div>
                            <div className="text-xs text-slate-400 mt-1">Requires 2+ cases in same room</div>
                          </>
                        )}
                      </div>

                      {/* Room Turnover */}
                      <div className="bg-slate-50 rounded-lg p-4">
                        <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Avg. Room Turnover
                        </div>
                        {dayMetrics.roomTurnoverCount > 0 ? (
                          <>
                            <div className="text-3xl font-bold text-slate-900">{formatMinutesToHHMMSS(dayMetrics.avgRoomTurnover)}</div>
                            <div className="flex items-center gap-4 mt-2 text-sm">
                              {turnoverVs30Day !== null && (
                                <span className={`flex items-center gap-1 ${turnoverVs30Day >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                  {turnoverVs30Day >= 0 ? '↑' : '↓'} {Math.abs(turnoverVs30Day)}%
                                </span>
                              )}
                              <span className="text-slate-400">vs. avg. {formatMinutesToHHMMSS(last30Metrics.avgRoomTurnover)}</span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-2xl font-bold text-slate-400">N/A</div>
                            <div className="text-xs text-slate-400 mt-1">Requires 2+ cases in same room</div>
                          </>
                        )}
                      </div>
                      
                      {/* Uptime vs Downtime */}
                      <div className="bg-slate-50 rounded-lg p-4 col-span-2">
                        <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                          Uptime vs Downtime
                        </div>
                        
                        {dayMetrics.totalORTime > 0 ? (
                          <>
                            <div className="flex items-baseline gap-2 mb-2">
                              <span className="text-2xl font-bold text-slate-900">{dayMetrics.uptimePercent}%</span>
                              <span className="text-slate-400">vs.</span>
                              <span className="text-xl font-semibold text-slate-600">{100 - dayMetrics.uptimePercent}%</span>
                              {uptimeImprovement !== null && (
                                <span className={`flex items-center gap-1 text-sm ml-2 ${uptimeImprovement >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                  {uptimeImprovement >= 0 ? '↑' : '↓'} {Math.abs(uptimeImprovement).toFixed(1)}%
                                  <span className="text-slate-400 ml-1">improvement</span>
                                </span>
                              )}
                            </div>
                            <div className="h-3 w-full rounded-full overflow-hidden flex">
                              <div className="h-full bg-blue-600 transition-all" style={{ width: `${dayMetrics.uptimePercent}%` }} />
                              <div className="h-full bg-red-500 transition-all" style={{ width: `${100 - dayMetrics.uptimePercent}%` }} />
                            </div>
                            <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                              <div className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-full bg-blue-600" />
                                <span>Surgical</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-full bg-red-500" />
                                <span>Other</span>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="text-2xl font-bold text-slate-400">--</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Cases and Procedure Performance */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Cases List with Stacked Bars */}
                    <div className="bg-white rounded-xl border border-slate-200 p-6">
                      <div className="flex items-center gap-2 mb-4">
                        <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        <div>
                          <h3 className="font-semibold text-slate-900">Cases</h3>
                          <p className="text-sm text-slate-500">{dayMetrics.totalCases} cases completed</p>
                        </div>
                      </div>

                      {caseBreakdown.length === 0 ? (
                        <div className="text-center py-8 text-slate-400">No completed cases for this date</div>
                      ) : (
<div className="space-y-3">
                          {caseBreakdown.map((c, idx) => (
                            <div key={c.id} className="flex items-center gap-3">
                              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-xs font-bold text-blue-600">
                                {idx + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-sm font-medium text-slate-900 truncate">{c.procedureName}</span>
                                  <span className="text-sm text-slate-500">{formatMinutesToHHMMSS(c.totalORTime)}</span>
                                </div>
                                <div className="h-4 bg-slate-100 rounded-full overflow-hidden flex">
                                  {c.wheelsInToIncision > 0 && (
                                    <div className="h-full bg-blue-600" style={{ width: `${(c.wheelsInToIncision / maxCaseTime) * 100}%` }} title={`Wheels-in to Incision: ${formatMinutesToHHMMSS(c.wheelsInToIncision)}`} />
                                  )}
                                  {c.incisionToClosing > 0 && (
                                    <div className="h-full bg-blue-400" style={{ width: `${(c.incisionToClosing / maxCaseTime) * 100}%` }} title={`Incision to Closing: ${formatMinutesToHHMMSS(c.incisionToClosing)}`} />
                                  )}
                                  {c.closingTime > 0 && (
                                    <div className="h-full bg-emerald-500" style={{ width: `${(c.closingTime / maxCaseTime) * 100}%` }} title={`Closing: ${formatMinutesToHHMMSS(c.closingTime)}`} />
                                  )}
                                  {c.closedToWheelsOut > 0 && (
                                    <div className="h-full bg-amber-400" style={{ width: `${(c.closedToWheelsOut / maxCaseTime) * 100}%` }} title={`Wheels-Out: ${formatMinutesToHHMMSS(c.closedToWheelsOut)}`} />
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-100 text-xs">
                        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-600 rounded" /><span className="text-slate-500">Pre-Op</span></div>
                        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-400 rounded" /><span className="text-slate-500">Surgical</span></div>
                        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-emerald-500 rounded" /><span className="text-slate-500">Closing</span></div>
                        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-amber-400 rounded" /><span className="text-slate-500">Emergence</span></div>
                      </div>
                    </div>

                    {/* Procedure Performance */}
                    <div className="bg-white rounded-xl border border-slate-200 p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                          <h3 className="font-semibold text-slate-900">Procedure Performance</h3>
                        </div>
                        <select
                          value={selectedProcedureFilter}
                          onChange={(e) => setSelectedProcedureFilter(e.target.value)}
                          className="px-2 py-1 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        >
                          <option value="all">All Procedures</option>
                          {procedures.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-4">
                        {/* OR Time */}
                        <div>
                          <div className="text-sm text-slate-500 mb-1">OR Time</div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-5 bg-slate-100 rounded overflow-hidden">
                                <div className="h-full bg-blue-600 rounded" style={{ width: `${Math.min(100, ((procedurePerformance.procedure.avgORTime || 0) / Math.max(procedurePerformance.baseline.avgORTime || 1, procedurePerformance.procedure.avgORTime || 1)) * 100)}%` }} />
                              </div>
                              <span className="text-sm font-semibold text-slate-900 w-20 text-right">{formatMinutesToHHMMSS(procedurePerformance.procedure.avgORTime)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-5 bg-slate-100 rounded overflow-hidden">
                                <div className="h-full bg-slate-400 rounded" style={{ width: `${Math.min(100, ((procedurePerformance.baseline.avgORTime || 0) / Math.max(procedurePerformance.baseline.avgORTime || 1, procedurePerformance.procedure.avgORTime || 1)) * 100)}%` }} />
                              </div>
                              <span className="text-sm font-medium text-slate-700 w-20 text-right">{formatMinutesToHHMMSS(procedurePerformance.baseline.avgORTime)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Surgical Time */}
                        <div>
                          <div className="text-sm text-slate-500 mb-1">Surgical Time</div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-5 bg-slate-100 rounded overflow-hidden">
                                <div className="h-full bg-blue-600 rounded" style={{ width: `${Math.min(100, ((procedurePerformance.procedure.avgSurgicalTime || 0) / Math.max(procedurePerformance.baseline.avgSurgicalTime || 1, procedurePerformance.procedure.avgSurgicalTime || 1)) * 100)}%` }} />
                              </div>
                              <span className="text-sm font-semibold text-slate-900 w-20 text-right">{formatMinutesToHHMMSS(procedurePerformance.procedure.avgSurgicalTime)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-5 bg-slate-100 rounded overflow-hidden">
                                <div className="h-full bg-slate-400 rounded" style={{ width: `${Math.min(100, ((procedurePerformance.baseline.avgSurgicalTime || 0) / Math.max(procedurePerformance.baseline.avgSurgicalTime || 1, procedurePerformance.procedure.avgSurgicalTime || 1)) * 100)}%` }} />
                              </div>
                              <span className="text-sm font-medium text-slate-700 w-20 text-right">{formatMinutesToHHMMSS(procedurePerformance.baseline.avgSurgicalTime)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-6 mt-4 pt-4 border-t border-slate-100 text-xs">
                          <div className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-600 rounded" /><span className="text-slate-600">{selectedProcedureFilter === 'all' ? 'Today' : 'Procedure'}</span></div>
                          <div className="flex items-center gap-1"><div className="w-3 h-3 bg-slate-400 rounded" /><span className="text-slate-600">{procedurePerformance.baselineLabel}</span></div>
                        </div>
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