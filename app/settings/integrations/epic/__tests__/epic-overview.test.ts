import { describe, it, expect } from 'vitest'
import type { EpicConnectionStatus } from '@/lib/epic/types'

/**
 * Tests for Epic Overview PageClient logic.
 *
 * Tests connection state decisions, token expiry calculation,
 * quick action availability, and disconnect flow.
 */

// ============================================
// TOKEN EXPIRY LOGIC
// ============================================

function getTokenExpiryInfo(expiresAt: string | null): {
  isExpired: boolean
  minutesRemaining: number | null
  label: string
} {
  if (!expiresAt) return { isExpired: true, minutesRemaining: null, label: 'No token' }
  const now = Date.now()
  const expires = new Date(expiresAt).getTime()
  const diff = expires - now
  if (diff <= 0) return { isExpired: true, minutesRemaining: 0, label: 'Expired' }
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return { isExpired: false, minutesRemaining: 0, label: 'Less than 1 minute' }
  return { isExpired: false, minutesRemaining: minutes, label: `${minutes} min remaining` }
}

describe('Epic Overview — Token Expiry', () => {
  it('should report expired when no token exists', () => {
    const info = getTokenExpiryInfo(null)
    expect(info.isExpired).toBe(true)
    expect(info.label).toBe('No token')
    expect(info.minutesRemaining).toBeNull()
  })

  it('should report expired when token is in the past', () => {
    const pastDate = new Date(Date.now() - 60000).toISOString() // 1 min ago
    const info = getTokenExpiryInfo(pastDate)
    expect(info.isExpired).toBe(true)
    expect(info.minutesRemaining).toBe(0)
    expect(info.label).toBe('Expired')
  })

  it('should report valid when token is in the future', () => {
    const futureDate = new Date(Date.now() + 30 * 60000).toISOString() // 30 min from now
    const info = getTokenExpiryInfo(futureDate)
    expect(info.isExpired).toBe(false)
    expect(info.minutesRemaining).toBeGreaterThan(25) // ~30 min
    expect(info.label).toMatch(/min remaining/)
  })

  it('should show "Less than 1 minute" when nearly expired', () => {
    const almostExpired = new Date(Date.now() + 30000).toISOString() // 30 seconds from now
    const info = getTokenExpiryInfo(almostExpired)
    expect(info.isExpired).toBe(false)
    expect(info.minutesRemaining).toBe(0)
    expect(info.label).toBe('Less than 1 minute')
  })
})

// ============================================
// CONNECTION STATE DECISIONS
// ============================================

describe('Epic Overview — Page State', () => {
  function getPageState(connectionStatus: EpicConnectionStatus | null):
    'not_connected' | 'connected' | 'needs_reconnect' {
    if (!connectionStatus || connectionStatus === 'disconnected') {
      return 'not_connected'
    }
    if (connectionStatus === 'connected') {
      return 'connected'
    }
    return 'needs_reconnect' // token_expired or error
  }

  it('should show "not_connected" when no connection', () => {
    expect(getPageState(null)).toBe('not_connected')
    expect(getPageState('disconnected')).toBe('not_connected')
  })

  it('should show "connected" when active', () => {
    expect(getPageState('connected')).toBe('connected')
  })

  it('should show "needs_reconnect" on token expiry or error', () => {
    expect(getPageState('token_expired')).toBe('needs_reconnect')
    expect(getPageState('error')).toBe('needs_reconnect')
  })
})

// ============================================
// QUICK ACTION AVAILABILITY
// ============================================

describe('Epic Overview — Quick Actions', () => {
  function getQuickActionAvailability(status: EpicConnectionStatus | null) {
    const isConnected = status === 'connected'
    return {
      importCases: isConnected,
      entityMappings: true, // always available when connection exists
      reconnect: !isConnected,
    }
  }

  it('should enable Import Cases only when connected', () => {
    expect(getQuickActionAvailability('connected').importCases).toBe(true)
    expect(getQuickActionAvailability('token_expired').importCases).toBe(false)
    expect(getQuickActionAvailability('error').importCases).toBe(false)
  })

  it('should always enable Entity Mappings', () => {
    expect(getQuickActionAvailability('connected').entityMappings).toBe(true)
    expect(getQuickActionAvailability('token_expired').entityMappings).toBe(true)
  })

  it('should enable Reconnect only when NOT connected', () => {
    expect(getQuickActionAvailability('connected').reconnect).toBe(false)
    expect(getQuickActionAvailability('token_expired').reconnect).toBe(true)
    expect(getQuickActionAvailability('error').reconnect).toBe(true)
  })
})

// ============================================
// MAPPING STAT CARD LOGIC
// ============================================

describe('Epic Overview — Mapping Stat Cards', () => {
  function getMappingStatColor(mapped: number, total: number): string {
    if (total === 0) return 'slate'
    const pct = Math.round((mapped / total) * 100)
    if (pct === 100) return 'emerald'
    if (pct > 0) return 'amber'
    return 'red'
  }

  it('should show slate when no entities exist', () => {
    expect(getMappingStatColor(0, 0)).toBe('slate')
  })

  it('should show emerald when fully mapped', () => {
    expect(getMappingStatColor(5, 5)).toBe('emerald')
  })

  it('should show amber when partially mapped', () => {
    expect(getMappingStatColor(3, 5)).toBe('amber')
  })

  it('should show red when none mapped but entities exist', () => {
    expect(getMappingStatColor(0, 5)).toBe('red')
  })
})

// ============================================
// FORMAT DATE
// ============================================

describe('Epic Overview — Format Date', () => {
  function formatDate(dateStr: string | null): string {
    if (!dateStr) return 'Never'
    return new Date(dateStr).toLocaleString()
  }

  it('should return "Never" for null dates', () => {
    expect(formatDate(null)).toBe('Never')
  })

  it('should format valid dates', () => {
    const result = formatDate('2026-03-01T12:00:00Z')
    expect(result).toBeTruthy()
    expect(result).not.toBe('Never')
  })
})
