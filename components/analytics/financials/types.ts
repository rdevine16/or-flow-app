// ============================================
// FINANCIALS ANALYTICS TYPES
// ============================================

export interface CaseDelay {
  id: string
  delay_type_id: string
  duration_minutes: number | null
  notes: string | null
  delay_types: { name: string } | null
}

export interface CaseWithFinancials {
  id: string
  case_number: string
  scheduled_date: string
  surgeon_id: string | null
  surgeon: { first_name: string; last_name: string } | null
  procedure_type_id: string | null
  procedure_types: { 
    id: string
    name: string
    soft_goods_cost: number | null
    hard_goods_cost: number | null
  } | null
  payer_id: string | null
  payers: { id: string; name: string } | null
  case_milestones: Array<{
    milestone_type_id: string
    recorded_at: string
    milestone_types: { name: string } | null
  }>
  case_delays: CaseDelay[]
}

export interface FacilitySettings {
  or_hourly_rate: number | null
}

export interface ProcedureReimbursement {
  procedure_type_id: string
  payer_id: string | null
  reimbursement: number
}

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

// Issue detail types
export interface OverTimeIssue {
  type: 'overTime'
  actualMinutes: number
  expectedMinutes: number
  percentOver: number
}

export interface DelayIssue {
  type: 'delay'
  delays: Array<{ name: string; minutes: number | null }>
  totalMinutes: number
}

export interface LowPayerIssue {
  type: 'lowPayer'
  payerName: string
  payerRate: number
  defaultRate: number
  percentBelow: number
}

export interface UnknownIssue {
  type: 'unknown'
}

export type CaseIssue = OverTimeIssue | DelayIssue | LowPayerIssue | UnknownIssue

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
}

export interface IssueStats {
  overTime: number
  delay: number
  lowPayer: number
  unknown: number
}

export interface ProfitTrendPoint {
  date: string
  profit: number
}

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

export type SubTab = 'overview' | 'procedure' | 'surgeon' | 'outliers'
