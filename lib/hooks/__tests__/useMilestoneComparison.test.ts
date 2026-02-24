import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useMilestoneComparison } from '../useMilestoneComparison'

// ============================================
// MOCK resolveTemplateForCase + resolvePhaseDefsFromTemplate
// ============================================

const mockResolveTemplateForCase = vi.fn().mockResolvedValue(null)
const mockResolvePhaseDefsFromTemplate = vi.fn().mockResolvedValue([])

vi.mock('@/lib/dal/phase-resolver', () => ({
  resolveTemplateForCase: (...args: unknown[]) => mockResolveTemplateForCase(...args),
  resolvePhaseDefsFromTemplate: (...args: unknown[]) => mockResolvePhaseDefsFromTemplate(...args),
}))

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

  function initHook(opts?: {
    surgeonId?: string | null
    procedureTypeId?: string | null
    facilityId?: string | null
    milestoneTemplateId?: string | null
  }) {
    renderHook(() =>
      useMilestoneComparison({
        caseId: 'case-1',
        surgeonId: opts?.surgeonId ?? 'surgeon-1',
        procedureTypeId: opts?.procedureTypeId ?? 'proc-1',
        facilityId: opts?.facilityId ?? 'fac-1',
        milestoneTemplateId: opts?.milestoneTemplateId ?? null,
        enabled: true,
      }),
    )
    return capturedQueries.expectedNames
  }

  it('calls resolveTemplateForCase with correct args including surgeonId', async () => {
    const fetcher = initHook()
    expect(fetcher).toBeDefined()

    const mock = buildMockSupabase()
    mockResolveTemplateForCase.mockResolvedValue('template-1')

    mock.from.mockImplementation((table: string) => {
      if (table === 'milestone_template_items') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                { facility_milestone: { name: 'patient_in' } },
                { facility_milestone: { name: 'incision' } },
              ],
              error: null,
            }),
          }),
        }
      }
      return mock
    })

    await fetcher(mock)

    expect(mockResolveTemplateForCase).toHaveBeenCalledWith(mock, {
      milestone_template_id: null,
      surgeon_id: 'surgeon-1',
      procedure_type_id: 'proc-1',
      facility_id: 'fac-1',
    })
  })

  it('resolves milestones from the template returned by resolveTemplateForCase', async () => {
    const fetcher = initHook()
    const mock = buildMockSupabase()

    mockResolveTemplateForCase.mockResolvedValue('template-1')

    mock.from.mockImplementation((table: string) => {
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
  })

  it('uses surgeon override template when surgeon has an override', async () => {
    // This tests the full cascade: resolveTemplateForCase should return
    // the surgeon override template, and expectedNames should fetch milestones from it
    const fetcher = initHook({ surgeonId: 'surgeon-override' })
    const mock = buildMockSupabase()

    // resolveTemplateForCase returns the surgeon override template
    mockResolveTemplateForCase.mockResolvedValue('surgeon-override-template')

    mock.from.mockImplementation((table: string) => {
      if (table === 'milestone_template_items') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation((col: string, val: string) => {
              // Verify it queries the surgeon override template, not some other template
              if (col === 'template_id') {
                expect(val).toBe('surgeon-override-template')
              }
              return {
                data: [
                  { facility_milestone: { name: 'patient_in' } },
                  { facility_milestone: { name: 'regional_block' } },
                  { facility_milestone: { name: 'incision' } },
                  { facility_milestone: { name: 'closing' } },
                  { facility_milestone: { name: 'patient_out' } },
                ],
                error: null,
              }
            }),
          }),
        }
      }
      return mock
    })

    const result = await fetcher(mock)
    expect(result).toEqual(['patient_in', 'regional_block', 'incision', 'closing', 'patient_out'])

    // Verify resolveTemplateForCase was called with surgeon ID
    expect(mockResolveTemplateForCase).toHaveBeenCalledWith(mock, {
      milestone_template_id: null,
      surgeon_id: 'surgeon-override',
      procedure_type_id: 'proc-1',
      facility_id: 'fac-1',
    })
  })

  it('passes milestoneTemplateId to resolveTemplateForCase for stamped cases', async () => {
    const fetcher = initHook({ milestoneTemplateId: 'stamped-template-123' })
    const mock = buildMockSupabase()

    mockResolveTemplateForCase.mockResolvedValue('stamped-template-123')

    mock.from.mockImplementation((table: string) => {
      if (table === 'milestone_template_items') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [{ facility_milestone: { name: 'patient_in' } }],
              error: null,
            }),
          }),
        }
      }
      return mock
    })

    await fetcher(mock)

    expect(mockResolveTemplateForCase).toHaveBeenCalledWith(mock, {
      milestone_template_id: 'stamped-template-123',
      surgeon_id: 'surgeon-1',
      procedure_type_id: 'proc-1',
      facility_id: 'fac-1',
    })
  })

  it('returns empty array when resolveTemplateForCase returns null', async () => {
    const fetcher = initHook()
    const mock = buildMockSupabase()

    mockResolveTemplateForCase.mockResolvedValue(null)

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
    // Should not call resolveTemplateForCase when procedureTypeId is null
    expect(mockResolveTemplateForCase).not.toHaveBeenCalled()
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
    // Should not call resolveTemplateForCase when facilityId is null
    expect(mockResolveTemplateForCase).not.toHaveBeenCalled()
  })

  it('handles array-wrapped facility_milestone from Supabase', async () => {
    const fetcher = initHook()
    const mock = buildMockSupabase()

    mockResolveTemplateForCase.mockResolvedValue('template-1')

    mock.from.mockImplementation((table: string) => {
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

  it('deduplicates shared boundary milestones', async () => {
    const fetcher = initHook()
    const mock = buildMockSupabase()

    mockResolveTemplateForCase.mockResolvedValue('template-1')

    mock.from.mockImplementation((table: string) => {
      if (table === 'milestone_template_items') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                { facility_milestone: { name: 'patient_in' } },
                { facility_milestone: { name: 'incision' } },
                { facility_milestone: { name: 'incision' } }, // shared boundary duplicate
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
  })
})

// ============================================
// TESTS — phaseDefinitions uses resolveTemplateForCase
// ============================================

describe('useMilestoneComparison — phaseDefinitions uses full cascade', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedQueries = {}
  })

  it('passes surgeonId to resolveTemplateForCase for phaseDefinitions', async () => {
    renderHook(() =>
      useMilestoneComparison({
        caseId: 'case-1',
        surgeonId: 'surgeon-1',
        procedureTypeId: 'proc-1',
        facilityId: 'fac-1',
        milestoneTemplateId: null,
        enabled: true,
      }),
    )

    const fetcher = capturedQueries.phaseDefinitions
    expect(fetcher).toBeDefined()

    const mock = buildMockSupabase()
    mockResolveTemplateForCase.mockResolvedValue('template-from-cascade')
    mockResolvePhaseDefsFromTemplate.mockResolvedValue([])

    await fetcher(mock)

    expect(mockResolveTemplateForCase).toHaveBeenCalledWith(mock, {
      milestone_template_id: null,
      surgeon_id: 'surgeon-1',
      procedure_type_id: 'proc-1',
      facility_id: 'fac-1',
    })
    expect(mockResolvePhaseDefsFromTemplate).toHaveBeenCalledWith(mock, 'template-from-cascade')
  })
})

// ============================================
// TESTS — medians RPC passes surgeon_id for template resolution
// ============================================

describe('useMilestoneComparison — medians RPC calls', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedQueries = {}
  })

  function initHookForMedians(opts?: {
    surgeonId?: string | null
    procedureTypeId?: string | null
    facilityId?: string | null
  }) {
    renderHook(() =>
      useMilestoneComparison({
        caseId: 'case-1',
        surgeonId: opts?.surgeonId !== undefined ? opts.surgeonId : 'surgeon-1',
        procedureTypeId: opts?.procedureTypeId !== undefined ? opts.procedureTypeId : 'proc-1',
        facilityId: opts?.facilityId !== undefined ? opts.facilityId : 'fac-1',
        milestoneTemplateId: null,
        enabled: true,
      }),
    )
    return capturedQueries.medians
  }

  it('calls get_milestone_interval_medians with p_surgeon_id for template resolution', async () => {
    const fetcher = initHookForMedians({ surgeonId: 'surgeon-override-1' })
    expect(fetcher).toBeDefined()

    const mock = buildMockSupabase()
    mock.rpc.mockResolvedValue({
      data: [
        {
          milestone_name: 'patient_in',
          facility_milestone_id: 'fm-1',
          display_order: 1,
          phase_group: 'preoperative',
          surgeon_median_minutes: 5.0,
          surgeon_case_count: 10,
          facility_median_minutes: 6.0,
          facility_case_count: 50,
        },
      ],
      error: null,
    })

    await fetcher(mock)

    expect(mock.rpc).toHaveBeenCalledWith('get_milestone_interval_medians', {
      p_surgeon_id: 'surgeon-override-1',
      p_procedure_type_id: 'proc-1',
      p_facility_id: 'fac-1',
    })
  })

  it('returns empty array when surgeonId is null', async () => {
    const fetcher = initHookForMedians({ surgeonId: null })
    expect(fetcher).toBeDefined()

    const mock = buildMockSupabase()
    const result = await fetcher(mock)
    expect(result).toEqual([])
    expect(mock.rpc).not.toHaveBeenCalled()
  })

  it('returns RPC data as MilestoneMedianRow array', async () => {
    const fetcher = initHookForMedians()
    const mock = buildMockSupabase()

    const expectedRows = [
      {
        milestone_name: 'patient_in',
        facility_milestone_id: 'fm-1',
        display_order: 1,
        phase_group: 'preoperative',
        surgeon_median_minutes: 5.0,
        surgeon_case_count: 10,
        facility_median_minutes: 6.0,
        facility_case_count: 50,
      },
      {
        milestone_name: 'incision',
        facility_milestone_id: 'fm-2',
        display_order: 2,
        phase_group: 'operative',
        surgeon_median_minutes: 12.0,
        surgeon_case_count: 10,
        facility_median_minutes: 15.0,
        facility_case_count: 50,
      },
    ]
    mock.rpc.mockResolvedValue({ data: expectedRows, error: null })

    const result = await fetcher(mock)
    expect(result).toEqual(expectedRows)
  })

  it('throws error when RPC fails', async () => {
    const fetcher = initHookForMedians()
    const mock = buildMockSupabase()
    mock.rpc.mockResolvedValue({ data: null, error: { message: 'RPC timeout' } })

    await expect(fetcher(mock)).rejects.toThrow('RPC timeout')
  })
})

// ============================================
// TESTS — phaseMedians uses full cascade for template resolution
// ============================================

describe('useMilestoneComparison — phaseMedians uses full cascade', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedQueries = {}
  })

  it('resolves template via cascade and passes it to get_phase_medians RPC', async () => {
    renderHook(() =>
      useMilestoneComparison({
        caseId: 'case-1',
        surgeonId: 'surgeon-1',
        procedureTypeId: 'proc-1',
        facilityId: 'fac-1',
        milestoneTemplateId: null,
        enabled: true,
      }),
    )

    const fetcher = capturedQueries.phaseMedians
    expect(fetcher).toBeDefined()

    const mock = buildMockSupabase()
    mockResolveTemplateForCase.mockResolvedValue('resolved-template-456')
    mock.rpc.mockResolvedValue({ data: [], error: null })

    await fetcher(mock)

    // Verify cascade resolution was called with surgeon_id
    expect(mockResolveTemplateForCase).toHaveBeenCalledWith(mock, {
      milestone_template_id: null,
      surgeon_id: 'surgeon-1',
      procedure_type_id: 'proc-1',
      facility_id: 'fac-1',
    })

    // Verify RPC receives the pre-resolved template ID
    expect(mock.rpc).toHaveBeenCalledWith('get_phase_medians', {
      p_facility_id: 'fac-1',
      p_procedure_type_id: 'proc-1',
      p_surgeon_id: 'surgeon-1',
      p_milestone_template_id: 'resolved-template-456',
    })
  })

  it('returns empty array when template cascade resolves to null', async () => {
    renderHook(() =>
      useMilestoneComparison({
        caseId: 'case-1',
        surgeonId: 'surgeon-1',
        procedureTypeId: 'proc-1',
        facilityId: 'fac-1',
        milestoneTemplateId: null,
        enabled: true,
      }),
    )

    const fetcher = capturedQueries.phaseMedians
    const mock = buildMockSupabase()
    mockResolveTemplateForCase.mockResolvedValue(null)

    const result = await fetcher(mock)
    expect(result).toEqual([])
    expect(mock.rpc).not.toHaveBeenCalled()
  })
})
