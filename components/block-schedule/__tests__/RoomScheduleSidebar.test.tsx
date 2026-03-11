import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RoomScheduleSidebar } from '../RoomScheduleSidebar'
import type { Surgeon } from '@/hooks/useLookups'
import type { ExpandedBlock } from '@/types/block-scheduling'

// Mock supabase client
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockOrder = vi.fn()

vi.mock('@/lib/supabase', () => ({
  createClient: () => ({
    from: () => ({
      select: (...args: unknown[]) => {
        mockSelect(...args)
        return {
          eq: (...eqArgs: unknown[]) => {
            mockEq(...eqArgs)
            return {
              eq: (...eqArgs2: unknown[]) => {
                mockEq(...eqArgs2)
                return {
                  order: (...orderArgs: unknown[]) => {
                    mockOrder(...orderArgs)
                    return Promise.resolve({
                      data: mockStaffData,
                      error: null,
                    })
                  },
                }
              },
            }
          },
        }
      },
    }),
  }),
}))

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}))

// Test data
const mockSurgeons: Surgeon[] = [
  { id: 'surgeon-1', first_name: 'John', last_name: 'Smith' },
  { id: 'surgeon-2', first_name: 'Jane', last_name: 'Doe' },
  { id: 'surgeon-3', first_name: 'Bob', last_name: 'Jones' },
]

// Staff data returned by supabase mock
let mockStaffData = [
  {
    id: 'staff-1',
    first_name: 'Alice',
    last_name: 'Brown',
    email: 'alice@test.com',
    profile_image_url: null,
    role_id: 'role-nurse',
    facility_id: 'fac-1',
    user_roles: { name: 'nurse' },
  },
  {
    id: 'staff-2',
    first_name: 'Charlie',
    last_name: 'Wilson',
    email: 'charlie@test.com',
    profile_image_url: null,
    role_id: 'role-tech',
    facility_id: 'fac-1',
    user_roles: { name: 'scrub tech' },
  },
  {
    id: 'staff-3',
    first_name: 'Diana',
    last_name: 'Lee',
    email: 'diana@test.com',
    profile_image_url: null,
    role_id: 'role-nurse',
    facility_id: 'fac-1',
    user_roles: { name: 'nurse' },
  },
]

// Block schedule data — surgeon-1 has block on 2026-03-09 (Monday)
const mockBlocks: ExpandedBlock[] = [
  {
    block_id: 'block-1',
    surgeon_id: 'surgeon-1',
    surgeon_first_name: 'John',
    surgeon_last_name: 'Smith',
    surgeon_color: '#3B82F6',
    block_date: '2026-03-09',
    start_time: '07:00:00',
    end_time: '15:00:00',
    recurrence_type: 'weekly',
    is_facility_closed: false,
  },
]

const defaultProps = {
  facilityId: 'fac-1',
  surgeons: mockSurgeons,
  surgeonsLoading: false,
  currentWeekStart: new Date(2026, 2, 8), // Sun March 8, 2026
  onDateSelect: vi.fn(),
  blocks: mockBlocks,
}

describe('RoomScheduleSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStaffData = [
      {
        id: 'staff-1',
        first_name: 'Alice',
        last_name: 'Brown',
        email: 'alice@test.com',
        profile_image_url: null,
        role_id: 'role-nurse',
        facility_id: 'fac-1',
        user_roles: { name: 'nurse' },
      },
      {
        id: 'staff-2',
        first_name: 'Charlie',
        last_name: 'Wilson',
        email: 'charlie@test.com',
        profile_image_url: null,
        role_id: 'role-tech',
        facility_id: 'fac-1',
        user_roles: { name: 'scrub tech' },
      },
      {
        id: 'staff-3',
        first_name: 'Diana',
        last_name: 'Lee',
        email: 'diana@test.com',
        profile_image_url: null,
        role_id: 'role-nurse',
        facility_id: 'fac-1',
        user_roles: { name: 'nurse' },
      },
    ]
  })

  describe('rendering', () => {
    it('renders the Surgeons section header', () => {
      render(<RoomScheduleSidebar {...defaultProps} />)
      expect(screen.getByText('Surgeons')).toBeDefined()
    })

    it('renders the Staff section header', () => {
      render(<RoomScheduleSidebar {...defaultProps} />)
      expect(screen.getByText('Staff')).toBeDefined()
    })

    it('renders all surgeon cards', () => {
      render(<RoomScheduleSidebar {...defaultProps} />)
      expect(screen.getByText('Dr. Smith')).toBeDefined()
      expect(screen.getByText('Dr. Doe')).toBeDefined()
      expect(screen.getByText('Dr. Jones')).toBeDefined()
    })

    it('renders the search input', () => {
      render(<RoomScheduleSidebar {...defaultProps} />)
      expect(screen.getByPlaceholderText('Search people...')).toBeDefined()
    })

    it('renders mini calendar with month name', () => {
      render(<RoomScheduleSidebar {...defaultProps} />)
      expect(screen.getByText('March 2026')).toBeDefined()
    })
  })

  describe('surgeon block-time badges', () => {
    it('shows block day badge for surgeon with block time in current week', () => {
      // Block on 2026-03-09 (Monday) → DraggableSurgeonCard shows day badge
      const { container } = render(<RoomScheduleSidebar {...defaultProps} />)

      // Badge uses text-[10px] font size — unique to block day badges
      const dayBadges = container.querySelectorAll('.text-\\[10px\\]')
      const blockBadgeTexts = Array.from(dayBadges).map(el => el.textContent)
      // surgeon-1 has block on Monday → 'M' should appear in a badge
      expect(blockBadgeTexts.some(t => t?.includes('M'))).toBe(true)
    })
  })

  describe('staff grouping', () => {
    it('renders staff grouped by role', async () => {
      render(<RoomScheduleSidebar {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Nurses')).toBeDefined()
        expect(screen.getByText('Scrub Techs')).toBeDefined()
      })
    })

    it('shows staff count per role group', async () => {
      render(<RoomScheduleSidebar {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('(2)')).toBeDefined() // 2 nurses
        expect(screen.getByText('(1)')).toBeDefined() // 1 scrub tech
      })
    })

    it('renders staff names within groups', async () => {
      render(<RoomScheduleSidebar {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Alice Brown')).toBeDefined()
        expect(screen.getByText('Charlie Wilson')).toBeDefined()
        expect(screen.getByText('Diana Lee')).toBeDefined()
      })
    })
  })

  describe('search filtering', () => {
    it('filters surgeons by search query', async () => {
      const user = userEvent.setup()
      render(<RoomScheduleSidebar {...defaultProps} />)

      const searchInput = screen.getByPlaceholderText('Search people...')
      await user.type(searchInput, 'Smith')

      expect(screen.getByText('Dr. Smith')).toBeDefined()
      expect(screen.queryByText('Dr. Doe')).toBeNull()
      expect(screen.queryByText('Dr. Jones')).toBeNull()
    })

    it('filters staff by search query', async () => {
      const user = userEvent.setup()
      render(<RoomScheduleSidebar {...defaultProps} />)

      // Wait for staff to load
      await waitFor(() => {
        expect(screen.getByText('Alice Brown')).toBeDefined()
      })

      const searchInput = screen.getByPlaceholderText('Search people...')
      await user.type(searchInput, 'Wilson')

      expect(screen.getByText('Charlie Wilson')).toBeDefined()
      expect(screen.queryByText('Alice Brown')).toBeNull()
    })

    it('shows empty message when no surgeons match search', async () => {
      const user = userEvent.setup()
      render(<RoomScheduleSidebar {...defaultProps} />)

      const searchInput = screen.getByPlaceholderText('Search people...')
      await user.type(searchInput, 'zzzzzzz')

      expect(screen.getByText('No surgeons match search')).toBeDefined()
    })
  })

  describe('loading states', () => {
    it('shows loading spinner when surgeons are loading', () => {
      render(<RoomScheduleSidebar {...defaultProps} surgeonsLoading={true} />)
      // Loading spinner is an animated div, check it exists
      const spinners = document.querySelectorAll('.animate-spin')
      expect(spinners.length).toBeGreaterThan(0)
    })

    it('shows empty message when no surgeons exist', () => {
      render(<RoomScheduleSidebar {...defaultProps} surgeons={[]} />)
      expect(screen.getByText('No surgeons in facility')).toBeDefined()
    })
  })

  describe('calendar interaction', () => {
    it('calls onDateSelect when a date is clicked', async () => {
      const onDateSelect = vi.fn()
      const user = userEvent.setup()
      render(<RoomScheduleSidebar {...defaultProps} onDateSelect={onDateSelect} />)

      // Click on a date in the calendar (March 10)
      const dateButton = screen.getByRole('button', { name: '10' })
      await user.click(dateButton)

      expect(onDateSelect).toHaveBeenCalledOnce()
    })

    it('navigates to previous month', async () => {
      const user = userEvent.setup()
      render(<RoomScheduleSidebar {...defaultProps} />)

      // Find and click the previous month button (first ChevronLeft)
      const prevButtons = document.querySelectorAll('button')
      // The prev month button is the small one in the calendar header
      const prevButton = Array.from(prevButtons).find(
        (btn) => btn.querySelector('svg') && btn.className.includes('rounded-full')
      )
      expect(prevButton).toBeDefined()

      if (prevButton) {
        await user.click(prevButton)
        expect(screen.getByText('February 2026')).toBeDefined()
      }
    })
  })

  describe('facility scoping', () => {
    it('queries staff with facility_id filter', async () => {
      render(<RoomScheduleSidebar {...defaultProps} />)

      await waitFor(() => {
        expect(mockEq).toHaveBeenCalledWith('facility_id', 'fac-1')
      })
    })

    it('queries only active staff', async () => {
      render(<RoomScheduleSidebar {...defaultProps} />)

      await waitFor(() => {
        expect(mockEq).toHaveBeenCalledWith('is_active', true)
      })
    })
  })
})
