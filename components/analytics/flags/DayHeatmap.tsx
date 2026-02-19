'use client'

import type { DayOfWeekRow } from '@/types/flag-analytics'
import { flagChartColors } from '@/lib/design-tokens'

// ============================================
// Types
// ============================================

interface DayHeatmapProps {
  data: DayOfWeekRow[]
}

type CategoryKey = 'fcots' | 'timing' | 'turnover' | 'delay'

interface HeatmapCategory {
  key: CategoryKey
  label: string
  color: string
}

// ============================================
// Category config — maps to flagChartColors
// ============================================

const CATEGORIES: HeatmapCategory[] = [
  { key: 'fcots', label: 'FCOTS', color: flagChartColors.fcots },
  { key: 'timing', label: 'Timing', color: flagChartColors.timing },
  { key: 'turnover', label: 'Turnover', color: flagChartColors.turnover },
  { key: 'delay', label: 'Delays', color: flagChartColors.delays },
]

// ============================================
// Helpers
// ============================================

/** Compute cell background with variable opacity based on value */
function getCellBackground(value: number, maxVal: number, baseColor: string): string {
  if (value === 0 || maxVal === 0) return '#f8fafc' // slate-50
  const intensity = Math.max(0.08, value / maxVal)
  // Convert hex to rgba with computed opacity
  const r = parseInt(baseColor.slice(1, 3), 16)
  const g = parseInt(baseColor.slice(3, 5), 16)
  const b = parseInt(baseColor.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${intensity * 0.35})`
}

/** Compute cell text color — darker when intensity is high */
function getCellTextColor(value: number, maxVal: number, baseColor: string): string {
  if (value === 0) return '#94a3b8' // slate-400
  const intensity = value / maxVal
  return intensity > 0.6 ? baseColor : '#334155' // slate-700
}

/** Compute cell border with variable opacity */
function getCellBorder(value: number, baseColor: string): string {
  if (value === 0) return '1px solid #e2e8f0' // slate-200
  const r = parseInt(baseColor.slice(1, 3), 16)
  const g = parseInt(baseColor.slice(3, 5), 16)
  const b = parseInt(baseColor.slice(5, 7), 16)
  return `1px solid rgba(${r}, ${g}, ${b}, 0.15)`
}

// ============================================
// Component
// ============================================

export default function DayHeatmap({ data }: DayHeatmapProps) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-[220px] text-sm text-slate-400">
        No heatmap data available
      </div>
    )
  }

  // Find max value across all category cells for intensity scaling
  const maxVal = Math.max(
    ...data.flatMap((d) => CATEGORIES.map((c) => d[c.key])),
    1 // prevent division by zero
  )

  return (
    <div className="overflow-x-auto">
      <div
        className="gap-[3px]"
        style={{
          display: 'grid',
          gridTemplateColumns: `60px repeat(${data.length}, 1fr)`,
          minWidth: 380,
        }}
      >
        {/* Day headers row */}
        <div /> {/* empty corner */}
        {data.map((d) => (
          <div
            key={d.day}
            className="text-[11px] font-semibold text-slate-500 text-center py-1"
          >
            {d.day}
          </div>
        ))}

        {/* Category rows */}
        {CATEGORIES.map((cat) => (
          <div key={cat.key} className="contents">
            {/* Row label */}
            <div className="text-[11px] font-medium text-slate-500 flex items-center pr-2">
              {cat.label}
            </div>

            {/* Day cells */}
            {data.map((d) => {
              const val = d[cat.key]
              return (
                <div
                  key={`${cat.key}-${d.day}`}
                  className="rounded-md text-center font-semibold text-[13px] font-mono transition-all duration-150 cursor-default"
                  style={{
                    backgroundColor: getCellBackground(val, maxVal, cat.color),
                    color: getCellTextColor(val, maxVal, cat.color),
                    border: getCellBorder(val, cat.color),
                    padding: '10px 0',
                  }}
                >
                  {val}
                </div>
              )
            })}
          </div>
        ))}

        {/* Total row */}
        <div className="text-[11px] font-bold text-slate-500 flex items-center pr-2 border-t border-slate-200 pt-2 mt-1">
          Total
        </div>
        {data.map((d) => (
          <div
            key={`total-${d.day}`}
            className="text-center text-sm font-bold text-slate-900 font-mono border-t border-slate-200 pt-2 mt-1"
          >
            {d.total}
          </div>
        ))}
      </div>
    </div>
  )
}
