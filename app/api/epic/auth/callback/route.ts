/**
 * Epic OAuth Callback Route
 *
 * GET /api/epic/auth/callback?code=xxx&state=xxx
 *
 * Handles the Epic OAuth redirect:
 * 1. Validates state parameter against cookie (CSRF protection)
 * 2. Exchanges authorization code for access token
 * 3. Stores token in epic_connections
 * 4. Logs audit event
 * 5. Redirects to Epic settings page
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { storeEpicToken } from '@/lib/epic/token-manager'
import { epicAudit } from '@/lib/audit-logger'
import { logger } from '@/lib/logger'
import type { SmartConfiguration, EpicTokenResponse } from '@/lib/epic/types'

const log = logger('epic-auth-callback')

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const epicSettingsUrl = `${appUrl}/settings/integrations/epic`

  try {
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      log.error('Unauthenticated callback attempt')
      return NextResponse.redirect(`${appUrl}/login?error=auth_required`)
    }

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

    // Validate state against cookie
    const stateCookie = req.cookies.get('epic_oauth_state')
    if (!stateCookie?.value) {
      log.error('Missing OAuth state cookie — possible CSRF or expired session')
      return NextResponse.redirect(
        `${epicSettingsUrl}?error=${encodeURIComponent('Authentication session expired. Please try again.')}`
      )
    }

    let cookieData: { state: string; facilityId: string }
    try {
      cookieData = JSON.parse(stateCookie.value) as { state: string; facilityId: string }
    } catch {
      log.error('Invalid OAuth state cookie format')
      return NextResponse.redirect(
        `${epicSettingsUrl}?error=${encodeURIComponent('Invalid authentication state. Please try again.')}`
      )
    }

    if (cookieData.state !== state) {
      log.error('OAuth state mismatch', { expected: cookieData.state, received: state })
      return NextResponse.redirect(
        `${epicSettingsUrl}?error=${encodeURIComponent('Authentication failed — state mismatch. Please try again.')}`
      )
    }

    const facilityId = cookieData.facilityId

    // Get FHIR base URL and SMART configuration
    const fhirBaseUrl = process.env.EPIC_FHIR_BASE_URL
    const clientId = process.env.EPIC_CLIENT_ID
    const clientSecret = process.env.EPIC_CLIENT_SECRET
    const redirectUri = process.env.EPIC_REDIRECT_URI

    if (!fhirBaseUrl || !clientId || !clientSecret || !redirectUri) {
      log.error('Missing Epic environment variables')
      return NextResponse.redirect(
        `${epicSettingsUrl}?error=${encodeURIComponent('Epic integration is not configured')}`
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
    const tokenResponse = await fetch(smartConfig.token_endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    })

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.text()
      log.error('Token exchange failed', { status: tokenResponse.status, body: errorBody })

      // Update connection status to error
      await supabase
        .from('epic_connections')
        .update({
          status: 'error',
          last_error: `Token exchange failed: ${tokenResponse.status}`,
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
      user.id
    )

    if (!success) {
      log.error('Failed to store Epic token', { error: storeError })
      return NextResponse.redirect(
        `${epicSettingsUrl}?error=${encodeURIComponent('Failed to save Epic connection')}`
      )
    }

    // Log audit event
    await epicAudit.connected(supabase, facilityId, fhirBaseUrl)

    // Clear the state cookie and redirect to settings
    const response = NextResponse.redirect(`${epicSettingsUrl}?connected=true`)
    response.cookies.set('epic_oauth_state', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0, // Delete cookie
      path: '/api/epic/auth',
    })

    log.info('Epic OAuth flow completed successfully', { facilityId })
    return response
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    log.error('Unexpected error in Epic callback', { error: message })
    return NextResponse.redirect(
      `${epicSettingsUrl}?error=${encodeURIComponent('An unexpected error occurred')}`
    )
  }
}
