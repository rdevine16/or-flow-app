/**
 * Shared utilities for HL7v2 test harness API routes.
 *
 * Extracted from route.ts so both the main test harness and the
 * auto-push route can look up a facility's integration config.
 */

import { ValidationError } from '@/lib/errorHandling';
import type { createClient } from '@/lib/supabase-server';

/**
 * Look up the HL7v2 integration config (endpoint URL + API key)
 * for a given facility. Throws if the facility has no integration
 * or no API key configured.
 */
export async function getIntegrationConfig(
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

/**
 * Non-throwing variant: returns `null` instead of throwing when
 * the facility has no integration configured. Useful for auto-push
 * where missing integration is a normal "skip" condition.
 */
export async function getIntegrationConfigOrNull(
  supabase: Awaited<ReturnType<typeof createClient>>,
  facilityId: string,
): Promise<{ endpointUrl: string; apiKey: string } | null> {
  const { data: integration } = await supabase
    .from('ehr_integrations')
    .select('id, config')
    .eq('facility_id', facilityId)
    .eq('integration_type', 'epic_hl7v2')
    .single();

  if (!integration) return null;

  const config = integration.config as Record<string, unknown>;
  const apiKey = config.api_key as string;
  if (!apiKey) return null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return null;

  return {
    endpointUrl: `${supabaseUrl}/functions/v1/hl7v2-listener`,
    apiKey,
  };
}
