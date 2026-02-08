'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { FinancialsMetrics } from './types'
import { formatCurrency, formatPercent } from './utils'
import MetricCard from './MetricCard'
import { InformationCircleIcon } from '@heroicons/react/24/outline'

interface OverviewTabProps {
  metrics: FinancialsMetrics
  onProcedureClick: (procedureId: string) => void
  onSurgeonClick: (surgeonId: string) => void
}

export default function OverviewTab({ 
  metrics, 
  onProcedureClick, 
  onSurgeonClick,
}: OverviewTabProps) {
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Profit"
          value={formatCurrency(metrics.totalProfit)}
          subtitle={`${metrics.totalCases} cases`}
          variant="success"
        />
        
        {/* Updated: Show Typical (median) as primary */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-1 mb-1">
            <p className="text-sm font-medium text-slate-500">Typical Profit / Case</p>
            <div className="group relative">
              <InformationCircleIcon className="w-4 h-4 text-slate-400 cursor-help" />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                Median value - represents the typical case
                <br />
                <span className="text-slate-400">Average: {formatCurrency(metrics.avgProfit)}</span>
              </div>
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900">
            {metrics.medianProfit !== null ? formatCurrency(metrics.medianProfit) : '—'}
          </p>
          {metrics.profitRange.p25 !== null && metrics.profitRange.p75 !== null && (
            <p className="text-xs text-slate-500 mt-1">
              Range: {formatCurrency(metrics.profitRange.p25)} – {formatCurrency(metrics.profitRange.p75)}
            </p>
          )}
        </div>

        <MetricCard
          title="Avg Margin"
          value={formatPercent(metrics.avgMargin)}
        />

        <MetricCard
          title="Typical Duration"
          value={metrics.medianDuration !== null ? `${Math.round(metrics.medianDuration)} min` : '—'}
          subtitle={`Avg: ${Math.round(metrics.avgDuration)} min`}
        />
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Procedures - Updated with median */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Top Procedures by Profit</h3>
          <div className="space-y-3">
            {metrics.procedureStats.slice(0, 5).map(proc => (
              <div 
                key={proc.procedureId}
                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors"
                onClick={() => onProcedureClick(proc.procedureId)}
              >
                <div>
                  <p className="font-medium text-slate-900">{proc.procedureName}</p>
                  <p className="text-sm text-slate-500">{proc.caseCount} cases • {proc.surgeonCount} surgeons</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-emerald-600">{formatCurrency(proc.totalProfit)}</p>
                  <p className="text-sm text-slate-500">
                    {proc.medianProfit !== null ? (
                      <>typical {formatCurrency(proc.medianProfit)}</>
                    ) : (
                      <>avg {formatCurrency(proc.avgProfit)}</>
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Surgeons - Updated with median */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Top Surgeons by Profit</h3>
          <div className="space-y-3">
            {metrics.surgeonStats.slice(0, 5).map(surgeon => (
              <div 
                key={surgeon.surgeonId}
                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors"
                onClick={() => onSurgeonClick(surgeon.surgeonId)}
              >
                <div>
                  <p className="font-medium text-slate-900">{surgeon.surgeonName}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-slate-500">{surgeon.caseCount} cases</p>
                    {surgeon.consistencyRating && (
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
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
                <div className="text-right">
                  <p className="font-semibold text-emerald-600">{formatCurrency(surgeon.totalProfit)}</p>
                  <p className="text-sm text-slate-500">
                    {surgeon.medianProfit !== null ? (
                      <>typical {formatCurrency(surgeon.medianProfit)}</>
                    ) : (
                      <>avg {formatCurrency(surgeon.avgProfit)}</>
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Time = Money Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200 p-6">
          <p className="text-sm font-medium text-blue-600 mb-1">OR Cost per Minute</p>
          <p className="text-3xl font-bold text-blue-900">{formatCurrency(metrics.costPerMinute)}</p>
          <p className="text-sm text-blue-600 mt-2">Based on {formatCurrency(metrics.orRate)}/hr</p>
        </div>
        <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl border border-amber-200 p-6">
          <div className="flex items-center gap-1 mb-1">
            <p className="text-sm font-medium text-amber-600">Excess Time Cost</p>
            <div className="group relative">
              <InformationCircleIcon className="w-4 h-4 text-amber-500 cursor-help" />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                Cost of time above typical (median) duration
                <br />
                for each procedure type
              </div>
            </div>
          </div>
          <p className="text-3xl font-bold text-amber-900">{formatCurrency(metrics.excessTimeCost)}</p>
          <p className="text-sm text-amber-600 mt-2">Time above typical durations</p>
        </div>
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl border border-emerald-200 p-6">
          <p className="text-sm font-medium text-emerald-600 mb-1">10-Min Savings Value</p>
          <p className="text-3xl font-bold text-emerald-900">{formatCurrency(metrics.costPerMinute * 10)}</p>
          <p className="text-sm text-emerald-600 mt-2">Potential savings per case</p>
        </div>
      </div>

      {/* Profit Trend Chart */}
      {metrics.profitTrend.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Profit Trend</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={metrics.profitTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis 
                dataKey="date" 
                stroke="#334155" 
                fontSize={12}
                tickFormatter={(date) => {
                  const [y, m, d] = date.split('-').map(Number)
                  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                }}
              />
              <YAxis 
                stroke="#334155" 
                fontSize={12}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              />
<Tooltip 
  formatter={(value: any, name?: string) => {
    if (value === undefined || value === null) return '—'
    if (name === 'Typical Profit') return formatCurrency(value)
    return `${Math.round(value)} min`
  }}
                labelFormatter={(date) => {
                  const [y, m, d] = (date as string).split('-').map(Number)
                  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
                }}
              />
              <Line 
                type="monotone" 
                dataKey="profit" 
                stroke="#10b981" 
                strokeWidth={2}
                dot={{ fill: '#10b981', r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}