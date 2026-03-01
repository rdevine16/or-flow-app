/**
 * Auto-Match Route Tests
 *
 * Tests for POST /api/epic/mappings/auto-match
 * - Authorization (facility admin only)
 * - Facility access validation
 * - Single mapping type vs all types
 * - Integration with auto-matcher functions
 * - Audit logging
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '../route'

// Mock all dependencies
vi.mock('@/lib/supabase-server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/dal', () => ({
  epicDAL: {
    getConnection: vi.fn(),
  },
  facilitiesDAL: {
    getRooms: vi.fn(),
  },
  usersDAL: {
    listSurgeons: vi.fn(),
  },
  lookupsDAL: {
    procedureTypes: vi.fn(),
  },
}))

vi.mock('@/lib/epic/auto-matcher', () => ({
  autoMatchSurgeons: vi.fn(),
  autoMatchRooms: vi.fn(),
  autoMatchProcedures: vi.fn(),
}))

vi.mock('@/lib/audit-logger', () => ({
  epicAudit: {
    autoMatchRun: vi.fn(),
  },
}))

import { createClient } from '@/lib/supabase-server'
import { epicDAL, facilitiesDAL, usersDAL, lookupsDAL } from '@/lib/dal'
import { autoMatchSurgeons, autoMatchRooms, autoMatchProcedures } from '@/lib/epic/auto-matcher'
import { epicAudit } from '@/lib/audit-logger'

beforeEach(() => {
  vi.clearAllMocks()
})

// Helper to create a mock request
function createMockRequest(body: Record<string, unknown>) {
  return {
    json: async () => body,
  } as NextRequest
}

// Helper to create a mock Supabase client
function createMockSupabase(user: any, userProfile: any) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error: null,
      }),
    },
    from: vi.fn((table: string) => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: userProfile,
        error: null,
      }),
    })),
  }
}

describe('POST /api/epic/mappings/auto-match', () => {
  it('rejects unauthenticated requests', async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: new Error('Not authenticated'),
        }),
      },
    }

    vi.mocked(createClient).mockResolvedValue(mockSupabase as any)

    const req = createMockRequest({ facility_id: 'fac-1' })
    const response = await POST(req)

    expect(response.status).toBe(403) // AuthorizationError returns 403
    const body = await response.json()
    expect(body.error).toBe('Must be logged in')
  })

  it('rejects non-admin users', async () => {
    const mockSupabase = createMockSupabase(
      { id: 'user-1' },
      { access_level: 'viewer', facility_id: 'fac-1', email: 'viewer@test.com' }
    )

    vi.mocked(createClient).mockResolvedValue(mockSupabase as any)

    const req = createMockRequest({ facility_id: 'fac-1' })
    const response = await POST(req)

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error).toBe('Only facility admins can run auto-matching')
  })

  it('rejects facility admin accessing another facility', async () => {
    const mockSupabase = createMockSupabase(
      { id: 'user-1' },
      { access_level: 'facility_admin', facility_id: 'fac-1', email: 'admin@test.com' }
    )

    vi.mocked(createClient).mockResolvedValue(mockSupabase as any)

    const req = createMockRequest({ facility_id: 'fac-2' }) // Different facility
    const response = await POST(req)

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error).toBe('Cannot run auto-matching for another facility')
  })

  it('allows global admin to access any facility', async () => {
    const mockSupabase = createMockSupabase(
      { id: 'user-1' },
      { access_level: 'global_admin', facility_id: null, email: 'admin@orbit.com' }
    )

    vi.mocked(createClient).mockResolvedValue(mockSupabase as any)
    vi.mocked(epicDAL.getConnection).mockResolvedValue({
      data: { id: 'conn-1', fhir_base_url: 'https://fhir.epic.com', status: 'connected' } as any,
      error: null,
    })
    vi.mocked(usersDAL.listSurgeons).mockResolvedValue({ data: [], error: null })
    vi.mocked(facilitiesDAL.getRooms).mockResolvedValue({ data: [], error: null })
    vi.mocked(lookupsDAL.procedureTypes).mockResolvedValue({ data: [], error: null })
    vi.mocked(autoMatchSurgeons).mockResolvedValue({
      mappingType: 'surgeon',
      autoApplied: 0,
      suggested: 0,
      skipped: 0,
      results: [],
    })
    vi.mocked(autoMatchRooms).mockResolvedValue({
      mappingType: 'room',
      autoApplied: 0,
      suggested: 0,
      skipped: 0,
      results: [],
    })
    vi.mocked(autoMatchProcedures).mockResolvedValue({
      mappingType: 'procedure',
      autoApplied: 0,
      suggested: 0,
      skipped: 0,
      results: [],
    })
    vi.mocked(epicAudit.autoMatchRun).mockResolvedValue(undefined as any)

    const req = createMockRequest({ facility_id: 'fac-2' })
    const response = await POST(req)

    expect(response.status).toBe(200)
  })

  it('returns 400 if facility_id is missing', async () => {
    const mockSupabase = createMockSupabase(
      { id: 'user-1' },
      { access_level: 'facility_admin', facility_id: 'fac-1', email: 'admin@test.com' }
    )

    vi.mocked(createClient).mockResolvedValue(mockSupabase as any)

    const req = createMockRequest({}) // No facility_id
    const response = await POST(req)

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe('facility_id is required')
  })

  it('returns 404 if no Epic connection exists', async () => {
    const mockSupabase = createMockSupabase(
      { id: 'user-1' },
      { access_level: 'facility_admin', facility_id: 'fac-1', email: 'admin@test.com' }
    )

    vi.mocked(createClient).mockResolvedValue(mockSupabase as any)
    vi.mocked(epicDAL.getConnection).mockResolvedValue({
      data: null,
      error: null,
    })

    const req = createMockRequest({ facility_id: 'fac-1' })
    const response = await POST(req)

    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body.error).toBe('No Epic connection found')
  })

  it('runs auto-match for a single mapping type when specified', async () => {
    const mockSupabase = createMockSupabase(
      { id: 'user-1' },
      { access_level: 'facility_admin', facility_id: 'fac-1', email: 'admin@test.com' }
    )

    vi.mocked(createClient).mockResolvedValue(mockSupabase as any)
    vi.mocked(epicDAL.getConnection).mockResolvedValue({
      data: { id: 'conn-1', fhir_base_url: 'https://fhir.epic.com', status: 'connected' } as any,
      error: null,
    })
    vi.mocked(usersDAL.listSurgeons).mockResolvedValue({
      data: [
        { id: 'surg-1', first_name: 'John', last_name: 'Smith', closing_workflow: null, closing_handoff_minutes: null },
      ],
      error: null,
    })
    vi.mocked(facilitiesDAL.getRooms).mockResolvedValue({ data: [], error: null })
    vi.mocked(lookupsDAL.procedureTypes).mockResolvedValue({ data: [], error: null })
    vi.mocked(autoMatchSurgeons).mockResolvedValue({
      mappingType: 'surgeon',
      autoApplied: 3,
      suggested: 2,
      skipped: 1,
      results: [],
    })

    const req = createMockRequest({ facility_id: 'fac-1', mapping_type: 'surgeon' })
    const response = await POST(req)

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].mappingType).toBe('surgeon')
    expect(body.data[0].autoApplied).toBe(3)

    // Only autoMatchSurgeons should have been called, not rooms or procedures
    expect(autoMatchSurgeons).toHaveBeenCalledTimes(1)
    expect(autoMatchRooms).not.toHaveBeenCalled()
    expect(autoMatchProcedures).not.toHaveBeenCalled()
  })

  it('runs auto-match for all mapping types when type is not specified', async () => {
    const mockSupabase = createMockSupabase(
      { id: 'user-1' },
      { access_level: 'facility_admin', facility_id: 'fac-1', email: 'admin@test.com' }
    )

    vi.mocked(createClient).mockResolvedValue(mockSupabase as any)
    vi.mocked(epicDAL.getConnection).mockResolvedValue({
      data: { id: 'conn-1', fhir_base_url: 'https://fhir.epic.com', status: 'connected' } as any,
      error: null,
    })
    vi.mocked(usersDAL.listSurgeons).mockResolvedValue({
      data: [{ id: 'surg-1', first_name: 'John', last_name: 'Smith', closing_workflow: null, closing_handoff_minutes: null }],
      error: null,
    })
    vi.mocked(facilitiesDAL.getRooms).mockResolvedValue({
      data: [{ id: 'room-1', name: 'OR 1', display_order: 1, is_active: true }],
      error: null,
    })
    vi.mocked(lookupsDAL.procedureTypes).mockResolvedValue({
      data: [{ id: 'proc-1', name: 'Knee Replacement', category: null, body_region: null, is_active: true }],
      error: null,
    })
    vi.mocked(autoMatchSurgeons).mockResolvedValue({
      mappingType: 'surgeon',
      autoApplied: 1,
      suggested: 0,
      skipped: 0,
      results: [],
    })
    vi.mocked(autoMatchRooms).mockResolvedValue({
      mappingType: 'room',
      autoApplied: 2,
      suggested: 0,
      skipped: 0,
      results: [],
    })
    vi.mocked(autoMatchProcedures).mockResolvedValue({
      mappingType: 'procedure',
      autoApplied: 1,
      suggested: 1,
      skipped: 0,
      results: [],
    })

    const req = createMockRequest({ facility_id: 'fac-1' }) // No mapping_type
    const response = await POST(req)

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.data).toHaveLength(3)
    expect(body.data.map((r: any) => r.mappingType)).toEqual(['surgeon', 'room', 'procedure'])

    // All three auto-match functions should have been called
    expect(autoMatchSurgeons).toHaveBeenCalledTimes(1)
    expect(autoMatchRooms).toHaveBeenCalledTimes(1)
    expect(autoMatchProcedures).toHaveBeenCalledTimes(1)
  })

  it('logs audit events for each mapping type', async () => {
    const mockSupabase = createMockSupabase(
      { id: 'user-1' },
      { access_level: 'facility_admin', facility_id: 'fac-1', email: 'admin@test.com' }
    )

    vi.mocked(createClient).mockResolvedValue(mockSupabase as any)
    vi.mocked(epicDAL.getConnection).mockResolvedValue({
      data: { id: 'conn-1', fhir_base_url: 'https://fhir.epic.com', status: 'connected' } as any,
      error: null,
    })
    vi.mocked(usersDAL.listSurgeons).mockResolvedValue({ data: [], error: null })
    vi.mocked(facilitiesDAL.getRooms).mockResolvedValue({ data: [], error: null })
    vi.mocked(lookupsDAL.procedureTypes).mockResolvedValue({ data: [], error: null })
    vi.mocked(autoMatchSurgeons).mockResolvedValue({
      mappingType: 'surgeon',
      autoApplied: 3,
      suggested: 2,
      skipped: 1,
      results: [],
    })
    vi.mocked(autoMatchRooms).mockResolvedValue({
      mappingType: 'room',
      autoApplied: 1,
      suggested: 0,
      skipped: 0,
      results: [],
    })
    vi.mocked(autoMatchProcedures).mockResolvedValue({
      mappingType: 'procedure',
      autoApplied: 2,
      suggested: 1,
      skipped: 0,
      results: [],
    })

    const req = createMockRequest({ facility_id: 'fac-1' })
    const response = await POST(req)

    expect(response.status).toBe(200)

    // Verify audit logging was called for each mapping type
    expect(epicAudit.autoMatchRun).toHaveBeenCalledTimes(3)
    expect(epicAudit.autoMatchRun).toHaveBeenCalledWith(
      mockSupabase,
      'fac-1',
      'surgeon',
      3,
      2
    )
    expect(epicAudit.autoMatchRun).toHaveBeenCalledWith(
      mockSupabase,
      'fac-1',
      'room',
      1,
      0
    )
    expect(epicAudit.autoMatchRun).toHaveBeenCalledWith(
      mockSupabase,
      'fac-1',
      'procedure',
      2,
      1
    )
  })

  it('passes correct entity data to auto-match functions', async () => {
    const mockSupabase = createMockSupabase(
      { id: 'user-1' },
      { access_level: 'facility_admin', facility_id: 'fac-1', email: 'admin@test.com' }
    )

    vi.mocked(createClient).mockResolvedValue(mockSupabase as any)
    vi.mocked(epicDAL.getConnection).mockResolvedValue({
      data: { id: 'conn-1', fhir_base_url: 'https://fhir.epic.com', status: 'connected' } as any,
      error: null,
    })

    const mockSurgeons = [
      { id: 'surg-1', first_name: 'John', last_name: 'Smith', closing_workflow: null, closing_handoff_minutes: null },
      { id: 'surg-2', first_name: 'Jane', last_name: 'Doe', closing_workflow: null, closing_handoff_minutes: null },
    ]
    const mockRooms = [
      { id: 'room-1', name: 'OR 1' },
      { id: 'room-2', name: 'OR 2' },
    ]
    const mockProcedures = [
      { id: 'proc-1', name: 'Knee Replacement' },
    ]

    vi.mocked(usersDAL.listSurgeons).mockResolvedValue({ data: mockSurgeons as any, error: null })
    vi.mocked(facilitiesDAL.getRooms).mockResolvedValue({ data: mockRooms as any, error: null })
    vi.mocked(lookupsDAL.procedureTypes).mockResolvedValue({ data: mockProcedures as any, error: null })
    vi.mocked(autoMatchSurgeons).mockResolvedValue({
      mappingType: 'surgeon',
      autoApplied: 0,
      suggested: 0,
      skipped: 0,
      results: [],
    })

    const req = createMockRequest({ facility_id: 'fac-1', mapping_type: 'surgeon' })
    await POST(req)

    // Verify surgeons were passed with correct structure
    expect(autoMatchSurgeons).toHaveBeenCalledWith(
      mockSupabase,
      'conn-1',
      'fac-1',
      [
        { id: 'surg-1', first_name: 'John', last_name: 'Smith' },
        { id: 'surg-2', first_name: 'Jane', last_name: 'Doe' },
      ]
    )
  })
})
