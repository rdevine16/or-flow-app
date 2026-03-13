// hooks/__tests__/useFacilityClosures.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFacilityClosures } from '../useFacilityClosures'
import type { FacilityHoliday, FacilityClosure } from '@/types/block-scheduling'

// Mock Supabase client
const mockFrom = vi.fn()
vi.mock('@/lib/supabase', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}))

// Mock audit logger
vi.mock('@/lib/audit-logger', () => ({
  facilityHolidayAudit: { created: vi.fn(), updated: vi.fn(), deleted: vi.fn(), toggled: vi.fn() },
  facilityClosureAudit: { created: vi.fn(), deleted: vi.fn() },
}))

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: vi.fn(() => ({
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  })),
}))

// Mock date-utils
vi.mock('@/lib/date-utils', () => ({
  getLocalDateString: (date: Date) => {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

// Helper to build a holiday fixture
function makeHoliday(overrides: Partial<FacilityHoliday> = {}): FacilityHoliday {
  return {
    id: 'hol-1',
    facility_id: 'fac-1',
    name: 'Test Holiday',
    month: 12,
    day: 25,
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

function makeClosure(overrides: Partial<FacilityClosure> = {}): FacilityClosure {
  return {
    id: 'clo-1',
    facility_id: 'fac-1',
    closure_date: '2026-03-15',
    reason: 'Maintenance',
    created_by: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('useFacilityClosures', () => {
  describe('getDateClosureInfo', () => {
    it('returns not-closed for a normal day', () => {
      const { result } = renderHook(() =>
        useFacilityClosures({ facilityId: 'fac-1' })
      )

      // March 10, 2026 — a Tuesday with no holidays
      const info = result.current.getDateClosureInfo(new Date(2026, 2, 10))
      expect(info.isClosed).toBe(false)
      expect(info.isPartialHoliday).toBe(false)
      expect(info.holidayName).toBeNull()
      expect(info.closureReason).toBeNull()
      expect(info.partialCloseTime).toBeNull()
    })

    it('returns full closure for one-off closure', async () => {
      // Set up fetchClosures to populate closures state
      const closureData = [makeClosure({ closure_date: '2026-03-15', reason: 'Pipe burst' })]
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: closureData, error: null }),
            gte: vi.fn().mockReturnValue({
              lte: vi.fn().mockResolvedValue({ data: closureData, error: null }),
            }),
          }),
        }),
      })

      const { result } = renderHook(() =>
        useFacilityClosures({ facilityId: 'fac-1' })
      )

      await act(async () => {
        await result.current.fetchClosures()
      })

      const info = result.current.getDateClosureInfo(new Date(2026, 2, 15))
      expect(info.isClosed).toBe(true)
      expect(info.isPartialHoliday).toBe(false)
      expect(info.closureReason).toBe('Pipe burst')
      expect(info.holidayName).toBeNull()
    })

    it('returns full closure for a full-day holiday', async () => {
      const holidays = [makeHoliday({ month: 12, day: 25, name: 'Christmas', is_partial: false })]
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: holidays, error: null }),
            }),
          }),
        }),
      })

      const { result } = renderHook(() =>
        useFacilityClosures({ facilityId: 'fac-1' })
      )

      await act(async () => {
        await result.current.fetchHolidays()
      })

      // Dec 25, 2026 is a Friday
      const info = result.current.getDateClosureInfo(new Date(2026, 11, 25))
      expect(info.isClosed).toBe(true)
      expect(info.isPartialHoliday).toBe(false)
      expect(info.holidayName).toBe('Christmas')
      expect(info.partialCloseTime).toBeNull()
    })

    it('returns partial holiday info for a partial holiday', async () => {
      const holidays = [makeHoliday({
        month: 12,
        day: 24,
        name: 'Christmas Eve',
        is_partial: true,
        partial_close_time: '12:00:00',
      })]
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: holidays, error: null }),
            }),
          }),
        }),
      })

      const { result } = renderHook(() =>
        useFacilityClosures({ facilityId: 'fac-1' })
      )

      await act(async () => {
        await result.current.fetchHolidays()
      })

      // Dec 24, 2026 is a Thursday
      const info = result.current.getDateClosureInfo(new Date(2026, 11, 24))
      expect(info.isClosed).toBe(false) // NOT fully closed
      expect(info.isPartialHoliday).toBe(true)
      expect(info.holidayName).toBe('Christmas Eve')
      expect(info.partialCloseTime).toBe('12:00:00')
    })

    it('returns not-closed for an inactive holiday', async () => {
      const holidays = [makeHoliday({ month: 7, day: 4, name: 'Independence Day', is_active: false })]
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: holidays, error: null }),
            }),
          }),
        }),
      })

      const { result } = renderHook(() =>
        useFacilityClosures({ facilityId: 'fac-1' })
      )

      await act(async () => {
        await result.current.fetchHolidays()
      })

      const info = result.current.getDateClosureInfo(new Date(2026, 6, 4))
      expect(info.isClosed).toBe(false)
      expect(info.isPartialHoliday).toBe(false)
      expect(info.holidayName).toBeNull()
    })

    it('handles dynamic holiday (4th Thursday of November)', async () => {
      const holidays = [makeHoliday({
        name: 'Thanksgiving',
        month: 11,
        day: null,
        week_of_month: 4,
        day_of_week: 4, // Thursday
        is_partial: false,
      })]
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: holidays, error: null }),
            }),
          }),
        }),
      })

      const { result } = renderHook(() =>
        useFacilityClosures({ facilityId: 'fac-1' })
      )

      await act(async () => {
        await result.current.fetchHolidays()
      })

      // Nov 26, 2026 = 4th Thursday
      const info = result.current.getDateClosureInfo(new Date(2026, 10, 26))
      expect(info.isClosed).toBe(true)
      expect(info.holidayName).toBe('Thanksgiving')

      // Nov 19, 2026 = 3rd Thursday — not the holiday
      const infoNot = result.current.getDateClosureInfo(new Date(2026, 10, 19))
      expect(infoNot.isClosed).toBe(false)
    })
  })

  describe('isDateClosed', () => {
    it('returns false for partial holidays (not fully closed)', async () => {
      const holidays = [makeHoliday({
        month: 12,
        day: 24,
        name: 'Christmas Eve',
        is_partial: true,
        partial_close_time: '12:00:00',
      })]
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: holidays, error: null }),
            }),
          }),
        }),
      })

      const { result } = renderHook(() =>
        useFacilityClosures({ facilityId: 'fac-1' })
      )

      await act(async () => {
        await result.current.fetchHolidays()
      })

      // Partial holiday — isDateClosed should return false
      expect(result.current.isDateClosed(new Date(2026, 11, 24))).toBe(false)
    })

    it('returns true for full-day holidays', async () => {
      const holidays = [makeHoliday({ month: 12, day: 25, is_partial: false })]
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: holidays, error: null }),
            }),
          }),
        }),
      })

      const { result } = renderHook(() =>
        useFacilityClosures({ facilityId: 'fac-1' })
      )

      await act(async () => {
        await result.current.fetchHolidays()
      })

      expect(result.current.isDateClosed(new Date(2026, 11, 25))).toBe(true)
    })

    it('returns true for one-off closures', async () => {
      const closures = [makeClosure({ closure_date: '2026-06-15' })]
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: closures, error: null }),
          }),
        }),
      })

      const { result } = renderHook(() =>
        useFacilityClosures({ facilityId: 'fac-1' })
      )

      await act(async () => {
        await result.current.fetchClosures()
      })

      expect(result.current.isDateClosed(new Date(2026, 5, 15))).toBe(true)
    })
  })
})
