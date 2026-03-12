// components/staff-management/__tests__/calendar-helpers.test.ts
// Tests for pure helper functions extracted from TimeOffCalendarTab
// These functions contain the core calendar grid generation and date-mapping logic.

import { describe, test, expect } from 'vitest'
import type { TimeOffRequest } from '@/types/time-off'

// ============================================
// Helpers (extracted from TimeOffCalendarTab)
// ============================================

function formatDateStr(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getCalendarDays(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startPadding = firstDay.getDay() // 0 = Sunday

  const totalDays = startPadding + lastDay.getDate()
  const totalCells = Math.ceil(totalDays / 7) * 7

  const days: Date[] = []
  for (let i = 0; i < totalCells; i++) {
    days.push(new Date(year, month, i - startPadding + 1))
  }
  return days
}

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
// Tests
// ============================================

describe('formatDateStr', () => {
  test('formats single-digit month and day with leading zeros', () => {
    const date = new Date(2026, 0, 5) // January 5, 2026
    expect(formatDateStr(date)).toBe('2026-01-05')
  })

  test('formats double-digit month and day without leading zeros', () => {
    const date = new Date(2026, 11, 25) // December 25, 2026
    expect(formatDateStr(date)).toBe('2026-12-25')
  })

  test('handles year boundaries correctly', () => {
    const date = new Date(2025, 11, 31) // December 31, 2025
    expect(formatDateStr(date)).toBe('2025-12-31')
  })
})

describe('getCalendarDays', () => {
  test('March 2026 starts on Sunday (no leading padding)', () => {
    // March 2026: Sun Mar 1 → Tue Mar 31 (31 days, starts on Sunday)
    const days = getCalendarDays(2026, 2) // month = 2 (0-indexed)

    // Should have 35 cells (5 weeks): 31 days + 4 trailing days from April
    expect(days.length).toBe(35)

    // First day should be March 1, 2026
    expect(days[0].getFullYear()).toBe(2026)
    expect(days[0].getMonth()).toBe(2)
    expect(days[0].getDate()).toBe(1)

    // Last March day (31st) should be at index 30
    expect(days[30].getMonth()).toBe(2)
    expect(days[30].getDate()).toBe(31)

    // Remaining cells should be April
    expect(days[31].getMonth()).toBe(3)
    expect(days[31].getDate()).toBe(1)
  })

  test('February 2026 starts on Sunday with 28 days', () => {
    // February 2026: Sun Feb 1 → Sat Feb 28 (28 days, 2026 is not a leap year)
    const days = getCalendarDays(2026, 1)

    // Exactly 4 weeks = 28 cells
    expect(days.length).toBe(28)

    // First day: Feb 1
    expect(days[0].getMonth()).toBe(1)
    expect(days[0].getDate()).toBe(1)

    // Last day: Feb 28
    expect(days[27].getMonth()).toBe(1)
    expect(days[27].getDate()).toBe(28)
  })

  test('April 2026 starts on Wednesday (3-day padding)', () => {
    // April 2026: Wed Apr 1 → Thu Apr 30 (30 days, starts on Wed)
    const days = getCalendarDays(2026, 3)

    // 3-day padding + 30 days = 33, rounded to 35 (5 weeks)
    expect(days.length).toBe(35)

    // First 3 cells should be March 29, 30, 31
    expect(days[0].getMonth()).toBe(2) // March
    expect(days[0].getDate()).toBe(29)
    expect(days[2].getDate()).toBe(31)

    // April 1 at index 3
    expect(days[3].getMonth()).toBe(3)
    expect(days[3].getDate()).toBe(1)

    // April 30 at index 32
    expect(days[32].getMonth()).toBe(3)
    expect(days[32].getDate()).toBe(30)

    // Last 2 cells: May 1, 2
    expect(days[33].getMonth()).toBe(4)
    expect(days[33].getDate()).toBe(1)
    expect(days[34].getMonth()).toBe(4)
    expect(days[34].getDate()).toBe(2)
  })

  test('handles December to January year boundary', () => {
    // December 2025: Mon Dec 1 → Wed Dec 31
    const days = getCalendarDays(2025, 11)

    // Starts on Monday → 1-day padding from November
    expect(days[0].getMonth()).toBe(10) // November
    expect(days[0].getDate()).toBe(30)

    // Dec 1 at index 1
    expect(days[1].getFullYear()).toBe(2025)
    expect(days[1].getMonth()).toBe(11)
    expect(days[1].getDate()).toBe(1)

    // Dec 31 at index 31
    expect(days[31].getMonth()).toBe(11)
    expect(days[31].getDate()).toBe(31)

    // Trailing days should be January 2026
    expect(days[32].getFullYear()).toBe(2026)
    expect(days[32].getMonth()).toBe(0)
    expect(days[32].getDate()).toBe(1)
  })
})

describe('buildRequestsByDate', () => {
  const mockRequest = (
    id: string,
    userId: string,
    startDate: string,
    endDate: string,
    status: 'pending' | 'approved' | 'denied' = 'approved',
  ): TimeOffRequest => ({
    id,
    facility_id: 'fac-1',
    user_id: userId,
    start_date: startDate,
    end_date: endDate,
    request_type: 'vacation',
    status,
    notes: null,
    created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z',
    user: {
      id: userId,
      first_name: 'John',
      last_name: 'Doe',
      email: 'john@example.com',
    },
  })

  test('single-day request appears on only that day', () => {
    const days = [
      new Date(2026, 2, 10), // March 10
      new Date(2026, 2, 11), // March 11
      new Date(2026, 2, 12), // March 12
    ]
    const requests = [mockRequest('r1', 'u1', '2026-03-11', '2026-03-11')]
    const map = buildRequestsByDate(days, requests)

    expect(map.get('2026-03-10')).toEqual([])
    expect(map.get('2026-03-11')).toEqual([requests[0]])
    expect(map.get('2026-03-12')).toEqual([])
  })

  test('multi-day request appears on all overlapping days', () => {
    const days = [
      new Date(2026, 2, 10),
      new Date(2026, 2, 11),
      new Date(2026, 2, 12),
      new Date(2026, 2, 13),
      new Date(2026, 2, 14),
    ]
    const requests = [mockRequest('r1', 'u1', '2026-03-11', '2026-03-13')]
    const map = buildRequestsByDate(days, requests)

    expect(map.get('2026-03-10')).toEqual([])
    expect(map.get('2026-03-11')).toEqual([requests[0]])
    expect(map.get('2026-03-12')).toEqual([requests[0]])
    expect(map.get('2026-03-13')).toEqual([requests[0]])
    expect(map.get('2026-03-14')).toEqual([])
  })

  test('multiple requests on the same day', () => {
    const days = [new Date(2026, 2, 15)]
    const requests = [
      mockRequest('r1', 'u1', '2026-03-15', '2026-03-15'),
      mockRequest('r2', 'u2', '2026-03-14', '2026-03-16'), // overlaps 15th
      mockRequest('r3', 'u3', '2026-03-15', '2026-03-17'), // overlaps 15th
    ]
    const map = buildRequestsByDate(days, requests)

    const dayRequests = map.get('2026-03-15')
    expect(dayRequests).toHaveLength(3)
    expect(dayRequests?.map((r) => r.id)).toEqual(['r1', 'r2', 'r3'])
  })

  test('request spanning month boundary', () => {
    const days = [
      new Date(2026, 2, 30), // March 30
      new Date(2026, 2, 31), // March 31
      new Date(2026, 3, 1),  // April 1
      new Date(2026, 3, 2),  // April 2
    ]
    const requests = [mockRequest('r1', 'u1', '2026-03-31', '2026-04-01')]
    const map = buildRequestsByDate(days, requests)

    expect(map.get('2026-03-30')).toEqual([])
    expect(map.get('2026-03-31')).toEqual([requests[0]])
    expect(map.get('2026-04-01')).toEqual([requests[0]])
    expect(map.get('2026-04-02')).toEqual([])
  })

  test('empty requests array returns empty map entries', () => {
    const days = [new Date(2026, 2, 1), new Date(2026, 2, 2)]
    const map = buildRequestsByDate(days, [])

    expect(map.get('2026-03-01')).toEqual([])
    expect(map.get('2026-03-02')).toEqual([])
  })
})

describe('buildCoverageMap', () => {
  const mockRequest = (
    id: string,
    userId: string,
    startDate: string,
    endDate: string,
    status: 'pending' | 'approved' | 'denied',
  ): TimeOffRequest => ({
    id,
    facility_id: 'fac-1',
    user_id: userId,
    start_date: startDate,
    end_date: endDate,
    request_type: 'vacation',
    status,
    notes: null,
    created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z',
    user: {
      id: userId,
      first_name: 'John',
      last_name: 'Doe',
      email: 'john@example.com',
    },
  })

  test('only counts approved requests', () => {
    const days = [new Date(2026, 2, 15)]
    const requests = [
      mockRequest('r1', 'u1', '2026-03-15', '2026-03-15', 'approved'),
      mockRequest('r2', 'u2', '2026-03-15', '2026-03-15', 'pending'),
      mockRequest('r3', 'u3', '2026-03-15', '2026-03-15', 'denied'),
    ]
    const map = buildCoverageMap(days, requests)

    // Only u1 has approved status
    expect(map.get('2026-03-15')).toBe(1)
  })

  test('counts unique users, not duplicate requests', () => {
    const days = [new Date(2026, 2, 15)]
    const requests = [
      mockRequest('r1', 'u1', '2026-03-15', '2026-03-15', 'approved'),
      mockRequest('r2', 'u1', '2026-03-15', '2026-03-15', 'approved'), // same user, different request
      mockRequest('r3', 'u2', '2026-03-15', '2026-03-15', 'approved'),
    ]
    const map = buildCoverageMap(days, requests)

    // u1 and u2 = 2 unique users
    expect(map.get('2026-03-15')).toBe(2)
  })

  test('counts overlapping multi-day requests correctly', () => {
    const days = [
      new Date(2026, 2, 10),
      new Date(2026, 2, 11),
      new Date(2026, 2, 12),
      new Date(2026, 2, 13),
    ]
    const requests = [
      mockRequest('r1', 'u1', '2026-03-10', '2026-03-12', 'approved'), // u1 off 10-12
      mockRequest('r2', 'u2', '2026-03-11', '2026-03-13', 'approved'), // u2 off 11-13
      mockRequest('r3', 'u3', '2026-03-12', '2026-03-12', 'approved'), // u3 off 12 only
    ]
    const map = buildCoverageMap(days, requests)

    expect(map.get('2026-03-10')).toBe(1) // u1
    expect(map.get('2026-03-11')).toBe(2) // u1, u2
    expect(map.get('2026-03-12')).toBe(3) // u1, u2, u3
    expect(map.get('2026-03-13')).toBe(1) // u2
  })

  test('returns 0 for days with no approved requests', () => {
    const days = [
      new Date(2026, 2, 10),
      new Date(2026, 2, 11),
    ]
    const requests = [
      mockRequest('r1', 'u1', '2026-03-10', '2026-03-10', 'pending'),
    ]
    const map = buildCoverageMap(days, requests)

    expect(map.get('2026-03-10')).toBe(0)
    expect(map.get('2026-03-11')).toBe(0)
  })

  test('handles empty requests array', () => {
    const days = [new Date(2026, 2, 1)]
    const map = buildCoverageMap(days, [])

    expect(map.get('2026-03-01')).toBe(0)
  })
})
