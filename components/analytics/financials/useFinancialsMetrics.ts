import { useMemo } from 'react'
import {
  CaseWithFinancials,
  FacilitySettings,
  ProcedureReimbursement,
  SurgeonStats,
  ProcedureStats,
  OutlierCase,
  CaseIssue,
  FinancialsMetrics,
  FinancialBreakdown,
} from './types'
import { getCaseDurationMinutes, calculateCaseProfit, CaseProfitResult } from './utils'

type CaseWithProfitData = CaseWithFinancials & CaseProfitResult & { duration: number }

export function useFinancialsMetrics(
  cases: CaseWithFinancials[],
  facilitySettings: FacilitySettings | null,
  reimbursements: ProcedureReimbursement[]
): FinancialsMetrics {
  return useMemo(() => {
    const orRate = facilitySettings?.or_hourly_rate || 0
    
    // ============================================
    // STEP 1: Calculate profit for each case
    // ============================================
    const casesWithProfit: CaseWithProfitData[] = cases
      .map(c => {
        const result = calculateCaseProfit(c, orRate, reimbursements)
        const duration = getCaseDurationMinutes(c.case_milestones)
        return result && duration !== null ? { ...c, ...result, duration } : null
      })
      .filter((c): c is CaseWithProfitData => c !== null)

    // ============================================
    // STEP 2: Build procedure map FIRST (needed for everything else)
    // ============================================
    const procedureMap = new Map<string, CaseWithProfitData[]>()
    casesWithProfit.forEach(c => {
      if (c.procedure_types) {
        const key = c.procedure_types.id
        if (!procedureMap.has(key)) procedureMap.set(key, [])
        procedureMap.get(key)!.push(c)
      }
    })

    // ============================================
    // STEP 3: Calculate procedure-level averages
    // ============================================
    const procedureAverages = new Map<string, { avgProfit: number; avgDuration: number }>()
    procedureMap.forEach((procCases, procId) => {
      const avgProfit = procCases.reduce((sum, c) => sum + c.profit, 0) / procCases.length
      const avgDuration = procCases.reduce((sum, c) => sum + c.duration, 0) / procCases.length
      procedureAverages.set(procId, { avgProfit, avgDuration })
    })

    // ============================================
    // STEP 4: Summary metrics
    // ============================================
    const totalProfit = casesWithProfit.reduce((sum, c) => sum + c.profit, 0)
    const totalReimbursement = casesWithProfit.reduce((sum, c) => sum + c.reimbursement, 0)
    const avgProfit = casesWithProfit.length > 0 ? totalProfit / casesWithProfit.length : 0
    const avgMargin = totalReimbursement > 0 ? (totalProfit / totalReimbursement) * 100 : 0

    // ============================================
    // STEP 5: Outlier detection (FIXED - now procedure-specific)
    // ============================================
    // Calculate outliers PER PROCEDURE TYPE, not globally
    const outlierCases: CaseWithProfitData[] = []
    
    procedureMap.forEach((procCases, procId) => {
      if (procCases.length < 2) return // Need at least 2 cases to detect outliers
      
      const procAvg = procedureAverages.get(procId)!.avgProfit
      const procStdDev = Math.sqrt(
        procCases.reduce((sum, c) => sum + Math.pow(c.profit - procAvg, 2), 0) / procCases.length
      )
      
      // Flag cases more than 1 std dev below THIS procedure's average
      const threshold = procAvg - procStdDev
      procCases.forEach(c => {
        if (c.profit < threshold) {
          outlierCases.push(c)
        }
      })
    })

    // Global threshold for display purposes (average of procedure thresholds)
    const outlierThreshold = avgProfit - (casesWithProfit.length > 1 
      ? Math.sqrt(casesWithProfit.reduce((sum, c) => sum + Math.pow(c.profit - avgProfit, 2), 0) / casesWithProfit.length)
      : 0)

    // ============================================
    // STEP 6: Procedure stats with surgeon breakdown
    // ============================================
    const procedureStats: ProcedureStats[] = Array.from(procedureMap.entries())
      .map(([procId, procCases]) => {
        const procTotal = procCases.reduce((sum, c) => sum + c.profit, 0)
        const procReimbursement = procCases.reduce((sum, c) => sum + c.reimbursement, 0)
        const procAvgDuration = procedureAverages.get(procId)!.avgDuration
        
        // Surgeon breakdown for this procedure
        const surgeonMap = new Map<string, CaseWithProfitData[]>()
        procCases.forEach(c => {
          if (c.surgeon_id && c.surgeon) {
            if (!surgeonMap.has(c.surgeon_id)) surgeonMap.set(c.surgeon_id, [])
            surgeonMap.get(c.surgeon_id)!.push(c)
          }
        })

        const surgeonBreakdown: SurgeonStats[] = Array.from(surgeonMap.entries())
          .map(([surgeonId, surgeonCases]) => {
            const surgeonName = surgeonCases[0].surgeon 
              ? `Dr. ${surgeonCases[0].surgeon.first_name} ${surgeonCases[0].surgeon.last_name}`
              : 'Unknown'
            const surgeonTotal = surgeonCases.reduce((sum, c) => sum + c.profit, 0)
            const surgeonAvgDuration = surgeonCases.reduce((sum, c) => sum + c.duration, 0) / surgeonCases.length
            
            // Compare to THIS PROCEDURE's average (not global)
            const durationDiff = surgeonAvgDuration - procAvgDuration
            const profitImpact = -durationDiff * (orRate / 60)

            return {
              surgeonId,
              surgeonName,
              totalProfit: surgeonTotal,
              avgProfit: surgeonTotal / surgeonCases.length,
              caseCount: surgeonCases.length,
              avgDurationMinutes: surgeonAvgDuration,
              durationVsAvgMinutes: durationDiff,
              profitImpact,
            }
          })
          .filter(s => s.caseCount >= 1)
          .sort((a, b) => b.avgProfit - a.avgProfit)

        return {
          procedureId: procId,
          procedureName: procCases[0].procedure_types?.name || 'Unknown',
          totalProfit: procTotal,
          avgProfit: procTotal / procCases.length,
          avgMarginPercent: procReimbursement > 0 ? (procTotal / procReimbursement) * 100 : 0,
          caseCount: procCases.length,
          avgDurationMinutes: procAvgDuration,
          surgeonBreakdown,
        }
      })
      .sort((a, b) => b.totalProfit - a.totalProfit)

    // ============================================
    // STEP 7: Overall surgeon stats (FIXED - weighted by procedure mix)
    // ============================================
    const surgeonMap = new Map<string, CaseWithProfitData[]>()
    casesWithProfit.forEach(c => {
      if (c.surgeon_id && c.surgeon) {
        if (!surgeonMap.has(c.surgeon_id)) surgeonMap.set(c.surgeon_id, [])
        surgeonMap.get(c.surgeon_id)!.push(c)
      }
    })

    const surgeonStats: SurgeonStats[] = Array.from(surgeonMap.entries())
      .map(([surgeonId, surgeonCases]) => {
        const surgeonName = surgeonCases[0].surgeon 
          ? `Dr. ${surgeonCases[0].surgeon.first_name} ${surgeonCases[0].surgeon.last_name}`
          : 'Unknown'
        const surgeonTotal = surgeonCases.reduce((sum, c) => sum + c.profit, 0)
        const surgeonAvgDuration = surgeonCases.reduce((sum, c) => sum + c.duration, 0) / surgeonCases.length

        // FIXED: Calculate weighted expected duration based on surgeon's procedure mix
        // This compares apples to apples - what SHOULD their duration be given their procedures?
        let weightedExpectedDuration = 0
        let totalDurationDiff = 0
        let totalProfitImpact = 0

        surgeonCases.forEach(c => {
          const procId = c.procedure_type_id
          if (procId) {
            const procAvg = procedureAverages.get(procId)
            if (procAvg) {
              weightedExpectedDuration += procAvg.avgDuration
              // How much faster/slower was this case vs procedure average?
              const caseDiff = c.duration - procAvg.avgDuration
              totalDurationDiff += caseDiff
              totalProfitImpact += -caseDiff * (orRate / 60)
            }
          }
        })

        // Average difference per case (not total)
        const avgDurationDiff = surgeonCases.length > 0 ? totalDurationDiff / surgeonCases.length : 0
        const avgProfitImpact = surgeonCases.length > 0 ? totalProfitImpact / surgeonCases.length : 0

        return {
          surgeonId,
          surgeonName,
          totalProfit: surgeonTotal,
          avgProfit: surgeonTotal / surgeonCases.length,
          caseCount: surgeonCases.length,
          avgDurationMinutes: surgeonAvgDuration,
          // FIXED: Now shows how much faster/slower vs expected for THEIR procedure mix
          durationVsAvgMinutes: avgDurationDiff,
          // FIXED: Impact based on procedure-specific comparison
          profitImpact: totalProfitImpact,
        }
      })
      .sort((a, b) => b.totalProfit - a.totalProfit)

    // ============================================
    // STEP 8: Outlier case details (FIXED - procedure-specific expected profit)
    // ============================================
    const outlierDetails: OutlierCase[] = outlierCases.map(c => {
      const procId = c.procedure_type_id || ''
      const procAvg = procedureAverages.get(procId)
      
      // FIXED: Expected profit is now THIS PROCEDURE's average, not global
      const expectedProfit = procAvg?.avgProfit ?? avgProfit
      const expectedDuration = procAvg?.avgDuration ?? c.duration

      // Detect all applicable issues
      const issues: CaseIssue[] = []

      // 1. Over Time check (30% over expected for THIS procedure)
      const actualDuration = c.duration
      if (actualDuration > expectedDuration * 1.3) {
        const percentOver = ((actualDuration - expectedDuration) / expectedDuration) * 100
        issues.push({
          type: 'overTime',
          actualMinutes: actualDuration,
          expectedMinutes: expectedDuration,
          percentOver,
        })
      }

      // 2. Delay check (has recorded delays)
      if (c.case_delays && c.case_delays.length > 0) {
        const delays = c.case_delays.map(d => ({
          name: d.delay_types?.name || 'Unknown Delay',
          minutes: d.duration_minutes,
        }))
        const totalMinutes = c.case_delays.reduce((sum, d) => sum + (d.duration_minutes || 0), 0)
        issues.push({
          type: 'delay',
          delays,
          totalMinutes,
        })
      }

      // 3. Low Payer check (payer rate < 80% of default)
      if (c.payer_id && c.payerReimbursement && c.defaultReimbursement) {
        const percentBelow = ((c.defaultReimbursement - c.payerReimbursement) / c.defaultReimbursement) * 100
        if (percentBelow >= 20) {
          issues.push({
            type: 'lowPayer',
            payerName: c.payers?.name || 'Unknown Payer',
            payerRate: c.payerReimbursement,
            defaultRate: c.defaultReimbursement,
            percentBelow,
          })
        }
      }

      // If no issues detected, add unknown
      if (issues.length === 0) {
        issues.push({ type: 'unknown' })
      }

      // Financial breakdown for drawer
      const financialBreakdown: FinancialBreakdown = {
        reimbursement: c.reimbursement,
        softGoodsCost: c.procedure_types?.soft_goods_cost || 0,
        hardGoodsCost: c.procedure_types?.hard_goods_cost || 0,
        orCost: c.orCost,
        orRate: orRate,
        payerName: c.payers?.name || null,
        defaultReimbursement: c.defaultReimbursement,
        payerReimbursement: c.payerReimbursement,
      }

      return {
        caseId: c.id,
        caseNumber: c.case_number,
        date: c.scheduled_date,
        surgeonName: c.surgeon ? `Dr. ${c.surgeon.first_name} ${c.surgeon.last_name}` : 'Unknown',
        procedureName: c.procedure_types?.name || 'Unknown',
        expectedProfit,  // FIXED: Now procedure-specific
        actualProfit: c.profit,
        gap: c.profit - expectedProfit,
        durationMinutes: actualDuration,
        expectedDurationMinutes: expectedDuration,
        issues,
        financialBreakdown,
      }
    }).sort((a, b) => a.gap - b.gap)

    // ============================================
    // STEP 9: Issue stats
    // ============================================
    const issueStats = {
      overTime: outlierDetails.filter(o => o.issues.some(i => i.type === 'overTime')).length,
      delay: outlierDetails.filter(o => o.issues.some(i => i.type === 'delay')).length,
      lowPayer: outlierDetails.filter(o => o.issues.some(i => i.type === 'lowPayer')).length,
      unknown: outlierDetails.filter(o => o.issues.some(i => i.type === 'unknown')).length,
    }

    // ============================================
    // STEP 10: Time = Money calculations (FIXED - uses procedure-specific avg)
    // ============================================
    const costPerMinute = orRate / 60
    const excessTimeMinutes = casesWithProfit.reduce((sum, c) => {
      const procId = c.procedure_type_id
      if (!procId) return sum
      const procAvg = procedureAverages.get(procId)
      if (!procAvg) return sum
      const excess = Math.max(0, c.duration - procAvg.avgDuration)
      return sum + excess
    }, 0)
    const excessTimeCost = excessTimeMinutes * costPerMinute

    // ============================================
    // STEP 11: Profit trend by date
    // ============================================
    const profitByDate = new Map<string, number>()
    casesWithProfit.forEach(c => {
      const date = c.scheduled_date
      profitByDate.set(date, (profitByDate.get(date) || 0) + c.profit)
    })
    const profitTrend = Array.from(profitByDate.entries())
      .map(([date, profit]) => ({ date, profit }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // ============================================
    // RETURN METRICS
    // ============================================
    return {
      totalCases: casesWithProfit.length,
      totalProfit,
      avgProfit,
      avgMargin,
      outlierCount: outlierCases.length,
      outlierThreshold,
      costPerMinute,
      excessTimeCost,
      procedureStats,
      surgeonStats,
      outlierDetails,
      issueStats,
      profitTrend,
      orRate,
    }
  }, [cases, facilitySettings, reimbursements])
}