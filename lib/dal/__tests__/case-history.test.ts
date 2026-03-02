import { describe, it, expect, vi, beforeEach } from 'vitest'
import { caseHistoryDAL, getFieldLabel, resolveChangedFieldNames } from '../case-history'
import type { CaseHistoryEntry } from '@/lib/integrations/shared/integration-types'

// ============================================
// MOCK SUPABASE CLIENT
// ============================================

function createMockSupabase() {
  const chainable: Record<string, ReturnType<typeof vi.fn>> = {}
  const methods = ['select', 'eq', 'in', 'order', 'range', 'limit']
  for (const m of methods) {
    chainable[m] = vi.fn().mockReturnValue(chainable)
  }
  chainable.single = vi.fn()
  chainable.maybeSingle = vi.fn()

  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client: { from: vi.fn().mockReturnValue(chainable) } as any,
    chainable,
  }
}

// ============================================
// getCaseHistory
// ============================================

describe('caseHistoryDAL.getCaseHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('queries case_history with correct case_id and ordering', async () => {
    const { client, chainable } = createMockSupabase()
    const mockRows = [
      {
        id: 'h-1',
        case_id: 'case-1',
        facility_id: 'fac-1',
        change_type: 'created',
        changed_fields: {},
        change_source: 'manual',
        changed_by: 'user-1',
        ehr_integration_log_id: null,
        created_at: '2026-03-01T14:30:00Z',
        changed_by_user: { first_name: 'Ryan', last_name: 'Devine' },
      },
    ]
    chainable.range.mockResolvedValue({ data: mockRows, error: null })

    const result = await caseHistoryDAL.getCaseHistory(client, 'case-1')

    expect(client.from).toHaveBeenCalledWith('case_history')
    expect(chainable.eq).toHaveBeenCalledWith('case_id', 'case-1')
    expect(chainable.order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(chainable.range).toHaveBeenCalledWith(0, 49) // default limit=50, offset=0
    expect(result.error).toBeNull()
    expect(result.data).toHaveLength(1)
    expect(result.data[0]).toEqual({
      id: 'h-1',
      caseId: 'case-1',
      facilityId: 'fac-1',
      changeType: 'created',
      changedFields: {},
      changeSource: 'manual',
      changedBy: 'user-1',
      changedByName: 'Ryan Devine',
      ehrIntegrationLogId: null,
      createdAt: '2026-03-01T14:30:00Z',
    })
  })

  it('returns empty array when no history exists', async () => {
    const { client, chainable } = createMockSupabase()
    chainable.range.mockResolvedValue({ data: [], error: null })

    const result = await caseHistoryDAL.getCaseHistory(client, 'case-no-history')

    expect(result.data).toEqual([])
    expect(result.error).toBeNull()
  })

  it('returns error on query failure', async () => {
    const { client, chainable } = createMockSupabase()
    const mockError = { message: 'DB error', code: '500', details: '', hint: '' }
    chainable.range.mockResolvedValue({ data: null, error: mockError })

    const result = await caseHistoryDAL.getCaseHistory(client, 'case-1')

    expect(result.data).toEqual([])
    expect(result.error).toEqual(mockError)
  })

  it('respects pagination params', async () => {
    const { client, chainable } = createMockSupabase()
    chainable.range.mockResolvedValue({ data: [], error: null })

    await caseHistoryDAL.getCaseHistory(client, 'case-1', 10, 20)

    expect(chainable.range).toHaveBeenCalledWith(20, 29) // offset=20, limit=10
  })

  it('handles null changed_by_user (system changes)', async () => {
    const { client, chainable } = createMockSupabase()
    const mockRows = [
      {
        id: 'h-2',
        case_id: 'case-1',
        facility_id: 'fac-1',
        change_type: 'updated',
        changed_fields: { status_id: { old: 'a', new: 'b' } },
        change_source: 'system',
        changed_by: null,
        ehr_integration_log_id: null,
        created_at: '2026-03-01T15:00:00Z',
        changed_by_user: null,
      },
    ]
    chainable.range.mockResolvedValue({ data: mockRows, error: null })

    const result = await caseHistoryDAL.getCaseHistory(client, 'case-1')

    expect(result.data[0].changedBy).toBeNull()
    expect(result.data[0].changedByName).toBeNull()
  })

  it('transforms HL7v2-sourced entries correctly', async () => {
    const { client, chainable } = createMockSupabase()
    const mockRows = [
      {
        id: 'h-3',
        case_id: 'case-1',
        facility_id: 'fac-1',
        change_type: 'updated',
        changed_fields: { surgeon_id: { old: 'surg-1', new: 'surg-2' } },
        change_source: 'epic_hl7v2',
        changed_by: null,
        ehr_integration_log_id: 'log-1',
        created_at: '2026-03-02T09:15:00Z',
        changed_by_user: null,
      },
    ]
    chainable.range.mockResolvedValue({ data: mockRows, error: null })

    const result = await caseHistoryDAL.getCaseHistory(client, 'case-1')

    expect(result.data[0].changeSource).toBe('epic_hl7v2')
    expect(result.data[0].ehrIntegrationLogId).toBe('log-1')
  })
})

// ============================================
// getCaseHistoryCount
// ============================================

describe('caseHistoryDAL.getCaseHistoryCount', () => {
  it('returns the count of history entries', async () => {
    const { client, chainable } = createMockSupabase()
    chainable.eq.mockResolvedValue({ count: 5, error: null })

    const result = await caseHistoryDAL.getCaseHistoryCount(client, 'case-1')

    expect(client.from).toHaveBeenCalledWith('case_history')
    expect(chainable.select).toHaveBeenCalledWith('id', { count: 'exact', head: true })
    expect(result.count).toBe(5)
    expect(result.error).toBeNull()
  })

  it('returns 0 when count is null', async () => {
    const { client, chainable } = createMockSupabase()
    chainable.eq.mockResolvedValue({ count: null, error: null })

    const result = await caseHistoryDAL.getCaseHistoryCount(client, 'case-1')

    expect(result.count).toBe(0)
  })
})

// ============================================
// getFieldLabel
// ============================================

describe('getFieldLabel', () => {
  it('returns known field labels', () => {
    expect(getFieldLabel('surgeon_id')).toBe('Surgeon')
    expect(getFieldLabel('procedure_type_id')).toBe('Procedure')
    expect(getFieldLabel('or_room_id')).toBe('OR Room')
    expect(getFieldLabel('scheduled_date')).toBe('Scheduled Date')
    expect(getFieldLabel('status_id')).toBe('Status')
    expect(getFieldLabel('patient_id')).toBe('Patient')
    expect(getFieldLabel('payer_id')).toBe('Payer')
    expect(getFieldLabel('operative_side')).toBe('Side')
    expect(getFieldLabel('data_validated')).toBe('Validated')
    expect(getFieldLabel('is_excluded_from_metrics')).toBe('Excluded')
  })

  it('auto-formats unknown fields to title case', () => {
    expect(getFieldLabel('some_custom_field')).toBe('Some Custom Field')
  })
})

// ============================================
// resolveChangedFieldNames
// ============================================

describe('resolveChangedFieldNames', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resolves FK UUIDs to display names', async () => {
    const { client } = createMockSupabase()

    // Override from() to return different data per table
    const fromMock = vi.fn().mockImplementation((table: string) => {
      const chain: Record<string, ReturnType<typeof vi.fn>> = {
        select: vi.fn().mockReturnThis() as ReturnType<typeof vi.fn>,
        in: vi.fn() as ReturnType<typeof vi.fn>,
      }

      const lookups: Record<string, Record<string, string | null>[]> = {
        users: [{ id: 'surg-1', first_name: 'John', last_name: 'Smith', name: null }],
        procedure_types: [{ id: 'proc-1', first_name: null, last_name: null, name: 'Total Knee' }],
        or_rooms: [],
        patients: [],
        case_statuses: [{ id: 'stat-1', first_name: null, last_name: null, name: 'Scheduled' }],
        payers: [],
      }
      chain.in.mockResolvedValue({ data: lookups[table] || [] })
      return chain
    })
    client.from = fromMock

    const entries: CaseHistoryEntry[] = [
      {
        id: 'h-1',
        caseId: 'case-1',
        facilityId: 'fac-1',
        changeType: 'updated',
        changedFields: {
          surgeon_id: { old: 'surg-old', new: 'surg-1' },
          procedure_type_id: { old: null, new: 'proc-1' },
          status_id: { old: 'stat-1', new: 'stat-2' },
        },
        changeSource: 'manual',
        changedBy: 'user-1',
        changedByName: 'Ryan Devine',
        ehrIntegrationLogId: null,
        createdAt: '2026-03-01T14:30:00Z',
      },
    ]

    const resolved = await resolveChangedFieldNames(client, entries)

    // surgeon_id new should be resolved to "John Smith"
    expect(resolved[0].changedFields.surgeon_id.new).toBe('John Smith')
    // surgeon_id old was not in the lookup data, so stays as UUID
    expect(resolved[0].changedFields.surgeon_id.old).toBe('surg-old')
    // procedure_type_id new should be resolved
    expect(resolved[0].changedFields.procedure_type_id.new).toBe('Total Knee')
    // status_id old should be resolved
    expect(resolved[0].changedFields.status_id.old).toBe('Scheduled')
  })

  it('handles boolean fields correctly', async () => {
    const { client } = createMockSupabase()
    client.from = vi.fn().mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ data: [] }),
    }))

    const entries: CaseHistoryEntry[] = [
      {
        id: 'h-1',
        caseId: 'case-1',
        facilityId: 'fac-1',
        changeType: 'updated',
        changedFields: {
          data_validated: { old: 'false', new: 'true' },
          is_excluded_from_metrics: { old: 'true', new: 'false' },
          is_draft: { old: 'true', new: 'false' },
        },
        changeSource: 'manual',
        changedBy: 'user-1',
        changedByName: 'Ryan Devine',
        ehrIntegrationLogId: null,
        createdAt: '2026-03-01T14:30:00Z',
      },
    ]

    const resolved = await resolveChangedFieldNames(client, entries)

    expect(resolved[0].changedFields.data_validated).toEqual({ old: 'No', new: 'Yes' })
    expect(resolved[0].changedFields.is_excluded_from_metrics).toEqual({ old: 'Yes', new: 'No' })
    expect(resolved[0].changedFields.is_draft).toEqual({ old: 'Yes', new: 'No' })
  })

  it('returns entries unchanged when no FK fields present', async () => {
    const { client } = createMockSupabase()
    client.from = vi.fn().mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ data: [] }),
    }))

    const entries: CaseHistoryEntry[] = [
      {
        id: 'h-1',
        caseId: 'case-1',
        facilityId: 'fac-1',
        changeType: 'updated',
        changedFields: {
          scheduled_date: { old: '2026-03-15', new: '2026-03-20' },
          notes: { old: 'Old note', new: 'New note' },
        },
        changeSource: 'manual',
        changedBy: 'user-1',
        changedByName: 'Ryan Devine',
        ehrIntegrationLogId: null,
        createdAt: '2026-03-01T14:30:00Z',
      },
    ]

    const resolved = await resolveChangedFieldNames(client, entries)

    expect(resolved[0].changedFields.scheduled_date).toEqual({ old: '2026-03-15', new: '2026-03-20' })
    expect(resolved[0].changedFields.notes).toEqual({ old: 'Old note', new: 'New note' })
  })

  it('handles empty entries array', async () => {
    const { client } = createMockSupabase()
    client.from = vi.fn().mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ data: [] }),
    }))

    const resolved = await resolveChangedFieldNames(client, [])

    expect(resolved).toEqual([])
  })
})
