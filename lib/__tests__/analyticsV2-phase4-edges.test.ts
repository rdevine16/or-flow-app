/**
 * Phase 4 tests: computePhaseDurations edge cases and milestone ID resolution
 *
 * Verifies:
 * 1. computePhaseDurations handles empty phase definitions
 * 2. Missing milestones produce durationSeconds: null
 * 3. Invalid timestamps (NaN, empty strings) are safely handled
 * 4. Reversed timestamps (end before start) return null
 * 5. buildMilestoneTimestampMap filters out falsy recorded_at values
 * 6. Subphases with missing boundaries are filtered out in the caseBreakdown flow
 * 7. Cases with no milestones produce all-null durations
 * 8. Partial milestones produce correct mix of computed and null durations
 */
import { describe, it, expect } from 'vitest'
import {
  computePhaseDurations,
  buildMilestoneTimestampMap,
  type PhaseDefInput,
  type MilestoneTimestampMap,
} from '../analyticsV2'
import {
  buildPhaseTree,
  resolvePhaseHex,
  resolveSubphaseHex,
} from '../milestone-phase-config'

// ============================================
// HELPERS
// ============================================

function makePhaseDef(overrides: Partial<PhaseDefInput> & { id: string }): PhaseDefInput {
  return {
    name: 'test_phase',
    display_name: 'Test Phase',
    display_order: 1,
    color_key: 'blue',
    parent_phase_id: null,
    start_milestone_id: 'ms_start',
    end_milestone_id: 'ms_end',
    ...overrides,
  }
}

// ============================================
// computePhaseDurations — empty inputs
// ============================================

describe('computePhaseDurations empty inputs', () => {
  it('returns empty array for empty phase definitions', () => {
    const timestamps: MilestoneTimestampMap = new Map()
    const result = computePhaseDurations([], timestamps)
    expect(result).toEqual([])
  })

  it('returns empty array for empty phase definitions with populated timestamps', () => {
    const timestamps: MilestoneTimestampMap = new Map([
      ['ms_1', '2025-02-03T07:30:00Z'],
      ['ms_2', '2025-02-03T08:30:00Z'],
    ])
    const result = computePhaseDurations([], timestamps)
    expect(result).toEqual([])
  })
})

// ============================================
// computePhaseDurations — missing milestones
// ============================================

describe('computePhaseDurations missing milestones', () => {
  const phases: PhaseDefInput[] = [
    makePhaseDef({
      id: 'phase-1',
      name: 'pre_op',
      display_name: 'Pre-Op',
      display_order: 1,
      start_milestone_id: 'ms_patient_in',
      end_milestone_id: 'ms_incision',
    }),
    makePhaseDef({
      id: 'phase-2',
      name: 'surgical',
      display_name: 'Surgical',
      display_order: 2,
      start_milestone_id: 'ms_incision',
      end_milestone_id: 'ms_closing',
    }),
  ]

  it('returns null for phases where start milestone is missing', () => {
    const timestamps: MilestoneTimestampMap = new Map([
      // ms_patient_in is missing
      ['ms_incision', '2025-02-03T07:50:00Z'],
      ['ms_closing', '2025-02-03T09:00:00Z'],
    ])

    const result = computePhaseDurations(phases, timestamps)
    expect(result[0].durationSeconds).toBeNull() // Pre-Op: missing start
    expect(result[1].durationSeconds).toBe(4200)  // Surgical: 70 min = 4200 sec
  })

  it('returns null for phases where end milestone is missing', () => {
    const timestamps: MilestoneTimestampMap = new Map([
      ['ms_patient_in', '2025-02-03T07:30:00Z'],
      // ms_incision is missing — affects both Pre-Op (end) and Surgical (start)
    ])

    const result = computePhaseDurations(phases, timestamps)
    expect(result[0].durationSeconds).toBeNull() // Pre-Op: missing end
    expect(result[1].durationSeconds).toBeNull() // Surgical: missing start
  })

  it('returns all nulls for empty milestone map', () => {
    const timestamps: MilestoneTimestampMap = new Map()
    const result = computePhaseDurations(phases, timestamps)
    expect(result[0].durationSeconds).toBeNull()
    expect(result[1].durationSeconds).toBeNull()
  })
})

// ============================================
// computePhaseDurations — invalid timestamps
// ============================================

describe('computePhaseDurations invalid timestamps', () => {
  const phases: PhaseDefInput[] = [
    makePhaseDef({
      id: 'phase-1',
      start_milestone_id: 'ms_start',
      end_milestone_id: 'ms_end',
    }),
  ]

  it('returns null for invalid date strings (NaN)', () => {
    const timestamps: MilestoneTimestampMap = new Map([
      ['ms_start', 'not-a-date'],
      ['ms_end', '2025-02-03T08:00:00Z'],
    ])
    const result = computePhaseDurations(phases, timestamps)
    expect(result[0].durationSeconds).toBeNull()
  })

  it('returns null when both timestamps are invalid', () => {
    const timestamps: MilestoneTimestampMap = new Map([
      ['ms_start', 'garbage'],
      ['ms_end', 'also-garbage'],
    ])
    const result = computePhaseDurations(phases, timestamps)
    expect(result[0].durationSeconds).toBeNull()
  })

  it('returns null when end timestamp is invalid', () => {
    const timestamps: MilestoneTimestampMap = new Map([
      ['ms_start', '2025-02-03T07:30:00Z'],
      ['ms_end', 'invalid'],
    ])
    const result = computePhaseDurations(phases, timestamps)
    expect(result[0].durationSeconds).toBeNull()
  })
})

// ============================================
// computePhaseDurations — reversed timestamps
// ============================================

describe('computePhaseDurations reversed timestamps', () => {
  const phases: PhaseDefInput[] = [
    makePhaseDef({
      id: 'phase-1',
      start_milestone_id: 'ms_start',
      end_milestone_id: 'ms_end',
    }),
  ]

  it('returns null when end time is before start time', () => {
    const timestamps: MilestoneTimestampMap = new Map([
      ['ms_start', '2025-02-03T09:00:00Z'],
      ['ms_end', '2025-02-03T07:30:00Z'], // before start
    ])
    const result = computePhaseDurations(phases, timestamps)
    expect(result[0].durationSeconds).toBeNull()
  })

  it('returns null when start and end times are identical', () => {
    const timestamps: MilestoneTimestampMap = new Map([
      ['ms_start', '2025-02-03T07:30:00Z'],
      ['ms_end', '2025-02-03T07:30:00Z'], // same time
    ])
    const result = computePhaseDurations(phases, timestamps)
    expect(result[0].durationSeconds).toBeNull()
  })
})

// ============================================
// computePhaseDurations — correct computation
// ============================================

describe('computePhaseDurations correct computation', () => {
  it('computes duration correctly in seconds', () => {
    const phases: PhaseDefInput[] = [
      makePhaseDef({
        id: 'phase-1',
        start_milestone_id: 'ms_start',
        end_milestone_id: 'ms_end',
      }),
    ]
    const timestamps: MilestoneTimestampMap = new Map([
      ['ms_start', '2025-02-03T07:30:00Z'],
      ['ms_end', '2025-02-03T08:00:00Z'], // 30 min
    ])
    const result = computePhaseDurations(phases, timestamps)
    expect(result[0].durationSeconds).toBe(1800) // 30 * 60
  })

  it('sorts results by display_order', () => {
    const phases: PhaseDefInput[] = [
      makePhaseDef({ id: 'phase-b', display_order: 2, display_name: 'Second' }),
      makePhaseDef({ id: 'phase-a', display_order: 1, display_name: 'First' }),
      makePhaseDef({ id: 'phase-c', display_order: 3, display_name: 'Third' }),
    ]
    const timestamps: MilestoneTimestampMap = new Map()
    const result = computePhaseDurations(phases, timestamps)
    expect(result[0].displayName).toBe('First')
    expect(result[1].displayName).toBe('Second')
    expect(result[2].displayName).toBe('Third')
  })

  it('preserves parent/child metadata', () => {
    const phases: PhaseDefInput[] = [
      makePhaseDef({ id: 'parent', parent_phase_id: null, color_key: 'blue' }),
      makePhaseDef({ id: 'child', parent_phase_id: 'parent', color_key: 'teal', display_order: 2 }),
    ]
    const timestamps: MilestoneTimestampMap = new Map()
    const result = computePhaseDurations(phases, timestamps)
    expect(result[0].parentPhaseId).toBeNull()
    expect(result[1].parentPhaseId).toBe('parent')
  })
})

// ============================================
// computePhaseDurations — subphases
// ============================================

describe('computePhaseDurations subphases', () => {
  it('computes subphase duration independently of parent', () => {
    const phases: PhaseDefInput[] = [
      makePhaseDef({
        id: 'parent',
        display_order: 1,
        start_milestone_id: 'ms_patient_in',
        end_milestone_id: 'ms_incision',
      }),
      makePhaseDef({
        id: 'sub',
        display_order: 2,
        parent_phase_id: 'parent',
        start_milestone_id: 'ms_anesthesia_start',
        end_milestone_id: 'ms_anesthesia_end',
      }),
    ]

    const timestamps: MilestoneTimestampMap = new Map([
      ['ms_patient_in', '2025-02-03T07:30:00Z'],
      ['ms_incision', '2025-02-03T07:50:00Z'],
      ['ms_anesthesia_start', '2025-02-03T07:35:00Z'],
      ['ms_anesthesia_end', '2025-02-03T07:45:00Z'],
    ])

    const result = computePhaseDurations(phases, timestamps)
    expect(result[0].durationSeconds).toBe(1200) // parent: 20 min
    expect(result[1].durationSeconds).toBe(600)  // sub: 10 min
    expect(result[1].parentPhaseId).toBe('parent')
  })

  it('returns null for subphase when its milestones are missing (parent still computes)', () => {
    const phases: PhaseDefInput[] = [
      makePhaseDef({
        id: 'parent',
        display_order: 1,
        start_milestone_id: 'ms_patient_in',
        end_milestone_id: 'ms_incision',
      }),
      makePhaseDef({
        id: 'sub',
        display_order: 2,
        parent_phase_id: 'parent',
        start_milestone_id: 'ms_anesthesia_start',
        end_milestone_id: 'ms_anesthesia_end',
      }),
    ]

    const timestamps: MilestoneTimestampMap = new Map([
      ['ms_patient_in', '2025-02-03T07:30:00Z'],
      ['ms_incision', '2025-02-03T07:50:00Z'],
      // no anesthesia milestones
    ])

    const result = computePhaseDurations(phases, timestamps)
    expect(result[0].durationSeconds).toBe(1200) // parent: 20 min
    expect(result[1].durationSeconds).toBeNull()  // sub: missing
  })
})

// ============================================
// buildMilestoneTimestampMap — edge cases
// ============================================

describe('buildMilestoneTimestampMap edge cases', () => {
  it('returns empty map for empty input', () => {
    const result = buildMilestoneTimestampMap([])
    expect(result.size).toBe(0)
  })

  it('filters out falsy recorded_at values', () => {
    const result = buildMilestoneTimestampMap([
      { facility_milestone_id: 'ms_1', recorded_at: '2025-02-03T07:30:00Z' },
      { facility_milestone_id: 'ms_2', recorded_at: '' },
    ])
    expect(result.size).toBe(1)
    expect(result.has('ms_1')).toBe(true)
    expect(result.has('ms_2')).toBe(false)
  })

  it('handles duplicate facility_milestone_ids (last wins)', () => {
    const result = buildMilestoneTimestampMap([
      { facility_milestone_id: 'ms_1', recorded_at: '2025-02-03T07:30:00Z' },
      { facility_milestone_id: 'ms_1', recorded_at: '2025-02-03T08:00:00Z' },
    ])
    expect(result.size).toBe(1)
    expect(result.get('ms_1')).toBe('2025-02-03T08:00:00Z')
  })

  it('handles single milestone', () => {
    const result = buildMilestoneTimestampMap([
      { facility_milestone_id: 'ms_only', recorded_at: '2025-02-03T12:00:00Z' },
    ])
    expect(result.size).toBe(1)
    expect(result.get('ms_only')).toBe('2025-02-03T12:00:00Z')
  })
})

// ============================================
// Integration: partial milestone coverage
// ============================================

describe('integration: partial milestone coverage', () => {
  it('computes mixed results for a case with partial milestones', () => {
    const phases: PhaseDefInput[] = [
      makePhaseDef({
        id: 'pre_op',
        display_name: 'Pre-Op',
        display_order: 1,
        color_key: 'blue',
        start_milestone_id: 'ms_patient_in',
        end_milestone_id: 'ms_incision',
      }),
      makePhaseDef({
        id: 'surgical',
        display_name: 'Surgical',
        display_order: 2,
        color_key: 'green',
        start_milestone_id: 'ms_incision',
        end_milestone_id: 'ms_closing',
      }),
      makePhaseDef({
        id: 'closing',
        display_name: 'Closing',
        display_order: 3,
        color_key: 'amber',
        start_milestone_id: 'ms_closing',
        end_milestone_id: 'ms_patient_out',
      }),
      makePhaseDef({
        id: 'anes_sub',
        display_name: 'Anesthesia',
        display_order: 4,
        color_key: 'teal',
        parent_phase_id: 'pre_op',
        start_milestone_id: 'ms_anes_start',
        end_milestone_id: 'ms_anes_end',
      }),
    ]

    // Case that has patient_in, incision, and closing — but NOT patient_out or anesthesia
    const milestones = buildMilestoneTimestampMap([
      { facility_milestone_id: 'ms_patient_in', recorded_at: '2025-02-03T07:30:00Z' },
      { facility_milestone_id: 'ms_incision', recorded_at: '2025-02-03T07:50:00Z' },
      { facility_milestone_id: 'ms_closing', recorded_at: '2025-02-03T09:00:00Z' },
      // ms_patient_out missing
      // ms_anes_start, ms_anes_end missing
    ])

    const result = computePhaseDurations(phases, milestones)

    expect(result[0].displayName).toBe('Pre-Op')
    expect(result[0].durationSeconds).toBe(1200) // 20 min

    expect(result[1].displayName).toBe('Surgical')
    expect(result[1].durationSeconds).toBe(4200) // 70 min

    expect(result[2].displayName).toBe('Closing')
    expect(result[2].durationSeconds).toBeNull() // missing patient_out

    expect(result[3].displayName).toBe('Anesthesia')
    expect(result[3].durationSeconds).toBeNull() // missing anes milestones
    expect(result[3].parentPhaseId).toBe('pre_op')
  })
})

// ============================================
// Workflow: surgeon page caseBreakdown simulation
// ============================================

describe('workflow: caseBreakdown data flow simulation', () => {
  it('produces correct CasePhaseBarPhase structure for a complete case', () => {
    // Simulate the logic from the surgeon page caseBreakdown useMemo
    // Uses buildPhaseTree, resolvePhaseHex, resolveSubphaseHex imported at top

    const phases: PhaseDefInput[] = [
      makePhaseDef({
        id: 'pre_op',
        name: 'pre_op',
        display_name: 'Pre-Op',
        display_order: 1,
        color_key: 'blue',
        start_milestone_id: 'ms_patient_in',
        end_milestone_id: 'ms_incision',
      }),
      makePhaseDef({
        id: 'surgical',
        name: 'surgical',
        display_name: 'Surgical',
        display_order: 2,
        color_key: 'green',
        start_milestone_id: 'ms_incision',
        end_milestone_id: 'ms_closing',
      }),
      makePhaseDef({
        id: 'anes',
        name: 'anesthesia',
        display_name: 'Anesthesia',
        display_order: 3,
        color_key: 'teal',
        parent_phase_id: 'pre_op',
        start_milestone_id: 'ms_anes_start',
        end_milestone_id: 'ms_anes_end',
      }),
    ]

    const timestampMap = buildMilestoneTimestampMap([
      { facility_milestone_id: 'ms_patient_in', recorded_at: '2025-02-03T07:30:00Z' },
      { facility_milestone_id: 'ms_incision', recorded_at: '2025-02-03T07:50:00Z' },
      { facility_milestone_id: 'ms_closing', recorded_at: '2025-02-03T09:00:00Z' },
      { facility_milestone_id: 'ms_anes_start', recorded_at: '2025-02-03T07:35:00Z' },
      { facility_milestone_id: 'ms_anes_end', recorded_at: '2025-02-03T07:45:00Z' },
    ])

    const durations = computePhaseDurations(phases, timestampMap)
    const durationMap = new Map(durations.map(d => [d.phaseId, d]))
    const phaseTree = buildPhaseTree(phases)

    // Simulate the caseBreakdown mapping from surgeon page
    const barPhases = phaseTree.map((node: { phase: PhaseDefInput; children: { phase: PhaseDefInput }[] }) => {
      const parentDuration = durationMap.get(node.phase.id)
      const subphases = node.children
        .map((child: { phase: PhaseDefInput }) => {
          const childDuration = durationMap.get(child.phase.id)
          if (!childDuration || childDuration.durationSeconds === null) return null
          return {
            label: childDuration.displayName,
            value: childDuration.durationSeconds,
            color: resolveSubphaseHex(childDuration.colorKey),
          }
        })
        .filter((s: unknown): s is { label: string; value: number; color: string } => s !== null)

      return {
        label: parentDuration?.displayName ?? node.phase.display_name,
        value: parentDuration?.durationSeconds ?? 0,
        color: resolvePhaseHex(parentDuration?.colorKey ?? node.phase.color_key),
        isMissing: parentDuration?.durationSeconds === null,
        subphases: subphases.length > 0 ? subphases : undefined,
      }
    })

    expect(barPhases).toHaveLength(2) // 2 top-level phases
    expect(barPhases[0].label).toBe('Pre-Op')
    expect(barPhases[0].value).toBe(1200) // 20 min
    expect(barPhases[0].isMissing).toBe(false)
    expect(barPhases[0].subphases).toHaveLength(1)
    expect(barPhases[0].subphases![0].label).toBe('Anesthesia')
    expect(barPhases[0].subphases![0].value).toBe(600) // 10 min

    expect(barPhases[1].label).toBe('Surgical')
    expect(barPhases[1].value).toBe(4200) // 70 min
    expect(barPhases[1].isMissing).toBe(false)
    expect(barPhases[1].subphases).toBeUndefined()
  })

  it('handles case with no milestones — all phases marked as missing', () => {
    // Uses buildPhaseTree, resolvePhaseHex imported at top

    const phases: PhaseDefInput[] = [
      makePhaseDef({
        id: 'pre_op',
        display_name: 'Pre-Op',
        display_order: 1,
        color_key: 'blue',
        start_milestone_id: 'ms_patient_in',
        end_milestone_id: 'ms_incision',
      }),
    ]

    const timestampMap = buildMilestoneTimestampMap([]) // no milestones at all
    const durations = computePhaseDurations(phases, timestampMap)
    const durationMap = new Map(durations.map(d => [d.phaseId, d]))
    const phaseTree = buildPhaseTree(phases)

    const barPhases = phaseTree.map((node: { phase: PhaseDefInput; children: { phase: PhaseDefInput }[] }) => {
      const parentDuration = durationMap.get(node.phase.id)
      return {
        label: parentDuration?.displayName ?? node.phase.display_name,
        value: parentDuration?.durationSeconds ?? 0,
        color: resolvePhaseHex(parentDuration?.colorKey ?? node.phase.color_key),
        isMissing: parentDuration?.durationSeconds === null,
      }
    })

    expect(barPhases).toHaveLength(1)
    expect(barPhases[0].value).toBe(0)
    expect(barPhases[0].isMissing).toBe(true)
  })

  it('filters out subphases with missing milestones (surgeon who does not capture them)', () => {
    // Uses buildPhaseTree, resolvePhaseHex, resolveSubphaseHex imported at top

    const phases: PhaseDefInput[] = [
      makePhaseDef({
        id: 'pre_op',
        display_name: 'Pre-Op',
        display_order: 1,
        color_key: 'blue',
        start_milestone_id: 'ms_patient_in',
        end_milestone_id: 'ms_incision',
      }),
      makePhaseDef({
        id: 'anes',
        display_name: 'Anesthesia',
        display_order: 2,
        color_key: 'teal',
        parent_phase_id: 'pre_op',
        start_milestone_id: 'ms_anes_start',
        end_milestone_id: 'ms_anes_end',
      }),
    ]

    // Surgeon captures parent boundaries but NOT anesthesia milestones
    const timestampMap = buildMilestoneTimestampMap([
      { facility_milestone_id: 'ms_patient_in', recorded_at: '2025-02-03T07:30:00Z' },
      { facility_milestone_id: 'ms_incision', recorded_at: '2025-02-03T07:50:00Z' },
    ])

    const durations = computePhaseDurations(phases, timestampMap)
    const durationMap = new Map(durations.map(d => [d.phaseId, d]))
    const phaseTree = buildPhaseTree(phases)

    const barPhases = phaseTree.map((node: { phase: PhaseDefInput; children: { phase: PhaseDefInput }[] }) => {
      const parentDuration = durationMap.get(node.phase.id)
      const subphases = node.children
        .map((child: { phase: PhaseDefInput }) => {
          const childDuration = durationMap.get(child.phase.id)
          if (!childDuration || childDuration.durationSeconds === null) return null
          return {
            label: childDuration.displayName,
            value: childDuration.durationSeconds,
            color: resolveSubphaseHex(childDuration.colorKey),
          }
        })
        .filter((s: unknown): s is { label: string; value: number; color: string } => s !== null)

      return {
        label: parentDuration?.displayName ?? node.phase.display_name,
        value: parentDuration?.durationSeconds ?? 0,
        color: resolvePhaseHex(parentDuration?.colorKey ?? node.phase.color_key),
        isMissing: parentDuration?.durationSeconds === null,
        subphases: subphases.length > 0 ? subphases : undefined,
      }
    })

    expect(barPhases).toHaveLength(1)
    expect(barPhases[0].label).toBe('Pre-Op')
    expect(barPhases[0].value).toBe(1200)
    expect(barPhases[0].isMissing).toBe(false)
    // Anesthesia subphase should NOT appear — milestones are missing
    expect(barPhases[0].subphases).toBeUndefined()
  })
})
