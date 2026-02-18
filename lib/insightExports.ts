// ============================================
// lib/insightExports.ts
// ============================================
// Client-side XLSX export for insight drill-through panels.
// Uses SheetJS (xlsx) for workbook generation — install: npm i xlsx
//
// Each export function:
//   1. Takes analytics data already available in the component
//   2. Builds a multi-sheet workbook with summary + detail
//   3. Triggers a browser download
//
// Usage:
//   import { exportCallbackOptimization } from '@/lib/insightExports'
//   exportCallbackOptimization(analytics.surgeonIdleSummaries, analytics.flipRoomAnalysis)
// ============================================

import * as XLSX from 'xlsx'

import type {
  AnalyticsOverview,
  SurgeonIdleSummary,
  FlipRoomAnalysis,
  KPIResult,
  DailyTrackerData,
  FCOTSDetail,
  FCOTSResult,
  TurnoverDetail,
  TurnoverResult,
  CancellationResult,
  CaseVolumeResult,
  ORUtilizationResult,
  FacilityAnalyticsConfig,
} from '@/lib/analyticsV2'

import type { Insight } from '@/lib/insightsEngine'

// ============================================
// SHARED UTILITIES
// ============================================

const DEFAULT_REVENUE_PER_MIN = 36
const DEFAULT_OPERATING_DAYS = 250

/**
 * Trigger browser download of an XLSX workbook.
 */
function downloadWorkbook(wb: XLSX.WorkBook, filename: string): void {
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Format a date string for display in exports.
 */
function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T12:00:00')
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return dateStr
  }
}

/**
 * Get current date formatted for filenames.
 */
function getDateStamp(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Apply column widths to a worksheet based on content.
 */
function autoFitColumns(ws: XLSX.WorkSheet, data: unknown[][]): void {
  if (data.length === 0) return
  const colWidths: number[] = []
  data.forEach(row => {
    row.forEach((cell, i) => {
      const len = cell !== null && cell !== undefined ? String(cell).length : 0
      colWidths[i] = Math.max(colWidths[i] || 8, Math.min(len + 2, 40))
    })
  })
  ws['!cols'] = colWidths.map(w => ({ wch: w }))
}

/**
 * Create a worksheet from a 2D array with auto-fitted columns.
 */
function createSheet(data: unknown[][]): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet(data)
  autoFitColumns(ws, data)
  return ws
}

// ============================================
// 1. CALLBACK OPTIMIZATION EXPORT
// ============================================

/**
 * Export callback optimization data with three sheets:
 * - Summary: per-surgeon aggregates with status and recommendations
 * - Flip Transitions: every flip room gap with timing detail
 * - Financial Impact: recoverable minutes and revenue projections
 */
export function exportCallbackOptimization(
  summaries: SurgeonIdleSummary[],
  details: FlipRoomAnalysis[],
  config?: { revenuePerORMinute?: number; operatingDaysPerYear?: number }
): void {
  const revPerMin = config?.revenuePerORMinute ?? DEFAULT_REVENUE_PER_MIN
  const opDays = config?.operatingDaysPerYear ?? DEFAULT_OPERATING_DAYS
  const wb = XLSX.utils.book_new()

  // ---- Sheet 1: Surgeon Summary ----
  const summaryData: unknown[][] = [
    ['ORbit — Callback Optimization Report'],
    [`Generated: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`],
    [],
    ['Surgeon', 'Status', 'Cases', 'Flip Gaps', 'Same-Room Gaps',
     'Median Flip Idle (min)', 'Median Same-Room Idle (min)',
     'Callback Delta (min)', 'Recommendation'],
  ]

  summaries.forEach(s => {
    let recommendation = ''
    if (s.status === 'call_sooner') {
      recommendation = `Call patient ${Math.round(s.medianCallbackDelta)} min earlier to flip room`
    } else if (s.status === 'call_later') {
      recommendation = 'Delay callback by 3-5 min — surgeon arriving before room ready'
    } else if (s.status === 'on_track') {
      recommendation = 'Callback timing is well-optimized'
    } else {
      recommendation = 'Same-room only — callback optimization not applicable'
    }

    summaryData.push([
      s.surgeonName,
      s.statusLabel,
      s.caseCount,
      s.flipGapCount,
      s.sameRoomGapCount,
      s.hasFlipData ? Math.round(s.medianFlipIdle) : '—',
      s.sameRoomGapCount > 0 ? Math.round(s.medianSameRoomIdle) : '—',
      s.hasFlipData && s.medianCallbackDelta > 0 ? Math.round(s.medianCallbackDelta) : '—',
      recommendation,
    ])
  })

  const summarySheet = createSheet(summaryData)
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Surgeon Summary')

  // ---- Sheet 2: Flip Transition Detail ----
  const flipData: unknown[][] = [
    ['ORbit — Flip Room Transition Detail'],
    [],
    ['Date', 'Surgeon', 'From Case', 'From Room', 'To Case', 'To Room',
     'Gap Type', 'Idle Minutes', 'Optimal Call Delta', 'Saveable Minutes'],
  ]

  details.forEach(analysis => {
    analysis.idleGaps.forEach(gap => {
      flipData.push([
        formatDate(analysis.date),
        analysis.surgeonName,
        gap.fromCase,
        gap.fromRoom || '',
        gap.toCase,
        gap.toRoom || '',
        gap.gapType === 'flip' ? 'Flip Room' : 'Same Room',
        Math.round(gap.idleMinutes),
        gap.gapType === 'flip' ? Math.round(gap.optimalCallDelta) : '—',
        gap.gapType === 'flip' && gap.optimalCallDelta > 0 ? Math.round(gap.optimalCallDelta) : 0,
      ])
    })
  })

  const flipSheet = createSheet(flipData)
  XLSX.utils.book_append_sheet(wb, flipSheet, 'Transition Detail')

  // ---- Sheet 3: Financial Impact ----
  const callSoonerSurgeons = summaries.filter(s => s.status === 'call_sooner')
  const totalRecoverableMinutes = callSoonerSurgeons.reduce(
    (sum, s) => sum + (s.medianCallbackDelta * s.flipGapCount), 0
  )
  const uniqueDates = new Set(details.map(d => d.date))
  const periodDays = Math.max(uniqueDates.size, 1)
  const dailyRecoverable = totalRecoverableMinutes / periodDays
  const annualRecoverable = Math.round(dailyRecoverable * opDays)
  const annualImpact = annualRecoverable * revPerMin

  const financialData: unknown[][] = [
    ['ORbit — Financial Impact Estimate'],
    [],
    ['Metric', 'Value'],
    ['Surgeons with callback opportunity', callSoonerSurgeons.length],
    ['Total recoverable minutes (this period)', Math.round(totalRecoverableMinutes)],
    ['Period days analyzed', periodDays],
    ['Estimated recoverable minutes/day', Math.round(dailyRecoverable)],
    [],
    ['Assumptions', ''],
    ['Revenue per OR minute', `$${revPerMin}`],
    ['Operating days per year', opDays],
    [],
    ['Projections', ''],
    ['Annual recoverable minutes', annualRecoverable],
    ['Annual revenue impact', `$${annualImpact.toLocaleString()}`],
    [],
    ['Note: Estimates based on configurable assumptions. Actual impact depends on case mix, scheduling, and payer mix.'],
  ]

  // Per-surgeon breakdown
  financialData.push([], ['Per-Surgeon Breakdown', '', '', ''])
  financialData.push(['Surgeon', 'Median Callback Delta', 'Flip Transitions', 'Est. Recoverable Min'])
  callSoonerSurgeons.forEach(s => {
    financialData.push([
      s.surgeonName,
      `${Math.round(s.medianCallbackDelta)} min`,
      s.flipGapCount,
      Math.round(s.medianCallbackDelta * s.flipGapCount),
    ])
  })

  const financialSheet = createSheet(financialData)
  XLSX.utils.book_append_sheet(wb, financialSheet, 'Financial Impact')

  downloadWorkbook(wb, `orbit-callback-optimization-${getDateStamp()}.xlsx`)
}

// ============================================
// 2. FIRST CASE ON-TIME (FCOTS) EXPORT
// ============================================

export function exportFCOTSDetails(
  fcots: FCOTSResult,
  firstCaseDetails?: FCOTSDetail[]
): void {
  const wb = XLSX.utils.book_new()

  // Parse counts from subtitle
  const lateMatch = fcots.subtitle.match(/(\d+)\s+late\s+of\s+(\d+)/)
  const lateCount = lateMatch ? parseInt(lateMatch[1]) : 0
  const totalFirstCases = lateMatch ? parseInt(lateMatch[2]) : 0

  // ---- Sheet 1: Summary ----
  const summaryData: unknown[][] = [
    ['ORbit — First Case On-Time Report'],
    [`Generated: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`],
    [],
    ['Metric', 'Value'],
    ['On-Time Rate', fcots.displayValue],
    ['Target', `${fcots.target ?? 85}%`],
    ['Target Met', fcots.targetMet ? 'Yes' : 'No'],
    ['Late Cases', lateCount],
    ['Total First Cases', totalFirstCases],
    ['Trend vs Previous Period', fcots.delta !== undefined ? `${fcots.deltaType === 'increase' ? '+' : '-'}${fcots.delta}%` : 'N/A'],
  ]

  // Day-of-week breakdown from daily data
  if (fcots.dailyData && fcots.dailyData.length > 0) {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const dayStats = new Map<number, { onTime: number; total: number }>()

    fcots.dailyData.forEach(d => {
      const date = new Date(d.date + 'T12:00:00')
      const day = date.getDay()
      const stats = dayStats.get(day) || { onTime: 0, total: 0 }
      stats.total++
      if (d.color === 'green') stats.onTime++
      dayStats.set(day, stats)
    })

    summaryData.push([], ['Day of Week Analysis', ''])
    summaryData.push(['Day', 'On-Time Days', 'Total Days', 'On-Time %'])
    dayStats.forEach((stats, day) => {
      const rate = stats.total > 0 ? Math.round((stats.onTime / stats.total) * 100) : 0
      summaryData.push([dayNames[day], stats.onTime, stats.total, `${rate}%`])
    })
  }

  const summarySheet = createSheet(summaryData)
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary')

  // ---- Sheet 2: Case Detail ----
  if (firstCaseDetails && firstCaseDetails.length > 0) {
    const detailData: unknown[][] = [
      ['ORbit — First Case Detail'],
      [],
      ['Date', 'Room', 'Surgeon', 'Case #', 'Scheduled', 'Actual', 'Delay (min)', 'Status'],
    ]

    // Sort by date, then by delay descending
    const sorted = [...firstCaseDetails].sort((a, b) => {
      const dateDiff = a.scheduledDate.localeCompare(b.scheduledDate)
      if (dateDiff !== 0) return dateDiff
      return b.delayMinutes - a.delayMinutes
    })

    sorted.forEach(c => {
      detailData.push([
        formatDate(c.scheduledDate),
        c.roomName,
        c.surgeonName,
        c.caseNumber,
        c.scheduledStart,
        c.actualStart,
        c.delayMinutes,
        c.isOnTime ? 'On Time' : 'Late',
      ])
    })

    const detailSheet = createSheet(detailData)
    XLSX.utils.book_append_sheet(wb, detailSheet, 'Case Detail')

    // ---- Sheet 3: Surgeon Pattern Analysis ----
    const bySurgeon = new Map<string, { late: number; total: number; totalDelay: number }>()
    firstCaseDetails.forEach(c => {
      const stats = bySurgeon.get(c.surgeonName) || { late: 0, total: 0, totalDelay: 0 }
      stats.total++
      if (!c.isOnTime) {
        stats.late++
        stats.totalDelay += c.delayMinutes
      }
      bySurgeon.set(c.surgeonName, stats)
    })

    const patternData: unknown[][] = [
      ['ORbit — Surgeon Pattern Analysis'],
      [],
      ['Surgeon', 'First Cases', 'Late', 'On-Time %', 'Avg Delay When Late (min)', 'Total Delay (min)'],
    ]

    // Sort by late count descending
    const surgeonEntries = Array.from(bySurgeon.entries())
      .sort((a, b) => b[1].late - a[1].late)

    surgeonEntries.forEach(([name, stats]) => {
      const onTimeRate = Math.round(((stats.total - stats.late) / stats.total) * 100)
      const avgDelay = stats.late > 0 ? Math.round(stats.totalDelay / stats.late) : 0
      patternData.push([name, stats.total, stats.late, `${onTimeRate}%`, avgDelay, Math.round(stats.totalDelay)])
    })

    // Room pattern
    const byRoom = new Map<string, { late: number; total: number; totalDelay: number }>()
    firstCaseDetails.forEach(c => {
      const stats = byRoom.get(c.roomName) || { late: 0, total: 0, totalDelay: 0 }
      stats.total++
      if (!c.isOnTime) {
        stats.late++
        stats.totalDelay += c.delayMinutes
      }
      byRoom.set(c.roomName, stats)
    })

    patternData.push([], ['Room Pattern Analysis', '', '', '', '', ''])
    patternData.push(['Room', 'First Cases', 'Late', 'On-Time %', 'Avg Delay When Late (min)', 'Total Delay (min)'])

    Array.from(byRoom.entries())
      .sort((a, b) => b[1].late - a[1].late)
      .forEach(([name, stats]) => {
        const onTimeRate = Math.round(((stats.total - stats.late) / stats.total) * 100)
        const avgDelay = stats.late > 0 ? Math.round(stats.totalDelay / stats.late) : 0
        patternData.push([name, stats.total, stats.late, `${onTimeRate}%`, avgDelay, Math.round(stats.totalDelay)])
      })

    const patternSheet = createSheet(patternData)
    XLSX.utils.book_append_sheet(wb, patternSheet, 'Pattern Analysis')
  }

  // ---- Sheet: Daily Tracker ----
  if (fcots.dailyData && fcots.dailyData.length > 0) {
    const dailyData: unknown[][] = [
      ['ORbit — FCOTS Daily Trend'],
      [],
      ['Date', 'Status', 'Detail'],
    ]
    fcots.dailyData.forEach(d => {
      dailyData.push([
        formatDate(d.date),
        d.color === 'green' ? 'All On Time' : d.color === 'yellow' ? 'Partial' : 'Below Target',
        d.tooltip,
      ])
    })
    const dailySheet = createSheet(dailyData)
    XLSX.utils.book_append_sheet(wb, dailySheet, 'Daily Trend')
  }

  downloadWorkbook(wb, `orbit-fcots-report-${getDateStamp()}.xlsx`)
}

// ============================================
// 3. OR UTILIZATION EXPORT
// ============================================

export function exportUtilizationBreakdown(
  utilization: ORUtilizationResult,
  dailyData?: DailyTrackerData[],
  config?: { revenuePerORMinute?: number; operatingDaysPerYear?: number }
): void {
  const revPerMin = config?.revenuePerORMinute ?? DEFAULT_REVENUE_PER_MIN
  const wb = XLSX.utils.book_new()

  const { roomBreakdown, roomsWithRealHours, roomsWithDefaultHours } = utilization

  // ---- Sheet 1: Summary ----
  const summaryData: unknown[][] = [
    ['ORbit — OR Utilization Report'],
    [`Generated: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`],
    [],
    ['Metric', 'Value'],
    ['Overall Utilization', utilization.displayValue],
    ['Target', `${utilization.target ?? 75}%`],
    ['Target Met', utilization.targetMet ? 'Yes' : 'No'],
    ['Total Rooms', roomBreakdown.length],
    ['Rooms Above Target', roomBreakdown.filter(r => r.utilization >= 75).length],
    ['Rooms 60-74%', roomBreakdown.filter(r => r.utilization >= 60 && r.utilization < 75).length],
    ['Rooms Below 60%', roomBreakdown.filter(r => r.utilization < 60).length],
    ['Rooms Using Configured Hours', roomsWithRealHours],
    ['Rooms Using Default (10h)', roomsWithDefaultHours],
    ['Trend vs Previous Period', utilization.delta !== undefined ? `${utilization.deltaType === 'increase' ? '+' : '-'}${utilization.delta}%` : 'N/A'],
  ]

  // Unused capacity calculation
  const totalUnusedMinutes = roomBreakdown.reduce((sum, r) => {
    const available = r.availableHours * 60 * r.daysActive
    return sum + Math.max(0, available - r.usedMinutes)
  }, 0)
  const unusedHours = Math.round(totalUnusedMinutes / 60)

  summaryData.push(
    [],
    ['Capacity Analysis', ''],
    ['Total Unused OR Hours (period)', unusedHours],
    ['Revenue per OR Hour', `$${revPerMin * 60}`],
    ['Estimated Unused Capacity Value (period)', `$${(unusedHours * revPerMin * 60).toLocaleString()}`],
  )

  const summarySheet = createSheet(summaryData)
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary')

  // ---- Sheet 2: Room Breakdown ----
  const roomData: unknown[][] = [
    ['ORbit — Per-Room Utilization'],
    [],
    ['Room', 'Utilization %', 'Status', 'Cases', 'Days Active',
     'Used Minutes', 'Available Hours', 'Avg Hours/Day', 'Hours Source'],
  ]

  // Sort by utilization ascending (action items first)
  const sorted = [...roomBreakdown].sort((a, b) => a.utilization - b.utilization)

  sorted.forEach(r => {
    const status = r.utilization >= 75 ? 'Above Target' : r.utilization >= 60 ? 'Near Target' : 'Below Target'
    const avgHoursPerDay = r.daysActive > 0 ? Math.round(r.usedMinutes / r.daysActive / 60 * 10) / 10 : 0
    roomData.push([
      r.roomName,
      r.utilization,
      status,
      r.caseCount,
      r.daysActive,
      Math.round(r.usedMinutes),
      r.availableHours,
      avgHoursPerDay,
      r.usingRealHours ? 'Configured' : 'Default (10h)',
    ])
  })

  const roomSheet = createSheet(roomData)
  XLSX.utils.book_append_sheet(wb, roomSheet, 'Room Breakdown')

  // ---- Sheet 3: Daily Trend ----
  if (dailyData && dailyData.length > 0) {
    const trendData: unknown[][] = [
      ['ORbit — Daily Utilization Trend'],
      [],
      ['Date', 'Status', 'Detail'],
    ]
    dailyData.forEach(d => {
      trendData.push([
        formatDate(d.date),
        d.color === 'green' ? 'Above 75%' : d.color === 'yellow' ? '60-74%' : 'Below 60%',
        d.tooltip,
      ])
    })
    const trendSheet = createSheet(trendData)
    XLSX.utils.book_append_sheet(wb, trendSheet, 'Daily Trend')
  }

  downloadWorkbook(wb, `orbit-utilization-report-${getDateStamp()}.xlsx`)
}

// ============================================
// 4. TURNOVER EFFICIENCY EXPORT
// ============================================

export function exportTurnoverEfficiency(
  roomTurnover: TurnoverResult,
  flipRoomTurnover: TurnoverResult,
  sameRoomSurgical: KPIResult,
  flipRoomSurgical: KPIResult,
  nonOperativeTime: KPIResult,
  turnoverDetails?: TurnoverDetail[]
): void {
  const wb = XLSX.utils.book_new()

  // ---- Sheet 1: Summary ----
  const summaryData: unknown[][] = [
    ['ORbit — Turnover Efficiency Report'],
    [`Generated: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`],
    [],
    ['Metric', 'Median', 'Target', 'Met Target', 'Trend', 'Detail'],
    [
      'Same-Room Turnover (Patient Out → In)',
      roomTurnover.displayValue,
      roomTurnover.target ? `${roomTurnover.target}% compliance` : '—',
      roomTurnover.targetMet ? 'Yes' : 'No',
      roomTurnover.delta !== undefined ? `${roomTurnover.deltaType === 'increase' ? '+' : '-'}${roomTurnover.delta}%` : '—',
      roomTurnover.subtitle,
    ],
    [
      'Flip-Room Turnover (Patient Out → In)',
      flipRoomTurnover.displayValue,
      flipRoomTurnover.target ? `${flipRoomTurnover.target}% compliance` : '—',
      flipRoomTurnover.targetMet ? 'Yes' : 'No',
      flipRoomTurnover.delta !== undefined ? `${flipRoomTurnover.deltaType === 'increase' ? '+' : '-'}${flipRoomTurnover.delta}%` : '—',
      flipRoomTurnover.subtitle,
    ],
    [
      'Same-Room Surgical Turnover',
      sameRoomSurgical.displayValue,
      sameRoomSurgical.target ? `≤${sameRoomSurgical.target} min` : '—',
      sameRoomSurgical.targetMet ? 'Yes' : 'No',
      sameRoomSurgical.delta !== undefined ? `${sameRoomSurgical.deltaType === 'increase' ? '+' : '-'}${sameRoomSurgical.delta}%` : '—',
      sameRoomSurgical.subtitle,
    ],
    [
      'Flip-Room Surgical Turnover',
      flipRoomSurgical.displayValue,
      flipRoomSurgical.target ? `≤${flipRoomSurgical.target} min` : '—',
      flipRoomSurgical.targetMet ? 'Yes' : 'No',
      flipRoomSurgical.delta !== undefined ? `${flipRoomSurgical.deltaType === 'increase' ? '+' : '-'}${flipRoomSurgical.delta}%` : '—',
      flipRoomSurgical.subtitle,
    ],
    [
      'Non-Operative Time',
      nonOperativeTime.displayValue,
      '—',
      '—',
      nonOperativeTime.delta !== undefined ? `${nonOperativeTime.deltaType === 'increase' ? '+' : '-'}${nonOperativeTime.delta}%` : '—',
      nonOperativeTime.subtitle,
    ],
  ]

  const summarySheet = createSheet(summaryData)
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary')

  // ---- Sheet 2: Per-Transition Detail (if available) ----
  if (turnoverDetails && turnoverDetails.length > 0) {
    const detailData: unknown[][] = [
      ['ORbit — Turnover Detail'],
      [],
      ['Date', 'Room', 'From Case', 'To Case', 'Surgeon', 'Minutes', 'Compliant'],
    ]

    const sorted = [...turnoverDetails].sort((a, b) => {
      const dateDiff = a.date.localeCompare(b.date)
      if (dateDiff !== 0) return dateDiff
      return b.turnoverMinutes - a.turnoverMinutes
    })

    sorted.forEach(t => {
      detailData.push([
        formatDate(t.date),
        t.roomName,
        t.fromCaseNumber,
        t.toCaseNumber,
        t.fromSurgeonName,
        Math.round(t.turnoverMinutes),
        t.isCompliant ? 'Yes' : 'No',
      ])
    })

    const detailSheet = createSheet(detailData)
    XLSX.utils.book_append_sheet(wb, detailSheet, 'Transition Detail')
  }

  // ---- Sheet 3: Daily Trends ----
  const allDailyData = [
    { name: 'Room Turnover', data: roomTurnover.dailyData },
    { name: 'Same-Room Surgical', data: sameRoomSurgical.dailyData },
    { name: 'Flip-Room Surgical', data: flipRoomSurgical.dailyData },
  ].filter(d => d.data && d.data.length > 0)

  if (allDailyData.length > 0) {
    const trendData: unknown[][] = [
      ['ORbit — Turnover Daily Trends'],
      [],
      ['Metric', 'Date', 'Status', 'Detail'],
    ]
    allDailyData.forEach(({ name, data }) => {
      data!.forEach(d => {
        trendData.push([
          name,
          formatDate(d.date),
          d.color === 'green' ? 'Good' : d.color === 'yellow' ? 'Near Target' : 'Above Target',
          d.tooltip,
        ])
      })
    })
    const trendSheet = createSheet(trendData)
    XLSX.utils.book_append_sheet(wb, trendSheet, 'Daily Trends')
  }

  downloadWorkbook(wb, `orbit-turnover-report-${getDateStamp()}.xlsx`)
}

// ============================================
// 5. CANCELLATION EXPORT
// ============================================

export function exportCancellationReport(
  cancellation: CancellationResult
): void {
  const wb = XLSX.utils.book_new()

  // ---- Sheet 1: Summary ----
  const summaryData: unknown[][] = [
    ['ORbit — Cancellation Report'],
    [`Generated: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`],
    [],
    ['Metric', 'Value'],
    ['Same-Day Cancellation Rate', cancellation.displayValue],
    ['Target', `<${cancellation.target ?? 5}%`],
    ['Target Met', cancellation.targetMet ? 'Yes' : 'No'],
    ['Same-Day Cancellations', cancellation.sameDayCount],
    ['Total Cancellations', cancellation.totalCancelledCount],
    ['Trend vs Previous Period', cancellation.delta !== undefined ? `${cancellation.deltaType === 'increase' ? '+' : '-'}${cancellation.delta}%` : 'N/A'],
  ]

  // Streak calculation
  const dailyData = cancellation.dailyData || []
  let streak = 0
  for (let i = dailyData.length - 1; i >= 0; i--) {
    if (dailyData[i].color === 'green') streak++
    else break
  }
  if (streak > 0) {
    summaryData.push([], ['Zero-Cancellation Streak', `${streak} consecutive operating days`])
  }

  const summarySheet = createSheet(summaryData)
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary')

  // ---- Sheet 2: Daily History ----
  if (dailyData.length > 0) {
    const dailySheetData: unknown[][] = [
      ['ORbit — Cancellation Daily History'],
      [],
      ['Date', 'Status', 'Detail'],
    ]
    dailyData.forEach(d => {
      dailySheetData.push([
        formatDate(d.date),
        d.color === 'green' ? 'No Cancellations' : d.color === 'yellow' ? '1 Cancellation' : 'Multiple',
        d.tooltip,
      ])
    })
    const historySheet = createSheet(dailySheetData)
    XLSX.utils.book_append_sheet(wb, historySheet, 'Daily History')
  }

  downloadWorkbook(wb, `orbit-cancellation-report-${getDateStamp()}.xlsx`)
}

// ============================================
// 6. NON-OPERATIVE TIME EXPORT
// ============================================

export function exportNonOperativeTime(
  nonOpKpi: KPIResult,
  avgPreOp: number,
  avgSurgical: number,
  avgClosing: number,
  avgEmergence: number
): void {
  const wb = XLSX.utils.book_new()

  const nonOpTotal = avgPreOp + avgClosing + avgEmergence
  const avgTotal = avgPreOp + avgSurgical + avgClosing + avgEmergence
  const nonOpPercent = avgTotal > 0 ? Math.round((nonOpTotal / avgTotal) * 100) : 0
  const dominant = avgPreOp > (avgClosing + avgEmergence) ? 'Pre-Op' : 'Post-Op'

  // ---- Sheet 1: Summary ----
  const summaryData: unknown[][] = [
    ['ORbit — Non-Operative Time Report'],
    [`Generated: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`],
    [],
    ['Metric', 'Value'],
    ['Average Non-Operative Time', nonOpKpi.displayValue],
    ['Non-Op % of Total Case Time', `${nonOpPercent}%`],
    ['Dominant Phase', dominant],
    [],
    ['Time Phase Breakdown', 'Average (min)'],
    ['Pre-Op (Patient In → Incision)', Math.round(avgPreOp)],
    ['Surgical (Incision → Closing)', Math.round(avgSurgical)],
    ['Closing (Closing → Closing Complete)', Math.round(avgClosing)],
    ['Emergence (Closing Complete → Patient Out)', Math.round(avgEmergence)],
    [],
    ['Total Case Time', Math.round(avgTotal)],
    ['Total Non-Operative', Math.round(nonOpTotal)],
    ['Total Operative (Surgical + Closing)', Math.round(avgSurgical + avgClosing)],
  ]

  const summarySheet = createSheet(summaryData)
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary')

  downloadWorkbook(wb, `orbit-non-operative-time-${getDateStamp()}.xlsx`)
}

// ============================================
// 7. SCHEDULING / VOLUME EXPORT
// ============================================

export function exportSchedulingData(
  caseVolume: CaseVolumeResult,
  orUtilization: ORUtilizationResult
): void {
  const wb = XLSX.utils.book_new()

  const weeklyVolume = caseVolume.weeklyVolume || []

  // ---- Sheet 1: Summary ----
  const summaryData: unknown[][] = [
    ['ORbit — Scheduling & Volume Report'],
    [`Generated: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`],
    [],
    ['Metric', 'Value'],
    ['Total Cases', caseVolume.displayValue],
    ['Trend vs Previous Period', caseVolume.delta !== undefined ? `${caseVolume.deltaType === 'increase' ? '+' : '-'}${caseVolume.delta}%` : 'N/A'],
    ['OR Utilization', orUtilization.displayValue],
    ['Utilization Trend', orUtilization.delta !== undefined ? `${orUtilization.deltaType === 'increase' ? '+' : '-'}${orUtilization.delta}%` : 'N/A'],
  ]

  // Trend analysis
  if (weeklyVolume.length >= 4) {
    const mid = Math.floor(weeklyVolume.length / 2)
    const firstHalf = weeklyVolume.slice(0, mid)
    const secondHalf = weeklyVolume.slice(mid)
    const firstAvg = firstHalf.reduce((s, w) => s + w.count, 0) / firstHalf.length
    const secondAvg = secondHalf.reduce((s, w) => s + w.count, 0) / secondHalf.length
    const trendPct = firstAvg > 0 ? Math.round(((secondAvg - firstAvg) / firstAvg) * 100) : 0

    summaryData.push(
      [],
      ['Trend Analysis', ''],
      ['First-half avg weekly volume', Math.round(firstAvg)],
      ['Second-half avg weekly volume', Math.round(secondAvg)],
      ['Trend', `${trendPct > 0 ? '+' : ''}${trendPct}%`],
    )
  }

  const summarySheet = createSheet(summaryData)
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary')

  // ---- Sheet 2: Weekly Volume ----
  if (weeklyVolume.length > 0) {
    const weeklyData: unknown[][] = [
      ['ORbit — Weekly Case Volume'],
      [],
      ['Week', 'Case Count'],
    ]
    weeklyVolume.forEach(w => {
      weeklyData.push([formatDate(w.week), w.count])
    })
    const weeklySheet = createSheet(weeklyData)
    XLSX.utils.book_append_sheet(wb, weeklySheet, 'Weekly Volume')
  }

  downloadWorkbook(wb, `orbit-scheduling-report-${getDateStamp()}.xlsx`)
}

// ============================================
// 8. FULL ANALYTICS EXPORT
// ============================================

/**
 * Export a comprehensive analytics report with all KPIs.
 * This is the "export everything" button — one workbook with all metrics.
 */
export function exportFullAnalyticsReport(
  analytics: AnalyticsOverview,
  insights: Insight[]
): void {
  const wb = XLSX.utils.book_new()

  // ---- Sheet 1: Executive Summary ----
  const execData: unknown[][] = [
    ['ORbit — Analytics Report'],
    [`Generated: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`],
    [],
    ['KPI', 'Value', 'Target', 'Met', 'Trend', 'Detail'],
    ['First Case On-Time', analytics.fcots.displayValue, `${analytics.fcots.target ?? 85}%`, analytics.fcots.targetMet ? 'Yes' : 'No', analytics.fcots.delta !== undefined ? `${analytics.fcots.delta}%` : '—', analytics.fcots.subtitle],
    ['OR Utilization', analytics.orUtilization.displayValue, `${analytics.orUtilization.target ?? 75}%`, analytics.orUtilization.targetMet ? 'Yes' : 'No', analytics.orUtilization.delta !== undefined ? `${analytics.orUtilization.delta}%` : '—', analytics.orUtilization.subtitle],
    ['Case Volume', analytics.caseVolume.displayValue, '—', '—', analytics.caseVolume.delta !== undefined ? `${analytics.caseVolume.delta}%` : '—', analytics.caseVolume.subtitle],
    ['Same-Day Cancellation', analytics.cancellationRate.displayValue, `<${analytics.cancellationRate.target ?? 5}%`, analytics.cancellationRate.targetMet ? 'Yes' : 'No', analytics.cancellationRate.delta !== undefined ? `${analytics.cancellationRate.delta}%` : '—', analytics.cancellationRate.subtitle],
    [],
    ['Turnover Metrics', '', '', '', '', ''],
    ['Same-Room Turnover', analytics.sameRoomTurnover.displayValue, `${analytics.sameRoomTurnover.target}% compliance`, analytics.sameRoomTurnover.targetMet ? 'Yes' : 'No', analytics.sameRoomTurnover.delta !== undefined ? `${analytics.sameRoomTurnover.delta}%` : '—', analytics.sameRoomTurnover.subtitle],
    ['Flip-Room Turnover', analytics.flipRoomTurnover.displayValue, `${analytics.flipRoomTurnover.target}% compliance`, analytics.flipRoomTurnover.targetMet ? 'Yes' : 'No', analytics.flipRoomTurnover.delta !== undefined ? `${analytics.flipRoomTurnover.delta}%` : '—', analytics.flipRoomTurnover.subtitle],
    ['Same-Room Surgical', analytics.sameRoomSurgicalTurnover.displayValue, `≤${analytics.sameRoomSurgicalTurnover.target} min`, analytics.sameRoomSurgicalTurnover.targetMet ? 'Yes' : 'No', analytics.sameRoomSurgicalTurnover.delta !== undefined ? `${analytics.sameRoomSurgicalTurnover.delta}%` : '—', analytics.sameRoomSurgicalTurnover.subtitle],
    ['Flip-Room Surgical', analytics.flipRoomSurgicalTurnover.displayValue, `≤${analytics.flipRoomSurgicalTurnover.target} min`, analytics.flipRoomSurgicalTurnover.targetMet ? 'Yes' : 'No', analytics.flipRoomSurgicalTurnover.delta !== undefined ? `${analytics.flipRoomSurgicalTurnover.delta}%` : '—', analytics.flipRoomSurgicalTurnover.subtitle],
    ['Non-Operative Time', analytics.nonOperativeTime.displayValue, '—', '—', analytics.nonOperativeTime.delta !== undefined ? `${analytics.nonOperativeTime.delta}%` : '—', analytics.nonOperativeTime.subtitle],
    [],
    ['Case Summary', '', '', '', '', ''],
    ['Total Cases', analytics.totalCases, '', '', '', ''],
    ['Completed Cases', analytics.completedCases, '', '', '', ''],
    ['Cancelled Cases', analytics.cancelledCases, '', '', '', ''],
  ]

  const execSheet = createSheet(execData)
  XLSX.utils.book_append_sheet(wb, execSheet, 'Executive Summary')

  // ---- Sheet 2: AI Insights ----
  const insightData: unknown[][] = [
    ['ORbit — AI Insights'],
    [],
    ['Priority', 'Severity', 'Title', 'Insight', 'Financial Impact', 'Action'],
  ]

  insights.forEach((ins, i) => {
    insightData.push([
      i + 1,
      ins.severity.charAt(0).toUpperCase() + ins.severity.slice(1),
      ins.title,
      ins.body,
      ins.financialImpact || '—',
      ins.action,
    ])
  })

  const insightSheet = createSheet(insightData)
  XLSX.utils.book_append_sheet(wb, insightSheet, 'AI Insights')

  // ---- Sheet 3: Surgeon Callback Summary ----
  if (analytics.surgeonIdleSummaries.length > 0) {
    const callbackData: unknown[][] = [
      ['ORbit — Surgeon Callback Summary'],
      [],
      ['Surgeon', 'Status', 'Cases', 'Flip Gaps', 'Same-Room Gaps',
       'Median Flip Idle', 'Median Same-Room Idle', 'Callback Delta'],
    ]
    analytics.surgeonIdleSummaries.forEach(s => {
      callbackData.push([
        s.surgeonName, s.statusLabel, s.caseCount,
        s.flipGapCount, s.sameRoomGapCount,
        s.hasFlipData ? `${Math.round(s.medianFlipIdle)} min` : '—',
        s.sameRoomGapCount > 0 ? `${Math.round(s.medianSameRoomIdle)} min` : '—',
        s.hasFlipData && s.medianCallbackDelta > 0 ? `${Math.round(s.medianCallbackDelta)} min` : '—',
      ])
    })
    const callbackSheet = createSheet(callbackData)
    XLSX.utils.book_append_sheet(wb, callbackSheet, 'Surgeon Callbacks')
  }

  // ---- Sheet 4: Room Utilization ----
  if (analytics.orUtilization.roomBreakdown.length > 0) {
    const roomData: unknown[][] = [
      ['ORbit — Room Utilization'],
      [],
      ['Room', 'Utilization %', 'Cases', 'Days Active', 'Avg Hours/Day', 'Available Hours', 'Source'],
    ]
    analytics.orUtilization.roomBreakdown.forEach(r => {
      const avgH = r.daysActive > 0 ? Math.round(r.usedMinutes / r.daysActive / 60 * 10) / 10 : 0
      roomData.push([r.roomName, r.utilization, r.caseCount, r.daysActive, avgH, r.availableHours, r.usingRealHours ? 'Configured' : 'Default'])
    })
    const roomSheet = createSheet(roomData)
    XLSX.utils.book_append_sheet(wb, roomSheet, 'Room Utilization')
  }

  // ---- Sheet 5: Time Breakdown ----
  const timeData: unknown[][] = [
    ['ORbit — Average Time Breakdown'],
    [],
    ['Phase', 'Average (min)', 'Milestone Range'],
    ['Total Case Time', Math.round(analytics.avgTotalCaseTime), 'Patient In → Patient Out'],
    ['Pre-Op', Math.round(analytics.avgPreOpTime), 'Patient In → Incision'],
    ['Surgical', Math.round(analytics.avgSurgicalTime), 'Incision → Closing'],
    ['Anesthesia', Math.round(analytics.avgAnesthesiaTime), 'Anes Start → Anes End'],
    ['Closing', Math.round(analytics.avgClosingTime), 'Closing → Closing Complete'],
    ['Emergence', Math.round(analytics.avgEmergenceTime), 'Closing Complete → Patient Out'],
  ]

  const timeSheet = createSheet(timeData)
  XLSX.utils.book_append_sheet(wb, timeSheet, 'Time Breakdown')

  downloadWorkbook(wb, `orbit-analytics-report-${getDateStamp()}.xlsx`)
}

// ============================================
// DISPATCHER — single entry point for panel exports
// ============================================

/**
 * Export data for a specific drill-through panel type.
 * Maps drillThroughType to the correct export function with correct arguments.
 */
export function exportInsightPanel(
  drillThroughType: string,
  analytics: AnalyticsOverview,
  config: FacilityAnalyticsConfig
): void {
  const revenuePerORMinute = config.orHourlyRate ? config.orHourlyRate / 60 : DEFAULT_REVENUE_PER_MIN
  const operatingDaysPerYear = config.operatingDaysPerYear ?? DEFAULT_OPERATING_DAYS
  const financialConfig = { revenuePerORMinute, operatingDaysPerYear }

  switch (drillThroughType) {
    case 'callback':
      exportCallbackOptimization(analytics.surgeonIdleSummaries, analytics.flipRoomAnalysis, financialConfig)
      break
    case 'fcots':
      exportFCOTSDetails(analytics.fcots, analytics.fcots.firstCaseDetails)
      break
    case 'utilization':
      exportUtilizationBreakdown(analytics.orUtilization, analytics.orUtilization.dailyData, financialConfig)
      break
    case 'turnover':
      exportTurnoverEfficiency(analytics.sameRoomTurnover, analytics.flipRoomTurnover, analytics.sameRoomSurgicalTurnover, analytics.flipRoomSurgicalTurnover, analytics.nonOperativeTime, analytics.sameRoomTurnover.details)
      break
    case 'cancellation':
      exportCancellationReport(analytics.cancellationRate)
      break
    case 'non_op_time':
      exportNonOperativeTime(analytics.nonOperativeTime, analytics.avgPreOpTime, analytics.avgSurgicalTime, analytics.avgClosingTime, analytics.avgEmergenceTime)
      break
    case 'scheduling':
      exportSchedulingData(analytics.caseVolume, analytics.orUtilization)
      break
  }
}
