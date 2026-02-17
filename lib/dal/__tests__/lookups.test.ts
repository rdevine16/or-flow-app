import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { FacilityMilestone, SurgeonMilestoneConfig } from '../lookups'
import { lookupsDAL } from '../lookups'
import type { SupabaseClient } from '@supabase/supabase-js'

type MockSupabaseClient = unknown

// ============================================
// LOOKUPS DAL TESTS — Phase 5.2b
// ============================================

describe('FacilityMilestone type — Phase 5.2b', () => {
  it('should include source_milestone_type_id instead of milestone_type_id', () => {
    const milestone: FacilityMilestone = {
      id: 'fm-1',
      name: 'patient_in',
      display_name: 'Patient In',
      display_order: 1,
      is_active: true,
      source_milestone_type_id: 'global-mt-1',
    }

    expect(milestone.source_milestone_type_id).toBe('global-mt-1')
    expect('milestone_type_id' in milestone).toBe(false)
  })

  it('should allow null source_milestone_type_id for custom milestones', () => {
    const milestone: FacilityMilestone = {
      id: 'fm-custom',
      name: 'custom_step',
      display_name: 'Custom Step',
      display_order: 99,
      is_active: true,
      source_milestone_type_id: null,
    }

    expect(milestone.source_milestone_type_id).toBeNull()
  })
})

describe('lookupsDAL.facilityMilestones — Phase 5.2b', () => {
  const chainable = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn(),
  }

  const mockSupabase = {
    from: vi.fn().mockReturnValue(chainable),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase.from.mockReturnValue(chainable)
  })

  it('should query facility_milestones table directly', async () => {
    chainable.order.mockResolvedValue({
      data: [
        { id: 'fm-1', name: 'patient_in', display_name: 'Patient In', display_order: 1, is_active: true, source_milestone_type_id: 'mt-1' },
        { id: 'fm-2', name: 'incision', display_name: 'Incision', display_order: 5, is_active: true, source_milestone_type_id: 'mt-5' },
      ],
      error: null,
    })

    const result = await lookupsDAL.facilityMilestones(mockSupabase as MockSupabaseClient as SupabaseClient, 'facility-1')

    expect(mockSupabase.from).toHaveBeenCalledWith('facility_milestones')
    expect(chainable.select).toHaveBeenCalledWith('id, name, display_name, display_order, is_active, source_milestone_type_id')
    expect(chainable.eq).toHaveBeenCalledWith('facility_id', 'facility-1')
    expect(chainable.eq).toHaveBeenCalledWith('is_active', true)
    expect(result.data).toHaveLength(2)
    expect(result.data[0].name).toBe('patient_in')
  })

  it('should return empty array when no milestones found', async () => {
    chainable.order.mockResolvedValue({ data: null, error: null })

    const result = await lookupsDAL.facilityMilestones(mockSupabase as MockSupabaseClient as SupabaseClient, 'facility-1')

    expect(result.data).toEqual([])
  })

  it('should return error when query fails', async () => {
    const pgError = { message: 'table not found', code: '42P01', details: '', hint: '' }
    chainable.order.mockResolvedValue({ data: null, error: pgError })

    const result = await lookupsDAL.facilityMilestones(mockSupabase as MockSupabaseClient as SupabaseClient, 'facility-1')

    expect(result.error).toBe(pgError)
  })
})

describe('SurgeonMilestoneConfig type', () => {
  it('should have all expected fields', () => {
    const config: SurgeonMilestoneConfig = {
      id: 'smc-1',
      facility_id: 'fac-1',
      surgeon_id: 'surg-1',
      procedure_type_id: 'proc-1',
      facility_milestone_id: 'fm-1',
      is_enabled: true,
      display_order: 5,
    }

    expect(config.surgeon_id).toBe('surg-1')
    expect(config.is_enabled).toBe(true)
    expect(config.display_order).toBe(5)
  })

  it('should allow null display_order', () => {
    const config: SurgeonMilestoneConfig = {
      id: 'smc-2',
      facility_id: 'fac-1',
      surgeon_id: 'surg-1',
      procedure_type_id: 'proc-1',
      facility_milestone_id: 'fm-2',
      is_enabled: false,
      display_order: null,
    }

    expect(config.display_order).toBeNull()
  })
})

describe('lookupsDAL.surgeonMilestoneConfig', () => {
  const chainable = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
  }

  const mockSupabase = {
    from: vi.fn().mockReturnValue(chainable),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase.from.mockReturnValue(chainable)
  })

  it('should query surgeon_milestone_config with correct filters', async () => {
    // The last .eq() is the terminal call, so we mock it to resolve
    let eqCallCount = 0
    chainable.eq.mockImplementation(() => {
      eqCallCount++
      if (eqCallCount === 3) {
        return Promise.resolve({
          data: [
            { id: 'smc-1', facility_id: 'fac-1', surgeon_id: 'surg-1', procedure_type_id: 'proc-1', facility_milestone_id: 'fm-1', is_enabled: false, display_order: null },
          ],
          error: null,
        })
      }
      return chainable
    })

    const result = await lookupsDAL.surgeonMilestoneConfig(mockSupabase as MockSupabaseClient as SupabaseClient, 'fac-1', 'surg-1', 'proc-1')

    expect(mockSupabase.from).toHaveBeenCalledWith('surgeon_milestone_config')
    expect(chainable.eq).toHaveBeenCalledWith('facility_id', 'fac-1')
    expect(chainable.eq).toHaveBeenCalledWith('surgeon_id', 'surg-1')
    expect(chainable.eq).toHaveBeenCalledWith('procedure_type_id', 'proc-1')
    expect(result.data).toHaveLength(1)
    expect(result.data[0].is_enabled).toBe(false)
  })

  it('should return empty array when no overrides exist', async () => {
    let eqCallCount = 0
    chainable.eq.mockImplementation(() => {
      eqCallCount++
      if (eqCallCount === 3) {
        return Promise.resolve({ data: null, error: null })
      }
      return chainable
    })

    const result = await lookupsDAL.surgeonMilestoneConfig(mockSupabase as MockSupabaseClient as SupabaseClient, 'fac-1', 'surg-1', 'proc-1')

    expect(result.data).toEqual([])
  })
})
