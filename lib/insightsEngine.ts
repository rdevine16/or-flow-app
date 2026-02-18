// ============================================
// lib/insightsEngine.ts
// ============================================
// Synthesizes actionable insights from analyticsV2 output.
// No additional DB queries — everything derived from AnalyticsOverview.
//
// Each insight includes:
//   - severity: prioritizes what needs attention
//   - financial impact: translates OR minutes into dollars
//   - action: specific, implementable recommendation
//   - benchmark: comparison point (internal or target)
// ============================================

import type {
  AnalyticsOverview,
  SurgeonIdleSummary,
  DailyTrackerData,
  RoomUtilizationDetail,
} from '@/lib/analyticsV2'

// ============================================
// TYPES
// ============================================

export type InsightSeverity = 'critical' | 'warning' | 'positive' | 'info'

export type InsightCategory =
  | 'first_case_delays'
  | 'turnover_efficiency'
  | 'callback_optimization'
  | 'utilization_gap'
  | 'cancellation_trend'
  | 'non_operative_time'
  | 'scheduling_pattern'

export type DrillThroughType =
  | 'callback'
  | 'fcots'
  | 'utilization'
  | 'turnover'
  | 'cancellation'
  | 'non_op_time'
  | 'scheduling'

export interface Insight {
  id: string
  category: InsightCategory
  severity: InsightSeverity
  title: string
  body: string                    // Main narrative (2-3 sentences)
  action: string                  // Clickable CTA label
  actionRoute?: string            // Optional route to navigate to
  financialImpact?: string        // e.g. "~$180K/year estimated impact"
  drillThroughType: DrillThroughType | null // Panel type for slide-over drill-through
  metadata: Record<string, unknown> // Raw values for programmatic use
}

export interface InsightsConfig {
  // Revenue assumptions (configurable per facility)
  orHourlyRate?: number | null    // $/hr from facilities.or_hourly_rate — takes precedence over revenuePerORMinute
  revenuePerORMinute?: number     // Default $36/min (~$2,160/hr, conservative ASC avg)
  revenuePerCase?: number         // Default $5,800 (average ASC case revenue)
  operatingDaysPerYear?: number   // Default 250

  // Thresholds for insight generation
  maxInsights?: number            // Default 6, cap to avoid noise
  minSeverityToShow?: InsightSeverity // Default 'info' (show everything)
}

/** Resolved config with orHourlyRate converted to revenuePerORMinute */
type ResolvedInsightsConfig = Required<Omit<InsightsConfig, 'orHourlyRate'>>

const DEFAULT_REVENUE_PER_OR_MINUTE = 36 // ~$2,160/hr, conservative ASC avg

const DEFAULT_CONFIG: ResolvedInsightsConfig = {
  revenuePerORMinute: DEFAULT_REVENUE_PER_OR_MINUTE,
  revenuePerCase: 5800,
  operatingDaysPerYear: 250,
  maxInsights: 6,
  minSeverityToShow: 'info',
}

// Severity priority for sorting
const SEVERITY_ORDER: Record<InsightSeverity, number> = {
  critical: 0,
  warning: 1,
  positive: 2,
  info: 3,
}

// ============================================
// MAIN ENTRY POINT
// ============================================

/**
 * Generate prioritized, actionable insights from analytics data.
 *
 * Call this after calculateAnalyticsOverview() — it takes the same output
 * and returns ranked insight cards ready for the dashboard.
 *
 * Usage:
 *   const analytics = calculateAnalyticsOverview(cases, prevCases, config, roomHours)
 *   const insights = generateInsights(analytics)
 */
export function generateInsights(
  analytics: AnalyticsOverview,
  config?: InsightsConfig
): Insight[] {
  // Resolve orHourlyRate → revenuePerORMinute (hourly rate takes precedence)
  const { orHourlyRate, ...rest } = config ?? {}
  const resolvedRevenue = orHourlyRate
    ? orHourlyRate / 60
    : rest.revenuePerORMinute ?? DEFAULT_REVENUE_PER_OR_MINUTE
  const cfg: ResolvedInsightsConfig = { ...DEFAULT_CONFIG, ...rest, revenuePerORMinute: resolvedRevenue }
  const insights: Insight[] = []

  // Run all insight generators
  insights.push(...analyzeFirstCaseDelays(analytics, cfg))
  insights.push(...analyzeTurnoverEfficiency(analytics, cfg))
  insights.push(...analyzeCallbackOptimization(analytics, cfg))
  insights.push(...analyzeUtilizationGaps(analytics, cfg))
  insights.push(...analyzeCancellationTrends(analytics, cfg))
  insights.push(...analyzeNonOperativeTime(analytics, cfg))
  insights.push(...analyzeSchedulingPatterns(analytics, cfg))

  // Filter by minimum severity
  const severityThreshold = SEVERITY_ORDER[cfg.minSeverityToShow]
  const filtered = insights.filter(i => SEVERITY_ORDER[i.severity] <= severityThreshold)

  // Sort: critical first, then warning, positive, info
  // Within same severity, sort by financial impact (descending)
  filtered.sort((a, b) => {
    const sevDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
    if (sevDiff !== 0) return sevDiff

    // Parse financial impact for secondary sort
    const aImpact = parseFinancialValue(a.financialImpact)
    const bImpact = parseFinancialValue(b.financialImpact)
    return bImpact - aImpact
  })

  return filtered.slice(0, cfg.maxInsights)
}

// ============================================
// INSIGHT GENERATORS
// ============================================

/**
 * FIRST CASE DELAYS
 *
 * Derives:
 * - Total late minutes and their revenue impact
 * - Worst day-of-week pattern (from dailyData dates)
 * - Whether the problem is getting better or worse (delta)
 */
function analyzeFirstCaseDelays(
  analytics: AnalyticsOverview,
  cfg: ResolvedInsightsConfig
): Insight[] {
  const { fcots } = analytics
  const insights: Insight[] = []

  // Skip if on target or no data
  if (fcots.targetMet || fcots.value === 0) {
    if (fcots.value >= (fcots.target ?? 85)) {
      insights.push({
        id: 'fcots-on-target',
        category: 'first_case_delays',
        severity: 'positive',
        title: 'First Cases Starting On Time',
        body: `${fcots.displayValue} of first cases started within the grace period — meeting the ${fcots.target}% target. Consistent on-time starts protect downstream scheduling for the entire day.`,
        action: 'View FCOTS details →',
        actionRoute: '/analytics/fcots',
        drillThroughType: null,
        metadata: { rate: fcots.value, target: fcots.target },
      })
    }
    return insights
  }

  // Parse subtitle for late count: "11 late of 16 first cases (wheels-in, 2 min grace)"
  const lateMatch = fcots.subtitle.match(/(\d+)\s+late\s+of\s+(\d+)/)
  const lateCount = lateMatch ? parseInt(lateMatch[1]) : 0
  const totalFirstCases = lateMatch ? parseInt(lateMatch[2]) : 0

  // Day-of-week analysis from dailyData
  const worstDay = findWorstDayOfWeek(fcots.dailyData)

  // Estimate revenue impact:
  // Average first-case delay × late cases × revenue per OR minute
  // Conservative: assume average 12-min delay per late case
  const estimatedAvgDelay = 12 // minutes — could be refined with actual data
  const dailyDelayMinutes = lateCount > 0 && totalFirstCases > 0
    ? (lateCount / totalFirstCases) * estimatedAvgDelay * 4 // ~4 rooms
    : 0
  const annualImpact = Math.round(dailyDelayMinutes * cfg.revenuePerORMinute * cfg.operatingDaysPerYear)

  let body = `${lateCount} of ${totalFirstCases} first cases started late this period — a ${fcots.displayValue} on-time rate against a ${fcots.target}% target.`

  if (worstDay) {
    body += ` ${worstDay.name}s are the weakest day at ${worstDay.rate}% on-time.`
  }

  if (fcots.delta && fcots.deltaType === 'decrease') {
    body += ` This is ${fcots.delta}% worse than the previous period.`
  }

  insights.push({
    id: 'fcots-delays',
    category: 'first_case_delays',
    severity: fcots.value < 50 ? 'critical' : 'warning',
    title: 'First Case On-Time Below Target',
    body,
    action: 'View delay breakdown →',
    actionRoute: '/analytics/fcots',
    financialImpact: annualImpact > 0 ? `~$${formatCompactNumber(annualImpact)}/year estimated impact` : undefined,
    drillThroughType: 'fcots',
    metadata: {
      rate: fcots.value,
      target: fcots.target,
      lateCount,
      totalFirstCases,
      worstDay: worstDay?.name,
      annualImpact,
    },
  })

  return insights
}

/**
 * TURNOVER EFFICIENCY
 *
 * Derives:
 * - Gap between current median and target
 * - Recoverable minutes per day if target were met
 * - Whether same-room or flip-room is the bigger problem
 */
function analyzeTurnoverEfficiency(
  analytics: AnalyticsOverview,
  cfg: ResolvedInsightsConfig
): Insight[] {
  const insights: Insight[] = []
  const { turnoverTime, standardSurgicalTurnover, flipRoomTime } = analytics

  // Compare same-room vs flip-room to identify the bigger lever
  const sameRoomGap = standardSurgicalTurnover.value - (standardSurgicalTurnover.target ?? 45)
  const flipRoomGap = flipRoomTime.value - (flipRoomTime.target ?? 15)

  // Parse counts from subtitles
  const sameRoomCountMatch = standardSurgicalTurnover.subtitle.match(/(\d+)\s+turnovers/)
  const flipCountMatch = flipRoomTime.subtitle.match(/(\d+)\s+flips/)
  const sameRoomCount = sameRoomCountMatch ? parseInt(sameRoomCountMatch[1]) : 0
  const flipCount = flipCountMatch ? parseInt(flipCountMatch[1]) : 0

  // Room turnover (patient out → patient in)
  // Note: turnoverTime.target is the compliance target % (e.g., 80%), not threshold minutes.
  // The threshold minutes are in the subtitle: "X% under Y min target"
  if (!turnoverTime.targetMet && turnoverTime.value > 0) {
    const thresholdMatch = turnoverTime.subtitle.match(/under\s+(\d+)\s+min/)
    const targetMinutes = thresholdMatch ? parseInt(thresholdMatch[1]) : 30
    const excessPerTurnover = Math.max(0, turnoverTime.value - targetMinutes)
    // Estimate turnovers per day from subtitle
    const complianceMatch = turnoverTime.subtitle.match(/(\d+)%/)
    const complianceRate = complianceMatch ? parseInt(complianceMatch[1]) : 0

    const totalTurnoversPerDay = Math.round((sameRoomCount + flipCount) / Math.max(analytics.completedCases / 20, 1)) // rough daily estimate
    const dailyRecoverable = excessPerTurnover * totalTurnoversPerDay
    const annualImpact = Math.round(dailyRecoverable * cfg.revenuePerORMinute * cfg.operatingDaysPerYear)

    insights.push({
      id: 'turnover-room',
      category: 'turnover_efficiency',
      severity: complianceRate < 50 ? 'critical' : 'warning',
      title: 'Room Turnover Above Target',
      body: `Median room turnover is ${turnoverTime.displayValue} against a ${targetMinutes} min target, with only ${complianceRate}% of turnovers meeting the goal. ${excessPerTurnover > 10 ? 'This suggests systemic process delays beyond normal room cleaning.' : 'Tightening handoff communication between teams could close the remaining gap.'}`,
      action: 'View turnover trends →',
      actionRoute: '/analytics/turnover',
      financialImpact: annualImpact > 10000 ? `~$${formatCompactNumber(annualImpact)}/year recoverable` : undefined,
      drillThroughType: 'turnover',
      metadata: { median: turnoverTime.value, target: targetMinutes, complianceRate, excessPerTurnover },
    })
  }

  // Surgical turnover comparison: which is the bigger problem?
  if (sameRoomGap > 0 && flipRoomGap > 0 && sameRoomCount > 0 && flipCount > 0) {
    const sameRoomTarget = standardSurgicalTurnover.target ?? 45
    const flipRoomTarget = flipRoomTime.target ?? 15
    const biggerProblem = sameRoomGap * sameRoomCount > flipRoomGap * flipCount ? 'same-room' : 'flip-room'
    const totalExcessMinutes = (sameRoomGap * sameRoomCount) + (flipRoomGap * flipCount)

    insights.push({
      id: 'turnover-surgical-comparison',
      category: 'turnover_efficiency',
      severity: 'info',
      title: 'Surgical Turnover Breakdown',
      body: `Same-room surgical turnover is ${standardSurgicalTurnover.displayValue} (target ≤${sameRoomTarget} min, ${sameRoomCount} transitions) while flip-room is ${flipRoomTime.displayValue} (target ≤${flipRoomTarget} min, ${flipCount} flips). The ${biggerProblem} pathway accounts for more total excess minutes — focus process improvements there first.`,
      action: 'Compare turnover types →',
      actionRoute: '/analytics/turnover',
      drillThroughType: 'turnover',
      metadata: { sameRoomGap, flipRoomGap, biggerProblem, totalExcessMinutes },
    })
  }

  return insights
}

/**
 * CALLBACK OPTIMIZATION
 *
 * Derives:
 * - Best-in-class surgeon as benchmark
 * - Total recoverable idle minutes across all "call sooner" surgeons
 * - Specific coaching targets with financial projections
 */
function analyzeCallbackOptimization(
  analytics: AnalyticsOverview,
  cfg: ResolvedInsightsConfig
): Insight[] {
  const insights: Insight[] = []
  const { surgeonIdleSummaries } = analytics

  if (surgeonIdleSummaries.length === 0) return insights

  const flipSurgeons = surgeonIdleSummaries.filter(s => s.hasFlipData)
  const callSoonerSurgeons = flipSurgeons.filter(s => s.status === 'call_sooner')
  const onTrackSurgeons = flipSurgeons.filter(s => s.status === 'on_track')
  const callLaterSurgeons = flipSurgeons.filter(s => s.status === 'call_later')

  // Find best-in-class benchmark
  const bestFlipSurgeon = flipSurgeons.length > 0
    ? flipSurgeons.reduce((best, s) => s.medianFlipIdle < best.medianFlipIdle ? s : best)
    : null

  // "Call sooner" insight — the primary actionable recommendation
  if (callSoonerSurgeons.length > 0) {
    const totalRecoverableMinutes = callSoonerSurgeons.reduce(
      (sum, s) => sum + (s.medianCallbackDelta * s.flipGapCount), 0
    )

    // Extrapolate to annual: scale by (operating days / days in period)
    // We approximate period length from the data we have
    const uniqueDates = new Set(analytics.flipRoomAnalysis.map(a => a.date))
    const periodDays = Math.max(uniqueDates.size, 1)
    const dailyRecoverable = totalRecoverableMinutes / periodDays
    const annualRecoverable = Math.round(dailyRecoverable * cfg.operatingDaysPerYear)
    const annualImpact = annualRecoverable * cfg.revenuePerORMinute

    const worstSurgeon = callSoonerSurgeons[0] // Already sorted by callback delta desc

    let body = `${callSoonerSurgeons.length} surgeon${callSoonerSurgeons.length > 1 ? 's' : ''} with flip rooms could benefit from earlier patient callbacks — ${Math.round(totalRecoverableMinutes)} total idle minutes identified this period.`

    if (bestFlipSurgeon && worstSurgeon && bestFlipSurgeon.surgeonId !== worstSurgeon.surgeonId) {
      body += ` ${bestFlipSurgeon.surgeonName}'s ${Math.round(bestFlipSurgeon.medianFlipIdle)} min flip idle is the facility benchmark. Applying similar timing to ${worstSurgeon.surgeonName} (currently ${Math.round(worstSurgeon.medianFlipIdle)} min) could save ~${Math.round(worstSurgeon.medianCallbackDelta)} min per transition.`
    }

    insights.push({
      id: 'callback-call-sooner',
      category: 'callback_optimization',
      severity: totalRecoverableMinutes > 60 ? 'warning' : 'info',
      title: 'Callback Timing Opportunity',
      body,
      action: 'View surgeon callback details →',
      actionRoute: '/analytics/callback',
      financialImpact: annualImpact > 5000 ? `~$${formatCompactNumber(annualImpact)}/year if optimized` : undefined,
      drillThroughType: 'callback',
      metadata: {
        callSoonerCount: callSoonerSurgeons.length,
        totalRecoverableMinutes,
        bestSurgeon: bestFlipSurgeon?.surgeonName,
        bestFlipIdle: bestFlipSurgeon?.medianFlipIdle,
        worstSurgeon: worstSurgeon?.surgeonName,
        worstFlipIdle: worstSurgeon?.medianFlipIdle,
        annualImpact,
      },
    })
  }

  // "Call later" insight — surgeons arriving before rooms are ready
  if (callLaterSurgeons.length > 0) {
    insights.push({
      id: 'callback-call-later',
      category: 'callback_optimization',
      severity: 'info',
      title: 'Surgeons Arriving Too Early',
      body: `${callLaterSurgeons.length} surgeon${callLaterSurgeons.length > 1 ? 's are' : ' is'} arriving before flip rooms are ready (median idle ≤2 min suggests overlap with room prep). Consider delaying callbacks by 3-5 minutes to avoid surgeon waiting in hallways — this doesn't impact schedule but improves surgeon satisfaction.`,
      action: 'View affected surgeons →',
      actionRoute: '/analytics/callback',
      drillThroughType: 'callback',
      metadata: {
        callLaterSurgeons: callLaterSurgeons.map(s => s.surgeonName),
      },
    })
  }

  // All flip surgeons on track — positive reinforcement
  if (flipSurgeons.length > 0 && callSoonerSurgeons.length === 0 && callLaterSurgeons.length === 0) {
    insights.push({
      id: 'callback-all-on-track',
      category: 'callback_optimization',
      severity: 'positive',
      title: 'Callback Timing Well-Optimized',
      body: `All ${onTrackSurgeons.length} flip room surgeon${onTrackSurgeons.length !== 1 ? 's have' : ' has'} well-timed callbacks with median idle ≤5 min. This means patients are arriving in flip rooms close to when surgeons are ready — minimal wasted OR time.`,
      action: 'View callback performance →',
      actionRoute: '/analytics/callback',
      drillThroughType: null,
      metadata: { onTrackCount: onTrackSurgeons.length },
    })
  }

  // Same-room idle outliers
  const sameRoomOnly = surgeonIdleSummaries.filter(s => !s.hasFlipData)
  const highSameRoom = sameRoomOnly.filter(s => s.medianSameRoomIdle > 30)

  if (highSameRoom.length > 0) {
    const worstSameRoom = highSameRoom[0]
    insights.push({
      id: 'callback-same-room-high',
      category: 'callback_optimization',
      severity: highSameRoom.some(s => s.medianSameRoomIdle > 45) ? 'warning' : 'info',
      title: 'High Same-Room Idle Time',
      body: `${highSameRoom.length} same-room surgeon${highSameRoom.length > 1 ? 's have' : ' has'} elevated idle time between cases. ${worstSameRoom.surgeonName} averages ${Math.round(worstSameRoom.medianSameRoomIdle)} min between cases in the same room — this is turnover-driven, so focus on room cleaning speed and next-patient prep workflow rather than callback timing.`,
      action: 'View same-room turnovers →',
      actionRoute: '/analytics/turnover',
      drillThroughType: 'callback',
      metadata: {
        highSameRoomSurgeons: highSameRoom.map(s => ({ name: s.surgeonName, idle: s.medianSameRoomIdle })),
      },
    })
  }

  return insights
}

/**
 * UTILIZATION GAPS
 *
 * Derives:
 * - Rooms below target with reasons (high turnover vs low case volume)
 * - Cross-references room utilization with turnover data
 * - Identifies scheduling gaps vs operational gaps
 */
function analyzeUtilizationGaps(
  analytics: AnalyticsOverview,
  cfg: ResolvedInsightsConfig
): Insight[] {
  const insights: Insight[] = []
  const { orUtilization } = analytics
  const { roomBreakdown } = orUtilization

  if (roomBreakdown.length === 0) return insights

  // Overall utilization insight
  const utilTarget = orUtilization.target ?? 75
  if (!orUtilization.targetMet && orUtilization.value > 0) {
    const roomsBelowTarget = roomBreakdown.filter(r => r.utilization < utilTarget)
    const defaultHoursRooms = roomBreakdown.filter(r => !r.usingRealHours)

    // Estimate unused OR hours
    const totalUnusedMinutes = roomBreakdown.reduce((sum, r) => {
      const availableMinutes = r.availableHours * 60 * r.daysActive
      return sum + Math.max(0, availableMinutes - r.usedMinutes)
    }, 0)
    const unusedHours = Math.round(totalUnusedMinutes / 60)
    const annualUnusedHours = Math.round(unusedHours * (cfg.operatingDaysPerYear / Math.max(roomBreakdown[0]?.daysActive || 1, 1)))
    const annualImpact = annualUnusedHours * cfg.revenuePerORMinute * 60

    let body = `Overall OR utilization is ${orUtilization.displayValue} against a ${utilTarget}% target. ${roomsBelowTarget.length} of ${roomBreakdown.length} rooms are underperforming.`

    if (defaultHoursRooms.length > 0) {
      body += ` Note: ${defaultHoursRooms.length} room${defaultHoursRooms.length > 1 ? 's are' : ' is'} using default 10h availability — configuring actual hours in Settings may change these numbers significantly.`
    }

    // Identify the worst room
    const worstRoom = roomsBelowTarget.length > 0
      ? roomsBelowTarget.reduce((worst, r) => r.utilization < worst.utilization ? r : worst)
      : null

    if (worstRoom) {
      body += ` ${worstRoom.roomName} is the lowest at ${worstRoom.utilization}% with ${worstRoom.caseCount} cases over ${worstRoom.daysActive} days.`
    }

    insights.push({
      id: 'utilization-below-target',
      category: 'utilization_gap',
      severity: orUtilization.value < 50 ? 'critical' : 'warning',
      title: 'OR Utilization Below Target',
      body,
      action: 'View room breakdown →',
      actionRoute: '/analytics/utilization',
      financialImpact: annualImpact > 50000 ? `~$${formatCompactNumber(annualImpact)}/year in unused capacity` : undefined,
      drillThroughType: 'utilization',
      metadata: {
        utilization: orUtilization.value,
        roomsBelowTarget: roomsBelowTarget.length,
        totalRooms: roomBreakdown.length,
        worstRoom: worstRoom?.roomName,
        worstUtilization: worstRoom?.utilization,
        unusedHours,
        defaultHoursRooms: defaultHoursRooms.length,
      },
    })
  } else if (orUtilization.targetMet) {
    insights.push({
      id: 'utilization-on-target',
      category: 'utilization_gap',
      severity: 'positive',
      title: 'OR Utilization Meeting Target',
      body: `${orUtilization.displayValue} utilization across ${roomBreakdown.length} rooms meets the ${utilTarget}% goal. ${roomBreakdown.filter(r => r.utilization >= utilTarget).length} rooms are individually above target.`,
      action: 'View room details →',
      actionRoute: '/analytics/utilization',
      drillThroughType: null,
      metadata: { utilization: orUtilization.value },
    })
  }

  return insights
}

/**
 * CANCELLATION TRENDS
 *
 * Derives:
 * - Consecutive zero-cancellation streak from dailyData
 * - Whether trend is improving or worsening
 * - Revenue protected by avoided cancellations
 */
function analyzeCancellationTrends(
  analytics: AnalyticsOverview,
  cfg: ResolvedInsightsConfig
): Insight[] {
  const insights: Insight[] = []
  const { cancellationRate } = analytics

  // Calculate zero-cancellation streak
  const dailyData = cancellationRate.dailyData || []
  let currentStreak = 0
  // Count from most recent day backwards
  for (let i = dailyData.length - 1; i >= 0; i--) {
    if (dailyData[i].color === 'green') {
      currentStreak++
    } else {
      break
    }
  }

  if (cancellationRate.sameDayCount === 0 && currentStreak > 5) {
    // Positive: sustained zero cancellations
    const protectedRevenue = Math.round(
      (cancellationRate.totalCancelledCount > 0 ? cancellationRate.totalCancelledCount : 1)
      * cfg.revenuePerCase
    )

    insights.push({
      id: 'cancellation-streak',
      category: 'cancellation_trend',
      severity: 'positive',
      title: 'Zero Same-Day Cancellations',
      body: `No same-day cancellations for ${currentStreak} consecutive operating days${currentStreak > 15 ? ' — an exceptional streak' : ''}. This reflects strong pre-operative screening and patient preparation processes. Each avoided same-day cancellation protects approximately $${formatCompactNumber(cfg.revenuePerCase)} in scheduled revenue.`,
      action: 'View cancellation history →',
      actionRoute: '/analytics/cancellations',
      drillThroughType: null,
      metadata: { streak: currentStreak, sameDayCount: 0 },
    })
  } else if (cancellationRate.sameDayCount > 0) {
    const cancelTarget = cancellationRate.target ?? 5
    const annualProjectedCancellations = Math.round(
      cancellationRate.sameDayRate / 100 * (analytics.totalCases / Math.max(dailyData.length, 1)) * cfg.operatingDaysPerYear
    )
    const annualImpact = annualProjectedCancellations * cfg.revenuePerCase

    insights.push({
      id: 'cancellation-rate',
      category: 'cancellation_trend',
      severity: cancellationRate.sameDayRate > cancelTarget ? 'warning' : 'info',
      title: 'Same-Day Cancellations',
      body: `${cancellationRate.sameDayCount} same-day cancellation${cancellationRate.sameDayCount > 1 ? 's' : ''} this period (${cancellationRate.displayValue} rate). ${cancellationRate.targetMet ? `Still within the <${cancelTarget}% target.` : `Above the <${cancelTarget}% target — review pre-op clearance workflows.`}`,
      action: 'View cancellation details →',
      actionRoute: '/analytics/cancellations',
      financialImpact: annualImpact > 10000 ? `~$${formatCompactNumber(annualImpact)}/year at risk` : undefined,
      drillThroughType: 'cancellation',
      metadata: {
        sameDayCount: cancellationRate.sameDayCount,
        rate: cancellationRate.sameDayRate,
        annualProjected: annualProjectedCancellations,
      },
    })
  }

  return insights
}

/**
 * NON-OPERATIVE TIME
 *
 * Derives:
 * - Whether non-op time is dominated by pre-op or post-op
 * - Total recoverable minutes if pre-op were reduced by X%
 * - Comparison of pre-op time to surgical time ratio
 */
function analyzeNonOperativeTime(
  analytics: AnalyticsOverview,
  cfg: ResolvedInsightsConfig
): Insight[] {
  const insights: Insight[] = []
  const { nonOperativeTime, avgPreOpTime, avgClosingTime, avgEmergenceTime, avgSurgicalTime, completedCases } = analytics

  if (nonOperativeTime.value === 0 || completedCases === 0) return insights

  // Parse the subtitle for percentage: "33% of total case time · 49 cases"
  const percentMatch = nonOperativeTime.subtitle.match(/(\d+)%/)
  const nonOpPercent = percentMatch ? parseInt(percentMatch[1]) : 0

  // Determine dominant contributor
  const preOpTotal = avgPreOpTime
  const postOpTotal = avgClosingTime + avgEmergenceTime
  const dominant = preOpTotal > postOpTotal ? 'pre-op' : 'post-op'
  const dominantMinutes = Math.round(Math.max(preOpTotal, postOpTotal))

  if (nonOpPercent > 30) {
    // Estimate impact of 20% reduction in dominant phase
    const reductionTarget = 0.2
    const savedMinutesPerCase = dominantMinutes * reductionTarget
    const dailyCases = Math.max(completedCases / 20, 1) // rough daily average
    const dailySaved = savedMinutesPerCase * dailyCases
    const annualImpact = Math.round(dailySaved * cfg.revenuePerORMinute * cfg.operatingDaysPerYear)

    insights.push({
      id: 'non-op-time-high',
      category: 'non_operative_time',
      severity: nonOpPercent > 40 ? 'warning' : 'info',
      title: 'Non-Operative Time Opportunity',
      body: `${nonOpPercent}% of total case time is non-operative (${nonOperativeTime.displayValue} average). The ${dominant} phase at ${dominantMinutes} min is the larger contributor. A 20% reduction in ${dominant} time would recover ~${Math.round(savedMinutesPerCase)} min per case — equivalent to ${Math.round(dailySaved)} min of OR capacity daily.`,
      action: 'View time breakdown →',
      actionRoute: '/analytics/time-breakdown',
      financialImpact: annualImpact > 20000 ? `~$${formatCompactNumber(annualImpact)}/year if ${dominant} reduced 20%` : undefined,
      drillThroughType: 'non_op_time',
      metadata: {
        nonOpPercent,
        dominant,
        dominantMinutes,
        preOpTime: Math.round(preOpTotal),
        postOpTime: Math.round(postOpTotal),
        savedMinutesPerCase: Math.round(savedMinutesPerCase),
      },
    })
  }

  // Pre-op to surgical ratio flag
  if (avgSurgicalTime > 0 && preOpTotal / avgSurgicalTime > 0.5) {
    insights.push({
      id: 'preop-ratio-high',
      category: 'non_operative_time',
      severity: 'info',
      title: 'Pre-Op Time Relative to Surgery',
      body: `Average pre-op time (${Math.round(preOpTotal)} min) is ${Math.round(preOpTotal / avgSurgicalTime * 100)}% of average surgical time (${Math.round(avgSurgicalTime)} min). For short procedures, this ratio suggests room setup and anesthesia induction are proportionally significant — parallel prep workflows could help.`,
      action: 'View phase analysis →',
      actionRoute: '/analytics/time-breakdown',
      drillThroughType: 'non_op_time',
      metadata: {
        preOpTime: Math.round(preOpTotal),
        surgicalTime: Math.round(avgSurgicalTime),
        ratio: Math.round(preOpTotal / avgSurgicalTime * 100),
      },
    })
  }

  return insights
}

/**
 * SCHEDULING PATTERNS
 *
 * Derives:
 * - Whether low utilization is from scheduling gaps vs operational inefficiency
 * - Compares case volume trend with utilization trend
 */
function analyzeSchedulingPatterns(
  analytics: AnalyticsOverview,
  cfg: ResolvedInsightsConfig
): Insight[] {
  const insights: Insight[] = []
  const { caseVolume, orUtilization } = analytics

  // Volume increasing but utilization flat/decreasing = scheduling efficiency problem
  if (
    caseVolume.deltaType === 'increase' &&
    caseVolume.delta &&
    caseVolume.delta > 10 &&
    orUtilization.deltaType === 'decrease'
  ) {
    insights.push({
      id: 'scheduling-divergence',
      category: 'scheduling_pattern',
      severity: 'warning',
      title: 'Volume Up, Utilization Down',
      body: `Case volume increased ${caseVolume.delta}% while OR utilization dropped ${orUtilization.delta}%. More cases are being scheduled but rooms are being used less efficiently — this often indicates scheduling gaps between cases, room assignment imbalances, or block time not matching actual demand.`,
      action: 'Review block utilization →',
      actionRoute: '/analytics/utilization',
      drillThroughType: 'scheduling',
      metadata: {
        volumeDelta: caseVolume.delta,
        utilDelta: orUtilization.delta,
      },
    })
  }

  // Volume decreasing — flag separately
  if (
    caseVolume.deltaType === 'decrease' &&
    caseVolume.delta &&
    caseVolume.delta > 15
  ) {
    const estimatedRevenueLoss = Math.round(
      (caseVolume.value * (caseVolume.delta / 100)) * cfg.revenuePerCase
    )

    insights.push({
      id: 'volume-declining',
      category: 'scheduling_pattern',
      severity: caseVolume.delta > 25 ? 'critical' : 'warning',
      title: 'Case Volume Declining',
      body: `Case volume dropped ${caseVolume.delta}% compared to the previous period (${caseVolume.displayValue} cases). This may reflect seasonal patterns, surgeon availability changes, or market shifts. Review scheduling pipeline and surgeon block allocations.`,
      action: 'View volume trends →',
      actionRoute: '/analytics/volume',
      financialImpact: estimatedRevenueLoss > 20000 ? `~$${formatCompactNumber(estimatedRevenueLoss)} revenue impact` : undefined,
      drillThroughType: 'scheduling',
      metadata: { volumeDelta: caseVolume.delta, totalCases: caseVolume.value },
    })
  }

  return insights
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Find the worst day of week from daily tracker data.
 * Parses the date from each entry and groups by weekday.
 */
function findWorstDayOfWeek(
  dailyData?: DailyTrackerData[]
): { name: string; rate: number; count: number } | null {
  if (!dailyData || dailyData.length < 5) return null // Need at least 5 days for pattern

  const dayNames = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays']
  const dayStats = new Map<number, { good: number; total: number }>()

  dailyData.forEach(d => {
    const date = new Date(d.date + 'T12:00:00') // Noon to avoid timezone shifts
    const day = date.getDay()
    const stats = dayStats.get(day) || { good: 0, total: 0 }
    stats.total++
    if (d.color === 'green') stats.good++
    dayStats.set(day, stats)
  })

  // Find the day with the lowest on-time rate (minimum 2 occurrences)
  let worstDay: { name: string; rate: number; count: number } | null = null

  dayStats.forEach((stats, day) => {
    if (stats.total < 2) return // Need at least 2 data points
    const rate = Math.round((stats.good / stats.total) * 100)
    if (!worstDay || rate < worstDay.rate) {
      worstDay = { name: dayNames[day], rate, count: stats.total }
    }
  })

  // Only return if there's a meaningful difference (not all days equally bad)
  const result = worstDay as { name: string; rate: number; count: number } | null
  if (result) {
    const avgRate = Array.from(dayStats.values()).reduce((sum, s) => sum + (s.good / s.total), 0) / dayStats.size * 100
    if (result.rate >= avgRate - 10) return null // Not meaningfully worse
  }

  return result
}

/**
 * Format large numbers compactly: 180000 → "180K", 1500000 → "1.5M"
 */
function formatCompactNumber(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  }
  if (value >= 1_000) {
    return `${Math.round(value / 1_000)}K`
  }
  return value.toString()
}

/**
 * Parse a financial impact string back to a number for sorting.
 * e.g. "~$180K/year estimated impact" → 180000
 */
function parseFinancialValue(impact?: string): number {
  if (!impact) return 0
  const match = impact.match(/\$([\d.]+)(K|M)?/)
  if (!match) return 0
  const base = parseFloat(match[1])
  const multiplier = match[2] === 'M' ? 1_000_000 : match[2] === 'K' ? 1_000 : 1
  return base * multiplier
}
