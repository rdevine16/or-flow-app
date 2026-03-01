import { describe, it, expect } from 'vitest'
import type { EpicConnectionStatus } from '@/lib/epic/types'

/**
 * Tests for the Integrations PageClient logic.
 *
 * Tests Epic card state transitions, status badge rendering decisions,
 * and mapping stats display logic.
 */

// ============================================
// EPIC CARD STATE LOGIC
// ============================================

interface EpicStatusResponse {
  connection: {
    id: string
    status: EpicConnectionStatus
    last_connected_at: string | null
    connected_by: string | null
    token_expires_at: string | null
    fhir_base_url: string
  } | null
  mappingStats: {
    surgeon: { total: number; mapped: number }
    room: { total: number; mapped: number }
    procedure: { total: number; mapped: number }
  } | null
}

function getEpicCardAction(status: EpicStatusResponse | null): 'Set Up' | 'Manage' {
  if (!status?.connection || status.connection.status === 'disconnected') {
    return 'Set Up'
  }
  return 'Manage'
}

describe('Integrations Page — Epic Card State', () => {
  it('should show "Set Up" when no Epic status loaded', () => {
    expect(getEpicCardAction(null)).toBe('Set Up')
  })

  it('should show "Set Up" when connection is null', () => {
    expect(getEpicCardAction({ connection: null, mappingStats: null })).toBe('Set Up')
  })

  it('should show "Set Up" when status is disconnected', () => {
    const status: EpicStatusResponse = {
      connection: {
        id: 'c1',
        status: 'disconnected',
        last_connected_at: null,
        connected_by: null,
        token_expires_at: null,
        fhir_base_url: 'https://fhir.epic.com',
      },
      mappingStats: null,
    }
    expect(getEpicCardAction(status)).toBe('Set Up')
  })

  it('should show "Manage" when connected', () => {
    const status: EpicStatusResponse = {
      connection: {
        id: 'c1',
        status: 'connected',
        last_connected_at: '2026-03-01T12:00:00Z',
        connected_by: 'user-1',
        token_expires_at: '2026-03-01T13:00:00Z',
        fhir_base_url: 'https://fhir.epic.com',
      },
      mappingStats: { surgeon: { total: 5, mapped: 3 }, room: { total: 3, mapped: 3 }, procedure: { total: 0, mapped: 0 } },
    }
    expect(getEpicCardAction(status)).toBe('Manage')
  })

  it('should show "Manage" when token is expired (still a connection exists)', () => {
    const status: EpicStatusResponse = {
      connection: {
        id: 'c1',
        status: 'token_expired',
        last_connected_at: '2026-03-01T12:00:00Z',
        connected_by: 'user-1',
        token_expires_at: '2026-03-01T12:30:00Z',
        fhir_base_url: 'https://fhir.epic.com',
      },
      mappingStats: null,
    }
    expect(getEpicCardAction(status)).toBe('Manage')
  })
})

// ============================================
// STATUS BADGE RENDERING
// ============================================

function getStatusBadgeInfo(status: EpicConnectionStatus | null): { label: string; color: string } {
  if (!status || status === 'disconnected') {
    return { label: 'Not Connected', color: 'slate' }
  }
  if (status === 'connected') {
    return { label: 'Connected', color: 'emerald' }
  }
  if (status === 'token_expired') {
    return { label: 'Token Expired', color: 'amber' }
  }
  return { label: 'Error', color: 'red' }
}

describe('Integrations Page — Status Badge', () => {
  it('should show "Not Connected" for null status', () => {
    expect(getStatusBadgeInfo(null)).toEqual({ label: 'Not Connected', color: 'slate' })
  })

  it('should show "Not Connected" for disconnected', () => {
    expect(getStatusBadgeInfo('disconnected')).toEqual({ label: 'Not Connected', color: 'slate' })
  })

  it('should show "Connected" with green for connected', () => {
    expect(getStatusBadgeInfo('connected')).toEqual({ label: 'Connected', color: 'emerald' })
  })

  it('should show "Token Expired" with amber', () => {
    expect(getStatusBadgeInfo('token_expired')).toEqual({ label: 'Token Expired', color: 'amber' })
  })

  it('should show "Error" with red', () => {
    expect(getStatusBadgeInfo('error')).toEqual({ label: 'Error', color: 'red' })
  })
})

// ============================================
// MAPPING STATS DISPLAY
// ============================================

describe('Integrations Page — Mapping Stats Display', () => {
  it('should skip stats with zero total', () => {
    const stats = {
      surgeon: { total: 5, mapped: 3 },
      room: { total: 0, mapped: 0 },
      procedure: { total: 2, mapped: 1 },
    }

    const displayableStats = (['surgeon', 'room', 'procedure'] as const)
      .filter(type => stats[type].total > 0)
      .map(type => ({ type, ...stats[type] }))

    expect(displayableStats).toHaveLength(2)
    expect(displayableStats[0].type).toBe('surgeon')
    expect(displayableStats[1].type).toBe('procedure')
  })

  it('should format as "mapped/total types mapped"', () => {
    const stat = { total: 5, mapped: 3 }
    const display = `${stat.mapped}/${stat.total} surgeons mapped`
    expect(display).toBe('3/5 surgeons mapped')
  })
})
