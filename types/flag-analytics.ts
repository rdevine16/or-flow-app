// types/flag-analytics.ts
// TypeScript interfaces for the flag analytics page data layer.
// Matches the JSON shape returned by the get_flag_analytics RPC.

// ============================================
// Summary KPIs
// ============================================

export interface FlagSummaryKPIs {
  totalCases: number
  flaggedCases: number
  flagRate: number
  flagRateTrend: number
  delayedCases: number
  delayRate: number
  delayRateTrend: number
  criticalCount: number
  warningCount: number
  infoCount: number
  totalFlags: number
  avgFlagsPerCase: number
}

// ============================================
// Sparkline data (weekly arrays for mini charts)
// ============================================

export interface FlagSparklineData {
  flagRate: number[]
  delayRate: number[]
}

// ============================================
// Weekly trend (stacked area chart data)
// ============================================

export interface WeeklyTrendPoint {
  week: string
  threshold: number
  delay: number
  total: number
}

// ============================================
// Day-of-week heatmap
// ============================================

export interface DayOfWeekRow {
  day: string
  dayNum: number
  fcots: number
  timing: number
  turnover: number
  delay: number
  total: number
}

// ============================================
// Flag rule breakdown (threshold flags by rule)
// ============================================

export interface FlagRuleBreakdownItem {
  name: string
  count: number
  severity: 'info' | 'warning' | 'critical'
  pct: number
}

// ============================================
// Delay type breakdown
// ============================================

export interface DelayTypeBreakdownItem {
  name: string
  count: number
  pct: number
  avgDuration: number | null
}

// ============================================
// Surgeon flag distribution
// ============================================

export interface SurgeonFlagRow {
  name: string
  surgeonId: string
  cases: number
  flags: number
  rate: number
  trend: number
  topFlag: string
}

// ============================================
// Room flag distribution
// ============================================

export interface RoomFlagRow {
  room: string
  roomId: string
  cases: number
  flags: number
  rate: number
  topIssue: string
  topDelay: string
}

// ============================================
// Recent flagged cases
// ============================================

export interface RecentFlaggedCaseFlag {
  type: 'threshold' | 'delay'
  name: string
  severity: 'info' | 'warning' | 'critical'
}

export interface RecentFlaggedCase {
  caseId: string
  caseNumber: string
  date: string
  surgeon: string
  procedure: string
  flags: RecentFlaggedCaseFlag[]
}

// ============================================
// Pattern detection (computed client-side)
// ============================================

export type PatternType =
  | 'day_spike'
  | 'equipment_cascade'
  | 'trend_improvement'
  | 'trend_deterioration'
  | 'room_concentration'
  | 'recurring_surgeon'

export type PatternSeverity = 'critical' | 'warning' | 'good'

export interface DetectedPattern {
  type: PatternType
  title: string
  desc: string
  severity: PatternSeverity
  metric: string
}

// ============================================
// Top-level analytics data (RPC response shape)
// ============================================

export interface FlagAnalyticsRPCResponse {
  summary: FlagSummaryKPIs
  sparklineData: FlagSparklineData
  weeklyTrend: WeeklyTrendPoint[]
  dayOfWeekHeatmap: DayOfWeekRow[]
  flagRuleBreakdown: FlagRuleBreakdownItem[]
  delayTypeBreakdown: DelayTypeBreakdownItem[]
  surgeonFlags: SurgeonFlagRow[]
  roomFlags: RoomFlagRow[]
  recentFlaggedCases: RecentFlaggedCase[]
}

// ============================================
// Hook return type (RPC data + patterns)
// ============================================

export interface FlagAnalyticsData extends FlagAnalyticsRPCResponse {
  patterns: DetectedPattern[]
}
