/**
 * Epic OAuth Callback Route
 *
 * GET /api/epic/auth/callback?code=xxx&state=xxx
 *
 * Handles the Epic OAuth redirect:
 * 1. Decodes state parameter to get facilityId + userId (no cookie dependency)
 * 2. Exchanges authorization code for access token
 * 3. Stores token in epic_connections via service role client
 * 4. Redirects to Epic settings page
 *
 * This route is in PUBLIC_API_ROUTES (middleware.ts) because the redirect
 * comes from Epic's domain and browser cookies may not be present
 * (especially with ngrok interstitials or cross-domain redirects).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { storeEpicToken } from '@/lib/epic/token-manager'
import { logger } from '@/lib/logger'
import type { SmartConfiguration, EpicTokenResponse } from '@/lib/epic/types'

const log = logger('epic-auth-callback')

/** Decode the base64url-encoded state parameter from the connect route */
function decodeState(state: string): { nonce: string; facilityId: string; userId: string } | null {
  try {
    const json = Buffer.from(state, 'base64url').toString('utf-8')
    const parsed = JSON.parse(json) as { nonce: string; facilityId: string; userId: string }
    if (!parsed.nonce || !parsed.facilityId || !parsed.userId) return null
    return parsed
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  // Use forwarded host (ngrok sets this) so redirects stay on the correct domain
  const forwardedHost = req.headers.get('x-forwarded-host')
  const forwardedProto = req.headers.get('x-forwarded-proto') || 'https'
  const origin = forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : req.nextUrl.origin
  const epicSettingsUrl = `${origin}/settings/integrations/epic`

  try {
    // Extract query params
    const code = req.nextUrl.searchParams.get('code')
    const state = req.nextUrl.searchParams.get('state')
    const error = req.nextUrl.searchParams.get('error')

    // Handle Epic-side errors
    if (error) {
      const errorDescription = req.nextUrl.searchParams.get('error_description') || error
      log.error('Epic returned OAuth error', { error, errorDescription })
      return NextResponse.redirect(
        `${epicSettingsUrl}?error=${encodeURIComponent(errorDescription)}`
      )
    }

    if (!code || !state) {
      log.error('Missing code or state in callback')
      return NextResponse.redirect(
        `${epicSettingsUrl}?error=${encodeURIComponent('Missing authorization parameters')}`
      )
    }

    // Decode state parameter (contains facilityId + userId from connect route)
    const stateData = decodeState(state)
    if (!stateData) {
      log.error('Invalid state parameter in callback')
      return NextResponse.redirect(
        `${epicSettingsUrl}?error=${encodeURIComponent('Invalid authentication state. Please try again.')}`
      )
    }

    const { facilityId, userId } = stateData

    // Use service role client — we can't rely on user session cookies
    // because the redirect comes from Epic's domain
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Verify the user is still a valid admin
    const { data: userProfile } = await supabase
      .from('users')
      .select('access_level, facility_id')
      .eq('id', userId)
      .single()

    if (!userProfile || !['facility_admin', 'global_admin'].includes(userProfile.access_level)) {
      log.error('Non-admin user in OAuth callback state', { userId })
      return NextResponse.redirect(
        `${epicSettingsUrl}?error=${encodeURIComponent('Only facility admins can connect to Epic')}`
      )
    }

    if (userProfile.access_level === 'facility_admin' && userProfile.facility_id !== facilityId) {
      log.error('Facility mismatch in OAuth callback', { userId, userFacility: userProfile.facility_id, stateFacility: facilityId })
      return NextResponse.redirect(
        `${epicSettingsUrl}?error=${encodeURIComponent('Cannot connect Epic for another facility')}`
      )
    }

    // App-level credentials from env vars
    const clientId = process.env.EPIC_CLIENT_ID
    const clientSecret = process.env.EPIC_CLIENT_SECRET
    const redirectUri = process.env.EPIC_REDIRECT_URI

    // Per-facility FHIR URL from DB, fall back to env var
    const { data: connection } = await supabase
      .from('epic_connections')
      .select('fhir_base_url')
      .eq('facility_id', facilityId)
      .single()

    const fhirBaseUrl = connection?.fhir_base_url || process.env.EPIC_FHIR_BASE_URL

    if (!fhirBaseUrl || !clientId || !clientSecret || !redirectUri) {
      log.error('Missing Epic configuration', { facilityId, hasFhirUrl: !!fhirBaseUrl, hasClientId: !!clientId })
      return NextResponse.redirect(
        `${epicSettingsUrl}?error=${encodeURIComponent('Epic integration is not fully configured')}`
      )
    }

    // Fetch SMART configuration for token endpoint
    const smartUrl = `${fhirBaseUrl}/.well-known/smart-configuration`
    const smartResponse = await fetch(smartUrl, {
      headers: { Accept: 'application/json' },
    })

    if (!smartResponse.ok) {
      log.error('Failed to fetch SMART config in callback', { status: smartResponse.status })
      return NextResponse.redirect(
        `${epicSettingsUrl}?error=${encodeURIComponent('Failed to connect to Epic server')}`
      )
    }

    const smartConfig = await smartResponse.json() as SmartConfiguration

    // Exchange code for token
    // Epic sandbox rejects requests with client_secret (returns invalid_client),
    // but accepts without it. Only include secret if explicitly needed for production.
    const tokenBody: Record<string, string> = {
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
    }

    const tokenResponse = await fetch(smartConfig.token_endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(tokenBody),
    })

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.text()
      log.error('Token exchange failed', { status: tokenResponse.status, body: errorBody })

      await supabase
        .from('epic_connections')
        .update({
          status: 'error',
          last_error: `Token exchange failed (${tokenResponse.status}): ${errorBody.slice(0, 500)}`,
        })
        .eq('facility_id', facilityId)

      return NextResponse.redirect(
        `${epicSettingsUrl}?error=${encodeURIComponent('Failed to complete Epic authentication')}`
      )
    }

    const tokenData = await tokenResponse.json() as EpicTokenResponse

    // Store the token
    const { success, error: storeError } = await storeEpicToken(
      supabase,
      facilityId,
      tokenData,
      userId
    )

    if (!success) {
      log.error('Failed to store Epic token', { error: storeError })
      return NextResponse.redirect(
        `${epicSettingsUrl}?error=${encodeURIComponent('Failed to save Epic connection')}`
      )
    }

    log.info('Epic OAuth flow completed successfully', { facilityId, userId })
    return NextResponse.redirect(`${epicSettingsUrl}?connected=true`)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    log.error('Unexpected error in Epic callback', { error: message })
    return NextResponse.redirect(
      `${epicSettingsUrl}?error=${encodeURIComponent('An unexpected error occurred')}`
    )
  }
}
