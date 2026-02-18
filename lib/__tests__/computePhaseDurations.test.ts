/**
 * Tests for computePhaseDurations engine and color utilities.
 * Phase 1 of Dynamic Case Breakdown feature.
 */
import { describe, it, expect } from 'vitest'
import {
  computePhaseDurations,
  buildMilestoneTimestampMap,
  type PhaseDefInput,
  type MilestoneTimestampMap,
} from '../analyticsV2'
import {
  resolvePhaseHex,
  resolveSubphaseHex,
  COLOR_KEY_PALETTE,
} from '../milestone-phase-config'

// ============================================
// HELPERS — Build test data
// ============================================

/** UUIDs for test facility milestones */
const FM = {
  patientIn: 'fm-patient-in',
  anesStart: 'fm-anes-start',
  anesEnd: 'fm-anes-end',
  incision: 'fm-incision',
  closing: 'fm-closing',
  closingComplete: 'fm-closing-complete',
  patientOut: 'fm-patient-out',
} as const

/** Build a standard set of 4 parent phases + 1 subphase */
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
      id: 'phase-closing',
      name: 'closing',
      display_name: 'Closing',
      display_order: 3,
      color_key: 'amber',
      parent_phase_id: null,
      start_milestone_id: FM.closing,
      end_milestone_id: FM.closingComplete,
    },
    {
      id: 'phase-postop',
      name: 'post_op',
      display_name: 'Post-Op',
      display_order: 4,
      color_key: 'purple',
      parent_phase_id: null,
      start_milestone_id: FM.closingComplete,
      end_milestone_id: FM.patientOut,
    },
    // Subphase: Anesthesia within Pre-Op
    {
      id: 'phase-anes',
      name: 'anesthesia',
      display_name: 'Anesthesia',
      display_order: 1.5,
      color_key: 'blue',
      parent_phase_id: 'phase-preop',
      start_milestone_id: FM.anesStart,
      end_milestone_id: FM.anesEnd,
    },
  ]
}

/** Build a complete milestone timestamp map (all milestones present) */
function buildCompleteMilestones(): MilestoneTimestampMap {
  const base = new Date('2025-01-15T07:00:00Z')
  return new Map([
    [FM.patientIn, base.toISOString()],                                           // 07:00
    [FM.anesStart, new Date(base.getTime() + 5 * 60000).toISOString()],           // 07:05
    [FM.anesEnd, new Date(base.getTime() + 15 * 60000).toISOString()],            // 07:15
    [FM.incision, new Date(base.getTime() + 20 * 60000).toISOString()],           // 07:20
    [FM.closing, new Date(base.getTime() + 80 * 60000).toISOString()],            // 08:20
    [FM.closingComplete, new Date(base.getTime() + 90 * 60000).toISOString()],    // 08:30
    [FM.patientOut, new Date(base.getTime() + 100 * 60000).toISOString()],        // 08:40
  ])
}

// ============================================
// UNIT TESTS — computePhaseDurations
// ============================================

describe('computePhaseDurations', () => {
  it('computes correct durations from boundary milestone IDs', () => {
    const phases = buildPhaseDefinitions()
    const milestones = buildCompleteMilestones()
    const results = computePhaseDurations(phases, milestones)

    // 5 phases total (4 parent + 1 subphase)
    expect(results).toHaveLength(5)

    // Pre-Op: patient_in (07:00) → incision (07:20) = 20 min = 1200 sec
    const preOp = results.find(r => r.name === 'pre_op')!
    expect(preOp.durationSeconds).toBe(1200)

    // Surgical: incision (07:20) → closing (08:20) = 60 min = 3600 sec
    const surgical = results.find(r => r.name === 'surgical')!
    expect(surgical.durationSeconds).toBe(3600)

    // Closing: closing (08:20) → closing_complete (08:30) = 10 min = 600 sec
    const closing = results.find(r => r.name === 'closing')!
    expect(closing.durationSeconds).toBe(600)

    // Post-Op: closing_complete (08:30) → patient_out (08:40) = 10 min = 600 sec
    const postOp = results.find(r => r.name === 'post_op')!
    expect(postOp.durationSeconds).toBe(600)

    // Anesthesia subphase: anes_start (07:05) → anes_end (07:15) = 10 min = 600 sec
    const anes = results.find(r => r.name === 'anesthesia')!
    expect(anes.durationSeconds).toBe(600)
  })

  it('returns null for phases with missing start milestone', () => {
    const phases = buildPhaseDefinitions()
    // Remove anes_start — anesthesia subphase should be null
    const milestones = buildCompleteMilestones()
    milestones.delete(FM.anesStart)

    const results = computePhaseDurations(phases, milestones)
    const anes = results.find(r => r.name === 'anesthesia')!
    expect(anes.durationSeconds).toBeNull()
  })

  it('returns null for phases with missing end milestone', () => {
    const phases = buildPhaseDefinitions()
    const milestones = buildCompleteMilestones()
    milestones.delete(FM.closing)

    const results = computePhaseDurations(phases, milestones)

    // Surgical phase has no end milestone
    const surgical = results.find(r => r.name === 'surgical')!
    expect(surgical.durationSeconds).toBeNull()

    // Closing phase has no start milestone
    const closing = results.find(r => r.name === 'closing')!
    expect(closing.durationSeconds).toBeNull()
  })

  it('returns null when end is before start (invalid data)', () => {
    const phases: PhaseDefInput[] = [{
      id: 'phase-invalid',
      name: 'invalid',
      display_name: 'Invalid',
      display_order: 1,
      color_key: 'blue',
      parent_phase_id: null,
      start_milestone_id: 'fm-a',
      end_milestone_id: 'fm-b',
    }]
    const milestones = new Map([
      ['fm-a', '2025-01-15T08:00:00Z'],
      ['fm-b', '2025-01-15T07:00:00Z'], // end before start
    ])

    const results = computePhaseDurations(phases, milestones)
    expect(results[0].durationSeconds).toBeNull()
  })

  it('returns results sorted by display_order regardless of input order', () => {
    const phases = buildPhaseDefinitions()
    // Shuffle the input order
    const shuffled = [phases[4], phases[2], phases[0], phases[3], phases[1]]
    const milestones = buildCompleteMilestones()

    const results = computePhaseDurations(shuffled, milestones)
    const orders = results.map(r => r.displayOrder)
    expect(orders).toEqual([1, 1.5, 2, 3, 4])
  })

  it('preserves parentPhaseId for subphases', () => {
    const phases = buildPhaseDefinitions()
    const milestones = buildCompleteMilestones()

    const results = computePhaseDurations(phases, milestones)
    const anes = results.find(r => r.name === 'anesthesia')!
    expect(anes.parentPhaseId).toBe('phase-preop')

    const preOp = results.find(r => r.name === 'pre_op')!
    expect(preOp.parentPhaseId).toBeNull()
  })

  it('handles empty phase definitions', () => {
    const milestones = buildCompleteMilestones()
    const results = computePhaseDurations([], milestones)
    expect(results).toEqual([])
  })

  it('handles empty milestone map', () => {
    const phases = buildPhaseDefinitions()
    const milestones = new Map<string, string>()
    const results = computePhaseDurations(phases, milestones)

    // All durations should be null
    for (const r of results) {
      expect(r.durationSeconds).toBeNull()
    }
    expect(results).toHaveLength(5)
  })

  it('outputs correct metadata fields', () => {
    const phases = buildPhaseDefinitions()
    const milestones = buildCompleteMilestones()

    const results = computePhaseDurations(phases, milestones)
    const preOp = results.find(r => r.name === 'pre_op')!

    expect(preOp.phaseId).toBe('phase-preop')
    expect(preOp.displayName).toBe('Pre-Op')
    expect(preOp.displayOrder).toBe(1)
    expect(preOp.colorKey).toBe('blue')
  })
})

// ============================================
// UNIT TESTS — buildMilestoneTimestampMap
// ============================================

describe('buildMilestoneTimestampMap', () => {
  it('builds a map from raw case_milestones array', () => {
    const raw = [
      { facility_milestone_id: 'fm-1', recorded_at: '2025-01-15T07:00:00Z' },
      { facility_milestone_id: 'fm-2', recorded_at: '2025-01-15T07:30:00Z' },
    ]
    const map = buildMilestoneTimestampMap(raw)
    expect(map.size).toBe(2)
    expect(map.get('fm-1')).toBe('2025-01-15T07:00:00Z')
    expect(map.get('fm-2')).toBe('2025-01-15T07:30:00Z')
  })

  it('handles empty array', () => {
    const map = buildMilestoneTimestampMap([])
    expect(map.size).toBe(0)
  })
})

// ============================================
// UNIT TESTS — Color Utilities
// ============================================

describe('resolvePhaseHex', () => {
  it('returns primary hex for known color keys', () => {
    expect(resolvePhaseHex('blue')).toBe('#3B82F6')
    expect(resolvePhaseHex('green')).toBe('#22C55E')
    expect(resolvePhaseHex('amber')).toBe('#F59E0B')
    expect(resolvePhaseHex('purple')).toBe('#8B5CF6')
  })

  it('falls back to slate for null', () => {
    expect(resolvePhaseHex(null)).toBe('#64748B')
  })

  it('falls back to slate for unknown color key', () => {
    expect(resolvePhaseHex('neon')).toBe('#64748B')
  })
})

describe('resolveSubphaseHex', () => {
  it('returns lighter shade for known color keys', () => {
    expect(resolveSubphaseHex('blue')).toBe('#93C5FD')
    expect(resolveSubphaseHex('green')).toBe('#86EFAC')
    expect(resolveSubphaseHex('amber')).toBe('#FCD34D')
    expect(resolveSubphaseHex('purple')).toBe('#C4B5FD')
  })

  it('falls back to slate light for null', () => {
    expect(resolveSubphaseHex(null)).toBe('#CBD5E1')
  })

  it('falls back to slate light for unknown color key', () => {
    expect(resolveSubphaseHex('neon')).toBe('#CBD5E1')
  })
})

describe('ColorKeyConfig lightHex', () => {
  it('every palette entry has a lightHex value', () => {
    for (const entry of COLOR_KEY_PALETTE) {
      expect(entry.lightHex).toBeTruthy()
      expect(entry.lightHex).toMatch(/^#[0-9A-Fa-f]{6}$/)
    }
  })

  it('lightHex differs from hex for all entries', () => {
    for (const entry of COLOR_KEY_PALETTE) {
      expect(entry.lightHex).not.toBe(entry.hex)
    }
  })
})

// ============================================
// INTEGRATION — Real-shaped data through engine
// ============================================

describe('computePhaseDurations integration', () => {
  it('matches old hardcoded helpers for same milestone data', () => {
    // Simulate what the old helpers compute:
    // getWheelsInToIncision = patient_in → incision (seconds)
    // getIncisionToClosing = incision → closing (seconds)
    // getClosingTime = closing → closing_complete (seconds)
    // getClosedToWheelsOut = closing_complete → patient_out (seconds)
    const milestones = buildCompleteMilestones()
    const parentPhases = buildPhaseDefinitions().filter(p => !p.parent_phase_id)
    const results = computePhaseDurations(parentPhases, milestones)

    // Old hardcoded values for the test timestamps:
    // patient_in=07:00, incision=07:20, closing=08:20, closing_complete=08:30, patient_out=08:40
    const expectedSeconds = {
      pre_op: 20 * 60,      // 1200
      surgical: 60 * 60,    // 3600
      closing: 10 * 60,     // 600
      post_op: 10 * 60,     // 600
    }

    for (const r of results) {
      expect(r.durationSeconds).toBe(expectedSeconds[r.name as keyof typeof expectedSeconds])
    }
  })

  it('handles partial milestones — some phases computed, others null', () => {
    const phases = buildPhaseDefinitions()
    const milestones = new Map<string, string>()
    // Only provide patient_in, incision, closing — missing closing_complete and patient_out
    milestones.set(FM.patientIn, '2025-01-15T07:00:00Z')
    milestones.set(FM.incision, '2025-01-15T07:20:00Z')
    milestones.set(FM.closing, '2025-01-15T08:20:00Z')

    const results = computePhaseDurations(phases, milestones)

    // Pre-Op: has both boundaries → computed
    expect(results.find(r => r.name === 'pre_op')!.durationSeconds).toBe(1200)
    // Surgical: has both boundaries → computed
    expect(results.find(r => r.name === 'surgical')!.durationSeconds).toBe(3600)
    // Closing: has start but missing end → null
    expect(results.find(r => r.name === 'closing')!.durationSeconds).toBeNull()
    // Post-Op: missing both boundaries → null
    expect(results.find(r => r.name === 'post_op')!.durationSeconds).toBeNull()
    // Anesthesia: missing both boundaries → null
    expect(results.find(r => r.name === 'anesthesia')!.durationSeconds).toBeNull()
  })
})

// ============================================
// WORKFLOW — Simulate surgeon page data flow
// ============================================

describe('surgeon page data flow simulation', () => {
  it('end-to-end: raw milestones → buildTimestampMap → computePhaseDurations → bar data', () => {
    // Step 1: Raw case_milestones from Supabase (as they'd arrive on the surgeon page)
    const rawMilestones = [
      { facility_milestone_id: FM.patientIn, recorded_at: '2025-01-15T07:00:00Z' },
      { facility_milestone_id: FM.anesStart, recorded_at: '2025-01-15T07:05:00Z' },
      { facility_milestone_id: FM.anesEnd, recorded_at: '2025-01-15T07:15:00Z' },
      { facility_milestone_id: FM.incision, recorded_at: '2025-01-15T07:20:00Z' },
      { facility_milestone_id: FM.closing, recorded_at: '2025-01-15T08:20:00Z' },
      { facility_milestone_id: FM.closingComplete, recorded_at: '2025-01-15T08:30:00Z' },
      { facility_milestone_id: FM.patientOut, recorded_at: '2025-01-15T08:40:00Z' },
    ]

    // Step 2: Build timestamp map
    const tsMap = buildMilestoneTimestampMap(rawMilestones)

    // Step 3: Compute durations using phase definitions
    const phaseDefinitions = buildPhaseDefinitions()
    const results = computePhaseDurations(phaseDefinitions, tsMap)

    // Step 4: Transform to CasePhaseBar-compatible format (this is what Phase 2/3 will do)
    const parentResults = results.filter(r => !r.parentPhaseId)
    const barPhases = parentResults.map(r => ({
      label: r.displayName,
      value: r.durationSeconds ?? 0,
      color: resolvePhaseHex(r.colorKey),
    }))

    // Verify the output shape matches CasePhaseBar's expectations
    expect(barPhases).toEqual([
      { label: 'Pre-Op', value: 1200, color: '#3B82F6' },
      { label: 'Surgical', value: 3600, color: '#22C55E' },
      { label: 'Closing', value: 600, color: '#F59E0B' },
      { label: 'Post-Op', value: 600, color: '#8B5CF6' },
    ])

    // Also verify subphases resolve correctly
    const subphases = results.filter(r => r.parentPhaseId)
    expect(subphases).toHaveLength(1)
    expect(subphases[0].displayName).toBe('Anesthesia')
    expect(subphases[0].durationSeconds).toBe(600)
    expect(resolveSubphaseHex(subphases[0].colorKey)).toBe('#93C5FD')
  })
})
