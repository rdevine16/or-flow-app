import { describe, it, expect } from 'vitest'
import { createCaseSchema, validateField } from '../schemas'

describe('createCaseSchema — Phase 1.3', () => {
  const validData = {
    case_number: 'C-2025-001',
    scheduled_date: '2026-03-15',
    start_time: '07:30',
    surgeon_id: 'some-surgeon-id',
    procedure_type_id: 'some-procedure-id',
    or_room_id: 'some-room-id',
    status_id: 'some-status-id',
    anesthesiologist_id: '',
    operative_side: '',
    payer_id: '',
    notes: '',
  }

  it('accepts valid case data', () => {
    const result = createCaseSchema.safeParse(validData)
    expect(result.success).toBe(true)
  })

  it('rejects empty case_number', () => {
    const result = createCaseSchema.safeParse({ ...validData, case_number: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const field = result.error.issues.find(i => i.path[0] === 'case_number')
      expect(field?.message).toBe('Case number is required')
    }
  })

  it('rejects case_number over 50 chars', () => {
    const result = createCaseSchema.safeParse({ ...validData, case_number: 'x'.repeat(51) })
    expect(result.success).toBe(false)
  })

  it('rejects empty scheduled_date', () => {
    const result = createCaseSchema.safeParse({ ...validData, scheduled_date: '' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid date format', () => {
    const result = createCaseSchema.safeParse({ ...validData, scheduled_date: '03/15/2026' })
    expect(result.success).toBe(false)
  })

  it('rejects empty start_time', () => {
    const result = createCaseSchema.safeParse({ ...validData, start_time: '' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid time format', () => {
    const result = createCaseSchema.safeParse({ ...validData, start_time: '25:00' })
    expect(result.success).toBe(false)
  })

  it('rejects empty surgeon_id', () => {
    const result = createCaseSchema.safeParse({ ...validData, surgeon_id: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const field = result.error.issues.find(i => i.path[0] === 'surgeon_id')
      expect(field?.message).toBe('Surgeon is required')
    }
  })

  it('rejects empty procedure_type_id', () => {
    const result = createCaseSchema.safeParse({ ...validData, procedure_type_id: '' })
    expect(result.success).toBe(false)
  })

  it('rejects empty or_room_id', () => {
    const result = createCaseSchema.safeParse({ ...validData, or_room_id: '' })
    expect(result.success).toBe(false)
  })

  it('accepts empty optional fields', () => {
    const result = createCaseSchema.safeParse({
      ...validData,
      anesthesiologist_id: '',
      operative_side: '',
      payer_id: '',
      notes: '',
    })
    expect(result.success).toBe(true)
  })

  it('accepts valid operative side values', () => {
    for (const side of ['left', 'right', 'bilateral', 'n/a']) {
      const result = createCaseSchema.safeParse({ ...validData, operative_side: side })
      expect(result.success).toBe(true)
    }
  })

  it('rejects notes over 1000 characters', () => {
    const result = createCaseSchema.safeParse({ ...validData, notes: 'x'.repeat(1001) })
    expect(result.success).toBe(false)
  })
})

describe('validateField — Phase 1.3', () => {
  it('returns null for a valid field value', () => {
    const error = validateField(createCaseSchema, 'case_number', 'C-001')
    expect(error).toBeNull()
  })

  it('returns error message for an empty required field', () => {
    const error = validateField(createCaseSchema, 'case_number', '')
    expect(error).toBe('Case number is required')
  })

  it('returns error for invalid date format', () => {
    const error = validateField(createCaseSchema, 'scheduled_date', '2026/03/15')
    expect(error).toBe('Date must be YYYY-MM-DD format')
  })

  it('returns null for unknown field name', () => {
    const error = validateField(createCaseSchema, 'nonexistent_field', 'any value')
    expect(error).toBeNull()
  })

  it('returns null for valid optional empty string', () => {
    const error = validateField(createCaseSchema, 'notes', '')
    expect(error).toBeNull()
  })
})
