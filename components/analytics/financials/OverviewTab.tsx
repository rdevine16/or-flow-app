// components/analytics/financials/OverviewTab.tsx

'use client'

import { useMemo, useState } from 'react'
import { FinancialsMetrics, ProcedureStats, SurgeonStats } from './types'
import { formatCurrency } from './utils'
import { ArrowDown, BanknoteIcon, ChevronDown, ChevronUp, Clock, DollarSignIcon, Info, Receipt } from 'lucide-react'
import { varianceColors } from '@/lib/design-tokens'

// ============================================
// PROPS
// ============================================

interface OverviewTabProps {
  metrics: FinancialsMetrics
  onProcedureClick?: (procedureId: string) => void
  onSurgeonClick?: (surgeonId: string) => void
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
  onProcedureClick,
  onSurgeonClick,
  onProcedureSelect,
  onSurgeonSelect,
}: OverviewTabProps) {
  const handleProcedureSelect = onProcedureClick ?? onProcedureSelect
  const handleSurgeonSelect = onSurgeonClick ?? onSurgeonSelect

  const totalCosts = metrics.totalDebits - metrics.totalCredits + metrics.totalORCost

  return (
    <div className="space-y-6">
      {/* Financial Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <SummaryCard
          label="Total Reimbursement"
          value={formatCurrency(metrics.totalReimbursement)}
          subtitle={`${metrics.totalCases} cases`}
          icon={BanknoteIcon}
        />
        <SummaryCard
          label="Total Costs"
          value={formatCurrency(totalCosts)}
          subtitle={`Avg ${formatCurrency(metrics.totalCases > 0 ? totalCosts / metrics.totalCases : 0)}/case`}
          icon={Receipt}
          negative
        />
        <SummaryCard
          label="Total Debits"
          value={formatCurrency(metrics.totalDebits)}
          subtitle="Implants & supplies"
          icon={ArrowDown}
          negative
        />
        <SummaryCard
          label="Total OR Cost"
          value={formatCurrency(metrics.totalORCost)}
          subtitle={`${formatCurrency(metrics.orRate)}/hr rate`}
          icon={Clock}
          negative
        />
        <SummaryCard
          label="Net Profit"
          value={formatCurrency(metrics.totalProfit)}
          subtitle={`${formatPercent(metrics.avgMargin)} margin`}
          icon={DollarSignIcon}
          highlight={metrics.totalProfit >= 0}
          negative={metrics.totalProfit < 0}
        />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Profit per OR Hour"
          value={metrics.profitPerORHour !== null ? formatCurrency(metrics.profitPerORHour) : '—'}
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

      {/* Two-Column: Top Procedures + Top Surgeons */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TopProceduresTable
          procedures={metrics.procedureStats}
          onSelect={handleProcedureSelect}
        />
        <TopSurgeonsTable
          surgeons={metrics.surgeonStats}
          onSelect={handleSurgeonSelect}
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
// SUMMARY CARDS — Top-level financial metrics
// ============================================

function SummaryCard({
  label,
  value,
  subtitle,
  icon: Icon,
  highlight,
  negative,
}: {
  label: string
  value: string
  subtitle?: string
  icon: React.ComponentType<{ className?: string }>
  highlight?: boolean
  negative?: boolean
}) {
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${
      highlight ? 'bg-green-50 border-green-200' :
      'bg-white border-slate-200'
    }`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${
          highlight ? 'text-green-600' :
          negative ? 'text-red-400' :
          'text-slate-400'
        }`} />
        <p className="text-sm font-medium text-slate-500">{label}</p>
      </div>
      <p className={`text-2xl font-bold tabular-nums ${
        highlight ? 'text-green-600' :
        negative ? 'text-red-600' :
        'text-slate-900'
      }`}>
        {value}
      </p>
      {subtitle && (
        <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
      )}
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
  const kpiStatusColors: Record<string, string> = {
    good: varianceColors.good.text,
    neutral: varianceColors.warning.text,
    bad: varianceColors.bad.text,
  }

  return (
    <div className={`bg-white rounded-xl border p-4 shadow-sm ${
      highlight ? 'border-blue-200 ring-1 ring-blue-100' : 'border-slate-200'
    }`}>
      <div className="flex items-center gap-1.5 mb-2">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        {tooltip && (
          <div className="group relative">
            <Info className="w-4 h-4 text-slate-400 cursor-help" />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-normal z-50 min-w-[200px] max-w-xs text-center shadow-lg">
              {tooltip}
            </div>
          </div>
        )}
      </div>
      <p className={`text-2xl font-bold tabular-nums ${
        status ? kpiStatusColors[status] :
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
      <div className="px-4 py-4 border-b border-slate-200">
        <h3 className="text-base font-semibold text-slate-900">Top Procedures</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/80">
            <tr>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
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
                <td className="px-4 py-3">
                  <span className="font-medium text-slate-900">{proc.procedureName}</span>
                  <span className="text-slate-400 ml-1.5 text-xs">{proc.surgeonCount} surgeons</span>
                </td>
                <td className="px-4 py-3 text-center text-slate-600">{proc.caseCount}</td>
                <td className="px-4 py-3 text-right font-semibold text-green-600 tabular-nums">
                  {formatCurrency(proc.totalProfit)}
                </td>
                <td className="px-4 py-3 text-right text-slate-900 tabular-nums">
                  {proc.profitPerORHour !== null ? formatCurrency(proc.profitPerORHour) : '—'}
                </td>
                <td className="px-4 py-3 text-right">
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
      <div className="px-4 py-4 border-b border-slate-200">
        <h3 className="text-base font-semibold text-slate-900">Top Surgeons</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/80">
            <tr>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
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
                <td className="px-4 py-3">
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
                <td className="px-4 py-3 text-center text-slate-600">{surgeon.caseCount}</td>
                <td className="px-4 py-3 text-right font-semibold text-green-600 tabular-nums">
                  {formatCurrency(surgeon.totalProfit)}
                </td>
                <td className="px-4 py-3 text-right text-slate-900 tabular-nums">
                  {surgeon.profitPerORHour !== null ? formatCurrency(surgeon.profitPerORHour) : '—'}
                </td>
                <td className="px-4 py-3 text-right">
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
// PROFIT TREND — Fixed chart rendering
// ============================================

function ProfitTrend({ data }: { data: FinancialsMetrics['profitTrend'] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  // Filter out invalid entries, sort by date
  const validData = useMemo(() => {
    return [...data]
      .filter(d => d.date && d.profit !== null && d.profit !== undefined)
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [data])

  if (validData.length < 2) return null

  const maxProfit = Math.max(...validData.map(d => Math.abs(d.profit)), 1)
  const hasNegative = validData.some(d => d.profit < 0)
  const minProfit = hasNegative ? Math.min(...validData.map(d => d.profit)) : 0
  const range = maxProfit - minProfit || 1

  const formatDate = (dateStr: string) => {
    try {
      const [year, month, day] = dateStr.split('-').map(Number)
      const date = new Date(year, month - 1, day)
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    } catch {
      return dateStr
    }
  }

  const labelInterval = Math.max(Math.ceil(validData.length / 6), 1)

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-slate-900">Daily Profit Trend</h3>
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-2 rounded-sm bg-green-500" />
            <span>Profit</span>
          </div>
          <span>{validData.length} days</span>
        </div>
      </div>

      <div className="relative">
        <div className="flex items-end gap-[2px] h-40" onMouseLeave={() => setHoveredIdx(null)}>
          {validData.map((d, i) => {
            const barHeight = Math.max((Math.abs(d.profit) / range) * 100, 3)
            const isNeg = d.profit < 0
            const isHovered = hoveredIdx === i

            return (
              <div
                key={d.date}
                className="flex-1 flex flex-col items-center justify-end relative h-full"
                onMouseEnter={() => setHoveredIdx(i)}
              >
                {isHovered && (
                  <div className="absolute bottom-full mb-2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg pointer-events-none whitespace-nowrap z-20 shadow-lg">
                    <div className="font-semibold">{formatDate(d.date)}</div>
                    <div className="mt-0.5">{formatCurrency(d.profit)}</div>
                    <div className="text-slate-400">{d.caseCount} {d.caseCount === 1 ? 'case' : 'cases'}</div>
                    {d.caseCount > 0 && (
                      <div className="text-slate-400">{formatCurrency(d.profit / d.caseCount)}/case</div>
                    )}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                  </div>
                )}

                <div
                  className={`w-full rounded-t transition-all duration-150 ${
                    isNeg 
                      ? isHovered ? 'bg-red-500' : 'bg-red-400/70'
                      : isHovered ? 'bg-green-500' : 'bg-green-500/70'
                  }`}
                  style={{ 
                    height: `${barHeight}%`,
                    minHeight: '3px',
                  }}
                />
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex gap-[2px] mt-2">
        {validData.map((d, i) => (
          <div key={d.date} className="flex-1 text-center">
            {(i === 0 || i === validData.length - 1 || i % labelInterval === 0) ? (
              <span className="text-xs text-slate-400 leading-tight block">
                {formatDate(d.date)}
              </span>
            ) : null}
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
      className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wide cursor-pointer select-none hover:text-slate-700 transition-colors ${alignClass} ${
        isActive ? 'text-slate-700' : 'text-slate-500'
      }`}
      onClick={() => onClick(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive && (
          dir === 'desc'
            ? <ChevronDown className="w-3 h-3" />
            : <ChevronUp className="w-3 h-3" />
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
    value >= 30 ? 'bg-green-50 text-green-600' :
    value >= 15 ? 'bg-amber-50 text-amber-700' :
    value >= 0 ? 'bg-red-50 text-red-600' :
    'bg-red-100 text-red-800'

  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold tabular-nums ${color}`}>
      {formatPercent(value)}
    </span>
  )
}