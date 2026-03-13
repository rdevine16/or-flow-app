// components/staff-management/__tests__/HolidaysTab.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { HolidaysTab } from '../HolidaysTab'
import type { FacilityHoliday, FacilityClosure } from '@/types/block-scheduling'

// ============================================
// Mock useFacilityClosures
// ============================================

const mockFetchHolidays = vi.fn()
const mockCreateHoliday = vi.fn()
const mockUpdateHoliday = vi.fn()
const mockDeleteHoliday = vi.fn()
const mockToggleHoliday = vi.fn()
const mockFetchClosures = vi.fn()
const mockCreateClosure = vi.fn()
const mockDeleteClosure = vi.fn()

let mockHolidays: FacilityHoliday[] = []
let mockClosures: FacilityClosure[] = []

vi.mock('@/hooks/useFacilityClosures', () => ({
  useFacilityClosures: () => ({
    holidays: mockHolidays,
    closures: mockClosures,
    loading: false,
    error: null,
    fetchHolidays: mockFetchHolidays,
    createHoliday: mockCreateHoliday,
    updateHoliday: mockUpdateHoliday,
    deleteHoliday: mockDeleteHoliday,
    toggleHoliday: mockToggleHoliday,
    fetchClosures: mockFetchClosures,
    createClosure: mockCreateClosure,
    deleteClosure: mockDeleteClosure,
    isDateClosed: () => false,
  }),
}))

vi.mock('@/lib/date-utils', () => ({
  getLocalDateString: () => '2026-03-13',
}))

// ============================================
// Test Data
// ============================================

function makeHoliday(overrides: Partial<FacilityHoliday> = {}): FacilityHoliday {
  return {
    id: 'h1',
    facility_id: 'fac1',
    name: 'Christmas',
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

function makePartialHoliday(): FacilityHoliday {
  return makeHoliday({
    id: 'h2',
    name: 'Christmas Eve',
    month: 12,
    day: 24,
    is_partial: true,
    partial_close_time: '12:00:00',
  })
}

// ============================================
// Tests
// ============================================

describe('HolidaysTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHolidays = []
    mockClosures = []
    mockCreateHoliday.mockResolvedValue(null)
    mockUpdateHoliday.mockResolvedValue(false)
  })

  describe('rendering', () => {
    it('renders empty state when no holidays or closures', () => {
      render(<HolidaysTab facilityId="fac1" />)

      expect(screen.getByText('No holidays defined yet')).toBeInTheDocument()
      expect(screen.getByText('No closures scheduled')).toBeInTheDocument()
    })

    it('fetches holidays and closures on mount', () => {
      render(<HolidaysTab facilityId="fac1" />)

      expect(mockFetchHolidays).toHaveBeenCalled()
      expect(mockFetchClosures).toHaveBeenCalled()
    })

    it('renders holiday rows with name and date description', () => {
      mockHolidays = [makeHoliday()]

      render(<HolidaysTab facilityId="fac1" />)

      expect(screen.getByText('Christmas')).toBeInTheDocument()
      expect(screen.getByText('December 25')).toBeInTheDocument()
    })

    it('renders partial holiday badge with close time', () => {
      mockHolidays = [makePartialHoliday()]

      render(<HolidaysTab facilityId="fac1" />)

      expect(screen.getByText('Christmas Eve')).toBeInTheDocument()
      expect(screen.getByText(/Partial — closes at 12:00 PM/)).toBeInTheDocument()
    })

    it('renders inactive holidays in separate section', () => {
      mockHolidays = [
        makeHoliday(),
        makeHoliday({ id: 'h3', name: 'Old Holiday', is_active: false }),
      ]

      render(<HolidaysTab facilityId="fac1" />)

      expect(screen.getByText('Christmas')).toBeInTheDocument()
      expect(screen.getByText('Old Holiday')).toBeInTheDocument()
      expect(screen.getByText('Inactive')).toBeInTheDocument()
    })
  })

  describe('holiday dialog', () => {
    it('opens Add Holiday dialog when button clicked', async () => {
      render(<HolidaysTab facilityId="fac1" />)

      fireEvent.click(screen.getAllByText('Add Holiday')[0])

      await waitFor(() => {
        expect(screen.getByText('Holiday Name')).toBeInTheDocument()
      })
    })

    it('shows partial holiday toggle in dialog', async () => {
      render(<HolidaysTab facilityId="fac1" />)

      fireEvent.click(screen.getAllByText('Add Holiday')[0])

      await waitFor(() => {
        expect(screen.getByText('Partial Holiday')).toBeInTheDocument()
        expect(
          screen.getByText('Facility closes early instead of full-day closure'),
        ).toBeInTheDocument()
      })
    })

    it('shows close time picker when partial toggle is enabled', async () => {
      render(<HolidaysTab facilityId="fac1" />)

      fireEvent.click(screen.getAllByText('Add Holiday')[0])

      await waitFor(() => {
        expect(screen.getByText('Partial Holiday')).toBeInTheDocument()
      })

      // Toggle partial on
      fireEvent.click(screen.getByLabelText('Toggle partial holiday'))

      await waitFor(() => {
        expect(screen.getByText('Facility closes at')).toBeInTheDocument()
      })
    })

    it('submits form with partial holiday fields', async () => {
      mockCreateHoliday.mockResolvedValue(makePartialHoliday())
      render(<HolidaysTab facilityId="fac1" />)

      fireEvent.click(screen.getAllByText('Add Holiday')[0])

      await waitFor(() => {
        expect(screen.getByText('Holiday Name')).toBeInTheDocument()
      })

      // Fill name
      const nameInput = screen.getByPlaceholderText('e.g., Thanksgiving, Christmas')
      fireEvent.change(nameInput, { target: { value: 'Christmas Eve' } })

      // Toggle partial on
      fireEvent.click(screen.getByLabelText('Toggle partial holiday'))

      // Submit
      fireEvent.click(screen.getByText('Add Holiday', { selector: 'button[type="submit"]' }))

      await waitFor(() => {
        expect(mockCreateHoliday).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Christmas Eve',
            is_partial: true,
            partial_close_time: '12:00:00',
          }),
        )
      })
    })

    it('submits non-partial holiday with null close time', async () => {
      mockCreateHoliday.mockResolvedValue(makeHoliday())
      render(<HolidaysTab facilityId="fac1" />)

      fireEvent.click(screen.getAllByText('Add Holiday')[0])

      await waitFor(() => {
        expect(screen.getByText('Holiday Name')).toBeInTheDocument()
      })

      const nameInput = screen.getByPlaceholderText('e.g., Thanksgiving, Christmas')
      fireEvent.change(nameInput, { target: { value: 'Christmas' } })

      fireEvent.click(screen.getByText('Add Holiday', { selector: 'button[type="submit"]' }))

      await waitFor(() => {
        expect(mockCreateHoliday).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Christmas',
            is_partial: false,
            partial_close_time: null,
          }),
        )
      })
    })

    it('pre-fills partial fields when editing a partial holiday', async () => {
      mockHolidays = [makePartialHoliday()]
      render(<HolidaysTab facilityId="fac1" />)

      // Click edit on Christmas Eve
      fireEvent.click(screen.getByLabelText('Edit Christmas Eve'))

      await waitFor(() => {
        expect(screen.getByText('Edit Holiday')).toBeInTheDocument()
        expect(screen.getByText('Facility closes at')).toBeInTheDocument()
      })
    })
  })

  describe('preview', () => {
    it('shows partial close time in preview text', async () => {
      render(<HolidaysTab facilityId="fac1" />)

      fireEvent.click(screen.getAllByText('Add Holiday')[0])

      await waitFor(() => {
        expect(screen.getByText('Holiday Name')).toBeInTheDocument()
      })

      // Toggle partial
      fireEvent.click(screen.getByLabelText('Toggle partial holiday'))

      await waitFor(() => {
        // Preview should show "January 1 — closes at 12:00 PM"
        expect(screen.getByText(/closes at 12:00 PM/)).toBeInTheDocument()
      })
    })
  })
})
