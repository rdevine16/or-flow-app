// types/room-scheduling.ts
// Type definitions for room date assignment scheduling (Room Schedule feature)

// =====================================================
// DATABASE TYPES
// =====================================================

/** A surgeon assigned to a room on a specific date */
export interface RoomDateAssignment {
  id: string
  facility_id: string
  or_room_id: string
  assignment_date: string // "2026-03-10"
  surgeon_id: string
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  // Joined data
  surgeon?: {
    id: string
    first_name: string
    last_name: string
  }
  room?: {
    id: string
    name: string
  }
}

/** Staff member assigned to a room-date slot */
export interface RoomDateStaff {
  id: string
  room_date_assignment_id: string | null
  facility_id: string
  or_room_id: string
  assignment_date: string // "2026-03-10"
  user_id: string
  role_id: string
  created_at: string
  // Joined data
  user?: {
    id: string
    first_name: string
    last_name: string
  }
  role?: {
    id: string
    name: string
  }
}

// =====================================================
// AGGREGATED TYPES (for UI consumption)
// =====================================================

/** All assignments for a single room on a single date */
export interface RoomDayCellData {
  roomId: string
  date: string
  surgeons: RoomDateAssignment[]
  staff: RoomDateStaff[]
}

/** Assignments indexed by "roomId:date" for fast cell lookup */
export type RoomDateAssignmentMap = Record<string, RoomDayCellData>

// =====================================================
// INPUT TYPES (for CRUD operations)
// =====================================================

export interface AssignSurgeonInput {
  or_room_id: string
  assignment_date: string
  surgeon_id: string
  notes?: string | null
}

export interface AssignStaffInput {
  or_room_id: string
  assignment_date: string
  user_id: string
  role_id: string
  room_date_assignment_id?: string | null
}

// =====================================================
// DRAG-AND-DROP TYPES (dnd-kit)
// =====================================================

/** Data attached to a draggable surgeon card */
export interface SurgeonDragData {
  type: 'surgeon'
  surgeonId: string
  surgeon: {
    id: string
    first_name: string
    last_name: string
  }
}

/** Data attached to a draggable staff card */
export interface StaffDragData {
  type: 'staff'
  userId: string
  roleId: string
  user: {
    id: string
    first_name: string
    last_name: string
  }
  roleName: string
}

/** Data attached to a droppable room-day cell */
export interface RoomDayDropData {
  type: 'room-day'
  roomId: string
  date: string
  roomName: string
}

/** Union of all drag data types */
export type RoomScheduleDragData = SurgeonDragData | StaffDragData

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/** Build a lookup key for room-date cells */
export function roomDateKey(roomId: string, date: string): string {
  return `${roomId}:${date}`
}

/** Build a RoomDateAssignmentMap from flat arrays */
export function buildAssignmentMap(
  assignments: RoomDateAssignment[],
  staffAssignments: RoomDateStaff[]
): RoomDateAssignmentMap {
  const map: RoomDateAssignmentMap = {}

  for (const a of assignments) {
    const key = roomDateKey(a.or_room_id, a.assignment_date)
    if (!map[key]) {
      map[key] = { roomId: a.or_room_id, date: a.assignment_date, surgeons: [], staff: [] }
    }
    map[key].surgeons.push(a)
  }

  for (const s of staffAssignments) {
    const key = roomDateKey(s.or_room_id, s.assignment_date)
    if (!map[key]) {
      map[key] = { roomId: s.or_room_id, date: s.assignment_date, surgeons: [], staff: [] }
    }
    map[key].staff.push(s)
  }

  return map
}
