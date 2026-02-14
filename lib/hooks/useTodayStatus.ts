// lib/hooks/useTodayStatus.ts
// Data fetching hook for Room Status cards and Today's Surgeons list.
// Fetches today's cases with room/surgeon joins, derives room status and surgeon schedules.

import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { useUser } from '@/lib/UserContext'
import { getLocalDateString } from '@/lib/date-utils'
import { casesDAL, facilitiesDAL } from '@/lib/dal'
import type { CaseListItem } from '@/lib/dal/cases'
import { getGrade, type GradeInfo } from '@/lib/orbitScoreEngine'
import { logger } from '@/lib/logger'

const log = logger('useTodayStatus')

// ============================================
// Types
// ============================================

export type RoomStatus = 'in_case' | 'turning_over' | 'idle' | 'done'

export interface RoomStatusData {
  roomId: string
  roomName: string
  status: RoomStatus
  currentCase: {
    caseId: string
    surgeonName: string
    procedureName: string
  } | null
  nextCase: {
    caseId: string
    surgeonName: string
    startTime: string | null
  } | null
  completedCases: number
  totalCases: number
}

export interface TodaySurgeonData {
  surgeonId: string
  surgeonName: string
  firstName: string
  lastName: string
  casesRemaining: number
  casesTotal: number
  grade: GradeInfo | null
  compositeScore: number | null
}

export interface TodayStatusData {
  rooms: RoomStatusData[]
  surgeons: TodaySurgeonData[]
}

// ============================================
// Status derivation helpers
// ============================================

function getSurgeonName(surgeon: CaseListItem['surgeon']): string {
  if (!surgeon) return 'Unassigned'
  // Supabase join may return array or object
  const s = Array.isArray(surgeon) ? surgeon[0] : surgeon
  if (!s) return 'Unassigned'
  return `Dr. ${s.last_name}`
}

function getSurgeonParts(surgeon: CaseListItem['surgeon']): { firstName: string; lastName: string } {
  if (!surgeon) return { firstName: '', lastName: '' }
  const s = Array.isArray(surgeon) ? surgeon[0] : surgeon
  if (!s) return { firstName: '', lastName: '' }
  return { firstName: s.first_name, lastName: s.last_name }
}

function getCaseStatusName(caseItem: CaseListItem): string {
  const cs = caseItem.case_status
  if (!cs) return ''
  const status = Array.isArray(cs) ? cs[0] : cs
  return status?.name ?? ''
}

function getProcedureName(caseItem: CaseListItem): string {
  const proc = caseItem.procedure_type
  if (!proc) return 'Unknown procedure'
  // Supabase join may return array or object
  const p = Array.isArray(proc) ? proc[0] : proc
  return p?.name ?? 'Unknown procedure'
}

function deriveRoomStatus(
  roomCases: CaseListItem[],
): RoomStatus {
  const hasInProgress = roomCases.some(c => getCaseStatusName(c) === 'in_progress')
  if (hasInProgress) return 'in_case'

  const totalCases = roomCases.length
  const completedCases = roomCases.filter(c => getCaseStatusName(c) === 'completed').length
  const scheduledCases = roomCases.filter(c => getCaseStatusName(c) === 'scheduled').length

  if (totalCases > 0 && completedCases === totalCases) return 'done'
  if (completedCases > 0 && scheduledCases > 0) return 'turning_over'
  if (scheduledCases > 0) return 'idle'

  return 'idle'
}

function formatTime12h(time: string | null): string {
  if (!time) return ''
  const [hours, minutes] = time.split(':')
  const hour = parseInt(hours, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${minutes} ${ampm}`
}

// ============================================
// Main query function
// ============================================

type SupabaseClient = Parameters<Parameters<typeof useSupabaseQuery>[0]>[0]

async function fetchTodayStatus(
  supabase: SupabaseClient,
  facilityId: string,
): Promise<TodayStatusData> {
  const todayStr = getLocalDateString()

  // Fetch today's cases and active rooms in parallel
  const [casesResult, roomsResult] = await Promise.all([
    casesDAL.listByDate(supabase, facilityId, todayStr),
    facilitiesDAL.getRooms(supabase, facilityId),
  ])

  if (casesResult.error) {
    log.error('Failed to fetch today cases', { error: casesResult.error.message })
    throw new Error(casesResult.error.message)
  }

  if (roomsResult.error) {
    log.error('Failed to fetch rooms', { error: roomsResult.error.message })
    throw new Error(roomsResult.error.message)
  }

  const cases = casesResult.data
  const rooms = roomsResult.data

  // Group cases by room
  const casesByRoom = new Map<string, CaseListItem[]>()
  for (const c of cases) {
    if (!c.or_room_id) continue
    const existing = casesByRoom.get(c.or_room_id) ?? []
    existing.push(c)
    casesByRoom.set(c.or_room_id, existing)
  }

  // Build room status data
  const roomStatuses: RoomStatusData[] = rooms.map((room) => {
    const roomCases = casesByRoom.get(room.id) ?? []
    const status = deriveRoomStatus(roomCases)

    const completedCases = roomCases.filter(c => getCaseStatusName(c) === 'completed').length

    // Find current in-progress case
    const inProgressCase = roomCases.find(c => getCaseStatusName(c) === 'in_progress')
    const currentCase = inProgressCase
      ? {
          caseId: inProgressCase.id,
          surgeonName: getSurgeonName(inProgressCase.surgeon),
          procedureName: getProcedureName(inProgressCase),
        }
      : null

    // Find next scheduled case
    const scheduledCases = roomCases
      .filter(c => getCaseStatusName(c) === 'scheduled')
      .sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? ''))

    const nextScheduled = scheduledCases[0] ?? null
    const nextCase = nextScheduled
      ? {
          caseId: nextScheduled.id,
          surgeonName: getSurgeonName(nextScheduled.surgeon),
          startTime: nextScheduled.start_time
            ? formatTime12h(nextScheduled.start_time)
            : null,
        }
      : null

    return {
      roomId: room.id,
      roomName: room.name,
      status,
      currentCase,
      nextCase,
      completedCases,
      totalCases: roomCases.length,
    }
  })

  // Filter out rooms with no cases today (show only active rooms)
  const activeRooms = roomStatuses.filter(r => r.totalCases > 0)

  // Build surgeon data
  const casesBySurgeon = new Map<string, CaseListItem[]>()
  for (const c of cases) {
    if (!c.surgeon_id) continue
    const existing = casesBySurgeon.get(c.surgeon_id) ?? []
    existing.push(c)
    casesBySurgeon.set(c.surgeon_id, existing)
  }

  // Fetch surgeon ORbit Scores (lightweight — just composite scores)
  const surgeonIds = Array.from(casesBySurgeon.keys())
  const scoreMap = await fetchSurgeonScores(supabase, facilityId, surgeonIds)

  const surgeons: TodaySurgeonData[] = []
  for (const [surgeonId, surgeonCases] of casesBySurgeon) {
    const firstCase = surgeonCases[0]
    const parts = getSurgeonParts(firstCase.surgeon)
    const casesRemaining = surgeonCases.filter(
      c => getCaseStatusName(c) !== 'completed'
    ).length
    const scoreData = scoreMap.get(surgeonId)

    surgeons.push({
      surgeonId,
      surgeonName: `Dr. ${parts.lastName}`,
      firstName: parts.firstName,
      lastName: parts.lastName,
      casesRemaining,
      casesTotal: surgeonCases.length,
      grade: scoreData?.grade ?? null,
      compositeScore: scoreData?.composite ?? null,
    })
  }

  // Sort: most remaining cases first, then alphabetical
  surgeons.sort((a, b) => {
    if (b.casesRemaining !== a.casesRemaining) return b.casesRemaining - a.casesRemaining
    return a.lastName.localeCompare(b.lastName)
  })

  return { rooms: activeRooms, surgeons }
}

/** Fetch latest ORbit Scores for a set of surgeons */
async function fetchSurgeonScores(
  supabase: SupabaseClient,
  facilityId: string,
  surgeonIds: string[],
): Promise<Map<string, { composite: number; grade: GradeInfo }>> {
  const scoreMap = new Map<string, { composite: number; grade: GradeInfo }>()

  if (surgeonIds.length === 0) return scoreMap

  // Query the latest scorecard results if they exist
  // The surgeon_scorecards table stores pre-computed scores
  const { data, error } = await supabase
    .from('surgeon_scorecards')
    .select('surgeon_id, composite_score')
    .eq('facility_id', facilityId)
    .in('surgeon_id', surgeonIds)
    .order('created_at', { ascending: false })

  if (error) {
    // Scorecard table may not exist yet — degrade gracefully
    log.warn('Could not fetch surgeon scores', { error: error.message })
    return scoreMap
  }

  if (!data) return scoreMap

  // Take only the latest score per surgeon
  for (const row of data) {
    const sid = row.surgeon_id as string
    if (scoreMap.has(sid)) continue
    const composite = row.composite_score as number
    scoreMap.set(sid, {
      composite,
      grade: getGrade(composite),
    })
  }

  return scoreMap
}

// ============================================
// Hook
// ============================================

export function useTodayStatus() {
  const { effectiveFacilityId } = useUser()

  return useSupabaseQuery<TodayStatusData>(
    async (supabase) => {
      return fetchTodayStatus(supabase, effectiveFacilityId!)
    },
    {
      deps: [effectiveFacilityId],
      enabled: !!effectiveFacilityId,
    }
  )
}
