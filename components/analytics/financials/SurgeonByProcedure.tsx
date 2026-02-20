// components/analytics/financials/SurgeonByProcedure.tsx
// By Procedure sub-tab: surgeon vs facility median comparison table

'use client'

import { useMemo, useState } from 'react'
import { BarChart3 } from 'lucide-react'

import { SurgeonProcedureBreakdown, SortDir } from './types'
import { formatCurrency, formatDuration } from './utils'
import { ComparisonPill, SortTH } from './shared'

// ============================================
// TYPES
// ============================================

interface SurgeonByProcedureProps {
  procedureBreakdown: SurgeonProcedureBreakdown[]
  surgeonName: string
}

type SortCol = 'name' | 'cases' | 'profit' | 'surgeonDur' | 'facilityDur' | 'diff'

// ============================================
// MAIN COMPONENT
// ============================================

export default function SurgeonByProcedure({
  procedureBreakdown,
  surgeonName,
}: SurgeonByProcedureProps) {
  const [sortCol, setSortCol] = useState<SortCol>('profit')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const handleSort = (key: string) => {
    if (sortCol === key) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortCol(key as SortCol)
      setSortDir(key === 'name' ? 'asc' : 'desc')
    }
  }

  const sorted = useMemo(() => {
    return [...procedureBreakdown].sort((a, b) => {
      let cmp = 0
      switch (sortCol) {
        case 'name':
          cmp = a.procedureName.localeCompare(b.procedureName)
          break
        case 'cases':
          cmp = a.caseCount - b.caseCount
          break
        case 'profit':
          cmp = a.totalProfit - b.totalProfit
          break
        case 'surgeonDur':
          cmp = (a.medianDuration ?? 0) - (b.medianDuration ?? 0)
          break
        case 'facilityDur':
          cmp = (a.facilityMedianDuration ?? 0) - (b.facilityMedianDuration ?? 0)
          break
        case 'diff':
          cmp = a.durationVsFacility - b.durationVsFacility
          break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [procedureBreakdown, sortCol, sortDir])

  const hasLowVolume = procedureBreakdown.some(p => p.caseCount < 5)

  if (procedureBreakdown.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
        <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-slate-900">No Procedure Data</h3>
        <p className="text-slate-500 mt-1">
          No procedure breakdown available for this surgeon.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-900">Performance by Procedure</h3>
        <p className="text-xs text-slate-400 mt-0.5">
          Comparing {surgeonName}&apos;s median duration to facility median
        </p>
      </div>

      <table className="w-full">
        <thead className="bg-slate-50/80">
          <tr>
            <SortTH
              label="Procedure"
              sortKey="name"
              current={sortCol}
              dir={sortDir}
              onClick={handleSort}
              align="left"
            />
            <SortTH
              label="Cases"
              sortKey="cases"
              current={sortCol}
              dir={sortDir}
              onClick={handleSort}
              align="center"
            />
            <SortTH
              label="Total Profit"
              sortKey="profit"
              current={sortCol}
              dir={sortDir}
              onClick={handleSort}
              align="right"
            />
            <SortTH
              label="Surgeon Median"
              sortKey="surgeonDur"
              current={sortCol}
              dir={sortDir}
              onClick={handleSort}
              align="right"
            />
            <SortTH
              label="Facility Median"
              sortKey="facilityDur"
              current={sortCol}
              dir={sortDir}
              onClick={handleSort}
              align="right"
            />
            <SortTH
              label="Difference"
              sortKey="diff"
              current={sortCol}
              dir={sortDir}
              onClick={handleSort}
              align="right"
            />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {sorted.map(pb => (
            <tr key={pb.procedureId} className="hover:bg-slate-50/50">
              <td className="px-4 py-3 text-sm font-medium text-slate-800">
                {pb.procedureName}
              </td>
              <td className="px-4 py-3 text-center text-sm text-slate-600">
                {pb.caseCount}
                {pb.caseCount < 5 && (
                  <span className="ml-1 text-amber-500 text-[10px]">*</span>
                )}
              </td>
              <td
                className={`px-4 py-3 text-right font-semibold tabular-nums ${
                  pb.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {formatCurrency(pb.totalProfit)}
              </td>
              <td className="px-4 py-3 text-right text-sm text-slate-900 tabular-nums">
                {formatDuration(pb.medianDuration)}
              </td>
              <td className="px-4 py-3 text-right text-sm text-slate-500 tabular-nums">
                {formatDuration(pb.facilityMedianDuration)}
              </td>
              <td className="px-4 py-3 text-right">
                <ComparisonPill value={pb.durationVsFacility} unit="min" invert />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {hasLowVolume && (
        <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-100">
          <p className="text-[10px] text-slate-500">
            * Low sample size — interpret with caution
          </p>
        </div>
      )}
    </div>
  )
}
