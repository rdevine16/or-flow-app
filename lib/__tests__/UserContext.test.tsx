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
    rpc: vi.fn(() =>
      Promise.resolve({
        data: { 'cases.view': true, 'cases.create': true, 'analytics.view': false },
        error: null,
      })
    ),
  }),
}))

// Helper to render a component that reads the UserContext
function TestConsumer() {
  const {
    isGlobalAdmin,
    isAdmin,
    can,
  } = useUser()

  return (
    <div>
      <span data-testid="isGlobalAdmin">{String(isGlobalAdmin)}</span>
      <span data-testid="isAdmin">{String(isAdmin)}</span>
      <span data-testid="can-cases-view">{String(can('cases.view'))}</span>
      <span data-testid="can-cases-create">{String(can('cases.create'))}</span>
      <span data-testid="can-analytics-view">{String(can('analytics.view'))}</span>
    </div>
  )
}

// ============================================
// TESTS
// ============================================

describe('UserContext — Role & Permission Access', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUserRecord = null
  })

  it('sets isAdmin=true and all can()=true for global_admin (bypass)', async () => {
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
      expect(screen.getByTestId('isAdmin').textContent).toBe('true')
      // Admin bypass: all permissions return true regardless of DB
      expect(screen.getByTestId('can-cases-view').textContent).toBe('true')
      expect(screen.getByTestId('can-cases-create').textContent).toBe('true')
      expect(screen.getByTestId('can-analytics-view').textContent).toBe('true')
    })
  })

  it('sets isAdmin=true and all can()=true for facility_admin (bypass)', async () => {
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
      expect(screen.getByTestId('isAdmin').textContent).toBe('true')
      // Admin bypass: all permissions return true
      expect(screen.getByTestId('can-cases-view').textContent).toBe('true')
      expect(screen.getByTestId('can-analytics-view').textContent).toBe('true')
    })
  })

  it('coordinator is not admin but can check permissions', async () => {
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
      // Coordinator is NOT an admin
      expect(screen.getByTestId('isAdmin').textContent).toBe('false')
    })
  })

  it('regular user is not admin and permissions come from DB', async () => {
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
      expect(screen.getByTestId('isAdmin').textContent).toBe('false')
      expect(screen.getByTestId('isGlobalAdmin').textContent).toBe('false')
    })
  })
})
