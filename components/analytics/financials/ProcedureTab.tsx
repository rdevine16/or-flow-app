'use client'

import { FinancialsMetrics } from './types'
import { formatCurrency, formatPercent } from './utils'
import MetricCard from './MetricCard'

interface ProcedureTabProps {
  metrics: FinancialsMetrics
  selectedProcedure: string | null
  onProcedureSelect: (procedureId: string | null) => void
}

export default function ProcedureTab({ 
  metrics, 
  selectedProcedure, 
  onProcedureSelect 
}: ProcedureTabProps) {
  return (
    <div className="space-y-6">
      {/* Procedure Filter */}
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium text-slate-700">Procedure:</label>
        <select
          value={selectedProcedure || ''}
          onChange={(e) => onProcedureSelect(e.target.value || null)}
          className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm"
        >
          <option value="">All Procedures</option>
          {metrics.procedureStats.map(proc => (
            <option key={proc.procedureId} value={proc.procedureId}>
              {proc.procedureName} ({proc.caseCount})
            </option>
          ))}
        </select>
      </div>

      {selectedProcedure ? (
        // Single procedure detail
        <ProcedureDetail 
          metrics={metrics} 
          procedureId={selectedProcedure} 
        />
      ) : (
        // All procedures table
        <AllProceduresTable 
          metrics={metrics} 
          onProcedureSelect={onProcedureSelect} 
        />
      )}
    </div>
  )
}

function ProcedureDetail({ 
  metrics, 
  procedureId 
}: { 
  metrics: FinancialsMetrics
  procedureId: string 
}) {
  const proc = metrics.procedureStats.find(p => p.procedureId === procedureId)
  if (!proc) return null

  return (
    <>
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Avg Profit" value={formatCurrency(proc.avgProfit)} />
        <MetricCard title="Avg Duration" value={`${Math.round(proc.avgDurationMinutes)} min`} />
        <MetricCard title="Margin" value={formatPercent(proc.avgMarginPercent)} />
        <MetricCard title="Cases" value={proc.caseCount} />
      </div>

      {/* Surgeon Breakdown */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">Surgeon Breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Surgeon</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Cases</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Avg Profit</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Avg Time</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">vs Avg</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Impact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {proc.surgeonBreakdown.map(surgeon => (
                <tr key={surgeon.surgeonId} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <span className="font-medium text-slate-900">{surgeon.surgeonName}</span>
                    {surgeon.caseCount < 10 && (
                      <span className="ml-2 text-xs text-amber-600">*</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center text-slate-600">{surgeon.caseCount}</td>
                  <td className="px-6 py-4 text-right font-medium text-emerald-600">
                    {formatCurrency(surgeon.avgProfit)}
                  </td>
                  <td className="px-6 py-4 text-right text-slate-600">
                    {Math.round(surgeon.avgDurationMinutes)} min
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={surgeon.durationVsAvgMinutes < 0 ? 'text-emerald-600' : 'text-red-500'}>
                      {surgeon.durationVsAvgMinutes > 0 ? '+' : ''}{Math.round(surgeon.durationVsAvgMinutes)} min
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={surgeon.profitImpact > 0 ? 'text-emerald-600' : 'text-red-500'}>
                      {surgeon.profitImpact > 0 ? '+' : ''}{formatCurrency(surgeon.profitImpact)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {proc.surgeonBreakdown.some(s => s.caseCount < 10) && (
          <div className="px-6 py-3 bg-slate-50 border-t border-slate-200">
            <p className="text-xs text-slate-500">* Below minimum threshold (10 cases) for statistical reliability</p>
          </div>
        )}
      </div>
    </>
  )
}

function AllProceduresTable({ 
  metrics, 
  onProcedureSelect 
}: { 
  metrics: FinancialsMetrics
  onProcedureSelect: (procedureId: string) => void 
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Procedure</th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Cases</th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Total Profit</th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Avg Profit</th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Margin</th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Avg Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {metrics.procedureStats.map(proc => (
              <tr 
                key={proc.procedureId} 
                className="hover:bg-slate-50 cursor-pointer"
                onClick={() => onProcedureSelect(proc.procedureId)}
              >
                <td className="px-6 py-4 font-medium text-slate-900">{proc.procedureName}</td>
                <td className="px-6 py-4 text-center text-slate-600">{proc.caseCount}</td>
                <td className="px-6 py-4 text-right font-semibold text-emerald-600">
                  {formatCurrency(proc.totalProfit)}
                </td>
                <td className="px-6 py-4 text-right text-slate-600">{formatCurrency(proc.avgProfit)}</td>
                <td className="px-6 py-4 text-right text-slate-600">{formatPercent(proc.avgMarginPercent)}</td>
                <td className="px-6 py-4 text-right text-slate-600">{Math.round(proc.avgDurationMinutes)} min</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
