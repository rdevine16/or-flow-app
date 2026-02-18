// components/analytics/InsightPanelCallback.tsx
// Callback/Idle Time drill-through panel.
// Displays surgeon comparison cards with status badges, sparklines,
// expandable gap-by-gap detail, recommendation, and financial impact.

'use client'

import { useState, useMemo } from 'react'
import type { SurgeonIdleSummary, FlipRoomAnalysis } from '@/lib/analyticsV2'
import type { Insight } from '@/lib/insightsEngine'
import Sparkline from '@/components/ui/Sparkline'

// ============================================
// STATUS CONFIG
// ============================================

const STATUS_CONFIG: Record<
  SurgeonIdleSummary['status'],
  { bg: string; text: string; border: string; dot: string; label: string }
> = {
  on_track: { bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-200', dot: 'bg-green-500', label: 'On Track' },
  call_sooner: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500', label: 'Call Sooner' },
  call_later: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500', label: 'Call Later' },
  turnover_only: { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200', dot: 'bg-slate-400', label: 'Turnover Only' },
}

const STATUS_SORT_ORDER: Record<SurgeonIdleSummary['status'], number> = {
  call_sooner: 0,
  call_later: 1,
  on_track: 2,
  turnover_only: 3,
}

// ============================================
// HORIZONTAL BAR
// ============================================

function HBar({ value, max, target, color }: {
  value: number
  max: number
  target?: number
  color: string
}) {
  const pct = Math.min((value / max) * 100, 100)
  const targetPct = target ? Math.min((target / max) * 100, 100) : null

  return (
    <div className="relative w-full h-[5px]">
      <div className="absolute inset-0 rounded-full bg-slate-100" />
      <div
        className="absolute top-0 left-0 h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
      {targetPct !== null && (
        <div
          className="absolute top-[-1px] w-[1.5px] rounded-sm bg-slate-400"
          style={{ left: `${targetPct}%`, height: '7px' }}
        />
      )}
    </div>
  )
}

// ============================================
// TYPES
// ============================================

interface InsightPanelCallbackProps {
  surgeonSummaries: SurgeonIdleSummary[]
  flipRoomAnalysis: FlipRoomAnalysis[]
  insight: Insight
  revenuePerMinute: number
  operatingDaysPerYear: number
}

// ============================================
// COMPONENT
// ============================================

export default function InsightPanelCallback({
  surgeonSummaries,
  flipRoomAnalysis,
  insight,
  revenuePerMinute,
  operatingDaysPerYear,
}: InsightPanelCallbackProps) {
  const [expandedSurgeon, setExpandedSurgeon] = useState<string | null>(null)

  // Sort surgeons by actionability: call_sooner first
  const sortedSurgeons = useMemo(
    () => [...surgeonSummaries].sort((a, b) => STATUS_SORT_ORDER[a.status] - STATUS_SORT_ORDER[b.status]),
    [surgeonSummaries]
  )

  // Compute daily idle sparkline data per surgeon from flipRoomAnalysis
  const sparklineData = useMemo(() => {
    const map = new Map<string, number[]>()

    // Group by surgeon → date → idle times
    const bySurgeon = new Map<string, Map<string, number[]>>()
    flipRoomAnalysis.forEach(analysis => {
      const surgeonMap = bySurgeon.get(analysis.surgeonId) || new Map<string, number[]>()
      const dayIdles = surgeonMap.get(analysis.date) || []
      analysis.idleGaps.forEach(gap => dayIdles.push(gap.idleMinutes))
      surgeonMap.set(analysis.date, dayIdles)
      bySurgeon.set(analysis.surgeonId, surgeonMap)
    })

    bySurgeon.forEach((dateMap, surgeonId) => {
      const sortedDates = [...dateMap.keys()].sort()
      const dailyAvgs = sortedDates.map(date => {
        const idles = dateMap.get(date)!
        return idles.reduce((sum, v) => sum + v, 0) / idles.length
      })
      map.set(surgeonId, dailyAvgs)
    })

    return map
  }, [flipRoomAnalysis])

  // Get flip gaps for a surgeon (expanded detail)
  const getFlipGaps = (surgeonId: string) => {
    const gaps: Array<{
      date: string
      fromCase: string
      toCase: string
      fromRoom: string
      toRoom: string
      idleMinutes: number
      optimalCallDelta: number
    }> = []

    flipRoomAnalysis
      .filter(a => a.surgeonId === surgeonId)
      .forEach(analysis => {
        analysis.idleGaps
          .filter(g => g.gapType === 'flip')
          .forEach(gap => {
            gaps.push({
              date: analysis.date,
              fromCase: gap.fromCase,
              toCase: gap.toCase,
              fromRoom: gap.fromRoom ?? '',
              toRoom: gap.toRoom ?? '',
              idleMinutes: gap.idleMinutes,
              optimalCallDelta: gap.optimalCallDelta,
            })
          })
      })

    return gaps
  }

  // Build recommendation parts
  const recommendation = useMemo(() => {
    const callSooner = sortedSurgeons.filter(s => s.status === 'call_sooner')
    const bestSurgeon = sortedSurgeons.find(s => s.status === 'on_track' && s.hasFlipData)

    if (callSooner.length === 0) return null

    const parts: Array<{ name: string; delta: number }> = callSooner.map(s => ({
      name: s.surgeonName,
      delta: Math.round(s.medianCallbackDelta),
    }))

    return { parts, benchmark: bestSurgeon?.surgeonName ?? null }
  }, [sortedSurgeons])

  // Financial calculations
  const financial = useMemo(() => {
    const callSooner = sortedSurgeons.filter(s => s.status === 'call_sooner')
    const totalRecoverableMinutes = callSooner.reduce(
      (sum, s) => sum + (s.medianCallbackDelta * s.flipGapCount), 0
    )

    const uniqueDates = new Set(flipRoomAnalysis.map(a => a.date))
    const periodDays = Math.max(uniqueDates.size, 1)
    const dailyRecoverable = Math.round(totalRecoverableMinutes / periodDays)
    const roundedRate = Math.round(revenuePerMinute)
    const annualProjection = Math.round(dailyRecoverable * revenuePerMinute * operatingDaysPerYear)

    return { dailyRecoverable, revenueRate: roundedRate, annualProjection }
  }, [sortedSurgeons, flipRoomAnalysis, revenuePerMinute, operatingDaysPerYear])

  // Suppress unused variable warning — insight metadata available for future use
  void insight

  // ============================================
  // RENDER
  // ============================================

  if (surgeonSummaries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 bg-indigo-50 rounded-xl flex items-center justify-center mb-4">
          <span className="text-2xl text-indigo-400">↔</span>
        </div>
        <h3 className="text-sm font-semibold text-slate-900 mb-1">No Surgeon Idle Data</h3>
        <p className="text-sm text-slate-400">No multi-case surgeon days found in this period.</p>
      </div>
    )
  }

  return (
    <div>
      {/* Surgeon Comparison */}
      <div className="mb-6">
        <h3 className="text-[13px] font-semibold text-slate-900 mb-3">Surgeon Comparison</h3>
        <div className="flex flex-col gap-2">
          {sortedSurgeons.map(surgeon => {
            const sc = STATUS_CONFIG[surgeon.status]
            const sparkline = sparklineData.get(surgeon.surgeonId) ?? []
            const isExpanded = expandedSurgeon === surgeon.surgeonId
            const maxIdle = 20
            const flipGaps = isExpanded ? getFlipGaps(surgeon.surgeonId) : []

            return (
              <div
                key={surgeon.surgeonId}
                role="button"
                tabIndex={0}
                aria-expanded={isExpanded}
                aria-label={`${surgeon.surgeonName} — ${sc.label}`}
                className={`border rounded-[10px] p-3.5 cursor-pointer transition-all duration-150 ${
                  isExpanded ? 'bg-slate-50/50 border-slate-300' : 'bg-white border-slate-100 hover:border-slate-200'
                }`}
                onClick={() => setExpandedSurgeon(isExpanded ? null : surgeon.surgeonId)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedSurgeon(isExpanded ? null : surgeon.surgeonId) } }}
              >
                {/* Header: name + status + sparkline */}
                <div className="flex justify-between items-center mb-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm font-semibold text-slate-900">{surgeon.surgeonName}</span>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${sc.bg} ${sc.text} ${sc.border}`}>
                      <span className={`w-[5px] h-[5px] rounded-full ${sc.dot}`} />
                      {sc.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {sparkline.length > 1 && (
                      <Sparkline
                        data={sparkline}
                        color={surgeon.status === 'on_track' ? '#10b981' : '#f59e0b'}
                        width={64}
                        height={22}
                      />
                    )}
                    <span className="text-[10px] text-slate-400" aria-hidden="true">
                      {isExpanded ? '▾' : '▸'}
                    </span>
                  </div>
                </div>

                {/* Metrics grid */}
                <div className="grid grid-cols-4 gap-2">
                  {/* Flip Idle */}
                  <div>
                    <div className="text-[10px] text-slate-400 mb-0.5">Flip Idle</div>
                    <div className={`text-base font-bold font-mono ${
                      surgeon.hasFlipData
                        ? surgeon.medianFlipIdle <= 5 ? 'text-emerald-500' : surgeon.medianFlipIdle <= 10 ? 'text-amber-600' : 'text-red-500'
                        : 'text-slate-300'
                    }`}>
                      {surgeon.hasFlipData ? `${Math.round(surgeon.medianFlipIdle)}m` : '—'}
                    </div>
                    {surgeon.hasFlipData && (
                      <HBar
                        value={surgeon.medianFlipIdle}
                        max={maxIdle}
                        target={5}
                        color={surgeon.medianFlipIdle <= 5 ? '#10b981' : surgeon.medianFlipIdle <= 10 ? '#f59e0b' : '#ef4444'}
                      />
                    )}
                  </div>

                  {/* Call Delta */}
                  <div>
                    <div className="text-[10px] text-slate-400 mb-0.5">Call &#916;</div>
                    <div className={`text-base font-bold font-mono ${
                      surgeon.medianCallbackDelta > 3 ? 'text-amber-600' : 'text-slate-500'
                    }`}>
                      {surgeon.medianCallbackDelta > 0 ? `${Math.round(surgeon.medianCallbackDelta)}m` : '—'}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {surgeon.medianCallbackDelta > 0 ? 'call earlier' : 'on time'}
                    </div>
                  </div>

                  {/* Cases */}
                  <div>
                    <div className="text-[10px] text-slate-400 mb-0.5">Cases</div>
                    <div className="text-base font-bold font-mono text-slate-800">{surgeon.caseCount}</div>
                    <div className="text-[10px] text-slate-400">
                      {surgeon.flipGapCount} flip{surgeon.flipGapCount !== 1 ? 's' : ''}
                    </div>
                  </div>

                  {/* Same Room */}
                  <div>
                    <div className="text-[10px] text-slate-400 mb-0.5">Same Rm</div>
                    <div className={`text-base font-bold font-mono ${
                      surgeon.sameRoomGapCount > 0
                        ? surgeon.medianSameRoomIdle <= 30 ? 'text-emerald-500' : 'text-amber-600'
                        : 'text-slate-300'
                    }`}>
                      {surgeon.sameRoomGapCount > 0 ? `${Math.round(surgeon.medianSameRoomIdle)}m` : '—'}
                    </div>
                    {surgeon.sameRoomGapCount > 0 && (
                      <div className="text-[10px] text-slate-400">{surgeon.sameRoomGapCount} gap{surgeon.sameRoomGapCount !== 1 ? 's' : ''}</div>
                    )}
                  </div>
                </div>

                {/* Expanded: Flip Room Transitions */}
                {isExpanded && flipGaps.length > 0 && (
                  <div className="mt-3.5 pt-3.5 border-t border-slate-100">
                    <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                      Flip Room Transitions
                    </div>

                    {/* Table header */}
                    <div className="grid grid-cols-[60px_1fr_1fr_50px_50px_64px] py-1.5 border-b border-slate-100">
                      {['Date', 'From', 'To', 'Idle', 'Save', ''].map(h => (
                        <span key={h} className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">{h}</span>
                      ))}
                    </div>

                    {/* Table rows */}
                    {flipGaps.map((gap, i) => (
                      <div
                        key={`${gap.date}-${gap.fromCase}-${i}`}
                        className="grid grid-cols-[60px_1fr_1fr_50px_50px_64px] py-2 border-b border-slate-50 items-center"
                      >
                        <span className="text-xs text-slate-500">{formatDate(gap.date)}</span>
                        <div>
                          <span className="text-xs font-medium text-slate-800">{gap.fromCase}</span>
                          {gap.fromRoom && <span className="text-[10px] text-slate-400 ml-1">{gap.fromRoom}</span>}
                        </div>
                        <div>
                          <span className="text-xs font-medium text-slate-800">{gap.toCase}</span>
                          {gap.toRoom && <span className="text-[10px] text-slate-400 ml-1">{gap.toRoom}</span>}
                        </div>
                        <span className={`text-[13px] font-semibold font-mono ${
                          gap.idleMinutes <= 5 ? 'text-emerald-500' : gap.idleMinutes <= 10 ? 'text-amber-600' : 'text-red-500'
                        }`}>
                          {Math.round(gap.idleMinutes)}m
                        </span>
                        <span className={`text-[13px] font-semibold font-mono ${
                          gap.optimalCallDelta > 0 ? 'text-amber-600' : 'text-slate-300'
                        }`}>
                          {gap.optimalCallDelta > 0 ? `${Math.round(gap.optimalCallDelta)}m` : '—'}
                        </span>
                        <HBar
                          value={gap.idleMinutes}
                          max={maxIdle}
                          target={5}
                          color={gap.idleMinutes <= 5 ? '#10b981' : gap.idleMinutes <= 10 ? '#f59e0b' : '#ef4444'}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Expanded: No flip gaps available */}
                {isExpanded && flipGaps.length === 0 && surgeon.hasFlipData && (
                  <div className="mt-3.5 pt-3.5 border-t border-slate-100">
                    <p className="text-xs text-slate-400">No flip room transitions recorded.</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Recommendation */}
      {recommendation && (
        <div className="bg-amber-50 border border-amber-200 rounded-[10px] p-3.5 mb-6">
          <div className="flex items-start gap-2.5">
            <span className="text-sm leading-none mt-0.5" aria-hidden="true">💡</span>
            <div>
              <div className="text-[13px] font-semibold text-amber-900 mb-1">Recommendation</div>
              <p className="text-xs text-amber-800 leading-relaxed">
                {recommendation.parts.map((p, i) => (
                  <span key={p.name}>
                    {i > 0 && ' '}
                    For {p.name}, call the next patient to the flip room{' '}
                    <strong>{p.delta} minute{p.delta !== 1 ? 's' : ''}</strong> earlier than current practice.
                  </span>
                ))}
                {recommendation.benchmark && (
                  <span> {recommendation.benchmark} is the benchmark — no change needed.</span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Financial Impact */}
      {financial.dailyRecoverable > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-[10px] p-3.5">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
            Financial Impact Estimate
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-[10px] text-slate-400 mb-0.5">Recoverable min/day</div>
              <div className="text-lg font-bold font-mono text-slate-900">{financial.dailyRecoverable}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 mb-0.5">Revenue rate</div>
              <div className="text-lg font-bold font-mono text-slate-900">
                ${financial.revenueRate}<span className="text-[11px] text-slate-400">/min</span>
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 mb-0.5">Annual projection</div>
              <div className="text-lg font-bold font-mono text-indigo-600">
                ${formatCompact(financial.annualProjection)}
              </div>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-2.5 italic">
            Based on ${financial.revenueRate}/OR minute, {operatingDaysPerYear} operating days/year. Configure in Settings.
          </p>
        </div>
      )}
    </div>
  )
}

// ============================================
// UTILITIES
// ============================================

/** Format date string: "2024-02-03" → "Feb 3" */
function formatDate(dateStr: string): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const parts = dateStr.split('-')
  const month = months[parseInt(parts[1], 10) - 1] ?? parts[1]
  const day = parseInt(parts[2], 10)
  return `${month} ${day}`
}

/** Format number compactly: 24000 → "24K" */
function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`
  return value.toString()
}
