// types/__tests__/time-off.test.ts
import { describe, it, expect } from 'vitest'
import {
  calculateBusinessDays,
  calculateBusinessDaysWithHolidays,
  resolveHolidayDatesForRange,
  REQUEST_TYPE_LABELS,
  STATUS_LABELS,
  type TimeOffRequest,
  type TimeOffRequestInput,
  type TimeOffReviewInput,
  type UserTimeOffSummary,
  type TimeOffFilterParams,
} from '../time-off'
import type { FacilityHoliday } from '../block-scheduling'

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

// =====================================================
// Holiday-aware calculation tests
// =====================================================

function makeHoliday(overrides: Partial<FacilityHoliday> & { name: string; month: number }): FacilityHoliday {
  return {
    id: 'h-' + Math.random().toString(36).slice(2, 8),
    facility_id: 'fac-1',
    day: null,
    week_of_month: null,
    day_of_week: null,
    is_partial: false,
    partial_close_time: null,
    is_active: true,
    created_by: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('resolveHolidayDatesForRange', () => {
  it('resolves a fixed-date holiday (Dec 25) within range', () => {
    const holidays = [makeHoliday({ name: 'Christmas', month: 12, day: 25 })]
    const result = resolveHolidayDatesForRange(holidays, '2026-12-20', '2026-12-31')

    expect(result.size).toBe(1)
    expect(result.get('2026-12-25')).toEqual({ name: 'Christmas', isPartial: false })
  })

  it('resolves a dynamic-date holiday (4th Thu of Nov = Thanksgiving)', () => {
    const holidays = [makeHoliday({ name: 'Thanksgiving', month: 11, week_of_month: 4, day_of_week: 4 })]
    const result = resolveHolidayDatesForRange(holidays, '2026-11-01', '2026-11-30')

    expect(result.size).toBe(1)
    // 4th Thursday of November 2026 = Nov 26
    expect(result.has('2026-11-26')).toBe(true)
    expect(result.get('2026-11-26')?.name).toBe('Thanksgiving')
  })

  it('resolves last-occurrence holiday (week_of_month=5)', () => {
    // Last Monday of May 2026 = May 25
    const holidays = [makeHoliday({ name: 'Memorial Day', month: 5, week_of_month: 5, day_of_week: 1 })]
    const result = resolveHolidayDatesForRange(holidays, '2026-05-01', '2026-05-31')

    expect(result.size).toBe(1)
    expect(result.has('2026-05-25')).toBe(true)
  })

  it('excludes inactive holidays', () => {
    const holidays = [makeHoliday({ name: 'Old Holiday', month: 12, day: 25, is_active: false })]
    const result = resolveHolidayDatesForRange(holidays, '2026-12-20', '2026-12-31')

    expect(result.size).toBe(0)
  })

  it('excludes holidays outside date range', () => {
    const holidays = [makeHoliday({ name: 'Christmas', month: 12, day: 25 })]
    const result = resolveHolidayDatesForRange(holidays, '2026-12-01', '2026-12-20')

    expect(result.size).toBe(0)
  })

  it('resolves multiple holidays in range', () => {
    const holidays = [
      makeHoliday({ name: 'Christmas Eve', month: 12, day: 24 }),
      makeHoliday({ name: 'Christmas', month: 12, day: 25 }),
    ]
    const result = resolveHolidayDatesForRange(holidays, '2026-12-20', '2026-12-31')

    expect(result.size).toBe(2)
    expect(result.has('2026-12-24')).toBe(true)
    expect(result.has('2026-12-25')).toBe(true)
  })

  it('handles year boundary (range spanning Dec–Jan)', () => {
    const holidays = [
      makeHoliday({ name: 'Christmas', month: 12, day: 25 }),
      makeHoliday({ name: "New Year's Day", month: 1, day: 1 }),
    ]
    const result = resolveHolidayDatesForRange(holidays, '2026-12-20', '2027-01-05')

    expect(result.size).toBe(2)
    expect(result.has('2026-12-25')).toBe(true)
    expect(result.has('2027-01-01')).toBe(true)
  })

  it('marks partial holidays correctly', () => {
    const holidays = [
      makeHoliday({ name: 'Christmas Eve', month: 12, day: 24, is_partial: true, partial_close_time: '12:00:00' }),
    ]
    const result = resolveHolidayDatesForRange(holidays, '2026-12-20', '2026-12-31')

    expect(result.get('2026-12-24')).toEqual({ name: 'Christmas Eve', isPartial: true })
  })

  it('returns empty map when no holidays match', () => {
    const holidays = [makeHoliday({ name: 'July 4th', month: 7, day: 4 })]
    const result = resolveHolidayDatesForRange(holidays, '2026-03-01', '2026-03-31')

    expect(result.size).toBe(0)
  })
})

describe('calculateBusinessDaysWithHolidays', () => {
  const christmas: FacilityHoliday = makeHoliday({ name: 'Christmas', month: 12, day: 25 })

  it('subtracts a weekday holiday from business days', () => {
    // Dec 22 (Mon) to Dec 26 (Fri) 2025: 5 weekdays, Christmas (Thu) is a holiday
    // 2025-12-25 is a Thursday
    const holidays = [christmas]
    const result = calculateBusinessDaysWithHolidays('2025-12-22', '2025-12-26', null, holidays)

    expect(result.totalCalendarDays).toBe(5)
    expect(result.weekendDays).toBe(0)
    expect(result.holidayDays).toBe(1)
    expect(result.ptoDaysCharged).toBe(4)
    expect(result.holidays).toHaveLength(1)
    expect(result.holidays[0].name).toBe('Christmas')
    expect(result.holidays[0].date).toBe('2025-12-25')
  })

  it('does NOT subtract weekend holidays from business days', () => {
    // In 2027, Dec 25 (Saturday). Mon Dec 20 to Fri Dec 24: 5 weekdays, no holiday on weekday
    const holidays = [christmas]
    const result = calculateBusinessDaysWithHolidays('2027-12-20', '2027-12-24', null, holidays)

    expect(result.holidayDays).toBe(0)
    expect(result.ptoDaysCharged).toBe(5)
    expect(result.holidays).toHaveLength(0)
  })

  it('handles partial holiday as 0.5 day subtracted', () => {
    const partialHoliday = makeHoliday({
      name: 'Christmas Eve',
      month: 12,
      day: 24,
      is_partial: true,
      partial_close_time: '12:00:00',
    })
    // Dec 22 (Mon) to Dec 26 (Fri) 2025: 5 weekdays
    // Dec 24 (Wed) is partial holiday = -0.5
    const result = calculateBusinessDaysWithHolidays('2025-12-22', '2025-12-26', null, [partialHoliday, christmas])

    expect(result.holidayDays).toBe(1.5) // 0.5 partial + 1 full
    expect(result.ptoDaysCharged).toBe(3.5) // 5 - 1.5
    expect(result.holidays).toHaveLength(2)
  })

  it('handles partial day PTO request (AM off)', () => {
    // Single day, no holidays
    const result = calculateBusinessDaysWithHolidays('2026-03-10', '2026-03-10', 'am', [])

    expect(result.ptoDaysCharged).toBe(0.5)
  })

  it('returns zero PTO days when all weekdays are holidays', () => {
    const allHolidays = [
      makeHoliday({ name: 'H1', month: 3, day: 10 }),
      makeHoliday({ name: 'H2', month: 3, day: 11 }),
      makeHoliday({ name: 'H3', month: 3, day: 12 }),
      makeHoliday({ name: 'H4', month: 3, day: 13 }),
    ]
    // Tue Mar 10 to Fri Mar 13, 2026: 4 weekdays, all holidays
    const result = calculateBusinessDaysWithHolidays('2026-03-10', '2026-03-13', null, allHolidays)

    expect(result.ptoDaysCharged).toBe(0)
    expect(result.holidays).toHaveLength(4)
  })

  it('handles empty holidays array (falls back to standard calculation)', () => {
    const result = calculateBusinessDaysWithHolidays('2026-03-09', '2026-03-13', null, [])

    // Mon-Fri = 5 business days
    expect(result.ptoDaysCharged).toBe(5)
    expect(result.holidayDays).toBe(0)
    expect(result.holidays).toHaveLength(0)
  })

  it('matches calculateBusinessDays when no holidays exist', () => {
    const start = '2026-03-02'
    const end = '2026-03-06'
    const withHolidays = calculateBusinessDaysWithHolidays(start, end, null, [])
    const without = calculateBusinessDays(start, end)

    expect(withHolidays.ptoDaysCharged).toBe(without)
  })

  it('handles multiple holidays in one week', () => {
    // Thanksgiving (4th Thu of Nov) + day after (Fri, as a fixed date)
    const holidays = [
      makeHoliday({ name: 'Thanksgiving', month: 11, week_of_month: 4, day_of_week: 4 }),
      makeHoliday({ name: 'Day After Thanksgiving', month: 11, day: 27 }),
    ]
    // Nov 23 (Mon) to Nov 27 (Fri) 2026: 5 weekdays
    // Thanksgiving = Thu Nov 26, Day after = Fri Nov 27 → 2 holidays
    const result = calculateBusinessDaysWithHolidays('2026-11-23', '2026-11-27', null, holidays)

    expect(result.holidayDays).toBe(2)
    expect(result.ptoDaysCharged).toBe(3)
  })
})
