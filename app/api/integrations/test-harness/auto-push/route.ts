/**
 * Auto-Push API Route
 *
 * POST: Send a single SIU message for a schedule entry action (create/update/delete).
 * Called by the Test Data Manager UI when auto-push is enabled or when the user
 * clicks the per-row "Push" button.
 *
 * Global admin only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, AuthorizationError, ValidationError } from '@/lib/errorHandling';
import { createClient } from '@/lib/supabase-server';
import { logger } from '@/lib/logger';
import {
  executeAutoPush,
  type AutoPushAction,
  type AutoPushRequest,
} from '@/lib/hl7v2/test-harness/auto-push';
import type { EhrTestScheduleWithEntities } from '@/lib/integrations/shared/integration-types';

const log = logger('auto-push-api');

const VALID_ACTIONS: AutoPushAction[] = ['create', 'update', 'delete'];

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
    throw new AuthorizationError('Only global admins can use auto-push');
  }

  // Parse and validate body
  const body = await req.json();
  const { scheduleId, facilityId, action, scheduleData } = body as {
    scheduleId: string;
    facilityId: string;
    action: AutoPushAction;
    scheduleData?: EhrTestScheduleWithEntities;
  };

  if (!scheduleId) {
    throw new ValidationError('scheduleId is required');
  }
  if (!facilityId) {
    throw new ValidationError('facilityId is required');
  }
  if (!action || !VALID_ACTIONS.includes(action)) {
    throw new ValidationError(`action must be one of: ${VALID_ACTIONS.join(', ')}`);
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

  log.info('Auto-push requested', {
    scheduleId,
    facilityId,
    facilityName: facility.name,
    action,
    hasScheduleData: !!scheduleData,
  });

  // Execute auto-push
  const request: AutoPushRequest = {
    scheduleId,
    facilityId,
    action,
    scheduleData,
  };

  const result = await executeAutoPush(supabase, request);

  return NextResponse.json(result);
});
