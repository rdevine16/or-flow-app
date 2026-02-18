// lib/utils/__tests__/buildFlatRows.test.ts
import { describe, it, expect } from 'vitest'
import {
  buildFlatRows,
  type FlatRowMilestone,
  type PhaseDefWithBoundaries,
} from '../buildFlatRows'
import { buildPhaseTree } from '@/lib/milestone-phase-config'

// ─── Test helpers ────────────────────────────────────────

function makePhaseDef(
  id: string,
  name: string,
  displayOrder: number,
  colorKey: string,
  startMsId: string,
  endMsId: string,
  parentPhaseId: string | null = null,
): PhaseDefWithBoundaries {
  return {
    id,
    name,
    display_name: name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    display_order: displayOrder,
    color_key: colorKey,
    start_milestone_id: startMsId,
    end_milestone_id: endMsId,
    parent_phase_id: parentPhaseId,
  }
}

function makeMs(
  id: string,
  name: string,
  displayOrder: number,
  phaseGroup: string | null = null,
  pairWithId: string | null = null,
  pairPosition: 'start' | 'end' | null = null,
): FlatRowMilestone {
  return {
    id,
    display_name: name,
    display_order: displayOrder,
    phase_group: phaseGroup,
    pair_with_id: pairWithId,
    pair_position: pairPosition,
    min_minutes: null,
    max_minutes: null,
  }
}

function buildHelpers(milestones: FlatRowMilestone[]) {
  const milestoneById = new Map<string, FlatRowMilestone>()
  for (const m of milestones) milestoneById.set(m.id, m)

  const pairGroupMap = new Map<string, string>()
  for (const m of milestones) {
    if (!m.pair_with_id || !m.pair_position) continue
    if (m.pair_position === 'start') pairGroupMap.set(m.id, m.id)
    else if (m.pair_position === 'end') pairGroupMap.set(m.id, m.pair_with_id)
  }

  return { milestoneById, pairGroupMap }
}

// ─── Standard test fixture ──────────────────────────────

const PHASES: PhaseDefWithBoundaries[] = [
  makePhaseDef('p1', 'pre_op', 0, 'blue', 'patient-in', 'incision'),
  makePhaseDef('p2', 'surgical', 1, 'green', 'incision', 'closing-start'),
  makePhaseDef('p3', 'closing', 2, 'amber', 'closing-start', 'patient-out'),
  makePhaseDef('p4', 'post_op', 3, 'purple', 'patient-out', 'room-cleaned'),
]

const MILESTONES: FlatRowMilestone[] = [
  makeMs('patient-in', 'Patient In Room', 1, 'pre_op'),
  makeMs('anesth-start', 'Anesthesia Start', 2, 'pre_op', 'anesth-end', 'start'),
  makeMs('anesth-end', 'Anesthesia End', 3, 'pre_op', 'anesth-start', 'end'),
  makeMs('timeout', 'Timeout', 4, 'pre_op'),
  makeMs('incision', 'Incision', 5, 'surgical'),
  makeMs('step-a', 'Surgical Step A', 6, 'surgical'),
  makeMs('closing-start', 'Closing Start', 7, 'closing'),
  makeMs('closing-end', 'Closing Complete', 8, 'closing'),
  makeMs('patient-out', 'Patient Out', 9, 'post_op'),
  makeMs('room-cleaned', 'Room Cleaned', 10, 'post_op'),
]

// ─── Tests ──────────────────────────────────────────────

describe('buildFlatRows', () => {
  it('produces the correct number of rows', () => {
    const tree = buildPhaseTree(PHASES)
    const { milestoneById, pairGroupMap } = buildHelpers(MILESTONES)

    const { rows } = buildFlatRows(tree, MILESTONES, pairGroupMap, milestoneById)

    // 4 boundaries (patient-in, incision, closing-start shared, patient-out shared, room-cleaned)
    // Actually: patient-in (start of pre_op), incision (shared: end of pre_op + start of surgical),
    // closing-start (shared: end of surgical + start of closing),
    // patient-out (shared: end of closing + start of post_op), room-cleaned (end of post_op)
    // Non-boundary: anesth-start, anesth-end, timeout, step-a, closing-end
    // Total: 5 boundaries + 5 non-boundary = 10
    expect(rows).toHaveLength(10)
  })

  it('orders rows correctly: boundary, phase milestones, boundary', () => {
    const tree = buildPhaseTree(PHASES)
    const { milestoneById, pairGroupMap } = buildHelpers(MILESTONES)

    const { rows } = buildFlatRows(tree, MILESTONES, pairGroupMap, milestoneById)
    const ids = rows.map(r => r.id)

    // Pre-Op section
    expect(ids[0]).toBe('patient-in')     // start boundary
    expect(ids[1]).toBe('anesth-start')   // non-boundary
    expect(ids[2]).toBe('anesth-end')     // non-boundary
    expect(ids[3]).toBe('timeout')        // non-boundary

    // Surgical section
    expect(ids[4]).toBe('incision')       // shared boundary (pre_op end + surgical start)
    expect(ids[5]).toBe('step-a')         // non-boundary

    // Closing section
    expect(ids[6]).toBe('closing-start')  // shared boundary
    expect(ids[7]).toBe('closing-end')    // non-boundary

    // Post-Op section
    expect(ids[8]).toBe('patient-out')    // shared boundary
    expect(ids[9]).toBe('room-cleaned')   // end boundary
  })

  it('marks boundary rows correctly', () => {
    const tree = buildPhaseTree(PHASES)
    const { milestoneById, pairGroupMap } = buildHelpers(MILESTONES)

    const { rows } = buildFlatRows(tree, MILESTONES, pairGroupMap, milestoneById)

    const boundaryIds = rows.filter(r => r.is_boundary).map(r => r.id)
    expect(boundaryIds).toContain('patient-in')
    expect(boundaryIds).toContain('incision')
    expect(boundaryIds).toContain('closing-start')
    expect(boundaryIds).toContain('patient-out')
    expect(boundaryIds).toContain('room-cleaned')

    const nonBoundaryIds = rows.filter(r => !r.is_boundary).map(r => r.id)
    expect(nonBoundaryIds).toContain('anesth-start')
    expect(nonBoundaryIds).toContain('timeout')
    expect(nonBoundaryIds).toContain('step-a')
    expect(nonBoundaryIds).toContain('closing-end')
  })

  it('marks shared boundaries as phase transitions', () => {
    const tree = buildPhaseTree(PHASES)
    const { milestoneById, pairGroupMap } = buildHelpers(MILESTONES)

    const { rows } = buildFlatRows(tree, MILESTONES, pairGroupMap, milestoneById)

    // Incision is shared between pre_op (end) and surgical (start)
    const incision = rows.find(r => r.id === 'incision')!
    expect(incision.isPhaseTransition).toBe(true)
    // transitionFromColor = pre_op (blue = #3B82F6)
    expect(incision.transitionFromColor).toBe('#3B82F6')
    // transitionToColor = surgical (green = #22C55E)
    expect(incision.transitionToColor).toBe('#22C55E')

    // Patient In is NOT a shared boundary (first phase's start)
    const patientIn = rows.find(r => r.id === 'patient-in')!
    expect(patientIn.isPhaseTransition).toBe(false)
  })

  it('assigns correct primaryColor per phase section', () => {
    const tree = buildPhaseTree(PHASES)
    const { milestoneById, pairGroupMap } = buildHelpers(MILESTONES)

    const { rows } = buildFlatRows(tree, MILESTONES, pairGroupMap, milestoneById)

    // Pre-Op milestones get blue
    const preOpRows = rows.filter(r => r.ownerPhaseKey === 'pre_op')
    for (const r of preOpRows) {
      if (!r.isPhaseTransition) {
        expect(r.primaryColor).toBe('#3B82F6')
      }
    }

    // Surgical milestones get green
    const surgRows = rows.filter(r => r.ownerPhaseKey === 'surgical')
    for (const r of surgRows) {
      if (!r.isPhaseTransition) {
        expect(r.primaryColor).toBe('#22C55E')
      }
    }
  })

  it('assigns phase tags to boundary milestones', () => {
    const tree = buildPhaseTree(PHASES)
    const { milestoneById, pairGroupMap } = buildHelpers(MILESTONES)

    const { rows } = buildFlatRows(tree, MILESTONES, pairGroupMap, milestoneById)

    // Patient In should have "Pre Op START" tag
    const patientIn = rows.find(r => r.id === 'patient-in')!
    expect(patientIn.phaseTags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Pre Op', action: 'start' }),
      ])
    )

    // Incision is both pre_op end and surgical start
    const incision = rows.find(r => r.id === 'incision')!
    expect(incision.phaseTags).toHaveLength(2)
    expect(incision.phaseTags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Pre Op', action: 'end' }),
        expect.objectContaining({ label: 'Surgical', action: 'start' }),
      ])
    )
  })

  it('assigns pair_group from pairGroupMap', () => {
    const tree = buildPhaseTree(PHASES)
    const { milestoneById, pairGroupMap } = buildHelpers(MILESTONES)

    const { rows } = buildFlatRows(tree, MILESTONES, pairGroupMap, milestoneById)

    const anesthStart = rows.find(r => r.id === 'anesth-start')!
    expect(anesthStart.pair_group).toBe('anesth-start')
    expect(anesthStart.pair_position).toBe('start')

    const anesthEnd = rows.find(r => r.id === 'anesth-end')!
    expect(anesthEnd.pair_group).toBe('anesth-start')
    expect(anesthEnd.pair_position).toBe('end')
  })

  it('places unphased milestones at the end', () => {
    const phases = [makePhaseDef('p1', 'pre_op', 0, 'blue', 'b1', 'b2')]
    const milestones = [
      makeMs('b1', 'Start', 1, 'pre_op'),
      makeMs('m1', 'Phased', 2, 'pre_op'),
      makeMs('b2', 'End', 3, 'pre_op'),
      makeMs('u1', 'Unphased One', 4, null),
      makeMs('u2', 'Unphased Two', 5, null),
    ]
    const tree = buildPhaseTree(phases)
    const { milestoneById, pairGroupMap } = buildHelpers(milestones)

    const { rows } = buildFlatRows(tree, milestones, pairGroupMap, milestoneById)
    const ids = rows.map(r => r.id)

    // Unphased should be at the end
    expect(ids[ids.length - 1]).toBe('u2')
    expect(ids[ids.length - 2]).toBe('u1')

    // Unphased rows get slate color
    const u1 = rows.find(r => r.id === 'u1')!
    expect(u1.primaryColor).toBe('#94A3B8')
    expect(u1.ownerPhaseKey).toBe('unphased')
  })

  it('respects configOrderMap for milestone sorting', () => {
    const phases = [makePhaseDef('p1', 'pre_op', 0, 'blue', 'b1', 'b2')]
    const milestones = [
      makeMs('b1', 'Start', 1, 'pre_op'),
      makeMs('m1', 'First by displayOrder', 2, 'pre_op'),
      makeMs('m2', 'Second by displayOrder', 3, 'pre_op'),
      makeMs('m3', 'Third by displayOrder', 4, 'pre_op'),
      makeMs('b2', 'End', 5, 'pre_op'),
    ]
    const tree = buildPhaseTree(phases)
    const { milestoneById, pairGroupMap } = buildHelpers(milestones)

    // Override order: m3 first, m1 second, m2 third
    const configOrderMap = new Map([
      ['m3', 1],
      ['m1', 2],
      ['m2', 3],
    ])

    const { rows } = buildFlatRows(tree, milestones, pairGroupMap, milestoneById, configOrderMap)
    const nonBoundary = rows.filter(r => !r.is_boundary)

    expect(nonBoundary[0].id).toBe('m3')
    expect(nonBoundary[1].id).toBe('m1')
    expect(nonBoundary[2].id).toBe('m2')
  })

  it('returns empty result for empty phase tree', () => {
    const milestones = [makeMs('m1', 'Standalone', 1, null)]
    const { milestoneById, pairGroupMap } = buildHelpers(milestones)

    const { rows, subPhaseRails, legendPhases } = buildFlatRows(
      [],
      milestones,
      pairGroupMap,
      milestoneById,
    )

    // All milestones are unphased
    expect(rows).toHaveLength(1)
    expect(rows[0].primaryColor).toBe('#94A3B8')
    expect(subPhaseRails).toHaveLength(0)
    expect(legendPhases).toHaveLength(0)
  })

  it('handles non-shared boundaries (different start/end milestones)', () => {
    // Two phases that do NOT share a boundary
    const phases = [
      makePhaseDef('p1', 'pre_op', 0, 'blue', 'start-1', 'end-1'),
      makePhaseDef('p2', 'surgical', 1, 'green', 'start-2', 'end-2'),
    ]
    const milestones = [
      makeMs('start-1', 'Pre-Op Start', 1, 'pre_op'),
      makeMs('m1', 'Step 1', 2, 'pre_op'),
      makeMs('end-1', 'Pre-Op End', 3, 'pre_op'),
      makeMs('start-2', 'Surgical Start', 4, 'surgical'),
      makeMs('m2', 'Step 2', 5, 'surgical'),
      makeMs('end-2', 'Surgical End', 6, 'surgical'),
    ]
    const tree = buildPhaseTree(phases)
    const { milestoneById, pairGroupMap } = buildHelpers(milestones)

    const { rows } = buildFlatRows(tree, milestones, pairGroupMap, milestoneById)
    const ids = rows.map(r => r.id)

    // Both start and end boundaries are emitted for each phase
    expect(ids).toEqual(['start-1', 'm1', 'end-1', 'start-2', 'm2', 'end-2'])

    // No transitions since boundaries aren't shared
    const transitions = rows.filter(r => r.isPhaseTransition)
    expect(transitions).toHaveLength(0)
  })

  it('builds legend from phase tree', () => {
    const tree = buildPhaseTree(PHASES)
    const { milestoneById, pairGroupMap } = buildHelpers(MILESTONES)

    const { legendPhases } = buildFlatRows(tree, MILESTONES, pairGroupMap, milestoneById)

    expect(legendPhases).toHaveLength(4) // 4 top-level, no children
    expect(legendPhases[0]).toEqual(
      expect.objectContaining({ key: 'pre_op', depth: 0, color: '#3B82F6' })
    )
    expect(legendPhases[1]).toEqual(
      expect.objectContaining({ key: 'surgical', depth: 0, color: '#22C55E' })
    )
  })

  it('computes sub-phase rails for child phases', () => {
    const phases: PhaseDefWithBoundaries[] = [
      makePhaseDef('p1', 'pre_op', 0, 'blue', 'b-start', 'b-end'),
      makePhaseDef('c1', 'anesthesia', 0, 'indigo', 'anesth-s', 'anesth-e', 'p1'),
    ]
    const milestones = [
      makeMs('b-start', 'Start', 1, 'pre_op'),
      makeMs('anesth-s', 'Anesthesia Start', 2, 'anesthesia', 'anesth-e', 'start'),
      makeMs('mid', 'Mid Step', 3, 'anesthesia'),
      makeMs('anesth-e', 'Anesthesia End', 4, 'anesthesia', 'anesth-s', 'end'),
      makeMs('after', 'After Anesthesia', 5, 'pre_op'),
      makeMs('b-end', 'End', 6, 'pre_op'),
    ]
    const tree = buildPhaseTree(phases)
    const { milestoneById, pairGroupMap } = buildHelpers(milestones)

    const { rows, subPhaseRails, legendPhases } = buildFlatRows(
      tree,
      milestones,
      pairGroupMap,
      milestoneById,
    )

    // Sub-phase rail should span from anesth-s to anesth-e
    expect(subPhaseRails).toHaveLength(1)
    expect(subPhaseRails[0].phaseKey).toBe('anesthesia')

    const startIdx = rows.findIndex(r => r.id === 'anesth-s')
    const endIdx = rows.findIndex(r => r.id === 'anesth-e')
    expect(subPhaseRails[0].startRowIndex).toBe(startIdx)
    expect(subPhaseRails[0].endRowIndex).toBe(endIdx)

    // Legend should include child phase
    expect(legendPhases).toHaveLength(2)
    expect(legendPhases[1]).toEqual(
      expect.objectContaining({ key: 'anesthesia', depth: 1 })
    )
  })

  it('child phase milestones are non-boundary rows', () => {
    const phases: PhaseDefWithBoundaries[] = [
      makePhaseDef('p1', 'pre_op', 0, 'blue', 'b-start', 'b-end'),
      makePhaseDef('c1', 'anesthesia', 0, 'indigo', 'anesth-s', 'anesth-e', 'p1'),
    ]
    const milestones = [
      makeMs('b-start', 'Start', 1, 'pre_op'),
      makeMs('anesth-s', 'Anesthesia Start', 2, 'anesthesia'),
      makeMs('anesth-e', 'Anesthesia End', 3, 'anesthesia'),
      makeMs('b-end', 'End', 4, 'pre_op'),
    ]
    const tree = buildPhaseTree(phases)
    const { milestoneById, pairGroupMap } = buildHelpers(milestones)

    const { rows } = buildFlatRows(tree, milestones, pairGroupMap, milestoneById)

    // anesth-s and anesth-e are child phase start/end but NOT top-level boundaries
    const anesthS = rows.find(r => r.id === 'anesth-s')!
    const anesthE = rows.find(r => r.id === 'anesth-e')!
    expect(anesthS.is_boundary).toBe(false)
    expect(anesthE.is_boundary).toBe(false)

    // They should have phase tags though
    expect(anesthS.phaseTags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Anesthesia', action: 'start' }),
      ])
    )
    expect(anesthE.phaseTags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Anesthesia', action: 'end' }),
      ])
    )
  })

  it('does not duplicate rows for milestones', () => {
    const tree = buildPhaseTree(PHASES)
    const { milestoneById, pairGroupMap } = buildHelpers(MILESTONES)

    const { rows } = buildFlatRows(tree, MILESTONES, pairGroupMap, milestoneById)
    const ids = rows.map(r => r.id)
    const uniqueIds = new Set(ids)

    expect(ids.length).toBe(uniqueIds.size)
  })

  it('preserves interval data on rows', () => {
    const phases = [makePhaseDef('p1', 'pre_op', 0, 'blue', 'b1', 'b2')]
    const milestones: FlatRowMilestone[] = [
      { ...makeMs('b1', 'Start', 1, 'pre_op'), min_minutes: 1, max_minutes: 90 },
      { ...makeMs('m1', 'Step', 2, 'pre_op'), min_minutes: 5, max_minutes: null },
      makeMs('b2', 'End', 3, 'pre_op'),
    ]
    const tree = buildPhaseTree(phases)
    const { milestoneById, pairGroupMap } = buildHelpers(milestones)

    const { rows } = buildFlatRows(tree, milestones, pairGroupMap, milestoneById)

    const b1 = rows.find(r => r.id === 'b1')!
    expect(b1.min_minutes).toBe(1)
    expect(b1.max_minutes).toBe(90)

    const m1 = rows.find(r => r.id === 'm1')!
    expect(m1.min_minutes).toBe(5)
    expect(m1.max_minutes).toBeNull()
  })
})
