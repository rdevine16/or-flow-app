import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import NewCasePage from '../PageClient'

// ============================================
// MOCKS
// ============================================

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

let mockCan = vi.fn()
let mockUserLoading = false

vi.mock('@/lib/UserContext', () => ({
  useUser: () => ({
    can: mockCan,
    loading: mockUserLoading,
    userData: { userId: 'user-1', firstName: 'Test', lastName: 'User' },
    effectiveFacilityId: 'facility-1',
  }),
}))

vi.mock('@/components/layouts/DashboardLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="dashboard-layout">{children}</div>,
}))

vi.mock('@/components/ui/AccessDenied', () => ({
  default: () => <div data-testid="access-denied">Access Denied</div>,
}))

vi.mock('@/components/cases/CaseForm', () => ({
  default: ({ mode }: { mode: string }) => <div data-testid="case-form">CaseForm ({mode})</div>,
}))

vi.mock('@/components/ui/Container', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="container">{children}</div>,
}))

vi.mock('@/components/ui/Card', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
}))

// ============================================
// TESTS
// ============================================

describe('New Case Page — Permission Guards', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUserLoading = false
    mockCan = vi.fn().mockReturnValue(true)
  })

  describe('Unit: Permission key checks', () => {
    it('checks can(cases.create) when user is loaded', async () => {
      mockCan = vi.fn((key: string) => key === 'cases.create')
      render(<NewCasePage />)

      await waitFor(() => {
        expect(mockCan).toHaveBeenCalledWith('cases.create')
      })
    })

    it('renders AccessDenied when can(cases.create) returns false', async () => {
      mockCan = vi.fn().mockReturnValue(false)
      render(<NewCasePage />)

      await waitFor(() => {
        expect(screen.getByTestId('access-denied')).toBeInTheDocument()
      })
    })

    it('does NOT render AccessDenied while user is loading', () => {
      mockUserLoading = true
      mockCan = vi.fn().mockReturnValue(false)
      render(<NewCasePage />)

      expect(screen.queryByTestId('access-denied')).not.toBeInTheDocument()
    })

    it('renders CaseForm when can(cases.create) returns true', async () => {
      mockCan = vi.fn((key: string) => key === 'cases.create')
      render(<NewCasePage />)

      await waitFor(() => {
        expect(screen.getByTestId('case-form')).toBeInTheDocument()
      })
    })
  })

  describe('Integration: AccessDenied replaces redirect', () => {
    it('shows AccessDenied UI instead of redirecting when permission denied', async () => {
      mockCan = vi.fn().mockReturnValue(false)
      render(<NewCasePage />)

      await waitFor(() => {
        expect(screen.getByTestId('access-denied')).toBeInTheDocument()
        // Verify NO redirect happens
        expect(mockPush).not.toHaveBeenCalled()
      })
    })

    it('renders AccessDenied within DashboardLayout (not bare)', async () => {
      mockCan = vi.fn().mockReturnValue(false)
      render(<NewCasePage />)

      await waitFor(() => {
        expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument()
        expect(screen.getByTestId('access-denied')).toBeInTheDocument()
      })
    })

    it('does NOT render form when permission denied', async () => {
      mockCan = vi.fn().mockReturnValue(false)
      render(<NewCasePage />)

      await waitFor(() => {
        expect(screen.queryByTestId('case-form')).not.toBeInTheDocument()
      })
    })
  })

  describe('Workflow: User journey with permission checks', () => {
    it('user clicks "New Case" button → denied cases.create → sees AccessDenied', async () => {
      mockCan = vi.fn((key: string) => key === 'cases.create' ? false : true)
      render(<NewCasePage />)

      await waitFor(() => {
        expect(screen.getByTestId('access-denied')).toBeInTheDocument()
      })

      // Verify form is not rendered
      expect(screen.queryByTestId('case-form')).not.toBeInTheDocument()
      // Verify no redirect happened (old behavior would have redirected to /cases)
      expect(mockPush).not.toHaveBeenCalled()
    })

    it('user has cases.create → sees form → can proceed to create', async () => {
      mockCan = vi.fn((key: string) => key === 'cases.create')
      render(<NewCasePage />)

      await waitFor(() => {
        expect(screen.getByTestId('case-form')).toBeInTheDocument()
        expect(screen.getByText('CaseForm (create)')).toBeInTheDocument()
      })

      expect(screen.queryByTestId('access-denied')).not.toBeInTheDocument()
    })
  })
})
