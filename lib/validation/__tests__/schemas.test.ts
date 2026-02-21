import { describe, it, expect } from 'vitest'
import { createCaseSchema, bulkCaseRowSchema, bulkCaseSubmissionSchema, recordMilestoneSchema, draftCaseSchema, validateField } from '../schemas'

describe('createCaseSchema — Phase 1.3', () => {
  const validData = {
    case_number: 'C-2025-001',
    scheduled_date: '2026-03-15',
    start_time: '07:30',
    surgeon_id: 'some-surgeon-id',
    procedure_type_id: 'some-procedure-id',
    or_room_id: 'some-room-id',
    status_id: 'some-status-id',
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

// ============================================
// BULK CASE SCHEMAS — Phase 4.1
// ============================================

describe('bulkCaseRowSchema — Phase 4.1', () => {
  const validRow = {
    case_number: 'C-2026-010',
    start_time: '07:30',
    procedure_type_id: 'proc-1',
    or_room_id: 'room-1',
    operative_side: 'left',
    implant_company_ids: [],
    rep_required_override: null,
  }

  it('accepts a valid row', () => {
    const result = bulkCaseRowSchema.safeParse(validRow)
    expect(result.success).toBe(true)
  })

  it('rejects empty case_number', () => {
    const result = bulkCaseRowSchema.safeParse({ ...validRow, case_number: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const field = result.error.issues.find(i => i.path[0] === 'case_number')
      expect(field?.message).toBe('Case number is required')
    }
  })

  it('rejects empty start_time', () => {
    const result = bulkCaseRowSchema.safeParse({ ...validRow, start_time: '' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid time format', () => {
    const result = bulkCaseRowSchema.safeParse({ ...validRow, start_time: '25:00' })
    expect(result.success).toBe(false)
  })

  it('rejects empty procedure_type_id', () => {
    const result = bulkCaseRowSchema.safeParse({ ...validRow, procedure_type_id: '' })
    expect(result.success).toBe(false)
  })

  it('rejects empty or_room_id', () => {
    const result = bulkCaseRowSchema.safeParse({ ...validRow, or_room_id: '' })
    expect(result.success).toBe(false)
  })

  it('accepts all valid operative side values', () => {
    for (const side of ['left', 'right', 'bilateral', 'n/a', '']) {
      const result = bulkCaseRowSchema.safeParse({ ...validRow, operative_side: side })
      expect(result.success).toBe(true)
    }
  })

  it('accepts row without optional fields', () => {
    const minimal = {
      case_number: 'C-001',
      start_time: '08:00',
      procedure_type_id: 'proc-1',
      or_room_id: 'room-1',
    }
    const result = bulkCaseRowSchema.safeParse(minimal)
    expect(result.success).toBe(true)
  })

  it('accepts implant_company_ids array', () => {
    const result = bulkCaseRowSchema.safeParse({
      ...validRow,
      implant_company_ids: ['company-1', 'company-2'],
    })
    expect(result.success).toBe(true)
  })
})

describe('bulkCaseSubmissionSchema — Phase 4.1', () => {
  const validRow = {
    case_number: 'C-2026-010',
    start_time: '07:30',
    procedure_type_id: 'proc-1',
    or_room_id: 'room-1',
  }

  const validSubmission = {
    scheduled_date: '2026-03-15',
    surgeon_id: 'surgeon-1',
    rows: [validRow],
  }

  it('accepts a valid submission with one row', () => {
    const result = bulkCaseSubmissionSchema.safeParse(validSubmission)
    expect(result.success).toBe(true)
  })

  it('accepts a valid submission with multiple rows', () => {
    const result = bulkCaseSubmissionSchema.safeParse({
      ...validSubmission,
      rows: [
        { ...validRow, case_number: 'C-001', start_time: '07:00' },
        { ...validRow, case_number: 'C-002', start_time: '08:00' },
        { ...validRow, case_number: 'C-003', start_time: '09:00' },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty scheduled_date', () => {
    const result = bulkCaseSubmissionSchema.safeParse({
      ...validSubmission,
      scheduled_date: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty surgeon_id', () => {
    const result = bulkCaseSubmissionSchema.safeParse({
      ...validSubmission,
      surgeon_id: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty rows array', () => {
    const result = bulkCaseSubmissionSchema.safeParse({
      ...validSubmission,
      rows: [],
    })
    expect(result.success).toBe(false)
  })

  it('rejects more than 20 rows', () => {
    const rows = Array.from({ length: 21 }, (_, i) => ({
      ...validRow,
      case_number: `C-${i}`,
    }))
    const result = bulkCaseSubmissionSchema.safeParse({
      ...validSubmission,
      rows,
    })
    expect(result.success).toBe(false)
  })

  it('rejects submission when any row is invalid', () => {
    const result = bulkCaseSubmissionSchema.safeParse({
      ...validSubmission,
      rows: [
        validRow,
        { ...validRow, case_number: '', start_time: '' }, // invalid row
      ],
    })
    expect(result.success).toBe(false)
  })

  it('validates nested row fields correctly', () => {
    const result = bulkCaseSubmissionSchema.safeParse({
      ...validSubmission,
      rows: [{ ...validRow, start_time: '25:00' }], // invalid time
    })
    expect(result.success).toBe(false)
  })
})

// ============================================
// MILESTONE SCHEMA — Phase 5.3
// ============================================

describe('recordMilestoneSchema — Phase 5.3', () => {
  // UUIDs must have valid version (pos 13 = 1-8) and variant (pos 17 = 8,9,a,b)
  const validMilestone = {
    case_id: 'a1111111-1111-4111-a111-111111111111',
    facility_milestone_id: 'b2222222-2222-4222-b222-222222222222',
    timestamp: '2026-03-15T07:30:00.000Z',
  }

  it('accepts valid milestone recording with facility_milestone_id', () => {
    const result = recordMilestoneSchema.safeParse(validMilestone)
    expect(result.success).toBe(true)
  })

  it('uses facility_milestone_id not milestone_id or milestone_type_id', () => {
    const result = recordMilestoneSchema.safeParse(validMilestone)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.facility_milestone_id).toBe(validMilestone.facility_milestone_id)
      expect('milestone_id' in result.data).toBe(false)
      expect('milestone_type_id' in result.data).toBe(false)
    }
  })

  it('rejects non-UUID case_id', () => {
    const result = recordMilestoneSchema.safeParse({ ...validMilestone, case_id: 'not-a-uuid' })
    expect(result.success).toBe(false)
  })

  it('rejects non-UUID facility_milestone_id', () => {
    const result = recordMilestoneSchema.safeParse({ ...validMilestone, facility_milestone_id: 'not-a-uuid' })
    expect(result.success).toBe(false)
  })

  it('rejects non-ISO timestamp', () => {
    const result = recordMilestoneSchema.safeParse({ ...validMilestone, timestamp: '2026-03-15 07:30:00' })
    expect(result.success).toBe(false)
  })

  it('accepts optional recorded_by and notes', () => {
    const result = recordMilestoneSchema.safeParse({
      ...validMilestone,
      recorded_by: 'c3333333-3333-4333-b333-333333333333',
      notes: 'Patient arrived late',
    })
    expect(result.success).toBe(true)
  })

  it('rejects notes over 500 characters', () => {
    const result = recordMilestoneSchema.safeParse({
      ...validMilestone,
      notes: 'x'.repeat(501),
    })
    expect(result.success).toBe(false)
  })
})

// ============================================
// DRAFT CASE SCHEMA — Phase 5.3
// ============================================

describe('draftCaseSchema — Phase 5.3', () => {
  it('requires only scheduled_date', () => {
    const result = draftCaseSchema.safeParse({ scheduled_date: '2026-03-15' })
    expect(result.success).toBe(true)
  })

  it('rejects empty scheduled_date', () => {
    const result = draftCaseSchema.safeParse({ scheduled_date: '' })
    expect(result.success).toBe(false)
  })

  it('accepts all fields as empty strings', () => {
    const result = draftCaseSchema.safeParse({
      scheduled_date: '2026-03-15',
      case_number: '',
      start_time: '',
      surgeon_id: '',
      procedure_type_id: '',
      or_room_id: '',
      status_id: '',
      operative_side: '',
      payer_id: '',
      notes: '',
    })
    expect(result.success).toBe(true)
  })

  it('accepts a fully-populated draft', () => {
    const result = draftCaseSchema.safeParse({
      scheduled_date: '2026-03-15',
      case_number: 'DRAFT-123',
      start_time: '07:30',
      surgeon_id: 'surgeon-1',
      procedure_type_id: 'proc-1',
      or_room_id: 'room-1',
      status_id: 'status-1',
      operative_side: 'left',
      payer_id: 'payer-1',
      notes: 'Draft notes',
    })
    expect(result.success).toBe(true)
  })
})
