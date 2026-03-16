// app/settings/voice-commands/__tests__/PageClient.test.tsx
//
// Unit + integration tests for the voice commands settings page.
// Covers:
//  - Left panel renders milestones and actions with correct counts
//  - Tab switching clears selection
//  - Search filters objectives case-insensitively
//  - Selecting an objective shows alias groups in right panel
//  - Permission gating: read-only hides add/delete
//  - Empty states for no selection and no search results
//  - Loading and error states
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ============================================
// MOCKS — must be declared before component import
// ============================================

const mockShowToast = vi.fn()
vi.mock('@/components/ui/Toast/ToastProvider', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}))

vi.mock('@/lib/supabase', () => ({
  createClient: () => ({
    from: () => ({
      delete: vi.fn(() => ({ eq: vi.fn(() => ({ error: null })) })),
    }),
  }),
}))

vi.mock('@/components/ui/Loading', () => ({
  PageLoader: () => <div data-testid="page-loader">Loading...</div>,
}))

vi.mock('@/components/ui/ErrorBanner', () => ({
  ErrorBanner: ({ message }: { message?: string | null }) =>
    message ? <div data-testid="error-banner">{message}</div> : null,
}))

// Mock AliasGroupSection to avoid deep component tree
vi.mock('@/components/settings/voice-commands/AliasGroupSection', () => ({
  AliasGroupSection: (props: {
    actionType: string
    aliases: { id: string }[]
    readOnly?: boolean
  }) => (
    <div data-testid={`alias-group-${props.actionType}`}>
      group:{props.actionType}:count={props.aliases.length}:readOnly={String(!!props.readOnly)}
    </div>
  ),
}))

// ============================================
// MOCK DATA
// ============================================

const MILESTONE_TYPES = [
  { id: 'mt-1', name: 'patient_in', display_order: 1 },
  { id: 'mt-2', name: 'incision', display_order: 6 },
  { id: 'mt-3', name: 'closing', display_order: 7 },
]

const FACILITY_MILESTONES = [
  { id: 'fm-1', source_milestone_type_id: 'mt-1' },
  { id: 'fm-2', source_milestone_type_id: 'mt-2' },
  { id: 'fm-3', source_milestone_type_id: 'mt-3' },
]

// Facility aliases use facility_milestone_id (not milestone_type_id) per check constraint
const ALIASES = [
  { id: 'a-1', facility_id: 'fac-1', milestone_type_id: null, facility_milestone_id: 'fm-1', alias_phrase: 'patient is in', source_alias_id: null, is_active: true, deleted_at: null, created_at: '2025-01-01', updated_at: '2025-01-01', action_type: 'record', auto_learned: false },
  { id: 'a-2', facility_id: 'fac-1', milestone_type_id: null, facility_milestone_id: 'fm-1', alias_phrase: 'cancel patient in', source_alias_id: null, is_active: true, deleted_at: null, created_at: '2025-01-01', updated_at: '2025-01-01', action_type: 'cancel', auto_learned: true },
  { id: 'a-3', facility_id: 'fac-1', milestone_type_id: null, facility_milestone_id: 'fm-2', alias_phrase: 'start incision', source_alias_id: null, is_active: true, deleted_at: null, created_at: '2025-01-01', updated_at: '2025-01-01', action_type: 'record', auto_learned: false },
  { id: 'a-4', facility_id: 'fac-1', milestone_type_id: null, facility_milestone_id: null, alias_phrase: 'next patient please', source_alias_id: null, is_active: true, deleted_at: null, created_at: '2025-01-01', updated_at: '2025-01-01', action_type: 'next_patient', auto_learned: false },
]

// ============================================
// CONTROLLABLE MOCK STATE
// ============================================

let mockMilestoneData: typeof MILESTONE_TYPES | null = MILESTONE_TYPES
let mockMilestonesLoading = false
let mockMilestonesError: string | null = null
let mockFacilityMilestoneData: typeof FACILITY_MILESTONES | null = FACILITY_MILESTONES
let mockAliasData: typeof ALIASES | null = ALIASES
let mockAliasesLoading = false
let mockAliasesError: string | null = null
const mockRefetch = vi.fn()
let mockCanManage = true
let depsOneCallIndex = 0

vi.mock('@/hooks/useSupabaseQuery', () => ({
  useSupabaseQuery: vi.fn((_fn: unknown, opts: { deps: unknown[] }) => {
    const depsLength = (opts?.deps || []).length
    if (depsLength === 0) {
      // milestone_types query
      return { data: mockMilestoneData, loading: mockMilestonesLoading, error: mockMilestonesError, refetch: vi.fn() }
    }
    // Two queries with deps: [effectiveFacilityId]
    // Order: facility_milestones (1st), aliases (2nd) per render cycle
    const callIdx = depsOneCallIndex++
    if (callIdx % 2 === 0) {
      // facility_milestones query
      return { data: mockFacilityMilestoneData, loading: false, error: null, refetch: vi.fn() }
    }
    // aliases query
    return { data: mockAliasData, loading: mockAliasesLoading, error: mockAliasesError, refetch: mockRefetch }
  }),
}))

vi.mock('@/lib/UserContext', () => ({
  useUser: () => ({
    effectiveFacilityId: 'fac-1',
    loading: false,
    can: (key: string) => key === 'settings.voice_commands' ? mockCanManage : false,
    userData: { userId: 'user-1' },
    permissionsLoading: false,
    isGlobalAdmin: false,
    isAdmin: true,
  }),
}))

vi.mock('@/lib/dal/voice-commands', () => ({
  voiceCommandsDAL: {
    listByFacility: vi.fn(),
    deleteAlias: vi.fn(() => ({ success: true, error: null })),
  },
}))

import VoiceCommandsPageClient from '../PageClient'

// ============================================
// TESTS
// ============================================

describe('VoiceCommandsPageClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    depsOneCallIndex = 0
    mockMilestoneData = MILESTONE_TYPES
    mockMilestonesLoading = false
    mockMilestonesError = null
    mockFacilityMilestoneData = FACILITY_MILESTONES
    mockAliasData = ALIASES
    mockAliasesLoading = false
    mockAliasesError = null
    mockCanManage = true
  })

  // ------------------------------------------
  // Unit: Rendering states
  // ------------------------------------------

  describe('Unit: Rendering states', () => {
    it('shows loading state while milestones fetch', () => {
      mockMilestonesLoading = true
      render(<VoiceCommandsPageClient />)
      expect(screen.getByTestId('page-loader')).toBeInTheDocument()
    })

    it('shows error banner on milestone fetch failure', () => {
      mockMilestonesError = 'Failed to fetch milestone types'
      render(<VoiceCommandsPageClient />)
      expect(screen.getByTestId('error-banner')).toHaveTextContent('Failed to fetch milestone types')
    })

    it('shows empty selection state when no item selected', () => {
      render(<VoiceCommandsPageClient />)
      expect(screen.getByText('Select a command to view aliases')).toBeInTheDocument()
    })

    it('renders milestones tab with correct count', () => {
      render(<VoiceCommandsPageClient />)
      expect(screen.getByText('(3)')).toBeInTheDocument() // 3 milestones
    })

    it('renders actions tab with correct count', () => {
      render(<VoiceCommandsPageClient />)
      expect(screen.getByText('(5)')).toBeInTheDocument() // 5 utility actions
    })

    it('renders milestone items in left panel', () => {
      render(<VoiceCommandsPageClient />)
      expect(screen.getByText('Patient In')).toBeInTheDocument()
      expect(screen.getByText('Incision')).toBeInTheDocument()
      expect(screen.getByText('Closing')).toBeInTheDocument()
    })
  })

  // ------------------------------------------
  // Integration: Tab switching and search
  // ------------------------------------------

  describe('Integration: Tab switching and search', () => {
    it('switching to Actions tab shows utility actions', async () => {
      const user = userEvent.setup()
      render(<VoiceCommandsPageClient />)

      await user.click(screen.getByText(/^Actions/))

      expect(screen.getByText('Next Patient')).toBeInTheDocument()
      expect(screen.getByText('Surgeon Left')).toBeInTheDocument()
      expect(screen.getByText('Undo Last')).toBeInTheDocument()
      expect(screen.getByText('Confirm Pending')).toBeInTheDocument()
      expect(screen.getByText('Cancel Pending')).toBeInTheDocument()
    })

    it('switching tabs clears selection', async () => {
      const user = userEvent.setup()
      render(<VoiceCommandsPageClient />)

      // Select a milestone
      await user.click(screen.getByText('Patient In'))
      expect(screen.queryByText('Select a command to view aliases')).not.toBeInTheDocument()

      // Switch to actions tab
      await user.click(screen.getByText(/^Actions/))
      expect(screen.getByText('Select a command to view aliases')).toBeInTheDocument()
    })

    it('search filters milestones case-insensitively', async () => {
      const user = userEvent.setup()
      render(<VoiceCommandsPageClient />)

      await user.type(screen.getByPlaceholderText('Search commands...'), 'inci')

      expect(screen.getByText('Incision')).toBeInTheDocument()
      expect(screen.queryByText('Patient In')).not.toBeInTheDocument()
      expect(screen.queryByText('Closing')).not.toBeInTheDocument()
    })

    it('shows empty state when search has no results', async () => {
      const user = userEvent.setup()
      render(<VoiceCommandsPageClient />)

      await user.type(screen.getByPlaceholderText('Search commands...'), 'nonexistent')

      expect(screen.getByText('No matching commands')).toBeInTheDocument()
    })
  })

  // ------------------------------------------
  // Integration: Selection and alias groups
  // ------------------------------------------

  describe('Integration: Selection and alias groups', () => {
    it('selecting a milestone shows record and cancel alias groups', async () => {
      const user = userEvent.setup()
      render(<VoiceCommandsPageClient />)

      await user.click(screen.getByText('Patient In'))

      // Should show both record and cancel groups
      const recordGroup = screen.getByTestId('alias-group-record')
      const cancelGroup = screen.getByTestId('alias-group-cancel')
      expect(recordGroup).toHaveTextContent('group:record:count=1')
      expect(cancelGroup).toHaveTextContent('group:cancel:count=1')
    })

    it('selecting an action shows only that action type group', async () => {
      const user = userEvent.setup()
      render(<VoiceCommandsPageClient />)

      // Switch to actions tab
      await user.click(screen.getByText(/^Actions/))
      await user.click(screen.getByText('Next Patient'))

      const group = screen.getByTestId('alias-group-next_patient')
      expect(group).toHaveTextContent('group:next_patient:count=1')
      expect(screen.queryByTestId('alias-group-record')).not.toBeInTheDocument()
    })

    it('shows alias loading spinner while aliases fetch', async () => {
      mockAliasesLoading = true
      const user = userEvent.setup()
      render(<VoiceCommandsPageClient />)

      await user.click(screen.getByText('Patient In'))

      // The header should appear but no alias groups
      expect(screen.queryByTestId('alias-group-record')).not.toBeInTheDocument()
    })

    it('shows error banner on alias fetch failure', async () => {
      mockAliasesError = 'Alias fetch failed'
      const user = userEvent.setup()
      render(<VoiceCommandsPageClient />)

      await user.click(screen.getByText('Patient In'))

      expect(screen.getByTestId('error-banner')).toHaveTextContent('Alias fetch failed')
    })
  })

  // ------------------------------------------
  // Integration: Permission gating
  // ------------------------------------------

  describe('Integration: Permission gating', () => {
    it('passes readOnly=false when user has settings.voice_commands permission', async () => {
      mockCanManage = true
      const user = userEvent.setup()
      render(<VoiceCommandsPageClient />)

      await user.click(screen.getByText('Patient In'))

      const recordGroup = screen.getByTestId('alias-group-record')
      expect(recordGroup).toHaveTextContent('readOnly=false')
    })

    it('passes readOnly=true when user lacks settings.voice_commands permission', async () => {
      mockCanManage = false
      const user = userEvent.setup()
      render(<VoiceCommandsPageClient />)

      await user.click(screen.getByText('Patient In'))

      const recordGroup = screen.getByTestId('alias-group-record')
      expect(recordGroup).toHaveTextContent('readOnly=true')
    })
  })
})
