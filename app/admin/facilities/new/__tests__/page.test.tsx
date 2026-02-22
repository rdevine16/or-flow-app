// app/admin/facilities/new/__tests__/page.test.tsx
// Tests for the WizardShell (page.tsx) — navigation, progress indicator, validation gating, submission

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ============================================================================
// MOCKS — must be declared before component import
// ============================================================================

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

let mockIsGlobalAdmin = true
let mockUserLoading = false
vi.mock('@/lib/UserContext', () => ({
  useUser: () => ({
    isGlobalAdmin: mockIsGlobalAdmin,
    loading: mockUserLoading,
    userData: { userId: 'user-1' },
    effectiveFacilityId: 'facility-1',
    can: () => true,
    canAny: () => false,
    canAll: () => false,
    permissionsLoading: false,
    isAdmin: true,
    isImpersonating: false,
  }),
}))

const mockShowToast = vi.fn()
vi.mock('@/components/ui/Toast/ToastProvider', () => ({
  useToast: () => ({
    showToast: mockShowToast,
    toasts: [],
    dismissToast: vi.fn(),
    dismissAll: vi.fn(),
  }),
}))

vi.mock('@/components/layouts/DashboardLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dashboard-layout">{children}</div>
  ),
}))

vi.mock('@/hooks/useLookups', () => ({
  useUserRoles: vi.fn(() => ({
    data: [
      { id: 'role-1', name: 'admin' },
      { id: 'role-2', name: 'facility_manager' },
    ],
    loading: false,
    error: null,
    refresh: vi.fn(),
  })),
}))

// Supabase mock — template count queries all return count values
const mockSelect = vi.fn()
const mockRpc = vi.fn()
const mockInsert = vi.fn()
const mockGetSession = vi.fn()

function createChainableMock(resolvedValue: Record<string, unknown>) {
  const chain: Record<string, unknown> = {}
  const terminal = vi.fn().mockResolvedValue(resolvedValue)

  // Each chainable method returns the chain itself
  chain.select = vi.fn().mockReturnValue(chain)
  chain.eq = vi.fn().mockReturnValue(chain)
  chain.is = vi.fn().mockReturnValue(chain)
  chain.single = vi.fn().mockResolvedValue(resolvedValue)

  // For count queries, the chain resolves directly via the last method in the chain
  // Since the actual queries use .eq().is().eq()... chains that resolve via Promise.all,
  // we make every terminal method resolve to the count value
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop) {
      if (prop === 'then') {
        // Make the chain itself thenable (resolves as a promise)
        return terminal().then.bind(terminal())
      }
      if (typeof prop === 'string') {
        return vi.fn().mockReturnValue(new Proxy({}, handler))
      }
      return undefined
    },
  }

  return new Proxy({}, handler)
}

vi.mock('@/lib/supabase', () => ({
  createClient: () => ({
    from: vi.fn(() => {
      // Return a chainable mock that always resolves to { count: 5, error: null }
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: 'facility-1' }, error: null }),
        insert: mockInsert.mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: 'facility-1' }, error: null }),
          }),
        }),
        then: (resolve: (val: { count: number; error: null }) => void) =>
          resolve({ count: 5, error: null }),
      }
      return chain
    }),
    rpc: mockRpc.mockResolvedValue({ error: null }),
    auth: {
      getSession: mockGetSession.mockResolvedValue({
        data: { session: { access_token: 'test-token' } },
      }),
    },
  }),
}))

// Mock actions module to isolate submission testing
const mockCreateFacilityWithTemplates = vi.fn()
vi.mock('../actions', () => ({
  createFacilityWithTemplates: (...args: unknown[]) => mockCreateFacilityWithTemplates(...args),
}))

vi.mock('@/lib/audit-logger', () => ({
  facilityAudit: {
    created: vi.fn(),
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

// Import AFTER mocks
import CreateFacilityPage from '../page'

// ============================================================================
// TESTS
// ============================================================================

describe('CreateFacilityPage (WizardShell)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsGlobalAdmin = true
    mockUserLoading = false
    mockCreateFacilityWithTemplates.mockResolvedValue({
      success: true,
      facilityId: 'new-facility-id',
    })
  })

  // ============================================================================
  // AUTH GUARD
  // ============================================================================

  describe('Auth Guard', () => {
    it('shows loading spinner while user data is loading', () => {
      mockUserLoading = true
      render(<CreateFacilityPage />)
      expect(screen.getByTestId('dashboard-layout')).toBeTruthy()
      // Spinner should be present (animate-spin class)
      const spinner = document.querySelector('.animate-spin')
      expect(spinner).toBeTruthy()
    })

    it('redirects non-global-admin users to dashboard', () => {
      mockIsGlobalAdmin = false
      render(<CreateFacilityPage />)
      expect(mockPush).toHaveBeenCalledWith('/dashboard')
    })

    it('renders wizard for global admin users', () => {
      render(<CreateFacilityPage />)
      expect(screen.getByText('Create New Facility')).toBeTruthy()
    })
  })

  // ============================================================================
  // HEADER & PROGRESS INDICATOR
  // ============================================================================

  describe('Header & Progress Indicator', () => {
    it('renders page title and subtitle', () => {
      render(<CreateFacilityPage />)
      expect(screen.getByText('Create New Facility')).toBeTruthy()
      expect(screen.getByText('Set up a new customer in ORbit')).toBeTruthy()
    })

    it('renders the wizard progress indicator', () => {
      render(<CreateFacilityPage />)
      expect(screen.getByTestId('wizard-progress')).toBeTruthy()
    })

    it('renders all 5 step indicators', () => {
      render(<CreateFacilityPage />)
      for (let i = 1; i <= 5; i++) {
        expect(screen.getByTestId(`step-indicator-${i}`)).toBeTruthy()
      }
    })

    it('renders step labels in progress indicator', () => {
      render(<CreateFacilityPage />)
      const progress = screen.getByTestId('wizard-progress')
      expect(progress.textContent).toContain('Facility Details')
      expect(progress.textContent).toContain('Administrator')
      expect(progress.textContent).toContain('Clinical Templates')
      expect(progress.textContent).toContain('Operational Templates')
      expect(progress.textContent).toContain('Review & Create')
    })

    it('highlights step 1 as active on initial render', () => {
      render(<CreateFacilityPage />)
      const step1 = screen.getByTestId('step-indicator-1')
      expect(step1.className).toContain('bg-blue-600')
    })

    it('shows step 2-5 as upcoming on initial render', () => {
      render(<CreateFacilityPage />)
      for (let i = 2; i <= 5; i++) {
        const step = screen.getByTestId(`step-indicator-${i}`)
        expect(step.className).toContain('bg-slate-200')
      }
    })
  })

  // ============================================================================
  // STEP 1 RENDERING
  // ============================================================================

  describe('Step 1 — Facility Details', () => {
    it('renders FacilityStep on initial load', () => {
      render(<CreateFacilityPage />)
      expect(screen.getByTestId('facility-step')).toBeTruthy()
    })

    it('shows Cancel button (not Back) on step 1', () => {
      render(<CreateFacilityPage />)
      expect(screen.getByText('Cancel')).toBeTruthy()
    })

    it('navigates to facilities list when Cancel is clicked', () => {
      render(<CreateFacilityPage />)
      fireEvent.click(screen.getByText('Cancel'))
      expect(mockPush).toHaveBeenCalledWith('/admin/facilities')
    })

    it('shows Continue button on step 1', () => {
      render(<CreateFacilityPage />)
      expect(screen.getByText('Continue')).toBeTruthy()
    })

    it('disables Continue when name is empty', () => {
      render(<CreateFacilityPage />)
      // Default state has empty name, so Continue should be disabled
      const continueBtn = screen.getByText('Continue').closest('button')!
      expect(continueBtn.disabled).toBe(true)
    })
  })

  // ============================================================================
  // STEP NAVIGATION
  // ============================================================================

  describe('Step Navigation', () => {
    it('advances from step 1 to step 2 when valid and Continue clicked', async () => {
      const user = userEvent.setup()
      render(<CreateFacilityPage />)

      // Fill required fields: name (timezone has default)
      const nameInput = screen.getByTestId('facility-name-input')
      await user.type(nameInput, 'Test Facility')

      // Click Continue
      const continueBtn = screen.getByText('Continue').closest('button')!
      await user.click(continueBtn)

      // Should now show admin step
      expect(screen.getByTestId('admin-step')).toBeTruthy()
    })

    it('shows Back button on step 2', async () => {
      const user = userEvent.setup()
      render(<CreateFacilityPage />)

      // Navigate to step 2
      const nameInput = screen.getByTestId('facility-name-input')
      await user.type(nameInput, 'Test Facility')
      await user.click(screen.getByText('Continue').closest('button')!)

      // Should show Back
      expect(screen.getByText('Back')).toBeTruthy()
    })

    it('navigates back from step 2 to step 1', async () => {
      const user = userEvent.setup()
      render(<CreateFacilityPage />)

      // Navigate to step 2
      const nameInput = screen.getByTestId('facility-name-input')
      await user.type(nameInput, 'Test Facility')
      await user.click(screen.getByText('Continue').closest('button')!)
      expect(screen.getByTestId('admin-step')).toBeTruthy()

      // Go back
      await user.click(screen.getByText('Back'))
      expect(screen.getByTestId('facility-step')).toBeTruthy()
    })

    it('preserves facility data when navigating back and forward', async () => {
      const user = userEvent.setup()
      render(<CreateFacilityPage />)

      // Fill name
      const nameInput = screen.getByTestId('facility-name-input')
      await user.type(nameInput, 'Pacific Surgery Center')

      // Go forward then back
      await user.click(screen.getByText('Continue').closest('button')!)
      await user.click(screen.getByText('Back'))

      // Name should persist
      const nameInputAfter = screen.getByTestId('facility-name-input') as HTMLInputElement
      expect(nameInputAfter.value).toBe('Pacific Surgery Center')
    })

    it('updates progress indicator as steps advance', async () => {
      const user = userEvent.setup()
      render(<CreateFacilityPage />)

      // Fill step 1 and advance
      await user.type(screen.getByTestId('facility-name-input'), 'Test')
      await user.click(screen.getByText('Continue').closest('button')!)

      // Step 1 should be completed (green), step 2 active (blue)
      const step1 = screen.getByTestId('step-indicator-1')
      const step2 = screen.getByTestId('step-indicator-2')
      expect(step1.className).toContain('bg-green-500')
      expect(step2.className).toContain('bg-blue-600')
    })
  })

  // ============================================================================
  // VALIDATION GATING
  // ============================================================================

  describe('Validation Gating', () => {
    it('does not advance past step 1 when name is empty', async () => {
      const user = userEvent.setup()
      render(<CreateFacilityPage />)

      // Try to click Continue (should be disabled)
      const continueBtn = screen.getByText('Continue').closest('button')!
      expect(continueBtn.disabled).toBe(true)

      // Still on step 1
      expect(screen.getByTestId('facility-step')).toBeTruthy()
    })

    it('does not advance past step 2 when admin fields are incomplete', async () => {
      const user = userEvent.setup()
      render(<CreateFacilityPage />)

      // Complete step 1
      await user.type(screen.getByTestId('facility-name-input'), 'Test')
      await user.click(screen.getByText('Continue').closest('button')!)

      // On step 2 now — leave fields empty, Continue should be disabled
      const continueBtn = screen.getByText('Continue').closest('button')!
      expect(continueBtn.disabled).toBe(true)
    })

    it('allows advancing past step 2 when all admin fields are valid', async () => {
      const user = userEvent.setup()
      render(<CreateFacilityPage />)

      // Complete step 1
      await user.type(screen.getByTestId('facility-name-input'), 'Test')
      await user.click(screen.getByText('Continue').closest('button')!)

      // Complete step 2
      await user.type(screen.getByTestId('admin-first-name-input'), 'Jane')
      await user.type(screen.getByTestId('admin-last-name-input'), 'Smith')
      await user.type(screen.getByTestId('admin-email-input'), 'jane@test.com')
      fireEvent.change(screen.getByTestId('admin-role-select'), { target: { value: 'role-1' } })

      const continueBtn = screen.getByText('Continue').closest('button')!
      expect(continueBtn.disabled).toBe(false)
    })

    it('always allows advancing from steps 3 and 4 (template steps)', async () => {
      const user = userEvent.setup()
      render(<CreateFacilityPage />)

      // Navigate through steps 1 and 2
      await user.type(screen.getByTestId('facility-name-input'), 'Test')
      await user.click(screen.getByText('Continue').closest('button')!)

      await user.type(screen.getByTestId('admin-first-name-input'), 'Jane')
      await user.type(screen.getByTestId('admin-last-name-input'), 'Smith')
      await user.type(screen.getByTestId('admin-email-input'), 'jane@test.com')
      fireEvent.change(screen.getByTestId('admin-role-select'), { target: { value: 'role-1' } })
      await user.click(screen.getByText('Continue').closest('button')!)

      // Step 3 — Continue should be enabled
      expect(screen.getByTestId('clinical-templates-step')).toBeTruthy()
      const continueBtnStep3 = screen.getByText('Continue').closest('button')!
      expect(continueBtnStep3.disabled).toBe(false)
    })
  })

  // ============================================================================
  // STEP 5 — CREATE FACILITY BUTTON
  // ============================================================================

  describe('Step 5 — Create Facility', () => {
    async function navigateToStep5(user: ReturnType<typeof userEvent.setup>) {
      render(<CreateFacilityPage />)

      // Step 1
      await user.type(screen.getByTestId('facility-name-input'), 'Test Facility')
      await user.click(screen.getByText('Continue').closest('button')!)

      // Step 2
      await user.type(screen.getByTestId('admin-first-name-input'), 'Jane')
      await user.type(screen.getByTestId('admin-last-name-input'), 'Smith')
      await user.type(screen.getByTestId('admin-email-input'), 'jane@test.com')
      fireEvent.change(screen.getByTestId('admin-role-select'), { target: { value: 'role-1' } })
      await user.click(screen.getByText('Continue').closest('button')!)

      // Step 3
      await user.click(screen.getByText('Continue').closest('button')!)

      // Step 4
      await user.click(screen.getByText('Continue').closest('button')!)

      // Now on step 5
    }

    it('shows "Create Facility" button on step 5 instead of Continue', async () => {
      const user = userEvent.setup()
      await navigateToStep5(user)

      expect(screen.getByText('Create Facility')).toBeTruthy()
      expect(screen.queryByText('Continue')).toBeNull()
    })

    it('shows ReviewStep on step 5', async () => {
      const user = userEvent.setup()
      await navigateToStep5(user)

      expect(screen.getByTestId('review-step')).toBeTruthy()
    })

    it('calls createFacilityWithTemplates on submit', async () => {
      const user = userEvent.setup()
      await navigateToStep5(user)

      await user.click(screen.getByText('Create Facility'))

      await waitFor(() => {
        expect(mockCreateFacilityWithTemplates).toHaveBeenCalledTimes(1)
      })
    })

    it('passes correct facility data to submission', async () => {
      const user = userEvent.setup()
      await navigateToStep5(user)

      await user.click(screen.getByText('Create Facility'))

      await waitFor(() => {
        expect(mockCreateFacilityWithTemplates).toHaveBeenCalledWith(
          expect.objectContaining({
            facilityData: expect.objectContaining({
              name: 'Test Facility',
            }),
            adminData: expect.objectContaining({
              firstName: 'Jane',
              lastName: 'Smith',
              email: 'jane@test.com',
              roleId: 'role-1',
            }),
          }),
        )
      })
    })

    it('shows success screen on successful submission', async () => {
      const user = userEvent.setup()
      await navigateToStep5(user)

      await user.click(screen.getByText('Create Facility'))

      await waitFor(() => {
        expect(screen.getByTestId('success-screen')).toBeTruthy()
      })
      expect(screen.getByText('Facility Created')).toBeTruthy()
      expect(screen.getByTestId('view-facility-btn')).toBeTruthy()
      expect(screen.getByTestId('create-another-btn')).toBeTruthy()
    })

    it('shows error toast on failed submission', async () => {
      mockCreateFacilityWithTemplates.mockResolvedValue({
        success: false,
        error: 'Database error occurred',
      })

      const user = userEvent.setup()
      await navigateToStep5(user)

      await user.click(screen.getByText('Create Facility'))

      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'error',
            title: 'Create Facility Failed',
          }),
        )
      })
      // Should NOT show success screen or redirect
      expect(screen.queryByTestId('success-screen')).toBeNull()
    })

    it('shows invite warning toast and success screen when inviteWarning is returned', async () => {
      mockCreateFacilityWithTemplates.mockResolvedValue({
        success: true,
        facilityId: 'new-facility-id',
        inviteWarning: 'Failed to send invite',
      })

      const user = userEvent.setup()
      await navigateToStep5(user)

      await user.click(screen.getByText('Create Facility'))

      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'error',
            title: 'Invite Warning',
            message: 'Failed to send invite',
          }),
        )
      })
      // Should still show success screen (facility was created)
      expect(screen.getByTestId('success-screen')).toBeTruthy()
    })
  })

  // ============================================================================
  // FULL WIZARD WORKFLOW
  // ============================================================================

  describe('Full Wizard Workflow', () => {
    it('navigates through all 5 steps and back to step 1', async () => {
      const user = userEvent.setup()
      render(<CreateFacilityPage />)

      // Step 1 → 2
      expect(screen.getByTestId('facility-step')).toBeTruthy()
      await user.type(screen.getByTestId('facility-name-input'), 'Test')
      await user.click(screen.getByText('Continue').closest('button')!)

      // Step 2 → 3
      expect(screen.getByTestId('admin-step')).toBeTruthy()
      await user.type(screen.getByTestId('admin-first-name-input'), 'Jane')
      await user.type(screen.getByTestId('admin-last-name-input'), 'Smith')
      await user.type(screen.getByTestId('admin-email-input'), 'jane@test.com')
      fireEvent.change(screen.getByTestId('admin-role-select'), { target: { value: 'role-1' } })
      await user.click(screen.getByText('Continue').closest('button')!)

      // Step 3 → 4
      expect(screen.getByTestId('clinical-templates-step')).toBeTruthy()
      await user.click(screen.getByText('Continue').closest('button')!)

      // Step 4 → 5
      expect(screen.getByTestId('operational-templates-step')).toBeTruthy()
      await user.click(screen.getByText('Continue').closest('button')!)

      // Step 5
      expect(screen.getByTestId('review-step')).toBeTruthy()

      // Navigate all the way back
      await user.click(screen.getByText('Back'))
      expect(screen.getByTestId('operational-templates-step')).toBeTruthy()

      await user.click(screen.getByText('Back'))
      expect(screen.getByTestId('clinical-templates-step')).toBeTruthy()

      await user.click(screen.getByText('Back'))
      expect(screen.getByTestId('admin-step')).toBeTruthy()

      await user.click(screen.getByText('Back'))
      expect(screen.getByTestId('facility-step')).toBeTruthy()
    })

    it('progress indicator shows correct states throughout navigation', async () => {
      const user = userEvent.setup()
      render(<CreateFacilityPage />)

      // Navigate to step 3
      await user.type(screen.getByTestId('facility-name-input'), 'Test')
      await user.click(screen.getByText('Continue').closest('button')!)

      await user.type(screen.getByTestId('admin-first-name-input'), 'Jane')
      await user.type(screen.getByTestId('admin-last-name-input'), 'Smith')
      await user.type(screen.getByTestId('admin-email-input'), 'jane@test.com')
      fireEvent.change(screen.getByTestId('admin-role-select'), { target: { value: 'role-1' } })
      await user.click(screen.getByText('Continue').closest('button')!)

      // On step 3: steps 1,2 completed (green), step 3 active (blue), steps 4,5 upcoming (gray)
      expect(screen.getByTestId('step-indicator-1').className).toContain('bg-green-500')
      expect(screen.getByTestId('step-indicator-2').className).toContain('bg-green-500')
      expect(screen.getByTestId('step-indicator-3').className).toContain('bg-blue-600')
      expect(screen.getByTestId('step-indicator-4').className).toContain('bg-slate-200')
      expect(screen.getByTestId('step-indicator-5').className).toContain('bg-slate-200')
    })
  })
})
