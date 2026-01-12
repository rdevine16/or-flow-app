'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../../lib/supabase'
import DashboardLayout from '../../../components/layouts/DashboardLayout'
import Container from '../../../components/ui/Container'
import DateFilter from '../../../components/ui/DateFilter'
import AnalyticsLayout from '../../../components/analytics/AnalyticsLayout'
import {
  getMilestoneMap,
  getTotalCaseTime,
  getSurgicalTime,
  getPreOpTime,
  getClosingTime,
  calculateAverage,
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
} from 'recharts'

interface Surgeon {
  id: string
  first_name: string
  last_name: string
}

const COLORS = ['#0d9488', '#0ea5e9', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

export default function SurgeonComparisonPage() {
  const supabase = createClient()
  const [cases, setCases] = useState<CaseWithMilestones[]>([])
  const [surgeons, setSurgeons] = useState<Surgeon[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFilter, setDateFilter] = useState('month')
  const [selectedSurgeons, setSelectedSurgeons] = useState<string[]>([])
  
  // NEW: Store the logged-in user's facility ID dynamically
  const [userFacilityId, setUserFacilityId] = useState<string | null>(null)

  // NEW: First, get the logged-in user's facility
  useEffect(() => {
    async function fetchUserFacility() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: userData } = await supabase
        .from('users')
        .select('facility_id')
        .eq('id', user.id)
        .single()

      if (userData?.facility_id) {
        setUserFacilityId(userData.facility_id)
      }
    }
    fetchUserFacility()
  }, [])

  const fetchData = async (startDate?: string, endDate?: string) => {
    if (!userFacilityId) return  // Wait for facility ID
    
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
      .eq('facility_id', userFacilityId)  // ← DYNAMIC!
      .order('scheduled_date', { ascending: false })

    if (startDate && endDate) {
      query = query.gte('scheduled_date', startDate).lte('scheduled_date', endDate)
    }

    const { data: casesData } = await query

    const { data: surgeonsData } = await supabase
      .from('users')
      .select('id, first_name, last_name, role_id')
      .eq('facility_id', userFacilityId)  // ← DYNAMIC!

    const { data: surgeonRole } = await supabase
      .from('user_roles')
      .select('id')
      .eq('name', 'surgeon')
      .single()

    setCases((casesData as unknown as CaseWithMilestones[]) || [])
    const filteredSurgeons = (surgeonsData?.filter(u => u.role_id === surgeonRole?.id) as Surgeon[]) || []
    setSurgeons(filteredSurgeons)
    
    // Auto-select first 2 surgeons if none selected
    if (selectedSurgeons.length === 0 && filteredSurgeons.length >= 2) {
      setSelectedSurgeons([filteredSurgeons[0].id, filteredSurgeons[1].id])
    }
    
    setLoading(false)
  }

  // CHANGED: Fetch data when userFacilityId is available
  useEffect(() => {
    if (!userFacilityId) return  // Wait for facility ID
    
    const today = new Date()
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    fetchData(monthStart.toISOString().split('T')[0], today.toISOString().split('T')[0])
  }, [userFacilityId])  // ← Added dependency

  const handleFilterChange = (filter: string, startDate?: string, endDate?: string) => {
    setDateFilter(filter)
    fetchData(startDate, endDate)
  }

  const toggleSurgeon = (surgeonId: string) => {
    if (selectedSurgeons.includes(surgeonId)) {
      setSelectedSurgeons(selectedSurgeons.filter(id => id !== surgeonId))
    } else if (selectedSurgeons.length < 6) {
      setSelectedSurgeons([...selectedSurgeons, surgeonId])
    }
  }

  // Get comparison data for selected surgeons
  const getComparisonData = () => {
    return selectedSurgeons.map((surgeonId, index) => {
      const surgeon = surgeons.find(s => s.id === surgeonId)
      const surgeonCases = cases.filter(c => c.surgeon_id === surgeonId)
      const completedCases = surgeonCases.filter(c => {
        const milestones = getMilestoneMap(c)
        return milestones.patient_in && milestones.patient_out
      })

      const totalTimes = completedCases.map(c => getTotalCaseTime(getMilestoneMap(c)))
      const surgicalTimes = completedCases.map(c => getSurgicalTime(getMilestoneMap(c)))
      const preOpTimes = completedCases.map(c => getPreOpTime(getMilestoneMap(c)))
      const closingTimes = completedCases.map(c => getClosingTime(getMilestoneMap(c)))

      return {
        id: surgeonId,
        name: surgeon ? `Dr. ${surgeon.last_name}` : 'Unknown',
        fullName: surgeon ? `Dr. ${surgeon.first_name} ${surgeon.last_name}` : 'Unknown',
        color: COLORS[index % COLORS.length],
        totalCases: surgeonCases.length,
        completedCases: completedCases.length,
        avgTotalTime: calculateAverage(totalTimes),
        avgSurgicalTime: calculateAverage(surgicalTimes),
        avgPreOpTime: calculateAverage(preOpTimes),
        avgClosingTime: calculateAverage(closingTimes),
      }
    })
  }

  const comparisonData = getComparisonData()

  // Prepare chart data
  const totalTimeChartData = comparisonData.map(d => ({
    name: d.name,
    value: d.avgTotalTime || 0,
    fill: d.color,
  }))

  const phaseComparisonData = [
    {
      phase: 'Pre-Op',
      ...Object.fromEntries(comparisonData.map(d => [d.name, d.avgPreOpTime || 0])),
    },
    {
      phase: 'Surgical',
      ...Object.fromEntries(comparisonData.map(d => [d.name, d.avgSurgicalTime || 0])),
    },
    {
      phase: 'Closing',
      ...Object.fromEntries(comparisonData.map(d => [d.name, d.avgClosingTime || 0])),
    },
  ]

  const caseVolumeData = comparisonData.map(d => ({
    name: d.name,
    completed: d.completedCases,
    total: d.totalCases,
  }))

return (
  <DashboardLayout>
    <Container>
      <AnalyticsLayout title="Surgeon Comparison" description="Compare performance metrics across surgeons">
        <div className="flex justify-end mb-6">
<DateFilter selectedFilter={dateFilter} onFilterChange={handleFilterChange} />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <svg className="animate-spin h-8 w-8 text-teal-500" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            </div>
          ) : (
            <>
              {/* Surgeon Selection */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
                <p className="text-sm font-medium text-slate-700 mb-3">Select Surgeons to Compare (max 6)</p>
                <div className="flex flex-wrap gap-2">
                  {surgeons.map(surgeon => (
                    <button
                      key={surgeon.id}
                      onClick={() => toggleSurgeon(surgeon.id)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        selectedSurgeons.includes(surgeon.id)
                          ? 'bg-teal-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Dr. {surgeon.first_name} {surgeon.last_name}
                    </button>
                  ))}
                </div>
              </div>

              {selectedSurgeons.length >= 2 ? (
                <>
                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                    {comparisonData.map(d => (
                      <div
                        key={d.id}
                        className="bg-white rounded-xl border-2 p-6"
                        style={{ borderColor: d.color }}
                      >
                        <div className="flex items-center gap-3 mb-4">
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                            style={{ backgroundColor: d.color }}
                          >
                            {d.fullName.split(' ').slice(1).map(n => n[0]).join('')}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{d.fullName}</p>
                            <p className="text-sm text-slate-500">{d.completedCases} completed cases</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-slate-400 uppercase">Avg Total</p>
                            <p className="text-xl font-bold text-slate-900">{formatMinutes(d.avgTotalTime)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400 uppercase">Avg Surgical</p>
                            <p className="text-xl font-bold text-slate-900">{formatMinutes(d.avgSurgicalTime)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Charts */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    {/* Total Time Comparison */}
                    <div className="bg-white rounded-xl border border-slate-200 p-6">
                      <h3 className="text-lg font-semibold text-slate-900 mb-4">Avg Total Case Time</h3>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={totalTimeChartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                          <YAxis stroke="#64748b" fontSize={12} />
                          <Tooltip
                            formatter={(value) => [formatMinutes(typeof value === 'number' ? value : 0), 'Avg Time']}
                            contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                          />
                          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                            {totalTimeChartData.map((entry, index) => (
                              <Bar key={index} dataKey="value" fill={entry.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Case Volume */}
                    <div className="bg-white rounded-xl border border-slate-200 p-6">
                      <h3 className="text-lg font-semibold text-slate-900 mb-4">Case Volume</h3>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={caseVolumeData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                          <YAxis stroke="#64748b" fontSize={12} />
                          <Tooltip
                            contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                          />
                          <Legend />
                          <Bar dataKey="completed" name="Completed" fill="#0d9488" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="total" name="Total" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Phase Comparison */}
                  <div className="bg-white rounded-xl border border-slate-200 p-6 mb-8">
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">Phase Time Comparison</h3>
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart data={phaseComparisonData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="phase" stroke="#64748b" fontSize={12} />
                        <YAxis stroke="#64748b" fontSize={12} label={{ value: 'Minutes', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#64748b' } }} />
                        <Tooltip
                          formatter={(value: number | string | undefined, name: string | undefined) => [formatMinutes(typeof value === 'number' ? value : 0), name || '']}
                          contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                        />
                        <Legend />
                        {comparisonData.map(d => (
                          <Bar key={d.id} dataKey={d.name} fill={d.color} radius={[4, 4, 0, 0]} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Comparison Table */}
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-200">
                      <h3 className="text-lg font-semibold text-slate-900">Detailed Comparison</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Metric</th>
                            {comparisonData.map(d => (
                              <th key={d.id} className="px-6 py-3 text-center text-xs font-semibold uppercase" style={{ color: d.color }}>
                                {d.name}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          <tr>
                            <td className="px-6 py-4 text-sm font-medium text-slate-900">Total Cases</td>
                            {comparisonData.map(d => (
                              <td key={d.id} className="px-6 py-4 text-sm text-center text-slate-600">{d.totalCases}</td>
                            ))}
                          </tr>
                          <tr className="bg-slate-50">
                            <td className="px-6 py-4 text-sm font-medium text-slate-900">Completed Cases</td>
                            {comparisonData.map(d => (
                              <td key={d.id} className="px-6 py-4 text-sm text-center text-slate-600">{d.completedCases}</td>
                            ))}
                          </tr>
                          <tr>
                            <td className="px-6 py-4 text-sm font-medium text-slate-900">Avg Total Time</td>
                            {comparisonData.map(d => (
                              <td key={d.id} className="px-6 py-4 text-sm text-center font-semibold text-slate-900">
                                {formatMinutes(d.avgTotalTime)}
                              </td>
                            ))}
                          </tr>
                          <tr className="bg-slate-50">
                            <td className="px-6 py-4 text-sm font-medium text-slate-900">Avg Surgical Time</td>
                            {comparisonData.map(d => (
                              <td key={d.id} className="px-6 py-4 text-sm text-center text-slate-600">
                                {formatMinutes(d.avgSurgicalTime)}
                              </td>
                            ))}
                          </tr>
                          <tr>
                            <td className="px-6 py-4 text-sm font-medium text-slate-900">Avg Pre-Op Time</td>
                            {comparisonData.map(d => (
                              <td key={d.id} className="px-6 py-4 text-sm text-center text-slate-600">
                                {formatMinutes(d.avgPreOpTime)}
                              </td>
                            ))}
                          </tr>
                          <tr className="bg-slate-50">
                            <td className="px-6 py-4 text-sm font-medium text-slate-900">Avg Closing Time</td>
                            {comparisonData.map(d => (
                              <td key={d.id} className="px-6 py-4 text-sm text-center text-slate-600">
                                {formatMinutes(d.avgClosingTime)}
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-12 text-center">
                  <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-1">Select at Least 2 Surgeons</h3>
                  <p className="text-slate-500">Choose surgeons above to compare their performance metrics</p>
                </div>
              )}
            </>
          )}
        </AnalyticsLayout>
      </Container>
    </DashboardLayout>
  )
}
