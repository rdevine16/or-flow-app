import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handleSIUMessage } from '../case-import-service'
import type { SIUMessage } from '@/lib/hl7v2/types'
import type { EhrIntegration } from '@/lib/integrations/shared/integration-types'

// Mock all sub-modules the import service depends on
vi.mock('@/lib/dal/ehr', () => ({
  ehrDAL: {
    checkDuplicateMessage: vi.fn(),
    createLogEntry: vi.fn(),
    updateLogEntry: vi.fn(),
    getEntityMapping: vi.fn(),
    saveEntityMapping: vi.fn(),
  },
}))

vi.mock('../patient-matcher', () => ({
  matchOrCreatePatient: vi.fn(),
}))

vi.mock('../provider-matcher', () => ({
  matchSurgeon: vi.fn(),
}))

vi.mock('../procedure-matcher', () => ({
  matchProcedure: vi.fn(),
}))

vi.mock('../room-matcher', () => ({
  matchRoom: vi.fn(),
}))

vi.mock('@/lib/integrations/shared/integration-logger', () => ({
  logMessageReceived: vi.fn(),
  logMessageProcessed: vi.fn(),
  logMessagePendingReview: vi.fn(),
  logMessageError: vi.fn(),
  logMessageIgnored: vi.fn(),
  updateIntegrationTimestamp: vi.fn(),
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
import { matchOrCreatePatient } from '../patient-matcher'
import { matchSurgeon } from '../provider-matcher'
import { matchProcedure } from '../procedure-matcher'
import { matchRoom } from '../room-matcher'
import {
  logMessageReceived,
  logMessageProcessed,
  logMessagePendingReview,
  logMessageError,
  logMessageIgnored,
  updateIntegrationTimestamp,
} from '@/lib/integrations/shared/integration-logger'

// =====================================================
// TEST FIXTURES
// =====================================================

const INTEGRATION: EhrIntegration = {
  id: 'int-1',
  facility_id: 'fac-1',
  integration_type: 'epic_hl7v2',
  display_name: 'Test Integration',
  config: { api_key: 'test-key' },
  is_active: true,
  last_message_at: null,
  last_error: null,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
}

const LOG_ENTRY = {
  id: 'log-1', facility_id: 'fac-1', integration_id: 'int-1',
  message_type: 'SIU^S12', message_control_id: 'MSG00001',
  raw_message: '', parsed_data: null, processing_status: 'received' as const,
  error_message: null, external_case_id: 'SC10001', case_id: null,
  review_notes: null, reviewed_by: null, reviewed_at: null,
  created_at: '', processed_at: null,
}

function buildSIUMessage(overrides?: Partial<SIUMessage>): SIUMessage {
  return {
    triggerEvent: 'S12',
    msh: {
      fieldSeparator: '|',
      encodingCharacters: '^~\\&',
      sendingApplication: 'EPIC',
      sendingFacility: 'SURGERY_CENTER',
      receivingApplication: '',
      receivingFacility: '',
      dateTime: '2026-03-01T14:30:22',
      messageType: 'SIU^S12',
      messageControlId: 'MSG00001',
      processingId: 'P',
      versionId: '2.3',
    },
    sch: {
      placerAppointmentId: 'SC10001',
      fillerAppointmentId: 'FL20001',
      appointmentReason: 'Right knee total arthroplasty',
      appointmentType: 'SURGERY',
      appointmentDuration: 120,
      durationUnits: 'min',
      startDateTime: '2026-03-15T08:00:00',
      endDateTime: '2026-03-15T10:00:00',
      requestingProvider: null,
      enteredByProvider: null,
      fillerStatusCode: 'Booked',
    },
    pid: {
      setId: '1',
      patientId: 'MRN12345',
      patientIdType: 'MR',
      lastName: 'DOE',
      firstName: 'JANE',
      middleName: 'M',
      dateOfBirth: '1965-04-15',
      gender: 'F',
      address: null,
      homePhone: '',
      workPhone: '',
      accountNumber: '',
      ssn: '',
    },
    pv1: {
      setId: '1',
      patientClass: 'O',
      assignedLocation: 'OR3',
      assignedLocationFacility: 'SURGERY_CENTER',
      attendingDoctor: { id: '1001', lastName: 'SMITH', firstName: 'JOHN', middleName: 'A', suffix: 'MD', npi: '1234567890' },
      admissionType: '',
      hospitalService: 'ORTHO',
      visitNumber: '12345',
      visitIndicator: 'V',
    },
    dg1: [{
      setId: '1',
      codingMethod: 'I10',
      diagnosisCode: 'M17.11',
      diagnosisCodeSystem: 'I10',
      diagnosisDescription: 'Primary osteoarthritis, right knee',
    }],
    rgs: { setId: '1', segmentActionCode: 'A', resourceGroupId: 'RG001' },
    ais: {
      setId: '1',
      segmentActionCode: 'A',
      procedureCode: '27447',
      procedureDescription: 'Total knee arthroplasty',
      procedureCodeSystem: 'CPT',
      startDateTime: '2026-03-15T08:00:00',
      startDateTimeOffset: 15,
      startDateTimeOffsetUnits: 'min',
      duration: 120,
      durationUnits: 'min',
      fillerStatusCode: 'Booked',
    },
    aig: [],
    ail: {
      setId: '1',
      segmentActionCode: 'A',
      locationCode: 'OR3',
      locationFacility: 'SURGERY_CENTER',
      locationDescription: 'Operating Room 3',
      startDateTime: '2026-03-15T08:00:00',
      duration: 120,
      durationUnits: 'min',
      fillerStatusCode: 'Booked',
    },
    aip: [{
      setId: '1',
      segmentActionCode: 'A',
      personnelId: '1001',
      personnelLastName: 'SMITH',
      personnelFirstName: 'JOHN',
      personnelMiddleName: 'A',
      personnelSuffix: 'MD',
      personnelNPI: '1234567890',
      role: 'SURGEON',
      startDateTime: '2026-03-15T08:00:00',
      duration: 120,
      durationUnits: 'min',
      fillerStatusCode: 'Booked',
    }],
    ...overrides,
  }
}

/** Build a chain-friendly Supabase mock that handles .from().select().eq()...maybeSingle/single chains */
function mockChain(finalValue: unknown = { data: null, error: null }) {
  const self: Record<string, unknown> = {}
  const methods = ['select', 'eq', 'in', 'insert', 'update', 'upsert', 'delete', 'order', 'limit', 'range', 'filter']
  for (const m of methods) {
    self[m] = vi.fn().mockReturnValue(self)
  }
  self.maybeSingle = vi.fn().mockResolvedValue(finalValue)
  self.single = vi.fn().mockResolvedValue(finalValue)
  // Make the chain itself thenable (for awaiting .update().eq() directly)
  self.then = (resolve: (v: unknown) => void) => resolve(finalValue)
  return self
}

function createMockSupabase(options?: {
  existingCase?: { id: string } | null
  scheduledStatusId?: string
  cancelledStatusId?: string
  rpcResult?: string | null
  rpcError?: { message: string } | null
}) {
  const rpcMock = vi.fn().mockResolvedValue({
    data: options?.rpcResult ?? 'new-case-1',
    error: options?.rpcError ?? null,
  })

  const fromMock = vi.fn().mockImplementation((table: string) => {
    switch (table) {
      case 'cases':
        return mockChain({ data: options?.existingCase ?? null, error: null })
      case 'case_statuses': {
        const statusId = options?.scheduledStatusId ?? options?.cancelledStatusId ?? 'status-1'
        return mockChain({ data: { id: statusId }, error: null })
      }
      case 'patients':
        return {
          ...mockChain({ data: null, error: null }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: 'new-patient-1' }, error: null }),
            }),
          }),
        }
      default:
        return mockChain({ data: null, error: null })
    }
  })

  return { from: fromMock, rpc: rpcMock } as unknown as Parameters<typeof handleSIUMessage>[0]
}

// =====================================================
// DEFAULT MOCK SETUP
// =====================================================

beforeEach(() => {
  vi.clearAllMocks()

  // DAL mocks
  vi.mocked(ehrDAL.checkDuplicateMessage).mockResolvedValue({ data: null, error: null })
  vi.mocked(ehrDAL.saveEntityMapping).mockResolvedValue({ data: null, error: null })

  // Logger mocks — logMessageReceived returns a log entry
  vi.mocked(logMessageReceived).mockResolvedValue(LOG_ENTRY)
  vi.mocked(logMessageProcessed).mockResolvedValue(undefined)
  vi.mocked(logMessagePendingReview).mockResolvedValue(undefined)
  vi.mocked(logMessageError).mockResolvedValue(undefined)
  vi.mocked(logMessageIgnored).mockResolvedValue(undefined)
  vi.mocked(updateIntegrationTimestamp).mockResolvedValue(undefined)

  // Matcher mocks — default: all matched
  vi.mocked(matchOrCreatePatient).mockResolvedValue({
    matched: true,
    patientId: 'patient-1',
    isNewPatient: false,
    demographicsMismatch: null,
  })
  vi.mocked(matchSurgeon).mockResolvedValue({
    matched: true,
    orbitSurgeonId: 'surg-1',
    orbitDisplayName: 'Smith, John',
    confidence: 1.0,
    matchSource: 'mapping',
    suggestions: [],
  })
  vi.mocked(matchProcedure).mockResolvedValue({
    matched: true,
    orbitProcedureId: 'proc-1',
    orbitDisplayName: 'Total knee arthroplasty',
    confidence: 1.0,
    matchSource: 'mapping',
    suggestions: [],
  })
  vi.mocked(matchRoom).mockResolvedValue({
    matched: true,
    orbitRoomId: 'room-3',
    orbitDisplayName: 'OR 3',
    confidence: 1.0,
    matchSource: 'mapping',
    suggestions: [],
  })
})

// =====================================================
// DEDUPLICATION
// =====================================================

describe('message deduplication', () => {
  it('returns duplicate result when message_control_id already processed', async () => {
    vi.mocked(ehrDAL.checkDuplicateMessage).mockResolvedValue({
      data: { ...LOG_ENTRY, id: 'existing-log-1', processing_status: 'processed', case_id: 'existing-case-1' },
      error: null,
    })

    const supabase = createMockSupabase()
    const result = await handleSIUMessage(supabase, buildSIUMessage(), INTEGRATION, 'raw-message')

    expect(result.action).toBe('duplicate')
    expect(result.caseId).toBe('existing-case-1')
    expect(result.logEntryId).toBe('existing-log-1')
    // Should NOT create a new log entry
    expect(logMessageReceived).not.toHaveBeenCalled()
  })
})

// =====================================================
// S12 — CREATE
// =====================================================

describe('S12 — create new case', () => {
  it('creates a case when all entities match', async () => {
    const supabase = createMockSupabase()
    const siu = buildSIUMessage()
    const result = await handleSIUMessage(supabase, siu, INTEGRATION, 'raw-message')

    expect(result.success).toBe(true)
    expect(result.action).toBe('created')
    expect(result.caseId).toBe('new-case-1')
    expect(result.logEntryId).toBe('log-1')

    // Verify all matchers were called
    expect(matchOrCreatePatient).toHaveBeenCalledOnce()
    expect(matchSurgeon).toHaveBeenCalledOnce()
    expect(matchProcedure).toHaveBeenCalledOnce()
    expect(matchRoom).toHaveBeenCalledOnce()

    // Verify log was updated to processed
    expect(logMessageProcessed).toHaveBeenCalledWith(expect.anything(), 'log-1', 'new-case-1')
  })

  it('queues for review when surgeon is unmatched', async () => {
    vi.mocked(matchSurgeon).mockResolvedValue({
      matched: false,
      orbitSurgeonId: null,
      orbitDisplayName: null,
      confidence: 0.6,
      matchSource: 'none',
      suggestions: [{ orbit_entity_id: 'surg-1', orbit_display_name: 'Smith, John', confidence: 0.6, match_reason: 'test' }],
    })

    const supabase = createMockSupabase()
    const result = await handleSIUMessage(supabase, buildSIUMessage(), INTEGRATION, 'raw-message')

    expect(result.success).toBe(true)
    expect(result.action).toBe('pending_review')
    expect(result.caseId).toBeNull()

    // Verify log was updated with review notes
    expect(logMessagePendingReview).toHaveBeenCalledWith(
      expect.anything(),
      'log-1',
      expect.objectContaining({
        surgeon: expect.objectContaining({ name: expect.any(String) }),
      }),
    )
  })

  it('queues for review when procedure is unmatched', async () => {
    vi.mocked(matchProcedure).mockResolvedValue({
      matched: false,
      orbitProcedureId: null,
      orbitDisplayName: null,
      confidence: null,
      matchSource: 'none',
      suggestions: [],
    })

    const supabase = createMockSupabase()
    const result = await handleSIUMessage(supabase, buildSIUMessage(), INTEGRATION, 'raw-message')

    expect(result.action).toBe('pending_review')
  })

  it('queues for review when room is unmatched', async () => {
    vi.mocked(matchRoom).mockResolvedValue({
      matched: false,
      orbitRoomId: null,
      orbitDisplayName: null,
      confidence: null,
      matchSource: 'none',
      suggestions: [],
    })

    const supabase = createMockSupabase()
    const result = await handleSIUMessage(supabase, buildSIUMessage(), INTEGRATION, 'raw-message')

    expect(result.action).toBe('pending_review')
  })

  it('queues for review when demographics mismatch', async () => {
    vi.mocked(matchOrCreatePatient).mockResolvedValue({
      matched: true,
      patientId: 'patient-1',
      isNewPatient: false,
      demographicsMismatch: { field: 'last_name', expected: 'Smith', received: 'Doe' },
    })

    const supabase = createMockSupabase()
    const result = await handleSIUMessage(supabase, buildSIUMessage(), INTEGRATION, 'raw-message')

    expect(result.action).toBe('pending_review')
  })

  it('returns error when log creation fails', async () => {
    vi.mocked(logMessageReceived).mockResolvedValue(null)

    const supabase = createMockSupabase()
    const result = await handleSIUMessage(supabase, buildSIUMessage(), INTEGRATION, 'raw-message')

    expect(result.success).toBe(false)
    expect(result.action).toBe('error')
  })

  it('returns error when RPC fails', async () => {
    const supabase = createMockSupabase({ rpcError: { message: 'RPC failed' } })
    const result = await handleSIUMessage(supabase, buildSIUMessage(), INTEGRATION, 'raw-message')

    expect(result.success).toBe(false)
    expect(result.action).toBe('error')
    expect(logMessageError).toHaveBeenCalled()
  })

  it('updates integration timestamp on every message', async () => {
    const supabase = createMockSupabase()
    await handleSIUMessage(supabase, buildSIUMessage(), INTEGRATION, 'raw-message')

    expect(updateIntegrationTimestamp).toHaveBeenCalledWith(expect.anything(), 'int-1')
  })
})

// =====================================================
// S15/S16 — CANCEL
// =====================================================

describe('S15/S16 — cancel case', () => {
  it('ignores cancel for unknown external case ID', async () => {
    const supabase = createMockSupabase({ existingCase: null })
    const siu = buildSIUMessage({ triggerEvent: 'S15' })
    const result = await handleSIUMessage(supabase, siu, INTEGRATION, 'raw-message')

    expect(result.action).toBe('ignored')
    expect(logMessageIgnored).toHaveBeenCalled()
  })

  it('cancels an existing case', async () => {
    const supabase = createMockSupabase({ existingCase: { id: 'case-1' }, cancelledStatusId: 'status-cancelled' })
    const siu = buildSIUMessage({ triggerEvent: 'S15' })
    const result = await handleSIUMessage(supabase, siu, INTEGRATION, 'raw-message')

    expect(result.success).toBe(true)
    expect(result.action).toBe('cancelled')
    expect(result.caseId).toBe('case-1')
    expect(logMessageProcessed).toHaveBeenCalled()
  })
})

// =====================================================
// S13/S14 — UPDATE
// =====================================================

describe('S13/S14 — update case', () => {
  it('treats update for non-existent case as create', async () => {
    const supabase = createMockSupabase({ existingCase: null })
    const siu = buildSIUMessage({ triggerEvent: 'S14' })

    const result = await handleSIUMessage(supabase, siu, INTEGRATION, 'raw-message')

    // First update query finds no case, falls through to create path
    expect(result.action).toBe('created')
  })

  it('updates an existing case', async () => {
    const supabase = createMockSupabase({ existingCase: { id: 'case-1' } })
    const siu = buildSIUMessage({ triggerEvent: 'S14' })

    const result = await handleSIUMessage(supabase, siu, INTEGRATION, 'raw-message')

    expect(result.success).toBe(true)
    expect(result.action).toBe('updated')
    expect(result.caseId).toBe('case-1')
  })
})
