'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '../../../lib/supabase'
import { useUser } from '../../../lib/UserContext'
import { getImpersonationState } from '../../../lib/impersonation'
import DashboardLayout from '../../../components/layouts/DashboardLayout'
import Container from '../../../components/ui/Container'
import AnalyticsLayout from '../../../components/analytics/AnalyticsLayout'
import { formatSecondsToHHMMSS } from '../../../lib/analytics'

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
    default: // month
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

function getConsistencyLabel(avgSeconds: number | null, stddevSeconds: number | null): { label: string; color: string } {
  if (!avgSeconds || !stddevSeconds || avgSeconds === 0) {
    return { label: 'N/A', color: 'text-slate-400' }
  }
  
  const cv = (stddevSeconds / avgSeconds) * 100 // Coefficient of variation
  
  if (cv < 10) {
    return { label: 'Very Consistent', color: 'text-emerald-600' }
  } else if (cv < 20) {
    return { label: 'Consistent', color: 'text-blue-600' }
  } else {
    return { label: 'Variable', color: 'text-amber-600' }
  }
}

function formatMinutes(minutes: number | null): string {
  if (minutes === null || isNaN(minutes)) return '--'
  const absMinutes = Math.abs(minutes)
  const mins = Math.floor(absMinutes)
  const secs = Math.round((absMinutes - mins) * 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// Get timezone offset in milliseconds for a given date and IANA timezone
// This handles DST automatically
function getTimezoneOffsetMs(date: Date, timezone: string): number {
  try {
    // Format the date in both UTC and the target timezone
    const utcString = date.toLocaleString('en-US', { timeZone: 'UTC' })
    const tzString = date.toLocaleString('en-US', { timeZone: timezone })
    
    // Parse both back to dates and find the difference
    const utcDate = new Date(utcString)
    const tzDate = new Date(tzString)
    
    return utcDate.getTime() - tzDate.getTime()
  } catch {
    // Fallback to EST (UTC-5) if timezone is invalid
    return 5 * 60 * 60 * 1000
  }
}

// Get timezone offset in hours for a specific date (handles DST)
function getTimezoneOffsetHours(timezone: string, date: Date): number {
  try {
    // Use Intl API to get accurate offset including DST
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'longOffset' // This gives "GMT-05:00" format
    })
    
    const parts = formatter.formatToParts(date)
    const offsetPart = parts.find(p => p.type === 'timeZoneName')?.value || 'GMT'
    
    // Parse "GMT-05:00" or "GMT+05:30" format
    const match = offsetPart.match(/GMT([+-])(\d{2}):(\d{2})/)
    if (match) {
      const sign = match[1] === '+' ? 1 : -1
      const hours = parseInt(match[2], 10)
      const minutes = parseInt(match[3], 10)
      return sign * (hours + minutes / 60)
    }
    
    return 0 // Default to UTC if parsing fails
  } catch (e) {
    console.error('Error parsing timezone:', e)
    return -5 // Fallback to EST
  }
}

// Convert local time to UTC using facility timezone
function localTimeToUTC(dateStr: string, timeStr: string, timezone: string): Date {
  // Create a date object from the local datetime
  const localDateTime = new Date(`${dateStr}T${timeStr}`)
  
  // Get the offset for this specific date (handles DST)
  const offsetHours = getTimezoneOffsetHours(timezone, localDateTime)
  
  // Subtract the offset to convert local to UTC
  // e.g., 7:00 AM EST (UTC-5) -> offset is -5 -> 7:00 - (-5) = 12:00 UTC
  return new Date(localDateTime.getTime() - (offsetHours * 60 * 60 * 1000))
}

// ============================================
// SLIDE-OUT PANEL COMPONENT
// ============================================

interface SlideOutPanelProps {
  isOpen: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: React.ReactNode
}

function SlideOutPanel({ isOpen, onClose, title, subtitle, children }: SlideOutPanelProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/30 transition-opacity"
        onClick={onClose}
      />
      
      {/* Panel */}
      <div className="absolute inset-y-0 right-0 max-w-xl w-full">
        <div className="h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
              {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
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
          <div className="flex-1 overflow-y-auto p-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

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
  icon?: React.ReactNode
  highlighted?: boolean
}

function MetricCard({ title, value, subtitle, trend, icon, highlighted = false }: MetricCardProps) {
  return (
    <div className={`rounded-xl border p-5 ${highlighted ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200'}`}>
      <div className="flex items-start justify-between mb-2">
        <p className="text-sm font-medium text-slate-600">{title}</p>
        {icon && <div className="text-slate-400">{icon}</div>}
      </div>
      
      <div className="flex items-end gap-3">
        <p className={`text-2xl font-bold ${highlighted ? 'text-blue-600' : 'text-slate-900'}`}>
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
      
      {subtitle && (
        <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
      )}
    </div>
  )
}

// ============================================
// INSIGHT CARD COMPONENT
// ============================================

interface InsightCardProps {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
  type?: 'info' | 'success' | 'warning'
}

function InsightCard({ icon, title, children, type = 'info' }: InsightCardProps) {
  const bgColor = type === 'success' ? 'bg-emerald-50 border-emerald-200' :
                  type === 'warning' ? 'bg-amber-50 border-amber-200' :
                  'bg-blue-50 border-blue-200'
  const iconColor = type === 'success' ? 'text-emerald-600' :
                    type === 'warning' ? 'text-amber-600' :
                    'text-blue-600'

  return (
    <div className={`rounded-xl border p-4 ${bgColor}`}>
      <div className="flex gap-3">
        <div className={`flex-shrink-0 ${iconColor}`}>
          {icon}
        </div>
        <div>
          <p className="font-medium text-slate-900 mb-1">{title}</p>
          <div className="text-sm text-slate-600">
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

      // Fetch all data in parallel
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

  // Data fetching functions
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
    // Get completed status ID
    const { data: statusData } = await supabase
      .from('case_statuses')
      .select('id')
      .eq('name', 'completed')
      .single()

    if (!statusData) return

    // Fetch cases with milestones for this surgeon
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

    // Group by procedure and calculate times
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
      
      // Build milestone map
      const milestones: { [key: string]: Date } = {}
      c.case_milestones?.forEach((m: any) => {
        const name = m.milestone_types?.name
        if (name && m.recorded_at) {
          milestones[name] = new Date(m.recorded_at)
        }
      })

      // Calculate surgical time (incision → closing)
      if (milestones.incision && milestones.closing) {
        const surgicalSeconds = (milestones.closing.getTime() - milestones.incision.getTime()) / 1000
        if (surgicalSeconds > 0 && surgicalSeconds < 36000) { // Sanity check: < 10 hours
          proc.surgical_times.push(surgicalSeconds)
        }
      }

      // Calculate total time (patient_in → patient_out)
      if (milestones.patient_in && milestones.patient_out) {
        const totalSeconds = (milestones.patient_out.getTime() - milestones.patient_in.getTime()) / 1000
        if (totalSeconds > 0 && totalSeconds < 36000) {
          proc.total_times.push(totalSeconds)
        }
      }
    })

    // Convert to array and calculate stats
    const proceduresArray: ProcedureBreakdown[] = Array.from(procedureMap.values())
      .map(proc => {
        const avgSurgical = proc.surgical_times.length > 0
          ? proc.surgical_times.reduce((a, b) => a + b, 0) / proc.surgical_times.length
          : null
        const avgTotal = proc.total_times.length > 0
          ? proc.total_times.reduce((a, b) => a + b, 0) / proc.total_times.length
          : null
        
        // Calculate standard deviation for surgical times
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

    // Fetch cases with call_time and milestones
    const { data: casesData } = await supabase
      .from('cases')
      .select(`
        id,
        call_time,
        case_milestones (
          recorded_at,
          milestone_types (name)
        )
      `)
      .eq('facility_id', effectiveFacilityId)
      .eq('surgeon_id', selectedSurgeonId)
      .eq('status_id', statusData.id)
      .not('call_time', 'is', null)
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

      const callTime = new Date(c.call_time)

      // Minutes before incision (negative = before)
      if (milestones.incision) {
        const minBeforeIncision = (callTime.getTime() - milestones.incision.getTime()) / 1000 / 60
        timings.minutesBeforeIncision.push(minBeforeIncision)
      }

      // Prep duration (patient_in → prepped)
      if (milestones.patient_in && milestones.prepped) {
        const prepMin = (milestones.prepped.getTime() - milestones.patient_in.getTime()) / 1000 / 60
        if (prepMin > 0 && prepMin < 120) {
          timings.prepDurations.push(prepMin)
        }
      }

      // Wait for surgeon (prepped → incision)
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

    // Group by delay type
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

    // Fetch all cases for this surgeon with start_time and patient_in milestone
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

    // Group by date to find first case of each day
    const casesByDate = new Map<string, any>()
    casesData.forEach((c: any) => {
      if (!casesByDate.has(c.scheduled_date)) {
        casesByDate.set(c.scheduled_date, c)
      }
    })

    let totalFirstCases = 0
    let onTimeCount = 0

    casesByDate.forEach((c) => {
      // Find patient_in milestone
      const patientInMilestone = c.case_milestones?.find(
        (m: any) => m.milestone_types?.name === 'patient_in'
      )

      if (!patientInMilestone?.recorded_at || !c.start_time) return

      totalFirstCases++

      // Calculate variance with timezone adjustment
      // Scheduled time is local, milestone is UTC
      // Use facility timezone to convert scheduled local time to UTC
      const scheduledDateTime = new Date(`${c.scheduled_date}T${c.start_time}`)
      const offsetMs = getTimezoneOffsetMs(scheduledDateTime, facilityTimezone)
      const scheduledUTC = new Date(scheduledDateTime.getTime() + offsetMs)
      const actualUTC = new Date(patientInMilestone.recorded_at)

      const varianceMinutes = (actualUTC.getTime() - scheduledUTC.getTime()) / 1000 / 60

      // On-time if within ±10 minutes
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

    // Sort by surgical time for outlier display
    const sorted = [...cases].sort((a, b) => (a.surgical_seconds || 0) - (b.surgical_seconds || 0))

    setProcedureCases(sorted)
    setLoadingProcedureCases(false)
  }

  // Computed values for call timing insight
  const callTimingInsight = useMemo(() => {
    if (!callTiming) return null

    const minBeforeIncision = callTiming.avg_minutes_before_incision
    const prepDuration = callTiming.avg_prep_duration_minutes
    const waitForSurgeon = callTiming.avg_wait_for_surgeon_minutes

    if (minBeforeIncision === null || prepDuration === null) return null

    // How early they call (absolute value since it's negative)
    const callEarliness = Math.abs(minBeforeIncision)
    
    // How much earlier they could call: callEarliness - prepDuration - small buffer
    const potentialOptimization = Math.max(0, callEarliness - prepDuration - 5)

    return {
      callEarliness: Math.round(callEarliness),
      prepDuration: Math.round(prepDuration),
      waitForSurgeon: waitForSurgeon !== null ? Math.round(waitForSurgeon) : null,
      potentialOptimization: Math.round(potentialOptimization),
      casesAnalyzed: callTiming.cases_with_call_data,
    }
  }, [callTiming])

  // Get selected surgeon name
  const selectedSurgeon = surgeons.find(s => s.id === selectedSurgeonId)
  const surgeonName = selectedSurgeon ? `Dr. ${selectedSurgeon.last_name}` : 'Select Surgeon'

  // Period labels
  const periodLabels: { [key: string]: string } = {
    week: 'This Week',
    month: 'This Month',
    quarter: 'This Quarter',
    year: 'This Year',
  }

  // Total delays
  const totalDelays = delays.reduce((sum, d) => sum + d.count, 0)
  const totalDelayMinutes = delays.reduce((sum, d) => sum + (d.total_minutes || 0), 0)

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

  // No facility selected
  if (noFacilitySelected) {
    return (
      <DashboardLayout>
        <Container>
          <AnalyticsLayout
            title="Surgeon Overview"
            description="Select a facility to view surgeon analytics"
          >
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
              <p className="text-amber-800">Please select a facility from the header to view analytics.</p>
            </div>
          </AnalyticsLayout>
        </Container>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <Container>
        <AnalyticsLayout
          title="Surgeon Overview"
          description="Performance insights and efficiency metrics"
          actions={
            <div className="flex items-center gap-3">
              {/* Surgeon Selector */}
              <select
                value={selectedSurgeonId || ''}
                onChange={(e) => setSelectedSurgeonId(e.target.value)}
                className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {surgeons.map((surgeon) => (
                  <option key={surgeon.id} value={surgeon.id}>
                    Dr. {surgeon.last_name}, {surgeon.first_name}
                  </option>
                ))}
              </select>

              {/* Time Period Selector */}
              <select
                value={timePeriod}
                onChange={(e) => setTimePeriod(e.target.value)}
                className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="quarter">This Quarter</option>
                <option value="year">This Year</option>
              </select>
            </div>
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
            <div className="space-y-8">
              {/* ============================================ */}
              {/* SECTION 1: KEY METRICS */}
              {/* ============================================ */}
              <div>
                <h2 className="text-lg font-semibold text-slate-900 mb-4">Key Metrics</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <MetricCard
                    title="Completed Cases"
                    value={caseVolume?.current_count || 0}
                    subtitle={`vs ${caseVolume?.previous_count || 0} prev period`}
                    trend={caseVolume?.percent_change !== null ? {
                      value: caseVolume?.percent_change || 0,
                      improved: (caseVolume?.percent_change || 0) > 0,
                    } : undefined}
                    highlighted
                  />
                  <MetricCard
                    title="First Case On-Time"
                    value={`${firstCaseData?.on_time_percentage || 0}%`}
                    subtitle={`${firstCaseData?.on_time_count || 0} of ${firstCaseData?.total_first_cases || 0} first cases`}
                  />
                  <MetricCard
                    title="Total Delays"
                    value={totalDelays}
                    subtitle={totalDelayMinutes > 0 ? `${totalDelayMinutes} min total` : 'No duration recorded'}
                  />
                  <MetricCard
                    title="Procedures"
                    value={procedures.length}
                    subtitle="Different procedure types"
                  />
                </div>
              </div>

              {/* ============================================ */}
              {/* SECTION 2: PROCEDURE BREAKDOWN */}
              {/* ============================================ */}
              <div>
                <h2 className="text-lg font-semibold text-slate-900 mb-4">Procedure Breakdown</h2>
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Procedure</th>
                        <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Cases</th>
                        <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Avg Surgical</th>
                        <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Avg Total</th>
                        <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Consistency</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {procedures.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                            No completed cases found for this period
                          </td>
                        </tr>
                      ) : (
                        procedures.map((proc) => {
                          const consistency = getConsistencyLabel(proc.avg_surgical_seconds, proc.stddev_surgical_seconds)
                          return (
                            <tr key={proc.procedure_id} className="hover:bg-slate-50">
                              <td className="px-6 py-4 text-sm font-medium text-slate-900">{proc.procedure_name}</td>
                              <td className="px-6 py-4 text-sm text-slate-600 text-center">{proc.case_count}</td>
                              <td className="px-6 py-4 text-sm text-slate-600 text-center font-mono">
                                {proc.avg_surgical_seconds ? formatSecondsToHHMMSS(proc.avg_surgical_seconds) : '--'}
                              </td>
                              <td className="px-6 py-4 text-sm text-slate-600 text-center font-mono">
                                {proc.avg_total_seconds ? formatSecondsToHHMMSS(proc.avg_total_seconds) : '--'}
                              </td>
                              <td className="px-6 py-4 text-center">
                                <span className={`text-sm font-medium ${consistency.color}`}>
                                  {consistency.label}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <button
                                  onClick={() => fetchProcedureCases(proc)}
                                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                >
                                  View Details →
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
              {/* SECTION 3: CALL TIMING INSIGHT */}
              {/* ============================================ */}
              {callTimingInsight && (
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 mb-4">Call Timing Analysis</h2>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-2">
                      <div className="bg-white rounded-xl border border-slate-200 p-6">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-slate-900 mb-3">Patient Call Timing</h3>
                            <div className="space-y-2 text-sm text-slate-600">
                              <p>
                                You call for your next patient <span className="font-semibold text-slate-900">{callTimingInsight.callEarliness} minutes</span> before your incision.
                              </p>
                              <p>
                                Your team takes <span className="font-semibold text-slate-900">{callTimingInsight.prepDuration} minutes</span> to prep the next patient.
                              </p>
                              {callTimingInsight.waitForSurgeon !== null && (
                                <p>
                                  Your rooms are ready <span className="font-semibold text-slate-900">{callTimingInsight.waitForSurgeon} minutes</span> before you cut.
                                </p>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 mt-3">
                              Based on {callTimingInsight.casesAnalyzed} cases with call data
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {callTimingInsight.potentialOptimization > 5 && (
                      <div className="lg:col-span-1">
                        <InsightCard
                          type="info"
                          icon={
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          }
                          title="Optimization Opportunity"
                        >
                          <p>
                            You could call <span className="font-semibold">{callTimingInsight.potentialOptimization} minutes later</span> and still have the room ready when you arrive.
                          </p>
                          <p className="mt-2 text-slate-500">
                            This could reduce patient wait time while maintaining your efficient flow.
                          </p>
                        </InsightCard>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ============================================ */}
              {/* SECTION 4: DELAYS SUMMARY */}
              {/* ============================================ */}
              {delays.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 mb-4">
                    Delays
                    <span className="ml-2 text-sm font-normal text-slate-500">
                      {totalDelays} total {periodLabels[timePeriod].toLowerCase()}
                    </span>
                  </h2>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-2">
                      <div className="bg-white rounded-xl border border-slate-200 p-6">
                        <div className="space-y-4">
                          {delays.map((delay, idx) => {
                            const maxCount = delays[0].count
                            const barWidth = (delay.count / maxCount) * 100
                            return (
                              <div key={delay.delay_type}>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-sm font-medium text-slate-700">{delay.display_name}</span>
                                  <div className="flex items-center gap-3">
                                    <span className="text-sm font-semibold text-slate-900">{delay.count}</span>
                                    {delay.total_minutes && delay.total_minutes > 0 && (
                                      <span className="text-xs text-slate-500">({delay.total_minutes} min)</span>
                                    )}
                                  </div>
                                </div>
                                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      idx === 0 ? 'bg-red-500' :
                                      idx === 1 ? 'bg-amber-500' :
                                      'bg-slate-400'
                                    }`}
                                    style={{ width: `${barWidth}%` }}
                                  />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                    
                    {delays[0] && delays[0].count >= 3 && (
                      <div className="lg:col-span-1">
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
                  className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium"
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
              <div className="flex items-center justify-center py-12">
                <svg className="animate-spin h-6 w-6 text-blue-600" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Summary Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 rounded-lg p-4">
                    <p className="text-sm text-slate-500">Avg Surgical Time</p>
                    <p className="text-xl font-bold text-slate-900 font-mono">
                      {selectedProcedure?.avg_surgical_seconds 
                        ? formatSecondsToHHMMSS(selectedProcedure.avg_surgical_seconds)
                        : '--'}
                    </p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-4">
                    <p className="text-sm text-slate-500">Avg Total Time</p>
                    <p className="text-xl font-bold text-slate-900 font-mono">
                      {selectedProcedure?.avg_total_seconds
                        ? formatSecondsToHHMMSS(selectedProcedure.avg_total_seconds)
                        : '--'}
                    </p>
                  </div>
                </div>

                {/* Range */}
                {procedureCases.length > 0 && (
                  <div className="bg-blue-50 rounded-lg p-4">
                    <p className="text-sm font-medium text-blue-800 mb-1">Surgical Time Range</p>
                    <p className="text-sm text-blue-700">
                      {formatSecondsToHHMMSS(procedureCases[0].surgical_seconds || 0)} — {formatSecondsToHHMMSS(procedureCases[procedureCases.length - 1].surgical_seconds || 0)}
                    </p>
                  </div>
                )}

                {/* Outliers */}
                {procedureCases.length >= 3 && (
                  <div>
                    <h4 className="font-medium text-slate-900 mb-3">Notable Cases</h4>
                    <div className="space-y-2">
                      {/* Fastest */}
                      <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
                        <div>
                          <span className="text-xs font-medium text-emerald-600 uppercase">Fastest</span>
                          <p className="text-sm font-medium text-slate-900">
                            <Link href={`/cases/${procedureCases[0].id}`} className="hover:text-blue-600">
                              {procedureCases[0].case_number}
                            </Link>
                          </p>
                          <p className="text-xs text-slate-500">{procedureCases[0].scheduled_date}</p>
                        </div>
                        <span className="font-mono text-emerald-700 font-semibold">
                          {formatSecondsToHHMMSS(procedureCases[0].surgical_seconds || 0)}
                        </span>
                      </div>
                      
                      {/* Slowest */}
                      <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                        <div>
                          <span className="text-xs font-medium text-amber-600 uppercase">Slowest</span>
                          <p className="text-sm font-medium text-slate-900">
                            <Link href={`/cases/${procedureCases[procedureCases.length - 1].id}`} className="hover:text-blue-600">
                              {procedureCases[procedureCases.length - 1].case_number}
                            </Link>
                          </p>
                          <p className="text-xs text-slate-500">{procedureCases[procedureCases.length - 1].scheduled_date}</p>
                        </div>
                        <span className="font-mono text-amber-700 font-semibold">
                          {formatSecondsToHHMMSS(procedureCases[procedureCases.length - 1].surgical_seconds || 0)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* All Cases Table */}
                <div>
                  <h4 className="font-medium text-slate-900 mb-3">All Cases</h4>
                  <div className="bg-white rounded-lg border border-slate-200 overflow-hidden max-h-64 overflow-y-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Case #</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Date</th>
                          <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Surgical</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {procedureCases.map((c) => (
                          <tr key={c.id} className="hover:bg-slate-50">
                            <td className="px-4 py-2 text-sm">
                              <Link href={`/cases/${c.id}`} className="text-blue-600 hover:text-blue-800 font-medium">
                                {c.case_number}
                              </Link>
                            </td>
                            <td className="px-4 py-2 text-sm text-slate-600">{c.scheduled_date}</td>
                            <td className="px-4 py-2 text-sm text-right font-mono text-slate-900">
                              {c.surgical_seconds ? formatSecondsToHHMMSS(c.surgical_seconds) : '--'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Link to filtered case history */}
                <div className="pt-4 border-t border-slate-200">
                  <Link
                    href={`/analytics/surgeons?procedure=${selectedProcedure?.procedure_id}`}
                    className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium text-sm"
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
