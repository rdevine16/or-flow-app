// lib/pace-utils.ts
// Pace calculation utilities - UPDATED for median-based statistics

import { CasePaceData, PaceStatus, CasePhase } from '@/types/pace'

// Minimum sample size required to show pace data
export const MIN_SAMPLE_SIZE = 10

/**
 * Calculate progress through the case (0.0 - 1.0)
 * Based on how far into the estimated total time the current milestone represents
 * UPDATED: Now uses expectedTotalMinutes (median) instead of avgTotalMinutes
 */
export function calculateProgress(paceData: CasePaceData): number {
  if (paceData.expectedTotalMinutes <= 0) return 0
  return Math.min(paceData.expectedMinutesToMilestone / paceData.expectedTotalMinutes, 1.0)
}

/**
 * Calculate expected time to reach current milestone
 * scheduledStart + expectedMinutesToMilestone
 * UPDATED: Now uses expectedMinutesToMilestone (median) instead of avgMinutesToMilestone
 */
export function getExpectedTimeAtMilestone(paceData: CasePaceData): Date {
  return new Date(paceData.scheduledStart.getTime() + paceData.expectedMinutesToMilestone * 60 * 1000)
}

/**
 * Calculate pace in minutes
 * Positive = ahead of schedule
 * Negative = behind schedule
 */
export function calculatePaceMinutes(paceData: CasePaceData, now: Date = new Date()): number {
  const expectedTime = getExpectedTimeAtMilestone(paceData)
  return (expectedTime.getTime() - now.getTime()) / (60 * 1000)
}

/**
 * Determine pace status for color coding
 * - ahead: >5 min ahead of schedule (green)
 * - onPace: within ±5 min (blue)
 * - slightlyBehind: 5-15 min behind (orange)
 * - behind: >15 min behind (red)
 */
export function getPaceStatus(paceData: CasePaceData, now: Date = new Date()): PaceStatus {
  const pace = calculatePaceMinutes(paceData, now)
  
  if (pace >= 5) return 'ahead'
  if (pace >= -5) return 'onPace'
  if (pace >= -15) return 'slightlyBehind'
  return 'behind'
}

/**
 * Check if we have enough historical data to show pace
 */
export function hasEnoughData(paceData: CasePaceData): boolean {
  return paceData.sampleSize >= MIN_SAMPLE_SIZE
}

/**
 * Format duration in minutes to human readable string
 * e.g., 94 -> "1h 34m", 45 -> "45m"
 */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)
  
  if (hours > 0) {
    return `${hours}h ${mins}m`
  }
  return `${mins}m`
}

/**
 * Format duration range for display
 * e.g., (55, 85) -> "(55m-1h 25m)" or "(55-85m)" for short format
 */
export function formatDurationRange(low: number | null, high: number | null, shortFormat: boolean = true): string | null {
  if (low === null || high === null) return null
  
  if (shortFormat) {
    // Simple format: just show the numbers with "m"
    return `(${Math.round(low)}-${Math.round(high)}m)`
  }
  
  // Full format with hours
  return `(${formatDuration(low)}-${formatDuration(high)})`
}

/**
 * Format elapsed seconds to HH:MM:SS or MM:SS
 */
export function formatElapsedTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

/**
 * Get pace status color classes for Tailwind
 */
export function getPaceStatusColors(status: PaceStatus): {
  bg: string
  text: string
  border: string
  gradient: string
} {
  switch (status) {
    case 'ahead':
      return {
        bg: 'bg-emerald-500',
        text: 'text-emerald-600',
        border: 'border-emerald-200',
        gradient: 'from-emerald-500 to-emerald-400'
      }
    case 'onPace':
      return {
        bg: 'bg-blue-500',
        text: 'text-blue-600',
        border: 'border-blue-200',
        gradient: 'from-blue-500 to-blue-400'
      }
    case 'slightlyBehind':
      return {
        bg: 'bg-amber-500',
        text: 'text-amber-600',
        border: 'border-amber-200',
        gradient: 'from-amber-500 to-amber-400'
      }
    case 'behind':
      return {
        bg: 'bg-red-500',
        text: 'text-red-600',
        border: 'border-red-200',
        gradient: 'from-red-500 to-red-400'
      }
  }
}

/**
 * Get pace status icon name (for use with heroicons or similar)
 */
export function getPaceStatusIcon(status: PaceStatus): string {
  switch (status) {
    case 'ahead':
      return 'check'
    case 'onPace':
      return 'minus'
    case 'slightlyBehind':
      return 'exclamation-triangle'
    case 'behind':
      return 'exclamation-triangle'
  }
}

/**
 * Determine the current phase of surgery based on recorded milestones
 */
export function determinePhase(milestoneNames: string[]): CasePhase {
  const names = milestoneNames.map(n => n.toLowerCase())
  
  // Check in reverse order (most recent milestone determines phase)
  if (names.includes('patient_out') || names.includes('room_cleaned')) {
    return 'Complete'
  }
  if (names.includes('closing') || names.includes('closing_complete')) {
    return 'Closing'
  }
  if (names.includes('incision')) {
    return 'In Surgery'
  }
  if (names.includes('prepped') || names.includes('draping_complete')) {
    return 'Prepping'
  }
  if (names.includes('anes_start') || names.includes('anes_end')) {
    return 'In Anesthesia'
  }
  if (names.includes('patient_in')) {
    return 'Patient In'
  }
  
  return 'Patient In' // Default if no milestones
}

/**
 * Parse ISO date string to Date object
 */
export function parseISODate(dateString: string): Date | null {
  try {
    const date = new Date(dateString)
    return isNaN(date.getTime()) ? null : date
  } catch {
    return null
  }
}

/**
 * Combine scheduled_date and start_time into a single Date
 * e.g., "2026-01-12" + "15:00:00" -> Date object
 */
export function parseScheduledStartTime(scheduledDate: string, startTime: string | null): Date | null {
  if (!startTime) return null
  
  try {
    // Handle different time formats
    const timeClean = startTime.includes(':') ? startTime : `${startTime}:00`
    const combined = `${scheduledDate}T${timeClean}`
    const date = new Date(combined)
    return isNaN(date.getTime()) ? null : date
  } catch {
    return null
  }
}

/**
 * Get room status based on cases
 */
export function getRoomStatus(currentCase: unknown, nextCase: unknown): 'active' | 'upcoming' | 'empty' {
  if (currentCase) return 'active'
  if (nextCase) return 'upcoming'
  return 'empty'
}

/**
 * Get status label for display
 */
export function getRoomStatusLabel(status: 'active' | 'upcoming' | 'empty'): string {
  switch (status) {
    case 'active': return 'ACTIVE'
    case 'upcoming': return 'NEXT UP'
    case 'empty': return 'EMPTY'
  }
}