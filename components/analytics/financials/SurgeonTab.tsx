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
  ReferenceLine,
} from 'recharts'
import { FinancialsMetrics } from './types'
import { formatCurrency } from './utils'
import MetricCard from './MetricCard'
import { InformationCircleIcon } from '@heroicons/react/24/outline'

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
        facilityMedianDuration: proc.medianDurationMinutes,
        facilityMedianProfit: proc.medianProfit,
      }
    })
    .filter(Boolean)

  return (
    <>
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard 
          title="Total Profit" 
          value={formatCurrency(surgeon.totalProfit)}
          variant="success"
        />
        
        {/* Typical Profit with comparison */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-1 mb-1">
            <p className="text-sm font-medium text-slate-500">Typical Profit / Case</p>
            <div className="group relative">
              <InformationCircleIcon className="w-4 h-4 text-slate-400 cursor-help" />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                Median profit across all procedures
                <br />
                <span className="text-slate-400">vs Facility: {surgeon.profitVsFacility >= 0 ? '+' : ''}{formatCurrency(surgeon.profitVsFacility)}</span>
              </div>
            </div>
          </div>
          <p className="text-xl font-bold text-slate-900">
            {surgeon.medianProfit !== null ? formatCurrency(surgeon.medianProfit) : formatCurrency(surgeon.avgProfit)}
          </p>
          <p className={`text-xs mt-1 ${surgeon.profitVsFacility >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {surgeon.profitVsFacility >= 0 ? '+' : ''}{formatCurrency(surgeon.profitVsFacility)} vs facility
          </p>
        </div>

        {/* Duration vs Facility */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-1 mb-1">
            <p className="text-sm font-medium text-slate-500">Time vs Facility</p>
            <div className="group relative">
              <InformationCircleIcon className="w-4 h-4 text-slate-400 cursor-help" />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                Weighted by procedure mix
                <br />
                Negative = faster than typical
              </div>
            </div>
          </div>
          <p className={`text-xl font-bold ${surgeon.durationVsFacilityMinutes < 0 ? 'text-emerald-600' : surgeon.durationVsFacilityMinutes > 10 ? 'text-red-500' : 'text-slate-900'}`}>
            {surgeon.durationVsFacilityMinutes > 0 ? '+' : ''}{Math.round(surgeon.durationVsFacilityMinutes)} min
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Impact: <span className={surgeon.profitImpact >= 0 ? 'text-emerald-600' : 'text-red-500'}>
              {surgeon.profitImpact >= 0 ? '+' : ''}{formatCurrency(surgeon.profitImpact)}/case
            </span>
          </p>
        </div>

        <MetricCard title="Cases" value={surgeon.caseCount} />
      </div>

      {/* Efficiency Metrics (if available) */}
      {surgeon.medianSurgicalTurnover !== null && (
        <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border border-slate-200 p-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Efficiency Metrics</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-slate-500">Typical Surgical Turnover</p>
              <p className="text-lg font-bold text-slate-900">{Math.round(surgeon.medianSurgicalTurnover)} min</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Typical Duration</p>
              <p className="text-lg font-bold text-slate-900">
                {surgeon.medianDurationMinutes !== null ? `${Math.round(surgeon.medianDurationMinutes)} min` : '—'}
              </p>
            </div>
            {surgeon.consistencyRating && (
              <div>
                <p className="text-xs text-slate-500">Consistency</p>
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-sm font-medium mt-1 ${
                  surgeon.consistencyRating === 'high' 
                    ? 'bg-emerald-100 text-emerald-700' 
                    : surgeon.consistencyRating === 'medium'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  {surgeon.consistencyRating === 'high' ? '⚡ High' :
                   surgeon.consistencyRating === 'medium' ? '◐ Medium' : '◯ Low'}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Procedure Breakdown */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-slate-900">By Procedure</h3>
            <div className="group relative">
              <InformationCircleIcon className="w-5 h-5 text-slate-400 cursor-help" />
              <div className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 w-64">
                <strong>Fair comparison:</strong> Surgeon's typical vs facility typical for the same procedure
              </div>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Procedure</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Cases</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Typical Profit</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Typical Time</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">vs Facility</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Consistency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {surgeonProcedures.map((proc: any) => (
                <tr key={proc.procedureName} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-medium text-slate-900">{proc.procedureName}</td>
                  <td className="px-6 py-4 text-center text-slate-600">{proc.caseCount}</td>
                  <td className="px-6 py-4 text-right">
                    <span className="font-medium text-emerald-600">
                      {proc.medianProfit !== null ? formatCurrency(proc.medianProfit) : formatCurrency(proc.avgProfit)}
                    </span>
                    {proc.profitVsFacility !== 0 && (
                      <span className={`ml-2 text-xs ${proc.profitVsFacility >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                        ({proc.profitVsFacility >= 0 ? '+' : ''}{formatCurrency(proc.profitVsFacility)})
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right text-slate-600">
                    {proc.medianDurationMinutes !== null ? Math.round(proc.medianDurationMinutes) : Math.round(proc.avgDurationMinutes)} min
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={proc.durationVsFacilityMinutes < 0 ? 'text-emerald-600' : proc.durationVsFacilityMinutes > 10 ? 'text-red-500' : 'text-slate-600'}>
                      {proc.durationVsFacilityMinutes > 0 ? '+' : ''}{Math.round(proc.durationVsFacilityMinutes)} min
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {proc.consistencyRating && (
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                        proc.consistencyRating === 'high' ? 'bg-emerald-100 text-emerald-700' :
                        proc.consistencyRating === 'medium' ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {proc.consistencyRating === 'high' ? '⚡' :
                         proc.consistencyRating === 'medium' ? '◐' : '◯'}
                      </span>
                    )}
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
        <div className="px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-slate-900">Surgeon Comparison</h3>
            <div className="group relative">
              <InformationCircleIcon className="w-5 h-5 text-slate-400 cursor-help" />
              <div className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 w-72">
                <strong>Fair comparison:</strong> Each surgeon compared to facility typical weighted by their procedure mix
              </div>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Surgeon</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Cases</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Total Profit</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Typical / Case</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Time vs Facility</th>
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
                      <div>
                        <span className="font-medium text-slate-900">{surgeon.surgeonName}</span>
                        {surgeon.caseCount < 10 && (
                          <span className="ml-1 text-xs text-amber-600">*</span>
                        )}
                        {surgeon.consistencyRating && (
                          <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${
                            surgeon.consistencyRating === 'high' 
                              ? 'bg-emerald-100 text-emerald-700' 
                              : surgeon.consistencyRating === 'medium'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {surgeon.consistencyRating}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center text-slate-600">{surgeon.caseCount}</td>
                  <td className="px-6 py-4 text-right font-semibold text-emerald-600">
                    {formatCurrency(surgeon.totalProfit)}
                  </td>
                  <td className="px-6 py-4 text-right text-slate-600">
                    {surgeon.medianProfit !== null ? formatCurrency(surgeon.medianProfit) : formatCurrency(surgeon.avgProfit)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={surgeon.durationVsFacilityMinutes < 0 ? 'text-emerald-600' : surgeon.durationVsFacilityMinutes > 10 ? 'text-red-500' : 'text-slate-600'}>
                      {surgeon.durationVsFacilityMinutes > 0 ? '+' : ''}{Math.round(surgeon.durationVsFacilityMinutes)} min
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={surgeon.profitImpact > 0 ? 'text-emerald-600' : surgeon.profitImpact < -100 ? 'text-red-500' : 'text-slate-600'}>
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
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Time vs Profit Analysis</h3>
          <p className="text-sm text-slate-500 mb-4">
            Top-left quadrant = fast and profitable. Dashed lines show facility typical.
          </p>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                type="number" 
                dataKey="medianDurationMinutes" 
                name="Typical Duration" 
                unit=" min"
                label={{ value: 'Typical Duration (min)', position: 'bottom', offset: -5 }}
              />
              <YAxis 
                type="number" 
                dataKey="medianProfit" 
                name="Typical Profit"
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                label={{ value: 'Typical Profit', angle: -90, position: 'insideLeft' }}
              />
              {/* Reference lines for facility typical */}
              {metrics.medianDuration !== null && (
                <ReferenceLine 
                  x={metrics.medianDuration} 
                  stroke="#94a3b8" 
                  strokeDasharray="5 5"
                />
              )}
              {metrics.medianProfit !== null && (
                <ReferenceLine 
                  y={metrics.medianProfit} 
                  stroke="#94a3b8" 
                  strokeDasharray="5 5"
                />
              )}
              <Tooltip 
                formatter={(value: any, name: string) => {
                  if (value === undefined || value === null) return '—'
                  if (name === 'Typical Profit') return formatCurrency(value)
                  return `${Math.round(value)} min`
                }}
                labelFormatter={(_, payload: any) => payload?.[0]?.payload?.surgeonName || ''}
              />
              <Scatter 
                data={metrics.surgeonStats.filter(s => s.caseCount >= 5 && s.medianProfit !== null && s.medianDurationMinutes !== null)} 
                fill="#2563eb"
              >
                {metrics.surgeonStats
                  .filter(s => s.caseCount >= 5 && s.medianProfit !== null && s.medianDurationMinutes !== null)
                  .map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.profitImpact > 0 ? '#10b981' : '#ef4444'} 
                    />
                  ))
                }
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}
    </>
  )
}