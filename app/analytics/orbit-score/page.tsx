// app/analytics/orbit-score/page.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import {
  calculateORbitScores,
  computeComposite,
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
  type GradeInfo,
  type PillarDefinition,
} from '@/lib/orbitScoreEngine'

// ─── DATA FETCHING ────────────────────────────────────────────

async function fetchScorecardData(
  supabase: any,
  facilityId: string,
  startDate: string,
  endDate: string,
) {
  // 1. Fetch completed cases with milestones
  //    We need to join through facility_milestones to get milestone names
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

  // Filter to completed cases only
  const completedCases = (rawCases || []).filter(
    (c: any) => c.case_statuses?.name === 'completed'
  )

  // Transform into ScorecardCase format
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

  // 2. Fetch financials from case_completion_stats
  const caseIds = cases.map(c => c.id)
  let financials: ScorecardFinancials[] = []

  if (caseIds.length > 0) {
    // Batch fetch in chunks of 100 to avoid query limits
    for (let i = 0; i < caseIds.length; i += 100) {
      const chunk = caseIds.slice(i, i + 100)
      const { data: finData } = await supabase
        .from('case_completion_stats')
        .select('case_id, profit, reimbursement, or_time_cost, total_case_minutes')
        .in('case_id', chunk)

      if (finData) financials = [...financials, ...finData]
    }
  }

  // 3. Fetch block schedules
  const { data: blocks } = await supabase
    .from('block_schedules')
    .select('id, surgeon_id, day_of_week, start_time, end_time, recurrence_type, effective_start, effective_end, or_room_id')
    .eq('facility_id', facilityId)
    .is('deleted_at', null)

  // 4. Fetch case flags (delays)
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

  // 5. Fetch facility analytics settings
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

// ─── DATE RANGE HELPERS ───────────────────────────────────────

type DateRangeOption = '30d' | '90d' | '180d' | '1y'

function getDateRange(option: DateRangeOption): { start: string; end: string } {
  const end = new Date()
  const start = new Date()

  switch (option) {
    case '30d': start.setDate(start.getDate() - 30); break
    case '90d': start.setDate(start.getDate() - 90); break
    case '180d': start.setDate(start.getDate() - 180); break
    case '1y': start.setFullYear(start.getFullYear() - 1); break
  }

  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  }
}

function getPreviousDateRange(option: DateRangeOption): { start: string; end: string } {
  const currentRange = getDateRange(option)
  const rangeMs = new Date(currentRange.end).getTime() - new Date(currentRange.start).getTime()
  const prevEnd = new Date(new Date(currentRange.start).getTime() - 86400000) // day before current start
  const prevStart = new Date(prevEnd.getTime() - rangeMs)

  return {
    start: prevStart.toISOString().split('T')[0],
    end: prevEnd.toISOString().split('T')[0],
  }
}

// ─── SVG SEGMENTED RING ──────────────────────────────────────

function SegmentedRing({
  pillars,
  size = 180,
  ringWidth = 14,
  animated = true,
}: {
  pillars: PillarScores
  size?: number
  ringWidth?: number
  animated?: boolean
}) {
  const [progress, setProgress] = useState(animated ? 0 : 1)
  const center = size / 2
  const radius = (size - ringWidth) / 2 - 2
  const gapAngle = 5
  const segmentAngle = (360 - gapAngle * PILLARS.length) / PILLARS.length

  useEffect(() => {
    if (!animated) return
    let frame: number
    let start: number | null = null
    const animate = (ts: number) => {
      if (!start) start = ts
      const t = Math.min((ts - start) / 1000, 1)
      setProgress(1 - Math.pow(1 - t, 3))
      if (t < 1) frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [animated])

  function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
    const rad = ((angleDeg - 90) * Math.PI) / 180
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
  }

  function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
    if (endAngle - startAngle < 0.1) return ''
    const s = polarToCartesian(cx, cy, r, endAngle)
    const e = polarToCartesian(cx, cy, r, startAngle)
    const large = endAngle - startAngle > 180 ? 1 : 0
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 0 ${e.x} ${e.y}`
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {PILLARS.map((pillar, i) => {
        const startA = i * (segmentAngle + gapAngle)
        const fullEnd = startA + segmentAngle
        const value = (pillars[pillar.key] || 0) / 100
        const filledEnd = startA + segmentAngle * value * progress
        return (
          <g key={pillar.key}>
            <path
              d={describeArc(center, center, radius, startA, fullEnd)}
              fill="none" stroke={pillar.color} strokeOpacity={0.12}
              strokeWidth={ringWidth} strokeLinecap="round"
            />
            {value * progress > 0.01 && (
              <path
                d={describeArc(center, center, radius, startA, filledEnd)}
                fill="none" stroke={pillar.color}
                strokeWidth={ringWidth} strokeLinecap="round"
              />
            )}
          </g>
        )
      })}
    </svg>
  )
}

// ─── TREND INDICATOR ──────────────────────────────────────────

function TrendIndicator({ trend, current, previous }: {
  trend: 'up' | 'down' | 'stable'
  current: number
  previous: number | null
}) {
  if (previous === null) return <span className="text-xs text-slate-500">New</span>
  const delta = current - previous
  const isUp = trend === 'up'
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold font-mono ${isUp ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-slate-500'}`}>
      {isUp ? '▲' : trend === 'down' ? '▼' : '–'} {isUp ? '+' : ''}{delta}
    </span>
  )
}

// ─── SURGEON CARD ─────────────────────────────────────────────

function SurgeonCard({
  scorecard,
  isSelected,
  onSelect,
}: {
  scorecard: ORbitScorecard
  isSelected: boolean
  onSelect: () => void
}) {
  const { composite, grade, pillars } = scorecard

  return (
    <div
      onClick={onSelect}
      className={`rounded-2xl p-6 cursor-pointer transition-all duration-200 ${
        isSelected
          ? 'bg-gradient-to-br from-slate-800/80 to-slate-800/40 border'
          : 'bg-slate-900/60 border border-slate-800/60 hover:border-slate-700/60'
      }`}
      style={{ borderColor: isSelected ? `${grade.text}33` : undefined }}
    >
      <div className="flex items-center gap-5">
        {/* Ring */}
        <div className="relative flex-shrink-0">
          <SegmentedRing pillars={pillars} size={140} ringWidth={12} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
            <div
              className="text-4xl font-extrabold font-mono leading-none"
              style={{ color: grade.text, letterSpacing: -2 }}
            >
              {composite}
            </div>
            <div
              className="text-[9px] font-bold tracking-widest uppercase mt-1 opacity-60 font-mono"
              style={{ color: grade.text }}
            >
              {grade.label}
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-base font-bold text-slate-200 truncate">
              {scorecard.surgeonName}
            </h3>
            <span
              className="text-[10px] font-bold tracking-wide px-1.5 py-0.5 rounded font-mono flex-shrink-0"
              style={{ color: grade.text, background: grade.bg }}
            >
              {grade.letter}
            </span>
          </div>

          <div className="text-xs text-slate-400 mb-2.5">
            {scorecard.caseCount} cases
            {scorecard.flipRoom && (
              <span className="ml-2 text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                Flip
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5 mb-3">
            <TrendIndicator
              trend={scorecard.trend}
              current={composite}
              previous={scorecard.previousComposite}
            />
            <span className="text-[11px] text-slate-600">vs prior period</span>
          </div>

          {/* Pillar grid */}
          <div className="grid grid-cols-3 gap-x-3 gap-y-1">
            {PILLARS.map((p) => (
              <div key={p.key} className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: p.color }}
                  />
                  <span className="text-[10px] text-slate-500">{p.label}</span>
                </div>
                <span
                  className="text-[11px] font-bold font-mono"
                  style={{ color: p.color }}
                >
                  {pillars[p.key]}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── DETAIL PANEL ─────────────────────────────────────────────

function DetailPanel({ scorecard }: { scorecard: ORbitScorecard }) {
  const { composite, grade, pillars } = scorecard

  return (
    <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-8">
      {/* Header with large ring */}
      <div className="flex flex-col items-center mb-8 pb-7 border-b border-slate-800/60">
        <div className="relative mb-4">
          <SegmentedRing pillars={pillars} size={200} ringWidth={16} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
            <div
              className="text-5xl font-extrabold font-mono leading-none"
              style={{ color: grade.text, letterSpacing: -3 }}
            >
              {composite}
            </div>
            <div
              className="text-[11px] font-bold tracking-widest uppercase mt-1 opacity-60 font-mono"
              style={{ color: grade.text }}
            >
              {grade.label}
            </div>
          </div>
        </div>
        <h2 className="text-xl font-bold text-slate-200">{scorecard.surgeonName}</h2>
        <p className="text-sm text-slate-500 mt-1">
          {scorecard.caseCount} cases · {scorecard.procedures.length} procedure types
        </p>
      </div>

      {/* Pillar breakdown */}
      <div className="space-y-5">
        {PILLARS.map((pillar) => {
          const value = pillars[pillar.key]
          const weighted = (value * pillar.weight).toFixed(1)
          return (
            <div key={pillar.key}>
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ background: pillar.color }}
                  />
                  <span className="text-sm font-semibold text-slate-300">
                    {pillar.label}
                  </span>
                  <span className="text-[11px] text-slate-600">
                    {pillar.description}
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-[10px] text-slate-600 font-mono">
                    {weighted} pts
                  </span>
                  <span
                    className="text-lg font-extrabold font-mono"
                    style={{ color: pillar.color }}
                  >
                    {value}
                  </span>
                </div>
              </div>
              <div
                className="h-1.5 rounded-full overflow-hidden"
                style={{ background: `${pillar.color}12` }}
              >
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    background: `linear-gradient(90deg, ${pillar.color}99, ${pillar.color})`,
                    width: `${value}%`,
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* Composite bar */}
      <div className="mt-7 pt-5 border-t border-slate-800/60">
        <div className="text-[10px] font-semibold text-slate-600 tracking-wider uppercase mb-3 font-mono">
          Composite Breakdown
        </div>
        <div className="flex h-6 rounded-md overflow-hidden gap-0.5">
          {PILLARS.map((pillar) => {
            const contribution = pillars[pillar.key] * pillar.weight
            return (
              <div
                key={pillar.key}
                title={`${pillar.label}: ${contribution.toFixed(1)} pts`}
                className="flex items-center justify-center text-[8px] font-bold font-mono"
                style={{
                  width: `${contribution}%`,
                  background: pillar.color,
                  color: '#0B0F19',
                }}
              >
                {contribution >= 8 ? Math.round(contribution) : ''}
              </div>
            )
          })}
        </div>
        <div className="flex justify-end mt-1.5">
          <span className="text-[11px] text-slate-500 font-mono">
            {composite} / 100
          </span>
        </div>
      </div>

      {/* Procedures */}
      <div className="mt-5 pt-5 border-t border-slate-800/60">
        <div className="text-[10px] font-semibold text-slate-600 tracking-wider uppercase mb-2.5 font-mono">
          Procedure Mix
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {scorecard.procedureBreakdown.map(({ name, count }) => (
            <span
              key={name}
              className="text-[11px] text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700/50"
            >
              {name}
              <span className="text-slate-600 ml-1.5">×{count}</span>
            </span>
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
    <div className="flex gap-3 mb-7">
      {[
        { label: 'Facility Average', value: String(avg), color: getGrade(avg).text },
        { label: 'Surgeons', value: String(scorecards.length), color: '#E2E8F0' },
        { label: 'Total Cases', value: String(totalCases), color: '#E2E8F0' },
      ].map((stat, i) => (
        <div key={i} className="bg-slate-900/60 border border-slate-800/60 rounded-xl px-5 py-4 flex-1">
          <div className="text-[10px] font-semibold text-slate-600 tracking-wider uppercase font-mono mb-1.5">
            {stat.label}
          </div>
          <div
            className="text-3xl font-extrabold font-mono"
            style={{ color: stat.color }}
          >
            {stat.value}
          </div>
        </div>
      ))}
      <div className="bg-slate-900/60 border border-slate-800/60 rounded-xl px-5 py-4 flex-1">
        <div className="text-[10px] font-semibold text-slate-600 tracking-wider uppercase font-mono mb-1.5">
          Distribution
        </div>
        <div className="flex gap-3.5">
          {['A', 'B', 'C', 'D'].map((g) => {
            const gr = getGrade(g === 'A' ? 95 : g === 'B' ? 85 : g === 'C' ? 75 : 55)
            return (
              <div key={g} className="text-center">
                <div className="text-xl font-extrabold font-mono leading-none" style={{ color: gr.text }}>
                  {dist[g] || 0}
                </div>
                <div className="text-[10px] font-semibold font-mono mt-0.5 opacity-50" style={{ color: gr.text }}>
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

// ─── RING LEGEND ──────────────────────────────────────────────

function RingLegend() {
  return (
    <div className="flex gap-4 flex-wrap py-3.5 mb-5 border-b border-slate-800/60">
      {PILLARS.map((p) => (
        <div key={p.key} className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
          <span className="text-[11px] text-slate-400">
            {p.label}
            <span className="text-slate-600 ml-1">{(p.weight * 100).toFixed(0)}%</span>
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
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<string>('composite')
  const [dateRange, setDateRange] = useState<DateRangeOption>('90d')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [insufficientSurgeons, setInsufficientSurgeons] = useState<{ name: string; count: number }[]>([])

  const loadORbitScores = async () => {
    if (!effectiveFacilityId) return

    setLoading(true)
    setError(null)

    try {
      const range = getDateRange(dateRange)
      const prevRange = getPreviousDateRange(dateRange)

      // Fetch current period data
      const data = await fetchScorecardData(supabase, effectiveFacilityId, range.start, range.end)
      if (!data) {
        setError('Failed to load ORbit Score data')
        setLoading(false)
        return
      }

      // Fetch previous period for trend comparison
      const prevData = await fetchScorecardData(supabase, effectiveFacilityId, prevRange.start, prevRange.end)

      // Calculate scorecards
      const results = calculateORbitScores({
        ...data,
        dateRange: range,
        previousPeriodCases: prevData?.cases || [],
        previousPeriodFinancials: prevData?.financials || [],
        previousPeriodBlocks: prevData?.blocks || [],
        previousPeriodFlags: prevData?.flags || [],
      })

      setScorecards(results)
      if (results.length > 0 && !selectedId) {
        setSelectedId(results[0].surgeonId)
      }

      // Track surgeons below threshold
      const allSurgeonCases: Record<string, { name: string; count: number }> = {}
      for (const c of data.cases) {
        if (!allSurgeonCases[c.surgeon_id]) {
          allSurgeonCases[c.surgeon_id] = {
            name: `Dr. ${c.surgeon_last_name}`,
            count: 0,
          }
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
    if (!userLoading && effectiveFacilityId) {
      loadORbitScores()
    } else if (!userLoading && !effectiveFacilityId) {
      setLoading(false)
    }
  }, [userLoading, effectiveFacilityId, dateRange])

  const selectedScorecard = scorecards.find(s => s.surgeonId === selectedId) || null

  const sorted = [...scorecards].sort((a, b) => {
    if (sortBy === 'composite') return b.composite - a.composite
    if (sortBy === 'name') return a.lastName.localeCompare(b.lastName)
    if (sortBy === 'cases') return b.caseCount - a.caseCount
    if (sortBy === 'trend') {
      const aDelta = a.previousComposite !== null ? a.composite - a.previousComposite : 0
      const bDelta = b.previousComposite !== null ? b.composite - b.previousComposite : 0
      return bDelta - aDelta
    }
    // Sort by pillar
    const pillar = PILLARS.find(p => p.key === sortBy)
    if (pillar) {
      return (b.pillars[pillar.key] || 0) - (a.pillars[pillar.key] || 0)
    }
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
      <Container>
        <div className="py-8">
          {/* Header */}
          <div className="flex justify-between items-end mb-2.5">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                ORbit Score
              </h1>
              <p className="text-sm text-slate-500 mt-1 max-w-xl">
                Composite scores based on controllable operational metrics.
                Percentile-ranked within procedure cohort, volume-weighted across case mix.
              </p>
            </div>

            {/* Date range selector */}
            <div className="flex items-center gap-1.5">
              {([
                { key: '30d', label: '30 Days' },
                { key: '90d', label: '90 Days' },
                { key: '180d', label: '6 Months' },
                { key: '1y', label: '1 Year' },
              ] as { key: DateRangeOption; label: string }[]).map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setDateRange(opt.key)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                    dateRange === opt.key
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-32">
              <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-sm text-slate-500">Calculating ORbit Scores...</p>
            </div>
          ) : error ? (
            <div className="text-center py-20">
              <p className="text-red-500 mb-2">{error}</p>
              <button
                onClick={loadORbitScores}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
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
                    <p key={s.name}>
                      {s.name}: {s.count} cases (need {MIN_CASE_THRESHOLD})
                    </p>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              <RingLegend />
              <FacilitySummary scorecards={scorecards} />

              {/* Insufficient data notice */}
              {insufficientSurgeons.length > 0 && (
                <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-lg">
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    <span className="font-semibold">Insufficient data:</span>{' '}
                    {insufficientSurgeons.map(s => `${s.name} (${s.count} cases)`).join(', ')}
                    {' '}— minimum {MIN_CASE_THRESHOLD} cases required for scoring
                  </p>
                </div>
              )}

              {/* Sort controls */}
              <div className="flex items-center gap-1.5 mb-4">
                <span className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase font-mono mr-1">
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
                        ? 'bg-slate-800 text-slate-200 border border-slate-700'
                        : 'text-slate-500 border border-transparent hover:text-slate-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Main layout */}
              <div className="grid grid-cols-[1fr_380px] gap-6 items-start">
                <div className="flex flex-col gap-3.5">
                  {sorted.map((sc) => (
                    <SurgeonCard
                      key={sc.surgeonId}
                      scorecard={sc}
                      isSelected={selectedId === sc.surgeonId}
                      onSelect={() => setSelectedId(sc.surgeonId)}
                    />
                  ))}
                </div>
                <div className="sticky top-6">
                  {selectedScorecard && <DetailPanel scorecard={selectedScorecard} />}
                </div>
              </div>
            </>
          )}

          {/* Methodology footer */}
          {scorecards.length > 0 && (
            <div className="mt-10 pt-5 border-t border-slate-200 dark:border-slate-800">
              <p className="text-[11px] text-slate-400 leading-relaxed">
                <span className="font-semibold text-slate-500">Methodology:</span> Each pillar is
                percentile-ranked within procedure-type cohort, volume-weighted across case mix,
                and clamped 0–100 (floor at 20th percentile, ceiling at 95th). Minimum {MIN_CASE_THRESHOLD} cases
                required. Solo procedure types use self-consistency benchmarking (CV-based).
                Trend compares current period against the equivalent prior period.
              </p>
            </div>
          )}
        </div>
      </Container>
    </DashboardLayout>
  )
}