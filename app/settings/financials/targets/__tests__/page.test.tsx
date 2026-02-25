// app/settings/financials/targets/__tests__/page.test.tsx
// Unit + Integration tests for the Financial Targets settings page

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'

// ============================================
// MOCKS
// ============================================

// Build a re-usable chainable Supabase mock
function makeSupabaseMock(
  data: Array<{ id: string; month: number; profit_target: number }> = [],
) {
  const orderFn = vi.fn().mockResolvedValue({ data, error: null })
  const eqYear = vi.fn().mockReturnValue({ order: orderFn })
  const eqFacility = vi.fn().mockReturnValue({ eq: eqYear })
  const selectFn = vi.fn().mockReturnValue({ eq: eqFacility })
  const insertFn = vi.fn().mockResolvedValue({ data: null, error: null })
  const updateEq = vi.fn().mockResolvedValue({ data: null, error: null })
  const updateFn = vi.fn().mockReturnValue({ eq: updateEq })
  const deleteEq = vi.fn().mockResolvedValue({ data: null, error: null })
  const deleteFn = vi.fn().mockReturnValue({ eq: deleteEq })
  const fromFn = vi.fn().mockReturnValue({
    select: selectFn,
    insert: insertFn,
    update: updateFn,
    delete: deleteFn,
  })

  return { from: fromFn, _select: selectFn, _insert: insertFn }
}

let mockClient = makeSupabaseMock()

vi.mock('@/lib/supabase', () => ({
  createClient: () => mockClient,
}))

vi.mock('@/lib/UserContext', () => ({
  useUser: () => ({
    effectiveFacilityId: 'facility-123',
    loading: false,
  }),
}))

const mockShowToast = vi.fn()
vi.mock('@/components/ui/Toast/ToastProvider', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}))

vi.mock('@/components/ui/Loading', () => ({
  PageLoader: ({ message }: { message: string }) => <div data-testid="loader">{message}</div>,
}))
vi.mock('@/components/ui/ErrorBanner', () => ({
  ErrorBanner: ({ message }: { message: string | null }) =>
    message ? <div data-testid="error-banner">{message}</div> : null,
}))

import FinancialTargetsPage from '../PageClient'

// ============================================
// TESTS
// ============================================

describe('FinancialTargetsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockClient = makeSupabaseMock()
  })

  describe('Rendering', () => {
    it('renders the page title and description', () => {
      render(<FinancialTargetsPage />)

      expect(screen.getByText('Monthly Profit Targets')).toBeDefined()
      expect(
        screen.getByText('Set monthly profit targets shown on the financial analytics overview'),
      ).toBeDefined()
    })

    it('renders all 12 months after loading', async () => {
      render(<FinancialTargetsPage />)

      await waitFor(() => {
        expect(screen.getByText('January')).toBeDefined()
        expect(screen.getByText('December')).toBeDefined()
      })
    })

    it('shows current month badge', async () => {
      render(<FinancialTargetsPage />)

      await waitFor(() => {
        expect(screen.getByText('Current')).toBeDefined()
      })
    })

    it('displays existing target values', async () => {
      mockClient = makeSupabaseMock([
        { id: 'target-1', month: 1, profit_target: 50000 },
        { id: 'target-6', month: 6, profit_target: 75000 },
      ])

      render(<FinancialTargetsPage />)

      await waitFor(() => {
        expect(screen.getByText('$50,000')).toBeDefined()
        expect(screen.getByText('$75,000')).toBeDefined()
      })
    })

    it('shows dash for months without targets', async () => {
      mockClient = makeSupabaseMock([{ id: 'target-1', month: 1, profit_target: 50000 }])

      render(<FinancialTargetsPage />)

      await waitFor(() => {
        const dashes = screen.getAllByText('—')
        expect(dashes.length).toBe(11)
      })
    })
  })

  describe('Year Navigation', () => {
    it('shows current year by default', async () => {
      render(<FinancialTargetsPage />)

      const currentYear = new Date().getFullYear()
      await waitFor(() => {
        expect(screen.getByText(String(currentYear))).toBeDefined()
      })
    })
  })

  describe('Summary Stats', () => {
    it('calculates annual total correctly', async () => {
      mockClient = makeSupabaseMock([
        { id: 't-1', month: 1, profit_target: 10000 },
        { id: 't-2', month: 2, profit_target: 20000 },
      ])

      render(<FinancialTargetsPage />)

      await waitFor(() => {
        expect(screen.getByText('$30,000')).toBeDefined()
        expect(screen.getByText('2/12')).toBeDefined()
      })
    })
  })

  describe('Inline Editing', () => {
    it('shows input field when edit button is clicked', async () => {
      render(<FinancialTargetsPage />)

      await waitFor(() => {
        expect(screen.getByText('January')).toBeDefined()
      })

      const editButtons = screen.getAllByTitle('Edit target')
      await act(async () => {
        fireEvent.click(editButtons[0])
      })

      expect(screen.getByPlaceholderText('0')).toBeDefined()
    })

    it('shows save and cancel buttons during editing', async () => {
      render(<FinancialTargetsPage />)

      await waitFor(() => {
        expect(screen.getByText('January')).toBeDefined()
      })

      const editButtons = screen.getAllByTitle('Edit target')
      await act(async () => {
        fireEvent.click(editButtons[0])
      })

      expect(screen.getByTitle('Save')).toBeDefined()
      expect(screen.getByTitle('Cancel')).toBeDefined()
    })

    it('cancels editing when Cancel is clicked', async () => {
      render(<FinancialTargetsPage />)

      await waitFor(() => {
        expect(screen.getByText('January')).toBeDefined()
      })

      const editButtons = screen.getAllByTitle('Edit target')
      await act(async () => {
        fireEvent.click(editButtons[0])
      })

      await act(async () => {
        fireEvent.click(screen.getByTitle('Cancel'))
      })

      expect(screen.queryByPlaceholderText('0')).toBeNull()
    })
  })

  describe('Help text', () => {
    it('renders explanation of how targets are used', async () => {
      render(<FinancialTargetsPage />)

      await waitFor(() => {
        expect(screen.getByText(/reference line/i)).toBeDefined()
      })
    })
  })
})
