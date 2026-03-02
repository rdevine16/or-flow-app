/**
 * Integration/workflow test for the EHR review queue flow.
 *
 * Tests the full review queue lifecycle at the DAL level:
 *   1. Pending review entry exists with unmatched entities
 *   2. Admin resolves entity (resolveEntity saves mapping + clears review_notes)
 *   3. Admin approves import (approveImport marks log as processed)
 *
 * Also tests the reject path:
 *   1. Pending review entry exists
 *   2. Admin rejects import (rejectImport marks log as ignored with reason)
 */

import { describe, it, expect, vi } from 'vitest'
import { ehrDAL } from '../ehr'

// ============================================
// MOCK HELPERS
// ============================================

/**
 * Creates a mock Supabase client that tracks calls per table.
 * Each table gets its own chainable mock, so we can assert per-table behavior
 * across the multi-step resolveEntity → approveImport workflow.
 */
function createSequentialMockSupabase(callHandlers: Array<{
  table: string
  resolve: Record<string, unknown>
  terminal: string
}>) {
  let callIndex = 0

  return {
    from: vi.fn().mockImplementation((table: string) => {
      const handler = callHandlers[callIndex]
      callIndex++

      if (!handler) {
        throw new Error(`Unexpected from('${table}') call #${callIndex}`)
      }

      const chain: Record<string, ReturnType<typeof vi.fn>> = {}
      const terminalFn = handler.terminal

      for (const method of ['select', 'eq', 'neq', 'in', 'gte', 'order', 'limit', 'range',
                            'insert', 'update', 'upsert', 'delete', 'single', 'maybeSingle']) {
        if (method === terminalFn) {
          chain[method] = vi.fn().mockResolvedValue(handler.resolve)
        } else {
          chain[method] = vi.fn().mockReturnThis()
        }
      }

      return chain
    }),
  }
}

// ============================================
// WORKFLOW: RESOLVE → APPROVE
// ============================================

describe('Review Queue Workflow: resolve entity → approve import', () => {
  it('should resolve entity mapping then approve the import', async () => {
    // --- Step 1: resolveEntity ---
    // This makes 3 supabase calls:
    //   1. upsert entity mapping (ehr_entity_mappings)
    //   2. getLogEntry (ehr_integration_log)
    //   3. update review_notes (ehr_integration_log)

    const resolveClient = createSequentialMockSupabase([
      {
        table: 'ehr_entity_mappings',
        terminal: 'single',
        resolve: {
          data: {
            id: 'map-1',
            integration_id: 'int-1',
            entity_type: 'surgeon',
            external_identifier: 'NPI-12345',
            orbit_entity_id: 'user-123',
          },
          error: null,
        },
      },
      {
        table: 'ehr_integration_log',
        terminal: 'single',
        resolve: {
          data: {
            id: 'log-1',
            review_notes: {
              unmatched_surgeon: { identifier: 'NPI-12345', display_name: 'SMITH^JOHN' },
            },
          },
          error: null,
        },
      },
      {
        table: 'ehr_integration_log',
        terminal: 'eq',
        resolve: { error: null },
      },
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resolveResult = await ehrDAL.resolveEntity(
      resolveClient as any,
      'log-1', 'int-1', 'fac-1',
      'surgeon', 'NPI-12345', 'SMITH^JOHN',
      'user-123', 'Dr. John Smith'
    )

    expect(resolveResult.error).toBeNull()
    // Should have made 3 calls: upsert mapping, fetch log, update review_notes
    expect(resolveClient.from).toHaveBeenCalledTimes(3)

    // --- Step 2: approveImport ---
    // This makes 1 supabase call: update ehr_integration_log

    const approveClient = createSequentialMockSupabase([
      {
        table: 'ehr_integration_log',
        terminal: 'eq',
        resolve: { error: null },
      },
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const approveResult = await ehrDAL.approveImport(
      approveClient as any,
      'log-1', 'case-new-1', 'user-admin'
    )

    expect(approveResult.error).toBeNull()
    expect(approveClient.from).toHaveBeenCalledTimes(1)
  })

  it('should handle multiple entity resolutions before approval', async () => {
    // Resolve surgeon first
    const resolveClient1 = createSequentialMockSupabase([
      {
        table: 'ehr_entity_mappings',
        terminal: 'single',
        resolve: { data: { id: 'map-1' }, error: null },
      },
      {
        table: 'ehr_integration_log',
        terminal: 'single',
        resolve: {
          data: {
            id: 'log-1',
            review_notes: {
              unmatched_surgeon: { identifier: 'NPI-12345', display_name: 'SMITH^JOHN' },
              unmatched_room: { identifier: 'OR-3', display_name: 'OR Room 3' },
            },
          },
          error: null,
        },
      },
      {
        table: 'ehr_integration_log',
        terminal: 'eq',
        resolve: { error: null },
      },
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r1 = await ehrDAL.resolveEntity(
      resolveClient1 as any,
      'log-1', 'int-1', 'fac-1',
      'surgeon', 'NPI-12345', 'SMITH^JOHN',
      'user-123', 'Dr. Smith'
    )
    expect(r1.error).toBeNull()

    // Resolve room second
    const resolveClient2 = createSequentialMockSupabase([
      {
        table: 'ehr_entity_mappings',
        terminal: 'single',
        resolve: { data: { id: 'map-2' }, error: null },
      },
      {
        table: 'ehr_integration_log',
        terminal: 'single',
        resolve: {
          data: {
            id: 'log-1',
            review_notes: {
              unmatched_room: { identifier: 'OR-3', display_name: 'OR Room 3' },
            },
          },
          error: null,
        },
      },
      {
        table: 'ehr_integration_log',
        terminal: 'eq',
        resolve: { error: null },
      },
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r2 = await ehrDAL.resolveEntity(
      resolveClient2 as any,
      'log-1', 'int-1', 'fac-1',
      'room', 'OR-3', 'OR Room 3',
      'room-456', 'Operating Room 3'
    )
    expect(r2.error).toBeNull()

    // Now approve
    const approveClient = createSequentialMockSupabase([
      {
        table: 'ehr_integration_log',
        terminal: 'eq',
        resolve: { error: null },
      },
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const approveResult = await ehrDAL.approveImport(
      approveClient as any,
      'log-1', 'case-new-1', 'user-admin'
    )
    expect(approveResult.error).toBeNull()
  })
})

// ============================================
// WORKFLOW: REJECT
// ============================================

describe('Review Queue Workflow: reject import', () => {
  it('should reject a pending import with reason', async () => {
    const client = createSequentialMockSupabase([
      {
        table: 'ehr_integration_log',
        terminal: 'eq',
        resolve: { error: null },
      },
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await ehrDAL.rejectImport(
      client as any,
      'log-1', 'This is a test message, not a real case', 'user-admin'
    )

    expect(result.error).toBeNull()
    expect(client.from).toHaveBeenCalledTimes(1)
  })
})

// ============================================
// WORKFLOW: RESOLVE FAILS MID-WAY
// ============================================

describe('Review Queue Workflow: error handling', () => {
  it('should abort resolve if entity mapping save fails', async () => {
    const client = createSequentialMockSupabase([
      {
        table: 'ehr_entity_mappings',
        terminal: 'single',
        resolve: {
          data: null,
          error: { message: 'Unique constraint violation', code: '23505' },
        },
      },
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await ehrDAL.resolveEntity(
      client as any,
      'log-1', 'int-1', 'fac-1',
      'surgeon', 'NPI-12345', 'SMITH^JOHN',
      'user-123', 'Dr. Smith'
    )

    expect(result.error).toBeTruthy()
    expect(result.error?.message).toContain('Unique constraint')
    // Should NOT proceed to fetch log entry
    expect(client.from).toHaveBeenCalledTimes(1)
  })

  it('should abort resolve if log entry fetch fails', async () => {
    const client = createSequentialMockSupabase([
      {
        table: 'ehr_entity_mappings',
        terminal: 'single',
        resolve: { data: { id: 'map-1' }, error: null },
      },
      {
        table: 'ehr_integration_log',
        terminal: 'single',
        resolve: {
          data: null,
          error: { message: 'Not found', code: 'PGRST116' },
        },
      },
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await ehrDAL.resolveEntity(
      client as any,
      'log-1', 'int-1', 'fac-1',
      'surgeon', 'NPI-12345', 'SMITH^JOHN',
      'user-123', 'Dr. Smith'
    )

    expect(result.error).toBeTruthy()
    // Should NOT proceed to update review_notes
    expect(client.from).toHaveBeenCalledTimes(2)
  })
})
