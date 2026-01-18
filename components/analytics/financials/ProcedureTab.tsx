'use client'

import { FinancialsMetrics } from './types'
import { formatCurrency, formatPercent } from './utils'
import MetricCard from './MetricCard'
import { InformationCircleIcon } from '@heroicons/react/24/outline'

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
      {/* Summary Cards - Updated with median */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard title="Total Profit" value={formatCurrency(proc.totalProfit)} variant="success" />
        
        {/* Typical Profit Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-1 mb-1">
            <p className="text-sm font-medium text-slate-500">Typical Profit</p>
            <div className="group relative">
              <InformationCircleIcon className="w-4 h-4 text-slate-400 cursor-help" />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                Median profit for this procedure
                <br />
                <span className="text-slate-400">Avg: {formatCurrency(proc.avgProfit)}</span>
              </div>
            </div>
          </div>
          <p className="text-xl font-bold text-slate-900">
            {proc.medianProfit !== null ? formatCurrency(proc.medianProfit) : formatCurrency(proc.avgProfit)}
          </p>
          {proc.profitRange.p25 !== null && proc.profitRange.p75 !== null && (
            <p className="text-xs text-slate-400 mt-1">
              {formatCurrency(proc.profitRange.p25)} – {formatCurrency(proc.profitRange.p75)}
            </p>
          )}
        </div>

        {/* Typical Duration Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-1 mb-1">
            <p className="text-sm font-medium text-slate-500">Typical Duration</p>
            <div className="group relative">
              <InformationCircleIcon className="w-4 h-4 text-slate-400 cursor-help" />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                Median duration for this procedure
                <br />
                <span className="text-slate-400">Avg: {Math.round(proc.avgDurationMinutes)} min</span>
              </div>
            </div>
          </div>
          <p className="text-xl font-bold text-slate-900">
            {proc.medianDurationMinutes !== null 
              ? `${Math.round(proc.medianDurationMinutes)} min`
              : `${Math.round(proc.avgDurationMinutes)} min`
            }
          </p>
          {proc.durationRange.p25 !== null && proc.durationRange.p75 !== null && (
            <p className="text-xs text-slate-400 mt-1">
              {Math.round(proc.durationRange.p25)} – {Math.round(proc.durationRange.p75)} min
            </p>
          )}
        </div>

        <MetricCard title="Margin" value={formatPercent(proc.avgMarginPercent)} />
        <MetricCard title="Cases" value={proc.caseCount} subtitle={`${proc.surgeonCount} surgeons`} />
      </div>

      {/* Surgeon Breakdown - Updated with median and fair comparison */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-slate-900">Surgeon Breakdown</h3>
            <div className="group relative">
              <InformationCircleIcon className="w-5 h-5 text-slate-400 cursor-help" />
              <div className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 w-64">
                <strong>Fair comparison:</strong> Each surgeon compared to facility typical for this same procedure
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
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Typical Profit</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Typical Time</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">vs Facility</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Impact</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Consistency</th>
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
                  <td className="px-6 py-4 text-right">
                    <span className="font-medium text-emerald-600">
                      {surgeon.medianProfit !== null 
                        ? formatCurrency(surgeon.medianProfit) 
                        : formatCurrency(surgeon.avgProfit)
                      }
                    </span>
                    {surgeon.profitVsFacility !== 0 && (
                      <span className={`ml-2 text-xs ${surgeon.profitVsFacility >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                        ({surgeon.profitVsFacility >= 0 ? '+' : ''}{formatCurrency(surgeon.profitVsFacility)})
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right text-slate-600">
                    {surgeon.medianDurationMinutes !== null 
                      ? Math.round(surgeon.medianDurationMinutes) 
                      : Math.round(surgeon.avgDurationMinutes)
                    } min
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={
                      surgeon.durationVsFacilityMinutes < 0 
                        ? 'text-emerald-600' 
                        : surgeon.durationVsFacilityMinutes > 10 
                        ? 'text-red-500' 
                        : 'text-slate-600'
                    }>
                      {surgeon.durationVsFacilityMinutes > 0 ? '+' : ''}{Math.round(surgeon.durationVsFacilityMinutes)} min
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={surgeon.profitImpact > 0 ? 'text-emerald-600' : surgeon.profitImpact < -50 ? 'text-red-500' : 'text-slate-600'}>
                      {surgeon.profitImpact > 0 ? '+' : ''}{formatCurrency(surgeon.profitImpact)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {surgeon.consistencyRating ? (
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        surgeon.consistencyRating === 'high' 
                          ? 'bg-emerald-100 text-emerald-700' 
                          : surgeon.consistencyRating === 'medium'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {surgeon.consistencyRating === 'high' ? '⚡ High' :
                         surgeon.consistencyRating === 'medium' ? '◐ Medium' : '◯ Low'}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
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
              <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Surgeons</th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Total Profit</th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Typical Profit</th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Typical Time</th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Margin</th>
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
                <td className="px-6 py-4 text-center text-slate-600">{proc.surgeonCount}</td>
                <td className="px-6 py-4 text-right font-semibold text-emerald-600">
                  {formatCurrency(proc.totalProfit)}
                </td>
                <td className="px-6 py-4 text-right text-slate-600">
                  {proc.medianProfit !== null 
                    ? formatCurrency(proc.medianProfit)
                    : formatCurrency(proc.avgProfit)
                  }
                </td>
                <td className="px-6 py-4 text-right text-slate-600">
                  {proc.medianDurationMinutes !== null 
                    ? `${Math.round(proc.medianDurationMinutes)} min`
                    : `${Math.round(proc.avgDurationMinutes)} min`
                  }
                </td>
                <td className="px-6 py-4 text-right text-slate-600">{formatPercent(proc.avgMarginPercent)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}