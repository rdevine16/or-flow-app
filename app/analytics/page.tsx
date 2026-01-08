'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../lib/supabase'
import DashboardLayout from '../../components/layouts/DashboardLayout'
import Container from '../../components/ui/Container'
import DateFilter from '../../components/ui/DateFilter'
import MetricCard from '../../components/ui/MetricCard'
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
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts'

const COLORS = ['#0d9488', '#0ea5e9', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

interface Surgeon {
  id: string
  first_name: string
  last_name: string
}

interface ProcedureType {
  id: string
  name: string
}

export default function AnalyticsPage() {
  const supabase = createClient()
  const [cases, setCases] = useState<CaseWithMilestones[]>([])
  const [surgeons, setSurgeons] = useState<Surgeon[]>([])
  const [procedures, setProcedures] = useState<ProcedureType[]>([])
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

    const { data: proceduresData } = await supabase
      .from('procedure_types')
      .select('id, name')
      .eq('facility_id', facilityId)

    setCases((casesData as unknown as CaseWithMilestones[]) || [])
    setSurgeons(
      (surgeonsData?.filter(u => u.role_id === surgeonRole?.id) as Surgeon[]) || []
    )
    setProcedures(proceduresData || [])
    setLoading(false)
  }

  useEffect(() => {
    // Default to this month
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

  // Cases by procedure type
  const casesByProcedure = procedures.map(proc => {
    const procCases = completedCases.filter(c => {
      const procType = Array.isArray(c.procedure_types) ? c.procedure_types[0] : c.procedure_types
      return procType?.id === proc.id
    })
    const times = procCases.map(c => getTotalCaseTime(getMilestoneMap(c)))
    return {
      name: proc.name.length > 15 ? proc.name.substring(0, 15) + '...' : proc.name,
      fullName: proc.name,
      count: procCases.length,
      avgTime: calculateAverage(times) || 0,
    }
  }).filter(p => p.count > 0).sort((a, b) => b.count - a.count)

  // Cases by surgeon
  const casesBySurgeon = surgeons.map(surgeon => {
    const surgeonCases = completedCases.filter(c => c.surgeon_id === surgeon.id)
    const times = surgeonCases.map(c => getTotalCaseTime(getMilestoneMap(c)))
    return {
      name: 'Dr. ' + surgeon.last_name,
      fullName: 'Dr. ' + surgeon.first_name + ' ' + surgeon.last_name,
      count: surgeonCases.length,
      avgTime: calculateAverage(times) || 0,
    }
  }).filter(s => s.count > 0).sort((a, b) => b.count - a.count)

  // Milestone breakdown for selected surgeon
  const getSurgeonMilestoneData = (surgeonId: string) => {
    const surgeonCases = completedCases.filter(c => c.surgeon_id === surgeonId)
    
    // Group by procedure type
    const byProcedure: { [key: string]: { preOp: number[], surgical: number[], closing: number[] } } = {}
    
    surgeonCases.forEach(c => {
      const procType = Array.isArray(c.procedure_types) ? c.procedure_types[0] : c.procedure_types
      const procName = procType?.name || 'Unknown'
      const milestones = getMilestoneMap(c)
      
      if (!byProcedure[procName]) {
        byProcedure[procName] = { preOp: [], surgical: [], closing: [] }
      }
      
      const preOp = getPreOpTime(milestones)
      const surgical = getSurgicalTime(milestones)
      const closing = getClosingTime(milestones)
      
      if (preOp) byProcedure[procName].preOp.push(preOp)
      if (surgical) byProcedure[procName].surgical.push(surgical)
      if (closing) byProcedure[procName].closing.push(closing)
    })

    return Object.entries(byProcedure).map(([procedure, times]) => ({
      procedure: procedure.length > 20 ? procedure.substring(0, 20) + '...' : procedure,
      'Pre-Op': calculateAverage(times.preOp) || 0,
      'Surgical': calculateAverage(times.surgical) || 0,
      'Closing': calculateAverage(times.closing) || 0,
    }))
  }

  // Cases over time (by date)
  const casesByDate = cases.reduce((acc: { [key: string]: number }, c) => {
    const date = c.scheduled_date
    acc[date] = (acc[date] || 0) + 1
    return acc
  }, {})

  const casesTrend = Object.entries(casesByDate)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-14) // Last 14 days

  return (
    <DashboardLayout>
      <Container className="py-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Analytics</h1>
            <p className="text-slate-500 mt-1">
              {completedCases.length} completed cases analyzed
            </p>
          </div>
          <div className="flex items-center gap-4">
            <DateFilter selectedFilter={dateFilter} onFilterChange={handleFilterChange} />
            <button className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
              Export
            </button>
          </div>
        </div>

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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
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
                title="Avg Pre-Op Time"
                value={formatMinutes(avgPreOpTime)}
                subtitle="Setup efficiency"
              />
              <MetricCard
                title="Avg Anesthesia"
                value={formatMinutes(avgAnesthesiaTime)}
                subtitle="Anes Start → End"
              />
              <MetricCard
                title="Case Time Variance"
                value={caseTimeVariance ? `±${caseTimeVariance}m` : '-'}
                subtitle="Consistency measure"
              />
            </div>

            {/* Second Row Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <MetricCard
                title="Total Cases"
                value={cases.length}
                subtitle="In selected period"
              />
              <MetricCard
                title="Completed"
                value={completedCases.length}
                subtitle={`${cases.length > 0 ? Math.round((completedCases.length / cases.length) * 100) : 0}% completion`}
              />
              <MetricCard
                title="Avg Closing Time"
                value={formatMinutes(avgClosingTime)}
                subtitle="Closing → Patient Out"
              />
              <MetricCard
                title="Surgeons Active"
                value={casesBySurgeon.length}
                subtitle="With completed cases"
              />
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Cases by Procedure */}
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Cases by Procedure Type</h3>
                {casesByProcedure.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={casesByProcedure} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis type="number" stroke="#64748b" fontSize={12} />
                      <YAxis dataKey="name" type="category" width={100} stroke="#64748b" fontSize={12} />
                      <Tooltip
                        formatter={(value: number, name: string) => [value, name === 'count' ? 'Cases' : 'Avg Time (min)']}
                        contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                      />
                      <Bar dataKey="count" fill="#0d9488" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-slate-400">
                    No data available
                  </div>
                )}
              </div>

              {/* Cases by Surgeon */}
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Cases by Surgeon</h3>
                {casesBySurgeon.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={casesBySurgeon} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis type="number" stroke="#64748b" fontSize={12} />
                      <YAxis dataKey="name" type="category" width={100} stroke="#64748b" fontSize={12} />
                      <Tooltip
                        formatter={(value: number) => [value, 'Cases']}
                        contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                      />
                      <Bar dataKey="count" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-slate-400">
                    No data available
                  </div>
                )}
              </div>
            </div>

            {/* Charts Row 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Avg Time by Procedure */}
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Avg Case Time by Procedure (minutes)</h3>
                {casesByProcedure.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={casesByProcedure} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis type="number" stroke="#64748b" fontSize={12} />
                      <YAxis dataKey="name" type="category" width={100} stroke="#64748b" fontSize={12} />
                      <Tooltip
                        formatter={(value: number) => [formatMinutes(value), 'Avg Time']}
                        contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                      />
                      <Bar dataKey="avgTime" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-slate-400">
                    No data available
                  </div>
                )}
              </div>

              {/* Cases Trend */}
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
                        labelFormatter={(date) => new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                        formatter={(value: number) => [value, 'Cases']}
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

            {/* Surgeon Deep Dive */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-slate-900">Surgeon Milestone Analysis</h3>
                <select
                  value={selectedSurgeon || ''}
                  onChange={(e) => setSelectedSurgeon(e.target.value || null)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                >
                  <option value="">Select a surgeon</option>
                  {surgeons.map(s => (
                    <option key={s.id} value={s.id}>
                      Dr. {s.first_name} {s.last_name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedSurgeon ? (
                <div>
                  <p className="text-sm text-slate-500 mb-4">
                    Average time spent in each phase by procedure type (in minutes)
                  </p>
                  {getSurgeonMilestoneData(selectedSurgeon).length > 0 ? (
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={getSurgeonMilestoneData(selectedSurgeon)}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="procedure" stroke="#64748b" fontSize={12} />
                        <YAxis stroke="#64748b" fontSize={12} />
                        <Tooltip
                          formatter={(value: number) => [formatMinutes(value)]}
                          contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                        />
                        <Legend />
                        <Bar dataKey="Pre-Op" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
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
              ) : (
                <div className="h-[400px] flex items-center justify-center text-slate-400">
                  Select a surgeon to see their milestone breakdown by procedure
                </div>
              )}
            </div>
          </>
        )}
      </Container>
    </DashboardLayout>
  )
}