// components/analytics/financials/SurgeonDailyActivity.tsx
// Daily Activity sub-tab: day rows with expandable case detail,
// phase pills, and surgical uptime visualization bar

'use client'

import { useState, useMemo } from 'react'
import { ChevronRight, ChevronDown, Clock } from 'lucide-react'

import {
  CaseCompletionStats,
  CasePhaseDuration,
  PhasePillColor,
} from './types'
import { formatDuration, fmt, normalizeJoin } from './utils'
import { ComparisonPill, PhasePill } from './shared'

// ============================================
// TYPES
// ============================================

interface SurgeonDailyActivityProps {
  cases: CaseCompletionStats[]
  casePhaseDurations: Map<string, CasePhaseDuration[]>
  loadingPhases: boolean
  surgeonMedians: Record<string, { medianDuration: number | null; medianProfit: number | null }>
  onCaseClick?: (caseId: string) => void
}

interface DaySummary {
  dateKey: string
  dateLabel: string
  dayOfWeek: string
  cases: CaseCompletionStats[]
  totalProfit: number
  totalDuration: number
  avgProfit: number
}

// ============================================
// HELPERS
// ============================================

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function groupCasesByDate(cases: CaseCompletionStats[]): DaySummary[] {
  const dayMap = new Map<string, CaseCompletionStats[]>()

  cases.forEach(c => {
    const existing = dayMap.get(c.case_date) || []
    existing.push(c)
    dayMap.set(c.case_date, existing)
  })

  return Array.from(dayMap.entries())
    .map(([dateKey, dayCases]) => {
      const d = new Date(dateKey + 'T00:00:00')
      const dateLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const dayOfWeek = DAYS_OF_WEEK[d.getDay()]
      const totalProfit = dayCases.reduce((sum, c) => sum + (c.profit || 0), 0)
      const totalDuration = dayCases.reduce((sum, c) => sum + (c.total_duration_minutes || 0), 0)
      const avgProfit = dayCases.length > 0 ? totalProfit / dayCases.length : 0

      return { dateKey, dateLabel, dayOfWeek, cases: dayCases, totalProfit, totalDuration, avgProfit }
    })
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey))
}

const PHASE_DOT_MAP: Record<PhasePillColor, string> = {
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  amber: 'bg-amber-500',
  violet: 'bg-violet-500',
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function SurgeonDailyActivity({
  cases,
  casePhaseDurations,
  loadingPhases,
  surgeonMedians,
  onCaseClick,
}: SurgeonDailyActivityProps) {
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set())

  const daySummaries = useMemo(() => groupCasesByDate(cases), [cases])

  const toggleDay = (dateKey: string) => {
    setExpandedDays(prev => {
      const next = new Set(prev)
      if (next.has(dateKey)) next.delete(dateKey)
      else next.add(dateKey)
      return next
    })
  }

  // Collect phase labels for legend from first case that has phases
  const legendPhases: CasePhaseDuration[] = useMemo(() => {
    for (const c of cases) {
      const phases = casePhaseDurations.get(c.case_id)
      if (phases && phases.length > 0) return phases
    }
    return []
  }, [cases, casePhaseDurations])

  if (daySummaries.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
        <Clock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-slate-900">No Cases Found</h3>
        <p className="text-slate-500 mt-1">
          No cases in the selected date range for this surgeon.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Daily Activity</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Click a day to view detailed case breakdown
            </p>
          </div>
          {legendPhases.length > 0 && (
            <div className="flex items-center gap-3 text-[10px] text-slate-400">
              {legendPhases.map(phase => (
                <span key={phase.label} className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${PHASE_DOT_MAP[phase.color]}`} />
                  {phase.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Day rows */}
      <div className="divide-y divide-slate-50">
        {daySummaries.map(day => {
          const isExpanded = expandedDays.has(day.dateKey)

          return (
            <div key={day.dateKey}>
              {/* Day summary row */}
              <button
                onClick={() => toggleDay(day.dateKey)}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-blue-50/50 cursor-pointer transition-all group text-left"
              >
                <div className="w-16">
                  <div className="text-base font-bold text-slate-900">{day.dateLabel}</div>
                  <div className="text-xs text-slate-500">{day.dayOfWeek}</div>
                </div>

                <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-semibold">
                  {day.cases.length} case{day.cases.length !== 1 ? 's' : ''}
                </span>

                <div className="flex-1 flex items-center gap-6 justify-end">
                  <div className="text-right">
                    <div className="text-[10px] text-slate-400 uppercase">Duration</div>
                    <div className="text-sm font-semibold text-slate-900">
                      {formatDuration(day.totalDuration)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-slate-400 uppercase">Total Profit</div>
                    <div
                      className={`text-sm font-bold ${
                        day.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {fmt(day.totalProfit)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-slate-400 uppercase">Avg/Case</div>
                    <div className="text-sm font-semibold text-slate-900">
                      {fmt(day.avgProfit)}
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  )}
                </div>
              </button>

              {/* Expanded case cards */}
              {isExpanded && (
                <DayExpanded
                  cases={day.cases}
                  casePhaseDurations={casePhaseDurations}
                  loadingPhases={loadingPhases}
                  surgeonMedians={surgeonMedians}
                  onCaseClick={onCaseClick}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ============================================
// EXPANDED DAY DETAIL
// ============================================

function DayExpanded({
  cases,
  casePhaseDurations,
  loadingPhases,
  surgeonMedians,
  onCaseClick,
}: {
  cases: CaseCompletionStats[]
  casePhaseDurations: Map<string, CasePhaseDuration[]>
  loadingPhases: boolean
  surgeonMedians: Record<string, { medianDuration: number | null; medianProfit: number | null }>
  onCaseClick?: (caseId: string) => void
}) {
  // Sort by start time ascending
  const sorted = [...cases].sort((a, b) => {
    const aTime = a.actual_start_time || a.scheduled_start_time || ''
    const bTime = b.actual_start_time || b.scheduled_start_time || ''
    return aTime.localeCompare(bTime)
  })

  return (
    <div className="bg-slate-50/50 border-t border-slate-100 divide-y divide-slate-100">
      {sorted.map(caseData => {
        const phases = casePhaseDurations.get(caseData.case_id)
        const procMedians = caseData.procedure_type_id
          ? surgeonMedians[caseData.procedure_type_id]
          : null
        const durDiff =
          caseData.total_duration_minutes && procMedians?.medianDuration
            ? caseData.total_duration_minutes - procMedians.medianDuration
            : null
        const profitDiff =
          caseData.profit && procMedians?.medianProfit
            ? caseData.profit - procMedians.medianProfit
            : null

        const procJoined = normalizeJoin(caseData.procedure_types)
        const roomJoined = normalizeJoin(caseData.or_rooms)
        const payerJoined = normalizeJoin(caseData.payers)
        const procedureName = procJoined?.name || 'Unknown Procedure'
        const roomName = roomJoined?.name || ''
        const payerName = payerJoined?.name || ''

        // Surgical uptime
        const surgicalMin = caseData.surgical_duration_minutes || 0
        const totalMin = caseData.total_duration_minutes || 0
        const uptimePct = totalMin > 0 ? (surgicalMin / totalMin) * 100 : 0

        const isLoss = (caseData.profit ?? 0) < 0

        return (
          <div
            key={caseData.case_id}
            onClick={() => onCaseClick?.(caseData.case_id)}
            className={`px-5 py-4 ml-4 transition-colors ${
              isLoss ? 'border-l-2 border-l-red-400 bg-red-50/30' : ''
            } ${onCaseClick ? 'cursor-pointer hover:bg-slate-50/50' : ''}`}
          >
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                {/* Case header */}
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-slate-900">{procedureName}</span>
                  {roomName && (
                    <>
                      <span className="text-slate-300">&middot;</span>
                      <span className="text-xs text-slate-500">{roomName}</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-mono text-[10px] text-slate-400">
                    {caseData.case_number}
                  </span>
                  {payerName && (
                    <>
                      <span className="text-[10px] text-slate-300">&middot;</span>
                      <span className="text-[10px] text-slate-400">{payerName}</span>
                    </>
                  )}
                </div>

                {/* Phase pills */}
                {phases && phases.length > 0 && (
                  <div className="flex items-center gap-1 mt-2">
                    {phases.map(phase => (
                      <PhasePill
                        key={phase.label}
                        label={phase.label}
                        minutes={phase.minutes}
                        color={phase.color}
                      />
                    ))}
                  </div>
                )}
                {loadingPhases && !phases && (
                  <div className="flex items-center gap-1.5 mt-2">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className="h-6 w-16 bg-slate-100 rounded-md animate-pulse" />
                    ))}
                  </div>
                )}

                {/* Surgical uptime bar */}
                {totalMin > 0 && (
                  <div className="mt-2.5">
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 mb-1">
                      <span>Surgical Uptime</span>
                      <span className="tabular-nums font-medium text-slate-600">
                        {Math.round(uptimePct)}%
                      </span>
                      <span className="text-slate-300">
                        ({formatDuration(surgicalMin)} of {formatDuration(totalMin)})
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden w-48">
                      <div
                        className={`h-full rounded-full transition-all ${
                          uptimePct >= 70
                            ? 'bg-green-400'
                            : uptimePct >= 50
                              ? 'bg-amber-400'
                              : 'bg-red-400'
                        }`}
                        style={{ width: `${Math.min(uptimePct, 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Right side: duration + profit */}
              <div className="flex items-center gap-5 shrink-0">
                <div className="text-right">
                  <div className="text-[10px] text-slate-400 uppercase mb-0.5">Duration</div>
                  <div className="flex items-center justify-end gap-1.5">
                    <span className="text-sm font-semibold text-slate-900 tabular-nums">
                      {formatDuration(caseData.total_duration_minutes)}
                    </span>
                    {durDiff !== null && <ComparisonPill value={durDiff} unit="min" invert />}
                  </div>
                </div>
                <div className="text-right min-w-[120px]">
                  <div className="text-[10px] text-slate-400 uppercase mb-0.5">Profit</div>
                  <div className="flex items-center justify-end gap-1.5">
                    <span
                      className={`text-sm font-bold tabular-nums ${
                        (caseData.profit ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-600'
                      }`}
                    >
                      {fmt(caseData.profit ?? 0)}
                    </span>
                    {profitDiff !== null && <ComparisonPill value={profitDiff} format="currency" />}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
