// lib/formatters.ts
// Centralized formatting utilities for ORbit
// Eliminates duplicate getValue, formatTime, formatSurgeon functions across the codebase

// ========================================
// Type Helpers
// ========================================

type JoinedData<T> = T | T[] | null

/**
 * Safely extract value from Supabase joined data.
 * Supabase can return relations as arrays or single objects depending on configuration.
 * This normalizes both cases.
 * 
 * @example
 * const room = getJoinedValue(case.or_rooms) // { name: "OR 1" } or null
 */
export function getJoinedValue<T>(data: JoinedData<T>): T | null {
  if (!data) return null
  if (Array.isArray(data)) return data[0] || null
  return data
}

// ========================================
// Name Extractors
// ========================================

/**
 * Extract the `name` property from Supabase joined data.
 * This is the most common pattern - replaces all the duplicate getValue functions.
 * 
 * @example
 * extractName(case.procedure_types)  // "Total Hip Replacement"
 * extractName(case.or_rooms)         // "OR 1"
 * extractName(case.case_statuses)    // "in_progress"
 */
export function extractName(
  data: { name: string }[] | { name: string } | null
): string | null {
  const joined = getJoinedValue(data)
  return joined?.name || null
}

/**
 * Format surgeon name from joined data.
 * 
 * @param data - Surgeon data from Supabase join
 * @param options.format - 'short' = "Dr. Smith", 'full' = "John Smith"
 * @param options.fallback - What to return if surgeon is null
 * 
 * @example
 * formatSurgeonName(case.surgeon)                        // "Dr. Smith"
 * formatSurgeonName(case.surgeon, { format: 'full' })    // "John Smith"
 * formatSurgeonName(null, { fallback: 'TBD' })           // "TBD"
 */
export function formatSurgeonName(
  data: { first_name: string; last_name: string }[] | { first_name: string; last_name: string } | null,
  options: { format?: 'short' | 'full'; fallback?: string } = {}
): string {
  const { format = 'short', fallback = 'Unassigned' } = options
  const surgeon = getJoinedValue(data)
  
  if (!surgeon) return fallback
  
  return format === 'full' 
    ? `${surgeon.first_name} ${surgeon.last_name}`
    : `Dr. ${surgeon.last_name}`
}

/**
 * Get surgeon initials for avatars.
 * 
 * @example
 * getSurgeonInitials(case.surgeon) // "JS"
 * getSurgeonInitials(null)         // "?"
 */
export function getSurgeonInitials(
  data: { first_name: string; last_name: string }[] | { first_name: string; last_name: string } | null
): string {
  const surgeon = getJoinedValue(data)
  if (!surgeon) return '?'
  return `${surgeon.first_name[0] || ''}${surgeon.last_name[0] || ''}`.toUpperCase()
}

// ========================================
// Date/Time Formatters
// ========================================

/**
 * Format a date string for display.
 * 
 * @param dateString - ISO date string (YYYY-MM-DD)
 * @param options.style - 'short' (1/15), 'medium' (Jan 15, 2025), 'long' (Wed, Jan 15, 2025)
 * 
 * @example
 * formatDisplayDate('2025-01-15')                      // "Jan 15, 2025"
 * formatDisplayDate('2025-01-15', { style: 'short' })  // "1/15"
 * formatDisplayDate('2025-01-15', { style: 'long' })   // "Wed, Jan 15, 2025"
 */
export function formatDisplayDate(
  dateString: string | null | undefined,
  options: {
    style?: 'short' | 'medium' | 'long'
    fallback?: string
  } = {}
): string {
  const { style = 'medium', fallback = '' } = options
  
  if (!dateString) return fallback
  
  try {
    // Add time component to prevent timezone issues
    const date = new Date(dateString + 'T00:00:00')
    
    const formatOptionsMap: Record<'short' | 'medium' | 'long', Intl.DateTimeFormatOptions> = {
      short: { month: 'numeric', day: 'numeric' },
      medium: { month: 'short', day: 'numeric', year: 'numeric' },
      long: { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }
    }
    
    return date.toLocaleDateString('en-US', formatOptionsMap[style])
  } catch {
    return fallback || dateString
  }
}

/**
 * Format time string (HH:MM:SS or HH:MM) to 12-hour format.
 * 
 * @example
 * formatDisplayTime('14:30')    // "2:30 PM"
 * formatDisplayTime('09:05')    // "9:05 AM"
 * formatDisplayTime('00:00')    // "12:00 AM"
 * formatDisplayTime(null)       // ""
 */
export function formatDisplayTime(
  timeString: string | null | undefined,
  options: { fallback?: string } = {}
): string {
  const { fallback = '' } = options
  
  if (!timeString) return fallback
  
  try {
    const [hours, minutes] = timeString.split(':').map(Number)
    const period = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours % 12 || 12
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`
  } catch {
    return fallback || timeString
  }
}

/**
 * Format a date string with relative labels (Today, Yesterday, Tomorrow).
 * Falls back to a short formatted date for other dates.
 * 
 * @example
 * formatRelativeDate('2025-02-10')  // "Today" (if today is 2/10)
 * formatRelativeDate('2025-02-09')  // "Yesterday"
 * formatRelativeDate('2025-02-05')  // "Wed, Feb 5"
 */
export function formatRelativeDate(
  dateString: string | null | undefined,
  options: { fallback?: string } = {}
): string {
  const { fallback = '' } = options

  if (!dateString) return fallback

  try {
    const [year, month, day] = dateString.split('-').map(Number)
    const caseDate = new Date(year, month - 1, day)
    caseDate.setHours(0, 0, 0, 0)

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const diffMs = caseDate.getTime() - today.getTime()
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Today'
    if (diffDays === -1) return 'Yesterday'
    if (diffDays === 1) return 'Tomorrow'

    return caseDate.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return fallback || dateString
  }
}

/**
 * Format duration in minutes to human-readable string.
 * 
 * @example
 * formatDuration(45)   // "45m"
 * formatDuration(95)   // "1h 35m"
 * formatDuration(120)  // "2h"
 * formatDuration(null) // "--"
 */
export function formatDuration(
  minutes: number | null | undefined,
  options: { fallback?: string } = {}
): string {
  const { fallback = '--' } = options
  
  if (minutes == null || isNaN(minutes)) return fallback
  
  const rounded = Math.round(minutes)
  if (rounded < 60) return `${rounded}m`
  
  const hours = Math.floor(rounded / 60)
  const mins = rounded % 60
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

// ========================================
// Case Status Helpers
// ========================================

export type CaseStatus = 'scheduled' | 'in_progress' | 'completed' | 'delayed' | 'cancelled'

interface StatusConfig {
  label: string
  color: string
  bgColor: string
  borderColor: string
  dotColor: string
}

/**
 * Configuration for each case status - colors, labels, etc.
 * Use this for consistent styling across the app.
 */
export const CASE_STATUS_CONFIG: Record<CaseStatus, StatusConfig> = {
  scheduled: {
    label: 'Scheduled',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    dotColor: 'bg-blue-500'
  },
  in_progress: {
    label: 'In Progress',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    dotColor: 'bg-emerald-500'
  },
  completed: {
    label: 'Completed',
    color: 'text-slate-600',
    bgColor: 'bg-slate-100',
    borderColor: 'border-slate-200',
    dotColor: 'bg-slate-400'
  },
  delayed: {
    label: 'Delayed',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    dotColor: 'bg-amber-500'
  },
  cancelled: {
    label: 'Cancelled',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    dotColor: 'bg-red-500'
  }
}

/**
 * Get status configuration by status name.
 * Handles various formats (spaces, different cases) gracefully.
 * 
 * @example
 * getStatusConfig('in_progress')  // { label: 'In Progress', color: 'text-emerald-700', ... }
 * getStatusConfig('In Progress')  // Same result
 * getStatusConfig(null)           // Returns 'scheduled' config as default
 */
export function getStatusConfig(status: string | null | undefined): StatusConfig {
  if (!status) return CASE_STATUS_CONFIG.scheduled
  
  // Normalize: lowercase and replace spaces with underscores
  const normalized = status.toLowerCase().replace(/\s+/g, '_') as CaseStatus
  
  return CASE_STATUS_CONFIG[normalized] || CASE_STATUS_CONFIG.scheduled
}

/**
 * Check if a status indicates the case is active.
 */
export function isActiveStatus(status: string | null | undefined): boolean {
  return extractName({ name: status || '' }) === 'in_progress'
}

/**
 * Check if a status indicates the case is scheduled (not started).
 */
export function isScheduledStatus(status: string | null | undefined): boolean {
  return extractName({ name: status || '' }) === 'scheduled'
}