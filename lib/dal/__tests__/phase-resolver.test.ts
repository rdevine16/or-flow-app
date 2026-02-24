/**
 * Tests for lib/dal/phase-resolver.ts
 * Template-based phase boundary resolution adapter
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  resolvePhaseDefsFromTemplate,
  resolveDefaultPhaseDefsForFacility,
  resolveTemplateForCase,
  batchResolveTemplatesForCases,
  type CaseTemplateInfo,
} from '../phase-resolver'

// ============================================
// FIXTURES
// ============================================

const MOCK_PHASE_ROWS = [
  {
    phase_id: 'phase-1',
    phase_name: 'preoperative',
    phase_display_name: 'Preoperative',
    color_key: 'blue',
    display_order: 1,
    parent_phase_id: null,
    start_milestone_id: 'ms-1',
    start_milestone_name: 'patient_arrival',
    start_milestone_display_name: 'Patient Arrival',
    start_milestone_display_order: 1,
    end_milestone_id: 'ms-2',
    end_milestone_name: 'or_entry',
    end_milestone_display_name: 'OR Entry',
    end_milestone_display_order: 2,
  },
  {
    phase_id: 'phase-2',
    phase_name: 'operative',
    phase_display_name: 'Operative',
    color_key: 'red',
    display_order: 2,
    parent_phase_id: null,
    start_milestone_id: 'ms-2',
    start_milestone_name: 'or_entry',
    start_milestone_display_name: 'OR Entry',
    start_milestone_display_order: 2,
    end_milestone_id: 'ms-3',
    end_milestone_name: 'patient_exit',
    end_milestone_display_name: 'Patient Exit',
    end_milestone_display_order: 3,
  },
  {
    phase_id: 'phase-2a',
    phase_name: 'anesthesia_prep',
    phase_display_name: 'Anesthesia Prep',
    color_key: 'orange',
    display_order: 1,
    parent_phase_id: 'phase-2',
    start_milestone_id: 'ms-2',
    start_milestone_name: 'or_entry',
    start_milestone_display_name: 'OR Entry',
    start_milestone_display_order: 2,
    end_milestone_id: 'ms-2a',
    end_milestone_name: 'incision',
    end_milestone_display_name: 'Incision',
    end_milestone_display_order: 3,
  },
]

// ============================================
// MOCKS
// ============================================

function createMockSupabase(rpcData: unknown = MOCK_PHASE_ROWS, rpcError: unknown = null) {
  const mockRpc = vi.fn().mockResolvedValue({ data: rpcData, error: rpcError })
  const mockSelect = vi.fn().mockReturnThis()
  const mockEq = vi.fn().mockReturnThis()
  const mockSingle = vi.fn().mockResolvedValue({ data: { id: 'template-default' }, error: null })
  const mockFrom = vi.fn().mockReturnValue({
    select: mockSelect,
    eq: mockEq,
    single: mockSingle,
  })

  return {
    rpc: mockRpc,
    from: mockFrom,
    mocks: { mockRpc, mockFrom, mockSelect, mockEq, mockSingle },
  }
}

// ============================================
// UNIT TESTS
// ============================================

describe('phase-resolver', () => {
  // ============================================
  // resolvePhaseDefsFromTemplate
  // ============================================

  describe('resolvePhaseDefsFromTemplate', () => {
    it('returns empty array when templateId is null', async () => {
      const supabase = createMockSupabase()
      const result = await resolvePhaseDefsFromTemplate(supabase, null)
      expect(result).toEqual([])
      expect(supabase.mocks.mockRpc).not.toHaveBeenCalled()
    })

    it('returns empty array when templateId is undefined', async () => {
      const supabase = createMockSupabase()
      const result = await resolvePhaseDefsFromTemplate(supabase, undefined)
      expect(result).toEqual([])
      expect(supabase.mocks.mockRpc).not.toHaveBeenCalled()
    })

    it('calls resolve_template_phase_boundaries RPC with correct template ID', async () => {
      const supabase = createMockSupabase()
      await resolvePhaseDefsFromTemplate(supabase, 'template-123')
      expect(supabase.mocks.mockRpc).toHaveBeenCalledWith('resolve_template_phase_boundaries', {
        p_template_id: 'template-123',
      })
    })

    it('returns empty array when RPC returns no rows', async () => {
      const supabase = createMockSupabase([])
      const result = await resolvePhaseDefsFromTemplate(supabase, 'template-123')
      expect(result).toEqual([])
    })

    it('returns empty array when RPC returns null', async () => {
      const supabase = createMockSupabase(null)
      const result = await resolvePhaseDefsFromTemplate(supabase, 'template-123')
      expect(result).toEqual([])
    })

    it('reshapes phase rows into PhaseDefinitionWithMilestones format', async () => {
      const supabase = createMockSupabase()
      const result = await resolvePhaseDefsFromTemplate(supabase, 'template-123')

      expect(result).toHaveLength(3)
      expect(result[0]).toEqual({
        id: 'phase-1',
        name: 'preoperative',
        display_name: 'Preoperative',
        display_order: 1,
        color_key: 'blue',
        parent_phase_id: null,
        start_milestone_id: 'ms-1',
        end_milestone_id: 'ms-2',
        start_milestone: {
          id: 'ms-1',
          name: 'patient_arrival',
          display_name: 'Patient Arrival',
          display_order: 1,
        },
        end_milestone: {
          id: 'ms-2',
          name: 'or_entry',
          display_name: 'OR Entry',
          display_order: 2,
        },
      })
    })

    it('preserves parent_phase_id for sub-phases', async () => {
      const supabase = createMockSupabase()
      const result = await resolvePhaseDefsFromTemplate(supabase, 'template-123')

      const subPhase = result.find((p) => p.id === 'phase-2a')
      expect(subPhase?.parent_phase_id).toBe('phase-2')
    })

    it('throws error when RPC fails', async () => {
      const supabase = createMockSupabase(null, { message: 'RPC failed' })
      await expect(resolvePhaseDefsFromTemplate(supabase, 'template-123')).rejects.toThrow(
        'resolve_template_phase_boundaries failed: RPC failed'
      )
    })
  })

  // ============================================
  // resolveDefaultPhaseDefsForFacility
  // ============================================

  describe('resolveDefaultPhaseDefsForFacility', () => {
    it('queries for facility default template', async () => {
      const supabase = createMockSupabase()
      await resolveDefaultPhaseDefsForFacility(supabase, 'facility-1')

      expect(supabase.mocks.mockFrom).toHaveBeenCalledWith('milestone_templates')
      expect(supabase.mocks.mockSelect).toHaveBeenCalledWith('id')
      expect(supabase.mocks.mockEq).toHaveBeenCalledWith('facility_id', 'facility-1')
      expect(supabase.mocks.mockEq).toHaveBeenCalledWith('is_default', true)
      expect(supabase.mocks.mockEq).toHaveBeenCalledWith('is_active', true)
    })

    it('returns empty array when no default template exists', async () => {
      const mockSupabase = createMockSupabase()
      mockSupabase.mocks.mockSingle.mockResolvedValue({ data: null, error: null })

      const result = await resolveDefaultPhaseDefsForFacility(mockSupabase, 'facility-1')
      expect(result).toEqual([])
      expect(mockSupabase.mocks.mockRpc).not.toHaveBeenCalled()
    })

    it('returns empty array when default template has no ID', async () => {
      const mockSupabase = createMockSupabase()
      mockSupabase.mocks.mockSingle.mockResolvedValue({ data: {}, error: null })

      const result = await resolveDefaultPhaseDefsForFacility(mockSupabase, 'facility-1')
      expect(result).toEqual([])
      expect(mockSupabase.mocks.mockRpc).not.toHaveBeenCalled()
    })

    it('calls resolvePhaseDefsFromTemplate with default template ID', async () => {
      const mockSupabase = createMockSupabase()
      mockSupabase.mocks.mockSingle.mockResolvedValue({
        data: { id: 'template-default' },
        error: null,
      })

      const result = await resolveDefaultPhaseDefsForFacility(mockSupabase, 'facility-1')
      expect(mockSupabase.mocks.mockRpc).toHaveBeenCalledWith('resolve_template_phase_boundaries', {
        p_template_id: 'template-default',
      })
      expect(result).toHaveLength(3)
    })
  })

  // ============================================
  // resolveTemplateForCase
  // ============================================

  describe('resolveTemplateForCase', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('returns case milestone_template_id when present', async () => {
      const mockSupabase = createMockSupabase()
      const caseInfo: CaseTemplateInfo = {
        milestone_template_id: 'template-case',
        surgeon_id: 'surgeon-1',
        procedure_type_id: 'proc-1',
        facility_id: 'facility-1',
      }

      const result = await resolveTemplateForCase(mockSupabase, caseInfo)
      expect(result).toBe('template-case')
      expect(mockSupabase.mocks.mockFrom).not.toHaveBeenCalled()
    })

    it('queries surgeon override when case has no template', async () => {
      const mockSingle = vi.fn().mockResolvedValue({
        data: { template_id: 'template-surgeon' },
        error: null,
      })
      const mockEq = vi.fn().mockReturnThis()
      const mockSelect = vi.fn().mockReturnValue({
        eq: mockEq,
        single: mockSingle,
      })
      const mockFrom = vi.fn().mockReturnValue({
        select: mockSelect,
      })
      const mockSupabase = { from: mockFrom, rpc: vi.fn() }

      const caseInfo: CaseTemplateInfo = {
        milestone_template_id: null,
        surgeon_id: 'surgeon-1',
        procedure_type_id: 'proc-1',
        facility_id: 'facility-1',
      }

      const result = await resolveTemplateForCase(mockSupabase, caseInfo)
      expect(result).toBe('template-surgeon')
      expect(mockFrom).toHaveBeenCalledWith('surgeon_template_overrides')
    })

    it('queries procedure template when no surgeon override', async () => {
      const mockSupabase = createMockSupabase()
      mockSupabase.mocks.mockSingle
        .mockResolvedValueOnce({ data: null, error: null }) // surgeon override
        .mockResolvedValueOnce({ data: { milestone_template_id: 'template-procedure' }, error: null }) // procedure

      const caseInfo: CaseTemplateInfo = {
        milestone_template_id: null,
        surgeon_id: 'surgeon-1',
        procedure_type_id: 'proc-1',
        facility_id: 'facility-1',
      }

      const result = await resolveTemplateForCase(mockSupabase, caseInfo)
      expect(result).toBe('template-procedure')
      expect(mockSupabase.mocks.mockFrom).toHaveBeenCalledWith('procedure_types')
      expect(mockSupabase.mocks.mockEq).toHaveBeenCalledWith('id', 'proc-1')
    })

    it('queries facility default when no surgeon or procedure template', async () => {
      const mockSupabase = createMockSupabase()
      mockSupabase.mocks.mockSingle
        .mockResolvedValueOnce({ data: null, error: null }) // surgeon override
        .mockResolvedValueOnce({ data: null, error: null }) // procedure
        .mockResolvedValueOnce({ data: { id: 'template-facility-default' }, error: null }) // facility default

      const caseInfo: CaseTemplateInfo = {
        milestone_template_id: null,
        surgeon_id: 'surgeon-1',
        procedure_type_id: 'proc-1',
        facility_id: 'facility-1',
      }

      const result = await resolveTemplateForCase(mockSupabase, caseInfo)
      expect(result).toBe('template-facility-default')
      expect(mockSupabase.mocks.mockFrom).toHaveBeenCalledWith('milestone_templates')
      expect(mockSupabase.mocks.mockEq).toHaveBeenCalledWith('facility_id', 'facility-1')
      expect(mockSupabase.mocks.mockEq).toHaveBeenCalledWith('is_default', true)
    })

    it('returns null when no template found in cascade', async () => {
      const mockSupabase = createMockSupabase()
      mockSupabase.mocks.mockSingle
        .mockResolvedValueOnce({ data: null, error: null }) // surgeon override
        .mockResolvedValueOnce({ data: null, error: null }) // procedure
        .mockResolvedValueOnce({ data: null, error: null }) // facility default

      const caseInfo: CaseTemplateInfo = {
        milestone_template_id: null,
        surgeon_id: 'surgeon-1',
        procedure_type_id: 'proc-1',
        facility_id: 'facility-1',
      }

      const result = await resolveTemplateForCase(mockSupabase, caseInfo)
      expect(result).toBeNull()
    })

    it('skips surgeon override query when no surgeon_id', async () => {
      const mockSupabase = createMockSupabase()
      mockSupabase.mocks.mockSingle
        .mockResolvedValueOnce({ data: { milestone_template_id: 'template-procedure' }, error: null })

      const caseInfo: CaseTemplateInfo = {
        milestone_template_id: null,
        surgeon_id: null,
        procedure_type_id: 'proc-1',
        facility_id: 'facility-1',
      }

      const result = await resolveTemplateForCase(mockSupabase, caseInfo)
      expect(result).toBe('template-procedure')
      expect(mockSupabase.mocks.mockFrom).toHaveBeenCalledWith('procedure_types')
      expect(mockSupabase.mocks.mockFrom).not.toHaveBeenCalledWith('surgeon_template_overrides')
    })

    it('skips surgeon override and procedure query when both IDs are null', async () => {
      const mockSingle = vi.fn().mockResolvedValue({
        data: { id: 'template-facility-default' },
        error: null,
      })
      const mockEq = vi.fn().mockReturnThis()
      const mockSelect = vi.fn().mockReturnValue({
        eq: mockEq,
        single: mockSingle,
      })
      const mockFrom = vi.fn().mockReturnValue({ select: mockSelect })
      const mockSupabase = { from: mockFrom, rpc: vi.fn() }

      const caseInfo: CaseTemplateInfo = {
        milestone_template_id: null,
        surgeon_id: null,
        procedure_type_id: null,
        facility_id: 'facility-1',
      }

      const result = await resolveTemplateForCase(mockSupabase, caseInfo)
      expect(result).toBe('template-facility-default')
      // Should only query facility default (surgeon_id and procedure_type_id are null)
      expect(mockFrom).toHaveBeenCalledTimes(1)
      expect(mockFrom).toHaveBeenCalledWith('milestone_templates')
    })
  })

  // ============================================
  // batchResolveTemplatesForCases
  // ============================================

  describe('batchResolveTemplatesForCases', () => {
    it('returns empty Map when no cases provided', async () => {
      const mockSupabase = createMockSupabase()
      const result = await batchResolveTemplatesForCases(mockSupabase, [], 'facility-1')
      expect(result).toBeInstanceOf(Map)
      expect(result.size).toBe(0)
    })

    it('returns case template IDs directly when all cases have them', async () => {
      const mockSupabase = createMockSupabase()
      const cases = [
        { id: 'case-1', milestone_template_id: 'template-a', surgeon_id: 's1', procedure_type_id: 'p1' },
        { id: 'case-2', milestone_template_id: 'template-b', surgeon_id: 's2', procedure_type_id: 'p2' },
      ]

      const result = await batchResolveTemplatesForCases(mockSupabase, cases, 'facility-1')
      expect(result).toBeInstanceOf(Map)
      expect(result.get('case-1')).toBe('template-a')
      expect(result.get('case-2')).toBe('template-b')
      expect(mockSupabase.mocks.mockFrom).not.toHaveBeenCalled()
    })

    // NOTE: Additional batch resolution tests would require complex mock chains
    // for the cascade logic (.in() queries, parallel fetches). These are better
    // suited as integration tests that use a real Supabase client.
    // The cascade logic is indirectly tested through resolveTemplateForCase tests above.
  })
})
