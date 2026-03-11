/**
 * Room Schedule Data Access Layer
 *
 * Fetches room date assignments and staff for case form pre-fill.
 * When a user selects a room + date in the case form, this DAL
 * queries the room_date_assignments and room_date_staff tables
 * to suggest surgeon and staff pre-fills.
 */

import type { AnySupabaseClient, DALResult } from './index'

// ============================================
// TYPES
// ============================================

export interface RoomDatePreFill {
  surgeons: { surgeon_id: string; notes: string | null }[]
  staff: { user_id: string; role_id: string }[]
}

// ============================================
// DAL FUNCTIONS
// ============================================

export const roomScheduleDAL = {
  /**
   * Fetch surgeon and staff assignments for a specific room + date.
   * Used by CaseForm to pre-fill surgeon and staff when room/date are selected.
   */
  async fetchRoomDatePreFill(
    supabase: AnySupabaseClient,
    facilityId: string,
    roomId: string,
    date: string,
  ): Promise<DALResult<RoomDatePreFill>> {
    // Fetch surgeon assignments for this room + date
    const { data: surgeonData, error: surgeonError } = await supabase
      .from('room_date_assignments')
      .select('surgeon_id, notes')
      .eq('facility_id', facilityId)
      .eq('or_room_id', roomId)
      .eq('assignment_date', date)

    if (surgeonError) {
      return { data: null, error: surgeonError }
    }

    // Fetch staff assignments for this room + date
    const { data: staffData, error: staffError } = await supabase
      .from('room_date_staff')
      .select('user_id, role_id')
      .eq('facility_id', facilityId)
      .eq('or_room_id', roomId)
      .eq('assignment_date', date)

    if (staffError) {
      return { data: null, error: staffError }
    }

    return {
      data: {
        surgeons: (surgeonData as unknown as { surgeon_id: string; notes: string | null }[]) || [],
        staff: (staffData as unknown as { user_id: string; role_id: string }[]) || [],
      },
      error: null,
    }
  },
}
