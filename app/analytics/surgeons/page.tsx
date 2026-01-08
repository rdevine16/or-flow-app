'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../../lib/supabase'
import DashboardLayout from '../../../components/layouts/DashboardLayout'
import Container from '../../../components/ui/Container'
import DateFilter from '../../../components/ui/DateFilter'
import MetricCard from '../../../components/ui/MetricCard'
import AnalyticsLayout from '../../../components/analytics/AnalyticsLayout'
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
} from '../../../lib/analytics'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts'

interface Surgeon {
  id: string
  first_name: string
  last_name: string
}

export default function SurgeonAnalysisPage() {
  const supabase = createClient()
  const [cases, setCases] = useState<CaseWithMilestones[]>([])
  const [surgeons, setSurgeons] = useState<Surgeon[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFilter, setDateFilter] = useState('month')
  const [selectedSurgeon, setSelectedSurgeon] = useState<string | null>(null)

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

    const { data: surgeonsData } = await supabase
      .from('users')
      .select('id, first_name, last_name, role_id')
      .eq('facility_id', facilityId)

    const { data: surgeonRole } = await supabase
      .from('user_roles')
      .select('id')
      .eq('name', 'surgeon')
      .single()

    setCases((casesData as unknown as CaseWithMilestones[]) || [])
    setSurgeons(
      (surgeonsData?.filter(u => u.role_id === surgeonRole?.id) as Surgeon[]) || []
    )
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

  // Get surgeon's cases
  const getSurgeonCases = (surgeonId: string) => {
    return cases.filter(c => c.surgeon_id === surgeonId)
  }

  // Get completed cases for a surgeon
  const getSurgeonCompletedCases = (surgeonId: string) => {
    return getSurgeonCases(surgeonId).filter(c => {
      const milestones = getMilestoneMap(c)
      return milestones.patient_in && milestones.patient_out
    })
  }

  // Calculate surgeon metrics
  const getSurgeonMetrics = (surgeonId: string) => {
    const completedCases = getSurgeonCompletedCases(surgeonId)
    
    const totalTimes = completedCases.map(c => getTotalCaseTime(getMilestoneMap(c)))
    const surgicalTimes = completedCases.map(c => getSurgicalTime(getMilestoneMap(c)))
    const preOpTimes = completedCases.map(c => getPreOpTime(getMilestoneMap(c)))
    const anesthesiaTimes = completedCases.map(c => getAnesthesiaTime(getMilestoneMap(c)))
    const closingTimes = completedCases.map(c => getClosingTime(getMilestoneMap(c)))

    return {
      totalCases: getSurgeonCases(surgeonId).length,
      completedCases: completedCases.length,
      avgTotalTime: calculateAverage(totalTimes),
      avgSurgicalTime: calculateAverage(surgicalTimes),
      avgPreOpTime: calculateAverage(preOpTimes),
      avgAnesthesiaTime: calculateAverage(anesthesiaTimes),
      avgClosingTime: calculateAverage(closingTimes),
      variance: calculateStdDev(totalTimes),
    }
  }

  // Get milestone breakdown by procedure for selected surgeon
  const getMilestoneBreakdownByProcedure = (surgeonId: string) => {
    const completedCases = getSurgeonCompletedCases(surgeonId)
    
    const byProcedure: { 
      [key: string]: { 
        preOp: number[]
        anesthesia: number[]
        surgical: number[]
        closing: number[]
        total: number[]
      } 
    } = {}
    
    completedCases.forEach(c => {
      const procType = Array.isArray(c.procedure_types) ? c.procedure_types[0] : c.procedure_types
      const procName = procType?.name || 'Unknown'
      const milestones = getMilestoneMap(c)
      
      if (!byProcedure[procName]) {
        byProcedure[procName] = { preOp: [], anesthesia: [], surgical: [], closing: [], total: [] }
      }
      
      const preOp = getPreOpTime(milestones)
      const anesthesia = getAnesthesiaTime(milestones)
      const surgical = getSurgicalTime(milestones)
      const closing = getClosingTime(milestones)
      const total = getTotalCaseTime(milestones)
      
      if (preOp) byProcedure[procName].preOp.push(preOp)
      if (anesthesia) byProcedure[procName].anesthesia.push(anesthesia)
      if (surgical) byProcedure[procName].surgical.push(surgical)
      if (closing) byProcedure[procName].closing.push(closing)
      if (total) byProcedure[procName].total.push(total)
    })

    return Object.entries(byProcedure).map(([procedure, times]) => ({
      procedure: procedure.length > 25 ? procedure.substring(0, 25) + '...' : procedure,
      fullName: procedure,
      caseCount: times.total.length,
      'Pre-Op': calculateAverage(times.preOp) || 0,
      'Anesthesia': calculateAverage(times.anesthesia) || 0,
      'Surgical': calculateAverage(times.surgical) || 0,
      'Closing': calculateAverage(times.closing) || 0,
      'Total': calculateAverage(times.total) || 0,
    })).sort((a, b) => b.caseCount - a.caseCount)
  }

  // Get radar chart data for surgeon performance
  const getRadarData = (surgeonId: string) => {
    const metrics = getSurgeonMetrics(surgeonId)
    
    // Normalize values (lower is better for time metrics)
    // Using inverse scaling so "better" points outward
    const maxTime = 120 // Assuming 120 min as baseline
    
    return [
      { metric: 'Pre-Op Speed', value: metrics.avgPreOpTime ? Math.max(0, 100 - (metrics.avgPreOpTime / maxTime * 100)) : 0 },
      { metric: 'Surgical Speed', value: metrics.avgSurgicalTime ? Math.max(0, 100 - (metrics.avgSurgicalTime / maxTime * 100)) : 0 },
      { metric: 'Closing Speed', value: metrics.avgClosingTime ? Math.max(0, 100 - (metrics.avgClosingTime / maxTime * 100)) : 0 },
      { metric: 'Consistency', value: metrics.variance ? Math.max(0, 100 - metrics.variance) : 0 },
      { metric: 'Volume', value: Math.min(100, metrics.completedCases * 10) },
    ]
  }

  const selectedSurgeonData = selectedSurgeon ? surgeons.find(s => s.id === selectedSurgeon) : null
  const metrics = selectedSurgeon ? getSurgeonMetrics(selectedSurgeon) : null
  const procedureBreakdown = selectedSurgeon ? getMilestoneBreakdownByProcedure(selectedSurgeon) : []

  return (
    <DashboardLayout>
      <Container className="py-8">
        <AnalyticsLayout
          title="Surgeon Analysis"
          description="Deep dive into individual surgeon performance metrics"
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
              {/* Surgeon Selector */}
              <div className="bg-white rounded-xl border border-slate-200 p-6 mb-8">
                <label className="block text-sm font-medium text-slate-700 mb-3">Select Surgeon</label>
                <div className="flex flex-wrap gap-2">
                  {surgeons.map(surgeon => (
                    <button
                      key={surgeon.id}
                      onClick={() => setSelectedSurgeon(surgeon.id)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        selectedSurgeon === surgeon.id
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Dr. {surgeon.first_name} {surgeon.last_name}
                    </button>
                  ))}
                </div>
              </div>

              {selectedSurgeon && metrics ? (
                <>
                  {/* Surgeon Header */}
                  <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl p-6 mb-8 text-white">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center text-2xl font-bold">
                        {selectedSurgeonData?.first_name[0]}{selectedSurgeonData?.last_name[0]}
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold">
                          Dr. {selectedSurgeonData?.first_name} {selectedSurgeonData?.last_name}
                        </h2>
                        <p className="text-slate-300">{metrics.totalCases} cases in selected period</p>
                      </div>
                    </div>
                  </div>

                  {/* Key Metrics */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <MetricCard
                      title="Avg Total Time"
                      value={formatMinutes(metrics.avgTotalTime)}
                      subtitle="Per case"
                      color="teal"
                    />
                    <MetricCard
                      title="Avg Surgical Time"
                      value={formatMinutes(metrics.avgSurgicalTime)}
                      subtitle="Incision → Closing"
                      color="emerald"
                    />
                    <MetricCard
                      title="Completed Cases"
                      value={metrics.completedCases}
                      subtitle={`of ${metrics.totalCases} total`}
                    />
                    <MetricCard
                      title="Consistency"
                      value={metrics.variance ? `±${metrics.variance}m` : '-'}
                      subtitle="Time variance"
                    />
                  </div>

                  {/* Phase Metrics */}
                  <div className="grid grid-cols-3 gap-4 mb-8">
                    <MetricCard
                      title="Avg Pre-Op"
                      value={formatMinutes(metrics.avgPreOpTime)}
                      subtitle="Patient In → Incision"
                    />
                    <MetricCard
                      title="Avg Anesthesia"
                      value={formatMinutes(metrics.avgAnesthesiaTime)}
                      subtitle="Anes Start → End"
                    />
                    <MetricCard
                      title="Avg Closing"
                      value={formatMinutes(metrics.avgClosingTime)}
                      subtitle="Closing → Patient Out"
                    />
                  </div>

                  {/* Charts */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    {/* Radar Chart */}
                    <div className="bg-white rounded-xl border border-slate-200 p-6">
                      <h3 className="text-lg font-semibold text-slate-900 mb-4">Performance Profile</h3>
                      <ResponsiveContainer width="100%" height={300}>
                        <RadarChart data={getRadarData(selectedSurgeon)}>
                          <PolarGrid stroke="#e2e8f0" />
                          <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12, fill: '#64748b' }} />
                          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                          <Radar
                            name="Performance"
                            dataKey="value"
                            stroke="#0d9488"
                            fill="#0d9488"
                            fillOpacity={0.3}
                            strokeWidth={2}
                          />
                        </RadarChart>
                      </ResponsiveContainer>
                      <p className="text-xs text-slate-400 text-center mt-2">
                        Higher values = better performance
                      </p>
                    </div>

                    {/* Procedure Distribution */}
                    <div className="bg-white rounded-xl border border-slate-200 p-6">
                      <h3 className="text-lg font-semibold text-slate-900 mb-4">Cases by Procedure</h3>
                      {procedureBreakdown.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={procedureBreakdown} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis type="number" stroke="#64748b" fontSize={12} />
                            <YAxis dataKey="procedure" type="category" width={120} stroke="#64748b" fontSize={11} />
                            <Tooltip
                              formatter={(value) => [value, 'Cases']}
                              contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' } as React.CSSProperties}
                            />
                            <Bar dataKey="caseCount" fill="#0d9488" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-[300px] flex items-center justify-center text-slate-400">
                          No completed cases
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Milestone Breakdown by Procedure */}
                  <div className="bg-white rounded-xl border border-slate-200 p-6">
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">Milestone Averages by Procedure</h3>
                    <p className="text-sm text-slate-500 mb-6">Average time (in minutes) spent in each phase per procedure type</p>
                    
                    {procedureBreakdown.length > 0 ? (
                      <ResponsiveContainer width="100%" height={400}>
                        <BarChart data={procedureBreakdown}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="procedure" stroke="#64748b" fontSize={11} angle={-20} textAnchor="end" height={80} />
                          <YAxis stroke="#64748b" fontSize={12} label={{ value: 'Minutes', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#64748b' } }} />
                          <Tooltip
                            formatter={(value: number | undefined, name?: string) => [value !== undefined ? formatMinutes(value) : '-', name || '']}
                            contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' } as React.CSSProperties}
                          />
                          <Legend />
                          <Bar dataKey="Pre-Op" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="Anesthesia" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="Surgical" fill="#0d9488" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="Closing" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[400px] flex items-center justify-center text-slate-400">
                        No completed cases for this surgeon
                      </div>
                    )}
                  </div>

                  {/* Procedure Details Table */}
                  {procedureBreakdown.length > 0 && (
                    <div className="bg-white rounded-xl border border-slate-200 mt-6 overflow-hidden">
                      <div className="px-6 py-4 border-b border-slate-200">
                        <h3 className="text-lg font-semibold text-slate-900">Detailed Breakdown</h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-slate-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Procedure</th>
                              <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Cases</th>
                              <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Pre-Op</th>
                              <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Anesthesia</th>
                              <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Surgical</th>
                              <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Closing</th>
                              <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {procedureBreakdown.map((proc, idx) => (
                              <tr key={idx} className="hover:bg-slate-50">
                                <td className="px-6 py-4 text-sm font-medium text-slate-900">{proc.fullName}</td>
                                <td className="px-6 py-4 text-sm text-center text-slate-600">{proc.caseCount}</td>
                                <td className="px-6 py-4 text-sm text-center text-slate-600">{formatMinutes(proc['Pre-Op'])}</td>
                                <td className="px-6 py-4 text-sm text-center text-slate-600">{formatMinutes(proc['Anesthesia'])}</td>
                                <td className="px-6 py-4 text-sm text-center text-slate-600">{formatMinutes(proc['Surgical'])}</td>
                                <td className="px-6 py-4 text-sm text-center text-slate-600">{formatMinutes(proc['Closing'])}</td>
                                <td className="px-6 py-4 text-sm text-center font-semibold text-slate-900">{formatMinutes(proc['Total'])}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-12 text-center">
                  <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-1">Select a Surgeon</h3>
                  <p className="text-slate-500">Choose a surgeon above to view their detailed analytics</p>
                </div>
              )}
            </>
          )}
        </AnalyticsLayout>
      </Container>
    </DashboardLayout>
  )
}