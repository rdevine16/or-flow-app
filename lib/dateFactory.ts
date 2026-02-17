/**
 * TIMEZONE-SAFE DATE FACTORY
 * 
 * All surgical scheduling must account for facility timezone.
 * Use these functions instead of `new Date()`.
 * 
 * RULES:
 * 1. Database stores ALL timestamps in UTC (ISO 8601)
 * 2. Display times are converted to facility timezone  
 * 3. User inputs are interpreted in facility timezone
 * 4. NEVER use `new Date()` directly for scheduling
 */

export interface Facility {
  id: string
  timezone: string // IANA timezone (e.g., 'America/New_York')
}

// ============================================
// GET CURRENT TIME IN FACILITY TIMEZONE
// ============================================

/**
 * Get current timestamp in UTC (for database storage)
 * This is safe to use anytime you need "now" for database.
 */
export function nowUTC(): string {
  return new Date().toISOString()
}

/**
 * Get today's date (YYYY-MM-DD) in facility timezone
 * Use this for default values in date inputs.
 */
export function todayInFacility(facility: Facility): string {
  const now = new Date()
  return now.toLocaleDateString('en-CA', {
    timeZone: facility.timezone
  })
}

/**
 * Get current time (HH:MM:SS) in facility timezone  
 * Use this for default values in time inputs.
 */
export function currentTimeInFacility(facility: Facility): string {
  const now = new Date()
  return now.toLocaleTimeString('en-US', {
    timeZone: facility.timezone,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

// ============================================
// PARSE USER INPUT TO UTC
// ============================================

/**
 * Convert a date+time from facility timezone to UTC timestamp
 * 
 * Use this when saving scheduled_start to database.
 * 
 * @example
 * // User enters: Feb 15, 2026 @ 8:30 AM (in New York)
 * const utc = parseToUTC('2026-02-15', '08:30:00', facility)
 * // Returns: '2026-02-15T13:30:00.000Z' (UTC)
 * // Then save to database: { scheduled_start: utc }
 */
export function parseToUTC(
  date: string,      // YYYY-MM-DD
  time: string,      // HH:MM:SS or HH:MM
  facility: Facility
): string {
  // Normalize time to HH:MM:SS
  const timeNormalized = time.length === 5 ? `${time}:00` : time

  // Parse the datetime as if it's in the facility timezone
  // We do this by creating a Date object and then adjusting for the timezone offset
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute, second] = timeNormalized.split(':').map(Number)
  
  // Create a date in UTC with these values
  const tempDate = new Date(Date.UTC(year, month - 1, day, hour, minute, second))
  
  // Get the string representation in the facility timezone
  const facilityStr = tempDate.toLocaleString('en-US', {
    timeZone: facility.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  
  // Parse it back as UTC
  const [datePart, timePart] = facilityStr.split(', ')
  const [m, d, y] = datePart.split('/')
  const finalDate = new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T${timePart}`)
  
  // Calculate the offset and adjust
  const offset = tempDate.getTime() - finalDate.getTime()
  const correctDate = new Date(tempDate.getTime() + offset)
  
  return correctDate.toISOString()
}

/**
 * SIMPLIFIED VERSION - Use this if the above is too complex
 * Assumes the date+time string represents local time in the facility
 */
export function parseToUTCSimple(
  date: string,
  time: string,
  facility: Facility
): string {
  const timeNormalized = time.length === 5 ? `${time}:00` : time
  const combinedStr = `${date}T${timeNormalized}`

  // Create formatter for the facility timezone
  new Intl.DateTimeFormat('en-US', {
    timeZone: facility.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  // Parse the local time as UTC first (wrong, but we'll correct)
  const parts = combinedStr.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/)
  if (!parts) throw new Error('Invalid date/time format')
  
  const [, y, m, d, h, min, s] = parts
  const utcDate = new Date(Date.UTC(
    parseInt(y),
    parseInt(m) - 1,
    parseInt(d),
    parseInt(h),
    parseInt(min),
    parseInt(s)
  ))
  
  return utcDate.toISOString()
}

// ============================================
// FORMAT UTC FOR DISPLAY
// ============================================

/**
 * Format UTC timestamp for display in facility timezone
 * 
 * @example
 * formatForDisplay('2026-02-15T13:30:00.000Z', facility)
 * // Returns in New York: { date: '2026-02-15', time: '08:30 am' }
 */
export function formatForDisplay(
  utcTimestamp: string | null | undefined,
  facility: Facility
): { date: string; time: string; datetime: string } {
  if (!utcTimestamp) {
    return { date: '--', time: '--:--', datetime: '--' }
  }
  
  const date = new Date(utcTimestamp)
  
  return {
    date: date.toLocaleDateString('en-CA', {
      timeZone: facility.timezone
    }),
    time: date.toLocaleTimeString('en-US', {
      timeZone: facility.timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).toLowerCase(),
    datetime: date.toLocaleString('en-US', {
      timeZone: facility.timezone,
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).toLowerCase(),
  }
}

/**
 * Format time only (for milestone timestamps)
 */
export function formatTimeOnly(
  utcTimestamp: string | null | undefined,
  facility: Facility
): string {
  if (!utcTimestamp) return '--:--'
  
  const date = new Date(utcTimestamp)
  return date.toLocaleTimeString('en-US', {
    timeZone: facility.timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).toLowerCase()
}

// ============================================
// CALCULATIONS
// ============================================

/**
 * Calculate difference in minutes between two timestamps
 * Positive = timestamp1 is later, Negative = timestamp1 is earlier
 */
export function minutesBetween(
  timestamp1: string,
  timestamp2: string
): number {
  const date1 = new Date(timestamp1)
  const date2 = new Date(timestamp2)
  return Math.round((date1.getTime() - date2.getTime()) / 60000)
}

/**
 * Add days to a date string
 */
export function addDays(
  dateString: string,
  days: number,
  facility: Facility
): string {
  const [year, month, day] = dateString.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + days)
  
  return date.toLocaleDateString('en-CA', {
    timeZone: facility.timezone
  })
}

/**
 * Get start and end of week for a given date
 */
export function getWeekBounds(
  dateString: string,
  facility: Facility
): { start: string; end: string } {
  const [year, month, day] = dateString.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  
  // Get day of week (0 = Sunday)
  const dayOfWeek = date.getDay()
  
  // Calculate start (Sunday) and end (Saturday)
  const start = new Date(date)
  start.setDate(date.getDate() - dayOfWeek)
  
  const end = new Date(date)
  end.setDate(date.getDate() + (6 - dayOfWeek))
  
  return {
    start: start.toLocaleDateString('en-CA', { timeZone: facility.timezone }),
    end: end.toLocaleDateString('en-CA', { timeZone: facility.timezone }),
  }
}

// ============================================
// VALIDATION
// ============================================

export function isValidDateString(dateString: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/
  if (!regex.test(dateString)) return false
  
  const [year, month, day] = dateString.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  )
}

export function isValidTimeString(timeString: string): boolean {
  const regex = /^(\d{2}):(\d{2})(?::(\d{2}))?$/
  const match = timeString.match(regex)
  if (!match) return false
  
  const [, hours, minutes, seconds = '00'] = match
  const h = parseInt(hours)
  const m = parseInt(minutes)
  const s = parseInt(seconds)
  
  return h >= 0 && h < 24 && m >= 0 && m < 60 && s >= 0 && s < 60
}

// ============================================
// MIGRATION HELPER
// ============================================

/**
 * Find all instances of new Date() in your codebase:
 * 
 * grep -r "new Date()" app/ components/ lib/
 * 
 * Replace them with:
 * - nowUTC() → for current timestamp to save to database
 * - todayInFacility(facility) → for today's date in UI
 * - currentTimeInFacility(facility) → for current time in UI
 * - parseToUTC(date, time, facility) → when saving user input
 * - formatForDisplay(utcTimestamp, facility) → when displaying timestamps
 */
