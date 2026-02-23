import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useMilestoneComparison } from '../useMilestoneComparison'

// ============================================
// MOCK Supabase client builder
// ============================================

type MockChain = {
  select: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
  single: ReturnType<typeof vi.fn>
  rpc: ReturnType<typeof vi.fn>
  from: ReturnType<typeof vi.fn>
}

let mockChain: MockChain

function buildMockSupabase() {
  mockChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: [], error: null }),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    from: vi.fn().mockReturnThis(),
  }
  // Chain returns itself for fluent API
  mockChain.select.mockReturnValue(mockChain)
  mockChain.eq.mockReturnValue(mockChain)
  mockChain.from.mockReturnValue(mockChain)
  return mockChain
}

// Mock useSupabaseQueries to extract and invoke fetcher functions directly
let capturedQueries: Record<string, (supabase: unknown) => Promise<unknown>>

vi.mock('@/hooks/useSupabaseQuery', () => ({
  useSupabaseQueries: (queries: Record<string, (supabase: unknown) => Promise<unknown>>, _opts: unknown) => {
    capturedQueries = queries
    return {
      data: null,
      loading: false,
      errors: {},
      refetch: vi.fn(),
    }
  },
}))

// ============================================
// TESTS — Template Cascade Resolution
// ============================================

describe('useMilestoneComparison — expectedNames template cascade', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedQueries = {}
  })

  function initHook() {
    renderHook(() =>
      useMilestoneComparison({
        caseId: 'case-1',
        surgeonId: 'surgeon-1',
        procedureTypeId: 'proc-1',
        facilityId: 'fac-1',
        enabled: true,
      }),
    )
    return capturedQueries.expectedNames
  }

  it('resolves template via procedure_types.milestone_template_id (direct assignment)', async () => {
    const fetcher = initHook()
    expect(fetcher).toBeDefined()

    const mock = buildMockSupabase()

    // procedure_types query → returns a template ID
    let fromCallCount = 0
    mock.from.mockImplementation((table: string) => {
      fromCallCount++
      if (table === 'procedure_types') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { milestone_template_id: 'template-1' },
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'milestone_template_items') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                { facility_milestone: { name: 'patient_in' } },
                { facility_milestone: { name: 'incision' } },
                { facility_milestone: { name: 'closing' } },
              ],
              error: null,
            }),
          }),
        }
      }
      return mock
    })

    const result = await fetcher(mock)
    expect(result).toEqual(['patient_in', 'incision', 'closing'])
    // Should NOT query milestone_templates (default fallback) since procedure had direct assignment
  })

  it('falls back to facility default template when procedure has no assignment', async () => {
    const fetcher = initHook()
    const mock = buildMockSupabase()

    mock.from.mockImplementation((table: string) => {
      if (table === 'procedure_types') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { milestone_template_id: null },
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'milestone_templates') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: 'default-template' },
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }
      }
      if (table === 'milestone_template_items') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                { facility_milestone: { name: 'patient_in' } },
                { facility_milestone: { name: 'patient_out' } },
              ],
              error: null,
            }),
          }),
        }
      }
      return mock
    })

    const result = await fetcher(mock)
    expect(result).toEqual(['patient_in', 'patient_out'])
  })

  it('returns empty array when no template exists (no procedure assignment, no default)', async () => {
    const fetcher = initHook()
    const mock = buildMockSupabase()

    mock.from.mockImplementation((table: string) => {
      if (table === 'procedure_types') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { milestone_template_id: null },
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'milestone_templates') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: null,
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }
      }
      return mock
    })

    const result = await fetcher(mock)
    expect(result).toEqual([])
  })

  it('returns empty array when procedureTypeId is null', async () => {
    renderHook(() =>
      useMilestoneComparison({
        caseId: 'case-1',
        surgeonId: 'surgeon-1',
        procedureTypeId: null,
        facilityId: 'fac-1',
        enabled: true,
      }),
    )
    const fetcher = capturedQueries.expectedNames
    expect(fetcher).toBeDefined()

    const mock = buildMockSupabase()
    const result = await fetcher(mock)
    expect(result).toEqual([])
  })

  it('returns empty array when facilityId is null', async () => {
    renderHook(() =>
      useMilestoneComparison({
        caseId: 'case-1',
        surgeonId: 'surgeon-1',
        procedureTypeId: 'proc-1',
        facilityId: null,
        enabled: true,
      }),
    )
    const fetcher = capturedQueries.expectedNames
    expect(fetcher).toBeDefined()

    const mock = buildMockSupabase()
    const result = await fetcher(mock)
    expect(result).toEqual([])
  })

  it('handles array-wrapped facility_milestone from Supabase', async () => {
    const fetcher = initHook()
    const mock = buildMockSupabase()

    mock.from.mockImplementation((table: string) => {
      if (table === 'procedure_types') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { milestone_template_id: 'template-1' },
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'milestone_template_items') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                { facility_milestone: [{ name: 'patient_in' }] },
                { facility_milestone: null },
              ],
              error: null,
            }),
          }),
        }
      }
      return mock
    })

    const result = await fetcher(mock)
    // Array-wrapped should extract first element; null should be filtered
    expect(result).toEqual(['patient_in'])
  })
})
