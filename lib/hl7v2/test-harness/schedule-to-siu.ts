/**
 * Schedule-to-SIU Converter
 *
 * Converts database-driven test schedule entries (with joined entity data)
 * into HL7v2 SIU messages using the existing siu-generator infrastructure.
 *
 * Maps EhrTest* database types → surgical-data.ts types → generateSIUMessage()
 */

import type { SIUTriggerEvent } from '../types';
import type {
  EhrTestScheduleWithEntities,
  EhrTestSurgeon,
  EhrTestProcedure,
  EhrTestPatient,
  EhrTestRoom,
  EhrTestDiagnosis,
} from '@/lib/integrations/shared/integration-types';
import type {
  ProcedureData,
  SurgeonData,
  PatientData,
  ORRoomData,
} from './surgical-data';
import { generateSIUMessage, type GeneratedSIUMessage } from './siu-generator';

// ── Type Adapters ─────────────────────────────────────────────────────────────

/**
 * Convert a DB test surgeon to the SurgeonData format used by siu-generator.
 * Parses "FirstName LastName" or "LastName, FirstName" from the `name` field.
 */
export function toSurgeonData(surgeon: EhrTestSurgeon): SurgeonData {
  const { firstName, lastName } = parseName(surgeon.name);
  return {
    id: surgeon.external_provider_id || surgeon.id.slice(0, 8),
    firstName,
    lastName,
    middleInitial: '',
    suffix: '',
    npi: surgeon.npi || '0000000000',
    specialty: (surgeon.specialty as SurgeonData['specialty']) || 'general',
  };
}

/**
 * Convert a DB test procedure to the ProcedureData format.
 * Uses the associated diagnosis for ICD-10 if available.
 */
export function toProcedureData(
  procedure: EhrTestProcedure,
  diagnosis?: EhrTestDiagnosis | null,
): ProcedureData {
  return {
    name: procedure.name,
    cptCode: procedure.cpt_code || '99999',
    icd10Code: diagnosis?.icd10_code || 'Z00.00',
    icd10Description: diagnosis?.description || 'General examination',
    typicalDurationMinutes: procedure.typical_duration_min || 60,
    specialty: (procedure.specialty as ProcedureData['specialty']) || 'general',
  };
}

/**
 * Convert a DB test patient to the PatientData format.
 */
export function toPatientData(patient: EhrTestPatient): PatientData {
  return {
    mrn: patient.mrn || `MRN${patient.id.slice(0, 6).toUpperCase()}`,
    firstName: patient.first_name,
    lastName: patient.last_name,
    middleName: '',
    dateOfBirth: formatDateAsHL7(patient.date_of_birth),
    gender: patient.gender === 'F' ? 'F' : 'M',
    street: patient.address_line || '123 Main St',
    city: patient.city || 'Anytown',
    state: patient.state || 'CA',
    zip: patient.zip || '90210',
    homePhone: patient.phone || '5555550100',
    accountNumber: `ACCT${patient.id.slice(0, 6).toUpperCase()}`,
  };
}

/**
 * Convert a DB test room to the ORRoomData format.
 */
export function toRoomData(room: EhrTestRoom): ORRoomData {
  return {
    code: room.location_code || room.name.replace(/\s+/g, '').toUpperCase(),
    description: room.name,
    facility: 'SURGERY_CENTER',
  };
}

// ── Main Converter ────────────────────────────────────────────────────────────

export interface ScheduleToSIUResult {
  message: GeneratedSIUMessage;
  scheduleId: string;
  sequenceOrder: number;
  description: string;
}

/**
 * Convert a single schedule entry (with joined entities) into an SIU message.
 * Requires all entity joins to be present (surgeon, procedure, room, patient).
 */
export function convertScheduleToSIU(
  schedule: EhrTestScheduleWithEntities,
): ScheduleToSIUResult {
  if (!schedule.surgeon || !schedule.procedure || !schedule.room || !schedule.patient) {
    throw new Error(
      `Schedule ${schedule.id} is missing required entities. ` +
      `surgeon=${!!schedule.surgeon}, procedure=${!!schedule.procedure}, ` +
      `room=${!!schedule.room}, patient=${!!schedule.patient}`
    );
  }

  const surgeon = toSurgeonData(schedule.surgeon);
  const procedure = toProcedureData(schedule.procedure, schedule.diagnosis);
  const patient = toPatientData(schedule.patient);
  const room = toRoomData(schedule.room);

  // Build scheduled date/time from schedule_date + start_time
  const scheduledDateTime = parseScheduleDateTime(schedule.scheduled_date, schedule.start_time);

  const triggerEvent = schedule.trigger_event as SIUTriggerEvent;
  const caseId = schedule.external_case_id || `TEST-${schedule.id.slice(0, 8).toUpperCase()}`;

  const message = generateSIUMessage({
    triggerEvent,
    caseId,
    scheduledDateTime,
    durationMinutes: schedule.duration_min,
    procedure,
    surgeon,
    patient,
    room,
    processingId: 'T', // Test mode
  });

  const description = buildDescription(triggerEvent, procedure.name, surgeon, room.code, scheduledDateTime);

  return {
    message,
    scheduleId: schedule.id,
    sequenceOrder: schedule.sequence_order,
    description,
  };
}

/**
 * Convert all schedule entries for a facility into SIU messages,
 * ordered by sequence_order. Validates all entities are present.
 */
export function convertAllSchedulesToSIU(
  schedules: EhrTestScheduleWithEntities[],
): { results: ScheduleToSIUResult[]; errors: { scheduleId: string; error: string }[] } {
  const results: ScheduleToSIUResult[] = [];
  const errors: { scheduleId: string; error: string }[] = [];

  // Sort by sequence_order
  const sorted = [...schedules].sort((a, b) => a.sequence_order - b.sequence_order);

  for (const schedule of sorted) {
    try {
      results.push(convertScheduleToSIU(schedule));
    } catch (err) {
      errors.push({
        scheduleId: schedule.id,
        error: err instanceof Error ? err.message : 'Unknown conversion error',
      });
    }
  }

  return { results, errors };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Parse "FirstName LastName" or "LastName, FirstName" into parts */
function parseName(fullName: string): { firstName: string; lastName: string } {
  if (fullName.includes(',')) {
    const [last, first] = fullName.split(',').map((s) => s.trim());
    return { firstName: first || 'Unknown', lastName: last || 'Unknown' };
  }
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: 'Unknown' };
  }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

/** Convert a date string (YYYY-MM-DD or ISO) to HL7v2 format (YYYYMMDD) */
function formatDateAsHL7(dateStr: string | null): string {
  if (!dateStr) return '19700101';
  // Handle ISO dates or YYYY-MM-DD
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '19700101';
  const y = d.getFullYear().toString();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}${m}${day}`;
}

/** Parse schedule_date (YYYY-MM-DD) + start_time (HH:MM:SS) into a Date */
function parseScheduleDateTime(dateStr: string, timeStr: string): Date {
  // Combine date + time
  const [hours, minutes] = timeStr.split(':').map(Number);
  const d = new Date(dateStr);
  d.setHours(hours || 7, minutes || 30, 0, 0);
  return d;
}

/** Build a human-readable description for the message */
function buildDescription(
  triggerEvent: SIUTriggerEvent,
  procedureName: string,
  surgeon: SurgeonData,
  roomCode: string,
  scheduledTime: Date,
): string {
  const time = scheduledTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  switch (triggerEvent) {
    case 'S12':
      return `New case: ${procedureName} by Dr. ${surgeon.lastName} in ${roomCode} at ${time}`;
    case 'S13':
      return `Reschedule: ${procedureName} by Dr. ${surgeon.lastName} to ${time}`;
    case 'S14':
      return `Modify: ${procedureName} by Dr. ${surgeon.lastName}`;
    case 'S15':
      return `Cancel: ${procedureName} (${roomCode})`;
    case 'S16':
      return `Discontinue: ${procedureName} (${roomCode})`;
  }
}
