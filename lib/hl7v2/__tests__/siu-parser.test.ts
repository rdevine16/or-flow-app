import { describe, it, expect } from 'vitest';
import { parseSIUMessage } from '../siu-parser';
import { generateSIUMessage } from '../test-harness/siu-generator';
import type { EhrIntegrationType } from '@/lib/integrations/shared/integration-types';

// ── Test Messages ───────────────────────────────────────────────────────────

/** Full SIU^S12 (New Surgical Case Booked) — the Epic OpTime example from the spec */
const SIU_S12_FULL = [
  'MSH|^~\\&|EPIC|SURGERY_CENTER|||20260301143022||SIU^S12|MSG00001|P|2.3||||||',
  'SCH|SC10001^SC10001|FL20001^FL20001|||SC10001|SURGERY^Surgical Case|Right knee total arthroplasty|SURGERY|120|min|^^120^20260315080000^20260315100000|||||1001^SMITH^JOHN^A^MD^^^^NPI^1234567890||||1001^SMITH^JOHN^A^MD^^^^|||||Booked',
  'PID|1||MRN12345^^^^MR||DOE^JANE^M^^||19650415|F|||123 Main St^^Springfield^IL^62704^US||(217)555-0123^HOME|(217)555-0456^WORK||S||ACCT98765|987-65-4321||||||||||||||||||',
  'PV1|1|O|OR3^^^SURGERY_CENTER^^^^^||||1001^SMITH^JOHN^A^MD^^^^|||ORTHO||||||||||||12345||||||||||||||||||||||||||||V',
  'DG1|1|I10|M17.11^Primary osteoarthritis, right knee^I10|Primary osteoarthritis, right knee||',
  'RGS|1|A|RG001',
  'AIS|1|A|27447^Total knee arthroplasty^CPT|20260315080000|15|min|120|min|Booked||',
  'AIL|1|A|OR3^^^SURGERY_CENTER|^Operating Room 3||20260315080000|||120|min||Booked',
  'AIP|1|A|1001^SMITH^JOHN^A^MD^^^^|SURGEON||20260315080000|||120|min||Booked',
  'AIP|2|A|2001^JONES^MARIA^L^MD^^^^|ANESTHESIOLOGIST||20260315075500|||135|min||Booked',
].join('\r');

/** SIU^S13 (Rescheduled) */
const SIU_S13 = [
  'MSH|^~\\&|EPIC|SURGERY_CENTER|||20260302090000||SIU^S13|MSG00002|P|2.3',
  'SCH|SC10001^SC10001|FL20001^FL20001|||SC10001|SURGERY^Surgical Case|Right knee total arthroplasty|SURGERY|120|min|^^120^20260316090000^20260316110000|||||1001^SMITH^JOHN^A^MD^^^^||||1001^SMITH^JOHN^A^MD^^^^|||||Booked',
  'PID|1||MRN12345^^^^MR||DOE^JANE^M^^||19650415|F',
  'PV1|1|O|OR5^^^SURGERY_CENTER||||1001^SMITH^JOHN^A^MD^^^^||ORTHO',
].join('\r');

/** SIU^S14 (Modified) */
const SIU_S14 = [
  'MSH|^~\\&|EPIC|SURGERY_CENTER|||20260302100000||SIU^S14|MSG00003|P|2.3',
  'SCH|SC10001^SC10001|FL20001^FL20001|||SC10001|SURGERY^Surgical Case|Revised: bilateral knee arthroplasty|SURGERY|180|min|^^180^20260316090000^20260316120000|||||1001^SMITH^JOHN^A^MD^^^^||||1001^SMITH^JOHN^A^MD^^^^|||||Booked',
  'PID|1||MRN12345^^^^MR||DOE^JANE^M^^||19650415|F',
  'PV1|1|O|OR5^^^SURGERY_CENTER||||1001^SMITH^JOHN^A^MD^^^^||ORTHO',
  'AIS|1|A|27447^Bilateral knee arthroplasty^CPT|20260316090000|15|min|180|min|Booked||',
].join('\r');

/** SIU^S15 (Canceled) */
const SIU_S15 = [
  'MSH|^~\\&|EPIC|SURGERY_CENTER|||20260303080000||SIU^S15|MSG00004|P|2.3',
  'SCH|SC10001^SC10001|FL20001^FL20001|||SC10001|SURGERY^Surgical Case|Right knee total arthroplasty|SURGERY|||||||||||||||||Cancelled',
  'PID|1||MRN12345^^^^MR||DOE^JANE^M^^||19650415|F',
].join('\r');

/** SIU^S16 (Discontinued) */
const SIU_S16 = [
  'MSH|^~\\&|EPIC|SURGERY_CENTER|||20260303090000||SIU^S16|MSG00005|P|2.3',
  'SCH|SC10002^SC10002|FL20002^FL20002|||SC10002|SURGERY^Surgical Case|ACL reconstruction|SURGERY|||||||||||||||||Discontinued',
  'PID|1||MRN67890^^^^MR||SMITH^BOB^^||19800101|M',
].join('\r');

/** Message with missing optional segments (no DG1, no AIG, no AIL) */
const MINIMAL_SIU = [
  'MSH|^~\\&|EPIC|FAC|||20260301000000||SIU^S12|MSG99|P|2.3',
  'SCH|SC999|FL999||||SURGERY|Test case|SURGERY|60|min|^^60^20260315120000^20260315130000|||||||||||||Booked',
  'PID|1||MRN999^^^^MR||TEST^PATIENT^^||19900101|M',
].join('\r');

// ── SIU^S12 Full Message Tests ──────────────────────────────────────────────

describe('parseSIUMessage — SIU^S12 (New Case)', () => {
  it('parses successfully with all fields', () => {
    const result = parseSIUMessage(SIU_S12_FULL);
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.message).not.toBeNull();
  });

  it('extracts correct trigger event', () => {
    const result = parseSIUMessage(SIU_S12_FULL);
    expect(result.message!.triggerEvent).toBe('S12');
  });

  it('parses MSH segment correctly', () => {
    const { message } = parseSIUMessage(SIU_S12_FULL);
    const msh = message!.msh;
    expect(msh.sendingApplication).toBe('EPIC');
    expect(msh.sendingFacility).toBe('SURGERY_CENTER');
    expect(msh.messageType).toBe('SIU^S12');
    expect(msh.messageControlId).toBe('MSG00001');
    expect(msh.processingId).toBe('P');
    expect(msh.versionId).toBe('2.3');
  });

  it('parses SCH segment with timing data', () => {
    const { message } = parseSIUMessage(SIU_S12_FULL);
    const sch = message!.sch;
    expect(sch.placerAppointmentId).toBe('SC10001');
    expect(sch.fillerAppointmentId).toBe('FL20001');
    expect(sch.appointmentReason).toBe('Right knee total arthroplasty');
    expect(sch.startDateTime).toBe('2026-03-15T08:00:00');
    expect(sch.endDateTime).toBe('2026-03-15T10:00:00');
    expect(sch.fillerStatusCode).toBe('Booked');
  });

  it('parses SCH-11 timing correctly (^^duration^startDT^endDT)', () => {
    const { message } = parseSIUMessage(SIU_S12_FULL);
    expect(message!.sch.appointmentDuration).toBe(120);
    expect(message!.sch.startDateTime).toBe('2026-03-15T08:00:00');
    expect(message!.sch.endDateTime).toBe('2026-03-15T10:00:00');
  });

  it('parses PID segment with patient demographics', () => {
    const { message } = parseSIUMessage(SIU_S12_FULL);
    const pid = message!.pid;
    expect(pid.patientId).toBe('MRN12345');
    expect(pid.patientIdType).toBe('MR');
    expect(pid.lastName).toBe('DOE');
    expect(pid.firstName).toBe('JANE');
    expect(pid.middleName).toBe('M');
    expect(pid.dateOfBirth).toBe('1965-04-15');
    expect(pid.gender).toBe('F');
    expect(pid.accountNumber).toBe('ACCT98765');
  });

  it('parses PID-5 patient name (LAST^FIRST^MIDDLE^^)', () => {
    const { message } = parseSIUMessage(SIU_S12_FULL);
    expect(message!.pid.lastName).toBe('DOE');
    expect(message!.pid.firstName).toBe('JANE');
    expect(message!.pid.middleName).toBe('M');
  });

  it('parses PID-11 address', () => {
    const { message } = parseSIUMessage(SIU_S12_FULL);
    expect(message!.pid.address).toEqual({
      street: '123 Main St',
      city: 'Springfield',
      state: 'IL',
      zip: '62704',
      country: 'US',
    });
  });

  it('parses PV1 with attending doctor and OR room', () => {
    const { message } = parseSIUMessage(SIU_S12_FULL);
    const pv1 = message!.pv1;
    expect(pv1.patientClass).toBe('O');
    expect(pv1.assignedLocation).toBe('OR3');
    expect(pv1.assignedLocationFacility).toBe('SURGERY_CENTER');
    expect(pv1.hospitalService).toBe('ORTHO');
    expect(pv1.attendingDoctor).not.toBeNull();
    expect(pv1.attendingDoctor!.id).toBe('1001');
    expect(pv1.attendingDoctor!.lastName).toBe('SMITH');
  });

  it('parses DG1 diagnosis segments', () => {
    const { message } = parseSIUMessage(SIU_S12_FULL);
    expect(message!.dg1).toHaveLength(1);
    expect(message!.dg1[0].diagnosisCode).toBe('M17.11');
    expect(message!.dg1[0].diagnosisDescription).toBe('Primary osteoarthritis, right knee');
    expect(message!.dg1[0].diagnosisCodeSystem).toBe('I10');
  });

  it('parses AIS procedure segment', () => {
    const { message } = parseSIUMessage(SIU_S12_FULL);
    expect(message!.ais).not.toBeNull();
    expect(message!.ais!.procedureCode).toBe('27447');
    expect(message!.ais!.procedureDescription).toBe('Total knee arthroplasty');
    expect(message!.ais!.procedureCodeSystem).toBe('CPT');
    expect(message!.ais!.duration).toBe(120);
  });

  it('parses AIL location segment', () => {
    const { message } = parseSIUMessage(SIU_S12_FULL);
    expect(message!.ail).not.toBeNull();
    expect(message!.ail!.locationCode).toBe('OR3');
    expect(message!.ail!.locationFacility).toBe('SURGERY_CENTER');
  });

  it('parses repeating AIP segments (surgeon + anesthesiologist)', () => {
    const { message } = parseSIUMessage(SIU_S12_FULL);
    expect(message!.aip).toHaveLength(2);

    const surgeon = message!.aip[0];
    expect(surgeon.personnelId).toBe('1001');
    expect(surgeon.personnelLastName).toBe('SMITH');
    expect(surgeon.personnelFirstName).toBe('JOHN');
    expect(surgeon.role).toBe('SURGEON');
    expect(surgeon.duration).toBe(120);

    const anesthesiologist = message!.aip[1];
    expect(anesthesiologist.personnelId).toBe('2001');
    expect(anesthesiologist.personnelLastName).toBe('JONES');
    expect(anesthesiologist.personnelFirstName).toBe('MARIA');
    expect(anesthesiologist.role).toBe('ANESTHESIOLOGIST');
    expect(anesthesiologist.duration).toBe(135);
  });

  it('records rawSegments for all segment types', () => {
    const result = parseSIUMessage(SIU_S12_FULL);
    expect(result.rawSegments['MSH']).toHaveLength(1);
    expect(result.rawSegments['SCH']).toHaveLength(1);
    expect(result.rawSegments['PID']).toHaveLength(1);
    expect(result.rawSegments['AIP']).toHaveLength(2);
  });
});

// ── All Trigger Events ──────────────────────────────────────────────────────

describe('parseSIUMessage — all trigger events', () => {
  it('parses SIU^S13 (rescheduled)', () => {
    const result = parseSIUMessage(SIU_S13);
    expect(result.success).toBe(true);
    expect(result.message!.triggerEvent).toBe('S13');
    expect(result.message!.sch.placerAppointmentId).toBe('SC10001');
    // Rescheduled to new date
    expect(result.message!.sch.startDateTime).toBe('2026-03-16T09:00:00');
    // Moved to OR5
    expect(result.message!.pv1.assignedLocation).toBe('OR5');
  });

  it('parses SIU^S14 (modified)', () => {
    const result = parseSIUMessage(SIU_S14);
    expect(result.success).toBe(true);
    expect(result.message!.triggerEvent).toBe('S14');
    expect(result.message!.sch.appointmentReason).toBe('Revised: bilateral knee arthroplasty');
    expect(result.message!.sch.appointmentDuration).toBe(180);
    expect(result.message!.ais).not.toBeNull();
    expect(result.message!.ais!.procedureDescription).toBe('Bilateral knee arthroplasty');
  });

  it('parses SIU^S15 (canceled)', () => {
    const result = parseSIUMessage(SIU_S15);
    expect(result.success).toBe(true);
    expect(result.message!.triggerEvent).toBe('S15');
    expect(result.message!.sch.fillerStatusCode).toBe('Cancelled');
  });

  it('parses SIU^S16 (discontinued)', () => {
    const result = parseSIUMessage(SIU_S16);
    expect(result.success).toBe(true);
    expect(result.message!.triggerEvent).toBe('S16');
    expect(result.message!.sch.fillerStatusCode).toBe('Discontinued');
    expect(result.message!.pid.patientId).toBe('MRN67890');
  });
});

// ── Missing / Optional Segments ─────────────────────────────────────────────

describe('parseSIUMessage — optional segments', () => {
  it('handles missing DG1 segments', () => {
    const result = parseSIUMessage(MINIMAL_SIU);
    expect(result.success).toBe(true);
    expect(result.message!.dg1).toEqual([]);
  });

  it('handles missing AIG segments', () => {
    const result = parseSIUMessage(MINIMAL_SIU);
    expect(result.message!.aig).toEqual([]);
  });

  it('handles missing AIL segment', () => {
    const result = parseSIUMessage(MINIMAL_SIU);
    expect(result.message!.ail).toBeNull();
  });

  it('handles missing AIP segments', () => {
    const result = parseSIUMessage(MINIMAL_SIU);
    expect(result.message!.aip).toEqual([]);
  });

  it('handles missing RGS segment', () => {
    const result = parseSIUMessage(MINIMAL_SIU);
    expect(result.message!.rgs).toBeNull();
  });

  it('handles missing PV1 — creates empty PV1', () => {
    const msg = [
      'MSH|^~\\&|EPIC|FAC|||20260301000000||SIU^S12|MSG88|P|2.3',
      'SCH|SC88|FL88||||SURGERY|Test|SURGERY||||||||||||||||Booked',
      'PID|1||MRN88^^^^MR||TEST^PAT^^||19900101|M',
    ].join('\r');
    const result = parseSIUMessage(msg);
    expect(result.success).toBe(true);
    expect(result.message!.pv1.assignedLocation).toBe('');
    expect(result.message!.pv1.attendingDoctor).toBeNull();
  });
});

// ── Error Handling ──────────────────────────────────────────────────────────

describe('parseSIUMessage — error handling', () => {
  it('fails on empty message', () => {
    const result = parseSIUMessage('');
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('fails on non-HL7 content', () => {
    const result = parseSIUMessage('This is not an HL7 message');
    expect(result.success).toBe(false);
  });

  it('fails on non-SIU message type', () => {
    const msg = 'MSH|^~\\&|EPIC|FAC|||20260301000000||ADT^A01|MSG01|P|2.3';
    const result = parseSIUMessage(msg);
    expect(result.success).toBe(false);
    expect(result.errors.some(e => e.message.includes('Invalid or unsupported message type'))).toBe(true);
  });

  it('fails when missing SCH segment', () => {
    const msg = [
      'MSH|^~\\&|EPIC|FAC|||20260301000000||SIU^S12|MSG01|P|2.3',
      'PID|1||MRN1^^^^MR||DOE^JANE^^||19650415|F',
    ].join('\r');
    const result = parseSIUMessage(msg);
    expect(result.success).toBe(false);
    expect(result.errors.some(e => e.segment === 'SCH')).toBe(true);
  });

  it('fails when missing PID segment', () => {
    const msg = [
      'MSH|^~\\&|EPIC|FAC|||20260301000000||SIU^S12|MSG01|P|2.3',
      'SCH|SC1|FL1||||SURGERY|Test|SURGERY||||||||||||||||Booked',
    ].join('\r');
    const result = parseSIUMessage(msg);
    expect(result.success).toBe(false);
    expect(result.errors.some(e => e.segment === 'PID')).toBe(true);
  });

  it('fails on unsupported SIU trigger event', () => {
    const msg = 'MSH|^~\\&|EPIC|FAC|||20260301000000||SIU^S99|MSG01|P|2.3\rSCH|SC1|FL1\rPID|1||MRN1^^^^MR||DOE^JANE^^||19650415|F';
    const result = parseSIUMessage(msg);
    expect(result.success).toBe(false);
    expect(result.errors.some(e => e.message.includes('Invalid or unsupported'))).toBe(true);
  });

  it('returns errors array but still provides partial message when possible', () => {
    // Message with missing SCH-1 (empty placer ID)
    const msg = [
      'MSH|^~\\&|EPIC|FAC|||20260301000000||SIU^S12|MSG01|P|2.3',
      'SCH||FL1||||SURGERY|Test|SURGERY||||||||||||||||Booked',
      'PID|1||MRN1^^^^MR||DOE^JANE^^||19650415|F',
    ].join('\r');
    const result = parseSIUMessage(msg);
    // Has validation error for missing SCH-1
    expect(result.errors.some(e => e.segment === 'SCH' && e.field === '1')).toBe(true);
    // But still provides the partial message
    expect(result.message).not.toBeNull();
  });
});

// ── Round-Trip Tests ────────────────────────────────────────────────────────

describe('parseSIUMessage — round-trip verification', () => {
  it('parsed SIU^S12 maps correctly to ORbit field mapping table', () => {
    const { message } = parseSIUMessage(SIU_S12_FULL);
    const m = message!;

    // SCH-1 → external_case_id
    expect(m.sch.placerAppointmentId).toBe('SC10001');

    // SCH-11.4 → scheduled_date + start_time
    expect(m.sch.startDateTime).toBe('2026-03-15T08:00:00');

    // SCH-11.5 → derive duration (end - start)
    expect(m.sch.endDateTime).toBe('2026-03-15T10:00:00');

    // SCH-25 → status_id mapping
    expect(m.sch.fillerStatusCode).toBe('Booked');

    // PID-3 → patients.mrn
    expect(m.pid.patientId).toBe('MRN12345');

    // PID-5 → patients.first_name, last_name
    expect(m.pid.firstName).toBe('JANE');
    expect(m.pid.lastName).toBe('DOE');

    // PID-7 → patients.date_of_birth
    expect(m.pid.dateOfBirth).toBe('1965-04-15');

    // PID-8 → gender (in parsed_data)
    expect(m.pid.gender).toBe('F');

    // PV1-7 → surgeon_id (match by NPI or name)
    expect(m.pv1.attendingDoctor!.id).toBe('1001');
    expect(m.pv1.attendingDoctor!.lastName).toBe('SMITH');

    // PV1-3 → or_room_id (match OR room by name)
    expect(m.pv1.assignedLocation).toBe('OR3');

    // DG1-3 → primary_diagnosis_code
    expect(m.dg1[0].diagnosisCode).toBe('M17.11');

    // DG1-4 → primary_diagnosis_desc
    expect(m.dg1[0].diagnosisDescription).toBe('Primary osteoarthritis, right knee');

    // AIS-3 → procedure_type_id (match by CPT code)
    expect(m.ais!.procedureCode).toBe('27447');
    expect(m.ais!.procedureDescription).toBe('Total knee arthroplasty');

    // AIS-7 → duration calculation
    expect(m.ais!.duration).toBe(120);

    // AIL-3 → or_room_id (confirm OR room)
    expect(m.ail!.locationCode).toBe('OR3');

    // AIP-3 → surgeon_id / staff (match provider)
    expect(m.aip[0].personnelId).toBe('1001');
    expect(m.aip[0].role).toBe('SURGEON');

    // AIP-4 → staff role mapping
    expect(m.aip[1].role).toBe('ANESTHESIOLOGIST');
  });

  it('S12→S13→S14→S15 lifecycle produces correct state transitions', () => {
    // S12: New case
    const s12 = parseSIUMessage(SIU_S12_FULL);
    expect(s12.message!.sch.placerAppointmentId).toBe('SC10001');
    expect(s12.message!.sch.fillerStatusCode).toBe('Booked');
    expect(s12.message!.sch.startDateTime).toBe('2026-03-15T08:00:00');

    // S13: Rescheduled
    const s13 = parseSIUMessage(SIU_S13);
    expect(s13.message!.sch.placerAppointmentId).toBe('SC10001');
    expect(s13.message!.sch.startDateTime).toBe('2026-03-16T09:00:00');
    expect(s13.message!.pv1.assignedLocation).toBe('OR5');

    // S14: Modified (procedure changed)
    const s14 = parseSIUMessage(SIU_S14);
    expect(s14.message!.sch.placerAppointmentId).toBe('SC10001');
    expect(s14.message!.sch.appointmentDuration).toBe(180);
    expect(s14.message!.ais!.procedureDescription).toBe('Bilateral knee arthroplasty');

    // S15: Canceled
    const s15 = parseSIUMessage(SIU_S15);
    expect(s15.message!.sch.placerAppointmentId).toBe('SC10001');
    expect(s15.message!.sch.fillerStatusCode).toBe('Cancelled');
  });
});

// ── Multiple DG1 Segments ───────────────────────────────────────────────────

describe('parseSIUMessage — multiple diagnoses', () => {
  it('collects multiple DG1 segments', () => {
    const msg = [
      'MSH|^~\\&|EPIC|FAC|||20260301000000||SIU^S12|MSG77|P|2.3',
      'SCH|SC77|FL77||||SURGERY|Multi-diagnosis case|SURGERY|90|min|^^90^20260315100000^20260315113000|||||||||||||Booked',
      'PID|1||MRN77^^^^MR||MULTI^DIAG^^||19750101|F',
      'DG1|1|I10|M17.11^Primary osteoarthritis, right knee^I10|Primary osteoarthritis, right knee||',
      'DG1|2|I10|E11.9^Type 2 diabetes mellitus^I10|Type 2 diabetes mellitus||',
      'DG1|3|I10|I10^Essential hypertension^I10|Essential hypertension||',
    ].join('\r');

    const result = parseSIUMessage(msg);
    expect(result.success).toBe(true);
    expect(result.message!.dg1).toHaveLength(3);
    expect(result.message!.dg1[0].diagnosisCode).toBe('M17.11');
    expect(result.message!.dg1[1].diagnosisCode).toBe('E11.9');
    expect(result.message!.dg1[2].diagnosisCode).toBe('I10');
  });
});

// ── Oracle Cerner Message Variants ─────────────────────────────────────────

describe('parseSIUMessage — Oracle Cerner messages', () => {
  /** Cerner SIU^S12 with MSH-3=CERNER and custom ZSG Z-segment */
  const CERNER_SIU_S12 = [
    'MSH|^~\\&|CERNER|SURGERY_CENTER|||20260301143022||SIU^S12|CMSG001|P|2.3||||||',
    'SCH|CSE5001^CSE5001|FLC5001^FLC5001|||CSE5001|SURGERY^Surgical Case|Laparoscopic cholecystectomy|SURGERY|90|min|^^90^20260320090000^20260320103000|||||2001^CHEN^DAVID^L^MD^^^^NPI^9876543210||||2001^CHEN^DAVID^L^MD^^^^|||||Booked',
    'PID|1||MRN55001^^^^MR||GARCIA^MARIA^R^^||19720918|F|||456 Oak Ave^^Chicago^IL^60601^US||(312)555-0199^HOME||||ACCT55001||',
    'PV1|1|O|OR7^^^SURGERY_CENTER^^^^^||||2001^CHEN^DAVID^L^MD^^^^|||GI||||||||||||67890||||||||||||||||||||||||||||V',
    'ZSG|1|CERNER_CUSTOM|SurgiNet scheduling data|Additional Cerner-specific metadata',
    'DG1|1|I10|K80.20^Calculus of gallbladder without cholecystitis^I10|Calculus of gallbladder||',
    'RGS|1|A|RG002',
    'AIS|1|A|47562^Laparoscopic cholecystectomy^CPT|20260320090000|15|min|90|min|Booked||',
    'AIL|1|A|OR7^^^SURGERY_CENTER|^Operating Room 7||20260320090000|||90|min||Booked',
    'AIP|1|A|2001^CHEN^DAVID^L^MD^^^^|SURGEON||20260320090000|||90|min||Booked',
  ].join('\r');

  it('parses Cerner SIU^S12 with MSH-3=CERNER', () => {
    const result = parseSIUMessage(CERNER_SIU_S12);
    expect(result.success).toBe(true);
    expect(result.message!.msh.sendingApplication).toBe('CERNER');
    expect(result.message!.triggerEvent).toBe('S12');
  });

  it('gracefully ignores custom Z-segments (ZSG)', () => {
    const result = parseSIUMessage(CERNER_SIU_S12);
    expect(result.success).toBe(true);
    // Z-segments should not cause parsing errors
    expect(result.errors).toHaveLength(0);
    // All standard segments parsed correctly
    expect(result.message!.sch.placerAppointmentId).toBe('CSE5001');
    expect(result.message!.pid.patientId).toBe('MRN55001');
    expect(result.message!.aip).toHaveLength(1);
  });

  it('parses Cerner patient and procedure data correctly', () => {
    const result = parseSIUMessage(CERNER_SIU_S12);
    const m = result.message!;
    expect(m.pid.lastName).toBe('GARCIA');
    expect(m.pid.firstName).toBe('MARIA');
    expect(m.ais!.procedureCode).toBe('47562');
    expect(m.ais!.procedureDescription).toBe('Laparoscopic cholecystectomy');
    expect(m.aip[0].personnelLastName).toBe('CHEN');
    expect(m.aip[0].role).toBe('SURGEON');
  });

  it('handles Cerner message with multiple Z-segments', () => {
    const msg = [
      'MSH|^~\\&|CERNER|SURGERY_CENTER|||20260301143022||SIU^S12|CMSG002|P|2.3',
      'SCH|CSE5002^CSE5002|FLC5002^FLC5002|||CSE5002|SURGERY^Surgical Case|Appendectomy|SURGERY|60|min|^^60^20260320100000^20260320110000|||||||||||||Booked',
      'PID|1||MRN55002^^^^MR||JOHNSON^ROBERT^T^^||19850301|M',
      'PV1|1|O|OR2^^^SURGERY_CENTER||||3001^PATEL^ANIL^K^MD^^^^||GENSURG',
      'ZSG|1|SURGINET_REF|ref-12345',
      'ZCS|1|CUSTOM_STATUS|scheduled|normal',
      'ZDT|1|20260320|MORNING_BLOCK',
      'RGS|1|A|RG003',
      'AIS|1|A|44950^Appendectomy^CPT|20260320100000|10|min|60|min|Booked||',
      'AIP|1|A|3001^PATEL^ANIL^K^MD^^^^|SURGEON||20260320100000|||60|min||Booked',
    ].join('\r');

    const result = parseSIUMessage(msg);
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.message!.sch.placerAppointmentId).toBe('CSE5002');
    expect(result.message!.ais!.procedureCode).toBe('44950');
  });
});

// ── MEDITECH Message Variants ──────────────────────────────────────────────

describe('parseSIUMessage — MEDITECH messages', () => {
  /** MEDITECH SIU^S12 with MSH-3=MEDITECH, HL7 v2.4, PV1-7 primary surgeon, no AIP */
  const MEDITECH_SIU_S12 = [
    'MSH|^~\\&|MEDITECH|SURGERY_CENTER|||20260301143022||SIU^S12|MMSG001|P|2.4||||||',
    'SCH|MSE7001^MSE7001|FLM7001^FLM7001|||MSE7001|SURGERY^Surgical Case|Total hip arthroplasty|SURGERY|150|min|^^150^20260322070000^20260322093000|||||4001^WILSON^SARAH^J^MD^^^^NPI^5556667777||||4001^WILSON^SARAH^J^MD^^^^|||||Booked',
    'PID|1||MRN77001^^^^MR||THOMPSON^JAMES^W^^||19580612|M|||789 Elm St^^Boston^MA^02101^US||(617)555-0333^HOME||||ACCT77001||',
    'PV1|1|O|OR1^^^SURGERY_CENTER^^^^^||||4001^WILSON^SARAH^J^MD^^^^NPI^5556667777|||ORTHO||||||||||||11111||||||||||||||||||||||||||||V',
    'DG1|1|I10|M16.11^Primary osteoarthritis, right hip^I10|Primary osteoarthritis, right hip||',
    'RGS|1|A|RG004',
    'AIS|1|A|27130^Total hip arthroplasty^CPT|20260322070000|15|min|150|min|Booked||',
    'AIL|1|A|OR1^^^SURGERY_CENTER|^Operating Room 1||20260322070000|||150|min||Booked',
  ].join('\r');

  it('parses MEDITECH SIU^S12 with MSH-3=MEDITECH and HL7 v2.4', () => {
    const result = parseSIUMessage(MEDITECH_SIU_S12);
    expect(result.success).toBe(true);
    expect(result.message!.msh.sendingApplication).toBe('MEDITECH');
    expect(result.message!.msh.versionId).toBe('2.4');
  });

  it('extracts surgeon from PV1-7 when no AIP segments present', () => {
    const result = parseSIUMessage(MEDITECH_SIU_S12);
    const m = result.message!;
    // No AIP segments in MEDITECH message
    expect(m.aip).toHaveLength(0);
    // Surgeon available via PV1-7 attending doctor
    expect(m.pv1.attendingDoctor).not.toBeNull();
    expect(m.pv1.attendingDoctor!.lastName).toBe('WILSON');
    expect(m.pv1.attendingDoctor!.firstName).toBe('SARAH');
    expect(m.pv1.attendingDoctor!.npi).toBe('5556667777');
  });

  it('parses MEDITECH patient and procedure data correctly', () => {
    const result = parseSIUMessage(MEDITECH_SIU_S12);
    const m = result.message!;
    expect(m.pid.lastName).toBe('THOMPSON');
    expect(m.pid.firstName).toBe('JAMES');
    expect(m.pid.dateOfBirth).toBe('1958-06-12');
    expect(m.ais!.procedureCode).toBe('27130');
    expect(m.ais!.procedureDescription).toBe('Total hip arthroplasty');
    expect(m.ais!.duration).toBe(150);
  });

  it('parses MEDITECH message with both PV1-7 and AIP (fallback test)', () => {
    const msg = [
      'MSH|^~\\&|MEDITECH|SURGERY_CENTER|||20260301143022||SIU^S12|MMSG002|P|2.4',
      'SCH|MSE7002^MSE7002|FLM7002^FLM7002|||MSE7002|SURGERY^Surgical Case|Cataract surgery|SURGERY|45|min|^^45^20260322100000^20260322104500|||||||||||||Booked',
      'PID|1||MRN77002^^^^MR||LEE^SUSAN^K^^||19450320|F',
      'PV1|1|O|OR4^^^SURGERY_CENTER||||5001^NGUYEN^TRAN^H^MD^^^^NPI^8889990000||OPHTH',
      'RGS|1|A|RG005',
      'AIS|1|A|66984^Cataract extraction^CPT|20260322100000|10|min|45|min|Booked||',
      'AIP|1|A|5001^NGUYEN^TRAN^H^MD^^^^|SURGEON||20260322100000|||45|min||Booked',
    ].join('\r');

    const result = parseSIUMessage(msg);
    expect(result.success).toBe(true);
    // Both PV1-7 and AIP present
    expect(result.message!.pv1.attendingDoctor!.lastName).toBe('NGUYEN');
    expect(result.message!.aip).toHaveLength(1);
    expect(result.message!.aip[0].personnelLastName).toBe('NGUYEN');
  });
});

// ── Round-Trip: Generate → Parse for Each System Type ──────────────────────

describe('parseSIUMessage — round-trip generate→parse per system type', () => {
  const systemTypes: EhrIntegrationType[] = ['epic_hl7v2', 'cerner_hl7v2', 'meditech_hl7v2'];
  const expectedMSH3: Record<string, string> = {
    epic_hl7v2: 'EPIC',
    cerner_hl7v2: 'CERNER',
    meditech_hl7v2: 'MEDITECH',
  };
  const expectedVersion: Record<string, string> = {
    epic_hl7v2: '2.3',
    cerner_hl7v2: '2.3',
    meditech_hl7v2: '2.4',
  };

  systemTypes.forEach((systemType) => {
    describe(`${systemType}`, () => {
      it(`generates and parses with correct MSH-3 (${expectedMSH3[systemType]})`, () => {
        const generated = generateSIUMessage({
          triggerEvent: 'S12',
          caseId: `RT-${systemType}`,
          scheduledDateTime: new Date(2026, 2, 15, 8, 0, 0),
          systemType,
        });

        const parsed = parseSIUMessage(generated.raw);
        expect(parsed.success).toBe(true);
        expect(parsed.message!.msh.sendingApplication).toBe(expectedMSH3[systemType]);
        expect(parsed.message!.msh.versionId).toBe(expectedVersion[systemType]);
      });

      it(`preserves case ID through generate→parse round-trip`, () => {
        const caseId = `ROUNDTRIP-${systemType}-001`;
        const generated = generateSIUMessage({
          triggerEvent: 'S12',
          caseId,
          scheduledDateTime: new Date(2026, 2, 15, 8, 0, 0),
          systemType,
        });

        const parsed = parseSIUMessage(generated.raw);
        expect(parsed.success).toBe(true);
        expect(parsed.message!.sch.placerAppointmentId).toBe(caseId);
      });

      it(`preserves trigger event through generate→parse round-trip`, () => {
        const generated = generateSIUMessage({
          triggerEvent: 'S15',
          caseId: `CANCEL-${systemType}`,
          scheduledDateTime: new Date(2026, 2, 15, 8, 0, 0),
          systemType,
        });

        const parsed = parseSIUMessage(generated.raw);
        expect(parsed.success).toBe(true);
        expect(parsed.message!.triggerEvent).toBe('S15');
      });

      it(`preserves patient data through generate→parse round-trip`, () => {
        const generated = generateSIUMessage({
          triggerEvent: 'S12',
          caseId: `PAT-${systemType}`,
          scheduledDateTime: new Date(2026, 2, 15, 8, 0, 0),
          systemType,
        });

        const parsed = parseSIUMessage(generated.raw);
        expect(parsed.success).toBe(true);
        // Patient name from generator should survive round-trip
        expect(parsed.message!.pid.lastName).toBe(generated.patient.lastName);
        expect(parsed.message!.pid.firstName).toBe(generated.patient.firstName);
      });
    });
  });
});
