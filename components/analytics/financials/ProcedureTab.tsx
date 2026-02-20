// components/analytics/financials/ProcedureTab.tsx
// List-only view — procedure detail is now URL-routed at /procedures/[id]

'use client'

import { useState, useMemo } from 'react'
import { FinancialsMetrics, SortDir } from './types'
import { formatCurrency } from './utils'
import { MarginBadge, SortTH } from './shared'

// ============================================
// PROPS
// ============================================

interface ProcedureTabProps {
  metrics: FinancialsMetrics
  onProcedureClick: (procedureId: string) => void
}

// ============================================
// MAIN COMPONENT — list-only
// ============================================

export default function ProcedureTab({
  metrics,
  onProcedureClick,
}: ProcedureTabProps) {
  return (
    <AllProceduresTable
      metrics={metrics}
      onProcedureClick={onProcedureClick}
    />
  )
}

// ============================================
// ALL PROCEDURES TABLE (sortable)
// ============================================

type ProcSortKey =
  | 'totalProfit'
  | 'caseCount'
  | 'medianProfit'
  | 'medianDurationMinutes'
  | 'avgMarginPercent'
  | 'profitPerORHour'

function AllProceduresTable({
  metrics,
  onProcedureClick,
}: {
  metrics: FinancialsMetrics
  onProcedureClick: (procedureId: string) => void
}) {
  const [sortKey, setSortKey] = useState<ProcSortKey>('totalProfit')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const sorted = useMemo(() => {
    return [...metrics.procedureStats].sort((a, b) => {
      const getVal = (p: typeof a) => {
        switch (sortKey) {
          case 'totalProfit': return p.totalProfit
          case 'caseCount': return p.caseCount
          case 'medianProfit': return p.medianProfit ?? p.avgProfit
          case 'medianDurationMinutes': return p.medianDurationMinutes ?? p.avgDurationMinutes
          case 'avgMarginPercent': return p.avgMarginPercent
          case 'profitPerORHour': return p.profitPerORHour ?? 0
        }
      }
      const aVal = getVal(a)
      const bVal = getVal(b)
      return sortDir === 'desc' ? bVal - aVal : aVal - bVal
    })
  }, [metrics.procedureStats, sortKey, sortDir])

  const toggleSort = (key: string) => {
    const k = key as ProcSortKey
    if (sortKey === k) {
      setSortDir(d => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortKey(k)
      setSortDir('desc')
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="px-5 py-4 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-900">All Procedures</h3>
        <p className="text-xs text-slate-400 mt-0.5">
          {metrics.procedureStats.length} procedures · Click to view detail
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50/80">
            <tr>
              <th className="px-4 py-2.5 text-left text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                Procedure
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
                label="Total Profit"
                sortKey="totalProfit"
                current={sortKey}
                dir={sortDir}
                onClick={toggleSort}
              />
              <SortTH
                label="Median Profit"
                sortKey="medianProfit"
                current={sortKey}
                dir={sortDir}
                onClick={toggleSort}
              />
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
                label="Margin"
                sortKey="avgMarginPercent"
                current={sortKey}
                dir={sortDir}
                onClick={toggleSort}
              />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {sorted.map(proc => {
              const loss = proc.totalProfit < 0

              return (
                <tr
                  key={proc.procedureId}
                  className={`hover:bg-slate-50/80 cursor-pointer transition-colors ${
                    loss ? 'bg-red-50/30' : ''
                  }`}
                  style={
                    loss
                      ? { borderLeft: '3px solid #fca5a5' }
                      : { borderLeft: '3px solid transparent' }
                  }
                  onClick={() => onProcedureClick(proc.procedureId)}
                >
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium text-slate-800 hover:text-blue-600 transition-colors">
                      {proc.procedureName}
                    </span>
                    <span className="text-slate-400 ml-1.5 text-xs">
                      {proc.surgeonCount} surgeons
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-slate-600 tabular-nums">
                    {proc.caseCount}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`font-semibold tabular-nums ${
                        loss ? 'text-red-600' : 'text-green-600'
                      }`}
                    >
                      {formatCurrency(proc.totalProfit)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-900 tabular-nums">
                    {formatCurrency(proc.medianProfit ?? proc.avgProfit)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-blue-700 tabular-nums">
                    {proc.profitPerORHour !== null
                      ? formatCurrency(proc.profitPerORHour)
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600 tabular-nums">
                    {Math.round(proc.medianDurationMinutes ?? proc.avgDurationMinutes)} min
                  </td>
                  <td className="px-4 py-3 text-right">
                    <MarginBadge value={proc.avgMarginPercent} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
