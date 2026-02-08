// components/analytics/financials/OverviewTab.tsx
// REDESIGNED: Replaced "Time = Money" gradient cards with P&L summary
// ADDED: Profit per OR hour, margin %, cost breakdown
// ADDED: Sortable procedure and surgeon tables
// FIXED: Profit trend now shows per-case median + case count

'use client'

import { useMemo, useState } from 'react'
import { FinancialsMetrics, ProcedureStats, SurgeonStats } from './types'
import { formatCurrency } from './utils'
import {
  InformationCircleIcon,
  ChevronRightIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'

// ============================================
// PROPS
// ============================================

interface OverviewTabProps {
  metrics: FinancialsMetrics
  onProcedureSelect?: (procedureId: string) => void
  onSurgeonSelect?: (surgeonId: string) => void
}

// ============================================
// HELPERS
// ============================================

function formatDuration(minutes: number | null): string {
  if (minutes === null || minutes === undefined) return '—'
  const hrs = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)
  if (hrs > 0) return `${hrs}h ${mins}m`
  return `${mins}m`
}

function formatPercent(value: number | null): string {
  if (value === null || value === undefined) return '—'
  return `${value.toFixed(1)}%`
}

function formatRate(value: number | null): string {
  if (value === null || value === undefined) return '—'
  return formatCurrency(value)
}

type SortDir = 'asc' | 'desc'

function sortBy<T>(arr: T[], key: (item: T) => number | null, dir: SortDir): T[] {
  return [...arr].sort((a, b) => {
    const aVal = key(a) ?? -Infinity
    const bVal = key(b) ?? -Infinity
    return dir === 'desc' ? bVal - aVal : aVal - bVal
  })
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function OverviewTab({
  metrics,
  onProcedureSelect,
  onSurgeonSelect,
}: OverviewTabProps) {
  return (
    <div className="space-y-6">
      {/* P&L Summary */}
      <PLSummary metrics={metrics} />

      {/* Key Performance Indicators */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Profit per OR Hour"
          value={formatRate(metrics.profitPerORHour)}
          tooltip="Total profit ÷ total OR hours. The single best measure of OR financial efficiency."
          highlight
        />
        <KPICard
          label="Average Margin"
          value={formatPercent(metrics.avgMargin)}
          tooltip="Total profit ÷ total reimbursement × 100"
          status={
            metrics.avgMargin >= 30 ? 'good' :
            metrics.avgMargin >= 15 ? 'neutral' : 'bad'
          }
        />
        <KPICard
          label="Median Profit/Case"
          value={formatCurrency(metrics.medianProfit ?? 0)}
          tooltip="Middle value of all case profits — less sensitive to outliers than average"
        />
        <KPICard
          label="Total OR Hours"
          value={formatDuration(metrics.totalORMinutes)}
          tooltip="Total time from patient-in to patient-out across all cases"
        />
      </div>

      {/* Outlier Alert Banner */}
      {metrics.outlierStats.total > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex items-start gap-3">
          <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-900">
              {metrics.outlierStats.total} outlier {metrics.outlierStats.total === 1 ? 'case' : 'cases'} detected
            </p>
            <p className="text-sm text-amber-700 mt-0.5">
              {metrics.outlierStats.profitOutliers > 0 && `${metrics.outlierStats.profitOutliers} low-profit`}
              {metrics.outlierStats.profitOutliers > 0 && metrics.outlierStats.durationOutliers > 0 && ' · '}
              {metrics.outlierStats.durationOutliers > 0 && `${metrics.outlierStats.durationOutliers} over-time`}
              {' — '}
              excess time cost: {formatCurrency(metrics.excessTimeCost)}
            </p>
          </div>
        </div>
      )}

      {/* Two-Column: Top Procedures + Top Surgeons */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TopProceduresTable
          procedures={metrics.procedureStats}
          onSelect={onProcedureSelect}
        />
        <TopSurgeonsTable
          surgeons={metrics.surgeonStats}
          onSelect={onSurgeonSelect}
        />
      </div>

      {/* Profit Trend */}
      {metrics.profitTrend.length > 1 && (
        <ProfitTrend data={metrics.profitTrend} />
      )}
    </div>
  )
}

// ============================================
// P&L SUMMARY — Enterprise waterfall-style
// ============================================

function PLSummary({ metrics }: { metrics: FinancialsMetrics }) {
  const netCost = metrics.totalDebits - metrics.totalCredits + metrics.totalORCost
  
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Financial Summary</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              {metrics.totalCases} cases in period
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500 uppercase tracking-wide">OR Rate</p>
            <p className="text-sm font-semibold text-slate-700">
              {formatCurrency(metrics.orRate)}/hr
            </p>
          </div>
        </div>
      </div>

      <div className="px-6 py-5">
        {/* Revenue */}
        <div className="flex items-center justify-between py-2.5">
          <span className="text-sm font-medium text-slate-700">Total Reimbursement</span>
          <span className="text-sm font-semibold text-slate-900 tabular-nums">
            {formatCurrency(metrics.totalReimbursement)}
          </span>
        </div>

        {/* Cost Breakdown */}
        <div className="border-t border-slate-100 mt-1 pt-1">
          <PLRow label="Debits (implants, supplies)" value={-metrics.totalDebits} negative />
          {metrics.totalCredits > 0 && (
            <PLRow label="Credits (tech fees, rebates)" value={metrics.totalCredits} positive />
          )}
          <PLRow label="OR Time Cost" value={-metrics.totalORCost} negative />
        </div>

        {/* Total Costs */}
        <div className="flex items-center justify-between py-2.5 border-t border-slate-200 mt-1">
          <span className="text-sm font-medium text-slate-500">Total Costs</span>
          <span className="text-sm font-semibold text-red-600 tabular-nums">
            ({formatCurrency(netCost)})
          </span>
        </div>

        {/* Net Profit */}
        <div className="flex items-center justify-between py-3 border-t-2 border-slate-900 mt-1">
          <span className="text-base font-bold text-slate-900">Net Profit</span>
          <div className="text-right">
            <span className={`text-lg font-bold tabular-nums ${
              metrics.totalProfit >= 0 ? 'text-emerald-600' : 'text-red-600'
            }`}>
              {formatCurrency(metrics.totalProfit)}
            </span>
            <span className="text-sm text-slate-500 ml-2">
              ({formatPercent(metrics.avgMargin)} margin)
            </span>
          </div>
        </div>

        {/* Per-Case Averages */}
        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-100">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">Avg Revenue/Case</p>
            <p className="text-sm font-semibold text-slate-900 mt-1 tabular-nums">
              {formatCurrency(metrics.totalCases > 0 ? metrics.totalReimbursement / metrics.totalCases : 0)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">Avg Cost/Case</p>
            <p className="text-sm font-semibold text-slate-900 mt-1 tabular-nums">
              {formatCurrency(metrics.totalCases > 0 ? netCost / metrics.totalCases : 0)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">Avg Profit/Case</p>
            <p className={`text-sm font-semibold mt-1 tabular-nums ${
              metrics.avgProfit >= 0 ? 'text-emerald-600' : 'text-red-600'
            }`}>
              {formatCurrency(metrics.avgProfit)}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function PLRow({
  label,
  value,
  negative,
  positive,
}: {
  label: string
  value: number
  negative?: boolean
  positive?: boolean
}) {
  return (
    <div className="flex items-center justify-between py-2 pl-4">
      <span className="text-sm text-slate-500">{label}</span>
      <span className={`text-sm font-medium tabular-nums ${
        positive ? 'text-emerald-600' : negative ? 'text-red-500' : 'text-slate-900'
      }`}>
        {positive && '+'}{formatCurrency(Math.abs(value))}
        {negative && value !== 0 && (
          <span className="text-slate-400 ml-0.5">−</span>
        )}
      </span>
    </div>
  )
}

// ============================================
// KPI CARD
// ============================================

function KPICard({
  label,
  value,
  tooltip,
  highlight,
  status,
}: {
  label: string
  value: string
  tooltip?: string
  highlight?: boolean
  status?: 'good' | 'neutral' | 'bad'
}) {
  const statusColors = {
    good: 'text-emerald-600',
    neutral: 'text-amber-600',
    bad: 'text-red-600',
  }

  return (
    <div className={`bg-white rounded-xl border p-5 shadow-sm ${
      highlight ? 'border-blue-200 ring-1 ring-blue-100' : 'border-slate-200'
    }`}>
      <div className="flex items-center gap-1.5 mb-2">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        {tooltip && (
          <div className="group relative">
            <InformationCircleIcon className="w-4 h-4 text-slate-400 cursor-help" />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-normal z-10 max-w-xs text-center">
              {tooltip}
            </div>
          </div>
        )}
      </div>
      <p className={`text-2xl font-bold tabular-nums ${
        status ? statusColors[status] :
        highlight ? 'text-blue-700' : 'text-slate-900'
      }`}>
        {value}
      </p>
    </div>
  )
}

// ============================================
// TOP PROCEDURES TABLE (sortable)
// ============================================

type ProcSortKey = 'totalProfit' | 'caseCount' | 'profitPerORHour' | 'avgMarginPercent'

function TopProceduresTable({
  procedures,
  onSelect,
}: {
  procedures: ProcedureStats[]
  onSelect?: (id: string) => void
}) {
  const [sortKey, setSortKey] = useState<ProcSortKey>('totalProfit')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const sorted = useMemo(() => {
    return sortBy(procedures, p => {
      switch (sortKey) {
        case 'totalProfit': return p.totalProfit
        case 'caseCount': return p.caseCount
        case 'profitPerORHour': return p.profitPerORHour
        case 'avgMarginPercent': return p.avgMarginPercent
      }
    }, sortDir)
  }, [procedures, sortKey, sortDir])

  const toggleSort = (key: ProcSortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200">
        <h3 className="text-base font-semibold text-slate-900">Top Procedures</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/80">
            <tr>
              <th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Procedure
              </th>
              <SortHeader label="Cases" sortKey="caseCount" current={sortKey} dir={sortDir} onClick={toggleSort} align="center" />
              <SortHeader label="Profit" sortKey="totalProfit" current={sortKey} dir={sortDir} onClick={toggleSort} />
              <SortHeader label="$/OR Hr" sortKey="profitPerORHour" current={sortKey} dir={sortDir} onClick={toggleSort} />
              <SortHeader label="Margin" sortKey="avgMarginPercent" current={sortKey} dir={sortDir} onClick={toggleSort} />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.slice(0, 8).map(proc => (
              <tr
                key={proc.procedureId}
                className={`hover:bg-slate-50/50 ${onSelect ? 'cursor-pointer' : ''}`}
                onClick={() => onSelect?.(proc.procedureId)}
              >
                <td className="px-5 py-3">
                  <span className="font-medium text-slate-900">{proc.procedureName}</span>
                  <span className="text-slate-400 ml-1.5 text-xs">{proc.surgeonCount} surgeons</span>
                </td>
                <td className="px-5 py-3 text-center text-slate-600">{proc.caseCount}</td>
                <td className="px-5 py-3 text-right font-semibold text-emerald-600 tabular-nums">
                  {formatCurrency(proc.totalProfit)}
                </td>
                <td className="px-5 py-3 text-right text-slate-900 tabular-nums">
                  {proc.profitPerORHour !== null ? formatCurrency(proc.profitPerORHour) : '—'}
                </td>
                <td className="px-5 py-3 text-right">
                  <MarginBadge value={proc.avgMarginPercent} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ============================================
// TOP SURGEONS TABLE (sortable)
// ============================================

type SurgeonSortKey = 'totalProfit' | 'caseCount' | 'profitPerORHour' | 'avgMarginPercent'

function TopSurgeonsTable({
  surgeons,
  onSelect,
}: {
  surgeons: SurgeonStats[]
  onSelect?: (id: string) => void
}) {
  const [sortKey, setSortKey] = useState<SurgeonSortKey>('totalProfit')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const sorted = useMemo(() => {
    return sortBy(surgeons, s => {
      switch (sortKey) {
        case 'totalProfit': return s.totalProfit
        case 'caseCount': return s.caseCount
        case 'profitPerORHour': return s.profitPerORHour
        case 'avgMarginPercent': return s.avgMarginPercent
      }
    }, sortDir)
  }, [surgeons, sortKey, sortDir])

  const toggleSort = (key: SurgeonSortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200">
        <h3 className="text-base font-semibold text-slate-900">Top Surgeons</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/80">
            <tr>
              <th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Surgeon
              </th>
              <SortHeader label="Cases" sortKey="caseCount" current={sortKey} dir={sortDir} onClick={toggleSort} align="center" />
              <SortHeader label="Profit" sortKey="totalProfit" current={sortKey} dir={sortDir} onClick={toggleSort} />
              <SortHeader label="$/OR Hr" sortKey="profitPerORHour" current={sortKey} dir={sortDir} onClick={toggleSort} />
              <SortHeader label="Margin" sortKey="avgMarginPercent" current={sortKey} dir={sortDir} onClick={toggleSort} />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.slice(0, 8).map((surgeon, idx) => (
              <tr
                key={surgeon.surgeonId}
                className={`hover:bg-slate-50/50 ${onSelect ? 'cursor-pointer' : ''}`}
                onClick={() => onSelect?.(surgeon.surgeonId)}
              >
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <RankBadge rank={idx + 1} />
                    <div>
                      <span className="font-medium text-slate-900">{surgeon.surgeonName}</span>
                      {surgeon.caseCount < 10 && (
                        <span className="ml-1.5 px-1.5 py-0.5 text-xs font-medium bg-amber-50 text-amber-700 rounded">
                          Low vol
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3 text-center text-slate-600">{surgeon.caseCount}</td>
                <td className="px-5 py-3 text-right font-semibold text-emerald-600 tabular-nums">
                  {formatCurrency(surgeon.totalProfit)}
                </td>
                <td className="px-5 py-3 text-right text-slate-900 tabular-nums">
                  {surgeon.profitPerORHour !== null ? formatCurrency(surgeon.profitPerORHour) : '—'}
                </td>
                <td className="px-5 py-3 text-right">
                  <MarginBadge value={surgeon.avgMarginPercent} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ============================================
// PROFIT TREND — with case count context
// ============================================

function ProfitTrend({ data }: { data: FinancialsMetrics['profitTrend'] }) {
  if (data.length === 0) return null

  const maxProfit = Math.max(...data.map(d => d.profit), 1)
  const maxCases = Math.max(...data.map(d => d.caseCount), 1)

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-slate-900">Daily Profit Trend</h3>
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-2 rounded-sm bg-emerald-500" />
            <span>Profit</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-2 rounded-sm bg-slate-300" />
            <span>Cases</span>
          </div>
        </div>
      </div>

      {/* Simple bar chart */}
      <div className="flex items-end gap-1 h-32">
        {data.map((d, i) => {
          const profitHeight = Math.max((d.profit / maxProfit) * 100, 2)
          const caseHeight = Math.max((d.caseCount / maxCases) * 100, 4)

          return (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-0.5 group relative">
              {/* Tooltip */}
              <div className="absolute bottom-full mb-2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                <div className="font-semibold">{d.date}</div>
                <div>{formatCurrency(d.profit)} · {d.caseCount} cases</div>
                <div>{formatCurrency(d.caseCount > 0 ? d.profit / d.caseCount : 0)}/case</div>
              </div>

              {/* Profit bar */}
              <div
                className="w-full rounded-t bg-emerald-500/80 hover:bg-emerald-500 transition-colors"
                style={{ height: `${profitHeight}%` }}
              />
            </div>
          )
        })}
      </div>

      {/* X-axis labels (show every few) */}
      <div className="flex gap-1 mt-1">
        {data.map((d, i) => (
          <div key={d.date} className="flex-1 text-center">
            {(i === 0 || i === data.length - 1 || i % Math.max(Math.floor(data.length / 5), 1) === 0) && (
              <span className="text-[10px] text-slate-400">
                {new Date(d.date + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================
// SHARED UI COMPONENTS
// ============================================

function SortHeader<T extends string>({
  label,
  sortKey,
  current,
  dir,
  onClick,
  align = 'right',
}: {
  label: string
  sortKey: T
  current: T
  dir: SortDir
  onClick: (key: T) => void
  align?: 'left' | 'center' | 'right'
}) {
  const isActive = current === sortKey
  const alignClass = align === 'center' ? 'text-center' : align === 'left' ? 'text-left' : 'text-right'

  return (
    <th
      className={`px-5 py-2.5 text-xs font-semibold uppercase tracking-wide cursor-pointer select-none hover:text-slate-700 transition-colors ${alignClass} ${
        isActive ? 'text-slate-700' : 'text-slate-500'
      }`}
      onClick={() => onClick(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive && (
          dir === 'desc'
            ? <ChevronDownIcon className="w-3 h-3" />
            : <ChevronUpIcon className="w-3 h-3" />
        )}
      </span>
    </th>
  )
}

function RankBadge({ rank }: { rank: number }) {
  const styles = rank <= 3
    ? [
        'bg-gradient-to-br from-amber-400 to-amber-500 text-white',
        'bg-gradient-to-br from-slate-300 to-slate-400 text-white',
        'bg-gradient-to-br from-amber-600 to-amber-700 text-white',
      ][rank - 1]
    : 'bg-slate-100 text-slate-600'

  return (
    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${styles}`}>
      {rank}
    </div>
  )
}

function MarginBadge({ value }: { value: number }) {
  const color =
    value >= 30 ? 'bg-emerald-50 text-emerald-700' :
    value >= 15 ? 'bg-amber-50 text-amber-700' :
    value >= 0 ? 'bg-red-50 text-red-700' :
    'bg-red-100 text-red-800'

  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold tabular-nums ${color}`}>
      {formatPercent(value)}
    </span>
  )
}