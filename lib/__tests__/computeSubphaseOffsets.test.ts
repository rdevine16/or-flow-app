/**
 * Tests for computeSubphaseOffsets — Phase 3 of Surgeon Day Analysis Redesign.
 *
 * Test coverage:
 *  1. Basic offset computation: parent 0-1200s, sub-phase at 180s for 600s
 *  2. Missing sub-phase milestone → sub-phase omitted from output
 *  3. Sub-phase extending beyond parent end → clamped to parent duration
 *  4. Multiple sub-phases within one parent
 *  5. Parent with null duration → skipped entirely
 *  6. Missing parent start timestamp → skipped
 *  7. Empty phase definitions → empty result
 *  8. Integration: buildMilestoneTimestampMap → computePhaseDurations → computeSubphaseOffsets
 */
import { describe, it, expect } from 'vitest'
import {
  computeSubphaseOffsets,
  computePhaseDurations,
  buildMilestoneTimestampMap,
  type PhaseDefInput,
  type MilestoneTimestampMap,
} from '../analyticsV2'
import { resolveSubphaseHex } from '../milestone-phase-config'

// ============================================
// HELPERS
// ============================================

const FM = {
  patientIn: 'fm-patient-in',
  anesStart: 'fm-anes-start',
  anesEnd: 'fm-anes-end',
  prepStart: 'fm-prep-start',
  prepEnd: 'fm-prep-end',
  incision: 'fm-incision',
  closing: 'fm-closing',
  closingComplete: 'fm-closing-complete',
  patientOut: 'fm-patient-out',
} as const

/** Build a standard set: 2 parent phases + 1 sub-phase (anesthesia within pre-op) */
function buildPhaseDefinitions(): PhaseDefInput[] {
  return [
    {
      id: 'phase-preop',
      name: 'pre_op',
      display_name: 'Pre-Op',
      display_order: 1,
      color_key: 'blue',
      parent_phase_id: null,
      start_milestone_id: FM.patientIn,
      end_milestone_id: FM.incision,
    },
    {
      id: 'phase-surgical',
      name: 'surgical',
      display_name: 'Surgical',
      display_order: 2,
      color_key: 'green',
      parent_phase_id: null,
      start_milestone_id: FM.incision,
      end_milestone_id: FM.closing,
    },
    {
      id: 'phase-anes',
      name: 'anesthesia',
      display_name: 'Anesthesia',
      display_order: 1.5,
      color_key: 'teal',
      parent_phase_id: 'phase-preop',
      start_milestone_id: FM.anesStart,
      end_milestone_id: FM.anesEnd,
    },
  ]
}

/** Build complete milestone timestamps */
function buildCompleteMilestones(): MilestoneTimestampMap {
  const base = new Date('2025-01-15T07:00:00Z')
  return new Map([
    [FM.patientIn, base.toISOString()],                                        // 07:00
    [FM.anesStart, new Date(base.getTime() + 3 * 60000).toISOString()],       // 07:03
    [FM.anesEnd, new Date(base.getTime() + 13 * 60000).toISOString()],        // 07:13
    [FM.incision, new Date(base.getTime() + 20 * 60000).toISOString()],       // 07:20
    [FM.closing, new Date(base.getTime() + 80 * 60000).toISOString()],        // 08:20
    [FM.closingComplete, new Date(base.getTime() + 90 * 60000).toISOString()], // 08:30
    [FM.patientOut, new Date(base.getTime() + 100 * 60000).toISOString()],    // 08:40
  ])
}

// ============================================
// UNIT TESTS
// ============================================

describe('computeSubphaseOffsets', () => {
  it('computes correct offset and duration for a sub-phase within its parent', () => {
    // Pre-Op: 07:00 → 07:20 = 1200s
    // Anesthesia: 07:03 → 07:13 = 600s, offset = 180s from parent start
    const phases = buildPhaseDefinitions()
    const milestones = buildCompleteMilestones()
    const durations = computePhaseDurations(phases, milestones)

    const result = computeSubphaseOffsets(phases, durations, milestones, resolveSubphaseHex)

    expect(result).toHaveLength(1) // only pre-op has children
    expect(result[0].phaseId).toBe('phase-preop')
    expect(result[0].subphases).toHaveLength(1)
    expect(result[0].subphases[0]).toEqual({
      phaseId: 'phase-anes',
      offsetSeconds: 180,   // 3 minutes
      durationSeconds: 600, // 10 minutes
      label: 'Anesthesia',
      color: resolveSubphaseHex('teal'),
    })
  })

  it('omits sub-phases whose start milestone is missing', () => {
    const phases = buildPhaseDefinitions()
    const milestones = buildCompleteMilestones()
    milestones.delete(FM.anesStart) // Remove anesthesia start

    const durations = computePhaseDurations(phases, milestones)
    const result = computeSubphaseOffsets(phases, durations, milestones, resolveSubphaseHex)

    // Anesthesia duration is null (missing start), so it's skipped
    expect(result).toHaveLength(0)
  })

  it('omits sub-phases whose duration is null (missing end milestone)', () => {
    const phases = buildPhaseDefinitions()
    const milestones = buildCompleteMilestones()
    milestones.delete(FM.anesEnd) // Remove anesthesia end

    const durations = computePhaseDurations(phases, milestones)
    const result = computeSubphaseOffsets(phases, durations, milestones, resolveSubphaseHex)

    // Anesthesia duration is null, so it's skipped
    expect(result).toHaveLength(0)
  })

  it('clamps sub-phase that extends beyond parent end', () => {
    const phases = buildPhaseDefinitions()
    const base = new Date('2025-01-15T07:00:00Z')

    // Pre-Op: 07:00 → 07:20 = 1200s
    // Anesthesia: 07:15 → 07:30 = 900s — extends 600s past parent end
    const milestones: MilestoneTimestampMap = new Map([
      [FM.patientIn, base.toISOString()],                                        // 07:00
      [FM.anesStart, new Date(base.getTime() + 15 * 60000).toISOString()],      // 07:15
      [FM.anesEnd, new Date(base.getTime() + 30 * 60000).toISOString()],        // 07:30
      [FM.incision, new Date(base.getTime() + 20 * 60000).toISOString()],       // 07:20
      [FM.closing, new Date(base.getTime() + 80 * 60000).toISOString()],        // 08:20
    ])

    const durations = computePhaseDurations(phases, milestones)
    const result = computeSubphaseOffsets(phases, durations, milestones, resolveSubphaseHex)

    expect(result).toHaveLength(1)
    const sub = result[0].subphases[0]
    expect(sub.offsetSeconds).toBe(900)      // 15 min
    expect(sub.durationSeconds).toBe(300)    // clamped: 1200 - 900 = 300s (not 900s)
  })

  it('handles multiple sub-phases within one parent', () => {
    const phases: PhaseDefInput[] = [
      {
        id: 'phase-preop',
        name: 'pre_op',
        display_name: 'Pre-Op',
        display_order: 1,
        color_key: 'blue',
        parent_phase_id: null,
        start_milestone_id: FM.patientIn,
        end_milestone_id: FM.incision,
      },
      {
        id: 'phase-anes',
        name: 'anesthesia',
        display_name: 'Anesthesia',
        display_order: 1.1,
        color_key: 'teal',
        parent_phase_id: 'phase-preop',
        start_milestone_id: FM.anesStart,
        end_milestone_id: FM.anesEnd,
      },
      {
        id: 'phase-prep',
        name: 'prep',
        display_name: 'Prep & Drape',
        display_order: 1.2,
        color_key: 'indigo',
        parent_phase_id: 'phase-preop',
        start_milestone_id: FM.prepStart,
        end_milestone_id: FM.prepEnd,
      },
    ]

    const base = new Date('2025-01-15T07:00:00Z')
    const milestones: MilestoneTimestampMap = new Map([
      [FM.patientIn, base.toISOString()],                                        // 07:00
      [FM.anesStart, new Date(base.getTime() + 3 * 60000).toISOString()],       // 07:03
      [FM.anesEnd, new Date(base.getTime() + 13 * 60000).toISOString()],        // 07:13
      [FM.prepStart, new Date(base.getTime() + 14 * 60000).toISOString()],      // 07:14
      [FM.prepEnd, new Date(base.getTime() + 19 * 60000).toISOString()],        // 07:19
      [FM.incision, new Date(base.getTime() + 20 * 60000).toISOString()],       // 07:20
    ])

    const durations = computePhaseDurations(phases, milestones)
    const result = computeSubphaseOffsets(phases, durations, milestones, resolveSubphaseHex)

    expect(result).toHaveLength(1)
    expect(result[0].subphases).toHaveLength(2)

    // Sorted by display_order: anesthesia (1.1), prep (1.2)
    expect(result[0].subphases[0].label).toBe('Anesthesia')
    expect(result[0].subphases[0].offsetSeconds).toBe(180)   // 3 min
    expect(result[0].subphases[0].durationSeconds).toBe(600) // 10 min

    expect(result[0].subphases[1].label).toBe('Prep & Drape')
    expect(result[0].subphases[1].offsetSeconds).toBe(840)   // 14 min
    expect(result[0].subphases[1].durationSeconds).toBe(300) // 5 min
  })

  it('skips parent phase with null duration', () => {
    const phases = buildPhaseDefinitions()
    const milestones = buildCompleteMilestones()
    // Remove parent's end milestone so pre-op duration is null
    milestones.delete(FM.incision)

    const durations = computePhaseDurations(phases, milestones)
    const result = computeSubphaseOffsets(phases, durations, milestones, resolveSubphaseHex)

    // Pre-op duration is null → entire parent is skipped
    expect(result).toHaveLength(0)
  })

  it('skips parent when start timestamp is missing', () => {
    const phases = buildPhaseDefinitions()
    const milestones = buildCompleteMilestones()
    // Remove parent's start milestone — duration still computable if both exist in map
    // but the offset computation needs the start timestamp
    milestones.delete(FM.patientIn)

    const durations = computePhaseDurations(phases, milestones)
    const result = computeSubphaseOffsets(phases, durations, milestones, resolveSubphaseHex)

    // Pre-op duration is null (missing start), parent skipped
    expect(result).toHaveLength(0)
  })

  it('returns empty array for phase definitions with no parent-child relationships', () => {
    const phases: PhaseDefInput[] = [
      {
        id: 'phase-preop',
        name: 'pre_op',
        display_name: 'Pre-Op',
        display_order: 1,
        color_key: 'blue',
        parent_phase_id: null,
        start_milestone_id: FM.patientIn,
        end_milestone_id: FM.incision,
      },
    ]
    const milestones = buildCompleteMilestones()
    const durations = computePhaseDurations(phases, milestones)
    const result = computeSubphaseOffsets(phases, durations, milestones, resolveSubphaseHex)

    expect(result).toEqual([])
  })

  it('returns empty array for empty input', () => {
    const result = computeSubphaseOffsets(
      [],
      [],
      new Map(),
      resolveSubphaseHex,
    )
    expect(result).toEqual([])
  })

  it('uses the provided resolveColor function for sub-phase colors', () => {
    const phases = buildPhaseDefinitions()
    const milestones = buildCompleteMilestones()
    const durations = computePhaseDurations(phases, milestones)

    // Custom color resolver that always returns red
    const customResolve = () => '#FF0000'
    const result = computeSubphaseOffsets(phases, durations, milestones, customResolve)

    expect(result[0].subphases[0].color).toBe('#FF0000')
  })
})

// ============================================
// INTEGRATION
// ============================================

describe('computeSubphaseOffsets integration', () => {
  it('end-to-end: raw milestones → buildTimestampMap → computePhaseDurations → computeSubphaseOffsets', () => {
    // Step 1: Raw case_milestones as from Supabase
    const rawMilestones = [
      { facility_milestone_id: FM.patientIn, recorded_at: '2025-01-15T07:00:00Z' },
      { facility_milestone_id: FM.anesStart, recorded_at: '2025-01-15T07:03:00Z' },
      { facility_milestone_id: FM.anesEnd, recorded_at: '2025-01-15T07:13:00Z' },
      { facility_milestone_id: FM.incision, recorded_at: '2025-01-15T07:20:00Z' },
      { facility_milestone_id: FM.closing, recorded_at: '2025-01-15T08:20:00Z' },
    ]

    // Step 2: Build timestamp map
    const tsMap = buildMilestoneTimestampMap(rawMilestones)

    // Step 3: Compute durations
    const phases = buildPhaseDefinitions()
    const durations = computePhaseDurations(phases, tsMap)

    // Step 4: Compute sub-phase offsets
    const offsets = computeSubphaseOffsets(phases, durations, tsMap, resolveSubphaseHex)

    // Verify shape matches what DayTimeline/CasePhaseBarNested need
    expect(offsets).toHaveLength(1)
    expect(offsets[0].phaseId).toBe('phase-preop')
    expect(offsets[0].subphases[0]).toEqual({
      phaseId: 'phase-anes',
      offsetSeconds: 180,
      durationSeconds: 600,
      label: 'Anesthesia',
      color: resolveSubphaseHex('teal'),
    })
  })

  it('workflow: sub-phase offsets feed into TimelineCaseData format', () => {
    const phases = buildPhaseDefinitions()
    const milestones = buildCompleteMilestones()
    const durations = computePhaseDurations(phases, milestones)
    const offsets = computeSubphaseOffsets(phases, durations, milestones, resolveSubphaseHex)

    // Build lookup for quick access (as the page component would)
    const offsetMap = new Map(offsets.map(o => [o.phaseId, o.subphases]))

    // Transform parent durations into timeline format with embedded sub-phases
    const parentDurations = durations.filter(d => !d.parentPhaseId)
    const timelinePhases = parentDurations
      .filter(d => d.durationSeconds !== null)
      .map(d => ({
        phaseId: d.phaseId,
        label: d.displayName,
        durationSeconds: d.durationSeconds!,
        subphases: offsetMap.get(d.phaseId) || [],
      }))

    // Pre-Op should have the anesthesia sub-phase
    const preOp = timelinePhases.find(p => p.phaseId === 'phase-preop')!
    expect(preOp.subphases).toHaveLength(1)
    expect(preOp.subphases[0].label).toBe('Anesthesia')

    // Surgical should have no sub-phases
    const surgical = timelinePhases.find(p => p.phaseId === 'phase-surgical')!
    expect(surgical.subphases).toHaveLength(0)
  })
})
