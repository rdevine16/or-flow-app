/**
 * Epic OAuth Callback Security Tests
 *
 * Phase 6: Verifies the security hardening added to the callback route:
 * - Admin permission check (non-admins rejected)
 * - Facility ownership check (facility admin can't complete OAuth for another facility)
 * - OAuth state validation (mismatch, missing, expired)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '../route'

// Mock dependencies
vi.mock('@/lib/supabase-server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/epic/token-manager', () => ({
  storeEpicToken: vi.fn(),
}))

vi.mock('@/lib/audit-logger', () => ({
  epicAudit: {
    connected: vi.fn(),
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

import { createClient } from '@/lib/supabase-server'

beforeEach(() => {
  vi.clearAllMocks()
  // Set required env vars
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000')
  vi.stubEnv('EPIC_FHIR_BASE_URL', 'https://fhir.epic.com')
  vi.stubEnv('EPIC_CLIENT_ID', 'test-client-id')
  vi.stubEnv('EPIC_CLIENT_SECRET', 'test-secret')
  vi.stubEnv('EPIC_REDIRECT_URI', 'http://localhost:3000/api/epic/auth/callback')
})

// Helper to create a mock request with query params and cookies
function createMockRequest(
  params: Record<string, string>,
  cookieValue?: string
): NextRequest {
  const url = new URL('http://localhost:3000/api/epic/auth/callback')
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }

  const req = new NextRequest(url)

  if (cookieValue) {
    // NextRequest doesn't allow direct cookie setting, so we create with headers
    const reqWithCookie = new NextRequest(url, {
      headers: {
        cookie: `epic_oauth_state=${cookieValue}`,
      },
    })
    return reqWithCookie
  }

  return req
}

// Helper to create a mock Supabase client
function createMockSupabase(userProfile: { access_level: string; facility_id: string | null } | null) {
  const chainable = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: userProfile,
      error: null,
    }),
    update: vi.fn().mockReturnThis(),
  }

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: userProfile ? { id: 'user-1' } : null },
        error: userProfile ? null : new Error('Not authenticated'),
      }),
    },
    from: vi.fn().mockReturnValue(chainable),
    chainable,
  }
}

describe('GET /api/epic/auth/callback — Security', () => {
  it('redirects unauthenticated users to login', async () => {
    const mockSupabase = createMockSupabase(null)
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any)

    const req = createMockRequest({ code: 'auth-code', state: 'test-state' })
    const response = await GET(req)

    expect(response.status).toBe(307)
    expect(response.headers.get('Location')).toContain('/login?error=auth_required')
  })

  it('rejects non-admin users (viewer)', async () => {
    const mockSupabase = createMockSupabase({ access_level: 'viewer', facility_id: 'fac-1' })
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any)

    const req = createMockRequest({ code: 'auth-code', state: 'test-state' })
    const response = await GET(req)

    expect(response.status).toBe(307)
    const location = response.headers.get('Location') || ''
    expect(location).toContain('error=')
    expect(decodeURIComponent(location)).toContain('Only facility admins can connect to Epic')
  })

  it('rejects non-admin users (surgeon)', async () => {
    const mockSupabase = createMockSupabase({ access_level: 'surgeon', facility_id: 'fac-1' })
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any)

    const req = createMockRequest({ code: 'auth-code', state: 'test-state' })
    const response = await GET(req)

    expect(response.status).toBe(307)
    const location = response.headers.get('Location') || ''
    expect(decodeURIComponent(location)).toContain('Only facility admins can connect to Epic')
  })

  it('rejects facility admin completing OAuth for another facility', async () => {
    const mockSupabase = createMockSupabase({ access_level: 'facility_admin', facility_id: 'fac-1' })
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any)

    // Cookie state contains a DIFFERENT facility
    const stateValue = 'test-state-123'
    const cookieData = JSON.stringify({ state: stateValue, facilityId: 'fac-2' })
    const req = createMockRequest(
      { code: 'auth-code', state: stateValue },
      cookieData
    )
    const response = await GET(req)

    expect(response.status).toBe(307)
    const location = response.headers.get('Location') || ''
    expect(decodeURIComponent(location)).toContain('Cannot connect Epic for another facility')
  })

  it('rejects callback with state mismatch', async () => {
    const mockSupabase = createMockSupabase({ access_level: 'facility_admin', facility_id: 'fac-1' })
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any)

    const cookieData = JSON.stringify({ state: 'cookie-state', facilityId: 'fac-1' })
    const req = createMockRequest(
      { code: 'auth-code', state: 'different-state' },
      cookieData
    )
    const response = await GET(req)

    expect(response.status).toBe(307)
    const location = response.headers.get('Location') || ''
    expect(decodeURIComponent(location)).toContain('state mismatch')
  })

  it('rejects callback with missing state cookie', async () => {
    const mockSupabase = createMockSupabase({ access_level: 'facility_admin', facility_id: 'fac-1' })
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any)

    const req = createMockRequest({ code: 'auth-code', state: 'test-state' })
    // No cookie set
    const response = await GET(req)

    expect(response.status).toBe(307)
    const location = response.headers.get('Location') || ''
    expect(decodeURIComponent(location)).toContain('session expired')
  })

  it('rejects callback with missing code or state params', async () => {
    const mockSupabase = createMockSupabase({ access_level: 'facility_admin', facility_id: 'fac-1' })
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any)

    const req = createMockRequest({}) // No code or state
    const response = await GET(req)

    expect(response.status).toBe(307)
    const location = response.headers.get('Location') || ''
    expect(decodeURIComponent(location)).toContain('Missing authorization parameters')
  })

  it('allows global admin to complete OAuth for any facility', async () => {
    const mockSupabase = createMockSupabase({ access_level: 'global_admin', facility_id: null })
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any)

    const stateValue = 'test-state-456'
    const cookieData = JSON.stringify({ state: stateValue, facilityId: 'fac-99' })
    const req = createMockRequest(
      { code: 'auth-code', state: stateValue },
      cookieData
    )

    // Mock SMART config fetch
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          authorization_endpoint: 'https://fhir.epic.com/auth',
          token_endpoint: 'https://fhir.epic.com/token',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test-token',
          expires_in: 3600,
          token_type: 'Bearer',
          scope: 'user/Patient.read',
        }),
      })
    )

    // Mock storeEpicToken
    const { storeEpicToken } = await import('@/lib/epic/token-manager')
    vi.mocked(storeEpicToken).mockResolvedValue({ success: true, error: null })

    const response = await GET(req)

    // Should proceed past admin check (global admin bypasses facility check)
    // Should reach the token storage step
    expect(response.status).toBe(307)
    const location = response.headers.get('Location') || ''
    expect(location).toContain('connected=true')
  })
})
