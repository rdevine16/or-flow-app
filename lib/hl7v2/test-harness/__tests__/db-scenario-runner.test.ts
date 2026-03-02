import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { EhrTestScheduleWithEntities } from '@/lib/integrations/shared/integration-types';
import {
  loadDatabaseScenario,
  sendDatabaseScenario,
  loadSingleSchedule,
  type DbScenarioResult,
} from '../db-scenario-runner';
import { ehrTestDataDAL } from '@/lib/dal/ehr-test-data';
import type { GeneratedSIUMessage } from '../siu-generator';

// Mock dependencies
vi.mock('@/lib/dal/ehr-test-data', () => ({
  ehrTestDataDAL: {
    listSchedules: vi.fn(),
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
      messageControlId: `MSG-${Math.random().toString(36).slice(2, 8)}`,
      raw: `MSH|...|SIU^${params.triggerEvent}|...\rPID|...\r`,
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

// -- Test Data Factories ------------------------------------------------------

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
const mockSupabase = {} as any;

// -- Tests: loadDatabaseScenario ----------------------------------------------

describe('loadDatabaseScenario', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds scenario from schedule list', async () => {
    const schedules = [
      makeSchedule({ id: 'sched-1', sequence_order: 1 }),
      makeSchedule({ id: 'sched-2', sequence_order: 2 }),
      makeSchedule({ id: 'sched-3', sequence_order: 3 }),
    ];

    vi.mocked(ehrTestDataDAL.listSchedules).mockResolvedValue({
      data: schedules,
      error: null,
    });

    const result = await loadDatabaseScenario(mockSupabase, 'fac-1');

    expect(result.type).toBe('database');
    expect(result.totalSchedules).toBe(3);
    expect(result.totalMessages).toBe(3);
    expect(result.conversionErrors.length).toBe(0);
    expect(result.messages.length).toBe(3);

    // Check messages are in sequence order
    expect(result.messages[0].siuResult.sequenceOrder).toBe(1);
    expect(result.messages[1].siuResult.sequenceOrder).toBe(2);
    expect(result.messages[2].siuResult.sequenceOrder).toBe(3);

    // Check delays are applied (200ms between messages)
    expect(result.messages[0].delayMs).toBe(0);
    expect(result.messages[1].delayMs).toBe(200);
    expect(result.messages[2].delayMs).toBe(400);
  });

  it('filters by scheduleIds when provided', async () => {
    const schedules = [
      makeSchedule({ id: 'sched-1', sequence_order: 1 }),
      makeSchedule({ id: 'sched-2', sequence_order: 2 }),
      makeSchedule({ id: 'sched-3', sequence_order: 3 }),
    ];

    vi.mocked(ehrTestDataDAL.listSchedules).mockResolvedValue({
      data: schedules,
      error: null,
    });

    const result = await loadDatabaseScenario(mockSupabase, 'fac-1', ['sched-1', 'sched-3']);

    expect(result.totalSchedules).toBe(2);
    expect(result.totalMessages).toBe(2);
    expect(result.messages[0].siuResult.scheduleId).toBe('sched-1');
    expect(result.messages[1].siuResult.scheduleId).toBe('sched-3');
  });

  it('throws when schedule list is empty', async () => {
    vi.mocked(ehrTestDataDAL.listSchedules).mockResolvedValue({
      data: [],
      error: null,
    });

    await expect(loadDatabaseScenario(mockSupabase, 'fac-1')).rejects.toThrow(
      'No test schedule entries found'
    );
  });

  it('throws when none of the specified scheduleIds are found', async () => {
    const schedules = [makeSchedule({ id: 'sched-1' })];

    vi.mocked(ehrTestDataDAL.listSchedules).mockResolvedValue({
      data: schedules,
      error: null,
    });

    await expect(
      loadDatabaseScenario(mockSupabase, 'fac-1', ['sched-999', 'sched-888'])
    ).rejects.toThrow('None of the specified schedule IDs were found');
  });

  it('throws when DAL returns error', async () => {
    vi.mocked(ehrTestDataDAL.listSchedules).mockResolvedValue({
      data: null,
      error: { message: 'Database connection failed' } as any,
    });

    await expect(loadDatabaseScenario(mockSupabase, 'fac-1')).rejects.toThrow(
      'Failed to load test schedules: Database connection failed'
    );
  });

  it('handles conversion errors gracefully', async () => {
    const schedules = [
      makeSchedule({ id: 'sched-1', sequence_order: 1 }),
      makeSchedule({ id: 'sched-2', sequence_order: 2, surgeon: null }), // Missing surgeon
      makeSchedule({ id: 'sched-3', sequence_order: 3 }),
    ];

    vi.mocked(ehrTestDataDAL.listSchedules).mockResolvedValue({
      data: schedules,
      error: null,
    });

    const result = await loadDatabaseScenario(mockSupabase, 'fac-1');

    expect(result.totalSchedules).toBe(3);
    expect(result.totalMessages).toBe(2); // Only 2 valid
    expect(result.conversionErrors.length).toBe(1);
    expect(result.conversionErrors[0].scheduleId).toBe('sched-2');
    expect(result.conversionErrors[0].error).toContain('missing required entities');
  });
});

// -- Tests: loadSingleSchedule ------------------------------------------------

describe('loadSingleSchedule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads and converts single schedule by ID', async () => {
    const schedule = makeSchedule({ id: 'sched-1' });

    vi.mocked(ehrTestDataDAL.getSchedule).mockResolvedValue({
      data: schedule,
      error: null,
    });

    const result = await loadSingleSchedule(mockSupabase, 'sched-1');

    expect(result.scheduleId).toBe('sched-1');
    expect(result.message.triggerEvent).toBe('S12');
    expect(ehrTestDataDAL.getSchedule).toHaveBeenCalledWith(mockSupabase, 'sched-1');
  });

  it('throws when schedule not found', async () => {
    vi.mocked(ehrTestDataDAL.getSchedule).mockResolvedValue({
      data: null,
      error: null,
    });

    await expect(loadSingleSchedule(mockSupabase, 'sched-999')).rejects.toThrow(
      'Failed to load schedule sched-999: Not found'
    );
  });

  it('throws when DAL returns error', async () => {
    vi.mocked(ehrTestDataDAL.getSchedule).mockResolvedValue({
      data: null,
      error: { message: 'Permission denied' } as any,
    });

    await expect(loadSingleSchedule(mockSupabase, 'sched-1')).rejects.toThrow(
      'Failed to load schedule sched-1: Permission denied'
    );
  });
});

// -- Tests: sendDatabaseScenario ----------------------------------------------

describe('sendDatabaseScenario', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('sends messages with delays', async () => {
    const scenario: DbScenarioResult = {
      type: 'database',
      messages: [
        {
          siuResult: {
            message: {
              triggerEvent: 'S12',
              caseId: 'CASE-001',
              messageControlId: 'MSG-001',
              raw: 'MSH|...|SIU^S12|...\r',
            } as GeneratedSIUMessage,
            scheduleId: 'sched-1',
            sequenceOrder: 1,
            description: 'New case',
          },
          delayMs: 0,
        },
        {
          siuResult: {
            message: {
              triggerEvent: 'S13',
              caseId: 'CASE-001',
              messageControlId: 'MSG-002',
              raw: 'MSH|...|SIU^S13|...\r',
            } as GeneratedSIUMessage,
            scheduleId: 'sched-2',
            sequenceOrder: 2,
            description: 'Reschedule',
          },
          delayMs: 200,
        },
      ],
      totalSchedules: 2,
      totalMessages: 2,
      conversionErrors: [],
    };

    // Mock successful responses
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      text: async () => 'MSA|AA|MSG-001|\r',
    } as Response);

    const results = await sendDatabaseScenario(
      scenario,
      'https://example.com/hl7v2-listener',
      'test-api-key',
      200
    );

    expect(results.length).toBe(2);
    expect(results[0].status).toBe('success');
    expect(results[0].ackCode).toBe('AA');
    expect(results[0].sequenceNumber).toBe(1);
    expect(results[0].scheduleId).toBe('sched-1');

    expect(results[1].status).toBe('success');
    expect(results[1].sequenceNumber).toBe(2);
    expect(results[1].scheduleId).toBe('sched-2');

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.com/hl7v2-listener',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/hl7-v2',
          'X-Integration-Key': 'test-api-key',
        },
        body: 'MSH|...|SIU^S12|...\r',
      })
    );
  });

  it('handles HTTP errors', async () => {
    const scenario: DbScenarioResult = {
      type: 'database',
      messages: [
        {
          siuResult: {
            message: {
              triggerEvent: 'S12',
              caseId: 'CASE-001',
              messageControlId: 'MSG-001',
              raw: 'MSH|...|SIU^S12|...\r',
            } as GeneratedSIUMessage,
            scheduleId: 'sched-1',
            sequenceOrder: 1,
            description: 'New case',
          },
          delayMs: 0,
        },
      ],
      totalSchedules: 1,
      totalMessages: 1,
      conversionErrors: [],
    };

    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    } as Response);

    const results = await sendDatabaseScenario(scenario, 'https://example.com/hl7v2-listener', 'test-api-key');

    expect(results.length).toBe(1);
    expect(results[0].status).toBe('error');
    expect(results[0].errorMessage).toContain('HTTP 500');
  });

  it('handles network errors', async () => {
    const scenario: DbScenarioResult = {
      type: 'database',
      messages: [
        {
          siuResult: {
            message: {
              triggerEvent: 'S12',
              caseId: 'CASE-001',
              messageControlId: 'MSG-001',
              raw: 'MSH|...|SIU^S12|...\r',
            } as GeneratedSIUMessage,
            scheduleId: 'sched-1',
            sequenceOrder: 1,
            description: 'New case',
          },
          delayMs: 0,
        },
      ],
      totalSchedules: 1,
      totalMessages: 1,
      conversionErrors: [],
    };

    vi.mocked(global.fetch).mockRejectedValue(new Error('Network timeout'));

    const results = await sendDatabaseScenario(scenario, 'https://example.com/hl7v2-listener', 'test-api-key');

    expect(results.length).toBe(1);
    expect(results[0].status).toBe('error');
    expect(results[0].errorMessage).toBe('Network timeout');
  });

  it('calls onProgress callback for each message', async () => {
    const scenario: DbScenarioResult = {
      type: 'database',
      messages: [
        {
          siuResult: {
            message: {
              triggerEvent: 'S12',
              caseId: 'CASE-001',
              messageControlId: 'MSG-001',
              raw: 'MSH|...|SIU^S12|...\r',
            } as GeneratedSIUMessage,
            scheduleId: 'sched-1',
            sequenceOrder: 1,
            description: 'New case',
          },
          delayMs: 0,
        },
        {
          siuResult: {
            message: {
              triggerEvent: 'S13',
              caseId: 'CASE-001',
              messageControlId: 'MSG-002',
              raw: 'MSH|...|SIU^S13|...\r',
            } as GeneratedSIUMessage,
            scheduleId: 'sched-2',
            sequenceOrder: 2,
            description: 'Reschedule',
          },
          delayMs: 200,
        },
      ],
      totalSchedules: 2,
      totalMessages: 2,
      conversionErrors: [],
    };

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      text: async () => 'MSA|AA|MSG-001|\r',
    } as Response);

    const onProgress = vi.fn();

    await sendDatabaseScenario(
      scenario,
      'https://example.com/hl7v2-listener',
      'test-api-key',
      0,
      onProgress
    );

    expect(onProgress).toHaveBeenCalledTimes(2);
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({ scheduleId: 'sched-1', status: 'success' }),
      0,
      2
    );
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({ scheduleId: 'sched-2', status: 'success' }),
      1,
      2
    );
  });

  it('handles ACK error codes', async () => {
    const scenario: DbScenarioResult = {
      type: 'database',
      messages: [
        {
          siuResult: {
            message: {
              triggerEvent: 'S12',
              caseId: 'CASE-001',
              messageControlId: 'MSG-001',
              raw: 'MSH|...|SIU^S12|...\r',
            } as GeneratedSIUMessage,
            scheduleId: 'sched-1',
            sequenceOrder: 1,
            description: 'New case',
          },
          delayMs: 0,
        },
      ],
      totalSchedules: 1,
      totalMessages: 1,
      conversionErrors: [],
    };

    // ACK with AE (application error)
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      text: async () => 'MSA|AE|MSG-001|Invalid segment\r',
    } as Response);

    const results = await sendDatabaseScenario(scenario, 'https://example.com/hl7v2-listener', 'test-api-key');

    expect(results.length).toBe(1);
    expect(results[0].status).toBe('error');
    expect(results[0].ackCode).toBe('AE');
  });

  it('uses custom delay when provided', async () => {
    const scenario: DbScenarioResult = {
      type: 'database',
      messages: [
        {
          siuResult: {
            message: {
              triggerEvent: 'S12',
              caseId: 'CASE-001',
              messageControlId: 'MSG-001',
              raw: 'MSH|...|SIU^S12|...\r',
            } as GeneratedSIUMessage,
            scheduleId: 'sched-1',
            sequenceOrder: 1,
            description: 'New case',
          },
          delayMs: 0,
        },
        {
          siuResult: {
            message: {
              triggerEvent: 'S13',
              caseId: 'CASE-001',
              messageControlId: 'MSG-002',
              raw: 'MSH|...|SIU^S13|...\r',
            } as GeneratedSIUMessage,
            scheduleId: 'sched-2',
            sequenceOrder: 2,
            description: 'Reschedule',
          },
          delayMs: 200,
        },
      ],
      totalSchedules: 2,
      totalMessages: 2,
      conversionErrors: [],
    };

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      text: async () => 'MSA|AA|MSG-001|\r',
    } as Response);

    // Use 0ms delay for testing
    await sendDatabaseScenario(scenario, 'https://example.com/hl7v2-listener', 'test-api-key', 0);

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
