// components/analytics/InsightPanelNonOpTime.tsx
// Non-operative time drill-through panel.
// Displays case time breakdown bars and analysis of non-operative time contributors.

'use client'

import { useMemo } from 'react'
import type { AnalyticsOverview } from '@/lib/analyticsV2'

// ============================================
// TYPES
// ============================================

interface InsightPanelNonOpTimeProps {
  analytics: AnalyticsOverview
}

interface TimePhase {
  label: string
  minutes: number
  percent: number
  isNonOperative: boolean
  color: string
  bgColor: string
}

// ============================================
// COMPONENT
// ============================================

export default function InsightPanelNonOpTime({ analytics }: InsightPanelNonOpTimeProps) {
  const {
    avgPreOpTime,
    avgAnesthesiaTime,
    avgSurgicalTime,
    avgClosingTime,
    avgEmergenceTime,
    avgTotalCaseTime,
    completedCases,
  } = analytics

  // Build phase breakdown
  const phases = useMemo((): TimePhase[] => {
    const total = avgTotalCaseTime
    if (total === 0) return []

    const raw: Array<{ label: string; minutes: number; isNonOperative: boolean; color: string; bgColor: string }> = [
      { label: 'Pre-Op', minutes: avgPreOpTime, isNonOperative: true, color: 'bg-amber-500', bgColor: 'bg-amber-50' },
      { label: 'Anesthesia', minutes: avgAnesthesiaTime, isNonOperative: false, color: 'bg-blue-500', bgColor: 'bg-blue-50' },
      { label: 'Surgical', minutes: avgSurgicalTime, isNonOperative: false, color: 'bg-emerald-500', bgColor: 'bg-emerald-50' },
      { label: 'Closing', minutes: avgClosingTime, isNonOperative: true, color: 'bg-purple-500', bgColor: 'bg-purple-50' },
      { label: 'Emergence', minutes: avgEmergenceTime, isNonOperative: true, color: 'bg-rose-400', bgColor: 'bg-rose-50' },
    ]

    return raw
      .filter(p => p.minutes > 0)
      .map(p => ({
        ...p,
        minutes: Math.round(p.minutes),
        percent: Math.round((p.minutes / total) * 100),
      }))
  }, [avgPreOpTime, avgAnesthesiaTime, avgSurgicalTime, avgClosingTime, avgEmergenceTime, avgTotalCaseTime])

  // Summary stats
  const summary = useMemo(() => {
    const nonOpMinutes = avgPreOpTime + avgClosingTime + avgEmergenceTime
    const totalMinutes = avgTotalCaseTime
    const nonOpPercent = totalMinutes > 0 ? Math.round((nonOpMinutes / totalMinutes) * 100) : 0
    const operativeMinutes = avgSurgicalTime + avgAnesthesiaTime
    const operativePercent = totalMinutes > 0 ? Math.round((operativeMinutes / totalMinutes) * 100) : 0

    // Find dominant non-op contributor
    const nonOpPhases = [
      { label: 'Pre-op', minutes: avgPreOpTime },
      { label: 'Closing', minutes: avgClosingTime },
      { label: 'Emergence', minutes: avgEmergenceTime },
    ]
    const dominant = nonOpPhases.reduce((a, b) => a.minutes > b.minutes ? a : b)

    return {
      nonOpMinutes: Math.round(nonOpMinutes),
      nonOpPercent,
      operativeMinutes: Math.round(operativeMinutes),
      operativePercent,
      totalMinutes: Math.round(totalMinutes),
      dominant,
    }
  }, [avgPreOpTime, avgAnesthesiaTime, avgSurgicalTime, avgClosingTime, avgEmergenceTime, avgTotalCaseTime])

  // ============================================
  // EMPTY STATE
  // ============================================

  if (phases.length === 0 || completedCases === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 bg-indigo-50 rounded-xl flex items-center justify-center mb-4">
          <span className="text-2xl text-indigo-400">&#x23F3;</span>
        </div>
        <h3 className="text-sm font-semibold text-slate-900 mb-1">No Time Data</h3>
        <p className="text-sm text-slate-400">No completed cases with time breakdown data in this period.</p>
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
          label="Non-Op Time"
          value={`${summary.nonOpMinutes}m`}
          color={summary.nonOpPercent > 40 ? 'text-amber-600' : 'text-slate-900'}
        />
        <SummaryCard
          label="% of Total"
          value={`${summary.nonOpPercent}%`}
          color={summary.nonOpPercent > 40 ? 'text-amber-600' : 'text-slate-900'}
        />
        <SummaryCard
          label="Avg Case Time"
          value={`${summary.totalMinutes}m`}
          color="text-slate-900"
        />
        <SummaryCard
          label="Cases"
          value={String(completedCases)}
          color="text-slate-900"
        />
      </div>

      {/* Case Time Breakdown */}
      <h3 className="text-[13px] font-semibold text-slate-900 mb-2.5">Case Time Breakdown</h3>
      <div className="bg-white border border-slate-100 rounded-[10px] p-4 mb-5 space-y-3">
        {phases.map(phase => (
          <TimeBar key={phase.label} phase={phase} maxMinutes={Math.max(...phases.map(p => p.minutes))} />
        ))}
      </div>

      {/* Operative vs Non-Operative Split */}
      <h3 className="text-[13px] font-semibold text-slate-900 mb-2.5">Time Split</h3>
      <div className="bg-white border border-slate-100 rounded-[10px] p-4 mb-5">
        {/* Stacked horizontal bar */}
        <div className="flex h-6 rounded-full overflow-hidden mb-3">
          <div
            className="bg-emerald-500 transition-all"
            style={{ width: `${summary.operativePercent}%` }}
            title={`Operative: ${summary.operativePercent}%`}
          />
          <div
            className="bg-amber-400 transition-all"
            style={{ width: `${summary.nonOpPercent}%` }}
            title={`Non-operative: ${summary.nonOpPercent}%`}
          />
        </div>
        <div className="flex justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-slate-600">Operative: {summary.operativePercent}% ({summary.operativeMinutes}m)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span className="text-slate-600">Non-operative: {summary.nonOpPercent}% ({summary.nonOpMinutes}m)</span>
          </div>
        </div>
      </div>

      {/* Analysis Box */}
      {summary.nonOpPercent > 25 && (
        <div className={`border rounded-[10px] p-3.5 ${
          summary.nonOpPercent > 40
            ? 'bg-amber-50 border-amber-200'
            : 'bg-indigo-50 border-indigo-200'
        }`}>
          <div className="flex items-start gap-2.5">
            <span className="text-sm leading-none mt-0.5" aria-hidden="true">&#x1F4CA;</span>
            <div>
              <div className={`text-[13px] font-semibold mb-1 ${
                summary.nonOpPercent > 40 ? 'text-amber-900' : 'text-indigo-900'
              }`}>
                Non-Operative Time Analysis
              </div>
              <p className={`text-xs leading-relaxed m-0 ${
                summary.nonOpPercent > 40 ? 'text-amber-800' : 'text-indigo-800'
              }`}>
                Non-operative time accounts for {summary.nonOpPercent}% of total case time.
                {' '}{summary.dominant.label} ({Math.round(summary.dominant.minutes)} min) is the largest
                non-operative contributor. Compare to average surgical time of {Math.round(avgSurgicalTime)} min.
                {summary.nonOpPercent > 35 && (
                  <> Reducing {summary.dominant.label.toLowerCase()} time by 20% would save ~{Math.round(summary.dominant.minutes * 0.2)} min per case.</>
                )}
              </p>
            </div>
          </div>
        </div>
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

function TimeBar({ phase, maxMinutes }: { phase: TimePhase; maxMinutes: number }) {
  const barWidth = maxMinutes > 0 ? (phase.minutes / maxMinutes) * 100 : 0

  return (
    <div className="flex items-center gap-3">
      <div className="w-[72px] flex-shrink-0">
        <span className={`text-xs font-medium ${phase.isNonOperative ? 'text-amber-700' : 'text-slate-700'}`}>
          {phase.label}
        </span>
      </div>
      <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${phase.color} transition-all`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
      <div className="w-[80px] flex-shrink-0 text-right">
        <span className="text-xs font-mono font-semibold text-slate-800">{phase.minutes} min</span>
        <span className="text-[10px] text-slate-400 ml-1">({phase.percent}%)</span>
      </div>
    </div>
  )
}
