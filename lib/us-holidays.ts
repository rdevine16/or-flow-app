// lib/us-holidays.ts
// Algorithmic computation of US federal holidays.
// No hardcoded date lists — computes from rules for any year.

export interface USHoliday {
  date: Date
  name: string
}

/**
 * Get the Nth occurrence of a weekday in a given month/year.
 * weekday: 0 = Sunday, 1 = Monday, etc.
 * n: 1-based (1st, 2nd, 3rd, etc.)
 */
function nthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): Date {
  const first = new Date(year, month, 1)
  const firstWeekday = first.getDay()
  const day = 1 + ((weekday - firstWeekday + 7) % 7) + (n - 1) * 7
  return new Date(year, month, day)
}

/**
 * Get the last occurrence of a weekday in a given month/year.
 */
function lastWeekdayOfMonth(year: number, month: number, weekday: number): Date {
  const last = new Date(year, month + 1, 0)
  const diff = (last.getDay() - weekday + 7) % 7
  return new Date(year, month, last.getDate() - diff)
}

/**
 * If a fixed holiday falls on Saturday, it's observed on Friday.
 * If it falls on Sunday, it's observed on Monday.
 */
function observedDate(date: Date): Date {
  const day = date.getDay()
  if (day === 6) return new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1)
  if (day === 0) return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
  return date
}

/**
 * Compute all US federal holidays for a given year.
 * Returns observed dates (shifted for weekends).
 */
export function getUSHolidays(year: number): USHoliday[] {
  const holidays: USHoliday[] = [
    // New Year's Day — January 1
    { date: observedDate(new Date(year, 0, 1)), name: "New Year's Day" },

    // MLK Day — 3rd Monday of January
    { date: nthWeekdayOfMonth(year, 0, 1, 3), name: 'Martin Luther King Jr. Day' },

    // Presidents' Day — 3rd Monday of February
    { date: nthWeekdayOfMonth(year, 1, 1, 3), name: "Presidents' Day" },

    // Memorial Day — Last Monday of May
    { date: lastWeekdayOfMonth(year, 4, 1), name: 'Memorial Day' },

    // Juneteenth — June 19
    { date: observedDate(new Date(year, 5, 19)), name: 'Juneteenth' },

    // Independence Day — July 4
    { date: observedDate(new Date(year, 6, 4)), name: 'Independence Day' },

    // Labor Day — 1st Monday of September
    { date: nthWeekdayOfMonth(year, 8, 1, 1), name: 'Labor Day' },

    // Columbus Day — 2nd Monday of October
    { date: nthWeekdayOfMonth(year, 9, 1, 2), name: 'Columbus Day' },

    // Veterans Day — November 11
    { date: observedDate(new Date(year, 10, 11)), name: 'Veterans Day' },

    // Thanksgiving — 4th Thursday of November
    { date: nthWeekdayOfMonth(year, 10, 4, 4), name: 'Thanksgiving Day' },

    // Christmas — December 25
    { date: observedDate(new Date(year, 11, 25)), name: 'Christmas Day' },
  ]

  return holidays.sort((a, b) => a.date.getTime() - b.date.getTime())
}

/**
 * Get a Set of holiday date strings (YYYY-MM-DD) for a range of years.
 * Use this as a fast lookup during date generation.
 */
export function getHolidayDateSet(startYear: number, endYear: number): Set<string> {
  const dates = new Set<string>()
  for (let year = startYear; year <= endYear; year++) {
    for (const holiday of getUSHolidays(year)) {
      const y = holiday.date.getFullYear()
      const m = String(holiday.date.getMonth() + 1).padStart(2, '0')
      const d = String(holiday.date.getDate()).padStart(2, '0')
      dates.add(`${y}-${m}-${d}`)
    }
  }
  return dates
}

/**
 * Check if a specific date is a US federal holiday.
 */
export function isUSHoliday(date: Date): boolean {
  const holidays = getUSHolidays(date.getFullYear())
  return holidays.some(h =>
    h.date.getFullYear() === date.getFullYear() &&
    h.date.getMonth() === date.getMonth() &&
    h.date.getDate() === date.getDate()
  )
}

/**
 * Count the number of US federal holidays in a date range.
 */
export function countHolidaysInRange(startDate: Date, endDate: Date): number {
  let count = 0
  const startYear = startDate.getFullYear()
  const endYear = endDate.getFullYear()

  for (let year = startYear; year <= endYear; year++) {
    for (const holiday of getUSHolidays(year)) {
      if (holiday.date >= startDate && holiday.date <= endDate) {
        count++
      }
    }
  }

  return count
}
