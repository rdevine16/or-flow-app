// app/analytics/block-utilization/page.tsx
// Block & Room Utilization Analytics — Capacity optimization for OR directors
// Shows surgeon block utilization AND facility room utilization,
// identifies unused capacity, and suggests what additional cases could fit.
'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import { AnalyticsPageHeader } from '@/components/analytics/AnalyticsBreadcrumb'
import { CalendarDaysIcon } from '@heroicons/react/24/outline'
import { useSurgeons } from '@/hooks'
import { AreaChart, BarChart } from '@tremor/react'
import {
  CalendarDays,
  Clock,
  TrendingUp,
  AlertTriangle,
  ChevronRight,
  Activity,
  Target,
  PlusCircle,
  Zap,
  BarChart3,
  Info,
  Calendar,
  CheckCircle2,
  XCircle,
  Building2,
  DoorOpen,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

import {
  type RecurrenceType,
  formatTime12Hour,
} from '@/types/block-scheduling'

import {
  type CaseWithMilestones,
} from '@/lib/analyticsV2'

import {
  SectionHeader,
  EnhancedMetricCard,
  PeriodSelector,
  SurgeonSelector,
  InsightCard,
  EmptyState,
  SkeletonMetricCards,
  SkeletonTable,
  SkeletonChart,
} from '@/components/analytics/AnalyticsComponents'


// ============================================
// TYPES
// ============================================

interface Surgeon {
  id: string
  first_name: string
  last_name: string
}

interface BlockScheduleRow {
  id: string
  facility_id: string
  surgeon_id: string
  or_room_id: string | null
  day_of_week: number
  start_time: string
  end_time: string
  recurrence_type: RecurrenceType
  effective_start: string
  effective_end: string | null
  exception_dates: string[] | null
  deleted_at: string | null
  notes: string | null
}

interface FacilityClosureRow {
  id: string
  closure_date: string
}

interface FacilityHolidayRow {
  id: string
  name: string
  month: number
  day: number | null
  week_of_month: number | null
  day_of_week: number | null
  is_active: boolean
}

interface RoomScheduleRow {
  id: string
  or_room_id: string
  day_of_week: number
  open_time: string
  close_time: string
  is_closed: boolean
  effective_start: string
  effective_end: string | null
}

interface ORRoomRow {
  id: string
  name: string
  available_hours: number | null
}

interface ResolvedBlockDay {
  date: string
  blockId: string
  surgeonId: string
  surgeonName: string
  roomId: string | null
  startTime: string
  endTime: string
  durationMinutes: number
}

interface BlockDayWithCases extends ResolvedBlockDay {
  cases: CaseOnBlockDay[]
  usedMinutes: number
  turnoverMinutes: number
  remainingMinutes: number
  utilizationPct: number
  firstCaseStart: number | null
  lastCaseEnd: number | null
  overrunMinutes: number
}

interface CaseOnBlockDay {
  id: string
  caseNumber: string
  procedureName: string
  procedureTypeId: string | null
  surgeonId: string
  roomId: string | null
  startMinute: number
  endMinute: number
  durationMinutes: number
}

interface SurgeonUtilization {
  surgeonId: string
  surgeonName: string
  blockDays: BlockDayWithCases[]
  totalBlockMinutes: number
  totalUsedMinutes: number
  totalRemainingMinutes: number
  avgUtilizationPct: number
  avgRemainingMinutes: number
  totalCases: number
  casesOutsideBlock: number
  outsideBlockDates: string[]
  blockDayCount: number
  avgCasesPerBlockDay: number
}

// NEW: Room utilization types
interface RoomDayUtilization {
  date: string
  roomId: string
  roomName: string
  availableMinutes: number
  usedMinutes: number
  caseCount: number
  utilizationPct: number
  idleMinutes: number
  firstCaseStart: number | null
  lastCaseEnd: number | null
  blockAllocatedMinutes: number  // How much of this room-day is assigned to blocks
  openTime: string
  closeTime: string
}

interface RoomUtilization {
  roomId: string
  roomName: string
  days: RoomDayUtilization[]
  totalAvailableMinutes: number
  totalUsedMinutes: number
  totalIdleMinutes: number
  totalCases: number
  avgUtilizationPct: number
  daysActive: number
  totalBlockAllocatedMinutes: number
  blockAllocationPct: number
  unblockedMinutes: number
}

interface ProcedureFitOption {
  procedureName: string
  procedureTypeId: string
  medianCaseMinutes: number
  medianSurgicalMinutes: number
  caseCount: number
  fitsInRemaining: boolean
  estimatedRevenue: number | null
  turnoverBuffer: number
  totalNeeded: number
}

interface WeeklyTrend {
  week: string
  utilization: number
  blockHours: number
  usedHours: number
}


// ============================================
// BLOCK DATE RESOLUTION
// ============================================

function resolveBlockDates(
  block: BlockScheduleRow,
  rangeStart: Date,
  rangeEnd: Date,
  closureDates: Set<string>,
  holidayDates: Set<string>,
  surgeonMap: Map<string, string>
): ResolvedBlockDay[] {
  const results: ResolvedBlockDay[] = []

  const effStart = new Date(Math.max(
    rangeStart.getTime(),
    new Date(block.effective_start + 'T00:00:00').getTime()
  ))
  const effEnd = block.effective_end
    ? new Date(Math.min(rangeEnd.getTime(), new Date(block.effective_end + 'T00:00:00').getTime()))
    : rangeEnd

  if (effStart > effEnd) return results

  const exceptions = new Set<string>(block.exception_dates || [])
  const blockDuration = timeDiffMinutes(block.start_time, block.end_time)

  const current = new Date(effStart)
  while (current <= effEnd) {
    if (current.getDay() === block.day_of_week) {
      const dateStr = toDateStr(current)
      if (
        matchesRecurrence(current, block.recurrence_type) &&
        !exceptions.has(dateStr) &&
        !closureDates.has(dateStr) &&
        !holidayDates.has(dateStr)
      ) {
        results.push({
          date: dateStr,
          blockId: block.id,
          surgeonId: block.surgeon_id,
          surgeonName: surgeonMap.get(block.surgeon_id) || 'Unknown',
          roomId: block.or_room_id || null,
          startTime: block.start_time,
          endTime: block.end_time,
          durationMinutes: blockDuration,
        })
      }
    }
    current.setDate(current.getDate() + 1)
  }

  return results
}

function matchesRecurrence(date: Date, recurrenceType: RecurrenceType): boolean {
  if (recurrenceType === 'weekly') return true
  const weekOfMonth = Math.ceil(date.getDate() / 7)
  const nextWeek = new Date(date)
  nextWeek.setDate(nextWeek.getDate() + 7)
  const isLast = nextWeek.getMonth() !== date.getMonth()

  switch (recurrenceType) {
    case 'first_third_fifth': return weekOfMonth === 1 || weekOfMonth === 3 || weekOfMonth === 5
    case 'second_fourth':     return weekOfMonth === 2 || weekOfMonth === 4
    case 'first_only':        return weekOfMonth === 1
    case 'second_only':       return weekOfMonth === 2
    case 'third_only':        return weekOfMonth === 3
    case 'fourth_only':       return weekOfMonth === 4
    case 'last_only':         return isLast
    default:                  return false
  }
}

function resolveHolidayDates(holidays: FacilityHolidayRow[], startDate: Date, endDate: Date): Set<string> {
  const dates = new Set<string>()
  const startYear = startDate.getFullYear()
  const endYear = endDate.getFullYear()

  for (let year = startYear; year <= endYear; year++) {
    for (const h of holidays) {
      if (!h.is_active) continue
      if (h.day !== null) {
        const d = new Date(year, h.month - 1, h.day)
        const ds = toDateStr(d)
        if (d >= startDate && d <= endDate) dates.add(ds)
      } else if (h.week_of_month !== null && h.day_of_week !== null) {
        const resolved = getNthWeekdayOfMonth(year, h.month - 1, h.day_of_week, h.week_of_month)
        if (resolved) {
          const ds = toDateStr(resolved)
          if (resolved >= startDate && resolved <= endDate) dates.add(ds)
        }
      }
    }
  }
  return dates
}

function getNthWeekdayOfMonth(year: number, month: number, dayOfWeek: number, n: number): Date | null {
  if (n === 5) {
    const lastDay = new Date(year, month + 1, 0)
    let d = new Date(lastDay)
    while (d.getDay() !== dayOfWeek) d.setDate(d.getDate() - 1)
    return d
  }
  let count = 0
  const d = new Date(year, month, 1)
  while (d.getMonth() === month) {
    if (d.getDay() === dayOfWeek) {
      count++
      if (count === n) return new Date(d)
    }
    d.setDate(d.getDate() + 1)
  }
  return null
}


// ============================================
// TIME UTILITIES
// ============================================

function timeDiffMinutes(start: string, end: string): number {
  return timeToMinutes(end) - timeToMinutes(start)
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function minutesToTimeStr(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return formatTime12Hour(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:00`)
}

function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatDuration(minutes: number): string {
  if (minutes < 0) return `-${formatDuration(Math.abs(minutes))}`
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (h === 0) return `${m}m`
  return `${h}h ${m.toString().padStart(2, '0')}m`
}

function formatHours(minutes: number): string {
  return `${(minutes / 60).toFixed(1)}h`
}


// ============================================
// CASE MATCHING — Match cases to block days
// ============================================

function matchCasesToBlocks(
  blockDays: ResolvedBlockDay[],
  cases: CaseWithMilestones[],
  facilityMilestoneNames: Map<string, string>
): BlockDayWithCases[] {
  const caseMap = new Map<string, CaseWithMilestones[]>()
  for (const c of cases) {
    const milestones = c.case_milestones || []
    const patientIn = milestones.find(m => {
      const fm = Array.isArray(m.facility_milestones) ? m.facility_milestones[0] : m.facility_milestones
      const name = fm?.name || facilityMilestoneNames.get(m.facility_milestone_id) || ''
      return name === 'patient_in'
    })
    if (!patientIn) continue

    // Use scheduled_date (date-only, no TZ issues) as the match key.
    // Fall back to patient_in timestamp date if scheduled_date is missing.
    const caseDate = c.scheduled_date || patientIn.recorded_at.split('T')[0].split(' ')[0]
    const surgeonId = c.surgeon_id
    if (!surgeonId) continue

    const key = `${surgeonId}|${caseDate}`
    if (!caseMap.has(key)) caseMap.set(key, [])
    caseMap.get(key)!.push(c)
  }

  return blockDays.map(bd => {
    const key = `${bd.surgeonId}|${bd.date}`
    const dayCases = caseMap.get(key) || []
    const blockStart = timeToMinutes(bd.startTime)
    const blockEnd = timeToMinutes(bd.endTime)

    const casesOnDay: CaseOnBlockDay[] = []
    for (const c of dayCases) {
      const milestones = c.case_milestones || []
      let piTime: number | null = null
      let poTime: number | null = null

      for (const m of milestones) {
        const fm = Array.isArray(m.facility_milestones) ? m.facility_milestones[0] : m.facility_milestones
        const name = fm?.name || facilityMilestoneNames.get(m.facility_milestone_id) || ''
        const recorded = new Date(m.recorded_at)
        const minuteOfDay = recorded.getHours() * 60 + recorded.getMinutes()

        if (name === 'patient_in') piTime = minuteOfDay
        if (name === 'patient_out') poTime = minuteOfDay
      }

      if (piTime !== null && poTime !== null && poTime > piTime) {
        const pt = Array.isArray(c.procedure_types) ? c.procedure_types[0] : c.procedure_types
        casesOnDay.push({
          id: c.id,
          caseNumber: c.case_number,
          procedureName: pt?.name || 'Unknown',
          procedureTypeId: (pt as any)?.id || null,
          surgeonId: c.surgeon_id || '',
          roomId: c.or_room_id || null,
          startMinute: piTime,
          endMinute: poTime,
          durationMinutes: poTime - piTime,
        })
      }
    }

    casesOnDay.sort((a, b) => a.startMinute - b.startMinute)

    const usedMinutes = casesOnDay.reduce((sum, c) => sum + c.durationMinutes, 0)
    let turnoverMinutes = 0
    for (let i = 1; i < casesOnDay.length; i++) {
      const gap = casesOnDay[i].startMinute - casesOnDay[i - 1].endMinute
      if (gap > 0) turnoverMinutes += gap
    }

    const lastEnd = casesOnDay.length > 0 ? casesOnDay[casesOnDay.length - 1].endMinute : null
    const firstStart = casesOnDay.length > 0 ? casesOnDay[0].startMinute : null
    const remainingMinutes = lastEnd !== null ? Math.max(0, blockEnd - lastEnd) : bd.durationMinutes
    const overrunMinutes = lastEnd !== null ? Math.max(0, lastEnd - blockEnd) : 0
    const utilizationPct = bd.durationMinutes > 0 ? Math.round((usedMinutes / bd.durationMinutes) * 100) : 0

    return {
      ...bd,
      cases: casesOnDay,
      usedMinutes,
      turnoverMinutes,
      remainingMinutes,
      utilizationPct,
      firstCaseStart: firstStart,
      lastCaseEnd: lastEnd,
      overrunMinutes,
    }
  })
}

function findCasesOutsideBlocks(
  cases: CaseWithMilestones[],
  blockDays: ResolvedBlockDay[],
  facilityMilestoneNames: Map<string, string>
): Map<string, { count: number; dates: string[] }> {
  const blockDaySet = new Set<string>()
  for (const bd of blockDays) blockDaySet.add(`${bd.surgeonId}|${bd.date}`)

  const surgeonsWithBlocks = new Set<string>()
  for (const bd of blockDays) surgeonsWithBlocks.add(bd.surgeonId)

  const outsideMap = new Map<string, { count: number; dates: string[] }>()

  for (const c of cases) {
    const surgeonId = c.surgeon_id
    if (!surgeonId || !surgeonsWithBlocks.has(surgeonId)) continue

    const milestones = c.case_milestones || []
    const patientIn = milestones.find(m => {
      const fm = Array.isArray(m.facility_milestones) ? m.facility_milestones[0] : m.facility_milestones
      const name = fm?.name || facilityMilestoneNames.get(m.facility_milestone_id) || ''
      return name === 'patient_in'
    })
    if (!patientIn) continue

    const caseDate = c.scheduled_date || patientIn.recorded_at.split('T')[0].split(' ')[0]
    const key = `${surgeonId}|${caseDate}`

    if (!blockDaySet.has(key)) {
      if (!outsideMap.has(surgeonId)) outsideMap.set(surgeonId, { count: 0, dates: [] })
      const entry = outsideMap.get(surgeonId)!
      entry.count++
      if (!entry.dates.includes(caseDate)) entry.dates.push(caseDate)
    }
  }

  return outsideMap
}


// ============================================
// ROOM UTILIZATION CALCULATION (NEW)
// ============================================

/**
 * Resolve room schedule for a specific date from room_schedules rows.
 * Returns the most recent effective schedule for this room + day-of-week.
 */
function getRoomScheduleForDate(
  roomId: string,
  date: string,
  roomSchedules: RoomScheduleRow[]
): { openTime: string; closeTime: string; availableMinutes: number } | null {
  const dow = new Date(date + 'T12:00:00').getDay()
  
  // Find matching schedule: same room, same DOW, effective for this date
  const matching = roomSchedules
    .filter(rs =>
      rs.or_room_id === roomId &&
      rs.day_of_week === dow &&
      rs.effective_start <= date &&
      (rs.effective_end === null || rs.effective_end >= date) &&
      !rs.is_closed
    )
    .sort((a, b) => b.effective_start.localeCompare(a.effective_start))  // newest first

  if (matching.length === 0) return null

  const sched = matching[0]
  const availableMinutes = timeDiffMinutes(sched.open_time, sched.close_time)
  return { openTime: sched.open_time, closeTime: sched.close_time, availableMinutes }
}

/**
 * Calculate room utilization across all rooms for the analysis period.
 */
function calculateRoomUtilization(
  cases: CaseWithMilestones[],
  rooms: ORRoomRow[],
  roomSchedules: RoomScheduleRow[],
  blockDays: ResolvedBlockDay[],
  facilityMilestoneNames: Map<string, string>,
  closureDates: Set<string>,
  holidayDates: Set<string>,
  startDate: Date,
  endDate: Date
): RoomUtilization[] {
  // Build case data indexed by room + date
  const roomDateCases = new Map<string, { minutes: number; count: number; firstStart: number | null; lastEnd: number | null }>()

  for (const c of cases) {
    if (!c.or_room_id) continue
    const milestones = c.case_milestones || []
    let piTime: number | null = null
    let poTime: number | null = null

    for (const m of milestones) {
      const fm = Array.isArray(m.facility_milestones) ? m.facility_milestones[0] : m.facility_milestones
      const name = fm?.name || facilityMilestoneNames.get(m.facility_milestone_id) || ''
      const recorded = new Date(m.recorded_at)
      const minuteOfDay = recorded.getHours() * 60 + recorded.getMinutes()

      if (name === 'patient_in') piTime = minuteOfDay
      if (name === 'patient_out') poTime = minuteOfDay
    }

    if (piTime !== null && poTime !== null && poTime > piTime) {
      const caseDate = milestones.find(m => {
        const fm = Array.isArray(m.facility_milestones) ? m.facility_milestones[0] : m.facility_milestones
        const name = fm?.name || facilityMilestoneNames.get(m.facility_milestone_id) || ''
        return name === 'patient_in'
      })?.recorded_at.split('T')[0]
      if (!caseDate) continue

      const key = `${c.or_room_id}|${caseDate}`
      const existing = roomDateCases.get(key) || { minutes: 0, count: 0, firstStart: null, lastEnd: null }
      existing.minutes += poTime - piTime
      existing.count++
      if (existing.firstStart === null || piTime < existing.firstStart) existing.firstStart = piTime
      if (existing.lastEnd === null || poTime > existing.lastEnd) existing.lastEnd = poTime
      roomDateCases.set(key, existing)
    }
  }

  // Build block allocation indexed by room + date
  const roomDateBlocks = new Map<string, number>()
  for (const bd of blockDays) {
    if (!bd.roomId) continue
    const key = `${bd.roomId}|${bd.date}`
    const existing = roomDateBlocks.get(key) || 0
    roomDateBlocks.set(key, existing + bd.durationMinutes)
  }

  // Calculate per-room utilization
  const roomUtils: RoomUtilization[] = []

  for (const room of rooms) {
    const days: RoomDayUtilization[] = []

    // Iterate each day in the period
    const current = new Date(startDate)
    while (current <= endDate) {
      const dateStr = toDateStr(current)

      // Skip closures and holidays
      if (!closureDates.has(dateStr) && !holidayDates.has(dateStr)) {
        const schedule = getRoomScheduleForDate(room.id, dateStr, roomSchedules)

        if (schedule && schedule.availableMinutes > 0) {
          const caseKey = `${room.id}|${dateStr}`
          const caseData = roomDateCases.get(caseKey)
          const blockAlloc = roomDateBlocks.get(caseKey) || 0

          const usedMinutes = caseData?.minutes || 0
          const caseCount = caseData?.count || 0
          const utilizationPct = Math.round((usedMinutes / schedule.availableMinutes) * 100)
          const idleMinutes = Math.max(0, schedule.availableMinutes - usedMinutes)

          days.push({
            date: dateStr,
            roomId: room.id,
            roomName: room.name,
            availableMinutes: schedule.availableMinutes,
            usedMinutes,
            caseCount,
            utilizationPct,
            idleMinutes,
            firstCaseStart: caseData?.firstStart ?? null,
            lastCaseEnd: caseData?.lastEnd ?? null,
            blockAllocatedMinutes: blockAlloc,
            openTime: schedule.openTime,
            closeTime: schedule.closeTime,
          })
        }
      }

      current.setDate(current.getDate() + 1)
    }

    // Only include rooms that have at least one open day
    if (days.length > 0) {
      const totalAvailable = days.reduce((s, d) => s + d.availableMinutes, 0)
      const totalUsed = days.reduce((s, d) => s + d.usedMinutes, 0)
      const totalIdle = days.reduce((s, d) => s + d.idleMinutes, 0)
      const totalCases = days.reduce((s, d) => s + d.caseCount, 0)
      const daysWithCases = days.filter(d => d.caseCount > 0).length
      const totalBlockAlloc = days.reduce((s, d) => s + d.blockAllocatedMinutes, 0)

      roomUtils.push({
        roomId: room.id,
        roomName: room.name,
        days,
        totalAvailableMinutes: totalAvailable,
        totalUsedMinutes: totalUsed,
        totalIdleMinutes: totalIdle,
        totalCases,
        avgUtilizationPct: totalAvailable > 0 ? Math.round((totalUsed / totalAvailable) * 100) : 0,
        daysActive: daysWithCases,
        totalBlockAllocatedMinutes: totalBlockAlloc,
        blockAllocationPct: totalAvailable > 0 ? Math.round((totalBlockAlloc / totalAvailable) * 100) : 0,
        unblockedMinutes: Math.max(0, totalAvailable - totalBlockAlloc),
      })
    }
  }

  // Sort by utilization ascending (biggest opportunities first)
  roomUtils.sort((a, b) => a.avgUtilizationPct - b.avgUtilizationPct)

  return roomUtils
}


// ============================================
// "WHAT FITS" CALCULATION
// ============================================

function calculateWhatFits(
  surgeonId: string,
  avgRemainingMinutes: number,
  allCases: CaseWithMilestones[],
  facilityMilestoneNames: Map<string, string>,
  medianTurnover: number,
  reimbursementMap: Map<string, number>
): ProcedureFitOption[] {
  const surgeonCases = allCases.filter(c => c.surgeon_id === surgeonId)
  const byProcedure = new Map<string, { name: string; totalMinutes: number[]; surgicalMinutes: number[] }>()

  for (const c of surgeonCases) {
    const pt = Array.isArray(c.procedure_types) ? c.procedure_types[0] : c.procedure_types
    const procId = (pt as any)?.id
    if (!pt || !procId) continue

    if (!byProcedure.has(procId)) {
      byProcedure.set(procId, { name: pt.name, totalMinutes: [], surgicalMinutes: [] })
    }

    const milestones = c.case_milestones || []
    let piTime: number | null = null
    let poTime: number | null = null
    let incisionTime: number | null = null
    let closingTime: number | null = null

    for (const m of milestones) {
      const fm = Array.isArray(m.facility_milestones) ? m.facility_milestones[0] : m.facility_milestones
      const name = fm?.name || facilityMilestoneNames.get(m.facility_milestone_id) || ''
      const recorded = new Date(m.recorded_at)
      const minuteOfDay = recorded.getHours() * 60 + recorded.getMinutes()

      if (name === 'patient_in') piTime = minuteOfDay
      if (name === 'patient_out') poTime = minuteOfDay
      if (name === 'incision') incisionTime = minuteOfDay
      if (name === 'closing') closingTime = minuteOfDay
    }

    if (piTime !== null && poTime !== null && poTime > piTime) {
      byProcedure.get(procId)!.totalMinutes.push(poTime - piTime)
    }
    if (incisionTime !== null && closingTime !== null && closingTime > incisionTime) {
      byProcedure.get(procId)!.surgicalMinutes.push(closingTime - incisionTime)
    }
  }

  const options: ProcedureFitOption[] = []
  for (const [procId, data] of byProcedure.entries()) {
    if (data.totalMinutes.length < 2) continue

    const medianTotal = median(data.totalMinutes)
    const medianSurgical = data.surgicalMinutes.length > 0 ? median(data.surgicalMinutes) : 0
    const totalNeeded = medianTotal + medianTurnover
    const fits = totalNeeded <= avgRemainingMinutes

    options.push({
      procedureName: data.name,
      procedureTypeId: procId,
      medianCaseMinutes: Math.round(medianTotal),
      medianSurgicalMinutes: Math.round(medianSurgical),
      caseCount: data.totalMinutes.length,
      fitsInRemaining: fits,
      estimatedRevenue: reimbursementMap.get(procId) || null,
      turnoverBuffer: medianTurnover,
      totalNeeded: Math.round(totalNeeded),
    })
  }

  options.sort((a, b) => {
    if (a.fitsInRemaining !== b.fitsInRemaining) return a.fitsInRemaining ? -1 : 1
    if (a.estimatedRevenue && b.estimatedRevenue) return b.estimatedRevenue - a.estimatedRevenue
    return b.caseCount - a.caseCount
  })

  return options
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}


// ============================================
// TREND CALCULATION
// ============================================

function calculateWeeklyTrends(blockDays: BlockDayWithCases[]): WeeklyTrend[] {
  if (blockDays.length === 0) return []

  const byWeek = new Map<string, BlockDayWithCases[]>()
  for (const bd of blockDays) {
    const d = new Date(bd.date + 'T00:00:00')
    const day = d.getDay()
    const mondayOffset = day === 0 ? -6 : 1 - day
    const monday = new Date(d)
    monday.setDate(d.getDate() + mondayOffset)
    const weekKey = toDateStr(monday)

    if (!byWeek.has(weekKey)) byWeek.set(weekKey, [])
    byWeek.get(weekKey)!.push(bd)
  }

  const trends: WeeklyTrend[] = []
  const sortedWeeks = [...byWeek.keys()].sort()

  for (const weekKey of sortedWeeks) {
    const days = byWeek.get(weekKey)!
    const totalBlock = days.reduce((s, d) => s + d.durationMinutes, 0)
    const totalUsed = days.reduce((s, d) => s + d.usedMinutes, 0)
    const utilization = totalBlock > 0 ? Math.round((totalUsed / totalBlock) * 100) : 0

    const weekDate = new Date(weekKey + 'T00:00:00')
    const label = weekDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

    trends.push({
      week: label,
      utilization,
      blockHours: Math.round(totalBlock / 60 * 10) / 10,
      usedHours: Math.round(totalUsed / 60 * 10) / 10,
    })
  }

  return trends
}


// ============================================
// VISUALIZATION COMPONENTS
// ============================================

function utilizationColor(pct: number): { text: string; bg: string; bar: string; ring: string } {
  if (pct >= 85) return { text: 'text-emerald-700', bg: 'bg-emerald-50', bar: 'bg-emerald-500', ring: 'ring-emerald-200' }
  if (pct >= 60) return { text: 'text-amber-700', bg: 'bg-amber-50', bar: 'bg-amber-500', ring: 'ring-amber-200' }
  return { text: 'text-red-700', bg: 'bg-red-50', bar: 'bg-red-500', ring: 'ring-red-200' }
}

function UtilizationBar({ pct, height = 8 }: { pct: number; height?: number }) {
  const colors = utilizationColor(pct)
  return (
    <div className="flex items-center gap-3 flex-1">
      <div className={`flex-1 bg-slate-100 rounded-full overflow-hidden`} style={{ height }}>
        <div
          className={`h-full rounded-full transition-all duration-500 ${colors.bar}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className={`text-sm font-semibold tabular-nums w-12 text-right ${colors.text}`}>
        {pct}%
      </span>
    </div>
  )
}


function BlockDayTimeline({
  day,
  maxWidth = 600,
  showLabels = true,
}: {
  day: BlockDayWithCases
  maxWidth?: number
  showLabels?: boolean
}) {
  const blockStart = timeToMinutes(day.startTime)
  const blockEnd = timeToMinutes(day.endTime)
  const totalMinutes = blockEnd - blockStart
  if (totalMinutes <= 0) return null

  const toPercent = (min: number) => ((min - blockStart) / totalMinutes) * 100
  const caseColors = [
    'bg-blue-500', 'bg-violet-500', 'bg-cyan-500',
    'bg-indigo-500', 'bg-teal-500', 'bg-sky-500',
  ]

  const isEmpty = day.cases.length === 0

  return (
    <div className="group">
      {showLabels && (
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium text-slate-700">
              {new Date(day.date + 'T12:00:00').toLocaleDateString('en-US', {
                weekday: 'short', month: 'short', day: 'numeric'
              })}
            </span>
            <span className="text-[11px] text-slate-400">
              {minutesToTimeStr(blockStart)} – {minutesToTimeStr(blockEnd)}
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-500">
            <span>{day.cases.length} case{day.cases.length !== 1 ? 's' : ''}</span>
            <span className={`font-semibold ${utilizationColor(day.utilizationPct).text}`}>
              {day.utilizationPct}%
            </span>
          </div>
        </div>
      )}

      <div className="relative h-9 bg-slate-100 rounded-lg overflow-hidden border border-slate-200">
        {day.remainingMinutes > 0 && day.lastCaseEnd !== null && (
          <div
            className="absolute top-0 bottom-0 bg-emerald-50 border-l border-dashed border-emerald-300"
            style={{ left: `${toPercent(day.lastCaseEnd)}%`, right: '0%' }}
          />
        )}

        {isEmpty && (
          <div className="absolute inset-0 bg-red-50 flex items-center justify-center">
            <span className="text-[10px] font-medium text-red-400 uppercase tracking-wide">No Cases</span>
          </div>
        )}

        {day.cases.map((c, i) => {
          const left = toPercent(c.startMinute)
          const width = toPercent(c.endMinute) - left
          return (
            <div
              key={c.id}
              className={`absolute top-1 bottom-1 rounded ${caseColors[i % caseColors.length]} opacity-90 hover:opacity-100 transition-opacity cursor-default`}
              style={{ left: `${left}%`, width: `${Math.max(width, 1)}%` }}
              title={`${c.caseNumber}: ${c.procedureName}\n${minutesToTimeStr(c.startMinute)} – ${minutesToTimeStr(c.endMinute)} (${formatDuration(c.durationMinutes)})`}
            >
              {width > 8 && (
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-white truncate px-1">
                  {c.procedureName.length > 15 ? c.caseNumber : c.procedureName}
                </span>
              )}
            </div>
          )
        })}

        {day.overrunMinutes > 0 && (
          <div className="absolute top-0 bottom-0 right-0 w-1 bg-red-500" />
        )}

        <div className="absolute bottom-0 left-0 text-[9px] text-slate-400 pl-1 leading-none pb-0.5">
          {minutesToTimeStr(blockStart)}
        </div>
        <div className="absolute bottom-0 right-0 text-[9px] text-slate-400 pr-1 leading-none pb-0.5">
          {minutesToTimeStr(blockEnd)}
        </div>
      </div>

      {day.remainingMinutes > 30 && (
        <div className="mt-1 text-[11px] text-emerald-600 font-medium">
          {formatDuration(day.remainingMinutes)} available
        </div>
      )}
      {day.overrunMinutes > 0 && (
        <div className="mt-1 text-[11px] text-red-500 font-medium">
          Ran {formatDuration(day.overrunMinutes)} past block end
        </div>
      )}
    </div>
  )
}


function WhatFitsPanel({
  options,
  avgRemainingMinutes,
  medianTurnover,
}: {
  options: ProcedureFitOption[]
  avgRemainingMinutes: number
  medianTurnover: number
}) {
  if (options.length === 0) {
    return (
      <div className="text-sm text-slate-500 italic py-4 text-center">
        Not enough case history to calculate (need ≥2 cases per procedure)
      </div>
    )
  }

  const fittingOptions = options.filter(o => o.fitsInRemaining)
  const nonFittingOptions = options.filter(o => !o.fitsInRemaining)

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[13px] text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
        <Info className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
        <span>
          Based on <span className="font-semibold text-slate-800">{formatDuration(avgRemainingMinutes)}</span> avg remaining
          block time + <span className="font-semibold text-slate-800">{Math.round(medianTurnover)}m</span> turnover buffer
        </span>
      </div>

      {fittingOptions.length > 0 && (
        <div className="space-y-1.5">
          {fittingOptions.map(opt => (
            <div key={opt.procedureTypeId} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-emerald-50/60 border border-emerald-100">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-medium text-slate-800 truncate">{opt.procedureName}</span>
                  {opt.estimatedRevenue && (
                    <span className="text-[12px] font-semibold text-emerald-700 ml-2">
                      ${opt.estimatedRevenue.toLocaleString()}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Median {formatDuration(opt.medianCaseMinutes)} + {Math.round(opt.turnoverBuffer)}m turnover = {formatDuration(opt.totalNeeded)} needed
                  <span className="text-slate-400 ml-1">({opt.caseCount} historical cases)</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {nonFittingOptions.length > 0 && (
        <div className="space-y-1.5">
          {nonFittingOptions.map(opt => {
            const deficit = opt.totalNeeded - avgRemainingMinutes
            return (
              <div key={opt.procedureTypeId} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-slate-50 border border-slate-100 opacity-70">
                <XCircle className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-medium text-slate-500 truncate">{opt.procedureName}</span>
                    {opt.estimatedRevenue && (
                      <span className="text-[12px] text-slate-400 ml-2">
                        ${opt.estimatedRevenue.toLocaleString()}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Needs {formatDuration(opt.totalNeeded)} — <span className="text-red-400">{formatDuration(deficit)} short</span>
                    <span className="ml-1">({opt.caseCount} historical cases)</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}


function SurgeonUtilizationRow({
  data,
  onSelect,
}: {
  data: SurgeonUtilization
  onSelect: (surgeonId: string) => void
}) {
  const colors = utilizationColor(data.avgUtilizationPct)

  return (
    <tr
      className="group hover:bg-slate-50/80 cursor-pointer transition-colors"
      onClick={() => onSelect(data.surgeonId)}
    >
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-slate-800">Dr. {data.surgeonName}</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </td>
      <td className="py-3 px-4 w-56">
        <UtilizationBar pct={data.avgUtilizationPct} />
      </td>
      <td className="py-3 px-4 text-center">
        <span className="text-[13px] text-slate-700 tabular-nums">{data.blockDayCount}</span>
      </td>
      <td className="py-3 px-4 text-center">
        <span className="text-[13px] text-slate-700 tabular-nums">{data.totalCases}</span>
      </td>
      <td className="py-3 px-4 text-center">
        <span className="text-[13px] text-slate-700 tabular-nums">{data.avgCasesPerBlockDay.toFixed(1)}</span>
      </td>
      <td className="py-3 px-4 text-right">
        <span className="text-[13px] tabular-nums text-slate-700">{formatHours(data.totalUsedMinutes)}</span>
        <span className="text-[11px] text-slate-400 ml-1">/ {formatHours(data.totalBlockMinutes)}</span>
      </td>
      <td className="py-3 px-4 text-right">
        <span className={`text-[13px] font-medium tabular-nums ${data.avgRemainingMinutes > 60 ? 'text-emerald-600' : 'text-slate-600'}`}>
          {formatDuration(data.avgRemainingMinutes)}
        </span>
      </td>
      <td className="py-3 px-4 text-center">
        {data.casesOutsideBlock > 0 ? (
          <span className="inline-flex items-center gap-1 text-[12px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
            {data.casesOutsideBlock}
          </span>
        ) : (
          <span className="text-[12px] text-slate-300">—</span>
        )}
      </td>
    </tr>
  )
}


/** NEW: Room utilization row */
function RoomUtilizationRow({ data }: { data: RoomUtilization }) {
  const [expanded, setExpanded] = useState(false)
  const colors = utilizationColor(data.avgUtilizationPct)

  return (
    <>
      <tr
        className="group hover:bg-slate-50/80 cursor-pointer transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="py-3 px-4">
          <div className="flex items-center gap-2">
            {expanded
              ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
              : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            }
            <DoorOpen className="w-4 h-4 text-slate-400" />
            <span className="text-[13px] font-semibold text-slate-800">{data.roomName}</span>
          </div>
        </td>
        <td className="py-3 px-4 w-56">
          <UtilizationBar pct={data.avgUtilizationPct} />
        </td>
        <td className="py-3 px-4 text-center">
          <span className="text-[13px] text-slate-700 tabular-nums">{data.daysActive}</span>
          <span className="text-[11px] text-slate-400 ml-0.5">/ {data.days.length}</span>
        </td>
        <td className="py-3 px-4 text-center">
          <span className="text-[13px] text-slate-700 tabular-nums">{data.totalCases}</span>
        </td>
        <td className="py-3 px-4 text-right">
          <span className="text-[13px] tabular-nums text-slate-700">{formatHours(data.totalUsedMinutes)}</span>
          <span className="text-[11px] text-slate-400 ml-1">/ {formatHours(data.totalAvailableMinutes)}</span>
        </td>
        <td className="py-3 px-4 text-right">
          <span className={`text-[13px] font-medium tabular-nums ${data.totalIdleMinutes / 60 > 10 ? 'text-emerald-600' : 'text-slate-600'}`}>
            {formatHours(data.totalIdleMinutes)}
          </span>
        </td>
        <td className="py-3 px-4 text-center">
          <div className="flex items-center justify-center gap-1">
            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${Math.min(data.blockAllocationPct, 100)}%` }} />
            </div>
            <span className="text-[11px] text-slate-500 tabular-nums">{data.blockAllocationPct}%</span>
          </div>
        </td>
      </tr>

      {/* Expanded: day-by-day breakdown */}
      {expanded && (
        <tr>
          <td colSpan={7} className="px-4 pb-4 pt-0">
            <div className="bg-slate-50 rounded-lg p-3 mt-1">
              <div className="grid grid-cols-7 gap-1">
                {/* Show last 28 days as a mini heatmap */}
                {data.days.slice(-28).map(day => {
                  const c = utilizationColor(day.utilizationPct)
                  const dayLabel = new Date(day.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'narrow' })
                  const dateLabel = new Date(day.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  return (
                    <div
                      key={day.date}
                      className={`p-1.5 rounded text-center border ${
                        day.caseCount === 0
                          ? 'bg-white border-slate-200'
                          : `${c.bg} ${c.ring.replace('ring-', 'border-')}`
                      }`}
                      title={`${dateLabel}: ${day.caseCount} cases, ${day.utilizationPct}% util, ${formatDuration(day.usedMinutes)} used of ${formatDuration(day.availableMinutes)}`}
                    >
                      <div className="text-[9px] text-slate-400 font-medium">{dayLabel}</div>
                      <div className={`text-[11px] font-bold ${day.caseCount === 0 ? 'text-slate-300' : c.text}`}>
                        {day.utilizationPct}%
                      </div>
                      <div className="text-[9px] text-slate-400">{day.caseCount}c</div>
                    </div>
                  )
                })}
              </div>
              {data.days.length > 28 && (
                <p className="text-[10px] text-slate-400 text-center mt-2">Showing last 28 of {data.days.length} open days</p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}


function CapacityInsightBanner({
  utilizations,
  whatFitsMap,
  roomUtilizations,
}: {
  utilizations: SurgeonUtilization[]
  whatFitsMap: Map<string, ProcedureFitOption[]>
  roomUtilizations: RoomUtilization[]
}) {
  if (utilizations.length === 0) return null

  const sorted = [...utilizations].sort((a, b) => a.avgUtilizationPct - b.avgUtilizationPct)
  const lowest = sorted[0]
  const totalUnused = utilizations.reduce((s, u) => s + u.totalRemainingMinutes, 0)
  const totalUnusedHours = Math.round(totalUnused / 60 * 10) / 10
  const fits = whatFitsMap.get(lowest.surgeonId) || []
  const bestFit = fits.find(f => f.fitsInRemaining)
  const totalOutside = utilizations.reduce((s, u) => s + u.casesOutsideBlock, 0)

  // Room insights
  const totalRoomIdle = roomUtilizations.reduce((s, r) => s + r.totalIdleMinutes, 0)
  const totalRoomIdleHours = Math.round(totalRoomIdle / 60 * 10) / 10
  const lowestRoom = roomUtilizations.length > 0 ? roomUtilizations[0] : null

  const insights: string[] = []

  if (totalUnusedHours > 0) {
    insights.push(`${totalUnusedHours} unused block hours identified in this period.`)
  }
  if (lowest.avgUtilizationPct < 70) {
    insights.push(
      `Dr. ${lowest.surgeonName} has the lowest utilization at ${lowest.avgUtilizationPct}% with ~${formatDuration(lowest.avgRemainingMinutes)} available per block day.`
    )
  }
  if (bestFit) {
    const revenue = bestFit.estimatedRevenue ? ` (~$${bestFit.estimatedRevenue.toLocaleString()}/case)` : ''
    insights.push(
      `A ${bestFit.procedureName} (median ${formatDuration(bestFit.medianCaseMinutes)}) could fit in that window${revenue}.`
    )
  }
  if (lowestRoom && lowestRoom.avgUtilizationPct < 60) {
    insights.push(
      `${lowestRoom.roomName} is your least-utilized room at ${lowestRoom.avgUtilizationPct}% with ${formatHours(lowestRoom.totalIdleMinutes)} idle hours.`
    )
  }
  if (totalOutside > 0) {
    insights.push(
      `${totalOutside} case${totalOutside > 1 ? 's' : ''} operated outside allocated block time — consider expanding block allocations.`
    )
  }

  if (insights.length === 0) return null

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5 mb-6">
      <div className="flex gap-3">
        <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
          <Zap className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h3 className="text-[14px] font-semibold text-blue-900 mb-1">Capacity Opportunity</h3>
          <p className="text-[13px] text-blue-800 leading-relaxed">
            {insights.join(' ')}
          </p>
        </div>
      </div>
    </div>
  )
}


function SkeletonBlockUtilization() {
  return (
    <div className="space-y-8">
      <SkeletonMetricCards count={5} />
      <SkeletonTable rows={4} />
      <SkeletonChart height={200} />
    </div>
  )
}


// ============================================
// MAIN PAGE COMPONENT
// ============================================

export default function BlockUtilizationPage() {
  const supabase = createClient()
  const { effectiveFacilityId: facilityId, loading: userLoading } = useUser()

  // State
  const [loading, setLoading] = useState(true)
  const [selectedSurgeonId, setSelectedSurgeonId] = useState<string>('all')
  const [periodDays, setPeriodDays] = useState('30')
  const [orHourlyRate, setOrHourlyRate] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<'block' | 'room'>('block')

  // Data
  const [blockSchedules, setBlockSchedules] = useState<BlockScheduleRow[]>([])
  const [cases, setCases] = useState<CaseWithMilestones[]>([])
  const [closures, setClosures] = useState<FacilityClosureRow[]>([])
  const [holidays, setHolidays] = useState<FacilityHolidayRow[]>([])
  const [reimbursements, setReimbursements] = useState<Map<string, number>>(new Map())
  const [facilityMilestoneNames, setFacilityMilestoneNames] = useState<Map<string, string>>(new Map())
  const [rooms, setRooms] = useState<ORRoomRow[]>([])
  const [roomSchedules, setRoomSchedules] = useState<RoomScheduleRow[]>([])

  const { data: surgeons, loading: surgeonsLoading } = useSurgeons(facilityId)

  const periodOptions = [
    { label: '1M', value: '30' },
    { label: '3M', value: '90' },
    { label: '6M', value: '180' },
    { label: '1Y', value: '365' },
  ]

  // Load all data
  useEffect(() => {
    if (!facilityId) return

    // Paginated fetch — Supabase defaults to 1000 rows per query.
    // A facility with 5 surgeons doing 6+ cases/week can hit 1000+ in 6 months.
    async function fetchAllCases(startStr: string, endStr: string) {
      const pageSize = 1000
      let allCases: any[] = []
      let from = 0
      let hasMore = true

      while (hasMore) {
        const { data, error } = await supabase
          .from('cases')
          .select(`
            id, case_number, facility_id, surgeon_id, or_room_id,
            scheduled_date, start_time, status_id,
            case_statuses(name),
            procedure_types(id, name),
            case_milestones(
              facility_milestone_id, recorded_at,
              facility_milestones(name)
            )
          `)
          .eq('facility_id', facilityId)
          .gte('scheduled_date', startStr)
          .lte('scheduled_date', endStr)
          .order('scheduled_date', { ascending: true })
          .range(from, from + pageSize - 1)

        if (error) throw error

        allCases = allCases.concat(data || [])
        hasMore = (data?.length || 0) === pageSize
        from += pageSize
      }

      return allCases
    }

    async function loadData() {
      setLoading(true)
      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - parseInt(periodDays))
      const startStr = toDateStr(startDate)
      const endStr = toDateStr(endDate)

      try {
        const [
          blocksRes, casesData, closuresRes, holidaysRes,
          milestoneNamesRes, facilityRes, reimbursementsRes,
          roomsRes, roomSchedulesRes
        ] = await Promise.all([
          // 1. Block schedules
          supabase
            .from('block_schedules')
            .select('*')
            .eq('facility_id', facilityId)
            .is('deleted_at', null),

          // 2. All cases with milestones (paginated — no 1000-row limit)
          fetchAllCases(startStr, endStr),

          // 3. Closures
          supabase
            .from('facility_closures')
            .select('id, closure_date')
            .eq('facility_id', facilityId),

          // 4. Holidays
          supabase
            .from('facility_holidays')
            .select('id, name, month, day, week_of_month, day_of_week, is_active')
            .eq('facility_id', facilityId),

          // 5. Facility milestones
          supabase
            .from('facility_milestones')
            .select('id, name')
            .eq('facility_id', facilityId),

          // 6. Facility hourly rate
          supabase
            .from('facilities')
            .select('or_hourly_rate')
            .eq('id', facilityId)
            .single(),

          // 7. Procedure reimbursements
          supabase
            .from('procedure_reimbursements')
            .select('procedure_type_id, avg_reimbursement')
            .eq('facility_id', facilityId),

          // 8. OR Rooms (NEW)
          supabase
            .from('or_rooms')
            .select('id, name, available_hours')
            .eq('facility_id', facilityId)
            .is('deleted_at', null)
            .order('name'),

          // 9. Room Schedules (NEW)
          supabase
            .from('room_schedules')
            .select('*')
            .eq('facility_id', facilityId)
            .lte('effective_start', endStr)
            .or(`effective_end.is.null,effective_end.gte.${startStr}`),
        ])

        setBlockSchedules((blocksRes.data || []) as BlockScheduleRow[])

        const allCases = (casesData as unknown as CaseWithMilestones[]) || []
        const completedCases = allCases.filter(c => {
          const status = Array.isArray(c.case_statuses) ? c.case_statuses[0] : c.case_statuses
          return status?.name === 'completed'
        })
        setCases(completedCases)

        setClosures((closuresRes.data || []) as FacilityClosureRow[])
        setHolidays((holidaysRes.data || []) as FacilityHolidayRow[])

        const nameMap = new Map<string, string>()
        for (const fm of milestoneNamesRes.data || []) {
          nameMap.set(fm.id, fm.name)
        }
        setFacilityMilestoneNames(nameMap)

        setOrHourlyRate(facilityRes.data?.or_hourly_rate || null)

        const reimbMap = new Map<string, number>()
        for (const r of reimbursementsRes.data || []) {
          if (r.procedure_type_id && r.avg_reimbursement) {
            reimbMap.set(r.procedure_type_id, r.avg_reimbursement)
          }
        }
        setReimbursements(reimbMap)

        setRooms((roomsRes.data || []) as ORRoomRow[])
        setRoomSchedules((roomSchedulesRes.data || []) as RoomScheduleRow[])
      } catch (err) {
        console.error('Error loading block utilization data:', err)
      }

      setLoading(false)
    }

    loadData()
  }, [facilityId, periodDays, supabase])


  // ============================================
  // COMPUTED: Surgeon Block Utilization
  // ============================================

  const computedData = useMemo(() => {
    if (blockSchedules.length === 0 || !facilityId) {
      return {
        surgeonUtilizations: [] as SurgeonUtilization[],
        allBlockDays: [] as BlockDayWithCases[],
        weeklyTrends: [] as WeeklyTrend[],
        whatFitsMap: new Map<string, ProcedureFitOption[]>(),
        surgeonTurnovers: new Map<string, number>(),
      }
    }

    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - parseInt(periodDays))

    const surgeonMap = new Map<string, string>()
    for (const s of surgeons) {
      surgeonMap.set(s.id, `${s.last_name}`)
    }

    const closureDates = new Set<string>(closures.map(c => c.closure_date))
    const holidayDates = resolveHolidayDates(holidays, startDate, endDate)

    const allResolvedDays: ResolvedBlockDay[] = []
    for (const block of blockSchedules) {
      const days = resolveBlockDates(block, startDate, endDate, closureDates, holidayDates, surgeonMap)
      allResolvedDays.push(...days)
    }

    const allBlockDays = matchCasesToBlocks(allResolvedDays, cases, facilityMilestoneNames)
    const outsideBlockMap = findCasesOutsideBlocks(cases, allResolvedDays, facilityMilestoneNames)

    const bySurgeon = new Map<string, BlockDayWithCases[]>()
    for (const bd of allBlockDays) {
      if (!bySurgeon.has(bd.surgeonId)) bySurgeon.set(bd.surgeonId, [])
      bySurgeon.get(bd.surgeonId)!.push(bd)
    }

    const surgeonTurnovers = new Map<string, number>()
    for (const [sid, days] of bySurgeon.entries()) {
      const turnovers: number[] = []
      for (const d of days) {
        for (let i = 1; i < d.cases.length; i++) {
          const gap = d.cases[i].startMinute - d.cases[i - 1].endMinute
          if (gap > 0 && gap < 120) turnovers.push(gap)
        }
      }
      surgeonTurnovers.set(sid, turnovers.length > 0 ? median(turnovers) : 30)
    }

    const surgeonUtilizations: SurgeonUtilization[] = []
    for (const [surgeonId, days] of bySurgeon.entries()) {
      const totalBlock = days.reduce((s, d) => s + d.durationMinutes, 0)
      const totalUsed = days.reduce((s, d) => s + d.usedMinutes, 0)
      const totalRemaining = days.reduce((s, d) => s + d.remainingMinutes, 0)
      const totalCases = days.reduce((s, d) => s + d.cases.length, 0)
      const outside = outsideBlockMap.get(surgeonId) || { count: 0, dates: [] }

      surgeonUtilizations.push({
        surgeonId,
        surgeonName: surgeonMap.get(surgeonId) || 'Unknown',
        blockDays: days,
        totalBlockMinutes: totalBlock,
        totalUsedMinutes: totalUsed,
        totalRemainingMinutes: totalRemaining,
        avgUtilizationPct: totalBlock > 0 ? Math.round((totalUsed / totalBlock) * 100) : 0,
        avgRemainingMinutes: days.length > 0 ? Math.round(totalRemaining / days.length) : 0,
        totalCases,
        casesOutsideBlock: outside.count,
        outsideBlockDates: outside.dates,
        blockDayCount: days.length,
        avgCasesPerBlockDay: days.length > 0 ? totalCases / days.length : 0,
      })
    }

    surgeonUtilizations.sort((a, b) => a.avgUtilizationPct - b.avgUtilizationPct)

    const whatFitsMap = new Map<string, ProcedureFitOption[]>()
    for (const su of surgeonUtilizations) {
      const medTurnover = surgeonTurnovers.get(su.surgeonId) || 30
      const fits = calculateWhatFits(su.surgeonId, su.avgRemainingMinutes, cases, facilityMilestoneNames, medTurnover, reimbursements)
      whatFitsMap.set(su.surgeonId, fits)
    }

    const weeklyTrends = calculateWeeklyTrends(allBlockDays)

    return { surgeonUtilizations, allBlockDays, weeklyTrends, whatFitsMap, surgeonTurnovers }
  }, [blockSchedules, cases, closures, holidays, surgeons, facilityId, periodDays, facilityMilestoneNames, reimbursements])


  // ============================================
  // COMPUTED: Room Utilization (NEW)
  // ============================================

  const roomUtilizations = useMemo(() => {
    if (rooms.length === 0 || !facilityId) return [] as RoomUtilization[]

    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - parseInt(periodDays))

    const closureDates = new Set<string>(closures.map(c => c.closure_date))
    const holidayDates = resolveHolidayDates(holidays, startDate, endDate)

    return calculateRoomUtilization(
      cases, rooms, roomSchedules,
      computedData.allBlockDays, facilityMilestoneNames,
      closureDates, holidayDates, startDate, endDate
    )
  }, [cases, rooms, roomSchedules, computedData.allBlockDays, closures, holidays, facilityId, periodDays, facilityMilestoneNames])


  // ============================================
  // DERIVED VIEW STATE
  // ============================================

  const { surgeonUtilizations, allBlockDays, weeklyTrends, whatFitsMap, surgeonTurnovers } = computedData

  const isAllSurgeons = selectedSurgeonId === 'all'
  const selectedUtil = isAllSurgeons
    ? null
    : surgeonUtilizations.find(su => su.surgeonId === selectedSurgeonId) || null

  const filteredTrends = useMemo(() => {
    if (isAllSurgeons) return weeklyTrends
    const filtered = allBlockDays.filter(bd => bd.surgeonId === selectedSurgeonId)
    return calculateWeeklyTrends(filtered)
  }, [isAllSurgeons, selectedSurgeonId, allBlockDays, weeklyTrends])

  const summaryMetrics = useMemo(() => {
    const utils = isAllSurgeons ? surgeonUtilizations : (selectedUtil ? [selectedUtil] : [])
    const totalBlock = utils.reduce((s, u) => s + u.totalBlockMinutes, 0)
    const totalUsed = utils.reduce((s, u) => s + u.totalUsedMinutes, 0)
    const totalRemaining = utils.reduce((s, u) => s + u.totalRemainingMinutes, 0)
    const totalCases = utils.reduce((s, u) => s + u.totalCases, 0)
    const totalOutside = utils.reduce((s, u) => s + u.casesOutsideBlock, 0)
    const avgUtil = totalBlock > 0 ? Math.round((totalUsed / totalBlock) * 100) : 0
    const unusedHours = totalRemaining / 60
    const financialImpact = orHourlyRate ? Math.round(unusedHours * orHourlyRate) : null

    return { totalBlock, totalUsed, totalRemaining, totalCases, totalOutside, avgUtil, financialImpact }
  }, [isAllSurgeons, surgeonUtilizations, selectedUtil, orHourlyRate])

  // Room summary metrics
  const roomSummary = useMemo(() => {
    const totalAvailable = roomUtilizations.reduce((s, r) => s + r.totalAvailableMinutes, 0)
    const totalUsed = roomUtilizations.reduce((s, r) => s + r.totalUsedMinutes, 0)
    const totalIdle = roomUtilizations.reduce((s, r) => s + r.totalIdleMinutes, 0)
    const totalCases = roomUtilizations.reduce((s, r) => s + r.totalCases, 0)
    const avgUtil = totalAvailable > 0 ? Math.round((totalUsed / totalAvailable) * 100) : 0
    const totalBlockAlloc = roomUtilizations.reduce((s, r) => s + r.totalBlockAllocatedMinutes, 0)
    const blockAllocPct = totalAvailable > 0 ? Math.round((totalBlockAlloc / totalAvailable) * 100) : 0

    return { totalAvailable, totalUsed, totalIdle, totalCases, avgUtil, blockAllocPct }
  }, [roomUtilizations])


  // ============================================
  // RENDER
  // ============================================

  const surgeonOptions = surgeons
    .filter(s => surgeonUtilizations.some(su => su.surgeonId === s.id))
    .map(s => ({ id: s.id, first_name: s.first_name, last_name: s.last_name }))

  const hasBlockData = blockSchedules.length > 0 && surgeonUtilizations.length > 0
  const hasRoomData = roomUtilizations.length > 0

  return (
    <DashboardLayout>
      <Container>
        <AnalyticsPageHeader
          title="Block & Room Utilization"
          description="Track how effectively surgeons use block time and how rooms are utilized"
          icon={CalendarDaysIcon}
        />

        <div className="space-y-8 pb-12">

          {/* HEADER */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              {/* Tab Switcher */}
              <div className="flex bg-slate-100 rounded-lg p-0.5">
                <button
                  onClick={() => { setActiveTab('block'); setSelectedSurgeonId('all') }}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'block'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Block Utilization
                </button>
                <button
                  onClick={() => setActiveTab('room')}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'room'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Room Utilization
                </button>
              </div>

              {/* Surgeon selector (block tab only) */}
              {activeTab === 'block' && (
                <>
                  <SurgeonSelector
                    surgeons={surgeonOptions}
                    selectedId={selectedSurgeonId}
                    onChange={setSelectedSurgeonId}
                    placeholder="All Surgeons"
                  />
                  {selectedUtil && (
                    <button
                      onClick={() => setSelectedSurgeonId('all')}
                      className="text-[12px] text-blue-600 hover:text-blue-800 font-medium"
                    >
                      ← All Surgeons
                    </button>
                  )}
                </>
              )}
            </div>
            <PeriodSelector
              options={periodOptions}
              selected={periodDays}
              onChange={setPeriodDays}
            />
          </div>


          {/* LOADING */}
          {loading || userLoading ? (
            <SkeletonBlockUtilization />

          /* ============================================ */
          /* BLOCK UTILIZATION TAB                        */
          /* ============================================ */
          ) : activeTab === 'block' ? (
            <>
              {!hasBlockData ? (
                blockSchedules.length === 0 ? (
                  <EmptyState
                    icon={<CalendarDays className="w-8 h-8" />}
                    title="No Block Schedules Found"
                    description="Set up block schedules in the Block Calendar to see utilization analytics."
                    action={
                      <Link href="/block-schedule" className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                        Go to Block Calendar →
                      </Link>
                    }
                  />
                ) : (
                  <EmptyState
                    icon={<Activity className="w-8 h-8" />}
                    title="No Block Activity"
                    description={`No active block days found in the last ${periodDays} days. Try expanding the time period.`}
                  />
                )
              ) : (
                <>
                  {/* Insight Banner */}
                  {isAllSurgeons && (
                    <CapacityInsightBanner
                      utilizations={surgeonUtilizations}
                      whatFitsMap={whatFitsMap}
                      roomUtilizations={roomUtilizations}
                    />
                  )}

                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                    <EnhancedMetricCard
                      title="Avg Utilization"
                      value={`${summaryMetrics.avgUtil}%`}
                      icon={<Target className="w-4 h-4" />}
                      accentColor={summaryMetrics.avgUtil >= 85 ? 'emerald' : summaryMetrics.avgUtil >= 60 ? 'amber' : 'red'}
                      progress={summaryMetrics.avgUtil}
                    />
                    <EnhancedMetricCard
                      title="Block Hours"
                      value={formatHours(summaryMetrics.totalBlock)}
                      subtitle="Allocated"
                      icon={<CalendarDays className="w-4 h-4" />}
                      accentColor="blue"
                    />
                    <EnhancedMetricCard
                      title="Used Hours"
                      value={formatHours(summaryMetrics.totalUsed)}
                      subtitle={`${summaryMetrics.totalCases} cases`}
                      icon={<Activity className="w-4 h-4" />}
                      accentColor="blue"
                    />
                    <EnhancedMetricCard
                      title="Unused Hours"
                      value={formatHours(summaryMetrics.totalRemaining)}
                      subtitle={summaryMetrics.financialImpact
                        ? `~$${summaryMetrics.financialImpact.toLocaleString()} opportunity`
                        : 'Available capacity'}
                      icon={<Clock className="w-4 h-4" />}
                      accentColor="emerald"
                    />
                    <EnhancedMetricCard
                      title="Outside Block"
                      value={summaryMetrics.totalOutside}
                      subtitle="Cases on non-block days"
                      icon={<AlertTriangle className="w-4 h-4" />}
                      accentColor={summaryMetrics.totalOutside > 0 ? 'amber' : 'slate'}
                    />
                  </div>

                  {/* ALL SURGEONS: Table */}
                  {isAllSurgeons && (
                    <div>
                      <SectionHeader
                        title="Surgeon Utilization"
                        subtitle="Click a surgeon for detailed breakdown"
                        icon={<BarChart3 className="w-4 h-4" />}
                        accentColor="blue"
                      />
                      <div className="mt-4 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="text-left py-2.5 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Surgeon</th>
                                <th className="text-left py-2.5 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-56">Utilization</th>
                                <th className="text-center py-2.5 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Block Days</th>
                                <th className="text-center py-2.5 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Cases</th>
                                <th className="text-center py-2.5 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Avg/Day</th>
                                <th className="text-right py-2.5 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Used / Alloc</th>
                                <th className="text-right py-2.5 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Avg Remaining</th>
                                <th className="text-center py-2.5 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Outside</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {surgeonUtilizations.map(su => (
                                <SurgeonUtilizationRow key={su.surgeonId} data={su} onSelect={(id) => setSelectedSurgeonId(id)} />
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SINGLE SURGEON: Detail View */}
                  {!isAllSurgeons && selectedUtil && (
                    <>
                      {selectedUtil.avgRemainingMinutes > 30 && (
                        <InsightCard icon={<Zap className="w-4 h-4" />} title="Capacity Available" type="info">
                          <p className="text-[13px] text-slate-700">
                            Dr. {selectedUtil.surgeonName} averages{' '}
                            <strong>{formatDuration(selectedUtil.avgRemainingMinutes)}</strong> of unused block time
                            per operating day across {selectedUtil.blockDayCount} block days.
                            {selectedUtil.casesOutsideBlock > 0 && (
                              <> Additionally, {selectedUtil.casesOutsideBlock} case{selectedUtil.casesOutsideBlock > 1 ? 's were' : ' was'} performed outside block time.</>
                            )}
                          </p>
                        </InsightCard>
                      )}

                      <div>
                        <SectionHeader title="Block Day Breakdown" subtitle={`${selectedUtil.blockDayCount} block days in period`} icon={<Calendar className="w-4 h-4" />} accentColor="blue" />
                        <div className="mt-4 bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-5">
                          {selectedUtil.blockDays
                            .sort((a, b) => b.date.localeCompare(a.date))
                            .slice(0, 20)
                            .map(day => <BlockDayTimeline key={day.date} day={day} />)
                          }
                          {selectedUtil.blockDays.length > 20 && (
                            <p className="text-[12px] text-slate-400 text-center pt-2">
                              Showing most recent 20 of {selectedUtil.blockDays.length} block days
                            </p>
                          )}
                        </div>
                      </div>

                      <div>
                        <SectionHeader title="What Could Fit?" subtitle="Based on historical case durations and available block time" icon={<PlusCircle className="w-4 h-4" />} accentColor="emerald" />
                        <div className="mt-4 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                          <WhatFitsPanel
                            options={whatFitsMap.get(selectedUtil.surgeonId) || []}
                            avgRemainingMinutes={selectedUtil.avgRemainingMinutes}
                            medianTurnover={surgeonTurnovers.get(selectedUtil.surgeonId) || 30}
                          />
                        </div>
                      </div>

                      {selectedUtil.casesOutsideBlock > 0 && (
                        <div>
                          <SectionHeader title="Cases Outside Block" subtitle="Operating days without allocated block time" icon={<AlertTriangle className="w-4 h-4" />} accentColor="amber" />
                          <div className="mt-4 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                            <div className="flex flex-wrap gap-2">
                              {selectedUtil.outsideBlockDates.sort().map(d => (
                                <span key={d} className="inline-flex items-center gap-1.5 text-[12px] font-medium text-amber-700 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-100">
                                  <Calendar className="w-3 h-3" />
                                  {new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                </span>
                              ))}
                            </div>
                            <p className="text-[12px] text-slate-500 mt-3">
                              {selectedUtil.casesOutsideBlock} total case{selectedUtil.casesOutsideBlock > 1 ? 's' : ''} on{' '}
                              {selectedUtil.outsideBlockDates.length} non-block day{selectedUtil.outsideBlockDates.length > 1 ? 's' : ''}.
                              This may indicate demand for additional block time.
                            </p>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Utilization Trend */}
                  {filteredTrends.length > 1 && (
                    <div>
                      <SectionHeader title="Utilization Trend" subtitle="Weekly block utilization over time" icon={<TrendingUp className="w-4 h-4" />} accentColor="blue" />
                      <div className="mt-4 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                        <AreaChart
                          className="h-56"
                          data={filteredTrends}
                          index="week"
                          categories={['utilization']}
                          colors={['blue']}
                          valueFormatter={(v) => `${v}%`}
                          showLegend={false}
                          showGridLines={true}
                          curveType="monotone"
                          yAxisWidth={48}
                          minValue={0}
                          maxValue={100}
                          showAnimation={true}
                        />
                        <div className="mt-4 pt-4 border-t border-slate-100">
                          <BarChart
                            className="h-40"
                            data={filteredTrends}
                            index="week"
                            categories={['usedHours', 'blockHours']}
                            colors={['blue', 'slate']}
                            valueFormatter={(v) => `${v}h`}
                            showLegend={true}
                            showGridLines={false}
                            yAxisWidth={48}
                            showAnimation={true}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>


          /* ============================================ */
          /* ROOM UTILIZATION TAB (NEW)                   */
          /* ============================================ */
          ) : (
            <>
              {!hasRoomData ? (
                <EmptyState
                  icon={<Building2 className="w-8 h-8" />}
                  title="No Room Data"
                  description="Configure room schedules in Settings → Rooms to see room utilization analytics."
                  action={
                    <Link href="/settings/rooms" className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                      Go to Room Settings →
                    </Link>
                  }
                />
              ) : (
                <>
                  {/* Room Summary Cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                    <EnhancedMetricCard
                      title="Avg Room Utilization"
                      value={`${roomSummary.avgUtil}%`}
                      icon={<Target className="w-4 h-4" />}
                      accentColor={roomSummary.avgUtil >= 85 ? 'emerald' : roomSummary.avgUtil >= 60 ? 'amber' : 'red'}
                      progress={roomSummary.avgUtil}
                    />
                    <EnhancedMetricCard
                      title="Available Hours"
                      value={formatHours(roomSummary.totalAvailable)}
                      subtitle={`${rooms.length} rooms`}
                      icon={<Building2 className="w-4 h-4" />}
                      accentColor="blue"
                    />
                    <EnhancedMetricCard
                      title="Used Hours"
                      value={formatHours(roomSummary.totalUsed)}
                      subtitle={`${roomSummary.totalCases} cases`}
                      icon={<Activity className="w-4 h-4" />}
                      accentColor="blue"
                    />
                    <EnhancedMetricCard
                      title="Idle Hours"
                      value={formatHours(roomSummary.totalIdle)}
                      subtitle={orHourlyRate ? `~$${Math.round((roomSummary.totalIdle / 60) * orHourlyRate).toLocaleString()} opportunity` : 'Unused capacity'}
                      icon={<Clock className="w-4 h-4" />}
                      accentColor="emerald"
                    />
                    <EnhancedMetricCard
                      title="Block Allocation"
                      value={`${roomSummary.blockAllocPct}%`}
                      subtitle="Of room time is blocked"
                      icon={<CalendarDays className="w-4 h-4" />}
                      accentColor="violet"
                    />
                  </div>

                  {/* Room Utilization Table */}
                  <div>
                    <SectionHeader
                      title="Room Utilization"
                      subtitle="Click a room to see daily heatmap"
                      icon={<DoorOpen className="w-4 h-4" />}
                      accentColor="violet"
                    />
                    <div className="mt-4 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                              <th className="text-left py-2.5 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Room</th>
                              <th className="text-left py-2.5 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-56">Utilization</th>
                              <th className="text-center py-2.5 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Active Days</th>
                              <th className="text-center py-2.5 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Cases</th>
                              <th className="text-right py-2.5 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Used / Available</th>
                              <th className="text-right py-2.5 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Idle Hours</th>
                              <th className="text-center py-2.5 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Block Alloc</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {roomUtilizations.map(ru => (
                              <RoomUtilizationRow key={ru.roomId} data={ru} />
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Unblocked Capacity Insight */}
                  {roomUtilizations.some(r => r.unblockedMinutes > 120) && (
                    <InsightCard icon={<Info className="w-4 h-4" />} title="Unblocked Room Capacity" type="info">
                      <p className="text-[13px] text-slate-700">
                        {roomUtilizations.filter(r => r.unblockedMinutes > 120).map(r => (
                          <span key={r.roomId}>
                            <strong>{r.roomName}</strong> has {formatHours(r.unblockedMinutes)} of available time not assigned to any block schedule.{' '}
                          </span>
                        ))}
                        Consider assigning block time to capture this capacity.
                      </p>
                    </InsightCard>
                  )}
                </>
              )}
            </>
          )}

        </div>
      </Container>
    </DashboardLayout>
  )
}
