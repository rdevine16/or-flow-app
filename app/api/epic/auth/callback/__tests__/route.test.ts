/**
 * Epic OAuth Callback Security Tests
 *
 * Verifies the security hardening in the callback route:
 * - State parameter decoding and validation
 * - Admin permission check (non-admins rejected)
 * - Facility ownership check (facility admin can't complete OAuth for another facility)
 * - Missing parameters handling
 * - Global admin bypass
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '../route'

// Mock the token manager
vi.mock('@/lib/epic/token-manager', () => ({
  storeEpicToken: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

// Mock @supabase/supabase-js createClient (used directly by the route)
const mockChainable = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data: null, error: null }),
  update: vi.fn().mockReturnThis(),
}

const mockSupabase = {
  from: vi.fn().mockReturnValue(mockChainable),
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
}))

/** Encode state the same way the connect route does */
function encodeState(data: { nonce: string; facilityId: string; userId: string }): string {
  return Buffer.from(JSON.stringify(data)).toString('base64url')
}

function createMockRequest(params: Record<string, string>): NextRequest {
  const url = new URL('http://localhost:3000/api/epic/auth/callback')
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return new NextRequest(url)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key')
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000')
  vi.stubEnv('EPIC_FHIR_BASE_URL', 'https://fhir.epic.com')
  vi.stubEnv('EPIC_CLIENT_ID', 'test-client-id')
  vi.stubEnv('EPIC_CLIENT_SECRET', 'test-secret')
  vi.stubEnv('EPIC_REDIRECT_URI', 'http://localhost:3000/api/epic/auth/callback')
})

describe('GET /api/epic/auth/callback — Security', () => {
  it('rejects callback with missing code or state params', async () => {
    const req = createMockRequest({}) // No code or state
    const response = await GET(req)

    expect(response.status).toBe(307)
    const location = response.headers.get('Location') || ''
    expect(decodeURIComponent(location)).toContain('Missing authorization parameters')
  })

  it('rejects callback with invalid state parameter', async () => {
    const req = createMockRequest({ code: 'auth-code', state: 'invalid-not-base64-json' })
    const response = await GET(req)

    expect(response.status).toBe(307)
    const location = response.headers.get('Location') || ''
    expect(decodeURIComponent(location)).toContain('Invalid authentication state')
  })

  it('rejects non-admin users (viewer)', async () => {
    const state = encodeState({ nonce: 'test', facilityId: 'fac-1', userId: 'user-1' })

    // Mock user lookup returns viewer
    mockChainable.single.mockResolvedValueOnce({
      data: { access_level: 'viewer', facility_id: 'fac-1' },
      error: null,
    })

    const req = createMockRequest({ code: 'auth-code', state })
    const response = await GET(req)

    expect(response.status).toBe(307)
    const location = response.headers.get('Location') || ''
    expect(decodeURIComponent(location)).toContain('Only facility admins can connect to Epic')
  })

  it('rejects non-admin users (surgeon)', async () => {
    const state = encodeState({ nonce: 'test', facilityId: 'fac-1', userId: 'user-1' })

    mockChainable.single.mockResolvedValueOnce({
      data: { access_level: 'surgeon', facility_id: 'fac-1' },
      error: null,
    })

    const req = createMockRequest({ code: 'auth-code', state })
    const response = await GET(req)

    expect(response.status).toBe(307)
    const location = response.headers.get('Location') || ''
    expect(decodeURIComponent(location)).toContain('Only facility admins can connect to Epic')
  })

  it('rejects facility admin completing OAuth for another facility', async () => {
    const state = encodeState({ nonce: 'test', facilityId: 'fac-2', userId: 'user-1' })

    // User belongs to fac-1 but state says fac-2
    mockChainable.single.mockResolvedValueOnce({
      data: { access_level: 'facility_admin', facility_id: 'fac-1' },
      error: null,
    })

    const req = createMockRequest({ code: 'auth-code', state })
    const response = await GET(req)

    expect(response.status).toBe(307)
    const location = response.headers.get('Location') || ''
    expect(decodeURIComponent(location)).toContain('Cannot connect Epic for another facility')
  })

  it('rejects when user profile not found', async () => {
    const state = encodeState({ nonce: 'test', facilityId: 'fac-1', userId: 'user-1' })

    // User not found
    mockChainable.single.mockResolvedValueOnce({
      data: null,
      error: null,
    })

    const req = createMockRequest({ code: 'auth-code', state })
    const response = await GET(req)

    expect(response.status).toBe(307)
    const location = response.headers.get('Location') || ''
    expect(decodeURIComponent(location)).toContain('Only facility admins can connect to Epic')
  })

  it('allows global admin to complete OAuth for any facility', async () => {
    const state = encodeState({ nonce: 'test', facilityId: 'fac-99', userId: 'user-1' })

    // Global admin — no facility_id constraint
    mockChainable.single
      .mockResolvedValueOnce({
        data: { access_level: 'global_admin', facility_id: null },
        error: null,
      })
      // epic_connections lookup for fhir_base_url
      .mockResolvedValueOnce({
        data: { fhir_base_url: 'https://fhir.epic.com' },
        error: null,
      })

    // Mock SMART config + token exchange fetch calls
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

    const req = createMockRequest({ code: 'auth-code', state })
    const response = await GET(req)

    expect(response.status).toBe(307)
    const location = response.headers.get('Location') || ''
    expect(location).toContain('connected=true')
  })
})
