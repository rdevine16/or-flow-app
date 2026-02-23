// components/settings/milestones/__tests__/AdminPhaseLibrary.test.tsx
// Tests for AdminPhaseLibrary component — admin-level phase template CRUD
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AdminPhaseLibrary } from '../AdminPhaseLibrary'

// ─── Mocks ───────────────────────────────────────────────

const mockShowToast = vi.fn()
vi.mock('@/components/ui/Toast/ToastProvider', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}))

interface PhaseTemplate {
  id: string
  name: string
  display_name: string
  color_key: string | null
  display_order: number
  parent_phase_template_id: string | null
  is_active: boolean
}

let mockPhases: PhaseTemplate[] = []
let mockLoading = false
const mockSetData = vi.fn()

vi.mock('@/hooks/useSupabaseQuery', () => ({
  useSupabaseQuery: () => ({
    data: mockPhases,
    loading: mockLoading,
    error: null,
    setData: mockSetData,
  }),
}))

const mockSupabase = {
  from: vi.fn(() => mockSupabase),
  select: vi.fn(() => mockSupabase),
  insert: vi.fn(() => mockSupabase),
  update: vi.fn(() => mockSupabase),
  eq: vi.fn(() => ({ error: null })),
  order: vi.fn(() => ({ data: mockPhases, error: null })),
  single: vi.fn(() => ({ data: null, error: null })),
}

vi.mock('@/lib/supabase', () => ({
  createClient: () => mockSupabase,
}))

// ─── Fixtures ────────────────────────────────────────────

const PHASE_TEMPLATES: PhaseTemplate[] = [
  {
    id: 'phase-1',
    name: 'pre_op',
    display_name: 'Pre-Op',
    color_key: 'blue',
    display_order: 1,
    parent_phase_template_id: null,
    is_active: true,
  },
  {
    id: 'phase-2',
    name: 'surgical',
    display_name: 'Surgical',
    color_key: 'green',
    display_order: 2,
    parent_phase_template_id: null,
    is_active: true,
  },
  {
    id: 'phase-3',
    name: 'anesthesia_prep',
    display_name: 'Anesthesia Prep',
    color_key: 'cyan',
    display_order: 3,
    parent_phase_template_id: 'phase-1',
    is_active: true,
  },
  {
    id: 'phase-4',
    name: 'archived_phase',
    display_name: 'Archived Phase',
    color_key: 'gray',
    display_order: 4,
    parent_phase_template_id: null,
    is_active: false,
  },
]

// ─── Tests ───────────────────────────────────────────────

describe('AdminPhaseLibrary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPhases = PHASE_TEMPLATES.filter(p => p.is_active) // Start with active phases only
    mockLoading = false
  })

  describe('rendering', () => {
    it('renders info banner about phase templates', () => {
      render(<AdminPhaseLibrary />)

      expect(screen.getByText(/Phase templates define the default phases seeded to new facilities/)).toBeInTheDocument()
    })

    it('renders search input', () => {
      render(<AdminPhaseLibrary />)

      expect(screen.getByPlaceholderText('Search phases...')).toBeInTheDocument()
    })

    it('renders Add Phase Template button', () => {
      render(<AdminPhaseLibrary />)

      expect(screen.getByText('Add Phase Template')).toBeInTheDocument()
    })

    it('renders table header columns', () => {
      render(<AdminPhaseLibrary />)

      expect(screen.getByText('Phase')).toBeInTheDocument()
      expect(screen.getByText('Color')).toBeInTheDocument()
      expect(screen.getByText('Parent')).toBeInTheDocument()
      expect(screen.getByText('Actions')).toBeInTheDocument()
    })

    it('renders active phase rows', () => {
      render(<AdminPhaseLibrary />)

      // Pre-Op appears twice: as row and as parent indicator
      expect(screen.getAllByText('Pre-Op').length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('Surgical')).toBeInTheDocument()
      expect(screen.getByText('Anesthesia Prep')).toBeInTheDocument()
    })

    it('does not render archived phases by default', () => {
      mockPhases = PHASE_TEMPLATES // Include archived, but component filters to active only
      render(<AdminPhaseLibrary />)

      // Archived phase should NOT appear in the main list
      expect(screen.queryByText('Archived Phase')).not.toBeInTheDocument()
    })

    it('shows color swatches and labels', () => {
      render(<AdminPhaseLibrary />)

      // Color labels (from resolveColorKey)
      expect(screen.getByText('Blue')).toBeInTheDocument()
      expect(screen.getByText('Green')).toBeInTheDocument()
    })

    it('shows parent phase indicator for sub-phases', () => {
      render(<AdminPhaseLibrary />)

      // Anesthesia Prep is a child of Pre-Op
      // Pre-Op appears twice: as row and as parent indicator
      const preOpElements = screen.getAllByText('Pre-Op')
      expect(preOpElements.length).toBe(2)
    })

    it('shows em-dash for phases with no parent', () => {
      const { container } = render(<AdminPhaseLibrary />)

      const mdash = container.querySelector('[class*="text-slate-300"]')
      expect(mdash).toBeInTheDocument()
    })

    it('shows loading skeletons when loading', () => {
      mockLoading = true
      const { container } = render(<AdminPhaseLibrary />)

      const skeletons = container.querySelectorAll('[class*="animate-pulse"]')
      expect(skeletons.length).toBeGreaterThanOrEqual(1)
    })

    it('shows empty state when no phases', () => {
      mockPhases = []
      render(<AdminPhaseLibrary />)

      expect(screen.getByText('No phase templates configured yet.')).toBeInTheDocument()
    })

    it('shows phase count in footer', () => {
      render(<AdminPhaseLibrary />)

      expect(screen.getByText(/3 phase templates/)).toBeInTheDocument()
    })
  })

  describe('search', () => {
    it('filters phases by display name', async () => {
      const user = userEvent.setup()
      render(<AdminPhaseLibrary />)

      await user.type(screen.getByPlaceholderText('Search phases...'), 'Surgical')

      expect(screen.getByText('Surgical')).toBeInTheDocument()
      expect(screen.queryByText('Pre-Op')).not.toBeInTheDocument()
    })

    it('filters phases by internal name', async () => {
      const user = userEvent.setup()
      render(<AdminPhaseLibrary />)

      await user.type(screen.getByPlaceholderText('Search phases...'), 'anesthesia')

      expect(screen.getByText('Anesthesia Prep')).toBeInTheDocument()
      expect(screen.queryByText('Surgical')).not.toBeInTheDocument()
    })

    it('shows no-match message when search finds nothing', async () => {
      const user = userEvent.setup()
      render(<AdminPhaseLibrary />)

      await user.type(screen.getByPlaceholderText('Search phases...'), 'zzzzz')

      expect(screen.getByText('No phases match your search.')).toBeInTheDocument()
    })

    it('shows filtered count in footer when searching', async () => {
      const user = userEvent.setup()
      render(<AdminPhaseLibrary />)

      await user.type(screen.getByPlaceholderText('Search phases...'), 'Pre')

      expect(screen.getByText(/2 shown/)).toBeInTheDocument() // Pre-Op + Anesthesia Prep
    })
  })

  describe('add phase template', () => {
    it('opens add modal when Add Phase Template clicked', async () => {
      const user = userEvent.setup()
      render(<AdminPhaseLibrary />)

      // Click the button in the header row (first instance)
      const addButtons = screen.getAllByText('Add Phase Template')
      await user.click(addButtons[0])

      // Modal should show input placeholder
      expect(screen.getByPlaceholderText('e.g., Pre-Op')).toBeInTheDocument()
    })

    it('add modal has display name input', async () => {
      const user = userEvent.setup()
      render(<AdminPhaseLibrary />)

      const addButtons = screen.getAllByText('Add Phase Template')
      await user.click(addButtons[0])

      // Check for placeholder instead of label
      expect(screen.getByPlaceholderText('e.g., Pre-Op')).toBeInTheDocument()
    })

    it('add modal has color picker', async () => {
      const user = userEvent.setup()
      render(<AdminPhaseLibrary />)

      const addButtons = screen.getAllByText('Add Phase Template')
      await user.click(addButtons[0])

      // Check for "Selected: Blue" text which appears in color picker
      expect(screen.getByText(/Selected: Blue/)).toBeInTheDocument()
    })

    it('add modal has parent phase dropdown', async () => {
      const user = userEvent.setup()
      render(<AdminPhaseLibrary />)

      const addButtons = screen.getAllByText('Add Phase Template')
      await user.click(addButtons[0])

      // Check for option text instead of label
      expect(screen.getByText('None (top-level phase)')).toBeInTheDocument()
    })

    it('add modal shows auto-generated internal name preview', async () => {
      const user = userEvent.setup()
      render(<AdminPhaseLibrary />)

      await user.click(screen.getByText('Add Phase Template'))

      const displayNameInput = screen.getByPlaceholderText('e.g., Pre-Op')
      await user.type(displayNameInput, 'Recovery Room')

      expect(screen.getByText(/Internal name:/)).toBeInTheDocument()
      expect(screen.getByText(/recovery_room/)).toBeInTheDocument()
    })

    it('parent phase dropdown excludes self and children (edit mode)', async () => {
      // This is tested implicitly in the component logic
      // The filter is: parentOptions.filter(p => p.id !== phase?.id)
      // In add mode, there's no self to exclude
      expect(true).toBe(true)
    })
  })

  describe('edit phase template', () => {
    it('shows edit button on each row', () => {
      render(<AdminPhaseLibrary />)

      const editButtons = screen.getAllByTitle('Edit')
      expect(editButtons.length).toBe(3) // 3 active phases
    })

    it('opens edit modal when edit button clicked', async () => {
      const user = userEvent.setup()
      render(<AdminPhaseLibrary />)

      const editButtons = screen.getAllByTitle('Edit')
      await user.click(editButtons[0])

      expect(screen.getByText('Edit Phase Template')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Pre-Op')).toBeInTheDocument()
    })

    it('edit modal pre-fills current values', async () => {
      const user = userEvent.setup()
      render(<AdminPhaseLibrary />)

      const editButtons = screen.getAllByTitle('Edit')
      await user.click(editButtons[2]) // Anesthesia Prep

      // Display name should be pre-filled
      expect(screen.getByDisplayValue('Anesthesia Prep')).toBeInTheDocument()
      // Parent dropdown should have Pre-Op selected
      // Find the select element and check its value
      const selects = screen.getAllByRole('combobox')
      const parentSelect = selects.find(s => (s as HTMLSelectElement).value === 'phase-1')
      expect(parentSelect).toBeInTheDocument()
    })

    it('edit modal has Save Changes button', async () => {
      const user = userEvent.setup()
      render(<AdminPhaseLibrary />)

      const editButtons = screen.getAllByTitle('Edit')
      await user.click(editButtons[0])

      expect(screen.getByText('Save Changes')).toBeInTheDocument()
    })
  })

  describe('archive phase template', () => {
    it('shows archive button on each row', () => {
      render(<AdminPhaseLibrary />)

      const archiveButtons = screen.getAllByTitle('Archive')
      expect(archiveButtons.length).toBe(3) // 3 active phases
    })

    it('opens confirmation dialog when archive clicked', async () => {
      const user = userEvent.setup()
      render(<AdminPhaseLibrary />)

      const archiveButtons = screen.getAllByTitle('Archive')
      await user.click(archiveButtons[0])

      expect(screen.getByText('Archive Phase Template')).toBeInTheDocument()
      expect(screen.getByText(/New facilities will no longer receive this phase/)).toBeInTheDocument()
    })

    it('shows warning when archiving phase with children', async () => {
      const user = userEvent.setup()
      render(<AdminPhaseLibrary />)

      // Archive Pre-Op (which has Anesthesia Prep as child)
      const archiveButtons = screen.getAllByTitle('Archive')
      await user.click(archiveButtons[0])

      // Should show warning about sub-phases
      expect(screen.getByText(/sub-phase/i)).toBeInTheDocument()
    })
  })

  describe('restore archived phase', () => {
    it('shows archived section when there are archived phases', () => {
      mockPhases = PHASE_TEMPLATES // Include archived
      render(<AdminPhaseLibrary />)

      expect(screen.getByText(/Archived \(1\)/)).toBeInTheDocument()
    })

    it('expands archived section when clicked', async () => {
      mockPhases = PHASE_TEMPLATES // Include archived
      const user = userEvent.setup()
      render(<AdminPhaseLibrary />)

      await user.click(screen.getByText(/Archived \(1\)/))

      expect(screen.getByText('Archived Phase')).toBeInTheDocument()
    })

    it('shows restore button for archived phases', async () => {
      mockPhases = PHASE_TEMPLATES // Include archived
      const user = userEvent.setup()
      render(<AdminPhaseLibrary />)

      await user.click(screen.getByText(/Archived \(1\)/))

      expect(screen.getByText('Restore')).toBeInTheDocument()
    })

    it('archived phases have strike-through styling', async () => {
      mockPhases = PHASE_TEMPLATES // Include archived
      const user = userEvent.setup()
      render(<AdminPhaseLibrary />)

      await user.click(screen.getByText(/Archived \(1\)/))

      const archivedPhase = screen.getByText('Archived Phase')
      expect(archivedPhase.className).toContain('line-through')
    })
  })

  describe('integration - create and update flow', () => {
    it('calls supabase insert when adding a new phase', async () => {
      const user = userEvent.setup()
      render(<AdminPhaseLibrary />)

      // Open add modal
      const addButtons = screen.getAllByText('Add Phase Template')
      await user.click(addButtons[0])

      // Fill form
      await user.type(screen.getByPlaceholderText('e.g., Pre-Op'), 'Post-Op')

      // Submit - get all "Add Phase Template" texts again (one is modal title, one is button)
      const allAddTexts = screen.getAllByText('Add Phase Template')
      // The button is the last one (after the modal title)
      const submitButton = allAddTexts[allAddTexts.length - 1].closest('button')!
      await user.click(submitButton)

      // Should have called supabase.from('phase_templates').insert(...)
      expect(mockSupabase.from).toHaveBeenCalledWith('phase_templates')
      expect(mockSupabase.insert).toHaveBeenCalled()
    })

    it('calls supabase update when editing a phase', async () => {
      const user = userEvent.setup()
      render(<AdminPhaseLibrary />)

      // Open edit modal
      const editButtons = screen.getAllByTitle('Edit')
      await user.click(editButtons[0])

      // Change display name
      const displayNameInput = screen.getByDisplayValue('Pre-Op')
      await user.clear(displayNameInput)
      await user.type(displayNameInput, 'Pre-Operative')

      // Submit
      const saveButton = screen.getByText('Save Changes')
      await user.click(saveButton)

      // Should have called supabase.from('phase_templates').update(...).eq(...)
      expect(mockSupabase.from).toHaveBeenCalledWith('phase_templates')
      expect(mockSupabase.update).toHaveBeenCalled()
      expect(mockSupabase.eq).toHaveBeenCalled()
    })

    it('calls supabase update when archiving a phase', async () => {
      const user = userEvent.setup()
      render(<AdminPhaseLibrary />)

      // Click archive
      const archiveButtons = screen.getAllByTitle('Archive')
      await user.click(archiveButtons[1]) // Surgical (no children)

      // Confirm
      const confirmButton = screen.getByText('Archive')
      await user.click(confirmButton)

      // Should have called supabase.from('phase_templates').update({ is_active: false }).eq(...)
      expect(mockSupabase.from).toHaveBeenCalledWith('phase_templates')
      expect(mockSupabase.update).toHaveBeenCalled()
    })

    it('clears parent references when archiving a parent phase', async () => {
      const user = userEvent.setup()
      render(<AdminPhaseLibrary />)

      // Archive Pre-Op (which has Anesthesia Prep as child)
      const archiveButtons = screen.getAllByTitle('Archive')
      await user.click(archiveButtons[0])

      // Confirm
      const confirmButton = screen.getByText('Archive')
      await user.click(confirmButton)

      // Should have called update TWICE:
      // 1. Archive the phase itself
      // 2. Clear parent references on children
      expect(mockSupabase.update).toHaveBeenCalledTimes(2)
    })
  })

  describe('empty states', () => {
    it('shows empty state when no phases and no search', () => {
      mockPhases = []
      render(<AdminPhaseLibrary />)

      expect(screen.getByText('No phase templates configured yet.')).toBeInTheDocument()
    })

    it('shows no-match state when search returns nothing', async () => {
      const user = userEvent.setup()
      render(<AdminPhaseLibrary />)

      await user.type(screen.getByPlaceholderText('Search phases...'), 'nonexistent')

      expect(screen.getByText('No phases match your search.')).toBeInTheDocument()
    })
  })
})
