import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { EhrTestScheduleWithEntities } from '@/lib/integrations/shared/integration-types';
import {
  executeAutoPush,
  type AutoPushRequest,
} from '../auto-push';
import { ehrTestDataDAL } from '@/lib/dal/ehr-test-data';
import type { GeneratedSIUMessage } from '../siu-generator';

// Mock dependencies
vi.mock('@/lib/dal/ehr-test-data', () => ({
  ehrTestDataDAL: {
    getSchedule: vi.fn(),
  },
}));

vi.mock('../siu-generator', () => ({
  resetMessageCounter: vi.fn(),
  generateSIUMessage: vi.fn((params) => {
    const mockMessage: GeneratedSIUMessage = {
      triggerEvent: params.triggerEvent,
      caseId: params.caseId,
      procedure: params.procedure,
      surgeon: params.surgeon,
      patient: params.patient,
      room: params.room,
      scheduledDateTime: params.scheduledDateTime,
      durationMinutes: params.durationMinutes,
      messageControlId: `MSG-AUTO-${params.triggerEvent}`,
      raw: `MSH|...|SIU^${params.triggerEvent}|...\rPID|...\r`,
      systemType: params.systemType || 'epic_hl7v2',
    };
    return mockMessage;
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    info: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock shared module - integration config lookup
const mockGetIntegrationConfigOrNull = vi.fn();
vi.mock('../shared', () => ({
  getIntegrationConfigOrNull: (...args: unknown[]) => mockGetIntegrationConfigOrNull(...args),
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ── Test Data ────────────────────────────────────────────────────────────────

function makeSchedule(
  overrides?: Partial<EhrTestScheduleWithEntities>
): EhrTestScheduleWithEntities {
  return {
    id: 'sched-001',
    facility_id: 'fac-1',
    patient_id: 'pat-001',
    surgeon_id: 'surg-001',
    procedure_id: 'proc-001',
    room_id: 'room-001',
    diagnosis_id: 'diag-001',
    scheduled_date: '2026-03-15',
    start_time: '07:30:00',
    duration_min: 90,
    trigger_event: 'S12',
    external_case_id: 'TEST-AAAA1111',
    references_schedule_id: null,
    notes: null,
    sequence_order: 1,
    created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z',
    patient: {
      id: 'pat-001',
      facility_id: 'fac-1',
      first_name: 'Jane',
      last_name: 'Doe',
      mrn: 'MRN-001',
      date_of_birth: '1980-01-15',
      gender: 'F',
      address_line: '123 Main St',
      city: 'Anytown',
      state: 'CA',
      zip: '90210',
      phone: '5555550100',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
    surgeon: {
      id: 'surg-001',
      facility_id: 'fac-1',
      name: 'John Smith',
      npi: '1234567890',
      specialty: 'Orthopedics',
      external_provider_id: 'PROV-123',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
    procedure: {
      id: 'proc-001',
      facility_id: 'fac-1',
      name: 'Total Knee Replacement',
      cpt_code: '27447',
      typical_duration_min: 90,
      specialty: 'Orthopedics',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
    room: {
      id: 'room-001',
      facility_id: 'fac-1',
      name: 'OR-1',
      location_code: 'MAIN-OR1',
      room_type: 'operating_room',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
    diagnosis: {
      id: 'diag-001',
      facility_id: 'fac-1',
      icd10_code: 'M17.11',
      description: 'Primary osteoarthritis, right knee',
      specialty: 'Orthopedics',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
    referenced_schedule: null,
    ...overrides,
  };
}

// Mock Supabase client
const mockSupabase = {} as Parameters<typeof executeAutoPush>[0];

// ── Tests ────────────────────────────────────────────────────────────────────

describe('executeAutoPush', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('action → trigger event mapping', () => {
    it('maps create → S12', async () => {
      const schedule = makeSchedule();
      mockGetIntegrationConfigOrNull.mockResolvedValue({
        endpointUrl: 'https://example.com/hl7v2-listener',
        apiKey: 'test-key',
      });
      vi.mocked(ehrTestDataDAL.getSchedule).mockResolvedValue({
        data: schedule,
        error: null,
      });
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => 'MSH|...\rMSA|AA|...\r',
      });

      const result = await executeAutoPush(mockSupabase, {
        scheduleId: 'sched-001',
        facilityId: 'fac-1',
        action: 'create',
      });

      expect(result.triggerEvent).toBe('S12');
      expect(result.success).toBe(true);
      expect(result.skipped).toBe(false);
    });

    it('maps update → S14', async () => {
      const schedule = makeSchedule();
      mockGetIntegrationConfigOrNull.mockResolvedValue({
        endpointUrl: 'https://example.com/hl7v2-listener',
        apiKey: 'test-key',
      });
      vi.mocked(ehrTestDataDAL.getSchedule).mockResolvedValue({
        data: schedule,
        error: null,
      });
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => 'MSH|...\rMSA|AA|...\r',
      });

      const result = await executeAutoPush(mockSupabase, {
        scheduleId: 'sched-001',
        facilityId: 'fac-1',
        action: 'update',
      });

      expect(result.triggerEvent).toBe('S14');
      expect(result.success).toBe(true);
    });

    it('maps delete → S15', async () => {
      const schedule = makeSchedule();
      mockGetIntegrationConfigOrNull.mockResolvedValue({
        endpointUrl: 'https://example.com/hl7v2-listener',
        apiKey: 'test-key',
      });

      // Delete uses pre-captured scheduleData
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => 'MSH|...\rMSA|AA|...\r',
      });

      const result = await executeAutoPush(mockSupabase, {
        scheduleId: 'sched-001',
        facilityId: 'fac-1',
        action: 'delete',
        scheduleData: schedule,
      });

      expect(result.triggerEvent).toBe('S15');
      expect(result.success).toBe(true);
      // Should NOT call getSchedule — uses pre-captured data
      expect(ehrTestDataDAL.getSchedule).not.toHaveBeenCalled();
    });
  });

  describe('no integration configured', () => {
    it('returns skipped when facility has no integration', async () => {
      mockGetIntegrationConfigOrNull.mockResolvedValue(null);

      const result = await executeAutoPush(mockSupabase, {
        scheduleId: 'sched-001',
        facilityId: 'fac-no-integration',
        action: 'create',
      });

      expect(result.success).toBe(false);
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('no_integration');
      // Should NOT attempt to load schedule or send
      expect(ehrTestDataDAL.getSchedule).not.toHaveBeenCalled();
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('schedule loading', () => {
    it('loads schedule from DB for create/update actions', async () => {
      const schedule = makeSchedule();
      mockGetIntegrationConfigOrNull.mockResolvedValue({
        endpointUrl: 'https://example.com/hl7v2-listener',
        apiKey: 'test-key',
      });
      vi.mocked(ehrTestDataDAL.getSchedule).mockResolvedValue({
        data: schedule,
        error: null,
      });
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => 'MSH|...\rMSA|AA|...\r',
      });

      await executeAutoPush(mockSupabase, {
        scheduleId: 'sched-001',
        facilityId: 'fac-1',
        action: 'create',
      });

      expect(ehrTestDataDAL.getSchedule).toHaveBeenCalledWith(mockSupabase, 'sched-001');
    });

    it('uses pre-captured data for delete action', async () => {
      const schedule = makeSchedule();
      mockGetIntegrationConfigOrNull.mockResolvedValue({
        endpointUrl: 'https://example.com/hl7v2-listener',
        apiKey: 'test-key',
      });
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => 'MSH|...\rMSA|AA|...\r',
      });

      await executeAutoPush(mockSupabase, {
        scheduleId: 'sched-001',
        facilityId: 'fac-1',
        action: 'delete',
        scheduleData: schedule,
      });

      expect(ehrTestDataDAL.getSchedule).not.toHaveBeenCalled();
    });

    it('returns error when schedule not found', async () => {
      mockGetIntegrationConfigOrNull.mockResolvedValue({
        endpointUrl: 'https://example.com/hl7v2-listener',
        apiKey: 'test-key',
      });
      vi.mocked(ehrTestDataDAL.getSchedule).mockResolvedValue({
        data: null,
        error: { message: 'Not found', details: '', hint: '', code: 'PGRST116' },
      });

      const result = await executeAutoPush(mockSupabase, {
        scheduleId: 'nonexistent',
        facilityId: 'fac-1',
        action: 'create',
      });

      expect(result.success).toBe(false);
      expect(result.skipped).toBe(false);
      expect(result.errorMessage).toContain('Failed to load schedule');
    });
  });

  describe('message contains correct external_case_id', () => {
    it('preserves external_case_id in the generated message', async () => {
      const schedule = makeSchedule({ external_case_id: 'TEST-CUSTOM-ID' });
      mockGetIntegrationConfigOrNull.mockResolvedValue({
        endpointUrl: 'https://example.com/hl7v2-listener',
        apiKey: 'test-key',
      });
      vi.mocked(ehrTestDataDAL.getSchedule).mockResolvedValue({
        data: schedule,
        error: null,
      });
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => 'MSH|...\rMSA|AA|...\r',
      });

      const result = await executeAutoPush(mockSupabase, {
        scheduleId: 'sched-001',
        facilityId: 'fac-1',
        action: 'create',
      });

      expect(result.caseId).toBe('TEST-CUSTOM-ID');
    });
  });

  describe('sending and ACK handling', () => {
    it('sends message with correct headers', async () => {
      const schedule = makeSchedule();
      mockGetIntegrationConfigOrNull.mockResolvedValue({
        endpointUrl: 'https://example.com/hl7v2-listener',
        apiKey: 'my-api-key',
      });
      vi.mocked(ehrTestDataDAL.getSchedule).mockResolvedValue({
        data: schedule,
        error: null,
      });
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => 'MSH|...\rMSA|AA|...\r',
      });

      await executeAutoPush(mockSupabase, {
        scheduleId: 'sched-001',
        facilityId: 'fac-1',
        action: 'create',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/hl7v2-listener',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/hl7-v2',
            'X-Integration-Key': 'my-api-key',
          },
        })
      );
    });

    it('returns success on AA ACK', async () => {
      const schedule = makeSchedule();
      mockGetIntegrationConfigOrNull.mockResolvedValue({
        endpointUrl: 'https://example.com/hl7v2-listener',
        apiKey: 'test-key',
      });
      vi.mocked(ehrTestDataDAL.getSchedule).mockResolvedValue({
        data: schedule,
        error: null,
      });
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => 'MSH|^~\\&|...\rMSA|AA|MSG-001\r',
      });

      const result = await executeAutoPush(mockSupabase, {
        scheduleId: 'sched-001',
        facilityId: 'fac-1',
        action: 'create',
      });

      expect(result.success).toBe(true);
      expect(result.ackCode).toBe('AA');
    });

    it('returns failure on AE ACK', async () => {
      const schedule = makeSchedule();
      mockGetIntegrationConfigOrNull.mockResolvedValue({
        endpointUrl: 'https://example.com/hl7v2-listener',
        apiKey: 'test-key',
      });
      vi.mocked(ehrTestDataDAL.getSchedule).mockResolvedValue({
        data: schedule,
        error: null,
      });
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => 'MSH|^~\\&|...\rMSA|AE|MSG-001\r',
      });

      const result = await executeAutoPush(mockSupabase, {
        scheduleId: 'sched-001',
        facilityId: 'fac-1',
        action: 'create',
      });

      expect(result.success).toBe(false);
      expect(result.ackCode).toBe('AE');
    });

    it('handles network errors gracefully', async () => {
      const schedule = makeSchedule();
      mockGetIntegrationConfigOrNull.mockResolvedValue({
        endpointUrl: 'https://example.com/hl7v2-listener',
        apiKey: 'test-key',
      });
      vi.mocked(ehrTestDataDAL.getSchedule).mockResolvedValue({
        data: schedule,
        error: null,
      });
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const result = await executeAutoPush(mockSupabase, {
        scheduleId: 'sched-001',
        facilityId: 'fac-1',
        action: 'create',
      });

      expect(result.success).toBe(false);
      expect(result.skipped).toBe(false);
      expect(result.errorMessage).toBe('Connection refused');
    });

    it('handles HTTP error responses', async () => {
      const schedule = makeSchedule();
      mockGetIntegrationConfigOrNull.mockResolvedValue({
        endpointUrl: 'https://example.com/hl7v2-listener',
        apiKey: 'test-key',
      });
      vi.mocked(ehrTestDataDAL.getSchedule).mockResolvedValue({
        data: schedule,
        error: null,
      });
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      const result = await executeAutoPush(mockSupabase, {
        scheduleId: 'sched-001',
        facilityId: 'fac-1',
        action: 'create',
      });

      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain('HTTP 500');
    });
  });

  describe('delete without pre-captured data falls back to DB lookup', () => {
    it('loads from DB when scheduleData is not provided on delete', async () => {
      const schedule = makeSchedule();
      mockGetIntegrationConfigOrNull.mockResolvedValue({
        endpointUrl: 'https://example.com/hl7v2-listener',
        apiKey: 'test-key',
      });
      vi.mocked(ehrTestDataDAL.getSchedule).mockResolvedValue({
        data: schedule,
        error: null,
      });
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => 'MSH|...\rMSA|AA|...\r',
      });

      const result = await executeAutoPush(mockSupabase, {
        scheduleId: 'sched-001',
        facilityId: 'fac-1',
        action: 'delete',
        // No scheduleData — falls back to DB
      });

      expect(ehrTestDataDAL.getSchedule).toHaveBeenCalledWith(mockSupabase, 'sched-001');
      expect(result.triggerEvent).toBe('S15');
      expect(result.success).toBe(true);
    });
  });
});

describe('executeAutoPush — integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('full create → update → delete cycle preserves external_case_id', async () => {
    const schedule = makeSchedule({ external_case_id: 'CASE-LIFECYCLE' });
    mockGetIntegrationConfigOrNull.mockResolvedValue({
      endpointUrl: 'https://example.com/hl7v2-listener',
      apiKey: 'test-key',
    });
    vi.mocked(ehrTestDataDAL.getSchedule).mockResolvedValue({
      data: schedule,
      error: null,
    });
    mockFetch.mockResolvedValue({
      ok: true,
      text: async () => 'MSH|...\rMSA|AA|...\r',
    });

    // Create
    const createResult = await executeAutoPush(mockSupabase, {
      scheduleId: 'sched-001',
      facilityId: 'fac-1',
      action: 'create',
    });
    expect(createResult.triggerEvent).toBe('S12');
    expect(createResult.caseId).toBe('CASE-LIFECYCLE');

    // Update
    const updateResult = await executeAutoPush(mockSupabase, {
      scheduleId: 'sched-001',
      facilityId: 'fac-1',
      action: 'update',
    });
    expect(updateResult.triggerEvent).toBe('S14');
    expect(updateResult.caseId).toBe('CASE-LIFECYCLE');

    // Delete (with pre-captured data)
    const deleteResult = await executeAutoPush(mockSupabase, {
      scheduleId: 'sched-001',
      facilityId: 'fac-1',
      action: 'delete',
      scheduleData: schedule,
    });
    expect(deleteResult.triggerEvent).toBe('S15');
    expect(deleteResult.caseId).toBe('CASE-LIFECYCLE');

    // All 3 calls should have gone to the endpoint
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});
