/**
 * Scenario Runner for SIU Message Test Harness
 *
 * Orchestrates multi-message scenarios (full day, chaos, multi-day) that
 * generate realistic surgical scheduling patterns and send them to the
 * HL7v2 Edge Function endpoint.
 */

import type { SIUTriggerEvent } from '../types';
import type { Specialty } from './surgical-data';
import {
  ALL_SPECIALTIES,
  PATIENTS,
  OR_ROOMS,
  getProceduresBySpecialty,
  getSurgeonsBySpecialty,
  seededShuffle,
} from './surgical-data';
import {
  generateSIUMessage,
  resetMessageCounter,
  type GeneratedSIUMessage,
} from './siu-generator';
import { logger } from '@/lib/logger';

const log = logger('scenario-runner');

// ── Types ────────────────────────────────────────────────────────────────────

export interface ScenarioOptions {
  /** Facility ID to scope the test against */
  facilityId: string;
  /** Specialties to include (defaults to all) */
  specialties?: Specialty[];
  /** Number of cases for full-day scenario (default: 15) */
  caseCount?: number;
  /** Start date for scheduling (default: tomorrow) */
  startDate?: Date;
  /** Number of days for multi-day scenario (default: 5) */
  dayCount?: number;
  /** Custom surgeon names to use (matched to pool by name if possible) */
  surgeonNames?: string[];
}

export type ScenarioType = 'full-day' | 'chaos' | 'multi-day';

export interface ScenarioMessage {
  /** The generated HL7v2 message */
  message: GeneratedSIUMessage;
  /** Delay in ms before sending (for realistic sequencing) */
  delayMs: number;
  /** Description for UI display */
  description: string;
  /** Sequence number within the scenario */
  sequenceNumber: number;
}

export interface ScenarioResult {
  type: ScenarioType;
  messages: ScenarioMessage[];
  totalCases: number;
  totalMessages: number;
  dateRange: { start: Date; end: Date };
}

export interface SendResult {
  sequenceNumber: number;
  messageControlId: string;
  caseId: string;
  triggerEvent: SIUTriggerEvent;
  status: 'success' | 'error';
  ackCode?: string;
  errorMessage?: string;
  description: string;
}

// ── Scenario Generators ──────────────────────────────────────────────────────

/**
 * Generate a full day of surgical cases across OR rooms.
 * Cases start at 7:30am, with 15-min turnover between cases per room.
 */
export function generateFullDay(options: ScenarioOptions): ScenarioResult {
  resetMessageCounter();
  const caseCount = options.caseCount || 15;
  const specialties = options.specialties || ALL_SPECIALTIES;
  const startDate = options.startDate || getNextBusinessDay();

  const procedures = getProceduresBySpecialty(specialties);
  const surgeons = getSurgeonsBySpecialty(specialties);
  const patients = seededShuffle(PATIENTS, startDate.getTime());
  const rooms = OR_ROOMS.slice(0, 4); // Use 4 rooms

  const messages: ScenarioMessage[] = [];
  let sequenceNumber = 0;

  // Track next available time for each room
  const roomNextAvailable: Record<string, Date> = {};
  for (const room of rooms) {
    // All rooms start at 7:30am
    const roomStart = new Date(startDate);
    roomStart.setHours(7, 30, 0, 0);
    roomNextAvailable[room.code] = roomStart;
  }

  const shuffledProcedures = seededShuffle(procedures, startDate.getTime() + 1);
  const shuffledSurgeons = seededShuffle(surgeons, startDate.getTime() + 2);

  for (let i = 0; i < caseCount; i++) {
    // Round-robin across rooms
    const room = rooms[i % rooms.length];
    const procedure = shuffledProcedures[i % shuffledProcedures.length];
    const surgeon = shuffledSurgeons[i % shuffledSurgeons.length];
    const patient = patients[i % patients.length];

    const scheduledTime = new Date(roomNextAvailable[room.code]);

    // Don't schedule past 5pm
    if (scheduledTime.getHours() >= 17) continue;

    const caseId = `SC${(10001 + i).toString()}`;

    const msg = generateSIUMessage({
      triggerEvent: 'S12',
      caseId,
      scheduledDateTime: scheduledTime,
      procedure,
      surgeon,
      patient,
      room,
      specialties,
    });

    sequenceNumber++;
    messages.push({
      message: msg,
      delayMs: i * 200, // 200ms between messages
      description: `New case: ${procedure.name} by Dr. ${surgeon.lastName} in ${room.code} at ${formatTime(scheduledTime)}`,
      sequenceNumber,
    });

    // Advance room time: procedure duration + 15 min turnover
    const nextAvail = new Date(scheduledTime.getTime() + (procedure.typicalDurationMinutes + 15) * 60_000);
    roomNextAvailable[room.code] = nextAvail;
  }

  const endDate = new Date(startDate);
  endDate.setHours(17, 0, 0, 0);

  return {
    type: 'full-day',
    messages,
    totalCases: messages.length,
    totalMessages: messages.length,
    dateRange: { start: startDate, end: endDate },
  };
}

/**
 * Generate a chaos day: normal schedule + reschedules, cancellations, and add-ons.
 * Creates a realistic messy surgical day.
 */
export function generateChaosDay(options: ScenarioOptions): ScenarioResult {
  // Start with a normal full day
  const fullDay = generateFullDay({
    ...options,
    caseCount: options.caseCount || 12,
  });

  const messages = [...fullDay.messages];
  let sequenceNumber = messages.length;
  const startDate = options.startDate || getNextBusinessDay();
  const specialties = options.specialties || ALL_SPECIALTIES;
  const procedures = getProceduresBySpecialty(specialties);
  const surgeons = getSurgeonsBySpecialty(specialties);
  const patients = seededShuffle(PATIENTS, startDate.getTime() + 100);

  // Pick 2-3 cases to reschedule
  const rescheduleCount = 2 + (startDate.getDate() % 2); // 2 or 3
  for (let i = 0; i < rescheduleCount && i < fullDay.messages.length; i++) {
    const original = fullDay.messages[i * 3 % fullDay.messages.length];
    const newTime = new Date(original.message.scheduledDateTime.getTime() + 60 * 60_000); // Push 1 hour later

    const msg = generateSIUMessage({
      triggerEvent: 'S13',
      caseId: original.message.caseId,
      scheduledDateTime: newTime,
      procedure: original.message.procedure,
      surgeon: original.message.surgeon,
      patient: original.message.patient,
      room: original.message.room,
      specialties,
    });

    sequenceNumber++;
    messages.push({
      message: msg,
      delayMs: (fullDay.messages.length + i) * 200,
      description: `Reschedule: ${original.message.caseId} to ${formatTime(newTime)}`,
      sequenceNumber,
    });
  }

  // Cancel 1-2 cases
  const cancelCount = 1 + (startDate.getDate() % 2);
  for (let i = 0; i < cancelCount && i < fullDay.messages.length; i++) {
    const original = fullDay.messages[(i * 5 + 2) % fullDay.messages.length];

    const msg = generateSIUMessage({
      triggerEvent: 'S15',
      caseId: original.message.caseId,
      scheduledDateTime: original.message.scheduledDateTime,
      procedure: original.message.procedure,
      surgeon: original.message.surgeon,
      patient: original.message.patient,
      room: original.message.room,
      specialties,
    });

    sequenceNumber++;
    messages.push({
      message: msg,
      delayMs: (fullDay.messages.length + rescheduleCount + i) * 200,
      description: `Cancel: ${original.message.caseId} (${original.message.procedure.name})`,
      sequenceNumber,
    });
  }

  // Add 2 add-on cases
  for (let i = 0; i < 2; i++) {
    const procedure = procedures[(startDate.getDate() + i) % procedures.length];
    const surgeon = surgeons[(startDate.getDate() + i + 1) % surgeons.length];
    const patient = patients[fullDay.messages.length + i];
    const room = OR_ROOMS[(startDate.getDate() + i) % OR_ROOMS.length];
    const addOnTime = new Date(startDate);
    addOnTime.setHours(14 + i, 0, 0, 0); // Afternoon add-ons

    const caseId = `SC${(20001 + i).toString()}`;
    const msg = generateSIUMessage({
      triggerEvent: 'S12',
      caseId,
      scheduledDateTime: addOnTime,
      procedure,
      surgeon,
      patient,
      room,
      specialties,
    });

    sequenceNumber++;
    messages.push({
      message: msg,
      delayMs: (fullDay.messages.length + rescheduleCount + cancelCount + i) * 200,
      description: `Add-on: ${procedure.name} at ${formatTime(addOnTime)}`,
      sequenceNumber,
    });
  }

  return {
    type: 'chaos',
    messages,
    totalCases: fullDay.totalCases + 2, // original + add-ons
    totalMessages: messages.length,
    dateRange: fullDay.dateRange,
  };
}

/**
 * Generate a multi-day schedule (typically a week).
 */
export function generateMultiDay(options: ScenarioOptions): ScenarioResult {
  resetMessageCounter();
  const dayCount = options.dayCount || 5;
  const startDate = options.startDate || getNextBusinessDay();

  const allMessages: ScenarioMessage[] = [];
  let totalCases = 0;
  let globalSequence = 0;

  for (let day = 0; day < dayCount; day++) {
    const dayDate = new Date(startDate);
    dayDate.setDate(dayDate.getDate() + day);

    // Skip weekends
    const dow = dayDate.getDay();
    if (dow === 0 || dow === 6) continue;

    const dayResult = generateFullDay({
      ...options,
      startDate: dayDate,
      caseCount: options.caseCount || 12 + (day % 4), // Vary count per day
    });

    for (const msg of dayResult.messages) {
      globalSequence++;
      allMessages.push({
        ...msg,
        sequenceNumber: globalSequence,
        delayMs: globalSequence * 150, // 150ms between all messages
      });
    }
    totalCases += dayResult.totalCases;
  }

  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + dayCount - 1);

  return {
    type: 'multi-day',
    messages: allMessages,
    totalCases,
    totalMessages: allMessages.length,
    dateRange: { start: startDate, end: endDate },
  };
}

// ── Scenario Sender ──────────────────────────────────────────────────────────

/**
 * Send generated scenario messages to the HL7v2 listener Edge Function.
 * Returns results for each message, yielding progress via callback.
 */
export async function sendScenario(
  scenario: ScenarioResult,
  endpointUrl: string,
  apiKey: string,
  onProgress?: (result: SendResult, index: number, total: number) => void,
): Promise<SendResult[]> {
  const results: SendResult[] = [];

  for (let i = 0; i < scenario.messages.length; i++) {
    const { message, delayMs, description, sequenceNumber } = scenario.messages[i];

    // Apply delay for realistic sequencing
    if (delayMs > 0 && i > 0) {
      await sleep(Math.min(delayMs - (scenario.messages[i - 1]?.delayMs || 0), 500));
    }

    try {
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/hl7-v2',
          'X-Integration-Key': apiKey,
        },
        body: message.raw,
      });

      const responseText = await response.text();
      const ackCode = extractACKCode(responseText);

      const result: SendResult = {
        sequenceNumber,
        messageControlId: message.messageControlId,
        caseId: message.caseId,
        triggerEvent: message.triggerEvent,
        status: response.ok && ackCode === 'AA' ? 'success' : 'error',
        ackCode: ackCode || undefined,
        errorMessage: !response.ok ? `HTTP ${response.status}: ${responseText.substring(0, 200)}` : undefined,
        description,
      };

      results.push(result);
      onProgress?.(result, i, scenario.messages.length);
    } catch (err) {
      const result: SendResult = {
        sequenceNumber,
        messageControlId: message.messageControlId,
        caseId: message.caseId,
        triggerEvent: message.triggerEvent,
        status: 'error',
        errorMessage: err instanceof Error ? err.message : 'Network error',
        description,
      };

      results.push(result);
      onProgress?.(result, i, scenario.messages.length);
      log.error('Failed to send SIU message', { caseId: message.caseId, error: result.errorMessage });
    }
  }

  return results;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getNextBusinessDay(): Date {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  // Skip to Monday if Saturday or Sunday
  const dow = date.getDay();
  if (dow === 0) date.setDate(date.getDate() + 1);
  if (dow === 6) date.setDate(date.getDate() + 2);
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

/** Extract ACK code from HL7v2 ACK response */
function extractACKCode(ackMessage: string): string | null {
  // MSA segment: MSA|AA|... or MSA|AE|... or MSA|AR|...
  const lines = ackMessage.split(/\r\n|\r|\n/);
  for (const line of lines) {
    if (line.startsWith('MSA|')) {
      const fields = line.split('|');
      return fields[1] || null;
    }
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
