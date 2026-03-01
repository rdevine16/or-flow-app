/**
 * Epic OAuth Connect Route
 *
 * GET /api/epic/auth/connect?facility_id=xxx
 *
 * Initiates the SMART on FHIR OAuth flow:
 * 1. Fetches Epic's SMART configuration
 * 2. Generates CSRF state token
 * 3. Stores state in HTTP-only cookie (5 min TTL)
 * 4. Redirects to Epic's authorization endpoint
 */

import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, AuthorizationError } from '@/lib/errorHandling'
import { createClient } from '@/lib/supabase-server'
import { epicDAL } from '@/lib/dal'
import { logger } from '@/lib/logger'
import type { SmartConfiguration } from '@/lib/epic/types'

const log = logger('epic-auth-connect')

// FHIR scopes for ORbit (SMART v2 granular syntax)
// .rs = read + search; Epic splits these into separate .r and .s grants
const EPIC_SCOPES = [
  'user/Appointment.rs',
  'user/ServiceRequest.rs',
  'user/Patient.rs',
  'user/Practitioner.rs',
  'user/Location.rs',
  'user/Procedure.rs',
  'openid',
  'fhirUser',
].join(' ')

export const GET = withErrorHandler(async (req: NextRequest) => {
  const supabase = await createClient()

  // Verify authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    throw new AuthorizationError('Must be logged in')
  }

  // Verify facility admin
  const { data: userProfile } = await supabase
    .from('users')
    .select('access_level, facility_id')
    .eq('id', user.id)
    .single()

  if (!userProfile || !['facility_admin', 'global_admin'].includes(userProfile.access_level)) {
    throw new AuthorizationError('Only facility admins can connect to Epic')
  }

  // Get facility_id from query params
  const facilityId = req.nextUrl.searchParams.get('facility_id')
  if (!facilityId) {
    return NextResponse.json({ error: 'facility_id is required' }, { status: 400 })
  }

  // Verify user has access to this facility
  if (userProfile.access_level === 'facility_admin' && userProfile.facility_id !== facilityId) {
    throw new AuthorizationError('Cannot connect Epic for another facility')
  }

  // App-level credentials from env vars (ORbit's shared Epic app registration)
  const clientId = process.env.EPIC_CLIENT_ID
  const redirectUri = process.env.EPIC_REDIRECT_URI

  if (!clientId || !redirectUri) {
    log.error('Missing Epic environment variables (CLIENT_ID or REDIRECT_URI)')
    return NextResponse.json(
      { error: 'Epic integration is not configured on the server' },
      { status: 500 }
    )
  }

  // Per-facility FHIR URL from DB, fall back to env var
  const { data: existingConnection } = await epicDAL.getConnection(supabase, facilityId)
  const fhirBaseUrl = existingConnection?.fhir_base_url || process.env.EPIC_FHIR_BASE_URL

  if (!fhirBaseUrl) {
    log.error('No FHIR base URL configured for facility', { facilityId })
    return NextResponse.json(
      { error: 'Please configure your Epic FHIR server URL first.' },
      { status: 400 }
    )
  }

  // Create connection record if one doesn't exist yet (e.g., env var fallback)
  if (!existingConnection) {
    await epicDAL.upsertConnection(supabase, facilityId, {
      fhir_base_url: fhirBaseUrl,
      client_id: clientId,
    })
  }

  // Fetch SMART configuration
  let smartConfig: SmartConfiguration
  try {
    const smartUrl = `${fhirBaseUrl}/.well-known/smart-configuration`
    const response = await fetch(smartUrl, {
      headers: { Accept: 'application/json' },
    })

    if (!response.ok) {
      throw new Error(`SMART config fetch failed: ${response.status}`)
    }

    smartConfig = await response.json() as SmartConfiguration
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    log.error('Failed to fetch SMART configuration', { fhirBaseUrl, error: message })
    return NextResponse.json(
      { error: 'Failed to connect to Epic FHIR server' },
      { status: 502 }
    )
  }

  // Generate CSRF state — encode facilityId and userId in the state parameter
  // so the callback doesn't depend on cookies (which break across domains/ngrok)
  const nonce = crypto.randomUUID()
  const statePayload = JSON.stringify({ nonce, facilityId, userId: user.id })
  const state = Buffer.from(statePayload).toString('base64url')

  // Build authorization URL
  const authUrl = new URL(smartConfig.authorization_endpoint)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('scope', EPIC_SCOPES)
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('aud', fhirBaseUrl)

  const response = NextResponse.redirect(authUrl.toString())

  log.info('Epic OAuth flow initiated', { facilityId })
  return response
})
