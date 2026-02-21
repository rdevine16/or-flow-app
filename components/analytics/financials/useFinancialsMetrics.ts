// components/analytics/financials/useFinancialsMetrics.ts
// Computes enriched financial metrics from case completion stats
// Includes: surgeon/procedure stats, payer mix, profit bins, monthly sparklines
// Computes payer mix, profit distribution bins, monthly sparklines, and phase durations

import { useMemo } from 'react'
import {
  CaseCompletionStats,
  SurgeonProcedureStats,
  FacilityProcedureStats,
  SurgeonStats,
  ProcedureStats,
  ProfitTrendPoint,
  FacilitySettings,
  SurgeonProcedureBreakdown,
  EnrichedFinancialsMetrics,
  PayerMixEntry,
  ProfitBin,
  MonthlyTrendPoint,
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

/** Month label from 1-based month number */
function monthLabel(month: number): string {
  const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return labels[month - 1] || ''
}

// ============================================
// PAYER MIX COMPUTATION
// ============================================

function computePayerMix(cases: CaseCompletionStats[]): PayerMixEntry[] {
  const payerMap = new Map<string, { payerName: string; cases: CaseCompletionStats[] }>()

  cases.forEach(c => {
    const payer = normalizeJoin(c.payers)
    const payerId = c.payer_id || 'unknown'
    const payerName = payer?.name || 'Unknown Payer'

    const existing = payerMap.get(payerId)
    if (existing) {
      existing.cases.push(c)
    } else {
      payerMap.set(payerId, { payerName, cases: [c] })
    }
  })

  const totalCases = cases.length

  return Array.from(payerMap.entries())
    .map(([payerId, { payerName, cases: payerCases }]) => {
      const totalReimbursement = payerCases.reduce((sum, c) => sum + (c.reimbursement || 0), 0)
      const totalProfit = payerCases.reduce((sum, c) => sum + (c.profit || 0), 0)

      return {
        payerId,
        payerName,
        caseCount: payerCases.length,
        totalReimbursement,
        avgReimbursement: payerCases.length > 0 ? totalReimbursement / payerCases.length : 0,
        totalProfit,
        avgProfit: payerCases.length > 0 ? totalProfit / payerCases.length : 0,
        marginPercent: totalReimbursement > 0 ? (totalProfit / totalReimbursement) * 100 : 0,
        pctOfCases: totalCases > 0 ? (payerCases.length / totalCases) * 100 : 0,
      }
    })
    .sort((a, b) => b.caseCount - a.caseCount)
}

// ============================================
// PROFIT DISTRIBUTION BINS
// ============================================

function computeProfitBins(cases: CaseCompletionStats[]): ProfitBin[] {
  const profits = cases.map(c => c.profit || 0)
  if (profits.length === 0) return []

  const min = Math.min(...profits)
  const max = Math.max(...profits)

  // Round to nearest 500 for bin boundaries
  const binStart = Math.floor(min / 500) * 500
  const binEnd = Math.ceil(max / 500) * 500
  const binWidth = 500

  const bins: ProfitBin[] = []
  for (let start = binStart; start < binEnd; start += binWidth) {
    const end = start + binWidth
    const count = profits.filter(p => p >= start && p < end).length

    const fmtVal = (v: number) => {
      const abs = Math.abs(v)
      if (abs >= 1000) return `${v < 0 ? '-' : ''}$${(abs / 1000).toFixed(abs % 1000 === 0 ? 0 : 1)}k`
      return `${v < 0 ? '-' : ''}$${abs}`
    }

    bins.push({
      rangeLabel: `${fmtVal(start)}\u2013${fmtVal(end)}`,
      min: start,
      max: end,
      count,
    })
  }

  return bins
}

// ============================================
// MONTHLY TREND (for sparklines)
// ============================================

function computeMonthlyTrend(cases: CaseCompletionStats[]): MonthlyTrendPoint[] {
  const monthMap = new Map<string, CaseCompletionStats[]>()

  cases.forEach(c => {
    const date = new Date(c.case_date)
    const key = `${date.getFullYear()}-${date.getMonth() + 1}`
    const existing = monthMap.get(key) || []
    existing.push(c)
    monthMap.set(key, existing)
  })

  return Array.from(monthMap.entries())
    .map(([key, monthCases]) => {
      const [yearStr, monthStr] = key.split('-')
      const year = parseInt(yearStr, 10)
      const month = parseInt(monthStr, 10)

      const profits = monthCases.map(c => c.profit || 0)
      const durations = monthCases.map(c => c.total_duration_minutes || 0)
      const totalProfit = profits.reduce((a, b) => a + b, 0)
      const totalReimbursement = monthCases.reduce((sum, c) => sum + (c.reimbursement || 0), 0)
      const totalDebits = monthCases.reduce((sum, c) => sum + getCaseDebits(c), 0)
      const totalCredits = monthCases.reduce((sum, c) => sum + getCaseCredits(c), 0)
      const totalORCost = monthCases.reduce((sum, c) => sum + getCaseORCost(c), 0)
      const totalCosts = totalDebits - totalCredits + totalORCost
      const totalORMinutes = durations.reduce((a, b) => a + b, 0)
      const totalORHours = totalORMinutes / 60

      return {
        year,
        month,
        label: monthLabel(month),
        caseCount: monthCases.length,
        totalProfit,
        avgProfit: monthCases.length > 0 ? totalProfit / monthCases.length : 0,
        totalReimbursement,
        totalDebits,
        totalCredits,
        totalORCost,
        totalCosts,
        marginPercent: totalReimbursement > 0 ? (totalProfit / totalReimbursement) * 100 : 0,
        medianDuration: median(durations),
        profitPerORHour: totalORHours > 0 ? totalProfit / totalORHours : null,
      }
    })
    .sort((a, b) => a.year - b.year || a.month - b.month)
}

// ============================================
// MAIN HOOK
// ============================================
export function useFinancialsMetrics(
  caseStats: CaseCompletionStats[],
  surgeonProcedureStats: SurgeonProcedureStats[],
  facilityProcedureStats: FacilityProcedureStats[],
  facilitySettings: FacilitySettings | null,
  periodStartDate?: string
): EnrichedFinancialsMetrics {
  return useMemo(() => {
    const orRate = facilitySettings?.or_hourly_rate || 0
    const costPerMinute = orRate / 60

    // All cases with valid profit data (includes prior month for trend)
    const allValidCases = caseStats.filter(c =>
      c.profit !== null &&
      c.total_duration_minutes !== null
    )

    // Cases within the selected period only (for main metrics)
    const validCases = periodStartDate
      ? allValidCases.filter(c => c.case_date >= periodStartDate)
      : allValidCases

    // ============================================
    // BUILD LOOKUP MAP
    // ============================================
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

        const profits = cases.map(c => c.profit || 0)
        const totalProfit = profits.reduce((a, b) => a + b, 0)
        const avgProfit = profits.length > 0 ? totalProfit / profits.length : 0
        const medianProfitVal = median(profits)
        const stddevProfitVal = stddev(profits)

        const durations = cases.map(c => c.total_duration_minutes || 0)
        const totalORMinutes = durations.reduce((a, b) => a + b, 0)
        const avgDuration = durations.length > 0 ? totalORMinutes / durations.length : 0
        const medianDurationVal = median(durations)
        const stddevDurationVal = stddev(durations)

        const totalReimbursement = cases.reduce((sum, c) => sum + (c.reimbursement || 0), 0)
        const totalDebits = cases.reduce((sum, c) => sum + getCaseDebits(c), 0)
        const totalCredits = cases.reduce((sum, c) => sum + getCaseCredits(c), 0)
        const totalORCost = cases.reduce((sum, c) => sum + getCaseORCost(c), 0)

        const avgMarginPercent = totalReimbursement > 0
          ? (totalProfit / totalReimbursement) * 100
          : 0

        const totalORHours = totalORMinutes / 60
        const profitPerORHour = totalORHours > 0 ? totalProfit / totalORHours : null

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
            p75: percentile(profits, 75),
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

        const totalReimbursement = cases.reduce((sum, c) => sum + (c.reimbursement || 0), 0)
        const avgReimbursement = cases.length > 0 ? totalReimbursement / cases.length : 0
        const totalDebits = cases.reduce((sum, c) => sum + getCaseDebits(c), 0)
        const totalCredits = cases.reduce((sum, c) => sum + getCaseCredits(c), 0)
        const totalORCost = cases.reduce((sum, c) => sum + getCaseORCost(c), 0)

        const totalORMinutes = durations.reduce((a, b) => a + b, 0)
        const totalORHours = totalORMinutes / 60
        const profitPerORHour = totalORHours > 0 ? totalProfit / totalORHours : null

        const uniqueSurgeons = new Set(cases.map(c => c.surgeon_id).filter(Boolean))

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
                p75: percentile(surgeonProfits, 75),
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
            p75: percentile(profits, 75),
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
            p75: percentile(durations, 75),
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
    // PROFIT TREND (daily)
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
    // NEW: Payer mix, profit bins, monthly trend
    // ============================================
    const payerMix = computePayerMix(validCases)
    const profitBins = computeProfitBins(validCases)
    // Use ALL valid cases (including prior month) for monthly trend so
    // the prior-period comparison section has data to work with
    const monthlyTrend = computeMonthlyTrend(allValidCases)

    // Extract sparkline data arrays from monthly trend (last 6 months)
    const trendSlice = monthlyTrend.slice(-6)
    const sparklines = {
      profit: trendSlice.map(t => t.totalProfit),
      margin: trendSlice.map(t => t.marginPercent),
      duration: trendSlice.map(t => t.medianDuration ?? 0),
      profitPerHour: trendSlice.map(t => t.profitPerORHour ?? 0),
      volume: trendSlice.map(t => t.caseCount),
    }

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
        p75: percentile(allProfits, 75),
      },
      avgMargin,
      profitPerORHour,
      avgDuration,
      medianDuration: median(allDurations),
      totalORMinutes,

      costPerMinute,
      excessTimeCost: excessTimeMinutes * costPerMinute,
      procedureStats, surgeonStats, profitTrend,
      orRate,

      // NEW enriched data
      payerMix,
      profitBins,
      monthlyTrend,
      sparklines,
    }
  }, [caseStats, surgeonProcedureStats, facilityProcedureStats, facilitySettings, periodStartDate])
}
