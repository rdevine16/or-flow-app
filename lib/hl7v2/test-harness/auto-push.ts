/**
 * Auto-Push — Send SIU Messages on Schedule CRUD
 *
 * When a schedule entry is created, updated, or deleted in the Test Data
 * Manager, this module converts the entry to the appropriate SIU message
 * (S12 for create, S14 for update, S15 for delete) and sends it to the
 * facility's HL7v2 listener endpoint.
 */

import type { SIUTriggerEvent } from '../types';
import type { AnySupabaseClient } from '@/lib/dal';
import type { EhrTestScheduleWithEntities } from '@/lib/integrations/shared/integration-types';
import { ehrTestDataDAL } from '@/lib/dal/ehr-test-data';
import { resetMessageCounter } from './siu-generator';
import { convertScheduleToSIU, type ScheduleToSIUResult } from './schedule-to-siu';
import { getIntegrationConfigOrNull } from './shared';
import { logger } from '@/lib/logger';
import type { createClient } from '@/lib/supabase-server';

const log = logger('auto-push');

// ── Types ────────────────────────────────────────────────────────────────────

export type AutoPushAction = 'create' | 'update' | 'delete';

export interface AutoPushRequest {
  scheduleId: string;
  facilityId: string;
  action: AutoPushAction;
  /** For delete: pre-captured schedule data (row may already be gone) */
  scheduleData?: EhrTestScheduleWithEntities;
  /** Override trigger event — use the schedule's own trigger_event instead of deriving from action.
   *  Used by manual per-row push to send S13/S16 correctly. */
  triggerEventOverride?: SIUTriggerEvent;
}

export interface AutoPushResult {
  success: boolean;
  skipped: boolean;
  reason?: string;
  triggerEvent?: SIUTriggerEvent;
  messageControlId?: string;
  caseId?: string;
  ackCode?: string;
  errorMessage?: string;
}

// ── Action → Trigger Event Mapping ───────────────────────────────────────────

const ACTION_TO_TRIGGER: Record<AutoPushAction, SIUTriggerEvent> = {
  create: 'S12',
  update: 'S14',
  delete: 'S15',
};

// ── Core Function ────────────────────────────────────────────────────────────

/**
 * Execute an auto-push for a single schedule entry.
 *
 * 1. Checks that the facility has an active HL7v2 integration
 * 2. Loads the schedule entry (or uses pre-captured data for deletes)
 * 3. Converts to SIU with the correct trigger event
 * 4. Sends to the listener endpoint
 * 5. Returns the result
 */
export async function executeAutoPush(
  supabase: Awaited<ReturnType<typeof createClient>>,
  request: AutoPushRequest,
): Promise<AutoPushResult> {
  const { scheduleId, facilityId, action, scheduleData, triggerEventOverride } = request;

  // 1. Check integration config — skip silently if none configured
  const config = await getIntegrationConfigOrNull(supabase, facilityId);
  if (!config) {
    log.info('Auto-push skipped: no integration configured', { facilityId, action });
    return { success: false, skipped: true, reason: 'no_integration' };
  }

  // 2. Load or use pre-captured schedule data
  let schedule: EhrTestScheduleWithEntities;

  if (action === 'delete' && scheduleData) {
    // For deletes, the row may already be gone — use pre-captured data
    schedule = scheduleData;
  } else {
    const { data, error } = await ehrTestDataDAL.getSchedule(supabase as AnySupabaseClient, scheduleId);
    if (error || !data) {
      const msg = `Failed to load schedule ${scheduleId}: ${error?.message || 'Not found'}`;
      log.error('Auto-push failed to load schedule', { scheduleId, error: msg });
      return { success: false, skipped: false, errorMessage: msg };
    }
    schedule = data;
  }

  // 3. Convert to SIU — use explicit override if provided (manual push),
  //    otherwise derive from CRUD action (auto-push on save/delete)
  const triggerEvent = triggerEventOverride || ACTION_TO_TRIGGER[action];

  resetMessageCounter();

  let siuResult: ScheduleToSIUResult;
  try {
    // Override the schedule's trigger_event with the action-derived one
    siuResult = convertScheduleToSIU({
      ...schedule,
      trigger_event: triggerEvent,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'SIU conversion failed';
    log.error('Auto-push SIU conversion failed', { scheduleId, action, error: msg });
    return { success: false, skipped: false, triggerEvent, errorMessage: msg };
  }

  // 4. Send to listener
  try {
    const response = await fetch(config.endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/hl7-v2',
        'X-Integration-Key': config.apiKey,
      },
      body: siuResult.message.raw,
    });

    const responseText = await response.text();
    const ackCode = extractACKCode(responseText);

    const success = response.ok && ackCode === 'AA';

    log.info('Auto-push sent', {
      scheduleId,
      facilityId,
      action,
      triggerEvent,
      caseId: siuResult.message.caseId,
      messageControlId: siuResult.message.messageControlId,
      success,
      ackCode,
    });

    return {
      success,
      skipped: false,
      triggerEvent,
      messageControlId: siuResult.message.messageControlId,
      caseId: siuResult.message.caseId,
      ackCode: ackCode || undefined,
      errorMessage: !success
        ? `HTTP ${response.status}: ${responseText.substring(0, 200)}`
        : undefined,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Network error';
    log.error('Auto-push send failed', { scheduleId, action, error: msg });
    return {
      success: false,
      skipped: false,
      triggerEvent,
      messageControlId: siuResult.message.messageControlId,
      caseId: siuResult.message.caseId,
      errorMessage: msg,
    };
  }
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
