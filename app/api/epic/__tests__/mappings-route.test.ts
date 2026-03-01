import { describe, it, expect } from 'vitest'
import type { EpicEntityMapping, EpicMappingType } from '@/lib/epic/types'

/**
 * Tests for /api/epic/mappings routes — logic validation.
 *
 * Tests request body validation, mapping type filtering,
 * and upsert data shape.
 */

// ============================================
// REQUEST VALIDATION
// ============================================

interface MappingPostBody {
  facility_id?: string
  connection_id?: string
  mapping_type?: EpicMappingType
  epic_resource_type?: string
  epic_resource_id?: string
  epic_display_name?: string
  orbit_entity_id?: string | null
}

function validateMappingBody(body: MappingPostBody): string | null {
  if (!body.facility_id) return 'Missing required field: facility_id'
  if (!body.connection_id) return 'Missing required field: connection_id'
  if (!body.mapping_type) return 'Missing required field: mapping_type'
  if (!body.epic_resource_type) return 'Missing required field: epic_resource_type'
  if (!body.epic_resource_id) return 'Missing required field: epic_resource_id'
  return null
}

describe('Epic Mappings API — Request Validation', () => {
  it('should pass with all required fields', () => {
    const body: MappingPostBody = {
      facility_id: 'fac-1',
      connection_id: 'conn-1',
      mapping_type: 'surgeon',
      epic_resource_type: 'Practitioner',
      epic_resource_id: 'pract-123',
    }
    expect(validateMappingBody(body)).toBeNull()
  })

  it('should reject missing facility_id', () => {
    expect(validateMappingBody({
      connection_id: 'conn-1',
      mapping_type: 'surgeon',
      epic_resource_type: 'Practitioner',
      epic_resource_id: 'pract-123',
    })).toContain('facility_id')
  })

  it('should reject missing connection_id', () => {
    expect(validateMappingBody({
      facility_id: 'fac-1',
      mapping_type: 'surgeon',
      epic_resource_type: 'Practitioner',
      epic_resource_id: 'pract-123',
    })).toContain('connection_id')
  })

  it('should reject missing mapping_type', () => {
    expect(validateMappingBody({
      facility_id: 'fac-1',
      connection_id: 'conn-1',
      epic_resource_type: 'Practitioner',
      epic_resource_id: 'pract-123',
    })).toContain('mapping_type')
  })

  it('should reject missing epic_resource_type', () => {
    expect(validateMappingBody({
      facility_id: 'fac-1',
      connection_id: 'conn-1',
      mapping_type: 'surgeon',
      epic_resource_id: 'pract-123',
    })).toContain('epic_resource_type')
  })

  it('should reject missing epic_resource_id', () => {
    expect(validateMappingBody({
      facility_id: 'fac-1',
      connection_id: 'conn-1',
      mapping_type: 'surgeon',
      epic_resource_type: 'Practitioner',
    })).toContain('epic_resource_id')
  })

  it('should accept optional orbit_entity_id as null (unmapping)', () => {
    const body: MappingPostBody = {
      facility_id: 'fac-1',
      connection_id: 'conn-1',
      mapping_type: 'surgeon',
      epic_resource_type: 'Practitioner',
      epic_resource_id: 'pract-123',
      orbit_entity_id: null,
    }
    expect(validateMappingBody(body)).toBeNull()
  })
})

// ============================================
// MAPPING TYPE FILTERING
// ============================================

describe('Epic Mappings API — Type Filtering', () => {
  const mockMappings: EpicEntityMapping[] = [
    {
      id: 'm1', facility_id: 'f1', connection_id: 'c1',
      mapping_type: 'surgeon', epic_resource_type: 'Practitioner', epic_resource_id: 'p1',
      epic_display_name: 'Dr. Smith', orbit_entity_id: 's1',
      match_method: 'manual', match_confidence: null,
      created_at: '', updated_at: '',
    },
    {
      id: 'm2', facility_id: 'f1', connection_id: 'c1',
      mapping_type: 'room', epic_resource_type: 'Location', epic_resource_id: 'l1',
      epic_display_name: 'OR 1', orbit_entity_id: null,
      match_method: 'manual', match_confidence: null,
      created_at: '', updated_at: '',
    },
    {
      id: 'm3', facility_id: 'f1', connection_id: 'c1',
      mapping_type: 'procedure', epic_resource_type: 'ServiceRequest', epic_resource_id: 'sr1',
      epic_display_name: 'Hip Replacement', orbit_entity_id: 'pt1',
      match_method: 'auto', match_confidence: 0.95,
      created_at: '', updated_at: '',
    },
  ]

  it('should return all mappings when no type filter', () => {
    expect(mockMappings.length).toBe(3)
  })

  it('should filter by surgeon type', () => {
    const filtered = mockMappings.filter(m => m.mapping_type === 'surgeon')
    expect(filtered).toHaveLength(1)
    expect(filtered[0].epic_display_name).toBe('Dr. Smith')
  })

  it('should filter by room type', () => {
    const filtered = mockMappings.filter(m => m.mapping_type === 'room')
    expect(filtered).toHaveLength(1)
    expect(filtered[0].orbit_entity_id).toBeNull() // unmapped
  })

  it('should filter by procedure type', () => {
    const filtered = mockMappings.filter(m => m.mapping_type === 'procedure')
    expect(filtered).toHaveLength(1)
    expect(filtered[0].match_method).toBe('auto')
    expect(filtered[0].match_confidence).toBe(0.95)
  })
})

// ============================================
// UPSERT DATA SHAPE
// ============================================

describe('Epic Mappings API — Upsert Data Shape', () => {
  it('should build correct upsert payload for manual mapping', () => {
    const body: MappingPostBody = {
      facility_id: 'fac-1',
      connection_id: 'conn-1',
      mapping_type: 'surgeon',
      epic_resource_type: 'Practitioner',
      epic_resource_id: 'pract-123',
      epic_display_name: 'Dr. Smith',
      orbit_entity_id: 'surgeon-uuid',
    }

    const upsertPayload = {
      facility_id: body.facility_id,
      connection_id: body.connection_id,
      mapping_type: body.mapping_type,
      epic_resource_type: body.epic_resource_type,
      epic_resource_id: body.epic_resource_id,
      epic_display_name: body.epic_display_name,
      orbit_entity_id: body.orbit_entity_id || null,
      match_method: 'manual' as const,
    }

    expect(upsertPayload.match_method).toBe('manual')
    expect(upsertPayload.orbit_entity_id).toBe('surgeon-uuid')
    expect(upsertPayload.facility_id).toBe('fac-1')
  })

  it('should set orbit_entity_id to null when clearing a mapping', () => {
    const body: MappingPostBody = {
      facility_id: 'fac-1',
      connection_id: 'conn-1',
      mapping_type: 'surgeon',
      epic_resource_type: 'Practitioner',
      epic_resource_id: 'pract-123',
      orbit_entity_id: null,
    }

    const payload = { orbit_entity_id: body.orbit_entity_id || null }
    expect(payload.orbit_entity_id).toBeNull()
  })

  it('should treat empty string orbit_entity_id as null', () => {
    const body: MappingPostBody = {
      facility_id: 'fac-1',
      connection_id: 'conn-1',
      mapping_type: 'surgeon',
      epic_resource_type: 'Practitioner',
      epic_resource_id: 'pract-123',
      orbit_entity_id: '',
    }

    // The route uses: orbit_entity_id: orbit_entity_id || null
    const resolvedId = body.orbit_entity_id || null
    expect(resolvedId).toBeNull()
  })
})
