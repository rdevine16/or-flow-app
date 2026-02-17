import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CaseListItem, CaseDetail, CaseMilestone, CasesFilterParams } from '../cases'
import { casesDAL } from '../cases'
import type { SupabaseClient } from '@supabase/supabase-js'

type MockSupabaseClient = unknown

// ============================================
// TYPE ALIGNMENT TESTS — Phase 5.2
// ============================================

describe('Cases DAL Types — Phase 5.2 Schema Alignment', () => {
  it('CaseListItem does not include patient_name or patient_mrn', () => {
    const item: CaseListItem = {
      id: 'case-1',
      case_number: 'C-001',
      scheduled_date: '2026-03-15',
      start_time: '07:30',
      status_id: 'scheduled',
      data_validated: false,
      or_room_id: 'room-1',
      surgeon_id: 'surgeon-1',
      facility_id: 'facility-1',
      scheduled_duration_minutes: null,
      created_at: '2026-03-15T00:00:00Z',
      created_by: 'user-1',
    }

    expect(item.case_number).toBe('C-001')
    // TypeScript enforces no patient_name/patient_mrn at compile time
    expect('patient_name' in item).toBe(false)
    expect('patient_mrn' in item).toBe(false)
  })

  it('CaseListItem includes created_by field', () => {
    const item: CaseListItem = {
      id: 'case-1',
      case_number: 'C-001',
      scheduled_date: '2026-03-15',
      start_time: '07:30',
      status_id: 'scheduled',
      data_validated: false,
      or_room_id: 'room-1',
      surgeon_id: 'surgeon-1',
      facility_id: 'facility-1',
      scheduled_duration_minutes: null,
      created_at: '2026-03-15T00:00:00Z',
      created_by: 'user-1',
    }

    expect(item.created_by).toBe('user-1')
  })

  it('CaseListItem allows null created_by', () => {
    const item: CaseListItem = {
      id: 'case-2',
      case_number: 'C-002',
      scheduled_date: '2026-03-15',
      start_time: null,
      status_id: null,
      data_validated: false,
      or_room_id: null,
      surgeon_id: null,
      facility_id: 'facility-1',
      scheduled_duration_minutes: null,
      created_at: '2026-03-15T00:00:00Z',
      created_by: null,
    }

    expect(item.created_by).toBeNull()
  })

  it('CaseMilestone uses facility_milestone_id instead of milestone_type_id', () => {
    const milestone: CaseMilestone = {
      id: 'ms-1',
      case_id: 'case-1',
      facility_milestone_id: 'fm-patient-in',
      recorded_at: '2026-03-15T07:30:00Z',
      recorded_by: 'user-1',
    }

    expect(milestone.facility_milestone_id).toBe('fm-patient-in')
    // TypeScript enforces no milestone_type_id at compile time
    expect('milestone_type_id' in milestone).toBe(false)
  })

  it('CaseMilestone includes facility_milestone join shape', () => {
    const milestone: CaseMilestone = {
      id: 'ms-1',
      case_id: 'case-1',
      facility_milestone_id: 'fm-patient-in',
      recorded_at: '2026-03-15T07:30:00Z',
      recorded_by: null,
      facility_milestone: {
        name: 'patient_in',
        display_name: 'Patient In',
        display_order: 1,
      },
    }

    expect(milestone.facility_milestone?.name).toBe('patient_in')
    expect(milestone.facility_milestone?.display_name).toBe('Patient In')
    expect(milestone.facility_milestone?.display_order).toBe(1)
  })

  it('CaseDetail inherits from CaseListItem without patient fields', () => {
    const detail: CaseDetail = {
      id: 'case-3',
      case_number: 'C-003',
      scheduled_date: '2026-03-15',
      start_time: '08:00',
      status_id: 'scheduled',
      data_validated: false,
      or_room_id: 'room-1',
      surgeon_id: 'surgeon-1',
      facility_id: 'facility-1',
      created_at: '2026-03-15T00:00:00Z',
      created_by: 'user-1',
      patient_dob: null,
      patient_phone: null,
      laterality: null,
      anesthesia_type: null,
      scheduled_duration_minutes: null,
      notes: null,
      rep_required_override: null,
      called_back_at: null,
      called_back_by: null,
      complexity_id: null,
      case_milestones: [],
      case_flags: [],
      case_staff: [],
      case_implant_companies: [],
    }

    expect(detail.created_by).toBe('user-1')
    expect(detail.case_milestones).toEqual([])
  })
})

// ============================================
// DAL METHOD TESTS — Phase 5.2
// ============================================

describe('casesDAL.recordMilestone — Phase 5.2', () => {
  const mockSupabase = {
    from: vi.fn(),
  }

  const chainable = {
    upsert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase.from.mockReturnValue(chainable)
  })

  it('should upsert with facility_milestone_id column', async () => {
    chainable.single.mockResolvedValue({
      data: {
        id: 'cm-1',
        case_id: 'case-1',
        facility_milestone_id: 'fm-1',
        recorded_at: '2026-03-15T07:30:00Z',
        recorded_by: 'user-1',
      },
      error: null,
    })

    await casesDAL.recordMilestone(
      mockSupabase as MockSupabaseClient as SupabaseClient,
      'case-1',
      'fm-1',
      '2026-03-15T07:30:00Z',
      'user-1'
    )

    expect(mockSupabase.from).toHaveBeenCalledWith('case_milestones')
    expect(chainable.upsert).toHaveBeenCalledWith(
      {
        case_id: 'case-1',
        facility_milestone_id: 'fm-1',
        recorded_at: '2026-03-15T07:30:00Z',
        recorded_by: 'user-1',
      },
      { onConflict: 'case_id,facility_milestone_id' }
    )
  })

  it('should select facility_milestone_id in return data', async () => {
    chainable.single.mockResolvedValue({
      data: {
        id: 'cm-1',
        case_id: 'case-1',
        facility_milestone_id: 'fm-1',
        recorded_at: '2026-03-15T07:30:00Z',
        recorded_by: null,
      },
      error: null,
    })

    const result = await casesDAL.recordMilestone(
      mockSupabase as MockSupabaseClient as SupabaseClient,
      'case-1',
      'fm-1',
      '2026-03-15T07:30:00Z'
    )

    expect(chainable.select).toHaveBeenCalledWith('id, case_id, facility_milestone_id, recorded_at, recorded_by')
    expect(result.data?.facility_milestone_id).toBe('fm-1')
  })

  it('should return error when upsert fails', async () => {
    const pgError = { message: 'conflict', code: '23505', details: '', hint: '' }
    chainable.single.mockResolvedValue({ data: null, error: pgError })

    const result = await casesDAL.recordMilestone(
      mockSupabase as MockSupabaseClient as SupabaseClient,
      'case-1',
      'fm-1',
      '2026-03-15T07:30:00Z'
    )

    expect(result.error).toBe(pgError)
    expect(result.data).toBeNull()
  })
})

describe('casesDAL.search — Phase 5.2', () => {
  const chainable = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn(),
  }

  const mockSupabase = {
    from: vi.fn().mockReturnValue(chainable),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase.from.mockReturnValue(chainable)
  })

  it('should search by case_number only (no patient_name)', async () => {
    chainable.limit.mockResolvedValue({ data: [], error: null })

    await casesDAL.search(mockSupabase as MockSupabaseClient as SupabaseClient, 'facility-1', 'C-001')

    expect(chainable.ilike).toHaveBeenCalledWith('case_number', '%C-001%')
    // Should NOT use .or() with patient_name
    expect(chainable.eq).toHaveBeenCalledWith('facility_id', 'facility-1')
  })
})

// ============================================
// FILTER PARAMS TYPE TESTS — Phase 4
// ============================================

describe('CasesFilterParams — Phase 4 type alignment', () => {
  it('CasesFilterParams accepts all filter fields', () => {
    const filters: CasesFilterParams = {
      search: 'C-001',
      surgeonIds: ['surgeon-1', 'surgeon-2'],
      roomIds: ['room-1'],
      procedureIds: ['proc-1'],
    }

    expect(filters.search).toBe('C-001')
    expect(filters.surgeonIds).toHaveLength(2)
    expect(filters.roomIds).toHaveLength(1)
    expect(filters.procedureIds).toHaveLength(1)
  })

  it('CasesFilterParams allows all fields to be undefined', () => {
    const filters: CasesFilterParams = {}
    expect(filters.search).toBeUndefined()
    expect(filters.surgeonIds).toBeUndefined()
    expect(filters.roomIds).toBeUndefined()
    expect(filters.procedureIds).toBeUndefined()
  })
})

// ============================================
// DAL FILTER METHOD TESTS — Phase 4
// ============================================

describe('casesDAL.listForCasesPage with filters — Phase 4', () => {
  const chainable = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn(),
  }

  const mockSupabase = {
    from: vi.fn().mockReturnValue(chainable),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase.from.mockReturnValue(chainable)
    chainable.select.mockReturnThis()
    chainable.eq.mockReturnThis()
    chainable.gte.mockReturnThis()
    chainable.lte.mockReturnThis()
    chainable.ilike.mockReturnThis()
    chainable.in.mockReturnThis()
    chainable.order.mockReturnThis()
    chainable.range.mockResolvedValue({ data: [], error: null, count: 0 })
  })

  it('applies search filter as ilike on case_number', async () => {
    await casesDAL.listForCasesPage(
      mockSupabase as unknown as Parameters<typeof casesDAL.listForCasesPage>[0],
      'facility-1',
      { start: '2026-01-01', end: '2026-01-31' },
      'all',
      { page: 1, pageSize: 25 },
      { sortBy: 'date', sortDirection: 'desc' },
      {},
      { search: 'C-001' },
    )

    expect(chainable.ilike).toHaveBeenCalledWith('case_number', '%C-001%')
  })

  it('applies surgeon filter as in on surgeon_id', async () => {
    await casesDAL.listForCasesPage(
      mockSupabase as unknown as Parameters<typeof casesDAL.listForCasesPage>[0],
      'facility-1',
      { start: '2026-01-01', end: '2026-01-31' },
      'all',
      { page: 1, pageSize: 25 },
      { sortBy: 'date', sortDirection: 'desc' },
      {},
      { surgeonIds: ['surgeon-1', 'surgeon-2'] },
    )

    expect(chainable.in).toHaveBeenCalledWith('surgeon_id', ['surgeon-1', 'surgeon-2'])
  })

  it('applies room filter as in on or_room_id', async () => {
    await casesDAL.listForCasesPage(
      mockSupabase as unknown as Parameters<typeof casesDAL.listForCasesPage>[0],
      'facility-1',
      { start: '2026-01-01', end: '2026-01-31' },
      'all',
      { page: 1, pageSize: 25 },
      { sortBy: 'date', sortDirection: 'desc' },
      {},
      { roomIds: ['room-1'] },
    )

    expect(chainable.in).toHaveBeenCalledWith('or_room_id', ['room-1'])
  })

  it('applies procedure filter as in on procedure_type_id', async () => {
    await casesDAL.listForCasesPage(
      mockSupabase as unknown as Parameters<typeof casesDAL.listForCasesPage>[0],
      'facility-1',
      { start: '2026-01-01', end: '2026-01-31' },
      'all',
      { page: 1, pageSize: 25 },
      { sortBy: 'date', sortDirection: 'desc' },
      {},
      { procedureIds: ['proc-1'] },
    )

    expect(chainable.in).toHaveBeenCalledWith('procedure_type_id', ['proc-1'])
  })

  it('applies all filters together', async () => {
    await casesDAL.listForCasesPage(
      mockSupabase as unknown as Parameters<typeof casesDAL.listForCasesPage>[0],
      'facility-1',
      { start: '2026-01-01', end: '2026-01-31' },
      'all',
      { page: 1, pageSize: 25 },
      { sortBy: 'date', sortDirection: 'desc' },
      {},
      { search: 'test', surgeonIds: ['s-1'], roomIds: ['r-1'], procedureIds: ['p-1'] },
    )

    expect(chainable.ilike).toHaveBeenCalledWith('case_number', '%test%')
    expect(chainable.in).toHaveBeenCalledWith('surgeon_id', ['s-1'])
    expect(chainable.in).toHaveBeenCalledWith('or_room_id', ['r-1'])
    expect(chainable.in).toHaveBeenCalledWith('procedure_type_id', ['p-1'])
  })

  it('does not apply filters when undefined', async () => {
    await casesDAL.listForCasesPage(
      mockSupabase as unknown as Parameters<typeof casesDAL.listForCasesPage>[0],
      'facility-1',
      { start: '2026-01-01', end: '2026-01-31' },
      'all',
      { page: 1, pageSize: 25 },
      { sortBy: 'date', sortDirection: 'desc' },
      {},
      undefined,
    )

    expect(chainable.ilike).not.toHaveBeenCalled()
    expect(chainable.in).not.toHaveBeenCalled()
  })

  it('does not apply filters when empty arrays', async () => {
    await casesDAL.listForCasesPage(
      mockSupabase as unknown as Parameters<typeof casesDAL.listForCasesPage>[0],
      'facility-1',
      { start: '2026-01-01', end: '2026-01-31' },
      'all',
      { page: 1, pageSize: 25 },
      { sortBy: 'date', sortDirection: 'desc' },
      {},
      { surgeonIds: [], roomIds: [], procedureIds: [] },
    )

    expect(chainable.in).not.toHaveBeenCalled()
  })
})

// ============================================
// getCaseIdsWithUnresolvedIssues TESTS
// ============================================

describe('casesDAL.getCaseIdsWithUnresolvedIssues', () => {
  const makeChainable = (resolvedValue: { data: unknown; error: unknown }) => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockResolvedValue(resolvedValue),
    }
    return chain
  }

  it('returns deduplicated case IDs', async () => {
    const chain = makeChainable({
      data: [
        { case_id: 'case-1' },
        { case_id: 'case-2' },
        { case_id: 'case-1' }, // duplicate
        { case_id: 'case-3' },
        { case_id: 'case-2' }, // duplicate
      ],
      error: null,
    })
    const mockSupabase = { from: vi.fn().mockReturnValue(chain) }

    const result = await casesDAL.getCaseIdsWithUnresolvedIssues(
      mockSupabase as unknown as Parameters<typeof casesDAL.getCaseIdsWithUnresolvedIssues>[0],
      'facility-1',
    )

    expect(result.error).toBeNull()
    expect(result.data).toEqual(['case-1', 'case-2', 'case-3'])
  })

  it('returns empty array when no unresolved issues exist', async () => {
    const chain = makeChainable({ data: [], error: null })
    const mockSupabase = { from: vi.fn().mockReturnValue(chain) }

    const result = await casesDAL.getCaseIdsWithUnresolvedIssues(
      mockSupabase as unknown as Parameters<typeof casesDAL.getCaseIdsWithUnresolvedIssues>[0],
      'facility-1',
    )

    expect(result.error).toBeNull()
    expect(result.data).toEqual([])
  })

  it('queries metric_issues with correct filters', async () => {
    const chain = makeChainable({ data: [], error: null })
    const mockSupabase = { from: vi.fn().mockReturnValue(chain) }

    await casesDAL.getCaseIdsWithUnresolvedIssues(
      mockSupabase as unknown as Parameters<typeof casesDAL.getCaseIdsWithUnresolvedIssues>[0],
      'facility-abc',
    )

    expect(mockSupabase.from).toHaveBeenCalledWith('metric_issues')
    expect(chain.select).toHaveBeenCalledWith('case_id')
    expect(chain.eq).toHaveBeenCalledWith('facility_id', 'facility-abc')
    expect(chain.is).toHaveBeenCalledWith('resolved_at', null)
  })

  it('returns error when query fails', async () => {
    const mockError = { message: 'DB error', details: '', hint: '', code: '500' }
    const chain = makeChainable({ data: null, error: mockError })
    const mockSupabase = { from: vi.fn().mockReturnValue(chain) }

    const result = await casesDAL.getCaseIdsWithUnresolvedIssues(
      mockSupabase as unknown as Parameters<typeof casesDAL.getCaseIdsWithUnresolvedIssues>[0],
      'facility-1',
    )

    expect(result.data).toBeNull()
    expect(result.error).toBe(mockError)
  })
})
