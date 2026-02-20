// components/analytics/financials/SurgeonTab.tsx
// List-only view — surgeon detail moved to URL-routed /analytics/financials/surgeons/[id]

'use client'

import { useState, useMemo } from 'react'
import {
  FinancialsMetrics,
  SortDir,
} from './types'
import { formatCurrency } from './utils'
import {
  SortTH,
  RankBadge,
  MarginBadge,
} from './shared'
import { ChevronRight, UserIcon, DollarSignIcon, ChartBarIcon, ArrowDown } from 'lucide-react'

interface SurgeonTabProps {
  metrics: FinancialsMetrics
  onSurgeonClick: (surgeonId: string) => void
}

// ============================================
// HELPERS
// ============================================

function sortByKey<T>(arr: T[], key: (item: T) => number | null, dir: SortDir): T[] {
  return [...arr].sort((a, b) => {
    const aVal = key(a) ?? -Infinity
    const bVal = key(b) ?? -Infinity
    return dir === 'desc' ? bVal - aVal : aVal - bVal
  })
}

// ============================================
// MAIN COMPONENT — List Only
// ============================================

export default function SurgeonTab({
  metrics,
  onSurgeonClick,
}: SurgeonTabProps) {
  return (
    <div className="space-y-6">
      <AllSurgeonsOverview
        metrics={metrics}
        onSurgeonClick={onSurgeonClick}
      />
    </div>
  )
}

// ============================================
// ALL SURGEONS OVERVIEW — Sortable Leaderboard
// ============================================

type LeaderboardSortKey = 'totalProfit' | 'caseCount' | 'profitPerORHour' | 'avgMarginPercent' | 'medianProfit'

function AllSurgeonsOverview({
  metrics,
  onSurgeonClick,
}: {
  metrics: FinancialsMetrics
  onSurgeonClick: (surgeonId: string) => void
}) {
  const [sortKey, setSortKey] = useState<LeaderboardSortKey>('totalProfit')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const sortedSurgeons = useMemo(() => {
    return sortByKey(metrics.surgeonStats, s => {
      switch (sortKey) {
        case 'totalProfit': return s.totalProfit
        case 'caseCount': return s.caseCount
        case 'profitPerORHour': return s.profitPerORHour
        case 'avgMarginPercent': return s.avgMarginPercent
        case 'medianProfit': return s.medianProfit ?? s.avgProfit
      }
    }, sortDir)
  }, [metrics.surgeonStats, sortKey, sortDir])

  const toggleSort = (key: string) => {
    const k = key as LeaderboardSortKey
    if (sortKey === k) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    } else {
      setSortKey(k)
      setSortDir('desc')
    }
  }

  // Summary totals
  const totalProfit = metrics.surgeonStats.reduce((sum, s) => sum + s.totalProfit, 0)
  const totalCases = metrics.surgeonStats.reduce((sum, s) => sum + s.caseCount, 0)

  return (
    <>
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="Total Surgeons"
          value={metrics.surgeonStats.length}
          icon={UserIcon}
        />
        <SummaryCard
          title="Total Profit"
          value={formatCurrency(totalProfit)}
          icon={DollarSignIcon}
          variant="success"
        />
        <SummaryCard
          title="Total Cases"
          value={totalCases}
          icon={ChartBarIcon}
        />
        <SummaryCard
          title="Avg $/OR Hour"
          value={metrics.profitPerORHour !== null ? formatCurrency(metrics.profitPerORHour) : '—'}
          icon={ArrowDown}
        />
      </div>

      {/* Sortable Leaderboard Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Surgeon Leaderboard</h3>
              <p className="text-sm text-slate-500 mt-0.5">Click a surgeon to view detailed performance</p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50/80">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide w-8">#</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Surgeon</th>
                <SortTH label="Cases" sortKey="caseCount" current={sortKey} dir={sortDir} onClick={toggleSort} align="center" />
                <SortTH label="Total Profit" sortKey="totalProfit" current={sortKey} dir={sortDir} onClick={toggleSort} />
                <SortTH label="Typical/Case" sortKey="medianProfit" current={sortKey} dir={sortDir} onClick={toggleSort} />
                <SortTH label="$/OR Hr" sortKey="profitPerORHour" current={sortKey} dir={sortDir} onClick={toggleSort} />
                <SortTH label="Margin" sortKey="avgMarginPercent" current={sortKey} dir={sortDir} onClick={toggleSort} />
                <th className="px-6 py-3 w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedSurgeons.map((surgeon, idx) => (
                <tr
                  key={surgeon.surgeonId}
                  className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                  onClick={() => onSurgeonClick(surgeon.surgeonId)}
                >
                  <td className="px-6 py-4">
                    <RankBadge rank={idx + 1} />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">{surgeon.surgeonName}</span>
                      {surgeon.caseCount < 10 && (
                        <span className="px-1.5 py-0.5 text-xs font-medium bg-amber-50 text-amber-700 rounded">
                          Low volume
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-sm text-slate-500">
                      <span>{surgeon.procedureBreakdown?.length || 0} procedures</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center text-slate-600">{surgeon.caseCount}</td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-lg font-bold text-green-600 tabular-nums">
                      {formatCurrency(surgeon.totalProfit)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-slate-900 tabular-nums">
                    {formatCurrency(surgeon.medianProfit || surgeon.avgProfit)}
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-blue-700 tabular-nums">
                    {surgeon.profitPerORHour !== null ? formatCurrency(surgeon.profitPerORHour) : '—'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <MarginBadge value={surgeon.avgMarginPercent} />
                  </td>
                  <td className="px-6 py-4">
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

// ============================================
// SUMMARY CARD
// ============================================

function SummaryCard({
  title,
  value,
  icon: Icon,
  variant,
}: {
  title: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
  variant?: 'success' | 'warning' | 'danger'
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`
          w-10 h-10 rounded-lg flex items-center justify-center
          ${variant === 'success' ? 'bg-green-50' : 'bg-slate-50'}
        `}>
          <Icon className={`w-5 h-5 ${variant === 'success' ? 'text-green-600' : 'text-slate-600'}`} />
        </div>
        <div>
          <p className="text-sm text-slate-500">{title}</p>
          <p className={`text-xl font-bold ${variant === 'success' ? 'text-green-600' : 'text-slate-900'}`}>
            {value}
          </p>
        </div>
      </div>
    </div>
  )
}
