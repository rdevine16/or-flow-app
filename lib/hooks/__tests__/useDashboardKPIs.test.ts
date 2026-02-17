import { describe, it, expect } from 'vitest'

// Test the date range helper by extracting its logic.
// The getDateRanges function is not exported, so we test it indirectly
// by validating date math logic here.

function getLocalDateString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

type TimeRange = 'today' | 'week' | 'month'

interface DateRangePair {
  current: { start: string; end: string }
  previous: { start: string; end: string }
}

function getDateRanges(timeRange: TimeRange, referenceDate: Date = new Date()): DateRangePair {
  const today = referenceDate
  const todayStr = getLocalDateString(today)

  switch (timeRange) {
    case 'today': {
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      return {
        current: { start: todayStr, end: todayStr },
        previous: { start: getLocalDateString(yesterday), end: getLocalDateString(yesterday) },
      }
    }
    case 'week': {
      const dayOfWeek = today.getDay()
      const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1
      const monday = new Date(today)
      monday.setDate(today.getDate() - mondayOffset)

      const prevMonday = new Date(monday)
      prevMonday.setDate(monday.getDate() - 7)
      const prevSunday = new Date(monday)
      prevSunday.setDate(monday.getDate() - 1)

      return {
        current: { start: getLocalDateString(monday), end: todayStr },
        previous: { start: getLocalDateString(prevMonday), end: getLocalDateString(prevSunday) },
      }
    }
    case 'month': {
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)

      const prevMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)
      const prevMonthStart = new Date(prevMonthEnd.getFullYear(), prevMonthEnd.getMonth(), 1)

      return {
        current: { start: getLocalDateString(monthStart), end: todayStr },
        previous: { start: getLocalDateString(prevMonthStart), end: getLocalDateString(prevMonthEnd) },
      }
    }
  }
}

describe('getDateRanges', () => {
  it('today: returns current day and yesterday', () => {
    // Wednesday Feb 12, 2025
    const ref = new Date(2025, 1, 12) // month is 0-indexed
    const ranges = getDateRanges('today', ref)

    expect(ranges.current.start).toBe('2025-02-12')
    expect(ranges.current.end).toBe('2025-02-12')
    expect(ranges.previous.start).toBe('2025-02-11')
    expect(ranges.previous.end).toBe('2025-02-11')
  })

  it('week: returns Monday-today and prior week', () => {
    // Wednesday Feb 12, 2025 (Wednesday)
    const ref = new Date(2025, 1, 12)
    const ranges = getDateRanges('week', ref)

    expect(ranges.current.start).toBe('2025-02-10') // Monday
    expect(ranges.current.end).toBe('2025-02-12')   // Today (Wed)
    expect(ranges.previous.start).toBe('2025-02-03') // Prev Monday
    expect(ranges.previous.end).toBe('2025-02-09')   // Prev Sunday
  })

  it('week: handles Sunday correctly (goes to prior Monday)', () => {
    // Sunday Feb 16, 2025
    const ref = new Date(2025, 1, 16)
    const ranges = getDateRanges('week', ref)

    expect(ranges.current.start).toBe('2025-02-10') // Monday of this week
    expect(ranges.current.end).toBe('2025-02-16')   // Sunday
  })

  it('week: handles Monday correctly (week starts today)', () => {
    // Monday Feb 10, 2025
    const ref = new Date(2025, 1, 10)
    const ranges = getDateRanges('week', ref)

    expect(ranges.current.start).toBe('2025-02-10')
    expect(ranges.current.end).toBe('2025-02-10')
    expect(ranges.previous.start).toBe('2025-02-03')
    expect(ranges.previous.end).toBe('2025-02-09')
  })

  it('month: returns 1st of month through today', () => {
    // Feb 15, 2025
    const ref = new Date(2025, 1, 15)
    const ranges = getDateRanges('month', ref)

    expect(ranges.current.start).toBe('2025-02-01')
    expect(ranges.current.end).toBe('2025-02-15')
    expect(ranges.previous.start).toBe('2025-01-01')
    expect(ranges.previous.end).toBe('2025-01-31')
  })

  it('month: handles January (previous month is December prior year)', () => {
    // Jan 20, 2025
    const ref = new Date(2025, 0, 20)
    const ranges = getDateRanges('month', ref)

    expect(ranges.current.start).toBe('2025-01-01')
    expect(ranges.current.end).toBe('2025-01-20')
    expect(ranges.previous.start).toBe('2024-12-01')
    expect(ranges.previous.end).toBe('2024-12-31')
  })

  it('month: handles first day of month', () => {
    // Mar 1, 2025
    const ref = new Date(2025, 2, 1)
    const ranges = getDateRanges('month', ref)

    expect(ranges.current.start).toBe('2025-03-01')
    expect(ranges.current.end).toBe('2025-03-01')
    expect(ranges.previous.start).toBe('2025-02-01')
    expect(ranges.previous.end).toBe('2025-02-28')
  })
})
