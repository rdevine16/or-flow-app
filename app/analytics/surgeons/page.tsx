'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import { AnalyticsPageHeader } from '@/components/analytics/AnalyticsBreadcrumb'
import { formatTimeInTimezone } from '@/lib/date-utils'
import { UserIcon } from '@heroicons/react/24/outline'
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
  formatTimeFromTimestamp,
  getAllTurnovers,
  getAllSurgicalTurnovers,
  CaseWithMilestones,
} from '@/lib/analytics'

interface Surgeon {
  id: string
  first_name: string
  last_name: string
}

interface ProcedureType {
  id: string
  name: string
}

// Helper to get today's date in YYYY-MM-DD format
function getLocalDateString(date?: Date): string {
  const d = date || new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Format date for display
function formatDateDisplay(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('en-US', { 
    month: 'numeric', 
    day: 'numeric', 
    year: 'numeric' 
  })
}

export default function SurgeonAnalysisPage() {
  const supabase = createClient()
  const { userData, loading: userLoading } = useUser()
  const facilityId = userData.facilityId
  const facilityTimezone = userData.facilityTimezone
  
  const [surgeons, setSurgeons] = useState<Surgeon[]>([])
  const [procedures, setProcedures] = useState<ProcedureType[]>([])
  const [selectedSurgeon, setSelectedSurgeon] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState(getLocalDateString())
  const [selectedProcedureFilter, setSelectedProcedureFilter] = useState<string>('all')
  
  // Cases for different time periods
  const [dayCases, setDayCases] = useState<CaseWithMilestones[]>([])
  const [last30DaysCases, setLast30DaysCases] = useState<CaseWithMilestones[]>([])
  const [allTimeCases, setAllTimeCases] = useState<CaseWithMilestones[]>([])
  
  const [loading, setLoading] = useState(true)
  const [initialLoading, setInitialLoading] = useState(true)

  // Fetch surgeons on mount
  useEffect(() => {
    if (!facilityId) return
    
    async function fetchSurgeons() {
      const { data: surgeonRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('name', 'surgeon')
        .single()

      const { data: surgeonsData } = await supabase
        .from('users')
        .select('id, first_name, last_name, role_id')
        .eq('facility_id', facilityId)

      const { data: proceduresData } = await supabase
        .from('procedure_types')
        .select('id, name')
        .eq('facility_id', facilityId)
        .order('name')

      setSurgeons(
        (surgeonsData?.filter(u => u.role_id === surgeonRole?.id) as Surgeon[]) || []
      )
      setProcedures(proceduresData || [])
      setInitialLoading(false)
    }
    fetchSurgeons()
  }, [facilityId])

  // Fetch cases when surgeon or date changes
  useEffect(() => {
    if (!selectedSurgeon) {
      setDayCases([])
      setLast30DaysCases([])
      setAllTimeCases([])
      setLoading(false)
      return
    }

    async function fetchCases() {
      setLoading(true)

      // Calculate date ranges
      const today = new Date()
      const thirtyDaysAgo = new Date(today)
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      // Query for selected day
      const { data: dayData } = await supabase
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
        .eq('surgeon_id', selectedSurgeon)
        .eq('scheduled_date', selectedDate)
        .order('start_time', { ascending: true })

      // Query for last 30 days
      const { data: last30Data } = await supabase
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
        .eq('surgeon_id', selectedSurgeon)
        .gte('scheduled_date', getLocalDateString(thirtyDaysAgo))
        .lte('scheduled_date', getLocalDateString(today))

      // Query for all time
      const { data: allTimeData } = await supabase
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
        .eq('surgeon_id', selectedSurgeon)

      setDayCases((dayData as unknown as CaseWithMilestones[]) || [])
      setLast30DaysCases((last30Data as unknown as CaseWithMilestones[]) || [])
      setAllTimeCases((allTimeData as unknown as CaseWithMilestones[]) || [])
      setLoading(false)
    }

    fetchCases()
  }, [selectedSurgeon, selectedDate])

  // Get completed cases (have patient_in and patient_out milestones)
  const getCompletedCases = (cases: CaseWithMilestones[]) => {
    return cases.filter(c => {
      const milestones = getMilestoneMap(c)
      return milestones.patient_in && milestones.patient_out
    })
  }

  // Calculate metrics for a set of cases
  const calculateMetrics = (cases: CaseWithMilestones[]) => {
    const completedCases = getCompletedCases(cases)
    
    const orTimes = completedCases.map(c => getTotalORTime(getMilestoneMap(c)))
    const surgicalTimes = completedCases.map(c => getSurgicalTime(getMilestoneMap(c)))
    const incisionToClosingTimes = completedCases.map(c => getIncisionToClosing(getMilestoneMap(c)))
    const wheelsInToIncisionTimes = completedCases.map(c => getWheelsInToIncision(getMilestoneMap(c)))
    const closingTimes = completedCases.map(c => getClosingTime(getMilestoneMap(c)))
    const closedToWheelsOutTimes = completedCases.map(c => getClosedToWheelsOut(getMilestoneMap(c)))
    
    // Get first case info
    const firstCase = completedCases.length > 0 ? completedCases[0] : null
    const firstCaseTime = firstCase ? getMilestoneMap(firstCase).patient_in : null
    const firstCaseScheduledTime = firstCase?.start_time || null

    // Calculate turnovers (both return seconds now)
    const roomTurnovers = getAllTurnovers(completedCases)
    const surgicalTurnovers = getAllSurgicalTurnovers(completedCases)

    // Calculate total times for uptime calculation
    const totalORTime = calculateSum(orTimes) || 0
    const totalSurgicalTime = calculateSum(incisionToClosingTimes) || 0
    
    // Uptime percentage (surgical time / total OR time)
    const uptimePercent = totalORTime > 0 
      ? Math.round((totalSurgicalTime / totalORTime) * 100) 
      : 0

    return {
      totalCases: completedCases.length,
      firstCaseStartTime: firstCaseTime,
      firstCaseScheduledTime: firstCaseScheduledTime,
      totalORTime: totalORTime,
      totalSurgicalTime: totalSurgicalTime,
      uptimePercent: uptimePercent,
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

  // Memoized metrics
  const dayMetrics = useMemo(() => calculateMetrics(dayCases), [dayCases])
  const last30Metrics = useMemo(() => calculateMetrics(last30DaysCases), [last30DaysCases])
  const allTimeMetrics = useMemo(() => calculateMetrics(allTimeCases), [allTimeCases])

  // Calculate percentage improvements
  const turnoverVs30Day = calculatePercentageChange(dayMetrics.avgRoomTurnover, last30Metrics.avgRoomTurnover)
  const turnoverVsAllTime = calculatePercentageChange(dayMetrics.avgRoomTurnover, allTimeMetrics.avgRoomTurnover)
  
  // Calculate surgical turnover improvement (today vs 30-day average)
  const surgicalTurnoverVs30Day = calculatePercentageChange(dayMetrics.avgSurgicalTurnover, last30Metrics.avgSurgicalTurnover)
  
  // Calculate uptime improvement (today vs all-time average)
  const uptimeImprovement = allTimeMetrics.uptimePercent > 0 
    ? dayMetrics.uptimePercent - allTimeMetrics.uptimePercent
    : null

  // Get case breakdown for the stacked bar chart
  const getCaseBreakdown = () => {
    const completedCases = getCompletedCases(dayCases)
    
    return completedCases.map(c => {
      const milestones = getMilestoneMap(c)
      const procType = Array.isArray(c.procedure_types) ? c.procedure_types[0] : c.procedure_types
      
      return {
        id: c.id,
        caseNumber: c.case_number,
        procedureName: procType?.name || 'Unknown',
        totalORTime: getTotalORTime(milestones) || 0,
        wheelsInToIncision: getWheelsInToIncision(milestones) || 0,
        incisionToClosing: getIncisionToClosing(milestones) || 0,
        closingTime: getClosingTime(milestones) || 0,
        closedToWheelsOut: getClosedToWheelsOut(milestones) || 0,
      }
    })
  }

  // Get procedure performance data
  const getProcedurePerformance = () => {
    const completedCases = getCompletedCases(dayCases)
    const completed30DayCases = getCompletedCases(last30DaysCases)
    
    const filteredCases = selectedProcedureFilter === 'all' 
      ? completedCases 
      : completedCases.filter(c => {
          const procType = Array.isArray(c.procedure_types) ? c.procedure_types[0] : c.procedure_types
          return procType?.id === selectedProcedureFilter
        })

    const filteredOrTimes = filteredCases.map(c => getTotalORTime(getMilestoneMap(c)))
    const filteredSurgicalTimes = filteredCases.map(c => getSurgicalTime(getMilestoneMap(c)))
    const filteredWheelsIn = filteredCases.map(c => getWheelsInToIncision(getMilestoneMap(c)))
    const filteredIncisionClosing = filteredCases.map(c => getIncisionToClosing(getMilestoneMap(c)))
    const filteredClosing = filteredCases.map(c => getClosingTime(getMilestoneMap(c)))
    const filteredWheelsOut = filteredCases.map(c => getClosedToWheelsOut(getMilestoneMap(c)))

    const baselineCases = selectedProcedureFilter === 'all' ? completed30DayCases : completedCases
    const baselineOrTimes = baselineCases.map(c => getTotalORTime(getMilestoneMap(c)))
    const baselineSurgicalTimes = baselineCases.map(c => getSurgicalTime(getMilestoneMap(c)))
    const baselineWheelsIn = baselineCases.map(c => getWheelsInToIncision(getMilestoneMap(c)))
    const baselineIncisionClosing = baselineCases.map(c => getIncisionToClosing(getMilestoneMap(c)))
    const baselineClosing = baselineCases.map(c => getClosingTime(getMilestoneMap(c)))
    const baselineWheelsOut = baselineCases.map(c => getClosedToWheelsOut(getMilestoneMap(c)))

    return {
      procedure: {
        avgORTime: calculateAverage(filteredOrTimes),
        avgSurgicalTime: calculateAverage(filteredSurgicalTimes),
        avgWheelsInToIncision: calculateAverage(filteredWheelsIn),
        avgIncisionToClosing: calculateAverage(filteredIncisionClosing),
        avgClosingTime: calculateAverage(filteredClosing),
        avgClosedToWheelsOut: calculateAverage(filteredWheelsOut),
      },
      baseline: {
        avgORTime: calculateAverage(baselineOrTimes),
        avgSurgicalTime: calculateAverage(baselineSurgicalTimes),
        avgWheelsInToIncision: calculateAverage(baselineWheelsIn),
        avgIncisionToClosing: calculateAverage(baselineIncisionClosing),
        avgClosingTime: calculateAverage(baselineClosing),
        avgClosedToWheelsOut: calculateAverage(baselineWheelsOut),
      },
      baselineLabel: selectedProcedureFilter === 'all' ? '30-Day Avg' : 'Day Average'
    }
  }

  const caseBreakdown = useMemo(() => getCaseBreakdown(), [dayCases])
  const procedurePerformance = useMemo(() => getProcedurePerformance(), [dayCases, last30DaysCases, selectedProcedureFilter])

  const selectedSurgeonData = selectedSurgeon ? surgeons.find(s => s.id === selectedSurgeon) : null
  const maxCaseTime = Math.max(...caseBreakdown.map(c => c.totalORTime), 1)

  // ============================================
  // FILTERS COMPONENT (for header actions)
  // ============================================
  const FiltersComponent = (
    <div className="flex items-center gap-4">
      {/* Surgeon Dropdown */}
      <div>
        <select
          value={selectedSurgeon || ''}
          onChange={(e) => setSelectedSurgeon(e.target.value || null)}
          className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
        >
          <option value="">Choose surgeon...</option>
          {surgeons.map(s => (
            <option key={s.id} value={s.id}>
              Dr. {s.first_name} {s.last_name}
            </option>
          ))}
        </select>
      </div>

      {/* Date Picker */}
      <div>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
        />
      </div>
    </div>
  )

  // ============================================
  // LOADING STATE
  // ============================================
  if (userLoading) {
    return (
      <DashboardLayout>
        <div className="min-h-screen bg-slate-50/50">
          <Container className="py-8">
            <div className="flex items-center justify-center py-24">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-slate-500">Loading...</p>
              </div>
            </div>
          </Container>
        </div>
      </DashboardLayout>
    )
  }

  // ============================================
  // NO FACILITY STATE
  // ============================================
  if (!facilityId) {
    return (
      <DashboardLayout>
        <div className="min-h-screen bg-slate-50/50">
          <Container className="py-8">
            <AnalyticsPageHeader
              title="Surgeon Performance"
              description="Individual surgeon performance metrics"
              icon={UserIcon}
            />
            <div className="text-center py-24 text-slate-500">
              No facility assigned to your account.
            </div>
          </Container>
        </div>
      </DashboardLayout>
    )
  }

  // ============================================
  // MAIN RENDER
  // ============================================
  return (
    <DashboardLayout>
      <div className="min-h-screen bg-slate-50/50">
        <Container className="py-8">
          {/* Page Header with Breadcrumb */}
          <AnalyticsPageHeader
            title="Surgeon Performance"
            description="Individual surgeon performance metrics"
            icon={UserIcon}
            actions={FiltersComponent}
          />

          {initialLoading ? (
            <div className="flex items-center justify-center py-24">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-slate-500">Loading surgeons...</p>
              </div>
            </div>
          ) : !selectedSurgeon ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <UserIcon className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">Select a Surgeon</h3>
              <p className="text-slate-500">Choose a surgeon from the dropdown above to view their analytics</p>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-slate-500">Loading case data...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Surgeon Header */}
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <span className="text-lg font-bold text-blue-600">
                    {selectedSurgeonData?.first_name?.charAt(0)}{selectedSurgeonData?.last_name?.charAt(0)}
                  </span>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Dr. {selectedSurgeonData?.first_name} {selectedSurgeonData?.last_name}
                  </h2>
                  <p className="text-sm text-slate-500">{formatDateDisplay(selectedDate)}</p>
                </div>
              </div>

              {/* Day Overview Section */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900">Day Overview</h3>
                    <p className="text-sm text-slate-500">Track your efficiency in the operating room</p>
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
                      {formatTimeInTimezone(dayMetrics.firstCaseStartTime, facilityTimezone)}
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
                    <div className="text-3xl font-bold text-slate-900">
                      {dayMetrics.totalCases}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Total OR Time
                    </div>
                    <div className="text-3xl font-bold text-slate-900">
                      {formatMinutesToHHMMSS(dayMetrics.totalORTime)}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Total Surgical Time
                    </div>
                    <div className="text-3xl font-bold text-slate-900">
                      {formatMinutesToHHMMSS(dayMetrics.totalSurgicalTime)}
                    </div>
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
                        <div className="text-3xl font-bold text-slate-900">
                          {formatMinutesToHHMMSS(dayMetrics.avgSurgicalTurnover)}
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-sm">
                          {surgicalTurnoverVs30Day !== null && (
                            <span className={`flex items-center gap-1 ${surgicalTurnoverVs30Day >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={surgicalTurnoverVs30Day >= 0 ? "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" : "M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"} />
                              </svg>
                              {Math.abs(surgicalTurnoverVs30Day)}%
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
                        <div className="text-3xl font-bold text-slate-900">
                          {formatMinutesToHHMMSS(dayMetrics.avgRoomTurnover)}
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-sm">
                          {turnoverVs30Day !== null && (
                            <span className={`flex items-center gap-1 ${turnoverVs30Day >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={turnoverVs30Day >= 0 ? "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" : "M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"} />
                              </svg>
                              {Math.abs(turnoverVs30Day)}%
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
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={uptimeImprovement >= 0 ? "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" : "M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"} />
                              </svg>
                              {Math.abs(uptimeImprovement).toFixed(1)}%
                              <span className="text-slate-400 ml-1">improvement in uptime</span>
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
                {/* Cases List */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
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
                    <div className="text-center py-8 text-slate-400">
                      No completed cases for this date
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[500px] overflow-y-auto">
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
                                <div 
                                  className="h-full bg-blue-600" 
                                  style={{ width: `${(c.wheelsInToIncision / maxCaseTime) * 100}%` }}
                                  title={`Wheels-in to Incision: ${formatMinutesToHHMMSS(c.wheelsInToIncision)}`}
                                />
                              )}
                              {c.incisionToClosing > 0 && (
                                <div 
                                  className="h-full bg-blue-400" 
                                  style={{ width: `${(c.incisionToClosing / maxCaseTime) * 100}%` }}
                                  title={`Incision to Closing: ${formatMinutesToHHMMSS(c.incisionToClosing)}`}
                                />
                              )}
                              {c.closingTime > 0 && (
                                <div 
                                  className="h-full bg-emerald-500" 
                                  style={{ width: `${(c.closingTime / maxCaseTime) * 100}%` }}
                                  title={`Closing Time: ${formatMinutesToHHMMSS(c.closingTime)}`}
                                />
                              )}
                              {c.closedToWheelsOut > 0 && (
                                <div 
                                  className="h-full bg-amber-400" 
                                  style={{ width: `${(c.closedToWheelsOut / maxCaseTime) * 100}%` }}
                                  title={`Closed to Wheels-Out: ${formatMinutesToHHMMSS(c.closedToWheelsOut)}`}
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Legend */}
                  <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-100 text-xs">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-blue-600 rounded" />
                      <span className="text-slate-500">Wheels-in to Incision</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-blue-400 rounded" />
                      <span className="text-slate-500">Incision to Closing</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-emerald-500 rounded" />
                      <span className="text-slate-500">Closing</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-amber-400 rounded" />
                      <span className="text-slate-500">Wheels-Out</span>
                    </div>
                  </div>
                </div>

                {/* Procedure Performance */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
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
                            <div 
                              className="h-full bg-blue-600 rounded"
                              style={{ width: `${Math.min(100, ((procedurePerformance.procedure.avgORTime || 0) / Math.max(procedurePerformance.baseline.avgORTime || 1, procedurePerformance.procedure.avgORTime || 1)) * 100)}%` }}
                            />
                          </div>
                          <span className="text-sm font-semibold text-slate-900 w-20 text-right">{formatMinutesToHHMMSS(procedurePerformance.procedure.avgORTime)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-5 bg-slate-100 rounded overflow-hidden">
                            <div 
                              className="h-full bg-slate-400 rounded"
                              style={{ width: `${Math.min(100, ((procedurePerformance.baseline.avgORTime || 0) / Math.max(procedurePerformance.baseline.avgORTime || 1, procedurePerformance.procedure.avgORTime || 1)) * 100)}%` }}
                            />
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
                            <div 
                              className="h-full bg-blue-600 rounded"
                              style={{ width: `${Math.min(100, ((procedurePerformance.procedure.avgSurgicalTime || 0) / Math.max(procedurePerformance.baseline.avgSurgicalTime || 1, procedurePerformance.procedure.avgSurgicalTime || 1)) * 100)}%` }}
                            />
                          </div>
                          <span className="text-sm font-semibold text-slate-900 w-20 text-right">{formatMinutesToHHMMSS(procedurePerformance.procedure.avgSurgicalTime)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-5 bg-slate-100 rounded overflow-hidden">
                            <div 
                              className="h-full bg-slate-400 rounded"
                              style={{ width: `${Math.min(100, ((procedurePerformance.baseline.avgSurgicalTime || 0) / Math.max(procedurePerformance.baseline.avgSurgicalTime || 1, procedurePerformance.procedure.avgSurgicalTime || 1)) * 100)}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-slate-700 w-20 text-right">{formatMinutesToHHMMSS(procedurePerformance.baseline.avgSurgicalTime)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Legend */}
                    <div className="flex items-center gap-6 mt-4 pt-4 border-t border-slate-100 text-xs">
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-blue-600 rounded" />
                        <span className="text-slate-600">{selectedProcedureFilter === 'all' ? 'Today' : 'Procedure'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-slate-400 rounded" />
                        <span className="text-slate-600">{procedurePerformance.baselineLabel}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Container>
      </div>
    </DashboardLayout>
    
  )
}