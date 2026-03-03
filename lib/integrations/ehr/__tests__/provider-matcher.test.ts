import { describe, it, expect, vi, beforeEach } from 'vitest'
import { matchSurgeon } from '../provider-matcher'

// Mock dependencies
vi.mock('@/lib/dal/ehr', () => ({
  ehrDAL: {
    getEntityMapping: vi.fn(),
  },
}))

vi.mock('@/lib/dal/users', () => ({
  usersDAL: {
    listSurgeons: vi.fn(),
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

import { ehrDAL } from '@/lib/dal/ehr'
import { usersDAL } from '@/lib/dal/users'

const mockSupabase = {} as Parameters<typeof matchSurgeon>[0]

const SURGEONS = [
  { id: 'surg-1', first_name: 'John', last_name: 'Smith', closing_workflow: null, closing_handoff_minutes: null },
  { id: 'surg-2', first_name: 'Maria', last_name: 'Jones', closing_workflow: null, closing_handoff_minutes: null },
  { id: 'surg-3', first_name: 'Robert', last_name: 'Williams', closing_workflow: null, closing_handoff_minutes: null },
]

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(ehrDAL.getEntityMapping).mockResolvedValue({ data: null, error: null })
  vi.mocked(usersDAL.listSurgeons).mockResolvedValue({ data: SURGEONS, error: null })
})

describe('matchSurgeon', () => {
  it('returns matched from entity mapping by NPI', async () => {
    vi.mocked(ehrDAL.getEntityMapping).mockResolvedValueOnce({
      data: {
        id: 'map-1',
        facility_id: 'fac-1',
        integration_id: 'int-1',
        entity_type: 'surgeon' as const,
        external_identifier: '1234567890',
        external_display_name: 'SMITH, JOHN',
        orbit_entity_id: 'surg-1',
        orbit_display_name: 'Smith, John',
        match_method: 'manual' as const,
        match_confidence: 1.0,
        created_at: '',
        updated_at: '',
      },
      error: null,
    })

    const result = await matchSurgeon(mockSupabase, 'int-1', 'fac-1', '1234567890', 'SMITH', 'JOHN', 'A')
    expect(result.matched).toBe(true)
    expect(result.orbitSurgeonId).toBe('surg-1')
    expect(result.matchSource).toBe('mapping')
  })

  it('returns matched via fuzzy name (exact name match)', async () => {
    const result = await matchSurgeon(mockSupabase, 'int-1', 'fac-1', '', 'Smith', 'John')
    expect(result.matched).toBe(true)
    expect(result.orbitSurgeonId).toBe('surg-1')
    expect(result.matchSource).toBe('fuzzy')
    expect(result.confidence).toBe(1.0)
  })

  it('returns matched via fuzzy name (case-insensitive)', async () => {
    const result = await matchSurgeon(mockSupabase, 'int-1', 'fac-1', '', 'SMITH', 'JOHN')
    expect(result.matched).toBe(true)
    expect(result.orbitSurgeonId).toBe('surg-1')
  })

  it('returns suggestions for similar names below auto-map threshold', async () => {
    // "Smithe" is close to "Smith" but not exact
    const result = await matchSurgeon(mockSupabase, 'int-1', 'fac-1', '', 'Smithe', 'John')
    // Should still match with high confidence since only 1 char different
    expect(result.suggestions.length).toBeGreaterThan(0)
    expect(result.suggestions[0].orbit_entity_id).toBe('surg-1')
  })

  it('returns unmatched with no suggestions for unknown surgeon', async () => {
    const result = await matchSurgeon(mockSupabase, 'int-1', 'fac-1', '', 'Completely', 'Unknown')
    expect(result.matched).toBe(false)
    expect(result.orbitSurgeonId).toBeNull()
    expect(result.matchSource).toBe('none')
  })

  it('returns empty result when no identifiers provided', async () => {
    const result = await matchSurgeon(mockSupabase, 'int-1', 'fac-1', '', '', '')
    expect(result.matched).toBe(false)
    expect(result.matchSource).toBe('none')
  })

  it('returns empty result when facility has no surgeons', async () => {
    vi.mocked(usersDAL.listSurgeons).mockResolvedValue({ data: [], error: null })

    const result = await matchSurgeon(mockSupabase, 'int-1', 'fac-1', '1234567890', 'Smith', 'John')
    expect(result.matched).toBe(false)
    expect(result.matchSource).toBe('none')
  })

  it('checks both NPI and name in entity mappings', async () => {
    vi.mocked(ehrDAL.getEntityMapping).mockResolvedValue({ data: null, error: null })

    await matchSurgeon(mockSupabase, 'int-1', 'fac-1', '1234567890', 'Smith', 'John')

    // Should have checked NPI first, then name
    expect(vi.mocked(ehrDAL.getEntityMapping)).toHaveBeenCalledTimes(2)
    expect(vi.mocked(ehrDAL.getEntityMapping)).toHaveBeenCalledWith(
      mockSupabase, 'int-1', 'surgeon', '1234567890',
    )
    expect(vi.mocked(ehrDAL.getEntityMapping)).toHaveBeenCalledWith(
      mockSupabase, 'int-1', 'surgeon', 'Smith, John',
    )
  })
})
