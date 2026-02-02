// components/analytics/financials/useFinancialsMetrics.ts
// Fixed: surgeon name lookup, normalizeJoin for Supabase, procedure breakdown

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
// Supabase sometimes returns joined data as arrays even for single relations
// ============================================
function normalizeJoin<T>(data: T | T[] | null): T | null {
  if (Array.isArray(data)) return data[0] || null
  return data
}

// ============================================
// HELPER: Determine outlier type from two booleans
// ============================================
function getOutlierType(isPersonal: boolean, isFacility: boolean): OutlierType {
  if (isPersonal && isFacility) return 'both'
  if (isPersonal) return 'personal'
  if (isFacility) return 'facility'
  return 'none'
}

// ============================================
// HELPER: Determine consistency rating from coefficient of variation
// ============================================
function getConsistencyRating(stddev: number | null, median: number | null): 'high' | 'medium' | 'low' | null {
  if (stddev === null || median === null || median === 0) return null
  const cv = (stddev / median) * 100  // Coefficient of variation
  if (cv < 15) return 'high'    // Less than 15% variation
  if (cv < 30) return 'medium'  // 15-30% variation
  return 'low'                   // More than 30% variation
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
    const validCases = caseStats.filter(c => c.profit !== null && c.total_duration_minutes !== null)

    // ============================================
    // BUILD LOOKUP MAPS FOR NAMES
    // Use ALL caseStats, not just validCases, to ensure we get names
    // for surgeons/procedures that might not be in the current date filter
    // ============================================
    
    const surgeonNameMap = new Map<string, string>()
    const procedureNameMap = new Map<string, string>()
    
    caseStats.forEach(c => {
      // Build surgeon name lookup
      if (c.surgeon_id && !surgeonNameMap.has(c.surgeon_id)) {
        const surgeon = normalizeJoin(c.surgeon)
        if (surgeon?.first_name && surgeon?.last_name) {
          surgeonNameMap.set(c.surgeon_id, `Dr. ${surgeon.last_name}`)
        }
      }
      
      // Build procedure name lookup
      if (c.procedure_type_id && !procedureNameMap.has(c.procedure_type_id)) {
        const procedureType = normalizeJoin(c.procedure_types)
        if (procedureType?.name) {
          procedureNameMap.set(c.procedure_type_id, procedureType.name)
        }
      }
    })

    // Helper functions
    const getSurgeonName = (surgeonId: string): string => {
      return surgeonNameMap.get(surgeonId) || 'Unknown Surgeon'
    }
    
    const getProcedureName = (procedureId: string): string => {
      return procedureNameMap.get(procedureId) || 'Unknown Procedure'
    }

    // ============================================
    // BUILD LOOKUP MAPS FOR STATS
    // ============================================
    
    // Map: surgeon_id + procedure_type_id -> SurgeonProcedureStats
    const surgeonProcStatsMap = new Map<string, SurgeonProcedureStats>()
    surgeonProcedureStats.forEach(s => {
      const key = `${s.surgeon_id}|${s.procedure_type_id}`
      surgeonProcStatsMap.set(key, s)
    })

    // Map: procedure_type_id -> FacilityProcedureStats
    const facilityProcStatsMap = new Map<string, FacilityProcedureStats>()
    facilityProcedureStats.forEach(f => {
      facilityProcStatsMap.set(f.procedure_type_id, f)
    })

    // ============================================
    // CALCULATE OVERALL SUMMARY FROM FACILITY STATS
    // ============================================
    
    const totalProfit = validCases.reduce((sum, c) => sum + (c.profit || 0), 0)
    const totalReimbursement = validCases.reduce((sum, c) => sum + (c.reimbursement || 0), 0)
    const avgProfit = validCases.length > 0 ? totalProfit / validCases.length : 0
    const avgMargin = totalReimbursement > 0 ? (totalProfit / totalReimbursement) * 100 : 0

    // Calculate median/stddev from facility stats (weighted by case count)
    let weightedMedianSum = 0
    let weightedStddevSum = 0
    let totalSampleSize = 0
    
    facilityProcedureStats.forEach(fps => {
      if (fps.median_profit !== null) {
        weightedMedianSum += fps.median_profit * fps.sample_size
        totalSampleSize += fps.sample_size
      }
      if (fps.stddev_profit !== null) {
        weightedStddevSum += fps.stddev_profit * fps.sample_size
      }
    })

    const medianProfit = totalSampleSize > 0 ? weightedMedianSum / totalSampleSize : null
    const stddevProfit = totalSampleSize > 0 ? weightedStddevSum / totalSampleSize : null

    // Calculate overall duration stats
    const totalDuration = validCases.reduce((sum, c) => sum + (c.total_duration_minutes || 0), 0)
    const avgDuration = validCases.length > 0 ? totalDuration / validCases.length : 0
    
    let weightedDurationMedian = 0
    let durationSampleSize = 0
    facilityProcedureStats.forEach(fps => {
      if (fps.median_duration !== null) {
        weightedDurationMedian += fps.median_duration * fps.sample_size
        durationSampleSize += fps.sample_size
      }
    })
    const medianDuration = durationSampleSize > 0 ? weightedDurationMedian / durationSampleSize : null

    // P25/P75 from facility stats (approximate)
    let profitP25Sum = 0, profitP75Sum = 0, profitPctSampleSize = 0
    facilityProcedureStats.forEach(fps => {
      if (fps.p25_profit !== null && fps.p75_profit !== null) {
        profitP25Sum += fps.p25_profit * fps.sample_size
        profitP75Sum += fps.p75_profit * fps.sample_size
        profitPctSampleSize += fps.sample_size
      }
    })
    const profitRange = {
      p25: profitPctSampleSize > 0 ? profitP25Sum / profitPctSampleSize : null,
      p75: profitPctSampleSize > 0 ? profitP75Sum / profitPctSampleSize : null,
    }

    // ============================================
    // CLASSIFY OUTLIERS WITH DUAL FLAGS
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
      const surgeonStats = surgeonProcStatsMap.get(surgeonKey)
      const facilityStats = c.procedure_type_id ? facilityProcStatsMap.get(c.procedure_type_id) : null

      // Get thresholds
      const personalDurationThreshold = surgeonStats?.median_duration != null && surgeonStats?.stddev_duration != null
        ? (surgeonStats.median_duration ?? 0) + (surgeonStats.stddev_duration ?? 0)
        : null

      const facilityDurationThreshold = facilityStats?.median_duration != null && facilityStats?.stddev_duration != null
        ? (facilityStats.median_duration ?? 0) + (facilityStats.stddev_duration ?? 0)
        : null

      const personalProfitThreshold = surgeonStats?.median_profit != null && surgeonStats?.stddev_profit != null
        ? (surgeonStats.median_profit ?? 0) - (surgeonStats.stddev_profit ?? 0)
        : null

      const facilityProfitThreshold = facilityStats?.median_profit != null && facilityStats?.stddev_profit != null
        ? (facilityStats.median_profit ?? 0) - (facilityStats.stddev_profit ?? 0)
        : null

      // Check outliers
      const actualDuration = c.total_duration_minutes || 0
      const actualProfit = c.profit || 0

      // Duration: ABOVE threshold is bad
      const isDurationPersonalOutlier = personalDurationThreshold !== null && actualDuration > personalDurationThreshold
      const isDurationFacilityOutlier = facilityDurationThreshold !== null && actualDuration > facilityDurationThreshold

      // Profit: BELOW threshold is bad
      const isProfitPersonalOutlier = personalProfitThreshold !== null && actualProfit < personalProfitThreshold
      const isProfitFacilityOutlier = facilityProfitThreshold !== null && actualProfit < facilityProfitThreshold

      const durationOutlierType = getOutlierType(isDurationPersonalOutlier, isDurationFacilityOutlier)
      const profitOutlierType = getOutlierType(isProfitPersonalOutlier, isProfitFacilityOutlier)

      // Is this case an outlier at all?
      const isAnyOutlier = isDurationPersonalOutlier || isDurationFacilityOutlier || 
                           isProfitPersonalOutlier || isProfitFacilityOutlier

      if (!isAnyOutlier) return  // Not an outlier, skip

      // Count outlier types
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

      // Build issues list
      const issues: CaseIssue[] = []

      if (isDurationPersonalOutlier || isDurationFacilityOutlier) {
        const expectedDuration = surgeonStats?.median_duration || facilityStats?.median_duration || 0
        const thresholdDuration = personalDurationThreshold || facilityDurationThreshold || 0
        issues.push({
          type: 'overTime',
          actualMinutes: actualDuration,
          expectedMinutes: expectedDuration,
          thresholdMinutes: thresholdDuration,
          minutesOver: actualDuration - thresholdDuration,
        })
        issueStats.overTime++
      }

      if (isProfitPersonalOutlier || isProfitFacilityOutlier) {
        const expectedProfit = surgeonStats?.median_profit || facilityStats?.median_profit || 0
        const thresholdProfit = personalProfitThreshold || facilityProfitThreshold || 0
        issues.push({
          type: 'lowProfit',
          actualProfit,
          expectedProfit,
          thresholdProfit,
          amountBelow: thresholdProfit - actualProfit,
        })
        issueStats.lowProfit++
      }

      if (issues.length === 0) {
        issues.push({ type: 'unknown' })
        issueStats.unknown++
      }

      // Build outlier flags
      const outlierFlags: OutlierFlags = {
        isDurationPersonalOutlier,
        isDurationFacilityOutlier,
        durationOutlierType,
        isProfitPersonalOutlier,
        isProfitFacilityOutlier,
        profitOutlierType,
        personalDurationThreshold,
        facilityDurationThreshold,
        personalProfitThreshold,
        facilityProfitThreshold,
      }

      // Build financial breakdown
      const financialBreakdown: FinancialBreakdown = {
        reimbursement: c.reimbursement || 0,
        softGoodsCost: c.soft_goods_cost || 0,
        hardGoodsCost: c.hard_goods_cost || 0,
        orCost: c.or_cost || 0,
        orRate: c.or_hourly_rate || orRate,
        payerName: normalizeJoin(c.payers)?.name || null,
        expectedProfit: surgeonStats?.median_profit || null,
        facilityExpectedProfit: facilityStats?.median_profit || null,
        expectedDuration: surgeonStats?.median_duration || null,
        facilityExpectedDuration: facilityStats?.median_duration || null,
      }

      // Get names using lookup maps
      const surgeonName = c.surgeon_id ? getSurgeonName(c.surgeon_id) : 'Unassigned'
      const procedureName = c.procedure_type_id ? getProcedureName(c.procedure_type_id) : 'Unknown'

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
        expectedProfit: surgeonStats?.median_profit || null,
        expectedDuration: surgeonStats?.median_duration || null,
        facilityExpectedProfit: facilityStats?.median_profit || null,
        facilityExpectedDuration: facilityStats?.median_duration || null,
        profitGap: actualProfit - (surgeonStats?.median_profit || facilityStats?.median_profit || actualProfit),
        durationGap: actualDuration - (surgeonStats?.median_duration || facilityStats?.median_duration || actualDuration),
        outlierFlags,
        issues,
        financialBreakdown,
      })
    })

    // Sort outliers by profit gap (worst first)
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
    // BUILD PROCEDURE STATS WITH SURGEON BREAKDOWN
    // ============================================
    
    const procedureStats: ProcedureStats[] = facilityProcedureStats.map(fps => {
      // Get all surgeon stats for this procedure
      const surgeonBreakdown: SurgeonStats[] = surgeonProcedureStats
        .filter(sps => sps.procedure_type_id === fps.procedure_type_id)
        .map(sps => {
          const surgeonName = getSurgeonName(sps.surgeon_id)
          
          // Calculate vs facility for this procedure
          const durationVsFacility = (sps.median_duration || 0) - (fps.median_duration || 0)
          const profitVsFacility = (sps.median_profit || 0) - (fps.median_profit || 0)
          const profitImpact = -durationVsFacility * costPerMinute

          return {
            surgeonId: sps.surgeon_id,
            surgeonName,
            caseCount: sps.sample_size,
            totalProfit: sps.total_profit || 0,
            avgProfit: sps.avg_profit || 0,
            medianProfit: sps.median_profit,
            stddevProfit: sps.stddev_profit,
            profitRange: { p25: sps.p25_profit, p75: sps.p75_profit },
            avgDurationMinutes: sps.avg_duration || 0,
            medianDurationMinutes: sps.median_duration,
            stddevDurationMinutes: sps.stddev_duration,
            durationVsFacilityMinutes: durationVsFacility,
            profitVsFacility,
            profitImpact,
            consistencyRating: getConsistencyRating(sps.stddev_duration, sps.median_duration),
            medianSurgicalTurnover: sps.median_surgical_turnover,
          }
        })
        .sort((a, b) => (b.medianProfit || 0) - (a.medianProfit || 0))

      const procedureName = getProcedureName(fps.procedure_type_id)

      return {
        procedureId: fps.procedure_type_id,
        procedureName,
        caseCount: fps.sample_size,
        surgeonCount: fps.surgeon_count,
        totalProfit: fps.total_profit || 0,
        avgProfit: fps.avg_profit || 0,
        medianProfit: fps.median_profit,
        stddevProfit: fps.stddev_profit,
        profitRange: { p25: fps.p25_profit, p75: fps.p75_profit },
        avgMarginPercent: fps.avg_reimbursement && fps.avg_profit 
          ? (fps.avg_profit / fps.avg_reimbursement) * 100 
          : 0,
        avgDurationMinutes: fps.avg_duration || 0,
        medianDurationMinutes: fps.median_duration,
        stddevDurationMinutes: fps.stddev_duration,
        durationRange: { p25: fps.p25_duration, p75: fps.p75_duration },
        surgeonBreakdown,
      }
    }).sort((a, b) => (b.totalProfit || 0) - (a.totalProfit || 0))

    // ============================================
    // BUILD OVERALL SURGEON STATS WITH PROCEDURE BREAKDOWN
    // ============================================
    
    // Aggregate surgeon stats across all procedures
    const surgeonAggregates = new Map<string, {
      surgeonId: string
      surgeonName: string
      totalProfit: number
      totalCases: number
      procedureBreakdown: SurgeonProcedureBreakdown[]
      profitValues: number[]
      durationValues: number[]
      surgicalTurnovers: number[]
      // For procedure-adjusted efficiency
      weightedDurationDiff: number
      weightedProfitDiff: number
      weightedCases: number
    }>()

    surgeonProcedureStats.forEach(sps => {
      const surgeonName = getSurgeonName(sps.surgeon_id)
      const procedureName = getProcedureName(sps.procedure_type_id)
      const facilityStats = facilityProcStatsMap.get(sps.procedure_type_id)
      
      // Calculate vs facility for this procedure
      const durationVsFacility = (sps.median_duration || 0) - (facilityStats?.median_duration || 0)
      const profitVsFacility = (sps.median_profit || 0) - (facilityStats?.median_profit || 0)
      
      // Calculate percentage differences
      const durationVsFacilityPct = facilityStats?.median_duration 
        ? (durationVsFacility / facilityStats.median_duration) * 100 
        : null
      const profitVsFacilityPct = facilityStats?.median_profit 
        ? (profitVsFacility / facilityStats.median_profit) * 100 
        : null

      const procedureData: SurgeonProcedureBreakdown = {
        procedureId: sps.procedure_type_id,
        procedureName,
        caseCount: sps.sample_size,
        medianDuration: sps.median_duration,
        medianProfit: sps.median_profit,
        totalProfit: sps.total_profit || 0,
        facilityMedianDuration: facilityStats?.median_duration || null,
        facilityMedianProfit: facilityStats?.median_profit || null,
        durationVsFacility,
        profitVsFacility,
        durationVsFacilityPct,
        profitVsFacilityPct,
      }

      const existing = surgeonAggregates.get(sps.surgeon_id)

      if (existing) {
        existing.totalProfit += sps.total_profit || 0
        existing.totalCases += sps.sample_size
        existing.procedureBreakdown.push(procedureData)
        if (sps.median_profit !== null) existing.profitValues.push(sps.median_profit)
        if (sps.median_duration !== null) existing.durationValues.push(sps.median_duration)
        if (sps.median_surgical_turnover !== null) existing.surgicalTurnovers.push(sps.median_surgical_turnover)
        // Weighted efficiency (weight by case count)
        if (facilityStats?.median_duration) {
          existing.weightedDurationDiff += durationVsFacility * sps.sample_size
          existing.weightedProfitDiff += profitVsFacility * sps.sample_size
          existing.weightedCases += sps.sample_size
        }
      } else {
        surgeonAggregates.set(sps.surgeon_id, {
          surgeonId: sps.surgeon_id,
          surgeonName,
          totalProfit: sps.total_profit || 0,
          totalCases: sps.sample_size,
          procedureBreakdown: [procedureData],
          profitValues: sps.median_profit !== null ? [sps.median_profit] : [],
          durationValues: sps.median_duration !== null ? [sps.median_duration] : [],
          surgicalTurnovers: sps.median_surgical_turnover !== null ? [sps.median_surgical_turnover] : [],
          weightedDurationDiff: facilityStats?.median_duration ? durationVsFacility * sps.sample_size : 0,
          weightedProfitDiff: facilityStats?.median_profit ? profitVsFacility * sps.sample_size : 0,
          weightedCases: facilityStats?.median_duration ? sps.sample_size : 0,
        })
      }
    })

    const surgeonStats: SurgeonStats[] = Array.from(surgeonAggregates.values()).map(agg => {
      const avgProfit = agg.totalCases > 0 ? agg.totalProfit / agg.totalCases : 0
      const avgDuration = agg.durationValues.length > 0
        ? agg.durationValues.reduce((a, b) => a + b, 0) / agg.durationValues.length
        : 0
      
      // Average of medians (approximate)
      const medianProfitValue = agg.profitValues.length > 0
        ? agg.profitValues.reduce((a, b) => a + b, 0) / agg.profitValues.length
        : null
      const medianDurationValue = agg.durationValues.length > 0
        ? agg.durationValues.reduce((a, b) => a + b, 0) / agg.durationValues.length
        : null
      const medianTurnover = agg.surgicalTurnovers.length > 0
        ? agg.surgicalTurnovers.reduce((a, b) => a + b, 0) / agg.surgicalTurnovers.length
        : null

      // PROCEDURE-ADJUSTED efficiency: weighted average of duration vs facility PER PROCEDURE
      // This is the KEY metric for fair comparison
      const procedureAdjustedDuration = agg.weightedCases > 0 
        ? agg.weightedDurationDiff / agg.weightedCases 
        : 0
      const procedureAdjustedProfit = agg.weightedCases > 0 
        ? agg.weightedProfitDiff / agg.weightedCases 
        : 0

      const profitImpact = -procedureAdjustedDuration * costPerMinute

      // Sort procedure breakdown by case count
      agg.procedureBreakdown.sort((a, b) => b.caseCount - a.caseCount)

      return {
        surgeonId: agg.surgeonId,
        surgeonName: agg.surgeonName,
        caseCount: agg.totalCases,
        totalProfit: agg.totalProfit,
        avgProfit,
        medianProfit: medianProfitValue,
        stddevProfit: null,
        profitRange: { p25: null, p75: null },
        avgDurationMinutes: avgDuration,
        medianDurationMinutes: medianDurationValue,
        stddevDurationMinutes: null,
        // Use PROCEDURE-ADJUSTED values for fair comparison
        durationVsFacilityMinutes: procedureAdjustedDuration,
        profitVsFacility: procedureAdjustedProfit,
        profitImpact,
        consistencyRating: null,
        medianSurgicalTurnover: medianTurnover,
        // Include procedure breakdown for drill-down
        procedureBreakdown: agg.procedureBreakdown,
      }
    }).sort((a, b) => b.totalProfit - a.totalProfit)

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
    // RETURN COMPLETE METRICS
    // ============================================
    
    return {
      totalCases: validCases.length,
      totalProfit,
      avgProfit,
      medianProfit,
      stddevProfit,
      profitRange,
      avgMargin,
      avgDuration,
      medianDuration,
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