import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { UserProvider, useUser } from '../UserContext'

// ============================================
// MOCKS
// ============================================

const mockPush = vi.fn()
const mockReplace = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
}))

vi.mock('../impersonation', () => ({
  getImpersonationState: () => null,
}))

let mockUserRecord: Record<string, unknown> | null = null

vi.mock('../supabase', () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn(() =>
        Promise.resolve({ data: { user: { id: 'user-1', email: 'test@test.com' } }, error: null })
      ),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(() =>
        Promise.resolve({
          data: mockUserRecord,
          error: null,
        })
      ),
    })),
  }),
}))

// Helper to render a component that reads the UserContext
function TestConsumer() {
  const {
    isGlobalAdmin,
    isFacilityAdmin,
    isCoordinator,
    isAdmin,
    canCreateCases,
  } = useUser()

  return (
    <div>
      <span data-testid="isGlobalAdmin">{String(isGlobalAdmin)}</span>
      <span data-testid="isFacilityAdmin">{String(isFacilityAdmin)}</span>
      <span data-testid="isCoordinator">{String(isCoordinator)}</span>
      <span data-testid="isAdmin">{String(isAdmin)}</span>
      <span data-testid="canCreateCases">{String(canCreateCases)}</span>
    </div>
  )
}

// ============================================
// TESTS
// ============================================

describe('UserContext — Phase 2.3 Role-Based Access', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUserRecord = null
  })

  it('sets canCreateCases=true for global_admin', async () => {
    mockUserRecord = {
      first_name: 'Admin',
      last_name: 'User',
      access_level: 'global_admin',
      facility_id: 'facility-1',
      facilities: { name: 'Test Facility', timezone: 'America/New_York' },
    }

    render(
      <UserProvider>
        <TestConsumer />
      </UserProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('isGlobalAdmin').textContent).toBe('true')
      expect(screen.getByTestId('canCreateCases').textContent).toBe('true')
      expect(screen.getByTestId('isAdmin').textContent).toBe('true')
    })
  })

  it('sets canCreateCases=true for facility_admin', async () => {
    mockUserRecord = {
      first_name: 'Facility',
      last_name: 'Admin',
      access_level: 'facility_admin',
      facility_id: 'facility-1',
      facilities: { name: 'Test Facility', timezone: 'America/New_York' },
    }

    render(
      <UserProvider>
        <TestConsumer />
      </UserProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('isFacilityAdmin').textContent).toBe('true')
      expect(screen.getByTestId('canCreateCases').textContent).toBe('true')
      expect(screen.getByTestId('isAdmin').textContent).toBe('true')
    })
  })

  it('sets canCreateCases=true for coordinator', async () => {
    mockUserRecord = {
      first_name: 'Coord',
      last_name: 'User',
      access_level: 'coordinator',
      facility_id: 'facility-1',
      facilities: { name: 'Test Facility', timezone: 'America/New_York' },
    }

    render(
      <UserProvider>
        <TestConsumer />
      </UserProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('isCoordinator').textContent).toBe('true')
      expect(screen.getByTestId('canCreateCases').textContent).toBe('true')
      // Coordinator is NOT an admin
      expect(screen.getByTestId('isAdmin').textContent).toBe('false')
    })
  })

  it('sets canCreateCases=false for regular user', async () => {
    mockUserRecord = {
      first_name: 'Regular',
      last_name: 'User',
      access_level: 'user',
      facility_id: 'facility-1',
      facilities: { name: 'Test Facility', timezone: 'America/New_York' },
    }

    render(
      <UserProvider>
        <TestConsumer />
      </UserProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('canCreateCases').textContent).toBe('false')
      expect(screen.getByTestId('isAdmin').textContent).toBe('false')
      expect(screen.getByTestId('isCoordinator').textContent).toBe('false')
    })
  })
})
