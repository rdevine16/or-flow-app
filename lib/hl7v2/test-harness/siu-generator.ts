/**
 * SIU Message Generator for Test Harness
 *
 * Generates realistic HL7v2 SIU messages mimicking Epic OpTime output.
 * Used for development/testing without requiring an Epic sandbox.
 */

import type { SIUTriggerEvent } from '../types';
import type {
  ProcedureData,
  SurgeonData,
  PatientData,
  ORRoomData,
  Specialty,
} from './surgical-data';
import {
  PROCEDURES,
  SURGEONS,
  PATIENTS,
  OR_ROOMS,
  getProceduresBySpecialty,
  getSurgeonsBySpecialty,
  pickRandom,
} from './surgical-data';

// ── Types ────────────────────────────────────────────────────────────────────

export interface GenerateSIUOptions {
  /** Trigger event type (S12=new, S13=reschedule, S14=modify, S15=cancel, S16=discontinue) */
  triggerEvent: SIUTriggerEvent;
  /** Case ID (used for SCH-1 placer appointment ID) */
  caseId: string;
  /** Scheduled date/time as Date object */
  scheduledDateTime: Date;
  /** Duration in minutes (overrides procedure default if provided) */
  durationMinutes?: number;
  /** Specific procedure to use (random from specialty if not provided) */
  procedure?: ProcedureData;
  /** Specific surgeon to use (random from specialty if not provided) */
  surgeon?: SurgeonData;
  /** Specific patient to use (random if not provided) */
  patient?: PatientData;
  /** Specific OR room to use (random if not provided) */
  room?: ORRoomData;
  /** Filter procedures/surgeons by specialties */
  specialties?: Specialty[];
  /** Custom message control ID (auto-generated if not provided) */
  messageControlId?: string;
  /** Filler status code (default: mapped from trigger event) */
  fillerStatusCode?: string;
  /** Processing ID: P=production, T=test */
  processingId?: string;
}

export interface GeneratedSIUMessage {
  raw: string;
  messageControlId: string;
  caseId: string;
  triggerEvent: SIUTriggerEvent;
  procedure: ProcedureData;
  surgeon: SurgeonData;
  patient: PatientData;
  room: ORRoomData;
  scheduledDateTime: Date;
  durationMinutes: number;
}

// ── Message ID Counter ───────────────────────────────────────────────────────

let messageCounter = 0;

/** Reset message counter (for testing) */
export function resetMessageCounter(): void {
  messageCounter = 0;
}

function nextMessageId(): string {
  messageCounter++;
  return `MSG${messageCounter.toString().padStart(5, '0')}`;
}

// ── Main Generator ───────────────────────────────────────────────────────────

/**
 * Generate a single SIU message with the specified parameters.
 * Fills in realistic defaults for any unspecified fields.
 */
export function generateSIUMessage(options: GenerateSIUOptions): GeneratedSIUMessage {
  const {
    triggerEvent,
    caseId,
    scheduledDateTime,
    processingId = 'P',
    specialties,
  } = options;

  // Select data elements (use provided or pick from pools)
  const availableProcedures = specialties
    ? getProceduresBySpecialty(specialties)
    : PROCEDURES;
  const availableSurgeons = specialties
    ? getSurgeonsBySpecialty(specialties)
    : SURGEONS;

  const seed = hashString(caseId);
  const procedure = options.procedure || pickRandom(availableProcedures, seed);
  const surgeon = options.surgeon || pickRandom(availableSurgeons, seed + 1);
  const patient = options.patient || pickRandom(PATIENTS, seed + 2);
  const room = options.room || pickRandom(OR_ROOMS, seed + 3);
  const durationMinutes = options.durationMinutes || procedure.typicalDurationMinutes;
  const messageControlId = options.messageControlId || nextMessageId();
  const fillerStatusCode = options.fillerStatusCode || getDefaultFillerStatus(triggerEvent);

  const endDateTime = new Date(scheduledDateTime.getTime() + durationMinutes * 60_000);

  const now = new Date();

  // Build segments
  const segments: string[] = [];

  // MSH
  segments.push(buildMSH({
    dateTime: now,
    triggerEvent,
    messageControlId,
    processingId,
  }));

  // SCH
  segments.push(buildSCH({
    caseId,
    procedure,
    durationMinutes,
    startDateTime: scheduledDateTime,
    endDateTime,
    surgeon,
    fillerStatusCode,
  }));

  // PID
  segments.push(buildPID(patient));

  // PV1
  segments.push(buildPV1({
    room,
    surgeon,
    specialty: procedure.specialty,
  }));

  // DG1 (diagnosis)
  segments.push(buildDG1(procedure));

  // RGS
  segments.push('RGS|1|A|RG001');

  // AIS (procedure/service)
  segments.push(buildAIS({
    procedure,
    startDateTime: scheduledDateTime,
    durationMinutes,
    fillerStatusCode,
  }));

  // AIL (location/room)
  segments.push(buildAIL({
    room,
    startDateTime: scheduledDateTime,
    durationMinutes,
    fillerStatusCode,
  }));

  // AIP - Surgeon (only provider included; anesthesiologist omitted)
  segments.push(buildAIP({
    provider: surgeon,
    role: 'SURGEON',
    setId: '1',
    startDateTime: scheduledDateTime,
    durationMinutes,
    fillerStatusCode,
  }));

  const raw = segments.join('\r');

  return {
    raw,
    messageControlId,
    caseId,
    triggerEvent,
    procedure,
    surgeon,
    patient,
    room,
    scheduledDateTime,
    durationMinutes,
  };
}

// ── Segment Builders ─────────────────────────────────────────────────────────

function buildMSH(opts: {
  dateTime: Date;
  triggerEvent: SIUTriggerEvent;
  messageControlId: string;
  processingId: string;
}): string {
  const fields = [
    'MSH',
    '^~\\&',
    'EPIC',
    'SURGERY_CENTER',
    '',  // MSH-5: receiving application
    '',  // MSH-6: receiving facility
    formatHL7DateTime(opts.dateTime),
    '',  // MSH-8: security
    `SIU^${opts.triggerEvent}`,
    opts.messageControlId,
    opts.processingId,
    '2.3',
    '',  // MSH-13 through end
    '',
    '',
    '',
    '',
  ];
  return fields.join('|');
}

function buildSCH(opts: {
  caseId: string;
  procedure: ProcedureData;
  durationMinutes: number;
  startDateTime: Date;
  endDateTime: Date;
  surgeon: SurgeonData;
  fillerStatusCode: string;
}): string {
  const providerXCN = formatProviderXCN(opts.surgeon);
  const timing = `^^${opts.durationMinutes}^${formatHL7DateTime(opts.startDateTime)}^${formatHL7DateTime(opts.endDateTime)}`;

  const fields = [
    'SCH',
    `${opts.caseId}^${opts.caseId}`,  // SCH-1: placer appointment ID
    `FL${opts.caseId}^FL${opts.caseId}`,  // SCH-2: filler appointment ID
    '',  // SCH-3
    '',  // SCH-4
    opts.caseId,  // SCH-5
    'SURGERY^Surgical Case',  // SCH-6: event reason
    opts.procedure.name,  // SCH-7: appointment reason
    'SURGERY',  // SCH-8: appointment type
    opts.durationMinutes.toString(),  // SCH-9
    'min',  // SCH-10: duration units
    timing,  // SCH-11: timing
    '',  // SCH-12
    '',  // SCH-13
    '',  // SCH-14
    '',  // SCH-15
    providerXCN,  // SCH-16: requesting provider
    '',  // SCH-17
    '',  // SCH-18
    '',  // SCH-19
    providerXCN,  // SCH-20: entered by provider
    '',  // SCH-21
    '',  // SCH-22
    '',  // SCH-23
    '',  // SCH-24
    opts.fillerStatusCode,  // SCH-25: filler status code
  ];
  return fields.join('|');
}

function buildPID(patient: PatientData): string {
  const fields = [
    'PID',
    '1',  // PID-1: set ID
    '',  // PID-2
    `${patient.mrn}^^^^MR`,  // PID-3: patient ID + type
    '',  // PID-4
    `${patient.lastName}^${patient.firstName}^${patient.middleName}^^`,  // PID-5: name
    '',  // PID-6
    patient.dateOfBirth,  // PID-7: DOB
    patient.gender,  // PID-8: gender
    '',  // PID-9
    '',  // PID-10
    `${patient.street}^^${patient.city}^${patient.state}^${patient.zip}^US`,  // PID-11: address
    '',  // PID-12
    `${patient.homePhone}^HOME`,  // PID-13: home phone
    '',  // PID-14: work phone
    '',  // PID-15
    '',  // PID-16
    '',  // PID-17
    patient.accountNumber,  // PID-18: account number
    '',  // PID-19: SSN (intentionally blank for test data)
  ];
  return fields.join('|');
}

function buildPV1(opts: {
  room: ORRoomData;
  surgeon: SurgeonData;
  specialty: string;
}): string {
  const providerXCN = formatProviderXCN(opts.surgeon);
  const specialtyMap: Record<string, string> = {
    orthopedics: 'ORTHO',
    ophthalmology: 'OPHTH',
    gi: 'GI',
    spine: 'SPINE',
    general: 'GENSURG',
  };
  const hospitalService = specialtyMap[opts.specialty] || opts.specialty.toUpperCase();

  const fields = [
    'PV1',
    '1',  // PV1-1: set ID
    'O',  // PV1-2: patient class (outpatient)
    `${opts.room.code}^^^${opts.room.facility}^^^^^`,  // PV1-3: assigned location
    '',  // PV1-4: admission type
    '',  // PV1-5
    '',  // PV1-6
    providerXCN,  // PV1-7: attending doctor
    '',  // PV1-8
    '',  // PV1-9
    hospitalService,  // PV1-10: hospital service
  ];
  return fields.join('|');
}

function buildDG1(procedure: ProcedureData): string {
  const fields = [
    'DG1',
    '1',  // DG1-1: set ID
    'I10',  // DG1-2: coding method (ICD-10)
    `${procedure.icd10Code}^${procedure.icd10Description}^I10`,  // DG1-3: diagnosis code
    procedure.icd10Description,  // DG1-4: diagnosis description
    '',  // DG1-5
    '',  // DG1-6
  ];
  return fields.join('|');
}

function buildAIS(opts: {
  procedure: ProcedureData;
  startDateTime: Date;
  durationMinutes: number;
  fillerStatusCode: string;
}): string {
  const fields = [
    'AIS',
    '1',  // AIS-1: set ID
    'A',  // AIS-2: segment action code
    `${opts.procedure.cptCode}^${opts.procedure.name}^CPT`,  // AIS-3: procedure
    formatHL7DateTime(opts.startDateTime),  // AIS-4: start time
    '15',  // AIS-5: start time offset
    'min',  // AIS-6: offset units
    opts.durationMinutes.toString(),  // AIS-7: duration
    'min',  // AIS-8: duration units
    '',  // AIS-9
    '',  // AIS-10
    opts.fillerStatusCode,  // AIS-11: filler status code
  ];
  return fields.join('|');
}

function buildAIL(opts: {
  room: ORRoomData;
  startDateTime: Date;
  durationMinutes: number;
  fillerStatusCode: string;
}): string {
  const fields = [
    'AIL',
    '1',  // AIL-1: set ID
    'A',  // AIL-2: segment action code
    `${opts.room.code}^^^${opts.room.facility}`,  // AIL-3: location
    `^${opts.room.description}`,  // AIL-4: location type
    '',  // AIL-5
    formatHL7DateTime(opts.startDateTime),  // AIL-6: start time
    '',  // AIL-7
    '',  // AIL-8
    '',  // AIL-9
    opts.durationMinutes.toString(),  // AIL-10: duration
    'min',  // AIL-11: duration units
    opts.fillerStatusCode,  // AIL-12: filler status code
  ];
  return fields.join('|');
}

function buildAIP(opts: {
  provider: SurgeonData;
  role: string;
  setId: string;
  startDateTime: Date;
  durationMinutes: number;
  fillerStatusCode: string;
}): string {
  const providerXCN = formatProviderXCN(opts.provider);
  const fields = [
    'AIP',
    opts.setId,  // AIP-1: set ID
    'A',  // AIP-2: segment action code
    providerXCN,  // AIP-3: personnel
    opts.role,  // AIP-4: role
    '',  // AIP-5
    formatHL7DateTime(opts.startDateTime),  // AIP-6: start time
    '',  // AIP-7
    '',  // AIP-8
    opts.durationMinutes.toString(),  // AIP-9: duration
    'min',  // AIP-10: duration units
    '',  // AIP-11
    opts.fillerStatusCode,  // AIP-12: filler status code
  ];
  return fields.join('|');
}

// ── Formatting Helpers ───────────────────────────────────────────────────────

/** Format a Date as HL7v2 timestamp YYYYMMDDHHMMSS */
export function formatHL7DateTime(date: Date): string {
  const y = date.getFullYear().toString();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  const h = date.getHours().toString().padStart(2, '0');
  const min = date.getMinutes().toString().padStart(2, '0');
  const sec = date.getSeconds().toString().padStart(2, '0');
  return `${y}${m}${d}${h}${min}${sec}`;
}

/** Format a provider as XCN (extended composite ID) */
function formatProviderXCN(provider: SurgeonData): string {
  // Format: ID^LAST^FIRST^MIDDLE^SUFFIX^^^^NPI^qualifier
  return `${provider.id}^${provider.lastName}^${provider.firstName}^${provider.middleInitial}^${provider.suffix}^^^^NPI^${provider.npi}`;
}

/** Simple hash function for seeded randomness */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/** Map trigger event to default filler status code */
function getDefaultFillerStatus(triggerEvent: SIUTriggerEvent): string {
  switch (triggerEvent) {
    case 'S12': return 'Booked';
    case 'S13': return 'Booked';  // Rescheduled but still booked
    case 'S14': return 'Booked';  // Modified but still booked
    case 'S15': return 'Cancelled';
    case 'S16': return 'Discontinued';
  }
}
