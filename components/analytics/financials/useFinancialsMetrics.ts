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
    
    // Calculate profit for each case
    const casesWithProfit: CaseWithProfitData[] = cases
      .map(c => {
        const result = calculateCaseProfit(c, orRate, reimbursements)
        const duration = getCaseDurationMinutes(c.case_milestones)
        return result && duration !== null ? { ...c, ...result, duration } : null
      })
      .filter((c): c is CaseWithProfitData => c !== null)

    // Summary metrics
    const totalProfit = casesWithProfit.reduce((sum, c) => sum + c.profit, 0)
    const totalReimbursement = casesWithProfit.reduce((sum, c) => sum + c.reimbursement, 0)
    const avgProfit = casesWithProfit.length > 0 ? totalProfit / casesWithProfit.length : 0
    const avgMargin = totalReimbursement > 0 ? (totalProfit / totalReimbursement) * 100 : 0

    // Calculate standard deviation for outlier detection
    const profitValues = casesWithProfit.map(c => c.profit)
    const profitMean = avgProfit
    const profitStdDev = profitValues.length > 1 
      ? Math.sqrt(profitValues.reduce((sum, p) => sum + Math.pow(p - profitMean, 2), 0) / profitValues.length)
      : 0

    // Outliers (cases below 1 std dev)
    const outlierThreshold = profitMean - profitStdDev
    const outlierCases = casesWithProfit.filter(c => c.profit < outlierThreshold)

    // Procedure breakdown
    const procedureMap = new Map<string, CaseWithProfitData[]>()
    casesWithProfit.forEach(c => {
      if (c.procedure_types) {
        const key = c.procedure_types.id
        if (!procedureMap.has(key)) procedureMap.set(key, [])
        procedureMap.get(key)!.push(c)
      }
    })

    const procedureStats: ProcedureStats[] = Array.from(procedureMap.entries())
      .map(([procId, procCases]) => {
        const procTotal = procCases.reduce((sum, c) => sum + c.profit, 0)
        const procReimbursement = procCases.reduce((sum, c) => sum + c.reimbursement, 0)
        const procAvgDuration = procCases.reduce((sum, c) => sum + c.duration, 0) / procCases.length
        
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

    // Overall surgeon stats
    const surgeonMap = new Map<string, CaseWithProfitData[]>()
    casesWithProfit.forEach(c => {
      if (c.surgeon_id && c.surgeon) {
        if (!surgeonMap.has(c.surgeon_id)) surgeonMap.set(c.surgeon_id, [])
        surgeonMap.get(c.surgeon_id)!.push(c)
      }
    })

    const overallAvgDuration = casesWithProfit.length > 0
      ? casesWithProfit.reduce((sum, c) => sum + c.duration, 0) / casesWithProfit.length
      : 0

    const surgeonStats: SurgeonStats[] = Array.from(surgeonMap.entries())
      .map(([surgeonId, surgeonCases]) => {
        const surgeonName = surgeonCases[0].surgeon 
          ? `Dr. ${surgeonCases[0].surgeon.first_name} ${surgeonCases[0].surgeon.last_name}`
          : 'Unknown'
        const surgeonTotal = surgeonCases.reduce((sum, c) => sum + c.profit, 0)
        const surgeonAvgDuration = surgeonCases.reduce((sum, c) => sum + c.duration, 0) / surgeonCases.length
        const durationDiff = surgeonAvgDuration - overallAvgDuration
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
      .sort((a, b) => b.totalProfit - a.totalProfit)

    // Outlier case details with multi-issue detection
    const outlierDetails: OutlierCase[] = outlierCases.map(c => {
      const procedureCases = procedureMap.get(c.procedure_type_id || '')
      const expectedDuration = procedureCases 
        ? procedureCases.reduce((sum, pc) => sum + pc.duration, 0) / procedureCases.length
        : c.duration
      const expectedProfit = avgProfit

      // Detect all applicable issues
      const issues: CaseIssue[] = []

      // 1. Over Time check (30% over expected)
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

      // BUILD FINANCIAL BREAKDOWN FOR DRAWER
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
        expectedProfit,
        actualProfit: c.profit,
        gap: c.profit - expectedProfit,
        durationMinutes: actualDuration,
        expectedDurationMinutes: expectedDuration,
        issues,
        financialBreakdown, // NEW: Include financial breakdown
      }
    }).sort((a, b) => a.gap - b.gap)

    // Count issues by type
    const issueStats = {
      overTime: outlierDetails.filter(o => o.issues.some(i => i.type === 'overTime')).length,
      delay: outlierDetails.filter(o => o.issues.some(i => i.type === 'delay')).length,
      lowPayer: outlierDetails.filter(o => o.issues.some(i => i.type === 'lowPayer')).length,
      unknown: outlierDetails.filter(o => o.issues.some(i => i.type === 'unknown')).length,
    }

    // Time = Money calculations
    const costPerMinute = orRate / 60
    const excessTimeMinutes = casesWithProfit.reduce((sum, c) => {
      const procedureCases = procedureMap.get(c.procedure_type_id || '')
      if (!procedureCases) return sum
      const avgDuration = procedureCases.reduce((s, pc) => s + pc.duration, 0) / procedureCases.length
      const excess = Math.max(0, c.duration - avgDuration)
      return sum + excess
    }, 0)
    const excessTimeCost = excessTimeMinutes * costPerMinute

    // Profit trend by date
    const profitByDate = new Map<string, number>()
    casesWithProfit.forEach(c => {
      const date = c.scheduled_date
      profitByDate.set(date, (profitByDate.get(date) || 0) + c.profit)
    })
    const profitTrend = Array.from(profitByDate.entries())
      .map(([date, profit]) => ({ date, profit }))
      .sort((a, b) => a.date.localeCompare(b.date))

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
