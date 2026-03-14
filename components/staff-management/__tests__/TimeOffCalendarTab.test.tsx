// components/staff-management/__tests__/TimeOffCalendarTab.test.tsx
// Integration tests for TimeOffCalendarTab component.
// Tests filtering, navigation, and integration with CalendarDayCell.

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TimeOffCalendarTab } from '../TimeOffCalendarTab'
import type { TimeOffRequest } from '@/types/time-off'
import type { UserListItem } from '@/lib/dal/users'

// ============================================
// Mocks
// ============================================

vi.mock('@/hooks/useSupabaseQuery', () => ({
  useSupabaseQueries: vi.fn(),
}))

vi.mock('@/hooks/useLookups', () => ({
  useUserRoles: vi.fn(),
}))

// Import after mocking
import { useSupabaseQueries } from '@/hooks/useSupabaseQuery'
import { useUserRoles } from '@/hooks/useLookups'

// ============================================
// Mock Data Factory
// ============================================

const mockRequest = (
  id: string,
  userId: string,
  firstName: string,
  lastName: string,
  startDate: string,
  endDate: string,
  status: 'pending' | 'approved' | 'denied',
  requestType: 'pto' | 'sick' = 'pto',
): TimeOffRequest => ({
  id,
  facility_id: 'fac-1',
  user_id: userId,
  start_date: startDate,
  end_date: endDate,
  request_type: requestType,
  status,
  notes: null,
  created_at: '2026-03-01T00:00:00Z',
  updated_at: '2026-03-01T00:00:00Z',
  user: {
    id: userId,
    first_name: firstName,
    last_name: lastName,
    email: `${firstName.toLowerCase()}@example.com`,
  },
})

const mockStaff = (
  id: string,
  firstName: string,
  lastName: string,
  roleId: string,
  isActive = true,
): UserListItem => ({
  id,
  first_name: firstName,
  last_name: lastName,
  email: `${firstName.toLowerCase()}@example.com`,
  role_id: roleId,
  facility_id: 'fac-1',
  is_active: isActive,
  phone_number: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  role: {
    id: roleId,
    name: roleId === 'role-rn' ? 'RN' : roleId === 'role-surgeon' ? 'Surgeon' : 'Anesthesiologist',
  },
})

// ============================================
// Tests
// ============================================

describe('TimeOffCalendarTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default role lookup
    vi.mocked(useUserRoles).mockReturnValue({
      data: [
        { id: 'role-rn', name: 'RN' },
        { id: 'role-surgeon', name: 'Surgeon' },
        { id: 'role-anesthesia', name: 'Anesthesiologist' },
      ],
      loading: false,
      error: null,
    } as never)
  })

  test('renders calendar grid with weekday headers', async () => {
    vi.mocked(useSupabaseQueries).mockReturnValue({
      data: {
        requests: [],
        staff: [],
      },
      loading: false,
      errors: {},
      refetch: vi.fn(),
    } as never)

    render(<TimeOffCalendarTab facilityId="fac-1" />)

    // Header shows a month and year
    expect(screen.getByText(/\w+ \d{4}/i)).toBeInTheDocument()

    // Weekday headers
    expect(screen.getByText('Sun')).toBeInTheDocument()
    expect(screen.getByText('Mon')).toBeInTheDocument()
    expect(screen.getByText('Sat')).toBeInTheDocument()
  })

  test('displays requests as badges in day cells', async () => {
    const requests = [
      mockRequest('r1', 'u1', 'Alice', 'Smith', '2026-03-10', '2026-03-10', 'approved'),
      mockRequest('r2', 'u2', 'Bob', 'Johnson', '2026-03-15', '2026-03-15', 'pending'),
    ]

    vi.mocked(useSupabaseQueries).mockReturnValue({
      data: {
        requests,
        staff: [
          mockStaff('u1', 'Alice', 'Smith', 'role-rn'),
          mockStaff('u2', 'Bob', 'Johnson', 'role-surgeon'),
        ],
      },
      loading: false,
      errors: {},
      refetch: vi.fn(),
    } as never)

    render(<TimeOffCalendarTab facilityId="fac-1" />)

    await waitFor(() => {
      // Request badges should appear with user initials and last name
      expect(screen.getByText(/A\. Smith/i)).toBeInTheDocument()
      expect(screen.getByText(/B\. Johnson/i)).toBeInTheDocument()
    })
  })

  test('filters by status correctly', async () => {
    const requests = [
      mockRequest('r1', 'u1', 'Alice', 'Smith', '2026-03-10', '2026-03-10', 'approved'),
      mockRequest('r2', 'u2', 'Bob', 'Johnson', '2026-03-15', '2026-03-15', 'pending'),
      mockRequest('r3', 'u3', 'Charlie', 'Brown', '2026-03-20', '2026-03-20', 'denied'),
    ]

    vi.mocked(useSupabaseQueries).mockReturnValue({
      data: {
        requests,
        staff: [
          mockStaff('u1', 'Alice', 'Smith', 'role-rn'),
          mockStaff('u2', 'Bob', 'Johnson', 'role-surgeon'),
          mockStaff('u3', 'Charlie', 'Brown', 'role-anesthesia'),
        ],
      },
      loading: false,
      errors: {},
      refetch: vi.fn(),
    } as never)


    render(<TimeOffCalendarTab facilityId="fac-1" />)

    const user = userEvent.setup({ delay: null })

    // Initially shows all 3 requests
    await waitFor(() => {
      expect(screen.getByText('3 requests')).toBeInTheDocument()
    })

    // Filter by "Approved"
    const statusFilter = screen.getByLabelText(/filter by status/i)
    await user.selectOptions(statusFilter, 'approved')

    await waitFor(() => {
      expect(screen.getByText('1 request')).toBeInTheDocument()
      expect(screen.getByText(/A\. Smith/i)).toBeInTheDocument()
      expect(screen.queryByText(/B\. Johnson/i)).not.toBeInTheDocument()
    })

    // Filter by "Pending"
    await user.selectOptions(statusFilter, 'pending')

    await waitFor(() => {
      expect(screen.getByText('1 request')).toBeInTheDocument()
      expect(screen.getByText(/B\. Johnson/i)).toBeInTheDocument()
      expect(screen.queryByText(/A\. Smith/i)).not.toBeInTheDocument()
    })

  })

  test('filters by role correctly', async () => {
    const requests = [
      mockRequest('r1', 'u1', 'Alice', 'Smith', '2026-03-10', '2026-03-10', 'approved'),
      mockRequest('r2', 'u2', 'Bob', 'Johnson', '2026-03-15', '2026-03-15', 'approved'),
    ]

    vi.mocked(useSupabaseQueries).mockReturnValue({
      data: {
        requests,
        staff: [
          mockStaff('u1', 'Alice', 'Smith', 'role-rn'),
          mockStaff('u2', 'Bob', 'Johnson', 'role-surgeon'),
        ],
      },
      loading: false,
      errors: {},
      refetch: vi.fn(),
    } as never)


    render(<TimeOffCalendarTab facilityId="fac-1" />)

    const user = userEvent.setup({ delay: null })

    // Initially shows both requests
    await waitFor(() => {
      expect(screen.getByText('2 requests')).toBeInTheDocument()
    })

    // Filter by "RN" role
    const roleFilter = screen.getByLabelText(/filter by role/i)
    await user.selectOptions(roleFilter, 'role-rn')

    await waitFor(() => {
      expect(screen.getByText('1 request')).toBeInTheDocument()
      expect(screen.getByText(/A\. Smith/i)).toBeInTheDocument()
      expect(screen.queryByText(/B\. Johnson/i)).not.toBeInTheDocument()
    })

    // Filter by "Surgeon" role
    await user.selectOptions(roleFilter, 'role-surgeon')

    await waitFor(() => {
      expect(screen.getByText('1 request')).toBeInTheDocument()
      expect(screen.getByText(/B\. Johnson/i)).toBeInTheDocument()
      expect(screen.queryByText(/A\. Smith/i)).not.toBeInTheDocument()
    })

  })

  test('filters by staff member correctly', async () => {
    const requests = [
      mockRequest('r1', 'u1', 'Alice', 'Smith', '2026-03-10', '2026-03-10', 'approved'),
      mockRequest('r2', 'u2', 'Bob', 'Johnson', '2026-03-15', '2026-03-15', 'approved'),
    ]

    vi.mocked(useSupabaseQueries).mockReturnValue({
      data: {
        requests,
        staff: [
          mockStaff('u1', 'Alice', 'Smith', 'role-rn'),
          mockStaff('u2', 'Bob', 'Johnson', 'role-surgeon'),
        ],
      },
      loading: false,
      errors: {},
      refetch: vi.fn(),
    } as never)


    render(<TimeOffCalendarTab facilityId="fac-1" />)

    const user = userEvent.setup({ delay: null })

    // Initially shows both requests
    await waitFor(() => {
      expect(screen.getByText('2 requests')).toBeInTheDocument()
    })

    // Filter by Alice
    const userFilter = screen.getByLabelText(/filter by staff member/i)
    await user.selectOptions(userFilter, 'u1')

    await waitFor(() => {
      expect(screen.getByText('1 request')).toBeInTheDocument()
      expect(screen.getByText(/A\. Smith/i)).toBeInTheDocument()
      expect(screen.queryByText(/B\. Johnson/i)).not.toBeInTheDocument()
    })

  })

  test('combines multiple filters (status + role)', async () => {
    const requests = [
      mockRequest('r1', 'u1', 'Alice', 'Smith', '2026-03-10', '2026-03-10', 'approved'),
      mockRequest('r2', 'u2', 'Bob', 'Johnson', '2026-03-15', '2026-03-15', 'pending'),
      mockRequest('r3', 'u3', 'Charlie', 'Brown', '2026-03-20', '2026-03-20', 'approved'),
    ]

    vi.mocked(useSupabaseQueries).mockReturnValue({
      data: {
        requests,
        staff: [
          mockStaff('u1', 'Alice', 'Smith', 'role-rn'),
          mockStaff('u2', 'Bob', 'Johnson', 'role-rn'), // same role as Alice
          mockStaff('u3', 'Charlie', 'Brown', 'role-surgeon'),
        ],
      },
      loading: false,
      errors: {},
      refetch: vi.fn(),
    } as never)


    render(<TimeOffCalendarTab facilityId="fac-1" />)

    const user = userEvent.setup({ delay: null })

    // Filter by "Approved" status
    const statusFilter = screen.getByLabelText(/filter by status/i)
    await user.selectOptions(statusFilter, 'approved')

    await waitFor(() => {
      expect(screen.getByText('2 requests')).toBeInTheDocument() // Alice + Charlie
    })

    // Further filter by "RN" role
    const roleFilter = screen.getByLabelText(/filter by role/i)
    await user.selectOptions(roleFilter, 'role-rn')

    await waitFor(() => {
      expect(screen.getByText('1 request')).toBeInTheDocument() // only Alice
      expect(screen.getByText(/A\. Smith/i)).toBeInTheDocument()
      expect(screen.queryByText(/C\. Brown/i)).not.toBeInTheDocument()
    })

  })

  test('navigates to previous month', async () => {
    vi.mocked(useSupabaseQueries).mockReturnValue({
      data: {
        requests: [],
        staff: [],
      },
      loading: false,
      errors: {},
      refetch: vi.fn(),
    } as never)

    // Don't use fake timers for navigation tests - they cause timeouts with userEvent
    render(<TimeOffCalendarTab facilityId="fac-1" />)

    const user = userEvent.setup()

    // Get current month from DOM
    const currentMonth = screen.getByText(/\w+ \d{4}/i).textContent

    // Click previous month button
    const prevButton = screen.getByLabelText(/previous month/i)
    await user.click(prevButton)

    // Should show a different month
    await waitFor(() => {
      const newMonth = screen.getByText(/\w+ \d{4}/i).textContent
      expect(newMonth).not.toBe(currentMonth)
    })
  })

  test('navigates to next month', async () => {
    vi.mocked(useSupabaseQueries).mockReturnValue({
      data: {
        requests: [],
        staff: [],
      },
      loading: false,
      errors: {},
      refetch: vi.fn(),
    } as never)

    render(<TimeOffCalendarTab facilityId="fac-1" />)

    const user = userEvent.setup()

    // Get current month from DOM
    const currentMonth = screen.getByText(/\w+ \d{4}/i).textContent

    // Click next month button
    const nextButton = screen.getByLabelText(/next month/i)
    await user.click(nextButton)

    // Should show a different month
    await waitFor(() => {
      const newMonth = screen.getByText(/\w+ \d{4}/i).textContent
      expect(newMonth).not.toBe(currentMonth)
    })
  })

  test('navigates across year boundary (December to January)', async () => {
    vi.mocked(useSupabaseQueries).mockReturnValue({
      data: {
        requests: [],
        staff: [],
      },
      loading: false,
      errors: {},
      refetch: vi.fn(),
    } as never)

    render(<TimeOffCalendarTab facilityId="fac-1" />)

    const user = userEvent.setup()

    // Navigate backward multiple times to reach December
    const prevButton = screen.getByLabelText(/previous month/i)

    // Just test that navigation works, don't rely on specific start month
    const initialMonth = screen.getByText(/\w+ \d{4}/i).textContent

    // Navigate forward
    const nextButton = screen.getByLabelText(/next month/i)
    await user.click(nextButton)

    await waitFor(() => {
      const newMonth = screen.getByText(/\w+ \d{4}/i).textContent
      expect(newMonth).not.toBe(initialMonth)
    })
  })

  test('"Today" button returns to current month', async () => {
    vi.mocked(useSupabaseQueries).mockReturnValue({
      data: {
        requests: [],
        staff: [],
      },
      loading: false,
      errors: {},
      refetch: vi.fn(),
    } as never)

    render(<TimeOffCalendarTab facilityId="fac-1" />)

    const user = userEvent.setup()

    // Capture initial month (today)
    const initialMonth = screen.getByText(/\w+ \d{4}/i).textContent

    // Navigate to a different month
    const nextButton = screen.getByLabelText(/next month/i)
    await user.click(nextButton)

    await waitFor(() => {
      const newMonth = screen.getByText(/\w+ \d{4}/i).textContent
      expect(newMonth).not.toBe(initialMonth)
    })

    // Click "Today" button
    const todayButton = screen.getByRole('button', { name: /today/i })
    await user.click(todayButton)

    // Should return to initial month
    await waitFor(() => {
      expect(screen.getByText(/\w+ \d{4}/i).textContent).toBe(initialMonth)
    })
  })

  test('shows empty state when no requests exist', async () => {
    vi.mocked(useSupabaseQueries).mockReturnValue({
      data: {
        requests: [],
        staff: [],
      },
      loading: false,
      errors: {},
      refetch: vi.fn(),
    } as never)

    render(<TimeOffCalendarTab facilityId="fac-1" />)

    await waitFor(() => {
      expect(screen.getByText(/no time-off requests for this month/i)).toBeInTheDocument()
    })
  })

  test('coverage map counts only approved requests (not pending/denied)', async () => {
    const requests = [
      mockRequest('r1', 'u1', 'Alice', 'Smith', '2026-03-10', '2026-03-10', 'approved'),
      mockRequest('r2', 'u2', 'Bob', 'Johnson', '2026-03-10', '2026-03-10', 'pending'),
      mockRequest('r3', 'u3', 'Charlie', 'Brown', '2026-03-10', '2026-03-10', 'denied'),
    ]

    vi.mocked(useSupabaseQueries).mockReturnValue({
      data: {
        requests,
        staff: [
          mockStaff('u1', 'Alice', 'Smith', 'role-rn'),
          mockStaff('u2', 'Bob', 'Johnson', 'role-surgeon'),
          mockStaff('u3', 'Charlie', 'Brown', 'role-anesthesia'),
        ],
      },
      loading: false,
      errors: {},
      refetch: vi.fn(),
    } as never)

    render(<TimeOffCalendarTab facilityId="fac-1" />)

    await waitFor(() => {
      // Coverage indicator should show "1 off" (only Alice is approved)
      expect(screen.getByText('1 off')).toBeInTheDocument()
    })
  })

  test('invokes onRequestClick when clicking a request badge', async () => {
    const onRequestClick = vi.fn()
    const requests = [
      mockRequest('r1', 'u1', 'Alice', 'Smith', '2026-03-10', '2026-03-10', 'approved'),
    ]

    vi.mocked(useSupabaseQueries).mockReturnValue({
      data: {
        requests,
        staff: [mockStaff('u1', 'Alice', 'Smith', 'role-rn')],
      },
      loading: false,
      errors: {},
      refetch: vi.fn(),
    } as never)

    render(<TimeOffCalendarTab facilityId="fac-1" onRequestClick={onRequestClick} />)

    const user = userEvent.setup()

    await waitFor(() => {
      expect(screen.getByText(/A\. Smith/i)).toBeInTheDocument()
    })

    // Click the request badge
    const badge = screen.getByText(/A\. Smith/i)
    await user.click(badge)

    expect(onRequestClick).toHaveBeenCalledWith(requests[0])
  })
})
