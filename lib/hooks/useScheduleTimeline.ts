// lib/hooks/useScheduleTimeline.ts
// Data fetching hook for the Schedule Adherence Timeline (Gantt chart).
// Fetches today's cases with milestones, resolves durations via fallback chain,
// determines late status, groups by room, and polls every 60 seconds.

import { useEffect, useRef } from 'react'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { useUser } from '@/lib/UserContext'
import { getLocalDateString } from '@/lib/date-utils'
import { getMilestoneMap, type CaseWithMilestones } from '@/lib/analyticsV2'
import { logger } from '@/lib/logger'

const log = logger('useScheduleTimeline')

// ============================================
// Types
// ============================================

export type TimelineCaseStatus = 'completed' | 'in_progress' | 'upcoming' | 'late'

export interface TimelineCase {
  caseId: string
  caseNumber: string
  procedureName: string
  surgeonName: string
  /** Scheduled start in hours from midnight (e.g., 7.5 = 7:30 AM) */
  scheduledStart: number
  /** Scheduled end in hours from midnight */
  scheduledEnd: number | null
  /** Actual patient_in in hours from midnight */
  actualStart: number | null
  /** Actual patient_out in hours from midnight */
  actualEnd: number | null
  status: TimelineCaseStatus
  /** Duration in minutes used for the ghost bar */
  durationMinutes: number | null
}

export interface TimelineRoom {
  roomId: string
  roomName: string
  displayOrder: number
  cases: TimelineCase[]
}

export interface TimelineSummary {
  onTimeCount: number
  lateCount: number
  avgDriftMinutes: number
  upcomingCount: number
  completedCount: number
  totalCount: number
}

export interface ScheduleTimelineData {
  rooms: TimelineRoom[]
  summary: TimelineSummary
  /** Time axis start in hours from midnight */
  axisStartHour: number
  /** Time axis end in hours from midnight */
  axisEndHour: number
}

// ============================================
// Helpers
// ============================================

/** Convert a "HH:MM:SS" time string to hours from midnight */
function timeToHours(time: string | null): number | null {
  if (!time) return null
  const parts = time.split(':')
  const hours = parseInt(parts[0], 10)
  const minutes = parseInt(parts[1], 10)
  return hours + minutes / 60
}

/** Convert a Date to hours from midnight */
function dateToHours(date: Date): number {
  return date.getHours() + date.getMinutes() / 60
}

/** Get surgeon display name from case data */
function getSurgeonName(c: CaseWithMilestones): string {
  if (!c.surgeon) return 'Unassigned'
  const s = Array.isArray(c.surgeon) ? c.surgeon[0] : c.surgeon
  if (!s) return 'Unassigned'
  return `Dr. ${s.last_name}`
}

/** Get procedure name from case data */
function getProcedureName(c: CaseWithMilestones): string {
  const proc = c.procedure_types
  if (!proc) return 'Unknown'
  const p = Array.isArray(proc) ? proc[0] : proc
  return p?.name ?? 'Unknown'
}

/** Get case status name from case data */
function getCaseStatusName(c: CaseWithMilestones): string {
  const cs = c.case_statuses
  if (!cs) return ''
  const status = Array.isArray(cs) ? cs[0] : cs
  return status?.name ?? ''
}

// ============================================
// Duration resolution types
// ============================================

interface SurgeonOverride {
  surgeon_id: string
  procedure_type_id: string
  expected_duration_minutes: number
}

interface ProcedureDuration {
  id: string
  expected_duration_minutes: number | null
}

interface RoomData {
  id: string
  name: string
  display_order: number
  available_hours: number | null
}

// ============================================
// Main fetch function
// ============================================

type SupabaseClient = Parameters<Parameters<typeof useSupabaseQuery>[0]>[0]

/** Select string for timeline cases — includes milestones for actual times */
const TIMELINE_CASE_SELECT = `
  id,
  case_number,
  facility_id,
  scheduled_date,
  start_time,
  scheduled_duration_minutes,
  surgeon_id,
  or_room_id,
  status_id,
  surgeon_left_at,
  procedure_type_id,
  surgeon:users!cases_surgeon_id_fkey (first_name, last_name),
  procedure_types (id, name),
  case_statuses (name),
  case_milestones (
    facility_milestone_id,
    recorded_at,
    facility_milestones (name)
  )
` as const

async function fetchScheduleTimeline(
  supabase: SupabaseClient,
  facilityId: string,
): Promise<ScheduleTimelineData> {
  const todayStr = getLocalDateString()

  // Fetch all data in parallel
  const [casesResult, roomsResult, proceduresResult, overridesResult, settingsResult] = await Promise.all([
    // Today's cases with milestones
    supabase
      .from('cases')
      .select(TIMELINE_CASE_SELECT)
      .eq('facility_id', facilityId)
      .eq('scheduled_date', todayStr)
      .order('start_time', { ascending: true }),
    // OR rooms with available_hours
    supabase
      .from('or_rooms')
      .select('id, name, display_order, available_hours')
      .eq('facility_id', facilityId)
      .eq('is_active', true)
      .order('display_order'),
    // Procedure base durations
    supabase
      .from('procedure_types')
      .select('id, expected_duration_minutes')
      .eq('facility_id', facilityId)
      .eq('is_active', true),
    // Surgeon-specific overrides
    supabase
      .from('surgeon_procedure_duration')
      .select('surgeon_id, procedure_type_id, expected_duration_minutes')
      .eq('facility_id', facilityId),
    // Facility analytics settings for FCOTS config
    supabase
      .from('facility_analytics_settings')
      .select('fcots_milestone, fcots_grace_minutes')
      .eq('facility_id', facilityId)
      .single(),
  ])

  if (casesResult.error) {
    log.error('Failed to fetch timeline cases', { error: casesResult.error.message })
    throw new Error(casesResult.error.message)
  }
  if (roomsResult.error) {
    log.error('Failed to fetch rooms', { error: roomsResult.error.message })
    throw new Error(roomsResult.error.message)
  }
  if (proceduresResult.error) {
    log.error('Failed to fetch procedures', { error: proceduresResult.error.message })
    throw new Error(proceduresResult.error.message)
  }
  // Overrides table might not exist yet or be empty — graceful fallback
  if (overridesResult.error && overridesResult.error.code !== 'PGRST116') {
    log.warn('Could not fetch surgeon overrides', { error: overridesResult.error.message })
  }

  const cases = (casesResult.data as unknown as (CaseWithMilestones & {
    scheduled_duration_minutes: number | null
    procedure_type_id: string | null
  })[]) || []
  const rooms = (roomsResult.data as unknown as RoomData[]) || []
  const procedures = (proceduresResult.data as unknown as ProcedureDuration[]) || []
  const overrides = (overridesResult.data as unknown as SurgeonOverride[]) || []

  // FCOTS config — settings row may not exist (PGRST116)
  const fcotsMilestone: string = settingsResult.error
    ? 'patient_in'
    : (settingsResult.data as { fcots_milestone: string } | null)?.fcots_milestone ?? 'patient_in'
  const fcotsGraceMinutes: number = settingsResult.error
    ? 5
    : (settingsResult.data as { fcots_grace_minutes: number } | null)?.fcots_grace_minutes ?? 5

  // Build lookup maps
  const procedureMap = new Map<string, number | null>()
  for (const p of procedures) {
    procedureMap.set(p.id, p.expected_duration_minutes)
  }

  const overrideMap = new Map<string, number>()
  for (const o of overrides) {
    overrideMap.set(`${o.surgeon_id}::${o.procedure_type_id}`, o.expected_duration_minutes)
  }

  // Group cases by room
  const casesByRoom = new Map<string, typeof cases>()
  for (const c of cases) {
    if (!c.or_room_id) continue
    const existing = casesByRoom.get(c.or_room_id) ?? []
    existing.push(c)
    casesByRoom.set(c.or_room_id, existing)
  }

  // Derive time axis from rooms
  const DEFAULT_AXIS_START = 7
  const DEFAULT_AXIS_END = 17
  let axisEndHour = DEFAULT_AXIS_END

  for (const room of rooms) {
    if (room.available_hours) {
      const roomEnd = DEFAULT_AXIS_START + room.available_hours
      if (roomEnd > axisEndHour) axisEndHour = roomEnd
    }
  }

  // Process rooms and cases
  let onTimeCount = 0
  let lateCount = 0
  let upcomingCount = 0
  let completedCount = 0
  let totalCount = 0
  const drifts: number[] = []

  const timelineRooms: TimelineRoom[] = rooms
    .filter(room => casesByRoom.has(room.id))
    .map(room => {
      const roomCases = casesByRoom.get(room.id) ?? []
      const timelineCases: TimelineCase[] = []

      for (const c of roomCases) {
        totalCount++
        const scheduledStartHours = timeToHours(c.start_time)
        if (scheduledStartHours === null) continue

        // Duration resolution chain:
        // 1. cases.scheduled_duration_minutes
        // 2. surgeon override
        // 3. procedure base
        // 4. null (no bar)
        let durationMinutes: number | null = c.scheduled_duration_minutes ?? null
        if (durationMinutes === null && c.surgeon_id && c.procedure_type_id) {
          const key = `${c.surgeon_id}::${c.procedure_type_id}`
          durationMinutes = overrideMap.get(key) ?? null
        }
        if (durationMinutes === null && c.procedure_type_id) {
          durationMinutes = procedureMap.get(c.procedure_type_id) ?? null
        }

        const scheduledEnd = durationMinutes !== null
          ? scheduledStartHours + durationMinutes / 60
          : null

        // Actual times from milestones
        const milestones = getMilestoneMap(c)
        const actualStart = milestones.patient_in ? dateToHours(milestones.patient_in) : null
        const actualEnd = milestones.patient_out ? dateToHours(milestones.patient_out) : null

        // Determine status
        const statusName = getCaseStatusName(c)
        let caseStatus: TimelineCaseStatus = 'upcoming'

        if (statusName === 'completed') {
          caseStatus = 'completed'
          completedCount++
        } else if (statusName === 'in_progress') {
          caseStatus = 'in_progress'
        } else {
          upcomingCount++
        }

        // Late determination: configured FCOTS milestone recorded_at > start_time + grace_minutes
        const fcotsTimestamp = fcotsMilestone === 'incision'
          ? milestones.incision
          : milestones.patient_in

        if (fcotsTimestamp && c.start_time) {
          // Build scheduled start as a Date from today's date + start_time
          const [h, m] = c.start_time.split(':').map(Number)
          const scheduledDate = new Date()
          scheduledDate.setHours(h, m, 0, 0)
          const graceMs = fcotsGraceMinutes * 60 * 1000
          const deadline = new Date(scheduledDate.getTime() + graceMs)

          if (fcotsTimestamp > deadline) {
            caseStatus = 'late'
            lateCount++
            // Calculate drift in minutes
            const driftMs = fcotsTimestamp.getTime() - scheduledDate.getTime()
            drifts.push(driftMs / 60000)
          } else if (caseStatus === 'completed' || caseStatus === 'in_progress') {
            onTimeCount++
          }
        } else if (caseStatus === 'completed' || caseStatus === 'in_progress') {
          // No FCOTS milestone recorded — can't determine late status, count as on-time
          onTimeCount++
        }

        timelineCases.push({
          caseId: c.id,
          caseNumber: c.case_number,
          procedureName: getProcedureName(c),
          surgeonName: getSurgeonName(c),
          scheduledStart: scheduledStartHours,
          scheduledEnd,
          actualStart,
          actualEnd,
          status: caseStatus,
          durationMinutes,
        })
      }

      return {
        roomId: room.id,
        roomName: room.name,
        displayOrder: room.display_order,
        cases: timelineCases,
      }
    })

  const avgDriftMinutes = drifts.length > 0
    ? Math.round(drifts.reduce((a, b) => a + b, 0) / drifts.length)
    : 0

  return {
    rooms: timelineRooms,
    summary: {
      onTimeCount,
      lateCount,
      avgDriftMinutes,
      upcomingCount,
      completedCount,
      totalCount,
    },
    axisStartHour: DEFAULT_AXIS_START,
    axisEndHour: Math.ceil(axisEndHour),
  }
}

// ============================================
// Hook
// ============================================

const POLL_INTERVAL_MS = 60_000

export function useScheduleTimeline() {
  const { effectiveFacilityId } = useUser()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const result = useSupabaseQuery<ScheduleTimelineData>(
    async (supabase) => {
      return fetchScheduleTimeline(supabase, effectiveFacilityId!)
    },
    {
      deps: [effectiveFacilityId],
      enabled: !!effectiveFacilityId,
    }
  )

  // Set up 60-second polling
  const { refetch } = result
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      refetch()
    }, POLL_INTERVAL_MS)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [refetch])

  return result
}
