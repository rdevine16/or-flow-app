/**
 * Epic Configuration Route
 *
 * GET  /api/epic/config?facility_id=xxx  — Returns current FHIR URL config
 * POST /api/epic/config                  — Saves per-facility FHIR base URL
 *
 * Each facility may connect to a different Epic instance (different hospital,
 * different FHIR server URL). The client_id and client_secret come from env
 * vars — they're ORbit's shared app registration in Epic App Orchard.
 */

import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, AuthorizationError, ValidationError } from '@/lib/errorHandling'
import { createClient } from '@/lib/supabase-server'
import { epicDAL } from '@/lib/dal'
import { logger } from '@/lib/logger'

const log = logger('epic-config')

/** Verify the caller is facility_admin or global_admin and has access to the facility */
async function verifyAdminAccess(
  supabase: Awaited<ReturnType<typeof createClient>>,
  facilityId: string
) {
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    throw new AuthorizationError('Must be logged in')
  }

  const { data: userProfile } = await supabase
    .from('users')
    .select('access_level, facility_id')
    .eq('id', user.id)
    .single()

  if (!userProfile || !['facility_admin', 'global_admin'].includes(userProfile.access_level)) {
    throw new AuthorizationError('Only facility admins can configure Epic')
  }

  if (userProfile.access_level === 'facility_admin' && userProfile.facility_id !== facilityId) {
    throw new AuthorizationError('Cannot configure Epic for another facility')
  }

  return user
}

// =====================================================
// GET — Retrieve current FHIR URL config
// =====================================================

export const GET = withErrorHandler(async (req: NextRequest) => {
  const supabase = await createClient()
  const facilityId = req.nextUrl.searchParams.get('facility_id')
  if (!facilityId) {
    throw new ValidationError('facility_id is required')
  }

  await verifyAdminAccess(supabase, facilityId)

  const { data, error } = await epicDAL.getConnectionConfig(supabase, facilityId)

  if (error && error.code !== 'PGRST116') {
    log.error('Failed to fetch Epic config', { facilityId, error: error.message })
    return NextResponse.json({ error: 'Failed to fetch configuration' }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ configured: false, config: null })
  }

  return NextResponse.json({
    configured: true,
    config: { fhir_base_url: data.fhir_base_url },
  })
})

// =====================================================
// POST — Save per-facility FHIR base URL
// =====================================================

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  try {
    const body = await req.json() as { facility_id?: string; fhir_base_url?: string }
    const { facility_id, fhir_base_url } = body

    if (!facility_id || !fhir_base_url) {
      return NextResponse.json(
        { error: 'facility_id and fhir_base_url are required' },
        { status: 400 }
      )
    }

    await verifyAdminAccess(supabase, facility_id)

    const cleanUrl = fhir_base_url.replace(/\/+$/, '')

    // Validate the FHIR base URL by fetching SMART configuration
    const smartUrl = `${cleanUrl}/.well-known/smart-configuration`
    try {
      const smartResponse = await fetch(smartUrl, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
      })

      if (!smartResponse.ok) {
        return NextResponse.json(
          { error: `FHIR server returned ${smartResponse.status}. Verify the URL includes the full path (e.g., /api/FHIR/R4).` },
          { status: 422 }
        )
      }

      const config = await smartResponse.json()
      if (!config.authorization_endpoint || !config.token_endpoint) {
        return NextResponse.json(
          { error: 'FHIR server responded but SMART configuration is missing required endpoints.' },
          { status: 422 }
        )
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      log.error('FHIR URL validation failed', { fhir_base_url: cleanUrl, error: message })
      return NextResponse.json(
        { error: 'Cannot reach the FHIR server. Check the URL and network connectivity.' },
        { status: 422 }
      )
    }

    // client_id comes from env var (ORbit's shared app registration)
    const clientId = process.env.EPIC_CLIENT_ID
    if (!clientId) {
      log.error('EPIC_CLIENT_ID env var not set')
      return NextResponse.json(
        { error: 'Epic integration is not configured on the server.' },
        { status: 500 }
      )
    }

    const { error } = await epicDAL.upsertConnection(supabase, facility_id, {
      fhir_base_url: cleanUrl,
      client_id: clientId,
    })

    if (error) {
      log.error('Failed to save Epic config', { facility_id, error: error.message })
      return NextResponse.json({ error: 'Failed to save configuration' }, { status: 500 })
    }

    log.info('Epic FHIR URL saved', { facility_id, fhir_base_url: cleanUrl })

    return NextResponse.json({
      success: true,
      config: { fhir_base_url: cleanUrl },
    })
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: 403 })
    }
    const message = err instanceof Error ? err.message : 'Unknown error'
    log.error('Unexpected error saving Epic config', { error: message })
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
