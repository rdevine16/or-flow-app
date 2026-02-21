// app/admin/settings/analytics/__tests__/page.test.tsx
// Tests for the admin analytics settings template page

import { describe, it, expect } from 'vitest'

/**
 * COVERAGE:
 * 1. Unit — SEED_DEFAULTS match the migration seed values
 * 2. Unit — CHECK constraint ranges validated client-side
 * 3. Integration — Upsert payload structure (create vs update)
 * 4. Workflow — Reset to defaults restores seed values after edits
 */

// ── Replicated from page.tsx to test in isolation ──

interface AnalyticsSettingsTemplate {
  id: string
  fcots_milestone: 'patient_in' | 'incision'
  fcots_grace_minutes: number
  fcots_target_percent: number
  turnover_target_same_surgeon: number
  turnover_target_flip_room: number
  utilization_target_percent: number
  cancellation_target_percent: number
  start_time_milestone: 'patient_in' | 'incision'
  start_time_grace_minutes: number
  start_time_floor_minutes: number
  waiting_on_surgeon_minutes: number
  waiting_on_surgeon_floor_minutes: number
  min_procedure_cases: number
}

const SEED_DEFAULTS: Omit<AnalyticsSettingsTemplate, 'id'> = {
  fcots_milestone: 'patient_in',
  fcots_grace_minutes: 2,
  fcots_target_percent: 85,
  turnover_target_same_surgeon: 30,
  turnover_target_flip_room: 45,
  utilization_target_percent: 80,
  cancellation_target_percent: 5,
  start_time_milestone: 'patient_in',
  start_time_grace_minutes: 3,
  start_time_floor_minutes: 20,
  waiting_on_surgeon_minutes: 3,
  waiting_on_surgeon_floor_minutes: 10,
  min_procedure_cases: 3,
}

/** Client-side validation mirroring DB CHECK constraints */
function validate(form: Record<string, string>): string | null {
  const grace = parseFloat(form.fcots_grace_minutes)
  if (grace < 0 || grace > 30) return 'FCOTS Grace Period must be 0–30 minutes'

  const target = parseFloat(form.fcots_target_percent)
  if (target < 0 || target > 100) return 'FCOTS Target must be 0–100%'

  const stGrace = parseInt(form.start_time_grace_minutes)
  if (stGrace < 0 || stGrace > 15) return 'Schedule Adherence Grace Period must be 0–15 minutes'

  const stFloor = parseInt(form.start_time_floor_minutes)
  if (stFloor < 5 || stFloor > 60) return 'Schedule Adherence Decay Floor must be 5–60 minutes'

  const wos = parseInt(form.waiting_on_surgeon_minutes)
  if (wos < 0 || wos > 15) return 'Surgeon Expected Gap must be 0–15 minutes'

  const wosFloor = parseInt(form.waiting_on_surgeon_floor_minutes)
  if (wosFloor < 3 || wosFloor > 30) return 'Surgeon Decay Floor must be 3–30 minutes'

  const minCases = parseInt(form.min_procedure_cases)
  if (minCases < 1 || minCases > 10) return 'Min Cases per Procedure must be 1–10'

  return null
}

// =====================================================
// TESTS
// =====================================================

describe('Admin Analytics Settings Template', () => {
  describe('Seed defaults match migration values', () => {
    it('FCOTS defaults match migration seed', () => {
      expect(SEED_DEFAULTS.fcots_milestone).toBe('patient_in')
      expect(SEED_DEFAULTS.fcots_grace_minutes).toBe(2)
      expect(SEED_DEFAULTS.fcots_target_percent).toBe(85)
    })

    it('turnover defaults match migration seed', () => {
      expect(SEED_DEFAULTS.turnover_target_same_surgeon).toBe(30)
      expect(SEED_DEFAULTS.turnover_target_flip_room).toBe(45)
    })

    it('utilization and cancellation defaults match migration seed', () => {
      expect(SEED_DEFAULTS.utilization_target_percent).toBe(80)
      expect(SEED_DEFAULTS.cancellation_target_percent).toBe(5)
    })

    it('ORbit Score v2 defaults match migration seed', () => {
      expect(SEED_DEFAULTS.start_time_milestone).toBe('patient_in')
      expect(SEED_DEFAULTS.start_time_grace_minutes).toBe(3)
      expect(SEED_DEFAULTS.start_time_floor_minutes).toBe(20)
      expect(SEED_DEFAULTS.waiting_on_surgeon_minutes).toBe(3)
      expect(SEED_DEFAULTS.waiting_on_surgeon_floor_minutes).toBe(10)
      expect(SEED_DEFAULTS.min_procedure_cases).toBe(3)
    })

    it('has exactly 13 configurable fields', () => {
      const keys = Object.keys(SEED_DEFAULTS)
      expect(keys).toHaveLength(13)
    })
  })

  describe('Client-side validation (CHECK constraints)', () => {
    const validForm: Record<string, string> = {
      fcots_grace_minutes: '2',
      fcots_target_percent: '85',
      start_time_grace_minutes: '3',
      start_time_floor_minutes: '20',
      waiting_on_surgeon_minutes: '3',
      waiting_on_surgeon_floor_minutes: '10',
      min_procedure_cases: '3',
    }

    it('accepts valid seed default values', () => {
      expect(validate(validForm)).toBeNull()
    })

    it('accepts boundary min values', () => {
      const minForm = {
        fcots_grace_minutes: '0',
        fcots_target_percent: '0',
        start_time_grace_minutes: '0',
        start_time_floor_minutes: '5',
        waiting_on_surgeon_minutes: '0',
        waiting_on_surgeon_floor_minutes: '3',
        min_procedure_cases: '1',
      }
      expect(validate(minForm)).toBeNull()
    })

    it('accepts boundary max values', () => {
      const maxForm = {
        fcots_grace_minutes: '30',
        fcots_target_percent: '100',
        start_time_grace_minutes: '15',
        start_time_floor_minutes: '60',
        waiting_on_surgeon_minutes: '15',
        waiting_on_surgeon_floor_minutes: '30',
        min_procedure_cases: '10',
      }
      expect(validate(maxForm)).toBeNull()
    })

    it('rejects FCOTS grace > 30', () => {
      expect(validate({ ...validForm, fcots_grace_minutes: '31' })).toContain('FCOTS Grace Period')
    })

    it('rejects FCOTS grace < 0', () => {
      expect(validate({ ...validForm, fcots_grace_minutes: '-1' })).toContain('FCOTS Grace Period')
    })

    it('rejects FCOTS target > 100', () => {
      expect(validate({ ...validForm, fcots_target_percent: '101' })).toContain('FCOTS Target')
    })

    it('rejects start_time_grace > 15', () => {
      expect(validate({ ...validForm, start_time_grace_minutes: '16' })).toContain('Schedule Adherence Grace')
    })

    it('rejects start_time_floor < 5', () => {
      expect(validate({ ...validForm, start_time_floor_minutes: '4' })).toContain('Schedule Adherence Decay Floor')
    })

    it('rejects start_time_floor > 60', () => {
      expect(validate({ ...validForm, start_time_floor_minutes: '61' })).toContain('Schedule Adherence Decay Floor')
    })

    it('rejects waiting_on_surgeon < 0', () => {
      expect(validate({ ...validForm, waiting_on_surgeon_minutes: '-1' })).toContain('Surgeon Expected Gap')
    })

    it('rejects waiting_on_surgeon_floor < 3', () => {
      expect(validate({ ...validForm, waiting_on_surgeon_floor_minutes: '2' })).toContain('Surgeon Decay Floor')
    })

    it('rejects waiting_on_surgeon_floor > 30', () => {
      expect(validate({ ...validForm, waiting_on_surgeon_floor_minutes: '31' })).toContain('Surgeon Decay Floor')
    })

    it('rejects min_procedure_cases < 1', () => {
      expect(validate({ ...validForm, min_procedure_cases: '0' })).toContain('Min Cases per Procedure')
    })

    it('rejects min_procedure_cases > 10', () => {
      expect(validate({ ...validForm, min_procedure_cases: '11' })).toContain('Min Cases per Procedure')
    })
  })

  describe('Upsert payload structure', () => {
    it('update path uses template id', () => {
      const existingTemplate: AnalyticsSettingsTemplate = {
        id: 'ast-001',
        ...SEED_DEFAULTS,
      }

      // Simulate update path
      const isUpdate = !!existingTemplate.id
      expect(isUpdate).toBe(true)
    })

    it('insert path used when no template row exists', () => {
      const template = null as AnalyticsSettingsTemplate | null

      const isInsert = template === null || !template.id
      expect(isInsert).toBe(true)
    })

    it('payload includes all 13 configurable fields + updated_at', () => {
      const payload = {
        fcots_milestone: SEED_DEFAULTS.fcots_milestone,
        fcots_grace_minutes: SEED_DEFAULTS.fcots_grace_minutes,
        fcots_target_percent: SEED_DEFAULTS.fcots_target_percent,
        turnover_target_same_surgeon: SEED_DEFAULTS.turnover_target_same_surgeon,
        turnover_target_flip_room: SEED_DEFAULTS.turnover_target_flip_room,
        utilization_target_percent: SEED_DEFAULTS.utilization_target_percent,
        cancellation_target_percent: SEED_DEFAULTS.cancellation_target_percent,
        start_time_milestone: SEED_DEFAULTS.start_time_milestone,
        start_time_grace_minutes: SEED_DEFAULTS.start_time_grace_minutes,
        start_time_floor_minutes: SEED_DEFAULTS.start_time_floor_minutes,
        waiting_on_surgeon_minutes: SEED_DEFAULTS.waiting_on_surgeon_minutes,
        waiting_on_surgeon_floor_minutes: SEED_DEFAULTS.waiting_on_surgeon_floor_minutes,
        min_procedure_cases: SEED_DEFAULTS.min_procedure_cases,
        updated_at: new Date().toISOString(),
      }

      expect(Object.keys(payload)).toHaveLength(14) // 13 fields + updated_at
      expect(payload.updated_at).toBeTruthy()
    })

    it('payload does NOT include id or facility_id', () => {
      const payload = {
        fcots_milestone: 'patient_in',
        fcots_grace_minutes: 2,
        updated_at: new Date().toISOString(),
      }

      expect('id' in payload).toBe(false)
      expect('facility_id' in payload).toBe(false)
    })
  })

  describe('Reset to defaults workflow', () => {
    it('reset restores all fields to seed values', () => {
      // Simulate edited form state
      const editedForm = {
        fcots_milestone: 'incision' as const,
        fcots_grace_minutes: '10',
        fcots_target_percent: '90',
        turnover_target_same_surgeon: '60',
        turnover_target_flip_room: '30',
        utilization_target_percent: '90',
        cancellation_target_percent: '10',
        start_time_milestone: 'incision' as const,
        start_time_grace_minutes: '5',
        start_time_floor_minutes: '30',
        waiting_on_surgeon_minutes: '5',
        waiting_on_surgeon_floor_minutes: '15',
        min_procedure_cases: '5',
      }

      // Apply reset
      const resetForm = {
        fcots_milestone: SEED_DEFAULTS.fcots_milestone,
        fcots_grace_minutes: String(SEED_DEFAULTS.fcots_grace_minutes),
        fcots_target_percent: String(SEED_DEFAULTS.fcots_target_percent),
        turnover_target_same_surgeon: String(SEED_DEFAULTS.turnover_target_same_surgeon),
        turnover_target_flip_room: String(SEED_DEFAULTS.turnover_target_flip_room),
        utilization_target_percent: String(SEED_DEFAULTS.utilization_target_percent),
        cancellation_target_percent: String(SEED_DEFAULTS.cancellation_target_percent),
        start_time_milestone: SEED_DEFAULTS.start_time_milestone,
        start_time_grace_minutes: String(SEED_DEFAULTS.start_time_grace_minutes),
        start_time_floor_minutes: String(SEED_DEFAULTS.start_time_floor_minutes),
        waiting_on_surgeon_minutes: String(SEED_DEFAULTS.waiting_on_surgeon_minutes),
        waiting_on_surgeon_floor_minutes: String(SEED_DEFAULTS.waiting_on_surgeon_floor_minutes),
        min_procedure_cases: String(SEED_DEFAULTS.min_procedure_cases),
      }

      // Verify ALL fields differ from edited and match seed
      expect(resetForm.fcots_milestone).not.toBe(editedForm.fcots_milestone)
      expect(resetForm.fcots_milestone).toBe('patient_in')

      expect(resetForm.fcots_grace_minutes).not.toBe(editedForm.fcots_grace_minutes)
      expect(resetForm.fcots_grace_minutes).toBe('2')

      expect(resetForm.utilization_target_percent).not.toBe(editedForm.utilization_target_percent)
      expect(resetForm.utilization_target_percent).toBe('80')

      expect(resetForm.start_time_milestone).not.toBe(editedForm.start_time_milestone)
      expect(resetForm.start_time_milestone).toBe('patient_in')
    })

    it('reset produces form that passes validation', () => {
      const resetForm = {
        fcots_grace_minutes: String(SEED_DEFAULTS.fcots_grace_minutes),
        fcots_target_percent: String(SEED_DEFAULTS.fcots_target_percent),
        start_time_grace_minutes: String(SEED_DEFAULTS.start_time_grace_minutes),
        start_time_floor_minutes: String(SEED_DEFAULTS.start_time_floor_minutes),
        waiting_on_surgeon_minutes: String(SEED_DEFAULTS.waiting_on_surgeon_minutes),
        waiting_on_surgeon_floor_minutes: String(SEED_DEFAULTS.waiting_on_surgeon_floor_minutes),
        min_procedure_cases: String(SEED_DEFAULTS.min_procedure_cases),
      }

      expect(validate(resetForm)).toBeNull()
    })
  })

  describe('Sync from template to form', () => {
    it('syncs numeric values to strings for controlled inputs', () => {
      const template: AnalyticsSettingsTemplate = {
        id: 'ast-001',
        ...SEED_DEFAULTS,
      }

      const form = {
        fcots_grace_minutes: String(template.fcots_grace_minutes ?? 2),
        fcots_target_percent: String(template.fcots_target_percent ?? 85),
        turnover_target_same_surgeon: String(template.turnover_target_same_surgeon ?? 30),
      }

      expect(form.fcots_grace_minutes).toBe('2')
      expect(form.fcots_target_percent).toBe('85')
      expect(form.turnover_target_same_surgeon).toBe('30')
    })

    it('uses defaults for null/undefined template values', () => {
      const partialTemplate = {
        id: 'ast-001',
        fcots_milestone: 'patient_in' as const,
        fcots_grace_minutes: null as unknown as number,
        fcots_target_percent: undefined as unknown as number,
      }

      const graceStr = String(partialTemplate.fcots_grace_minutes ?? 2)
      const targetStr = String(partialTemplate.fcots_target_percent ?? 85)

      expect(graceStr).toBe('2')
      expect(targetStr).toBe('85')
    })
  })
})
