// components/analytics/financials/OverviewTab.tsx
// Overview tab for Financial Analytics — hero P&L, KPI sparklines,
// procedure/surgeon tables, profit trend chart

'use client'

import { useMemo, useState } from 'react'
import {
  ComposedChart,
  Bar,
  Area,
  XAxis,
  YAxis,
  Tooltip as ReTooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts'

import { EnrichedFinancialsMetrics, MonthlyTrendPoint, ProcedureStats, SurgeonStats } from './types'
import { formatCurrency, formatPercent, formatDuration, fmtK, fmt } from './utils'
import { AnimatedNumber, Sparkline, MicroBar, MarginDot, RankBadge } from './shared'

// ============================================
// PROPS
// ============================================

interface OverviewTabProps {
  metrics: EnrichedFinancialsMetrics
  monthlyTarget: number | null
  onProcedureClick: (procedureId: string) => void
  onSurgeonClick: (surgeonId: string) => void
}

// ============================================
// HELPERS
// ============================================

type SortDir = 'asc' | 'desc'

function computeTrend(values: number[]): { pct: string; up: boolean } | null {
  if (values.length < 2) return null
  const current = values[values.length - 1]
  const prev = values[values.length - 2]
  if (prev === 0) return null
  const change = ((current - prev) / Math.abs(prev)) * 100
  return {
    pct: `${change > 0 ? '+' : ''}${change.toFixed(1)}%`,
    up: change > 0,
  }
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function OverviewTab({
  metrics,
  monthlyTarget,
  onProcedureClick,
  onSurgeonClick,
}: OverviewTabProps) {
  // Prior period data from monthly trend
  const priorPeriod: MonthlyTrendPoint | null = useMemo(() => {
    if (metrics.monthlyTrend.length < 2) return null
    return metrics.monthlyTrend[metrics.monthlyTrend.length - 2]
  }, [metrics.monthlyTrend])

  // Profit trend comparison
  const profitTrendInfo = useMemo(() => {
    if (!priorPeriod || priorPeriod.totalProfit === 0) return null
    const pctChange = ((metrics.totalProfit - priorPeriod.totalProfit) / Math.abs(priorPeriod.totalProfit)) * 100
    return { pct: pctChange, up: pctChange > 0 }
  }, [metrics.totalProfit, priorPeriod])

  // Cost composition for revenue split bar
  const costComposition = useMemo(() => {
    const rev = metrics.totalReimbursement || 1
    const implants = metrics.totalDebits
    const other = metrics.totalCredits
    const orCost = metrics.totalORCost
    const profit = metrics.totalProfit
    return {
      implantPct: ((implants / rev) * 100).toFixed(1),
      otherPct: ((other / rev) * 100).toFixed(1),
      orPct: ((orCost / rev) * 100).toFixed(1),
      profitPct: ((Math.max(profit, 0) / rev) * 100).toFixed(1),
    }
  }, [metrics])

  // P&L line items for breakdown section
  const plLineItems = useMemo(() => {
    const totalCases = metrics.totalCases || 1
    const rev = metrics.totalReimbursement || 1
    const totalORHours = metrics.totalORMinutes / 60
    return [
      {
        label: 'Reimbursement',
        value: metrics.totalReimbursement,
        color: '#3b82f6',
        sub: `${formatCurrency(Math.round(metrics.totalReimbursement / totalCases))}/case avg`,
        prior: priorPeriod?.totalReimbursement ?? null,
        isRevenue: true,
      },
      {
        label: 'Implants & Supplies',
        value: -metrics.totalDebits,
        color: '#ef4444',
        sub: `${((metrics.totalDebits / rev) * 100).toFixed(1)}% of revenue`,
        prior: priorPeriod ? -priorPeriod.totalDebits : null,
        isRevenue: false,
      },
      {
        label: 'Other Costs',
        value: -metrics.totalCredits,
        color: '#f97316',
        sub: `${((metrics.totalCredits / rev) * 100).toFixed(1)}% of revenue`,
        prior: priorPeriod ? -priorPeriod.totalCredits : null,
        isRevenue: false,
      },
      {
        label: 'OR Time Cost',
        value: -metrics.totalORCost,
        color: '#f59e0b',
        sub: `${formatCurrency(metrics.orRate)}/hr × ${totalORHours.toFixed(1)} hrs`,
        prior: priorPeriod ? -priorPeriod.totalORCost : null,
        isRevenue: false,
      },
    ]
  }, [metrics, priorPeriod])

  // Period comparison metrics
  const periodComparison = useMemo(() => {
    if (!priorPeriod) return null
    const totalCosts = metrics.totalDebits - metrics.totalCredits + metrics.totalORCost
    const profitPerCase = metrics.totalCases > 0 ? metrics.totalProfit / metrics.totalCases : 0
    const priorProfitPerCase = priorPeriod.caseCount > 0 ? priorPeriod.totalProfit / priorPeriod.caseCount : 0
    return [
      { label: 'Revenue', current: metrics.totalReimbursement, prior: priorPeriod.totalReimbursement, prefix: '$', goodWhenUp: true },
      { label: 'Total Costs', current: totalCosts, prior: priorPeriod.totalCosts, prefix: '$', goodWhenUp: false },
      { label: 'Profit', current: metrics.totalProfit, prior: priorPeriod.totalProfit, prefix: '$', goodWhenUp: true },
      { label: 'Margin', current: metrics.avgMargin, prior: priorPeriod.marginPercent, suffix: '%', goodWhenUp: true },
      { label: 'Cases', current: metrics.totalCases, prior: priorPeriod.caseCount, goodWhenUp: true },
      { label: 'Profit/Case', current: profitPerCase, prior: priorProfitPerCase, prefix: '$', goodWhenUp: true },
    ]
  }, [metrics, priorPeriod])

  // Secondary KPI cards data
  const secondaryCards = useMemo(() => {
    const profitPerHourTrend = computeTrend(metrics.sparklines.profitPerHour)
    const marginTrend = computeTrend(metrics.sparklines.margin)
    const profitTrend = computeTrend(metrics.sparklines.profit)
    const volumeTrend = computeTrend(metrics.sparklines.volume)

    const priorProfitPerHour = priorPeriod?.profitPerORHour
    const priorMedianProfit = priorPeriod?.avgProfit

    return [
      {
        label: 'Profit / OR Hour',
        value: metrics.profitPerORHour !== null ? formatCurrency(metrics.profitPerORHour) : '—',
        trend: profitPerHourTrend,
        spark: metrics.sparklines.profitPerHour,
        color: '#3b82f6',
        detail: priorProfitPerHour != null ? `vs ${formatCurrency(Math.round(priorProfitPerHour))} last month` : undefined,
      },
      {
        label: 'Average Margin',
        value: formatPercent(metrics.avgMargin),
        trend: marginTrend,
        spark: metrics.sparklines.margin,
        color: '#8b5cf6',
        detail: monthlyTarget ? `Target: ${formatPercent((monthlyTarget / (metrics.totalReimbursement || 1)) * 100)}` : undefined,
      },
      {
        label: 'Median Profit / Case',
        value: formatCurrency(metrics.medianProfit ?? 0),
        trend: profitTrend,
        spark: metrics.sparklines.profit,
        color: '#0ea5e9',
        detail: priorMedianProfit != null ? `vs ${formatCurrency(Math.round(priorMedianProfit))} last month` : undefined,
      },
      {
        label: 'Total OR Hours',
        value: formatDuration(metrics.totalORMinutes),
        trend: volumeTrend,
        spark: metrics.sparklines.volume,
        color: '#6366f1',
        detail: `${metrics.totalCases} cases completed`,
      },
    ]
  }, [metrics, priorPeriod, monthlyTarget])

  // Cumulative profit trend for ComposedChart
  const chartData = useMemo(() => {
    let cumulative = 0
    return metrics.profitTrend.map(pt => {
      cumulative += pt.profit
      const [year, month, day] = pt.date.split('-').map(Number)
      const date = new Date(year, month - 1, day)
      const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      return { ...pt, daily: pt.profit, cumulative, label }
    })
  }, [metrics.profitTrend])

  // Max values for MicroBar scaling (guard empty arrays)
  const maxProcProfit = metrics.procedureStats.length > 0
    ? Math.max(...metrics.procedureStats.map(p => Math.abs(p.totalProfit)), 1)
    : 1
  const maxSurgeonProfit = metrics.surgeonStats.length > 0
    ? Math.max(...metrics.surgeonStats.map(s => s.totalProfit), 1)
    : 1

  // Target progress
  const targetProgress = monthlyTarget && monthlyTarget > 0
    ? Math.min((metrics.totalProfit / monthlyTarget) * 100, 100)
    : null

  const targetRemaining = monthlyTarget ? monthlyTarget - metrics.totalProfit : null

  // Estimate operating days remaining in the month
  const operatingDaysLeft = useMemo(() => {
    const today = new Date()
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    const daysRemaining = monthEnd.getDate() - today.getDate()
    return Math.max(Math.ceil(daysRemaining * 5 / 7), 1)
  }, [])

  // Max cumulative for chart scaling
  const maxCumulative = Math.max(
    ...chartData.map(d => d.cumulative),
    monthlyTarget ?? 0,
    1,
  )

  return (
    <div className="space-y-4">
      {/* Staggered fade-in keyframe */}
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* ==========================================
          HERO P&L CARD — v6 Design
          ========================================== */}
      <div
        className="bg-white rounded-xl border border-slate-200 shadow-sm mb-0"
        style={{ animation: 'fadeSlideIn 0.4s ease-out both' }}
      >
        <div className="p-6">
          <div className="grid grid-cols-12 gap-6">

            {/* Net Profit hero — col 1-3 */}
            <div className="col-span-3 border-r border-slate-100 pr-6">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">
                Net Profit
              </p>
              <div
                className={`text-4xl font-bold tracking-tight ${
                  metrics.totalProfit >= 0 ? 'text-emerald-600' : 'text-red-600'
                }`}
                style={{ fontFeatureSettings: "'tnum'" }}
              >
                {metrics.totalProfit < 0 && '('}
                <AnimatedNumber value={Math.abs(metrics.totalProfit)} />
                {metrics.totalProfit < 0 && ')'}
              </div>

              {profitTrendInfo && (
                <div className="flex items-center gap-3 mt-2">
                  <span
                    className={`inline-flex items-center gap-1 text-sm font-medium px-2 py-0.5 rounded-full ${
                      profitTrendInfo.up
                        ? 'text-emerald-700 bg-emerald-50'
                        : 'text-red-700 bg-red-50'
                    }`}
                  >
                    <TrendArrow up={profitTrendInfo.up} />
                    {profitTrendInfo.up ? '+' : ''}{profitTrendInfo.pct.toFixed(1)}%
                  </span>
                  <span className="text-xs text-slate-400">vs last month</span>
                </div>
              )}

              <div className="mt-3 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Margin</span>
                  <span className="font-semibold text-slate-700">{formatPercent(metrics.avgMargin)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Per Case</span>
                  <span className="font-semibold text-slate-700">
                    {formatCurrency(metrics.totalCases > 0 ? Math.round(metrics.totalProfit / metrics.totalCases) : 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Per OR Hour</span>
                  <span className="font-semibold text-blue-700">
                    {metrics.profitPerORHour !== null ? formatCurrency(Math.round(metrics.profitPerORHour)) : '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* P&L Breakdown — col 4-8 */}
            <div className="col-span-5 border-r border-slate-100 pr-6">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">P&L Breakdown</p>
                <p className="text-[10px] text-slate-400">{metrics.totalCases} cases</p>
              </div>
              <div className="space-y-2">
                {plLineItems.map((row, i) => {
                  const pctChange = row.prior !== null && row.prior !== 0
                    ? (((Math.abs(row.value) - Math.abs(row.prior)) / Math.abs(row.prior)) * 100)
                    : null
                  const changeIsGood = pctChange !== null
                    ? (row.isRevenue ? pctChange > 0 : pctChange < 0)
                    : null
                  return (
                    <div key={i} className="group">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: row.color }} />
                          <span className="text-sm text-slate-700">{row.label}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-sm font-semibold tabular-nums ${row.value < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                            {row.value < 0 ? `(${fmt(Math.abs(row.value))})` : fmt(row.value)}
                          </span>
                          {pctChange !== null && (
                            <span className={`text-[10px] font-medium tabular-nums ${
                              changeIsGood ? 'text-emerald-600' : 'text-red-500'
                            }`}>
                              {pctChange > 0 ? '+' : ''}{pctChange.toFixed(1)}%
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="ml-[18px] mt-1 flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${(Math.abs(row.value) / (metrics.totalReimbursement || 1)) * 100}%`,
                              backgroundColor: row.color,
                              opacity: 0.5,
                            }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-400 w-24 shrink-0">{row.sub}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Period comparison — col 9-12 */}
            <div className="col-span-4">
              {periodComparison ? (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">vs Prior Month</p>
                    <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                      {priorPeriod?.label} · {priorPeriod?.caseCount} cases
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {periodComparison.map((m, i) => {
                      const delta = m.suffix === '%'
                        ? m.current - m.prior
                        : m.prior !== 0 ? ((m.current - m.prior) / Math.abs(m.prior)) * 100 : 0
                      const positive = delta > 0
                      const good = m.goodWhenUp ? positive : !positive
                      return (
                        <div key={i} className="rounded-lg bg-slate-50/80 p-2.5 hover:bg-slate-100/80 transition-colors">
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider">{m.label}</p>
                          <div className="flex items-end justify-between mt-1">
                            <span className="text-sm font-bold text-slate-800 tabular-nums">
                              {m.prefix || ''}{typeof m.current === 'number' && Math.abs(m.current) >= 1000
                                ? Math.round(m.current).toLocaleString()
                                : m.suffix === '%' ? m.current.toFixed(1) : Math.round(m.current)}{m.suffix || ''}
                            </span>
                            <span className={`text-[10px] font-semibold tabular-nums ${
                              good ? 'text-emerald-600' : 'text-red-500'
                            }`}>
                              {positive ? '+' : ''}{delta.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-slate-400">
                  No prior period data available
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Revenue Split composition bar */}
        <div className="px-6 pb-5 pt-4 mt-2 border-t border-slate-100">
          <div className="flex items-center gap-4">
            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider shrink-0">Revenue Split</p>
            <div className="flex-1 flex items-center h-4 rounded-full overflow-hidden">
              <div
                className="h-full bg-red-400 transition-all duration-700 flex items-center justify-center"
                style={{ width: `${costComposition.implantPct}%` }}
              >
                <span className="text-[8px] font-bold text-white/80">{costComposition.implantPct}%</span>
              </div>
              <div
                className="h-full bg-orange-400 transition-all duration-700 flex items-center justify-center"
                style={{ width: `${costComposition.otherPct}%` }}
              >
                <span className="text-[8px] font-bold text-white/80">{costComposition.otherPct}%</span>
              </div>
              <div
                className="h-full bg-amber-400 transition-all duration-700 flex items-center justify-center"
                style={{ width: `${costComposition.orPct}%` }}
              >
                <span className="text-[8px] font-bold text-white/80">{costComposition.orPct}%</span>
              </div>
              <div
                className="h-full bg-emerald-500 transition-all duration-700 rounded-r-full flex items-center justify-center"
                style={{ width: `${costComposition.profitPct}%` }}
              >
                <span className="text-[8px] font-bold text-white/90">{costComposition.profitPct}%</span>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0 text-[10px] text-slate-400">
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-400" />Implants</span>
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-orange-400" />Other</span>
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" />OR</span>
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Profit</span>
            </div>
          </div>
        </div>
      </div>

      {/* ==========================================
          SECONDARY KPI CARDS
          ========================================== */}
      <div
        className="grid grid-cols-4 gap-3"
        style={{ animation: 'fadeSlideIn 0.4s ease-out 0.05s both' }}
      >
        {secondaryCards.map(card => (
          <div
            key={card.label}
            className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:border-slate-300 transition-all group"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-400 font-medium mb-1.5">{card.label}</p>
                <p className="text-xl font-semibold text-slate-900 tracking-tight">{card.value}</p>
              </div>
              {card.spark.length >= 2 && (
                <div className="ml-2 opacity-60 group-hover:opacity-100 transition-opacity">
                  <Sparkline data={card.spark} color={card.color} />
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 mt-2">
              {card.trend && (
                <span
                  className={`inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full ${
                    card.trend.up
                      ? 'text-emerald-700 bg-emerald-50'
                      : 'text-red-700 bg-red-50'
                  }`}
                >
                  <TrendArrow up={card.trend.up} />
                  {card.trend.pct}
                </span>
              )}
              {card.detail && (
                <span className="text-xs text-slate-400">{card.detail}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ==========================================
          TWO-COLUMN TABLES: PROCEDURES + SURGEONS
          ========================================== */}
      <div
        className="grid grid-cols-2 gap-4"
        style={{ animation: 'fadeSlideIn 0.4s ease-out 0.1s both' }}
      >
        <TopProceduresPanel
          procedures={metrics.procedureStats}
          maxProfit={maxProcProfit}
          onProcedureClick={onProcedureClick}
        />
        <TopSurgeonsPanel
          surgeons={metrics.surgeonStats}
          maxProfit={maxSurgeonProfit}
          onSurgeonClick={onSurgeonClick}
        />
      </div>

      {/* ==========================================
          PROFIT TREND CHART
          ========================================== */}
      {chartData.length >= 2 && (
        <div
          className="bg-white rounded-xl border border-slate-200 shadow-sm p-6"
          style={{ animation: 'fadeSlideIn 0.4s ease-out 0.15s both' }}
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Profit Trend</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Daily profit with cumulative trajectory
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-emerald-500 rounded-full" />
                Daily
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-blue-500 rounded-full" />
                Cumulative
              </span>
              {monthlyTarget && (
                <span className="flex items-center gap-1.5">
                  <span className="w-6 h-0 border-t border-dashed border-slate-300" />
                  Target
                </span>
              )}
            </div>
          </div>

          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartData}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="cumulativeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.12} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  dy={8}
                />
                <YAxis
                  yAxisId="left"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                  width={44}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                  domain={[0, Math.ceil(maxCumulative / 10000) * 10000]}
                  width={44}
                />
                <ReTooltip
                  contentStyle={{
                    background: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07)',
                    fontSize: '12px',
                  }}
                  formatter={(v: number | undefined, name: string | undefined) => [
                    v !== undefined ? `$${v.toLocaleString()}` : '$0',
                    name === 'daily' ? 'Daily' : 'Cumulative',
                  ]}
                />
                {monthlyTarget && (
                  <ReferenceLine
                    yAxisId="right"
                    y={monthlyTarget}
                    stroke="#94a3b8"
                    strokeDasharray="6 3"
                    strokeWidth={1}
                  />
                )}
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="cumulative"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#cumulativeGradient)"
                  dot={{ r: 3, fill: '#3b82f6', stroke: 'white', strokeWidth: 2 }}
                />
                <Bar yAxisId="left" dataKey="daily" radius={[4, 4, 0, 0]} maxBarSize={32}>
                  {chartData.map((d, i) => (
                    <Cell
                      key={`cell-${i}`}
                      fill={d.daily >= 0 ? '#10b981' : '#ef4444'}
                      opacity={0.75}
                    />
                  ))}
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Target progress bar */}
          {monthlyTarget && targetProgress !== null && targetRemaining !== null && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-500">Monthly target progress</span>
                <span className="text-xs font-medium text-slate-700 tabular-nums">
                  {formatCurrency(metrics.totalProfit)} / {formatCurrency(monthlyTarget)}{' '}
                  <span className="text-slate-400">
                    ({targetProgress.toFixed(1)}%)
                  </span>
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${targetProgress}%`,
                    background: 'linear-gradient(90deg, #3b82f6, #10b981)',
                  }}
                />
              </div>
              {targetRemaining > 0 && (
                <div className="flex justify-between mt-1.5">
                  <span className="text-[10px] text-slate-400">
                    {formatCurrency(targetRemaining)} remaining &middot;{' '}
                    ~{operatingDaysLeft} operating days left
                  </span>
                  <span className="text-[10px] text-slate-400">
                    ~{formatCurrency(Math.ceil(targetRemaining / operatingDaysLeft))}/day needed
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {chartData.length < 2 && (
        <div
          className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center"
          style={{ animation: 'fadeSlideIn 0.4s ease-out 0.15s both' }}
        >
          <p className="text-sm text-slate-400">
            Not enough data for the profit trend chart. More daily data points are needed.
          </p>
        </div>
      )}
    </div>
  )
}

// ============================================
// TOP PROCEDURES PANEL
// ============================================

function TopProceduresPanel({
  procedures,
  maxProfit,
  onProcedureClick,
}: {
  procedures: ProcedureStats[]
  maxProfit: number
  onProcedureClick: (id: string) => void
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="px-5 py-4 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-900">Top Procedures</h3>
      </div>
      <div className="divide-y divide-slate-50">
        {/* Header */}
        <div className="grid grid-cols-12 px-5 py-2.5 text-[10px] font-medium text-slate-400 uppercase tracking-wider">
          <div className="col-span-4">Procedure</div>
          <div className="col-span-1 text-center">Cases</div>
          <div className="col-span-3">Profit</div>
          <div className="col-span-2 text-right">$/OR Hr</div>
          <div className="col-span-2 text-right">Margin</div>
        </div>
        {/* Rows */}
        {procedures.length === 0 && (
          <div className="px-5 py-8 text-center text-sm text-slate-400">
            No procedure data for the selected period
          </div>
        )}
        {procedures.slice(0, 8).map(proc => {
          const loss = proc.totalProfit < 0
          return (
            <div
              key={proc.procedureId}
              onClick={() => onProcedureClick(proc.procedureId)}
              className={`grid grid-cols-12 items-center px-5 py-3 hover:bg-slate-50/80 transition-colors cursor-pointer group ${
                loss ? 'bg-red-50/30' : ''
              }`}
              style={loss ? { borderLeft: '3px solid #fca5a5' } : { borderLeft: '3px solid transparent' }}
            >
              <div className="col-span-4">
                <span className="text-sm font-medium text-slate-800 group-hover:text-blue-600 transition-colors">
                  {proc.procedureName}
                </span>
                <span className="text-[10px] text-slate-400 ml-1.5">
                  {proc.surgeonCount}s
                </span>
              </div>
              <div className="col-span-1 text-center text-sm text-slate-600 tabular-nums">
                {proc.caseCount}
              </div>
              <div className="col-span-3">
                <MicroBar
                  value={proc.totalProfit}
                  max={maxProfit}
                  color={loss ? '#ef4444' : '#10b981'}
                />
              </div>
              <div
                className={`col-span-2 text-right text-sm tabular-nums ${
                  loss ? 'text-red-500' : 'text-slate-600'
                }`}
              >
                {proc.profitPerORHour !== null
                  ? proc.profitPerORHour < 0
                    ? `(${formatCurrency(Math.abs(proc.profitPerORHour))})`
                    : formatCurrency(proc.profitPerORHour)
                  : '—'}
              </div>
              <div className="col-span-2 text-right">
                <MarginDot margin={proc.avgMarginPercent} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ============================================
// TOP SURGEONS PANEL
// ============================================

function TopSurgeonsPanel({
  surgeons,
  maxProfit,
  onSurgeonClick,
}: {
  surgeons: SurgeonStats[]
  maxProfit: number
  onSurgeonClick: (id: string) => void
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="px-5 py-4 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-900">Top Surgeons</h3>
      </div>
      <div className="divide-y divide-slate-50">
        {/* Header */}
        <div className="grid grid-cols-12 px-5 py-2.5 text-[10px] font-medium text-slate-400 uppercase tracking-wider">
          <div className="col-span-4">Surgeon</div>
          <div className="col-span-1 text-center">Cases</div>
          <div className="col-span-3">Profit</div>
          <div className="col-span-2 text-right">$/OR Hr</div>
          <div className="col-span-2 text-right">Margin</div>
        </div>
        {/* Rows */}
        {surgeons.length === 0 && (
          <div className="px-5 py-8 text-center text-sm text-slate-400">
            No surgeon data for the selected period
          </div>
        )}
        {surgeons.slice(0, 8).map((surgeon, idx) => (
          <div
            key={surgeon.surgeonId}
            onClick={() => onSurgeonClick(surgeon.surgeonId)}
            className="grid grid-cols-12 items-center px-5 py-3 hover:bg-slate-50/80 transition-colors cursor-pointer group"
            style={{ borderLeft: '3px solid transparent' }}
          >
            <div className="col-span-4 flex items-center gap-2.5">
              <RankBadge rank={idx + 1} />
              <div>
                <span className="text-sm font-medium text-slate-800 group-hover:text-blue-600 transition-colors">
                  {surgeon.surgeonName}
                </span>
                {surgeon.caseCount < 10 && (
                  <span className="ml-1.5 text-[9px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                    Low vol
                  </span>
                )}
              </div>
            </div>
            <div className="col-span-1 text-center text-sm text-slate-600 tabular-nums">
              {surgeon.caseCount}
            </div>
            <div className="col-span-3">
              <MicroBar value={surgeon.totalProfit} max={maxProfit} color="#3b82f6" />
            </div>
            <div className="col-span-2 text-right text-sm text-slate-600 tabular-nums">
              {surgeon.profitPerORHour !== null
                ? formatCurrency(surgeon.profitPerORHour)
                : '—'}
            </div>
            <div className="col-span-2 text-right">
              <MarginDot margin={surgeon.avgMarginPercent} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================
// TREND ARROW — small inline SVG
// ============================================

function TrendArrow({ up }: { up: boolean }) {
  return (
    <svg
      className={`w-2.5 h-2.5 ${up ? '' : 'rotate-180'}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25"
      />
    </svg>
  )
}

