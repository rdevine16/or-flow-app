// components/analytics/financials/useFinancialsMetrics.ts
// FIXED: Compute surgeon stats from filtered case data, not materialized views
// This ensures date filters actually filter the surgeon data

import { useMemo } from 'react'
import {
  CaseCompletionStats,
  SurgeonProcedureStats,
  FacilityProcedureStats,
  SurgeonStats,
  ProcedureStats,
  OutlierCase,
  OutlierFlags,
  OutlierType,
  CaseIssue,
  FinancialsMetrics,
  FinancialBreakdown,
  OutlierStats,
  IssueStats,
  ProfitTrendPoint,
  FacilitySettings,
  SurgeonProcedureBreakdown,
} from './types'

// ============================================
// HELPER: Normalize Supabase join (array or single object)
// ============================================
function normalizeJoin<T>(data: T | T[] | null): T | null {
  if (Array.isArray(data)) return data[0] || null
  return data
}

// ============================================
// HELPER: Calculate median from array
// ============================================
function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
}

// ============================================
// HELPER: Calculate standard deviation
// ============================================
function stddev(values: number[]): number | null {
  if (values.length < 2) return null
  const avg = values.reduce((a, b) => a + b, 0) / values.length
  const squareDiffs = values.map(v => Math.pow(v - avg, 2))
  return Math.sqrt(squareDiffs.reduce((a, b) => a + b, 0) / values.length)
}

// ============================================
// HELPER: Determine outlier type
// ============================================
function getOutlierType(isPersonal: boolean, isFacility: boolean): OutlierType {
  if (isPersonal && isFacility) return 'both'
  if (isPersonal) return 'personal'
  if (isFacility) return 'facility'
  return 'none'
}

// ============================================
// MAIN HOOK
// ============================================
export function useFinancialsMetrics(
  caseStats: CaseCompletionStats[],
  surgeonProcedureStats: SurgeonProcedureStats[],  // Used for outlier baselines only
  facilityProcedureStats: FacilityProcedureStats[], // Used for outlier baselines only
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
    // BUILD LOOKUP MAPS FOR STATS (for outliers)
    // ============================================
    const surgeonProcStatsMap = new Map<string, SurgeonProcedureStats>()
    surgeonProcedureStats.forEach(s => {
      const key = `${s.surgeon_id}|${s.procedure_type_id}`
      surgeonProcStatsMap.set(key, s)
    })

    const facilityProcStatsMap = new Map<string, FacilityProcedureStats>()
    facilityProcedureStats.forEach(f => {
      facilityProcStatsMap.set(f.procedure_type_id, f)
    })

    // ============================================
    // COMPUTE SURGEON STATS FROM FILTERED CASES
    // This is the key change - compute from actual filtered data
    // ============================================
    
    // Group cases by surgeon
    const surgeonCasesMap = new Map<string, CaseCompletionStats[]>()
    
    validCases.forEach(c => {
      if (!c.surgeon_id) return
      const existing = surgeonCasesMap.get(c.surgeon_id) || []
      existing.push(c)
      surgeonCasesMap.set(c.surgeon_id, existing)
    })

    // Build surgeon stats from grouped cases
    const surgeonStats: SurgeonStats[] = Array.from(surgeonCasesMap.entries())
      .map(([surgeonId, cases]) => {
        // Get surgeon name from first case
        const firstCase = cases[0]
        const surgeon = normalizeJoin(firstCase.surgeon)
        const surgeonName = surgeon?.first_name && surgeon?.last_name
          ? `Dr. ${surgeon.last_name}`
          : 'Unknown Surgeon'

        // Calculate profit stats
        const profits = cases.map(c => c.profit || 0)
        const totalProfit = profits.reduce((a, b) => a + b, 0)
        const avgProfit = profits.length > 0 ? totalProfit / profits.length : 0
        const medianProfitVal = median(profits)
        const stddevProfitVal = stddev(profits)

        // Calculate duration stats
        const durations = cases.map(c => c.total_duration_minutes || 0)
        const avgDuration = durations.length > 0 
          ? durations.reduce((a, b) => a + b, 0) / durations.length 
          : 0
        const medianDurationVal = median(durations)

        // Group by procedure for breakdown
        const procedureCases = new Map<string, CaseCompletionStats[]>()
        cases.forEach(c => {
          if (!c.procedure_type_id) return
          const existing = procedureCases.get(c.procedure_type_id) || []
          existing.push(c)
          procedureCases.set(c.procedure_type_id, existing)
        })

        // Build procedure breakdown
        const procedureBreakdown: SurgeonProcedureBreakdown[] = Array.from(procedureCases.entries())
          .map(([procedureId, procCases]) => {
            const procType = normalizeJoin(procCases[0].procedure_types)
            const procedureName = procType?.name || 'Unknown Procedure'

            const procProfits = procCases.map(c => c.profit || 0)
            const procDurations = procCases.map(c => c.total_duration_minutes || 0)
            
            const procMedianProfit = median(procProfits)
            const procMedianDuration = median(procDurations)
            const procTotalProfit = procProfits.reduce((a, b) => a + b, 0)

            // Get facility baseline for this procedure
            const facilityStats = facilityProcStatsMap.get(procedureId)
            const facilityMedianDuration = facilityStats?.median_duration || null
            const facilityMedianProfit = facilityStats?.median_profit || null

            // Calculate differences
            const durationVsFacility = procMedianDuration !== null && facilityMedianDuration !== null
              ? procMedianDuration - facilityMedianDuration
              : 0
            const profitVsFacility = procMedianProfit !== null && facilityMedianProfit !== null
              ? procMedianProfit - facilityMedianProfit
              : 0

            return {
              procedureId,
              procedureName,
              caseCount: procCases.length,
              medianDuration: procMedianDuration,
              medianProfit: procMedianProfit,
              totalProfit: procTotalProfit,
              facilityMedianDuration,
              facilityMedianProfit,
              durationVsFacility,
              profitVsFacility,
              durationVsFacilityPct: facilityMedianDuration 
                ? (durationVsFacility / facilityMedianDuration) * 100 
                : null,
              profitVsFacilityPct: facilityMedianProfit 
                ? (profitVsFacility / facilityMedianProfit) * 100 
                : null,
            }
          })
          .sort((a, b) => b.caseCount - a.caseCount)

        // Calculate procedure-adjusted efficiency (weighted by case count)
        let weightedDurationDiff = 0
        let weightedCases = 0
        procedureBreakdown.forEach(pb => {
          if (pb.facilityMedianDuration !== null) {
            weightedDurationDiff += pb.durationVsFacility * pb.caseCount
            weightedCases += pb.caseCount
          }
        })
        const procedureAdjustedDuration = weightedCases > 0 
          ? weightedDurationDiff / weightedCases 
          : 0

        return {
          surgeonId,
          surgeonName,
          caseCount: cases.length,
          totalProfit,
          avgProfit,
          medianProfit: medianProfitVal,
          stddevProfit: stddevProfitVal,
          profitRange: { p25: null, p75: null },
          avgDurationMinutes: avgDuration,
          medianDurationMinutes: medianDurationVal,
          stddevDurationMinutes: stddev(durations),
          durationVsFacilityMinutes: procedureAdjustedDuration,
          profitVsFacility: 0, // Not as meaningful
          profitImpact: -procedureAdjustedDuration * costPerMinute,
          consistencyRating: null,
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
        const reimbursements = cases.map(c => c.reimbursement || 0)

        const totalProfit = profits.reduce((a, b) => a + b, 0)
        const avgProfit = profits.length > 0 ? totalProfit / profits.length : 0
        const totalReimbursement = reimbursements.reduce((a, b) => a + b, 0)

        // Get unique surgeons
        const uniqueSurgeons = new Set(cases.map(c => c.surgeon_id).filter(Boolean))

        // Build surgeon breakdown for this procedure
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
              ? `Dr. ${surgeon.last_name}`
              : 'Unknown Surgeon'

            const surgeonProfits = surgeonCases.map(c => c.profit || 0)
            const surgeonDurations = surgeonCases.map(c => c.total_duration_minutes || 0)

            const facilityStats = facilityProcStatsMap.get(procedureId)
            const surgeonMedianDuration = median(surgeonDurations)
            const durationVsFacility = surgeonMedianDuration !== null && facilityStats?.median_duration
              ? surgeonMedianDuration - facilityStats.median_duration
              : 0

            return {
              surgeonId,
              surgeonName,
              caseCount: surgeonCases.length,
              totalProfit: surgeonProfits.reduce((a, b) => a + b, 0),
              avgProfit: surgeonProfits.length > 0 
                ? surgeonProfits.reduce((a, b) => a + b, 0) / surgeonProfits.length 
                : 0,
              medianProfit: median(surgeonProfits),
              stddevProfit: stddev(surgeonProfits),
              profitRange: { p25: null, p75: null },
              avgDurationMinutes: surgeonDurations.length > 0
                ? surgeonDurations.reduce((a, b) => a + b, 0) / surgeonDurations.length
                : 0,
              medianDurationMinutes: surgeonMedianDuration,
              stddevDurationMinutes: stddev(surgeonDurations),
              durationVsFacilityMinutes: durationVsFacility,
              profitVsFacility: 0,
              profitImpact: -durationVsFacility * costPerMinute,
              consistencyRating: null,
              medianSurgicalTurnover: null,
            }
          })
          .sort((a, b) => b.totalProfit - a.totalProfit)

        return {
          procedureId,
          procedureName,
          caseCount: cases.length,
          surgeonCount: uniqueSurgeons.size,
          totalProfit,
          avgProfit,
          medianProfit: median(profits),
          stddevProfit: stddev(profits),
          profitRange: { p25: null, p75: null },
          avgMarginPercent: totalReimbursement > 0 
            ? (totalProfit / totalReimbursement) * 100 
            : 0,
          avgDurationMinutes: durations.length > 0
            ? durations.reduce((a, b) => a + b, 0) / durations.length
            : 0,
          medianDurationMinutes: median(durations),
          stddevDurationMinutes: stddev(durations),
          durationRange: { p25: null, p75: null },
          surgeonBreakdown,
        }
      })
      .sort((a, b) => b.totalProfit - a.totalProfit)

    // ============================================
    // CALCULATE OVERALL SUMMARY
    // ============================================
    
    const allProfits = validCases.map(c => c.profit || 0)
    const allDurations = validCases.map(c => c.total_duration_minutes || 0)
    const allReimbursements = validCases.map(c => c.reimbursement || 0)

    const totalProfit = allProfits.reduce((a, b) => a + b, 0)
    const totalReimbursement = allReimbursements.reduce((a, b) => a + b, 0)
    const avgProfit = validCases.length > 0 ? totalProfit / validCases.length : 0
    const avgMargin = totalReimbursement > 0 ? (totalProfit / totalReimbursement) * 100 : 0
    const avgDuration = validCases.length > 0 
      ? allDurations.reduce((a, b) => a + b, 0) / validCases.length 
      : 0

    // ============================================
    // CLASSIFY OUTLIERS (still uses materialized views for baselines)
    // ============================================
    
    const outlierDetails: OutlierCase[] = []
    let personalOnlyCount = 0
    let facilityOnlyCount = 0
    let bothCount = 0
    let durationOutlierCount = 0
    let profitOutlierCount = 0

    const issueStats: IssueStats = {
      overTime: 0,
      delay: 0,
      lowPayer: 0,
      lowProfit: 0,
      unknown: 0,
    }

    validCases.forEach(c => {
      const surgeonKey = `${c.surgeon_id}|${c.procedure_type_id}`
      const surgeonBaselineStats = surgeonProcStatsMap.get(surgeonKey)
      const facilityStats = c.procedure_type_id ? facilityProcStatsMap.get(c.procedure_type_id) : null

      // Get thresholds from materialized views (all-time baselines)
      const personalDurationThreshold = surgeonBaselineStats?.median_duration != null && surgeonBaselineStats?.stddev_duration != null
        ? surgeonBaselineStats.median_duration + surgeonBaselineStats.stddev_duration
        : null

      const facilityDurationThreshold = facilityStats?.median_duration != null && facilityStats?.stddev_duration != null
        ? facilityStats.median_duration + facilityStats.stddev_duration
        : null

      const personalProfitThreshold = surgeonBaselineStats?.median_profit != null && surgeonBaselineStats?.stddev_profit != null
        ? surgeonBaselineStats.median_profit - surgeonBaselineStats.stddev_profit
        : null

      const facilityProfitThreshold = facilityStats?.median_profit != null && facilityStats?.stddev_profit != null
        ? facilityStats.median_profit - facilityStats.stddev_profit
        : null

      const actualDuration = c.total_duration_minutes || 0
      const actualProfit = c.profit || 0

      // Check outliers
      const isDurationPersonalOutlier = personalDurationThreshold !== null && actualDuration > personalDurationThreshold
      const isDurationFacilityOutlier = facilityDurationThreshold !== null && actualDuration > facilityDurationThreshold
      const isProfitPersonalOutlier = personalProfitThreshold !== null && actualProfit < personalProfitThreshold
      const isProfitFacilityOutlier = facilityProfitThreshold !== null && actualProfit < facilityProfitThreshold

      const isAnyOutlier = isDurationPersonalOutlier || isDurationFacilityOutlier || 
                           isProfitPersonalOutlier || isProfitFacilityOutlier

      if (!isAnyOutlier) return

      // Count types
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

      // Build issues
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

      // Get names
      const surgeon = normalizeJoin(c.surgeon)
      const surgeonName = surgeon?.first_name && surgeon?.last_name
        ? `Dr. ${surgeon.last_name}`
        : 'Unassigned'
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
        actualProfit,
        actualDuration,
        expectedProfit: surgeonBaselineStats?.median_profit || null,
        expectedDuration: surgeonBaselineStats?.median_duration || null,
        facilityExpectedProfit: facilityStats?.median_profit || null,
        facilityExpectedDuration: facilityStats?.median_duration || null,
        profitGap: actualProfit - (surgeonBaselineStats?.median_profit || facilityStats?.median_profit || actualProfit),
        durationGap: actualDuration - (surgeonBaselineStats?.median_duration || facilityStats?.median_duration || actualDuration),
        outlierFlags: {
          isDurationPersonalOutlier,
          isDurationFacilityOutlier,
          durationOutlierType: getOutlierType(isDurationPersonalOutlier, isDurationFacilityOutlier),
          isProfitPersonalOutlier,
          isProfitFacilityOutlier,
          profitOutlierType: getOutlierType(isProfitPersonalOutlier, isProfitFacilityOutlier),
          personalDurationThreshold,
          facilityDurationThreshold,
          personalProfitThreshold,
          facilityProfitThreshold,
        },
        issues,
        financialBreakdown: {
          reimbursement: c.reimbursement || 0,
          softGoodsCost: c.soft_goods_cost || 0,
          hardGoodsCost: c.hard_goods_cost || 0,
          orCost: c.or_cost || 0,
          orRate: c.or_hourly_rate || orRate,
          payerName: normalizeJoin(c.payers)?.name || null,
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
    // CALCULATE EXCESS TIME COST
    // ============================================
    
    let excessTimeMinutes = 0
    validCases.forEach(c => {
      if (!c.procedure_type_id || !c.total_duration_minutes) return
      const facilityStats = facilityProcStatsMap.get(c.procedure_type_id)
      if (!facilityStats?.median_duration) return
      const excess = Math.max(0, c.total_duration_minutes - facilityStats.median_duration)
      excessTimeMinutes += excess
    })
    const excessTimeCost = excessTimeMinutes * costPerMinute

    // ============================================
    // BUILD PROFIT TREND
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
      totalProfit,
      avgProfit,
      medianProfit: median(allProfits),
      stddevProfit: stddev(allProfits),
      profitRange: { p25: null, p75: null },
      avgMargin,
      avgDuration,
      medianDuration: median(allDurations),
      outlierStats,
      outlierDetails,
      issueStats,
      costPerMinute,
      excessTimeCost,
      procedureStats,
      surgeonStats,
      profitTrend,
      orRate,
    }
  }, [caseStats, surgeonProcedureStats, facilityProcedureStats, facilitySettings])
}