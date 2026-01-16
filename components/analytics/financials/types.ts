// ============================================
// CASE AND FINANCIAL DATA TYPES
// ============================================

export interface CaseWithFinancials {
  id: string
  case_number: string
  scheduled_date: string
  surgeon_id: string | null
  surgeon: {
    first_name: string
    last_name: string
  } | null
  procedure_type_id: string | null
  procedure_types: {
    id: string
    name: string
    soft_goods_cost: number | null
    hard_goods_cost: number | null
  } | null
  payer_id: string | null
  payers: {
    id: string
    name: string
  } | null
  case_milestones: {
    milestone_type_id: string
    recorded_at: string
    milestone_types: {
      name: string
    } | null
  }[]
  case_delays: {
    id: string
    delay_type_id: string
    duration_minutes: number | null
    notes: string | null
    delay_types: {
      name: string
    } | null
  }[]
}

export interface FacilitySettings {
  or_hourly_rate: number | null
}

export interface ProcedureReimbursement {
  procedure_type_id: string
  payer_id: string | null
  reimbursement: number
}

// ============================================
// STATS AND METRICS TYPES
// ============================================

export interface SurgeonStats {
  surgeonId: string
  surgeonName: string
  totalProfit: number
  avgProfit: number
  caseCount: number
  avgDurationMinutes: number
  durationVsAvgMinutes: number
  profitImpact: number
}

export interface ProcedureStats {
  procedureId: string
  procedureName: string
  totalProfit: number
  avgProfit: number
  avgMarginPercent: number
  caseCount: number
  avgDurationMinutes: number
  surgeonBreakdown: SurgeonStats[]
}

// ============================================
// ISSUE TYPES
// ============================================

export type CaseIssue = 
  | { 
      type: 'overTime'
      actualMinutes: number
      expectedMinutes: number
      percentOver: number
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
      type: 'unknown' 
    }

// ============================================
// FINANCIAL BREAKDOWN (NEW)
// ============================================

export interface FinancialBreakdown {
  reimbursement: number
  softGoodsCost: number
  hardGoodsCost: number
  orCost: number
  orRate: number
  payerName: string | null
  defaultReimbursement: number | null
  payerReimbursement: number | null
}

// ============================================
// OUTLIER CASE (UPDATED)
// ============================================

export interface OutlierCase {
  caseId: string
  caseNumber: string
  date: string
  surgeonName: string
  procedureName: string
  expectedProfit: number
  actualProfit: number
  gap: number
  durationMinutes: number
  expectedDurationMinutes: number
  issues: CaseIssue[]
  // NEW: Financial breakdown for drawer
  financialBreakdown: FinancialBreakdown | null
}

// ============================================
// ISSUE STATS
// ============================================

export interface IssueStats {
  overTime: number
  delay: number
  lowPayer: number
  unknown: number
}

// ============================================
// PROFIT TREND
// ============================================

export interface ProfitTrendPoint {
  date: string
  profit: number
}

// ============================================
// MAIN METRICS OBJECT
// ============================================

export interface FinancialsMetrics {
  totalCases: number
  totalProfit: number
  avgProfit: number
  avgMargin: number
  outlierCount: number
  outlierThreshold: number
  costPerMinute: number
  excessTimeCost: number
  procedureStats: ProcedureStats[]
  surgeonStats: SurgeonStats[]
  outlierDetails: OutlierCase[]
  issueStats: IssueStats
  profitTrend: ProfitTrendPoint[]
  orRate: number
}

// ============================================
// UI TYPES
// ============================================

export type SubTab = 'overview' | 'procedure' | 'surgeon' | 'outliers'
