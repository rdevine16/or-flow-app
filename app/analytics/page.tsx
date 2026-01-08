'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../lib/supabase'
import DashboardLayout from '../../components/layouts/DashboardLayout'
import Container from '../../components/ui/Container'
import DateFilter from '../../components/ui/DateFilter'
import MetricCard from '../../components/ui/MetricCard'
import AnalyticsLayout from '../../components/analytics/AnalyticsLayout'
import {
  getMilestoneMap,
  getTotalCaseTime,
  getSurgicalTime,
  getPreOpTime,
  getAnesthesiaTime,
  getClosingTime,
  calculateAverage,
  calculateStdDev,
  formatMinutes,
  CaseWithMilestones,
} from '../../lib/analytics'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts'

export default function AnalyticsOverviewPage() {
  const supabase = createClient()
  const [cases, setCases] = useState<CaseWithMilestones[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFilter, setDateFilter] = useState('month')

  const facilityId = 'a1111111-1111-1111-1111-111111111111'

  const fetchData = async (startDate?: string, endDate?: string) => {
    setLoading(true)

    let query = supabase
      .from('cases')
      .select(`
        id,
        case_number,
        scheduled_date,
        start_time,
        surgeon_id,
        surgeon:users!cases_surgeon_id_fkey (first_name, last_name),
        procedure_types (id, name),
        or_rooms (name),
        case_milestones (
          milestone_type_id,
          recorded_at,
          milestone_types (name)
        )
      `)
      .eq('facility_id', facilityId)
      .order('scheduled_date', { ascending: false })

    if (startDate && endDate) {
      query = query.gte('scheduled_date', startDate).lte('scheduled_date', endDate)
    }

    const { data: casesData } = await query
    setCases((casesData as unknown as CaseWithMilestones[]) || [])
    setLoading(false)
  }

  useEffect(() => {
    const today = new Date()
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    fetchData(monthStart.toISOString().split('T')[0], today.toISOString().split('T')[0])
  }, [])

  const handleFilterChange = (filter: string, startDate?: string, endDate?: string) => {
    setDateFilter(filter)
    fetchData(startDate, endDate)
  }

  // Calculate metrics
  const completedCases = cases.filter(c => {
    const milestones = getMilestoneMap(c)
    return milestones.patient_in && milestones.patient_out
  })

  const totalCaseTimes = completedCases.map(c => getTotalCaseTime(getMilestoneMap(c)))
  const surgicalTimes = completedCases.map(c => getSurgicalTime(getMilestoneMap(c)))
  const preOpTimes = completedCases.map(c => getPreOpTime(getMilestoneMap(c)))
  const anesthesiaTimes = completedCases.map(c => getAnesthesiaTime(getMilestoneMap(c)))
  const closingTimes = completedCases.map(c => getClosingTime(getMilestoneMap(c)))

  const avgTotalTime = calculateAverage(totalCaseTimes)
  const avgSurgicalTime = calculateAverage(surgicalTimes)
  const avgPreOpTime = calculateAverage(preOpTimes)
  const avgAnesthesiaTime = calculateAverage(anesthesiaTimes)
  const avgClosingTime = calculateAverage(closingTimes)
  const caseTimeVariance = calculateStdDev(totalCaseTimes)

  // Cases over time
  const casesByDate = cases.reduce((acc: { [key: string]: number }, c) => {
    const date = c.scheduled_date
    acc[date] = (acc[date] || 0) + 1
    return acc
  }, {})

  const casesTrend = Object.entries(casesByDate)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-14)

  // Milestone phase breakdown
  const phaseData = [
    { phase: 'Pre-Op', avgTime: avgPreOpTime || 0, description: 'Patient In → Incision' },
    { phase: 'Anesthesia', avgTime: avgAnesthesiaTime || 0, description: 'Anes Start → End' },
    { phase: 'Surgical', avgTime: avgSurgicalTime || 0, description: 'Incision → Closing' },
    { phase: 'Closing', avgTime: avgClosingTime || 0, description: 'Closing → Patient Out' },
  ]

  return (
    <DashboardLayout>
      <Container className="py-8">
        <AnalyticsLayout
          title="Analytics Overview"
          description={`${completedCases.length} completed cases analyzed`}
          actions={
            <DateFilter selectedFilter={dateFilter} onFilterChange={handleFilterChange} />
          }
        >
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <svg className="animate-spin h-8 w-8 text-teal-500" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          ) : (
            <>
              {/* Key Metrics */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <MetricCard
                  title="Avg Total Case Time"
                  value={formatMinutes(avgTotalTime)}
                  subtitle="Patient In → Out"
                  color="teal"
                />
                <MetricCard
                  title="Avg Surgical Time"
                  value={formatMinutes(avgSurgicalTime)}
                  subtitle="Incision → Closing"
                  color="emerald"
                />
                <MetricCard
                  title="Total Cases"
                  value={cases.length}
                  subtitle="In selected period"
                />
                <MetricCard
                  title="Variance"
                  value={caseTimeVariance ? `±${caseTimeVariance}m` : '-'}
                  subtitle="Case time consistency"
                />
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Phase Breakdown */}
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Average Time by Phase</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={phaseData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="phase" stroke="#64748b" fontSize={12} />
                      <YAxis stroke="#64748b" fontSize={12} />
                      <Tooltip
  formatter={(value) => [formatMinutes(value as number), 'Avg Time']}
                        contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                      />
                      <Bar dataKey="avgTime" fill="#0d9488" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Volume Trend */}
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Case Volume Trend</h3>
                  {casesTrend.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={casesTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                          dataKey="date"
                          stroke="#64748b"
                          fontSize={12}
                          tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        />
                        <YAxis stroke="#64748b" fontSize={12} />
                        <Tooltip
  labelFormatter={(date) => new Date(date as string).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
  formatter={(value) => [value, 'Cases']}
                          contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                        />
                        <Line type="monotone" dataKey="count" stroke="#0d9488" strokeWidth={2} dot={{ fill: '#0d9488' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-slate-400">
                      No data available
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard
                  title="Avg Pre-Op"
                  value={formatMinutes(avgPreOpTime)}
                  subtitle="Setup time"
                />
                <MetricCard
                  title="Avg Anesthesia"
                  value={formatMinutes(avgAnesthesiaTime)}
                  subtitle="Induction time"
                />
                <MetricCard
                  title="Avg Closing"
                  value={formatMinutes(avgClosingTime)}
                  subtitle="Wrap-up time"
                />
                <MetricCard
                  title="Completed"
                  value={completedCases.length}
                  subtitle={`${cases.length > 0 ? Math.round((completedCases.length / cases.length) * 100) : 0}% of total`}
                />
              </div>
            </>
          )}
        </AnalyticsLayout>
      </Container>
    </DashboardLayout>
  )
}