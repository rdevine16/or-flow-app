'use client'

import { useState, useMemo } from 'react'
import { TrendingUp, TrendingDown, ArrowUp, ArrowDown } from 'lucide-react'
import type { SurgeonFlagRow } from '@/types/flag-analytics'

// ============================================
// Types
// ============================================

type SortKey = 'name' | 'cases' | 'flags' | 'rate' | 'trend'
type SortDir = 'asc' | 'desc'

interface SurgeonFlagTableProps {
  data: SurgeonFlagRow[]
  /** Click handler for drill-through (Phase 5 will provide this) */
  onSurgeonClick?: (surgeonId: string) => void
}

// ============================================
// Inline TrendBadge (matches FlagKPICard pattern)
// ============================================

function TrendBadge({ value }: { value: number }) {
  if (value === 0) {
    return <span className="text-[11px] text-slate-400">&mdash;</span>
  }

  const isPositive = value > 0
  // For flag trends, negative = good (fewer flags)
  const isGood = !isPositive

  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1.5 py-px rounded text-[11px] font-semibold ${
        isGood ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
      }`}
    >
      {isPositive ? (
        <TrendingUp className="w-3 h-3" />
      ) : (
        <TrendingDown className="w-3 h-3" />
      )}
      {Math.abs(value).toFixed(1)}%
    </span>
  )
}

// ============================================
// Flag rate badge with color coding
// ============================================

function FlagRateBadge({ rate }: { rate: number }) {
  let colorClass: string
  if (rate > 35) {
    colorClass = 'bg-rose-50 text-rose-600'
  } else if (rate > 25) {
    colorClass = 'bg-amber-50 text-amber-600'
  } else {
    colorClass = 'bg-emerald-50 text-emerald-600'
  }

  return (
    <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${colorClass}`}>
      {rate.toFixed(1)}%
    </span>
  )
}

// ============================================
// Column header with sort indicator
// ============================================

const COLUMNS: { key: SortKey; label: string; align: 'left' | 'right' }[] = [
  { key: 'name', label: 'Surgeon', align: 'left' },
  { key: 'cases', label: 'Cases', align: 'right' },
  { key: 'flags', label: 'Flags', align: 'right' },
  { key: 'rate', label: 'Flag Rate', align: 'right' },
  { key: 'trend', label: 'Trend', align: 'right' },
]

function SortIndicator({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return null
  return dir === 'asc' ? (
    <ArrowUp className="w-3 h-3 text-slate-500" />
  ) : (
    <ArrowDown className="w-3 h-3 text-slate-500" />
  )
}

// ============================================
// SurgeonFlagTable
// ============================================

export default function SurgeonFlagTable({ data, onSurgeonClick }: SurgeonFlagTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('rate')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      // Default desc for numeric columns, asc for name
      setSortDir(key === 'name' ? 'asc' : 'desc')
    }
  }

  const sortedData = useMemo(() => {
    const sorted = [...data]
    sorted.sort((a, b) => {
      let cmp: number
      switch (sortKey) {
        case 'name':
          cmp = a.name.localeCompare(b.name)
          break
        case 'cases':
          cmp = a.cases - b.cases
          break
        case 'flags':
          cmp = a.flags - b.flags
          break
        case 'rate':
          cmp = a.rate - b.rate
          break
        case 'trend':
          cmp = a.trend - b.trend
          break
        default:
          cmp = 0
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return sorted
  }, [data, sortKey, sortDir])

  if (data.length === 0) return null

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse min-w-[700px]">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/50">
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-[0.05em] cursor-pointer select-none hover:text-slate-600 transition-colors ${
                  col.align === 'right' ? 'text-right' : 'text-left'
                }`}
                onClick={() => handleSort(col.key)}
              >
                <span className="inline-flex items-center gap-1">
                  {col.align === 'right' && (
                    <SortIndicator active={sortKey === col.key} dir={sortDir} />
                  )}
                  {col.label}
                  {col.align === 'left' && (
                    <SortIndicator active={sortKey === col.key} dir={sortDir} />
                  )}
                </span>
              </th>
            ))}
            {/* Top Flag column — not sortable */}
            <th className="px-4 py-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-[0.05em] text-left">
              Top Flag
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedData.map((sg) => (
            <tr
              key={sg.surgeonId}
              className="border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer"
              onClick={() => onSurgeonClick?.(sg.surgeonId)}
            >
              <td className="px-4 py-3">
                <span className="text-[13px] font-semibold text-slate-900">
                  {sg.name}
                </span>
              </td>
              <td className="px-4 py-3 text-right font-mono text-[13px] text-slate-500">
                {sg.cases}
              </td>
              <td className="px-4 py-3 text-right font-mono text-[13px] font-semibold text-slate-900">
                {sg.flags}
              </td>
              <td className="px-4 py-3 text-right">
                <FlagRateBadge rate={sg.rate} />
              </td>
              <td className="px-4 py-3 text-right">
                <TrendBadge value={sg.trend} />
              </td>
              <td className="px-4 py-3">
                <span className="text-xs text-slate-500">{sg.topFlag}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
