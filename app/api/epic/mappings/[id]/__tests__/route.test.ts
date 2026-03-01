/**
 * Epic Entity Mapping Delete Route — Security Tests
 *
 * Phase 6: Verifies the security hardening added to the DELETE route:
 * - Admin permission check
 * - Facility_id verification (prevents cross-facility deletion)
 * - Proper 404 handling for missing mappings
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { DELETE } from '../route'

// Mock dependencies
vi.mock('@/lib/supabase-server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/dal', () => ({
  epicDAL: {
    deleteEntityMapping: vi.fn(),
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
import { epicDAL } from '@/lib/dal'

beforeEach(() => {
  vi.clearAllMocks()
})

// Helper to create mock Supabase with user profile
function createMockSupabase(
  userProfile: { access_level: string; facility_id: string | null } | null,
  mappingData?: { id: string; facility_id: string } | null,
  deleteError?: { message: string } | null
) {
  const fromCalls: Record<string, ReturnType<typeof createChainable>> = {}

  function createChainable() {
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
      delete: vi.fn().mockReturnThis(),
    }
  }

  const usersChain = createChainable()
  usersChain.single.mockResolvedValue({
    data: userProfile,
    error: null,
  })

  const mappingsChain = createChainable()
  mappingsChain.single.mockResolvedValue({
    data: mappingData ?? null,
    error: mappingData === undefined ? { message: 'Not found' } : null,
  })

  fromCalls['users'] = usersChain
  fromCalls['epic_entity_mappings'] = mappingsChain

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: userProfile ? { id: 'user-1' } : null },
        error: userProfile ? null : new Error('Not authenticated'),
      }),
    },
    from: vi.fn((table: string) => fromCalls[table] || createChainable()),
  }
}

// Helper to create mock request
function createMockRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/epic/mappings/map-1', {
    method: 'DELETE',
  })
}

describe('DELETE /api/epic/mappings/:id — Security', () => {
  const mockContext = { params: Promise.resolve({ id: 'map-1' }) }

  it('rejects unauthenticated users', async () => {
    const mockSupabase = createMockSupabase(null)
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any)

    const req = createMockRequest()
    const response = await DELETE(req, mockContext)

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error).toBe('Must be logged in')
  })

  it('rejects non-admin users (viewer)', async () => {
    const mockSupabase = createMockSupabase({ access_level: 'viewer', facility_id: 'fac-1' })
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any)

    const req = createMockRequest()
    const response = await DELETE(req, mockContext)

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error).toBe('Only facility admins can delete entity mappings')
  })

  it('returns 404 when mapping not found', async () => {
    const mockSupabase = createMockSupabase(
      { access_level: 'facility_admin', facility_id: 'fac-1' },
      null // No mapping found
    )
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any)

    const req = createMockRequest()
    const response = await DELETE(req, mockContext)

    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body.error).toBe('Mapping not found')
  })

  it('rejects facility admin deleting mapping from another facility', async () => {
    const mockSupabase = createMockSupabase(
      { access_level: 'facility_admin', facility_id: 'fac-1' },
      { id: 'map-1', facility_id: 'fac-2' } // Mapping belongs to DIFFERENT facility
    )
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any)

    const req = createMockRequest()
    const response = await DELETE(req, mockContext)

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error).toBe('Cannot delete mappings from another facility')

    // Should NOT have called deleteEntityMapping
    expect(epicDAL.deleteEntityMapping).not.toHaveBeenCalled()
  })

  it('allows facility admin to delete mapping from own facility', async () => {
    const mockSupabase = createMockSupabase(
      { access_level: 'facility_admin', facility_id: 'fac-1' },
      { id: 'map-1', facility_id: 'fac-1' } // Same facility
    )
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any)
    vi.mocked(epicDAL.deleteEntityMapping).mockResolvedValue({ error: null })

    const req = createMockRequest()
    const response = await DELETE(req, mockContext)

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(epicDAL.deleteEntityMapping).toHaveBeenCalledWith(
      mockSupabase,
      'map-1'
    )
  })

  it('allows global admin to delete mapping from any facility', async () => {
    const mockSupabase = createMockSupabase(
      { access_level: 'global_admin', facility_id: null },
      { id: 'map-1', facility_id: 'fac-99' } // Any facility
    )
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any)
    vi.mocked(epicDAL.deleteEntityMapping).mockResolvedValue({ error: null })

    const req = createMockRequest()
    const response = await DELETE(req, mockContext)

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(epicDAL.deleteEntityMapping).toHaveBeenCalledWith(
      mockSupabase,
      'map-1'
    )
  })
})
