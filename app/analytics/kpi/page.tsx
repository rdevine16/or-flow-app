'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import { getImpersonationState } from '@/lib/impersonation'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import AccessDenied from '@/components/ui/AccessDenied'
import DateFilter from '@/components/ui/DateFilter'
import Sparkline, { dailyDataToSparkline } from '@/components/ui/Sparkline'
import { DeltaBadge } from '@/components/ui/DeltaBadge'
import { generateInsights } from '@/lib/insightsEngine'

import {
  calculateAnalyticsOverview,
  getKPIStatus,
  type CaseWithMilestonesAndSurgeon,
  type RoomHoursMap,
  type ORUtilizationResult,
  type KPIResult,
  type FacilityAnalyticsConfig,
} from '@/lib/analyticsV2'
import { useAnalyticsConfig } from '@/lib/hooks/useAnalyticsConfig'

import { ArrowRight, BarChart3, X } from 'lucide-react'

// ============================================
// HELPERS
// ============================================

const STATUS_COLORS: Record<'good' | 'warn' | 'bad', string> = {
  good: '#10b981',
  warn: '#f59e0b',
  bad: '#ef4444',
}

function toSignedDelta(kpi: KPIResult): number {
  if (!kpi.delta || !kpi.deltaType || kpi.deltaType === 'unchanged') return 0
  return kpi.deltaType === 'decrease' ? -kpi.delta : kpi.delta
}

// ============================================
// STATUS DOT
// ============================================

const STATUS_DOT_CLASSES: Record<'good' | 'warn' | 'bad', string> = {
  good: 'bg-emerald-500',
  warn: 'bg-amber-500',
  bad: 'bg-red-500',
}

function StatusDot({ status, size = 6 }: { status: 'good' | 'warn' | 'bad'; size?: number }) {
  return (
    <span
      className={`inline-block rounded-full flex-shrink-0 ${STATUS_DOT_CLASSES[status]}`}
      style={{ width: size, height: size }}
    />
  )
}

// ============================================
// TARGET GAUGE (mini progress bar)
// ============================================

function TargetGauge({ value, target, inverse = false, unit = '%' }: {
  value: number
  target: number
  inverse?: boolean
  unit?: string
}) {
  const ratio = inverse ? target / Math.max(value, 1) : value / Math.max(target, 1)
  const isGood = inverse ? value <= target : value >= target
  const barColor = isGood ? 'bg-emerald-500' : ratio > 0.7 ? 'bg-amber-500' : 'bg-red-500'

  return (
    <div className="flex items-center gap-1.5">
      <div className="w-11 h-[3px] rounded-full bg-slate-200">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${Math.min(ratio * 100, 100)}%` }}
        />
      </div>
      <span className="text-[10px] text-slate-400 font-mono">
        {inverse ? `<${target}` : `${target}`}{unit}
      </span>
    </div>
  )
}

// ============================================
// SECTION HEADING
// ============================================

function Section({ title, subtitle, badge, children }: {
  title: string
  subtitle?: string
  badge?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section>
      <div className="flex items-baseline justify-between mb-3.5">
        <div>
          <h2 className="text-[15px] font-semibold text-slate-900 tracking-tight">{title}</h2>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        {badge}
      </div>
      {children}
    </section>
  )
}

// ============================================
// CONFIGS
// ============================================

const SEVERITY_CONFIG: Record<string, { border: string; labelBg: string; labelText: string }> = {
  critical: { border: 'border-l-red-500', labelBg: 'bg-red-100', labelText: 'text-red-800' },
  warning: { border: 'border-l-amber-500', labelBg: 'bg-amber-100', labelText: 'text-amber-800' },
  positive: { border: 'border-l-emerald-500', labelBg: 'bg-emerald-100', labelText: 'text-emerald-800' },
  info: { border: 'border-l-indigo-500', labelBg: 'bg-indigo-100', labelText: 'text-indigo-800' },
}

const SURGEON_STATUS_CONFIG: Record<
  'on_track' | 'call_sooner' | 'call_later' | 'turnover_only',
  { bg: string; text: string; border: string; dot: string }
> = {
  on_track: { bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-200', dot: 'bg-green-500' },
  call_sooner: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
  call_later: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
  turnover_only: { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200', dot: 'bg-slate-400' },
}

// ============================================
// OR UTILIZATION MODAL (Room Breakdown)
// ============================================

function ORUtilizationModal({
  isOpen,
  onClose,
  data,
  config,
}: {
  isOpen: boolean
  onClose: () => void
  data: ORUtilizationResult
  config: FacilityAnalyticsConfig
}) {
  if (!isOpen) return null

  const { roomBreakdown, roomsWithRealHours, roomsWithDefaultHours } = data

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true" aria-label="OR Utilization by Room">
      <div className="flex min-h-full items-center justify-center p-2 sm:p-4">
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={onClose} />

        <div className="relative bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] sm:max-h-[85vh] overflow-hidden border border-slate-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200 bg-slate-50">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-100 hidden sm:flex">
                <BarChart3 className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-semibold text-slate-900">OR Utilization by Room</h2>
                <p className="text-xs sm:text-sm text-slate-500">
                  {roomsWithRealHours > 0 && roomsWithDefaultHours > 0
                    ? `${roomsWithRealHours} rooms configured · ${roomsWithDefaultHours} using default (10h)`
                    : roomsWithDefaultHours === roomBreakdown.length
                    ? 'All rooms using default 10h availability — configure in Settings'
                    : `All ${roomsWithRealHours} rooms have configured hours`}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close modal"
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(90vh-80px)] sm:max-h-[calc(85vh-80px)]">
            {roomBreakdown.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <BarChart3 className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-base font-semibold text-slate-900 mb-1">No utilization data</h3>
                <p className="text-sm text-slate-500">No rooms with case data found in this period.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Summary bar */}
                <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
                  <div className="p-2 sm:p-3 bg-green-50 rounded-lg border border-green-200/60 text-center">
                    <div className="text-xl sm:text-2xl font-semibold text-green-600">
                      {roomBreakdown.filter(r => r.utilization >= config.utilizationTargetPercent).length}
                    </div>
                    <div className="text-[10px] sm:text-xs text-green-600 font-medium">Above Target</div>
                  </div>
                  <div className="p-2 sm:p-3 bg-amber-50 rounded-lg border border-amber-200/60 text-center">
                    <div className="text-xl sm:text-2xl font-semibold text-amber-700">
                      {roomBreakdown.filter(r => r.utilization >= config.utilizationTargetPercent * 0.8 && r.utilization < config.utilizationTargetPercent).length}
                    </div>
                    <div className="text-[10px] sm:text-xs text-amber-700 font-medium">Near Target</div>
                  </div>
                  <div className="p-2 sm:p-3 bg-slate-50 rounded-lg border border-slate-200/60 text-center">
                    <div className="text-xl sm:text-2xl font-semibold text-slate-600">
                      {roomBreakdown.filter(r => r.utilization < config.utilizationTargetPercent * 0.8).length}
                    </div>
                    <div className="text-[10px] sm:text-xs text-slate-500 font-medium">Below {Math.round(config.utilizationTargetPercent * 0.8)}%</div>
                  </div>
                </div>

                {/* Room rows */}
                {roomBreakdown.map((room) => {
                  const nearTarget = config.utilizationTargetPercent * 0.8
                  const barColor = room.utilization >= config.utilizationTargetPercent
                    ? 'bg-green-500'
                    : room.utilization >= nearTarget
                    ? 'bg-amber-500'
                    : 'bg-slate-400'
                  const textColor = room.utilization >= config.utilizationTargetPercent
                    ? 'text-green-600'
                    : room.utilization >= nearTarget
                    ? 'text-amber-700'
                    : 'text-slate-600'

                  return (
                    <div key={room.roomId} className="p-3 sm:p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-slate-900">{room.roomName}</span>
                          {!room.usingRealHours && (
                            <span className="px-1.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded">
                              Default hours
                            </span>
                          )}
                        </div>
                        <span className={`text-xl font-semibold ${textColor}`}>
                          {room.utilization}%
                        </span>
                      </div>

                      {/* Utilization bar */}
                      <div className="w-full bg-slate-200 rounded-full h-2 mb-3">
                        <div
                          className={`${barColor} h-2 rounded-full transition-all duration-500`}
                          style={{ width: `${Math.min(room.utilization, 100)}%` }}
                        />
                      </div>

                      {/* Stats row */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                        <span>{room.caseCount} cases</span>
                        <span className="text-slate-300 hidden sm:inline">·</span>
                        <span>{room.daysActive} days active</span>
                        <span className="text-slate-300 hidden sm:inline">·</span>
                        <span>~{Math.round(room.usedMinutes / room.daysActive / 60 * 10) / 10}h avg/day of {room.availableHours}h</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================
// MAIN PAGE COMPONENT
// ============================================

export default function AnalyticsOverviewPage() {
  const supabase = createClient()
  const { userData, loading: userLoading, isGlobalAdmin, can } = useUser()

  const [effectiveFacilityId, setEffectiveFacilityId] = useState<string | null>(null)
  const [noFacilitySelected, setNoFacilitySelected] = useState(false)
  const [facilityCheckComplete, setFacilityCheckComplete] = useState(false)

  const [cases, setCases] = useState<CaseWithMilestonesAndSurgeon[]>([])
  const [previousPeriodCases, setPreviousPeriodCases] = useState<CaseWithMilestonesAndSurgeon[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFilter, setDateFilter] = useState('month')

  const [showORUtilModal, setShowORUtilModal] = useState(false)
  const [roomHoursMap, setRoomHoursMap] = useState<RoomHoursMap>({})
  const { config } = useAnalyticsConfig()

  // Fetch room available hours when facility changes
  useEffect(() => {
    if (!effectiveFacilityId) return

    const fetchRoomHours = async () => {
      const { data } = await supabase
        .from('or_rooms')
        .select('id, available_hours')
        .eq('facility_id', effectiveFacilityId)
        .is('deleted_at', null)
      if (data) {
        const map: RoomHoursMap = {}
        data.forEach((r: { id: string; available_hours?: number }) => {
          if (r.available_hours) map[r.id] = r.available_hours
        })
        setRoomHoursMap(map)
      }
    }

    fetchRoomHours()
  }, [effectiveFacilityId, supabase])

  // Determine effective facility ID
  useEffect(() => {
    if (userLoading) return

    if (isGlobalAdmin || userData.accessLevel === 'global_admin') {
      const impersonation = getImpersonationState()
      if (impersonation?.facilityId) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setEffectiveFacilityId(impersonation.facilityId)
      } else {
        setNoFacilitySelected(true)
      }
    } else if (userData.facilityId) {
      setEffectiveFacilityId(userData.facilityId)
    }

    setFacilityCheckComplete(true)
  }, [userLoading, isGlobalAdmin, userData.accessLevel, userData.facilityId])

  // Fetch data
  const fetchData = useCallback(async (startDate?: string, endDate?: string) => {
    if (!effectiveFacilityId) return

    setLoading(true)

    let query = supabase
      .from('cases')
      .select(`
        id,
        case_number,
        facility_id,
        scheduled_date,
        start_time,
        surgeon_id,
        or_room_id,
        status_id,
        surgeon_left_at,
        cancelled_at,
        is_excluded_from_metrics,
        surgeon:users!cases_surgeon_id_fkey (
          id,
          first_name,
          last_name,
          closing_workflow,
          closing_handoff_minutes
        ),
        procedure_types (id, name),
        or_rooms (id, name),
        case_statuses (name),
        case_milestones (
          facility_milestone_id,
          recorded_at,
          facility_milestones (name)
        )
      `)
      .eq('facility_id', effectiveFacilityId)
      .order('scheduled_date', { ascending: false })

    if (startDate && endDate) {
      query = query.gte('scheduled_date', startDate).lte('scheduled_date', endDate)
    }

    const { data: casesData } = await query

    // Transform: Extract surgeon_profile from the joined surgeon data
    const transformedCases = ((casesData || []) as unknown[]).map((c: unknown) => {
      const caseObj = c as Record<string, unknown>
      const surgeon = caseObj.surgeon as Record<string, unknown> | null | undefined
      return {
        ...caseObj,
        surgeon_profile: surgeon ? {
          id: surgeon.id,
          closing_workflow: surgeon.closing_workflow || 'surgeon_closes',
          closing_handoff_minutes: surgeon.closing_handoff_minutes || 0,
        } : null,
      }
    })
    setCases(transformedCases as unknown as CaseWithMilestonesAndSurgeon[])

    // Fetch previous period for comparison
    if (startDate && endDate) {
      const start = new Date(startDate)
      const end = new Date(endDate)
      const periodLength = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)

      const prevEnd = new Date(start)
      prevEnd.setDate(prevEnd.getDate() - 1)
      const prevStart = new Date(prevEnd)
      prevStart.setDate(prevStart.getDate() - periodLength)

      const { data: prevData } = await supabase
        .from('cases')
        .select(`
          id,
          case_number,
          facility_id,
          scheduled_date,
          start_time,
          surgeon_id,
          or_room_id,
          status_id,
          surgeon_left_at,
          cancelled_at,
          is_excluded_from_metrics,
          surgeon:users!cases_surgeon_id_fkey (
            id,
            first_name,
            last_name,
            closing_workflow,
            closing_handoff_minutes
          ),
          procedure_types (id, name),
          or_rooms (id, name),
          case_statuses (name),
          case_milestones (
            facility_milestone_id,
            recorded_at,
            facility_milestones (name)
          )
        `)
        .eq('facility_id', effectiveFacilityId)
        .gte('scheduled_date', prevStart.toISOString().split('T')[0])
        .lte('scheduled_date', prevEnd.toISOString().split('T')[0])

      const transformedPrev = ((prevData || []) as unknown[]).map((c: unknown) => {
        const caseObj = c as Record<string, unknown>
        const surgeon = caseObj.surgeon as Record<string, unknown> | null | undefined
        return {
          ...caseObj,
          surgeon_profile: surgeon ? {
            id: surgeon.id,
            closing_workflow: surgeon.closing_workflow || 'surgeon_closes',
            closing_handoff_minutes: surgeon.closing_handoff_minutes || 0,
          } : null,
        }
      })
      setPreviousPeriodCases(transformedPrev as unknown as CaseWithMilestonesAndSurgeon[])
    }

    setLoading(false)
  }, [effectiveFacilityId, supabase])

  useEffect(() => {
    if (!effectiveFacilityId) return
    const today = new Date()
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData(monthStart.toISOString().split('T')[0], today.toISOString().split('T')[0])
  }, [effectiveFacilityId, fetchData])

  const handleFilterChange = (filter: string, startDate?: string, endDate?: string) => {
    setDateFilter(filter)
    fetchData(startDate, endDate)
  }

  // ============================================
  // ANALYTICS COMPUTATION
  // ============================================

  const analytics = useMemo(() => {
    return calculateAnalyticsOverview(cases, previousPeriodCases, config, roomHoursMap)
  }, [cases, previousPeriodCases, config, roomHoursMap])

  // AI Insights from insightsEngine
  const insights = useMemo(() => {
    return generateInsights(analytics, {
      revenuePerORMinute: config.orHourlyRate ? config.orHourlyRate / 60 : 36,
      revenuePerCase: 5800,
    })
  }, [analytics, config.orHourlyRate])

  // Action items for health overview
  const actionItems = useMemo(() => {
    const items: Array<{ text: string; status: 'good' | 'warn' | 'bad' }> = []
    if (!analytics.fcots.targetMet) {
      items.push({ text: `First case on-time at ${analytics.fcots.displayValue}`, status: 'bad' })
    }
    if (!analytics.orUtilization.targetMet) {
      items.push({ text: `OR utilization at ${analytics.orUtilization.displayValue}`, status: 'bad' })
    }
    const callSoonerCount = analytics.surgeonIdleSummaries.filter(s => s.status === 'call_sooner').length
    if (callSoonerCount > 0) {
      items.push({ text: `${callSoonerCount} surgeon${callSoonerCount > 1 ? 's' : ''} need earlier callbacks`, status: 'warn' })
    }
    if (analytics.cancellationRate.sameDayCount === 0) {
      items.push({ text: 'Zero same-day cancellations', status: 'good' })
    }
    return items
  }, [analytics])

  // Health status dots for ORbit Score placeholder
  const healthStatuses = useMemo(() => ({
    fcots: getKPIStatus(analytics.fcots.value, analytics.fcots.target ?? config.fcotsTargetPercent),
    utilization: getKPIStatus(analytics.orUtilization.value, analytics.orUtilization.target ?? config.utilizationTargetPercent),
    volume: (analytics.caseVolume.deltaType === 'decrease' && (analytics.caseVolume.delta ?? 0) > 15
      ? 'bad' as const
      : 'good' as const),
    cancellation: getKPIStatus(analytics.cancellationRate.value, analytics.cancellationRate.target ?? config.cancellationTargetPercent, true),
  }), [analytics, config])

  // ============================================
  // KPI STRIP DATA (Layer 2)
  // ============================================

  const kpiCards = [
    {
      label: 'First Case On-Time',
      kpi: analytics.fcots as KPIResult,
      status: getKPIStatus(analytics.fcots.value, analytics.fcots.target ?? config.fcotsTargetPercent),
      sparkline: dailyDataToSparkline(analytics.fcots.dailyData),
      onClick: undefined as (() => void) | undefined,
      inverse: false,
    },
    {
      label: 'OR Utilization',
      kpi: analytics.orUtilization as KPIResult,
      status: getKPIStatus(analytics.orUtilization.value, analytics.orUtilization.target ?? config.utilizationTargetPercent),
      sparkline: dailyDataToSparkline(analytics.orUtilization.dailyData),
      onClick: (() => setShowORUtilModal(true)) as (() => void) | undefined,
      inverse: false,
    },
    {
      label: 'Case Volume',
      kpi: analytics.caseVolume as KPIResult,
      status: (analytics.caseVolume.deltaType === 'decrease' ? 'warn' : 'good') as 'good' | 'warn' | 'bad',
      sparkline: analytics.caseVolume.weeklyVolume?.map(w => w.count) || [],
      onClick: undefined as (() => void) | undefined,
      inverse: false,
    },
    {
      label: 'Same-Day Cancellation',
      kpi: analytics.cancellationRate as KPIResult,
      status: getKPIStatus(analytics.cancellationRate.value, analytics.cancellationRate.target ?? config.cancellationTargetPercent, true),
      sparkline: dailyDataToSparkline(analytics.cancellationRate.dailyData),
      onClick: undefined as (() => void) | undefined,
      inverse: true,
    },
  ]

  // ============================================
  // TURNOVER ROWS DATA (Layer 3 left)
  // ============================================

  const turnoverRows = [
    {
      label: 'Same Room Turnover',
      kpi: analytics.turnoverTime,
      status: getKPIStatus(analytics.turnoverTime.value, analytics.turnoverTime.target ?? config.turnoverThresholdMinutes, true),
      sparkline: dailyDataToSparkline(analytics.turnoverTime.dailyData),
      unit: 'min',
    },
    {
      label: 'Same-Room Surgical',
      kpi: analytics.standardSurgicalTurnover,
      status: getKPIStatus(analytics.standardSurgicalTurnover.value, analytics.standardSurgicalTurnover.target ?? config.sameRoomTurnoverTarget, true),
      sparkline: dailyDataToSparkline(analytics.standardSurgicalTurnover.dailyData),
      unit: 'min',
    },
    {
      label: 'Flip-Room Surgical',
      kpi: analytics.flipRoomTime,
      status: getKPIStatus(analytics.flipRoomTime.value, analytics.flipRoomTime.target ?? config.flipRoomTurnoverTarget, true),
      sparkline: dailyDataToSparkline(analytics.flipRoomTime.dailyData),
      unit: 'min',
    },
    {
      label: 'Non-Operative Time',
      kpi: analytics.nonOperativeTime,
      status: (analytics.nonOperativeTime.value > config.nonOpBadMinutes
        ? 'bad'
        : analytics.nonOperativeTime.value > config.nonOpWarnMinutes
        ? 'warn'
        : 'good') as 'good' | 'warn' | 'bad',
      sparkline: dailyDataToSparkline(analytics.nonOperativeTime.dailyData),
      unit: 'min',
    },
  ]

  // Surgeon data for callback section (Layer 3 right)
  const flipSurgeons = analytics.surgeonIdleSummaries.filter(s => s.hasFlipData)
  const sameRoomOnlySurgeons = analytics.surgeonIdleSummaries.filter(s => !s.hasFlipData)

  // ============================================
  // ACCESS / LOADING STATES
  // ============================================

  if (!userLoading && !can('analytics.view')) {
    return (
      <DashboardLayout>
        <AccessDenied />
      </DashboardLayout>
    )
  }

  if (userLoading || !facilityCheckComplete) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-500">Loading analytics...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (noFacilitySelected) {
    return (
      <DashboardLayout>
        <Container className="py-12">
          <div className="max-w-md mx-auto text-center">
            <div className="w-16 h-16 bg-blue-50 rounded-xl flex items-center justify-center mx-auto mb-4">
              <BarChart3 className="w-8 h-8 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">No Facility Selected</h2>
            <p className="text-slate-500 mb-6">Select a facility to view analytics and performance metrics.</p>
            <Link
              href="/admin/facilities"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              View Facilities
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </Container>
      </DashboardLayout>
    )
  }

  // ============================================
  // MAIN RENDER — 4-LAYER INFORMATION HIERARCHY
  // ============================================

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-slate-50/50">
        <Container className="py-8">
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-7">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Analytics Overview</h1>
              <p className="text-sm text-slate-400 mt-1">
                {analytics.completedCases} completed cases analyzed
                {analytics.totalCases > analytics.completedCases && (
                  <span> · {analytics.totalCases} total</span>
                )}
              </p>
            </div>
            <DateFilter selectedFilter={dateFilter} onFilterChange={handleFilterChange} />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-slate-500">Calculating metrics...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-7">

              {/* ======================================== */}
              {/* LAYER 1: HEALTH OVERVIEW                 */}
              {/* ======================================== */}
              <div className="stagger-item grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-4">
                {/* ORbit Score Placeholder */}
                <div className="bg-white border border-slate-200 rounded-xl flex flex-col sm:flex-row items-center gap-4 sm:gap-7 px-4 sm:px-6 py-4 sm:py-5 transition-all duration-150 hover:border-slate-300 hover:shadow-sm">
                  {/* Placeholder radar chart area */}
                  <div className="w-[100px] h-[100px] sm:w-[146px] sm:h-[146px] rounded-full border-2 border-dashed border-slate-200 flex items-center justify-center flex-shrink-0">
                    <div className="text-center">
                      <p className="text-xs font-semibold text-slate-400">ORbit Score</p>
                      <p className="text-[10px] text-slate-300 mt-1">Coming Soon</p>
                    </div>
                  </div>

                  {/* Health check grid */}
                  <div className="flex-1 w-full sm:w-auto">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">
                      Health Check
                    </p>
                    <div className="grid grid-cols-2 gap-x-5 gap-y-2">
                      {[
                        { label: 'FCOTS', status: healthStatuses.fcots, value: analytics.fcots.displayValue },
                        { label: 'Utilization', status: healthStatuses.utilization, value: analytics.orUtilization.displayValue },
                        { label: 'Volume', status: healthStatuses.volume, value: analytics.caseVolume.displayValue },
                        { label: 'Cancellation', status: healthStatuses.cancellation, value: analytics.cancellationRate.displayValue },
                      ].map(h => (
                        <div key={h.label} className="flex items-center gap-2">
                          <StatusDot status={h.status} />
                          <span className="text-xs text-slate-500 flex-1">{h.label}</span>
                          <span className="text-xs font-semibold text-slate-800 font-mono">{h.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Action Items */}
                <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 flex flex-col transition-all duration-150 hover:border-slate-300 hover:shadow-sm">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
                    Action Items
                  </span>
                  <div className="flex flex-col flex-1">
                    {actionItems.map((item, i) => (
                      <div
                        key={i}
                        className={`flex items-center gap-2.5 py-2.5 ${i > 0 ? 'border-t border-slate-100' : ''}`}
                      >
                        <StatusDot status={item.status} />
                        <span className="text-xs text-slate-600 leading-snug">{item.text}</span>
                      </div>
                    ))}
                    {actionItems.length === 0 && (
                      <div className="flex-1 flex items-center justify-center">
                        <span className="text-xs text-slate-400">All metrics on target</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ======================================== */}
              {/* LAYER 2: KPI STRIP                       */}
              {/* ======================================== */}
              <div className="stagger-item">
                <Section title="How are we tracking?" subtitle="Core KPIs vs targets">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    {kpiCards.map((card) => (
                      <div
                        key={card.label}
                        role={card.onClick ? 'button' : undefined}
                        tabIndex={card.onClick ? 0 : undefined}
                        aria-label={card.onClick ? `${card.label}: ${card.kpi.displayValue} — click for details` : undefined}
                        onKeyDown={card.onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.onClick?.() } } : undefined}
                        className={`bg-white border border-slate-200 rounded-xl p-3 sm:p-4 transition-all duration-150 hover:border-slate-300 hover:shadow-sm ${
                          card.onClick ? 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1' : ''
                        }`}
                        onClick={card.onClick}
                      >
                        {/* Top: status dot + label, value + trend, sparkline */}
                        <div className="flex justify-between items-start mb-2.5">
                          <div>
                            <div className="flex items-center gap-1.5 mb-2">
                              <StatusDot status={card.status} />
                              <span className="text-xs text-slate-500 font-medium">{card.label}</span>
                            </div>
                            <div className="flex items-baseline gap-2">
                              <span className="text-[22px] sm:text-[26px] font-bold text-slate-900 font-mono tracking-tight leading-none">
                                {card.kpi.displayValue}
                              </span>
                              {card.kpi.delta !== undefined && card.kpi.deltaType && card.kpi.deltaType !== 'unchanged' && (
                                <DeltaBadge delta={toSignedDelta(card.kpi)} invert={card.inverse} />
                              )}
                            </div>
                          </div>
                          {card.sparkline.length > 1 && (
                            <Sparkline
                              data={card.sparkline}
                              color={STATUS_COLORS[card.status]}
                              width={68}
                              height={30}
                            />
                          )}
                        </div>

                        {/* Bottom: detail + target gauge */}
                        <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                          <span className="text-[11px] text-slate-400 truncate mr-2">{card.kpi.subtitle}</span>
                          {card.kpi.target !== undefined && (
                            <TargetGauge
                              value={card.kpi.value}
                              target={card.kpi.target}
                              inverse={card.inverse}
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>
              </div>

              {/* ======================================== */}
              {/* LAYER 3: TWO-COLUMN OPERATIONAL          */}
              {/* ======================================== */}
              <div className="stagger-item grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* LEFT: Where are we losing time? */}
                <Section title="Where are we losing time?" subtitle="Room turnover & non-operative time">
                  <div className="flex flex-col gap-2">
                    {turnoverRows.map((row) => (
                      <div
                        key={row.label}
                        className="bg-white border border-slate-200 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 flex items-center gap-3 transition-all duration-150 hover:border-slate-300 hover:shadow-sm"
                      >
                        <StatusDot status={row.status} />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-slate-700 mb-0.5">{row.label}</div>
                          <div className="text-[11px] text-slate-400 truncate hidden sm:block">{row.kpi.subtitle}</div>
                        </div>
                        {row.sparkline.length > 1 && (
                          <Sparkline
                            data={row.sparkline}
                            color={STATUS_COLORS[row.status]}
                            width={68}
                            height={24}
                            className="hidden sm:block"
                          />
                        )}
                        <div className="text-right min-w-[56px]">
                          <div className="flex items-baseline justify-end gap-0.5">
                            <span className="text-lg sm:text-xl font-bold text-slate-900 font-mono">
                              {Math.round(row.kpi.value)}
                            </span>
                            <span className="text-[11px] text-slate-400">{row.unit}</span>
                          </div>
                          {row.kpi.delta !== undefined && row.kpi.deltaType && row.kpi.deltaType !== 'unchanged' && (
                            <DeltaBadge delta={toSignedDelta(row.kpi)} invert />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>

                {/* RIGHT: What should we fix? */}
                <Section title="What should we fix?" subtitle="Surgeon callback optimization & idle time">
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden transition-all duration-150 hover:border-slate-300 hover:shadow-sm">
                    {/* Summary strip */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 border-b border-slate-100">
                      {[
                        { label: 'Overall Median', kpi: analytics.surgeonIdleTime, count: `${analytics.surgeonIdleSummaries.length} surgeons`, color: 'text-slate-900' },
                        { label: 'Flip Room Idle', kpi: analytics.surgeonIdleFlip, count: `${flipSurgeons.length} w/ flips`, color: 'text-indigo-600' },
                        { label: 'Same Room Idle', kpi: analytics.surgeonIdleSameRoom, count: `${sameRoomOnlySurgeons.length} same-room`, color: 'text-amber-600' },
                      ].map((s, i) => (
                        <div key={s.label} className={`p-3 sm:p-3.5 ${i < 2 ? 'border-b sm:border-b-0 sm:border-r border-slate-100' : ''}`}>
                          <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-1">{s.label}</div>
                          <div className={`text-xl font-bold font-mono ${s.color}`}>{s.kpi.displayValue}</div>
                          <div className="text-[11px] text-slate-400">{s.count}</div>
                        </div>
                      ))}
                    </div>

                    {/* Table — horizontally scrollable on small screens */}
                    <div className="overflow-x-auto">
                      {/* Table header */}
                      <div className="grid grid-cols-[1fr_56px_56px_44px_80px] min-w-[420px] px-4 py-2 bg-slate-50 border-b border-slate-100">
                        {['Surgeon', 'Flip', 'Same', 'Cases', 'Status'].map(h => (
                          <span key={h} className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{h}</span>
                        ))}
                      </div>

                      {/* Surgeon rows */}
                      <div className="divide-y divide-slate-50 max-h-[320px] overflow-y-auto">
                        {analytics.surgeonIdleSummaries.map((surgeon) => {
                          const sc = SURGEON_STATUS_CONFIG[surgeon.status]
                          return (
                            <div
                              key={surgeon.surgeonId}
                              className="grid grid-cols-[1fr_56px_56px_44px_80px] min-w-[420px] px-4 py-2.5 items-center hover:bg-slate-50/50 transition-colors"
                            >
                              <div>
                                <span className="text-[13px] font-medium text-slate-800">{surgeon.surgeonName}</span>
                                <div className="flex gap-1 mt-0.5">
                                  {surgeon.flipGapCount > 0 && (
                                    <span className="text-[10px] text-indigo-600 bg-indigo-50 px-1 py-px rounded">
                                      {surgeon.flipGapCount} flip{surgeon.flipGapCount !== 1 ? 's' : ''}
                                    </span>
                                  )}
                                  {surgeon.sameRoomGapCount > 0 && (
                                    <span className="text-[10px] text-amber-700 bg-amber-50 px-1 py-px rounded">
                                      {surgeon.sameRoomGapCount} same
                                    </span>
                                  )}
                                </div>
                              </div>
                              <span className={`text-[13px] font-mono font-semibold ${
                                surgeon.hasFlipData
                                  ? surgeon.medianFlipIdle <= 5 ? 'text-emerald-500' : surgeon.medianFlipIdle <= 10 ? 'text-amber-600' : 'text-red-500'
                                  : 'text-slate-300'
                              }`}>
                                {surgeon.hasFlipData ? `${Math.round(surgeon.medianFlipIdle)}m` : '—'}
                              </span>
                              <span className={`text-[13px] font-mono font-medium ${
                                surgeon.sameRoomGapCount > 0
                                  ? surgeon.medianSameRoomIdle <= 30 ? 'text-emerald-500' : surgeon.medianSameRoomIdle <= 50 ? 'text-amber-600' : 'text-red-500'
                                  : 'text-slate-300'
                              }`}>
                                {surgeon.sameRoomGapCount > 0 ? `${Math.round(surgeon.medianSameRoomIdle)}m` : '—'}
                              </span>
                              <span className="text-[13px] text-slate-500 font-mono">{surgeon.caseCount}</span>
                              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${sc.bg} ${sc.text} ${sc.border}`}>
                                <span className={`w-[5px] h-[5px] rounded-full ${sc.dot}`} />
                                {surgeon.statusLabel}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Empty state */}
                    {analytics.surgeonIdleSummaries.length === 0 && (
                      <div className="p-6 text-center">
                        <span className="text-sm text-slate-400">No multi-case surgeon days in this period</span>
                      </div>
                    )}
                  </div>
                </Section>
              </div>

              {/* ======================================== */}
              {/* LAYER 4: AI INSIGHTS                     */}
              {/* ======================================== */}
              <div className="stagger-item">
                <Section
                  title="AI Insights"
                  subtitle="Prioritized opportunities ranked by financial impact"
                  badge={
                    <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full tracking-wider">
                      POWERED BY ORBIT ENGINE
                    </span>
                  }
                >
                  <div className="flex flex-col gap-2.5">
                    {insights.map((insight) => {
                      const cfg = SEVERITY_CONFIG[insight.severity] ?? SEVERITY_CONFIG.info
                      return (
                        <div
                          key={insight.id}
                          className={`bg-white border border-slate-200 rounded-xl p-3 sm:p-4 pr-4 sm:pr-5 border-l-[3px] ${cfg.border} transition-all duration-150 hover:border-slate-300 hover:shadow-sm`}
                        >
                          <div className="flex flex-wrap items-center gap-2 mb-1.5">
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${cfg.labelBg} ${cfg.labelText}`}>
                              {insight.severity}
                            </span>
                            <span className="text-sm font-semibold text-slate-900">{insight.title}</span>
                          </div>
                          <p className="text-[13px] text-slate-600 leading-relaxed mb-2.5">{insight.body}</p>
                          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                            <span className="text-xs font-semibold text-indigo-600">{insight.action}</span>
                            {insight.financialImpact && (
                              <span className="text-[11px] font-semibold font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                {insight.financialImpact}
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                    {insights.length === 0 && (
                      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
                        <p className="text-sm text-slate-400">No insights generated for this period</p>
                      </div>
                    )}
                  </div>
                </Section>
              </div>

              {/* OR UTILIZATION MODAL */}
              <ORUtilizationModal
                isOpen={showORUtilModal}
                onClose={() => setShowORUtilModal(false)}
                data={analytics.orUtilization}
                config={config}
              />
            </div>
          )}
        </Container>
      </div>
    </DashboardLayout>
  )
}
