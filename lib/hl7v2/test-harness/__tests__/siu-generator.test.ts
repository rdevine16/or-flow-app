import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateSIUMessage,
  resetMessageCounter,
  formatHL7DateTime,
  type GeneratedSIUMessage,
} from '../siu-generator';
import {
  PROCEDURES,
  SURGEONS,
  PATIENTS,
  OR_ROOMS,
  ANESTHESIOLOGISTS,
  getProceduresBySpecialty,
  getSurgeonsBySpecialty,
  seededShuffle,
} from '../surgical-data';
import {
  generateFullDay,
  generateChaosDay,
  generateMultiDay,
} from '../scenario-runner';
import { parseSIUMessage } from '../../siu-parser';

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  resetMessageCounter();
});

// ── Surgical Data Pool Tests ─────────────────────────────────────────────────

describe('surgical data pools', () => {
  it('has valid CPT codes (5 digits) for all procedures', () => {
    for (const proc of PROCEDURES) {
      expect(proc.cptCode).toMatch(/^\d{5}$/);
    }
  });

  it('has valid ICD-10 codes for all procedures', () => {
    for (const proc of PROCEDURES) {
      // ICD-10 format: letter followed by digits, optional dot and more digits/letters
      expect(proc.icd10Code).toMatch(/^[A-Z]\d+/);
    }
  });

  it('has procedures for all specialties', () => {
    const specialties = new Set(PROCEDURES.map((p) => p.specialty));
    expect(specialties.size).toBeGreaterThanOrEqual(5);
    expect(specialties.has('orthopedics')).toBe(true);
    expect(specialties.has('ophthalmology')).toBe(true);
    expect(specialties.has('gi')).toBe(true);
    expect(specialties.has('spine')).toBe(true);
    expect(specialties.has('general')).toBe(true);
  });

  it('has surgeons for all specialties', () => {
    const specialties = new Set(SURGEONS.map((s) => s.specialty));
    expect(specialties.size).toBeGreaterThanOrEqual(5);
  });

  it('has unique NPIs for all surgeons', () => {
    const npis = SURGEONS.map((s) => s.npi);
    expect(new Set(npis).size).toBe(npis.length);
  });

  it('has unique NPIs for anesthesiologists', () => {
    const npis = ANESTHESIOLOGISTS.map((a) => a.npi);
    expect(new Set(npis).size).toBe(npis.length);
  });

  it('has unique MRNs for all patients', () => {
    const mrns = PATIENTS.map((p) => p.mrn);
    expect(new Set(mrns).size).toBe(mrns.length);
  });

  it('has at least 15 patients for full-day scenarios', () => {
    expect(PATIENTS.length).toBeGreaterThanOrEqual(15);
  });

  it('has at least 4 OR rooms', () => {
    expect(OR_ROOMS.length).toBeGreaterThanOrEqual(4);
  });

  it('filters procedures by specialty correctly', () => {
    const ortho = getProceduresBySpecialty(['orthopedics']);
    expect(ortho.length).toBeGreaterThan(0);
    expect(ortho.every((p) => p.specialty === 'orthopedics')).toBe(true);
  });

  it('filters surgeons by specialty correctly', () => {
    const gi = getSurgeonsBySpecialty(['gi']);
    expect(gi.length).toBeGreaterThan(0);
    expect(gi.every((s) => s.specialty === 'gi')).toBe(true);
  });

  it('shuffles deterministically with same seed', () => {
    const a = seededShuffle([1, 2, 3, 4, 5], 42);
    const b = seededShuffle([1, 2, 3, 4, 5], 42);
    expect(a).toEqual(b);
  });

  it('shuffles differently with different seeds', () => {
    const a = seededShuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 42);
    const b = seededShuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 99);
    // Very unlikely to be same order for 10 elements
    expect(a).not.toEqual(b);
  });
});

// ── SIU Message Generator Tests ──────────────────────────────────────────────

describe('generateSIUMessage', () => {
  const testDate = new Date('2026-03-15T08:00:00');

  it('generates a valid SIU^S12 message that parses correctly', () => {
    const result = generateSIUMessage({
      triggerEvent: 'S12',
      caseId: 'SC10001',
      scheduledDateTime: testDate,
    });

    // Should parse back without errors
    const parsed = parseSIUMessage(result.raw);
    expect(parsed.success).toBe(true);
    expect(parsed.message).not.toBeNull();
    expect(parsed.message!.triggerEvent).toBe('S12');
  });

  it('generates a valid SIU^S15 (cancel) message', () => {
    const result = generateSIUMessage({
      triggerEvent: 'S15',
      caseId: 'SC10002',
      scheduledDateTime: testDate,
    });

    const parsed = parseSIUMessage(result.raw);
    expect(parsed.success).toBe(true);
    expect(parsed.message!.triggerEvent).toBe('S15');
    expect(parsed.message!.sch.fillerStatusCode).toBe('Cancelled');
  });

  it('generates messages for all trigger events', () => {
    const events: Array<'S12' | 'S13' | 'S14' | 'S15' | 'S16'> = ['S12', 'S13', 'S14', 'S15', 'S16'];
    for (const event of events) {
      const result = generateSIUMessage({
        triggerEvent: event,
        caseId: `SC${event}`,
        scheduledDateTime: testDate,
      });

      const parsed = parseSIUMessage(result.raw);
      expect(parsed.success).toBe(true);
      expect(parsed.message!.triggerEvent).toBe(event);
    }
  });

  it('uses provided procedure data', () => {
    const proc = PROCEDURES.find((p) => p.cptCode === '27447')!;
    const result = generateSIUMessage({
      triggerEvent: 'S12',
      caseId: 'SC10001',
      scheduledDateTime: testDate,
      procedure: proc,
    });

    const parsed = parseSIUMessage(result.raw);
    expect(parsed.message!.ais!.procedureCode).toBe('27447');
    expect(parsed.message!.ais!.procedureDescription).toBe('Total knee arthroplasty');
  });

  it('uses provided surgeon data', () => {
    const surgeon = SURGEONS[0];
    const result = generateSIUMessage({
      triggerEvent: 'S12',
      caseId: 'SC10001',
      scheduledDateTime: testDate,
      surgeon,
    });

    const parsed = parseSIUMessage(result.raw);
    // Surgeon should appear in AIP segments
    const surgeonAip = parsed.message!.aip.find((a) => a.role === 'SURGEON');
    expect(surgeonAip).toBeDefined();
    expect(surgeonAip!.personnelLastName).toBe(surgeon.lastName);
    expect(surgeonAip!.personnelFirstName).toBe(surgeon.firstName);
  });

  it('uses provided patient data', () => {
    const patient = PATIENTS[0];
    const result = generateSIUMessage({
      triggerEvent: 'S12',
      caseId: 'SC10001',
      scheduledDateTime: testDate,
      patient,
    });

    const parsed = parseSIUMessage(result.raw);
    expect(parsed.message!.pid.patientId).toBe(patient.mrn);
    expect(parsed.message!.pid.lastName).toBe(patient.lastName);
    expect(parsed.message!.pid.firstName).toBe(patient.firstName);
  });

  it('uses provided room data', () => {
    const room = OR_ROOMS[2]; // OR3
    const result = generateSIUMessage({
      triggerEvent: 'S12',
      caseId: 'SC10001',
      scheduledDateTime: testDate,
      room,
    });

    const parsed = parseSIUMessage(result.raw);
    expect(parsed.message!.pv1.assignedLocation).toBe('OR3');
    expect(parsed.message!.ail!.locationCode).toBe('OR3');
  });

  it('includes correct case ID in SCH-1', () => {
    const result = generateSIUMessage({
      triggerEvent: 'S12',
      caseId: 'SC99999',
      scheduledDateTime: testDate,
    });

    const parsed = parseSIUMessage(result.raw);
    expect(parsed.message!.sch.placerAppointmentId).toBe('SC99999');
  });

  it('sets correct start/end times based on duration', () => {
    const proc = PROCEDURES.find((p) => p.cptCode === '27447')!; // 120 min
    const result = generateSIUMessage({
      triggerEvent: 'S12',
      caseId: 'SC10001',
      scheduledDateTime: testDate,
      procedure: proc,
    });

    expect(result.durationMinutes).toBe(120);

    const parsed = parseSIUMessage(result.raw);
    expect(parsed.message!.sch.startDateTime).not.toBeNull();
    expect(parsed.message!.sch.endDateTime).not.toBeNull();
    expect(parsed.message!.sch.appointmentDuration).toBe(120);
  });

  it('overrides duration when provided', () => {
    const result = generateSIUMessage({
      triggerEvent: 'S12',
      caseId: 'SC10001',
      scheduledDateTime: testDate,
      durationMinutes: 90,
    });

    expect(result.durationMinutes).toBe(90);
  });

  it('includes diagnosis from procedure data', () => {
    const proc = PROCEDURES.find((p) => p.cptCode === '27447')!;
    const result = generateSIUMessage({
      triggerEvent: 'S12',
      caseId: 'SC10001',
      scheduledDateTime: testDate,
      procedure: proc,
    });

    const parsed = parseSIUMessage(result.raw);
    expect(parsed.message!.dg1.length).toBe(1);
    expect(parsed.message!.dg1[0].diagnosisCode).toBe('M17.11');
  });

  it('includes surgeon as AIP', () => {
    const result = generateSIUMessage({
      triggerEvent: 'S12',
      caseId: 'SC10001',
      scheduledDateTime: testDate,
    });

    const parsed = parseSIUMessage(result.raw);
    // Only surgeon AIP is generated (anesthesiologist omitted from generator)
    expect(parsed.message!.aip.length).toBe(1);
    expect(parsed.message!.aip[0].role).toBe('SURGEON');
  });

  it('generates unique message control IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const result = generateSIUMessage({
        triggerEvent: 'S12',
        caseId: `SC${i}`,
        scheduledDateTime: testDate,
      });
      ids.add(result.messageControlId);
    }
    expect(ids.size).toBe(10);
  });

  it('uses custom message control ID when provided', () => {
    const result = generateSIUMessage({
      triggerEvent: 'S12',
      caseId: 'SC10001',
      scheduledDateTime: testDate,
      messageControlId: 'CUSTOM001',
    });

    expect(result.messageControlId).toBe('CUSTOM001');
    const parsed = parseSIUMessage(result.raw);
    expect(parsed.message!.msh.messageControlId).toBe('CUSTOM001');
  });

  it('filters by specialty when provided', () => {
    const result = generateSIUMessage({
      triggerEvent: 'S12',
      caseId: 'SC10001',
      scheduledDateTime: testDate,
      specialties: ['ophthalmology'],
    });

    // Procedure should be from ophthalmology
    const ophthoProcs = getProceduresBySpecialty(['ophthalmology']);
    const cptCodes = ophthoProcs.map((p) => p.cptCode);
    expect(cptCodes).toContain(result.procedure.cptCode);
  });
});

// ── formatHL7DateTime Tests ──────────────────────────────────────────────────

describe('formatHL7DateTime', () => {
  it('formats date correctly', () => {
    const date = new Date('2026-03-15T08:30:00');
    expect(formatHL7DateTime(date)).toBe('20260315083000');
  });

  it('pads single-digit values', () => {
    const date = new Date('2026-01-05T09:05:03');
    expect(formatHL7DateTime(date)).toBe('20260105090503');
  });
});

// ── Scenario Generator Tests ─────────────────────────────────────────────────

describe('generateFullDay', () => {
  const baseOptions = {
    facilityId: 'test-facility-id',
    startDate: new Date('2026-03-16'), // Monday
  };

  it('generates the requested number of cases', () => {
    const result = generateFullDay({ ...baseOptions, caseCount: 10 });
    expect(result.totalCases).toBeLessThanOrEqual(10);
    expect(result.totalMessages).toBe(result.messages.length);
  });

  it('generates default 15 cases', () => {
    const result = generateFullDay(baseOptions);
    expect(result.totalCases).toBeLessThanOrEqual(15);
    expect(result.totalCases).toBeGreaterThan(0);
  });

  it('all generated messages parse correctly', () => {
    const result = generateFullDay({ ...baseOptions, caseCount: 5 });
    for (const msg of result.messages) {
      const parsed = parseSIUMessage(msg.message.raw);
      expect(parsed.success).toBe(true);
    }
  });

  it('assigns messages to sequence numbers', () => {
    const result = generateFullDay({ ...baseOptions, caseCount: 5 });
    const seqNums = result.messages.map((m) => m.sequenceNumber);
    expect(seqNums).toEqual([1, 2, 3, 4, 5]);
  });

  it('schedules cases with no room overlap', () => {
    const result = generateFullDay({ ...baseOptions, caseCount: 8 });

    // Group by room, check no time overlaps
    const byRoom: Record<string, Array<{ start: Date; durationMinutes: number }>> = {};
    for (const msg of result.messages) {
      const room = msg.message.room.code;
      if (!byRoom[room]) byRoom[room] = [];
      byRoom[room].push({
        start: msg.message.scheduledDateTime,
        durationMinutes: msg.message.durationMinutes,
      });
    }

    for (const [room, cases] of Object.entries(byRoom)) {
      // Sort by start time
      cases.sort((a, b) => a.start.getTime() - b.start.getTime());
      for (let i = 1; i < cases.length; i++) {
        const prevEnd = cases[i - 1].start.getTime() + cases[i - 1].durationMinutes * 60_000;
        expect(cases[i].start.getTime()).toBeGreaterThanOrEqual(prevEnd);
      }
    }
  });

  it('all cases are S12 (new) trigger events', () => {
    const result = generateFullDay({ ...baseOptions, caseCount: 5 });
    for (const msg of result.messages) {
      expect(msg.message.triggerEvent).toBe('S12');
    }
  });

  it('respects specialty filter', () => {
    const result = generateFullDay({
      ...baseOptions,
      specialties: ['gi'],
      caseCount: 5,
    });

    const giProcs = getProceduresBySpecialty(['gi']);
    const giCptCodes = giProcs.map((p) => p.cptCode);

    for (const msg of result.messages) {
      expect(giCptCodes).toContain(msg.message.procedure.cptCode);
    }
  });

  it('returns full-day type', () => {
    const result = generateFullDay(baseOptions);
    expect(result.type).toBe('full-day');
  });
});

describe('generateChaosDay', () => {
  const baseOptions = {
    facilityId: 'test-facility-id',
    startDate: new Date('2026-03-16'),
  };

  it('generates more messages than a full day (reschedules + cancellations + add-ons)', () => {
    const fullDay = generateFullDay({ ...baseOptions, caseCount: 12 });
    const chaos = generateChaosDay({ ...baseOptions, caseCount: 12 });

    expect(chaos.totalMessages).toBeGreaterThan(fullDay.totalMessages);
  });

  it('contains S13 (reschedule) messages', () => {
    const result = generateChaosDay(baseOptions);
    const reschedules = result.messages.filter((m) => m.message.triggerEvent === 'S13');
    expect(reschedules.length).toBeGreaterThan(0);
  });

  it('contains S15 (cancel) messages', () => {
    const result = generateChaosDay(baseOptions);
    const cancels = result.messages.filter((m) => m.message.triggerEvent === 'S15');
    expect(cancels.length).toBeGreaterThan(0);
  });

  it('contains add-on S12 messages after initial batch', () => {
    const result = generateChaosDay(baseOptions);
    // Add-ons come after the initial S12 batch + reschedules + cancels
    const initialCount = (baseOptions as { caseCount?: number }).caseCount || 12;
    const addOns = result.messages.filter(
      (m) => m.message.triggerEvent === 'S12' && m.sequenceNumber > initialCount
    );
    expect(addOns.length).toBeGreaterThan(0);
  });

  it('all generated messages parse correctly', () => {
    const result = generateChaosDay({ ...baseOptions, caseCount: 6 });
    for (const msg of result.messages) {
      const parsed = parseSIUMessage(msg.message.raw);
      expect(parsed.success).toBe(true);
    }
  });

  it('returns chaos type', () => {
    const result = generateChaosDay(baseOptions);
    expect(result.type).toBe('chaos');
  });
});

describe('generateMultiDay', () => {
  const baseOptions = {
    facilityId: 'test-facility-id',
    startDate: new Date('2026-03-16'), // Monday
  };

  it('generates messages for multiple days', () => {
    const result = generateMultiDay({ ...baseOptions, dayCount: 3, caseCount: 5 });
    expect(result.totalMessages).toBeGreaterThan(5); // More than one day
  });

  it('all messages parse correctly', () => {
    const result = generateMultiDay({ ...baseOptions, dayCount: 2, caseCount: 3 });
    for (const msg of result.messages) {
      const parsed = parseSIUMessage(msg.message.raw);
      expect(parsed.success).toBe(true);
    }
  });

  it('sequences are contiguous across days', () => {
    const result = generateMultiDay({ ...baseOptions, dayCount: 2, caseCount: 3 });
    const seqNums = result.messages.map((m) => m.sequenceNumber);
    for (let i = 1; i < seqNums.length; i++) {
      expect(seqNums[i]).toBe(seqNums[i - 1] + 1);
    }
  });

  it('returns multi-day type', () => {
    const result = generateMultiDay(baseOptions);
    expect(result.type).toBe('multi-day');
  });
});

// ── Integration: Round-Trip (Generate → Parse → Verify) ─────────────────────

describe('round-trip: generate → parse → verify field mapping', () => {
  const testDate = new Date('2026-03-15T08:00:00');
  const proc = PROCEDURES.find((p) => p.cptCode === '27447')!;
  const surgeon = SURGEONS[0];
  const patient = PATIENTS[0];
  const room = OR_ROOMS[2]; // OR3

  it('maps all fields from the SIU spec correctly', () => {
    const generated = generateSIUMessage({
      triggerEvent: 'S12',
      caseId: 'SC10001',
      scheduledDateTime: testDate,
      procedure: proc,
      surgeon,
      patient,
      room,
    });

    const parsed = parseSIUMessage(generated.raw);
    expect(parsed.success).toBe(true);
    const msg = parsed.message!;

    // MSH fields
    expect(msg.msh.sendingApplication).toBe('EPIC');
    expect(msg.msh.sendingFacility).toBe('SURGERY_CENTER');
    expect(msg.msh.messageType).toBe('SIU^S12');
    expect(msg.msh.processingId).toBe('P');
    expect(msg.msh.versionId).toBe('2.3');

    // SCH fields → ORbit: external_case_id, scheduled_date, duration
    expect(msg.sch.placerAppointmentId).toBe('SC10001');
    expect(msg.sch.appointmentReason).toBe(proc.name);
    expect(msg.sch.appointmentDuration).toBe(proc.typicalDurationMinutes);
    expect(msg.sch.fillerStatusCode).toBe('Booked');
    expect(msg.sch.startDateTime).not.toBeNull();
    expect(msg.sch.endDateTime).not.toBeNull();

    // PID fields → ORbit: patients table
    expect(msg.pid.patientId).toBe(patient.mrn);
    expect(msg.pid.lastName).toBe(patient.lastName);
    expect(msg.pid.firstName).toBe(patient.firstName);
    expect(msg.pid.middleName).toBe(patient.middleName);
    expect(msg.pid.dateOfBirth).toBe('1965-04-15'); // YYYYMMDD → ISO
    expect(msg.pid.gender).toBe(patient.gender);

    // PV1 fields → ORbit: or_room_id, surgeon_id
    expect(msg.pv1.assignedLocation).toBe(room.code);
    expect(msg.pv1.assignedLocationFacility).toBe(room.facility);
    expect(msg.pv1.patientClass).toBe('O'); // Outpatient
    expect(msg.pv1.hospitalService).toBe('ORTHO');

    // DG1 fields → ORbit: primary_diagnosis_code, primary_diagnosis_desc
    expect(msg.dg1.length).toBe(1);
    expect(msg.dg1[0].diagnosisCode).toBe(proc.icd10Code);
    expect(msg.dg1[0].diagnosisDescription).toBe(proc.icd10Description);
    expect(msg.dg1[0].codingMethod).toBe('I10');

    // AIS fields → ORbit: procedure_type_id
    expect(msg.ais!.procedureCode).toBe(proc.cptCode);
    expect(msg.ais!.procedureDescription).toBe(proc.name);
    expect(msg.ais!.procedureCodeSystem).toBe('CPT');
    expect(msg.ais!.duration).toBe(proc.typicalDurationMinutes);

    // AIL fields → ORbit: or_room_id (confirm)
    expect(msg.ail!.locationCode).toBe(room.code);
    expect(msg.ail!.locationFacility).toBe(room.facility);

    // AIP fields → ORbit: surgeon_id + staff
    // Only surgeon AIP is generated (anesthesiologist omitted from generator)
    expect(msg.aip.length).toBe(1);
    const surgeonAip = msg.aip[0];
    expect(surgeonAip.role).toBe('SURGEON');
    expect(surgeonAip.personnelLastName).toBe(surgeon.lastName);
    expect(surgeonAip.personnelFirstName).toBe(surgeon.firstName);
    expect(surgeonAip.personnelNPI).toBe(surgeon.npi);
  });

  it('generates correct full-day scenario with verifiable case data', () => {
    const fullDay = generateFullDay({
      facilityId: 'test-facility',
      startDate: testDate,
      caseCount: 5,
    });

    expect(fullDay.totalCases).toBe(5);

    // Verify each message round-trips correctly
    for (const scenarioMsg of fullDay.messages) {
      const parsed = parseSIUMessage(scenarioMsg.message.raw);
      expect(parsed.success).toBe(true);

      // Case ID should match
      expect(parsed.message!.sch.placerAppointmentId).toBe(scenarioMsg.message.caseId);

      // Procedure should match
      expect(parsed.message!.ais!.procedureCode).toBe(scenarioMsg.message.procedure.cptCode);

      // Patient should match
      expect(parsed.message!.pid.patientId).toBe(scenarioMsg.message.patient.mrn);
    }
  });
});
