// types/__tests__/time-off.test.ts
import { describe, it, expect } from 'vitest'
import {
  calculateBusinessDays,
  REQUEST_TYPE_LABELS,
  STATUS_LABELS,
  type TimeOffRequest,
  type TimeOffRequestInput,
  type TimeOffReviewInput,
  type UserTimeOffSummary,
  type TimeOffFilterParams,
} from '../time-off'

describe('calculateBusinessDays', () => {
  it('calculates single weekday as 1 business day', () => {
    // Monday March 10, 2026
    expect(calculateBusinessDays('2026-03-10', '2026-03-10')).toBe(1)
  })

  it('calculates 5-day work week correctly', () => {
    // Monday to Friday (Mar 2-6, 2026)
    expect(calculateBusinessDays('2026-03-02', '2026-03-06')).toBe(5)
  })

  it('excludes weekends from count', () => {
    // Friday to Monday (Mar 6-9, 2026) — excludes Sat/Sun
    expect(calculateBusinessDays('2026-03-06', '2026-03-09')).toBe(2)
  })

  it('excludes Saturday and Sunday when they are the only days', () => {
    // Saturday to Sunday (Mar 7-8, 2026)
    expect(calculateBusinessDays('2026-03-07', '2026-03-08')).toBe(0)
  })

  it('calculates two-week span correctly', () => {
    // Monday Mar 2 to Friday Mar 13 (10 weekdays)
    expect(calculateBusinessDays('2026-03-02', '2026-03-13')).toBe(10)
  })

  it('handles partial day (AM) as 0.5', () => {
    // Single day with partial_day_type = 'am'
    expect(calculateBusinessDays('2026-03-10', '2026-03-10', 'am')).toBe(0.5)
  })

  it('handles partial day (PM) as 0.5', () => {
    // Single day with partial_day_type = 'pm'
    expect(calculateBusinessDays('2026-03-10', '2026-03-10', 'pm')).toBe(0.5)
  })

  it('treats null partial_day_type as full day', () => {
    expect(calculateBusinessDays('2026-03-10', '2026-03-10', null)).toBe(1)
  })

  it('treats undefined partial_day_type as full day', () => {
    expect(calculateBusinessDays('2026-03-10', '2026-03-10')).toBe(1)
  })

  it('handles same start and end date', () => {
    expect(calculateBusinessDays('2026-03-10', '2026-03-10')).toBe(1)
  })

  it('handles consecutive weekdays', () => {
    // Tuesday to Wednesday (Mar 11-12, 2026)
    expect(calculateBusinessDays('2026-03-11', '2026-03-12')).toBe(2)
  })

  it('handles full week including weekends', () => {
    // Sunday Mar 8 to Sunday Mar 15 (5 weekdays: Mon-Fri)
    expect(calculateBusinessDays('2026-03-08', '2026-03-15')).toBe(5)
  })
})

describe('REQUEST_TYPE_LABELS', () => {
  it('maps all TimeOffRequestType values', () => {
    expect(REQUEST_TYPE_LABELS.pto).toBe('PTO')
    expect(REQUEST_TYPE_LABELS.sick).toBe('Sick')
    expect(REQUEST_TYPE_LABELS.personal).toBe('Personal')
  })

  it('contains exactly 3 entries', () => {
    expect(Object.keys(REQUEST_TYPE_LABELS)).toHaveLength(3)
  })
})

describe('STATUS_LABELS', () => {
  it('maps all TimeOffStatus values', () => {
    expect(STATUS_LABELS.pending).toBe('Pending')
    expect(STATUS_LABELS.approved).toBe('Approved')
    expect(STATUS_LABELS.denied).toBe('Denied')
  })

  it('contains exactly 3 entries', () => {
    expect(Object.keys(STATUS_LABELS)).toHaveLength(3)
  })
})

describe('TimeOffRequest type', () => {
  it('has all required fields for a complete request', () => {
    const request: TimeOffRequest = {
      id: 'req-1',
      facility_id: 'fac-1',
      user_id: 'user-1',
      request_type: 'pto',
      start_date: '2026-03-10',
      end_date: '2026-03-14',
      partial_day_type: null,
      reason: 'Family vacation',
      status: 'approved',
      reviewed_by: 'admin-1',
      reviewed_at: '2026-03-01T10:00:00Z',
      review_notes: 'Approved',
      created_at: '2026-02-28T09:00:00Z',
      updated_at: '2026-03-01T10:00:00Z',
      is_active: true,
    }

    expect(request.id).toBe('req-1')
    expect(request.request_type).toBe('pto')
    expect(request.status).toBe('approved')
  })

  it('allows optional joined user data', () => {
    const request: TimeOffRequest = {
      id: 'req-1',
      facility_id: 'fac-1',
      user_id: 'user-1',
      request_type: 'sick',
      start_date: '2026-03-10',
      end_date: '2026-03-10',
      partial_day_type: 'am',
      reason: null,
      status: 'pending',
      reviewed_by: null,
      reviewed_at: null,
      review_notes: null,
      created_at: '2026-03-09T08:00:00Z',
      updated_at: '2026-03-09T08:00:00Z',
      is_active: true,
      user: {
        id: 'user-1',
        first_name: 'Alice',
        last_name: 'Jones',
        email: 'alice@example.com',
      },
    }

    expect(request.user?.first_name).toBe('Alice')
    expect(request.user?.email).toBe('alice@example.com')
  })

  it('allows optional joined reviewer data', () => {
    const request: TimeOffRequest = {
      id: 'req-1',
      facility_id: 'fac-1',
      user_id: 'user-1',
      request_type: 'personal',
      start_date: '2026-03-10',
      end_date: '2026-03-10',
      partial_day_type: null,
      reason: null,
      status: 'denied',
      reviewed_by: 'admin-1',
      reviewed_at: '2026-03-09T10:00:00Z',
      review_notes: 'Insufficient coverage',
      created_at: '2026-03-08T08:00:00Z',
      updated_at: '2026-03-09T10:00:00Z',
      is_active: true,
      reviewer: {
        id: 'admin-1',
        first_name: 'Bob',
        last_name: 'Admin',
      },
    }

    expect(request.reviewer?.first_name).toBe('Bob')
    expect(request.reviewer?.last_name).toBe('Admin')
  })
})

describe('TimeOffRequestInput type', () => {
  it('has required fields for creating a request', () => {
    const input: TimeOffRequestInput = {
      facility_id: 'fac-1',
      user_id: 'user-1',
      request_type: 'pto',
      start_date: '2026-03-10',
      end_date: '2026-03-14',
    }

    expect(input.facility_id).toBe('fac-1')
    expect(input.request_type).toBe('pto')
  })

  it('allows optional partial_day_type and reason', () => {
    const input: TimeOffRequestInput = {
      facility_id: 'fac-1',
      user_id: 'user-1',
      request_type: 'sick',
      start_date: '2026-03-10',
      end_date: '2026-03-10',
      partial_day_type: 'am',
      reason: 'Dentist appointment',
    }

    expect(input.partial_day_type).toBe('am')
    expect(input.reason).toBe('Dentist appointment')
  })
})

describe('TimeOffReviewInput type', () => {
  it('has required fields for approving a request', () => {
    const review: TimeOffReviewInput = {
      status: 'approved',
      reviewed_by: 'admin-1',
    }

    expect(review.status).toBe('approved')
    expect(review.reviewed_by).toBe('admin-1')
  })

  it('has required fields for denying a request', () => {
    const review: TimeOffReviewInput = {
      status: 'denied',
      reviewed_by: 'admin-1',
      review_notes: 'Coverage issue',
    }

    expect(review.status).toBe('denied')
    expect(review.review_notes).toBe('Coverage issue')
  })
})

describe('UserTimeOffSummary type', () => {
  it('has all required totals fields', () => {
    const summary: UserTimeOffSummary = {
      user_id: 'user-1',
      pto_days: 5,
      sick_days: 2,
      personal_days: 1,
      total_days: 8,
    }

    expect(summary.total_days).toBe(8)
    expect(summary.pto_days + summary.sick_days + summary.personal_days).toBe(8)
  })

  it('handles zero days for all types', () => {
    const summary: UserTimeOffSummary = {
      user_id: 'user-2',
      pto_days: 0,
      sick_days: 0,
      personal_days: 0,
      total_days: 0,
    }

    expect(summary.total_days).toBe(0)
  })

  it('handles fractional days from partial requests', () => {
    const summary: UserTimeOffSummary = {
      user_id: 'user-3',
      pto_days: 2.5,
      sick_days: 0.5,
      personal_days: 1,
      total_days: 4,
    }

    expect(summary.pto_days).toBe(2.5)
    expect(summary.sick_days).toBe(0.5)
  })
})

describe('TimeOffFilterParams type', () => {
  it('allows filtering by status only', () => {
    const filter: TimeOffFilterParams = {
      status: 'pending',
    }

    expect(filter.status).toBe('pending')
    expect(filter.userId).toBeUndefined()
  })

  it('allows filtering by userId only', () => {
    const filter: TimeOffFilterParams = {
      userId: 'user-123',
    }

    expect(filter.userId).toBe('user-123')
    expect(filter.status).toBeUndefined()
  })

  it('allows filtering by date range only', () => {
    const filter: TimeOffFilterParams = {
      dateRange: {
        start: '2026-03-01',
        end: '2026-03-31',
      },
    }

    expect(filter.dateRange?.start).toBe('2026-03-01')
    expect(filter.dateRange?.end).toBe('2026-03-31')
  })

  it('allows filtering by all parameters simultaneously', () => {
    const filter: TimeOffFilterParams = {
      status: 'approved',
      userId: 'user-123',
      roleId: 'role-nurse',
      dateRange: {
        start: '2026-03-01',
        end: '2026-03-31',
      },
    }

    expect(filter.status).toBe('approved')
    expect(filter.userId).toBe('user-123')
    expect(filter.roleId).toBe('role-nurse')
    expect(filter.dateRange).toBeDefined()
  })

  it('allows empty filters object', () => {
    const filter: TimeOffFilterParams = {}
    expect(Object.keys(filter)).toHaveLength(0)
  })
})
