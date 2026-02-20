// components/analytics/financials/ProcedureDetail.tsx
// Full procedure detail layout matching orbit-procedure-detail.jsx mockup
// 7 sections: KPI cards, trend chart, profit distribution, case economics,
// payer mix, surgeon breakdown, recent cases with expandable rows

'use client'

import { useState, useMemo } from 'react'
import {
  ComposedChart,
  Bar,
  Area,
  Line,
  BarChart,
  XAxis,
  YAxis,
  Tooltip as ReTooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
  CartesianGrid,
} from 'recharts'
import { ChevronRight } from 'lucide-react'

import {
  ProcedureStats,
  CaseCompletionStats,
  PayerMixEntry,
  ProfitBin,
  SortDir,
} from './types'
import {
  formatCurrency,
  formatPercent,
  fmt,
  normalizeJoin,
  median,
  percentile,
} from './utils'
import {
  Sparkline,
  ComparisonPill,
  ConsistencyBadge,
  InfoTip,
  SortTH,
  MarginBadge,
} from './shared'
import { CaseEconomicsCard } from './CaseEconomicsCard'
import { PayerMixCard } from './PayerMixCard'

// ============================================
// PROPS
// ============================================

interface ProcedureDetailProps {
  procedure: ProcedureStats
  cases: CaseCompletionStats[]
  onBack: () => void
}

// ============================================
// HELPERS — payer mix / bins / monthly trend
// ============================================

function computeProcedurePayerMix(cases: CaseCompletionStats[]): PayerMixEntry[] {
  const payerMap = new Map<string, { payerName: string; cases: CaseCompletionStats[] }>()

  cases.forEach(c => {
    const payer = normalizeJoin(c.payers)
    const payerId = c.payer_id || 'unknown'
    const payerName = payer?.name || 'Unknown Payer'

    const existing = payerMap.get(payerId)
    if (existing) {
      existing.cases.push(c)
    } else {
      payerMap.set(payerId, { payerName, cases: [c] })
    }
  })

  const totalCases = cases.length

  return Array.from(payerMap.entries())
    .map(([payerId, { payerName, cases: payerCases }]) => {
      const totalReimbursement = payerCases.reduce((sum, c) => sum + (c.reimbursement || 0), 0)
      const totalProfit = payerCases.reduce((sum, c) => sum + (c.profit || 0), 0)

      return {
        payerId,
        payerName,
        caseCount: payerCases.length,
        totalReimbursement,
        avgReimbursement: payerCases.length > 0 ? totalReimbursement / payerCases.length : 0,
        totalProfit,
        avgProfit: payerCases.length > 0 ? totalProfit / payerCases.length : 0,
        marginPercent: totalReimbursement > 0 ? (totalProfit / totalReimbursement) * 100 : 0,
        pctOfCases: totalCases > 0 ? (payerCases.length / totalCases) * 100 : 0,
      }
    })
    .sort((a, b) => b.caseCount - a.caseCount)
}

function computeProcedureProfitBins(cases: CaseCompletionStats[]): ProfitBin[] {
  const profits = cases.map(c => c.profit || 0)
  if (profits.length === 0) return []

  const min = Math.min(...profits)
  const max = Math.max(...profits)
  const binStart = Math.floor(min / 500) * 500
  const binEnd = Math.ceil(max / 500) * 500
  const binWidth = 500

  const bins: ProfitBin[] = []
  for (let start = binStart; start < binEnd; start += binWidth) {
    const end = start + binWidth
    const count = profits.filter(p => p >= start && p < end).length

    const fmtVal = (v: number) => {
      const abs = Math.abs(v)
      if (abs >= 1000) return `${v < 0 ? '-' : ''}$${(abs / 1000).toFixed(abs % 1000 === 0 ? 0 : 1)}k`
      return `${v < 0 ? '-' : ''}$${abs}`
    }

    bins.push({
      rangeLabel: `${fmtVal(start)}\u2013${fmtVal(end)}`,
      min: start,
      max: end,
      count,
    })
  }

  return bins
}

interface MonthlyPoint {
  label: string
  cases: number
  profit: number
  avgProfit: number
}

function computeProcedureMonthlyTrend(cases: CaseCompletionStats[]): MonthlyPoint[] {
  const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const monthMap = new Map<string, CaseCompletionStats[]>()

  cases.forEach(c => {
    const d = new Date(c.case_date)
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`
    const existing = monthMap.get(key) || []
    existing.push(c)
    monthMap.set(key, existing)
  })

  return Array.from(monthMap.entries())
    .map(([key, monthCases]) => {
      const [, monthStr] = key.split('-')
      const month = parseInt(monthStr, 10)
      const profits = monthCases.map(c => c.profit || 0)
      const totalProfit = profits.reduce((a, b) => a + b, 0)

      return {
        label: monthLabels[month - 1],
        cases: monthCases.length,
        profit: totalProfit,
        avgProfit: monthCases.length > 0 ? totalProfit / monthCases.length : 0,
        _sortKey: key,
      }
    })
    .sort((a, b) => a._sortKey.localeCompare(b._sortKey))
    .slice(-6)
    .map(({ _sortKey: _, ...rest }) => rest)
}

function getCaseDebits(c: CaseCompletionStats): number {
  return c.total_debits ?? c.soft_goods_cost ?? 0
}

function getCaseCredits(c: CaseCompletionStats): number {
  return c.total_credits ?? c.hard_goods_cost ?? 0
}

function getCaseORCost(c: CaseCompletionStats): number {
  return c.or_time_cost ?? c.or_cost ?? 0
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function ProcedureDetail({
  procedure: proc,
  cases,
  onBack,
}: ProcedureDetailProps) {
  // Compute procedure-specific data
  const payerMix = useMemo(() => computeProcedurePayerMix(cases), [cases])
  const profitBins = useMemo(() => computeProcedureProfitBins(cases), [cases])
  const monthlyTrend = useMemo(() => computeProcedureMonthlyTrend(cases), [cases])

  // Sparkline arrays from monthly trend
  const sparklines = useMemo(() => {
    const profits = cases.map(c => c.profit || 0)
    const durations = cases.map(c => c.total_duration_minutes || 0).filter(d => d > 0)

    return {
      profit: monthlyTrend.map(m => m.profit),
      margin: monthlyTrend.map(m => {
        const monthCases = cases.filter(c => {
          const d = new Date(c.case_date)
          const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
          return monthLabels[d.getMonth()] === m.label
        })
        const reimb = monthCases.reduce((s, c) => s + (c.reimbursement || 0), 0)
        const prof = monthCases.reduce((s, c) => s + (c.profit || 0), 0)
        return reimb > 0 ? (prof / reimb) * 100 : 0
      }),
      duration: monthlyTrend.map(() => {
        // Use overall median as sparkline points
        return median(durations) ?? 0
      }),
      perHour: monthlyTrend.map(m => {
        const totalMin = cases
          .filter(c => {
            const d = new Date(c.case_date)
            const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
            return monthLabels[d.getMonth()] === m.label
          })
          .reduce((s, c) => s + (c.total_duration_minutes || 0), 0)
        const hrs = totalMin / 60
        return hrs > 0 ? m.profit / hrs : 0
      }),
    }
  }, [cases, monthlyTrend])

  // Profit stats for distribution summary
  const profitStats = useMemo(() => {
    const profits = cases.map(c => c.profit || 0)
    return {
      min: profits.length > 0 ? Math.min(...profits) : 0,
      median: median(profits) ?? 0,
      max: profits.length > 0 ? Math.max(...profits) : 0,
    }
  }, [cases])

  // Average case economics
  const economics = useMemo(() => {
    const n = cases.length || 1
    return {
      avgReimbursement: cases.reduce((s, c) => s + (c.reimbursement || 0), 0) / n,
      avgDebits: cases.reduce((s, c) => s + getCaseDebits(c), 0) / n,
      avgCredits: cases.reduce((s, c) => s + getCaseCredits(c), 0) / n,
      avgORCost: cases.reduce((s, c) => s + getCaseORCost(c), 0) / n,
      avgProfit: proc.totalProfit / n,
    }
  }, [cases, proc.totalProfit])

  // Trend calculations
  const profitTrend = useMemo(() => {
    if (sparklines.profit.length < 2) return null
    const curr = sparklines.profit[sparklines.profit.length - 1]
    const prev = sparklines.profit[sparklines.profit.length - 2]
    if (prev === 0) return null
    const pct = ((curr - prev) / Math.abs(prev)) * 100
    return { pct: `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`, up: pct > 0 }
  }, [sparklines.profit])

  const loss = proc.totalProfit < 0

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm mb-1">
        <button
          onClick={onBack}
          className="text-slate-500 hover:text-blue-600 font-medium transition-colors"
        >
          All Procedures
        </button>
        <ChevronRight className="w-4 h-4 text-slate-400" />
        <span className="text-slate-900 font-medium">{proc.procedureName}</span>
      </nav>

      {/* ================================================
          SECTION 1: KPI CARDS
          ================================================ */}
      <div className="grid grid-cols-5 gap-3">
        {/* Total Profit — hero card */}
        <div
          className={`rounded-xl border p-4 ${
            loss ? 'bg-red-50 border-red-200' : 'bg-emerald-50/70 border-emerald-200'
          }`}
        >
          <p className={`text-xs font-medium mb-1.5 ${loss ? 'text-red-500' : 'text-emerald-600'}`}>
            Total Profit
          </p>
          <div className="flex items-start justify-between">
            <div>
              <p
                className={`text-2xl font-bold tracking-tight ${
                  loss ? 'text-red-600' : 'text-emerald-700'
                }`}
              >
                {formatCurrency(proc.totalProfit)}
              </p>
              {profitTrend && (
                <div className="flex items-center gap-2 mt-1.5">
                  <span
                    className={`inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full ${
                      profitTrend.up
                        ? 'text-emerald-700 bg-emerald-100/80'
                        : 'text-red-700 bg-red-100/80'
                    }`}
                  >
                    <TrendArrow up={profitTrend.up} />
                    {profitTrend.pct}
                  </span>
                  <span className="text-[10px] text-slate-400">vs last month</span>
                </div>
              )}
            </div>
            {sparklines.profit.length >= 2 && (
              <Sparkline data={sparklines.profit} color={loss ? '#ef4444' : '#10b981'} />
            )}
          </div>
        </div>

        {/* Median Profit */}
        <KPICard
          label="Median Profit"
          value={formatCurrency(proc.medianProfit ?? proc.avgProfit)}
          tooltip={`Avg: ${formatCurrency(proc.avgProfit)} · IQR: ${formatCurrency(proc.profitRange.p25)}–${formatCurrency(proc.profitRange.p75)}`}
          sub={
            proc.profitRange.p25 !== null && proc.profitRange.p75 !== null
              ? `IQR: ${formatCurrency(proc.profitRange.p25)}–${formatCurrency(proc.profitRange.p75)}`
              : undefined
          }
          spark={sparklines.profit}
          sparkColor="#6366f1"
        />

        {/* Typical Duration */}
        <KPICard
          label="Typical Duration"
          value={`${Math.round(proc.medianDurationMinutes ?? proc.avgDurationMinutes)} min`}
          tooltip={`Avg: ${Math.round(proc.avgDurationMinutes)} min · IQR: ${Math.round(proc.durationRange.p25 ?? 0)}–${Math.round(proc.durationRange.p75 ?? 0)} min`}
          sub={
            proc.durationRange.p25 !== null && proc.durationRange.p75 !== null
              ? `${Math.round(proc.durationRange.p25)}–${Math.round(proc.durationRange.p75)} min`
              : undefined
          }
          spark={sparklines.duration}
          sparkColor="#0ea5e9"
        />

        {/* Margin */}
        <KPICard
          label="Margin"
          value={formatPercent(proc.avgMarginPercent)}
          spark={sparklines.margin}
          sparkColor="#8b5cf6"
        />

        {/* $/OR Hour */}
        <div className="bg-white rounded-xl border border-blue-200 ring-1 ring-blue-100 shadow-sm p-4 hover:border-blue-300 transition-all group">
          <div className="flex items-center gap-1 mb-1.5">
            <p className="text-xs text-blue-500 font-medium">$/OR Hour</p>
          </div>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xl font-semibold text-blue-700 tracking-tight">
                {proc.profitPerORHour !== null
                  ? formatCurrency(proc.profitPerORHour)
                  : '—'}
              </p>
              <p className="text-[10px] text-slate-400 mt-1.5">
                {proc.caseCount} cases · {proc.surgeonCount} surgeons
              </p>
            </div>
            {sparklines.perHour.length >= 2 && (
              <div className="opacity-60 group-hover:opacity-100 transition-opacity">
                <Sparkline data={sparklines.perHour} color="#3b82f6" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ================================================
          SECTION 2 & 3: TREND + DISTRIBUTION (side by side)
          ================================================ */}
      <div className="grid grid-cols-3 gap-4">
        {/* Volume & Profit Trend (2 cols) */}
        <div className="col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Volume & Profit Trend</h3>
              <p className="text-xs text-slate-400 mt-0.5">Monthly case volume and total profit</p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-2 bg-emerald-500/70 rounded-sm" />
                Profit
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-blue-500 rounded-full" />
                Avg/Case
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-5 h-3 bg-slate-200/60 rounded-sm text-[8px] text-slate-400 flex items-center justify-center">
                  n
                </span>
                Volume
              </span>
            </div>
          </div>
          {monthlyTrend.length >= 2 ? (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={monthlyTrend}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="procProfitGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
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
                    domain={[0, 'auto']}
                    width={28}
                  />
                  <ReTooltip
                    contentStyle={{
                      background: 'white',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07)',
                      fontSize: '12px',
                    }}
                    formatter={(v: number | undefined, n: string | undefined) => [
                      n === 'cases'
                        ? `${v ?? 0} cases`
                        : `$${(v ?? 0).toLocaleString()}`,
                      n === 'cases' ? 'Volume' : n === 'profit' ? 'Total Profit' : 'Avg/Case',
                    ]}
                  />
                  <Bar
                    yAxisId="right"
                    dataKey="cases"
                    fill="#e2e8f0"
                    radius={[3, 3, 0, 0]}
                    maxBarSize={28}
                  />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="profit"
                    stroke="#10b981"
                    strokeWidth={2}
                    fill="url(#procProfitGrad)"
                    dot={{ r: 3, fill: '#10b981', stroke: 'white', strokeWidth: 2 }}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="avgProfit"
                    stroke="#3b82f6"
                    strokeWidth={1.5}
                    strokeDasharray="4 2"
                    dot={{ r: 2.5, fill: '#3b82f6', stroke: 'white', strokeWidth: 1.5 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-52 flex items-center justify-center text-sm text-slate-400">
              Not enough data for trend chart
            </div>
          )}
        </div>

        {/* Profit Distribution (1 col) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-900">Profit Distribution</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Per-case profit spread across {proc.caseCount} cases
            </p>
          </div>
          {profitBins.length > 0 ? (
            <>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={profitBins}
                    margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#f1f5f9"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="rangeLabel"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 9, fill: '#94a3b8' }}
                      dy={4}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      allowDecimals={false}
                      width={20}
                    />
                    <ReTooltip
                      contentStyle={{
                        background: 'white',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                      formatter={(v: number | undefined) => [`${v ?? 0} cases`, 'Count']}
                    />
                    <ReferenceLine y={0} stroke="#e2e8f0" />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={32}>
                      {profitBins.map((b, i) => (
                        <Cell
                          key={`bin-${i}`}
                          fill={b.count === 0 ? '#f1f5f9' : b.min < 0 ? '#ef4444' : '#10b981'}
                          opacity={b.count === 0 ? 0.5 : 0.7}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {/* Distribution summary */}
              <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase">Min</p>
                  <p className="text-sm font-semibold text-slate-700 tabular-nums">
                    {formatCurrency(profitStats.min)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase">Median</p>
                  <p className="text-sm font-semibold text-emerald-600 tabular-nums">
                    {formatCurrency(profitStats.median)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase">Max</p>
                  <p className="text-sm font-semibold text-slate-700 tabular-nums">
                    {formatCurrency(profitStats.max)}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="h-52 flex items-center justify-center text-sm text-slate-400">
              No profit data
            </div>
          )}
        </div>
      </div>

      {/* ================================================
          SECTION 4 & 5: CASE ECONOMICS + PAYER MIX
          ================================================ */}
      <div className="grid grid-cols-2 gap-4">
        <CaseEconomicsCard
          avgReimbursement={economics.avgReimbursement}
          avgDebits={economics.avgDebits}
          avgCredits={economics.avgCredits}
          avgORCost={economics.avgORCost}
          avgProfit={economics.avgProfit}
        />
        <PayerMixCard
          payerMix={payerMix}
          subtitle={`Reimbursement and margin by payer for ${proc.procedureName}`}
        />
      </div>

      {/* ================================================
          SECTION 6: SURGEON BREAKDOWN TABLE
          ================================================ */}
      <SurgeonBreakdownTable procedure={proc} />

      {/* ================================================
          SECTION 7: RECENT CASES TABLE
          ================================================ */}
      <RecentCasesTable
        cases={cases}
        medianProfit={proc.medianProfit ?? proc.avgProfit}
        medianDuration={proc.medianDurationMinutes ?? proc.avgDurationMinutes}
        procedureName={proc.procedureName}
      />
    </div>
  )
}

// ============================================
// KPI CARD — secondary KPI card with sparkline
// ============================================

function KPICard({
  label,
  value,
  tooltip,
  sub,
  spark,
  sparkColor,
}: {
  label: string
  value: string
  tooltip?: string
  sub?: string
  spark: number[]
  sparkColor: string
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:border-slate-300 transition-all group">
      <div className="flex items-center gap-1 mb-1.5">
        <p className="text-xs text-slate-400 font-medium">{label}</p>
        {tooltip && <InfoTip text={tooltip} />}
      </div>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xl font-semibold text-slate-900 tracking-tight">{value}</p>
          {sub && <p className="text-[10px] text-slate-400 mt-1.5">{sub}</p>}
        </div>
        {spark.length >= 2 && (
          <div className="opacity-60 group-hover:opacity-100 transition-opacity">
            <Sparkline data={spark} color={sparkColor} />
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================
// SURGEON BREAKDOWN TABLE
// ============================================

type SurgeonSortKey =
  | 'totalProfit'
  | 'caseCount'
  | 'medianDurationMinutes'
  | 'profitPerORHour'
  | 'durationVsFacilityMinutes'

function SurgeonBreakdownTable({ procedure: proc }: { procedure: ProcedureStats }) {
  const [sortKey, setSortKey] = useState<SurgeonSortKey>('totalProfit')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const sorted = useMemo(() => {
    return [...proc.surgeonBreakdown].sort((a, b) => {
      const getVal = (s: typeof a) => {
        switch (sortKey) {
          case 'totalProfit': return s.totalProfit
          case 'caseCount': return s.caseCount
          case 'medianDurationMinutes': return s.medianDurationMinutes ?? s.avgDurationMinutes
          case 'profitPerORHour': return s.profitPerORHour ?? 0
          case 'durationVsFacilityMinutes': return s.durationVsFacilityMinutes
        }
      }
      const aVal = getVal(a)
      const bVal = getVal(b)
      return sortDir === 'desc' ? bVal - aVal : aVal - bVal
    })
  }, [proc.surgeonBreakdown, sortKey, sortDir])

  const toggleSort = (key: string) => {
    const k = key as SurgeonSortKey
    if (sortKey === k) {
      setSortDir(d => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortKey(k)
      setSortDir('desc')
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-900">Surgeon Breakdown</h3>
          <InfoTip text={`Each surgeon compared to facility median for ${proc.procedureName}`} />
        </div>
        <p className="text-xs text-slate-400 mt-0.5">
          {proc.surgeonCount} surgeons · Facility median:{' '}
          {Math.round(proc.medianDurationMinutes ?? proc.avgDurationMinutes)} min
        </p>
      </div>
      <table className="w-full">
        <thead className="bg-slate-50/80">
          <tr>
            <th className="px-4 py-2.5 text-left text-[10px] font-medium text-slate-400 uppercase tracking-wider">
              Surgeon
            </th>
            <SortTH
              label="Cases"
              sortKey="caseCount"
              current={sortKey}
              dir={sortDir}
              onClick={toggleSort}
              align="center"
            />
            <SortTH
              label="Median Profit"
              sortKey="totalProfit"
              current={sortKey}
              dir={sortDir}
              onClick={toggleSort}
            />
            <th className="px-4 py-2.5 text-right text-[10px] font-medium text-slate-400 uppercase tracking-wider">
              Impact
            </th>
            <SortTH
              label="$/OR Hr"
              sortKey="profitPerORHour"
              current={sortKey}
              dir={sortDir}
              onClick={toggleSort}
            />
            <SortTH
              label="Typical Time"
              sortKey="medianDurationMinutes"
              current={sortKey}
              dir={sortDir}
              onClick={toggleSort}
            />
            <SortTH
              label="vs Facility"
              sortKey="durationVsFacilityMinutes"
              current={sortKey}
              dir={sortDir}
              onClick={toggleSort}
            />
            <th className="px-4 py-2.5 text-center text-[10px] font-medium text-slate-400 uppercase tracking-wider">
              Consistency
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {sorted.map(s => (
            <tr
              key={s.surgeonId}
              className="hover:bg-slate-50/80 transition-colors"
            >
              <td className="px-4 py-3">
                <span className="text-sm font-medium text-slate-800">{s.surgeonName}</span>
                {s.caseCount < 5 && (
                  <span className="ml-1 text-amber-500 text-[10px]">*</span>
                )}
              </td>
              <td className="px-4 py-3 text-center text-sm text-slate-600">{s.caseCount}</td>
              <td className="px-4 py-3 text-right">
                <span
                  className={`font-medium tabular-nums ${
                    (s.medianProfit ?? s.avgProfit) >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {formatCurrency(s.medianProfit ?? s.avgProfit)}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                {Math.abs(s.profitImpact) >= 10 ? (
                  <ComparisonPill value={s.profitImpact} format="currency" />
                ) : (
                  <span className="text-sm text-slate-400">&mdash;</span>
                )}
              </td>
              <td className="px-4 py-3 text-right text-sm font-medium text-slate-900 tabular-nums">
                {s.profitPerORHour !== null ? formatCurrency(s.profitPerORHour) : '—'}
              </td>
              <td className="px-4 py-3 text-right text-sm text-slate-600 tabular-nums">
                {Math.round(s.medianDurationMinutes ?? s.avgDurationMinutes)} min
              </td>
              <td className="px-4 py-3 text-right">
                <ComparisonPill value={s.durationVsFacilityMinutes} unit="min" invert />
              </td>
              <td className="px-4 py-3 text-center">
                {s.consistencyRating ? (
                  <ConsistencyBadge rating={s.consistencyRating} />
                ) : (
                  <span className="text-slate-400 text-xs">Insufficient data</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {proc.surgeonBreakdown.some(s => s.caseCount < 5) && (
        <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-100">
          <p className="text-[10px] text-slate-500">
            * Below minimum threshold — interpret with caution
          </p>
        </div>
      )}
    </div>
  )
}

// ============================================
// RECENT CASES TABLE — sortable, expandable
// ============================================

type CaseSortKey = 'date' | 'profit' | 'duration' | 'reimbursement'

function RecentCasesTable({
  cases,
  medianProfit,
  medianDuration,
  procedureName,
}: {
  cases: CaseCompletionStats[]
  medianProfit: number
  medianDuration: number
  procedureName: string
}) {
  const [sortKey, setSortKey] = useState<CaseSortKey>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [expandedCase, setExpandedCase] = useState<string | null>(null)

  const sorted = useMemo(() => {
    return [...cases].sort((a, b) => {
      const getVal = (c: CaseCompletionStats) => {
        switch (sortKey) {
          case 'date': return c.case_date
          case 'profit': return c.profit ?? 0
          case 'duration': return c.total_duration_minutes ?? 0
          case 'reimbursement': return c.reimbursement ?? 0
        }
      }
      const aVal = getVal(a)
      const bVal = getVal(b)
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'desc' ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal)
      }
      return sortDir === 'desc'
        ? (bVal as number) - (aVal as number)
        : (aVal as number) - (bVal as number)
    })
  }, [cases, sortKey, sortDir])

  const toggleSort = (key: string) => {
    const k = key as CaseSortKey
    if (sortKey === k) {
      setSortDir(d => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortKey(k)
      setSortDir('desc')
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-900">Recent Cases</h3>
        <p className="text-xs text-slate-400 mt-0.5">
          {cases.length} {procedureName} cases in period · Click to expand
        </p>
      </div>
      <table className="w-full">
        <thead className="bg-slate-50/80">
          <tr>
            <th className="px-4 py-2.5 text-left text-[10px] font-medium text-slate-400 uppercase tracking-wider w-8" />
            <SortTH
              label="Date"
              sortKey="date"
              current={sortKey}
              dir={sortDir}
              onClick={toggleSort}
              align="left"
            />
            <th className="px-4 py-2.5 text-left text-[10px] font-medium text-slate-400 uppercase tracking-wider">
              Case #
            </th>
            <th className="px-4 py-2.5 text-left text-[10px] font-medium text-slate-400 uppercase tracking-wider">
              Surgeon
            </th>
            <th className="px-4 py-2.5 text-left text-[10px] font-medium text-slate-400 uppercase tracking-wider">
              Payer
            </th>
            <SortTH
              label="Duration"
              sortKey="duration"
              current={sortKey}
              dir={sortDir}
              onClick={toggleSort}
            />
            <SortTH
              label="Reimb."
              sortKey="reimbursement"
              current={sortKey}
              dir={sortDir}
              onClick={toggleSort}
            />
            <SortTH
              label="Profit"
              sortKey="profit"
              current={sortKey}
              dir={sortDir}
              onClick={toggleSort}
            />
            <th className="px-4 py-2.5 text-right text-[10px] font-medium text-slate-400 uppercase tracking-wider">
              Margin
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {sorted.map(c => {
            const surgeon = normalizeJoin(c.surgeon)
            const payer = normalizeJoin(c.payers)
            const room = normalizeJoin(c.or_rooms)
            const profit = c.profit ?? 0
            const reimb = c.reimbursement ?? 0
            const margin = reimb > 0 ? (profit / reimb) * 100 : 0
            const profitDiff = profit - medianProfit
            const durDiff = (c.total_duration_minutes ?? 0) - medianDuration
            const isExpanded = expandedCase === c.case_id
            const isLoss = profit < 0
            const debits = getCaseDebits(c)
            const orCost = getCaseORCost(c)

            const dateObj = new Date(c.case_date + 'T00:00:00')
            const dateLabel = dateObj.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })

            const surgeonName = surgeon
              ? `Dr. ${surgeon.last_name}`
              : 'Unknown'

            return (
              <CaseRow
                key={c.case_id}
                caseId={c.case_id}
                caseNumber={c.case_number}
                dateLabel={dateLabel}
                surgeonName={surgeonName}
                payerName={payer?.name ?? 'Unknown'}
                duration={c.total_duration_minutes ?? 0}
                durDiff={durDiff}
                reimb={reimb}
                profit={profit}
                profitDiff={profitDiff}
                margin={margin}
                isLoss={isLoss}
                isExpanded={isExpanded}
                roomName={room?.name ?? '—'}
                debits={debits}
                orCost={orCost}
                onToggle={() => setExpandedCase(isExpanded ? null : c.case_id)}
              />
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ============================================
// CASE ROW — single row with expand
// ============================================

function CaseRow({
  caseId,
  caseNumber,
  dateLabel,
  surgeonName,
  payerName,
  duration,
  durDiff,
  reimb,
  profit,
  profitDiff,
  margin,
  isLoss,
  isExpanded,
  roomName,
  debits,
  orCost,
  onToggle,
}: {
  caseId: string
  caseNumber: string
  dateLabel: string
  surgeonName: string
  payerName: string
  duration: number
  durDiff: number
  reimb: number
  profit: number
  profitDiff: number
  margin: number
  isLoss: boolean
  isExpanded: boolean
  roomName: string
  debits: number
  orCost: number
  onToggle: () => void
}) {
  return (
    <>
      <tr
        className={`hover:bg-slate-50/80 cursor-pointer transition-colors ${
          isExpanded ? 'bg-slate-50' : ''
        } ${isLoss ? 'bg-red-50/30' : ''}`}
        style={isLoss ? { borderLeft: '3px solid #fca5a5' } : { borderLeft: '3px solid transparent' }}
        onClick={onToggle}
      >
        <td className="px-4 py-3">
          <ChevronRight
            className={`w-4 h-4 text-slate-400 transition-transform ${
              isExpanded ? 'rotate-90' : ''
            }`}
          />
        </td>
        <td className="px-4 py-3 text-sm text-slate-700">{dateLabel}</td>
        <td className="px-4 py-3">
          <span className="text-xs font-mono text-slate-500">{caseNumber}</span>
        </td>
        <td className="px-4 py-3 text-sm font-medium text-slate-800">{surgeonName}</td>
        <td className="px-4 py-3 text-sm text-slate-600">{payerName}</td>
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-1.5">
            <span className="text-sm text-slate-700 tabular-nums">{duration} min</span>
            <ComparisonPill value={durDiff} unit="min" invert />
          </div>
        </td>
        <td className="px-4 py-3 text-right text-sm text-slate-700 tabular-nums">
          {fmt(reimb)}
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-1.5">
            <span
              className={`text-sm font-semibold tabular-nums ${
                profit >= 0 ? 'text-emerald-600' : 'text-red-600'
              }`}
            >
              {fmt(profit)}
            </span>
            <ComparisonPill value={profitDiff} format="currency" />
          </div>
        </td>
        <td className="px-4 py-3 text-right">
          <MarginBadge value={margin} />
        </td>
      </tr>

      {/* Expanded detail */}
      {isExpanded && (
        <tr className="bg-slate-50/50">
          <td colSpan={9} className="px-8 py-4">
            <div className="grid grid-cols-4 gap-4">
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Room</p>
                <p className="text-sm font-medium text-slate-700">{roomName}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">
                  Reimbursement
                </p>
                <p className="text-sm font-medium text-slate-700 tabular-nums">{fmt(reimb)}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">
                  Implants & Supplies
                </p>
                <p className="text-sm font-medium text-red-600 tabular-nums">({fmt(debits)})</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">OR Cost</p>
                <p className="text-sm font-medium text-red-600 tabular-nums">({fmt(orCost)})</p>
              </div>
            </div>
            {/* Mini cost waterfall bar */}
            {reimb > 0 && (
              <div className="mt-3 flex items-center gap-0.5 h-2.5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-400 rounded-l-full"
                  style={{ width: `${(debits / reimb) * 100}%` }}
                />
                <div
                  className="h-full bg-amber-400"
                  style={{ width: `${(orCost / reimb) * 100}%` }}
                />
                <div
                  className="h-full bg-emerald-400 rounded-r-full"
                  style={{ width: `${Math.max((profit / reimb) * 100, 0)}%` }}
                />
              </div>
            )}
          </td>
        </tr>
      )}
    </>
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
