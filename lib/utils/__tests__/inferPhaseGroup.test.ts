// lib/utils/__tests__/inferPhaseGroup.test.ts
import { describe, it, expect } from 'vitest'
import {
  inferPhaseGroup,
  PHASE_GROUP_OPTIONS,
  PHASE_GROUP_LABELS,
  type PhaseGroup,
} from '../inferPhaseGroup'

describe('inferPhaseGroup', () => {
  describe('Pre-Op milestones', () => {
    it('returns pre_op for patient_in', () => {
      expect(inferPhaseGroup('patient_in')).toBe('pre_op')
    })

    it('returns pre_op for anes_start', () => {
      expect(inferPhaseGroup('anes_start')).toBe('pre_op')
    })

    it('returns pre_op for anes_end', () => {
      expect(inferPhaseGroup('anes_end')).toBe('pre_op')
    })

    it('returns pre_op for prep_drape_start', () => {
      expect(inferPhaseGroup('prep_drape_start')).toBe('pre_op')
    })

    it('returns pre_op for prep_drape_complete', () => {
      expect(inferPhaseGroup('prep_drape_complete')).toBe('pre_op')
    })
  })

  describe('Surgical milestones', () => {
    it('returns surgical for incision', () => {
      expect(inferPhaseGroup('incision')).toBe('surgical')
    })
  })

  describe('Closing milestones', () => {
    it('returns closing for closing', () => {
      expect(inferPhaseGroup('closing')).toBe('closing')
    })

    it('returns closing for closing_complete', () => {
      expect(inferPhaseGroup('closing_complete')).toBe('closing')
    })

    it('returns closing for surgeon_left', () => {
      expect(inferPhaseGroup('surgeon_left')).toBe('closing')
    })
  })

  describe('Post-Op milestones', () => {
    it('returns post_op for patient_out', () => {
      expect(inferPhaseGroup('patient_out')).toBe('post_op')
    })

    it('returns post_op for room_cleaned', () => {
      expect(inferPhaseGroup('room_cleaned')).toBe('post_op')
    })
  })

  describe('Unrecognized milestones', () => {
    it('returns null for unknown milestone name', () => {
      expect(inferPhaseGroup('custom_milestone')).toBeNull()
    })

    it('returns null for empty string', () => {
      expect(inferPhaseGroup('')).toBeNull()
    })

    it('returns null for arbitrary text', () => {
      expect(inferPhaseGroup('some_random_name')).toBeNull()
    })
  })

  describe('Case insensitivity', () => {
    it('handles uppercase names', () => {
      expect(inferPhaseGroup('PATIENT_IN')).toBe('pre_op')
      expect(inferPhaseGroup('INCISION')).toBe('surgical')
      expect(inferPhaseGroup('CLOSING')).toBe('closing')
      expect(inferPhaseGroup('PATIENT_OUT')).toBe('post_op')
    })

    it('handles mixed case names', () => {
      expect(inferPhaseGroup('Patient_In')).toBe('pre_op')
      expect(inferPhaseGroup('Incision')).toBe('surgical')
      expect(inferPhaseGroup('Closing_Complete')).toBe('closing')
      expect(inferPhaseGroup('Room_Cleaned')).toBe('post_op')
    })

    it('trims whitespace', () => {
      expect(inferPhaseGroup('  patient_in  ')).toBe('pre_op')
      expect(inferPhaseGroup('  incision  ')).toBe('surgical')
      expect(inferPhaseGroup('  closing  ')).toBe('closing')
      expect(inferPhaseGroup('  patient_out  ')).toBe('post_op')
    })
  })
})

describe('PHASE_GROUP_OPTIONS', () => {
  it('has exactly 4 entries', () => {
    expect(PHASE_GROUP_OPTIONS).toHaveLength(4)
  })

  it('contains all phase groups', () => {
    const values = PHASE_GROUP_OPTIONS.map((opt) => opt.value)
    expect(values).toContain('pre_op')
    expect(values).toContain('surgical')
    expect(values).toContain('closing')
    expect(values).toContain('post_op')
  })

  it('has correct labels', () => {
    expect(PHASE_GROUP_OPTIONS[0]).toEqual({ value: 'pre_op', label: 'Pre-Op' })
    expect(PHASE_GROUP_OPTIONS[1]).toEqual({
      value: 'surgical',
      label: 'Surgical',
    })
    expect(PHASE_GROUP_OPTIONS[2]).toEqual({ value: 'closing', label: 'Closing' })
    expect(PHASE_GROUP_OPTIONS[3]).toEqual({
      value: 'post_op',
      label: 'Post-Op',
    })
  })
})

describe('PHASE_GROUP_LABELS', () => {
  it('has correct mapping for pre_op', () => {
    expect(PHASE_GROUP_LABELS.pre_op).toBe('Pre-Op')
  })

  it('has correct mapping for surgical', () => {
    expect(PHASE_GROUP_LABELS.surgical).toBe('Surgical')
  })

  it('has correct mapping for closing', () => {
    expect(PHASE_GROUP_LABELS.closing).toBe('Closing')
  })

  it('has correct mapping for post_op', () => {
    expect(PHASE_GROUP_LABELS.post_op).toBe('Post-Op')
  })

  it('has all phase groups as keys', () => {
    const keys = Object.keys(PHASE_GROUP_LABELS) as PhaseGroup[]
    expect(keys).toHaveLength(4)
    expect(keys).toContain('pre_op')
    expect(keys).toContain('surgical')
    expect(keys).toContain('closing')
    expect(keys).toContain('post_op')
  })
})
