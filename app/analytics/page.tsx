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
  type Color,
} from '@tremor/react'

// Analytics functions
import {
  calculateAnalyticsOverview,
  formatMinutes,
  type CaseWithMilestones,
  type FlipRoomAnalysis,
} from '@/lib/analyticsV2'

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
// KPI CARD WITH TREMOR TRACKER
// ============================================

function KPICard({ 
  title, 
  kpi, 
  highlighted = false,
  showTracker = true,
  onClick,
  invertDelta = false
}: { 
  title: string
  kpi: KPIData
  highlighted?: boolean
  showTracker?: boolean
  onClick?: () => void
  invertDelta?: boolean
}) {
  // Determine delta type display
  const getDeltaType = () => {
    if (!kpi.deltaType || kpi.deltaType === 'unchanged') return 'unchanged'
    if (invertDelta) {
      return kpi.deltaType === 'decrease' ? 'increase' : 'decrease'
    }
    return kpi.deltaType
  }

  return (
    <Card
      className={`${highlighted ? 'ring-2 ring-blue-500' : ''} ${onClick ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''}`}
      onClick={onClick}
    >
      <Flex alignItems="start">
        <div>
          <Text>{title}</Text>
          <Metric className={highlighted ? 'text-blue-600' : ''}>{kpi.displayValue}</Metric>
        </div>
        {kpi.delta !== undefined && kpi.deltaType && (
          <BadgeDelta deltaType={getDeltaType() as 'increase' | 'decrease' | 'unchanged'}>
            {kpi.delta}%
          </BadgeDelta>
        )}
      </Flex>

      {kpi.target !== undefined && (
        <Flex className="mt-4" justifyContent="start" alignItems="center">
          <div className={`w-2 h-2 rounded-full mr-2 ${kpi.targetMet ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          <Text className="text-slate-500">
            Target: {title.includes('Cancellation') ? `<${kpi.target}%` : `${kpi.target}%`}
          </Text>
        </Flex>
      )}

      {kpi.subtitle && (
        <Text className="mt-2">{kpi.subtitle}</Text>
      )}

      {showTracker && kpi.dailyData && kpi.dailyData.length > 0 && (
        <div className="mt-4">
          <Flex justifyContent="between" className="mb-2">
            <Text className="text-xs text-slate-400">Daily performance</Text>
            <Text className="text-xs text-slate-400">Last {kpi.dailyData.length} days</Text>
          </Flex>
          <Tracker data={kpi.dailyData} className="h-10" />
        </div>
      )}

      {onClick && (
        <div className="mt-4 flex items-center text-xs font-medium text-blue-600">
          View details
          <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      )}
    </Card>
  )
}

// ============================================
// SURGEON IDLE TIME CARD (Special)
// ============================================

function SurgeonIdleTimeCard({ 
  kpi, 
  onClick 
}: { 
  kpi: KPIData
  onClick?: () => void 
}) {
  return (
    <Card 
      className="ring-2 ring-blue-500 cursor-pointer hover:shadow-lg transition-shadow"
      decoration="top"
      decorationColor="blue"
      onClick={onClick}
    >
      <Flex alignItems="start">
        <div>
          <Flex justifyContent="start" className="gap-2">
            <Text>Surgeon Idle Time</Text>
            <span className="px-2 py-0.5 text-xs font-semibold bg-blue-100 text-blue-700 rounded-full">
              Insight
            </span>
          </Flex>
          <Metric className="text-blue-600">{kpi.displayValue}</Metric>
        </div>
      </Flex>

      <Text className="mt-2">Avg wait between rooms</Text>

      {kpi.subtitle && kpi.subtitle !== 'No optimization needed' && kpi.value > 0 && (
        <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <Text className="text-blue-800">💡 {kpi.subtitle}</Text>
        </div>
      )}

      {(kpi.targetMet || kpi.value <= 5) && (
        <div className="mt-4 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
          <Text className="text-emerald-700">✓ Excellent! Minimal surgeon wait time</Text>
        </div>
      )}

      <div className="mt-4 flex items-center text-xs font-medium text-blue-600">
        View flip room details
        <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Card>
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
        <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={onClose} />
        
        <div className="relative bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
            <div>
              <Title>Flip Room Analysis</Title>
              <Text>Surgeon idle time between room transitions</Text>
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
          
          <div className="p-6 overflow-y-auto max-h-[calc(85vh-80px)]">
            {data.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <Text className="font-medium">No flip room patterns detected</Text>
                <Text className="mt-2">
                  Flip rooms occur when a surgeon operates in multiple rooms on the same day.
                </Text>
              </div>
            ) : (
              <div className="space-y-6">
                {data.map((analysis, idx) => (
                  <Card key={idx} className="bg-slate-50">
                    <Flex>
                      <div>
                        <Text className="font-semibold">{analysis.surgeonName}</Text>
                        <Text className="text-slate-500">{analysis.date}</Text>
                      </div>
                      <div className="text-right">
                        <Text className="text-slate-500">Total idle time</Text>
                        <Metric className="text-amber-600">{Math.round(analysis.totalIdleTime)} min</Metric>
                      </div>
                    </Flex>
                    
                    <div className="mt-4">
                      <Text className="font-medium mb-2">Room Sequence</Text>
                      <div className="flex items-center gap-2 flex-wrap">
                        {analysis.cases.map((c, i) => (
                          <div key={c.caseId} className="flex items-center">
                            <div className="px-3 py-1.5 bg-white rounded-lg border border-slate-200 text-sm">
                              <span className="font-medium">{c.roomName}</span>
                              <span className="text-slate-500 ml-2">{c.scheduledStart}</span>
                            </div>
                            {i < analysis.cases.length - 1 && (
                              <svg className="w-4 h-4 mx-1 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {analysis.idleGaps.length > 0 && (
                      <div className="mt-4">
                        <Text className="font-medium mb-2">Transition Gaps</Text>
                        <div className="space-y-2">
                          {analysis.idleGaps.map((gap, i) => (
                            <div key={i} className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200">
                              <div className="flex items-center gap-2">
                                <Text className="font-medium">{gap.fromCase}</Text>
                                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                </svg>
                                <Text className="font-medium">{gap.toCase}</Text>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="text-right">
                                  <Text className="text-xs text-slate-500">Idle time</Text>
                                  <Text className={`font-semibold ${gap.idleMinutes > 10 ? 'text-red-600' : 'text-amber-600'}`}>
                                    {Math.round(gap.idleMinutes)} min
                                  </Text>
                                </div>
                                {gap.optimalCallDelta > 0 && (
                                  <div className="text-right pl-4 border-l border-slate-200">
                                    <Text className="text-xs text-blue-600">Call earlier by</Text>
                                    <Text className="font-semibold text-blue-600">
                                      {Math.round(gap.optimalCallDelta)} min
                                    </Text>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </Card>
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

  // Chart data for Tremor
  const phaseChartData = [
    { name: 'Pre-Op', minutes: Math.round(analytics.avgPreOpTime) },
    { name: 'Surgical', minutes: Math.round(analytics.avgSurgicalTime) },
    { name: 'Closing', minutes: Math.round(analytics.avgClosingTime) },
    { name: 'Emergence', minutes: Math.round(analytics.avgEmergenceTime) },
  ].filter(d => d.minutes > 0)

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

  // No facility selected (global admin)
  if (noFacilitySelected) {
    return (
      <DashboardLayout>
        <Container className="py-8">
          <Card className="max-w-lg mx-auto text-center">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <Title>No Facility Selected</Title>
            <Text className="mt-2">Select a facility to view analytics.</Text>
            <Link
              href="/admin/facilities"
              className="inline-flex items-center gap-2 px-4 py-2 mt-6 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              View Facilities
            </Link>
          </Card>
        </Container>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <Container className="py-8">
        {/* Header */}
        <Flex className="mb-8" justifyContent="between" alignItems="start">
          <div>
            <Title className="text-2xl">Analytics Overview</Title>
            <Text className="mt-1">{analytics.completedCases} completed cases analyzed</Text>
          </div>
          <DateFilter selectedFilter={dateFilter} onFilterChange={handleFilterChange} />
        </Flex>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <svg className="animate-spin h-8 w-8 text-blue-600" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        ) : (
          <>
            {/* ROW 1: KEY PERFORMANCE INDICATORS */}
            <div className="mb-8">
              <Title className="text-lg mb-1">Key Performance Indicators</Title>
              <Text className="mb-4">Click any metric to drill down into details</Text>
              <Grid numItemsMd={2} numItemsLg={4} className="gap-4">
                <KPICard 
                  title="First Case On-Time" 
                  kpi={analytics.fcots}
                  highlighted
                />
                <KPICard 
                  title="Avg Turnover Time" 
                  kpi={analytics.turnoverTime}
                  highlighted
                />
                <KPICard 
                  title="OR Utilization" 
                  kpi={analytics.orUtilization}
                  highlighted
                />
                <KPICard 
                  title="Case Volume" 
                  kpi={analytics.caseVolume}
                  showTracker={false}
                />
              </Grid>
            </div>

            {/* ROW 2: EFFICIENCY INDICATORS */}
            <div className="mb-8">
              <Title className="text-lg mb-1">Efficiency Indicators</Title>
              <Text className="mb-4">Secondary metrics that drive performance</Text>
              <Grid numItemsMd={2} numItemsLg={4} className="gap-4">
                <KPICard 
                  title="Same-Day Cancellation" 
                  kpi={analytics.cancellationRate}
                  invertDelta
                />
                <KPICard 
                  title="Cumulative Tardiness" 
                  kpi={analytics.cumulativeTardiness}
                  showTracker={false}
                />
                <KPICard 
                  title="Non-Operative Time" 
                  kpi={analytics.nonOperativeTime}
                  showTracker={false}
                />
                <SurgeonIdleTimeCard 
                  kpi={analytics.surgeonIdleTime}
                  onClick={() => setShowFlipRoomModal(true)}
                />
              </Grid>
            </div>

            {/* ROW 3: TIME BREAKDOWN */}
            <div className="mb-8">
              <Title className="text-lg mb-1">Time Breakdown</Title>
              <Text className="mb-4">Average durations across all completed cases</Text>
              <Grid numItemsMd={3} numItemsLg={6} className="gap-4">
                <Card>
                  <Text>Total Case Time</Text>
                  <Metric className="text-xl">{formatMinutes(analytics.avgTotalCaseTime)}</Metric>
                  <Text className="text-slate-500 text-sm">Patient In → Out</Text>
                </Card>
                <Card>
                  <Text>Surgical Time</Text>
                  <Metric className="text-xl">{formatMinutes(analytics.avgSurgicalTime)}</Metric>
                  <Text className="text-slate-500 text-sm">Incision → Closing</Text>
                </Card>
                <Card>
                  <Text>Pre-Op Time</Text>
                  <Metric className="text-xl">{formatMinutes(analytics.avgPreOpTime)}</Metric>
                  <Text className="text-slate-500 text-sm">Patient In → Incision</Text>
                </Card>
                <Card>
                  <Text>Anesthesia Time</Text>
                  <Metric className="text-xl">{formatMinutes(analytics.avgAnesthesiaTime)}</Metric>
                  <Text className="text-slate-500 text-sm">Anes Start → End</Text>
                </Card>
                <Card>
                  <Text>Closing Time</Text>
                  <Metric className="text-xl">{formatMinutes(analytics.avgClosingTime)}</Metric>
                  <Text className="text-slate-500 text-sm">Closing → Complete</Text>
                </Card>
                <Card>
                  <Text>Emergence</Text>
                  <Metric className="text-xl">{formatMinutes(analytics.avgEmergenceTime)}</Metric>
                  <Text className="text-slate-500 text-sm">Close → Patient Out</Text>
                </Card>
              </Grid>
            </div>

            {/* ROW 4: CHARTS */}
            <Grid numItemsMd={2} className="gap-6 mb-8">
              {/* Tremor Bar Chart */}
              <Card>
                <Title>Average Time by Phase</Title>
                <Text>Minutes spent in each surgical phase</Text>
                {phaseChartData.length > 0 ? (
                  <BarChart
                    className="mt-4 h-72"
                    data={phaseChartData}
                    index="name"
                    categories={['minutes']}
                    colors={['blue']}
                    valueFormatter={(v) => `${v} min`}
                    yAxisWidth={48}
                  />
                ) : (
                  <div className="flex items-center justify-center h-72 text-slate-400">
                    No data available
                  </div>
                )}
              </Card>

              {/* Tremor Donut Chart */}
              <Card>
                <Title>Time Distribution</Title>
                <Text>Proportion of case time by phase</Text>
                {phaseChartData.length > 0 ? (
                  <DonutChart
                    className="mt-4 h-72"
                    data={phaseChartData}
                    index="name"
                    category="minutes"
                    colors={['blue', 'slate', 'zinc', 'gray']}
                    valueFormatter={(v) => `${v} min`}
                  />
                ) : (
                  <div className="flex items-center justify-center h-72 text-slate-400">
                    No data available
                  </div>
                )}
              </Card>
            </Grid>

            {/* FLIP ROOM MODAL */}
            <FlipRoomModal
              isOpen={showFlipRoomModal}
              onClose={() => setShowFlipRoomModal(false)}
              data={analytics.flipRoomAnalysis}
            />
          </>
        )}
      </Container>
    </DashboardLayout>
  )
}