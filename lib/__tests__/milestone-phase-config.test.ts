// lib/__tests__/milestone-phase-config.test.ts
import { describe, it, expect } from 'vitest'
import {
  PHASE_ORDER,
  PHASE_CONFIG_MAP,
  UNASSIGNED_PHASE,
  type PhaseConfig,
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
})
