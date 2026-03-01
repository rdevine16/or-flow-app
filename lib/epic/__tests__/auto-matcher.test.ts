/**
 * Auto-Matcher Tests
 *
 * Tests for Phase 5 Epic FHIR integration auto-matching functionality:
 * - Levenshtein distance calculation (exact, close, no match)
 * - Similarity score normalization (0-1 range)
 * - Auto-match threshold logic (auto-apply >= 0.90, suggest 0.70-0.89, skip < 0.70)
 * - Duplicate prevention (already-mapped entities)
 * - Integration with DAL and mapping updates
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  levenshteinDistance,
  similarityScore,
  autoMatchSurgeons,
  autoMatchRooms,
  autoMatchProcedures,
} from '../auto-matcher'
import type { AutoMatchResult } from '../auto-matcher'

// =====================================================
// UNIT TESTS: Levenshtein Distance
// =====================================================

describe('levenshteinDistance', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshteinDistance('hello', 'hello')).toBe(0)
    expect(levenshteinDistance('', '')).toBe(0)
  })

  it('returns length of non-empty string when other is empty', () => {
    expect(levenshteinDistance('hello', '')).toBe(5)
    expect(levenshteinDistance('', 'world')).toBe(5)
  })

  it('counts single-character insertions correctly', () => {
    expect(levenshteinDistance('cat', 'cats')).toBe(1)
    expect(levenshteinDistance('sit', 'sitting')).toBe(4)
  })

  it('counts single-character deletions correctly', () => {
    expect(levenshteinDistance('cats', 'cat')).toBe(1)
    expect(levenshteinDistance('sitting', 'sit')).toBe(4)
  })

  it('counts single-character substitutions correctly', () => {
    expect(levenshteinDistance('cat', 'bat')).toBe(1)
    expect(levenshteinDistance('kitten', 'mitten')).toBe(1)
  })

  it('handles complex multi-operation edits', () => {
    expect(levenshteinDistance('kitten', 'sitting')).toBe(3) // k→s, e→i, insert g
    expect(levenshteinDistance('saturday', 'sunday')).toBe(3)
  })

  it('handles case-sensitive comparison (not normalized)', () => {
    // Raw levenshtein is case-sensitive
    expect(levenshteinDistance('Hello', 'hello')).toBe(1)
  })
})

// =====================================================
// UNIT TESTS: Similarity Score
// =====================================================

describe('similarityScore', () => {
  it('returns 1.0 for exact matches', () => {
    expect(similarityScore('Smith, John', 'Smith, John')).toBe(1.0)
    expect(similarityScore('OR 1', 'OR 1')).toBe(1.0)
  })

  it('is case-insensitive', () => {
    expect(similarityScore('Smith, John', 'smith, john')).toBe(1.0)
    expect(similarityScore('OR 1', 'or 1')).toBe(1.0)
  })

  it('trims whitespace', () => {
    expect(similarityScore('  Smith, John  ', 'Smith, John')).toBe(1.0)
    expect(similarityScore('OR 1', '  OR 1  ')).toBe(1.0)
  })

  it('returns 0.0 when one string is empty', () => {
    expect(similarityScore('Smith', '')).toBe(0.0)
    expect(similarityScore('', 'Smith')).toBe(0.0)
  })

  it('computes normalized score for close matches', () => {
    // 'Smith, John' vs 'Smyth, John' — 1 substitution, 12 chars max → 1 - 1/12 = 0.917
    const score = similarityScore('Smith, John', 'Smyth, John')
    expect(score).toBeGreaterThan(0.9)
    expect(score).toBeLessThan(1.0)
  })

  it('computes normalized score for distant matches', () => {
    // 'Smith, John' vs 'Jones, Mary' — many changes
    const score = similarityScore('Smith, John', 'Jones, Mary')
    expect(score).toBeLessThan(0.5)
  })

  it('handles very similar but not identical names', () => {
    const score = similarityScore('Johnson, Michael', 'Johnson, Micheal') // e/a typo
    // 'Johnson, Michael' (17 chars) vs 'Johnson, Micheal' (17 chars) — 2 char diff (e→a, l→nothing)
    // Levenshtein distance = 2, normalized = 1 - 2/17 = 0.88
    expect(score).toBeGreaterThan(0.85) // Should be high
    expect(score).toBeLessThan(0.92)
  })

  it('handles completely different strings', () => {
    const score = similarityScore('AAAA', 'BBBB')
    expect(score).toBe(0.0)
  })
})

// =====================================================
// INTEGRATION TESTS: Auto-Match Logic
// =====================================================

// Mock DAL
vi.mock('@/lib/dal/epic', () => ({
  epicDAL: {
    listEntityMappings: vi.fn(),
    upsertEntityMapping: vi.fn(),
  },
}))

import { epicDAL } from '@/lib/dal/epic'
import type { EpicEntityMapping, EpicMappingType } from '@/lib/epic/types'
import type { PostgrestError } from '@supabase/supabase-js'

/** Helper to create a type-safe mock EpicEntityMapping */
function mockMapping(overrides: Partial<EpicEntityMapping> & {
  id: string
  connection_id: string
  mapping_type: EpicMappingType
  epic_resource_type: string
  epic_resource_id: string
}): EpicEntityMapping {
  return {
    facility_id: 'fac-1',
    epic_display_name: null,
    orbit_entity_id: null,
    match_method: 'manual',
    match_confidence: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('autoMatchSurgeons', () => {
  const mockSurgeons = [
    { id: 'surg-1', first_name: 'John', last_name: 'Smith' },
    { id: 'surg-2', first_name: 'Jane', last_name: 'Doe' },
    { id: 'surg-3', first_name: 'Michael', last_name: 'Johnson' },
  ]

  it('auto-applies high-confidence matches (>= 0.90)', async () => {
    // Mock Epic mappings with unmapped surgeon "Smith, John" (exact match to surg-1)
    vi.mocked(epicDAL.listEntityMappings).mockResolvedValue({
      data: [
        mockMapping({
          id: 'map-1',
          connection_id: 'conn-1',
          mapping_type: 'surgeon',
          epic_resource_type: 'Practitioner',
          epic_resource_id: 'epic-prac-1',
          epic_display_name: 'Smith, John',
        }),
      ],
      error: null,
    })

    vi.mocked(epicDAL.upsertEntityMapping).mockResolvedValue({
      data: {} as any,
      error: null,
    })

    const supabase = {} as any
    const result = await autoMatchSurgeons(supabase, 'conn-1', 'fac-1', mockSurgeons)

    expect(result.autoApplied).toBe(1)
    expect(result.suggested).toBe(0)
    expect(result.skipped).toBe(0)
    expect(result.results).toHaveLength(1)
    expect(result.results[0].action).toBe('auto_applied')
    expect(result.results[0].confidence).toBeGreaterThanOrEqual(0.9)
    expect(result.results[0].orbitEntityId).toBe('surg-1')
    expect(epicDAL.upsertEntityMapping).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({
        orbit_entity_id: 'surg-1',
        match_method: 'auto',
      })
    )
  })

  it('suggests medium-confidence matches (0.70-0.89)', async () => {
    // Use "Smythe, John" which will score around 0.75 (suggest range)
    vi.mocked(epicDAL.listEntityMappings).mockResolvedValue({
      data: [
        mockMapping({
          id: 'map-1',
          connection_id: 'conn-1',
          mapping_type: 'surgeon',
          epic_resource_type: 'Practitioner',
          epic_resource_id: 'epic-prac-1',
          epic_display_name: 'Smythe, John', // 0.75 match
        }),
      ],
      error: null,
    })

    const supabase = {} as any
    const result = await autoMatchSurgeons(supabase, 'conn-1', 'fac-1', mockSurgeons)

    // Should suggest, not auto-apply
    expect(result.autoApplied).toBe(0)
    expect(result.suggested).toBeGreaterThanOrEqual(1)
    expect(result.results[0].action).toBe('suggested')
    expect(result.results[0].confidence).toBeGreaterThanOrEqual(0.7)
    expect(result.results[0].confidence).toBeLessThan(0.9)
    expect(epicDAL.upsertEntityMapping).not.toHaveBeenCalled()
  })

  it('skips low-confidence matches (< 0.70)', async () => {
    vi.mocked(epicDAL.listEntityMappings).mockResolvedValue({
      data: [
        mockMapping({
          id: 'map-1',
          connection_id: 'conn-1',
          mapping_type: 'surgeon',
          epic_resource_type: 'Practitioner',
          epic_resource_id: 'epic-prac-1',
          epic_display_name: 'Williams, Robert', // No good match
        }),
      ],
      error: null,
    })

    const supabase = {} as any
    const result = await autoMatchSurgeons(supabase, 'conn-1', 'fac-1', mockSurgeons)

    expect(result.autoApplied).toBe(0)
    expect(result.suggested).toBe(0)
    expect(result.skipped).toBe(1)
    expect(result.results[0].action).toBe('skipped')
    expect(epicDAL.upsertEntityMapping).not.toHaveBeenCalled()
  })

  it('skips Epic entities with empty display names', async () => {
    vi.mocked(epicDAL.listEntityMappings).mockResolvedValue({
      data: [
        mockMapping({
          id: 'map-1',
          connection_id: 'conn-1',
          mapping_type: 'surgeon',
          epic_resource_type: 'Practitioner',
          epic_resource_id: 'epic-prac-1',
          epic_display_name: '', // Empty name
        }),
      ],
      error: null,
    })

    const supabase = {} as any
    const result = await autoMatchSurgeons(supabase, 'conn-1', 'fac-1', mockSurgeons)

    expect(result.skipped).toBe(1)
    expect(result.results[0].action).toBe('skipped')
    expect(result.results[0].confidence).toBe(0)
  })

  it('prevents double-mapping (already-mapped ORbit entities are excluded)', async () => {
    vi.mocked(epicDAL.listEntityMappings).mockResolvedValue({
      data: [
        mockMapping({
          id: 'map-1',
          connection_id: 'conn-1',
          mapping_type: 'surgeon',
          epic_resource_type: 'Practitioner',
          epic_resource_id: 'epic-prac-1',
          epic_display_name: 'Smith, John', // Would match surg-1
        }),
        mockMapping({
          id: 'map-2',
          connection_id: 'conn-1',
          mapping_type: 'surgeon',
          epic_resource_type: 'Practitioner',
          epic_resource_id: 'epic-prac-2',
          epic_display_name: 'Smith, J.',
          orbit_entity_id: 'surg-1', // ALREADY MAPPED
        }),
      ],
      error: null,
    })

    const supabase = {} as any
    const result = await autoMatchSurgeons(supabase, 'conn-1', 'fac-1', mockSurgeons)

    // map-1 should NOT match surg-1 (already taken), should match next-best or skip
    const map1Result = result.results.find(r => r.epicResourceId === 'epic-prac-1')
    expect(map1Result?.orbitEntityId).not.toBe('surg-1')
    expect(['skipped', 'suggested', 'auto_applied']).toContain(map1Result?.action)
  })

  it('handles empty ORbit surgeons list', async () => {
    vi.mocked(epicDAL.listEntityMappings).mockResolvedValue({
      data: [
        mockMapping({
          id: 'map-1',
          connection_id: 'conn-1',
          mapping_type: 'surgeon',
          epic_resource_type: 'Practitioner',
          epic_resource_id: 'epic-prac-1',
          epic_display_name: 'Smith, John',
        }),
      ],
      error: null,
    })

    const supabase = {} as any
    const result = await autoMatchSurgeons(supabase, 'conn-1', 'fac-1', []) // No surgeons

    expect(result.autoApplied).toBe(0)
    expect(result.suggested).toBe(0)
    expect(result.skipped).toBe(1)
    expect(result.results[0].action).toBe('skipped')
  })

  it('handles DAL errors gracefully', async () => {
    const mockError = {
      message: 'Database error',
      details: '',
      hint: '',
      code: 'PGRST000',
      name: 'PostgrestError',
    } as PostgrestError
    vi.mocked(epicDAL.listEntityMappings).mockResolvedValue({
      data: [],
      error: mockError,
    })

    const supabase = {} as any
    const result = await autoMatchSurgeons(supabase, 'conn-1', 'fac-1', mockSurgeons)

    // Should return empty summary, not crash
    expect(result.autoApplied).toBe(0)
    expect(result.suggested).toBe(0)
    expect(result.skipped).toBe(0)
    expect(result.results).toHaveLength(0)
  })
})

describe('autoMatchRooms', () => {
  const mockRooms = [
    { id: 'room-1', name: 'OR 1' },
    { id: 'room-2', name: 'OR 2' },
  ]

  it('auto-applies exact room name matches', async () => {
    vi.mocked(epicDAL.listEntityMappings).mockResolvedValue({
      data: [
        mockMapping({
          id: 'map-1',
          connection_id: 'conn-1',
          mapping_type: 'room',
          epic_resource_type: 'Location',
          epic_resource_id: 'epic-loc-1',
          epic_display_name: 'OR 1',
        }),
      ],
      error: null,
    })

    vi.mocked(epicDAL.upsertEntityMapping).mockResolvedValue({
      data: {} as any,
      error: null,
    })

    const supabase = {} as any
    const result = await autoMatchRooms(supabase, 'conn-1', 'fac-1', mockRooms)

    expect(result.autoApplied).toBe(1)
    expect(result.results[0].orbitEntityId).toBe('room-1')
  })

  it('suggests close room name matches (e.g., "OR-1" vs "OR 1")', async () => {
    vi.mocked(epicDAL.listEntityMappings).mockResolvedValue({
      data: [
        mockMapping({
          id: 'map-1',
          connection_id: 'conn-1',
          mapping_type: 'room',
          epic_resource_type: 'Location',
          epic_resource_id: 'epic-loc-1',
          epic_display_name: 'OR-1', // Close but not exact
        }),
      ],
      error: null,
    })

    const supabase = {} as any
    const result = await autoMatchRooms(supabase, 'conn-1', 'fac-1', mockRooms)

    const match = result.results[0]
    expect(match.orbitEntityId).toBe('room-1')
    expect(['suggested', 'auto_applied']).toContain(match.action)
  })
})

describe('autoMatchProcedures', () => {
  const mockProcedures = [
    { id: 'proc-1', name: 'Knee Replacement' },
    { id: 'proc-2', name: 'Hip Replacement' },
  ]

  it('auto-applies exact procedure name matches', async () => {
    vi.mocked(epicDAL.listEntityMappings).mockResolvedValue({
      data: [
        mockMapping({
          id: 'map-1',
          connection_id: 'conn-1',
          mapping_type: 'procedure',
          epic_resource_type: 'ServiceType',
          epic_resource_id: 'epic-svc-1',
          epic_display_name: 'Knee Replacement',
        }),
      ],
      error: null,
    })

    vi.mocked(epicDAL.upsertEntityMapping).mockResolvedValue({
      data: {} as any,
      error: null,
    })

    const supabase = {} as any
    const result = await autoMatchProcedures(supabase, 'conn-1', 'fac-1', mockProcedures)

    expect(result.autoApplied).toBe(1)
    expect(result.results[0].orbitEntityId).toBe('proc-1')
  })

  it('suggests close procedure name matches (typos, abbreviations)', async () => {
    vi.mocked(epicDAL.listEntityMappings).mockResolvedValue({
      data: [
        mockMapping({
          id: 'map-1',
          connection_id: 'conn-1',
          mapping_type: 'procedure',
          epic_resource_type: 'ServiceType',
          epic_resource_id: 'epic-svc-1',
          epic_display_name: 'Kne Replacement', // Typo
        }),
      ],
      error: null,
    })

    const supabase = {} as any
    const result = await autoMatchProcedures(supabase, 'conn-1', 'fac-1', mockProcedures)

    const match = result.results[0]
    expect(match.orbitEntityId).toBe('proc-1')
    expect(match.confidence).toBeGreaterThan(0.8)
  })
})

// =====================================================
// EDGE CASE TESTS
// =====================================================

describe('auto-matcher edge cases', () => {
  it('rounds confidence to 2 decimal places', async () => {
    vi.mocked(epicDAL.listEntityMappings).mockResolvedValue({
      data: [
        mockMapping({
          id: 'map-1',
          connection_id: 'conn-1',
          mapping_type: 'surgeon',
          epic_resource_type: 'Practitioner',
          epic_resource_id: 'epic-prac-1',
          epic_display_name: 'Smith, John',
        }),
      ],
      error: null,
    })

    vi.mocked(epicDAL.upsertEntityMapping).mockResolvedValue({
      data: {} as any,
      error: null,
    })

    const supabase = {} as any
    const result = await autoMatchSurgeons(supabase, 'conn-1', 'fac-1', [
      { id: 'surg-1', first_name: 'John', last_name: 'Smith' },
    ])

    // Confidence should be 1.00 for exact match, not 0.9999999
    expect(result.results[0].confidence).toBe(1.0)
    // Verify upsertEntityMapping was called with rounded confidence
    expect(epicDAL.upsertEntityMapping).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({
        match_confidence: 1.0,
      })
    )
  })

  it('processes multiple unmapped entities in a single run', async () => {
    vi.mocked(epicDAL.listEntityMappings).mockResolvedValue({
      data: [
        mockMapping({
          id: 'map-1',
          connection_id: 'conn-1',
          mapping_type: 'surgeon',
          epic_resource_type: 'Practitioner',
          epic_resource_id: 'epic-prac-1',
          epic_display_name: 'Smith, John',
        }),
        mockMapping({
          id: 'map-2',
          connection_id: 'conn-1',
          mapping_type: 'surgeon',
          epic_resource_type: 'Practitioner',
          epic_resource_id: 'epic-prac-2',
          epic_display_name: 'Doe, Jane',
        }),
      ],
      error: null,
    })

    vi.mocked(epicDAL.upsertEntityMapping).mockResolvedValue({
      data: {} as any,
      error: null,
    })

    const supabase = {} as any
    const result = await autoMatchSurgeons(supabase, 'conn-1', 'fac-1', [
      { id: 'surg-1', first_name: 'John', last_name: 'Smith' },
      { id: 'surg-2', first_name: 'Jane', last_name: 'Doe' },
    ])

    expect(result.results).toHaveLength(2)
    expect(result.autoApplied).toBe(2)
    expect(epicDAL.upsertEntityMapping).toHaveBeenCalledTimes(2)
  })
})
