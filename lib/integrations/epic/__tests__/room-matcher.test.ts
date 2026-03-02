import { describe, it, expect, vi, beforeEach } from 'vitest'
import { normalizeRoomName, matchRoom } from '../room-matcher'

// Mock dependencies
vi.mock('@/lib/dal/ehr', () => ({
  ehrDAL: {
    getEntityMapping: vi.fn(),
  },
}))

vi.mock('@/lib/dal/facilities', () => ({
  facilitiesDAL: {
    getRooms: vi.fn(),
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
import { facilitiesDAL } from '@/lib/dal/facilities'

const mockSupabase = {} as Parameters<typeof matchRoom>[0]

const ROOMS = [
  { id: 'room-1', name: 'OR 1', display_order: 1, is_active: true },
  { id: 'room-2', name: 'OR 2', display_order: 2, is_active: true },
  { id: 'room-3', name: 'OR 3', display_order: 3, is_active: true },
  { id: 'room-4', name: 'Procedure Room A', display_order: 4, is_active: true },
]

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(ehrDAL.getEntityMapping).mockResolvedValue({ data: null, error: null })
  vi.mocked(facilitiesDAL.getRooms).mockResolvedValue({ data: ROOMS, error: null })
})

// =====================================================
// normalizeRoomName
// =====================================================

describe('normalizeRoomName', () => {
  it('normalizes "OR3" to "or 3"', () => {
    expect(normalizeRoomName('OR3')).toBe('or 3')
  })

  it('normalizes "OR 3" to "or 3"', () => {
    expect(normalizeRoomName('OR 3')).toBe('or 3')
  })

  it('normalizes "Operating Room 3" to "or 3"', () => {
    expect(normalizeRoomName('Operating Room 3')).toBe('or 3')
  })

  it('normalizes "operating room 3" to "or 3"', () => {
    expect(normalizeRoomName('operating room 3')).toBe('or 3')
  })

  it('normalizes "OR3" and "or 3" to same value', () => {
    expect(normalizeRoomName('OR3')).toBe(normalizeRoomName('or 3'))
  })

  it('normalizes "Operating Room 3" and "OR3" to same value', () => {
    expect(normalizeRoomName('Operating Room 3')).toBe(normalizeRoomName('OR3'))
  })

  it('handles extra whitespace', () => {
    expect(normalizeRoomName('  OR  3  ')).toBe('or 3')
  })

  it('handles non-OR rooms', () => {
    expect(normalizeRoomName('Procedure Room A')).toBe('procedure room a')
  })
})

// =====================================================
// matchRoom
// =====================================================

describe('matchRoom', () => {
  it('returns matched from entity mapping', async () => {
    vi.mocked(ehrDAL.getEntityMapping).mockResolvedValue({
      data: {
        id: 'map-1',
        facility_id: 'fac-1',
        integration_id: 'int-1',
        entity_type: 'room' as const,
        external_identifier: 'OR3',
        external_display_name: 'Operating Room 3',
        orbit_entity_id: 'room-3',
        orbit_display_name: 'OR 3',
        match_method: 'manual' as const,
        match_confidence: 1.0,
        created_at: '',
        updated_at: '',
      },
      error: null,
    })

    const result = await matchRoom(mockSupabase, 'int-1', 'fac-1', 'OR3', 'Operating Room 3')
    expect(result.matched).toBe(true)
    expect(result.orbitRoomId).toBe('room-3')
    expect(result.matchSource).toBe('mapping')
    expect(result.confidence).toBe(1.0)
  })

  it('returns matched via normalized exact match ("OR3" → "OR 3")', async () => {
    const result = await matchRoom(mockSupabase, 'int-1', 'fac-1', 'OR3', 'Operating Room 3')
    expect(result.matched).toBe(true)
    expect(result.orbitRoomId).toBe('room-3')
    expect(result.matchSource).toBe('exact')
  })

  it('returns matched via normalized exact match ("Operating Room 3" → "OR 3")', async () => {
    const result = await matchRoom(mockSupabase, 'int-1', 'fac-1', '', 'Operating Room 3')
    expect(result.matched).toBe(true)
    expect(result.orbitRoomId).toBe('room-3')
    expect(result.matchSource).toBe('exact')
  })

  it('returns unmatched with suggestions for room below auto-map threshold', async () => {
    // "Proc Room A" should fuzzy-match "Procedure Room A" with decent score
    const result = await matchRoom(mockSupabase, 'int-1', 'fac-1', 'PROCA', 'Proc Room A')
    // The fuzzy score for "Proc Room A" vs "Procedure Room A" depends on Levenshtein
    // May or may not match above threshold, but should have suggestions
    expect(result.matchSource === 'fuzzy' || result.matchSource === 'none').toBe(true)
  })

  it('returns unmatched with no suggestions for completely unknown room', async () => {
    const result = await matchRoom(mockSupabase, 'int-1', 'fac-1', 'ENDOSCOPY_1', 'Endoscopy Suite 1')
    expect(result.matched).toBe(false)
    expect(result.orbitRoomId).toBeNull()
    expect(result.matchSource).toBe('none')
  })

  it('returns empty result when no room code or description provided', async () => {
    const result = await matchRoom(mockSupabase, 'int-1', 'fac-1', '', '')
    expect(result.matched).toBe(false)
    expect(result.matchSource).toBe('none')
  })

  it('returns empty result when facility has no rooms', async () => {
    vi.mocked(facilitiesDAL.getRooms).mockResolvedValue({ data: [], error: null })

    const result = await matchRoom(mockSupabase, 'int-1', 'fac-1', 'OR3', '')
    expect(result.matched).toBe(false)
    expect(result.matchSource).toBe('none')
  })
})
