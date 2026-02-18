// components/analytics/InsightPanelTurnover.tsx
// Turnover drill-through panel.
// Displays compliance summary, per-transition detail table, and surgeon comparison.

'use client'

import { useMemo } from 'react'
import type { TurnoverResult, TurnoverDetail, FacilityAnalyticsConfig } from '@/lib/analyticsV2'

// ============================================
// TYPES
// ============================================

interface InsightPanelTurnoverProps {
  turnoverTime: TurnoverResult
  config: FacilityAnalyticsConfig
}

interface SurgeonTurnoverStats {
  name: string
  medianMinutes: number
  count: number
  compliantCount: number
  complianceRate: number
}

// ============================================
// HELPERS
// ============================================

function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/** Format date string: "2024-02-03" → "Feb 3" */
function formatDate(dateStr: string): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const parts = dateStr.split('-')
  const month = months[parseInt(parts[1], 10) - 1] ?? parts[1]
  const day = parseInt(parts[2], 10)
  return `${month} ${day}`
}

function computeSurgeonStats(details: TurnoverDetail[], threshold: number): SurgeonTurnoverStats[] {
  // Group by "from" surgeon (the surgeon whose case just ended)
  const bySurgeon = new Map<string, TurnoverDetail[]>()
  details.forEach(d => {
    const arr = bySurgeon.get(d.fromSurgeonName) || []
    arr.push(d)
    bySurgeon.set(d.fromSurgeonName, arr)
  })

  const stats: SurgeonTurnoverStats[] = []
  bySurgeon.forEach((transitions, name) => {
    const times = transitions.map(t => t.turnoverMinutes)
    const compliant = transitions.filter(t => t.isCompliant).length
    stats.push({
      name,
      medianMinutes: Math.round(calculateMedian(times)),
      count: transitions.length,
      compliantCount: compliant,
      complianceRate: transitions.length > 0 ? Math.round((compliant / transitions.length) * 100) : 0,
    })
  })

  return stats.sort((a, b) => b.medianMinutes - a.medianMinutes)
}

// ============================================
// COMPONENT
// ============================================

export default function InsightPanelTurnover({
  turnoverTime,
  config,
}: InsightPanelTurnoverProps) {
  const { details, compliantCount, nonCompliantCount, complianceRate } = turnoverTime
  const threshold = config.turnoverThresholdMinutes
  const target = config.turnoverComplianceTarget

  // Sort: non-compliant first, then by time descending
  const sortedDetails = useMemo(
    () => [...details].sort((a, b) => {
      if (a.isCompliant !== b.isCompliant) return a.isCompliant ? 1 : -1
      return b.turnoverMinutes - a.turnoverMinutes
    }),
    [details]
  )

  // Surgeon-level comparison
  const surgeonStats = useMemo(
    () => computeSurgeonStats(details, threshold),
    [details, threshold]
  )

  // ============================================
  // EMPTY STATE
  // ============================================

  if (details.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 bg-indigo-50 rounded-xl flex items-center justify-center mb-4">
          <span className="text-2xl text-indigo-400">&#x27F3;</span>
        </div>
        <h3 className="text-sm font-semibold text-slate-900 mb-1">No Turnover Data</h3>
        <p className="text-sm text-slate-400">No room turnovers found in this period.</p>
      </div>
    )
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <div>
      {/* Compliance Summary */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <SummaryCard
          label="Compliance"
          value={`${complianceRate}%`}
          color={complianceRate >= target ? 'text-emerald-500' : 'text-red-500'}
        />
        <SummaryCard
          label="Target"
          value={`${target}%`}
          color="text-slate-900"
        />
        <SummaryCard
          label={`Under ${threshold}m`}
          value={String(compliantCount)}
          color="text-emerald-500"
        />
        <SummaryCard
          label={`Over ${threshold}m`}
          value={String(nonCompliantCount)}
          color={nonCompliantCount > 0 ? 'text-red-500' : 'text-slate-900'}
        />
      </div>

      {/* Per-transition detail table */}
      <h3 className="text-[13px] font-semibold text-slate-900 mb-2.5">Turnover Detail</h3>
      <div className="bg-white border border-slate-100 rounded-[10px] overflow-hidden mb-5">
        {/* Table header */}
        <div className="grid grid-cols-[56px_56px_140px_100px_52px_60px] px-3.5 py-2 bg-slate-50/80 border-b border-slate-100">
          {['Date', 'Room', 'Cases', 'Surgeon', 'Time', 'Status'].map(h => (
            <span key={h} className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">{h}</span>
          ))}
        </div>

        {/* Table rows */}
        {sortedDetails.map((d, i) => (
          <div
            key={`${d.date}-${d.fromCaseNumber}-${d.toCaseNumber}`}
            className={`grid grid-cols-[56px_56px_140px_100px_52px_60px] px-3.5 py-2.5 items-center ${
              i < sortedDetails.length - 1 ? 'border-b border-slate-50' : ''
            }`}
          >
            <span className="text-xs text-slate-500">{formatDate(d.date)}</span>
            <span className="text-xs font-medium text-slate-800">{d.roomName}</span>
            <span className="text-xs text-slate-600 truncate">{d.fromCaseNumber} &rarr; {d.toCaseNumber}</span>
            <span className="text-xs text-slate-800 truncate">{d.fromSurgeonName}</span>
            <span className={`text-xs font-mono font-semibold ${
              d.isCompliant ? 'text-emerald-500' : 'text-red-500'
            }`}>
              {d.turnoverMinutes}m
            </span>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
              d.isCompliant
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-red-50 text-red-700'
            }`}>
              {d.isCompliant ? 'OK' : 'Over'}
            </span>
          </div>
        ))}
      </div>

      {/* Surgeon Turnover Comparison */}
      {surgeonStats.length > 0 && (
        <>
          <h3 className="text-[13px] font-semibold text-slate-900 mb-2.5">Surgeon Turnover Comparison</h3>
          <div className="space-y-2">
            {surgeonStats.map(s => (
              <div key={s.name} className="bg-white border border-slate-100 rounded-[10px] p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-900">{s.name}</span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                    s.complianceRate >= target
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-red-50 text-red-700'
                  }`}>
                    {s.complianceRate}% compliant
                  </span>
                </div>
                {/* Horizontal bar */}
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-1.5">
                  <div
                    className={`h-full rounded-full ${
                      s.medianMinutes <= threshold ? 'bg-emerald-400' : 'bg-red-400'
                    }`}
                    style={{ width: `${Math.min((s.medianMinutes / (threshold * 2)) * 100, 100)}%` }}
                  />
                  {/* Target line */}
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>Median: {s.medianMinutes}m</span>
                  <span>{s.count} turnovers</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ============================================
// SUB-COMPONENTS
// ============================================

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-slate-50/80 rounded-lg p-2.5 border border-slate-100">
      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-xl font-bold font-mono ${color}`}>{value}</div>
    </div>
  )
}
