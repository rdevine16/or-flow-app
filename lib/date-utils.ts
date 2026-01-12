/**
 * Get today's date in YYYY-MM-DD format using local timezone
 */
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Format a date string for display (e.g., "January 7, 2025")
 */
export function formatDateDisplay(dateString: string): string {
  // Parse as local date (not UTC)
  const [year, month, day] = dateString.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

/**
 * Format a date string with weekday (e.g., "Tuesday, January 7, 2025")
 */
export function formatDateWithWeekday(dateString: string): string {
  const [year, month, day] = dateString.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

/**
 * Format a date for short display (e.g., "Jan 7")
 */
export function formatDateShort(dateString: string): string {
  const [year, month, day] = dateString.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  })
}

/**
 * Check if a date string is today
 */
export function isToday(dateString: string): boolean {
  return dateString === getLocalDateString()
}

/**
 * Get date range for filters
 */
export function getDateRange(filter: string): { start: string; end: string } {
  const today = new Date()
  const todayStr = getLocalDateString(today)
  
  switch (filter) {
    case 'today':
      return { start: todayStr, end: todayStr }
    
    case 'yesterday': {
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = getLocalDateString(yesterday)
      return { start: yesterdayStr, end: yesterdayStr }
    }
    
    case 'week': {
      const weekAgo = new Date(today)
      weekAgo.setDate(weekAgo.getDate() - 7)
      return { start: getLocalDateString(weekAgo), end: todayStr }
    }
    
    case 'month': {
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
      return { start: getLocalDateString(monthStart), end: todayStr }
    }
    
    case 'quarter': {
      const quarterStart = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1)
      return { start: getLocalDateString(quarterStart), end: todayStr }
    }
    
    default:
      return { start: todayStr, end: todayStr }
  }
}

// ============================================
// TIMEZONE-AWARE FUNCTIONS
// All timestamps are stored in UTC in the database.
// These functions convert to the facility's local timezone for display.
// ============================================

/**
 * Format a UTC timestamp to a time string in the specified timezone
 * @param utcTimestamp - ISO timestamp string (UTC)
 * @param timezone - IANA timezone string (e.g., 'America/New_York')
 * @returns Formatted time string (e.g., "07:34 am")
 */
export function formatTimeInTimezone(
  utcTimestamp: string | null | undefined,
  timezone: string = 'America/New_York'
): string {
  if (!utcTimestamp) return '--:--'
  
  try {
    const date = new Date(utcTimestamp)
    return date.toLocaleTimeString('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).toLowerCase()
  } catch (error) {
    console.error('Error formatting time:', error)
    return '--:--'
  }
}

/**
 * Format a UTC timestamp to a date string in the specified timezone
 * @param utcTimestamp - ISO timestamp string (UTC)
 * @param timezone - IANA timezone string
 * @returns Formatted date string (e.g., "1/5/2026")
 */
export function formatDateInTimezone(
  utcTimestamp: string | null | undefined,
  timezone: string = 'America/New_York'
): string {
  if (!utcTimestamp) return '--/--/----'
  
  try {
    const date = new Date(utcTimestamp)
    return date.toLocaleDateString('en-US', {
      timeZone: timezone,
      month: 'numeric',
      day: 'numeric',
      year: 'numeric',
    })
  } catch (error) {
    console.error('Error formatting date:', error)
    return '--/--/----'
  }
}

/**
 * Format a UTC timestamp to a full datetime string in the specified timezone
 * @param utcTimestamp - ISO timestamp string (UTC)
 * @param timezone - IANA timezone string
 * @returns Formatted datetime string (e.g., "1/5/2026, 07:34 am")
 */
export function formatDateTimeInTimezone(
  utcTimestamp: string | null | undefined,
  timezone: string = 'America/New_York'
): string {
  if (!utcTimestamp) return '--'
  
  try {
    const date = new Date(utcTimestamp)
    return date.toLocaleString('en-US', {
      timeZone: timezone,
      month: 'numeric',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).toLowerCase()
  } catch (error) {
    console.error('Error formatting datetime:', error)
    return '--'
  }
}

/**
 * Calculate the difference in minutes between a scheduled time and actual time
 * @param scheduledDate - Date string (YYYY-MM-DD) 
 * @param scheduledTime - Time string (HH:MM:SS or HH:MM)
 * @param actualTimestamp - UTC timestamp of actual start
 * @param timezone - Facility timezone
 * @returns Positive = late, Negative = early, null = invalid
 */
export function getDelayMinutes(
  scheduledDate: string,
  scheduledTime: string,
  actualTimestamp: string | null | undefined,
  timezone: string = 'America/New_York'
): number | null {
  if (!actualTimestamp || !scheduledDate || !scheduledTime) return null
  
  try {
    // Create scheduled time in facility timezone
    // Format: "2026-01-05T07:30:00" interpreted in facility timezone
    const scheduledStr = `${scheduledDate}T${scheduledTime}`
    
    // Get the actual time in the facility timezone
    const actualDate = new Date(actualTimestamp)
    const actualInTZ = new Date(actualDate.toLocaleString('en-US', { timeZone: timezone }))
    
    // Parse scheduled as if it's in the facility timezone
    const scheduledParts = scheduledStr.split(/[-T:]/).map(Number)
    const scheduledInTZ = new Date(
      scheduledParts[0], // year
      scheduledParts[1] - 1, // month (0-indexed)
      scheduledParts[2], // day
      scheduledParts[3] || 0, // hour
      scheduledParts[4] || 0, // minute
      scheduledParts[5] || 0  // second
    )
    
    const diffMs = actualInTZ.getTime() - scheduledInTZ.getTime()
    return Math.round(diffMs / 60000) // Convert to minutes
  } catch (error) {
    console.error('Error calculating delay:', error)
    return null
  }
}

/**
 * Format delay minutes as a human-readable status
 * @param minutes - Number of minutes (positive = late, negative = early)
 * @returns Formatted string (e.g., "5 min late", "3 min early", "On time")
 */
export function formatDelayStatus(minutes: number | null): string {
  if (minutes === null) return '--'
  
  if (minutes > 5) {
    return `${minutes} min late`
  } else if (minutes < -5) {
    return `${Math.abs(minutes)} min early`
  } else {
    return 'On time'
  }
}

/**
 * Get today's date string (YYYY-MM-DD) in a specific timezone
 * @param timezone - IANA timezone string
 */
export function getTodayInTimezone(timezone: string = 'America/New_York'): string {
  const now = new Date()
  return now.toLocaleDateString('en-CA', { timeZone: timezone }) // en-CA gives YYYY-MM-DD
}
