// hooks/useRoomDateAssignments.ts
// CRUD hook for room date assignments (surgeon + staff to rooms on specific dates)

import { useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { roomScheduleAudit } from '@/lib/audit-logger'
import { logger } from '@/lib/logger'
import type {
  RoomDateAssignment,
  RoomDateStaff,
  AssignSurgeonInput,
  AssignStaffInput,
} from '@/types/room-scheduling'

const log = logger('useRoomDateAssignments')

interface UseRoomDateAssignmentsOptions {
  facilityId: string | null
}

export function useRoomDateAssignments({ facilityId }: UseRoomDateAssignmentsOptions) {
  const supabase = useMemo(() => createClient(), [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [assignments, setAssignments] = useState<RoomDateAssignment[]>([])
  const [staffAssignments, setStaffAssignments] = useState<RoomDateStaff[]>([])

  // =========================================================
  // FETCH — all assignments + staff for a date range
  // =========================================================

  const fetchWeek = useCallback(
    async (startDate: string, endDate: string) => {
      if (!facilityId) return

      setLoading(true)
      setError(null)

      try {
        const [assignmentsResult, staffResult] = await Promise.all([
          supabase
            .from('room_date_assignments')
            .select(`
              *,
              surgeon:users!room_date_assignments_surgeon_id_fkey(id, first_name, last_name),
              room:or_rooms!room_date_assignments_or_room_id_fkey(id, name)
            `)
            .eq('facility_id', facilityId)
            .gte('assignment_date', startDate)
            .lte('assignment_date', endDate)
            .order('assignment_date'),
          supabase
            .from('room_date_staff')
            .select(`
              *,
              user:users!room_date_staff_user_id_fkey(id, first_name, last_name),
              role:user_roles!room_date_staff_role_id_fkey(id, name)
            `)
            .eq('facility_id', facilityId)
            .gte('assignment_date', startDate)
            .lte('assignment_date', endDate)
            .order('assignment_date'),
        ])

        if (assignmentsResult.error) throw assignmentsResult.error
        if (staffResult.error) throw staffResult.error

        setAssignments(assignmentsResult.data || [])
        setStaffAssignments(staffResult.data || [])
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch room assignments'
        setError(message)
        log.error('Error fetching room assignments:', err)
      } finally {
        setLoading(false)
      }
    },
    [facilityId, supabase]
  )

  // =========================================================
  // ASSIGN SURGEON to a room-date
  // =========================================================

  const assignSurgeon = useCallback(
    async (input: AssignSurgeonInput): Promise<RoomDateAssignment | null> => {
      if (!facilityId) return null

      setLoading(true)
      setError(null)

      try {
        const { data, error: insertError } = await supabase
          .from('room_date_assignments')
          .insert({
            facility_id: facilityId,
            or_room_id: input.or_room_id,
            assignment_date: input.assignment_date,
            surgeon_id: input.surgeon_id,
            notes: input.notes ?? null,
          })
          .select(`
            *,
            surgeon:users!room_date_assignments_surgeon_id_fkey(id, first_name, last_name),
            room:or_rooms!room_date_assignments_or_room_id_fkey(id, name)
          `)
          .single()

        if (insertError) throw insertError

        await roomScheduleAudit.surgeonAssigned(
          supabase,
          data.id,
          `Dr. ${data.surgeon?.last_name ?? 'Unknown'}`,
          data.room?.name ?? 'Unknown Room',
          input.assignment_date,
          facilityId
        )

        setAssignments((prev) => [...prev, data])
        return data
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to assign surgeon'
        setError(message)
        log.error('Error assigning surgeon:', err)
        return null
      } finally {
        setLoading(false)
      }
    },
    [facilityId, supabase]
  )

  // =========================================================
  // REMOVE SURGEON from a room-date (cascades staff via FK)
  // =========================================================

  const removeSurgeon = useCallback(
    async (assignmentId: string): Promise<boolean> => {
      if (!facilityId) return false

      setLoading(true)
      setError(null)

      try {
        // Fetch assignment details for audit before deleting
        const existing = assignments.find((a) => a.id === assignmentId)

        const { error: deleteError } = await supabase
          .from('room_date_assignments')
          .delete()
          .eq('id', assignmentId)

        if (deleteError) throw deleteError

        if (existing) {
          await roomScheduleAudit.surgeonRemoved(
            supabase,
            assignmentId,
            `Dr. ${existing.surgeon?.last_name ?? 'Unknown'}`,
            existing.room?.name ?? 'Unknown Room',
            existing.assignment_date,
            facilityId
          )
        }

        // Remove from local state (cascade removes staff too)
        setAssignments((prev) => prev.filter((a) => a.id !== assignmentId))
        setStaffAssignments((prev) =>
          prev.filter((s) => s.room_date_assignment_id !== assignmentId)
        )

        return true
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to remove surgeon'
        setError(message)
        log.error('Error removing surgeon:', err)
        return false
      } finally {
        setLoading(false)
      }
    },
    [facilityId, supabase, assignments]
  )

  // =========================================================
  // ASSIGN STAFF to a room-date
  // =========================================================

  const assignStaff = useCallback(
    async (input: AssignStaffInput): Promise<RoomDateStaff | null> => {
      if (!facilityId) return null

      setLoading(true)
      setError(null)

      try {
        const { data, error: insertError } = await supabase
          .from('room_date_staff')
          .insert({
            facility_id: facilityId,
            or_room_id: input.or_room_id,
            assignment_date: input.assignment_date,
            user_id: input.user_id,
            role_id: input.role_id,
            room_date_assignment_id: input.room_date_assignment_id ?? null,
          })
          .select(`
            *,
            user:users!room_date_staff_user_id_fkey(id, first_name, last_name),
            role:user_roles!room_date_staff_role_id_fkey(id, name)
          `)
          .single()

        if (insertError) throw insertError

        await roomScheduleAudit.staffAssigned(
          supabase,
          data.id,
          `${data.user?.first_name ?? ''} ${data.user?.last_name ?? ''}`.trim(),
          data.role?.name ?? 'Unknown Role',
          input.or_room_id,
          input.assignment_date,
          facilityId
        )

        setStaffAssignments((prev) => [...prev, data])
        return data
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to assign staff'
        setError(message)
        log.error('Error assigning staff:', err)
        return null
      } finally {
        setLoading(false)
      }
    },
    [facilityId, supabase]
  )

  // =========================================================
  // REMOVE STAFF from a room-date
  // =========================================================

  const removeStaff = useCallback(
    async (staffId: string): Promise<boolean> => {
      if (!facilityId) return false

      setLoading(true)
      setError(null)

      try {
        const existing = staffAssignments.find((s) => s.id === staffId)

        const { error: deleteError } = await supabase
          .from('room_date_staff')
          .delete()
          .eq('id', staffId)

        if (deleteError) throw deleteError

        if (existing) {
          await roomScheduleAudit.staffRemoved(
            supabase,
            staffId,
            `${existing.user?.first_name ?? ''} ${existing.user?.last_name ?? ''}`.trim(),
            existing.role?.name ?? 'Unknown Role',
            existing.or_room_id,
            existing.assignment_date,
            facilityId
          )
        }

        setStaffAssignments((prev) => prev.filter((s) => s.id !== staffId))
        return true
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to remove staff'
        setError(message)
        log.error('Error removing staff:', err)
        return false
      } finally {
        setLoading(false)
      }
    },
    [facilityId, supabase, staffAssignments]
  )

  // =========================================================
  // CLONE DAY — copy all assignments from one date to another
  // =========================================================

  const cloneDay = useCallback(
    async (sourceDate: string, targetDate: string): Promise<boolean> => {
      if (!facilityId) return false

      setLoading(true)
      setError(null)

      try {
        // 1. Fetch source assignments + staff
        const [srcAssignments, srcStaff] = await Promise.all([
          supabase
            .from('room_date_assignments')
            .select('or_room_id, surgeon_id, notes')
            .eq('facility_id', facilityId)
            .eq('assignment_date', sourceDate),
          supabase
            .from('room_date_staff')
            .select('or_room_id, user_id, role_id')
            .eq('facility_id', facilityId)
            .eq('assignment_date', sourceDate),
        ])

        if (srcAssignments.error) throw srcAssignments.error
        if (srcStaff.error) throw srcStaff.error

        // 2. Delete existing target assignments (cascade deletes staff)
        const { error: deleteError } = await supabase
          .from('room_date_assignments')
          .delete()
          .eq('facility_id', facilityId)
          .eq('assignment_date', targetDate)

        if (deleteError) throw deleteError

        // Also delete orphan staff on target date (staff without surgeon assignment)
        const { error: deleteStaffError } = await supabase
          .from('room_date_staff')
          .delete()
          .eq('facility_id', facilityId)
          .eq('assignment_date', targetDate)

        if (deleteStaffError) throw deleteStaffError

        // 3. Insert cloned surgeon assignments
        if (srcAssignments.data && srcAssignments.data.length > 0) {
          const surgeonInserts = srcAssignments.data.map((a) => ({
            facility_id: facilityId,
            or_room_id: a.or_room_id,
            assignment_date: targetDate,
            surgeon_id: a.surgeon_id,
            notes: a.notes,
          }))

          const { data: newAssignments, error: insertError } = await supabase
            .from('room_date_assignments')
            .insert(surgeonInserts)
            .select('id, or_room_id, surgeon_id')

          if (insertError) throw insertError

          // 4. Insert cloned staff, linking to new surgeon assignments where applicable
          if (srcStaff.data && srcStaff.data.length > 0 && newAssignments) {
            // Build a map: or_room_id -> new assignment id
            const roomToAssignmentId = new Map<string, string>()
            for (const na of newAssignments) {
              roomToAssignmentId.set(na.or_room_id, na.id)
            }

            const staffInserts = srcStaff.data.map((s) => ({
              facility_id: facilityId,
              or_room_id: s.or_room_id,
              assignment_date: targetDate,
              user_id: s.user_id,
              role_id: s.role_id,
              room_date_assignment_id: roomToAssignmentId.get(s.or_room_id) ?? null,
            }))

            const { error: staffInsertError } = await supabase
              .from('room_date_staff')
              .insert(staffInserts)

            if (staffInsertError) throw staffInsertError
          }
        } else if (srcStaff.data && srcStaff.data.length > 0) {
          // Staff without surgeon assignments
          const staffInserts = srcStaff.data.map((s) => ({
            facility_id: facilityId,
            or_room_id: s.or_room_id,
            assignment_date: targetDate,
            user_id: s.user_id,
            role_id: s.role_id,
          }))

          const { error: staffInsertError } = await supabase
            .from('room_date_staff')
            .insert(staffInserts)

          if (staffInsertError) throw staffInsertError
        }

        await roomScheduleAudit.dayCloned(supabase, sourceDate, targetDate, facilityId)

        return true
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to clone day'
        setError(message)
        log.error('Error cloning day:', err)
        return false
      } finally {
        setLoading(false)
      }
    },
    [facilityId, supabase]
  )

  // =========================================================
  // CLONE WEEK — clone 7 days from source week to target week
  // =========================================================

  const cloneWeek = useCallback(
    async (sourceWeekStart: string, targetWeekStart: string): Promise<boolean> => {
      if (!facilityId) return false

      setLoading(true)
      setError(null)

      try {
        // Clone each day of the week (0-6, Sun-Sat)
        for (let i = 0; i < 7; i++) {
          const sourceDate = addDays(sourceWeekStart, i)
          const targetDate = addDays(targetWeekStart, i)
          // Use inline logic instead of recursive call to avoid state thrash
          const [srcAssignments, srcStaff] = await Promise.all([
            supabase
              .from('room_date_assignments')
              .select('or_room_id, surgeon_id, notes')
              .eq('facility_id', facilityId)
              .eq('assignment_date', sourceDate),
            supabase
              .from('room_date_staff')
              .select('or_room_id, user_id, role_id')
              .eq('facility_id', facilityId)
              .eq('assignment_date', sourceDate),
          ])

          if (srcAssignments.error) throw srcAssignments.error
          if (srcStaff.error) throw srcStaff.error

          // Delete target day
          await supabase
            .from('room_date_assignments')
            .delete()
            .eq('facility_id', facilityId)
            .eq('assignment_date', targetDate)

          await supabase
            .from('room_date_staff')
            .delete()
            .eq('facility_id', facilityId)
            .eq('assignment_date', targetDate)

          // Insert cloned surgeon assignments
          if (srcAssignments.data && srcAssignments.data.length > 0) {
            const surgeonInserts = srcAssignments.data.map((a) => ({
              facility_id: facilityId,
              or_room_id: a.or_room_id,
              assignment_date: targetDate,
              surgeon_id: a.surgeon_id,
              notes: a.notes,
            }))

            const { data: newAssignments, error: insertError } = await supabase
              .from('room_date_assignments')
              .insert(surgeonInserts)
              .select('id, or_room_id, surgeon_id')

            if (insertError) throw insertError

            if (srcStaff.data && srcStaff.data.length > 0 && newAssignments) {
              const roomToAssignmentId = new Map<string, string>()
              for (const na of newAssignments) {
                roomToAssignmentId.set(na.or_room_id, na.id)
              }

              const staffInserts = srcStaff.data.map((s) => ({
                facility_id: facilityId,
                or_room_id: s.or_room_id,
                assignment_date: targetDate,
                user_id: s.user_id,
                role_id: s.role_id,
                room_date_assignment_id: roomToAssignmentId.get(s.or_room_id) ?? null,
              }))

              const { error: staffInsertError } = await supabase
                .from('room_date_staff')
                .insert(staffInserts)

              if (staffInsertError) throw staffInsertError
            }
          } else if (srcStaff.data && srcStaff.data.length > 0) {
            const staffInserts = srcStaff.data.map((s) => ({
              facility_id: facilityId,
              or_room_id: s.or_room_id,
              assignment_date: targetDate,
              user_id: s.user_id,
              role_id: s.role_id,
            }))

            const { error: staffInsertError } = await supabase
              .from('room_date_staff')
              .insert(staffInserts)

            if (staffInsertError) throw staffInsertError
          }
        }

        await roomScheduleAudit.weekCloned(supabase, sourceWeekStart, targetWeekStart, facilityId)

        return true
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to clone week'
        setError(message)
        log.error('Error cloning week:', err)
        return false
      } finally {
        setLoading(false)
      }
    },
    [facilityId, supabase]
  )

  return {
    assignments,
    staffAssignments,
    loading,
    error,
    fetchWeek,
    assignSurgeon,
    removeSurgeon,
    assignStaff,
    removeStaff,
    cloneDay,
    cloneWeek,
  }
}

// =========================================================
// UTILITY — add days to a date string
// =========================================================

function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr + 'T00:00:00')
  date.setDate(date.getDate() + days)
  return date.toISOString().split('T')[0]
}
