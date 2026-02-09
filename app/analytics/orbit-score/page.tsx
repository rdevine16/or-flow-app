// app/analytics/orbit-score/page.tsx
'use client'

import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import DateRangeSelector, { getPresetDates } from '@/components/ui/DateRangeSelector'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import {
  calculateORbitScores,
  getGrade,
  PILLARS,
  MIN_CASE_THRESHOLD,
  type ORbitScorecard,
  type ScorecardCase,
  type ScorecardFinancials,
  type ScorecardBlock,
  type ScorecardFlag,
  type ScorecardSettings,
  type PillarScores,
} from '@/lib/orbitScoreEngine'

// ─── DATA FETCHING ────────────────────────────────────────────

async function fetchScorecardData(
  supabase: any,
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
    .gte('scheduled_date', startDate)
    .lte('scheduled_date', endDate)

  if (casesError) {
    console.error('Error fetching cases:', casesError)
    return null
  }

  const completedCases = (rawCases || []).filter(
    (c: any) => c.case_statuses?.name === 'completed'
  )

  const cases: ScorecardCase[] = completedCases.map((c: any) => {
    const milestones: Record<string, string | null> = {}
    for (const cm of (c.case_milestones || [])) {
      const name = cm.facility_milestones?.name
      if (name && cm.recorded_at) {
        milestones[name] = cm.recorded_at
      }
    }

    return {
      id: c.id,
      surgeon_id: c.surgeon_id,
      surgeon_first_name: c.users?.first_name || '',
      surgeon_last_name: c.users?.last_name || '',
      procedure_type_id: c.procedure_type_id,
      procedure_name: c.procedure_types?.name || 'Unknown',
      or_room_id: c.or_room_id,
      scheduled_date: c.scheduled_date,
      start_time: c.start_time,
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
      const { data: finData } = await supabase
        .from('case_completion_stats')
        .select('case_id, profit, reimbursement, or_time_cost, total_case_minutes')
        .in('case_id', chunk)
      if (finData) financials = [...financials, ...finData]
    }
  }

  const { data: blocks } = await supabase
    .from('block_schedules')
    .select('id, surgeon_id, day_of_week, start_time, end_time, recurrence_type, effective_start, effective_end, or_room_id')
    .eq('facility_id', facilityId)
    .is('deleted_at', null)

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
        flags = [...flags, ...flagData.map((f: any) => ({
          case_id: f.case_id,
          flag_type: f.flag_type,
          severity: f.severity,
          delay_type_name: f.delay_types?.name || null,
          created_by: f.created_by,
        }))]
      }
    }
  }

  const { data: settingsData } = await supabase
    .from('facility_analytics_settings')
    .select('*')
    .eq('facility_id', facilityId)
    .single()

  const settings: ScorecardSettings = {
    fcots_milestone: settingsData?.fcots_milestone || 'patient_in',
    fcots_grace_minutes: settingsData?.fcots_grace_minutes ?? 2,
    fcots_target_percent: settingsData?.fcots_target_percent ?? 85,
    turnover_target_same_surgeon: settingsData?.turnover_target_same_surgeon ?? 30,
    turnover_target_flip_room: settingsData?.turnover_target_flip_room ?? 45,
  }

  return {
    cases,
    financials: financials as ScorecardFinancials[],
    blocks: (blocks || []) as ScorecardBlock[],
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
  if (previous === null) return <span className="text-[11px] text-slate-400 font-medium">New</span>
  const delta = current - previous
  const isUp = trend === 'up'
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold font-mono ${isUp ? 'text-emerald-600' : trend === 'down' ? 'text-red-600' : 'text-slate-400'}`}>
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
          <span className="text-[11px] font-medium text-slate-500">{pillar.label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-400 font-mono">{weighted}</span>
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

function SurgeonCard({ scorecard }: { scorecard: ORbitScorecard }) {
  const { composite, grade, pillars } = scorecard

  return (
    <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm hover:shadow-md transition-all duration-200 p-6">
      <div className="flex items-start gap-6">
        {/* Ring */}
        <div className="flex-shrink-0">
          <ScoreRing score={composite} size={110} ringWidth={9} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Name row */}
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="text-base font-bold text-slate-900 truncate">
              {scorecard.surgeonName}
            </h3>
            <span
              className="text-[10px] font-bold tracking-wide px-1.5 py-0.5 rounded font-mono flex-shrink-0"
              style={{ color: grade.text, background: grade.bg }}
            >
              {grade.letter}
            </span>
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs text-slate-500">{scorecard.caseCount} cases</span>
            {scorecard.flipRoom && (
              <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                Flip Room
              </span>
            )}
            <TrendIndicator
              trend={scorecard.trend}
              current={composite}
              previous={scorecard.previousComposite}
            />
            <span className="text-[10px] text-slate-400">vs prior</span>
          </div>

          {/* 3×2 Pillar grid */}
          <div className="grid grid-cols-3 gap-x-5 gap-y-3">
            {PILLARS.map((p) => (
              <PillarBar key={p.key} pillar={p} value={pillars[p.key]} />
            ))}
          </div>

          {/* Procedure tags */}
          <div className="flex gap-1.5 flex-wrap mt-4 pt-3 border-t border-slate-100">
            {scorecard.procedureBreakdown.slice(0, 5).map(({ name, count }) => (
              <span
                key={name}
                className="text-[10px] text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200"
              >
                {name} <span className="text-slate-400">×{count}</span>
              </span>
            ))}
            {scorecard.procedureBreakdown.length > 5 && (
              <span className="text-[10px] text-slate-400 px-2 py-0.5">
                +{scorecard.procedureBreakdown.length - 5} more
              </span>
            )}
          </div>
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
        { label: 'Surgeons', value: String(scorecards.length), color: '#0F172A' },
        { label: 'Total Cases', value: String(totalCases), color: '#0F172A' },
      ].map((stat, i) => (
        <div key={i} className="bg-white border border-slate-200/60 rounded-xl px-5 py-4 shadow-sm">
          <div className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase font-mono mb-1.5">
            {stat.label}
          </div>
          <div className="text-2xl font-extrabold font-mono" style={{ color: stat.color }}>
            {stat.value}
          </div>
        </div>
      ))}
      <div className="bg-white border border-slate-200/60 rounded-xl px-5 py-4 shadow-sm">
        <div className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase font-mono mb-1.5">
          Distribution
        </div>
        <div className="flex gap-3.5">
          {['A', 'B', 'C', 'D'].map((g) => {
            const gr = getGrade(g === 'A' ? 95 : g === 'B' ? 85 : g === 'C' ? 75 : 55)
            return (
              <div key={g} className="text-center">
                <div className="text-lg font-extrabold font-mono leading-none" style={{ color: gr.text }}>
                  {dist[g] || 0}
                </div>
                <div className="text-[10px] font-semibold font-mono mt-0.5 opacity-60" style={{ color: gr.text }}>
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
    <div className="flex gap-4 flex-wrap py-3 mb-5 border-b border-slate-200">
      {PILLARS.map((p) => (
        <div key={p.key} className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
          <span className="text-[11px] text-slate-500">
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
  const { effectiveFacilityId, loading: userLoading } = useUser()

  const [scorecards, setScorecards] = useState<ORbitScorecard[]>([])
  const [sortBy, setSortBy] = useState<string>('composite')
  const [dateFilter, setDateFilter] = useState('last_90')
  const [currentStartDate, setCurrentStartDate] = useState('')
  const [currentEndDate, setCurrentEndDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [insufficientSurgeons, setInsufficientSurgeons] = useState<{ name: string; count: number }[]>([])

  // Initialize dates
  useEffect(() => {
    const { start, end } = getPresetDates('last_90')
    setCurrentStartDate(start)
    setCurrentEndDate(end)
  }, [])

  const handleFilterChange = (range: string, startDate: string, endDate: string) => {
    setDateFilter(range)
    setCurrentStartDate(startDate)
    setCurrentEndDate(endDate)
  }

  const loadORbitScores = async () => {
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
        previousPeriodBlocks: prevData?.blocks || [],
        previousPeriodFlags: prevData?.flags || [],
      })

      setScorecards(results)

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
    } catch (err) {
      console.error('ORbit Score calculation error:', err)
      setError('Error calculating ORbit Scores')
    }

    setLoading(false)
  }

  useEffect(() => {
    if (!userLoading && effectiveFacilityId && currentStartDate && currentEndDate) {
      loadORbitScores()
    } else if (!userLoading && !effectiveFacilityId) {
      setLoading(false)
    }
  }, [userLoading, effectiveFacilityId, currentStartDate, currentEndDate])

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

  if (userLoading) {
    return (
      <DashboardLayout>
        <Container>
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        </Container>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-slate-50/50">
        <Container className="py-8">
          {/* Page Header — matches analytics page pattern */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">ORbit Score</h1>
              <p className="text-slate-500 mt-1">
                Composite surgeon performance based on controllable operational metrics
              </p>
            </div>
            <DateRangeSelector value={dateFilter} onChange={handleFilterChange} />
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-32">
              <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-sm text-slate-500">Calculating ORbit Scores...</p>
            </div>
          ) : error ? (
            <div className="text-center py-20">
              <p className="text-red-500 mb-2">{error}</p>
              <button onClick={loadORbitScores} className="text-sm text-blue-600 hover:text-blue-700">
                Retry
              </button>
            </div>
          ) : scorecards.length === 0 ? (
            <div className="text-center py-20">
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
                <span className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase font-mono mr-1">
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
                    className={`text-[11px] font-semibold px-3 py-1 rounded-md transition-all ${
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
                  <SurgeonCard key={sc.surgeonId} scorecard={sc} />
                ))}
              </div>
            </>
          )}

          {/* Methodology footer */}
          {scorecards.length > 0 && (
            <div className="mt-10 pt-5 border-t border-slate-200">
              <p className="text-[11px] text-slate-400 leading-relaxed">
                <span className="font-semibold text-slate-500">Methodology:</span> Each pillar is
                percentile-ranked within procedure-type cohort, volume-weighted across case mix,
                and clamped 0–100 (floor at 20th percentile, ceiling at 95th). Minimum {MIN_CASE_THRESHOLD} cases
                required. Solo procedure types use self-consistency benchmarking (CV-based).
                Trend compares current period against the equivalent prior period.
              </p>
            </div>
          )}
        </Container>
      </div>
    </DashboardLayout>
  )
}