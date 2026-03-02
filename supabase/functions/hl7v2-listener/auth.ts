/**
 * Authentication Module for HL7v2 Listener
 *
 * Authenticates inbound requests via:
 * 1. API key (X-Integration-Key header)
 * 2. Basic Auth (Authorization: Basic ...)
 *
 * Resolves the integration and facility from the provided credentials.
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { EhrIntegration } from './types.ts';

export interface AuthResult {
  authenticated: boolean;
  integration: EhrIntegration | null;
  errorMessage: string | null;
}

/**
 * Authenticate an incoming request and resolve the facility integration.
 *
 * Auth flow:
 * 1. Check X-Integration-Key header → query by API key
 * 2. If no header, check Authorization: Basic → decode → query by API key from password
 * 3. Reject if neither present or no match
 */
export async function authenticateRequest(
  req: Request,
  supabase: SupabaseClient,
): Promise<AuthResult> {
  // 1. Try API key header
  const apiKeyHeader = req.headers.get('X-Integration-Key');
  if (apiKeyHeader) {
    return lookupByApiKey(supabase, apiKeyHeader);
  }

  // 2. Try Basic Auth
  const authHeader = req.headers.get('Authorization');
  if (authHeader?.startsWith('Basic ')) {
    const decoded = decodeBasicAuth(authHeader);
    if (!decoded) {
      return { authenticated: false, integration: null, errorMessage: 'Invalid Basic Auth encoding' };
    }

    // Look up the integration by Basic Auth credentials
    return lookupByBasicAuth(supabase, decoded.username, decoded.password);
  }

  return { authenticated: false, integration: null, errorMessage: 'No authentication credentials provided' };
}

/**
 * Look up an integration by API key.
 * Queries config->>'api_key' on ehr_integrations.
 */
async function lookupByApiKey(
  supabase: SupabaseClient,
  apiKey: string,
): Promise<AuthResult> {
  const { data, error } = await supabase
    .from('ehr_integrations')
    .select('*')
    .eq('config->>api_key', apiKey)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('[auth] DB error looking up API key:', error.message);
    return { authenticated: false, integration: null, errorMessage: 'Authentication service error' };
  }

  if (!data) {
    return { authenticated: false, integration: null, errorMessage: 'Invalid API key' };
  }

  return { authenticated: true, integration: data as unknown as EhrIntegration, errorMessage: null };
}

/**
 * Look up an integration by Basic Auth credentials.
 * Checks config->>'basic_auth_user' and config->>'basic_auth_pass'.
 */
async function lookupByBasicAuth(
  supabase: SupabaseClient,
  username: string,
  password: string,
): Promise<AuthResult> {
  const { data, error } = await supabase
    .from('ehr_integrations')
    .select('*')
    .eq('config->>basic_auth_user', username)
    .eq('config->>basic_auth_pass', password)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('[auth] DB error looking up Basic Auth:', error.message);
    return { authenticated: false, integration: null, errorMessage: 'Authentication service error' };
  }

  if (!data) {
    return { authenticated: false, integration: null, errorMessage: 'Invalid Basic Auth credentials' };
  }

  return { authenticated: true, integration: data as unknown as EhrIntegration, errorMessage: null };
}

/**
 * Decode a Basic Auth header value.
 * Format: "Basic base64(username:password)"
 */
function decodeBasicAuth(header: string): { username: string; password: string } | null {
  try {
    const encoded = header.substring(6); // Remove "Basic "
    const decoded = atob(encoded);
    const colonIndex = decoded.indexOf(':');
    if (colonIndex === -1) return null;

    return {
      username: decoded.substring(0, colonIndex),
      password: decoded.substring(colonIndex + 1),
    };
  } catch {
    return null;
  }
}
