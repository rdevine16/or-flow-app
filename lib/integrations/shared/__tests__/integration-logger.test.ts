import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  logMessageReceived,
  logMessageProcessed,
  logMessagePendingReview,
  logMessageError,
  logMessageIgnored,
  updateIntegrationTimestamp,
} from '../integration-logger'

vi.mock('@/lib/dal/ehr', () => ({
  ehrDAL: {
    createLogEntry: vi.fn(),
    updateLogEntry: vi.fn(),
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

import { ehrDAL } from '@/lib/dal/ehr'

function createMockSupabase() {
  return {
    from: vi.fn().mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    }),
  } as unknown as Parameters<typeof logMessageReceived>[0]
}

const LOG_ENTRY = {
  id: 'log-1',
  facility_id: 'fac-1',
  integration_id: 'int-1',
  message_type: 'SIU^S12',
  message_control_id: 'MSG00001',
  raw_message: 'MSH|...',
  parsed_data: { triggerEvent: 'S12' },
  processing_status: 'received' as const,
  error_message: null,
  external_case_id: 'SC10001',
  case_id: null,
  review_notes: null,
  reviewed_by: null,
  reviewed_at: null,
  created_at: '2026-03-01',
  processed_at: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(ehrDAL.createLogEntry).mockResolvedValue({ data: LOG_ENTRY, error: null })
  vi.mocked(ehrDAL.updateLogEntry).mockResolvedValue({ error: null })
})

describe('logMessageReceived', () => {
  it('creates log entry with received status', async () => {
    const supabase = createMockSupabase()
    const result = await logMessageReceived(supabase, {
      facilityId: 'fac-1',
      integrationId: 'int-1',
      messageType: 'SIU^S12',
      messageControlId: 'MSG00001',
      rawMessage: 'MSH|...',
      parsedData: { triggerEvent: 'S12' },
      externalCaseId: 'SC10001',
    })

    expect(result).toEqual(LOG_ENTRY)
    expect(ehrDAL.createLogEntry).toHaveBeenCalledWith(supabase, expect.objectContaining({
      facility_id: 'fac-1',
      integration_id: 'int-1',
      message_type: 'SIU^S12',
      processing_status: 'received',
    }))
  })

  it('returns null on error', async () => {
    vi.mocked(ehrDAL.createLogEntry).mockResolvedValue({
      data: null,
      error: { name: 'PostgrestError', message: 'DB error', code: '500', details: '', hint: '' },
    })

    const supabase = createMockSupabase()
    const result = await logMessageReceived(supabase, {
      facilityId: 'fac-1',
      integrationId: 'int-1',
      messageType: 'SIU^S12',
      messageControlId: null,
      rawMessage: '',
      parsedData: null,
      externalCaseId: null,
    })

    expect(result).toBeNull()
  })

  it('handles null parsedData and messageControlId', async () => {
    const supabase = createMockSupabase()
    await logMessageReceived(supabase, {
      facilityId: 'fac-1',
      integrationId: 'int-1',
      messageType: 'SIU^S12',
      messageControlId: null,
      rawMessage: '',
      parsedData: null,
      externalCaseId: null,
    })

    expect(ehrDAL.createLogEntry).toHaveBeenCalledWith(supabase, expect.objectContaining({
      message_control_id: undefined,
      parsed_data: undefined,
      external_case_id: undefined,
    }))
  })
})

describe('logMessageProcessed', () => {
  it('updates log entry to processed status with case_id', async () => {
    const supabase = createMockSupabase()
    await logMessageProcessed(supabase, 'log-1', 'case-1')

    expect(ehrDAL.updateLogEntry).toHaveBeenCalledWith(supabase, 'log-1', expect.objectContaining({
      processing_status: 'processed',
      case_id: 'case-1',
      processed_at: expect.any(String),
    }))
  })
})

describe('logMessagePendingReview', () => {
  it('builds review notes with unmatched surgeon', async () => {
    const supabase = createMockSupabase()
    await logMessagePendingReview(supabase, 'log-1', {
      surgeon: {
        name: 'Smith, John',
        npi: '1234567890',
        suggestions: [
          { orbit_entity_id: 'surg-1', orbit_display_name: 'Smith, John A', confidence: 0.85, match_reason: 'test' },
        ],
      },
    })

    expect(ehrDAL.updateLogEntry).toHaveBeenCalledWith(supabase, 'log-1', expect.objectContaining({
      processing_status: 'pending_review',
      review_notes: expect.objectContaining({
        unmatched_surgeon: expect.objectContaining({
          name: 'Smith, John',
          npi: '1234567890',
          suggestions: expect.arrayContaining([
            expect.objectContaining({ confidence: 0.85 }),
          ]),
        }),
      }),
    }))
  })

  it('builds review notes with multiple unmatched entities', async () => {
    const supabase = createMockSupabase()
    await logMessagePendingReview(supabase, 'log-1', {
      surgeon: { name: 'Smith, John', suggestions: [] },
      procedure: { cpt: '27447', name: 'TKA', suggestions: [] },
      room: { name: 'OR3', suggestions: [] },
    })

    expect(ehrDAL.updateLogEntry).toHaveBeenCalledWith(supabase, 'log-1', expect.objectContaining({
      review_notes: expect.objectContaining({
        unmatched_surgeon: expect.any(Object),
        unmatched_procedure: expect.any(Object),
        unmatched_room: expect.any(Object),
      }),
    }))
  })

  it('builds review notes with demographics mismatch', async () => {
    const supabase = createMockSupabase()
    await logMessagePendingReview(supabase, 'log-1', {
      demographicsMismatch: { field: 'last_name', expected: 'Smith', received: 'Doe' },
    })

    expect(ehrDAL.updateLogEntry).toHaveBeenCalledWith(supabase, 'log-1', expect.objectContaining({
      review_notes: expect.objectContaining({
        demographics_mismatch: { field: 'last_name', expected: 'Smith', received: 'Doe' },
      }),
    }))
  })
})

describe('logMessageError', () => {
  it('updates log entry to error status', async () => {
    const supabase = createMockSupabase()
    await logMessageError(supabase, 'log-1', 'Parse failed: invalid MSH')

    expect(ehrDAL.updateLogEntry).toHaveBeenCalledWith(supabase, 'log-1', {
      processing_status: 'error',
      error_message: 'Parse failed: invalid MSH',
    })
  })
})

describe('logMessageIgnored', () => {
  it('updates log entry to ignored status', async () => {
    const supabase = createMockSupabase()
    await logMessageIgnored(supabase, 'log-1', 'Case not found for cancellation')

    expect(ehrDAL.updateLogEntry).toHaveBeenCalledWith(supabase, 'log-1', {
      processing_status: 'ignored',
      error_message: 'Case not found for cancellation',
    })
  })
})

describe('updateIntegrationTimestamp', () => {
  it('updates integration last_message_at', async () => {
    const supabase = createMockSupabase()
    await updateIntegrationTimestamp(supabase, 'int-1')

    expect(supabase.from).toHaveBeenCalledWith('ehr_integrations')
  })
})
