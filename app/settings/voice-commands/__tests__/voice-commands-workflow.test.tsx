// app/settings/voice-commands/__tests__/voice-commands-workflow.test.tsx
//
// End-to-end workflow tests for voice command settings.
// Covers:
//  - Full flow: navigate → select milestone → see aliases → switch tabs → select action
//  - Permission-gated workflow: read-only user can browse but not modify
//  - Search → select → verify → clear search → verify list restores
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ============================================
// MOCKS
// ============================================

const mockShowToast = vi.fn()
vi.mock('@/components/ui/Toast/ToastProvider', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}))

vi.mock('@/lib/supabase', () => ({
  createClient: () => 'mock-client',
}))

vi.mock('@/components/ui/Loading', () => ({
  PageLoader: () => <div data-testid="page-loader">Loading...</div>,
}))

vi.mock('@/components/ui/ErrorBanner', () => ({
  ErrorBanner: ({ message }: { message?: string | null }) =>
    message ? <div data-testid="error-banner">{message}</div> : null,
}))

const mockDeleteAlias = vi.fn()
const mockCheckDuplicate = vi.fn()
const mockAddAlias = vi.fn()

vi.mock('@/lib/dal/voice-commands', () => ({
  voiceCommandsDAL: {
    listByFacility: vi.fn(),
    deleteAlias: (...args: unknown[]) => mockDeleteAlias(...args),
    checkDuplicate: (...args: unknown[]) => mockCheckDuplicate(...args),
    addAlias: (...args: unknown[]) => mockAddAlias(...args),
  },
}))

// ============================================
// MOCK DATA
// ============================================

const MILESTONE_TYPES = [
  { id: 'mt-1', name: 'patient_in', display_order: 1 },
  { id: 'mt-2', name: 'incision', display_order: 6 },
]

const FACILITY_MILESTONES = [
  { id: 'fm-1', source_milestone_type_id: 'mt-1' },
  { id: 'fm-2', source_milestone_type_id: 'mt-2' },
]

// Facility aliases use facility_milestone_id (not milestone_type_id) per check constraint
const ALIASES = [
  { id: 'a-1', facility_id: 'fac-1', milestone_type_id: null, facility_milestone_id: 'fm-1', alias_phrase: 'patient is in', source_alias_id: null, is_active: true, deleted_at: null, created_at: '2025-01-01', updated_at: '2025-01-01', action_type: 'record', auto_learned: false },
  { id: 'a-2', facility_id: 'fac-1', milestone_type_id: null, facility_milestone_id: 'fm-1', alias_phrase: 'undo patient in', source_alias_id: null, is_active: true, deleted_at: null, created_at: '2025-01-01', updated_at: '2025-01-01', action_type: 'cancel', auto_learned: true },
  { id: 'a-3', facility_id: 'fac-1', milestone_type_id: null, facility_milestone_id: null, alias_phrase: 'next patient please', source_alias_id: null, is_active: true, deleted_at: null, created_at: '2025-01-01', updated_at: '2025-01-01', action_type: 'next_patient', auto_learned: false },
]

let mockCanManage = true
const mockRefetch = vi.fn()
let depsOneCallIndex = 0

vi.mock('@/hooks/useSupabaseQuery', () => ({
  useSupabaseQuery: vi.fn((_fn: unknown, opts: { deps: unknown[] }) => {
    const depsLength = (opts?.deps || []).length
    if (depsLength === 0) {
      return { data: MILESTONE_TYPES, loading: false, error: null, refetch: vi.fn() }
    }
    // Two queries with deps: [effectiveFacilityId]
    // Order: facility_milestones (1st), aliases (2nd) per render cycle
    const callIdx = depsOneCallIndex++
    if (callIdx % 2 === 0) {
      return { data: FACILITY_MILESTONES, loading: false, error: null, refetch: vi.fn() }
    }
    return { data: ALIASES, loading: false, error: null, refetch: mockRefetch }
  }),
}))

vi.mock('@/lib/UserContext', () => ({
  useUser: () => ({
    effectiveFacilityId: 'fac-1',
    loading: false,
    can: (key: string) => key === 'settings.manage' ? mockCanManage : false,
    userData: { userId: 'user-1' },
    permissionsLoading: false,
    isGlobalAdmin: false,
    isAdmin: true,
  }),
}))

import VoiceCommandsPageClient from '../PageClient'

// ============================================
// TESTS
// ============================================

describe('Voice Commands Workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    depsOneCallIndex = 0
    mockCanManage = true
    mockDeleteAlias.mockResolvedValue({ success: true, error: null })
    mockCheckDuplicate.mockResolvedValue({ data: null, error: null })
    mockAddAlias.mockResolvedValue({ data: { id: 'new-1' }, error: null })
  })

  describe('Workflow: Browse milestones → select → see aliases → switch to actions', () => {
    it('completes full browse flow', async () => {
      const user = userEvent.setup()
      render(<VoiceCommandsPageClient />)

      // Step 1: See milestones listed
      expect(screen.getByText('Patient In')).toBeInTheDocument()
      expect(screen.getByText('Incision')).toBeInTheDocument()

      // Step 2: Select Patient In → see alias groups
      await user.click(screen.getByText('Patient In'))
      expect(screen.getByText('patient is in')).toBeInTheDocument()
      expect(screen.getByText('undo patient in')).toBeInTheDocument()

      // Step 3: Check AI Learned badge appears for auto_learned alias
      expect(screen.getByText('AI Learned')).toBeInTheDocument()

      // Step 4: Switch to Actions tab
      await user.click(screen.getByText(/^Actions/))
      // Selection cleared — empty state returns
      expect(screen.getByText('Select a command to view aliases')).toBeInTheDocument()

      // Step 5: Select Next Patient action
      await user.click(screen.getByText('Next Patient'))
      expect(screen.getByText('next patient please')).toBeInTheDocument()
    })
  })

  describe('Workflow: Add alias → verify toast → refetch called', () => {
    it('adds a new alias phrase', async () => {
      const user = userEvent.setup()
      render(<VoiceCommandsPageClient />)

      // Select a milestone
      await user.click(screen.getByText('Patient In'))

      // Type in the add input (there will be multiple — use the first one for 'record' group)
      const addInputs = screen.getAllByPlaceholderText('Add voice phrase...')
      await user.type(addInputs[0], 'patient has arrived')

      // Find the Add button near this input
      const addButtons = screen.getAllByRole('button', { name: /add/i })
      await user.click(addButtons[0])

      await waitFor(() => {
        expect(mockAddAlias).toHaveBeenCalledWith('mock-client', expect.objectContaining({
          alias_phrase: 'patient has arrived',
          action_type: 'record',
          milestone_type_id: null,
          facility_milestone_id: 'fm-1',
          facility_id: 'fac-1',
        }))
      })

      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'success', title: 'Alias added' })
        )
      })

      expect(mockRefetch).toHaveBeenCalled()
    })
  })

  describe('Workflow: Delete alias → confirm → toast → refetch', () => {
    it('deletes an alias through confirm dialog', async () => {
      const user = userEvent.setup()
      render(<VoiceCommandsPageClient />)

      // Select Patient In milestone
      await user.click(screen.getByText('Patient In'))

      // Hover over first alias to reveal delete button
      const deleteBtn = screen.getByRole('button', { name: /delete alias "patient is in"/i })
      await user.click(deleteBtn)

      // Confirm dialog appears
      const confirmBtn = screen.getByRole('button', { name: /confirm/i })
      await user.click(confirmBtn)

      await waitFor(() => {
        expect(mockDeleteAlias).toHaveBeenCalledWith('mock-client', 'a-1')
      })

      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'success', title: 'Alias deleted' })
        )
      })

      expect(mockRefetch).toHaveBeenCalled()
    })
  })

  describe('Workflow: Read-only user can browse but not modify', () => {
    it('hides add inputs and delete buttons in read-only mode', async () => {
      mockCanManage = false
      const user = userEvent.setup()
      render(<VoiceCommandsPageClient />)

      // Can still browse
      await user.click(screen.getByText('Patient In'))
      expect(screen.getByText('patient is in')).toBeInTheDocument()

      // No add inputs visible
      expect(screen.queryByPlaceholderText('Add voice phrase...')).not.toBeInTheDocument()

      // No delete buttons visible
      expect(screen.queryByRole('button', { name: /delete alias/i })).not.toBeInTheDocument()
    })
  })

  describe('Workflow: Search → select → clear search', () => {
    it('search filters, select works, clearing restores list', async () => {
      const user = userEvent.setup()
      render(<VoiceCommandsPageClient />)

      const searchInput = screen.getByPlaceholderText('Search commands...')

      // Step 1: Search for "inci"
      await user.type(searchInput, 'inci')
      expect(screen.getByText('Incision')).toBeInTheDocument()
      expect(screen.queryByText('Patient In')).not.toBeInTheDocument()

      // Step 2: Select the filtered result
      await user.click(screen.getByText('Incision'))
      // Right panel should show header
      expect(screen.getByText('Milestone')).toBeInTheDocument()

      // Step 3: Clear search
      await user.clear(searchInput)
      // All milestones should be visible again (Incision appears in both left panel + right header)
      expect(screen.getByText('Patient In')).toBeInTheDocument()
      expect(screen.getAllByText('Incision').length).toBeGreaterThanOrEqual(1)
    })
  })
})
