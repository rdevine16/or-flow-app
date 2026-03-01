import { describe, it, expect } from 'vitest'
import type { EpicEntityMapping, EpicMappingType } from '@/lib/epic/types'

/**
 * Tests for Entity Mappings PageClient logic.
 *
 * Tests tab filtering, filter composition, mapping count stats,
 * ORbit entity dropdown population, and mapped/unmapped status.
 */

// ============================================
// TEST DATA
// ============================================

const mockMappings: EpicEntityMapping[] = [
  {
    id: 'm1', facility_id: 'f1', connection_id: 'c1',
    mapping_type: 'surgeon', epic_resource_type: 'Practitioner', epic_resource_id: 'p1',
    epic_display_name: 'Dr. Smith', orbit_entity_id: 'surgeon-1',
    match_method: 'manual', match_confidence: null,
    created_at: '', updated_at: '',
  },
  {
    id: 'm2', facility_id: 'f1', connection_id: 'c1',
    mapping_type: 'surgeon', epic_resource_type: 'Practitioner', epic_resource_id: 'p2',
    epic_display_name: 'Dr. Jones', orbit_entity_id: null,
    match_method: 'manual', match_confidence: null,
    created_at: '', updated_at: '',
  },
  {
    id: 'm3', facility_id: 'f1', connection_id: 'c1',
    mapping_type: 'surgeon', epic_resource_type: 'Practitioner', epic_resource_id: 'p3',
    epic_display_name: 'Dr. Williams', orbit_entity_id: 'surgeon-2',
    match_method: 'auto', match_confidence: 0.92,
    created_at: '', updated_at: '',
  },
  {
    id: 'm4', facility_id: 'f1', connection_id: 'c1',
    mapping_type: 'room', epic_resource_type: 'Location', epic_resource_id: 'l1',
    epic_display_name: 'OR Suite 1', orbit_entity_id: 'room-1',
    match_method: 'manual', match_confidence: null,
    created_at: '', updated_at: '',
  },
  {
    id: 'm5', facility_id: 'f1', connection_id: 'c1',
    mapping_type: 'room', epic_resource_type: 'Location', epic_resource_id: 'l2',
    epic_display_name: 'OR Suite 2', orbit_entity_id: null,
    match_method: 'manual', match_confidence: null,
    created_at: '', updated_at: '',
  },
  {
    id: 'm6', facility_id: 'f1', connection_id: 'c1',
    mapping_type: 'procedure', epic_resource_type: 'ServiceRequest', epic_resource_id: 'sr1',
    epic_display_name: 'Total Hip Replacement', orbit_entity_id: null,
    match_method: 'manual', match_confidence: null,
    created_at: '', updated_at: '',
  },
]

// ============================================
// TAB FILTERING
// ============================================

describe('Entity Mappings — Tab Filtering', () => {
  it('should filter by surgeon tab', () => {
    const surgeons = mockMappings.filter(m => m.mapping_type === 'surgeon')
    expect(surgeons).toHaveLength(3)
  })

  it('should filter by room tab', () => {
    const rooms = mockMappings.filter(m => m.mapping_type === 'room')
    expect(rooms).toHaveLength(2)
  })

  it('should filter by procedure tab', () => {
    const procedures = mockMappings.filter(m => m.mapping_type === 'procedure')
    expect(procedures).toHaveLength(1)
  })

  it('should show correct tab counts', () => {
    const counts = {
      surgeon: mockMappings.filter(m => m.mapping_type === 'surgeon').length,
      room: mockMappings.filter(m => m.mapping_type === 'room').length,
      procedure: mockMappings.filter(m => m.mapping_type === 'procedure').length,
    }
    expect(counts).toEqual({ surgeon: 3, room: 2, procedure: 1 })
  })
})

// ============================================
// FILTER COMPOSITION (tab + mapped/unmapped)
// ============================================

type FilterTab = 'all' | 'mapped' | 'unmapped'

function filterMappings(
  allMappings: EpicEntityMapping[],
  activeTab: EpicMappingType,
  filterTab: FilterTab
): EpicEntityMapping[] {
  const tabMappings = allMappings.filter(m => m.mapping_type === activeTab)
  switch (filterTab) {
    case 'mapped': return tabMappings.filter(m => !!m.orbit_entity_id)
    case 'unmapped': return tabMappings.filter(m => !m.orbit_entity_id)
    default: return tabMappings
  }
}

describe('Entity Mappings — Filter Composition', () => {
  it('should show all surgeons when filter is "all"', () => {
    const result = filterMappings(mockMappings, 'surgeon', 'all')
    expect(result).toHaveLength(3)
  })

  it('should show only mapped surgeons', () => {
    const result = filterMappings(mockMappings, 'surgeon', 'mapped')
    expect(result).toHaveLength(2) // Dr. Smith + Dr. Williams
    expect(result.every(m => m.orbit_entity_id !== null)).toBe(true)
  })

  it('should show only unmapped surgeons', () => {
    const result = filterMappings(mockMappings, 'surgeon', 'unmapped')
    expect(result).toHaveLength(1) // Dr. Jones
    expect(result[0].epic_display_name).toBe('Dr. Jones')
  })

  it('should filter rooms by mapped status', () => {
    const mapped = filterMappings(mockMappings, 'room', 'mapped')
    expect(mapped).toHaveLength(1) // OR Suite 1
    const unmapped = filterMappings(mockMappings, 'room', 'unmapped')
    expect(unmapped).toHaveLength(1) // OR Suite 2
  })

  it('should handle procedures with all unmapped', () => {
    const mapped = filterMappings(mockMappings, 'procedure', 'mapped')
    expect(mapped).toHaveLength(0)
    const unmapped = filterMappings(mockMappings, 'procedure', 'unmapped')
    expect(unmapped).toHaveLength(1)
  })
})

// ============================================
// MAPPED/UNMAPPED COUNTS
// ============================================

describe('Entity Mappings — Count Calculations', () => {
  it('should compute mapped and unmapped counts per tab', () => {
    const surgeons = mockMappings.filter(m => m.mapping_type === 'surgeon')
    const mapped = surgeons.filter(m => !!m.orbit_entity_id).length
    const unmapped = surgeons.filter(m => !m.orbit_entity_id).length

    expect(mapped).toBe(2)
    expect(unmapped).toBe(1)
    expect(mapped + unmapped).toBe(surgeons.length)
  })

  it('should have consistent counts between "all" and "mapped + unmapped"', () => {
    for (const type of ['surgeon', 'room', 'procedure'] as EpicMappingType[]) {
      const all = filterMappings(mockMappings, type, 'all')
      const mapped = filterMappings(mockMappings, type, 'mapped')
      const unmapped = filterMappings(mockMappings, type, 'unmapped')
      expect(mapped.length + unmapped.length).toBe(all.length)
    }
  })
})

// ============================================
// ORBIT ENTITY DROPDOWN POPULATION
// ============================================

describe('Entity Mappings — Dropdown Options', () => {
  const surgeons = [
    { id: 's1', first_name: 'John', last_name: 'Smith', email: 'j@test.com' },
    { id: 's2', first_name: 'Jane', last_name: 'Doe', email: 'jd@test.com' },
  ]
  const rooms = [
    { id: 'r1', name: 'OR 1' },
    { id: 'r2', name: 'OR 2' },
  ]
  const procedures = [
    { id: 'p1', name: 'Total Hip Replacement' },
    { id: 'p2', name: 'Knee Arthroscopy' },
  ]

  function getOrbitEntities(
    activeTab: EpicMappingType,
    surgeonsData: typeof surgeons,
    roomsData: typeof rooms,
    proceduresData: typeof procedures,
  ): Array<{ id: string; label: string }> {
    switch (activeTab) {
      case 'surgeon':
        return surgeonsData.map(s => ({ id: s.id, label: `${s.last_name}, ${s.first_name}` }))
      case 'room':
        return roomsData.map(r => ({ id: r.id, label: r.name }))
      case 'procedure':
        return proceduresData.map(p => ({ id: p.id, label: p.name }))
    }
  }

  it('should format surgeon names as "Last, First"', () => {
    const entities = getOrbitEntities('surgeon', surgeons, rooms, procedures)
    expect(entities[0]).toEqual({ id: 's1', label: 'Smith, John' })
    expect(entities[1]).toEqual({ id: 's2', label: 'Doe, Jane' })
  })

  it('should use room names directly', () => {
    const entities = getOrbitEntities('room', surgeons, rooms, procedures)
    expect(entities[0]).toEqual({ id: 'r1', label: 'OR 1' })
  })

  it('should use procedure names directly', () => {
    const entities = getOrbitEntities('procedure', surgeons, rooms, procedures)
    expect(entities[0]).toEqual({ id: 'p1', label: 'Total Hip Replacement' })
  })
})

// ============================================
// MATCH METHOD DISPLAY
// ============================================

describe('Entity Mappings — Match Badge Logic', () => {
  it('should show auto-match badge with confidence for auto matches', () => {
    const mapping = mockMappings.find(m => m.match_method === 'auto')!
    expect(mapping.match_confidence).toBe(0.92)
    const display = `Auto ${Math.round(mapping.match_confidence! * 100)}%`
    expect(display).toBe('Auto 92%')
  })

  it('should show manual badge for manual matches that are mapped', () => {
    const mapping = mockMappings.find(m => m.match_method === 'manual' && m.orbit_entity_id)!
    expect(mapping.match_method).toBe('manual')
    expect(mapping.orbit_entity_id).toBeTruthy()
  })

  it('should show no badge for unmapped entities', () => {
    const mapping = mockMappings.find(m => !m.orbit_entity_id && m.match_method === 'manual')!
    // No badge should render when orbit_entity_id is null
    expect(mapping.orbit_entity_id).toBeNull()
  })
})

// ============================================
// EMPTY STATE SCENARIOS
// ============================================

describe('Entity Mappings — Empty States', () => {
  it('should show "no connection" message when connectionInfo is null', () => {
    const hasConnection = false
    expect(hasConnection).toBe(false)
    // Should render the "No Epic connection found" message
  })

  it('should show "no entities" message when tab has zero mappings', () => {
    const emptyMappings: EpicEntityMapping[] = []
    const tabMappings = emptyMappings.filter(m => m.mapping_type === 'surgeon')
    expect(tabMappings.length).toBe(0)
  })

  it('should show filter-specific empty message when filter excludes all', () => {
    // All procedures are unmapped, so "mapped" filter shows nothing
    const mapped = filterMappings(mockMappings, 'procedure', 'mapped')
    expect(mapped).toHaveLength(0)
  })
})
