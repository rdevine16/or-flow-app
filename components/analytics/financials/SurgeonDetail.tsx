// components/analytics/financials/SurgeonDetail.tsx
// Full surgeon detail layout matching orbit-surgeon-detail.jsx mockup
// Hero header + sub-tabs (Overview | Daily Activity | By Procedure)
// Overview: metric cards, trend chart, distribution, economics, payer mix, recent cases

'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  ComposedChart,
  Bar,
  Area,
  Line,
  BarChart,
  XAxis,
  YAxis,
  Tooltip as ReTooltip,
  ResponsiveContainer,
  Cell,
  CartesianGrid,
} from 'recharts'
import { ChevronRight, ArrowRight } from 'lucide-react'

import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/ui/Toast/ToastProvider'

import {
  SurgeonStats,
  CaseCompletionStats,
  FinancialsMetrics,
  PayerMixEntry,
  ProfitBin,
  PhasePillColor,
  CasePhaseDuration,
  SortDir,
} from './types'
import {
  formatCurrency,
  formatPercent,
  formatDuration,
  fmt,
  normalizeJoin,
  median,
  phaseGroupColor,
} from './utils'
import {
  Sparkline,
  ComparisonPill,
  ConsistencyBadge,
  InfoTip,
  SortTH,
  PhasePill,
} from './shared'
import { CaseEconomicsCard } from './CaseEconomicsCard'
import { PayerMixCard } from './PayerMixCard'
import { SurgeonHero, HeroStat } from './SurgeonHero'
import SurgeonDailyActivity from './SurgeonDailyActivity'
import SurgeonByProcedure from './SurgeonByProcedure'

// ============================================
// TYPES
// ============================================

interface SurgeonDetailProps {
  surgeon: SurgeonStats
  cases: CaseCompletionStats[]
  metrics: FinancialsMetrics
  facilityId: string
  onBack: () => void
}

interface MonthlyPoint {
  label: string
  cases: number
  profit: number
  avgProfit: number
}

interface PhaseDefRow {
  id: string
  name: string
  display_name: string
  display_order: number
  color_key: string | null
  start_milestone_id: string
  end_milestone_id: string
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function computeSurgeonPayerMix(cases: CaseCompletionStats[]): PayerMixEntry[] {
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

function computeSurgeonProfitBins(cases: CaseCompletionStats[]): ProfitBin[] {
  const profits = cases.map(c => c.profit || 0)
  if (profits.length === 0) return []

  const min = Math.min(...profits)
  const max = Math.max(...profits)
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

function computeSurgeonMonthlyTrend(cases: CaseCompletionStats[]): MonthlyPoint[] {
  const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const monthMap = new Map<string, CaseCompletionStats[]>()

  cases.forEach(c => {
    const d = new Date(c.case_date)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const existing = monthMap.get(key) || []
    existing.push(c)
    monthMap.set(key, existing)
  })

  return Array.from(monthMap.entries())
    .map(([key, monthCases]) => {
      const [, monthStr] = key.split('-')
      const month = parseInt(monthStr, 10)
      const profits = monthCases.map(c => c.profit || 0)
      const totalProfit = profits.reduce((a, b) => a + b, 0)

      return {
        label: monthLabels[month - 1],
        cases: monthCases.length,
        profit: totalProfit,
        avgProfit: monthCases.length > 0 ? totalProfit / monthCases.length : 0,
        _sortKey: key,
      }
    })
    .sort((a, b) => a._sortKey.localeCompare(b._sortKey))
    .slice(-6)
    .map(({ _sortKey: _, ...rest }) => rest)
}

function getCaseDebits(c: CaseCompletionStats): number {
  return c.total_debits ?? c.soft_goods_cost ?? 0
}

function getCaseORCost(c: CaseCompletionStats): number {
  return c.or_time_cost ?? c.or_cost ?? 0
}

function colorKeyToPillColor(colorKey: string | null): PhasePillColor {
  // color_key stores the phase_group name or a custom key
  if (!colorKey) return 'blue'
  return phaseGroupColor(colorKey)
}

function computeTrendPct(values: number[]): { pct: string; up: boolean } | null {
  if (values.length < 2) return null
  const curr = values[values.length - 1]
  const prev = values[values.length - 2]
  if (prev === 0) return null
  const pct = ((curr - prev) / Math.abs(prev)) * 100
  return { pct: `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`, up: pct > 0 }
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function SurgeonDetail({
  surgeon,
  cases,
  metrics,
  facilityId,
  onBack,
}: SurgeonDetailProps) {
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'daily' | 'procedures'>('overview')
  const { showToast } = useToast()

  // Phase data for recent cases
  const [phaseDefinitions, setPhaseDefinitions] = useState<PhaseDefRow[]>([])
  const [caseMilestoneMap, setCaseMilestoneMap] = useState<
    Record<string, Array<{ facility_milestone_id: string; recorded_at: string | null }>>
  >({})
  const [loadingPhases, setLoadingPhases] = useState(false)

  // ============================================
  // COMPUTED DATA
  // ============================================

  const payerMix = useMemo(() => computeSurgeonPayerMix(cases), [cases])
  const profitBins = useMemo(() => computeSurgeonProfitBins(cases), [cases])
  const monthlyTrend = useMemo(() => computeSurgeonMonthlyTrend(cases), [cases])

  // Sparkline arrays from monthly trend
  const sparklines = useMemo(() => {
    return {
      profit: monthlyTrend.map(m => m.profit),
      profitPerCase: monthlyTrend.map(m => m.avgProfit),
      perHr: monthlyTrend.map(m => {
        const monthCases = cases.filter(c => {
          const d = new Date(c.case_date)
          const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
          return monthLabels[d.getMonth()] === m.label
        })
        const totalMin = monthCases.reduce((s, c) => s + (c.total_duration_minutes || 0), 0)
        const hrs = totalMin / 60
        return hrs > 0 ? m.profit / hrs : 0
      }),
      margin: monthlyTrend.map(m => {
        const monthCases = cases.filter(c => {
          const d = new Date(c.case_date)
          const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
          return monthLabels[d.getMonth()] === m.label
        })
        const reimb = monthCases.reduce((s, c) => s + (c.reimbursement || 0), 0)
        const prof = monthCases.reduce((s, c) => s + (c.profit || 0), 0)
        return reimb > 0 ? (prof / reimb) * 100 : 0
      }),
      caseCount: monthlyTrend.map(m => m.cases),
      duration: monthlyTrend.map(m => {
        const monthCases = cases.filter(c => {
          const d = new Date(c.case_date)
          const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
          return monthLabels[d.getMonth()] === m.label
        })
        const durations = monthCases.map(c => c.total_duration_minutes || 0).filter(d => d > 0)
        return median(durations) ?? 0
      }),
    }
  }, [cases, monthlyTrend])

  // Profit stats for distribution summary
  const profitStats = useMemo(() => {
    const profits = cases.map(c => c.profit || 0)
    return {
      min: profits.length > 0 ? Math.min(...profits) : 0,
      median: median(profits) ?? 0,
      max: profits.length > 0 ? Math.max(...profits) : 0,
    }
  }, [cases])

  // Average case economics
  const economics = useMemo(() => {
    const n = cases.length || 1
    return {
      avgReimbursement: cases.reduce((s, c) => s + (c.reimbursement || 0), 0) / n,
      avgDebits: cases.reduce((s, c) => s + getCaseDebits(c), 0) / n,
      avgCredits: cases.reduce((s, c) => s + (c.total_credits ?? c.hard_goods_cost ?? 0), 0) / n,
      avgORCost: cases.reduce((s, c) => s + getCaseORCost(c), 0) / n,
      avgProfit: surgeon.totalProfit / n,
    }
  }, [cases, surgeon.totalProfit])

  // Efficiency/consistency metrics
  const efficiency = useMemo(() => {
    const durations = cases
      .map(c => c.total_duration_minutes)
      .filter((d): d is number => d !== null && d > 0)

    const surgicalTimes = cases
      .map(c => c.surgical_duration_minutes)
      .filter((t): t is number => t !== null && t > 0)

    const medianDuration = median(durations)
    const avgDuration = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : null
    const stdDev = avgDuration && durations.length > 1
      ? Math.sqrt(durations.reduce((sum, d) => sum + Math.pow(d - avgDuration, 2), 0) / durations.length)
      : null
    const cv = avgDuration && stdDev ? (stdDev / avgDuration) * 100 : null

    let consistencyRating: 'high' | 'medium' | 'low' = 'medium'
    if (cv !== null) {
      if (cv < 15) consistencyRating = 'high'
      else if (cv > 30) consistencyRating = 'low'
    }

    return {
      medianDuration,
      consistencyRating,
      avgSurgicalTime: surgicalTimes.length > 0
        ? surgicalTimes.reduce((a, b) => a + b, 0) / surgicalTimes.length
        : null,
      durationRange: durations.length > 0
        ? { min: Math.min(...durations), max: Math.max(...durations) }
        : null,
      durations, // for the mini bar chart
    }
  }, [cases])

  // Hero stats
  const heroStats: HeroStat[] = useMemo(() => {
    const profitTrend = computeTrendPct(sparklines.profit)
    const perCaseTrend = computeTrendPct(sparklines.profitPerCase)
    const perHrTrend = computeTrendPct(sparklines.perHr)
    const marginTrend = computeTrendPct(sparklines.margin)
    const durationTrend = computeTrendPct(sparklines.duration)

    return [
      {
        label: 'Total Profit',
        value: formatCurrency(surgeon.totalProfit),
        trend: profitTrend?.pct ?? null,
        trendUp: profitTrend?.up ?? null,
        spark: sparklines.profit,
      },
      {
        label: 'Typical / Case',
        value: formatCurrency(surgeon.medianProfit ?? surgeon.avgProfit),
        trend: perCaseTrend?.pct ?? null,
        trendUp: perCaseTrend?.up ?? null,
        spark: sparklines.profitPerCase,
      },
      {
        label: '$ / OR Hour',
        value: surgeon.profitPerORHour !== null ? formatCurrency(surgeon.profitPerORHour) : '—',
        trend: perHrTrend?.pct ?? null,
        trendUp: perHrTrend?.up ?? null,
        spark: sparklines.perHr,
        accent: 'text-blue-300',
      },
      {
        label: 'Margin',
        value: formatPercent(surgeon.avgMarginPercent),
        trend: marginTrend?.pct ?? null,
        trendUp: marginTrend?.up ?? null,
        spark: sparklines.margin,
      },
      {
        label: 'Cases',
        value: String(surgeon.caseCount),
        trend: null,
        trendUp: null,
        spark: sparklines.caseCount,
      },
      {
        label: 'Typical Duration',
        value: formatDuration(efficiency.medianDuration),
        trend: durationTrend?.pct ?? null,
        trendUp: durationTrend ? !durationTrend.up : null, // lower duration = good
        spark: sparklines.duration,
      },
    ]
  }, [surgeon, sparklines, efficiency.medianDuration])

  // Facility comparison
  const facilityComparison = useMemo(() => {
    const perHrDiff =
      surgeon.profitPerORHour !== null && metrics.profitPerORHour !== null
        ? surgeon.profitPerORHour - metrics.profitPerORHour
        : null
    const marginDiff = surgeon.avgMarginPercent - metrics.avgMargin

    return { profitPerHrDiff: perHrDiff, marginDiff }
  }, [surgeon, metrics])

  // Recent cases (last 5) sorted by date desc
  const recentCases = useMemo(() => {
    return [...cases]
      .sort((a, b) => b.case_date.localeCompare(a.case_date))
      .slice(0, 5)
  }, [cases])

  // Per-case median lookup for comparison pills
  const surgeonMedians = useMemo(() => {
    const byProcedure: Record<string, { durations: number[]; profits: number[] }> = {}

    cases.forEach(c => {
      if (!c.procedure_type_id) return
      if (!byProcedure[c.procedure_type_id]) {
        byProcedure[c.procedure_type_id] = { durations: [], profits: [] }
      }
      if (c.total_duration_minutes) byProcedure[c.procedure_type_id].durations.push(c.total_duration_minutes)
      if (c.profit) byProcedure[c.procedure_type_id].profits.push(c.profit)
    })

    const result: Record<string, { medianDuration: number | null; medianProfit: number | null }> = {}
    Object.entries(byProcedure).forEach(([procId, data]) => {
      result[procId] = {
        medianDuration: median(data.durations),
        medianProfit: median(data.profits),
      }
    })
    return result
  }, [cases])

  // ============================================
  // PHASE DATA FETCHING
  // ============================================

  const fetchPhaseData = useCallback(
    async (caseIds: string[]) => {
      if (caseIds.length === 0 || !facilityId) {
        setCaseMilestoneMap({})
        return
      }

      setLoadingPhases(true)
      try {
        const supabase = createClient()

        const [phaseDefsRes, milestonesRes] = await Promise.all([
          // Fetch phase definitions for this facility
          supabase
            .from('phase_definitions')
            .select('id, name, display_name, display_order, color_key, start_milestone_id, end_milestone_id')
            .eq('facility_id', facilityId)
            .eq('is_active', true)
            .order('display_order', { ascending: true }),

          // Fetch case milestones for the given cases
          supabase
            .from('case_milestones')
            .select('case_id, facility_milestone_id, recorded_at')
            .in('case_id', caseIds)
            .order('recorded_at', { ascending: true }),
        ])

        if (phaseDefsRes.error) {
          showToast({
            type: 'error',
            title: 'Failed to fetch phase definitions',
            message: phaseDefsRes.error.message,
          })
          return
        }

        if (milestonesRes.error) {
          showToast({
            type: 'error',
            title: 'Failed to fetch milestones',
            message: milestonesRes.error.message,
          })
          return
        }

        setPhaseDefinitions(phaseDefsRes.data as PhaseDefRow[])

        // Group milestones by case_id
        const byCase: Record<string, Array<{ facility_milestone_id: string; recorded_at: string | null }>> = {}
        for (const m of milestonesRes.data || []) {
          if (!byCase[m.case_id]) byCase[m.case_id] = []
          byCase[m.case_id].push({
            facility_milestone_id: m.facility_milestone_id,
            recorded_at: m.recorded_at,
          })
        }
        setCaseMilestoneMap(byCase)
      } catch (err) {
        showToast({
          type: 'error',
          title: 'Error fetching phase data',
          message: err instanceof Error ? err.message : 'Unknown error',
        })
      } finally {
        setLoadingPhases(false)
      }
    },
    [facilityId, showToast],
  )

  // Fetch phase data for ALL cases (needed by Daily Activity tab)
  useEffect(() => {
    const caseIds = cases.map(c => c.case_id)
    fetchPhaseData(caseIds)
  }, [cases, fetchPhaseData])

  // Compute phase durations per case from phase_definitions + case milestones
  const casePhaseDurations = useMemo(() => {
    if (phaseDefinitions.length === 0) return new Map<string, CasePhaseDuration[]>()

    const result = new Map<string, CasePhaseDuration[]>()

    for (const [caseId, milestones] of Object.entries(caseMilestoneMap)) {
      // Build timestamp lookup: facility_milestone_id → recorded_at timestamp
      const timeMap = new Map<string, number>()
      for (const m of milestones) {
        if (m.recorded_at) {
          timeMap.set(m.facility_milestone_id, new Date(m.recorded_at).getTime())
        }
      }

      const phases: CasePhaseDuration[] = phaseDefinitions.map(pd => {
        const startTime = timeMap.get(pd.start_milestone_id)
        const endTime = timeMap.get(pd.end_milestone_id)
        const minutes =
          startTime != null && endTime != null && endTime > startTime
            ? Math.round((endTime - startTime) / 60000)
            : null

        return {
          label: pd.display_name,
          minutes,
          color: colorKeyToPillColor(pd.color_key),
        }
      })

      result.set(caseId, phases)
    }

    return result
  }, [phaseDefinitions, caseMilestoneMap])

  // Procedure count for hero
  const procedureCount = surgeon.procedureBreakdown?.length ?? 0

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm mb-1">
        <button
          onClick={onBack}
          className="text-slate-500 hover:text-blue-600 font-medium transition-colors"
        >
          All Surgeons
        </button>
        <ChevronRight className="w-4 h-4 text-slate-400" />
        <span className="text-slate-900 font-medium">{surgeon.surgeonName}</span>
      </nav>

      {/* Hero Header */}
      <SurgeonHero
        name={surgeon.surgeonName}
        caseCount={surgeon.caseCount}
        procedureCount={procedureCount}
        isLowVolume={surgeon.caseCount < 10}
        stats={heroStats}
        facilityComparison={facilityComparison}
      />

      {/* Sub-tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-lg w-fit">
        {[
          { id: 'overview' as const, label: 'Overview' },
          { id: 'daily' as const, label: 'Daily Activity' },
          { id: 'procedures' as const, label: 'By Procedure' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
              activeSubTab === tab.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Sub-tab Content */}
      {activeSubTab === 'overview' && (
        <OverviewSubTab
          surgeon={surgeon}
          cases={cases}
          metrics={metrics}
          economics={economics}
          efficiency={efficiency}
          payerMix={payerMix}
          profitBins={profitBins}
          profitStats={profitStats}
          monthlyTrend={monthlyTrend}
          recentCases={recentCases}
          surgeonMedians={surgeonMedians}
          casePhaseDurations={casePhaseDurations}
          loadingPhases={loadingPhases}
          onSwitchToDaily={() => setActiveSubTab('daily')}
        />
      )}

      {activeSubTab === 'daily' && (
        <SurgeonDailyActivity
          cases={cases}
          casePhaseDurations={casePhaseDurations}
          loadingPhases={loadingPhases}
          surgeonMedians={surgeonMedians}
        />
      )}

      {activeSubTab === 'procedures' && (
        <SurgeonByProcedure
          procedureBreakdown={surgeon.procedureBreakdown ?? []}
          surgeonName={surgeon.surgeonName}
        />
      )}
    </div>
  )
}

// ============================================
// OVERVIEW SUB-TAB
// ============================================

function OverviewSubTab({
  surgeon,
  cases,
  metrics,
  economics,
  efficiency,
  payerMix,
  profitBins,
  profitStats,
  monthlyTrend,
  recentCases,
  surgeonMedians,
  casePhaseDurations,
  loadingPhases,
  onSwitchToDaily,
}: {
  surgeon: SurgeonStats
  cases: CaseCompletionStats[]
  metrics: FinancialsMetrics
  economics: {
    avgReimbursement: number
    avgDebits: number
    avgCredits: number
    avgORCost: number
    avgProfit: number
  }
  efficiency: {
    medianDuration: number | null
    consistencyRating: 'high' | 'medium' | 'low'
    avgSurgicalTime: number | null
    durationRange: { min: number; max: number } | null
    durations: number[]
  }
  payerMix: PayerMixEntry[]
  profitBins: ProfitBin[]
  profitStats: { min: number; median: number; max: number }
  monthlyTrend: MonthlyPoint[]
  recentCases: CaseCompletionStats[]
  surgeonMedians: Record<string, { medianDuration: number | null; medianProfit: number | null }>
  casePhaseDurations: Map<string, CasePhaseDuration[]>
  loadingPhases: boolean
  onSwitchToDaily: () => void
}) {
  return (
    <div className="space-y-4">
      {/* Row 1: Performance Metric Cards */}
      <div className="grid grid-cols-4 gap-3">
        {/* Time vs Facility */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:border-slate-300 transition-all group">
          <div className="flex items-center gap-1 mb-2">
            <p className="text-xs font-medium text-slate-400">Time vs Facility</p>
            <InfoTip text="Weighted avg comparing surgeon's duration to facility median per procedure type" />
          </div>
          <div className="flex items-start justify-between">
            <div>
              <p
                className={`text-2xl font-bold ${
                  surgeon.durationVsFacilityMinutes < 0
                    ? 'text-green-600'
                    : surgeon.durationVsFacilityMinutes > 5
                      ? 'text-red-600'
                      : 'text-slate-900'
                }`}
              >
                {surgeon.durationVsFacilityMinutes > 0 ? '+' : ''}
                {Math.round(surgeon.durationVsFacilityMinutes)} min
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {surgeon.durationVsFacilityMinutes < 0 ? 'Faster' : 'Slower'} than facility typical
              </p>
            </div>
            <div className="opacity-60 group-hover:opacity-100 transition-opacity">
              <Sparkline
                data={[5, 3, 1, 0, -1, Math.round(surgeon.durationVsFacilityMinutes)]}
                color="#10b981"
              />
            </div>
          </div>
        </div>

        {/* Profit Impact */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:border-slate-300 transition-all group">
          <div className="flex items-center gap-1 mb-2">
            <p className="text-xs font-medium text-slate-400">Profit Impact</p>
            <InfoTip text="Estimated profit impact per case from time efficiency vs facility baseline" />
          </div>
          <div className="flex items-start justify-between">
            <div>
              <p
                className={`text-2xl font-bold ${
                  surgeon.profitImpact >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {surgeon.profitImpact >= 0 ? '+' : ''}
                {formatCurrency(surgeon.profitImpact)}/case
              </p>
              <p className="text-xs text-slate-400 mt-1">From time efficiency</p>
            </div>
            <div className="opacity-60 group-hover:opacity-100 transition-opacity">
              <Sparkline
                data={[-25, 0, 15, 30, 40, surgeon.profitImpact]}
                color="#10b981"
              />
            </div>
          </div>
        </div>

        {/* Typical Surgical Time */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:border-slate-300 transition-all group">
          <div className="flex items-center gap-1 mb-2">
            <p className="text-xs font-medium text-slate-400">Typical Surgical Time</p>
            <InfoTip text="Median incision-to-closing across all procedures" />
          </div>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-2xl font-bold text-slate-900">
                {formatDuration(efficiency.avgSurgicalTime)}
              </p>
              <p className="text-xs text-slate-400 mt-1">Incision to closing</p>
            </div>
            {efficiency.durations.length >= 2 && (
              <div className="opacity-60 group-hover:opacity-100 transition-opacity">
                <Sparkline data={efficiency.durations.slice(-6)} color="#0ea5e9" />
              </div>
            )}
          </div>
        </div>

        {/* Consistency */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-400 mb-2">Consistency</p>
          <ConsistencyBadge rating={efficiency.consistencyRating} size="lg" />
          <p className="text-xs text-slate-400 mt-2">Case duration variance</p>
          {/* Mini variance visualization */}
          {efficiency.durations.length > 0 && (
            <>
              <div className="mt-2 flex items-end gap-0.5 h-6">
                {efficiency.durations.slice(-9).map((d, i) => {
                  const range = efficiency.durationRange
                  const minD = range ? range.min : d
                  const maxD = range ? range.max : d
                  const span = maxD - minD || 1
                  const h = ((d - minD) / span) * 100
                  const barColor =
                    efficiency.consistencyRating === 'high'
                      ? 'bg-green-200'
                      : efficiency.consistencyRating === 'low'
                        ? 'bg-red-200'
                        : 'bg-amber-200'
                  return (
                    <div
                      key={i}
                      className={`flex-1 ${barColor} rounded-t-sm`}
                      style={{ height: `${Math.max(h, 10)}%` }}
                    />
                  )
                })}
              </div>
              {efficiency.durationRange && (
                <div className="flex justify-between mt-1 text-[9px] text-slate-400">
                  <span>
                    {efficiency.consistencyRating === 'high' ? 'Narrow range' : 'Wide range'}
                  </span>
                  <span>
                    {Math.round(efficiency.durationRange.min)}–
                    {Math.round(efficiency.durationRange.max)} min
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Row 2: Trend Chart + Distribution */}
      <div className="grid grid-cols-3 gap-4">
        {/* Volume & Profit Trend (2 cols) */}
        <div className="col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Volume & Profit Trend</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Monthly case volume, total profit, and avg per case
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-2 bg-emerald-500/70 rounded-sm" />
                Profit
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-blue-500 rounded-full" />
                Avg/Case
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-5 h-3 bg-slate-200/60 rounded-sm text-[8px] text-slate-400 flex items-center justify-center">
                  n
                </span>
                Volume
              </span>
            </div>
          </div>
          {monthlyTrend.length >= 2 ? (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={monthlyTrend}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="surgProfitGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    dy={8}
                  />
                  <YAxis
                    yAxisId="left"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                    width={44}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    domain={[0, 'auto']}
                    width={28}
                  />
                  <ReTooltip
                    contentStyle={{
                      background: 'white',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07)',
                      fontSize: '12px',
                    }}
                    formatter={(v: number | undefined, n: string | undefined) => [
                      n === 'cases'
                        ? `${v ?? 0} cases`
                        : `$${(v ?? 0).toLocaleString()}`,
                      n === 'cases' ? 'Volume' : n === 'profit' ? 'Total Profit' : 'Avg/Case',
                    ]}
                  />
                  <Bar
                    yAxisId="right"
                    dataKey="cases"
                    fill="#e2e8f0"
                    radius={[3, 3, 0, 0]}
                    maxBarSize={28}
                  />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="profit"
                    stroke="#10b981"
                    strokeWidth={2}
                    fill="url(#surgProfitGrad)"
                    dot={{ r: 3, fill: '#10b981', stroke: 'white', strokeWidth: 2 }}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="avgProfit"
                    stroke="#3b82f6"
                    strokeWidth={1.5}
                    strokeDasharray="4 2"
                    dot={{ r: 2.5, fill: '#3b82f6', stroke: 'white', strokeWidth: 1.5 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-52 flex items-center justify-center text-sm text-slate-400">
              Not enough data for trend chart
            </div>
          )}
        </div>

        {/* Profit Distribution (1 col) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-900">Profit Distribution</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Per-case profit spread across {surgeon.caseCount} cases
            </p>
          </div>
          {profitBins.length > 0 ? (
            <>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={profitBins}
                    margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis
                      dataKey="rangeLabel"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 8, fill: '#94a3b8' }}
                      dy={4}
                      interval={0}
                      angle={-25}
                      textAnchor="end"
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      allowDecimals={false}
                      width={18}
                    />
                    <ReTooltip
                      contentStyle={{
                        background: 'white',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                      formatter={(v: number | undefined) => [
                        `${v ?? 0} case${(v ?? 0) !== 1 ? 's' : ''}`,
                        'Count',
                      ]}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={28}>
                      {profitBins.map((b, i) => (
                        <Cell
                          key={`bin-${i}`}
                          fill={b.count === 0 ? '#f1f5f9' : b.min < 0 ? '#ef4444' : '#10b981'}
                          opacity={b.count === 0 ? 0.5 : 0.7}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {/* Distribution summary */}
              <div className="mt-3 pt-3 border-t border-slate-100">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase">Min</p>
                    <p className="text-sm font-semibold text-slate-700 tabular-nums">
                      {formatCurrency(profitStats.min)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase">Median</p>
                    <p className="text-sm font-semibold text-emerald-600 tabular-nums">
                      {formatCurrency(profitStats.median)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase">Max</p>
                    <p className="text-sm font-semibold text-slate-700 tabular-nums">
                      {formatCurrency(profitStats.max)}
                    </p>
                  </div>
                </div>
                {/* Facility median reference */}
                {metrics.medianProfit !== null && (
                  <div className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-400">
                    <span className="w-0 h-0 border-l-[4px] border-r-[4px] border-b-[5px] border-l-transparent border-r-transparent border-b-blue-400" />
                    Facility median: {formatCurrency(metrics.medianProfit)}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="h-44 flex items-center justify-center text-sm text-slate-400">
              No profit data
            </div>
          )}
        </div>
      </div>

      {/* Row 3: Case Economics + Payer Mix */}
      <div className="grid grid-cols-2 gap-4">
        <CaseEconomicsCard
          avgReimbursement={economics.avgReimbursement}
          avgDebits={economics.avgDebits}
          avgCredits={economics.avgCredits}
          avgORCost={economics.avgORCost}
          avgProfit={economics.avgProfit}
        />
        <PayerMixCard
          payerMix={payerMix}
          subtitle={`Reimbursement and margin by payer for ${surgeon.surgeonName}`}
        />
      </div>

      {/* Row 4: Recent Cases */}
      <RecentCasesSection
        recentCases={recentCases}
        surgeonMedians={surgeonMedians}
        casePhaseDurations={casePhaseDurations}
        loadingPhases={loadingPhases}
        onSwitchToDaily={onSwitchToDaily}
      />
    </div>
  )
}

// ============================================
// RECENT CASES SECTION
// ============================================

function RecentCasesSection({
  recentCases,
  surgeonMedians,
  casePhaseDurations,
  loadingPhases,
  onSwitchToDaily,
}: {
  recentCases: CaseCompletionStats[]
  surgeonMedians: Record<string, { medianDuration: number | null; medianProfit: number | null }>
  casePhaseDurations: Map<string, CasePhaseDuration[]>
  loadingPhases: boolean
  onSwitchToDaily: () => void
}) {
  if (recentCases.length === 0) return null

  // Collect unique phase labels from the first case that has phases (for legend)
  const legendPhases: CasePhaseDuration[] = []
  for (const c of recentCases) {
    const phases = casePhaseDurations.get(c.case_id)
    if (phases && phases.length > 0) {
      legendPhases.push(...phases)
      break
    }
  }

  const phaseColorDotMap: Record<PhasePillColor, string> = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    amber: 'bg-amber-500',
    violet: 'bg-violet-500',
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Recent Cases</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Last {recentCases.length} cases · View Daily Activity for full breakdown
            </p>
          </div>
          {legendPhases.length > 0 && (
            <div className="flex items-center gap-3 text-[10px] text-slate-400">
              {legendPhases.map(phase => (
                <span key={phase.label} className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${phaseColorDotMap[phase.color]}`} />
                  {phase.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="divide-y divide-slate-50">
        {recentCases.map((caseData, idx) => {
          const procMedians = caseData.procedure_type_id
            ? surgeonMedians[caseData.procedure_type_id]
            : null
          const durDiff =
            caseData.total_duration_minutes && procMedians?.medianDuration
              ? caseData.total_duration_minutes - procMedians.medianDuration
              : null
          const profitDiff =
            caseData.profit && procMedians?.medianProfit
              ? caseData.profit - procMedians.medianProfit
              : null

          const phases = casePhaseDurations.get(caseData.case_id)
          const procedureName =
            (Array.isArray(caseData.procedure_types)
              ? caseData.procedure_types[0]?.name
              : caseData.procedure_types?.name) || 'Unknown Procedure'
          const roomName =
            (Array.isArray(caseData.or_rooms)
              ? caseData.or_rooms[0]?.name
              : caseData.or_rooms?.name) || ''
          const payerName =
            (Array.isArray(caseData.payers)
              ? caseData.payers[0]?.name
              : caseData.payers?.name) || ''

          const dateObj = new Date(caseData.case_date + 'T00:00:00')
          const dateLabel = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

          return (
            <div
              key={caseData.case_id}
              className="px-5 py-3.5 hover:bg-slate-50/50 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center gap-0.5">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                      idx === 0
                        ? 'bg-gradient-to-br from-amber-400 to-amber-500 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {idx + 1}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-slate-900">{procedureName}</span>
                    {roomName && (
                      <>
                        <span className="text-slate-300">·</span>
                        <span className="text-xs text-slate-500">{roomName}</span>
                      </>
                    )}
                    <span className="text-slate-300">·</span>
                    <span className="text-xs text-slate-400">{dateLabel}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-mono text-[10px] text-slate-400">
                      {caseData.case_number}
                    </span>
                    {payerName && (
                      <>
                        <span className="text-[10px] text-slate-300">·</span>
                        <span className="text-[10px] text-slate-400">{payerName}</span>
                      </>
                    )}
                  </div>

                  {/* Phase pills */}
                  {phases && phases.length > 0 && (
                    <div className="flex items-center gap-1 mt-2">
                      {phases.map(phase => (
                        <PhasePill
                          key={phase.label}
                          label={phase.label}
                          minutes={phase.minutes}
                          color={phase.color}
                        />
                      ))}
                    </div>
                  )}
                  {loadingPhases && !phases && (
                    <div className="flex items-center gap-1.5 mt-2">
                      {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-6 w-16 bg-slate-100 rounded-md animate-pulse" />
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-5 shrink-0">
                  <div className="text-right">
                    <div className="text-[10px] text-slate-400 uppercase mb-0.5">Duration</div>
                    <div className="flex items-center justify-end gap-1.5">
                      <span className="text-sm font-semibold text-slate-900 tabular-nums">
                        {formatDuration(caseData.total_duration_minutes)}
                      </span>
                      {durDiff !== null && <ComparisonPill value={durDiff} unit="min" invert />}
                    </div>
                  </div>
                  <div className="text-right min-w-[120px]">
                    <div className="text-[10px] text-slate-400 uppercase mb-0.5">Profit</div>
                    <div className="flex items-center justify-end gap-1.5">
                      <span
                        className={`text-sm font-bold tabular-nums ${
                          (caseData.profit ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-600'
                        }`}
                      >
                        {fmt(caseData.profit ?? 0)}
                      </span>
                      {profitDiff !== null && <ComparisonPill value={profitDiff} format="currency" />}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer link to Daily Activity */}
      <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-center">
        <button
          onClick={onSwitchToDaily}
          className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors flex items-center gap-1"
        >
          View all days in Daily Activity
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
