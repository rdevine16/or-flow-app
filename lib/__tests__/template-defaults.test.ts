// lib/__tests__/template-defaults.test.ts
// Unit tests for template-defaults.ts: Required milestones/phases constants and helper functions.
import { describe, it, expect } from 'vitest'
import {
  REQUIRED_PHASE_NAMES,
  REQUIRED_MILESTONE_NAMES,
  REQUIRED_PHASE_MILESTONES,
  isRequiredMilestone,
  isRequiredPhase,
  getRequiredPhasesForMilestone,
} from '../template-defaults'

describe('template-defaults constants', () => {
  it('REQUIRED_PHASE_NAMES contains all 4 required phases', () => {
    expect(REQUIRED_PHASE_NAMES).toEqual(['pre_op', 'surgical', 'closing', 'post_op'])
  })

  it('REQUIRED_MILESTONE_NAMES contains all 7 unique required milestones', () => {
    expect(REQUIRED_MILESTONE_NAMES).toEqual([
      'patient_in',
      'prep_drape_start',
      'prep_drape_complete',
      'incision',
      'closing',
      'closing_complete',
      'patient_out',
    ])
  })

  it('REQUIRED_PHASE_MILESTONES contains all 4 phases with correct milestones', () => {
    expect(Object.keys(REQUIRED_PHASE_MILESTONES)).toEqual(['pre_op', 'surgical', 'closing', 'post_op'])
    expect(REQUIRED_PHASE_MILESTONES.pre_op).toEqual(['patient_in', 'prep_drape_start', 'prep_drape_complete'])
    expect(REQUIRED_PHASE_MILESTONES.surgical).toEqual(['incision', 'closing'])
    expect(REQUIRED_PHASE_MILESTONES.closing).toEqual(['closing', 'closing_complete'])
    expect(REQUIRED_PHASE_MILESTONES.post_op).toEqual(['closing_complete', 'patient_out'])
  })

  it('REQUIRED_PHASE_MILESTONES has shared boundaries (closing and closing_complete appear in multiple phases)', () => {
    // 'closing' appears in surgical and closing phases
    const closingPhases = Object.entries(REQUIRED_PHASE_MILESTONES)
      .filter(([, milestones]) => milestones.includes('closing'))
      .map(([phase]) => phase)
    expect(closingPhases).toEqual(['surgical', 'closing'])

    // 'closing_complete' appears in closing and post_op phases
    const closingCompletePhases = Object.entries(REQUIRED_PHASE_MILESTONES)
      .filter(([, milestones]) => milestones.includes('closing_complete'))
      .map(([phase]) => phase)
    expect(closingCompletePhases).toEqual(['closing', 'post_op'])
  })

  it('REQUIRED_PHASE_MILESTONES total item count is 9 placements (7 unique milestones with 2 appearing twice as shared boundaries)', () => {
    const totalItems = Object.values(REQUIRED_PHASE_MILESTONES)
      .flat()
      .length
    expect(totalItems).toBe(9)
  })
})

describe('isRequiredMilestone', () => {
  it('returns true for all 7 required milestones', () => {
    expect(isRequiredMilestone('patient_in')).toBe(true)
    expect(isRequiredMilestone('prep_drape_start')).toBe(true)
    expect(isRequiredMilestone('prep_drape_complete')).toBe(true)
    expect(isRequiredMilestone('incision')).toBe(true)
    expect(isRequiredMilestone('closing')).toBe(true)
    expect(isRequiredMilestone('closing_complete')).toBe(true)
    expect(isRequiredMilestone('patient_out')).toBe(true)
  })

  it('returns false for non-required milestones', () => {
    expect(isRequiredMilestone('timeout')).toBe(false)
    expect(isRequiredMilestone('sign_in')).toBe(false)
    expect(isRequiredMilestone('device_setup')).toBe(false)
    expect(isRequiredMilestone('not_a_real_milestone')).toBe(false)
    expect(isRequiredMilestone('')).toBe(false)
  })

  it('is case-sensitive', () => {
    expect(isRequiredMilestone('PATIENT_IN')).toBe(false)
    expect(isRequiredMilestone('Patient_In')).toBe(false)
  })
})

describe('isRequiredPhase', () => {
  it('returns true for all 4 required phases', () => {
    expect(isRequiredPhase('pre_op')).toBe(true)
    expect(isRequiredPhase('surgical')).toBe(true)
    expect(isRequiredPhase('closing')).toBe(true)
    expect(isRequiredPhase('post_op')).toBe(true)
  })

  it('returns false for non-required phases', () => {
    expect(isRequiredPhase('setup')).toBe(false)
    expect(isRequiredPhase('cleanup')).toBe(false)
    expect(isRequiredPhase('not_a_real_phase')).toBe(false)
    expect(isRequiredPhase('')).toBe(false)
  })

  it('is case-sensitive', () => {
    expect(isRequiredPhase('PRE_OP')).toBe(false)
    expect(isRequiredPhase('Pre_Op')).toBe(false)
  })
})

describe('getRequiredPhasesForMilestone', () => {
  it('returns correct phases for patient_in (only pre_op)', () => {
    expect(getRequiredPhasesForMilestone('patient_in')).toEqual(['pre_op'])
  })

  it('returns correct phases for prep_drape_start (only pre_op)', () => {
    expect(getRequiredPhasesForMilestone('prep_drape_start')).toEqual(['pre_op'])
  })

  it('returns correct phases for prep_drape_complete (only pre_op)', () => {
    expect(getRequiredPhasesForMilestone('prep_drape_complete')).toEqual(['pre_op'])
  })

  it('returns correct phases for incision (only surgical)', () => {
    expect(getRequiredPhasesForMilestone('incision')).toEqual(['surgical'])
  })

  it('returns correct phases for closing (surgical and closing)', () => {
    const phases = getRequiredPhasesForMilestone('closing')
    expect(phases).toHaveLength(2)
    expect(phases).toContain('surgical')
    expect(phases).toContain('closing')
  })

  it('returns correct phases for closing_complete (closing and post_op)', () => {
    const phases = getRequiredPhasesForMilestone('closing_complete')
    expect(phases).toHaveLength(2)
    expect(phases).toContain('closing')
    expect(phases).toContain('post_op')
  })

  it('returns correct phases for patient_out (only post_op)', () => {
    expect(getRequiredPhasesForMilestone('patient_out')).toEqual(['post_op'])
  })

  it('returns empty array for non-required milestones', () => {
    expect(getRequiredPhasesForMilestone('timeout')).toEqual([])
    expect(getRequiredPhasesForMilestone('sign_in')).toEqual([])
    expect(getRequiredPhasesForMilestone('not_a_real_milestone')).toEqual([])
    expect(getRequiredPhasesForMilestone('')).toEqual([])
  })

  it('preserves order from REQUIRED_PHASE_MILESTONES', () => {
    // Closing appears in surgical first, then closing
    const closingPhases = getRequiredPhasesForMilestone('closing')
    expect(closingPhases[0]).toBe('surgical')
    expect(closingPhases[1]).toBe('closing')

    // closing_complete appears in closing first, then post_op
    const closingCompletePhases = getRequiredPhasesForMilestone('closing_complete')
    expect(closingCompletePhases[0]).toBe('closing')
    expect(closingCompletePhases[1]).toBe('post_op')
  })
})

describe('edge cases and invariants', () => {
  it('all REQUIRED_MILESTONE_NAMES are found in REQUIRED_PHASE_MILESTONES', () => {
    const allMilestonesInPhases = new Set(
      Object.values(REQUIRED_PHASE_MILESTONES).flat()
    )

    for (const milestone of REQUIRED_MILESTONE_NAMES) {
      expect(allMilestonesInPhases.has(milestone)).toBe(true)
    }
  })

  it('all milestones in REQUIRED_PHASE_MILESTONES are in REQUIRED_MILESTONE_NAMES', () => {
    const allMilestonesInPhases = Object.values(REQUIRED_PHASE_MILESTONES).flat()

    for (const milestone of allMilestonesInPhases) {
      expect(REQUIRED_MILESTONE_NAMES).toContain(milestone as typeof REQUIRED_MILESTONE_NAMES[number])
    }
  })

  it('isRequiredMilestone matches entries in REQUIRED_PHASE_MILESTONES', () => {
    const allMilestonesInPhases = new Set(
      Object.values(REQUIRED_PHASE_MILESTONES).flat()
    )

    // Every milestone in REQUIRED_PHASE_MILESTONES should return true for isRequiredMilestone
    for (const milestone of allMilestonesInPhases) {
      expect(isRequiredMilestone(milestone)).toBe(true)
    }
  })

  it('isRequiredPhase matches keys in REQUIRED_PHASE_MILESTONES', () => {
    const allPhases = Object.keys(REQUIRED_PHASE_MILESTONES)

    for (const phase of allPhases) {
      expect(isRequiredPhase(phase)).toBe(true)
    }
  })

  it('getRequiredPhasesForMilestone never returns phases not in REQUIRED_PHASE_NAMES', () => {
    for (const milestone of REQUIRED_MILESTONE_NAMES) {
      const phases = getRequiredPhasesForMilestone(milestone)
      for (const phase of phases) {
        expect(REQUIRED_PHASE_NAMES).toContain(phase as typeof REQUIRED_PHASE_NAMES[number])
      }
    }
  })
})
