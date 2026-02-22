// lib/__tests__/us-holidays.test.ts
import { describe, it, expect } from 'vitest'
import { getUSHolidays, getHolidayDateSet, isUSHoliday, countHolidaysInRange } from '../us-holidays'

describe('us-holidays.ts — Algorithmic US federal holiday computation', () => {
  describe('getUSHolidays', () => {
    it('returns 11 federal holidays for any year', () => {
      expect(getUSHolidays(2025).length).toBe(11)
      expect(getUSHolidays(2026).length).toBe(11)
      expect(getUSHolidays(2030).length).toBe(11)
    })

    it('sorts holidays chronologically', () => {
      const holidays = getUSHolidays(2025)
      for (let i = 1; i < holidays.length; i++) {
        expect(holidays[i].date.getTime()).toBeGreaterThan(holidays[i - 1].date.getTime())
      }
    })

    it('includes New Year\'s Day (January 1)', () => {
      const holidays = getUSHolidays(2025)
      const newYear = holidays.find(h => h.name === "New Year's Day")
      expect(newYear).toBeDefined()
      expect(newYear!.date.getMonth()).toBe(0) // January
    })

    it('includes MLK Day (3rd Monday of January)', () => {
      const holidays = getUSHolidays(2025)
      const mlk = holidays.find(h => h.name === 'Martin Luther King Jr. Day')
      expect(mlk).toBeDefined()
      expect(mlk!.date.getMonth()).toBe(0) // January
      expect(mlk!.date.getDay()).toBe(1) // Monday
      // 2025: 3rd Monday = Jan 20
      expect(mlk!.date.getDate()).toBe(20)
    })

    it('includes Presidents\' Day (3rd Monday of February)', () => {
      const holidays = getUSHolidays(2025)
      const presidents = holidays.find(h => h.name === "Presidents' Day")
      expect(presidents).toBeDefined()
      expect(presidents!.date.getMonth()).toBe(1) // February
      expect(presidents!.date.getDay()).toBe(1) // Monday
    })

    it('includes Memorial Day (last Monday of May)', () => {
      const holidays = getUSHolidays(2025)
      const memorial = holidays.find(h => h.name === 'Memorial Day')
      expect(memorial).toBeDefined()
      expect(memorial!.date.getMonth()).toBe(4) // May
      expect(memorial!.date.getDay()).toBe(1) // Monday
      // 2025: May 26
      expect(memorial!.date.getDate()).toBe(26)
    })

    it('includes Juneteenth (June 19)', () => {
      const holidays = getUSHolidays(2025)
      const juneteenth = holidays.find(h => h.name === 'Juneteenth')
      expect(juneteenth).toBeDefined()
      expect(juneteenth!.date.getMonth()).toBe(5) // June
    })

    it('includes Independence Day (July 4)', () => {
      const holidays = getUSHolidays(2025)
      const july4 = holidays.find(h => h.name === 'Independence Day')
      expect(july4).toBeDefined()
      expect(july4!.date.getMonth()).toBe(6) // July
    })

    it('includes Labor Day (1st Monday of September)', () => {
      const holidays = getUSHolidays(2025)
      const labor = holidays.find(h => h.name === 'Labor Day')
      expect(labor).toBeDefined()
      expect(labor!.date.getMonth()).toBe(8) // September
      expect(labor!.date.getDay()).toBe(1) // Monday
    })

    it('includes Columbus Day (2nd Monday of October)', () => {
      const holidays = getUSHolidays(2025)
      const columbus = holidays.find(h => h.name === 'Columbus Day')
      expect(columbus).toBeDefined()
      expect(columbus!.date.getMonth()).toBe(9) // October
      expect(columbus!.date.getDay()).toBe(1) // Monday
    })

    it('includes Veterans Day (November 11)', () => {
      const holidays = getUSHolidays(2025)
      const veterans = holidays.find(h => h.name === 'Veterans Day')
      expect(veterans).toBeDefined()
      expect(veterans!.date.getMonth()).toBe(10) // November
    })

    it('includes Thanksgiving (4th Thursday of November)', () => {
      const holidays = getUSHolidays(2025)
      const thanksgiving = holidays.find(h => h.name === 'Thanksgiving Day')
      expect(thanksgiving).toBeDefined()
      expect(thanksgiving!.date.getMonth()).toBe(10) // November
      expect(thanksgiving!.date.getDay()).toBe(4) // Thursday
    })

    it('includes Christmas (December 25)', () => {
      const holidays = getUSHolidays(2025)
      const christmas = holidays.find(h => h.name === 'Christmas Day')
      expect(christmas).toBeDefined()
      expect(christmas!.date.getMonth()).toBe(11) // December
    })

    it('observes Saturday holidays on Friday', () => {
      // 2026: July 4 falls on Saturday → observed Friday July 3
      const holidays = getUSHolidays(2026)
      const july4 = holidays.find(h => h.name === 'Independence Day')
      expect(july4!.date.getDate()).toBe(3)
      expect(july4!.date.getDay()).toBe(5) // Friday
    })

    it('observes Sunday holidays on Monday', () => {
      // 2026: New Year's Day (Jan 1) falls on Thursday (not Sunday)
      // 2027: Jan 1 falls on Friday (not Sunday)
      // 2028: Jan 1 falls on Saturday → observed Dec 31, 2027
      // Let's use 2023: Jan 1 is Sunday → observed Monday Jan 2
      const holidays = getUSHolidays(2023)
      const newYear = holidays.find(h => h.name === "New Year's Day")
      expect(newYear!.date.getDate()).toBe(2)
      expect(newYear!.date.getDay()).toBe(1) // Monday
    })

    it('does not shift weekday holidays', () => {
      // 2025: July 4 falls on Friday → observed as-is
      const holidays = getUSHolidays(2025)
      const july4 = holidays.find(h => h.name === 'Independence Day')
      expect(july4!.date.getDate()).toBe(4)
      expect(july4!.date.getDay()).toBe(5) // Friday
    })
  })

  describe('getHolidayDateSet', () => {
    it('returns a Set of YYYY-MM-DD formatted strings', () => {
      const dateSet = getHolidayDateSet(2025, 2025)
      expect(dateSet).toBeInstanceOf(Set)
      expect(dateSet.size).toBe(11)

      // Check format
      for (const dateStr of dateSet) {
        expect(dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      }
    })

    it('includes holidays from multiple years', () => {
      const dateSet = getHolidayDateSet(2025, 2026)
      expect(dateSet.size).toBe(22) // 11 per year * 2 years
    })

    it('handles single year range', () => {
      const dateSet = getHolidayDateSet(2025, 2025)
      expect(dateSet.size).toBe(11)
    })

    it('produces unique dates (no duplicates)', () => {
      const dateSet = getHolidayDateSet(2025, 2027)
      const dateArray = Array.from(dateSet)
      expect(dateArray.length).toBe(new Set(dateArray).size)
    })

    it('formats dates with zero-padded months and days', () => {
      const dateSet = getHolidayDateSet(2025, 2025)
      // New Year's Day 2025 (observed) = 2025-01-01
      expect(dateSet.has('2025-01-01')).toBe(true)
      // July 4 = 2025-07-04
      expect(dateSet.has('2025-07-04')).toBe(true)
    })
  })

  describe('isUSHoliday', () => {
    it('returns true for July 4, 2025', () => {
      const date = new Date(2025, 6, 4) // July 4, 2025 (Friday)
      expect(isUSHoliday(date)).toBe(true)
    })

    it('returns false for a regular working day', () => {
      const date = new Date(2025, 6, 7) // July 7, 2025 (Monday, not a holiday)
      expect(isUSHoliday(date)).toBe(false)
    })

    it('returns true for observed dates (Saturday → Friday)', () => {
      // July 4, 2026 is Saturday → observed July 3
      const observedDate = new Date(2026, 6, 3) // July 3, 2026 (Friday)
      expect(isUSHoliday(observedDate)).toBe(true)
    })

    it('returns false for the actual date when observed elsewhere', () => {
      // July 4, 2026 is Saturday → observed July 3, so July 4 itself is NOT in the list
      const actualDate = new Date(2026, 6, 4) // July 4, 2026 (Saturday)
      expect(isUSHoliday(actualDate)).toBe(false)
    })

    it('returns true for Thanksgiving 2025', () => {
      const thanksgiving = new Date(2025, 10, 27) // Nov 27, 2025 (4th Thursday)
      expect(isUSHoliday(thanksgiving)).toBe(true)
    })

    it('returns true for Christmas 2025', () => {
      const christmas = new Date(2025, 11, 25) // Dec 25, 2025 (Thursday)
      expect(isUSHoliday(christmas)).toBe(true)
    })
  })

  describe('countHolidaysInRange', () => {
    it('counts all 11 holidays in a full calendar year', () => {
      const start = new Date(2025, 0, 1)
      const end = new Date(2025, 11, 31)
      expect(countHolidaysInRange(start, end)).toBe(11)
    })

    it('counts 0 holidays when range contains none', () => {
      // Aug 1 - Aug 15, 2025 (no holidays)
      const start = new Date(2025, 7, 1)
      const end = new Date(2025, 7, 15)
      expect(countHolidaysInRange(start, end)).toBe(0)
    })

    it('counts 1 holiday when range contains exactly one', () => {
      // July 1 - July 10, 2025 (includes July 4)
      const start = new Date(2025, 6, 1)
      const end = new Date(2025, 6, 10)
      expect(countHolidaysInRange(start, end)).toBe(1)
    })

    it('counts holidays spanning multiple years', () => {
      // Dec 1, 2025 - Jan 31, 2026 (Christmas 2025 + New Year's 2026 + MLK 2026)
      const start = new Date(2025, 11, 1)
      const end = new Date(2026, 0, 31)
      expect(countHolidaysInRange(start, end)).toBe(3)
    })

    it('includes holidays at exact range boundaries', () => {
      // July 4, 2025 only
      const start = new Date(2025, 6, 4)
      const end = new Date(2025, 6, 4)
      expect(countHolidaysInRange(start, end)).toBe(1)
    })

    it('counts Q4 holidays (Veterans, Thanksgiving, Christmas)', () => {
      // Oct 1 - Dec 31, 2025
      const start = new Date(2025, 9, 1)
      const end = new Date(2025, 11, 31)
      // Columbus Day (Oct 13), Veterans Day (Nov 11), Thanksgiving (Nov 27), Christmas (Dec 25)
      expect(countHolidaysInRange(start, end)).toBe(4)
    })

    it('counts Q1 holidays (New Year, MLK, Presidents)', () => {
      // Jan 1 - Mar 31, 2025
      const start = new Date(2025, 0, 1)
      const end = new Date(2025, 2, 31)
      // New Year's Day (Jan 1), MLK Day (Jan 20), Presidents' Day (Feb 17)
      expect(countHolidaysInRange(start, end)).toBe(3)
    })
  })
})
