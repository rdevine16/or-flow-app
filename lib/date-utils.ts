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