// components/analytics/financials/types.ts
// UPDATED: Added total_debits/total_credits/or_time_cost to CaseCompletionStats
// UPDATED: Added profitPerORHour to SurgeonStats and ProcedureStats
// UPDATED: Added revenue/cost breakdown to FinancialsMetrics

// ============================================
// CASE STATS FROM MATERIALIZED VIEWS
// ============================================

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
  
  // Financial — legacy columns (now populated correctly)
  reimbursement: number | null
  soft_goods_cost: number | null   // = total_debits
  hard_goods_cost: number | null   // = total_credits
  or_cost: number | null
  profit: number | null
  or_hourly_rate: number | null
  
  // Financial — new columns
  total_debits: number | null
  total_credits: number | null
  net_cost: number | null
  or_time_cost: number | null
  cost_source: string | null
  
  // Joined data
  surgeon?: {
    first_name: string
    last_name: string
  } | {
    first_name: string
    last_name: string
  }[] | null
  procedure_types?: {
    id: string
    name: string
  } | {
    id: string
    name: string
  }[] | null
  payers?: {
    id: string
    name: string
  } | {
    id: string
    name: string
  }[] | null
  or_rooms?: {
    name: string
  } | {
    name: string
  }[] | null
}

// ============================================
// PRE-COMPUTED STATS (unchanged)
// ============================================

export interface SurgeonProcedureStats {
  facility_id: string
  surgeon_id: string
  procedure_type_id: string
  sample_size: number
  avg_duration: number | null
  median_duration: number | null
  stddev_duration: number | null
  p25_duration: number | null
  p75_duration: number | null
  min_duration: number | null
  max_duration: number | null
  avg_surgical_duration: number | null
  median_surgical_duration: number | null
  stddev_surgical_duration: number | null
  avg_anesthesia_duration: number | null
  median_anesthesia_duration: number | null
  avg_call_to_patient_in: number | null
  median_call_to_patient_in: number | null
  stddev_call_to_patient_in: number | null
  avg_schedule_variance: number | null
  median_schedule_variance: number | null
  avg_room_turnover: number | null
  median_room_turnover: number | null
  stddev_room_turnover: number | null
  avg_surgical_turnover: number | null
  median_surgical_turnover: number | null
  stddev_surgical_turnover: number | null
  avg_first_case_delay: number | null
  median_first_case_delay: number | null
  first_case_count: number
  avg_profit: number | null
  median_profit: number | null
  stddev_profit: number | null
  p25_profit: number | null
  p75_profit: number | null
  total_profit: number | null
  avg_reimbursement: number | null
  median_reimbursement: number | null
  last_case_date: string
  first_case_date: string
}

export interface FacilityProcedureStats {
  facility_id: string
  procedure_type_id: string
  sample_size: number
  surgeon_count: number
  avg_duration: number | null
  median_duration: number | null
  stddev_duration: number | null
  p25_duration: number | null
  p75_duration: number | null
  min_duration: number | null
  max_duration: number | null
  avg_surgical_duration: number | null
  median_surgical_duration: number | null
  stddev_surgical_duration: number | null
  avg_anesthesia_duration: number | null
  median_anesthesia_duration: number | null
  avg_call_to_patient_in: number | null
  median_call_to_patient_in: number | null
  stddev_call_to_patient_in: number | null
  avg_schedule_variance: number | null
  median_schedule_variance: number | null
  avg_room_turnover: number | null
  median_room_turnover: number | null
  stddev_room_turnover: number | null
  avg_surgical_turnover: number | null
  median_surgical_turnover: number | null
  stddev_surgical_turnover: number | null
  avg_first_case_delay: number | null
  median_first_case_delay: number | null
  first_case_count: number
  avg_profit: number | null
  median_profit: number | null
  stddev_profit: number | null
  p25_profit: number | null
  p75_profit: number | null
  total_profit: number | null
  avg_reimbursement: number | null
  median_reimbursement: number | null
  last_case_date: string
  first_case_date: string
}

export interface SurgeonOverallStats {
  facility_id: string
  surgeon_id: string
  total_cases: number
  procedure_type_count: number
  days_worked: number
  avg_duration: number | null
  median_duration: number | null
  stddev_duration: number | null
  avg_surgical_duration: number | null
  median_surgical_duration: number | null
  avg_surgical_turnover: number | null
  median_surgical_turnover: number | null
  avg_rooms_per_day: number | null
  max_rooms_per_day: number | null
  multi_room_case_count: number
  total_profit: number | null
  avg_profit: number | null
  median_profit: number | null
  stddev_profit: number | null
  last_case_date: string
  first_case_date: string
  cases_last_30_days: number
  cases_last_90_days: number
}


// ============================================
// SURGEON PROCEDURE BREAKDOWN
// ============================================

export interface SurgeonProcedureBreakdown {
  procedureId: string
  procedureName: string
  caseCount: number
  medianDuration: number | null
  medianProfit: number | null
  totalProfit: number
  facilityMedianDuration: number | null
  facilityMedianProfit: number | null
  durationVsFacility: number
  profitVsFacility: number
  durationVsFacilityPct: number | null
  profitVsFacilityPct: number | null
}

// ============================================
// STATS TYPES — UPDATED with profitPerORHour, margin, cost breakdown
// ============================================

export interface SurgeonStats {
  surgeonId: string
  surgeonName: string
  caseCount: number
  
  // Revenue & costs
  totalReimbursement: number
  totalDebits: number
  totalCredits: number
  totalORCost: number
  
  // Profit
  totalProfit: number
  avgProfit: number
  medianProfit: number | null
  stddevProfit: number | null
  profitRange: { p25: number | null; p75: number | null }
  
  // Margin
  avgMarginPercent: number
  
  // Profit per OR hour (the key enterprise metric)
  profitPerORHour: number | null
  
  // Duration
  avgDurationMinutes: number
  medianDurationMinutes: number | null
  stddevDurationMinutes: number | null
  totalORMinutes: number
  
  // Comparison to facility baseline (procedure-adjusted)
  durationVsFacilityMinutes: number
  profitVsFacility: number
  profitImpact: number
  
  // Consistency
  consistencyRating: 'high' | 'medium' | 'low' | null
  
  // Turnover
  medianSurgicalTurnover: number | null
  
  // Procedure breakdown
  procedureBreakdown?: SurgeonProcedureBreakdown[]
}

export interface ProcedureStats {
  procedureId: string
  procedureName: string
  caseCount: number
  surgeonCount: number
  
  // Revenue & costs
  totalReimbursement: number
  avgReimbursement: number
  totalDebits: number
  totalCredits: number
  totalORCost: number
  
  // Profit
  totalProfit: number
  avgProfit: number
  medianProfit: number | null
  stddevProfit: number | null
  profitRange: { p25: number | null; p75: number | null }
  avgMarginPercent: number
  
  // Profit per OR hour
  profitPerORHour: number | null
  
  // Duration
  avgDurationMinutes: number
  medianDurationMinutes: number | null
  stddevDurationMinutes: number | null
  durationRange: { p25: number | null; p75: number | null }
  
  // Surgeon breakdown
  surgeonBreakdown: SurgeonStats[]
}

// ============================================
// PROFIT TREND
// ============================================

export interface ProfitTrendPoint {
  date: string
  profit: number
  caseCount: number
  medianProfit: number | null
}

// ============================================
// MAIN METRICS OBJECT — UPDATED with P&L summary
// ============================================

export interface FinancialsMetrics {
  // Case counts
  totalCases: number
  
  // Revenue & cost breakdown (NEW — for P&L view)
  totalReimbursement: number
  totalDebits: number
  totalCredits: number
  totalORCost: number
  
  // Profit summary
  totalProfit: number
  avgProfit: number
  medianProfit: number | null
  stddevProfit: number | null
  profitRange: { p25: number | null; p75: number | null }
  avgMargin: number
  
  // Profit per OR hour
  profitPerORHour: number | null
  
  // Duration summary
  avgDuration: number
  medianDuration: number | null
  totalORMinutes: number
  
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
// PAYER MIX
// ============================================

export interface PayerMixEntry {
  payerId: string
  payerName: string
  caseCount: number
  totalReimbursement: number
  avgReimbursement: number
  totalProfit: number
  avgProfit: number
  marginPercent: number
  pctOfCases: number
}

// ============================================
// PROFIT DISTRIBUTION BINS
// ============================================

export interface ProfitBin {
  rangeLabel: string
  min: number
  max: number
  count: number
}

// ============================================
// MONTHLY TREND (for sparklines)
// ============================================

export interface MonthlyTrendPoint {
  year: number
  month: number
  label: string
  caseCount: number
  totalProfit: number
  avgProfit: number
  totalReimbursement: number
  marginPercent: number
  medianDuration: number | null
  profitPerORHour: number | null
}

// ============================================
// FINANCIAL TARGETS
// ============================================

export interface FinancialTarget {
  id: string
  facility_id: string
  year: number
  month: number
  profit_target: number
  created_at: string
  updated_at: string
}

// ============================================
// PHASE DURATION (from case_milestones)
// ============================================

export interface PhaseDuration {
  phaseName: string
  phaseGroup: string
  durationMinutes: number | null
  color: PhasePillColor
}

export type PhasePillColor = 'blue' | 'green' | 'amber' | 'violet'

/**
 * Per-case phase duration used in case cards (daily activity, recent cases)
 */
export interface CasePhaseDuration {
  label: string
  minutes: number | null
  color: PhasePillColor
}

// ============================================
// SORT DIRECTION
// ============================================

export type SortDir = 'asc' | 'desc'

// ============================================
// CONSISTENCY RATING
// ============================================

export type ConsistencyRating = 'high' | 'medium' | 'low'

// ============================================
// UI TYPES
// ============================================

export type SubTab = 'overview' | 'procedure' | 'surgeon'

export interface FacilitySettings {
  or_hourly_rate: number | null
}

// ============================================
// ENRICHED METRICS (extends FinancialsMetrics with new computations)
// ============================================

export interface EnrichedFinancialsMetrics extends FinancialsMetrics {
  // Payer mix analysis
  payerMix: PayerMixEntry[]

  // Profit distribution histogram
  profitBins: ProfitBin[]

  // Monthly trend sparklines (last 6 months)
  monthlyTrend: MonthlyTrendPoint[]

  // Sparkline data arrays (extracted from monthlyTrend for easy consumption)
  sparklines: {
    profit: number[]
    margin: number[]
    duration: number[]
    profitPerHour: number[]
    volume: number[]
  }
}