// components/analytics/InsightPanelScheduling.tsx
// Scheduling & volume drill-through panel.
// Displays weekly volume trend bar chart and volume-vs-utilization comparison.

'use client'

import { useMemo } from 'react'
import type { AnalyticsOverview } from '@/lib/analyticsV2'

// ============================================
// TYPES
// ============================================

interface InsightPanelSchedulingProps {
  analytics: AnalyticsOverview
}

// ============================================
// COMPONENT
// ============================================

export default function InsightPanelScheduling({ analytics }: InsightPanelSchedulingProps) {
  const { caseVolume, orUtilization, totalCases, completedCases } = analytics
  const { weeklyVolume } = caseVolume

  // Compute weekly stats
  const weeklyStats = useMemo(() => {
    if (weeklyVolume.length === 0) return null

    const counts = weeklyVolume.map(w => w.count)
    const max = Math.max(...counts)
    const avg = Math.round(counts.reduce((a, b) => a + b, 0) / counts.length)

    // Trend: compare first half to second half
    const mid = Math.floor(counts.length / 2)
    const firstHalf = counts.slice(0, mid)
    const secondHalf = counts.slice(mid)
    const firstAvg = firstHalf.length > 0 ? firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length : 0
    const secondAvg = secondHalf.length > 0 ? secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length : 0
    const trendDirection = secondAvg > firstAvg + 1 ? 'increasing' : secondAvg < firstAvg - 1 ? 'decreasing' : 'stable'
    const trendPercent = firstAvg > 0 ? Math.round(((secondAvg - firstAvg) / firstAvg) * 100) : 0

    return { max, avg, trendDirection, trendPercent, firstAvg: Math.round(firstAvg), secondAvg: Math.round(secondAvg) }
  }, [weeklyVolume])

  // Volume vs utilization comparison
  const divergence = useMemo(() => {
    const volDelta = caseVolume.delta
    const volDirection = caseVolume.deltaType
    const utilDelta = orUtilization.delta
    const utilDirection = orUtilization.deltaType

    if (!volDelta || !utilDelta || !volDirection || !utilDirection) return null

    const isDiverging = (volDirection === 'increase' && utilDirection === 'decrease')
      || (volDirection === 'decrease' && utilDirection === 'increase')

    let pattern: string
    if (volDirection === 'increase' && utilDirection === 'decrease') {
      pattern = 'More cases are being scheduled but rooms are used less efficiently. This suggests scheduling gaps, room assignment imbalances, or block time mismatch.'
    } else if (volDirection === 'decrease' && utilDirection === 'decrease') {
      pattern = 'Both volume and utilization are declining. Fewer cases are being scheduled, directly impacting room usage.'
    } else if (volDirection === 'decrease' && utilDirection === 'increase') {
      pattern = 'Volume is down but utilization is up. Fewer cases are fitting more tightly into available time — operations are efficient but the pipeline is shrinking.'
    } else if (volDirection === 'increase' && utilDirection === 'increase') {
      pattern = 'Both volume and utilization are trending up. Growth is being absorbed efficiently into available OR time.'
    } else {
      pattern = 'Volume and utilization trends are stable.'
    }

    return { volDelta, volDirection, utilDelta, utilDirection, isDiverging, pattern }
  }, [caseVolume, orUtilization])

  // ============================================
  // EMPTY STATE
  // ============================================

  if (weeklyVolume.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 bg-indigo-50 rounded-xl flex items-center justify-center mb-4">
          <span className="text-2xl text-indigo-400">&#x1F4CA;</span>
        </div>
        <h3 className="text-sm font-semibold text-slate-900 mb-1">No Scheduling Data</h3>
        <p className="text-sm text-slate-400">No weekly volume data available for this period.</p>
      </div>
    )
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <div>
      {/* Summary Strip */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <SummaryCard
          label="Total Cases"
          value={String(totalCases)}
          color="text-slate-900"
        />
        <SummaryCard
          label="Completed"
          value={String(completedCases)}
          color="text-slate-900"
        />
        <SummaryCard
          label="Avg/Week"
          value={weeklyStats ? String(weeklyStats.avg) : '—'}
          color="text-slate-900"
        />
        <SummaryCard
          label="Trend"
          value={caseVolume.delta ? `${caseVolume.deltaType === 'increase' ? '+' : '-'}${caseVolume.delta}%` : '—'}
          color={
            caseVolume.deltaType === 'increase' ? 'text-emerald-500'
              : caseVolume.deltaType === 'decrease' ? 'text-red-500'
                : 'text-slate-900'
          }
        />
      </div>

      {/* Weekly Volume Chart */}
      <h3 className="text-[13px] font-semibold text-slate-900 mb-2.5">Weekly Volume Trend</h3>
      <div className="bg-white border border-slate-100 rounded-[10px] p-4 mb-5">
        {weeklyStats && (
          <div className="relative">
            {/* Average line */}
            <div className="absolute left-0 right-0 border-t border-dashed border-slate-300" style={{
              bottom: `${weeklyStats.max > 0 ? (weeklyStats.avg / weeklyStats.max) * 120 : 0}px`,
            }}>
              <span className="absolute -top-3.5 right-0 text-[9px] font-semibold text-slate-400">
                avg: {weeklyStats.avg}
              </span>
            </div>

            {/* Bars */}
            <div className="flex items-end gap-1.5" style={{ height: '140px' }}>
              {weeklyVolume.map((w, i) => {
                const barHeight = weeklyStats.max > 0 ? (w.count / weeklyStats.max) * 120 : 0
                const isAboveAvg = w.count >= weeklyStats.avg
                return (
                  <div
                    key={w.week}
                    className="flex-1 flex flex-col items-center justify-end"
                    title={`Week of ${formatWeekLabel(w.week)}: ${w.count} cases`}
                  >
                    <span className="text-[9px] font-mono font-semibold text-slate-500 mb-1">{w.count}</span>
                    <div
                      className={`w-full rounded-t-sm transition-all ${
                        isAboveAvg ? 'bg-emerald-400' : 'bg-slate-300'
                      } ${i === weeklyVolume.length - 1 ? 'ring-2 ring-indigo-400 ring-offset-1' : ''}`}
                      style={{ height: `${barHeight}px`, minHeight: w.count > 0 ? '4px' : '0' }}
                    />
                  </div>
                )
              })}
            </div>

            {/* X-axis labels */}
            <div className="flex gap-1.5 mt-1.5">
              {weeklyVolume.map(w => (
                <div key={w.week} className="flex-1 text-center">
                  <span className="text-[8px] text-slate-400">{formatWeekLabel(w.week)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Trend summary */}
        {weeklyStats && weeklyStats.trendDirection !== 'stable' && (
          <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
            Volume is{' '}
            <span className={`font-semibold ${
              weeklyStats.trendDirection === 'increasing' ? 'text-emerald-600' : 'text-red-500'
            }`}>
              {weeklyStats.trendDirection}
            </span>
            {' '}— recent avg: {weeklyStats.secondAvg}/week vs earlier avg: {weeklyStats.firstAvg}/week
            {weeklyStats.trendPercent !== 0 && ` (${weeklyStats.trendPercent > 0 ? '+' : ''}${weeklyStats.trendPercent}%)`}
          </div>
        )}
      </div>

      {/* Volume vs Utilization */}
      {divergence && (
        <>
          <h3 className="text-[13px] font-semibold text-slate-900 mb-2.5">Volume vs Utilization</h3>
          <div className="bg-white border border-slate-100 rounded-[10px] p-4 mb-5">
            <div className="grid grid-cols-2 gap-4 mb-3">
              <TrendIndicator
                label="Case Volume"
                delta={divergence.volDelta}
                direction={divergence.volDirection}
              />
              <TrendIndicator
                label="OR Utilization"
                delta={divergence.utilDelta}
                direction={divergence.utilDirection}
              />
            </div>

            <div className={`border rounded-[10px] p-3.5 ${
              divergence.isDiverging
                ? 'bg-amber-50 border-amber-200'
                : 'bg-slate-50 border-slate-200'
            }`}>
              <p className={`text-xs leading-relaxed m-0 ${
                divergence.isDiverging ? 'text-amber-800' : 'text-slate-600'
              }`}>
                {divergence.pattern}
              </p>
            </div>
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

function TrendIndicator({
  label,
  delta,
  direction,
}: {
  label: string
  delta: number
  direction: 'increase' | 'decrease' | 'unchanged'
}) {
  const icon = direction === 'increase' ? '\u2191' : direction === 'decrease' ? '\u2193' : '\u2192'
  const color = direction === 'increase' ? 'text-emerald-600' : direction === 'decrease' ? 'text-red-500' : 'text-slate-500'

  return (
    <div className="text-center">
      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-lg font-bold font-mono ${color}`}>
        {icon} {delta}%
      </div>
      <div className="text-[10px] text-slate-400 capitalize">{direction}</div>
    </div>
  )
}

// ============================================
// UTILITIES
// ============================================

/** Format week date: "2024-02-05" → "Feb 5" */
function formatWeekLabel(dateStr: string): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const parts = dateStr.split('-')
  const month = months[parseInt(parts[1], 10) - 1] ?? parts[1]
  const day = parseInt(parts[2], 10)
  return `${month} ${day}`
}
