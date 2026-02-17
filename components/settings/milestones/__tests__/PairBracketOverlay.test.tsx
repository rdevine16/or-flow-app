// components/settings/milestones/__tests__/PairBracketOverlay.test.tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import {
  PairBracketOverlay,
  computeBracketData,
  computeBracketAreaWidth,
} from '../PairBracketOverlay'
import type { PhaseBlockMilestone } from '../PhaseBlock'

function ms(
  id: string,
  pairGroup: string | null = null,
  pairPosition: 'start' | 'end' | null = null,
  pairWithId: string | null = null
): PhaseBlockMilestone {
  return {
    id,
    display_name: `Milestone ${id}`,
    phase_group: 'pre_op',
    is_boundary: false,
    pair_with_id: pairWithId,
    pair_position: pairPosition,
    pair_group: pairGroup,
    min_minutes: null,
    max_minutes: null,
  }
}

// ─── Unit: computeBracketData ──────────────────────────────────────

describe('computeBracketData', () => {
  it('returns empty array for no milestones', () => {
    expect(computeBracketData([], {})).toEqual([])
  })

  it('returns empty array for unpaired milestones', () => {
    const milestones = [ms('1'), ms('2'), ms('3')]
    expect(computeBracketData(milestones, {})).toEqual([])
  })

  it('computes bracket for a single pair', () => {
    const milestones = [
      ms('1', 'anesthesia', 'start', '2'),
      ms('2'),
      ms('3', 'anesthesia', 'end', '1'),
    ]
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
      ms('1', 'outer', 'start', '4'),
      ms('2', 'inner', 'start', '3'),
      ms('3', 'inner', 'end', '2'),
      ms('4', 'outer', 'end', '1'),
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
      ms('1', 'first', 'start', '2'),
      ms('2', 'first', 'end', '1'),
      ms('3'),
      ms('4', 'second', 'start', '5'),
      ms('5', 'second', 'end', '4'),
    ]
    const brackets = computeBracketData(milestones, {})
    expect(brackets).toHaveLength(2)
    // Non-overlapping brackets can share lane 0
    expect(brackets[0].lane).toBe(0)
    expect(brackets[1].lane).toBe(0)
  })

  it('marks brackets with issues as hasIssue', () => {
    const milestones = [
      ms('1', 'bad-pair', 'start', '2'),
      ms('2', 'bad-pair', 'end', '1'),
    ]
    const issues = { 'bad-pair': 'END before START' }
    const brackets = computeBracketData(milestones, issues)
    expect(brackets[0].hasIssue).toBe(true)
  })

  it('handles 3 overlapping pairs with correct lane allocation', () => {
    const milestones = [
      ms('1', 'a', 'start', '6'),
      ms('2', 'b', 'start', '5'),
      ms('3', 'c', 'start', '4'),
      ms('4', 'c', 'end', '3'),
      ms('5', 'b', 'end', '2'),
      ms('6', 'a', 'end', '1'),
    ]
    const brackets = computeBracketData(milestones, {})
    expect(brackets).toHaveLength(3)
    // Each overlapping pair gets a different lane
    const lanes = new Set(brackets.map((b) => b.lane))
    expect(lanes.size).toBe(3)
  })

  it('ignores pair groups with only one milestone', () => {
    const milestones = [
      ms('1', 'incomplete', 'start', '99'),
      ms('2'),
    ]
    const brackets = computeBracketData(milestones, {})
    expect(brackets).toHaveLength(0)
  })

  it('uses explicit pairColors when provided', () => {
    const milestones = [
      ms('1', 'anesthesia', 'start', '2'),
      ms('2', 'anesthesia', 'end', '1'),
    ]
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

// ─── Integration: PairBracketOverlay rendering ─────────────────────

describe('PairBracketOverlay', () => {
  it('renders nothing when no pairs exist', () => {
    const milestones = [ms('1'), ms('2')]
    const { container } = render(
      <PairBracketOverlay milestones={milestones} pairIssues={{}} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders SVG bracket for a valid pair', () => {
    const milestones = [
      ms('1', 'anesthesia', 'start', '3'),
      ms('2'),
      ms('3', 'anesthesia', 'end', '1'),
    ]
    const { container } = render(
      <PairBracketOverlay milestones={milestones} pairIssues={{}} />
    )

    // Should render an SVG with lines and circles
    const svgs = container.querySelectorAll('svg')
    expect(svgs.length).toBeGreaterThanOrEqual(1)

    // Should have lines (vertical bracket + 2 horizontal ticks)
    const lines = container.querySelectorAll('line')
    expect(lines.length).toBe(3)

    // Should have circles (2 endpoint dots + 1 middle dot for unpaired ms)
    const circles = container.querySelectorAll('circle')
    expect(circles.length).toBe(3) // start dot + end dot + middle indicator
  })

  it('renders red brackets for pairs with issues', () => {
    const milestones = [
      ms('1', 'bad', 'end', '2'),
      ms('2', 'bad', 'start', '1'),
    ]
    const issues = { bad: 'END before START' }
    const { container } = render(
      <PairBracketOverlay milestones={milestones} pairIssues={issues} />
    )

    // Check that the line uses the error color
    const lines = container.querySelectorAll('line')
    expect(lines[0].getAttribute('stroke')).toBe('#EF4444')
  })

  it('renders multiple brackets for multiple pairs', () => {
    const milestones = [
      ms('1', 'a', 'start', '2'),
      ms('2', 'a', 'end', '1'),
      ms('3', 'b', 'start', '4'),
      ms('4', 'b', 'end', '3'),
    ]
    const { container } = render(
      <PairBracketOverlay milestones={milestones} pairIssues={{}} />
    )

    const svgs = container.querySelectorAll('svg')
    expect(svgs.length).toBe(2)
  })
})

// ─── Workflow: Reference Pre-Op phase data ─────────────────────────

describe('Workflow: Pre-Op phase with paired milestones', () => {
  const preOpMilestones: PhaseBlockMilestone[] = [
    {
      id: 'anes-start',
      display_name: 'Anesthesia Start',
      phase_group: 'pre_op',
      is_boundary: false,
      pair_with_id: 'anes-end',
      pair_position: 'start',
      pair_group: 'anesthesia',
      min_minutes: null,
      max_minutes: null,
    },
    {
      id: 'anes-end',
      display_name: 'Anesthesia End',
      phase_group: 'pre_op',
      is_boundary: false,
      pair_with_id: 'anes-start',
      pair_position: 'end',
      pair_group: 'anesthesia',
      min_minutes: null,
      max_minutes: null,
    },
    {
      id: 'bed-prep',
      display_name: 'Bed Prep',
      phase_group: 'pre_op',
      is_boundary: false,
      pair_with_id: null,
      pair_position: null,
      pair_group: null,
      min_minutes: null,
      max_minutes: null,
    },
    {
      id: 'table-start',
      display_name: 'Table Setup Start',
      phase_group: 'pre_op',
      is_boundary: false,
      pair_with_id: 'table-end',
      pair_position: 'start',
      pair_group: 'table-setup',
      min_minutes: null,
      max_minutes: null,
    },
    {
      id: 'table-end',
      display_name: 'Table Setup Complete',
      phase_group: 'pre_op',
      is_boundary: false,
      pair_with_id: 'table-start',
      pair_position: 'end',
      pair_group: 'table-setup',
      min_minutes: null,
      max_minutes: null,
    },
    {
      id: 'prep-start',
      display_name: 'Prep/Drape Start',
      phase_group: 'pre_op',
      is_boundary: false,
      pair_with_id: 'prep-end',
      pair_position: 'start',
      pair_group: 'prep-drape',
      min_minutes: null,
      max_minutes: null,
    },
    {
      id: 'prep-end',
      display_name: 'Prep/Drape Complete',
      phase_group: 'pre_op',
      is_boundary: false,
      pair_with_id: 'prep-start',
      pair_position: 'end',
      pair_group: 'prep-drape',
      min_minutes: null,
      max_minutes: null,
    },
    {
      id: 'timeout',
      display_name: 'Timeout',
      phase_group: 'pre_op',
      is_boundary: false,
      pair_with_id: null,
      pair_position: null,
      pair_group: null,
      min_minutes: null,
      max_minutes: null,
    },
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

  it('renders correct number of SVG elements for Pre-Op', () => {
    const { container } = render(
      <PairBracketOverlay
        milestones={preOpMilestones}
        pairIssues={{}}
      />
    )

    // 3 pair groups = 3 SVGs
    const svgs = container.querySelectorAll('svg')
    expect(svgs.length).toBe(3)

    // Each bracket has: 1 vertical line + 2 horizontal ticks = 3 lines per bracket
    const lines = container.querySelectorAll('line')
    expect(lines.length).toBe(9) // 3 brackets × 3 lines
  })

  it('issue detection integrates with overlay coloring', () => {
    // Move prep-drape END before START (swap positions conceptually via issues)
    const issues = { 'prep-drape': 'END before START' }
    const { container } = render(
      <PairBracketOverlay
        milestones={preOpMilestones}
        pairIssues={issues}
      />
    )

    // Find SVGs and check that one uses the red error color
    const circles = container.querySelectorAll('circle')
    const redCircles = Array.from(circles).filter(
      (c) => c.getAttribute('fill') === '#EF4444'
    )
    expect(redCircles.length).toBeGreaterThan(0)
  })
})
