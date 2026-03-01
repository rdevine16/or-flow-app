import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getTokenExpiryInfo } from '../token-manager'

// ============================================
// TOKEN EXPIRY INFO — Pure function, no DB needed
// ============================================

describe('getTokenExpiryInfo', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-01T12:00:00Z'))
  })

  it('should return expired when tokenExpiresAt is null', () => {
    const result = getTokenExpiryInfo(null)
    expect(result.expiresAt).toBeNull()
    expect(result.isExpired).toBe(true)
    expect(result.minutesRemaining).toBeNull()
  })

  it('should return not expired for future timestamp', () => {
    const result = getTokenExpiryInfo('2026-03-01T13:00:00Z')
    expect(result.isExpired).toBe(false)
    expect(result.minutesRemaining).toBe(60)
    expect(result.expiresAt).toEqual(new Date('2026-03-01T13:00:00Z'))
  })

  it('should return expired for past timestamp', () => {
    const result = getTokenExpiryInfo('2026-03-01T11:00:00Z')
    expect(result.isExpired).toBe(true)
    expect(result.minutesRemaining).toBe(0)
  })

  it('should handle token expiring in less than 1 minute', () => {
    const result = getTokenExpiryInfo('2026-03-01T12:00:30Z')
    expect(result.isExpired).toBe(false)
    expect(result.minutesRemaining).toBe(0)
  })

  it('should handle token expiring exactly now', () => {
    const result = getTokenExpiryInfo('2026-03-01T12:00:00Z')
    expect(result.isExpired).toBe(true)
    expect(result.minutesRemaining).toBe(0)
  })

  it('should handle token expiring in 10 minutes (amber warning threshold)', () => {
    const result = getTokenExpiryInfo('2026-03-01T12:10:00Z')
    expect(result.isExpired).toBe(false)
    expect(result.minutesRemaining).toBe(10)
  })

  afterEach(() => {
    vi.useRealTimers()
  })
})
