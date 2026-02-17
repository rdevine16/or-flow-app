// lib/__tests__/milestone-phase-config.test.ts
import { describe, it, expect } from 'vitest'
import {
  PHASE_ORDER,
  PHASE_CONFIG_MAP,
  UNASSIGNED_PHASE,
  buildPhaseTree,
  type PhaseDefLike,
} from '../milestone-phase-config'

describe('milestone-phase-config', () => {
  describe('PHASE_ORDER', () => {
    it('contains exactly 4 phases in the correct order', () => {
      expect(PHASE_ORDER.map((p) => p.key)).toEqual([
        'pre_op',
        'surgical',
        'closing',
        'post_op',
      ])
    })

    it('every phase has all required fields', () => {
      for (const phase of PHASE_ORDER) {
        expect(phase.key).toBeTruthy()
        expect(phase.label).toBeTruthy()
        expect(phase.accentBg).toMatch(/^bg-/)
        expect(phase.accentText).toMatch(/^text-/)
        expect(phase.headerBg).toMatch(/^bg-/)
        expect(phase.borderColor).toMatch(/^border-/)
        expect(phase.hex).toMatch(/^#[0-9A-Fa-f]{6}$/)
      }
    })

    it('has unique keys for each phase', () => {
      const keys = PHASE_ORDER.map((p) => p.key)
      expect(new Set(keys).size).toBe(keys.length)
    })

    it('has unique labels for each phase', () => {
      const labels = PHASE_ORDER.map((p) => p.label)
      expect(new Set(labels).size).toBe(labels.length)
    })
  })

  describe('PHASE_CONFIG_MAP', () => {
    it('maps all phase keys to their config', () => {
      expect(PHASE_CONFIG_MAP.pre_op.label).toBe('Pre-Op')
      expect(PHASE_CONFIG_MAP.surgical.label).toBe('Surgical')
      expect(PHASE_CONFIG_MAP.closing.label).toBe('Closing')
      expect(PHASE_CONFIG_MAP.post_op.label).toBe('Post-Op')
    })

    it('returns the same config objects as PHASE_ORDER', () => {
      for (const phase of PHASE_ORDER) {
        expect(PHASE_CONFIG_MAP[phase.key]).toBe(phase)
      }
    })
  })

  describe('UNASSIGNED_PHASE', () => {
    it('has label "Unassigned"', () => {
      expect(UNASSIGNED_PHASE.label).toBe('Unassigned')
    })

    it('uses slate colors', () => {
      expect(UNASSIGNED_PHASE.accentBg).toContain('slate')
      expect(UNASSIGNED_PHASE.headerBg).toContain('slate')
    })
  })

  describe('buildPhaseTree', () => {
    const makePhase = (
      id: string,
      name: string,
      displayOrder: number,
      parentId: string | null = null,
    ): PhaseDefLike => ({
      id,
      name,
      display_name: name,
      display_order: displayOrder,
      parent_phase_id: parentId,
    })

    it('returns empty array for empty input', () => {
      expect(buildPhaseTree([])).toEqual([])
    })

    it('returns all phases as top-level when no parents set', () => {
      const phases = [
        makePhase('1', 'pre_op', 1),
        makePhase('2', 'surgical', 2),
        makePhase('3', 'closing', 3),
      ]
      const tree = buildPhaseTree(phases)
      expect(tree).toHaveLength(3)
      expect(tree.map((n) => n.phase.name)).toEqual(['pre_op', 'surgical', 'closing'])
      expect(tree.every((n) => n.children.length === 0)).toBe(true)
    })

    it('nests child phases under their parent', () => {
      const phases = [
        makePhase('1', 'surgical', 1),
        makePhase('2', 'sub_a', 2, '1'),
        makePhase('3', 'sub_b', 3, '1'),
      ]
      const tree = buildPhaseTree(phases)
      expect(tree).toHaveLength(1)
      expect(tree[0].phase.name).toBe('surgical')
      expect(tree[0].children).toHaveLength(2)
      expect(tree[0].children[0].phase.name).toBe('sub_a')
      expect(tree[0].children[1].phase.name).toBe('sub_b')
    })

    it('sorts by display_order at each level', () => {
      const phases = [
        makePhase('3', 'closing', 3),
        makePhase('1', 'pre_op', 1),
        makePhase('2', 'surgical', 2),
        makePhase('5', 'sub_b', 5, '2'),
        makePhase('4', 'sub_a', 4, '2'),
      ]
      const tree = buildPhaseTree(phases)
      expect(tree.map((n) => n.phase.name)).toEqual(['pre_op', 'surgical', 'closing'])
      expect(tree[1].children.map((c) => c.phase.name)).toEqual(['sub_a', 'sub_b'])
    })

    it('children have empty children array (1-level only)', () => {
      const phases = [
        makePhase('1', 'parent', 1),
        makePhase('2', 'child', 2, '1'),
      ]
      const tree = buildPhaseTree(phases)
      expect(tree[0].children[0].children).toEqual([])
    })

    it('handles orphaned children (parent not in list)', () => {
      const phases = [
        makePhase('1', 'pre_op', 1),
        makePhase('2', 'orphan', 2, 'nonexistent'),
      ]
      const tree = buildPhaseTree(phases)
      // Only pre_op is top-level, orphan is not rendered
      expect(tree).toHaveLength(1)
      expect(tree[0].phase.name).toBe('pre_op')
    })

    it('handles multiple parents with children', () => {
      const phases = [
        makePhase('1', 'pre_op', 1),
        makePhase('2', 'surgical', 2),
        makePhase('3', 'child_a', 3, '1'),
        makePhase('4', 'child_b', 4, '2'),
      ]
      const tree = buildPhaseTree(phases)
      expect(tree).toHaveLength(2)
      expect(tree[0].children).toHaveLength(1)
      expect(tree[0].children[0].phase.name).toBe('child_a')
      expect(tree[1].children).toHaveLength(1)
      expect(tree[1].children[0].phase.name).toBe('child_b')
    })
  })
})
