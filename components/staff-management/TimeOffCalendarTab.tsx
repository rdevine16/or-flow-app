// components/staff-management/TimeOffCalendarTab.tsx
// Team-wide month calendar showing time-off requests color-coded by status.
// Supports filtering by status, role, and specific staff member.
// Click a request badge to trigger the review modal (Phase 10).
'use client'

import { useMemo, useState } from 'react'
import { useSupabaseQueries } from '@/hooks/useSupabaseQuery'
import { useUserRoles } from '@/hooks/useLookups'
import { timeOffDAL } from '@/lib/dal/time-off'
import { usersDAL, type UserListItem } from '@/lib/dal/users'
import type { TimeOffRequest, TimeOffStatus } from '@/types/time-off'
import { resolveHolidayDatesForRange } from '@/types/time-off'
import type { FacilityHoliday } from '@/types/block-scheduling'
import { CalendarDayCell } from './CalendarDayCell'
import { PageLoader } from '@/components/ui/Loading'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'

// ============================================
// Types
// ============================================

interface TimeOffCalendarTabProps {
  facilityId: string
  onRequestClick?: (request: TimeOffRequest) => void
  /** Increment to force data refetch (e.g. after review modal approves/denies) */
  refreshTrigger?: number
}

// ============================================
// Constants
// ============================================

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const STATUS_FILTER_OPTIONS: { value: TimeOffStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'denied', label: 'Denied' },
]

// ============================================
// Helpers
// ============================================

/** Format a Date as "YYYY-MM-DD" for comparison with DB date strings */
function formatDateStr(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Generate all calendar day cells for a given month.
 * Includes padding from the previous/next month to fill complete weeks.
 */
function getCalendarDays(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startPadding = firstDay.getDay() // 0 = Sunday

  const totalDays = startPadding + lastDay.getDate()
  const totalCells = Math.ceil(totalDays / 7) * 7

  const days: Date[] = []
  for (let i = 0; i < totalCells; i++) {
    // JS Date handles overflow/underflow: day 0 = last day of prev month, etc.
    days.push(new Date(year, month, i - startPadding + 1))
  }
  return days
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/**
 * Build a map of dateStr → requests overlapping that date.
 * A request with start_date="2026-03-10" and end_date="2026-03-13"
 * appears on all four days.
 */
function buildRequestsByDate(
  calendarDays: Date[],
  requests: TimeOffRequest[],
): Map<string, TimeOffRequest[]> {
  const map = new Map<string, TimeOffRequest[]>()

  for (const day of calendarDays) {
    const dateStr = formatDateStr(day)
    const dayRequests = requests.filter(
      (r) => r.start_date <= dateStr && r.end_date >= dateStr,
    )
    map.set(dateStr, dayRequests)
  }

  return map
}

/**
 * Build a map of dateStr → count of unique users with approved time off.
 * Uses all requests (unfiltered) so coverage reflects reality regardless of filters.
 */
function buildCoverageMap(
  calendarDays: Date[],
  allRequests: TimeOffRequest[],
): Map<string, number> {
  const approved = allRequests.filter((r) => r.status === 'approved')
  const map = new Map<string, number>()

  for (const day of calendarDays) {
    const dateStr = formatDateStr(day)
    const userIds = new Set<string>()
    for (const r of approved) {
      if (r.start_date <= dateStr && r.end_date >= dateStr) {
        userIds.add(r.user_id)
      }
    }
    map.set(dateStr, userIds.size)
  }

  return map
}

// ============================================
// Component
// ============================================

export function TimeOffCalendarTab({ facilityId, onRequestClick, refreshTrigger = 0 }: TimeOffCalendarTabProps) {
  const today = useMemo(() => new Date(), [])

  // Month navigation state
  const [currentMonth, setCurrentMonth] = useState(() => ({
    year: today.getFullYear(),
    month: today.getMonth(),
  }))

  // Filter state
  const [statusFilter, setStatusFilter] = useState<TimeOffStatus | 'all'>('all')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [userFilter, setUserFilter] = useState<string>('all')

  // Calendar grid + date range for query
  const calendarDays = useMemo(
    () => getCalendarDays(currentMonth.year, currentMonth.month),
    [currentMonth.year, currentMonth.month],
  )

  const dateRange = useMemo(
    () => ({
      start: formatDateStr(calendarDays[0]),
      end: formatDateStr(calendarDays[calendarDays.length - 1]),
    }),
    [calendarDays],
  )

  // Role lookups for filter dropdown
  const { data: roles } = useUserRoles()

  // Fetch all requests + staff + holidays for the visible date range
  const { data, loading, errors, refetch } = useSupabaseQueries<{
    requests: TimeOffRequest[]
    staff: UserListItem[]
    holidays: FacilityHoliday[]
  }>(
    {
      requests: async (supabase) => {
        const { data, error } = await timeOffDAL.fetchFacilityRequests(
          supabase,
          facilityId,
          { dateRange },
        )
        if (error) throw error
        return data
      },
      staff: async (supabase) => {
        const result = await usersDAL.listByFacility(supabase, facilityId)
        if (result.error) throw result.error
        return result.data
      },
      holidays: async (supabase) => {
        const { data, error } = await supabase
          .from('facility_holidays')
          .select('*')
          .eq('facility_id', facilityId)
          .eq('is_active', true)
        if (error) throw error
        return (data as FacilityHoliday[]) || []
      },
    },
    { deps: [facilityId, dateRange.start, dateRange.end, refreshTrigger], enabled: !!facilityId },
  )

  const allRequests = data?.requests ?? []
  const staffList = data?.staff ?? []
  const facilityHolidays = data?.holidays ?? []
  const totalActiveStaff = staffList.filter((s) => s.is_active).length

  // Resolve holidays to actual dates for the visible calendar range
  const holidaysByDate = useMemo(
    () => resolveHolidayDatesForRange(facilityHolidays, dateRange.start, dateRange.end),
    [facilityHolidays, dateRange.start, dateRange.end],
  )

  // Staff lookup by user ID (for role filtering)
  const staffMap = useMemo(() => {
    const map = new Map<string, UserListItem>()
    for (const s of staffList) {
      map.set(s.id, s)
    }
    return map
  }, [staffList])

  // Client-side filtering
  const filteredRequests = useMemo(() => {
    let result = allRequests

    if (statusFilter !== 'all') {
      result = result.filter((r) => r.status === statusFilter)
    }

    if (roleFilter !== 'all') {
      result = result.filter((r) => {
        const staff = staffMap.get(r.user_id)
        return staff?.role_id === roleFilter
      })
    }

    if (userFilter !== 'all') {
      result = result.filter((r) => r.user_id === userFilter)
    }

    return result
  }, [allRequests, statusFilter, roleFilter, userFilter, staffMap])

  // Pre-compute per-date data
  const requestsByDate = useMemo(
    () => buildRequestsByDate(calendarDays, filteredRequests),
    [calendarDays, filteredRequests],
  )

  const coverageMap = useMemo(
    () => buildCoverageMap(calendarDays, allRequests),
    [calendarDays, allRequests],
  )

  // Unique requesters for user filter dropdown
  const requesterOptions = useMemo(() => {
    const seen = new Set<string>()
    const options: { id: string; name: string }[] = []
    for (const r of allRequests) {
      if (!seen.has(r.user_id) && r.user) {
        seen.add(r.user_id)
        options.push({
          id: r.user_id,
          name: `${r.user.first_name} ${r.user.last_name}`,
        })
      }
    }
    return options.sort((a, b) => a.name.localeCompare(b.name))
  }, [allRequests])

  // Navigation
  const goToPrevMonth = () => {
    setCurrentMonth((prev) => {
      if (prev.month === 0) return { year: prev.year - 1, month: 11 }
      return { ...prev, month: prev.month - 1 }
    })
  }

  const goToNextMonth = () => {
    setCurrentMonth((prev) => {
      if (prev.month === 11) return { year: prev.year + 1, month: 0 }
      return { ...prev, month: prev.month + 1 }
    })
  }

  const goToToday = () => {
    setCurrentMonth({ year: today.getFullYear(), month: today.getMonth() })
  }

  // Loading & error states
  if (loading) return <PageLoader />

  const errorMsg = errors.requests
    ? String(errors.requests)
    : errors.staff
      ? String(errors.staff)
      : null
  if (errorMsg) return <ErrorBanner message={errorMsg} onRetry={refetch} />

  // Empty state (no requests at all for the month)
  const hasAnyRequests = allRequests.length > 0

  return (
    <div className="space-y-4">
      {/* Toolbar: filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as TimeOffStatus | 'all')}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          aria-label="Filter by status"
        >
          {STATUS_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          aria-label="Filter by role"
        >
          <option value="all">All Roles</option>
          {(roles ?? []).map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>

        <select
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          aria-label="Filter by staff member"
        >
          <option value="all">All Staff</option>
          {requesterOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.name}
            </option>
          ))}
        </select>

        <span className="text-sm text-slate-500 whitespace-nowrap ml-auto">
          {filteredRequests.length} request{filteredRequests.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Calendar card */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Month navigation */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <button
              onClick={goToPrevMonth}
              className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-4 h-4 text-slate-600" />
            </button>
            <button
              onClick={goToNextMonth}
              className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              aria-label="Next month"
            >
              <ChevronRight className="w-4 h-4 text-slate-600" />
            </button>
            <h2 className="text-lg font-semibold text-slate-900 ml-2">
              {MONTH_NAMES[currentMonth.month]} {currentMonth.year}
            </h2>
          </div>
          <button
            onClick={goToToday}
            className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            Today
          </button>
        </div>

        {/* Calendar grid with horizontal scroll for narrow screens */}
        <div className="overflow-x-auto">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b border-slate-200 min-w-[560px]" role="row">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="px-2 py-2 text-xs font-medium text-slate-500 text-center uppercase tracking-wider bg-slate-50"
                role="columnheader"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div
            className="grid grid-cols-7 border-l border-t border-slate-200 min-w-[560px]"
            role="grid"
            aria-label={`Time-off calendar for ${MONTH_NAMES[currentMonth.month]} ${currentMonth.year}`}
          >
            {calendarDays.map((day) => {
              const dateStr = formatDateStr(day)
              const holiday = holidaysByDate.get(dateStr)
              return (
                <CalendarDayCell
                  key={dateStr}
                  date={day}
                  isCurrentMonth={day.getMonth() === currentMonth.month}
                  isToday={isSameDay(day, today)}
                  requests={requestsByDate.get(dateStr) ?? []}
                  approvedOffCount={coverageMap.get(dateStr) ?? 0}
                  totalStaff={totalActiveStaff}
                  onRequestClick={onRequestClick}
                  holidayName={holiday?.name}
                  isPartialHoliday={holiday?.isPartial}
                  partialCloseTime={holiday?.partialCloseTime}
                />
              )
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500" role="legend" aria-label="Calendar legend">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-amber-100 border border-amber-300" aria-hidden="true" />
          <span>Pending</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300" aria-hidden="true" />
          <span>Approved</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-slate-100 border border-slate-300" aria-hidden="true" />
          <span>Denied</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-blue-100 border border-blue-300" aria-hidden="true" />
          <span>Holiday</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-blue-100 border border-blue-300 relative" aria-hidden="true">
            <span className="absolute inset-0 flex items-center justify-center text-[7px] text-blue-500 font-bold">½</span>
          </div>
          <span>Partial Holiday</span>
        </div>
        <div className="flex items-center gap-1.5 ml-2">
          <span className="px-1 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-medium" aria-hidden="true">
            N off
          </span>
          <span>Coverage indicator</span>
        </div>
      </div>

      {/* Empty hint when no requests exist */}
      {!hasAnyRequests && (
        <div className="text-center py-8">
          <CalendarDays className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No time-off requests for this month.</p>
          <p className="text-xs text-slate-400 mt-1">
            Requests submitted by staff will appear here.
          </p>
        </div>
      )}
    </div>
  )
}
