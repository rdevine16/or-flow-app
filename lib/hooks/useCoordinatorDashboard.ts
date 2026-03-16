// lib/hooks/useCoordinatorDashboard.ts
// Fetches data for the Coordinator-tier dashboard: today's blocks, staff,
// upcoming time-off, and upcoming holidays.

'use client'

import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { useUser } from '@/lib/UserContext'
import { getLocalDateString } from '@/lib/date-utils'
import type { FacilityHoliday } from '@/types/block-scheduling'
import { resolveHolidayDatesForRange } from '@/types/time-off'

// ============================================
// Types
// ============================================

export interface TodayBlock {
  id: string
  surgeonName: string
  startTime: string // "07:00:00"
  endTime: string   // "15:00:00"
  roomName: string | null
}

export interface StaffMember {
  id: string
  firstName: string
  lastName: string
  role: string
}

export interface UpcomingTimeOff {
  id: string
  userName: string
  requestType: string
  startDate: string
  endDate: string
}

export interface UpcomingHoliday {
  date: string
  name: string
  isPartial: boolean
  partialCloseTime: string | null
}

export interface CoordinatorDashboardData {
  blocks: TodayBlock[]
  staff: StaffMember[]
  timeOff: UpcomingTimeOff[]
  holidays: UpcomingHoliday[]
}

// ============================================
// Hook
// ============================================

export function useCoordinatorDashboard() {
  const { effectiveFacilityId } = useUser()

  const { data, loading, error } = useSupabaseQuery<CoordinatorDashboardData | null>(
    async (supabase) => {
      if (!effectiveFacilityId) return null

      const today = new Date()
      const todayStr = getLocalDateString(today)
      const dayOfWeek = today.getDay() // 0=Sun, 6=Sat
      const sevenDaysOut = new Date(today)
      sevenDaysOut.setDate(sevenDaysOut.getDate() + 7)
      const sevenDaysOutStr = getLocalDateString(sevenDaysOut)
      // Look 90 days ahead for holidays
      const ninetyDaysOut = new Date(today)
      ninetyDaysOut.setDate(ninetyDaysOut.getDate() + 90)
      const ninetyDaysOutStr = getLocalDateString(ninetyDaysOut)

      const [blocksRes, staffRes, timeOffRes, holidaysRes, timeOffTodayRes] = await Promise.all([
        // Today's blocks — join with surgeon (users) and room_date_assignments for room info
        supabase
          .from('block_schedules')
          .select(`
            id, start_time, end_time, surgeon_id,
            surgeon:users!block_schedules_surgeon_id_fkey(first_name, last_name)
          `)
          .eq('facility_id', effectiveFacilityId)
          .eq('day_of_week', dayOfWeek)
          .lte('effective_start', todayStr)
          .is('deleted_at', null)
          .or(`effective_end.is.null,effective_end.gte.${todayStr}`),

        // Active staff
        supabase
          .from('users')
          .select(`
            id, first_name, last_name,
            user_facility_roles!inner(role_id, roles(name))
          `)
          .eq('facility_id', effectiveFacilityId)
          .eq('is_active', true)
          .order('last_name'),

        // Upcoming time-off (next 7 days, approved)
        supabase
          .from('time_off_requests')
          .select(`
            id, request_type, start_date, end_date,
            user:users!time_off_requests_user_id_fkey(first_name, last_name)
          `)
          .eq('facility_id', effectiveFacilityId)
          .eq('status', 'approved')
          .eq('is_active', true)
          .lte('start_date', sevenDaysOutStr)
          .gte('end_date', todayStr)
          .order('start_date')
          .limit(10),

        // Facility holidays (recurring rules)
        supabase
          .from('facility_holidays')
          .select('*')
          .eq('facility_id', effectiveFacilityId)
          .eq('is_active', true),

        // Today's approved time-off (for "staff on duty" filtering)
        supabase
          .from('time_off_requests')
          .select('user_id, partial_day_type')
          .eq('facility_id', effectiveFacilityId)
          .eq('status', 'approved')
          .eq('is_active', true)
          .lte('start_date', todayStr)
          .gte('end_date', todayStr),
      ])

      // Build today's blocks
      type BlockRow = {
        id: string
        start_time: string
        end_time: string
        surgeon_id: string
        surgeon: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null
      }
      const blocks: TodayBlock[] = ((blocksRes.data ?? []) as BlockRow[]).map((b) => {
        const surgeon = Array.isArray(b.surgeon) ? b.surgeon[0] : b.surgeon
        return {
          id: b.id,
          surgeonName: surgeon ? `${surgeon.first_name} ${surgeon.last_name}` : 'Unknown',
          startTime: b.start_time,
          endTime: b.end_time,
          roomName: null, // Room assignment would require room_date_assignments join
        }
      })

      // Build staff list, excluding those on full-day time-off today
      const offTodayUserIds = new Set(
        ((timeOffTodayRes.data ?? []) as { user_id: string; partial_day_type: string | null }[])
          .filter((r) => !r.partial_day_type) // full-day off only
          .map((r) => r.user_id),
      )

      type StaffRow = {
        id: string
        first_name: string
        last_name: string
        user_facility_roles: { role_id: string; roles: { name: string } | { name: string }[] | null }[] | null
      }
      const staff: StaffMember[] = ((staffRes.data ?? []) as StaffRow[])
        .filter((u) => !offTodayUserIds.has(u.id))
        .map((u) => {
          const roles = u.user_facility_roles ?? []
          const firstRole = roles[0]
          const roleName = firstRole?.roles
            ? (Array.isArray(firstRole.roles) ? firstRole.roles[0]?.name : firstRole.roles.name) ?? 'Staff'
            : 'Staff'
          return {
            id: u.id,
            firstName: u.first_name,
            lastName: u.last_name,
            role: roleName,
          }
        })

      // Build upcoming time-off
      type TimeOffRow = {
        id: string
        request_type: string
        start_date: string
        end_date: string
        user: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null
      }
      const timeOff: UpcomingTimeOff[] = ((timeOffRes.data ?? []) as TimeOffRow[]).map((r) => {
        const user = Array.isArray(r.user) ? r.user[0] : r.user
        return {
          id: r.id,
          userName: user ? `${user.first_name} ${user.last_name}` : 'Unknown',
          requestType: r.request_type,
          startDate: r.start_date,
          endDate: r.end_date,
        }
      })

      // Resolve holidays to actual dates in next 90 days
      const holidayRules = (holidaysRes.data ?? []) as FacilityHoliday[]
      const resolved = resolveHolidayDatesForRange(holidayRules, todayStr, ninetyDaysOutStr)
      const holidays: UpcomingHoliday[] = Array.from(resolved.entries())
        .map(([date, info]) => ({
          date,
          name: info.name,
          isPartial: info.isPartial,
          partialCloseTime: info.partialCloseTime,
        }))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 5)

      return { blocks, staff, timeOff, holidays }
    },
    {
      deps: [effectiveFacilityId],
      enabled: !!effectiveFacilityId,
    },
  )

  return {
    data,
    loading,
    error,
  }
}
