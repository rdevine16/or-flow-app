// components/analytics/financials/useFinancialsMetrics.ts
// FIXED: Compute profit correctly using total_debits/total_credits/or_time_cost
// FIXED: Compute consistency ratings (was hardcoded null)
// FIXED: Compute p25/p75 ranges (was hardcoded null)
// ADDED: profitPerORHour — the key enterprise metric
// ADDED: Revenue/cost breakdown for P&L summary
// ADDED: Per-surgeon margin and cost breakdown

import { useMemo } from 'react'
import {
  CaseCompletionStats,
  SurgeonProcedureStats,
  FacilityProcedureStats,
  SurgeonStats,
  ProcedureStats,
  OutlierCase,
  OutlierType,
  CaseIssue,
  FinancialsMetrics,
  OutlierStats,
  IssueStats,
  ProfitTrendPoint,
  FacilitySettings,
  SurgeonProcedureBreakdown,
} from './types'

// ============================================
// HELPERS
// ============================================

function normalizeJoin<T>(data: T | T[] | null): T | null {
  if (Array.isArray(data)) return data[0] || null
  return data
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
}

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const idx = (p / 100) * (sorted.length - 1)
  const lower = Math.floor(idx)
  const upper = Math.ceil(idx)
  if (lower === upper) return sorted[lower]
  return sorted[lower] + (idx - lower) * (sorted[upper] - sorted[lower])
}

function stddev(values: number[]): number | null {
  if (values.length < 2) return null
  const avg = values.reduce((a, b) => a + b, 0) / values.length
  const squareDiffs = values.map(v => Math.pow(v - avg, 2))
  return Math.sqrt(squareDiffs.reduce((a, b) => a + b, 0) / values.length)
}

function getConsistencyRating(
  medianVal: number | null,
  stddevVal: number | null
): 'high' | 'medium' | 'low' | null {
  if (medianVal === null || stddevVal === null || medianVal === 0) return null
  const cv = stddevVal / medianVal
  if (cv < 0.15) return 'high'
  if (cv < 0.30) return 'medium'
  return 'low'
}

function getOutlierType(isPersonal: boolean, isFacility: boolean): OutlierType {
  if (isPersonal && isFacility) return 'both'
  if (isPersonal) return 'personal'
  if (isFacility) return 'facility'
  return 'none'
}

/** Get case debits — prefer new columns, fall back to legacy */
function getCaseDebits(c: CaseCompletionStats): number {
  return c.total_debits ?? c.soft_goods_cost ?? 0
}

/** Get case credits — prefer new columns, fall back to legacy */
function getCaseCredits(c: CaseCompletionStats): number {
  return c.total_credits ?? c.hard_goods_cost ?? 0
}

/** Get case OR time cost */
function getCaseORCost(c: CaseCompletionStats): number {
  return c.or_time_cost ?? c.or_cost ?? 0
}

// ============================================
// MAIN HOOK
// ============================================
export function useFinancialsMetrics(
  caseStats: CaseCompletionStats[],
  surgeonProcedureStats: SurgeonProcedureStats[],
  facilityProcedureStats: FacilityProcedureStats[],
  facilitySettings: FacilitySettings | null
): FinancialsMetrics {
  return useMemo(() => {
    const orRate = facilitySettings?.or_hourly_rate || 0
    const costPerMinute = orRate / 60

    // Filter to cases with valid profit data
    const validCases = caseStats.filter(c => 
      c.profit !== null && 
      c.total_duration_minutes !== null
    )

    // ============================================
    // BUILD LOOKUP MAPS (for outliers)
    // ============================================
    const surgeonProcStatsMap = new Map<string, SurgeonProcedureStats>()
    surgeonProcedureStats.forEach(s => {
      surgeonProcStatsMap.set(`${s.surgeon_id}|${s.procedure_type_id}`, s)
    })

    const facilityProcStatsMap = new Map<string, FacilityProcedureStats>()
    facilityProcedureStats.forEach(f => {
      facilityProcStatsMap.set(f.procedure_type_id, f)
    })

    // ============================================
    // COMPUTE SURGEON STATS FROM FILTERED CASES
    // ============================================
    const surgeonCasesMap = new Map<string, CaseCompletionStats[]>()
    validCases.forEach(c => {
      if (!c.surgeon_id) return
      const existing = surgeonCasesMap.get(c.surgeon_id) || []
      existing.push(c)
      surgeonCasesMap.set(c.surgeon_id, existing)
    })

    const surgeonStats: SurgeonStats[] = Array.from(surgeonCasesMap.entries())
      .map(([surgeonId, cases]) => {
        const firstCase = cases[0]
        const surgeon = normalizeJoin(firstCase.surgeon)
        const surgeonName = surgeon?.first_name && surgeon?.last_name
          ? `Dr. ${surgeon.last_name}`
          : 'Unknown Surgeon'

        // Profit stats
        const profits = cases.map(c => c.profit || 0)
        const totalProfit = profits.reduce((a, b) => a + b, 0)
        const avgProfit = profits.length > 0 ? totalProfit / profits.length : 0
        const medianProfitVal = median(profits)
        const stddevProfitVal = stddev(profits)

        // Duration stats
        const durations = cases.map(c => c.total_duration_minutes || 0)
        const totalORMinutes = durations.reduce((a, b) => a + b, 0)
        const avgDuration = durations.length > 0 ? totalORMinutes / durations.length : 0
        const medianDurationVal = median(durations)
        const stddevDurationVal = stddev(durations)

        // Revenue & cost breakdown
        const totalReimbursement = cases.reduce((sum, c) => sum + (c.reimbursement || 0), 0)
        const totalDebits = cases.reduce((sum, c) => sum + getCaseDebits(c), 0)
        const totalCredits = cases.reduce((sum, c) => sum + getCaseCredits(c), 0)
        const totalORCost = cases.reduce((sum, c) => sum + getCaseORCost(c), 0)

        // Margin
        const avgMarginPercent = totalReimbursement > 0 
          ? (totalProfit / totalReimbursement) * 100 
          : 0

        // Profit per OR hour
        const totalORHours = totalORMinutes / 60
        const profitPerORHour = totalORHours > 0 ? totalProfit / totalORHours : null

        // Consistency rating — FIXED (was hardcoded null)
        const consistencyRating = getConsistencyRating(medianDurationVal, stddevDurationVal)

        // Procedure breakdown
        const procedureCases = new Map<string, CaseCompletionStats[]>()
        cases.forEach(c => {
          if (!c.procedure_type_id) return
          const existing = procedureCases.get(c.procedure_type_id) || []
          existing.push(c)
          procedureCases.set(c.procedure_type_id, existing)
        })

        const procedureBreakdown: SurgeonProcedureBreakdown[] = Array.from(procedureCases.entries())
          .map(([procedureId, procCases]) => {
            const procType = normalizeJoin(procCases[0].procedure_types)
            const procedureName = procType?.name || 'Unknown Procedure'
            const procProfits = procCases.map(c => c.profit || 0)
            const procDurations = procCases.map(c => c.total_duration_minutes || 0)
            const procMedianProfit = median(procProfits)
            const procMedianDuration = median(procDurations)
            const procTotalProfit = procProfits.reduce((a, b) => a + b, 0)

            const facilityStats = facilityProcStatsMap.get(procedureId)
            const facilityMedianDuration = facilityStats?.median_duration || null
            const facilityMedianProfit = facilityStats?.median_profit || null

            const durationVsFacility = procMedianDuration !== null && facilityMedianDuration !== null
              ? procMedianDuration - facilityMedianDuration : 0
            const profitVsFacility = procMedianProfit !== null && facilityMedianProfit !== null
              ? procMedianProfit - facilityMedianProfit : 0

            return {
              procedureId, procedureName,
              caseCount: procCases.length,
              medianDuration: procMedianDuration, medianProfit: procMedianProfit,
              totalProfit: procTotalProfit,
              facilityMedianDuration, facilityMedianProfit,
              durationVsFacility, profitVsFacility,
              durationVsFacilityPct: facilityMedianDuration 
                ? (durationVsFacility / facilityMedianDuration) * 100 : null,
              profitVsFacilityPct: facilityMedianProfit 
                ? (profitVsFacility / facilityMedianProfit) * 100 : null,
            }
          })
          .sort((a, b) => b.caseCount - a.caseCount)

        // Procedure-adjusted duration efficiency
        let weightedDurationDiff = 0
        let weightedDurationCases = 0
        procedureBreakdown.forEach(pb => {
          if (pb.facilityMedianDuration !== null) {
            weightedDurationDiff += pb.durationVsFacility * pb.caseCount
            weightedDurationCases += pb.caseCount
          }
        })
        const procedureAdjustedDuration = weightedDurationCases > 0
          ? weightedDurationDiff / weightedDurationCases : 0

        // Procedure-adjusted profit efficiency
        let weightedProfitDiff = 0
        let weightedProfitCases = 0
        procedureBreakdown.forEach(pb => {
          if (pb.facilityMedianProfit !== null) {
            weightedProfitDiff += pb.profitVsFacility * pb.caseCount
            weightedProfitCases += pb.caseCount
          }
        })
        const procedureAdjustedProfit = weightedProfitCases > 0
          ? weightedProfitDiff / weightedProfitCases : 0

        return {
          surgeonId, surgeonName,
          caseCount: cases.length,
          totalReimbursement, totalDebits, totalCredits, totalORCost,
          totalProfit, avgProfit,
          medianProfit: medianProfitVal,
          stddevProfit: stddevProfitVal,
          profitRange: { 
            p25: percentile(profits, 25), 
            p75: percentile(profits, 75) 
          },
          avgMarginPercent,
          profitPerORHour,
          avgDurationMinutes: avgDuration,
          medianDurationMinutes: medianDurationVal,
          stddevDurationMinutes: stddevDurationVal,
          totalORMinutes,
          durationVsFacilityMinutes: procedureAdjustedDuration,
          profitVsFacility: procedureAdjustedProfit,
          profitImpact: -procedureAdjustedDuration * costPerMinute,
          consistencyRating,
          medianSurgicalTurnover: null,
          procedureBreakdown,
        }
      })
      .sort((a, b) => b.totalProfit - a.totalProfit)

    // ============================================
    // COMPUTE PROCEDURE STATS FROM FILTERED CASES
    // ============================================
    const procedureCasesMap = new Map<string, CaseCompletionStats[]>()
    validCases.forEach(c => {
      if (!c.procedure_type_id) return
      const existing = procedureCasesMap.get(c.procedure_type_id) || []
      existing.push(c)
      procedureCasesMap.set(c.procedure_type_id, existing)
    })

    const procedureStats: ProcedureStats[] = Array.from(procedureCasesMap.entries())
      .map(([procedureId, cases]) => {
        const procType = normalizeJoin(cases[0].procedure_types)
        const procedureName = procType?.name || 'Unknown Procedure'

        const profits = cases.map(c => c.profit || 0)
        const durations = cases.map(c => c.total_duration_minutes || 0)

        const totalProfit = profits.reduce((a, b) => a + b, 0)
        const avgProfit = profits.length > 0 ? totalProfit / profits.length : 0
        
        // Revenue & cost aggregates
        const totalReimbursement = cases.reduce((sum, c) => sum + (c.reimbursement || 0), 0)
        const avgReimbursement = cases.length > 0 ? totalReimbursement / cases.length : 0
        const totalDebits = cases.reduce((sum, c) => sum + getCaseDebits(c), 0)
        const totalCredits = cases.reduce((sum, c) => sum + getCaseCredits(c), 0)
        const totalORCost = cases.reduce((sum, c) => sum + getCaseORCost(c), 0)

        const totalORMinutes = durations.reduce((a, b) => a + b, 0)
        const totalORHours = totalORMinutes / 60
        const profitPerORHour = totalORHours > 0 ? totalProfit / totalORHours : null

        const uniqueSurgeons = new Set(cases.map(c => c.surgeon_id).filter(Boolean))

        // Surgeon breakdown for this procedure
        const surgeonCasesForProc = new Map<string, CaseCompletionStats[]>()
        cases.forEach(c => {
          if (!c.surgeon_id) return
          const existing = surgeonCasesForProc.get(c.surgeon_id) || []
          existing.push(c)
          surgeonCasesForProc.set(c.surgeon_id, existing)
        })

        const surgeonBreakdown: SurgeonStats[] = Array.from(surgeonCasesForProc.entries())
          .map(([surgeonId, surgeonCases]) => {
            const firstCase = surgeonCases[0]
            const surgeon = normalizeJoin(firstCase.surgeon)
            const surgeonName = surgeon?.first_name && surgeon?.last_name
              ? `Dr. ${surgeon.last_name}` : 'Unknown Surgeon'

            const surgeonProfits = surgeonCases.map(c => c.profit || 0)
            const surgeonDurations = surgeonCases.map(c => c.total_duration_minutes || 0)
            const surgeonTotalProfit = surgeonProfits.reduce((a, b) => a + b, 0)
            const surgeonTotalReimbursement = surgeonCases.reduce((sum, c) => sum + (c.reimbursement || 0), 0)
            const surgeonTotalDebits = surgeonCases.reduce((sum, c) => sum + getCaseDebits(c), 0)
            const surgeonTotalCredits = surgeonCases.reduce((sum, c) => sum + getCaseCredits(c), 0)
            const surgeonTotalORCost = surgeonCases.reduce((sum, c) => sum + getCaseORCost(c), 0)
            const surgeonTotalORMinutes = surgeonDurations.reduce((a, b) => a + b, 0)

            const facilityStats = facilityProcStatsMap.get(procedureId)
            const surgeonMedianDuration = median(surgeonDurations)
            const surgeonStddevDuration = stddev(surgeonDurations)
            const durationVsFacility = surgeonMedianDuration !== null && facilityStats?.median_duration
              ? surgeonMedianDuration - facilityStats.median_duration : 0
            const surgeonMedianProfitVal = median(surgeonProfits)
            const profitVsFacility = surgeonMedianProfitVal !== null && facilityStats?.median_profit
              ? surgeonMedianProfitVal - facilityStats.median_profit : 0

            const surgeonORHours = surgeonTotalORMinutes / 60

            return {
              surgeonId, surgeonName,
              caseCount: surgeonCases.length,
              totalReimbursement: surgeonTotalReimbursement,
              totalDebits: surgeonTotalDebits,
              totalCredits: surgeonTotalCredits,
              totalORCost: surgeonTotalORCost,
              totalProfit: surgeonTotalProfit,
              avgProfit: surgeonCases.length > 0 ? surgeonTotalProfit / surgeonCases.length : 0,
              medianProfit: median(surgeonProfits),
              stddevProfit: stddev(surgeonProfits),
              profitRange: { 
                p25: percentile(surgeonProfits, 25), 
                p75: percentile(surgeonProfits, 75) 
              },
              avgMarginPercent: surgeonTotalReimbursement > 0 
                ? (surgeonTotalProfit / surgeonTotalReimbursement) * 100 : 0,
              profitPerORHour: surgeonORHours > 0 ? surgeonTotalProfit / surgeonORHours : null,
              avgDurationMinutes: surgeonCases.length > 0
                ? surgeonTotalORMinutes / surgeonCases.length : 0,
              medianDurationMinutes: surgeonMedianDuration,
              stddevDurationMinutes: surgeonStddevDuration,
              totalORMinutes: surgeonTotalORMinutes,
              durationVsFacilityMinutes: durationVsFacility,
              profitVsFacility,
              profitImpact: -durationVsFacility * costPerMinute,
              consistencyRating: getConsistencyRating(surgeonMedianDuration, surgeonStddevDuration),
              medianSurgicalTurnover: null,
            }
          })
          .sort((a, b) => b.totalProfit - a.totalProfit)

        return {
          procedureId, procedureName,
          caseCount: cases.length,
          surgeonCount: uniqueSurgeons.size,
          totalReimbursement, avgReimbursement,
          totalDebits, totalCredits, totalORCost,
          totalProfit, avgProfit,
          medianProfit: median(profits),
          stddevProfit: stddev(profits),
          profitRange: { 
            p25: percentile(profits, 25), 
            p75: percentile(profits, 75) 
          },
          avgMarginPercent: totalReimbursement > 0 
            ? (totalProfit / totalReimbursement) * 100 : 0,
          profitPerORHour,
          avgDurationMinutes: durations.length > 0
            ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
          medianDurationMinutes: median(durations),
          stddevDurationMinutes: stddev(durations),
          durationRange: { 
            p25: percentile(durations, 25), 
            p75: percentile(durations, 75) 
          },
          surgeonBreakdown,
        }
      })
      .sort((a, b) => b.totalProfit - a.totalProfit)

    // ============================================
    // CALCULATE OVERALL SUMMARY
    // ============================================
    const allProfits = validCases.map(c => c.profit || 0)
    const allDurations = validCases.map(c => c.total_duration_minutes || 0)

    const totalProfit = allProfits.reduce((a, b) => a + b, 0)
    const totalReimbursement = validCases.reduce((sum, c) => sum + (c.reimbursement || 0), 0)
    const totalDebits = validCases.reduce((sum, c) => sum + getCaseDebits(c), 0)
    const totalCredits = validCases.reduce((sum, c) => sum + getCaseCredits(c), 0)
    const totalORCost = validCases.reduce((sum, c) => sum + getCaseORCost(c), 0)
    const totalORMinutes = allDurations.reduce((a, b) => a + b, 0)
    
    const avgProfit = validCases.length > 0 ? totalProfit / validCases.length : 0
    const avgMargin = totalReimbursement > 0 ? (totalProfit / totalReimbursement) * 100 : 0
    const avgDuration = validCases.length > 0 ? totalORMinutes / validCases.length : 0
    
    const totalORHours = totalORMinutes / 60
    const profitPerORHour = totalORHours > 0 ? totalProfit / totalORHours : null

    // ============================================
    // CLASSIFY OUTLIERS
    // ============================================
    const outlierDetails: OutlierCase[] = []
    let personalOnlyCount = 0
    let facilityOnlyCount = 0
    let bothCount = 0
    let durationOutlierCount = 0
    let profitOutlierCount = 0

    const issueStats: IssueStats = {
      overTime: 0, delay: 0, lowPayer: 0, lowProfit: 0, unknown: 0,
    }

    validCases.forEach(c => {
      const surgeonKey = `${c.surgeon_id}|${c.procedure_type_id}`
      const surgeonBaselineStats = surgeonProcStatsMap.get(surgeonKey)
      const facilityStats = c.procedure_type_id ? facilityProcStatsMap.get(c.procedure_type_id) : null

      const personalDurationThreshold = surgeonBaselineStats?.median_duration != null && surgeonBaselineStats?.stddev_duration != null
        ? surgeonBaselineStats.median_duration + surgeonBaselineStats.stddev_duration : null
      const facilityDurationThreshold = facilityStats?.median_duration != null && facilityStats?.stddev_duration != null
        ? facilityStats.median_duration + facilityStats.stddev_duration : null
      const personalProfitThreshold = surgeonBaselineStats?.median_profit != null && surgeonBaselineStats?.stddev_profit != null
        ? surgeonBaselineStats.median_profit - surgeonBaselineStats.stddev_profit : null
      const facilityProfitThreshold = facilityStats?.median_profit != null && facilityStats?.stddev_profit != null
        ? facilityStats.median_profit - facilityStats.stddev_profit : null

      const actualDuration = c.total_duration_minutes || 0
      const actualProfit = c.profit || 0

      const isDurationPersonalOutlier = personalDurationThreshold !== null && actualDuration > personalDurationThreshold
      const isDurationFacilityOutlier = facilityDurationThreshold !== null && actualDuration > facilityDurationThreshold
      const isProfitPersonalOutlier = personalProfitThreshold !== null && actualProfit < personalProfitThreshold
      const isProfitFacilityOutlier = facilityProfitThreshold !== null && actualProfit < facilityProfitThreshold

      const isAnyOutlier = isDurationPersonalOutlier || isDurationFacilityOutlier || 
                           isProfitPersonalOutlier || isProfitFacilityOutlier
      if (!isAnyOutlier) return

      const isOnlyPersonal = (isDurationPersonalOutlier || isProfitPersonalOutlier) && 
                             !isDurationFacilityOutlier && !isProfitFacilityOutlier
      const isOnlyFacility = (isDurationFacilityOutlier || isProfitFacilityOutlier) && 
                             !isDurationPersonalOutlier && !isProfitPersonalOutlier
      const isBoth = (isDurationPersonalOutlier || isProfitPersonalOutlier) && 
                     (isDurationFacilityOutlier || isProfitFacilityOutlier)

      if (isOnlyPersonal) personalOnlyCount++
      if (isOnlyFacility) facilityOnlyCount++
      if (isBoth) bothCount++
      if (isDurationPersonalOutlier || isDurationFacilityOutlier) durationOutlierCount++
      if (isProfitPersonalOutlier || isProfitFacilityOutlier) profitOutlierCount++

      const issues: CaseIssue[] = []
      if (isDurationPersonalOutlier || isDurationFacilityOutlier) {
        issues.push({
          type: 'overTime',
          actualMinutes: actualDuration,
          expectedMinutes: surgeonBaselineStats?.median_duration || facilityStats?.median_duration || 0,
          thresholdMinutes: personalDurationThreshold || facilityDurationThreshold || 0,
          minutesOver: actualDuration - (personalDurationThreshold || facilityDurationThreshold || 0),
        })
        issueStats.overTime++
      }
      if (isProfitPersonalOutlier || isProfitFacilityOutlier) {
        issues.push({
          type: 'lowProfit',
          actualProfit,
          expectedProfit: surgeonBaselineStats?.median_profit || facilityStats?.median_profit || 0,
          thresholdProfit: personalProfitThreshold || facilityProfitThreshold || 0,
          amountBelow: (personalProfitThreshold || facilityProfitThreshold || 0) - actualProfit,
        })
        issueStats.lowProfit++
      }
      if (issues.length === 0) {
        issues.push({ type: 'unknown' })
        issueStats.unknown++
      }

      const surgeonObj = normalizeJoin(c.surgeon)
      const surgeonName = surgeonObj?.first_name && surgeonObj?.last_name
        ? `Dr. ${surgeonObj.last_name}` : 'Unassigned'
      const procType = normalizeJoin(c.procedure_types)
      const procedureName = procType?.name || 'Unknown'

      outlierDetails.push({
        caseId: c.case_id,
        caseNumber: c.case_number,
        date: c.case_date,
        surgeonId: c.surgeon_id,
        surgeonName,
        procedureId: c.procedure_type_id,
        procedureName,
        roomName: normalizeJoin(c.or_rooms)?.name || null,
        actualProfit, actualDuration,
        expectedProfit: surgeonBaselineStats?.median_profit || null,
        expectedDuration: surgeonBaselineStats?.median_duration || null,
        facilityExpectedProfit: facilityStats?.median_profit || null,
        facilityExpectedDuration: facilityStats?.median_duration || null,
        profitGap: actualProfit - (surgeonBaselineStats?.median_profit || facilityStats?.median_profit || actualProfit),
        durationGap: actualDuration - (surgeonBaselineStats?.median_duration || facilityStats?.median_duration || actualDuration),
        outlierFlags: {
          isDurationPersonalOutlier, isDurationFacilityOutlier,
          durationOutlierType: getOutlierType(isDurationPersonalOutlier, isDurationFacilityOutlier),
          isProfitPersonalOutlier, isProfitFacilityOutlier,
          profitOutlierType: getOutlierType(isProfitPersonalOutlier, isProfitFacilityOutlier),
          personalDurationThreshold, facilityDurationThreshold,
          personalProfitThreshold, facilityProfitThreshold,
        },
        issues,
        financialBreakdown: {
          reimbursement: c.reimbursement || 0,
          totalDebits: getCaseDebits(c),
          totalCredits: getCaseCredits(c),
          orTimeCost: getCaseORCost(c),
          orRate: c.or_hourly_rate || orRate,
          payerName: normalizeJoin(c.payers)?.name || null,
          costSource: c.cost_source || null,
          softGoodsCost: getCaseDebits(c),
          hardGoodsCost: getCaseCredits(c),
          orCost: getCaseORCost(c),
          expectedProfit: surgeonBaselineStats?.median_profit || null,
          facilityExpectedProfit: facilityStats?.median_profit || null,
          expectedDuration: surgeonBaselineStats?.median_duration || null,
          facilityExpectedDuration: facilityStats?.median_duration || null,
        },
      })
    })

    outlierDetails.sort((a, b) => a.profitGap - b.profitGap)

    const outlierStats: OutlierStats = {
      total: outlierDetails.length,
      personalOnly: personalOnlyCount,
      facilityOnly: facilityOnlyCount,
      both: bothCount,
      durationOutliers: durationOutlierCount,
      profitOutliers: profitOutlierCount,
    }

    // ============================================
    // EXCESS TIME COST
    // ============================================
    let excessTimeMinutes = 0
    validCases.forEach(c => {
      if (!c.procedure_type_id || !c.total_duration_minutes) return
      const fStats = facilityProcStatsMap.get(c.procedure_type_id)
      if (!fStats?.median_duration) return
      excessTimeMinutes += Math.max(0, c.total_duration_minutes - fStats.median_duration)
    })

    // ============================================
    // PROFIT TREND
    // ============================================
    const profitByDate = new Map<string, { profit: number; count: number }>()
    validCases.forEach(c => {
      const date = c.case_date
      const existing = profitByDate.get(date) || { profit: 0, count: 0 }
      existing.profit += c.profit || 0
      existing.count += 1
      profitByDate.set(date, existing)
    })

    const profitTrend: ProfitTrendPoint[] = Array.from(profitByDate.entries())
      .map(([date, data]) => ({
        date,
        profit: data.profit,
        caseCount: data.count,
        medianProfit: null,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // ============================================
    // RETURN
    // ============================================
    return {
      totalCases: validCases.length,
      totalReimbursement, totalDebits, totalCredits, totalORCost,
      totalProfit, avgProfit,
      medianProfit: median(allProfits),
      stddevProfit: stddev(allProfits),
      profitRange: { 
        p25: percentile(allProfits, 25), 
        p75: percentile(allProfits, 75) 
      },
      avgMargin,
      profitPerORHour,
      avgDuration,
      medianDuration: median(allDurations),
      totalORMinutes,
      outlierStats, outlierDetails, issueStats,
      costPerMinute,
      excessTimeCost: excessTimeMinutes * costPerMinute,
      procedureStats, surgeonStats, profitTrend,
      orRate,
    }
  }, [caseStats, surgeonProcedureStats, facilityProcedureStats, facilitySettings])
}