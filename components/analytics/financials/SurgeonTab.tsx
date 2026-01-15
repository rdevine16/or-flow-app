'use client'

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { FinancialsMetrics } from './types'
import { formatCurrency } from './utils'
import MetricCard from './MetricCard'

interface SurgeonTabProps {
  metrics: FinancialsMetrics
  selectedSurgeon: string | null
  onSurgeonSelect: (surgeonId: string | null) => void
}

export default function SurgeonTab({ 
  metrics, 
  selectedSurgeon, 
  onSurgeonSelect 
}: SurgeonTabProps) {
  return (
    <div className="space-y-6">
      {/* Surgeon Filter */}
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium text-slate-700">Surgeon:</label>
        <select
          value={selectedSurgeon || ''}
          onChange={(e) => onSurgeonSelect(e.target.value || null)}
          className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm"
        >
          <option value="">All Surgeons</option>
          {metrics.surgeonStats.map(surgeon => (
            <option key={surgeon.surgeonId} value={surgeon.surgeonId}>
              {surgeon.surgeonName} ({surgeon.caseCount})
            </option>
          ))}
        </select>
      </div>

      {selectedSurgeon ? (
        <SurgeonDetail 
          metrics={metrics} 
          surgeonId={selectedSurgeon} 
        />
      ) : (
        <AllSurgeonsView 
          metrics={metrics} 
          onSurgeonSelect={onSurgeonSelect} 
        />
      )}
    </div>
  )
}

function SurgeonDetail({ 
  metrics, 
  surgeonId 
}: { 
  metrics: FinancialsMetrics
  surgeonId: string 
}) {
  const surgeon = metrics.surgeonStats.find(s => s.surgeonId === surgeonId)
  if (!surgeon) return null

  // Get procedure breakdown for this surgeon
  const surgeonProcedures = metrics.procedureStats
    .map(proc => {
      const surgeonData = proc.surgeonBreakdown.find(s => s.surgeonId === surgeonId)
      if (!surgeonData) return null
      return {
        procedureName: proc.procedureName,
        ...surgeonData,
        facilityAvgDuration: proc.avgDurationMinutes,
      }
    })
    .filter(Boolean) as Array<{
      procedureName: string
      surgeonId: string
      surgeonName: string
      totalProfit: number
      avgProfit: number
      caseCount: number
      avgDurationMinutes: number
      durationVsAvgMinutes: number
      profitImpact: number
      facilityAvgDuration: number
    }>

  return (
    <>
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard 
          title="Total Profit" 
          value={formatCurrency(surgeon.totalProfit)}
          variant="success"
        />
        <MetricCard title="Avg Profit / Case" value={formatCurrency(surgeon.avgProfit)} />
        <MetricCard 
          title="Time vs Avg" 
          value={`${surgeon.durationVsAvgMinutes > 0 ? '+' : ''}${Math.round(surgeon.durationVsAvgMinutes)} min`}
          variant={surgeon.durationVsAvgMinutes < 0 ? 'success' : surgeon.durationVsAvgMinutes > 10 ? 'warning' : 'default'}
        />
        <MetricCard title="Cases" value={surgeon.caseCount} />
      </div>

      {/* Procedure Breakdown */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">By Procedure</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Procedure</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Cases</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Avg Profit</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Avg Time</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">vs Facility</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {surgeonProcedures.map((proc) => (
                <tr key={proc.procedureName} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-medium text-slate-900">{proc.procedureName}</td>
                  <td className="px-6 py-4 text-center text-slate-600">{proc.caseCount}</td>
                  <td className="px-6 py-4 text-right font-medium text-emerald-600">
                    {formatCurrency(proc.avgProfit)}
                  </td>
                  <td className="px-6 py-4 text-right text-slate-600">
                    {Math.round(proc.avgDurationMinutes)} min
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={proc.durationVsAvgMinutes < 0 ? 'text-emerald-600' : 'text-red-500'}>
                      {proc.durationVsAvgMinutes > 0 ? '+' : ''}{Math.round(proc.durationVsAvgMinutes)} min
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

function AllSurgeonsView({ 
  metrics, 
  onSurgeonSelect 
}: { 
  metrics: FinancialsMetrics
  onSurgeonSelect: (surgeonId: string) => void 
}) {
  return (
    <>
      {/* Comparison Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Surgeon</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Cases</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Total Profit</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Per Case</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Time vs Avg</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Impact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {metrics.surgeonStats.map((surgeon, idx) => (
                <tr 
                  key={surgeon.surgeonId} 
                  className="hover:bg-slate-50 cursor-pointer"
                  onClick={() => onSurgeonSelect(surgeon.surgeonId)}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${
                        idx === 0 ? 'bg-amber-500' : idx === 1 ? 'bg-slate-400' : idx === 2 ? 'bg-amber-700' : 'bg-slate-300'
                      }`}>
                        {idx + 1}
                      </div>
                      <span className="font-medium text-slate-900">{surgeon.surgeonName}</span>
                      {surgeon.caseCount < 10 && (
                        <span className="text-xs text-amber-600">*</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center text-slate-600">{surgeon.caseCount}</td>
                  <td className="px-6 py-4 text-right font-semibold text-emerald-600">
                    {formatCurrency(surgeon.totalProfit)}
                  </td>
                  <td className="px-6 py-4 text-right text-slate-600">{formatCurrency(surgeon.avgProfit)}</td>
                  <td className="px-6 py-4 text-right">
                    <span className={surgeon.durationVsAvgMinutes < 0 ? 'text-emerald-600' : 'text-red-500'}>
                      {surgeon.durationVsAvgMinutes > 0 ? '+' : ''}{Math.round(surgeon.durationVsAvgMinutes)} min
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={surgeon.profitImpact > 0 ? 'text-emerald-600' : 'text-red-500'}>
                      {surgeon.profitImpact > 0 ? '+' : ''}{formatCurrency(surgeon.profitImpact)}/case
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {metrics.surgeonStats.some(s => s.caseCount < 10) && (
          <div className="px-6 py-3 bg-slate-50 border-t border-slate-200">
            <p className="text-xs text-slate-500">* Below minimum threshold (10 cases) for statistical reliability</p>
          </div>
        )}
      </div>

      {/* Scatter Plot */}
      {metrics.surgeonStats.length > 1 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Time vs Profit Analysis</h3>
          <p className="text-sm text-slate-500 mb-4">Top-left quadrant = fast and profitable</p>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                type="number" 
                dataKey="avgDurationMinutes" 
                name="Avg Duration" 
                unit=" min"
                label={{ value: 'Avg Duration (min)', position: 'bottom' }}
              />
              <YAxis 
                type="number" 
                dataKey="avgProfit" 
                name="Avg Profit"
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                label={{ value: 'Avg Profit', angle: -90, position: 'left' }}
              />
              <Tooltip 
                formatter={(value: any, name: any) => {
                  if (value === undefined) return '-'
                  if (name === 'Avg Profit') return formatCurrency(value)
                  return `${Math.round(value)} min`
                }}
                labelFormatter={(_, payload: any) => payload?.[0]?.payload?.surgeonName || ''}
              />
              <Scatter 
                data={metrics.surgeonStats.filter(s => s.caseCount >= 5)} 
                fill="#2563eb"
              >
                {metrics.surgeonStats.filter(s => s.caseCount >= 5).map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.profitImpact > 0 ? '#10b981' : '#ef4444'} 
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}
    </>
  )
}
