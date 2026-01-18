// ============================================
// CASE STATS FROM MATERIALIZED VIEWS
// ============================================

/**
 * Raw case data from case_completion_stats table
 */
export interface CaseCompletionStats {
  id: string
  case_id: string
  case_number: string
  facility_id: string
  surgeon_id: string | null
  procedure_type_id: string | null
  payer_id: string | null
  or_room_id: string | null
  case_date: string
  scheduled_start_time: string | null
  actual_start_time: string | null
  
  // Durations
  total_duration_minutes: number | null
  surgical_duration_minutes: number | null
  anesthesia_duration_minutes: number | null
  
  // Pre-case
  call_to_patient_in_minutes: number | null
  schedule_variance_minutes: number | null
  
  // Turnover
  room_turnover_minutes: number | null
  surgical_turnover_minutes: number | null
  
  // Flags
  is_first_case_of_day_room: boolean
  is_first_case_of_day_surgeon: boolean
  
  // Context
  surgeon_room_count: number | null
  surgeon_case_sequence: number | null
  room_case_sequence: number | null
  
  // Financial
  reimbursement: number | null
  soft_goods_cost: number | null
  hard_goods_cost: number | null
  or_cost: number | null
  profit: number | null
  or_hourly_rate: number | null
  
  // Joined data (from query)
  surgeon?: {
    first_name: string
    last_name: string
  } | null
  procedure_types?: {
    id: string
    name: string
  } | null
  payers?: {
    id: string
    name: string
  } | null
  or_rooms?: {
    name: string
  } | null
}

/**
 * Pre-computed stats per surgeon per procedure from surgeon_procedure_stats view
 */
export interface SurgeonProcedureStats {
  facility_id: string
  surgeon_id: string
  procedure_type_id: string
  sample_size: number
  
  // Duration
  avg_duration: number | null
  median_duration: number | null
  stddev_duration: number | null
  p25_duration: number | null
  p75_duration: number | null
  min_duration: number | null
  max_duration: number | null
  
  // Surgical time
  avg_surgical_duration: number | null
  median_surgical_duration: number | null
  stddev_surgical_duration: number | null
  
  // Anesthesia time
  avg_anesthesia_duration: number | null
  median_anesthesia_duration: number | null
  
  // Call to patient in
  avg_call_to_patient_in: number | null
  median_call_to_patient_in: number | null
  stddev_call_to_patient_in: number | null
  
  // Schedule variance
  avg_schedule_variance: number | null
  median_schedule_variance: number | null
  
  // Room turnover (excluding first cases)
  avg_room_turnover: number | null
  median_room_turnover: number | null
  stddev_room_turnover: number | null
  
  // Surgical turnover (excluding first cases)
  avg_surgical_turnover: number | null
  median_surgical_turnover: number | null
  stddev_surgical_turnover: number | null
  
  // First case stats
  avg_first_case_delay: number | null
  median_first_case_delay: number | null
  first_case_count: number
  
  // Profit
  avg_profit: number | null
  median_profit: number | null
  stddev_profit: number | null
  p25_profit: number | null
  p75_profit: number | null
  total_profit: number | null
  
  // Reimbursement
  avg_reimbursement: number | null
  median_reimbursement: number | null
  
  // Metadata
  last_case_date: string
  first_case_date: string
}

/**
 * Pre-computed stats per procedure at facility level from facility_procedure_stats view
 */
export interface FacilityProcedureStats {
  facility_id: string
  procedure_type_id: string
  sample_size: number
  surgeon_count: number
  
  // Duration
  avg_duration: number | null
  median_duration: number | null
  stddev_duration: number | null
  p25_duration: number | null
  p75_duration: number | null
  min_duration: number | null
  max_duration: number | null
  
  // Surgical time
  avg_surgical_duration: number | null
  median_surgical_duration: number | null
  stddev_surgical_duration: number | null
  
  // Anesthesia time
  avg_anesthesia_duration: number | null
  median_anesthesia_duration: number | null
  
  // Call to patient in
  avg_call_to_patient_in: number | null
  median_call_to_patient_in: number | null
  stddev_call_to_patient_in: number | null
  
  // Schedule variance
  avg_schedule_variance: number | null
  median_schedule_variance: number | null
  
  // Room turnover
  avg_room_turnover: number | null
  median_room_turnover: number | null
  stddev_room_turnover: number | null
  
  // Surgical turnover
  avg_surgical_turnover: number | null
  median_surgical_turnover: number | null
  stddev_surgical_turnover: number | null
  
  // First case stats
  avg_first_case_delay: number | null
  median_first_case_delay: number | null
  first_case_count: number
  
  // Profit
  avg_profit: number | null
  median_profit: number | null
  stddev_profit: number | null
  p25_profit: number | null
  p75_profit: number | null
  total_profit: number | null
  
  // Reimbursement
  avg_reimbursement: number | null
  median_reimbursement: number | null
  
  // Metadata
  last_case_date: string
  first_case_date: string
}

/**
 * Overall surgeon stats from surgeon_overall_stats view
 */
export interface SurgeonOverallStats {
  facility_id: string
  surgeon_id: string
  total_cases: number
  procedure_type_count: number
  days_worked: number
  
  // Duration
  avg_duration: number | null
  median_duration: number | null
  stddev_duration: number | null
  
  // Surgical time
  avg_surgical_duration: number | null
  median_surgical_duration: number | null
  
  // Turnover
  avg_surgical_turnover: number | null
  median_surgical_turnover: number | null
  
  // Multi-room
  avg_rooms_per_day: number | null
  max_rooms_per_day: number | null
  multi_room_case_count: number
  
  // Profit
  total_profit: number | null
  avg_profit: number | null
  median_profit: number | null
  stddev_profit: number | null
  
  // Activity
  last_case_date: string
  first_case_date: string
  cases_last_30_days: number
  cases_last_90_days: number
}


// ============================================
// OUTLIER TYPES
// ============================================

export type OutlierType = 'personal' | 'facility' | 'both' | 'none'

export type Issue = 
  | {
      type: 'overTime'
      actualMinutes: number
      expectedMinutes: number
      thresholdMinutes: number
      minutesOver: number
    }
  | {
      type: 'lowProfit'
      actualProfit: number
      expectedProfit: number
      thresholdProfit: number
      amountBelow: number
    }
  | {
      type: 'delay'
      totalMinutes: number
      delays: Array<{ name: string; minutes?: number }>
    }
  | {
      type: 'lowPayer'
      payerName: string
      payerRate: number
      defaultRate: number
      percentBelow: number
    }
  | {
      type: 'unknown'
    }

export interface OutlierFlags {
  // Duration outliers (ABOVE threshold = bad)
  isDurationPersonalOutlier: boolean
  isDurationFacilityOutlier: boolean
  durationOutlierType: OutlierType
  
  // Profit outliers (BELOW threshold = bad)
  isProfitPersonalOutlier: boolean
  isProfitFacilityOutlier: boolean
  profitOutlierType: OutlierType
  
  // Thresholds (for display/tooltip)
  personalDurationThreshold: number | null    // surgeon median + stddev
  facilityDurationThreshold: number | null    // facility median + stddev
  personalProfitThreshold: number | null      // surgeon median - stddev
  facilityProfitThreshold: number | null      // facility median - stddev
}

// ============================================
// ISSUE TYPES
// ============================================

export type CaseIssue = 
  | { 
      type: 'overTime'
      actualMinutes: number
      expectedMinutes: number  // surgeon's median
      thresholdMinutes: number // median + stddev
      minutesOver: number
    }
  | { 
      type: 'delay'
      delays: { name: string; minutes: number | null }[]
      totalMinutes: number
    }
  | { 
      type: 'lowPayer'
      payerName: string
      payerRate: number
      defaultRate: number
      percentBelow: number
    }
  | { 
      type: 'lowProfit'
      actualProfit: number
      expectedProfit: number  // surgeon's median
      thresholdProfit: number // median - stddev
      amountBelow: number
    }
  | { 
      type: 'unknown' 
    }

// ============================================
// FINANCIAL BREAKDOWN (FOR DRAWER)
// ============================================

export interface FinancialBreakdown {
  reimbursement: number
  softGoodsCost: number
  hardGoodsCost: number
  orCost: number
  orRate: number
  payerName: string | null
  
  // Comparison to expected
  expectedProfit: number | null       // surgeon's median profit for this procedure
  facilityExpectedProfit: number | null // facility median profit for this procedure
  expectedDuration: number | null     // surgeon's median duration
  facilityExpectedDuration: number | null // facility median duration
}

// ============================================
// OUTLIER CASE (UPDATED WITH DUAL FLAGS)
// ============================================

export interface OutlierCase {
  caseId: string
  caseNumber: string
  date: string
  surgeonId: string | null
  surgeonName: string
  procedureId: string | null
  procedureName: string
  roomName: string | null
  
  // Actual values
  actualProfit: number
  actualDuration: number
  
  // Expected values (surgeon's median for this procedure)
  expectedProfit: number | null
  expectedDuration: number | null
  
  // Facility baseline (for comparison)
  facilityExpectedProfit: number | null
  facilityExpectedDuration: number | null
  
  // Gaps
  profitGap: number  // actual - expected (negative = below)
  durationGap: number // actual - expected (positive = over)
  
  // Outlier classification
  outlierFlags: OutlierFlags
  
  // Detected issues
  issues: CaseIssue[]
  
  // Full breakdown for drawer
  financialBreakdown: FinancialBreakdown
}

// ============================================
// STATS TYPES (UPDATED WITH MEDIAN)
// ============================================

export interface SurgeonStats {
  surgeonId: string
  surgeonName: string
  caseCount: number
  
  // Profit (both avg and median)
  totalProfit: number
  avgProfit: number
  medianProfit: number | null
  stddevProfit: number | null
  profitRange: { p25: number | null; p75: number | null }
  
  // Duration (both avg and median)
  avgDurationMinutes: number
  medianDurationMinutes: number | null
  stddevDurationMinutes: number | null
  
  // Comparison to facility baseline
  durationVsFacilityMinutes: number  // surgeon median - facility median
  profitVsFacility: number           // surgeon median - facility median
  
  // Profit impact from duration difference
  profitImpact: number
  
  // Consistency rating (lower stddev = more consistent)
  consistencyRating: 'high' | 'medium' | 'low' | null
  
  // Turnover stats
  medianSurgicalTurnover: number | null
}

export interface ProcedureStats {
  procedureId: string
  procedureName: string
  caseCount: number
  surgeonCount: number
  
  // Profit (both avg and median)
  totalProfit: number
  avgProfit: number
  medianProfit: number | null
  stddevProfit: number | null
  profitRange: { p25: number | null; p75: number | null }
  avgMarginPercent: number
  
  // Duration (both avg and median)
  avgDurationMinutes: number
  medianDurationMinutes: number | null
  stddevDurationMinutes: number | null
  durationRange: { p25: number | null; p75: number | null }
  
  // Surgeon breakdown
  surgeonBreakdown: SurgeonStats[]
}

// ============================================
// ISSUE STATS (UPDATED)
// ============================================

export interface IssueStats {
  overTime: number
  delay: number
  lowPayer: number
  lowProfit: number
  unknown: number
}

export interface OutlierStats {
  total: number
  personalOnly: number      // Only flagged by surgeon's own baseline
  facilityOnly: number      // Only flagged by facility baseline
  both: number              // Flagged by both
  
  // By type
  durationOutliers: number
  profitOutliers: number
}

// ============================================
// PROFIT TREND
// ============================================

export interface ProfitTrendPoint {
  date: string
  profit: number
  caseCount: number
  medianProfit: number | null  // Running median (optional)
}

// ============================================
// MAIN METRICS OBJECT (UPDATED)
// ============================================

export interface FinancialsMetrics {
  // Case counts
  totalCases: number
  
  // Profit summary (both avg and median)
  totalProfit: number
  avgProfit: number
  medianProfit: number | null
  stddevProfit: number | null
  profitRange: { p25: number | null; p75: number | null }
  avgMargin: number
  
  // Duration summary
  avgDuration: number
  medianDuration: number | null
  
  // Outliers (updated with dual classification)
  outlierStats: OutlierStats
  outlierDetails: OutlierCase[]
  issueStats: IssueStats
  
  // Time = Money
  costPerMinute: number
  excessTimeCost: number
  
  // Breakdowns
  procedureStats: ProcedureStats[]
  surgeonStats: SurgeonStats[]
  
  // Trend
  profitTrend: ProfitTrendPoint[]
  
  // Settings
  orRate: number
}

// ============================================
// UI TYPES
// ============================================

export type SubTab = 'overview' | 'procedure' | 'surgeon' | 'outliers'

export type OutlierFilter = 'all' | 'personal' | 'facility' | 'both' | 'duration' | 'profit'

// ============================================
// FACILITY SETTINGS (unchanged)
// ============================================

export interface FacilitySettings {
  or_hourly_rate: number | null
}