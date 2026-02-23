// app/settings/milestones/__tests__/page.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ─── Mocks ───────────────────────────────────────────────

const mockPush = vi.fn()
let mockTabParam: string | null = null

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: (key: string) => key === 'tab' ? mockTabParam : null,
    toString: () => mockTabParam ? `tab=${mockTabParam}` : '',
  }),
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/settings/milestones',
}))

const mockShowToast = vi.fn()
vi.mock('@/components/ui/Toast/ToastProvider', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}))

vi.mock('@/lib/UserContext', () => ({
  useUser: () => ({ effectiveFacilityId: 'fac-1', loading: false }),
}))

interface MockMilestone {
  id: string
  facility_id: string
  name: string
  display_name: string
  display_order: number
  pair_with_id: string | null
  pair_position: 'start' | 'end' | null
  source_milestone_type_id: string | null
  is_active: boolean
  deleted_at: string | null
  deleted_by: string | null
  min_minutes: number | null
  max_minutes: number | null
  validation_type: 'duration' | 'sequence_gap' | null
  phase_group: string | null
}

let mockMilestones: MockMilestone[] = []
let mockMilestonesLoading = false
const mockSetMilestones = vi.fn()

vi.mock('@/hooks/useSupabaseQuery', () => ({
  useSupabaseQuery: () => ({
    data: mockMilestones,
    loading: mockMilestonesLoading,
    error: null,
    setData: mockSetMilestones,
  }),
  useCurrentUser: () => ({
    data: { userId: 'user-1' },
  }),
}))

vi.mock('@/lib/supabase', () => ({
  createClient: () => ({
    from: () => ({
      select: vi.fn(() => ({ not: vi.fn(() => ({ data: [], error: null })) })),
      insert: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn(() => ({ data: null, error: null })) })) })),
      update: vi.fn(() => ({ eq: vi.fn(() => ({ error: null })) })),
    }),
  }),
}))

vi.mock('@/lib/audit-logger', () => ({
  milestoneTypeAudit: {
    created: vi.fn(),
    updated: vi.fn(),
    deleted: vi.fn(),
    restored: vi.fn(),
    linked: vi.fn(),
    unlinked: vi.fn(),
  },
}))

// Mock PhaseLibrary to avoid nested supabase queries
vi.mock('@/components/settings/milestones/PhaseLibrary', () => ({
  PhaseLibrary: () => <div data-testid="phase-library">Phase Library Content</div>,
}))

import MilestonesSettingsPage from '../page'

// ─── Fixtures ────────────────────────────────────────────

const MILESTONES: MockMilestone[] = [
  {
    id: 'm-1', facility_id: 'fac-1', name: 'patient_in', display_name: 'Patient In',
    display_order: 1, pair_with_id: null, pair_position: null,
    source_milestone_type_id: 'global-1', is_active: true,
    deleted_at: null, deleted_by: null, min_minutes: 1, max_minutes: 30,
    validation_type: 'sequence_gap', phase_group: 'pre_op',
  },
  {
    id: 'm-2', facility_id: 'fac-1', name: 'incision', display_name: 'Incision',
    display_order: 2, pair_with_id: null, pair_position: null,
    source_milestone_type_id: null, is_active: true,
    deleted_at: null, deleted_by: null, min_minutes: 5, max_minutes: 60,
    validation_type: 'sequence_gap', phase_group: 'surgical',
  },
  {
    id: 'm-3', facility_id: 'fac-1', name: 'anes_start', display_name: 'Anesthesia Start',
    display_order: 3, pair_with_id: 'm-4', pair_position: 'start',
    source_milestone_type_id: null, is_active: true,
    deleted_at: null, deleted_by: null, min_minutes: 2, max_minutes: 45,
    validation_type: 'duration', phase_group: 'pre_op',
  },
  {
    id: 'm-4', facility_id: 'fac-1', name: 'anes_end', display_name: 'Anesthesia End',
    display_order: 4, pair_with_id: 'm-3', pair_position: 'end',
    source_milestone_type_id: null, is_active: true,
    deleted_at: null, deleted_by: null, min_minutes: 2, max_minutes: 120,
    validation_type: 'sequence_gap', phase_group: 'post_op',
  },
]

// ─── Tests ───────────────────────────────────────────────

describe('MilestonesSettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTabParam = null
    mockMilestones = [...MILESTONES]
    mockMilestonesLoading = false
  })

  describe('tab navigation', () => {
    it('renders all 5 tab buttons', () => {
      render(<MilestonesSettingsPage />)

      // "Milestones" appears in page title + tab, so use getAllByText
      expect(screen.getAllByText('Milestones').length).toBeGreaterThanOrEqual(2)
      expect(screen.getByText('Phases')).toBeInTheDocument()
      expect(screen.getByText('Templates')).toBeInTheDocument()
      expect(screen.getByText('Procedures')).toBeInTheDocument()
      expect(screen.getByText('Surgeons')).toBeInTheDocument()
    })

    it('defaults to Milestones tab when no ?tab param', () => {
      render(<MilestonesSettingsPage />)

      // Should see milestone content (search input, Add Milestone button)
      expect(screen.getByPlaceholderText('Search milestones...')).toBeInTheDocument()
      expect(screen.getByText('Add Milestone')).toBeInTheDocument()
    })

    it('shows Phases tab when ?tab=phases', () => {
      mockTabParam = 'phases'
      render(<MilestonesSettingsPage />)

      expect(screen.getByTestId('phase-library')).toBeInTheDocument()
    })

    it('shows Templates placeholder when ?tab=templates', () => {
      mockTabParam = 'templates'
      render(<MilestonesSettingsPage />)

      expect(screen.getByText('Template builder will be available in the next phase.')).toBeInTheDocument()
    })

    it('shows Procedures placeholder when ?tab=procedures', () => {
      mockTabParam = 'procedures'
      render(<MilestonesSettingsPage />)

      expect(screen.getByText('Procedure template assignment will be available in a future phase.')).toBeInTheDocument()
    })

    it('shows Surgeons placeholder when ?tab=surgeons', () => {
      mockTabParam = 'surgeons'
      render(<MilestonesSettingsPage />)

      expect(screen.getByText('Surgeon template overrides will be available in a future phase.')).toBeInTheDocument()
    })

    it('updates URL when tab clicked', async () => {
      const user = userEvent.setup()
      render(<MilestonesSettingsPage />)

      await user.click(screen.getByText('Phases'))

      expect(mockPush).toHaveBeenCalledWith('/settings/milestones?tab=phases')
    })

    it('removes ?tab param when Milestones tab clicked', async () => {
      mockTabParam = 'phases'
      const user = userEvent.setup()
      render(<MilestonesSettingsPage />)

      // Need to find the tab button specifically (not just any "Milestones" text)
      const tabButtons = screen.getAllByRole('button')
      const milestonesTabBtn = tabButtons.find(btn => btn.textContent?.includes('Milestones'))
      if (milestonesTabBtn) {
        await user.click(milestonesTabBtn)
        expect(mockPush).toHaveBeenCalledWith('/settings/milestones')
      }
    })

    it('defaults to milestones for invalid tab param', () => {
      mockTabParam = 'nonexistent'
      render(<MilestonesSettingsPage />)

      // Should show milestone content
      expect(screen.getByPlaceholderText('Search milestones...')).toBeInTheDocument()
    })
  })

  describe('Milestones tab - table rendering', () => {
    it('renders milestone rows with display names', () => {
      render(<MilestonesSettingsPage />)

      expect(screen.getByText('Patient In')).toBeInTheDocument()
      expect(screen.getByText('Incision')).toBeInTheDocument()
      // Paired milestones appear in both name column and partner badge — use getAllByText
      expect(screen.getAllByText('Anesthesia Start').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Anesthesia End').length).toBeGreaterThanOrEqual(1)
    })

    it('shows pair badges for paired milestones', () => {
      render(<MilestonesSettingsPage />)

      expect(screen.getByText('Start')).toBeInTheDocument()
      expect(screen.getByText('End')).toBeInTheDocument()
    })

    it('shows validation range for milestones', () => {
      render(<MilestonesSettingsPage />)

      expect(screen.getByText('1\u201330 min')).toBeInTheDocument()
      expect(screen.getByText('5\u201360 min')).toBeInTheDocument()
    })

    it('shows milestone count in summary footer', () => {
      render(<MilestonesSettingsPage />)

      expect(screen.getByText('4 milestones')).toBeInTheDocument()
    })

    it('shows loading skeletons when loading', () => {
      mockMilestonesLoading = true
      const { container } = render(<MilestonesSettingsPage />)

      const skeletons = container.querySelectorAll('[class*="animate-pulse"], [class*="skeleton"]')
      expect(skeletons.length).toBeGreaterThanOrEqual(1)
    })

    it('shows empty state when no milestones', () => {
      mockMilestones = []
      render(<MilestonesSettingsPage />)

      expect(screen.getByText('No milestones configured yet.')).toBeInTheDocument()
    })
  })

  describe('Milestones tab - search', () => {
    it('filters milestones by search term', async () => {
      const user = userEvent.setup()
      render(<MilestonesSettingsPage />)

      await user.type(screen.getByPlaceholderText('Search milestones...'), 'Anes')

      // Paired names may appear in partner badges, so use getAllByText
      expect(screen.getAllByText('Anesthesia Start').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Anesthesia End').length).toBeGreaterThanOrEqual(1)
      expect(screen.queryByText('Patient In')).not.toBeInTheDocument()
      expect(screen.queryByText('Incision')).not.toBeInTheDocument()
    })

    it('shows no-match message when search finds nothing', async () => {
      const user = userEvent.setup()
      render(<MilestonesSettingsPage />)

      await user.type(screen.getByPlaceholderText('Search milestones...'), 'zzzzzz')

      expect(screen.getByText('No milestones match your search.')).toBeInTheDocument()
    })

    it('shows filtered count in footer when searching', async () => {
      const user = userEvent.setup()
      render(<MilestonesSettingsPage />)

      await user.type(screen.getByPlaceholderText('Search milestones...'), 'Anes')

      expect(screen.getByText(/2 shown/)).toBeInTheDocument()
    })
  })

  describe('Milestones tab - pair linking', () => {
    it('shows link button for unpaired milestones', () => {
      render(<MilestonesSettingsPage />)

      // Patient In and Incision are unpaired — should have link buttons
      const linkButtons = screen.getAllByTitle('Link with another milestone')
      expect(linkButtons.length).toBe(2) // Patient In and Incision
    })

    it('shows unlink button for paired milestones', () => {
      render(<MilestonesSettingsPage />)

      const unlinkButtons = screen.getAllByTitle('Unlink pair')
      expect(unlinkButtons.length).toBe(2) // Anes Start and Anes End
    })

    it('shows pair linking banner when link button clicked', async () => {
      const user = userEvent.setup()
      render(<MilestonesSettingsPage />)

      // Click link button on "Incision" (second unpaired milestone)
      const linkButtons = screen.getAllByTitle('Link with another milestone')
      await user.click(linkButtons[1])

      expect(screen.getByText(/Click another milestone to pair with/)).toBeInTheDocument()
    })

    it('shows cancel button in pair linking mode', async () => {
      const user = userEvent.setup()
      render(<MilestonesSettingsPage />)

      const linkButtons = screen.getAllByTitle('Link with another milestone')
      await user.click(linkButtons[0])

      expect(screen.getByText('Cancel')).toBeInTheDocument()
    })

    it('cancels pair linking when Cancel clicked', async () => {
      const user = userEvent.setup()
      render(<MilestonesSettingsPage />)

      const linkButtons = screen.getAllByTitle('Link with another milestone')
      await user.click(linkButtons[0])
      await user.click(screen.getByText('Cancel'))

      expect(screen.queryByText(/Click another milestone to pair with/)).not.toBeInTheDocument()
    })
  })

  describe('Milestones tab - actions', () => {
    it('shows edit button on each row', () => {
      render(<MilestonesSettingsPage />)

      const editButtons = screen.getAllByTitle('Edit')
      expect(editButtons.length).toBe(4)
    })

    it('shows archive button only for non-global milestones', () => {
      render(<MilestonesSettingsPage />)

      // Patient In is global (source_milestone_type_id is not null) — no archive button
      // Other 3 are custom — should have archive buttons
      const archiveButtons = screen.getAllByTitle('Archive')
      expect(archiveButtons.length).toBe(3)
    })

    it('opens edit modal when edit button clicked', async () => {
      const user = userEvent.setup()
      render(<MilestonesSettingsPage />)

      const editButtons = screen.getAllByTitle('Edit')
      await user.click(editButtons[0])

      expect(screen.getByText('Edit Milestone')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Patient In')).toBeInTheDocument()
    })

    it('opens add modal when Add Milestone button clicked', async () => {
      const user = userEvent.setup()
      render(<MilestonesSettingsPage />)

      await user.click(screen.getByText('Add Milestone'))

      expect(screen.getByPlaceholderText('e.g., Array Placement')).toBeInTheDocument()
    })
  })
})
