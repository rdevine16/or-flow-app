// app/admin/facilities/new/__tests__/actions.test.ts
// Direct unit tests for createFacilityWithTemplates submission logic

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createFacilityWithTemplates } from '../actions'
import type { CreateFacilityParams } from '../actions'
import { DEFAULT_FACILITY_DATA, DEFAULT_ADMIN_DATA, DEFAULT_TEMPLATE_CONFIG } from '../types'
import type { FacilityData, AdminData, TemplateConfig } from '../types'

// Mock audit logger
const mockAuditCreated = vi.fn()
vi.mock('@/lib/audit-logger', () => ({
  facilityAudit: {
    created: (...args: unknown[]) => mockAuditCreated(...args),
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

// ============================================================================
// HELPERS
// ============================================================================

const VALID_FACILITY: FacilityData = {
  ...DEFAULT_FACILITY_DATA,
  name: 'Pacific Surgery Center',
  facilityType: 'asc',
  phone: '(555) 123-4567',
  streetAddress: '123 Main St',
  streetAddress2: 'Suite 200',
  city: 'Seattle',
  state: 'WA',
  zipCode: '98101',
  timezone: 'America/Los_Angeles',
  subscriptionStatus: 'trial',
  trialDays: 30,
}

const VALID_ADMIN: AdminData = {
  firstName: 'Jane',
  lastName: 'Smith',
  email: 'jane.smith@hospital.com',
  roleId: 'role-1',
}

function createMockSupabase(overrides: {
  insertError?: { message: string }
  insertData?: { id: string }
  rpcError?: { message: string }
  sessionToken?: string
} = {}) {
  const mockSingle = vi.fn().mockResolvedValue({
    data: overrides.insertData ?? { id: 'new-facility-id' },
    error: overrides.insertError ?? null,
  })
  const mockSelect = vi.fn().mockReturnValue({ single: mockSingle })
  const mockInsert = vi.fn().mockReturnValue({ select: mockSelect })
  const mockRpc = vi.fn().mockResolvedValue({
    error: overrides.rpcError ?? null,
  })
  const mockGetSession = vi.fn().mockResolvedValue({
    data: { session: { access_token: overrides.sessionToken ?? 'test-token' } },
  })

  return {
    client: {
      from: vi.fn().mockReturnValue({ insert: mockInsert }),
      rpc: mockRpc,
      auth: { getSession: mockGetSession },
    },
    mocks: { mockInsert, mockSelect, mockSingle, mockRpc, mockGetSession },
  }
}

function createParams(overrides: Partial<CreateFacilityParams> = {}): CreateFacilityParams {
  const { client } = createMockSupabase()
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: client as any,
    facilityData: VALID_FACILITY,
    adminData: VALID_ADMIN,
    templateConfig: DEFAULT_TEMPLATE_CONFIG,
    sendWelcomeEmail: true,
    ...overrides,
  }
}

// ============================================================================
// TESTS
// ============================================================================

describe('createFacilityWithTemplates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock global fetch for invite API
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    })
  })

  // ============================================================================
  // SUCCESSFUL CREATION
  // ============================================================================

  describe('Successful Creation', () => {
    it('returns success with facility ID', async () => {
      const params = createParams()
      const result = await createFacilityWithTemplates(params)

      expect(result.success).toBe(true)
      expect(result.facilityId).toBe('new-facility-id')
      expect(result.error).toBeUndefined()
    })

    it('inserts facility with correct data', async () => {
      const { client, mocks } = createMockSupabase()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const params = createParams({ supabase: client as any })

      await createFacilityWithTemplates(params)

      expect(client.from).toHaveBeenCalledWith('facilities')
      expect(mocks.mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Pacific Surgery Center',
          facility_type: 'asc',
          phone: '5551234567',
          street_address: '123 Main St',
          street_address_2: 'Suite 200',
          city: 'Seattle',
          state: 'WA',
          zip_code: '98101',
          timezone: 'America/Los_Angeles',
          subscription_status: 'trial',
        }),
      )
    })

    it('trims whitespace from name', async () => {
      const { client, mocks } = createMockSupabase()
      const params = createParams({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        supabase: client as any,
        facilityData: { ...VALID_FACILITY, name: '  Pacific Surgery Center  ' },
      })

      await createFacilityWithTemplates(params)

      expect(mocks.mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Pacific Surgery Center' }),
      )
    })

    it('strips non-digit characters from phone', async () => {
      const { client, mocks } = createMockSupabase()
      const params = createParams({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        supabase: client as any,
        facilityData: { ...VALID_FACILITY, phone: '(555) 123-4567' },
      })

      await createFacilityWithTemplates(params)

      expect(mocks.mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({ phone: '5551234567' }),
      )
    })

    it('sets null for empty optional fields', async () => {
      const { client, mocks } = createMockSupabase()
      const params = createParams({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        supabase: client as any,
        facilityData: {
          ...VALID_FACILITY,
          phone: '',
          streetAddress: '',
          streetAddress2: '',
          city: '',
          state: '',
          zipCode: '',
        },
      })

      await createFacilityWithTemplates(params)

      expect(mocks.mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          phone: null,
          street_address: null,
          street_address_2: null,
          city: null,
          state: null,
          zip_code: null,
        }),
      )
    })

    it('sets trial_ends_at for trial subscriptions', async () => {
      const { client, mocks } = createMockSupabase()
      const params = createParams({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        supabase: client as any,
        facilityData: { ...VALID_FACILITY, subscriptionStatus: 'trial', trialDays: 30 },
      })

      await createFacilityWithTemplates(params)

      const insertCall = mocks.mockInsert.mock.calls[0][0]
      expect(insertCall.trial_ends_at).toBeTruthy()
      // Trial end date should be ~30 days from now
      const trialEnd = new Date(insertCall.trial_ends_at)
      const now = new Date()
      const diffDays = (trialEnd.getTime() - now.getTime()) / 86400000
      expect(diffDays).toBeGreaterThan(29)
      expect(diffDays).toBeLessThan(31)
    })

    it('sets null trial_ends_at for active subscriptions', async () => {
      const { client, mocks } = createMockSupabase()
      const params = createParams({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        supabase: client as any,
        facilityData: { ...VALID_FACILITY, subscriptionStatus: 'active' },
      })

      await createFacilityWithTemplates(params)

      expect(mocks.mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({ trial_ends_at: null }),
      )
    })
  })

  // ============================================================================
  // RPC CALL
  // ============================================================================

  describe('RPC Call', () => {
    it('calls seed_facility_with_templates RPC with correct parameters', async () => {
      const { client, mocks } = createMockSupabase()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const params = createParams({ supabase: client as any })

      await createFacilityWithTemplates(params)

      expect(mocks.mockRpc).toHaveBeenCalledWith('seed_facility_with_templates', {
        target_facility_id: 'new-facility-id',
        template_config: {
          milestones: true,
          procedures: true,
          procedure_milestone_config: true,
          delay_types: true,
          cancellation_reasons: true,
          complexities: true,
          preop_checklist_fields: true,
          cost_categories: true,
          implant_companies: true,
          payers: true,
          analytics_settings: true,
          flag_rules: true,
          phase_definitions: true,
          notification_settings: true,
        },
      })
    })

    it('passes correct template config when some templates are disabled', async () => {
      const { client, mocks } = createMockSupabase()
      const customConfig: TemplateConfig = {
        ...DEFAULT_TEMPLATE_CONFIG,
        milestones: false,
        flagRules: false,
        payers: false,
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const params = createParams({ supabase: client as any, templateConfig: customConfig })

      await createFacilityWithTemplates(params)

      expect(mocks.mockRpc).toHaveBeenCalledWith(
        'seed_facility_with_templates',
        expect.objectContaining({
          template_config: expect.objectContaining({
            milestones: false,
            flag_rules: false,
            payers: false,
            procedures: true,
          }),
        }),
      )
    })
  })

  // ============================================================================
  // INVITE EMAIL
  // ============================================================================

  describe('Invite Email', () => {
    it('sends invite email when sendWelcomeEmail is true', async () => {
      const params = createParams({ sendWelcomeEmail: true })
      await createFacilityWithTemplates(params)

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/invite',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: expect.stringContaining('jane.smith@hospital.com'),
        }),
      )
    })

    it('includes correct admin data in invite payload', async () => {
      const params = createParams({ sendWelcomeEmail: true })
      await createFacilityWithTemplates(params)

      const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
      const body = JSON.parse(fetchCall[1].body)
      expect(body).toEqual(
        expect.objectContaining({
          email: 'jane.smith@hospital.com',
          firstName: 'Jane',
          lastName: 'Smith',
          accessLevel: 'facility_admin',
          facilityId: 'new-facility-id',
          roleId: 'role-1',
        }),
      )
    })

    it('does not send invite when sendWelcomeEmail is false', async () => {
      const params = createParams({ sendWelcomeEmail: false })
      await createFacilityWithTemplates(params)

      expect(global.fetch).not.toHaveBeenCalled()
    })

    it('returns inviteWarning when invite fails', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Email service unavailable' }),
      })

      const params = createParams({ sendWelcomeEmail: true })
      const result = await createFacilityWithTemplates(params)

      expect(result.success).toBe(true) // Facility still created
      expect(result.inviteWarning).toBe('Email service unavailable')
    })

    it('returns inviteWarning when invite throws an exception', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

      const params = createParams({ sendWelcomeEmail: true })
      const result = await createFacilityWithTemplates(params)

      expect(result.success).toBe(true) // Facility still created
      expect(result.inviteWarning).toBe('Failed to send invitation email')
    })
  })

  // ============================================================================
  // AUDIT LOG
  // ============================================================================

  describe('Audit Log', () => {
    it('logs facility created audit event', async () => {
      const params = createParams()
      await createFacilityWithTemplates(params)

      expect(mockAuditCreated).toHaveBeenCalledWith(
        expect.anything(), // supabase client
        'Pacific Surgery Center',
        'new-facility-id',
      )
    })
  })

  // ============================================================================
  // ERROR HANDLING
  // ============================================================================

  describe('Error Handling', () => {
    it('returns error when facility insert fails', async () => {
      const { client } = createMockSupabase({ insertError: { message: 'Duplicate name' } })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const params = createParams({ supabase: client as any })

      const result = await createFacilityWithTemplates(params)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Duplicate name')
    })

    it('returns error when facility insert returns null data', async () => {
      const mockSingle = vi.fn().mockResolvedValue({ data: null, error: null })
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle })
      const mockInsert = vi.fn().mockReturnValue({ select: mockSelect })
      const client = {
        from: vi.fn().mockReturnValue({ insert: mockInsert }),
        rpc: vi.fn(),
        auth: { getSession: vi.fn() },
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const params = createParams({ supabase: client as any })

      const result = await createFacilityWithTemplates(params)

      expect(result.success).toBe(false)
    })

    it('returns error when RPC fails', async () => {
      const { client } = createMockSupabase({
        rpcError: { message: 'Template seeding failed' },
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const params = createParams({ supabase: client as any })

      const result = await createFacilityWithTemplates(params)

      expect(result.success).toBe(false)
      expect(result.facilityId).toBe('new-facility-id') // Facility was created
      expect(result.error).toContain('template seeding failed')
    })

    it('does not call RPC when facility insert fails', async () => {
      const { client, mocks } = createMockSupabase({
        insertError: { message: 'Insert failed' },
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const params = createParams({ supabase: client as any })

      await createFacilityWithTemplates(params)

      expect(mocks.mockRpc).not.toHaveBeenCalled()
    })

    it('does not send invite when RPC fails', async () => {
      const { client } = createMockSupabase({
        rpcError: { message: 'RPC failed' },
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const params = createParams({ supabase: client as any })

      await createFacilityWithTemplates(params)

      expect(global.fetch).not.toHaveBeenCalled()
    })

    it('catches unexpected exceptions and returns error', async () => {
      const client = {
        from: vi.fn().mockImplementation(() => {
          throw new Error('Unexpected crash')
        }),
        rpc: vi.fn(),
        auth: { getSession: vi.fn() },
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const params = createParams({ supabase: client as any })

      const result = await createFacilityWithTemplates(params)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Unexpected crash')
    })
  })
})
