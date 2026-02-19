// lib/flagPatternDetection.ts
// Client-side pattern detection engine for flag analytics.
// Takes aggregated RPC data and applies heuristic rules to detect
// actionable patterns. Thresholds are hardcoded constants for now —
// a future phase will make them configurable per-facility.

import type {
  FlagAnalyticsRPCResponse,
  DetectedPattern,
  PatternSeverity,
  WeeklyTrendPoint,
  DayOfWeekRow,
  SurgeonFlagRow,
  RoomFlagRow,
} from '@/types/flag-analytics'

// ============================================
// Thresholds (hardcoded, configurable in future phase)
// ============================================

const THRESHOLDS = {
  /** Day is a spike if >50% more flags than daily average */
  daySpikePct: 0.5,
  /** Trend is significant if >20% change over recent weeks */
  trendChangePct: 0.2,
  /** Minimum weeks needed to detect a trend */
  trendMinWeeks: 3,
  /** Room is concentrated if >35% of flags but <30% of cases */
  roomFlagPct: 0.35,
  roomCasePct: 0.3,
  /** Surgeon is recurring if flag rate >2x facility average */
  surgeonMultiplier: 2,
  /** Minimum flags to consider a pattern meaningful */
  minFlagsForPattern: 3,
} as const

// ============================================
// Severity sort order
// ============================================

const SEVERITY_ORDER: Record<PatternSeverity, number> = {
  critical: 0,
  warning: 1,
  good: 2,
}

// ============================================
// Main entry point
// ============================================

export function detectFlagPatterns(data: FlagAnalyticsRPCResponse): DetectedPattern[] {
  const patterns: DetectedPattern[] = []

  if (data.summary.totalFlags < THRESHOLDS.minFlagsForPattern) {
    return patterns
  }

  detectDaySpikes(data.dayOfWeekHeatmap, patterns)
  detectTrendChanges(data.weeklyTrend, patterns)
  detectRoomConcentration(data.roomFlags, data.summary.totalCases, data.summary.totalFlags, patterns)
  detectRecurringSurgeon(data.surgeonFlags, data.summary.flagRate, patterns)
  detectEquipmentCascade(data, patterns)

  // Sort by severity (critical first, then warning, then good)
  patterns.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])

  return patterns
}

// ============================================
// Detectors
// ============================================

/**
 * Day-of-week spike: Any day with >50% more flags than the daily average.
 */
function detectDaySpikes(heatmap: DayOfWeekRow[], patterns: DetectedPattern[]): void {
  if (heatmap.length === 0) return

  const totalAllDays = heatmap.reduce((sum, d) => sum + d.total, 0)
  const avgPerDay = totalAllDays / heatmap.length

  if (avgPerDay === 0) return

  for (const day of heatmap) {
    const excess = (day.total - avgPerDay) / avgPerDay
    if (excess > THRESHOLDS.daySpikePct && day.total >= THRESHOLDS.minFlagsForPattern) {
      // Find the dominant category for this day
      const categories = [
        { name: 'FCOTS', value: day.fcots },
        { name: 'Timing', value: day.timing },
        { name: 'Turnover', value: day.turnover },
        { name: 'Delay', value: day.delay },
      ]
      const top = categories.reduce((a, b) => (b.value > a.value ? b : a))
      const pctStr = `+${Math.round(excess * 100)}%`

      patterns.push({
        type: 'day_spike',
        title: `${day.day} Spike`,
        desc: `${day.day}s average ${pctStr} more flags than other days. ${top.value} of ${day.total} flags are ${top.name}.`,
        severity: excess > 1 ? 'critical' : 'warning',
        metric: pctStr,
      })
    }
  }
}

/**
 * Trend changes: Flag categories declining or increasing >20% over recent weeks.
 * Compares the first half to the second half of the weekly trend data.
 */
function detectTrendChanges(trend: WeeklyTrendPoint[], patterns: DetectedPattern[]): void {
  if (trend.length < THRESHOLDS.trendMinWeeks) return

  const mid = Math.floor(trend.length / 2)
  const firstHalf = trend.slice(0, mid)
  const secondHalf = trend.slice(mid)

  // Check threshold flags trend
  const firstThreshold = firstHalf.reduce((s, w) => s + w.threshold, 0) / firstHalf.length
  const secondThreshold = secondHalf.reduce((s, w) => s + w.threshold, 0) / secondHalf.length

  if (firstThreshold > 0) {
    const thresholdChange = (secondThreshold - firstThreshold) / firstThreshold
    if (thresholdChange < -THRESHOLDS.trendChangePct) {
      const pctStr = `${Math.round(thresholdChange * 100)}%`
      patterns.push({
        type: 'trend_improvement',
        title: 'Threshold Flags Declining',
        desc: `Auto-detected flags down ${pctStr} over recent weeks. Threshold-based alerts are improving.`,
        severity: 'good',
        metric: pctStr,
      })
    } else if (thresholdChange > THRESHOLDS.trendChangePct) {
      const pctStr = `+${Math.round(thresholdChange * 100)}%`
      patterns.push({
        type: 'trend_deterioration',
        title: 'Threshold Flags Increasing',
        desc: `Auto-detected flags up ${pctStr} over recent weeks. Review flag rules for emerging issues.`,
        severity: 'warning',
        metric: pctStr,
      })
    }
  }

  // Check delay flags trend
  const firstDelay = firstHalf.reduce((s, w) => s + w.delay, 0) / firstHalf.length
  const secondDelay = secondHalf.reduce((s, w) => s + w.delay, 0) / secondHalf.length

  if (firstDelay > 0) {
    const delayChange = (secondDelay - firstDelay) / firstDelay
    if (delayChange < -THRESHOLDS.trendChangePct) {
      const pctStr = `${Math.round(delayChange * 100)}%`
      patterns.push({
        type: 'trend_improvement',
        title: 'Reported Delays Declining',
        desc: `User-reported delays down ${pctStr} over recent weeks. Operational improvements are working.`,
        severity: 'good',
        metric: pctStr,
      })
    } else if (delayChange > THRESHOLDS.trendChangePct) {
      const pctStr = `+${Math.round(delayChange * 100)}%`
      patterns.push({
        type: 'trend_deterioration',
        title: 'Reported Delays Increasing',
        desc: `User-reported delays up ${pctStr} over recent weeks. Investigate root causes.`,
        severity: 'warning',
        metric: pctStr,
      })
    }
  }
}

/**
 * Room concentration: Room with >35% of flags but <30% of cases.
 */
function detectRoomConcentration(
  rooms: RoomFlagRow[],
  totalCases: number,
  totalFlags: number,
  patterns: DetectedPattern[],
): void {
  if (rooms.length === 0 || totalCases === 0 || totalFlags === 0) return

  for (const room of rooms) {
    const flagShare = room.flags / totalFlags
    const caseShare = room.cases / totalCases

    if (flagShare > THRESHOLDS.roomFlagPct && caseShare < THRESHOLDS.roomCasePct) {
      const flagPctStr = `${Math.round(flagShare * 100)}%`
      const casePctStr = `${Math.round(caseShare * 100)}%`
      patterns.push({
        type: 'room_concentration',
        title: `${room.room} Flag Concentration`,
        desc: `${room.room} accounts for ${flagPctStr} of all flags despite handling ${casePctStr} of cases. Top issue: ${room.topIssue || 'N/A'}.`,
        severity: 'critical',
        metric: flagPctStr,
      })
    }
  }
}

/**
 * Recurring surgeon: Surgeon flag rate >2x facility average.
 */
function detectRecurringSurgeon(
  surgeons: SurgeonFlagRow[],
  facilityFlagRate: number,
  patterns: DetectedPattern[],
): void {
  if (surgeons.length === 0 || facilityFlagRate === 0) return

  const threshold = facilityFlagRate * THRESHOLDS.surgeonMultiplier

  for (const surgeon of surgeons) {
    if (surgeon.rate > threshold && surgeon.flags >= THRESHOLDS.minFlagsForPattern) {
      const multiplier = (surgeon.rate / facilityFlagRate).toFixed(1)
      patterns.push({
        type: 'recurring_surgeon',
        title: `${surgeon.name} Flag Pattern`,
        desc: `${surgeon.name} has a ${surgeon.rate.toFixed(0)}% flag rate (${multiplier}x facility average). Top flag: ${surgeon.topFlag || 'N/A'}.`,
        severity: 'warning',
        metric: `${multiplier}x`,
      })
    }
  }
}

/**
 * Equipment cascade: Approximated from aggregated data.
 * Checks if delay types related to equipment/supplies exist alongside
 * elevated threshold flag rates, suggesting cascading effects.
 */
function detectEquipmentCascade(data: FlagAnalyticsRPCResponse, patterns: DetectedPattern[]): void {
  const equipmentKeywords = ['equipment', 'supply', 'instrument', 'device', 'implant']

  const equipmentDelays = data.delayTypeBreakdown.filter((d) =>
    equipmentKeywords.some((kw) => d.name.toLowerCase().includes(kw)),
  )

  if (equipmentDelays.length === 0) return

  const totalEquipmentDelays = equipmentDelays.reduce((s, d) => s + d.count, 0)
  if (totalEquipmentDelays < 2) return

  // Check if avg flags per case is elevated (>1.5 suggests cascading)
  if (data.summary.avgFlagsPerCase > 1.5) {
    const cascadeRatio = data.summary.avgFlagsPerCase.toFixed(1)
    patterns.push({
      type: 'equipment_cascade',
      title: 'Equipment → Cascade Pattern',
      desc: `${totalEquipmentDelays} equipment-related delays detected. Cases average ${cascadeRatio} flags each, suggesting equipment issues cascade into additional threshold flags.`,
      severity: 'critical',
      metric: `${cascadeRatio}x`,
    })
  }
}
