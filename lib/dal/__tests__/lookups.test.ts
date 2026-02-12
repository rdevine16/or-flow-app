import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { FacilityMilestone } from '../lookups'
import { lookupsDAL } from '../lookups'

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

    const result = await lookupsDAL.facilityMilestones(mockSupabase as any, 'facility-1')

    expect(mockSupabase.from).toHaveBeenCalledWith('facility_milestones')
    expect(chainable.select).toHaveBeenCalledWith('id, name, display_name, display_order, is_active, source_milestone_type_id')
    expect(chainable.eq).toHaveBeenCalledWith('facility_id', 'facility-1')
    expect(chainable.eq).toHaveBeenCalledWith('is_active', true)
    expect(result.data).toHaveLength(2)
    expect(result.data[0].name).toBe('patient_in')
  })

  it('should return empty array when no milestones found', async () => {
    chainable.order.mockResolvedValue({ data: null, error: null })

    const result = await lookupsDAL.facilityMilestones(mockSupabase as any, 'facility-1')

    expect(result.data).toEqual([])
  })

  it('should return error when query fails', async () => {
    const pgError = { message: 'table not found', code: '42P01', details: '', hint: '' }
    chainable.order.mockResolvedValue({ data: null, error: pgError })

    const result = await lookupsDAL.facilityMilestones(mockSupabase as any, 'facility-1')

    expect(result.error).toBe(pgError)
  })
})
