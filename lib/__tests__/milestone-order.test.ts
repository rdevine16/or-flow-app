import { describe, it, expect } from 'vitest'
import {
  checkMilestoneOrder,
  type MilestoneTypeForOrder,
  type RecordedMilestoneForOrder,
  type OrderCheckResult,
} from '../milestone-order'

// ============================================
// HELPERS
// ============================================

/** Realistic OR milestone set — matches typical facility configuration */
function buildMilestoneTypes(): MilestoneTypeForOrder[] {
  return [
    { id: 'fm-patient-in', display_name: 'Patient In', display_order: 0 },
    { id: 'fm-anes-start', display_name: 'Anesthesia Start', display_order: 1 },
    { id: 'fm-anes-end', display_name: 'Anesthesia End', display_order: 2 },
    { id: 'fm-prep-start', display_name: 'Prep/Drape Start', display_order: 3 },
    { id: 'fm-prep-end', display_name: 'Prep/Drape Complete', display_order: 4 },
    { id: 'fm-incision', display_name: 'Incision', display_order: 5 },
    { id: 'fm-closing', display_name: 'Closing', display_order: 6 },
    { id: 'fm-closing-end', display_name: 'Closing Complete', display_order: 7 },
    { id: 'fm-patient-out', display_name: 'Patient Out', display_order: 8 },
    { id: 'fm-room-cleaned', display_name: 'Room Cleaned', display_order: 9 },
  ]
}

function recorded(facilityMilestoneId: string, at: string = '2025-01-15T08:00:00Z'): RecordedMilestoneForOrder {
  return { facility_milestone_id: facilityMilestoneId, recorded_at: at }
}

function unrecorded(facilityMilestoneId: string): RecordedMilestoneForOrder {
  return { facility_milestone_id: facilityMilestoneId, recorded_at: null }
}

// ============================================
// UNIT TESTS: checkMilestoneOrder
// ============================================

describe('checkMilestoneOrder — unit', () => {
  const milestoneTypes = buildMilestoneTypes()

  it('should return not-out-of-order for the first milestone (lowest display_order)', () => {
    const result = checkMilestoneOrder('fm-patient-in', milestoneTypes, [])
    expect(result.isOutOfOrder).toBe(false)
    expect(result.skippedCount).toBe(0)
  })

  it('should return not-out-of-order when all predecessors are recorded', () => {
    const caseMilestones = [
      recorded('fm-patient-in', '2025-01-15T08:00:00Z'),
      recorded('fm-anes-start', '2025-01-15T08:05:00Z'),
    ]
    const result = checkMilestoneOrder('fm-anes-end', milestoneTypes, caseMilestones)
    expect(result.isOutOfOrder).toBe(false)
    expect(result.skippedCount).toBe(0)
  })

  it('should detect 1 skipped predecessor', () => {
    // Recording anes_end without anes_start (patient_in is recorded)
    const caseMilestones = [
      recorded('fm-patient-in'),
    ]
    const result = checkMilestoneOrder('fm-anes-end', milestoneTypes, caseMilestones)
    expect(result.isOutOfOrder).toBe(true)
    expect(result.skippedCount).toBe(1) // anes_start
  })

  it('should detect multiple skipped predecessors', () => {
    // Recording incision with nothing recorded
    const result = checkMilestoneOrder('fm-incision', milestoneTypes, [])
    expect(result.isOutOfOrder).toBe(true)
    expect(result.skippedCount).toBe(5) // patient_in, anes_start, anes_end, prep_start, prep_end
  })

  it('should count only unrecorded predecessors when some are recorded', () => {
    // Recording incision with patient_in and anes_start recorded, but anes_end, prep_start, prep_end missing
    const caseMilestones = [
      recorded('fm-patient-in'),
      recorded('fm-anes-start'),
    ]
    const result = checkMilestoneOrder('fm-incision', milestoneTypes, caseMilestones)
    expect(result.isOutOfOrder).toBe(true)
    expect(result.skippedCount).toBe(3) // anes_end, prep_start, prep_end
  })

  it('should treat recorded_at === null as unrecorded', () => {
    // Pre-created milestone rows with null recorded_at count as unrecorded
    const caseMilestones = [
      recorded('fm-patient-in'),
      unrecorded('fm-anes-start'), // exists but not recorded
    ]
    const result = checkMilestoneOrder('fm-anes-end', milestoneTypes, caseMilestones)
    expect(result.isOutOfOrder).toBe(true)
    expect(result.skippedCount).toBe(1) // anes_start has null recorded_at
  })

  it('should return not-out-of-order for unknown milestone ID', () => {
    const result = checkMilestoneOrder('fm-nonexistent', milestoneTypes, [])
    expect(result.isOutOfOrder).toBe(false)
    expect(result.skippedCount).toBe(0)
  })

  it('should handle empty milestone types array', () => {
    const result = checkMilestoneOrder('fm-patient-in', [], [])
    expect(result.isOutOfOrder).toBe(false)
    expect(result.skippedCount).toBe(0)
  })

  it('should handle empty case milestones array', () => {
    // First milestone with no recorded data — still in order
    const result = checkMilestoneOrder('fm-patient-in', milestoneTypes, [])
    expect(result.isOutOfOrder).toBe(false)
    expect(result.skippedCount).toBe(0)
  })

  it('should return correct type structure', () => {
    const result: OrderCheckResult = checkMilestoneOrder('fm-incision', milestoneTypes, [])
    expect(result).toHaveProperty('isOutOfOrder')
    expect(result).toHaveProperty('skippedCount')
    expect(typeof result.isOutOfOrder).toBe('boolean')
    expect(typeof result.skippedCount).toBe('number')
  })

  it('should not count milestones with equal display_order as predecessors', () => {
    // Edge case: two milestones with the same display_order
    const types: MilestoneTypeForOrder[] = [
      { id: 'fm-a', display_name: 'A', display_order: 1 },
      { id: 'fm-b', display_name: 'B', display_order: 1 },
      { id: 'fm-c', display_name: 'C', display_order: 2 },
    ]
    // Recording C with A unrecorded and B unrecorded — both are predecessors
    const result = checkMilestoneOrder('fm-c', types, [])
    expect(result.skippedCount).toBe(2)

    // Recording B — A has the same display_order, not a predecessor
    const result2 = checkMilestoneOrder('fm-b', types, [])
    expect(result2.isOutOfOrder).toBe(false)
    expect(result2.skippedCount).toBe(0)
  })

  it('should handle last milestone with all predecessors recorded', () => {
    const allRecorded = milestoneTypes.slice(0, -1).map(mt => recorded(mt.id))
    const result = checkMilestoneOrder('fm-room-cleaned', milestoneTypes, allRecorded)
    expect(result.isOutOfOrder).toBe(false)
    expect(result.skippedCount).toBe(0)
  })
})

// ============================================
// INTEGRATION: Paired milestone order checks
// ============================================

describe('checkMilestoneOrder — paired milestones', () => {
  const milestoneTypes = buildMilestoneTypes()

  it('should include paired end milestones in predecessor check', () => {
    // Recording prep_start (order 3) when anes_end (order 2) is not recorded
    const caseMilestones = [
      recorded('fm-patient-in'),
      recorded('fm-anes-start'),
      // anes_end NOT recorded
    ]
    const result = checkMilestoneOrder('fm-prep-start', milestoneTypes, caseMilestones)
    expect(result.isOutOfOrder).toBe(true)
    expect(result.skippedCount).toBe(1) // anes_end
  })

  it('should pass when paired end milestone is recorded', () => {
    const caseMilestones = [
      recorded('fm-patient-in'),
      recorded('fm-anes-start'),
      recorded('fm-anes-end'),
    ]
    const result = checkMilestoneOrder('fm-prep-start', milestoneTypes, caseMilestones)
    expect(result.isOutOfOrder).toBe(false)
    expect(result.skippedCount).toBe(0)
  })

  it('should correctly count when completing a paired end milestone out of order', () => {
    // Completing anes_end (order 2) directly, but patient_in (order 0) is missing
    const caseMilestones = [
      // patient_in NOT recorded
      recorded('fm-anes-start'),
    ]
    const result = checkMilestoneOrder('fm-anes-end', milestoneTypes, caseMilestones)
    expect(result.isOutOfOrder).toBe(true)
    expect(result.skippedCount).toBe(1) // patient_in
  })

  it('should check both paired start and end predecessors for incision', () => {
    // Recording incision (order 5) with only patient_in recorded
    // Missing: anes_start(1), anes_end(2), prep_start(3), prep_end(4)
    const caseMilestones = [recorded('fm-patient-in')]
    const result = checkMilestoneOrder('fm-incision', milestoneTypes, caseMilestones)
    expect(result.isOutOfOrder).toBe(true)
    expect(result.skippedCount).toBe(4)
  })
})

// ============================================
// INTEGRATION: Warning message content
// ============================================

describe('checkMilestoneOrder — warning message construction', () => {
  const milestoneTypes = buildMilestoneTypes()

  it('should produce singular "milestone" for 1 skipped', () => {
    const caseMilestones = [recorded('fm-patient-in')]
    const { skippedCount } = checkMilestoneOrder('fm-anes-end', milestoneTypes, caseMilestones)
    const pluralSuffix = skippedCount === 1 ? '' : 's'
    expect(`${skippedCount} earlier milestone${pluralSuffix}`).toBe('1 earlier milestone')
  })

  it('should produce plural "milestones" for 3 skipped', () => {
    const caseMilestones = [recorded('fm-patient-in'), recorded('fm-anes-start')]
    const { skippedCount } = checkMilestoneOrder('fm-incision', milestoneTypes, caseMilestones)
    const pluralSuffix = skippedCount === 1 ? '' : 's'
    expect(`${skippedCount} earlier milestone${pluralSuffix}`).toBe('3 earlier milestones')
  })
})

// ============================================
// WORKFLOW: Full case recording scenarios
// ============================================

describe('checkMilestoneOrder — full case workflows', () => {
  const milestoneTypes = buildMilestoneTypes()

  it('should allow sequential in-order recording of entire case', () => {
    const caseMilestones: RecordedMilestoneForOrder[] = []

    // Record each milestone in order — none should trigger warning
    for (const mt of milestoneTypes) {
      const result = checkMilestoneOrder(mt.id, milestoneTypes, caseMilestones)
      expect(result.isOutOfOrder).toBe(false)
      expect(result.skippedCount).toBe(0)
      // Simulate recording
      caseMilestones.push(recorded(mt.id))
    }
  })

  it('should detect out-of-order then allow after override in a real scenario', () => {
    const caseMilestones: RecordedMilestoneForOrder[] = []

    // Step 1: Record patient_in — in order
    let result = checkMilestoneOrder('fm-patient-in', milestoneTypes, caseMilestones)
    expect(result.isOutOfOrder).toBe(false)
    caseMilestones.push(recorded('fm-patient-in'))

    // Step 2: Skip to incision — out of order (4 skipped)
    result = checkMilestoneOrder('fm-incision', milestoneTypes, caseMilestones)
    expect(result.isOutOfOrder).toBe(true)
    expect(result.skippedCount).toBe(4)

    // Step 3: User overrides — record incision anyway
    caseMilestones.push(recorded('fm-incision'))

    // Step 4: Go back and record anes_start — still out of order?
    // No — anes_start (order 1) only needs patient_in (order 0) which is recorded
    result = checkMilestoneOrder('fm-anes-start', milestoneTypes, caseMilestones)
    expect(result.isOutOfOrder).toBe(false)

    // Step 5: Record closing — anes_start, anes_end, prep_start, prep_end still missing
    result = checkMilestoneOrder('fm-closing', milestoneTypes, caseMilestones)
    expect(result.isOutOfOrder).toBe(true)
    expect(result.skippedCount).toBe(4) // anes_start, anes_end, prep_start, prep_end
  })

  it('should handle undo then re-record correctly', () => {
    const caseMilestones: RecordedMilestoneForOrder[] = [
      recorded('fm-patient-in'),
      recorded('fm-anes-start'),
      recorded('fm-anes-end'),
    ]

    // Recording prep_start — in order
    let result = checkMilestoneOrder('fm-prep-start', milestoneTypes, caseMilestones)
    expect(result.isOutOfOrder).toBe(false)
    caseMilestones.push(recorded('fm-prep-start'))

    // Undo anes_end (set to null)
    const anesEnd = caseMilestones.find(cm => cm.facility_milestone_id === 'fm-anes-end')!
    anesEnd.recorded_at = null

    // Now recording prep_end — anes_end is null, so it's out of order
    result = checkMilestoneOrder('fm-prep-end', milestoneTypes, caseMilestones)
    expect(result.isOutOfOrder).toBe(true)
    expect(result.skippedCount).toBe(1) // anes_end (now null)

    // Re-record anes_end
    anesEnd.recorded_at = '2025-01-15T08:15:00Z'

    // Now prep_end is in order
    result = checkMilestoneOrder('fm-prep-end', milestoneTypes, caseMilestones)
    expect(result.isOutOfOrder).toBe(false)
  })

  it('should handle case with only 2 milestones configured', () => {
    const shortTypes: MilestoneTypeForOrder[] = [
      { id: 'fm-start', display_name: 'Start', display_order: 0 },
      { id: 'fm-end', display_name: 'End', display_order: 1 },
    ]

    // Record end without start — out of order
    let result = checkMilestoneOrder('fm-end', shortTypes, [])
    expect(result.isOutOfOrder).toBe(true)
    expect(result.skippedCount).toBe(1)

    // Record start — in order
    result = checkMilestoneOrder('fm-start', shortTypes, [])
    expect(result.isOutOfOrder).toBe(false)
  })
})
