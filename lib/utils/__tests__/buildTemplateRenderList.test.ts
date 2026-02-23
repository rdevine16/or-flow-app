// lib/utils/__tests__/buildTemplateRenderList.test.ts
import { describe, it, expect } from 'vitest'
import {
  buildTemplateRenderList,
  type TemplateItemData,
  type PhaseLookup,
  type MilestoneLookup,
} from '../buildTemplateRenderList'

// ─── Test Helpers ──────────────────────────────────────────

function makePhase(
  id: string,
  name: string,
  displayOrder: number,
  colorKey: string | null = 'blue',
  parentPhaseId: string | null = null,
): PhaseLookup {
  return {
    id,
    name,
    display_name: name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    color_key: colorKey,
    display_order: displayOrder,
    parent_phase_id: parentPhaseId,
  }
}

function makeMilestone(
  id: string,
  name: string,
  pairWithId: string | null = null,
  pairPosition: 'start' | 'end' | null = null,
): MilestoneLookup {
  return {
    id,
    name,
    display_name: name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    pair_with_id: pairWithId,
    pair_position: pairPosition,
  }
}

function makeItem(
  id: string,
  templateId: string,
  milestoneId: string,
  phaseId: string | null,
  displayOrder: number,
): TemplateItemData {
  return {
    id,
    template_id: templateId,
    facility_milestone_id: milestoneId,
    facility_phase_id: phaseId,
    display_order: displayOrder,
  }
}

// ─── Tests ─────────────────────────────────────────────────

describe('buildTemplateRenderList', () => {
  it('returns empty array for empty template', () => {
    const result = buildTemplateRenderList([], [], [])
    expect(result).toEqual([])
  })

  it('handles unassigned milestones (null facility_phase_id)', () => {
    const milestones = [
      makeMilestone('m1', 'patient_in'),
      makeMilestone('m2', 'incision'),
    ]
    const items = [
      makeItem('i1', 't1', 'm1', null, 1),
      makeItem('i2', 't1', 'm2', null, 2),
    ]

    const result = buildTemplateRenderList(items, [], milestones)

    expect(result).toHaveLength(3) // header + 2 milestones
    expect(result[0]).toMatchObject({ type: 'unassigned-header', count: 2 })
    expect(result[1]).toMatchObject({ type: 'unassigned-milestone', milestone: milestones[0] })
    expect(result[2]).toMatchObject({ type: 'unassigned-milestone', milestone: milestones[1] })
  })

  it('renders single phase with multiple milestones', () => {
    const phases = [makePhase('p1', 'pre_op', 1)]
    const milestones = [
      makeMilestone('m1', 'patient_in'),
      makeMilestone('m2', 'timeout'),
      makeMilestone('m3', 'incision'),
    ]
    const items = [
      makeItem('i1', 't1', 'm1', 'p1', 1),
      makeItem('i2', 't1', 'm2', 'p1', 2),
      makeItem('i3', 't1', 'm3', 'p1', 3),
    ]

    const result = buildTemplateRenderList(items, phases, milestones)

    // Should be: phase-header, edge-milestone (start), interior-milestone, edge-milestone (end), drop-zone
    expect(result).toHaveLength(5)
    expect(result[0]).toMatchObject({ type: 'phase-header', phase: phases[0], itemCount: 3 })
    expect(result[1]).toMatchObject({ type: 'edge-milestone', edge: 'start', milestone: milestones[0] })
    expect(result[2]).toMatchObject({ type: 'interior-milestone', milestone: milestones[1] })
    expect(result[3]).toMatchObject({ type: 'edge-milestone', edge: 'end', milestone: milestones[2] })
    expect(result[4]).toMatchObject({ type: 'drop-zone', phaseId: 'p1' })
  })

  it('handles single milestone in a phase (edge case)', () => {
    const phases = [makePhase('p1', 'pre_op', 1)]
    const milestones = [makeMilestone('m1', 'incision')]
    const items = [makeItem('i1', 't1', 'm1', 'p1', 1)]

    const result = buildTemplateRenderList(items, phases, milestones)

    // Single milestone is BOTH start and end edge
    expect(result).toHaveLength(3) // phase-header, edge-milestone (start), drop-zone
    expect(result[0]).toMatchObject({ type: 'phase-header' })
    expect(result[1]).toMatchObject({ type: 'edge-milestone', edge: 'start', milestone: milestones[0] })
    expect(result[2]).toMatchObject({ type: 'drop-zone' })
  })

  it('renders boundary connector between two adjacent phases sharing a milestone', () => {
    const phases = [
      makePhase('p1', 'pre_op', 1),
      makePhase('p2', 'surgical', 2),
    ]
    const milestones = [
      makeMilestone('m1', 'patient_in'),
      makeMilestone('m2', 'incision'), // shared boundary
      makeMilestone('m3', 'closing'),
    ]
    const items = [
      makeItem('i1', 't1', 'm1', 'p1', 1),
      makeItem('i2', 't1', 'm2', 'p1', 2), // end of p1
      makeItem('i3', 't1', 'm2', 'p2', 3), // start of p2 (same milestone)
      makeItem('i4', 't1', 'm3', 'p2', 4),
    ]

    const result = buildTemplateRenderList(items, phases, milestones)

    // Boundary connector should exist between the two phases
    const boundaryConnectors = result.filter(r => r.type === 'boundary-connector')
    expect(boundaryConnectors).toHaveLength(1)
    expect(boundaryConnectors[0]).toMatchObject({
      type: 'boundary-connector',
      milestoneName: 'Incision',
      endsPhase: phases[0],
      startsPhase: phases[1],
    })

    // The shared milestone renders as edge-milestone in BOTH phases
    const edgeMilestones = result.filter(r => r.type === 'edge-milestone')
    expect(edgeMilestones).toHaveLength(4) // patient_in (start p1), incision (end p1), incision (start p2), closing (end p2)
    expect(edgeMilestones[0]).toMatchObject({ milestone: milestones[0], edge: 'start' }) // patient_in
    expect(edgeMilestones[1]).toMatchObject({ milestone: milestones[1], edge: 'end' })   // incision (end of p1)
    expect(edgeMilestones[2]).toMatchObject({ milestone: milestones[1], edge: 'start' }) // incision (start of p2)
    expect(edgeMilestones[3]).toMatchObject({ milestone: milestones[2], edge: 'end' })   // closing
  })

  it('renders sub-phase within parent phase', () => {
    const phases = [
      makePhase('p1', 'surgical', 1),
      makePhase('p1_sub', 'closure', 2, 'amber'),
    ]
    const milestones = [
      makeMilestone('m1', 'incision'),
      makeMilestone('m2', 'suture_start'),
      makeMilestone('m3', 'suture_end'),
      makeMilestone('m4', 'dressing'),
    ]
    const items = [
      // Parent phase has all 4 milestones
      makeItem('i1', 't1', 'm1', 'p1', 1),
      makeItem('i2', 't1', 'm2', 'p1', 2),
      makeItem('i3', 't1', 'm3', 'p1', 3),
      makeItem('i4', 't1', 'm4', 'p1', 4),
      // Sub-phase contains m2 and m3
      makeItem('i5', 't1', 'm2', 'p1_sub', 5),
      makeItem('i6', 't1', 'm3', 'p1_sub', 6),
    ]

    // Sub-phase relationship is template-specific via subPhaseMap
    const result = buildTemplateRenderList(items, phases, milestones, undefined, { p1_sub: 'p1' })

    const subPhases = result.filter(r => r.type === 'sub-phase')
    expect(subPhases).toHaveLength(1)
    expect(subPhases[0]).toMatchObject({
      type: 'sub-phase',
      phase: phases[1], // p1_sub
      parentPhase: phases[0], // p1
      milestones: [
        { milestone: milestones[1], templateItem: expect.objectContaining({ facility_milestone_id: 'm2' }) },
        { milestone: milestones[2], templateItem: expect.objectContaining({ facility_milestone_id: 'm3' }) },
      ],
    })

    // Sub-phase indicator should appear AFTER the parent milestone that matches the sub-phase's last milestone
    const subPhaseIndex = result.findIndex(r => r.type === 'sub-phase')
    const m3Index = result.findIndex(r =>
      (r.type === 'interior-milestone' || r.type === 'edge-milestone') &&
      'milestone' in r && r.milestone.id === 'm3'
    )
    expect(subPhaseIndex).toBeGreaterThan(m3Index)
  })

  it('handles phase with no items (should not appear in render list)', () => {
    const phases = [
      makePhase('p1', 'pre_op', 1),
      makePhase('p2', 'surgical', 2), // no items in this phase
    ]
    const milestones = [makeMilestone('m1', 'patient_in')]
    const items = [makeItem('i1', 't1', 'm1', 'p1', 1)]

    const result = buildTemplateRenderList(items, phases, milestones)

    // Only p1 should appear (p2 has no items)
    const phaseHeaders = result.filter(r => r.type === 'phase-header')
    expect(phaseHeaders).toHaveLength(1)
    expect(phaseHeaders[0]).toMatchObject({ phase: phases[0] })
  })

  it('respects display_order for phases', () => {
    const phases = [
      makePhase('p2', 'surgical', 2),
      makePhase('p1', 'pre_op', 1), // Lower display_order, should appear first
    ]
    const milestones = [
      makeMilestone('m1', 'patient_in'),
      makeMilestone('m2', 'incision'),
    ]
    const items = [
      makeItem('i1', 't1', 'm1', 'p1', 1),
      makeItem('i2', 't1', 'm2', 'p2', 2),
    ]

    const result = buildTemplateRenderList(items, phases, milestones)

    const phaseHeaders = result.filter(r => r.type === 'phase-header')
    expect(phaseHeaders[0]).toMatchObject({ phase: phases[1] }) // p1 (display_order: 1)
    expect(phaseHeaders[1]).toMatchObject({ phase: phases[0] }) // p2 (display_order: 2)
  })

  it('respects display_order for template items', () => {
    const phases = [makePhase('p1', 'pre_op', 1)]
    const milestones = [
      makeMilestone('m1', 'timeout'),
      makeMilestone('m2', 'patient_in'),
    ]
    const items = [
      makeItem('i1', 't1', 'm1', 'p1', 2), // Higher display_order
      makeItem('i2', 't1', 'm2', 'p1', 1), // Lower display_order, should appear first
    ]

    const result = buildTemplateRenderList(items, phases, milestones)

    const edgeMilestones = result.filter(r => r.type === 'edge-milestone')
    expect(edgeMilestones[0]).toMatchObject({ milestone: milestones[1], edge: 'start' }) // m2 (patient_in)
    expect(edgeMilestones[1]).toMatchObject({ milestone: milestones[0], edge: 'end' }) // m1 (timeout)
  })

  it('drops milestones with missing lookups', () => {
    const phases = [makePhase('p1', 'pre_op', 1)]
    const milestones = [makeMilestone('m1', 'patient_in')]
    const items = [
      makeItem('i1', 't1', 'm1', 'p1', 1),
      makeItem('i2', 't1', 'm999', 'p1', 2), // milestone not in lookup
    ]

    const result = buildTemplateRenderList(items, phases, milestones)

    // Should only render m1, m999 is dropped
    expect(result.filter(r => r.type === 'edge-milestone' || r.type === 'interior-milestone')).toHaveLength(1)
  })

  it('moves items with invalid phase_id to unassigned section', () => {
    const phases = [makePhase('p1', 'pre_op', 1)]
    const milestones = [
      makeMilestone('m1', 'patient_in'),
      makeMilestone('m2', 'incision'),
    ]
    const items = [
      makeItem('i1', 't1', 'm1', 'p1', 1),
      makeItem('i2', 't1', 'm2', 'p999', 2), // phase not found
    ]

    const result = buildTemplateRenderList(items, phases, milestones)

    const unassignedHeader = result.find(r => r.type === 'unassigned-header')
    expect(unassignedHeader).toMatchObject({ count: 1 })

    const unassignedMilestones = result.filter(r => r.type === 'unassigned-milestone')
    expect(unassignedMilestones).toHaveLength(1)
    expect(unassignedMilestones[0]).toMatchObject({ milestone: milestones[1] })
  })

  it('includes drop zones for each phase', () => {
    const phases = [
      makePhase('p1', 'pre_op', 1),
      makePhase('p2', 'surgical', 2),
    ]
    const milestones = [
      makeMilestone('m1', 'patient_in'),
      makeMilestone('m2', 'incision'),
    ]
    const items = [
      makeItem('i1', 't1', 'm1', 'p1', 1),
      makeItem('i2', 't1', 'm2', 'p2', 2),
    ]

    const result = buildTemplateRenderList(items, phases, milestones)

    const dropZones = result.filter(r => r.type === 'drop-zone')
    expect(dropZones).toHaveLength(2)
    expect(dropZones[0]).toMatchObject({ phaseId: 'p1', phaseName: 'Pre Op' })
    expect(dropZones[1]).toMatchObject({ phaseId: 'p2', phaseName: 'Surgical' })
  })

  it('resolves color keys for phases', () => {
    const phases = [
      makePhase('p1', 'pre_op', 1, 'blue'),
      makePhase('p2', 'surgical', 2, 'green'),
    ]
    const milestones = [
      makeMilestone('m1', 'patient_in'),
      makeMilestone('m2', 'incision'),
    ]
    const items = [
      makeItem('i1', 't1', 'm1', 'p1', 1),
      makeItem('i2', 't1', 'm2', 'p2', 2),
    ]

    const result = buildTemplateRenderList(items, phases, milestones)

    const phaseHeaders = result.filter(r => r.type === 'phase-header')
    expect(phaseHeaders[0]).toHaveProperty('color')
    expect(phaseHeaders[0].color).toHaveProperty('label') // resolveColorKey returns ColorKeyConfig
    expect(phaseHeaders[1]).toHaveProperty('color')
  })

  it('complex scenario: 3 phases, 2 shared boundaries, 1 sub-phase, unassigned milestones', () => {
    const phases = [
      makePhase('p1', 'pre_op', 1, 'blue'),
      makePhase('p2', 'surgical', 2, 'green'),
      makePhase('p2_sub', 'closure', 3, 'amber'),
      makePhase('p3', 'post_op', 4, 'purple'),
    ]
    const milestones = [
      makeMilestone('m1', 'patient_in'),
      makeMilestone('m2', 'incision'), // shared: p1-end, p2-start
      makeMilestone('m3', 'suture_start'),
      makeMilestone('m4', 'suture_end'),
      makeMilestone('m5', 'patient_out'), // shared: p2-end, p3-start
      makeMilestone('m6', 'room_clean'),
      makeMilestone('m7', 'orphan'), // unassigned
    ]
    const items = [
      makeItem('i1', 't1', 'm1', 'p1', 1),
      makeItem('i2', 't1', 'm2', 'p1', 2), // end of p1
      makeItem('i3', 't1', 'm2', 'p2', 3), // start of p2
      makeItem('i4', 't1', 'm3', 'p2', 4),
      makeItem('i5', 't1', 'm4', 'p2', 5),
      makeItem('i6', 't1', 'm5', 'p2', 6), // end of p2
      makeItem('i7', 't1', 'm5', 'p3', 7), // start of p3
      makeItem('i8', 't1', 'm6', 'p3', 8),
      makeItem('i9', 't1', 'm3', 'p2_sub', 9), // sub-phase
      makeItem('i10', 't1', 'm4', 'p2_sub', 10), // sub-phase
      makeItem('i11', 't1', 'm7', null, 11), // unassigned
    ]

    // Sub-phase relationship via subPhaseMap
    const result = buildTemplateRenderList(items, phases, milestones, undefined, { p2_sub: 'p2' })

    // Verify phase headers
    const phaseHeaders = result.filter(r => r.type === 'phase-header')
    expect(phaseHeaders).toHaveLength(3) // p1, p2, p3 (p2_sub is rendered as sub-phase, not header)
    expect(phaseHeaders.map(h => h.phase.id)).toEqual(['p1', 'p2', 'p3'])

    // Verify boundary connectors
    const boundaryConnectors = result.filter(r => r.type === 'boundary-connector')
    expect(boundaryConnectors).toHaveLength(2)
    expect(boundaryConnectors[0]).toMatchObject({
      milestoneName: 'Incision', // m2
      endsPhase: phases[0], // p1
      startsPhase: phases[1], // p2
    })
    expect(boundaryConnectors[1]).toMatchObject({
      milestoneName: 'Patient Out', // m5
      endsPhase: phases[1], // p2
      startsPhase: phases[3], // p3
    })

    // Verify sub-phase
    const subPhases = result.filter(r => r.type === 'sub-phase')
    expect(subPhases).toHaveLength(1)
    expect(subPhases[0]).toMatchObject({
      phase: phases[2], // p2_sub
      parentPhase: phases[1], // p2
      milestones: [
        { milestone: milestones[2] }, // m3
        { milestone: milestones[3] }, // m4
      ],
    })

    // Verify unassigned section
    const unassignedHeader = result.find(r => r.type === 'unassigned-header')
    expect(unassignedHeader).toMatchObject({ count: 1 })
    const unassignedMilestones = result.filter(r => r.type === 'unassigned-milestone')
    expect(unassignedMilestones).toHaveLength(1)
    expect(unassignedMilestones[0]).toMatchObject({ milestone: milestones[6] }) // m7

    // Verify drop zones
    const dropZones = result.filter(r => r.type === 'drop-zone')
    expect(dropZones).toHaveLength(3) // one per top-level phase
  })

  describe('subPhaseMap parameter', () => {
    it('same phase renders as top-level when not in subPhaseMap', () => {
      const phases = [
        makePhase('p1', 'surgical', 1, 'green'),
        makePhase('p1_sub', 'closure', 2, 'amber'),
      ]
      const milestones = [
        makeMilestone('m1', 'incision'),
        makeMilestone('m2', 'suture'),
      ]
      const items = [
        makeItem('i1', 't1', 'm1', 'p1', 1),
        makeItem('i2', 't1', 'm2', 'p1_sub', 2),
      ]

      // No subPhaseMap → p1_sub is treated as a top-level phase
      const result = buildTemplateRenderList(items, phases, milestones)

      const phaseHeaders = result.filter(r => r.type === 'phase-header')
      expect(phaseHeaders).toHaveLength(2) // both p1 and p1_sub as top-level
      expect(phaseHeaders.map(h => h.phase.id)).toEqual(['p1', 'p1_sub'])
    })

    it('same phase renders as sub-phase when in subPhaseMap', () => {
      const phases = [
        makePhase('p1', 'surgical', 1, 'green'),
        makePhase('p1_sub', 'closure', 2, 'amber'),
      ]
      const milestones = [
        makeMilestone('m1', 'incision'),
        makeMilestone('m2', 'suture'),
      ]
      const items = [
        makeItem('i1', 't1', 'm1', 'p1', 1),
        makeItem('i2', 't1', 'm2', 'p1', 2),
        makeItem('i3', 't1', 'm2', 'p1_sub', 3),
      ]

      // With subPhaseMap → p1_sub is nested under p1
      const result = buildTemplateRenderList(items, phases, milestones, undefined, { p1_sub: 'p1' })

      const phaseHeaders = result.filter(r => r.type === 'phase-header')
      expect(phaseHeaders).toHaveLength(1) // only p1 as top-level
      expect(phaseHeaders[0]).toMatchObject({ phase: phases[0] })

      const subPhases = result.filter(r => r.type === 'sub-phase')
      expect(subPhases).toHaveLength(1)
      expect(subPhases[0]).toMatchObject({
        phase: phases[1],
        parentPhase: phases[0],
      })
    })

    it('ignores parent_phase_id on phase objects (only uses subPhaseMap)', () => {
      const phases = [
        makePhase('p1', 'surgical', 1, 'green'),
        makePhase('p1_sub', 'closure', 2, 'amber', 'p1'), // has parent_phase_id but no subPhaseMap
      ]
      const milestones = [
        makeMilestone('m1', 'incision'),
        makeMilestone('m2', 'suture'),
      ]
      const items = [
        makeItem('i1', 't1', 'm1', 'p1', 1),
        makeItem('i2', 't1', 'm2', 'p1_sub', 2),
      ]

      // No subPhaseMap → parent_phase_id on phase is ignored
      const result = buildTemplateRenderList(items, phases, milestones)

      const phaseHeaders = result.filter(r => r.type === 'phase-header')
      expect(phaseHeaders).toHaveLength(2) // both top-level despite parent_phase_id
    })
  })

  describe('emptyPhaseIds parameter', () => {
    it('renders empty phase header + drop zone when phase has no items', () => {
      const phases = [
        makePhase('p1', 'pre_op', 1, 'blue'),
        makePhase('p2', 'surgical', 2, 'green'),
      ]
      const milestones = [makeMilestone('m1', 'patient_in')]
      const items = [makeItem('i1', 't1', 'm1', 'p1', 1)]

      const result = buildTemplateRenderList(items, phases, milestones, new Set(['p2']))

      // p1 has items, p2 is empty but should render because it's in emptyPhaseIds
      const phaseHeaders = result.filter(r => r.type === 'phase-header')
      expect(phaseHeaders).toHaveLength(2)
      expect(phaseHeaders.map(h => h.phase.id)).toEqual(['p1', 'p2'])

      // p2 should have a drop zone
      const dropZones = result.filter(r => r.type === 'drop-zone')
      expect(dropZones).toHaveLength(2)
      expect(dropZones[1]).toMatchObject({ phaseId: 'p2', phaseName: 'Surgical' })

      // p2 header should show itemCount: 0
      const p2Header = phaseHeaders.find(h => h.phase.id === 'p2')
      expect(p2Header).toMatchObject({ itemCount: 0 })
    })

    it('does not duplicate phase if it already has items', () => {
      const phases = [makePhase('p1', 'pre_op', 1, 'blue')]
      const milestones = [makeMilestone('m1', 'patient_in')]
      const items = [makeItem('i1', 't1', 'm1', 'p1', 1)]

      // p1 is in emptyPhaseIds but also has items
      const result = buildTemplateRenderList(items, phases, milestones, new Set(['p1']))

      const phaseHeaders = result.filter(r => r.type === 'phase-header')
      expect(phaseHeaders).toHaveLength(1) // only one p1 header
      expect(phaseHeaders[0]).toMatchObject({ itemCount: 1 }) // shows correct count from items
    })

    it('skips sub-phases in emptyPhaseIds (only renders top-level phases)', () => {
      const phases = [
        makePhase('p1', 'surgical', 1, 'green'),
        makePhase('p1_sub', 'closure', 2, 'amber'),
      ]
      const milestones: MilestoneLookup[] = []
      const items: TemplateItemData[] = []

      // p1_sub is a sub-phase via subPhaseMap
      const result = buildTemplateRenderList(items, phases, milestones, new Set(['p1', 'p1_sub']), { p1_sub: 'p1' })

      // Only p1 should render (p1_sub is a sub-phase via subPhaseMap so it's skipped)
      const phaseHeaders = result.filter(r => r.type === 'phase-header')
      expect(phaseHeaders).toHaveLength(1)
      expect(phaseHeaders[0]).toMatchObject({ phase: phases[0] })
    })

    it('skips phases in emptyPhaseIds that do not exist in phases lookup', () => {
      const phases = [makePhase('p1', 'pre_op', 1, 'blue')]
      const milestones: MilestoneLookup[] = []
      const items: TemplateItemData[] = []

      const result = buildTemplateRenderList(items, phases, milestones, new Set(['p1', 'p999']))

      // p999 does not exist in phases, so only p1 should render
      const phaseHeaders = result.filter(r => r.type === 'phase-header')
      expect(phaseHeaders).toHaveLength(1)
      expect(phaseHeaders[0]).toMatchObject({ phase: phases[0] })
    })

    it('renders multiple empty phases in order', () => {
      const phases = [
        makePhase('p1', 'pre_op', 1, 'blue'),
        makePhase('p2', 'surgical', 2, 'green'),
        makePhase('p3', 'post_op', 3, 'purple'),
      ]
      const milestones: MilestoneLookup[] = []
      const items: TemplateItemData[] = []

      const result = buildTemplateRenderList(items, phases, milestones, new Set(['p1', 'p3']))

      // p1 and p3 should render as empty (p2 not in emptyPhaseIds)
      const phaseHeaders = result.filter(r => r.type === 'phase-header')
      expect(phaseHeaders).toHaveLength(2)
      expect(phaseHeaders.map(h => h.phase.id)).toEqual(['p1', 'p3'])
    })

    it('works when emptyPhaseIds is undefined (backwards compatible)', () => {
      const phases = [makePhase('p1', 'pre_op', 1, 'blue')]
      const milestones = [makeMilestone('m1', 'patient_in')]
      const items = [makeItem('i1', 't1', 'm1', 'p1', 1)]

      const result = buildTemplateRenderList(items, phases, milestones)

      // Should work exactly as before — only phases with items render
      const phaseHeaders = result.filter(r => r.type === 'phase-header')
      expect(phaseHeaders).toHaveLength(1)
    })

    it('works when emptyPhaseIds is empty set', () => {
      const phases = [makePhase('p1', 'pre_op', 1, 'blue')]
      const milestones = [makeMilestone('m1', 'patient_in')]
      const items = [makeItem('i1', 't1', 'm1', 'p1', 1)]

      const result = buildTemplateRenderList(items, phases, milestones, new Set())

      const phaseHeaders = result.filter(r => r.type === 'phase-header')
      expect(phaseHeaders).toHaveLength(1)
    })
  })
})
