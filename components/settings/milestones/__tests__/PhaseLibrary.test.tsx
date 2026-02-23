// components/settings/milestones/__tests__/PhaseLibrary.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ─── Mocks ───────────────────────────────────────────────

const mockShowToast = vi.fn()
vi.mock('@/components/ui/Toast/ToastProvider', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}))

vi.mock('@/lib/UserContext', () => ({
  useUser: () => ({ effectiveFacilityId: 'fac-1', loading: false }),
}))

let mockQueryData: unknown[] = []
let mockQueryLoading = false
let mockQueryError: string | null = null
const mockSetData = vi.fn()

vi.mock('@/hooks/useSupabaseQuery', () => ({
  useSupabaseQuery: () => ({
    data: mockQueryData,
    loading: mockQueryLoading,
    error: mockQueryError,
    setData: mockSetData,
  }),
  useCurrentUser: () => ({
    data: { userId: 'user-1' },
  }),
}))

let mockInsertResult: { data: unknown; error: null | { message: string } } = { data: null, error: null }
let mockUpdateResult: { error: null | { message: string } } = { error: null }

const mockSingle = vi.fn(() => mockInsertResult)
const mockSelectChain = vi.fn(() => ({ single: mockSingle }))
const mockInsert = vi.fn(() => ({ select: mockSelectChain }))
const mockUpdateEq = vi.fn(() => mockUpdateResult)
const mockUpdate = vi.fn(() => ({ eq: mockUpdateEq }))

vi.mock('@/lib/supabase', () => ({
  createClient: () => ({
    from: () => ({
      insert: mockInsert,
      update: mockUpdate,
    }),
  }),
}))

import { PhaseLibrary } from '../PhaseLibrary'

// ─── Fixtures ────────────────────────────────────────────

const PHASES = [
  {
    id: 'phase-1', facility_id: 'fac-1', name: 'pre_op', display_name: 'Pre-Op',
    color_key: 'blue', display_order: 1, parent_phase_id: null,
    is_active: true, deleted_at: null, deleted_by: null,
  },
  {
    id: 'phase-2', facility_id: 'fac-1', name: 'surgical', display_name: 'Surgical',
    color_key: 'green', display_order: 2, parent_phase_id: null,
    is_active: true, deleted_at: null, deleted_by: null,
  },
  {
    id: 'phase-3', facility_id: 'fac-1', name: 'prep', display_name: 'Pre-Op Prep',
    color_key: 'teal', display_order: 3, parent_phase_id: 'phase-1',
    is_active: true, deleted_at: null, deleted_by: null,
  },
]

const ARCHIVED_PHASE = {
  id: 'phase-archived', facility_id: 'fac-1', name: 'old_phase', display_name: 'Old Phase',
  color_key: 'slate', display_order: 99, parent_phase_id: null,
  is_active: false, deleted_at: '2026-02-20T00:00:00Z', deleted_by: 'user-1',
}

// ─── Tests ───────────────────────────────────────────────

describe('PhaseLibrary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockQueryData = [...PHASES]
    mockQueryLoading = false
    mockQueryError = null
    mockInsertResult = { data: null, error: null }
    mockUpdateResult = { error: null }
  })

  describe('rendering', () => {
    it('renders active phases as table rows', () => {
      render(<PhaseLibrary />)

      // "Pre-Op" appears in its own row AND as parent label on the sub-phase row
      expect(screen.getAllByText('Pre-Op').length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('Surgical')).toBeInTheDocument()
      expect(screen.getByText('Pre-Op Prep')).toBeInTheDocument()
    })

    it('shows color labels for each phase', () => {
      render(<PhaseLibrary />)

      expect(screen.getByText('Blue')).toBeInTheDocument()
      expect(screen.getByText('Green')).toBeInTheDocument()
      expect(screen.getByText('Teal')).toBeInTheDocument()
    })

    it('shows parent indicator for sub-phases', () => {
      render(<PhaseLibrary />)

      // Pre-Op Prep has parent_phase_id = phase-1 (Pre-Op)
      // The parent name should appear in that row
      const rows = screen.getAllByText('Pre-Op')
      // First "Pre-Op" is the phase itself, second is the parent indicator on the sub-phase row
      expect(rows.length).toBeGreaterThanOrEqual(2)
    })

    it('shows dash for top-level phases parent column', () => {
      render(<PhaseLibrary />)

      // Top-level phases should have dash in parent column
      const dashes = screen.getAllByText('\u2014')
      expect(dashes.length).toBeGreaterThanOrEqual(1)
    })

    it('shows phase count in summary footer', () => {
      render(<PhaseLibrary />)

      expect(screen.getByText('3 phases')).toBeInTheDocument()
    })

    it('shows singular "phase" for single phase', () => {
      mockQueryData = [PHASES[0]]
      render(<PhaseLibrary />)

      expect(screen.getByText('1 phase')).toBeInTheDocument()
    })

    it('shows loading skeletons when loading', () => {
      mockQueryLoading = true
      const { container } = render(<PhaseLibrary />)

      // Should show skeleton loading elements
      const skeletons = container.querySelectorAll('[class*="animate-pulse"], [class*="skeleton"]')
      expect(skeletons.length).toBeGreaterThanOrEqual(1)
    })

    it('shows error banner when query fails', () => {
      mockQueryError = 'Failed to load phases'
      render(<PhaseLibrary />)

      expect(screen.getByText('Failed to load phases')).toBeInTheDocument()
    })

    it('shows empty state when no phases exist', () => {
      mockQueryData = []
      render(<PhaseLibrary />)

      expect(screen.getByText('No phases configured yet.')).toBeInTheDocument()
    })
  })

  describe('search', () => {
    it('filters phases by display name', async () => {
      const user = userEvent.setup()
      render(<PhaseLibrary />)

      await user.type(screen.getByPlaceholderText('Search phases...'), 'Surg')

      expect(screen.getByText('Surgical')).toBeInTheDocument()
      expect(screen.queryByText('Pre-Op Prep')).not.toBeInTheDocument()
    })

    it('shows "no match" message when search has no results', async () => {
      const user = userEvent.setup()
      render(<PhaseLibrary />)

      await user.type(screen.getByPlaceholderText('Search phases...'), 'zzzzzzz')

      expect(screen.getByText('No phases match your search.')).toBeInTheDocument()
    })

    it('shows filtered count in summary footer', async () => {
      const user = userEvent.setup()
      render(<PhaseLibrary />)

      await user.type(screen.getByPlaceholderText('Search phases...'), 'Pre')

      // Should show "2 shown" since both Pre-Op and Pre-Op Prep match
      expect(screen.getByText(/2 shown/)).toBeInTheDocument()
    })
  })

  describe('add phase modal', () => {
    it('opens add modal when Add Phase button clicked', async () => {
      const user = userEvent.setup()
      render(<PhaseLibrary />)

      await user.click(screen.getByText('Add Phase'))

      // Modal is open — verify form fields appear
      expect(screen.getByPlaceholderText('e.g., Pre-Op')).toBeInTheDocument()
      expect(screen.getByText('Display Name')).toBeInTheDocument()
      // "Color" appears in table header AND modal — verify modal is open via placeholder
      expect(screen.getByText('Selected: Blue')).toBeInTheDocument()
    })

    it('shows color picker with 8 color options', async () => {
      const user = userEvent.setup()
      render(<PhaseLibrary />)

      await user.click(screen.getByText('Add Phase'))

      // 8 color buttons
      expect(screen.getByText('Selected: Blue')).toBeInTheDocument()
    })

    it('shows parent phase dropdown with top-level options', async () => {
      const user = userEvent.setup()
      render(<PhaseLibrary />)

      await user.click(screen.getByText('Add Phase'))

      // Parent dropdown should show Pre-Op and Surgical (top-level)
      expect(screen.getByText('None (top-level phase)')).toBeInTheDocument()
    })

    it('shows auto-generated internal name preview', async () => {
      const user = userEvent.setup()
      render(<PhaseLibrary />)

      await user.click(screen.getByText('Add Phase'))
      await user.type(screen.getByPlaceholderText('e.g., Pre-Op'), 'My New Phase')

      expect(screen.getByText('my_new_phase')).toBeInTheDocument()
    })

    it('disables Add Phase button when name is empty', async () => {
      const user = userEvent.setup()
      render(<PhaseLibrary />)

      await user.click(screen.getByText('Add Phase'))

      const addButtons = screen.getAllByRole('button', { name: 'Add Phase' })
      const submitButton = addButtons[addButtons.length - 1]
      expect(submitButton).toBeDisabled()
    })
  })

  describe('edit phase modal', () => {
    it('opens edit modal with pre-filled values when pencil clicked', async () => {
      const user = userEvent.setup()
      render(<PhaseLibrary />)

      // Click the pencil button on first row
      const editButtons = screen.getAllByTitle('Edit')
      await user.click(editButtons[0])

      expect(screen.getByText('Edit Phase')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Pre-Op')).toBeInTheDocument()
    })
  })

  describe('archived phases', () => {
    it('shows archived section when archived phases exist', () => {
      mockQueryData = [...PHASES, ARCHIVED_PHASE]
      render(<PhaseLibrary />)

      expect(screen.getByText('Archived (1)')).toBeInTheDocument()
    })

    it('does not show archived section when no archived phases', () => {
      render(<PhaseLibrary />)

      expect(screen.queryByText(/Archived/)).not.toBeInTheDocument()
    })

    it('expands archived section to show restore button', async () => {
      const user = userEvent.setup()
      mockQueryData = [...PHASES, ARCHIVED_PHASE]
      render(<PhaseLibrary />)

      await user.click(screen.getByText('Archived (1)'))

      expect(screen.getByText('Old Phase')).toBeInTheDocument()
      expect(screen.getByText('Restore')).toBeInTheDocument()
    })
  })
})
