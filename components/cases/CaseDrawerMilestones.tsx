// components/cases/CaseDrawerMilestones.tsx
// Milestones tab content for the Case Drawer.
// Shows ordered milestone timeline with timestamps, intervals between
// consecutive milestones, and a summary row comparing actual vs surgeon/facility medians.
// Color coding: green (faster), amber (within 10%), red (>10% over median).

'use client'

import { useMemo } from 'react'
import type { CaseMilestone } from '@/lib/dal/cases'
import type { SurgeonProcedureStats, FacilityProcedureStats } from '@/lib/hooks/useCaseDrawer'
import {
  CheckCircle2,
  Circle,
  Clock,
  Timer,
  ArrowDown,
  Loader2,
  User,
  Building2,
} from 'lucide-react'

// ============================================
// TYPES
// ============================================

interface CaseDrawerMilestonesProps {
  milestones: CaseMilestone[]
  surgeonStats: SurgeonProcedureStats | null
  facilityStats: FacilityProcedureStats | null
  comparisonLoading: boolean
  surgeonName: string | null
}

interface MilestoneRow {
  id: string
  name: string
  displayOrder: number
  recordedAt: string | null
  /** Minutes since previous recorded milestone (null for first or pending milestones) */
  intervalMinutes: number | null
}

/** Color coding for comparison badges */
type ComparisonColor = 'green' | 'amber' | 'red' | 'neutral'

// ============================================
// HELPERS
// ============================================

function formatTimestamp(isoString: string | null): string {
  if (!isoString) return 'Pending'
  const date = new Date(isoString)
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function formatMinutes(minutes: number | null): string {
  if (minutes == null) return '—'
  const hrs = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)
  if (hrs === 0) return `${mins}m`
  return `${hrs}h ${mins}m`
}

/**
 * Compare actual vs median and return color coding.
 * green = faster than median, amber = within 10%, red = >10% over
 */
function getComparisonColor(actual: number | null, median: number | null): ComparisonColor {
  if (actual == null || median == null || median <= 0) return 'neutral'
  const ratio = actual / median
  if (ratio <= 1.0) return 'green'
  if (ratio <= 1.1) return 'amber'
  return 'red'
}

function getComparisonDelta(actual: number | null, median: number | null): string {
  if (actual == null || median == null || median <= 0) return '—'
  const diff = actual - median
  const sign = diff <= 0 ? '' : '+'
  return `${sign}${formatMinutes(diff)}`
}

const COMPARISON_STYLES: Record<ComparisonColor, string> = {
  green: 'bg-green-50 text-green-700 border-green-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  red: 'bg-red-50 text-red-700 border-red-200',
  neutral: 'bg-slate-50 text-slate-500 border-slate-200',
}

/**
 * Build processed milestone rows from raw data.
 * Sorts by display_order, computes intervals between consecutive recorded milestones.
 */
function buildMilestoneRows(milestones: CaseMilestone[]): MilestoneRow[] {
  const sorted = [...milestones].sort((a, b) => {
    const orderA = a.facility_milestone?.display_order ?? 0
    const orderB = b.facility_milestone?.display_order ?? 0
    return orderA - orderB
  })

  let prevRecordedAt: Date | null = null

  return sorted.map((m) => {
    const name = m.facility_milestone?.display_name || m.facility_milestone?.name || 'Unknown Milestone'
    const recordedAt = m.recorded_at || null
    let intervalMinutes: number | null = null

    if (recordedAt && prevRecordedAt) {
      const diff = new Date(recordedAt).getTime() - prevRecordedAt.getTime()
      intervalMinutes = diff > 0 ? diff / 60000 : null
    }

    if (recordedAt) {
      prevRecordedAt = new Date(recordedAt)
    }

    return {
      id: m.id,
      name,
      displayOrder: m.facility_milestone?.display_order ?? 0,
      recordedAt,
      intervalMinutes,
    }
  })
}

/**
 * Compute key phase durations from milestone data.
 */
function computePhaseDurations(milestones: CaseMilestone[]): {
  totalCaseTime: number | null
  surgicalTime: number | null
  preOpTime: number | null
} {
  const recorded = milestones
    .filter((m) => m.recorded_at)
    .map((m) => ({ name: (m.facility_milestone?.name ?? '').toLowerCase(), time: new Date(m.recorded_at).getTime() }))

  if (recorded.length < 2) {
    return { totalCaseTime: null, surgicalTime: null, preOpTime: null }
  }

  // Total case time: first recorded → last recorded
  const times = recorded.map((r) => r.time)
  const totalCaseTime = (Math.max(...times) - Math.min(...times)) / 60000

  // Surgical time: incision → closing
  const incision = recorded.find((r) => r.name.includes('incision'))
  const closing = recorded.find((r) => r.name.includes('closing'))
  const surgicalTime =
    incision && closing && closing.time > incision.time
      ? (closing.time - incision.time) / 60000
      : null

  // Pre-op time: first milestone → incision (or patient in → incision)
  const patientIn = recorded.find((r) => r.name.includes('patient in') || r.name.includes('patient_in'))
  const preOpStart = patientIn || (recorded.length > 0 ? recorded[0] : null)
  const preOpTime =
    preOpStart && incision && incision.time > preOpStart.time
      ? (incision.time - preOpStart.time) / 60000
      : null

  return { totalCaseTime, surgicalTime, preOpTime }
}

// ============================================
// SUB-COMPONENTS
// ============================================

function ComparisonBadge({
  label,
  icon: Icon,
  actual,
  median,
}: {
  label: string
  icon: typeof User
  actual: number | null
  median: number | null
}) {
  const color = getComparisonColor(actual, median)
  const delta = getComparisonDelta(actual, median)

  if (median == null || median <= 0) {
    return (
      <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] ${COMPARISON_STYLES.neutral}`}>
        <Icon className="w-3 h-3" />
        <span>{label}: No data</span>
      </div>
    )
  }

  return (
    <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] font-medium ${COMPARISON_STYLES[color]}`}>
      <Icon className="w-3 h-3" />
      <span>{label}: {delta}</span>
    </div>
  )
}

function SummaryRow({
  label,
  actual,
  surgeonMedian,
  facilityMedian,
  surgeonName,
}: {
  label: string
  actual: number | null
  surgeonMedian: number | null
  facilityMedian: number | null
  surgeonName: string | null
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <span className="text-sm text-slate-900 ml-2 font-semibold">{formatMinutes(actual)}</span>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <ComparisonBadge
          label={surgeonName ? `Dr. ${surgeonName.split(' ').pop()}` : 'Surgeon'}
          icon={User}
          actual={actual}
          median={surgeonMedian}
        />
        <ComparisonBadge
          label="Facility"
          icon={Building2}
          actual={actual}
          median={facilityMedian}
        />
      </div>
    </div>
  )
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function CaseDrawerMilestones({
  milestones,
  surgeonStats,
  facilityStats,
  comparisonLoading,
  surgeonName,
}: CaseDrawerMilestonesProps) {
  const rows = useMemo(() => buildMilestoneRows(milestones), [milestones])
  const phases = useMemo(() => computePhaseDurations(milestones), [milestones])

  const recordedCount = milestones.filter((m) => m.recorded_at).length

  if (milestones.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
          <Clock className="w-6 h-6 text-slate-400" />
        </div>
        <p className="text-sm font-medium text-slate-900">No milestones</p>
        <p className="text-xs text-slate-500 mt-1">
          No milestones are configured for this case
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Progress summary */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          Milestone Timeline
        </span>
        <span className="text-xs text-slate-500">
          {recordedCount}/{milestones.length} recorded
        </span>
      </div>

      {/* Timeline */}
      <div className="relative">
        {rows.map((row, idx) => {
          const isRecorded = !!row.recordedAt
          const isLast = idx === rows.length - 1

          return (
            <div key={row.id} className="relative">
              {/* Interval label between milestones */}
              {row.intervalMinutes != null && (
                <div className="flex items-center gap-2 py-1.5 pl-[18px]">
                  <div className="w-px h-full bg-slate-200 absolute left-[11px]" />
                  <ArrowDown className="w-3 h-3 text-slate-300 relative z-10" />
                  <span className="text-[11px] font-medium text-slate-400">
                    {formatMinutes(row.intervalMinutes)}
                  </span>
                </div>
              )}

              {/* Milestone row */}
              <div className="flex items-start gap-3 relative">
                {/* Timeline dot + connector line */}
                <div className="flex flex-col items-center flex-shrink-0 relative z-10">
                  {isRecorded ? (
                    <CheckCircle2 className="w-[22px] h-[22px] text-green-500" />
                  ) : (
                    <Circle className="w-[22px] h-[22px] text-slate-300" />
                  )}
                  {!isLast && (
                    <div className="w-px flex-1 bg-slate-200 min-h-[8px]" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pb-4">
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-medium ${isRecorded ? 'text-slate-900' : 'text-slate-400'}`}>
                      {row.name}
                    </span>
                    <span className={`text-xs ${isRecorded ? 'text-slate-600' : 'text-slate-400'}`}>
                      {formatTimestamp(row.recordedAt)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Summary Section */}
      <div className="border-t border-slate-200 pt-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            Duration Summary
          </span>
          {comparisonLoading && (
            <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin" />
          )}
        </div>

        <div className="bg-slate-50 rounded-lg p-3 divide-y divide-slate-200">
          <SummaryRow
            label="Total Case Time"
            actual={phases.totalCaseTime}
            surgeonMedian={surgeonStats?.median_duration ?? null}
            facilityMedian={facilityStats?.median_duration ?? null}
            surgeonName={surgeonName}
          />
          <SummaryRow
            label="Surgical Time"
            actual={phases.surgicalTime}
            surgeonMedian={surgeonStats?.median_surgical_duration ?? null}
            facilityMedian={facilityStats?.median_surgical_duration ?? null}
            surgeonName={surgeonName}
          />
          <SummaryRow
            label="Pre-Op Time"
            actual={phases.preOpTime}
            surgeonMedian={surgeonStats?.median_call_to_patient_in ?? null}
            facilityMedian={facilityStats?.median_call_to_patient_in ?? null}
            surgeonName={surgeonName}
          />
        </div>

        {/* Sample size context */}
        {!comparisonLoading && (surgeonStats || facilityStats) && (
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400">
            {surgeonStats && (
              <span>Surgeon median based on {surgeonStats.sample_size} cases</span>
            )}
            {facilityStats && (
              <span>Facility median based on {facilityStats.sample_size} cases ({facilityStats.surgeon_count} surgeons)</span>
            )}
          </div>
        )}

        {!comparisonLoading && !surgeonStats && !facilityStats && (
          <p className="mt-2 text-[11px] text-slate-400">
            No benchmark data available for this procedure
          </p>
        )}
      </div>
    </div>
  )
}
