/**
 * Database-Driven Scenario Runner
 *
 * Reads test schedule entries from the Test Data Manager tables,
 * converts them to SIU messages, and sends them through the HL7v2
 * pipeline in sequence_order.
 *
 * Replaces the algorithmic scenario generation (full-day, chaos, multi-day)
 * with user-configured test data from the database.
 */

import type { AnySupabaseClient } from '@/lib/dal';
import type { EhrTestScheduleWithEntities } from '@/lib/integrations/shared/integration-types';
import type { SIUTriggerEvent } from '../types';
import { ehrTestDataDAL } from '@/lib/dal/ehr-test-data';
import { resetMessageCounter } from './siu-generator';
import {
  convertAllSchedulesToSIU,
  convertScheduleToSIU,
  type ScheduleToSIUResult,
} from './schedule-to-siu';
import { logger } from '@/lib/logger';

const log = logger('db-scenario-runner');

// ── Types ────────────────────────────────────────────────────────────────────

export interface DbScenarioResult {
  type: 'database';
  messages: DbScenarioMessage[];
  totalSchedules: number;
  totalMessages: number;
  conversionErrors: { scheduleId: string; error: string }[];
}

export interface DbScenarioMessage {
  /** The converted SIU result with message + metadata */
  siuResult: ScheduleToSIUResult;
  /** Delay in ms before sending (for realistic sequencing) */
  delayMs: number;
}

export interface DbSendResult {
  sequenceNumber: number;
  scheduleId: string;
  messageControlId: string;
  caseId: string;
  triggerEvent: SIUTriggerEvent;
  status: 'success' | 'error';
  ackCode?: string;
  errorMessage?: string;
  description: string;
}

export interface DbSendSummary {
  totalSent: number;
  succeeded: number;
  failed: number;
}

// ── Main Functions ───────────────────────────────────────────────────────────

/**
 * Load schedule entries from the database and convert them to SIU messages.
 * Returns a DbScenarioResult ready for preview or sending.
 */
export async function loadDatabaseScenario(
  supabase: AnySupabaseClient,
  facilityId: string,
  scheduleIds?: string[],
): Promise<DbScenarioResult> {
  resetMessageCounter();

  // Load all schedules with entity joins
  const { data: allSchedules, error } = await ehrTestDataDAL.listSchedules(supabase, facilityId);

  if (error) {
    throw new Error(`Failed to load test schedules: ${error.message}`);
  }

  if (!allSchedules || allSchedules.length === 0) {
    throw new Error(
      'No test schedule entries found. Add schedule entries in the Test Data Manager first.'
    );
  }

  // Filter to specific schedule IDs if provided
  let schedules: EhrTestScheduleWithEntities[];
  if (scheduleIds && scheduleIds.length > 0) {
    const idSet = new Set(scheduleIds);
    schedules = allSchedules.filter((s) => idSet.has(s.id));
    if (schedules.length === 0) {
      throw new Error('None of the specified schedule IDs were found.');
    }
  } else {
    schedules = allSchedules;
  }

  // Convert all to SIU messages
  const { results, errors } = convertAllSchedulesToSIU(schedules);

  // Build messages with delays
  const messages: DbScenarioMessage[] = results.map((r, i) => ({
    siuResult: r,
    delayMs: i * 200, // 200ms between messages
  }));

  log.info('Database scenario loaded', {
    facilityId,
    totalSchedules: schedules.length,
    convertedMessages: results.length,
    conversionErrors: errors.length,
  });

  return {
    type: 'database',
    messages,
    totalSchedules: schedules.length,
    totalMessages: messages.length,
    conversionErrors: errors,
  };
}

/**
 * Convert a single schedule entry by ID (for individual send).
 */
export async function loadSingleSchedule(
  supabase: AnySupabaseClient,
  scheduleId: string,
): Promise<ScheduleToSIUResult> {
  resetMessageCounter();

  const { data: schedule, error } = await ehrTestDataDAL.getSchedule(supabase, scheduleId);

  if (error || !schedule) {
    throw new Error(`Failed to load schedule ${scheduleId}: ${error?.message || 'Not found'}`);
  }

  return convertScheduleToSIU(schedule);
}

/**
 * Send database-driven scenario messages to the HL7v2 listener Edge Function.
 * Sends messages in sequence_order with configurable delay.
 */
export async function sendDatabaseScenario(
  scenario: DbScenarioResult,
  endpointUrl: string,
  apiKey: string,
  delayMs?: number,
  onProgress?: (result: DbSendResult, index: number, total: number) => void,
): Promise<DbSendResult[]> {
  const results: DbSendResult[] = [];
  const messageDelay = delayMs ?? 200;

  for (let i = 0; i < scenario.messages.length; i++) {
    const { siuResult } = scenario.messages[i];

    // Apply delay between messages
    if (i > 0 && messageDelay > 0) {
      await sleep(messageDelay);
    }

    try {
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/hl7-v2',
          'X-Integration-Key': apiKey,
        },
        body: siuResult.message.raw,
      });

      const responseText = await response.text();
      const ackCode = extractACKCode(responseText);

      const result: DbSendResult = {
        sequenceNumber: siuResult.sequenceOrder,
        scheduleId: siuResult.scheduleId,
        messageControlId: siuResult.message.messageControlId,
        caseId: siuResult.message.caseId,
        triggerEvent: siuResult.message.triggerEvent,
        status: response.ok && ackCode === 'AA' ? 'success' : 'error',
        ackCode: ackCode || undefined,
        errorMessage: !response.ok
          ? `HTTP ${response.status}: ${responseText.substring(0, 200)}`
          : undefined,
        description: siuResult.description,
      };

      results.push(result);
      onProgress?.(result, i, scenario.messages.length);
    } catch (err) {
      const result: DbSendResult = {
        sequenceNumber: siuResult.sequenceOrder,
        scheduleId: siuResult.scheduleId,
        messageControlId: siuResult.message.messageControlId,
        caseId: siuResult.message.caseId,
        triggerEvent: siuResult.message.triggerEvent,
        status: 'error',
        errorMessage: err instanceof Error ? err.message : 'Network error',
        description: siuResult.description,
      };

      results.push(result);
      onProgress?.(result, i, scenario.messages.length);
      log.error('Failed to send DB-driven SIU message', {
        scheduleId: siuResult.scheduleId,
        caseId: siuResult.message.caseId,
        error: result.errorMessage,
      });
    }
  }

  return results;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Extract ACK code from HL7v2 ACK response */
function extractACKCode(ackMessage: string): string | null {
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
