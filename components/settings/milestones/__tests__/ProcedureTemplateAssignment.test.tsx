// components/settings/milestones/__tests__/ProcedureTemplateAssignment.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ─── Mocks ───────────────────────────────────────────────

const mockShowToast = vi.fn()
vi.mock('@/components/ui/Toast/ToastProvider', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}))

vi.mock('@/lib/UserContext', () => ({
  useUser: () => ({ effectiveFacilityId: 'fac-1', loading: false }),
}))

let mockQueryDataMap: Record<string, unknown[]> = {}
let mockQueryLoading = false
let mockQueryError: string | null = null
const mockSetProcedures = vi.fn()

vi.mock('@/hooks/useSupabaseQuery', () => ({
  useSupabaseQuery: (queryFn: () => Promise<unknown[]>) => {
    const fnStr = queryFn.toString()

    if (fnStr.includes('procedure_types')) {
      return {
        data: mockQueryDataMap.procedures || [],
        loading: mockQueryLoading,
        error: mockQueryError,
        setData: mockSetProcedures,
      }
    }
    if (fnStr.includes('milestone_templates')) {
      return {
        data: mockQueryDataMap.templates || [],
        loading: mockQueryLoading,
        error: mockQueryError,
      }
    }
    if (fnStr.includes('milestone_template_items')) {
      return {
        data: mockQueryDataMap.items || [],
        loading: mockQueryLoading,
        error: mockQueryError,
      }
    }
    if (fnStr.includes('facility_milestones')) {
      return {
        data: mockQueryDataMap.milestones || [],
        loading: mockQueryLoading,
        error: mockQueryError,
      }
    }
    if (fnStr.includes('facility_phases')) {
      return {
        data: mockQueryDataMap.phases || [],
        loading: mockQueryLoading,
        error: mockQueryError,
      }
    }

    return { data: [], loading: false, error: null }
  },
}))

let mockUpdateResult: { error: null | { message: string } } = { error: null }
const mockUpdateEq = vi.fn(() => mockUpdateResult)
const mockUpdate = vi.fn(() => ({ eq: mockUpdateEq }))

vi.mock('@/lib/supabase', () => ({
  createClient: () => ({
    from: () => ({
      update: mockUpdate,
    }),
  }),
}))

import { ProcedureTemplateAssignment } from '../ProcedureTemplateAssignment'

// ─── Fixtures ────────────────────────────────────────────

const TEMPLATES = [
  {
    id: 'tmpl-default',
    facility_id: 'fac-1',
    name: 'Standard Workflow',
    description: 'Default template',
    is_default: true,
    is_active: true,
    deleted_at: null,
    deleted_by: null,
    block_order: {},
    sub_phase_map: {},
  },
  {
    id: 'tmpl-1',
    facility_id: 'fac-1',
    name: 'Ortho Template',
    description: 'For orthopedic procedures',
    is_default: false,
    is_active: true,
    deleted_at: null,
    deleted_by: null,
    block_order: {},
    sub_phase_map: {},
  },
  {
    id: 'tmpl-2',
    facility_id: 'fac-1',
    name: 'Cardiac Template',
    description: 'For cardiac procedures',
    is_default: false,
    is_active: true,
    deleted_at: null,
    deleted_by: null,
    block_order: {},
    sub_phase_map: {},
  },
]

const PROCEDURES = [
  {
    id: 'proc-1',
    name: 'Total Hip Replacement',
    category_name: 'Orthopedic',
    milestone_template_id: 'tmpl-1',
  },
  {
    id: 'proc-2',
    name: 'Knee Arthroscopy',
    category_name: 'Orthopedic',
    milestone_template_id: null,
  },
  {
    id: 'proc-3',
    name: 'Coronary Bypass',
    category_name: 'Cardiac',
    milestone_template_id: 'tmpl-2',
  },
]

const MILESTONES = [
  { id: 'ms-1', name: 'patient_in_room', display_name: 'Patient In Room', pair_with_id: null, pair_position: null },
  { id: 'ms-2', name: 'incision', display_name: 'Incision', pair_with_id: null, pair_position: null },
  { id: 'ms-3', name: 'closure', display_name: 'Closure', pair_with_id: null, pair_position: null },
]

const PHASES = [
  { id: 'ph-1', name: 'pre_op', display_name: 'Pre-Op', color_key: 'blue', display_order: 1, parent_phase_id: null },
  { id: 'ph-2', name: 'surgical', display_name: 'Surgical', color_key: 'green', display_order: 2, parent_phase_id: null },
]

const TEMPLATE_ITEMS = [
  { id: 'item-1', template_id: 'tmpl-1', facility_milestone_id: 'ms-1', facility_phase_id: 'ph-1', display_order: 1 },
  { id: 'item-2', template_id: 'tmpl-1', facility_milestone_id: 'ms-2', facility_phase_id: 'ph-2', display_order: 2 },
  { id: 'item-3', template_id: 'tmpl-2', facility_milestone_id: 'ms-3', facility_phase_id: 'ph-2', display_order: 1 },
]

// ─── Helpers ────────────────────────────────────────────

/** Get the picker container (div holding "Milestone Template" label and the picker button). */
function getPickerContainer() {
  const label = screen.getByText('Milestone Template')
  return within(label.parentElement as HTMLElement)
}

/** Get the open dropdown popup (absolute positioned). */
function getDropdown() {
  const el = document.querySelector('.absolute.left-0.top-full') as HTMLElement
  if (!el) throw new Error('Dropdown not open')
  return within(el)
}

// ─── Tests ───────────────────────────────────────────────

describe('ProcedureTemplateAssignment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockQueryDataMap = {
      procedures: [...PROCEDURES],
      templates: [...TEMPLATES],
      items: [...TEMPLATE_ITEMS],
      milestones: [...MILESTONES],
      phases: [...PHASES],
    }
    mockQueryLoading = false
    mockQueryError = null
    mockUpdateResult = { error: null }
  })

  describe('rendering — 2-column layout', () => {
    it('renders procedure list in left column', () => {
      render(<ProcedureTemplateAssignment />)

      expect(screen.getByText('Total Hip Replacement')).toBeInTheDocument()
      expect(screen.getByText('Knee Arthroscopy')).toBeInTheDocument()
      expect(screen.getByText('Coronary Bypass')).toBeInTheDocument()
    })

    it('shows procedure count in footer', () => {
      render(<ProcedureTemplateAssignment />)

      expect(screen.getByText('3 procedures')).toBeInTheDocument()
    })

    it('shows assigned count in footer', () => {
      render(<ProcedureTemplateAssignment />)

      expect(screen.getByText('2 assigned')).toBeInTheDocument()
    })

    it('shows empty state in right column when no procedure selected', () => {
      render(<ProcedureTemplateAssignment />)

      expect(screen.getByText('Select a procedure to view its template')).toBeInTheDocument()
    })

    it('shows template badge on list items with explicit assignment', () => {
      render(<ProcedureTemplateAssignment />)

      // Procedures with explicit template should show a badge
      const hipButton = screen.getByText('Total Hip Replacement').closest('button')
      expect(hipButton?.textContent).toContain('Ortho')
    })

    it('shows default template name for inherited procedures', () => {
      render(<ProcedureTemplateAssignment />)

      // Knee Arthroscopy has no explicit assignment → shows default
      const kneeButton = screen.getByText('Knee Arthroscopy').closest('button')
      expect(kneeButton?.textContent).toContain('Standard Workflow (default)')
    })
  })

  describe('procedure selection', () => {
    it('shows template detail when procedure is clicked', async () => {
      const user = userEvent.setup()
      render(<ProcedureTemplateAssignment />)

      await user.click(screen.getByText('Total Hip Replacement'))

      // Right column should show template picker label
      expect(screen.getByText('Explicit template assignment')).toBeInTheDocument()
      expect(screen.getByText('Milestone Template')).toBeInTheDocument()
    })

    it('shows facility default label for inherited procedure', async () => {
      const user = userEvent.setup()
      render(<ProcedureTemplateAssignment />)

      await user.click(screen.getByText('Knee Arthroscopy'))

      expect(screen.getByText('Using facility default')).toBeInTheDocument()
    })

    it('shows timeline preview for selected procedure', async () => {
      const user = userEvent.setup()
      render(<ProcedureTemplateAssignment />)

      await user.click(screen.getByText('Total Hip Replacement'))

      // Template items for tmpl-1 include Patient In Room and Incision
      expect(screen.getByText('Patient In Room')).toBeInTheDocument()
      expect(screen.getByText('Incision')).toBeInTheDocument()
    })

    it('highlights selected procedure in the list', async () => {
      const user = userEvent.setup()
      render(<ProcedureTemplateAssignment />)

      await user.click(screen.getByText('Total Hip Replacement'))

      // After selection, the name appears in both list + header; find the list button
      const hipButtons = screen.getAllByText('Total Hip Replacement')
      const listButton = hipButtons.map(el => el.closest('button')).find(Boolean)
      expect(listButton?.className).toContain('bg-blue-50')
    })
  })

  describe('search filtering', () => {
    it('filters procedures by name', async () => {
      const user = userEvent.setup()
      render(<ProcedureTemplateAssignment />)

      const searchInput = screen.getByPlaceholderText('Search procedures...')
      await user.type(searchInput, 'Hip')

      expect(screen.getByText('Total Hip Replacement')).toBeInTheDocument()
      expect(screen.queryByText('Knee Arthroscopy')).not.toBeInTheDocument()
      expect(screen.queryByText('Coronary Bypass')).not.toBeInTheDocument()
      expect(screen.getByText('1 procedure')).toBeInTheDocument()
    })

    it('filters procedures by category', async () => {
      const user = userEvent.setup()
      render(<ProcedureTemplateAssignment />)

      const searchInput = screen.getByPlaceholderText('Search procedures...')
      await user.type(searchInput, 'Cardiac')

      expect(screen.queryByText('Total Hip Replacement')).not.toBeInTheDocument()
      expect(screen.getByText('Coronary Bypass')).toBeInTheDocument()
      expect(screen.getByText('1 procedure')).toBeInTheDocument()
    })

    it('shows empty state when no matches', async () => {
      const user = userEvent.setup()
      render(<ProcedureTemplateAssignment />)

      const searchInput = screen.getByPlaceholderText('Search procedures...')
      await user.type(searchInput, 'nonexistent')

      expect(screen.getByText('No procedures match your search.')).toBeInTheDocument()
    })
  })

  describe('template assignment', () => {
    it('opens template picker after selecting procedure', async () => {
      const user = userEvent.setup()
      render(<ProcedureTemplateAssignment />)

      // Select a procedure first
      await user.click(screen.getByText('Knee Arthroscopy'))

      // Click the template picker in the detail panel (scope to picker container)
      const picker = getPickerContainer()
      await user.click(picker.getByRole('button'))

      await waitFor(() => {
        expect(screen.getByText('Use facility default')).toBeInTheDocument()
      })
      const dropdown = getDropdown()
      expect(dropdown.getByText('Ortho Template')).toBeInTheDocument()
      expect(dropdown.getByText('Cardiac Template')).toBeInTheDocument()
    })

    it('assigns a template to a procedure', async () => {
      const user = userEvent.setup()
      render(<ProcedureTemplateAssignment />)

      // Select Knee Arthroscopy
      await user.click(screen.getByText('Knee Arthroscopy'))

      // Open picker (scoped to picker container)
      const picker = getPickerContainer()
      await user.click(picker.getByRole('button'))

      // Select "Ortho Template" from the dropdown
      await waitFor(() => {
        expect(screen.getByText('Use facility default')).toBeInTheDocument()
      })
      const dropdown = getDropdown()
      await user.click(dropdown.getByText('Ortho Template'))

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalled()
        expect(mockUpdateEq).toHaveBeenCalledWith('id', 'proc-2')
      })

      expect(mockShowToast).toHaveBeenCalledWith({
        type: 'success',
        title: expect.stringContaining('Ortho Template'),
      })
    })

    it('removes explicit assignment (use facility default)', async () => {
      const user = userEvent.setup()
      render(<ProcedureTemplateAssignment />)

      // Select Total Hip (has explicit Ortho Template)
      await user.click(screen.getByText('Total Hip Replacement'))

      // Open picker (scoped to picker container)
      const picker = getPickerContainer()
      await user.click(picker.getByRole('button'))

      // Select "Use facility default"
      await waitFor(() => {
        expect(screen.getByText('Use facility default')).toBeInTheDocument()
      })
      const dropdown = getDropdown()
      await user.click(dropdown.getByText('Use facility default'))

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalled()
      })

      expect(mockShowToast).toHaveBeenCalledWith({
        type: 'success',
        title: expect.stringContaining('facility default'),
      })
    })

    it('handles assignment error gracefully', async () => {
      mockUpdateResult = { error: { message: 'DB constraint violation' } }

      const user = userEvent.setup()
      render(<ProcedureTemplateAssignment />)

      await user.click(screen.getByText('Knee Arthroscopy'))

      const picker = getPickerContainer()
      await user.click(picker.getByRole('button'))

      await waitFor(() => {
        expect(screen.getByText('Use facility default')).toBeInTheDocument()
      })
      const dropdown = getDropdown()
      await user.click(dropdown.getByText('Ortho Template'))

      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith({
          type: 'error',
          title: expect.any(String),
        })
      })
    })
  })

  describe('loading and error states', () => {
    it('shows skeleton while loading', () => {
      mockQueryLoading = true
      render(<ProcedureTemplateAssignment />)

      const skeletons = document.querySelectorAll('.animate-pulse')
      expect(skeletons.length).toBeGreaterThan(0)
    })

    it('shows error banner on fetch error', () => {
      mockQueryError = 'Failed to fetch procedures'
      render(<ProcedureTemplateAssignment />)

      expect(screen.getByText('Failed to fetch procedures')).toBeInTheDocument()
    })

    it('shows empty state when no procedures exist', () => {
      mockQueryDataMap.procedures = []
      render(<ProcedureTemplateAssignment />)

      expect(screen.getByText('No procedures configured yet.')).toBeInTheDocument()
    })
  })

  describe('template cascade visualization', () => {
    it('shows explicit vs inherited styling in template picker', async () => {
      const user = userEvent.setup()
      render(<ProcedureTemplateAssignment />)

      // Click explicit assignment (Total Hip → has Ortho Template)
      await user.click(screen.getByText('Total Hip Replacement'))

      const picker = getPickerContainer()
      const pickerButton = picker.getByRole('button')
      expect(pickerButton.className).toContain('border-blue-200')
    })

    it('shows inherited styling for facility default', async () => {
      const user = userEvent.setup()
      render(<ProcedureTemplateAssignment />)

      await user.click(screen.getByText('Knee Arthroscopy'))

      const picker = getPickerContainer()
      const pickerButton = picker.getByRole('button')
      expect(pickerButton.className).toContain('border-slate-200')
    })
  })
})
