// components/block-schedule/RoomScheduleSidebar.tsx
// Sidebar for Room Schedule tab — mini calendar, surgeon list with block badges, staff pool by role

'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import type { Surgeon } from '@/hooks/useLookups'
import type { StaffMember } from '@/types/staff-assignment'
import type { ExpandedBlock } from '@/types/block-scheduling'
import { DraggableSurgeonCard } from './DraggableSurgeonCard'
import { DraggableStaffCard } from './DraggableStaffCard'
import { logger } from '@/lib/logger'

const log = logger('RoomScheduleSidebar')

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

// Display-friendly role labels
const ROLE_DISPLAY_LABELS: Record<string, string> = {
  nurse: 'Nurses',
  'circulating nurse': 'Circulating Nurses',
  'scrub tech': 'Scrub Techs',
  tech: 'Techs',
  anesthesiologist: 'Anesthesia',
  crna: 'CRNAs',
  pa: 'PAs',
  'first assist': 'First Assists',
  'device rep': 'Device Reps',
}

function getRoleLabel(roleName: string): string {
  const lower = roleName.toLowerCase()
  return ROLE_DISPLAY_LABELS[lower] ?? `${roleName}s`
}

interface RoomScheduleSidebarProps {
  facilityId: string | null
  surgeons: Surgeon[]
  surgeonsLoading: boolean
  currentWeekStart: Date
  onDateSelect: (date: Date) => void
  /** The block schedule data for the current week — used for block-time badges */
  blocks: ExpandedBlock[]
}

export function RoomScheduleSidebar({
  facilityId,
  surgeons,
  surgeonsLoading,
  currentWeekStart,
  onDateSelect,
  blocks,
}: RoomScheduleSidebarProps) {
  const supabase = useMemo(() => createClient(), [])

  // Staff state
  const [facilityStaff, setFacilityStaff] = useState<StaffMember[]>([])
  const [staffLoading, setStaffLoading] = useState(true)

  // Search filter
  const [searchQuery, setSearchQuery] = useState('')

  // Mini calendar month
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date(currentWeekStart)
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })

  // Focused date for block-time badge (defaults to today)
  const [focusedDate, setFocusedDate] = useState<Date>(() => new Date())

  // Fetch staff for the facility
  const fetchStaff = useCallback(async () => {
    if (!facilityId) return

    setStaffLoading(true)
    try {
      const { data, error } = await supabase
        .from('users')
        .select(`
          id,
          first_name,
          last_name,
          email,
          profile_image_url,
          role_id,
          facility_id,
          user_roles (name)
        `)
        .eq('facility_id', facilityId)
        .eq('is_active', true)
        .order('last_name')

      if (error) throw error
      setFacilityStaff((data as unknown as StaffMember[]) || [])
    } catch (err) {
      log.error('Error fetching staff:', err)
    } finally {
      setStaffLoading(false)
    }
  }, [facilityId, supabase])

  useEffect(() => {
    fetchStaff()
  }, [fetchStaff])

  // Build map of surgeon ID → day-of-week indices with block time this week
  const surgeonsBlockDays = useMemo(() => {
    const weekDates: string[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(currentWeekStart)
      d.setDate(d.getDate() + i)
      weekDates.push(formatDate(d))
    }

    const map = new Map<string, number[]>()
    for (const block of blocks) {
      const dayIndex = weekDates.indexOf(block.block_date)
      if (dayIndex === -1) continue
      const dayOfWeek = new Date(block.block_date + 'T00:00:00').getDay()
      if (!map.has(block.surgeon_id)) {
        map.set(block.surgeon_id, [])
      }
      const days = map.get(block.surgeon_id)!
      if (!days.includes(dayOfWeek)) {
        days.push(dayOfWeek)
      }
    }

    // Sort each surgeon's days
    for (const days of map.values()) {
      days.sort((a, b) => a - b)
    }

    return map
  }, [blocks, currentWeekStart])

  // Filter staff: exclude surgeons, then group by role
  const staffByRole = useMemo(() => {
    const nonSurgeons = facilityStaff.filter(
      (s) => s.user_roles?.name?.toLowerCase() !== 'surgeon'
    )

    // Apply search filter
    const filtered = searchQuery
      ? nonSurgeons.filter((s) => {
          const name = `${s.first_name} ${s.last_name}`.toLowerCase()
          return name.includes(searchQuery.toLowerCase())
        })
      : nonSurgeons

    // Group by role
    const groups = new Map<string, StaffMember[]>()
    for (const staff of filtered) {
      const role = staff.user_roles?.name ?? 'Other'
      if (!groups.has(role)) {
        groups.set(role, [])
      }
      groups.get(role)!.push(staff)
    }

    return groups
  }, [facilityStaff, searchQuery])

  // Filter surgeons by search
  const filteredSurgeons = useMemo(() => {
    if (!searchQuery) return surgeons
    return surgeons.filter((s) => {
      const name = `Dr. ${s.first_name} ${s.last_name}`.toLowerCase()
      return name.includes(searchQuery.toLowerCase())
    })
  }, [surgeons, searchQuery])

  // Calendar helpers
  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const isInCurrentWeek = (date: Date) => {
    const weekEnd = new Date(currentWeekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)
    return date >= currentWeekStart && date <= weekEnd
  }

  const isToday = (date: Date) => date.toDateString() === today.toDateString()
  const isFocused = (date: Date) => date.toDateString() === focusedDate.toDateString()

  const generateCalendarDays = () => {
    const year = calendarMonth.getFullYear()
    const month = calendarMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startPadding = firstDay.getDay()
    const totalDays = lastDay.getDate()
    const days: (Date | null)[] = []
    for (let i = 0; i < startPadding; i++) days.push(null)
    for (let i = 1; i <= totalDays; i++) days.push(new Date(year, month, i))
    return days
  }

  const calendarDays = generateCalendarDays()
  const monthYear = calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const handleDateClick = (date: Date) => {
    setFocusedDate(date)
    onDateSelect(date)
  }

  return (
    <div className="w-64 flex-shrink-0 border-r border-slate-200 bg-white flex flex-col overflow-hidden">
      {/* Mini Calendar */}
      <div className="px-4 pt-4 pb-3">
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-slate-800">{monthYear}</span>
          <div className="flex items-center">
            <button
              onClick={() => setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
              className="p-1 hover:bg-slate-100 rounded-full transition-colors"
            >
              <ChevronLeft className="h-4 w-4 text-slate-600" />
            </button>
            <button
              onClick={() => setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
              className="p-1 hover:bg-slate-100 rounded-full transition-colors"
            >
              <ChevronRight className="h-4 w-4 text-slate-600" />
            </button>
          </div>
        </div>

        {/* Day Headers */}
        <div className="grid grid-cols-7 mb-1">
          {DAYS.map((day, i) => (
            <div key={i} className="text-center text-xs font-medium text-slate-400 py-1">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7">
          {calendarDays.map((date, i) => {
            if (!date) return <div key={i} className="h-7" />

            const inWeek = isInCurrentWeek(date)
            const isTodayDate = isToday(date)
            const isFocusedDate = isFocused(date)

            return (
              <button
                key={i}
                onClick={() => handleDateClick(date)}
                className={`h-7 w-7 mx-auto text-xs font-medium rounded-full transition-colors ${
                  isFocusedDate
                    ? 'bg-blue-600 text-white'
                    : isTodayDate
                    ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-300'
                    : inWeek
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {date.getDate()}
              </button>
            )
          })}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-slate-100 mx-4" />

      {/* Search */}
      <div className="px-4 py-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search people..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
          />
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-auto px-4 pb-4">
        {/* Surgeons Section */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Surgeons
            </span>
          </div>

          {surgeonsLoading ? (
            <div className="py-4 text-center">
              <div className="h-4 w-4 mx-auto border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
            </div>
          ) : filteredSurgeons.length === 0 ? (
            <div className="text-xs text-slate-400 py-2">
              {searchQuery ? (
                'No surgeons match search'
              ) : (
                <>
                  <p>No surgeons in facility</p>
                  <Link href="/settings/users" className="text-blue-500 hover:text-blue-700 underline underline-offset-2">
                    Add surgeons in Settings
                  </Link>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-0.5">
              {filteredSurgeons.map((surgeon) => (
                <DraggableSurgeonCard
                  key={surgeon.id}
                  surgeon={surgeon}
                  blockDays={surgeonsBlockDays.get(surgeon.id) ?? []}
                />
              ))}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-slate-100 mb-4" />

        {/* Staff Section */}
        <div>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">
            Staff
          </span>

          {staffLoading ? (
            <div className="py-4 text-center">
              <div className="h-4 w-4 mx-auto border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
            </div>
          ) : staffByRole.size === 0 ? (
            <div className="text-xs text-slate-400 py-2">
              {searchQuery ? (
                'No staff match search'
              ) : (
                <>
                  <p>No staff in facility</p>
                  <Link href="/settings/users" className="text-blue-500 hover:text-blue-700 underline underline-offset-2">
                    Add staff in Settings
                  </Link>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {Array.from(staffByRole.entries()).map(([role, members]) => (
                <div key={role}>
                  {/* Role group header */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                      {getRoleLabel(role)}
                    </span>
                    <span className="text-[10px] text-slate-300">
                      ({members.length})
                    </span>
                  </div>
                  {/* Staff cards */}
                  <div className="space-y-0.5">
                    {members.map((staff) => (
                      <DraggableStaffCard key={staff.id} staff={staff} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// =====================================================
// HELPERS
// =====================================================

function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
