// components/analytics/InsightPanelFCOTS.tsx
// FCOTS (First Case On-Time Start) drill-through panel.
// Displays summary strip, per-case detail table, and pattern detection.

'use client'

import { useMemo } from 'react'
import type { FCOTSDetail, FCOTSResult } from '@/lib/analyticsV2'

// ============================================
// TYPES
// ============================================

interface InsightPanelFCOTSProps {
  fcots: FCOTSResult
  graceMinutes: number
  targetPercent: number
}

interface SurgeonPattern {
  name: string
  lateCount: number
  totalCount: number
  lateRate: number
  avgDelay: number
}

interface RoomPattern {
  name: string
  lateCount: number
  totalCount: number
  lateRate: number
}

interface DayPattern {
  name: string
  lateRate: number
  lateCount: number
  totalCount: number
}

// ============================================
// PATTERN DETECTION
// ============================================

function detectPatterns(details: FCOTSDetail[]) {
  // Group by surgeon
  const bySurgeon = new Map<string, FCOTSDetail[]>()
  details.forEach(d => {
    const arr = bySurgeon.get(d.surgeonName) || []
    arr.push(d)
    bySurgeon.set(d.surgeonName, arr)
  })

  const surgeonPatterns: SurgeonPattern[] = []
  bySurgeon.forEach((cases, name) => {
    const lateCases = cases.filter(c => !c.isOnTime)
    const lateRate = cases.length > 0 ? (lateCases.length / cases.length) * 100 : 0
    if (lateRate > 50 && lateCases.length >= 2) {
      const avgDelay = lateCases.reduce((sum, c) => sum + c.delayMinutes, 0) / lateCases.length
      surgeonPatterns.push({
        name,
        lateCount: lateCases.length,
        totalCount: cases.length,
        lateRate,
        avgDelay: Math.round(avgDelay),
      })
    }
  })
  surgeonPatterns.sort((a, b) => b.lateRate - a.lateRate || b.avgDelay - a.avgDelay)

  // Group by room
  const byRoom = new Map<string, FCOTSDetail[]>()
  details.forEach(d => {
    const arr = byRoom.get(d.roomName) || []
    arr.push(d)
    byRoom.set(d.roomName, arr)
  })

  const roomPatterns: RoomPattern[] = []
  byRoom.forEach((cases, name) => {
    const lateCases = cases.filter(c => !c.isOnTime)
    const lateRate = cases.length > 0 ? (lateCases.length / cases.length) * 100 : 0
    if (lateRate > 50 && lateCases.length >= 2) {
      roomPatterns.push({
        name,
        lateCount: lateCases.length,
        totalCount: cases.length,
        lateRate,
      })
    }
  })
  roomPatterns.sort((a, b) => b.lateRate - a.lateRate)

  // Group by day of week
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const byDay = new Map<number, { late: number; total: number }>()
  details.forEach(d => {
    const dow = new Date(d.scheduledDate + 'T00:00:00').getDay()
    const entry = byDay.get(dow) || { late: 0, total: 0 }
    entry.total++
    if (!d.isOnTime) entry.late++
    byDay.set(dow, entry)
  })

  let worstDay: DayPattern | null = null
  for (const [dow, data] of byDay.entries()) {
    if (data.total < 2) continue
    const rate = (data.late / data.total) * 100
    if (rate > 50 && (!worstDay || rate > worstDay.lateRate)) {
      worstDay = { name: dayNames[dow], lateRate: Math.round(rate), lateCount: data.late, totalCount: data.total }
    }
  }

  return { surgeonPatterns, roomPatterns, worstDay }
}

function buildPatternNarrative(patterns: ReturnType<typeof detectPatterns>): string | null {
  const parts: string[] = []

  patterns.surgeonPatterns.forEach(s => {
    parts.push(
      `${s.name} was late for ${s.lateCount} of ${s.totalCount} first cases (avg +${s.avgDelay} min).`
    )
  })

  patterns.roomPatterns.forEach(r => {
    parts.push(
      `${r.name} had the most delays (${r.lateCount} of ${r.totalCount} days).`
    )
  })

  if (patterns.worstDay) {
    parts.push(
      `${patterns.worstDay.name}s were the worst day (${patterns.worstDay.lateCount} of ${patterns.worstDay.totalCount} late).`
    )
  }

  if (parts.length === 0) return null

  // Add actionable recommendation
  if (patterns.surgeonPatterns.length > 0) {
    const worst = patterns.surgeonPatterns[0]
    parts.push(
      `Consider scheduling ${worst.name} in later slots or addressing arrival timing directly.`
    )
  }

  return parts.join(' ')
}

// ============================================
// COMPONENT
// ============================================

export default function InsightPanelFCOTS({
  fcots,
  graceMinutes,
  targetPercent,
}: InsightPanelFCOTSProps) {
  const details = fcots.firstCaseDetails

  // Compute summary stats
  const summary = useMemo(() => {
    const total = details.length
    const lateCases = details.filter(d => !d.isOnTime)
    const lateCount = lateCases.length
    const onTimeRate = total > 0 ? Math.round(((total - lateCount) / total) * 100) : 0
    const avgDelay = lateCases.length > 0
      ? Math.round(lateCases.reduce((sum, d) => sum + d.delayMinutes, 0) / lateCases.length)
      : 0

    return { onTimeRate, lateCount, total, avgDelay }
  }, [details])

  // Detect patterns
  const patterns = useMemo(() => detectPatterns(details), [details])
  const narrative = useMemo(() => buildPatternNarrative(patterns), [patterns])

  // Sort: late first, then by delay descending
  const sortedDetails = useMemo(
    () => [...details].sort((a, b) => {
      if (a.isOnTime !== b.isOnTime) return a.isOnTime ? 1 : -1
      return b.delayMinutes - a.delayMinutes
    }),
    [details]
  )

  // ============================================
  // EMPTY STATE
  // ============================================

  if (details.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 bg-indigo-50 rounded-xl flex items-center justify-center mb-4">
          <span className="text-2xl text-indigo-400">⏱</span>
        </div>
        <h3 className="text-sm font-semibold text-slate-900 mb-1">No First Case Data</h3>
        <p className="text-sm text-slate-400">No first cases found in this period.</p>
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
          label="On-Time Rate"
          value={`${summary.onTimeRate}%`}
          color={summary.onTimeRate >= targetPercent ? 'text-emerald-500' : 'text-red-500'}
        />
        <SummaryCard
          label="Late Cases"
          value={String(summary.lateCount)}
          color={summary.lateCount > 0 ? 'text-red-500' : 'text-slate-900'}
        />
        <SummaryCard
          label="Total First Cases"
          value={String(summary.total)}
          color="text-slate-900"
        />
        <SummaryCard
          label="Avg Delay"
          value={summary.avgDelay > 0 ? `${summary.avgDelay}m` : '0m'}
          color={summary.avgDelay > graceMinutes ? 'text-amber-600' : 'text-slate-900'}
        />
      </div>

      {/* Per-case detail table */}
      <h3 className="text-[13px] font-semibold text-slate-900 mb-2.5">First Case Detail</h3>
      <div className="bg-white border border-slate-100 rounded-[10px] overflow-hidden mb-5">
        {/* Table header */}
        <div className="grid grid-cols-[60px_56px_110px_64px_64px_52px_60px] px-3.5 py-2 bg-slate-50/80 border-b border-slate-100">
          {['Date', 'Room', 'Surgeon', 'Sched', 'Actual', 'Delay', 'Status'].map(h => (
            <span key={h} className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">{h}</span>
          ))}
        </div>

        {/* Table rows */}
        {sortedDetails.map((c, i) => (
          <div
            key={c.caseId}
            className={`grid grid-cols-[60px_56px_110px_64px_64px_52px_60px] px-3.5 py-2.5 items-center ${
              i < sortedDetails.length - 1 ? 'border-b border-slate-50' : ''
            }`}
          >
            <span className="text-xs text-slate-500">{formatDate(c.scheduledDate)}</span>
            <span className="text-xs font-medium text-slate-800">{c.roomName}</span>
            <span className="text-xs text-slate-800 truncate">{c.surgeonName}</span>
            <span className="text-xs text-slate-500 font-mono">{c.scheduledStart}</span>
            <span className={`text-xs font-mono font-semibold ${
              c.isOnTime ? 'text-emerald-500' : 'text-red-500'
            }`}>
              {c.actualStart}
            </span>
            <span className={`text-xs font-mono font-semibold ${
              c.delayMinutes <= graceMinutes ? 'text-emerald-500' : c.delayMinutes <= 10 ? 'text-amber-600' : 'text-red-500'
            }`}>
              {c.delayMinutes > 0 ? `+${c.delayMinutes}m` : '0m'}
            </span>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
              c.isOnTime
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-red-50 text-red-700'
            }`}>
              {c.isOnTime ? 'On Time' : 'Late'}
            </span>
          </div>
        ))}
      </div>

      {/* Pattern Detection */}
      {narrative && (
        <div className={`border rounded-[10px] p-3.5 ${
          patterns.surgeonPatterns.length > 0
            ? 'bg-red-50 border-red-200'
            : 'bg-amber-50 border-amber-200'
        }`}>
          <div className="flex items-start gap-2.5">
            <span className="text-sm leading-none mt-0.5" aria-hidden="true">📊</span>
            <div>
              <div className={`text-[13px] font-semibold mb-1 ${
                patterns.surgeonPatterns.length > 0 ? 'text-red-900' : 'text-amber-900'
              }`}>
                Pattern Detected
              </div>
              <p className={`text-xs leading-relaxed m-0 ${
                patterns.surgeonPatterns.length > 0 ? 'text-red-800' : 'text-amber-800'
              }`}>
                {narrative}
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
