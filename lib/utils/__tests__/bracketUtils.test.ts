// lib/utils/__tests__/bracketUtils.test.ts
import { describe, it, expect } from 'vitest'
import {
  computeBracketData,
  computeBracketAreaWidth,
} from '../bracketUtils'
import type { BracketMilestone } from '../bracketUtils'

function ms(pairGroup: string | null = null): BracketMilestone {
  return { pair_group: pairGroup }
}

// ─── Unit: computeBracketData ──────────────────────────────────────

describe('computeBracketData', () => {
  it('returns empty array for no milestones', () => {
    expect(computeBracketData([], {})).toEqual([])
  })

  it('returns empty array for unpaired milestones', () => {
    const milestones = [ms(), ms(), ms()]
    expect(computeBracketData(milestones, {})).toEqual([])
  })

  it('computes bracket for a single pair', () => {
    const milestones = [ms('anesthesia'), ms(), ms('anesthesia')]
    const brackets = computeBracketData(milestones, {})
    expect(brackets).toHaveLength(1)
    expect(brackets[0].group).toBe('anesthesia')
    expect(brackets[0].start).toBe(0)
    expect(brackets[0].end).toBe(2)
    expect(brackets[0].hasIssue).toBe(false)
    expect(brackets[0].lane).toBe(0)
  })

  it('assigns different lanes to overlapping pairs', () => {
    const milestones = [
      ms('outer'),
      ms('inner'),
      ms('inner'),
      ms('outer'),
    ]
    const brackets = computeBracketData(milestones, {})
    expect(brackets).toHaveLength(2)
    // Outer pair has larger span, gets lane 0
    const outer = brackets.find((b) => b.group === 'outer')!
    const inner = brackets.find((b) => b.group === 'inner')!
    expect(outer.lane).toBe(0)
    expect(inner.lane).toBe(1)
  })

  it('assigns same lane to non-overlapping pairs', () => {
    const milestones = [
      ms('first'),
      ms('first'),
      ms(),
      ms('second'),
      ms('second'),
    ]
    const brackets = computeBracketData(milestones, {})
    expect(brackets).toHaveLength(2)
    // Non-overlapping brackets can share lane 0
    expect(brackets[0].lane).toBe(0)
    expect(brackets[1].lane).toBe(0)
  })

  it('marks brackets with issues as hasIssue', () => {
    const milestones = [ms('bad-pair'), ms('bad-pair')]
    const issues = { 'bad-pair': 'END before START' }
    const brackets = computeBracketData(milestones, issues)
    expect(brackets[0].hasIssue).toBe(true)
  })

  it('handles 3 overlapping pairs with correct lane allocation', () => {
    const milestones = [
      ms('a'),
      ms('b'),
      ms('c'),
      ms('c'),
      ms('b'),
      ms('a'),
    ]
    const brackets = computeBracketData(milestones, {})
    expect(brackets).toHaveLength(3)
    // Each overlapping pair gets a different lane
    const lanes = new Set(brackets.map((b) => b.lane))
    expect(lanes.size).toBe(3)
  })

  it('ignores pair groups with only one milestone', () => {
    const milestones = [ms('incomplete'), ms()]
    const brackets = computeBracketData(milestones, {})
    expect(brackets).toHaveLength(0)
  })

  it('uses explicit pairColors when provided', () => {
    const milestones = [ms('anesthesia'), ms('anesthesia')]
    const customColors = {
      anesthesia: { dot: '#FF0000', bg: '#FFF0F0', border: '#FF8080' },
    }
    const brackets = computeBracketData(milestones, {}, customColors)
    expect(brackets[0].color.dot).toBe('#FF0000')
  })
})

// ─── Unit: computeBracketAreaWidth ─────────────────────────────────

describe('computeBracketAreaWidth', () => {
  it('returns 0 for no brackets', () => {
    expect(computeBracketAreaWidth([])).toBe(0)
  })

  it('returns correct width for 1 lane', () => {
    const brackets = [
      { group: 'a', start: 0, end: 2, color: { dot: '', bg: '', border: '' }, hasIssue: false, lane: 0 },
    ]
    // 1 lane * 14 + 4 = 18
    expect(computeBracketAreaWidth(brackets)).toBe(18)
  })

  it('returns correct width for 2 lanes', () => {
    const brackets = [
      { group: 'a', start: 0, end: 3, color: { dot: '', bg: '', border: '' }, hasIssue: false, lane: 0 },
      { group: 'b', start: 1, end: 2, color: { dot: '', bg: '', border: '' }, hasIssue: false, lane: 1 },
    ]
    // 2 lanes * 14 + 4 = 32
    expect(computeBracketAreaWidth(brackets)).toBe(32)
  })
})

// ─── Workflow: Pre-Op phase with paired milestones ─────────────────

describe('Workflow: Pre-Op phase bracket computation', () => {
  const preOpMilestones: BracketMilestone[] = [
    { pair_group: 'anesthesia' },
    { pair_group: 'anesthesia' },
    { pair_group: null },
    { pair_group: 'table-setup' },
    { pair_group: 'table-setup' },
    { pair_group: 'prep-drape' },
    { pair_group: 'prep-drape' },
    { pair_group: null },
  ]

  it('computes brackets matching reference Pre-Op structure', () => {
    const brackets = computeBracketData(preOpMilestones, {})

    // Should have 3 brackets: anesthesia, table-setup, prep-drape
    expect(brackets).toHaveLength(3)

    const groups = brackets.map((b) => b.group).sort()
    expect(groups).toEqual(['anesthesia', 'prep-drape', 'table-setup'])

    // Anesthesia: indices 0-1 (adjacent)
    const anes = brackets.find((b) => b.group === 'anesthesia')!
    expect(anes.start).toBe(0)
    expect(anes.end).toBe(1)

    // Table setup: indices 3-4 (adjacent)
    const table = brackets.find((b) => b.group === 'table-setup')!
    expect(table.start).toBe(3)
    expect(table.end).toBe(4)

    // Prep/drape: indices 5-6 (adjacent)
    const prep = brackets.find((b) => b.group === 'prep-drape')!
    expect(prep.start).toBe(5)
    expect(prep.end).toBe(6)
  })

  it('bracket area width accounts for non-overlapping pairs sharing lanes', () => {
    const brackets = computeBracketData(preOpMilestones, {})
    const width = computeBracketAreaWidth(brackets)
    // All 3 pairs are non-overlapping, so they share lane 0 → 1 lane * 14 + 4 = 18
    expect(width).toBe(18)
  })
})
