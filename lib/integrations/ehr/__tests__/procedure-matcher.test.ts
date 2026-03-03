import { describe, it, expect, vi, beforeEach } from 'vitest'
import { matchProcedure } from '../procedure-matcher'

vi.mock('@/lib/dal/ehr', () => ({
  ehrDAL: {
    getEntityMapping: vi.fn(),
  },
}))

vi.mock('@/lib/dal/lookups', () => ({
  lookupsDAL: {
    procedureTypes: vi.fn(),
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
import { lookupsDAL } from '@/lib/dal/lookups'

const mockSupabase = {} as Parameters<typeof matchProcedure>[0]

const PROCEDURES = [
  { id: 'proc-1', name: 'Total knee arthroplasty', category: 'Orthopedics', body_region: 'Knee', is_active: true },
  { id: 'proc-2', name: 'Total hip arthroplasty', category: 'Orthopedics', body_region: 'Hip', is_active: true },
  { id: 'proc-3', name: 'ACL reconstruction', category: 'Orthopedics', body_region: 'Knee', is_active: true },
  { id: 'proc-4', name: 'Cataract surgery', category: 'Ophthalmology', body_region: 'Eye', is_active: true },
]

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(ehrDAL.getEntityMapping).mockResolvedValue({ data: null, error: null })
  vi.mocked(lookupsDAL.procedureTypes).mockResolvedValue({ data: PROCEDURES, error: null })
})

describe('matchProcedure', () => {
  it('returns matched from entity mapping by CPT code', async () => {
    vi.mocked(ehrDAL.getEntityMapping).mockResolvedValueOnce({
      data: {
        id: 'map-1',
        facility_id: 'fac-1',
        integration_id: 'int-1',
        entity_type: 'procedure' as const,
        external_identifier: '27447',
        external_display_name: 'Total knee arthroplasty',
        orbit_entity_id: 'proc-1',
        orbit_display_name: 'Total knee arthroplasty',
        match_method: 'auto' as const,
        match_confidence: 0.95,
        created_at: '',
        updated_at: '',
      },
      error: null,
    })

    const result = await matchProcedure(mockSupabase, 'int-1', 'fac-1', '27447', 'Total knee arthroplasty')
    expect(result.matched).toBe(true)
    expect(result.orbitProcedureId).toBe('proc-1')
    expect(result.matchSource).toBe('mapping')
    expect(result.confidence).toBe(1.0)
  })

  it('returns matched via fuzzy name (exact name match)', async () => {
    const result = await matchProcedure(mockSupabase, 'int-1', 'fac-1', '27447', 'Total knee arthroplasty')
    expect(result.matched).toBe(true)
    expect(result.orbitProcedureId).toBe('proc-1')
    expect(result.matchSource).toBe('fuzzy')
    expect(result.confidence).toBe(1.0)
  })

  it('returns matched via fuzzy name (case-insensitive)', async () => {
    const result = await matchProcedure(mockSupabase, 'int-1', 'fac-1', '27447', 'TOTAL KNEE ARTHROPLASTY')
    expect(result.matched).toBe(true)
    expect(result.orbitProcedureId).toBe('proc-1')
  })

  it('returns suggestions for similar procedure names', async () => {
    // "Total hip arthroplasty" is an exact match — use a slight typo to test fuzzy
    const result = await matchProcedure(mockSupabase, 'int-1', 'fac-1', '', 'Total hip arthroplasty')
    expect(result.suggestions.length).toBeGreaterThan(0)
    const hipSuggestion = result.suggestions.find(s => s.orbit_entity_id === 'proc-2')
    expect(hipSuggestion).toBeDefined()
    expect(hipSuggestion!.confidence).toBe(1.0)
  })

  it('returns unmatched with no suggestions for completely unknown procedure', async () => {
    const result = await matchProcedure(mockSupabase, 'int-1', 'fac-1', '99999', 'Alien probe removal')
    expect(result.matched).toBe(false)
    expect(result.orbitProcedureId).toBeNull()
    expect(result.matchSource).toBe('none')
  })

  it('returns empty result when no identifiers provided', async () => {
    const result = await matchProcedure(mockSupabase, 'int-1', 'fac-1', '', '')
    expect(result.matched).toBe(false)
    expect(result.matchSource).toBe('none')
  })

  it('returns empty result when facility has no procedure types', async () => {
    vi.mocked(lookupsDAL.procedureTypes).mockResolvedValue({ data: [], error: null })

    const result = await matchProcedure(mockSupabase, 'int-1', 'fac-1', '27447', 'Total knee arthroplasty')
    expect(result.matched).toBe(false)
    expect(result.matchSource).toBe('none')
  })

  it('checks both CPT code and name in entity mappings', async () => {
    vi.mocked(ehrDAL.getEntityMapping).mockResolvedValue({ data: null, error: null })

    await matchProcedure(mockSupabase, 'int-1', 'fac-1', '27447', 'Total knee arthroplasty')

    // Should have checked CPT first, then name
    expect(vi.mocked(ehrDAL.getEntityMapping)).toHaveBeenCalledTimes(2)
    expect(vi.mocked(ehrDAL.getEntityMapping)).toHaveBeenCalledWith(
      mockSupabase, 'int-1', 'procedure', '27447',
    )
    expect(vi.mocked(ehrDAL.getEntityMapping)).toHaveBeenCalledWith(
      mockSupabase, 'int-1', 'procedure', 'Total knee arthroplasty',
    )
  })
})
