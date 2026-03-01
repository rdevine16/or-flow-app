/**
 * Epic Token Manager
 *
 * Manages OAuth access tokens for Epic FHIR connections.
 * Tokens are stored in the epic_connections table with RLS protection.
 * Provides helpers for token validation, storage, and authenticated FHIR requests.
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'
import type { EpicTokenResponse, TokenExpiryInfo } from './types'

const log = logger('epic-token-manager')

/**
 * Store an Epic OAuth token for a facility's connection.
 * Updates the connection record with token data and sets status to 'connected'.
 */
export async function storeEpicToken(
  supabase: SupabaseClient,
  facilityId: string,
  tokenResponse: EpicTokenResponse,
  connectedBy: string
): Promise<{ success: boolean; error: string | null }> {
  const expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString()
  const scopes = tokenResponse.scope ? tokenResponse.scope.split(' ') : []

  const { error } = await supabase
    .from('epic_connections')
    .update({
      access_token: tokenResponse.access_token,
      refresh_token: tokenResponse.refresh_token || null,
      token_expires_at: expiresAt,
      token_scopes: scopes,
      status: 'connected',
      last_connected_at: new Date().toISOString(),
      last_error: null,
      connected_by: connectedBy,
    })
    .eq('facility_id', facilityId)

  if (error) {
    log.error('Failed to store Epic token', { facilityId, error: error.message })
    return { success: false, error: error.message }
  }

  log.info('Epic token stored successfully', { facilityId })
  return { success: true, error: null }
}

/**
 * Get a valid Epic access token for a facility.
 * Returns the token if it exists and hasn't expired.
 * Updates status to 'token_expired' if expired.
 */
export async function getEpicAccessToken(
  supabase: SupabaseClient,
  facilityId: string
): Promise<{ token: string | null; error: string | null }> {
  const { data: connection, error } = await supabase
    .from('epic_connections')
    .select('access_token, token_expires_at, status')
    .eq('facility_id', facilityId)
    .single()

  if (error || !connection) {
    log.error('Failed to fetch Epic connection', { facilityId, error: error?.message })
    return { token: null, error: 'No Epic connection found for this facility' }
  }

  if (!connection.access_token) {
    return { token: null, error: 'No access token available. Please connect to Epic.' }
  }

  // Check expiry
  if (connection.token_expires_at) {
    const expiresAt = new Date(connection.token_expires_at)
    if (expiresAt <= new Date()) {
      // Token expired — update status
      await supabase
        .from('epic_connections')
        .update({ status: 'token_expired' })
        .eq('facility_id', facilityId)

      log.warn('Epic token expired', { facilityId })
      return { token: null, error: 'Epic token has expired. Please reconnect.' }
    }
  }

  return { token: connection.access_token, error: null }
}

/**
 * Clear all token data and set status to 'disconnected'.
 */
export async function clearEpicToken(
  supabase: SupabaseClient,
  facilityId: string
): Promise<{ success: boolean; error: string | null }> {
  const { error } = await supabase
    .from('epic_connections')
    .update({
      access_token: null,
      refresh_token: null,
      token_expires_at: null,
      token_scopes: null,
      status: 'disconnected',
      last_error: null,
    })
    .eq('facility_id', facilityId)

  if (error) {
    log.error('Failed to clear Epic token', { facilityId, error: error.message })
    return { success: false, error: error.message }
  }

  log.info('Epic token cleared', { facilityId })
  return { success: true, error: null }
}

/**
 * Get token expiry info for UX countdown display.
 */
export function getTokenExpiryInfo(tokenExpiresAt: string | null): TokenExpiryInfo {
  if (!tokenExpiresAt) {
    return { expiresAt: null, isExpired: true, minutesRemaining: null }
  }

  const expiresAt = new Date(tokenExpiresAt)
  const now = new Date()
  const diffMs = expiresAt.getTime() - now.getTime()
  const minutesRemaining = Math.max(0, Math.floor(diffMs / 60000))

  return {
    expiresAt,
    isExpired: diffMs <= 0,
    minutesRemaining: diffMs <= 0 ? 0 : minutesRemaining,
  }
}

// =====================================================
// FHIR REQUEST WITH RETRY + TIMEOUT
// =====================================================

const FHIR_TIMEOUT_MS = 10_000
const MAX_RETRIES = 3
const BASE_BACKOFF_MS = 1000

/** Sleep helper for backoff */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Make an authenticated FHIR request using the facility's Epic access token.
 * Features: 10s timeout, exponential backoff for 429 rate limits, up to 3 retries.
 */
export async function epicFhirRequest<T>(
  supabase: SupabaseClient,
  facilityId: string,
  resourcePath: string,
  options: { method?: string; body?: unknown } = {}
): Promise<{ data: T | null; error: string | null }> {
  // Proactive token expiry check
  const { data: connCheck } = await supabase
    .from('epic_connections')
    .select('token_expires_at')
    .eq('facility_id', facilityId)
    .single()

  if (connCheck?.token_expires_at) {
    const expiryInfo = getTokenExpiryInfo(connCheck.token_expires_at)
    if (expiryInfo.isExpired) {
      await supabase
        .from('epic_connections')
        .update({ status: 'token_expired' })
        .eq('facility_id', facilityId)
      return { data: null, error: 'Epic token has expired. Please reconnect.' }
    }
  }

  // Get valid token
  const { token, error: tokenError } = await getEpicAccessToken(supabase, facilityId)
  if (!token) {
    return { data: null, error: tokenError }
  }

  // Get the FHIR base URL from the connection
  const { data: connection, error: connError } = await supabase
    .from('epic_connections')
    .select('fhir_base_url')
    .eq('facility_id', facilityId)
    .single()

  if (connError || !connection) {
    return { data: null, error: 'Failed to get FHIR base URL' }
  }

  const url = `${connection.fhir_base_url}/${resourcePath}`

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), FHIR_TIMEOUT_MS)

      const response = await fetch(url, {
        method: options.method || 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/fhir+json',
          'Content-Type': 'application/fhir+json',
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      // Rate limited — retry with exponential backoff
      if (response.status === 429 && attempt < MAX_RETRIES) {
        const backoff = BASE_BACKOFF_MS * Math.pow(2, attempt)
        log.warn('FHIR rate limited, retrying', { facilityId, resourcePath, attempt, backoffMs: backoff })
        await sleep(backoff)
        continue
      }

      if (!response.ok) {
        const errorText = await response.text()
        log.error('FHIR request failed', {
          facilityId,
          resourcePath,
          status: response.status,
          error: errorText,
        })

        // Token rejected by Epic — may be expired or revoked
        if (response.status === 401) {
          await supabase
            .from('epic_connections')
            .update({ status: 'token_expired' })
            .eq('facility_id', facilityId)

          return { data: null, error: 'Epic token is invalid or expired. Please reconnect.' }
        }

        return { data: null, error: `FHIR request failed: ${response.status} ${response.statusText}` }
      }

      const data = await response.json() as T
      return { data, error: null }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      const isTimeout = err instanceof Error && err.name === 'AbortError'

      if (isTimeout && attempt < MAX_RETRIES) {
        const backoff = BASE_BACKOFF_MS * Math.pow(2, attempt)
        log.warn('FHIR request timed out, retrying', { facilityId, resourcePath, attempt, backoffMs: backoff })
        await sleep(backoff)
        continue
      }

      log.error('FHIR request threw', { facilityId, resourcePath, error: message, isTimeout })
      return {
        data: null,
        error: isTimeout
          ? 'FHIR request timed out after 10s. Epic may be slow — try again.'
          : `FHIR request error: ${message}`,
      }
    }
  }

  // Should not reach here, but TypeScript safety
  return { data: null, error: 'FHIR request failed after retries' }
}
