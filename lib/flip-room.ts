// lib/flip-room.ts
// Pure utility functions for flip room status card
// Finds surgeon's next case in a different room and computes milestone status

// ============================================================================
// TYPES
// ============================================================================

export interface SurgeonDayCase {
  id: string
  case_number: string
  or_room_id: string | null
  room_name: string | null
  start_time: string | null
  status_name: string
  procedure_name: string | null
  called_back_at: string | null
}

export interface FlipRoomResult {
  /** Next case in a DIFFERENT room — shown as full flip room card */
  flipCase: SurgeonDayCase | null
  /** Next case in the SAME room — shown as inline "Next: Case #X (same room)" note */
  nextSameRoomCase: SurgeonDayCase | null
}

export interface FlipRoomMilestoneData {
  facility_milestone_id: string
  recorded_at: string | null
  display_name: string
  display_order: number
  name: string
}

export interface CurrentMilestoneStatus {
  milestoneName: string
  milestoneDisplayName: string
  recordedAt: string
  elapsedMs: number
}

// ============================================================================
// FIND NEXT CASE
// ============================================================================

/**
 * Find the surgeon's next case in sequence after the current one.
 *
 * - Filters out cancelled and completed cases
 * - Sorts by start_time ascending
 * - If the next case is in a different room → returns as flipCase
 * - If the next case is in the same room → returns as nextSameRoomCase
 * - If neither case has a room assigned → returns null for both
 */
export function findNextCase(
  surgeonCases: SurgeonDayCase[],
  currentCaseId: string,
  currentRoomId: string | null,
): FlipRoomResult {
  const active = [...surgeonCases]
    .filter(c => c.status_name !== 'cancelled' && c.status_name !== 'completed')
    .sort((a, b) => {
      if (!a.start_time && !b.start_time) return 0
      if (!a.start_time) return 1
      if (!b.start_time) return -1
      return a.start_time.localeCompare(b.start_time)
    })

  const currentIndex = active.findIndex(c => c.id === currentCaseId)
  if (currentIndex === -1 || currentIndex >= active.length - 1) {
    return { flipCase: null, nextSameRoomCase: null }
  }

  const next = active[currentIndex + 1]

  // Can't determine flip vs same room if either case has no room
  if (!currentRoomId || !next.or_room_id) {
    return { flipCase: null, nextSameRoomCase: null }
  }

  if (next.or_room_id !== currentRoomId) {
    return { flipCase: next, nextSameRoomCase: null }
  }

  return { flipCase: null, nextSameRoomCase: next }
}

// ============================================================================
// CURRENT MILESTONE STATUS
// ============================================================================

/**
 * Get the current (most recent) milestone status for a flip room case.
 * Returns the highest-display-order recorded milestone with elapsed time.
 */
export function getCurrentMilestoneStatus(
  milestones: FlipRoomMilestoneData[],
  currentTime: number,
): CurrentMilestoneStatus | null {
  const recorded = milestones
    .filter(m => m.recorded_at !== null)
    .sort((a, b) => b.display_order - a.display_order)

  if (recorded.length === 0) return null

  const last = recorded[0]
  return {
    milestoneName: last.name,
    milestoneDisplayName: last.display_name,
    recordedAt: last.recorded_at!,
    elapsedMs: currentTime - new Date(last.recorded_at!).getTime(),
  }
}
