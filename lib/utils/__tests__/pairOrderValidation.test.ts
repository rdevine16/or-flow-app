// lib/utils/__tests__/pairOrderValidation.test.ts
import { describe, it, expect } from 'vitest'
import { detectPairOrderIssues } from '../pairOrderValidation'
import type {
  RenderItem,
  MilestoneLookup,
  TemplateItemData,
  PhaseLookup,
} from '../buildTemplateRenderList'
import { resolveColorKey } from '@/lib/milestone-phase-config'

// ─── Helpers ────────────────────────────────────────────────

function makeMs(
  id: string,
  name: string,
  pairWithId: string | null = null,
  pairPosition: 'start' | 'end' | null = null,
): MilestoneLookup {
  return { id, name, display_name: name, pair_with_id: pairWithId, pair_position: pairPosition }
}

function makeItem(id: string, msId: string, phaseId: string | null, order: number): TemplateItemData {
  return { id, template_id: 't1', facility_milestone_id: msId, facility_phase_id: phaseId, display_order: order }
}

const phase1: PhaseLookup = { id: 'p1', name: 'pre_op', display_name: 'Pre-Op', color_key: 'blue', display_order: 1, parent_phase_id: null }
const phase2: PhaseLookup = { id: 'p2', name: 'surgical', display_name: 'Surgical', color_key: 'green', display_order: 2, parent_phase_id: null }
const subPhase: PhaseLookup = { id: 'sp1', name: 'closure', display_name: 'Closure', color_key: 'amber', display_order: 1, parent_phase_id: 'p2' }
const color1 = resolveColorKey('blue')
const color2 = resolveColorKey('green')
const colorSp = resolveColorKey('amber')

// ─── Tests ──────────────────────────────────────────────────

describe('detectPairOrderIssues', () => {
  it('returns empty set when no milestones have pairs', () => {
    const ms1 = makeMs('m1', 'Patient In')
    const ms2 = makeMs('m2', 'Timeout')
    const item1 = makeItem('i1', 'm1', 'p1', 0)
    const item2 = makeItem('i2', 'm2', 'p1', 1)

    const renderList: RenderItem[] = [
      { type: 'edge-milestone', milestone: ms1, templateItem: item1, phase: phase1, color: color1, edge: 'start' },
      { type: 'edge-milestone', milestone: ms2, templateItem: item2, phase: phase1, color: color1, edge: 'end' },
    ]

    const result = detectPairOrderIssues(renderList, [ms1, ms2])
    expect(result.size).toBe(0)
  })

  it('returns empty set when pairs are in correct order (START before END)', () => {
    const msStart = makeMs('m1', 'Array Start', 'm2', 'start')
    const msEnd = makeMs('m2', 'Array End', 'm1', 'end')
    const item1 = makeItem('i1', 'm1', 'p1', 0)
    const item2 = makeItem('i2', 'm2', 'p1', 1)

    const renderList: RenderItem[] = [
      { type: 'edge-milestone', milestone: msStart, templateItem: item1, phase: phase1, color: color1, edge: 'start' },
      { type: 'edge-milestone', milestone: msEnd, templateItem: item2, phase: phase1, color: color1, edge: 'end' },
    ]

    const result = detectPairOrderIssues(renderList, [msStart, msEnd])
    expect(result.size).toBe(0)
  })

  it('flags both milestones when END appears before START in same phase', () => {
    const msStart = makeMs('m1', 'Array Start', 'm2', 'start')
    const msEnd = makeMs('m2', 'Array End', 'm1', 'end')
    const itemEnd = makeItem('i1', 'm2', 'p1', 0)
    const itemStart = makeItem('i2', 'm1', 'p1', 1)

    const renderList: RenderItem[] = [
      { type: 'edge-milestone', milestone: msEnd, templateItem: itemEnd, phase: phase1, color: color1, edge: 'start' },
      { type: 'edge-milestone', milestone: msStart, templateItem: itemStart, phase: phase1, color: color1, edge: 'end' },
    ]

    const result = detectPairOrderIssues(renderList, [msStart, msEnd])
    expect(result.size).toBe(2)
    expect(result.has('i1')).toBe(true) // END item
    expect(result.has('i2')).toBe(true) // START item
  })

  it('flags milestones when END appears before START across different phases', () => {
    const msStart = makeMs('m1', 'Array Start', 'm2', 'start')
    const msEnd = makeMs('m2', 'Array End', 'm1', 'end')
    const itemEnd = makeItem('i1', 'm2', 'p1', 0)
    const itemStart = makeItem('i2', 'm1', 'p2', 0)

    const renderList: RenderItem[] = [
      { type: 'edge-milestone', milestone: msEnd, templateItem: itemEnd, phase: phase1, color: color1, edge: 'start' },
      { type: 'edge-milestone', milestone: msStart, templateItem: itemStart, phase: phase2, color: color2, edge: 'start' },
    ]

    const result = detectPairOrderIssues(renderList, [msStart, msEnd])
    expect(result.size).toBe(2)
    expect(result.has('i1')).toBe(true)
    expect(result.has('i2')).toBe(true)
  })

  it('flags milestones when END is in parent phase and START is in sub-phase below', () => {
    const msEnd = makeMs('m2', 'Array End', 'm1', 'end')
    const msStart = makeMs('m1', 'Array Start', 'm2', 'start')
    const msOther = makeMs('m3', 'Filler')
    const itemEnd = makeItem('i1', 'm2', 'p2', 0)
    const itemOther = makeItem('i2', 'm3', 'p2', 1)
    const itemStart = makeItem('i3', 'm1', 'sp1', 0)

    const renderList: RenderItem[] = [
      { type: 'edge-milestone', milestone: msEnd, templateItem: itemEnd, phase: phase2, color: color2, edge: 'start' },
      { type: 'interior-milestone', milestone: msOther, templateItem: itemOther, phase: phase2, color: color2 },
      {
        type: 'sub-phase',
        phase: subPhase,
        parentPhase: phase2,
        color: colorSp,
        milestones: [{ milestone: msStart, templateItem: itemStart }],
      },
    ]

    const result = detectPairOrderIssues(renderList, [msStart, msEnd, msOther])
    expect(result.size).toBe(2)
    expect(result.has('i1')).toBe(true) // END
    expect(result.has('i3')).toBe(true) // START in sub-phase
  })

  it('only flags the out-of-order instance for shared boundaries', () => {
    const msStart = makeMs('m1', 'Incision', 'm2', 'start')
    const msEnd = makeMs('m2', 'Closure', 'm1', 'end')
    // Incision appears at position 0 (correct) and position 3 (after END at 2)
    const itemStart1 = makeItem('i1', 'm1', 'p1', 0)
    const itemEnd = makeItem('i2', 'm2', 'p1', 1)
    const itemStart2 = makeItem('i3', 'm1', 'p2', 0) // second instance in phase 2

    const renderList: RenderItem[] = [
      { type: 'edge-milestone', milestone: msStart, templateItem: itemStart1, phase: phase1, color: color1, edge: 'start' },
      { type: 'edge-milestone', milestone: msEnd, templateItem: itemEnd, phase: phase1, color: color1, edge: 'end' },
      { type: 'edge-milestone', milestone: msStart, templateItem: itemStart2, phase: phase2, color: color2, edge: 'start' },
    ]

    const result = detectPairOrderIssues(renderList, [msStart, msEnd])
    // i1 (START @ 0) vs i2 (END @ 1): 0 < 1 → OK
    // i3 (START @ 2) vs i2 (END @ 1): 2 > 1 → Issue: i3 and i2 flagged
    expect(result.has('i1')).toBe(false) // first START is OK
    expect(result.has('i2')).toBe(true)  // END is flagged (START after it)
    expect(result.has('i3')).toBe(true)  // second START after END
  })

  it('handles missing partner gracefully', () => {
    const msStart = makeMs('m1', 'Array Start', 'm_missing', 'start')
    const item1 = makeItem('i1', 'm1', 'p1', 0)

    const renderList: RenderItem[] = [
      { type: 'edge-milestone', milestone: msStart, templateItem: item1, phase: phase1, color: color1, edge: 'start' },
    ]

    const result = detectPairOrderIssues(renderList, [msStart])
    expect(result.size).toBe(0) // no crash, no false positives
  })

  it('ignores milestones with no pair data', () => {
    const ms1 = makeMs('m1', 'Patient In')
    const ms2 = makeMs('m2', 'Timeout')
    const ms3 = makeMs('m3', 'Incision')
    const item1 = makeItem('i1', 'm1', 'p1', 0)
    const item2 = makeItem('i2', 'm2', 'p1', 1)
    const item3 = makeItem('i3', 'm3', 'p1', 2)

    const renderList: RenderItem[] = [
      { type: 'edge-milestone', milestone: ms1, templateItem: item1, phase: phase1, color: color1, edge: 'start' },
      { type: 'interior-milestone', milestone: ms2, templateItem: item2, phase: phase1, color: color1 },
      { type: 'edge-milestone', milestone: ms3, templateItem: item3, phase: phase1, color: color1, edge: 'end' },
    ]

    const result = detectPairOrderIssues(renderList, [ms1, ms2, ms3])
    expect(result.size).toBe(0)
  })

  it('handles one-sided pair (START has pair_with_id but partner has no pair_position)', () => {
    const msStart = makeMs('m1', 'Array Start', 'm2', 'start')
    const msNoPos = makeMs('m2', 'Array End', 'm1', null) // missing pair_position
    const item1 = makeItem('i1', 'm2', 'p1', 0)
    const item2 = makeItem('i2', 'm1', 'p1', 1)

    const renderList: RenderItem[] = [
      { type: 'edge-milestone', milestone: msNoPos, templateItem: item1, phase: phase1, color: color1, edge: 'start' },
      { type: 'edge-milestone', milestone: msStart, templateItem: item2, phase: phase1, color: color1, edge: 'end' },
    ]

    const result = detectPairOrderIssues(renderList, [msStart, msNoPos])
    expect(result.size).toBe(0) // partner has no pair_position, skip
  })

  it('handles unassigned milestones in the render list', () => {
    const msStart = makeMs('m1', 'Array Start', 'm2', 'start')
    const msEnd = makeMs('m2', 'Array End', 'm1', 'end')
    const itemEnd = makeItem('i1', 'm2', null, 0)
    const itemStart = makeItem('i2', 'm1', null, 1)

    const renderList: RenderItem[] = [
      { type: 'unassigned-milestone', milestone: msEnd, templateItem: itemEnd },
      { type: 'unassigned-milestone', milestone: msStart, templateItem: itemStart },
    ]

    const result = detectPairOrderIssues(renderList, [msStart, msEnd])
    // END before START in unassigned → flagged
    expect(result.size).toBe(2)
    expect(result.has('i1')).toBe(true)
    expect(result.has('i2')).toBe(true)
  })

  it('returns empty set for empty render list', () => {
    const result = detectPairOrderIssues([], [])
    expect(result.size).toBe(0)
  })
})
