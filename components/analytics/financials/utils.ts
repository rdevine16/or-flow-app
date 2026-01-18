
// ============================================
// FORMATTING FUNCTIONS
// ============================================

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-'
  return `${value.toFixed(1)}%`
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)
  if (hours === 0) return `${mins}m`
  return `${hours}h ${mins}m`
}

// ============================================
// CALCULATION FUNCTIONS
// ============================================

export function getCaseDurationMinutes(
  milestones: CaseWithFinancials['case_milestones']
): number | null {
  const patientIn = milestones.find(m => m.milestone_types?.name === 'patient_in')
  const patientOut = milestones.find(m => m.milestone_types?.name === 'patient_out')
  
  if (!patientIn || !patientOut) return null
  
  const start = new Date(patientIn.recorded_at)
  const end = new Date(patientOut.recorded_at)
  return (end.getTime() - start.getTime()) / (1000 * 60)
}

export interface CaseProfitResult {
  profit: number
  reimbursement: number
  orCost: number
  payerReimbursement: number | null
  defaultReimbursement: number | null
}

export function calculateCaseProfit(
  caseData: CaseWithFinancials,
  orHourlyRate: number,
  reimbursements: ProcedureReimbursement[]
): CaseProfitResult | null {
  const procedure = caseData.procedure_types
  if (!procedure) return null
  
  const duration = getCaseDurationMinutes(caseData.case_milestones)
  if (duration === null) return null
  
  // Get default reimbursement
  const defaultReimbursement = reimbursements.find(
    r => r.procedure_type_id === procedure.id && r.payer_id === null
  )?.reimbursement || null

  // Get payer-specific reimbursement if applicable
  let payerReimbursement: number | null = null
  if (caseData.payer_id) {
    payerReimbursement = reimbursements.find(
      r => r.procedure_type_id === procedure.id && r.payer_id === caseData.payer_id
    )?.reimbursement || null
  }
  
  // Use payer rate if available, otherwise default
  const reimbursement = payerReimbursement ?? defaultReimbursement
  if (!reimbursement) return null
  
  const softGoods = procedure.soft_goods_cost || 0
  const hardGoods = procedure.hard_goods_cost || 0
  const orCost = (duration / 60) * orHourlyRate
  
  const profit = reimbursement - softGoods - hardGoods - orCost
  
  return { profit, reimbursement, orCost, payerReimbursement, defaultReimbursement }
}
