'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import { getImpersonationState } from '@/lib/impersonation'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import AnalyticsLayout from '@/components/analytics/AnalyticsLayout'
import { formatSecondsToHHMMSS } from '@/lib/analyticsV2'
import {
  SectionHeader,
  EnhancedMetricCard,
  PeriodSelector,
  SurgeonSelector,
  ConsistencyBadge,
  InlineBar,
  CallTimingTimeline,
  DelayDonut,
  InsightCard,
  SlideOutPanel,
  SkeletonMetricCards,
  SkeletonTable,
  SkeletonChart,
  EmptyState,
} from '@/components/analytics/AnalyticsComponents'

// ============================================
// TYPES
// ============================================

interface Surgeon {
  id: string
  first_name: string
  last_name: string
}

interface ProcedureBreakdown {
  procedure_id: string
  procedure_name: string
  case_count: number
  avg_surgical_seconds: number | null
  stddev_surgical_seconds: number | null
  avg_total_seconds: number | null
}

interface CallTimingData {
  avg_minutes_before_incision: number | null
  avg_prep_duration_minutes: number | null
  avg_wait_for_surgeon_minutes: number | null
  cases_with_call_data: number
}

interface DelayData {
  delay_type: string
  display_name: string
  count: number
  total_minutes: number | null
}

interface CaseVolumeData {
  current_count: number
  previous_count: number
  percent_change: number | null
}

interface FirstCaseData {
  total_first_cases: number
  on_time_count: number
  on_time_percentage: number
}

interface ProcedureCaseDetail {
  id: string
  case_number: string
  scheduled_date: string
  surgical_seconds: number | null
  total_seconds: number | null
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getDateRange(period: string): { startDate: string; endDate: string; prevStartDate: string; prevEndDate: string } {
  const today = new Date()
  let startDate: Date
  let endDate = today
  let prevStartDate: Date
  let prevEndDate: Date

  switch (period) {
    case 'week':
      startDate = new Date(today)
      startDate.setDate(today.getDate() - 7)
      prevEndDate = new Date(startDate)
      prevEndDate.setDate(prevEndDate.getDate() - 1)
      prevStartDate = new Date(prevEndDate)
      prevStartDate.setDate(prevEndDate.getDate() - 6)
      break
    case 'month':
      startDate = new Date(today.getFullYear(), today.getMonth(), 1)
      prevEndDate = new Date(startDate)
      prevEndDate.setDate(prevEndDate.getDate() - 1)
      prevStartDate = new Date(prevEndDate.getFullYear(), prevEndDate.getMonth(), 1)
      break
    case 'quarter':
      const currentQuarter = Math.floor(today.getMonth() / 3)
      startDate = new Date(today.getFullYear(), currentQuarter * 3, 1)
      prevEndDate = new Date(startDate)
      prevEndDate.setDate(prevEndDate.getDate() - 1)
      prevStartDate = new Date(prevEndDate.getFullYear(), Math.floor(prevEndDate.getMonth() / 3) * 3, 1)
      break
    case 'year':
      startDate = new Date(today.getFullYear(), 0, 1)
      prevEndDate = new Date(startDate)
      prevEndDate.setDate(prevEndDate.getDate() - 1)
      prevStartDate = new Date(prevEndDate.getFullYear(), 0, 1)
      break
    default:
      startDate = new Date(today.getFullYear(), today.getMonth(), 1)
      prevEndDate = new Date(startDate)
      prevEndDate.setDate(prevEndDate.getDate() - 1)
      prevStartDate = new Date(prevEndDate.getFullYear(), prevEndDate.getMonth(), 1)
  }

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
    prevStartDate: prevStartDate.toISOString().split('T')[0],
    prevEndDate: prevEndDate.toISOString().split('T')[0],
  }
}

function getConsistencyLevel(avgSeconds: number | null, stddevSeconds: number | null): 'very_consistent' | 'consistent' | 'variable' | 'na' {
  if (!avgSeconds || !stddevSeconds || avgSeconds === 0) return 'na'
  const cv = (stddevSeconds / avgSeconds) * 100
  if (cv < 10) return 'very_consistent'
  if (cv < 20) return 'consistent'
  return 'variable'
}

function getConsistencyLabel(level: 'very_consistent' | 'consistent' | 'variable' | 'na'): string {
  const labels = { very_consistent: 'Very Consistent', consistent: 'Consistent', variable: 'Variable', na: 'N/A' }
  return labels[level]
}

function getTimezoneOffsetMs(date: Date, timezone: string): number {
  try {
    const utcStr = date.toLocaleString('en-US', { timeZone: 'UTC' })
    const tzStr = date.toLocaleString('en-US', { timeZone: timezone })
    const utcDate = new Date(utcStr)
    const tzDate = new Date(tzStr)
    return utcDate.getTime() - tzDate.getTime()
  } catch {
    return 5 * 60 * 60 * 1000
  }
}

// ============================================
// MAIN PAGE COMPONENT
// ============================================

export default function SurgeonOverviewPage() {
  const router = useRouter()
  const supabase = createClient()
  const { userData, loading: userLoading, isGlobalAdmin } = useUser()

  // Facility handling
  const [effectiveFacilityId, setEffectiveFacilityId] = useState<string | null>(null)
  const [facilityTimezone, setFacilityTimezone] = useState<string>('America/New_York')
  const [noFacilitySelected, setNoFacilitySelected] = useState(false)
  const [facilityCheckComplete, setFacilityCheckComplete] = useState(false)

  // Filters
  const [selectedSurgeonId, setSelectedSurgeonId] = useState<string | null>(null)
  const [timePeriod, setTimePeriod] = useState('month')

  // Data
  const [surgeons, setSurgeons] = useState<Surgeon[]>([])
  const [loading, setLoading] = useState(true)
  const [caseVolume, setCaseVolume] = useState<CaseVolumeData | null>(null)
  const [procedures, setProcedures] = useState<ProcedureBreakdown[]>([])
  const [callTiming, setCallTiming] = useState<CallTimingData | null>(null)
  const [delays, setDelays] = useState<DelayData[]>([])
  const [firstCaseData, setFirstCaseData] = useState<FirstCaseData | null>(null)

  // Slide-out panel state
  const [selectedProcedure, setSelectedProcedure] = useState<ProcedureBreakdown | null>(null)
  const [procedureCases, setProcedureCases] = useState<ProcedureCaseDetail[]>([])
  const [loadingProcedureCases, setLoadingProcedureCases] = useState(false)

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

  // Fetch facility timezone
  useEffect(() => {
    if (!effectiveFacilityId) return

    const fetchTimezone = async () => {
      const { data } = await supabase
        .from('facilities')
        .select('timezone')
        .eq('id', effectiveFacilityId)
        .single()

      if (data?.timezone) {
        setFacilityTimezone(data.timezone)
      }
    }

    fetchTimezone()
  }, [effectiveFacilityId])

  // Fetch surgeons list
  useEffect(() => {
    if (!effectiveFacilityId) return

    const fetchSurgeons = async () => {
      const { data } = await supabase
        .from('users')
        .select('id, first_name, last_name')
        .eq('facility_id', effectiveFacilityId)
        .eq('role_id', (await supabase.from('user_roles').select('id').eq('name', 'surgeon').single()).data?.id)
        .order('last_name')

      if (data && data.length > 0) {
        setSurgeons(data)
        if (!selectedSurgeonId) {
          setSelectedSurgeonId(data[0].id)
        }
      }
    }

    fetchSurgeons()
  }, [effectiveFacilityId])

  // Fetch all data when surgeon or period changes
  useEffect(() => {
    if (!effectiveFacilityId || !selectedSurgeonId) return

    const fetchAllData = async () => {
      setLoading(true)
      const { startDate, endDate, prevStartDate, prevEndDate } = getDateRange(timePeriod)

      await Promise.all([
        fetchCaseVolume(startDate, endDate, prevStartDate, prevEndDate),
        fetchProcedures(startDate, endDate),
        fetchCallTiming(startDate, endDate),
        fetchDelays(startDate, endDate),
        fetchFirstCaseData(startDate, endDate),
      ])

      setLoading(false)
    }

    fetchAllData()
  }, [effectiveFacilityId, selectedSurgeonId, timePeriod, facilityTimezone])

  // ============================================
  // DATA FETCHING FUNCTIONS
  // ============================================

  const fetchCaseVolume = async (startDate: string, endDate: string, prevStartDate: string, prevEndDate: string) => {
    const { data: currentData } = await supabase
      .from('cases')
      .select('id', { count: 'exact' })
      .eq('facility_id', effectiveFacilityId)
      .eq('surgeon_id', selectedSurgeonId)
      .gte('scheduled_date', startDate)
      .lte('scheduled_date', endDate)
      .eq('status_id', (await supabase.from('case_statuses').select('id').eq('name', 'completed').single()).data?.id)

    const { data: prevData } = await supabase
      .from('cases')
      .select('id', { count: 'exact' })
      .eq('facility_id', effectiveFacilityId)
      .eq('surgeon_id', selectedSurgeonId)
      .gte('scheduled_date', prevStartDate)
      .lte('scheduled_date', prevEndDate)
      .eq('status_id', (await supabase.from('case_statuses').select('id').eq('name', 'completed').single()).data?.id)

    const currentCount = currentData?.length || 0
    const previousCount = prevData?.length || 0
    const percentChange = previousCount > 0
      ? Math.round(((currentCount - previousCount) / previousCount) * 100)
      : null

    setCaseVolume({ current_count: currentCount, previous_count: previousCount, percent_change: percentChange })
  }

  const fetchProcedures = async (startDate: string, endDate: string) => {
    const { data: statusData } = await supabase
      .from('case_statuses')
      .select('id')
      .eq('name', 'completed')
      .single()

    if (!statusData) return

    const { data: casesData } = await supabase
      .from('cases')
      .select(`
        id,
        procedure_type_id,
        procedure_types (id, name),
        case_milestones (
          recorded_at,
          milestone_types (name)
        )
      `)
      .eq('facility_id', effectiveFacilityId)
      .eq('surgeon_id', selectedSurgeonId)
      .eq('status_id', statusData.id)
      .gte('scheduled_date', startDate)
      .lte('scheduled_date', endDate)

    if (!casesData) return

    const procedureMap = new Map<string, {
      procedure_id: string
      procedure_name: string
      surgical_times: number[]
      total_times: number[]
    }>()

    casesData.forEach((c: any) => {
      const procId = c.procedure_type_id
      const procName = c.procedure_types?.name || 'Unknown'

      if (!procId) return

      if (!procedureMap.has(procId)) {
        procedureMap.set(procId, {
          procedure_id: procId,
          procedure_name: procName,
          surgical_times: [],
          total_times: [],
        })
      }

      const proc = procedureMap.get(procId)!

      const milestones: { [key: string]: Date } = {}
      c.case_milestones?.forEach((m: any) => {
        const name = m.milestone_types?.name
        if (name && m.recorded_at) {
          milestones[name] = new Date(m.recorded_at)
        }
      })

      if (milestones.incision && milestones.closing) {
        const surgicalSeconds = (milestones.closing.getTime() - milestones.incision.getTime()) / 1000
        if (surgicalSeconds > 0 && surgicalSeconds < 36000) {
          proc.surgical_times.push(surgicalSeconds)
        }
      }

      if (milestones.patient_in && milestones.patient_out) {
        const totalSeconds = (milestones.patient_out.getTime() - milestones.patient_in.getTime()) / 1000
        if (totalSeconds > 0 && totalSeconds < 36000) {
          proc.total_times.push(totalSeconds)
        }
      }
    })

    const proceduresArray: ProcedureBreakdown[] = Array.from(procedureMap.values())
      .map(proc => {
        const avgSurgical = proc.surgical_times.length > 0
          ? proc.surgical_times.reduce((a, b) => a + b, 0) / proc.surgical_times.length
          : null
        const avgTotal = proc.total_times.length > 0
          ? proc.total_times.reduce((a, b) => a + b, 0) / proc.total_times.length
          : null

        let stddevSurgical: number | null = null
        if (proc.surgical_times.length > 1 && avgSurgical) {
          const squaredDiffs = proc.surgical_times.map(t => Math.pow(t - avgSurgical, 2))
          stddevSurgical = Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / proc.surgical_times.length)
        }

        return {
          procedure_id: proc.procedure_id,
          procedure_name: proc.procedure_name,
          case_count: proc.surgical_times.length,
          avg_surgical_seconds: avgSurgical,
          stddev_surgical_seconds: stddevSurgical,
          avg_total_seconds: avgTotal,
        }
      })
      .filter(p => p.case_count > 0)
      .sort((a, b) => b.case_count - a.case_count)

    setProcedures(proceduresArray)
  }

  const fetchCallTiming = async (startDate: string, endDate: string) => {
    const { data: statusData } = await supabase
      .from('case_statuses')
      .select('id')
      .eq('name', 'completed')
      .single()

    if (!statusData) return

    const { data: casesData } = await supabase
      .from('cases')
      .select(`
        id,
        called_back_at,
        case_milestones (
          recorded_at,
          milestone_types (name)
        )
      `)
      .eq('facility_id', effectiveFacilityId)
      .eq('surgeon_id', selectedSurgeonId)
      .eq('status_id', statusData.id)
      .not('called_back_at', 'is', null)
      .gte('scheduled_date', startDate)
      .lte('scheduled_date', endDate)

    if (!casesData || casesData.length === 0) {
      setCallTiming(null)
      return
    }

    const timings: {
      minutesBeforeIncision: number[]
      prepDurations: number[]
      waitForSurgeon: number[]
    } = {
      minutesBeforeIncision: [],
      prepDurations: [],
      waitForSurgeon: [],
    }

    casesData.forEach((c: any) => {
      const milestones: { [key: string]: Date } = {}
      c.case_milestones?.forEach((m: any) => {
        const name = m.milestone_types?.name
        if (name && m.recorded_at) {
          milestones[name] = new Date(m.recorded_at)
        }
      })

      const callTime = new Date(c.called_back_at)

      if (milestones.incision) {
        const minBeforeIncision = (callTime.getTime() - milestones.incision.getTime()) / 1000 / 60
        timings.minutesBeforeIncision.push(minBeforeIncision)
      }

      if (milestones.patient_in && milestones.prepped) {
        const prepMin = (milestones.prepped.getTime() - milestones.patient_in.getTime()) / 1000 / 60
        if (prepMin > 0 && prepMin < 120) {
          timings.prepDurations.push(prepMin)
        }
      }

      if (milestones.prepped && milestones.incision) {
        const waitMin = (milestones.incision.getTime() - milestones.prepped.getTime()) / 1000 / 60
        if (waitMin >= 0 && waitMin < 60) {
          timings.waitForSurgeon.push(waitMin)
        }
      }
    })

    const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null

    setCallTiming({
      avg_minutes_before_incision: avg(timings.minutesBeforeIncision),
      avg_prep_duration_minutes: avg(timings.prepDurations),
      avg_wait_for_surgeon_minutes: avg(timings.waitForSurgeon),
      cases_with_call_data: casesData.length,
    })
  }

  const fetchDelays = async (startDate: string, endDate: string) => {
    const { data } = await supabase
      .from('case_delays')
      .select(`
        id,
        duration_minutes,
        delay_types (name, display_name),
        cases!inner (
          surgeon_id,
          scheduled_date,
          facility_id
        )
      `)
      .eq('cases.facility_id', effectiveFacilityId)
      .eq('cases.surgeon_id', selectedSurgeonId)
      .gte('cases.scheduled_date', startDate)
      .lte('cases.scheduled_date', endDate)

    if (!data) {
      setDelays([])
      return
    }

    const delayMap = new Map<string, DelayData>()

    data.forEach((d: any) => {
      const typeName = d.delay_types?.name || 'unknown'
      const displayName = d.delay_types?.display_name || typeName

      if (!delayMap.has(typeName)) {
        delayMap.set(typeName, {
          delay_type: typeName,
          display_name: displayName,
          count: 0,
          total_minutes: 0,
        })
      }

      const delay = delayMap.get(typeName)!
      delay.count++
      if (d.duration_minutes) {
        delay.total_minutes = (delay.total_minutes || 0) + d.duration_minutes
      }
    })

    const delaysArray = Array.from(delayMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    setDelays(delaysArray)
  }

  const fetchFirstCaseData = async (startDate: string, endDate: string) => {
    const { data: statusData } = await supabase
      .from('case_statuses')
      .select('id')
      .eq('name', 'completed')
      .single()

    if (!statusData) return

    const { data: casesData } = await supabase
      .from('cases')
      .select(`
        id,
        scheduled_date,
        start_time,
        case_milestones (
          recorded_at,
          milestone_types (name)
        )
      `)
      .eq('facility_id', effectiveFacilityId)
      .eq('surgeon_id', selectedSurgeonId)
      .eq('status_id', statusData.id)
      .not('start_time', 'is', null)
      .gte('scheduled_date', startDate)
      .lte('scheduled_date', endDate)
      .order('scheduled_date')
      .order('start_time')

    if (!casesData) {
      setFirstCaseData(null)
      return
    }

    const casesByDate = new Map<string, any>()
    casesData.forEach((c: any) => {
      if (!casesByDate.has(c.scheduled_date)) {
        casesByDate.set(c.scheduled_date, c)
      }
    })

    let totalFirstCases = 0
    let onTimeCount = 0

    casesByDate.forEach((c) => {
      const patientInMilestone = c.case_milestones?.find(
        (m: any) => m.milestone_types?.name === 'patient_in'
      )

      if (!patientInMilestone?.recorded_at || !c.start_time) return

      totalFirstCases++

      const scheduledDateTime = new Date(`${c.scheduled_date}T${c.start_time}`)
      const offsetMs = getTimezoneOffsetMs(scheduledDateTime, facilityTimezone)
      const scheduledUTC = new Date(scheduledDateTime.getTime() + offsetMs)
      const actualUTC = new Date(patientInMilestone.recorded_at)

      const varianceMinutes = (actualUTC.getTime() - scheduledUTC.getTime()) / 1000 / 60

      if (varianceMinutes >= -10 && varianceMinutes <= 10) {
        onTimeCount++
      }
    })

    const percentage = totalFirstCases > 0 ? Math.round((onTimeCount / totalFirstCases) * 100) : 0

    setFirstCaseData({
      total_first_cases: totalFirstCases,
      on_time_count: onTimeCount,
      on_time_percentage: percentage,
    })
  }

  // Fetch procedure cases for slide-out panel
  const fetchProcedureCases = async (procedure: ProcedureBreakdown) => {
    setSelectedProcedure(procedure)
    setLoadingProcedureCases(true)
    setProcedureCases([])

    const { startDate, endDate } = getDateRange(timePeriod)
    const { data: statusData } = await supabase
      .from('case_statuses')
      .select('id')
      .eq('name', 'completed')
      .single()

    if (!statusData) {
      setLoadingProcedureCases(false)
      return
    }

    const { data: casesData } = await supabase
      .from('cases')
      .select(`
        id,
        case_number,
        scheduled_date,
        case_milestones (
          recorded_at,
          milestone_types (name)
        )
      `)
      .eq('facility_id', effectiveFacilityId)
      .eq('surgeon_id', selectedSurgeonId)
      .eq('procedure_type_id', procedure.procedure_id)
      .eq('status_id', statusData.id)
      .gte('scheduled_date', startDate)
      .lte('scheduled_date', endDate)
      .order('scheduled_date', { ascending: false })

    if (!casesData) {
      setLoadingProcedureCases(false)
      return
    }

    const cases: ProcedureCaseDetail[] = casesData.map((c: any) => {
      const milestones: { [key: string]: Date } = {}
      c.case_milestones?.forEach((m: any) => {
        const name = m.milestone_types?.name
        if (name && m.recorded_at) {
          milestones[name] = new Date(m.recorded_at)
        }
      })

      let surgicalSeconds: number | null = null
      let totalSeconds: number | null = null

      if (milestones.incision && milestones.closing) {
        surgicalSeconds = (milestones.closing.getTime() - milestones.incision.getTime()) / 1000
      }
      if (milestones.patient_in && milestones.patient_out) {
        totalSeconds = (milestones.patient_out.getTime() - milestones.patient_in.getTime()) / 1000
      }

      return {
        id: c.id,
        case_number: c.case_number,
        scheduled_date: c.scheduled_date,
        surgical_seconds: surgicalSeconds,
        total_seconds: totalSeconds,
      }
    }).filter((c: ProcedureCaseDetail) => c.surgical_seconds !== null)

    const sorted = [...cases].sort((a, b) => (a.surgical_seconds || 0) - (b.surgical_seconds || 0))

    setProcedureCases(sorted)
    setLoadingProcedureCases(false)
  }

  // ============================================
  // COMPUTED VALUES
  // ============================================

  const callTimingInsight = useMemo(() => {
    if (!callTiming) return null

    const minBeforeIncision = callTiming.avg_minutes_before_incision
    const prepDuration = callTiming.avg_prep_duration_minutes
    const waitForSurgeon = callTiming.avg_wait_for_surgeon_minutes

    if (minBeforeIncision === null || prepDuration === null) return null

    const callEarliness = Math.abs(minBeforeIncision)
    const potentialOptimization = Math.max(0, callEarliness - prepDuration - 5)

    return {
      callEarliness: Math.round(callEarliness),
      prepDuration: Math.round(prepDuration),
      waitForSurgeon: waitForSurgeon !== null ? Math.round(waitForSurgeon) : null,
      potentialOptimization: Math.round(potentialOptimization),
      casesAnalyzed: callTiming.cases_with_call_data,
    }
  }, [callTiming])

  const selectedSurgeon = surgeons.find(s => s.id === selectedSurgeonId)
  const surgeonName = selectedSurgeon ? `Dr. ${selectedSurgeon.last_name}` : 'Select Surgeon'

  const periodLabels: { [key: string]: string } = {
    week: 'This Week',
    month: 'This Month',
    quarter: 'This Quarter',
    year: 'This Year',
  }

  const totalDelays = delays.reduce((sum, d) => sum + d.count, 0)
  const totalDelayMinutes = delays.reduce((sum, d) => sum + (d.total_minutes || 0), 0)

  // Max values for InlineBar comparison
  const maxSurgicalSeconds = Math.max(...procedures.map(p => p.avg_surgical_seconds || 0), 1)
  const maxTotalSeconds = Math.max(...procedures.map(p => p.avg_total_seconds || 0), 1)

  // Delay colors for donut
  const delayColors = ['#EF4444', '#F59E0B', '#6366F1', '#8B5CF6', '#94A3B8']

  // ============================================
  // LOADING / NO FACILITY STATES
  // ============================================

  if (userLoading || !facilityCheckComplete) {
    return (
      <DashboardLayout>
        <Container>
          <AnalyticsLayout title="Surgeon Overview" description="Performance insights and efficiency metrics">
            <SkeletonMetricCards count={4} />
          </AnalyticsLayout>
        </Container>
      </DashboardLayout>
    )
  }

  if (noFacilitySelected) {
    return (
      <DashboardLayout>
        <Container>
          <AnalyticsLayout
            title="Surgeon Overview"
            description="Select a facility to view surgeon analytics"
          >
            <EmptyState
              icon={
                <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              }
              title="No Facility Selected"
              description="Please select a facility from the header to view surgeon analytics."
            />
          </AnalyticsLayout>
        </Container>
      </DashboardLayout>
    )
  }

  // ============================================
  // MAIN RENDER
  // ============================================

  return (
    <DashboardLayout>
      <Container>
        <AnalyticsLayout
          title="Surgeon Overview"
          description="Performance insights and efficiency metrics"
          actions={
            <div className="flex items-center gap-3">
              {/* Surgeon Selector — custom dropdown with avatar */}
              <SurgeonSelector
                surgeons={surgeons.map(s => ({
                  id: s.id,
                  first_name: s.first_name,
                  last_name: s.last_name,
                }))}
                selectedId={selectedSurgeonId}
                onChange={setSelectedSurgeonId}
              />

              {/* Period Selector — segmented pill buttons */}
              <PeriodSelector
                options={[
                  { value: 'week', label: '1W' },
                  { value: 'month', label: '1M' },
                  { value: 'quarter', label: '3M' },
                  { value: 'year', label: '1Y' },
                ]}
                selected={timePeriod}
                onChange={setTimePeriod}
              />
            </div>
          }
        >
          {loading ? (
            <div className="space-y-8">
              <SkeletonMetricCards count={4} />
              <SkeletonTable rows={4} />
              <SkeletonChart height={200} />
            </div>
          ) : (
            <div className="space-y-10">
              {/* ============================================ */}
              {/* SECTION 1: KEY METRICS */}
              {/* ============================================ */}
              <div>
                <SectionHeader
                  title="Key Metrics"
                  subtitle={periodLabels[timePeriod]}
                  accentColor="blue"
                  icon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  }
                />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                  <EnhancedMetricCard
                    title="Completed Cases"
                    value={caseVolume?.current_count || 0}
                    subtitle={`vs ${caseVolume?.previous_count || 0} prev period`}
                    accentColor="blue"
                    trend={caseVolume?.percent_change !== null && caseVolume?.percent_change !== undefined ? {
                      value: caseVolume.percent_change,
                      improved: caseVolume.percent_change > 0,
                      label: 'vs prev period',
                    } : undefined}
                    icon={
                      <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    }
                  />
                  <EnhancedMetricCard
                    title="First Case On-Time"
                    value={`${firstCaseData?.on_time_percentage || 0}%`}
                    subtitle={`${firstCaseData?.on_time_count || 0} of ${firstCaseData?.total_first_cases || 0} first cases`}
                    accentColor="emerald"
                    progress={firstCaseData?.on_time_percentage || 0}
                    icon={
                      <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    }
                  />
                  <EnhancedMetricCard
                    title="Total Delays"
                    value={totalDelays}
                    subtitle={totalDelayMinutes > 0 ? `${totalDelayMinutes} min total` : 'No duration recorded'}
                    accentColor={totalDelays > 5 ? 'red' : totalDelays > 0 ? 'amber' : 'emerald'}
                    icon={
                      <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    }
                  />
                  <EnhancedMetricCard
                    title="Procedures"
                    value={procedures.length}
                    subtitle="Different procedure types"
                    accentColor="violet"
                    icon={
                      <svg className="w-4 h-4 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                      </svg>
                    }
                  />
                </div>
              </div>

              {/* ============================================ */}
              {/* SECTION 2: PROCEDURE BREAKDOWN */}
              {/* ============================================ */}
              <div>
                <SectionHeader
                  title="Procedure Breakdown"
                  subtitle={`${procedures.reduce((sum, p) => sum + p.case_count, 0)} completed cases`}
                  accentColor="violet"
                  icon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                  }
                />
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mt-4">
                  <table className="w-full">
                    <thead className="bg-slate-50/80">
                      <tr>
                        <th className="px-6 py-3.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Procedure</th>
                        <th className="px-6 py-3.5 text-center text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Cases</th>
                        <th className="px-6 py-3.5 text-center text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Avg Surgical</th>
                        <th className="px-6 py-3.5 text-center text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Avg Total</th>
                        <th className="px-6 py-3.5 text-center text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Consistency</th>
                        <th className="px-6 py-3.5 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {procedures.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center">
                            <EmptyState
                              icon={
                                <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              }
                              title="No completed cases"
                              description="No completed cases found for this period."
                            />
                          </td>
                        </tr>
                      ) : (
                        procedures.map((proc) => {
                          const level = getConsistencyLevel(proc.avg_surgical_seconds, proc.stddev_surgical_seconds)
                          return (
                            <tr key={proc.procedure_id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-6 py-4">
                                <span className="text-sm font-medium text-slate-900">{proc.procedure_name}</span>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <span className="text-sm font-semibold text-slate-900 tabular-nums">{proc.case_count}</span>
                              </td>
                              <td className="px-6 py-4">
                                <InlineBar
                                  value={proc.avg_surgical_seconds || 0}
                                  max={maxSurgicalSeconds}
                                  color="blue"
                                  label={proc.avg_surgical_seconds ? formatSecondsToHHMMSS(Math.round(proc.avg_surgical_seconds)) : '--'}
                                />
                              </td>
                              <td className="px-6 py-4">
                                <InlineBar
                                  value={proc.avg_total_seconds || 0}
                                  max={maxTotalSeconds}
                                  color="slate"
                                  label={proc.avg_total_seconds ? formatSecondsToHHMMSS(Math.round(proc.avg_total_seconds)) : '--'}
                                />
                              </td>
                              <td className="px-6 py-4 text-center">
                                <ConsistencyBadge
                                  label={getConsistencyLabel(level)}
                                  level={level}
                                />
                              </td>
                              <td className="px-6 py-4 text-right">
                                <button
                                  onClick={() => fetchProcedureCases(proc)}
                                  className="text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors"
                                >
                                  Details →
                                </button>
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ============================================ */}
              {/* SECTION 3: CALL TIMING — Visual Timeline */}
              {/* ============================================ */}
              {callTimingInsight && (
                <div>
                  <SectionHeader
                    title="Call Timing Analysis"
                    subtitle={`Based on ${callTimingInsight.casesAnalyzed} cases`}
                    accentColor="blue"
                    icon={
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    }
                  />
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
                    <div className="lg:col-span-2">
                      <CallTimingTimeline
                        callEarliness={callTimingInsight.callEarliness}
                        prepDuration={callTimingInsight.prepDuration}
                        waitForSurgeon={callTimingInsight.waitForSurgeon}
                        casesAnalyzed={callTimingInsight.casesAnalyzed}
                      />
                    </div>

                    {callTimingInsight.potentialOptimization > 5 && (
                      <div className="lg:col-span-1">
                        <InsightCard
                          type="info"
                          icon={
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                          }
                          title="Optimization Opportunity"
                        >
                          <p>
                            You could call <span className="font-semibold text-blue-700">{callTimingInsight.potentialOptimization} min later</span> and still have the room ready when you arrive.
                          </p>
                          <p className="mt-2 text-slate-500">
                            This reduces patient wait time while maintaining your efficient flow.
                          </p>
                        </InsightCard>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ============================================ */}
              {/* SECTION 4: DELAYS — Bar Chart + Donut */}
              {/* ============================================ */}
              {delays.length > 0 && (
                <div>
                  <SectionHeader
                    title="Delays"
                    subtitle={`${totalDelays} total ${periodLabels[timePeriod].toLowerCase()}`}
                    accentColor="red"
                    icon={
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    }
                  />
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mt-4">
                    {/* Delay Donut */}
                    <div className="lg:col-span-3">
                      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex items-center justify-center">
                        <DelayDonut
                          delays={delays.map((d, i) => ({
                            name: d.display_name,
                            count: d.count,
                            color: delayColors[i] || '#94A3B8',
                          }))}
                          totalDelays={totalDelays}
                          totalMinutes={totalDelayMinutes}
                        />
                      </div>
                    </div>

                    {/* Bar chart */}
                    <div className="lg:col-span-5">
                      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                        <div className="space-y-4">
                          {delays.map((delay, idx) => {
                            const maxCount = delays[0].count
                            const barWidth = (delay.count / maxCount) * 100
                            return (
                              <div key={delay.delay_type}>
                                <div className="flex items-center justify-between mb-1.5">
                                  <div className="flex items-center gap-2">
                                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: delayColors[idx] || '#94A3B8' }} />
                                    <span className="text-sm font-medium text-slate-700">{delay.display_name}</span>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="text-sm font-semibold text-slate-900 tabular-nums">{delay.count}</span>
                                    {delay.total_minutes && delay.total_minutes > 0 && (
                                      <span className="text-xs text-slate-400 tabular-nums">({delay.total_minutes} min)</span>
                                    )}
                                  </div>
                                </div>
                                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full transition-all duration-700 ease-out"
                                    style={{
                                      width: `${barWidth}%`,
                                      backgroundColor: delayColors[idx] || '#94A3B8',
                                    }}
                                  />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Insight */}
                    {delays[0] && delays[0].count >= 3 && (
                      <div className="lg:col-span-4">
                        <InsightCard
                          type="warning"
                          icon={
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                          }
                          title="Action Recommended"
                        >
                          <p>
                            <span className="font-semibold">{delays[0].count} delays</span> from {delays[0].display_name.toLowerCase()}.
                          </p>
                          {delays[0].delay_type === 'Equipment Issue' || delays[0].delay_type === 'waiting_equipment' ? (
                            <p className="mt-2 text-slate-500">
                              Review your preference card with OR staff to ensure all instruments are available.
                            </p>
                          ) : delays[0].delay_type === 'Staff Availability' || delays[0].delay_type === 'waiting_staff' ? (
                            <p className="mt-2 text-slate-500">
                              Consider discussing staffing needs with the OR director.
                            </p>
                          ) : (
                            <p className="mt-2 text-slate-500">
                              This is your most common delay type. Consider reviewing the root causes.
                            </p>
                          )}
                        </InsightCard>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Link to full case history */}
              <div className="pt-4 border-t border-slate-200">
                <Link
                  href="/analytics/surgeons"
                  className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium transition-colors"
                >
                  View full case history for {surgeonName}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </div>
          )}

          {/* ============================================ */}
          {/* SLIDE-OUT PANEL: PROCEDURE DETAILS */}
          {/* ============================================ */}
          <SlideOutPanel
            isOpen={selectedProcedure !== null}
            onClose={() => setSelectedProcedure(null)}
            title={selectedProcedure?.procedure_name || ''}
            subtitle={`${selectedProcedure?.case_count || 0} cases ${periodLabels[timePeriod].toLowerCase()}`}
          >
            {loadingProcedureCases ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="h-24 bg-slate-100 rounded-lg animate-pulse" />
                  <div className="h-24 bg-slate-100 rounded-lg animate-pulse" />
                </div>
                <div className="h-16 bg-slate-100 rounded-lg animate-pulse" />
                <div className="h-48 bg-slate-100 rounded-lg animate-pulse" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Summary Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Avg Surgical Time</p>
                    <p className="text-2xl font-bold text-slate-900 font-mono mt-1">
                      {selectedProcedure?.avg_surgical_seconds
                        ? formatSecondsToHHMMSS(Math.round(selectedProcedure.avg_surgical_seconds))
                        : '--'}
                    </p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Avg Total Time</p>
                    <p className="text-2xl font-bold text-slate-900 font-mono mt-1">
                      {selectedProcedure?.avg_total_seconds
                        ? formatSecondsToHHMMSS(Math.round(selectedProcedure.avg_total_seconds))
                        : '--'}
                    </p>
                  </div>
                </div>

                {/* Range */}
                {procedureCases.length > 0 && (
                  <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                    <p className="text-xs font-medium text-blue-700 uppercase tracking-wider mb-1">Surgical Time Range</p>
                    <p className="text-sm font-semibold text-blue-900 font-mono">
                      {formatSecondsToHHMMSS(Math.round(procedureCases[0].surgical_seconds || 0))} — {formatSecondsToHHMMSS(Math.round(procedureCases[procedureCases.length - 1].surgical_seconds || 0))}
                    </p>
                  </div>
                )}

                {/* Outliers */}
                {procedureCases.length >= 3 && (
                  <div>
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Notable Cases</h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                        <div>
                          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Fastest</span>
                          <p className="text-sm font-medium text-slate-900 mt-0.5">
                            <Link href={`/cases/${procedureCases[0].id}`} className="hover:text-blue-600 transition-colors">
                              {procedureCases[0].case_number}
                            </Link>
                          </p>
                          <p className="text-xs text-slate-500">{procedureCases[0].scheduled_date}</p>
                        </div>
                        <span className="font-mono text-emerald-700 font-bold text-lg">
                          {formatSecondsToHHMMSS(Math.round(procedureCases[0].surgical_seconds || 0))}
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-amber-50 rounded-xl border border-amber-100">
                        <div>
                          <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Slowest</span>
                          <p className="text-sm font-medium text-slate-900 mt-0.5">
                            <Link href={`/cases/${procedureCases[procedureCases.length - 1].id}`} className="hover:text-blue-600 transition-colors">
                              {procedureCases[procedureCases.length - 1].case_number}
                            </Link>
                          </p>
                          <p className="text-xs text-slate-500">{procedureCases[procedureCases.length - 1].scheduled_date}</p>
                        </div>
                        <span className="font-mono text-amber-700 font-bold text-lg">
                          {formatSecondsToHHMMSS(Math.round(procedureCases[procedureCases.length - 1].surgical_seconds || 0))}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* All Cases Table */}
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">All Cases</h4>
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden max-h-64 overflow-y-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50/80 sticky top-0">
                        <tr>
                          <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Case #</th>
                          <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                          <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Surgical</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {procedureCases.map((c) => (
                          <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-2.5 text-sm">
                              <Link href={`/cases/${c.id}`} className="text-blue-600 hover:text-blue-800 font-medium transition-colors">
                                {c.case_number}
                              </Link>
                            </td>
                            <td className="px-4 py-2.5 text-sm text-slate-600">{c.scheduled_date}</td>
                            <td className="px-4 py-2.5 text-sm text-right font-mono font-semibold text-slate-900 tabular-nums">
                              {c.surgical_seconds ? formatSecondsToHHMMSS(Math.round(c.surgical_seconds)) : '--'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Link to filtered analysis */}
                <div className="pt-4 border-t border-slate-200">
                  <Link
                    href={`/analytics/surgeons?procedure=${selectedProcedure?.procedure_id}`}
                    className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium text-sm transition-colors"
                  >
                    View in full case analysis
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </Link>
                </div>
              </div>
            )}
          </SlideOutPanel>
        </AnalyticsLayout>
      </Container>
    </DashboardLayout>
  )
}