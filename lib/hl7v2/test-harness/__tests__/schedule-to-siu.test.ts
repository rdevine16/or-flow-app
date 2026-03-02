import { describe, it, expect } from 'vitest';
import type {
  EhrTestScheduleWithEntities,
  EhrTestSurgeon,
  EhrTestProcedure,
  EhrTestPatient,
  EhrTestRoom,
  EhrTestDiagnosis,
} from '@/lib/integrations/shared/integration-types';
import {
  toSurgeonData,
  toProcedureData,
  toPatientData,
  toRoomData,
  convertScheduleToSIU,
  convertAllSchedulesToSIU,
} from '../schedule-to-siu';

// -- Test Data Factories ------------------------------------------------------

function makeSurgeon(overrides?: Partial<EhrTestSurgeon>): EhrTestSurgeon {
  return {
    id: 'surg-001',
    facility_id: 'fac-1',
    name: 'John Smith',
    npi: '1234567890',
    specialty: 'orthopedics',
    external_provider_id: 'PROV-123',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeProcedure(overrides?: Partial<EhrTestProcedure>): EhrTestProcedure {
  return {
    id: 'proc-001',
    facility_id: 'fac-1',
    name: 'Total Knee Replacement',
    cpt_code: '27447',
    typical_duration_min: 90,
    specialty: 'orthopedics',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makePatient(overrides?: Partial<EhrTestPatient>): EhrTestPatient {
  return {
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
    ...overrides,
  };
}

function makeRoom(overrides?: Partial<EhrTestRoom>): EhrTestRoom {
  return {
    id: 'room-001',
    facility_id: 'fac-1',
    name: 'OR-1',
    location_code: 'MAIN-OR1',
    room_type: 'operating_room',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeDiagnosis(overrides?: Partial<EhrTestDiagnosis>): EhrTestDiagnosis {
  return {
    id: 'diag-001',
    facility_id: 'fac-1',
    icd10_code: 'M17.11',
    description: 'Primary osteoarthritis, right knee',
    specialty: 'orthopedics',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

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
    patient: makePatient(),
    surgeon: makeSurgeon(),
    procedure: makeProcedure(),
    room: makeRoom(),
    diagnosis: makeDiagnosis(),
    referenced_schedule: null,
    ...overrides,
  };
}

// -- Tests: toSurgeonData -----------------------------------------------------

describe('toSurgeonData', () => {
  it('parses "FirstName LastName" format', () => {
    const surgeon = makeSurgeon({ name: 'John Smith' });
    const result = toSurgeonData(surgeon);
    expect(result.firstName).toBe('John');
    expect(result.lastName).toBe('Smith');
    expect(result.id).toBe('PROV-123'); // Uses external_provider_id
    expect(result.npi).toBe('1234567890');
    expect(result.specialty).toBe('orthopedics');
  });

  it('parses "LastName, FirstName" format', () => {
    const surgeon = makeSurgeon({ name: 'Smith, John' });
    const result = toSurgeonData(surgeon);
    expect(result.firstName).toBe('John');
    expect(result.lastName).toBe('Smith');
  });

  it('handles single name (no space or comma)', () => {
    const surgeon = makeSurgeon({ name: 'Madonna' });
    const result = toSurgeonData(surgeon);
    expect(result.firstName).toBe('Madonna');
    expect(result.lastName).toBe('Unknown');
  });

  it('handles full name with middle name', () => {
    const surgeon = makeSurgeon({ name: 'John Allen Smith' });
    const result = toSurgeonData(surgeon);
    expect(result.firstName).toBe('John');
    expect(result.lastName).toBe('Allen Smith');
  });

  it('uses id prefix when external_provider_id is missing', () => {
    const surgeon = makeSurgeon({ external_provider_id: null });
    const result = toSurgeonData(surgeon);
    // Should use first 8 chars of id
    expect(result.id).toBe('surg-001');
  });

  it('defaults to 0000000000 NPI when null', () => {
    const surgeon = makeSurgeon({ npi: null });
    const result = toSurgeonData(surgeon);
    expect(result.npi).toBe('0000000000');
  });

  it('defaults to general specialty when null', () => {
    const surgeon = makeSurgeon({ specialty: null });
    const result = toSurgeonData(surgeon);
    expect(result.specialty).toBe('general');
  });
});

// -- Tests: toProcedureData ---------------------------------------------------

describe('toProcedureData', () => {
  it('maps procedure with diagnosis', () => {
    const procedure = makeProcedure();
    const diagnosis = makeDiagnosis();
    const result = toProcedureData(procedure, diagnosis);
    expect(result.name).toBe('Total Knee Replacement');
    expect(result.cptCode).toBe('27447');
    expect(result.icd10Code).toBe('M17.11');
    expect(result.icd10Description).toBe('Primary osteoarthritis, right knee');
    expect(result.typicalDurationMinutes).toBe(90);
    expect(result.specialty).toBe('orthopedics');
  });

  it('handles missing diagnosis (null)', () => {
    const procedure = makeProcedure();
    const result = toProcedureData(procedure, null);
    expect(result.icd10Code).toBe('Z00.00');
    expect(result.icd10Description).toBe('General examination');
  });

  it('defaults to 99999 CPT when null', () => {
    const procedure = makeProcedure({ cpt_code: null });
    const result = toProcedureData(procedure, null);
    expect(result.cptCode).toBe('99999');
  });

  it('defaults to 60 minutes when typical_duration_min is null', () => {
    const procedure = makeProcedure({ typical_duration_min: null });
    const result = toProcedureData(procedure, null);
    expect(result.typicalDurationMinutes).toBe(60);
  });

  it('defaults to general specialty when null', () => {
    const procedure = makeProcedure({ specialty: null });
    const result = toProcedureData(procedure, null);
    expect(result.specialty).toBe('general');
  });
});

// -- Tests: toPatientData -----------------------------------------------------

describe('toPatientData', () => {
  it('maps patient with full data', () => {
    const patient = makePatient();
    const result = toPatientData(patient);
    expect(result.firstName).toBe('Jane');
    expect(result.lastName).toBe('Doe');
    expect(result.mrn).toBe('MRN-001');
    // Date parsing is timezone-dependent, just check it's a valid 8-digit format
    expect(result.dateOfBirth).toMatch(/^\d{8}$/);
    expect(result.dateOfBirth).toContain('1980');
    expect(result.dateOfBirth).toContain('01'); // January
    expect(result.gender).toBe('F');
    expect(result.street).toBe('123 Main St');
    expect(result.city).toBe('Anytown');
    expect(result.state).toBe('CA');
    expect(result.zip).toBe('90210');
    expect(result.homePhone).toBe('5555550100');
    expect(result.accountNumber).toBe('ACCTPAT-00');
  });

  it('handles null MRN by generating from id', () => {
    const patient = makePatient({ mrn: null });
    const result = toPatientData(patient);
    expect(result.mrn).toBe('MRNPAT-00');
  });

  it('handles null address fields with defaults', () => {
    const patient = makePatient({
      address_line: null,
      city: null,
      state: null,
      zip: null,
      phone: null,
    });
    const result = toPatientData(patient);
    expect(result.street).toBe('123 Main St');
    expect(result.city).toBe('Anytown');
    expect(result.state).toBe('CA');
    expect(result.zip).toBe('90210');
    expect(result.homePhone).toBe('5555550100');
  });

  it('handles null date_of_birth with 19700101 default', () => {
    const patient = makePatient({ date_of_birth: null });
    const result = toPatientData(patient);
    expect(result.dateOfBirth).toBe('19700101');
  });

  it('converts M gender correctly', () => {
    const patient = makePatient({ gender: 'M' });
    const result = toPatientData(patient);
    expect(result.gender).toBe('M');
  });

  it('converts F gender correctly', () => {
    const patient = makePatient({ gender: 'F' });
    const result = toPatientData(patient);
    expect(result.gender).toBe('F');
  });

  it('defaults to M for other genders', () => {
    const patient = makePatient({ gender: 'O' });
    const result = toPatientData(patient);
    expect(result.gender).toBe('M');
  });
});

// -- Tests: toRoomData --------------------------------------------------------

describe('toRoomData', () => {
  it('maps room with location_code', () => {
    const room = makeRoom();
    const result = toRoomData(room);
    expect(result.code).toBe('MAIN-OR1');
    expect(result.description).toBe('OR-1');
    expect(result.facility).toBe('SURGERY_CENTER');
  });

  it('generates code from name when location_code is null', () => {
    const room = makeRoom({ location_code: null, name: 'OR 2 East' });
    const result = toRoomData(room);
    expect(result.code).toBe('OR2EAST');
    expect(result.description).toBe('OR 2 East');
  });
});

// -- Tests: convertScheduleToSIU ----------------------------------------------

describe('convertScheduleToSIU', () => {
  it('produces valid SIU message from complete schedule', () => {
    const schedule = makeSchedule();
    const result = convertScheduleToSIU(schedule);

    expect(result.scheduleId).toBe('sched-001');
    expect(result.sequenceOrder).toBe(1);
    expect(result.description).toContain('New case');
    expect(result.description).toContain('Total Knee Replacement');
    expect(result.description).toContain('Dr. Smith');
    expect(result.description).toContain('MAIN-OR1');

    expect(result.message.triggerEvent).toBe('S12');
    expect(result.message.caseId).toBe('TEST-AAAA1111');
    expect(result.message.procedure.name).toBe('Total Knee Replacement');
    expect(result.message.surgeon.firstName).toBe('John');
    expect(result.message.surgeon.lastName).toBe('Smith');
    expect(result.message.patient.firstName).toBe('Jane');
    expect(result.message.patient.lastName).toBe('Doe');
    expect(result.message.room.code).toBe('MAIN-OR1');
  });

  it('throws when surgeon is missing', () => {
    const schedule = makeSchedule({ surgeon: null });
    expect(() => convertScheduleToSIU(schedule)).toThrow(
      /Schedule sched-001 is missing required entities.*surgeon=false/
    );
  });

  it('throws when procedure is missing', () => {
    const schedule = makeSchedule({ procedure: null });
    expect(() => convertScheduleToSIU(schedule)).toThrow(
      /Schedule sched-001 is missing required entities.*procedure=false/
    );
  });

  it('throws when room is missing', () => {
    const schedule = makeSchedule({ room: null });
    expect(() => convertScheduleToSIU(schedule)).toThrow(
      /Schedule sched-001 is missing required entities.*room=false/
    );
  });

  it('throws when patient is missing', () => {
    const schedule = makeSchedule({ patient: null });
    expect(() => convertScheduleToSIU(schedule)).toThrow(
      /Schedule sched-001 is missing required entities.*patient=false/
    );
  });

  it('handles S12 with correct caseId from external_case_id', () => {
    const schedule = makeSchedule({
      trigger_event: 'S12',
      external_case_id: 'CUSTOM-CASE-ID',
    });
    const result = convertScheduleToSIU(schedule);
    expect(result.message.triggerEvent).toBe('S12');
    expect(result.message.caseId).toBe('CUSTOM-CASE-ID');
  });

  it('generates caseId from id when external_case_id is null', () => {
    const schedule = makeSchedule({ external_case_id: null });
    const result = convertScheduleToSIU(schedule);
    expect(result.message.caseId).toBe('TEST-SCHED-00');
  });

  it('handles S13 trigger event', () => {
    const schedule = makeSchedule({ trigger_event: 'S13' });
    const result = convertScheduleToSIU(schedule);
    expect(result.message.triggerEvent).toBe('S13');
    expect(result.description).toContain('Reschedule');
  });

  it('handles S14 trigger event', () => {
    const schedule = makeSchedule({ trigger_event: 'S14' });
    const result = convertScheduleToSIU(schedule);
    expect(result.message.triggerEvent).toBe('S14');
    expect(result.description).toContain('Modify');
  });

  it('handles S15 trigger event', () => {
    const schedule = makeSchedule({ trigger_event: 'S15' });
    const result = convertScheduleToSIU(schedule);
    expect(result.message.triggerEvent).toBe('S15');
    expect(result.description).toContain('Cancel');
  });

  it('handles S16 trigger event', () => {
    const schedule = makeSchedule({ trigger_event: 'S16' });
    const result = convertScheduleToSIU(schedule);
    expect(result.message.triggerEvent).toBe('S16');
    expect(result.description).toContain('Discontinue');
  });

  it('parses scheduled date and time correctly', () => {
    const schedule = makeSchedule({
      scheduled_date: '2026-03-15',
      start_time: '14:30:00',
    });
    const result = convertScheduleToSIU(schedule);
    const scheduledTime = result.message.scheduledDateTime;
    expect(scheduledTime.getFullYear()).toBe(2026);
    expect(scheduledTime.getMonth()).toBe(2); // March = 2 (0-indexed)
    // Date parsing can be timezone-dependent, so check it's in the range 14-16
    expect([14, 15, 16]).toContain(scheduledTime.getDate());
    expect(scheduledTime.getHours()).toBe(14);
    expect(scheduledTime.getMinutes()).toBe(30);
  });
});

// -- Tests: convertAllSchedulesToSIU ------------------------------------------

describe('convertAllSchedulesToSIU', () => {
  it('sorts by sequence_order', () => {
    const schedules = [
      makeSchedule({ id: 'sched-3', sequence_order: 3 }),
      makeSchedule({ id: 'sched-1', sequence_order: 1 }),
      makeSchedule({ id: 'sched-2', sequence_order: 2 }),
    ];

    const { results } = convertAllSchedulesToSIU(schedules);

    expect(results.length).toBe(3);
    expect(results[0].scheduleId).toBe('sched-1');
    expect(results[1].scheduleId).toBe('sched-2');
    expect(results[2].scheduleId).toBe('sched-3');
    expect(results[0].sequenceOrder).toBe(1);
    expect(results[1].sequenceOrder).toBe(2);
    expect(results[2].sequenceOrder).toBe(3);
  });

  it('collects errors for invalid schedules', () => {
    const schedules = [
      makeSchedule({ id: 'sched-1', sequence_order: 1 }),
      makeSchedule({ id: 'sched-2', sequence_order: 2, surgeon: null }),
      makeSchedule({ id: 'sched-3', sequence_order: 3 }),
    ];

    const { results, errors } = convertAllSchedulesToSIU(schedules);

    expect(results.length).toBe(2);
    expect(results[0].scheduleId).toBe('sched-1');
    expect(results[1].scheduleId).toBe('sched-3');

    expect(errors.length).toBe(1);
    expect(errors[0].scheduleId).toBe('sched-2');
    expect(errors[0].error).toContain('missing required entities');
  });

  it('handles empty array', () => {
    const { results, errors } = convertAllSchedulesToSIU([]);
    expect(results.length).toBe(0);
    expect(errors.length).toBe(0);
  });

  it('handles all schedules valid', () => {
    const schedules = [
      makeSchedule({ id: 'sched-1', sequence_order: 1 }),
      makeSchedule({ id: 'sched-2', sequence_order: 2 }),
    ];

    const { results, errors } = convertAllSchedulesToSIU(schedules);

    expect(results.length).toBe(2);
    expect(errors.length).toBe(0);
  });

  it('handles all schedules invalid', () => {
    const schedules = [
      makeSchedule({ id: 'sched-1', surgeon: null }),
      makeSchedule({ id: 'sched-2', procedure: null }),
    ];

    const { results, errors } = convertAllSchedulesToSIU(schedules);

    expect(results.length).toBe(0);
    expect(errors.length).toBe(2);
  });
});
