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

import { EnrichedFinancialsMetrics, ProcedureStats, SurgeonStats } from './types'
import { formatCurrency, formatPercent, formatDuration, fmtK } from './utils'
import { AnimatedNumber, Sparkline, MicroBar, MarginDot, RankBadge } from './shared'
import { WaterfallChart } from './WaterfallChart'

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
  // Profit trend comparison
  const profitTrendInfo = useMemo(() => {
    if (metrics.monthlyTrend.length < 2) return null
    const current = metrics.monthlyTrend[metrics.monthlyTrend.length - 1]
    const prev = metrics.monthlyTrend[metrics.monthlyTrend.length - 2]
    if (prev.totalProfit === 0) return null
    const pctChange = ((current.totalProfit - prev.totalProfit) / Math.abs(prev.totalProfit)) * 100
    return { pct: pctChange, up: pctChange > 0 }
  }, [metrics.monthlyTrend])

  // Secondary KPI cards data
  const secondaryCards = useMemo(() => {
    const profitPerHourTrend = computeTrend(metrics.sparklines.profitPerHour)
    const marginTrend = computeTrend(metrics.sparklines.margin)
    const profitTrend = computeTrend(metrics.sparklines.profit)
    const volumeTrend = computeTrend(metrics.sparklines.volume)

    return [
      {
        label: 'Profit / OR Hour',
        value: metrics.profitPerORHour !== null ? formatCurrency(metrics.profitPerORHour) : '—',
        trend: profitPerHourTrend,
        spark: metrics.sparklines.profitPerHour,
        color: '#3b82f6',
      },
      {
        label: 'Average Margin',
        value: formatPercent(metrics.avgMargin),
        trend: marginTrend,
        spark: metrics.sparklines.margin,
        color: '#8b5cf6',
      },
      {
        label: 'Median Profit / Case',
        value: formatCurrency(metrics.medianProfit ?? 0),
        trend: profitTrend,
        spark: metrics.sparklines.profit,
        color: '#0ea5e9',
      },
      {
        label: 'Total OR Hours',
        value: formatDuration(metrics.totalORMinutes),
        trend: volumeTrend,
        spark: metrics.sparklines.volume,
        color: '#6366f1',
      },
    ]
  }, [metrics])

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

  // Max values for MicroBar scaling
  const maxProcProfit = Math.max(...metrics.procedureStats.map(p => Math.abs(p.totalProfit)), 1)
  const maxSurgeonProfit = Math.max(...metrics.surgeonStats.map(s => s.totalProfit), 1)

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
      {/* ==========================================
          HERO P&L CARD
          ========================================== */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="grid grid-cols-12 gap-6 items-center">
          {/* Left: Net Profit */}
          <div className="col-span-4 border-r border-slate-100 pr-6">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">
              Net Profit
            </p>
            <div
              className={`text-4xl font-bold tracking-tight ${
                metrics.totalProfit >= 0 ? 'text-emerald-600' : 'text-red-600'
              }`}
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

            <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
              <span>{formatPercent(metrics.avgMargin)} margin</span>
              <span className="text-slate-200">&middot;</span>
              <span>
                {formatCurrency(
                  metrics.totalCases > 0 ? metrics.totalProfit / metrics.totalCases : 0
                )}
                /case
              </span>
            </div>
          </div>

          {/* Right: Waterfall */}
          <div className="col-span-8">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Revenue &rarr; Profit Flow
              </p>
              <WaterfallLegend credits={metrics.totalCredits} />
            </div>
            <WaterfallChart
              revenue={metrics.totalReimbursement}
              debits={metrics.totalDebits}
              credits={metrics.totalCredits}
              orCost={metrics.totalORCost}
              profit={metrics.totalProfit}
            />
          </div>
        </div>
      </div>

      {/* ==========================================
          SECONDARY KPI CARDS
          ========================================== */}
      <div className="grid grid-cols-4 gap-3">
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
            {card.trend && (
              <div className="flex items-center gap-2 mt-2">
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
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ==========================================
          TWO-COLUMN TABLES: PROCEDURES + SURGEONS
          ========================================== */}
      <div className="grid grid-cols-2 gap-4">
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
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
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

// ============================================
// WATERFALL LEGEND
// ============================================

function WaterfallLegend({ credits }: { credits: number }) {
  const items: [string, string][] = [
    ['Revenue', 'bg-blue-500'],
    ['Implants', 'bg-red-500'],
  ]
  if (credits > 0) {
    items.push(['Credits', 'bg-green-500'])
  }
  items.push(['OR Cost', 'bg-amber-500'], ['Profit', 'bg-emerald-500'])

  return (
    <div className="flex items-center gap-3 text-[10px] text-slate-400">
      {items.map(([label, bg]) => (
        <span key={label} className="flex items-center gap-1">
          <span className={`w-2 h-2 rounded-sm ${bg}`} />
          {label}
        </span>
      ))}
    </div>
  )
}
