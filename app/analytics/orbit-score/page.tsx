// app/analytics/orbit-score/page.tsx
'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import DashboardLayout from '@/components/layouts/DashboardLayout'

import DateRangeSelector, { getPresetDates } from '@/components/ui/DateRangeSelector'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { ArrowRight, ChevronDown } from 'lucide-react'
import { PageLoader } from '@/components/ui/Loading'
import AccessDenied from '@/components/ui/AccessDenied'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import {
  calculateORbitScores,
  generateImprovementPlan,
  getGrade,
  PILLARS,
  MIN_CASE_THRESHOLD,
  type ORbitScorecard,
  type ScorecardCase,
  type ScorecardFinancials,
  type ScorecardFlag,
  type ScorecardSettings,
  type ImprovementRecommendation,
} from '@/lib/orbitScoreEngine'
import { chartHex } from '@/lib/design-tokens'

// ─── DATA FETCHING ────────────────────────────────────────────

async function fetchScorecardData(
  supabase: ReturnType<typeof createClient>,
  facilityId: string,
  startDate: string,
  endDate: string,
) {
  const { data: rawCases, error: casesError } = await supabase
    .from('cases')
    .select(`
      id,
      surgeon_id,
      procedure_type_id,
      or_room_id,
      scheduled_date,
      start_time,
      data_validated,
      procedure_types(id, name),
      users!surgeon_id(id, first_name, last_name),
      case_milestones(
        facility_milestone_id,
        recorded_at,
        facility_milestones(name)
      ),
      case_statuses(name)
    `)
    .eq('facility_id', facilityId)
    .eq('data_validated', true)
    .gte('scheduled_date', startDate)
    .lte('scheduled_date', endDate)

  if (casesError) {
    return null
  }

  const completedCases = (rawCases || []).filter(
    (c: Record<string, unknown>) => (c.case_statuses as Record<string, unknown> | undefined)?.name === 'completed'
  )

  const cases: ScorecardCase[] = completedCases.map((c: Record<string, unknown>) => {
    const milestones: Record<string, string | null> = {}
    const caseMilestones = c.case_milestones as Array<{ facility_milestone_id: string; recorded_at: string | null; facility_milestones?: { name?: string } | Array<{ name?: string }> | null }> | null
    for (const cm of (caseMilestones || [])) {
      const fmRaw = cm.facility_milestones
      const fm = Array.isArray(fmRaw) ? fmRaw[0] : fmRaw
      const name = fm?.name
      if (name && cm.recorded_at) {
        milestones[name] = cm.recorded_at
      }
    }

    const usersRaw = c.users as { first_name?: string; last_name?: string } | Array<{ first_name?: string; last_name?: string }> | null
    const users = Array.isArray(usersRaw) ? usersRaw[0] : usersRaw
    const procedureTypesRaw = c.procedure_types as { name?: string } | Array<{ name?: string }> | null
    const procedureType = Array.isArray(procedureTypesRaw) ? procedureTypesRaw[0] : procedureTypesRaw

    return {
      id: c.id as string,
      surgeon_id: c.surgeon_id as string,
      surgeon_first_name: users?.first_name || '',
      surgeon_last_name: users?.last_name || '',
      procedure_type_id: c.procedure_type_id as string,
      procedure_name: procedureType?.name || 'Unknown',
      or_room_id: c.or_room_id as string,
      scheduled_date: c.scheduled_date as string,
      start_time: c.start_time as string | null,
      patient_in_at: milestones['patient_in'] || null,
      incision_at: milestones['incision'] || null,
      prep_drape_complete_at: milestones['prep_drape_complete'] || null,
      closing_at: milestones['closing'] || milestones['closure_start'] || null,
      patient_out_at: milestones['patient_out'] || null,
    }
  })

  const caseIds = cases.map(c => c.id)
  let financials: ScorecardFinancials[] = []

  if (caseIds.length > 0) {
    for (let i = 0; i < caseIds.length; i += 100) {
      const chunk = caseIds.slice(i, i + 100)
      const { data: finData, error: finError } = await supabase
        .from('case_completion_stats')
        .select('case_id, profit, reimbursement, or_time_cost')
        .in('case_id', chunk)
      if (finError) {
        // financials query error — non-fatal, continue
      }
      if (finData) financials = [...financials, ...finData]
    }
  }

  let flags: ScorecardFlag[] = []
  if (caseIds.length > 0) {
    for (let i = 0; i < caseIds.length; i += 100) {
      const chunk = caseIds.slice(i, i + 100)
      const { data: flagData } = await supabase
        .from('case_flags')
        .select(`
          case_id,
          flag_type,
          severity,
          created_by,
          delay_types(name)
        `)
        .in('case_id', chunk)
      if (flagData) {
        flags = [...flags, ...flagData.map((f: Record<string, unknown>) => {
          const delayTypesRaw = f.delay_types as { name?: string } | Array<{ name?: string }> | null
          const delayType = Array.isArray(delayTypesRaw) ? delayTypesRaw[0] : delayTypesRaw
          return {
            case_id: f.case_id as string,
            flag_type: f.flag_type as string,
            severity: f.severity as string,
            delay_type_name: delayType?.name || null,
            created_by: f.created_by as string | null,
          }
        })]
      }
    }
  }

  const { data: settingsData } = await supabase
    .from('facility_analytics_settings')
    .select('*')
    .eq('facility_id', facilityId)
    .single()

  const settings: ScorecardSettings = {
    start_time_milestone: settingsData?.start_time_milestone || settingsData?.fcots_milestone || 'patient_in',
    start_time_grace_minutes: settingsData?.start_time_grace_minutes ?? settingsData?.fcots_grace_minutes ?? 3,
    start_time_floor_minutes: settingsData?.start_time_floor_minutes ?? 20,
    waiting_on_surgeon_minutes: settingsData?.waiting_on_surgeon_minutes ?? 3,
    waiting_on_surgeon_floor_minutes: settingsData?.waiting_on_surgeon_floor_minutes ?? 10,
    min_procedure_cases: settingsData?.min_procedure_cases ?? 3,
  }

  return {
    cases,
    financials: financials as ScorecardFinancials[],
    flags,
    settings,
  }
}

// ─── SVG RING ─────────────────────────────────────────────────

function ScoreRing({
  score,
  size = 100,
  ringWidth = 8,
}: {
  score: number
  size?: number
  ringWidth?: number
}) {
  const center = size / 2
  const radius = (size - ringWidth) / 2 - 2
  const circumference = 2 * Math.PI * radius
  const filled = (score / 100) * circumference
  const grade = getGrade(score)

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Track */}
      <circle
        cx={center} cy={center} r={radius}
        fill="none" stroke={grade.text} strokeOpacity={0.12}
        strokeWidth={ringWidth}
      />
      {/* Filled arc */}
      <circle
        cx={center} cy={center} r={radius}
        fill="none" stroke={grade.text}
        strokeWidth={ringWidth}
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circumference - filled}`}
        strokeDashoffset={circumference * 0.25}
        className="transition-all duration-700 ease-out"
      />
      {/* Score text */}
      <text
        x={center} y={center}
        textAnchor="middle" dominantBaseline="central"
        fill={grade.text}
        fontSize={size * 0.3}
        fontWeight="800"
        fontFamily="ui-monospace, SFMono-Regular, monospace"
      >
        {score}
      </text>
    </svg>
  )
}

// ─── TREND INDICATOR ──────────────────────────────────────────

function TrendIndicator({ trend, current, previous }: {
  trend: 'up' | 'down' | 'stable'
  current: number
  previous: number | null
}) {
  if (previous === null) return <span className="text-xs text-slate-400 font-medium">New</span>
  const delta = current - previous
  const isUp = trend === 'up'
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold font-mono ${isUp ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-slate-400'}`}>
      {isUp ? '▲' : trend === 'down' ? '▼' : '–'} {isUp ? '+' : ''}{delta}
    </span>
  )
}

// ─── PILLAR BAR ───────────────────────────────────────────────

function PillarBar({ pillar, value }: { pillar: typeof PILLARS[number]; value: number }) {
  const weighted = (value * pillar.weight).toFixed(1)
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: pillar.color }} />
          <span className="text-xs font-medium text-slate-500">{pillar.label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-400 font-mono">{weighted}</span>
          <span className="text-xs font-bold font-mono min-w-[22px] text-right" style={{ color: pillar.color }}>
            {value}
          </span>
        </div>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: `${pillar.color}15` }}>
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            background: `linear-gradient(90deg, ${pillar.color}88, ${pillar.color})`,
            width: `${value}%`,
          }}
        />
      </div>
    </div>
  )
}

// ─── SURGEON CARD ─────────────────────────────────────────────

function SurgeonCard({ scorecard, settings }: { scorecard: ORbitScorecard; settings: ScorecardSettings | null }) {
  const { composite, grade, pillars } = scorecard
  const [expanded, setExpanded] = useState(false)

  const plan = settings ? generateImprovementPlan(scorecard, settings) : null
  const hasRecommendations = plan && plan.recommendations.length > 0

  return (
    <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm hover:shadow-md transition-all duration-200">
      <div className="p-6">
        <div className="flex items-start gap-6">
          {/* Ring */}
          <div className="flex-shrink-0">
            <ScoreRing score={composite} size={110} ringWidth={9} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Name row */}
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="text-base font-semibold text-slate-900 truncate">
                {scorecard.surgeonName}
              </h3>
              <span
                className="text-xs font-bold tracking-wide px-1.5 py-0.5 rounded font-mono flex-shrink-0"
                style={{ color: grade.text, background: grade.bg }}
              >
                {grade.letter}
              </span>
            </div>

            {/* Meta row */}
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs text-slate-500">{scorecard.caseCount} cases</span>
              {scorecard.flipRoom && (
                <span className="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                  Flip Room
                </span>
              )}
              <TrendIndicator
                trend={scorecard.trend}
                current={composite}
                previous={scorecard.previousComposite}
              />
              <span className="text-xs text-slate-400">vs prior</span>
            </div>

            {/* 2×2 Pillar grid */}
            <div className="grid grid-cols-2 gap-x-5 gap-y-3">
              {PILLARS.map((p) => (
                <PillarBar key={p.key} pillar={p} value={pillars[p.key]} />
              ))}
            </div>

            {/* Procedure tags */}
            <div className="flex gap-1.5 flex-wrap mt-4 pt-3 border-t border-slate-100">
              {scorecard.procedureBreakdown.slice(0, 5).map(({ name, count }) => (
                <span
                  key={name}
                  className="text-xs text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200"
                >
                  {name} <span className="text-slate-400">×{count}</span>
                </span>
              ))}
              {scorecard.procedureBreakdown.length > 5 && (
                <span className="text-xs text-slate-400 px-2 py-0.5">
                  +{scorecard.procedureBreakdown.length - 5} more
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Improvement Plan Toggle */}
      {hasRecommendations && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full px-6 py-2.5 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-50/50 transition-colors"
        >
          <span className="flex items-center gap-2">
            <span className="text-amber-500">📋</span>
            Improvement Plan
            <span className="text-xs font-normal text-slate-400">
              {plan!.recommendations.length} {plan!.recommendations.length === 1 ? 'area' : 'areas'} · +{plan!.projectedComposite - plan!.currentComposite} pts potential
            </span>
          </span>
          <ChevronDown
            className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
        </button>
      )}

      {/* Expanded Improvement Plan */}
      {expanded && plan && (
        <div className="border-t border-slate-100 bg-slate-50/30">
          {/* Summary bar */}
          <div className="px-6 py-4 flex items-center gap-6 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="text-center">
                <div className="text-lg font-bold" style={{ color: plan.currentGrade.text }}>
                  {plan.currentComposite}
                </div>
                <div className="text-[9px] text-slate-400 uppercase tracking-wider">Current</div>
              </div>
              <ArrowRight className="w-5 h-5 text-slate-300" />
              <div className="text-center">
                <div className="text-lg font-bold" style={{ color: plan.projectedGrade.text }}>
                  {plan.projectedComposite}
                </div>
                <div className="text-[9px] text-slate-400 uppercase tracking-wider">Projected</div>
              </div>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div className="text-center">
              <div className="text-sm font-bold text-slate-700">{plan.totalProjectedHours} hrs</div>
              <div className="text-[9px] text-slate-400 uppercase tracking-wider">Annual Time Saved</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-bold text-green-600">${plan.totalProjectedDollars.toLocaleString()}</div>
              <div className="text-[9px] text-slate-400 uppercase tracking-wider">Annual Value</div>
            </div>
          </div>

          {/* Strengths */}
          {plan.strengths.length > 0 && (
            <div className="px-6 py-3 border-b border-slate-100">
              <div className="text-xs font-semibold text-green-600 uppercase tracking-wider mb-1.5">Strengths</div>
              <div className="flex flex-wrap gap-2">
                {plan.strengths.map((s) => (
                  <span key={s.pillarLabel} className="text-xs text-green-600 bg-green-50 border border-green-100 px-2.5 py-1 rounded-lg">
                    {s.pillarLabel} ({s.score}) — {s.message}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          <div className="px-6 py-4 space-y-4">
            {plan.recommendations.map((rec) => (
              <RecommendationCard key={rec.pillar} rec={rec} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function RecommendationCard({ rec }: { rec: ImprovementRecommendation }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-1.5 h-8 rounded-full"
            style={{ backgroundColor: rec.pillarColor }}
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">{rec.pillarLabel}</span>
              <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                {rec.currentScore} → {rec.targetScore}
              </span>
              <span className="text-xs text-slate-400">+{rec.compositeImpact} composite pts</span>
            </div>
            <div className="text-xs text-slate-600 mt-0.5">{rec.headline}</div>
          </div>
        </div>
        <div className="text-right flex-shrink-0 ml-4">
          <div className="text-xs font-bold text-green-600">{rec.projectedAnnualHours} hrs</div>
          <div className="text-xs text-slate-400">${rec.projectedAnnualDollars.toLocaleString()}/yr</div>
        </div>
      </div>

      {/* Insight */}
      <div className="px-4 pb-2">
        <p className="text-xs text-slate-500 leading-relaxed">{rec.insight}</p>
      </div>

      {/* Actions */}
      <div className="px-4 pb-3">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Actions</div>
        <div className="space-y-1">
          {rec.actions.map((action, i) => (
            <div key={i} className="flex gap-2 text-xs text-slate-600">
              <span className="text-slate-300 flex-shrink-0">{i + 1}.</span>
              <span>{action}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── FACILITY SUMMARY ─────────────────────────────────────────

function FacilitySummary({ scorecards }: { scorecards: ORbitScorecard[] }) {
  const composites = scorecards.map(s => s.composite)
  const avg = composites.length > 0
    ? Math.round(composites.reduce((a, b) => a + b, 0) / composites.length)
    : 0
  const dist = composites.reduce<Record<string, number>>((acc, s) => {
    acc[getGrade(s).letter] = (acc[getGrade(s).letter] || 0) + 1
    return acc
  }, {})
  const totalCases = scorecards.reduce((s, x) => s + x.caseCount, 0)

  return (
    <div className="grid grid-cols-4 gap-3 mb-6">
      {[
        { label: 'Facility Average', value: String(avg), color: getGrade(avg).text },
        { label: 'Surgeons', value: String(scorecards.length), color: chartHex.neutral },
        { label: 'Total Cases', value: String(totalCases), color: chartHex.neutral },
      ].map((stat, i) => (
        <div key={i} className="bg-white border border-slate-200/60 rounded-xl px-4 py-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-400 tracking-wider uppercase font-mono mb-1.5">
            {stat.label}
          </div>
          <div className="text-2xl font-extrabold font-mono" style={{ color: stat.color }}>
            {stat.value}
          </div>
        </div>
      ))}
      <div className="bg-white border border-slate-200/60 rounded-xl px-4 py-4 shadow-sm">
        <div className="text-xs font-semibold text-slate-400 tracking-wider uppercase font-mono mb-1.5">
          Distribution
        </div>
        <div className="flex gap-3.5">
          {['A', 'B', 'C', 'D'].map((g) => {
            const gr = getGrade(g === 'A' ? 80 : g === 'B' ? 65 : g === 'C' ? 50 : 40)
            return (
              <div key={g} className="text-center">
                <div className="text-lg font-extrabold font-mono leading-none" style={{ color: gr.text }}>
                  {dist[g] || 0}
                </div>
                <div className="text-xs font-semibold font-mono mt-0.5 opacity-60" style={{ color: gr.text }}>
                  {g}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── PILLAR LEGEND ────────────────────────────────────────────

function PillarLegend() {
  return (
    <div className="flex gap-4 flex-wrap py-3 mb-4 border-b border-slate-200">
      {PILLARS.map((p) => (
        <div key={p.key} className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
          <span className="text-xs text-slate-500">
            {p.label}
            <span className="text-slate-400 ml-1">{(p.weight * 100).toFixed(0)}%</span>
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────

export default function ORbitScorePage() {
  const supabase = createClient()
  const { effectiveFacilityId, loading: userLoading, can } = useUser()

  const [scorecards, setScorecards] = useState<ORbitScorecard[]>([])
  const [facilitySettings, setFacilitySettings] = useState<ScorecardSettings | null>(null)
  const [sortBy, setSortBy] = useState<string>('composite')
  const [dateFilter, setDateFilter] = useState('last_90')

  // Initialize dates from preset
  const initialDates = useMemo(() => getPresetDates('last_90'), [])
  const [currentStartDate, setCurrentStartDate] = useState(initialDates.start)
  const [currentEndDate, setCurrentEndDate] = useState(initialDates.end)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [insufficientSurgeons, setInsufficientSurgeons] = useState<{ name: string; count: number }[]>([])

  const handleFilterChange = (range: string, startDate: string, endDate: string) => {
    setDateFilter(range)
    setCurrentStartDate(startDate)
    setCurrentEndDate(endDate)
  }

  const loadORbitScores = useCallback(async () => {
    if (!effectiveFacilityId || !currentStartDate || !currentEndDate) return

    setLoading(true)
    setError(null)

    try {
      const data = await fetchScorecardData(supabase, effectiveFacilityId, currentStartDate, currentEndDate)
      if (!data) {
        setError('Failed to load ORbit Score data')
        setLoading(false)
        return
      }

      // Fetch facility timezone for accurate time-of-day comparisons
      const { data: facilityData } = await supabase
        .from('facilities')
        .select('timezone')
        .eq('id', effectiveFacilityId)
        .single()
      const facilityTimezone = facilityData?.timezone || 'America/New_York'

      // Compute previous period for trend
      const periodMs = new Date(currentEndDate).getTime() - new Date(currentStartDate).getTime()
      const periodDays = Math.ceil(periodMs / (1000 * 60 * 60 * 24))
      const prevEnd = new Date(currentStartDate)
      prevEnd.setDate(prevEnd.getDate() - 1)
      const prevStart = new Date(prevEnd)
      prevStart.setDate(prevStart.getDate() - periodDays)

      const prevData = await fetchScorecardData(
        supabase,
        effectiveFacilityId,
        prevStart.toISOString().split('T')[0],
        prevEnd.toISOString().split('T')[0],
      )

      const results = calculateORbitScores({
        ...data,
        dateRange: { start: currentStartDate, end: currentEndDate },
        timezone: facilityTimezone,
        previousPeriodCases: prevData?.cases || [],
        previousPeriodFinancials: prevData?.financials || [],
        previousPeriodFlags: prevData?.flags || [],
        enableDiagnostics: true,
      })

      setScorecards(results)
      setFacilitySettings(data.settings)

      // Track surgeons below threshold
      const allSurgeonCases: Record<string, { name: string; count: number }> = {}
      for (const c of data.cases) {
        if (!allSurgeonCases[c.surgeon_id]) {
          allSurgeonCases[c.surgeon_id] = { name: `Dr. ${c.surgeon_last_name}`, count: 0 }
        }
        allSurgeonCases[c.surgeon_id].count++
      }
      setInsufficientSurgeons(
        Object.values(allSurgeonCases).filter(s => s.count < MIN_CASE_THRESHOLD)
      )
    } catch {
      setError('Failed to calculate ORbit Scores')
    }

    setLoading(false)
  }, [effectiveFacilityId, currentStartDate, currentEndDate, supabase])

  useEffect(() => {
    if (!userLoading && effectiveFacilityId && currentStartDate && currentEndDate) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadORbitScores()
    } else if (!userLoading && !effectiveFacilityId) {
      setLoading(false)
    }
  }, [userLoading, effectiveFacilityId, currentStartDate, currentEndDate, loadORbitScores])

  const sorted = [...scorecards].sort((a, b) => {
    if (sortBy === 'composite') return b.composite - a.composite
    if (sortBy === 'name') return a.lastName.localeCompare(b.lastName)
    if (sortBy === 'cases') return b.caseCount - a.caseCount
    if (sortBy === 'trend') {
      const aDelta = a.previousComposite !== null ? a.composite - a.previousComposite : 0
      const bDelta = b.previousComposite !== null ? b.composite - b.previousComposite : 0
      return bDelta - aDelta
    }
    const pillar = PILLARS.find(p => p.key === sortBy)
    if (pillar) return (b.pillars[pillar.key] || 0) - (a.pillars[pillar.key] || 0)
    return 0
  })

  // ─── RENDER ───────────────────────────────────────────────

  if (!userLoading && !can('scores.view')) {
    return (
      <DashboardLayout>
        <AccessDenied />
      </DashboardLayout>
    )
  }

  if (userLoading) {
    return (
      <DashboardLayout>
        <PageLoader message="Loading ORbit Scores..." />
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
          {/* Page Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">ORbit Score</h1>
              <p className="text-slate-500 text-sm mt-1">
                Composite surgeon performance based on controllable operational metrics
              </p>
            </div>
            <DateRangeSelector value={dateFilter} onChange={handleFilterChange} />
          </div>

          <ErrorBanner message={error} onRetry={loadORbitScores} onDismiss={() => setError(null)} />

          {loading ? (
            <PageLoader message="Calculating ORbit Scores..." />
          ) : scorecards.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-slate-500 mb-2">
                No surgeons met the minimum threshold of {MIN_CASE_THRESHOLD} cases.
              </p>
              {insufficientSurgeons.length > 0 && (
                <div className="mt-4 text-sm text-slate-400">
                  <p className="mb-2">Surgeons with insufficient data:</p>
                  {insufficientSurgeons.map((s) => (
                    <p key={s.name}>{s.name}: {s.count} cases (need {MIN_CASE_THRESHOLD})</p>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              <PillarLegend />
              <FacilitySummary scorecards={scorecards} />

              {/* Insufficient data notice */}
              {insufficientSurgeons.length > 0 && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs text-amber-700">
                    <span className="font-semibold">Insufficient data:</span>{' '}
                    {insufficientSurgeons.map(s => `${s.name} (${s.count} cases)`).join(', ')}
                    {' '}— minimum {MIN_CASE_THRESHOLD} cases required for scoring
                  </p>
                </div>
              )}

              {/* Sort controls */}
              <div className="flex items-center gap-1.5 mb-4">
                <span className="text-xs text-slate-400 font-semibold tracking-wider uppercase font-mono mr-1">
                  Sort
                </span>
                {[
                  { key: 'composite', label: 'Score' },
                  { key: 'trend', label: 'Trend' },
                  { key: 'cases', label: 'Volume' },
                  { key: 'name', label: 'Name' },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setSortBy(opt.key)}
                    className={`text-xs font-semibold px-3 py-1 rounded-md transition-all ${
                      sortBy === opt.key
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Surgeon Cards — single column, full width */}
              <div className="flex flex-col gap-3">
                {sorted.map((sc) => (
                  <SurgeonCard key={sc.surgeonId} scorecard={sc} settings={facilitySettings} />
                ))}
              </div>
            </>
          )}

          {/* Methodology footer */}
          {scorecards.length > 0 && (
            <div className="mt-8 pt-4 border-t border-slate-200">
              <p className="text-xs text-slate-400 leading-relaxed">
                <span className="font-semibold text-slate-500">Methodology v2.2:</span> 4 pillars measuring
                surgeon-controllable behaviors. Profitability (30%) and Consistency (25%) use median-anchored
                MAD scoring within procedure-type cohorts, volume-weighted across case mix — with a 3 MAD
                scoring band and minimum MAD floors to prevent noise sensitivity.
                Schedule Adherence (25%) and Availability (20%) use direct graduated scoring — each case
                scored 0–1.0 via linear decay, averaged to produce the pillar score. No peer comparison needed.
                All pillar scores floored at 10, capped at 100. Grades: A≥80, B≥65, C≥50, D&lt;50.
                Minimum {MIN_CASE_THRESHOLD} cases required. Trend compares current period against the equivalent prior period.
              </p>
            </div>
          )}
    </DashboardLayout>
  )
}