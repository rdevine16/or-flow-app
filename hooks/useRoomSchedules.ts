// hooks/useRoomSchedules.ts
// Manages per-day-of-week room open/close schedules

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { roomScheduleAudit } from '@/lib/audit-logger'
import { logger } from '@/lib/logger'

const log = logger('useRoomSchedules')

export interface RoomScheduleRow {
  id: string
  facility_id: string
  or_room_id: string
  day_of_week: number  // 0=Sun, 6=Sat
  open_time: string    // "07:00:00"
  close_time: string   // "17:00:00"
  is_closed: boolean
  effective_start: string
  effective_end: string | null
}

export interface RoomDaySchedule {
  dayOfWeek: number
  openTime: string
  closeTime: string
  isClosed: boolean
}

export const DAY_LABELS: Record<number, string> = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
}

export const DAY_LABELS_SHORT: Record<number, string> = {
  0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat',
}

/** Default schedule: Mon-Fri 7am-5pm, weekends closed */
export function getDefaultWeekSchedule(): RoomDaySchedule[] {
  return [0, 1, 2, 3, 4, 5, 6].map(day => ({
    dayOfWeek: day,
    openTime: '07:00:00',
    closeTime: '17:00:00',
    isClosed: day === 0 || day === 6,
  }))
}

interface UseRoomSchedulesOptions {
  facilityId: string | null
}

export function useRoomSchedules({ facilityId }: UseRoomSchedulesOptions) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Fetch the current active schedule for a room.
   * Returns 7 entries (one per day of week), using the most recent
   * effective schedule for each day.
   */
  const fetchRoomSchedule = useCallback(async (roomId: string): Promise<RoomDaySchedule[]> => {
    if (!facilityId) return getDefaultWeekSchedule()

    try {
      const today = new Date().toISOString().split('T')[0]

      const { data, error: fetchError } = await supabase
        .from('room_schedules')
        .select('*')
        .eq('or_room_id', roomId)
        .eq('facility_id', facilityId)
        .lte('effective_start', today)
        .or(`effective_end.is.null,effective_end.gte.${today}`)
        .order('day_of_week')
        .order('effective_start', { ascending: false })

      if (fetchError) throw fetchError

      if (!data || data.length === 0) {
        return getDefaultWeekSchedule()
      }

      // Group by day_of_week, take the most recent (first due to sort order)
      const byDay = new Map<number, RoomScheduleRow>()
      for (const row of data as RoomScheduleRow[]) {
        if (!byDay.has(row.day_of_week)) {
          byDay.set(row.day_of_week, row)
        }
      }

      // Build full 7-day schedule, using defaults for missing days
      const defaults = getDefaultWeekSchedule()
      return defaults.map(def => {
        const existing = byDay.get(def.dayOfWeek)
        if (existing) {
          return {
            dayOfWeek: existing.day_of_week,
            openTime: existing.open_time,
            closeTime: existing.close_time,
            isClosed: existing.is_closed,
          }
        }
        return def
      })
    } catch (err) {
      log.error('Error fetching room schedule:', err)
      return getDefaultWeekSchedule()
    }
  }, [facilityId, supabase])

  /**
   * Fetch schedules for ALL rooms in the facility.
   * Returns a Map of roomId -> RoomDaySchedule[]
   */
  const fetchAllRoomSchedules = useCallback(async (): Promise<Map<string, RoomDaySchedule[]>> => {
    if (!facilityId) return new Map()

    try {
      const today = new Date().toISOString().split('T')[0]

      const { data, error: fetchError } = await supabase
        .from('room_schedules')
        .select('*')
        .eq('facility_id', facilityId)
        .lte('effective_start', today)
        .or(`effective_end.is.null,effective_end.gte.${today}`)
        .order('effective_start', { ascending: false })

      if (fetchError) throw fetchError

      // Group by room, then by day, taking most recent effective schedule
      const roomMap = new Map<string, Map<number, RoomScheduleRow>>()
      for (const row of (data || []) as RoomScheduleRow[]) {
        if (!roomMap.has(row.or_room_id)) {
          roomMap.set(row.or_room_id, new Map())
        }
        const dayMap = roomMap.get(row.or_room_id)!
        if (!dayMap.has(row.day_of_week)) {
          dayMap.set(row.day_of_week, row)
        }
      }

      const result = new Map<string, RoomDaySchedule[]>()
      for (const [roomId, dayMap] of roomMap.entries()) {
        const defaults = getDefaultWeekSchedule()
        result.set(roomId, defaults.map(def => {
          const existing = dayMap.get(def.dayOfWeek)
          if (existing) {
            return {
              dayOfWeek: existing.day_of_week,
              openTime: existing.open_time,
              closeTime: existing.close_time,
              isClosed: existing.is_closed,
            }
          }
          return def
        }))
      }

      return result
    } catch (err) {
      log.error('Error fetching all room schedules:', err)
      return new Map()
    }
  }, [facilityId, supabase])

  /**
   * Save a complete 7-day schedule for a room.
   * Ends any existing active schedules and creates new ones effective today.
   */
  const saveRoomSchedule = useCallback(async (
    roomId: string,
    schedule: RoomDaySchedule[],
    effectiveDate?: string,
    roomName?: string
  ): Promise<boolean> => {
    if (!facilityId) return false

    setLoading(true)
    setError(null)

    try {
      const effDate = effectiveDate || new Date().toISOString().split('T')[0]
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = yesterday.toISOString().split('T')[0]

      // Capture the old schedule BEFORE we overwrite it (for audit logging)
      const oldSchedule = await fetchRoomSchedule(roomId)

      // End all current active schedules for this room (set effective_end to yesterday)
      const { error: endError } = await supabase
        .from('room_schedules')
        .update({
          effective_end: yesterdayStr,
          updated_at: new Date().toISOString(),
        })
        .eq('or_room_id', roomId)
        .eq('facility_id', facilityId)
        .is('effective_end', null)

      if (endError) throw endError

      // Insert new schedule rows for all 7 days
      const rows = schedule.map(day => ({
        facility_id: facilityId,
        or_room_id: roomId,
        day_of_week: day.dayOfWeek,
        open_time: day.openTime,
        close_time: day.closeTime,
        is_closed: day.isClosed,
        effective_start: effDate,
        effective_end: null,
      }))

      const { error: insertError } = await supabase
        .from('room_schedules')
        .insert(rows)

      if (insertError) throw insertError

      // Also update the legacy available_hours on or_rooms for backward compatibility
      // Use the average of open weekday hours
      const openDays = schedule.filter(d => !d.isClosed)
      if (openDays.length > 0) {
        const avgHours = openDays.reduce((sum, d) => {
          const [oh, om] = d.openTime.split(':').map(Number)
          const [ch, cm] = d.closeTime.split(':').map(Number)
          return sum + (ch + cm / 60) - (oh + om / 60)
        }, 0) / openDays.length

        await supabase
          .from('or_rooms')
          .update({ available_hours: Math.round(avgHours * 10) / 10 })
          .eq('id', roomId)
      }

      // Audit log: record the schedule change
      const formatForAudit = (sched: RoomDaySchedule[]) =>
        sched.map(d => ({
          day: DAY_LABELS[d.dayOfWeek],
          open: d.openTime,
          close: d.closeTime,
          closed: d.isClosed,
        }))

      await roomScheduleAudit.updated(
        supabase,
        roomId,
        roomName || roomId,
        formatForAudit(oldSchedule),
        formatForAudit(schedule),
        facilityId,
        effDate
      )

      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save room schedule'
      setError(message)
      log.error('Error saving room schedule:', err)
      return false
    } finally {
      setLoading(false)
    }
  }, [facilityId, supabase])

  /**
   * Get available minutes for a specific room on a specific date.
   * Used by analytics calculations.
   */
  const getRoomMinutesForDate = useCallback(async (
    roomId: string,
    date: string
  ): Promise<number> => {
    if (!facilityId) return 0

    try {
      const dow = new Date(date + 'T12:00:00').getDay()

      const { data, error: fetchError } = await supabase
        .from('room_schedules')
        .select('open_time, close_time, is_closed')
        .eq('or_room_id', roomId)
        .eq('day_of_week', dow)
        .lte('effective_start', date)
        .or(`effective_end.is.null,effective_end.gte.${date}`)
        .order('effective_start', { ascending: false })
        .limit(1)
        .single()

      if (fetchError || !data || data.is_closed) return 0

      const [oh, om] = data.open_time.split(':').map(Number)
      const [ch, cm] = data.close_time.split(':').map(Number)
      return (ch * 60 + cm) - (oh * 60 + om)
    } catch {
      return 0
    }
  }, [facilityId, supabase])

  return {
    loading,
    error,
    fetchRoomSchedule,
    fetchAllRoomSchedules,
    saveRoomSchedule,
    getRoomMinutesForDate,
  }
}