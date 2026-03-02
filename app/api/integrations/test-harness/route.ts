/**
 * Test Harness API Route
 *
 * POST: Generate and/or send SIU test messages via the HL7v2 listener.
 * Supports two modes:
 *   - Algorithmic: generates scenarios from hardcoded data (full-day, chaos, multi-day)
 *   - Database: reads schedule entries from the Test Data Manager (default)
 * Global admin only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, AuthorizationError, ValidationError } from '@/lib/errorHandling';
import { createClient } from '@/lib/supabase-server';
import { logger } from '@/lib/logger';
import type { ScenarioType, ScenarioOptions, ScenarioResult } from '@/lib/hl7v2/test-harness/scenario-runner';
import {
  generateFullDay,
  generateChaosDay,
  generateMultiDay,
  sendScenario,
} from '@/lib/hl7v2/test-harness/scenario-runner';
import {
  loadDatabaseScenario,
  sendDatabaseScenario,
} from '@/lib/hl7v2/test-harness/db-scenario-runner';

const log = logger('test-harness-api');

type ExtendedScenarioType = ScenarioType | 'database';

// ── POST: Run a scenario ─────────────────────────────────────────────────────

export const POST = withErrorHandler(async (req: NextRequest) => {
  const supabase = await createClient();

  // Auth: global admin only
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new AuthorizationError('Must be logged in');
  }

  const { data: userProfile } = await supabase
    .from('users')
    .select('access_level')
    .eq('id', user.id)
    .single();

  if (!userProfile || userProfile.access_level !== 'global_admin') {
    throw new AuthorizationError('Only global admins can use the test harness');
  }

  // Parse body
  const body = await req.json();
  const {
    scenario: scenarioType,
    facilityId,
    specialties,
    caseCount,
    startDate,
    dayCount,
    previewOnly,
    scheduleIds,
    delayMs,
  } = body as {
    scenario: ExtendedScenarioType;
    facilityId: string;
    specialties?: string[];
    caseCount?: number;
    startDate?: string;
    dayCount?: number;
    previewOnly?: boolean;
    scheduleIds?: string[];
    delayMs?: number;
  };

  if (!scenarioType) {
    throw new ValidationError('scenario is required');
  }
  if (!facilityId) {
    throw new ValidationError('facilityId is required');
  }

  // Validate facility exists
  const { data: facility } = await supabase
    .from('facilities')
    .select('id, name')
    .eq('id', facilityId)
    .single();

  if (!facility) {
    throw new ValidationError('Invalid facility ID');
  }

  // ── Database-driven mode ──────────────────────────────────────────────────
  if (scenarioType === 'database') {
    return handleDatabaseScenario(supabase, facilityId, facility.name, previewOnly, scheduleIds, delayMs);
  }

  // ── Algorithmic mode (existing: full-day, chaos, multi-day) ───────────────

  // Build scenario options
  const options: ScenarioOptions = {
    facilityId,
    specialties: specialties as ScenarioOptions['specialties'],
    caseCount,
    startDate: startDate ? new Date(startDate) : undefined,
    dayCount,
  };

  // Generate scenario
  let scenario: ScenarioResult;
  switch (scenarioType) {
    case 'full-day':
      scenario = generateFullDay(options);
      break;
    case 'chaos':
      scenario = generateChaosDay(options);
      break;
    case 'multi-day':
      scenario = generateMultiDay(options);
      break;
    default:
      throw new ValidationError(`Invalid scenario type: ${scenarioType}`);
  }

  // If preview only, return messages without sending
  if (previewOnly) {
    return NextResponse.json({
      type: scenario.type,
      totalCases: scenario.totalCases,
      totalMessages: scenario.totalMessages,
      dateRange: scenario.dateRange,
      messages: scenario.messages.map((m) => ({
        sequenceNumber: m.sequenceNumber,
        description: m.description,
        triggerEvent: m.message.triggerEvent,
        caseId: m.message.caseId,
        procedure: m.message.procedure.name,
        surgeon: `${m.message.surgeon.firstName} ${m.message.surgeon.lastName}`,
        patient: `${m.message.patient.firstName} ${m.message.patient.lastName}`,
        room: m.message.room.code,
        scheduledTime: m.message.scheduledDateTime.toISOString(),
        rawMessage: m.message.raw,
      })),
    });
  }

  // Get integration config for sending
  const { endpointUrl, apiKey } = await getIntegrationConfig(supabase, facilityId);

  log.info('Running test harness scenario', {
    scenario: scenarioType,
    facilityId,
    totalMessages: scenario.totalMessages,
    facilityName: facility.name,
  });

  // Send scenario messages
  const results = await sendScenario(scenario, endpointUrl, apiKey);

  const summary = {
    totalSent: results.length,
    succeeded: results.filter((r) => r.status === 'success').length,
    failed: results.filter((r) => r.status === 'error').length,
  };

  log.info('Test harness scenario completed', { ...summary, scenario: scenarioType });

  return NextResponse.json({
    type: scenario.type,
    summary,
    results: results.map((r) => ({
      sequenceNumber: r.sequenceNumber,
      messageControlId: r.messageControlId,
      caseId: r.caseId,
      triggerEvent: r.triggerEvent,
      status: r.status,
      ackCode: r.ackCode,
      errorMessage: r.errorMessage,
      description: r.description,
    })),
  });
});

// ── Database Scenario Handler ────────────────────────────────────────────────

async function handleDatabaseScenario(
  supabase: Awaited<ReturnType<typeof createClient>>,
  facilityId: string,
  facilityName: string,
  previewOnly?: boolean,
  scheduleIds?: string[],
  delayMs?: number,
) {
  // Load and convert schedules
  const dbScenario = await loadDatabaseScenario(supabase, facilityId, scheduleIds);

  // If preview only, return converted messages without sending
  if (previewOnly) {
    return NextResponse.json({
      type: 'database',
      totalSchedules: dbScenario.totalSchedules,
      totalMessages: dbScenario.totalMessages,
      conversionErrors: dbScenario.conversionErrors,
      messages: dbScenario.messages.map((m) => ({
        sequenceNumber: m.siuResult.sequenceOrder,
        scheduleId: m.siuResult.scheduleId,
        description: m.siuResult.description,
        triggerEvent: m.siuResult.message.triggerEvent,
        caseId: m.siuResult.message.caseId,
        procedure: m.siuResult.message.procedure.name,
        surgeon: `${m.siuResult.message.surgeon.firstName} ${m.siuResult.message.surgeon.lastName}`,
        patient: `${m.siuResult.message.patient.firstName} ${m.siuResult.message.patient.lastName}`,
        room: m.siuResult.message.room.code,
        scheduledTime: m.siuResult.message.scheduledDateTime.toISOString(),
        rawMessage: m.siuResult.message.raw,
      })),
    });
  }

  // Get integration config for sending
  const { endpointUrl, apiKey } = await getIntegrationConfig(supabase, facilityId);

  log.info('Running database-driven test harness', {
    facilityId,
    facilityName,
    totalMessages: dbScenario.totalMessages,
    conversionErrors: dbScenario.conversionErrors.length,
    scheduleIds: scheduleIds?.length,
  });

  // Send messages
  const results = await sendDatabaseScenario(dbScenario, endpointUrl, apiKey, delayMs);

  const summary = {
    totalSent: results.length,
    succeeded: results.filter((r) => r.status === 'success').length,
    failed: results.filter((r) => r.status === 'error').length,
  };

  log.info('Database test harness completed', { ...summary });

  return NextResponse.json({
    type: 'database',
    summary,
    conversionErrors: dbScenario.conversionErrors,
    results: results.map((r) => ({
      sequenceNumber: r.sequenceNumber,
      scheduleId: r.scheduleId,
      messageControlId: r.messageControlId,
      caseId: r.caseId,
      triggerEvent: r.triggerEvent,
      status: r.status,
      ackCode: r.ackCode,
      errorMessage: r.errorMessage,
      description: r.description,
    })),
  });
}

// ── Shared Helpers ───────────────────────────────────────────────────────────

async function getIntegrationConfig(
  supabase: Awaited<ReturnType<typeof createClient>>,
  facilityId: string,
): Promise<{ endpointUrl: string; apiKey: string }> {
  const { data: integration } = await supabase
    .from('ehr_integrations')
    .select('id, config')
    .eq('facility_id', facilityId)
    .eq('integration_type', 'epic_hl7v2')
    .single();

  if (!integration) {
    throw new ValidationError(
      'No HL7v2 integration configured for this facility. Set up the integration first.'
    );
  }

  const config = integration.config as Record<string, unknown>;
  const apiKey = config.api_key as string;

  if (!apiKey) {
    throw new ValidationError('Integration has no API key configured');
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new ValidationError('NEXT_PUBLIC_SUPABASE_URL not configured');
  }

  return {
    endpointUrl: `${supabaseUrl}/functions/v1/hl7v2-listener`,
    apiKey,
  };
}
