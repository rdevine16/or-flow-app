// lib/dal/__tests__/time-off.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { timeOffDAL } from '../time-off'
import type { SupabaseClient } from '@supabase/supabase-js'

type MockSupabaseClient = unknown

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: vi.fn(() => ({
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  })),
}))

describe('timeOffDAL.fetchFacilityRequests', () => {
  const chainable = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn(),
  }

  const mockSupabase = {
    from: vi.fn().mockReturnValue(chainable),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase.from.mockReturnValue(chainable)
  })

  it('queries time_off_requests table with facility scoping', async () => {
    chainable.order.mockResolvedValue({
      data: [
        {
          id: 'req-1',
          facility_id: 'fac-1',
          user_id: 'user-1',
          request_type: 'pto',
          start_date: '2026-03-10',
          end_date: '2026-03-14',
          status: 'pending',
          is_active: true,
        },
      ],
      error: null,
    })

    const result = await timeOffDAL.fetchFacilityRequests(
      mockSupabase as MockSupabaseClient as SupabaseClient,
      'fac-1'
    )

    expect(mockSupabase.from).toHaveBeenCalledWith('time_off_requests')
    expect(chainable.eq).toHaveBeenCalledWith('facility_id', 'fac-1')
    expect(chainable.eq).toHaveBeenCalledWith('is_active', true)
    expect(chainable.order).toHaveBeenCalledWith('start_date', { ascending: true })
    expect(result.data).toHaveLength(1)
    expect(result.error).toBeNull()
  })

  it('filters by status when provided', async () => {
    chainable.order.mockResolvedValue({ data: [], error: null })

    await timeOffDAL.fetchFacilityRequests(
      mockSupabase as MockSupabaseClient as SupabaseClient,
      'fac-1',
      { status: 'approved' }
    )

    expect(chainable.eq).toHaveBeenCalledWith('status', 'approved')
  })

  it('filters by userId when provided', async () => {
    chainable.order.mockResolvedValue({ data: [], error: null })

    await timeOffDAL.fetchFacilityRequests(
      mockSupabase as MockSupabaseClient as SupabaseClient,
      'fac-1',
      { userId: 'user-123' }
    )

    expect(chainable.eq).toHaveBeenCalledWith('user_id', 'user-123')
  })

  it('filters by date range when provided (overlapping logic)', async () => {
    chainable.order.mockResolvedValue({ data: [], error: null })

    await timeOffDAL.fetchFacilityRequests(
      mockSupabase as MockSupabaseClient as SupabaseClient,
      'fac-1',
      {
        dateRange: {
          start: '2026-03-01',
          end: '2026-03-31',
        },
      }
    )

    // Overlapping range: request starts before filter end AND ends after filter start
    expect(chainable.lte).toHaveBeenCalledWith('start_date', '2026-03-31')
    expect(chainable.gte).toHaveBeenCalledWith('end_date', '2026-03-01')
  })

  it('applies all filters simultaneously', async () => {
    chainable.order.mockResolvedValue({ data: [], error: null })

    await timeOffDAL.fetchFacilityRequests(
      mockSupabase as MockSupabaseClient as SupabaseClient,
      'fac-1',
      {
        status: 'approved',
        userId: 'user-123',
        dateRange: {
          start: '2026-03-01',
          end: '2026-03-31',
        },
      }
    )

    expect(chainable.eq).toHaveBeenCalledWith('facility_id', 'fac-1')
    expect(chainable.eq).toHaveBeenCalledWith('is_active', true)
    expect(chainable.eq).toHaveBeenCalledWith('status', 'approved')
    expect(chainable.eq).toHaveBeenCalledWith('user_id', 'user-123')
    expect(chainable.lte).toHaveBeenCalledWith('start_date', '2026-03-31')
    expect(chainable.gte).toHaveBeenCalledWith('end_date', '2026-03-01')
  })

  it('returns empty array when no requests found', async () => {
    chainable.order.mockResolvedValue({ data: null, error: null })

    const result = await timeOffDAL.fetchFacilityRequests(
      mockSupabase as MockSupabaseClient as SupabaseClient,
      'fac-1'
    )

    expect(result.data).toEqual([])
    expect(result.error).toBeNull()
  })

  it('returns error when query fails', async () => {
    const pgError = { message: 'table not found', code: '42P01', details: '', hint: '' }
    chainable.order.mockResolvedValue({ data: null, error: pgError })

    const result = await timeOffDAL.fetchFacilityRequests(
      mockSupabase as MockSupabaseClient as SupabaseClient,
      'fac-1'
    )

    expect(result.data).toEqual([])
    expect(result.error).toBe(pgError)
  })

  it('includes user and reviewer joins in SELECT', async () => {
    chainable.order.mockResolvedValue({ data: [], error: null })

    await timeOffDAL.fetchFacilityRequests(
      mockSupabase as MockSupabaseClient as SupabaseClient,
      'fac-1'
    )

    // Verify the SELECT includes joins for user and reviewer
    const selectCall = chainable.select.mock.calls[0][0]
    expect(selectCall).toContain('user:users!time_off_requests_user_id_fkey')
    expect(selectCall).toContain('reviewer:users!time_off_requests_reviewed_by_fkey')
  })
})

describe('timeOffDAL.reviewRequest', () => {
  const chainable = {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn(),
  }

  const mockSupabase = {
    from: vi.fn().mockReturnValue(chainable),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase.from.mockReturnValue(chainable)
  })

  it('updates request with approval status', async () => {
    chainable.single.mockResolvedValue({
      data: {
        id: 'req-1',
        status: 'approved',
        reviewed_by: 'admin-1',
        reviewed_at: expect.any(String),
      },
      error: null,
    })

    const result = await timeOffDAL.reviewRequest(
      mockSupabase as MockSupabaseClient as SupabaseClient,
      'fac-1',
      'req-1',
      {
        status: 'approved',
        reviewed_by: 'admin-1',
      }
    )

    expect(mockSupabase.from).toHaveBeenCalledWith('time_off_requests')
    expect(chainable.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'approved',
        reviewed_by: 'admin-1',
        reviewed_at: expect.any(String),
      })
    )
    expect(chainable.eq).toHaveBeenCalledWith('id', 'req-1')
    expect(chainable.eq).toHaveBeenCalledWith('facility_id', 'fac-1')
    expect(chainable.eq).toHaveBeenCalledWith('is_active', true)
    expect(result.error).toBeNull()
  })

  it('updates request with denial status and review notes', async () => {
    chainable.single.mockResolvedValue({
      data: {
        id: 'req-1',
        status: 'denied',
        reviewed_by: 'admin-1',
        review_notes: 'Insufficient coverage',
      },
      error: null,
    })

    const result = await timeOffDAL.reviewRequest(
      mockSupabase as MockSupabaseClient as SupabaseClient,
      'fac-1',
      'req-1',
      {
        status: 'denied',
        reviewed_by: 'admin-1',
        review_notes: 'Insufficient coverage',
      }
    )

    expect(chainable.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'denied',
        reviewed_by: 'admin-1',
        review_notes: 'Insufficient coverage',
        reviewed_at: expect.any(String),
      })
    )
    expect(result.error).toBeNull()
  })

  it('scopes update to facility_id (RLS enforcement)', async () => {
    chainable.single.mockResolvedValue({ data: null, error: null })

    await timeOffDAL.reviewRequest(
      mockSupabase as MockSupabaseClient as SupabaseClient,
      'fac-1',
      'req-1',
      {
        status: 'approved',
        reviewed_by: 'admin-1',
      }
    )

    expect(chainable.eq).toHaveBeenCalledWith('facility_id', 'fac-1')
  })

  it('returns error when update fails', async () => {
    const pgError = { message: 'permission denied', code: '42501', details: '', hint: '' }
    chainable.single.mockResolvedValue({ data: null, error: pgError })

    const result = await timeOffDAL.reviewRequest(
      mockSupabase as MockSupabaseClient as SupabaseClient,
      'fac-1',
      'req-1',
      {
        status: 'approved',
        reviewed_by: 'admin-1',
      }
    )

    expect(result.data).toBeNull()
    expect(result.error).toBe(pgError)
  })
})

describe('timeOffDAL.fetchUserTimeOffTotals', () => {
  const chainable = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn(),
  }

  const mockSupabase = {
    from: vi.fn().mockReturnValue(chainable),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase.from.mockReturnValue(chainable)
  })

  it('queries time_off_requests for approved requests in given year', async () => {
    chainable.lte.mockResolvedValue({ data: [], error: null })

    await timeOffDAL.fetchUserTimeOffTotals(
      mockSupabase as MockSupabaseClient as SupabaseClient,
      'fac-1',
      2026
    )

    expect(mockSupabase.from).toHaveBeenCalledWith('time_off_requests')
    expect(chainable.eq).toHaveBeenCalledWith('facility_id', 'fac-1')
    expect(chainable.eq).toHaveBeenCalledWith('status', 'approved')
    expect(chainable.eq).toHaveBeenCalledWith('is_active', true)
    expect(chainable.gte).toHaveBeenCalledWith('start_date', '2026-01-01')
    expect(chainable.lte).toHaveBeenCalledWith('start_date', '2026-12-31')
  })

  it('aggregates totals per user by request type', async () => {
    chainable.lte.mockResolvedValue({
      data: [
        { user_id: 'user-1', request_type: 'pto', start_date: '2026-03-02', end_date: '2026-03-06', partial_day_type: null },
        { user_id: 'user-1', request_type: 'sick', start_date: '2026-04-01', end_date: '2026-04-01', partial_day_type: 'am' },
        { user_id: 'user-2', request_type: 'pto', start_date: '2026-05-04', end_date: '2026-05-06', partial_day_type: null },
      ],
      error: null,
    })

    const result = await timeOffDAL.fetchUserTimeOffTotals(
      mockSupabase as MockSupabaseClient as SupabaseClient,
      'fac-1',
      2026
    )

    expect(result.data).toHaveLength(2)

    const user1Summary = result.data.find((s) => s.user_id === 'user-1')
    expect(user1Summary?.pto_days).toBe(5) // Mon-Fri (Mar 2-6)
    expect(user1Summary?.sick_days).toBe(0.5) // Half day (Apr 1 is Wed, partial AM)
    expect(user1Summary?.total_days).toBe(5.5)

    const user2Summary = result.data.find((s) => s.user_id === 'user-2')
    expect(user2Summary?.pto_days).toBe(3) // Mon-Wed (May 4-6, 2026)
    expect(user2Summary?.total_days).toBe(3)
  })

  it('handles single user with multiple request types', async () => {
    chainable.lte.mockResolvedValue({
      data: [
        { user_id: 'user-1', request_type: 'pto', start_date: '2026-03-02', end_date: '2026-03-04', partial_day_type: null },
        { user_id: 'user-1', request_type: 'sick', start_date: '2026-04-15', end_date: '2026-04-15', partial_day_type: null },
        { user_id: 'user-1', request_type: 'pto', start_date: '2026-05-20', end_date: '2026-05-20', partial_day_type: 'pm' },
      ],
      error: null,
    })

    const result = await timeOffDAL.fetchUserTimeOffTotals(
      mockSupabase as MockSupabaseClient as SupabaseClient,
      'fac-1',
      2026
    )

    expect(result.data).toHaveLength(1)
    const summary = result.data[0]
    expect(summary.pto_days).toBe(3.5) // Mon-Wed (Mar 2-4) + Half day (Wed May 20, partial PM)
    expect(summary.sick_days).toBe(1) // Wed (Apr 15)
    expect(summary.total_days).toBe(4.5)
  })

  it('returns empty array when no approved requests in year', async () => {
    chainable.lte.mockResolvedValue({ data: [], error: null })

    const result = await timeOffDAL.fetchUserTimeOffTotals(
      mockSupabase as MockSupabaseClient as SupabaseClient,
      'fac-1',
      2026
    )

    expect(result.data).toEqual([])
    expect(result.error).toBeNull()
  })

  it('returns error when query fails', async () => {
    const pgError = { message: 'timeout', code: '57014', details: '', hint: '' }
    chainable.lte.mockResolvedValue({ data: null, error: pgError })

    const result = await timeOffDAL.fetchUserTimeOffTotals(
      mockSupabase as MockSupabaseClient as SupabaseClient,
      'fac-1',
      2026
    )

    expect(result.data).toEqual([])
    expect(result.error).toBe(pgError)
  })
})

describe('timeOffDAL.fetchApprovedRequestsForDateRange', () => {
  const chainable = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    gte: vi.fn(),
  }

  const mockSupabase = {
    from: vi.fn().mockReturnValue(chainable),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase.from.mockReturnValue(chainable)
  })

  it('queries approved requests overlapping with date range', async () => {
    chainable.gte.mockResolvedValue({ data: [], error: null })

    await timeOffDAL.fetchApprovedRequestsForDateRange(
      mockSupabase as MockSupabaseClient as SupabaseClient,
      'fac-1',
      '2026-03-10',
      '2026-03-16'
    )

    expect(mockSupabase.from).toHaveBeenCalledWith('time_off_requests')
    expect(chainable.eq).toHaveBeenCalledWith('facility_id', 'fac-1')
    expect(chainable.eq).toHaveBeenCalledWith('status', 'approved')
    expect(chainable.eq).toHaveBeenCalledWith('is_active', true)
    expect(chainable.lte).toHaveBeenCalledWith('start_date', '2026-03-16')
    expect(chainable.gte).toHaveBeenCalledWith('end_date', '2026-03-10')
  })

  it('returns list of approved requests for coverage calculation', async () => {
    chainable.gte.mockResolvedValue({
      data: [
        { id: 'req-1', user_id: 'user-1', start_date: '2026-03-10', end_date: '2026-03-12', partial_day_type: null, request_type: 'pto' },
        { id: 'req-2', user_id: 'user-2', start_date: '2026-03-14', end_date: '2026-03-14', partial_day_type: 'am', request_type: 'sick' },
      ],
      error: null,
    })

    const result = await timeOffDAL.fetchApprovedRequestsForDateRange(
      mockSupabase as MockSupabaseClient as SupabaseClient,
      'fac-1',
      '2026-03-10',
      '2026-03-16'
    )

    expect(result.data).toHaveLength(2)
    expect(result.data[0].user_id).toBe('user-1')
    expect(result.data[1].partial_day_type).toBe('am')
  })

  it('returns empty array when no approved requests in range', async () => {
    chainable.gte.mockResolvedValue({ data: null, error: null })

    const result = await timeOffDAL.fetchApprovedRequestsForDateRange(
      mockSupabase as MockSupabaseClient as SupabaseClient,
      'fac-1',
      '2026-03-10',
      '2026-03-16'
    )

    expect(result.data).toEqual([])
  })

  it('returns error when query fails', async () => {
    const pgError = { message: 'network error', code: '08006', details: '', hint: '' }
    chainable.gte.mockResolvedValue({ data: null, error: pgError })

    const result = await timeOffDAL.fetchApprovedRequestsForDateRange(
      mockSupabase as MockSupabaseClient as SupabaseClient,
      'fac-1',
      '2026-03-10',
      '2026-03-16'
    )

    expect(result.data).toEqual([])
    expect(result.error).toBe(pgError)
  })
})
