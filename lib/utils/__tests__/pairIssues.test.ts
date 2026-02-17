// lib/utils/__tests__/pairIssues.test.ts
import { describe, it, expect } from 'vitest'
import {
  detectPairIssues,
  countPairIssuesInPhase,
  type PairIssueMilestone,
} from '../pairIssues'

function ms(
  id: string,
  phase: string,
  pairGroup: string | null = null,
  pairPosition: 'start' | 'end' | null = null
): PairIssueMilestone {
  return {
    id,
    phase_group: phase,
    pair_with_id: null,
    pair_position: pairPosition,
    pair_group: pairGroup,
  }
}

describe('detectPairIssues', () => {
  it('returns empty object when no milestones', () => {
    expect(detectPairIssues([])).toEqual({})
  })

  it('returns empty object when no paired milestones', () => {
    const milestones = [
      ms('1', 'pre_op'),
      ms('2', 'pre_op'),
      ms('3', 'surgical'),
    ]
    expect(detectPairIssues(milestones)).toEqual({})
  })

  it('returns empty object for a valid pair in same phase with correct order', () => {
    const milestones = [
      ms('1', 'pre_op', 'anesthesia', 'start'),
      ms('2', 'pre_op'),
      ms('3', 'pre_op', 'anesthesia', 'end'),
    ]
    expect(detectPairIssues(milestones)).toEqual({})
  })

  it('detects pair split across phases', () => {
    const milestones = [
      ms('1', 'pre_op', 'anesthesia', 'start'),
      ms('2', 'surgical', 'anesthesia', 'end'),
    ]
    const issues = detectPairIssues(milestones)
    expect(issues).toHaveProperty('anesthesia')
    expect(issues.anesthesia).toBe('split across phases')
  })

  it('detects END before START in display order', () => {
    const milestones = [
      ms('1', 'pre_op', 'anesthesia', 'end'),
      ms('2', 'pre_op'),
      ms('3', 'pre_op', 'anesthesia', 'start'),
    ]
    const issues = detectPairIssues(milestones)
    expect(issues).toHaveProperty('anesthesia')
    expect(issues.anesthesia).toBe('END before START')
  })

  it('prioritizes split-phase issue over wrong-order issue', () => {
    // If split across phases, we report that rather than order
    const milestones = [
      ms('1', 'surgical', 'anesthesia', 'end'),
      ms('2', 'pre_op', 'anesthesia', 'start'),
    ]
    const issues = detectPairIssues(milestones)
    expect(issues.anesthesia).toBe('split across phases')
  })

  it('handles multiple pair groups — some valid, some invalid', () => {
    const milestones = [
      ms('1', 'pre_op', 'anesthesia', 'start'),
      ms('2', 'pre_op', 'anesthesia', 'end'),
      ms('3', 'pre_op', 'prep', 'end'),
      ms('4', 'pre_op', 'prep', 'start'),
    ]
    const issues = detectPairIssues(milestones)
    expect(issues).not.toHaveProperty('anesthesia')
    expect(issues).toHaveProperty('prep')
    expect(issues.prep).toBe('END before START')
  })

  it('ignores incomplete pairs (only START, no END)', () => {
    const milestones = [
      ms('1', 'pre_op', 'anesthesia', 'start'),
      ms('2', 'pre_op'),
    ]
    expect(detectPairIssues(milestones)).toEqual({})
  })

  it('ignores incomplete pairs (only END, no START)', () => {
    const milestones = [
      ms('1', 'pre_op'),
      ms('2', 'pre_op', 'anesthesia', 'end'),
    ]
    expect(detectPairIssues(milestones)).toEqual({})
  })

  it('handles 3+ overlapping pair groups', () => {
    const milestones = [
      ms('1', 'pre_op', 'outer', 'start'),
      ms('2', 'pre_op', 'middle', 'start'),
      ms('3', 'pre_op', 'inner', 'start'),
      ms('4', 'pre_op', 'inner', 'end'),
      ms('5', 'pre_op', 'middle', 'end'),
      ms('6', 'pre_op', 'outer', 'end'),
    ]
    expect(detectPairIssues(milestones)).toEqual({})
  })
})

describe('countPairIssuesInPhase', () => {
  it('returns 0 when no issues', () => {
    const milestones = [ms('1', 'pre_op', 'anesthesia', 'start')]
    expect(countPairIssuesInPhase(milestones, {}, 'pre_op')).toBe(0)
  })

  it('counts issues for pairs in the specified phase', () => {
    const milestones = [
      ms('1', 'pre_op', 'anesthesia', 'start'),
      ms('2', 'pre_op', 'anesthesia', 'end'),
      ms('3', 'pre_op', 'prep', 'end'),
      ms('4', 'pre_op', 'prep', 'start'),
    ]
    const issues = { prep: 'END before START' }
    expect(countPairIssuesInPhase(milestones, issues, 'pre_op')).toBe(1)
  })

  it('does not count issues from other phases', () => {
    const milestones = [
      ms('1', 'pre_op', 'anesthesia', 'start'),
      ms('2', 'surgical', 'anesthesia', 'end'),
    ]
    const issues = { anesthesia: 'split across phases' }
    // The anesthesia pair has milestones in both phases
    expect(countPairIssuesInPhase(milestones, issues, 'pre_op')).toBe(1)
    expect(countPairIssuesInPhase(milestones, issues, 'surgical')).toBe(1)
    // But not in closing
    expect(countPairIssuesInPhase(milestones, issues, 'closing')).toBe(0)
  })

  it('counts multiple issues in one phase', () => {
    const milestones = [
      ms('1', 'pre_op', 'a', 'end'),
      ms('2', 'pre_op', 'a', 'start'),
      ms('3', 'pre_op', 'b', 'end'),
      ms('4', 'pre_op', 'b', 'start'),
    ]
    const issues = { a: 'END before START', b: 'END before START' }
    expect(countPairIssuesInPhase(milestones, issues, 'pre_op')).toBe(2)
  })
})
