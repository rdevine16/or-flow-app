'use client'

import { useState, useMemo } from 'react'
import { FinancialsMetrics, ProcedureStats } from './types'
import { formatCurrency } from './utils'
import {
  InformationCircleIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
} from '@heroicons/react/24/outline'

// ============================================
// PROPS
// ============================================

interface ProcedureTabProps {
  metrics: FinancialsMetrics
  selectedProcedure: string | null
  onProcedureSelect: (procedureId: string | null) => void
}

// ============================================
// HELPERS
// ============================================

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return `${value.toFixed(1)}%`
}

function formatDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return '—'
  const hrs = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)
  if (hrs > 0) return `${hrs}h ${mins}m`
  return `${mins}m`
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
        <ProcedureDetail 
          metrics={metrics} 
          procedureId={selectedProcedure} 
        />
      ) : (
        <AllProceduresTable 
          metrics={metrics} 
          onProcedureSelect={onProcedureSelect} 
        />
      )}
    </div>
  )
}

// ============================================
// PROCEDURE DETAIL VIEW
// ============================================

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
      {/* Summary Cards Row 1 — Financial KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Profit */}
        <div className="bg-green-50 rounded-xl border border-green-200 p-5">
          <p className="text-sm font-medium text-green-600 mb-1">Total Profit</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(proc.totalProfit)}</p>
        </div>
        
        {/* Typical Profit with IQR */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-1 mb-1">
            <p className="text-sm font-medium text-slate-500">Typical Profit</p>
            <Tooltip text={`Median profit · Avg: ${formatCurrency(proc.avgProfit)}`} />
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

        {/* Typical Duration with IQR */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-1 mb-1">
            <p className="text-sm font-medium text-slate-500">Typical Duration</p>
            <Tooltip text={`Median duration · Avg: ${Math.round(proc.avgDurationMinutes)} min`} />
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

        {/* Margin */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-sm font-medium text-slate-500 mb-1">Margin</p>
          <p className="text-xl font-bold text-slate-900">{formatPercent(proc.avgMarginPercent)}</p>
          <MarginBar value={proc.avgMarginPercent} />
        </div>

        {/* Profit per OR Hour */}
        <div className="bg-white rounded-xl border border-blue-200 ring-1 ring-blue-100 p-5">
          <div className="flex items-center gap-1 mb-1">
            <p className="text-sm font-medium text-slate-500">$/OR Hour</p>
            <Tooltip text="Total profit ÷ total OR hours for this procedure" />
          </div>
          <p className="text-xl font-bold text-blue-700">
            {proc.profitPerORHour !== null ? formatCurrency(proc.profitPerORHour) : '—'}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {proc.caseCount} cases · {proc.surgeonCount} surgeons
          </p>
        </div>
      </div>

      {/* Revenue/Cost Breakdown (mini P&L) */}
      <ProcedurePL proc={proc} />

      {/* Surgeon Breakdown Table */}
      <SurgeonBreakdownTable proc={proc} />
    </>
  )
}

// ============================================
// PROCEDURE P&L — mini waterfall
// ============================================

function ProcedurePL({ proc }: { proc: ProcedureStats }) {
  const avgReimbursement = proc.caseCount > 0 ? proc.totalReimbursement / proc.caseCount : 0
  const avgDebits = proc.caseCount > 0 ? proc.totalDebits / proc.caseCount : 0
  const avgCredits = proc.caseCount > 0 ? proc.totalCredits / proc.caseCount : 0
  const avgORCost = proc.caseCount > 0 ? proc.totalORCost / proc.caseCount : 0
  const avgProfit = proc.caseCount > 0 ? proc.totalProfit / proc.caseCount : 0

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">Average Case Economics</h3>
      <div className="space-y-1.5">
        <PLRow label="Reimbursement" value={avgReimbursement} />
        <PLRow label="Debits (implants, supplies)" value={-avgDebits} negative />
        {avgCredits > 0 && (
          <PLRow label="Credits (rebates, fees)" value={avgCredits} positive />
        )}
        <PLRow label="OR Time Cost" value={-avgORCost} negative />
        <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-200">
          <span className="text-sm font-semibold text-slate-900">Net Profit</span>
          <span className={`text-sm font-bold tabular-nums ${avgProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(avgProfit)}
          </span>
        </div>
      </div>
    </div>
  )
}

function PLRow({ label, value, negative, positive }: {
  label: string
  value: number
  negative?: boolean
  positive?: boolean
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-slate-500">{label}</span>
      <span className={`text-sm font-medium tabular-nums ${
        positive ? 'text-green-600' : negative ? 'text-red-600' : 'text-slate-900'
      }`}>
        {value < 0 ? `(${formatCurrency(Math.abs(value))})` : formatCurrency(value)}
      </span>
    </div>
  )
}

// ============================================
// SURGEON BREAKDOWN TABLE (within procedure detail)
// ============================================

type SurgeonSortKey = 'totalProfit' | 'caseCount' | 'medianDurationMinutes' | 'profitPerORHour' | 'durationVsFacilityMinutes'

function SurgeonBreakdownTable({ proc }: { proc: ProcedureStats }) {
  const [sortKey, setSortKey] = useState<SurgeonSortKey>('totalProfit')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const sorted = useMemo(() => {
    return sortBy(proc.surgeonBreakdown, s => {
      switch (sortKey) {
        case 'totalProfit': return s.totalProfit ?? s.avgProfit * s.caseCount
        case 'caseCount': return s.caseCount
        case 'medianDurationMinutes': return s.medianDurationMinutes ?? s.avgDurationMinutes
        case 'profitPerORHour': return s.profitPerORHour ?? null
        case 'durationVsFacilityMinutes': return s.durationVsFacilityMinutes
      }
    }, sortDir)
  }, [proc.surgeonBreakdown, sortKey, sortDir])

  const toggleSort = (key: SurgeonSortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-slate-900">Surgeon Breakdown</h3>
          <Tooltip text="Each surgeon compared to facility median for this same procedure" />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Surgeon</th>
              <SortTH label="Cases" sortKey="caseCount" current={sortKey} dir={sortDir} onClick={toggleSort} align="center" />
              <SortTH label="Typical Profit" sortKey="totalProfit" current={sortKey} dir={sortDir} onClick={toggleSort} />
              <SortTH label="$/OR Hr" sortKey="profitPerORHour" current={sortKey} dir={sortDir} onClick={toggleSort} />
              <SortTH label="Typical Time" sortKey="medianDurationMinutes" current={sortKey} dir={sortDir} onClick={toggleSort} />
              <SortTH label="vs Facility" sortKey="durationVsFacilityMinutes" current={sortKey} dir={sortDir} onClick={toggleSort} />
              <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Impact</th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Consistency</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map(surgeon => (
              <tr key={surgeon.surgeonId} className="hover:bg-slate-50">
                <td className="px-6 py-4">
                  <span className="font-medium text-slate-900">{surgeon.surgeonName}</span>
                  {surgeon.caseCount < 10 && (
                    <span className="ml-2 text-xs text-amber-700">*</span>
                  )}
                </td>
                <td className="px-6 py-4 text-center text-slate-600">{surgeon.caseCount}</td>
                <td className="px-6 py-4 text-right">
                  <span className="font-medium text-green-600">
                    {surgeon.medianProfit !== null 
                      ? formatCurrency(surgeon.medianProfit) 
                      : formatCurrency(surgeon.avgProfit)
                    }
                  </span>
                  {surgeon.profitVsFacility !== 0 && (
                    <span className={`ml-2 text-xs ${surgeon.profitVsFacility >= 0 ? 'text-green-500' : 'text-red-400'}`}>
                      ({surgeon.profitVsFacility >= 0 ? '+' : ''}{formatCurrency(surgeon.profitVsFacility)})
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-right tabular-nums">
                  <span className="font-medium text-blue-700">
                    {surgeon.profitPerORHour !== null ? formatCurrency(surgeon.profitPerORHour) : '—'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right text-slate-600 tabular-nums">
                  {surgeon.medianDurationMinutes !== null 
                    ? `${Math.round(surgeon.medianDurationMinutes)} min`
                    : `${Math.round(surgeon.avgDurationMinutes)} min`
                  }
                </td>
                <td className="px-6 py-4 text-right">
                  <DurationDiff minutes={surgeon.durationVsFacilityMinutes} />
                </td>
                <td className="px-6 py-4 text-right">
                  <ImpactBadge value={surgeon.profitImpact} />
                </td>
                <td className="px-6 py-4 text-center">
                  <ConsistencyBadge rating={surgeon.consistencyRating} />
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
  )
}

// ============================================
// ALL PROCEDURES TABLE (sortable)
// ============================================

type ProcSortKey = 'totalProfit' | 'caseCount' | 'medianProfit' | 'medianDurationMinutes' | 'avgMarginPercent' | 'profitPerORHour'

function AllProceduresTable({ 
  metrics, 
  onProcedureSelect 
}: { 
  metrics: FinancialsMetrics
  onProcedureSelect: (procedureId: string) => void 
}) {
  const [sortKey, setSortKey] = useState<ProcSortKey>('totalProfit')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const sorted = useMemo(() => {
    return sortBy(metrics.procedureStats, p => {
      switch (sortKey) {
        case 'totalProfit': return p.totalProfit
        case 'caseCount': return p.caseCount
        case 'medianProfit': return p.medianProfit ?? p.avgProfit
        case 'medianDurationMinutes': return p.medianDurationMinutes ?? p.avgDurationMinutes
        case 'avgMarginPercent': return p.avgMarginPercent
        case 'profitPerORHour': return p.profitPerORHour
      }
    }, sortDir)
  }, [metrics.procedureStats, sortKey, sortDir])

  const toggleSort = (key: ProcSortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Procedure</th>
              <SortTH label="Cases" sortKey="caseCount" current={sortKey} dir={sortDir} onClick={toggleSort} align="center" />
              <SortTH label="Total Profit" sortKey="totalProfit" current={sortKey} dir={sortDir} onClick={toggleSort} />
              <SortTH label="Typical Profit" sortKey="medianProfit" current={sortKey} dir={sortDir} onClick={toggleSort} />
              <SortTH label="$/OR Hr" sortKey="profitPerORHour" current={sortKey} dir={sortDir} onClick={toggleSort} />
              <SortTH label="Typical Time" sortKey="medianDurationMinutes" current={sortKey} dir={sortDir} onClick={toggleSort} />
              <SortTH label="Margin" sortKey="avgMarginPercent" current={sortKey} dir={sortDir} onClick={toggleSort} />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map(proc => (
              <tr 
                key={proc.procedureId} 
                className="hover:bg-slate-50 cursor-pointer"
                onClick={() => onProcedureSelect(proc.procedureId)}
              >
                <td className="px-6 py-4">
                  <span className="font-medium text-slate-900">{proc.procedureName}</span>
                  <span className="text-slate-400 ml-1.5 text-xs">{proc.surgeonCount} surgeons</span>
                </td>
                <td className="px-6 py-4 text-center text-slate-600">{proc.caseCount}</td>
                <td className="px-6 py-4 text-right font-semibold text-green-600 tabular-nums">
                  {formatCurrency(proc.totalProfit)}
                </td>
                <td className="px-6 py-4 text-right text-slate-900 tabular-nums">
                  {proc.medianProfit !== null 
                    ? formatCurrency(proc.medianProfit)
                    : formatCurrency(proc.avgProfit)
                  }
                </td>
                <td className="px-6 py-4 text-right font-medium text-blue-700 tabular-nums">
                  {proc.profitPerORHour !== null ? formatCurrency(proc.profitPerORHour) : '—'}
                </td>
                <td className="px-6 py-4 text-right text-slate-600 tabular-nums">
                  {proc.medianDurationMinutes !== null 
                    ? `${Math.round(proc.medianDurationMinutes)} min`
                    : `${Math.round(proc.avgDurationMinutes)} min`
                  }
                </td>
                <td className="px-6 py-4 text-right">
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
// SHARED UI COMPONENTS
// ============================================

function SortTH<T extends string>({
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
      className={`px-6 py-3 text-xs font-semibold uppercase tracking-wide cursor-pointer select-none hover:text-slate-700 transition-colors ${alignClass} ${
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

function Tooltip({ text }: { text: string }) {
  return (
    <div className="group relative">
      <InformationCircleIcon className="w-4 h-4 text-slate-400 cursor-help" />
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-normal z-10 max-w-xs text-center">
        {text}
      </div>
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

function MarginBar({ value }: { value: number }) {
  const width = Math.min(Math.max(value, 0), 100)
  const color =
    value >= 30 ? 'bg-green-500' :
    value >= 15 ? 'bg-amber-500' :
    'bg-red-500'

  return (
    <div className="mt-2 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${width}%` }} />
    </div>
  )
}

function DurationDiff({ minutes }: { minutes: number }) {
  const color =
    minutes < -3 ? 'text-green-600' :
    minutes > 10 ? 'text-red-600' :
    'text-slate-600'

  return (
    <span className={`inline-flex items-center gap-1 text-sm ${color}`}>
      {minutes < -3 && <ArrowTrendingDownIcon className="w-3.5 h-3.5" />}
      {minutes > 10 && <ArrowTrendingUpIcon className="w-3.5 h-3.5" />}
      {minutes > 0 ? '+' : ''}{Math.round(minutes)} min
    </span>
  )
}

function ImpactBadge({ value }: { value: number }) {
  if (Math.abs(value) < 10) {
    return <span className="text-sm text-slate-400">—</span>
  }

  const isPositive = value > 0
  return (
    <span className={`inline-flex items-center gap-1 text-sm font-medium ${
      isPositive ? 'text-green-600' : 'text-red-600'
    }`}>
      {isPositive ? '+' : ''}{formatCurrency(value)}
    </span>
  )
}

function ConsistencyBadge({ rating }: { rating: 'high' | 'medium' | 'low' | null }) {
  if (!rating) return <span className="text-slate-400">—</span>

  const config = {
    high: { label: '⚡ High', classes: 'bg-green-100 text-green-600' },
    medium: { label: '◐ Medium', classes: 'bg-amber-100 text-amber-700' },
    low: { label: '◯ Low', classes: 'bg-red-100 text-red-600' },
  }

  const c = config[rating]
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${c.classes}`}>
      {c.label}
    </span>
  )
}