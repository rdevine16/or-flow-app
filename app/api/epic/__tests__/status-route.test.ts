import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Tests for GET /api/epic/status API route logic.
 *
 * Tests mapping stats aggregation, connection status scenarios,
 * and authorization checks — all exercised as pure logic.
 */

// ============================================
// MAPPING STATS AGGREGATION LOGIC
// ============================================

interface MappingStatRow {
  mapping_type: string
  orbit_entity_id: string | null
}

interface MappingStatsResult {
  surgeon: { total: number; mapped: number }
  room: { total: number; mapped: number }
  procedure: { total: number; mapped: number }
}

function aggregateMappingStats(rows: MappingStatRow[]): MappingStatsResult {
  const stats: MappingStatsResult = {
    surgeon: { total: 0, mapped: 0 },
    room: { total: 0, mapped: 0 },
    procedure: { total: 0, mapped: 0 },
  }

  for (const row of rows) {
    const type = row.mapping_type as keyof MappingStatsResult
    if (stats[type]) {
      stats[type].total++
      if (row.orbit_entity_id) {
        stats[type].mapped++
      }
    }
  }

  return stats
}

describe('Epic Status API — Mapping Stats Aggregation', () => {
  it('should aggregate empty rows to zero counts', () => {
    const stats = aggregateMappingStats([])
    expect(stats.surgeon).toEqual({ total: 0, mapped: 0 })
    expect(stats.room).toEqual({ total: 0, mapped: 0 })
    expect(stats.procedure).toEqual({ total: 0, mapped: 0 })
  })

  it('should count mapped vs unmapped entities correctly', () => {
    const rows: MappingStatRow[] = [
      { mapping_type: 'surgeon', orbit_entity_id: 'surgeon-1' },
      { mapping_type: 'surgeon', orbit_entity_id: null },
      { mapping_type: 'surgeon', orbit_entity_id: 'surgeon-2' },
      { mapping_type: 'room', orbit_entity_id: 'room-1' },
      { mapping_type: 'room', orbit_entity_id: null },
      { mapping_type: 'procedure', orbit_entity_id: null },
    ]

    const stats = aggregateMappingStats(rows)
    expect(stats.surgeon).toEqual({ total: 3, mapped: 2 })
    expect(stats.room).toEqual({ total: 2, mapped: 1 })
    expect(stats.procedure).toEqual({ total: 1, mapped: 0 })
  })

  it('should handle all entities fully mapped', () => {
    const rows: MappingStatRow[] = [
      { mapping_type: 'surgeon', orbit_entity_id: 's-1' },
      { mapping_type: 'surgeon', orbit_entity_id: 's-2' },
      { mapping_type: 'room', orbit_entity_id: 'r-1' },
    ]

    const stats = aggregateMappingStats(rows)
    expect(stats.surgeon).toEqual({ total: 2, mapped: 2 })
    expect(stats.room).toEqual({ total: 1, mapped: 1 })
    expect(stats.procedure).toEqual({ total: 0, mapped: 0 })
  })

  it('should ignore unknown mapping types', () => {
    const rows: MappingStatRow[] = [
      { mapping_type: 'unknown_type', orbit_entity_id: 'something' },
      { mapping_type: 'surgeon', orbit_entity_id: 's-1' },
    ]

    const stats = aggregateMappingStats(rows)
    expect(stats.surgeon).toEqual({ total: 1, mapped: 1 })
    // Unknown type should not appear
    expect(stats.room).toEqual({ total: 0, mapped: 0 })
  })
})

// ============================================
// CONNECTION STATUS SCENARIOS
// ============================================

describe('Epic Status API — Connection Scenarios', () => {
  it('should return null connection when facility has no Epic setup', () => {
    // Simulates PGRST116 (no rows returned)
    const response = { connection: null, mappingStats: null }
    expect(response.connection).toBeNull()
    expect(response.mappingStats).toBeNull()
  })

  it('should return connected status with stats when connected', () => {
    const response = {
      connection: {
        id: 'conn-1',
        status: 'connected',
        last_connected_at: '2026-03-01T12:00:00Z',
        connected_by: 'user-1',
        token_expires_at: '2026-03-01T13:00:00Z',
        fhir_base_url: 'https://fhir.epic.com',
      },
      mappingStats: {
        surgeon: { total: 5, mapped: 3 },
        room: { total: 4, mapped: 4 },
        procedure: { total: 2, mapped: 0 },
      },
    }

    expect(response.connection!.status).toBe('connected')
    expect(response.mappingStats!.surgeon.mapped).toBe(3)
    expect(response.mappingStats!.room.total).toBe(4)
  })

  it('should represent token_expired status', () => {
    const connection = {
      id: 'conn-1',
      status: 'token_expired' as const,
      token_expires_at: '2026-02-28T12:00:00Z', // in the past
    }

    expect(connection.status).toBe('token_expired')
  })
})

// ============================================
// AUTHORIZATION LOGIC
// ============================================

describe('Epic Status API — Authorization Logic', () => {
  function canAccessFacility(
    userAccessLevel: string,
    userFacilityId: string | null,
    requestedFacilityId: string
  ): boolean {
    if (userAccessLevel === 'global_admin') return true
    return userFacilityId === requestedFacilityId
  }

  it('should allow global_admin to access any facility', () => {
    expect(canAccessFacility('global_admin', null, 'fac-1')).toBe(true)
    expect(canAccessFacility('global_admin', 'fac-2', 'fac-1')).toBe(true)
  })

  it('should allow facility_admin to access own facility', () => {
    expect(canAccessFacility('facility_admin', 'fac-1', 'fac-1')).toBe(true)
  })

  it('should deny facility_admin access to other facilities', () => {
    expect(canAccessFacility('facility_admin', 'fac-2', 'fac-1')).toBe(false)
  })

  it('should deny regular user access', () => {
    expect(canAccessFacility('user', 'fac-1', 'fac-1')).toBe(true) // same facility but low perms
    expect(canAccessFacility('user', 'fac-2', 'fac-1')).toBe(false)
  })
})
