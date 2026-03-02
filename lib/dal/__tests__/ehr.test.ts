import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ehrDAL } from '../ehr'

// ============================================
// MOCK SUPABASE CLIENT
// ============================================

function createMockSupabase() {
  const chainable = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  }

  return {
    client: { from: vi.fn().mockReturnValue(chainable) },
    chainable,
  }
}

// ============================================
// EHR INTEGRATIONS
// ============================================

describe('ehrDAL.getIntegration', () => {
  it('should query ehr_integrations by id', async () => {
    const { client, chainable } = createMockSupabase()
    const mockIntegration = {
      id: 'int-1',
      facility_id: 'fac-1',
      integration_type: 'epic_hl7v2',
      display_name: 'Epic HL7v2',
      config: { api_key: 'test-key' },
      is_active: true,
      last_message_at: null,
      last_error: null,
      created_at: '2026-03-01T12:00:00Z',
      updated_at: '2026-03-01T12:00:00Z',
    }
    chainable.single.mockResolvedValue({ data: mockIntegration, error: null })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await ehrDAL.getIntegration(client as any, 'int-1')

    expect(client.from).toHaveBeenCalledWith('ehr_integrations')
    expect(chainable.eq).toHaveBeenCalledWith('id', 'int-1')
    expect(result.data).toEqual(mockIntegration)
    expect(result.error).toBeNull()
  })

  it('should return error when integration not found', async () => {
    const { client, chainable } = createMockSupabase()
    chainable.single.mockResolvedValue({
      data: null,
      error: { message: 'No rows returned', code: 'PGRST116' },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await ehrDAL.getIntegration(client as any, 'nonexistent')
    expect(result.data).toBeNull()
    expect(result.error).toBeTruthy()
  })
})

describe('ehrDAL.getIntegrationByFacility', () => {
  it('should query by facility_id and integration_type', async () => {
    const { client, chainable } = createMockSupabase()
    const mockIntegration = {
      id: 'int-1',
      facility_id: 'fac-1',
      integration_type: 'epic_hl7v2',
      display_name: 'Epic HL7v2',
      config: {},
      is_active: true,
      last_message_at: null,
      last_error: null,
      created_at: '2026-03-01T12:00:00Z',
      updated_at: '2026-03-01T12:00:00Z',
    }
    chainable.maybeSingle.mockResolvedValue({ data: mockIntegration, error: null })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await ehrDAL.getIntegrationByFacility(client as any, 'fac-1', 'epic_hl7v2')

    expect(client.from).toHaveBeenCalledWith('ehr_integrations')
    expect(chainable.eq).toHaveBeenCalledWith('facility_id', 'fac-1')
    expect(chainable.eq).toHaveBeenCalledWith('integration_type', 'epic_hl7v2')
    expect(result.data).toEqual(mockIntegration)
  })

  it('should return null when no integration exists for facility + type', async () => {
    const { client, chainable } = createMockSupabase()
    chainable.maybeSingle.mockResolvedValue({ data: null, error: null })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await ehrDAL.getIntegrationByFacility(
      client as any,
      'fac-1',
      'modmed_fhir'
    )
    expect(result.data).toBeNull()
  })
})

describe('ehrDAL.listIntegrations', () => {
  it('should list all integrations for a facility ordered by created_at desc', async () => {
    const { client, chainable } = createMockSupabase()
    const mockIntegrations = [
      {
        id: 'int-2',
        facility_id: 'fac-1',
        integration_type: 'csv_import',
        created_at: '2026-03-02T12:00:00Z',
      },
      {
        id: 'int-1',
        facility_id: 'fac-1',
        integration_type: 'epic_hl7v2',
        created_at: '2026-03-01T12:00:00Z',
      },
    ]
    // listIntegrations calls .order() which is the last method, so mock it
    chainable.order.mockResolvedValue({ data: mockIntegrations, error: null })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await ehrDAL.listIntegrations(client as any, 'fac-1')

    expect(client.from).toHaveBeenCalledWith('ehr_integrations')
    expect(chainable.eq).toHaveBeenCalledWith('facility_id', 'fac-1')
    expect(chainable.order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(result.data).toEqual(mockIntegrations)
  })

  it('should return empty array when no integrations exist', async () => {
    const { client, chainable } = createMockSupabase()
    chainable.order.mockResolvedValue({ data: null, error: null })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await ehrDAL.listIntegrations(client as any, 'fac-1')
    expect(result.data).toEqual([])
  })
})

describe('ehrDAL.upsertIntegration', () => {
  it('should upsert with onConflict facility_id,integration_type', async () => {
    const { client, chainable } = createMockSupabase()
    const insertPayload = {
      facility_id: 'fac-1',
      integration_type: 'epic_hl7v2' as const,
      display_name: 'Epic HL7v2',
      config: { api_key: 'new-key' },
      is_active: true,
    }
    chainable.single.mockResolvedValue({ data: { id: 'int-1', ...insertPayload }, error: null })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ehrDAL.upsertIntegration(client as any, insertPayload)

    expect(chainable.upsert).toHaveBeenCalledWith(insertPayload, {
      onConflict: 'facility_id,integration_type',
    })
    expect(chainable.select).toHaveBeenCalledWith('*')
  })
})

describe('ehrDAL.getIntegrationByApiKey', () => {
  it('should query config->>api_key using JSONB operator', async () => {
    const { client, chainable } = createMockSupabase()
    const mockIntegration = {
      id: 'int-1',
      facility_id: 'fac-1',
      integration_type: 'epic_hl7v2',
      config: { api_key: 'secret-key' },
      is_active: true,
    }
    chainable.maybeSingle.mockResolvedValue({ data: mockIntegration, error: null })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await ehrDAL.getIntegrationByApiKey(client as any, 'secret-key')

    expect(client.from).toHaveBeenCalledWith('ehr_integrations')
    expect(chainable.eq).toHaveBeenCalledWith('config->>api_key', 'secret-key')
    expect(chainable.eq).toHaveBeenCalledWith('is_active', true)
    expect(result.data).toEqual(mockIntegration)
  })

  it('should return null when API key not found', async () => {
    const { client, chainable } = createMockSupabase()
    chainable.maybeSingle.mockResolvedValue({ data: null, error: null })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await ehrDAL.getIntegrationByApiKey(client as any, 'nonexistent-key')
    expect(result.data).toBeNull()
  })

  it('should exclude inactive integrations', async () => {
    const { client, chainable } = createMockSupabase()
    chainable.maybeSingle.mockResolvedValue({ data: null, error: null })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ehrDAL.getIntegrationByApiKey(client as any, 'some-key')

    expect(chainable.eq).toHaveBeenCalledWith('is_active', true)
  })
})

// ============================================
// EHR INTEGRATION LOG
// ============================================

describe('ehrDAL.createLogEntry', () => {
  it('should insert a log entry and return the created row', async () => {
    const { client, chainable } = createMockSupabase()
    const logEntry = {
      facility_id: 'fac-1',
      integration_id: 'int-1',
      message_type: 'SIU_S12',
      message_control_id: 'MSG-001',
      raw_message: 'MSH|^~\\&|...',
      processing_status: 'received' as const,
    }
    chainable.single.mockResolvedValue({ data: { id: 'log-1', ...logEntry }, error: null })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await ehrDAL.createLogEntry(client as any, logEntry)

    expect(client.from).toHaveBeenCalledWith('ehr_integration_log')
    expect(chainable.insert).toHaveBeenCalledWith(logEntry)
    expect(result.data?.id).toBe('log-1')
  })
})

describe('ehrDAL.updateLogEntry', () => {
  it('should update log entry fields by id', async () => {
    const { client, chainable } = createMockSupabase()
    chainable.eq.mockResolvedValue({ error: null })

    const updates = {
      processing_status: 'processed' as const,
      case_id: 'case-123',
      processed_at: '2026-03-01T12:30:00Z',
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ehrDAL.updateLogEntry(client as any, 'log-1', updates)

    expect(chainable.update).toHaveBeenCalledWith(updates)
    expect(chainable.eq).toHaveBeenCalledWith('id', 'log-1')
  })
})

describe('ehrDAL.getLogEntry', () => {
  it('should fetch a single log entry by id', async () => {
    const { client, chainable } = createMockSupabase()
    const mockLog = {
      id: 'log-1',
      facility_id: 'fac-1',
      integration_id: 'int-1',
      message_type: 'SIU_S12',
      processing_status: 'processed',
    }
    chainable.single.mockResolvedValue({ data: mockLog, error: null })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await ehrDAL.getLogEntry(client as any, 'log-1')

    expect(chainable.eq).toHaveBeenCalledWith('id', 'log-1')
    expect(result.data).toEqual(mockLog)
  })
})

describe('ehrDAL.listLogEntries', () => {
  it('should list log entries for a facility', async () => {
    const { client, chainable } = createMockSupabase()
    const mockLogs = [
      { id: 'log-2', facility_id: 'fac-1', created_at: '2026-03-01T12:30:00Z' },
      { id: 'log-1', facility_id: 'fac-1', created_at: '2026-03-01T12:00:00Z' },
    ]
    // .order() is the last call in the basic path
    chainable.order.mockResolvedValue({ data: mockLogs, error: null, count: 2 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await ehrDAL.listLogEntries(client as any, 'fac-1')

    expect(chainable.select).toHaveBeenCalledWith('*', { count: 'exact' })
    expect(chainable.eq).toHaveBeenCalledWith('facility_id', 'fac-1')
    expect(chainable.order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(result.data).toEqual(mockLogs)
    expect(result.count).toBe(2)
  })

  it('should filter by status when provided', async () => {
    const { client, chainable } = createMockSupabase()
    // When status is provided, the chain goes: .order().eq()
    // So we need .eq() to resolve after .order() has been called
    let orderCalled = false
    chainable.order.mockImplementation(() => {
      orderCalled = true
      return chainable
    })
    chainable.eq.mockImplementation((field, value) => {
      if (orderCalled && field === 'processing_status') {
        return Promise.resolve({ data: [], error: null, count: 0 })
      }
      return chainable
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ehrDAL.listLogEntries(client as any, 'fac-1', { status: 'pending_review' })

    expect(chainable.eq).toHaveBeenCalledWith('processing_status', 'pending_review')
  })

  it('should filter by messageType when provided', async () => {
    const { client, chainable } = createMockSupabase()
    let orderCalled = false
    chainable.order.mockImplementation(() => {
      orderCalled = true
      return chainable
    })
    chainable.eq.mockImplementation((field, value) => {
      if (orderCalled && field === 'message_type') {
        return Promise.resolve({ data: [], error: null, count: 0 })
      }
      return chainable
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ehrDAL.listLogEntries(client as any, 'fac-1', { messageType: 'SIU_S12' })

    expect(chainable.eq).toHaveBeenCalledWith('message_type', 'SIU_S12')
  })

  it('should apply limit when provided', async () => {
    const { client, chainable } = createMockSupabase()
    chainable.limit.mockResolvedValue({ data: [], error: null, count: 0 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ehrDAL.listLogEntries(client as any, 'fac-1', { limit: 10 })

    expect(chainable.limit).toHaveBeenCalledWith(10)
  })

  it('should apply range for pagination when offset is provided', async () => {
    const { client, chainable } = createMockSupabase()
    chainable.range.mockResolvedValue({ data: [], error: null, count: 0 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ehrDAL.listLogEntries(client as any, 'fac-1', { offset: 10, limit: 25 })

    // offset: 10, limit: 25 → range(10, 34)
    expect(chainable.range).toHaveBeenCalledWith(10, 34)
  })
})

describe('ehrDAL.listPendingReviews', () => {
  it('should call listLogEntries with status=pending_review', async () => {
    const { client, chainable } = createMockSupabase()
    chainable.range.mockResolvedValue({ data: [], error: null, count: 0 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ehrDAL.listPendingReviews(client as any, 'fac-1', { limit: 10, offset: 0 })

    expect(chainable.eq).toHaveBeenCalledWith('processing_status', 'pending_review')
  })
})

describe('ehrDAL.checkDuplicateMessage', () => {
  it('should filter by integration_id and message_control_id', async () => {
    const { client, chainable } = createMockSupabase()
    const mockLog = {
      id: 'log-1',
      integration_id: 'int-1',
      message_control_id: 'MSG-001',
      processing_status: 'processed',
    }
    chainable.maybeSingle.mockResolvedValue({ data: mockLog, error: null })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await ehrDAL.checkDuplicateMessage(client as any, 'int-1', 'MSG-001')

    expect(chainable.eq).toHaveBeenCalledWith('integration_id', 'int-1')
    expect(chainable.eq).toHaveBeenCalledWith('message_control_id', 'MSG-001')
    expect(chainable.in).toHaveBeenCalledWith('processing_status', ['processed', 'pending_review'])
    expect(result.data).toEqual(mockLog)
  })

  it('should exclude received/error/ignored statuses', async () => {
    const { client, chainable } = createMockSupabase()
    chainable.maybeSingle.mockResolvedValue({ data: null, error: null })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ehrDAL.checkDuplicateMessage(client as any, 'int-1', 'MSG-001')

    expect(chainable.in).toHaveBeenCalledWith('processing_status', ['processed', 'pending_review'])
  })

  it('should return null when no duplicate exists', async () => {
    const { client, chainable } = createMockSupabase()
    chainable.maybeSingle.mockResolvedValue({ data: null, error: null })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await ehrDAL.checkDuplicateMessage(client as any, 'int-1', 'MSG-NEW')
    expect(result.data).toBeNull()
  })
})

// ============================================
// EHR ENTITY MAPPINGS
// ============================================

describe('ehrDAL.getEntityMapping', () => {
  it('should query by integration_id, entity_type, and external_identifier', async () => {
    const { client, chainable } = createMockSupabase()
    const mockMapping = {
      id: 'map-1',
      integration_id: 'int-1',
      entity_type: 'surgeon',
      external_identifier: 'NPI-12345',
      orbit_entity_id: 'user-123',
    }
    chainable.maybeSingle.mockResolvedValue({ data: mockMapping, error: null })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await ehrDAL.getEntityMapping(client as any, 'int-1', 'surgeon', 'NPI-12345')

    expect(chainable.eq).toHaveBeenCalledWith('integration_id', 'int-1')
    expect(chainable.eq).toHaveBeenCalledWith('entity_type', 'surgeon')
    expect(chainable.eq).toHaveBeenCalledWith('external_identifier', 'NPI-12345')
    expect(result.data).toEqual(mockMapping)
  })

  it('should return null when mapping does not exist', async () => {
    const { client, chainable } = createMockSupabase()
    chainable.maybeSingle.mockResolvedValue({ data: null, error: null })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await ehrDAL.getEntityMapping(client as any, 'int-1', 'surgeon', 'NPI-NONE')
    expect(result.data).toBeNull()
  })
})

describe('ehrDAL.saveEntityMapping', () => {
  it('should upsert with onConflict integration_id,entity_type,external_identifier', async () => {
    const { client, chainable } = createMockSupabase()
    const mappingPayload = {
      facility_id: 'fac-1',
      integration_id: 'int-1',
      entity_type: 'surgeon' as const,
      external_identifier: 'NPI-12345',
      external_display_name: 'Dr. Smith',
      orbit_entity_id: 'user-123',
      orbit_display_name: 'Dr. Smith',
      match_method: 'auto' as const,
      match_confidence: 0.95,
    }
    chainable.single.mockResolvedValue({ data: { id: 'map-1', ...mappingPayload }, error: null })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ehrDAL.saveEntityMapping(client as any, mappingPayload)

    expect(chainable.upsert).toHaveBeenCalledWith(mappingPayload, {
      onConflict: 'integration_id,entity_type,external_identifier',
    })
    expect(chainable.select).toHaveBeenCalledWith('*')
  })
})

describe('ehrDAL.listEntityMappings', () => {
  it('should list all mappings for an integration', async () => {
    const { client, chainable } = createMockSupabase()
    const mockMappings = [
      { id: 'map-1', integration_id: 'int-1', entity_type: 'surgeon', external_display_name: 'A' },
      { id: 'map-2', integration_id: 'int-1', entity_type: 'procedure', external_display_name: 'B' },
    ]
    chainable.order.mockResolvedValue({ data: mockMappings, error: null })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await ehrDAL.listEntityMappings(client as any, 'int-1')

    expect(chainable.eq).toHaveBeenCalledWith('integration_id', 'int-1')
    expect(chainable.order).toHaveBeenCalledWith('external_display_name', { ascending: true })
    expect(result.data).toEqual(mockMappings)
  })

  it('should filter by entity_type when provided', async () => {
    const { client, chainable} = createMockSupabase()
    // When entityType is provided, the chain goes: .order().eq()
    let orderCalled = false
    chainable.order.mockImplementation(() => {
      orderCalled = true
      return chainable
    })
    chainable.eq.mockImplementation((field, value) => {
      if (orderCalled && field === 'entity_type') {
        return Promise.resolve({ data: [], error: null })
      }
      return chainable
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ehrDAL.listEntityMappings(client as any, 'int-1', 'surgeon')

    expect(chainable.eq).toHaveBeenCalledWith('entity_type', 'surgeon')
  })

  it('should not filter by entity_type when omitted', async () => {
    const { client, chainable } = createMockSupabase()
    chainable.order.mockResolvedValue({ data: [], error: null })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ehrDAL.listEntityMappings(client as any, 'int-1')

    // Should be called once for integration_id, not entity_type
    expect(chainable.eq).toHaveBeenCalledTimes(1)
    expect(chainable.eq).toHaveBeenCalledWith('integration_id', 'int-1')
  })
})

describe('ehrDAL.deleteEntityMapping', () => {
  it('should delete mapping by id', async () => {
    const { client, chainable } = createMockSupabase()
    chainable.eq.mockResolvedValue({ error: null })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ehrDAL.deleteEntityMapping(client as any, 'map-1')

    expect(chainable.delete).toHaveBeenCalled()
    expect(chainable.eq).toHaveBeenCalledWith('id', 'map-1')
  })
})

// ============================================
// REVIEW QUEUE OPERATIONS
// ============================================

describe('ehrDAL.approveImport', () => {
  it('should update log to processed with case_id and reviewer', async () => {
    const { client, chainable } = createMockSupabase()
    chainable.eq.mockResolvedValue({ error: null })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await ehrDAL.approveImport(client as any, 'log-1', 'case-123', 'user-1')

    expect(client.from).toHaveBeenCalledWith('ehr_integration_log')
    expect(chainable.update).toHaveBeenCalledWith(
      expect.objectContaining({
        processing_status: 'processed',
        case_id: 'case-123',
        reviewed_by: 'user-1',
      })
    )
    expect(chainable.eq).toHaveBeenCalledWith('id', 'log-1')
    expect(result.error).toBeNull()
  })

  it('should set reviewed_at and processed_at timestamps', async () => {
    const { client, chainable } = createMockSupabase()
    chainable.eq.mockResolvedValue({ error: null })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ehrDAL.approveImport(client as any, 'log-1', 'case-123', 'user-1')

    const updateCall = chainable.update.mock.calls[0][0]
    expect(updateCall.reviewed_at).toBeDefined()
    expect(updateCall.processed_at).toBeDefined()
    // Both should be ISO date strings
    expect(new Date(updateCall.reviewed_at).toISOString()).toBe(updateCall.reviewed_at)
    expect(new Date(updateCall.processed_at).toISOString()).toBe(updateCall.processed_at)
  })

  it('should return error when update fails', async () => {
    const { client, chainable } = createMockSupabase()
    const mockError = { message: 'Update failed', code: '42501' }
    chainable.eq.mockResolvedValue({ error: mockError })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await ehrDAL.approveImport(client as any, 'log-1', 'case-123', 'user-1')
    expect(result.error).toEqual(mockError)
  })
})

describe('ehrDAL.rejectImport', () => {
  it('should update log to ignored with reason and reviewer', async () => {
    const { client, chainable } = createMockSupabase()
    chainable.eq.mockResolvedValue({ error: null })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await ehrDAL.rejectImport(client as any, 'log-1', 'Duplicate case', 'user-1')

    expect(client.from).toHaveBeenCalledWith('ehr_integration_log')
    expect(chainable.update).toHaveBeenCalledWith(
      expect.objectContaining({
        processing_status: 'ignored',
        error_message: 'Duplicate case',
        reviewed_by: 'user-1',
      })
    )
    expect(chainable.eq).toHaveBeenCalledWith('id', 'log-1')
    expect(result.error).toBeNull()
  })

  it('should set reviewed_at timestamp', async () => {
    const { client, chainable } = createMockSupabase()
    chainable.eq.mockResolvedValue({ error: null })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ehrDAL.rejectImport(client as any, 'log-1', 'Bad data', 'user-1')

    const updateCall = chainable.update.mock.calls[0][0]
    expect(updateCall.reviewed_at).toBeDefined()
    expect(new Date(updateCall.reviewed_at).toISOString()).toBe(updateCall.reviewed_at)
  })

  it('should return error when update fails', async () => {
    const { client, chainable } = createMockSupabase()
    const mockError = { message: 'Permission denied', code: '42501' }
    chainable.eq.mockResolvedValue({ error: mockError })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await ehrDAL.rejectImport(client as any, 'log-1', 'Reason', 'user-1')
    expect(result.error).toEqual(mockError)
  })
})

describe('ehrDAL.resolveEntity', () => {
  it('should save entity mapping and clear review_notes for resolved entity type', async () => {
    // resolveEntity makes 3 Supabase calls:
    // 1. upsert to ehr_entity_mappings (saveEntityMapping)
    // 2. select from ehr_integration_log (getLogEntry)
    // 3. update ehr_integration_log (clear review_notes)
    const callLog: Array<{ table: string; chain: Record<string, unknown> }> = []

    const makeChainable = () => {
      const c = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn(),
        maybeSingle: vi.fn(),
        upsert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
      }
      return c
    }

    let callCount = 0
    const chains = [makeChainable(), makeChainable(), makeChainable()]

    // Call 1 (saveEntityMapping → upsert): succeed
    chains[0].single.mockResolvedValue({
      data: { id: 'map-1', entity_type: 'surgeon' },
      error: null,
    })

    // Call 2 (getLogEntry → select/single): return log with review_notes
    chains[1].single.mockResolvedValue({
      data: {
        id: 'log-1',
        review_notes: {
          unmatched_surgeon: { identifier: 'NPI-12345', display_name: 'Dr. Smith' },
          unmatched_room: { identifier: 'OR-3', display_name: 'OR Room 3' },
        },
      },
      error: null,
    })

    // Call 3 (update review_notes): succeed
    chains[2].eq.mockResolvedValue({ error: null })

    const client = {
      from: vi.fn().mockImplementation((table: string) => {
        const chain = chains[callCount]
        callCount++
        callLog.push({ table, chain })
        return chain
      }),
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await ehrDAL.resolveEntity(
      client as any,
      'log-1', 'int-1', 'fac-1',
      'surgeon', 'NPI-12345', 'Dr. Smith',
      'user-123', 'Dr. Smith (ORbit)'
    )

    expect(result.error).toBeNull()

    // Verify call 1: upsert entity mapping
    expect(callLog[0].table).toBe('ehr_entity_mappings')
    expect(chains[0].upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        entity_type: 'surgeon',
        external_identifier: 'NPI-12345',
        orbit_entity_id: 'user-123',
        match_method: 'manual',
        match_confidence: 1.0,
      }),
      { onConflict: 'integration_id,entity_type,external_identifier' }
    )

    // Verify call 2: fetch log entry
    expect(callLog[1].table).toBe('ehr_integration_log')
    expect(chains[1].eq).toHaveBeenCalledWith('id', 'log-1')

    // Verify call 3: update review_notes (surgeon removed, room remains)
    expect(callLog[2].table).toBe('ehr_integration_log')
    expect(chains[2].update).toHaveBeenCalledWith({
      review_notes: {
        unmatched_room: { identifier: 'OR-3', display_name: 'OR Room 3' },
      },
    })
  })

  it('should return early with error if saveEntityMapping fails', async () => {
    const mappingChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Conflict', code: '23505' },
      }),
      upsert: vi.fn().mockReturnThis(),
    }

    const client = {
      from: vi.fn().mockReturnValue(mappingChain),
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await ehrDAL.resolveEntity(
      client as any,
      'log-1', 'int-1', 'fac-1',
      'surgeon', 'NPI-12345', 'Dr. Smith',
      'user-123', 'Dr. Smith'
    )

    expect(result.error).toEqual(expect.objectContaining({ message: 'Conflict' }))
    // Should only call from() once (for the upsert), not proceed to getLogEntry
    expect(client.from).toHaveBeenCalledTimes(1)
  })
})

// ============================================
// INTEGRATION STATS
// ============================================

describe('ehrDAL.getIntegrationStats', () => {
  it('should return counts for processed, pending, errors, and today', async () => {
    // getIntegrationStats makes 4 parallel queries via Promise.all
    // Each uses: from().select().eq().eq() or .gte()
    const makeStatsChain = (count: number) => {
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
      }
      // The last call in each chain resolves with count
      // For the first 3: .eq('processing_status', ...) is the terminal
      // For the 4th: .gte('created_at', ...) is the terminal
      chain.eq.mockReturnThis()
      chain.gte.mockResolvedValue({ error: null, count })
      return chain
    }

    let callCount = 0
    const counts = [42, 5, 3, 10]
    const chains = counts.map(c => makeStatsChain(c))

    // For the first 3 chains, the terminal call is the second .eq()
    // We need to track call count per chain to make the 2nd eq() resolve
    for (let i = 0; i < 3; i++) {
      let eqCallCount = 0
      chains[i].eq.mockImplementation(() => {
        eqCallCount++
        // First eq is facility_id, second eq is processing_status (terminal)
        if (eqCallCount >= 2) {
          return Promise.resolve({ error: null, count: counts[i] })
        }
        return chains[i]
      })
    }

    // Chain 4: terminal is .gte()
    let chain4EqCount = 0
    chains[3].eq.mockImplementation(() => {
      chain4EqCount++
      return chains[3]
    })
    chains[3].gte.mockResolvedValue({ error: null, count: counts[3] })

    const client = {
      from: vi.fn().mockImplementation(() => {
        const chain = chains[callCount]
        callCount++
        return chain
      }),
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await ehrDAL.getIntegrationStats(client as any, 'fac-1')

    expect(result.data).toEqual({
      totalProcessed: 42,
      pendingReview: 5,
      errors: 3,
      messagesToday: 10,
    })
    expect(result.error).toBeNull()
    expect(client.from).toHaveBeenCalledTimes(4)
  })

  it('should return first error if any query fails', async () => {
    const errorChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
    }

    let callCount = 0
    const mockError = { message: 'Connection failed', code: '08006' }

    const client = {
      from: vi.fn().mockImplementation(() => {
        callCount++
        const chain = { ...errorChain }
        let eqCallCount = 0
        chain.eq = vi.fn().mockImplementation(() => {
          eqCallCount++
          // After second .eq() call on first query, return error
          if (callCount === 1 && eqCallCount === 2) {
            return Promise.resolve({ error: mockError, count: null })
          }
          // Otherwise return chain for continued chaining
          return chain
        })
        chain.gte = vi.fn().mockResolvedValue({ error: null, count: 0 })
        chain.select = vi.fn().mockReturnValue(chain)
        return chain
      }),
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await ehrDAL.getIntegrationStats(client as any, 'fac-1')
    expect(result.error).toEqual(mockError)
  })
})
