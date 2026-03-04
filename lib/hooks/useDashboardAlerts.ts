// lib/hooks/useDashboardAlerts.ts
// Data fetching hook for the facility admin dashboard Needs Attention list.
// Runs one query per alert type (no N+1), returns prioritized alert items.

import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { useUser } from '@/lib/UserContext'
import { getLocalDateString } from '@/lib/date-utils'
import { logger } from '@/lib/logger'

const log = logger('useDashboardAlerts')

// ============================================
// Types
// ============================================

export type AlertType =
  | 'validation'
  | 'missing_milestones'
  | 'behind_schedule'
  | 'stale_cases'

export type AlertPriority = 'high' | 'medium' | 'low'

export interface DashboardAlert {
  id: string
  type: AlertType
  priority: AlertPriority
  title: string
  description: string
  count?: number
  timestamp?: string
  linkTo: string
}

// ============================================
// Priority ordering
// ============================================

const PRIORITY_ORDER: Record<AlertPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
}

function sortAlerts(alerts: DashboardAlert[]): DashboardAlert[] {
  return alerts.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
}

// ============================================
// Alert query functions
// ============================================

type SupabaseClient = Parameters<Parameters<typeof useSupabaseQuery>[0]>[0]

/** Cases with unresolved data quality issues */
async function queryUnvalidatedCases(
  supabase: SupabaseClient,
  facilityId: string
): Promise<DashboardAlert | null> {
  const { data, error } = await supabase
    .from('metric_issues')
    .select('case_id')
    .eq('facility_id', facilityId)
    .is('resolved_at', null)

  if (error) {
    log.error('Failed to query unresolved metric issues', { error: error.message })
    return null
  }

  const uniqueCaseIds = new Set((data ?? []).map((d: { case_id: string }) => d.case_id))
  const count = uniqueCaseIds.size

  if (count === 0) return null

  return {
    id: 'alert-validation',
    type: 'validation',
    priority: 'medium',
    title: `${count} case${count === 1 ? '' : 's'} flagged for review`,
    description: 'Cases with data quality issues that need review.',
    count,
    linkTo: '/data-quality',
  }
}

/** Supabase returns belongs-to joins as object or single-element array */
function normalizeJoin<T>(data: T | T[] | null): T | null {
  if (Array.isArray(data)) return data[0] || null
  return data
}

/** Batch-fetch facility templates → Map<template_id, Set<milestone_name>> */
async function fetchTemplateMap(
  supabase: SupabaseClient,
  facilityId: string
): Promise<{ templateMap: Map<string, Set<string>>; defaultTemplateId: string | null }> {
  const { data: templates, error } = await supabase
    .from('milestone_templates')
    .select(`
      id,
      is_default,
      milestone_template_items (
        facility_milestones (name)
      )
    `)
    .eq('facility_id', facilityId)
    .eq('is_active', true)

  if (error || !templates) {
    log.error('Failed to fetch facility templates', { error: error?.message })
    return { templateMap: new Map(), defaultTemplateId: null }
  }

  const templateMap = new Map<string, Set<string>>()
  let defaultTemplateId: string | null = null

  for (const template of templates) {
    const milestoneNames = new Set<string>()
    const items = template.milestone_template_items as Array<{
      facility_milestones: { name: string } | { name: string }[] | null
    }> | null
    for (const item of items ?? []) {
      const fm = normalizeJoin(item.facility_milestones)
      if (fm?.name) milestoneNames.add(fm.name)
    }
    templateMap.set(template.id, milestoneNames)
    if (template.is_default) defaultTemplateId = template.id
  }

  return { templateMap, defaultTemplateId }
}

/** Resolve expected milestone names for a case, falling back to facility default */
function getExpectedMilestones(
  caseTemplateId: string | null,
  templateMap: Map<string, Set<string>>,
  defaultTemplateId: string | null
): Set<string> {
  const templateId = caseTemplateId || defaultTemplateId
  if (!templateId) return new Set()
  return templateMap.get(templateId) ?? new Set()
}

/** Cases from today/yesterday missing milestone data (template-scoped) */
async function queryMissingMilestones(
  supabase: SupabaseClient,
  facilityId: string
): Promise<DashboardAlert | null> {
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const todayStr = getLocalDateString(today)
  const yesterdayStr = getLocalDateString(yesterday)

  // Fetch completed status and facility templates in parallel
  const [statusResult, templateResult] = await Promise.all([
    supabase
      .from('case_statuses')
      .select('id')
      .eq('name', 'completed')
      .single(),
    fetchTemplateMap(supabase, facilityId),
  ])

  if (!statusResult.data) return null
  const { templateMap, defaultTemplateId } = templateResult

  // Fetch completed cases with ALL their milestones and their template assignment
  const { data: cases, error } = await supabase
    .from('cases')
    .select(`
      id,
      milestone_template_id,
      case_milestones (
        recorded_at,
        facility_milestones (name)
      )
    `)
    .eq('facility_id', facilityId)
    .gte('scheduled_date', yesterdayStr)
    .lte('scheduled_date', todayStr)
    .eq('status_id', statusResult.data.id)
    .not('data_validated', 'is', true)

  if (error) {
    log.error('Failed to query missing milestones', { error: error.message })
    return null
  }

  // For each case, check if any EXPECTED milestones (from template) are missing
  const casesWithMissing: string[] = []

  for (const c of cases ?? []) {
    const expected = getExpectedMilestones(c.milestone_template_id, templateMap, defaultTemplateId)
    if (expected.size === 0) continue

    // Build set of milestones that have been recorded
    const recorded = new Set<string>()
    const milestones = Array.isArray(c.case_milestones) ? c.case_milestones : []
    for (const m of milestones) {
      if (m.recorded_at) {
        const fm = normalizeJoin(
          m.facility_milestones as { name: string } | { name: string }[] | null
        )
        if (fm?.name) recorded.add(fm.name)
      }
    }

    // Check if any expected milestone is missing
    for (const name of expected) {
      if (!recorded.has(name)) {
        casesWithMissing.push(c.id)
        break
      }
    }
  }

  const count = casesWithMissing.length

  if (count === 0) return null

  return {
    id: 'alert-missing-milestones',
    type: 'missing_milestones',
    priority: 'medium',
    title: `${count} case${count === 1 ? '' : 's'} missing milestones`,
    description: 'Completed cases with missing milestone timestamps.',
    count,
    linkTo: '/cases?filter=missing_milestones',
  }
}

/** Rooms running behind schedule based on today's cases */
async function queryBehindSchedule(
  supabase: SupabaseClient,
  facilityId: string
): Promise<DashboardAlert | null> {
  const todayStr = getLocalDateString()

  // Get in_progress status and behind-schedule grace setting in parallel
  const [statusResult, settingsResult] = await Promise.all([
    supabase
      .from('case_statuses')
      .select('id')
      .eq('name', 'in_progress')
      .single(),
    supabase
      .from('facility_analytics_settings')
      .select('behind_schedule_grace_minutes')
      .eq('facility_id', facilityId)
      .single(),
  ])

  const statusData = statusResult.data
  if (!statusData) return null

  // Use configured grace or default to 15 minutes
  const GRACE_MINUTES = (settingsResult.data as { behind_schedule_grace_minutes?: number } | null)
    ?.behind_schedule_grace_minutes ?? 15

  // Fetch today's in-progress cases with procedure type duration and start milestone
  const [casesResult, overridesResult] = await Promise.all([
    supabase
      .from('cases')
      .select(`
        id,
        or_room_id,
        start_time,
        procedure_type_id,
        surgeon_id,
        procedure_types(expected_duration_minutes),
        or_rooms (name),
        case_milestones (
          recorded_at,
          facility_milestones (name)
        )
      `)
      .eq('facility_id', facilityId)
      .eq('scheduled_date', todayStr)
      .eq('status_id', statusData.id),
    supabase
      .from('surgeon_procedure_duration')
      .select('surgeon_id, procedure_type_id, expected_duration_minutes')
      .eq('facility_id', facilityId),
  ])

  if (casesResult.error) {
    log.error('Failed to query behind schedule', { error: casesResult.error.message })
    return null
  }

  const cases = casesResult.data
  if (!cases || cases.length === 0) return null

  // Build surgeon override map
  const overrideMap = new Map<string, number>()
  if (overridesResult.data) {
    for (const o of overridesResult.data as Array<{ surgeon_id: string; procedure_type_id: string; expected_duration_minutes: number }>) {
      overrideMap.set(`${o.surgeon_id}::${o.procedure_type_id}`, o.expected_duration_minutes)
    }
  }

  const now = new Date()
  const behindRooms: Array<{ roomName: string; minutesBehind: number }> = []

  for (const c of cases) {
    // Find the patient_in milestone as the actual start
    const milestones = Array.isArray(c.case_milestones) ? c.case_milestones : []
    const patientIn = milestones.find((m) => {
      // Supabase returns nested belongs-to as object, but TS may infer array
      const fm = m.facility_milestones as unknown as { name: string } | { name: string }[] | null
      const name = Array.isArray(fm) ? fm[0]?.name : fm?.name
      return name === 'patient_in' && m.recorded_at
    })

    if (!patientIn?.recorded_at) continue

    const overrideKey = `${(c as unknown as { surgeon_id: string | null }).surgeon_id}::${(c as unknown as { procedure_type_id: string | null }).procedure_type_id}`
    const surgeonDuration = overrideMap.get(overrideKey) ?? null
    const procDuration = ((c as unknown as { procedure_types: { expected_duration_minutes: number | null } | null }).procedure_types)?.expected_duration_minutes ?? null
    const estimatedDuration = surgeonDuration ?? procDuration ?? 120
    const startTime = new Date(patientIn.recorded_at)
    const expectedEnd = new Date(startTime.getTime() + (estimatedDuration + GRACE_MINUTES) * 60000)

    if (now > expectedEnd) {
      const minutesBehind = Math.round((now.getTime() - expectedEnd.getTime()) / 60000)
      const rooms = c.or_rooms
      const roomData = Array.isArray(rooms) ? rooms[0] : rooms
      behindRooms.push({
        roomName: roomData?.name ?? 'Unknown Room',
        minutesBehind,
      })
    }
  }

  if (behindRooms.length === 0) return null

  // Build description from the most behind rooms
  const sorted = behindRooms.sort((a, b) => b.minutesBehind - a.minutesBehind)
  const topRoom = sorted[0]
  const description =
    sorted.length === 1
      ? `${topRoom.roomName} is running ${topRoom.minutesBehind} min over.`
      : `${topRoom.roomName} is ${topRoom.minutesBehind} min over and ${sorted.length - 1} other room${sorted.length - 1 === 1 ? '' : 's'}.`

  return {
    id: 'alert-behind-schedule',
    type: 'behind_schedule',
    priority: 'high',
    title: `${sorted.length} room${sorted.length === 1 ? '' : 's'} running behind`,
    description,
    count: sorted.length,
    linkTo: '/rooms',
  }
}

/** Past cases still marked as 'scheduled' */
async function queryStaleCases(
  supabase: SupabaseClient,
  facilityId: string
): Promise<DashboardAlert | null> {
  const todayStr = getLocalDateString()

  // Get scheduled status ID
  const { data: statusData } = await supabase
    .from('case_statuses')
    .select('id')
    .eq('name', 'scheduled')
    .single()

  if (!statusData) return null

  const { count, error } = await supabase
    .from('cases')
    .select('id', { count: 'exact', head: true })
    .eq('facility_id', facilityId)
    .eq('status_id', statusData.id)
    .lt('scheduled_date', todayStr)

  if (error) {
    log.error('Failed to query stale cases', { error: error.message })
    return null
  }

  if (!count || count === 0) return null

  return {
    id: 'alert-stale-cases',
    type: 'stale_cases',
    priority: 'low',
    title: `${count} past case${count === 1 ? '' : 's'} still scheduled`,
    description: 'Cases with a past date that were never updated from scheduled status.',
    count,
    linkTo: '/cases?filter=stale',
  }
}

// ============================================
// Hook
// ============================================

const DISMISSED_ALERTS_KEY = 'dismissed_alerts'

function getDismissedIds(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = sessionStorage.getItem(DISMISSED_ALERTS_KEY)
    if (!raw) return new Set()
    return new Set(JSON.parse(raw) as string[])
  } catch {
    return new Set()
  }
}

function setDismissedIds(ids: Set<string>) {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(DISMISSED_ALERTS_KEY, JSON.stringify([...ids]))
}

export function useDashboardAlerts() {
  const { effectiveFacilityId } = useUser()

  const queryResult = useSupabaseQuery<DashboardAlert[]>(
    async (supabase) => {
      const facilityId = effectiveFacilityId!

      // Run all alert queries in parallel (one query per alert type)
      const results = await Promise.allSettled([
        queryUnvalidatedCases(supabase, facilityId),
        queryMissingMilestones(supabase, facilityId),
        queryBehindSchedule(supabase, facilityId),
        queryStaleCases(supabase, facilityId),
      ])

      const alerts: DashboardAlert[] = []

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          alerts.push(result.value)
        } else if (result.status === 'rejected') {
          log.error('Alert query failed', { reason: result.reason })
        }
      }

      const sorted = sortAlerts(alerts)

      // Prune dismissed IDs: remove any that no longer exist in the current alerts
      const currentIds = new Set(sorted.map(a => a.id))
      const dismissed = getDismissedIds()
      let changed = false
      for (const id of dismissed) {
        if (!currentIds.has(id)) {
          dismissed.delete(id)
          changed = true
        }
      }
      if (changed) setDismissedIds(dismissed)

      return sorted
    },
    {
      deps: [effectiveFacilityId],
      enabled: !!effectiveFacilityId,
    }
  )

  return {
    ...queryResult,
    /** Dismiss an alert by ID (persists in sessionStorage until data refresh clears it) */
    dismissAlert: (id: string) => {
      const dismissed = getDismissedIds()
      dismissed.add(id)
      setDismissedIds(dismissed)
      // Remove from displayed data via setData
      queryResult.setData(
        queryResult.data?.filter(a => a.id !== id) ?? null
      )
    },
    /** Check if an alert is currently dismissed */
    isDismissed: (id: string) => getDismissedIds().has(id),
  }
}
