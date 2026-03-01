import { describe, it, expect, vi, beforeEach } from 'vitest'
import { epicDAL } from '../epic'

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
// EPIC CONNECTIONS
// ============================================

describe('epicDAL.getConnection', () => {
  it('should query epic_connections by facility_id', async () => {
    const { client, chainable } = createMockSupabase()
    const mockConnection = {
      id: 'conn-1',
      facility_id: 'fac-1',
      status: 'connected',
      fhir_base_url: 'https://fhir.epic.com',
      client_id: 'test-client',
    }
    chainable.single.mockResolvedValue({ data: mockConnection, error: null })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await epicDAL.getConnection(client as any, 'fac-1')

    expect(client.from).toHaveBeenCalledWith('epic_connections')
    expect(chainable.eq).toHaveBeenCalledWith('facility_id', 'fac-1')
    expect(result.data).toEqual(mockConnection)
    expect(result.error).toBeNull()
  })

  it('should return error when connection not found', async () => {
    const { client, chainable } = createMockSupabase()
    chainable.single.mockResolvedValue({
      data: null,
      error: { message: 'No rows returned', code: 'PGRST116' },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await epicDAL.getConnection(client as any, 'nonexistent')
    expect(result.data).toBeNull()
    expect(result.error).toBeTruthy()
  })
})

describe('epicDAL.getConnectionStatus', () => {
  it('should call RPC with facility_id parameter', async () => {
    const mockStatus = {
      id: 'conn-1',
      status: 'connected',
      last_connected_at: '2026-03-01T12:00:00Z',
      connected_by: 'user-1',
      token_expires_at: '2026-03-01T13:00:00Z',
      fhir_base_url: 'https://fhir.epic.com',
    }
    const rpcChain = {
      single: vi.fn().mockResolvedValue({ data: mockStatus, error: null }),
    }
    const client = {
      rpc: vi.fn().mockReturnValue(rpcChain),
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await epicDAL.getConnectionStatus(client as any, 'fac-1')

    expect(client.rpc).toHaveBeenCalledWith('get_epic_connection_status', { p_facility_id: 'fac-1' })
    expect(result.data).toEqual(mockStatus)
  })
})

describe('epicDAL.upsertConnection', () => {
  it('should upsert with onConflict facility_id', async () => {
    const { client, chainable } = createMockSupabase()
    chainable.single.mockResolvedValue({ data: { id: 'conn-1' }, error: null })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await epicDAL.upsertConnection(client as any, 'fac-1', {
      fhir_base_url: 'https://fhir.epic.com',
      client_id: 'test-client',
    })

    expect(chainable.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ facility_id: 'fac-1', fhir_base_url: 'https://fhir.epic.com' }),
      { onConflict: 'facility_id' }
    )
  })
})

// ============================================
// EPIC ENTITY MAPPINGS
// ============================================

describe('epicDAL.listEntityMappings', () => {
  it('should list all entity mappings for a connection', async () => {
    const { client, chainable } = createMockSupabase()
    const mockMappings = [
      { id: 'map-1', mapping_type: 'surgeon', epic_display_name: 'Dr. Smith' },
      { id: 'map-2', mapping_type: 'room', epic_display_name: 'OR 1' },
    ]
    // When there's no .single(), order returns the final result
    chainable.order.mockResolvedValue({ data: mockMappings, error: null })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await epicDAL.listEntityMappings(client as any, 'conn-1')

    expect(client.from).toHaveBeenCalledWith('epic_entity_mappings')
    expect(chainable.eq).toHaveBeenCalledWith('connection_id', 'conn-1')
    expect(result.data).toEqual(mockMappings)
  })

  it('should filter by mapping_type when provided', async () => {
    // Need a fresh mock where order returns this and the final eq resolves
    const chainable2 = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
    }
    // When mapping_type is provided, the chain is: from → select → eq(connection_id) → order → eq(mapping_type)
    // The last eq must resolve
    let eqCallCount = 0
    chainable2.eq.mockImplementation(() => {
      eqCallCount++
      // Third eq call is mapping_type - this resolves the promise
      if (eqCallCount >= 3) {
        return Promise.resolve({ data: [], error: null })
      }
      return chainable2
    })

    const client2 = { from: vi.fn().mockReturnValue(chainable2) }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await epicDAL.listEntityMappings(client2 as any, 'conn-1', 'surgeon')

    expect(chainable2.eq).toHaveBeenCalledWith('connection_id', 'conn-1')
    expect(chainable2.eq).toHaveBeenCalledWith('mapping_type', 'surgeon')
  })
})

// ============================================
// EPIC FIELD MAPPINGS
// ============================================

describe('epicDAL.listFieldMappings', () => {
  it('should list all field mappings ordered by resource type and field path', async () => {
    // Need order to return this for chaining (order().order())
    const chainable2 = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
    }
    const mockMappings = [
      { id: 'fm-1', fhir_resource_type: 'Appointment', fhir_field_path: 'start' },
      { id: 'fm-2', fhir_resource_type: 'Patient', fhir_field_path: 'name.family' },
    ]
    // Second order call resolves
    let orderCallCount = 0
    chainable2.order.mockImplementation(() => {
      orderCallCount++
      if (orderCallCount >= 2) {
        return Promise.resolve({ data: mockMappings, error: null })
      }
      return chainable2
    })

    const client2 = { from: vi.fn().mockReturnValue(chainable2) }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await epicDAL.listFieldMappings(client2 as any)

    expect(client2.from).toHaveBeenCalledWith('epic_field_mappings')
    expect(result.data).toEqual(mockMappings)
  })

  it('should filter active-only when requested', async () => {
    const { client, chainable } = createMockSupabase()
    chainable.eq.mockResolvedValue({ data: [], error: null })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await epicDAL.listFieldMappings(client as any, true)

    expect(chainable.eq).toHaveBeenCalledWith('is_active', true)
  })
})

describe('epicDAL.batchUpdateFieldMappings', () => {
  it('should update each mapping individually', async () => {
    const { client, chainable } = createMockSupabase()
    chainable.eq.mockResolvedValue({ error: null })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await epicDAL.batchUpdateFieldMappings(client as any, [
      { id: 'fm-1', label: 'Updated Label' },
      { id: 'fm-2', is_active: false },
    ])

    expect(result.success).toBe(true)
    expect(client.from).toHaveBeenCalledWith('epic_field_mappings')
    expect(chainable.update).toHaveBeenCalledTimes(2)
  })

  it('should return error if any update fails', async () => {
    const { client, chainable } = createMockSupabase()
    chainable.eq
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: 'Update failed' } })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await epicDAL.batchUpdateFieldMappings(client as any, [
      { id: 'fm-1', label: 'Updated' },
      { id: 'fm-2', label: 'Will Fail' },
    ])

    expect(result.success).toBe(false)
    expect(result.error).toBe('Update failed')
  })
})

describe('epicDAL.resetFieldMappingsToDefaults', () => {
  it('should delete all existing and re-seed default mappings', async () => {
    const { client, chainable } = createMockSupabase()
    chainable.neq.mockResolvedValueOnce({ error: null })
    chainable.insert.mockResolvedValueOnce({ error: null })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await epicDAL.resetFieldMappingsToDefaults(client as any)

    expect(result.success).toBe(true)
    expect(client.from).toHaveBeenCalledWith('epic_field_mappings')
    expect(chainable.delete).toHaveBeenCalled()
    expect(chainable.neq).toHaveBeenCalledWith('id', '00000000-0000-0000-0000-000000000000')
    expect(chainable.insert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ fhir_resource_type: 'Appointment', orbit_table: 'cases' }),
        expect.objectContaining({ fhir_resource_type: 'Patient', orbit_table: 'patients' }),
      ])
    )
  })

  it('should return error if delete fails', async () => {
    const { client, chainable } = createMockSupabase()
    chainable.neq.mockResolvedValueOnce({ error: { message: 'Delete failed' } })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await epicDAL.resetFieldMappingsToDefaults(client as any)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Delete failed')
    expect(chainable.insert).not.toHaveBeenCalled()
  })

  it('should return error if insert fails', async () => {
    const { client, chainable } = createMockSupabase()
    chainable.neq.mockResolvedValueOnce({ error: null })
    chainable.insert.mockResolvedValueOnce({ error: { message: 'Insert failed' } })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await epicDAL.resetFieldMappingsToDefaults(client as any)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Insert failed')
  })
})

// ============================================
// EPIC IMPORT LOG
// ============================================

describe('epicDAL.checkDuplicateImport', () => {
  it('should check for existing successful import by appointment ID', async () => {
    const { client, chainable } = createMockSupabase()
    chainable.maybeSingle.mockResolvedValue({ data: null, error: null })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await epicDAL.checkDuplicateImport(client as any, 'fac-1', 'appt-123')

    expect(client.from).toHaveBeenCalledWith('epic_import_log')
    expect(chainable.eq).toHaveBeenCalledWith('facility_id', 'fac-1')
    expect(chainable.eq).toHaveBeenCalledWith('fhir_appointment_id', 'appt-123')
    expect(chainable.eq).toHaveBeenCalledWith('status', 'success')
    expect(result.data).toBeNull()
  })

  it('should return existing log entry if duplicate found', async () => {
    const { client, chainable } = createMockSupabase()
    const existingEntry = {
      id: 'log-1',
      fhir_appointment_id: 'appt-123',
      status: 'success',
    }
    chainable.maybeSingle.mockResolvedValue({ data: existingEntry, error: null })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await epicDAL.checkDuplicateImport(client as any, 'fac-1', 'appt-123')

    expect(result.data).toEqual(existingEntry)
  })
})
