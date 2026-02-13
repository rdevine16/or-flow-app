// lib/facilityScoreStub.ts
// Stubbed facility-level composite score
// Simple average of normalized KPI metrics, scaled to 0-100 with letter grade.
// This is explicitly a placeholder — the real facility score engine will be built separately.

import { getGrade, type GradeInfo } from '@/lib/orbitScoreEngine'

export interface FacilityScoreInput {
  /** OR utilization percentage (0-100) */
  utilizationPct: number
  /** Median turnover time in minutes */
  medianTurnoverMinutes: number
  /** First Case On-Time Start percentage (0-100) */
  fcotsPct: number
  /** Cancellation rate as a decimal (0-1) */
  cancellationRate: number
}

export interface FacilityScoreResult {
  score: number
  grade: GradeInfo
  components: {
    utilization: number
    turnover: number
    fcots: number
    cancellation: number
  }
}

/**
 * Normalize turnover minutes to a 0-1 score.
 * Lower turnover is better. Uses 60 min as the worst-case baseline.
 * 0 min → 1.0, 30 min → 0.5, 60+ min → 0.0
 */
function normalizeTurnover(minutes: number): number {
  const maxMinutes = 60
  return Math.max(0, Math.min(1, 1 - minutes / maxMinutes))
}

/**
 * Compute a stubbed facility composite score.
 *
 * Formula: average of four normalized components, each on 0-1 scale:
 *   1. Utilization: raw percentage / 100
 *   2. Turnover: inverted and capped (lower is better)
 *   3. FCOTS: raw percentage / 100
 *   4. Anti-cancellation: 1 - cancellation rate
 *
 * The average is scaled to 0-100 and mapped to a letter grade.
 */
export function computeFacilityScore(input: FacilityScoreInput): FacilityScoreResult {
  const utilNorm = Math.max(0, Math.min(1, input.utilizationPct / 100))
  const turnoverNorm = normalizeTurnover(input.medianTurnoverMinutes)
  const fcotsNorm = Math.max(0, Math.min(1, input.fcotsPct / 100))
  const cancellationNorm = Math.max(0, Math.min(1, 1 - input.cancellationRate))

  const average = (utilNorm + turnoverNorm + fcotsNorm + cancellationNorm) / 4
  const score = Math.round(average * 100)

  return {
    score,
    grade: getGrade(score),
    components: {
      utilization: Math.round(utilNorm * 100),
      turnover: Math.round(turnoverNorm * 100),
      fcots: Math.round(fcotsNorm * 100),
      cancellation: Math.round(cancellationNorm * 100),
    },
  }
}
