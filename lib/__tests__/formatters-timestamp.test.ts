import { describe, it, expect } from 'vitest'
import { formatTimestamp, formatTimestamp24 } from '../formatters'

// ============================================
// formatTimestamp — 12-hour display with timezone support
// ============================================

describe('formatTimestamp', () => {
  it('should return fallback for null input', () => {
    expect(formatTimestamp(null)).toBe('--:--')
    expect(formatTimestamp(undefined)).toBe('--:--')
    expect(formatTimestamp('')).toBe('--:--')
  })

  it('should return custom fallback when provided', () => {
    expect(formatTimestamp(null, { fallback: 'N/A' })).toBe('N/A')
  })

  it('should format a valid ISO timestamp in 12-hour format', () => {
    // Using a fixed timezone to get deterministic output
    const result = formatTimestamp('2025-01-15T14:30:00Z', { timeZone: 'UTC' })
    expect(result).toBe('2:30 PM')
  })

  it('should format midnight correctly', () => {
    const result = formatTimestamp('2025-01-15T00:00:00Z', { timeZone: 'UTC' })
    expect(result).toBe('12:00 AM')
  })

  it('should format noon correctly', () => {
    const result = formatTimestamp('2025-01-15T12:00:00Z', { timeZone: 'UTC' })
    expect(result).toBe('12:00 PM')
  })

  it('should respect facility timezone (America/New_York)', () => {
    // 14:30 UTC = 9:30 AM ET (EST, UTC-5)
    const result = formatTimestamp('2025-01-15T14:30:00Z', { timeZone: 'America/New_York' })
    expect(result).toBe('9:30 AM')
  })

  it('should respect facility timezone (America/Chicago)', () => {
    // 14:30 UTC = 8:30 AM CT (CST, UTC-6)
    const result = formatTimestamp('2025-01-15T14:30:00Z', { timeZone: 'America/Chicago' })
    expect(result).toBe('8:30 AM')
  })

  it('should respect facility timezone (America/Los_Angeles)', () => {
    // 14:30 UTC = 6:30 AM PT (PST, UTC-8)
    const result = formatTimestamp('2025-01-15T14:30:00Z', { timeZone: 'America/Los_Angeles' })
    expect(result).toBe('6:30 AM')
  })

  it('should handle DST correctly (summer time)', () => {
    // July 15 = EDT (UTC-4), so 14:30 UTC = 10:30 AM EDT
    const result = formatTimestamp('2025-07-15T14:30:00Z', { timeZone: 'America/New_York' })
    expect(result).toBe('10:30 AM')
  })

  it('should handle invalid ISO strings gracefully', () => {
    const result = formatTimestamp('not-a-date')
    expect(result).toBe('--:--')
  })
})

// ============================================
// formatTimestamp24 — 24-hour display with timezone support
// ============================================

describe('formatTimestamp24', () => {
  it('should return fallback for null input', () => {
    expect(formatTimestamp24(null)).toBe('--:--')
    expect(formatTimestamp24(undefined)).toBe('--:--')
  })

  it('should format a valid ISO timestamp in 24-hour format', () => {
    const result = formatTimestamp24('2025-01-15T14:30:00Z', { timeZone: 'UTC' })
    expect(result).toBe('14:30')
  })

  it('should format midnight correctly in 24-hour format', () => {
    const result = formatTimestamp24('2025-01-15T00:05:00Z', { timeZone: 'UTC' })
    expect(result).toBe('00:05')
  })

  it('should respect facility timezone (America/New_York)', () => {
    // 14:30 UTC = 9:30 ET (EST)
    const result = formatTimestamp24('2025-01-15T14:30:00Z', { timeZone: 'America/New_York' })
    expect(result).toBe('09:30')
  })

  it('should respect facility timezone (America/Los_Angeles)', () => {
    // 14:30 UTC = 6:30 PT (PST)
    const result = formatTimestamp24('2025-01-15T14:30:00Z', { timeZone: 'America/Los_Angeles' })
    expect(result).toBe('06:30')
  })

  it('should handle invalid ISO strings gracefully', () => {
    const result = formatTimestamp24('invalid')
    expect(result).toBe('--:--')
  })
})
