// components/settings/milestones/__tests__/AdminProcedureTypeAssignment.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ─── Mocks ───────────────────────────────────────────────

const mockShowToast = vi.fn()
vi.mock('@/components/ui/Toast/ToastProvider', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}))

vi.mock('@/lib/UserContext', () => ({
  useUser: () => ({ isGlobalAdmin: true, loading: false }),
}))

let mockQueryDataMap: Record<string, unknown[]> = {}
let mockQueryLoading = false
let mockQueryError: string | null = null
const mockSetProcedures = vi.fn()

vi.mock('@/hooks/useSupabaseQuery', () => ({
  useSupabaseQuery: (queryFn: () => Promise<unknown[]>) => {
    const fnStr = queryFn.toString()

    if (fnStr.includes('procedure_type_templates')) {
      return {
        data: mockQueryDataMap.procedures || [],
        loading: mockQueryLoading,
        error: mockQueryError,
        setData: mockSetProcedures,
      }
    }
    if (fnStr.includes('milestone_template_types')) {
      return {
        data: mockQueryDataMap.templates || [],
        loading: mockQueryLoading,
        error: mockQueryError,
      }
    }
    if (fnStr.includes('milestone_template_type_items')) {
      return {
        data: mockQueryDataMap.items || [],
        loading: mockQueryLoading,
        error: mockQueryError,
      }
    }
    if (fnStr.includes('milestone_types')) {
      return {
        data: mockQueryDataMap.milestones || [],
        loading: mockQueryLoading,
        error: mockQueryError,
      }
    }
    if (fnStr.includes('phase_templates')) {
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

import { AdminProcedureTypeAssignment } from '../AdminProcedureTypeAssignment'

// ─── Fixtures ────────────────────────────────────────────

const TEMPLATES = [
  {
    id: 'tmpl-default',
    facility_id: '',
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
    facility_id: '',
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
    facility_id: '',
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
    id: 'pt-1',
    name: 'Total Hip Replacement',
    category_name: 'Orthopedic',
    milestone_template_type_id: 'tmpl-1',
  },
  {
    id: 'pt-2',
    name: 'Knee Arthroscopy',
    category_name: 'Orthopedic',
    milestone_template_type_id: null,
  },
  {
    id: 'pt-3',
    name: 'Coronary Bypass',
    category_name: 'Cardiac',
    milestone_template_type_id: 'tmpl-2',
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

/** Get the picker container in the detail panel. */
function getPickerContainer() {
  const label = screen.getByText('Milestone Template')
  return within(label.parentElement as HTMLElement)
}

/** Get the open dropdown popup. */
function getDropdown() {
  const el = document.querySelector('.absolute.left-0.top-full') as HTMLElement
  if (!el) throw new Error('Dropdown not open')
  return within(el)
}

// ─── Tests ───────────────────────────────────────────────

describe('AdminProcedureTypeAssignment', () => {
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

  describe('2-column layout', () => {
    it('renders procedure list in left column and empty state in right column', () => {
      render(<AdminProcedureTypeAssignment />)

      expect(screen.getByText('Total Hip Replacement')).toBeInTheDocument()
      expect(screen.getByText('Knee Arthroscopy')).toBeInTheDocument()
      expect(screen.getByText('Coronary Bypass')).toBeInTheDocument()

      expect(screen.getByText('Select a procedure type to view its template')).toBeInTheDocument()
    })

    it('renders info banner about global seeding', () => {
      render(<AdminProcedureTypeAssignment />)

      expect(screen.getByText(/Assign milestone templates to global procedure types/)).toBeInTheDocument()
    })

    it('shows template badge for explicit assignments in procedure list', () => {
      render(<AdminProcedureTypeAssignment />)

      const hipButton = screen.getByText('Total Hip Replacement').closest('button')
      expect(hipButton?.textContent).toContain('Ortho')
    })

    it('shows default label for inherited assignments in procedure list', () => {
      render(<AdminProcedureTypeAssignment />)

      const kneeButton = screen.getByText('Knee Arthroscopy').closest('button')
      expect(kneeButton?.textContent).toContain('Standard Workflow (default)')
    })

    it('shows assigned count in footer', () => {
      render(<AdminProcedureTypeAssignment />)

      expect(screen.getByText('2 assigned')).toBeInTheDocument()
    })
  })

  describe('procedure selection', () => {
    it('shows template detail when a procedure is selected', async () => {
      const user = userEvent.setup()
      render(<AdminProcedureTypeAssignment />)

      await user.click(screen.getByText('Total Hip Replacement'))

      expect(screen.getByText('Explicit template assignment')).toBeInTheDocument()
    })

    it('shows inherited label when selecting procedure without explicit template', async () => {
      const user = userEvent.setup()
      render(<AdminProcedureTypeAssignment />)

      await user.click(screen.getByText('Knee Arthroscopy'))

      expect(screen.getByText('Using global default')).toBeInTheDocument()
    })
  })

  describe('search filtering', () => {
    it('filters procedure types by name', async () => {
      const user = userEvent.setup()
      render(<AdminProcedureTypeAssignment />)

      const searchInput = screen.getByPlaceholderText('Search procedure types...')
      await user.type(searchInput, 'Hip')

      expect(screen.getByText('Total Hip Replacement')).toBeInTheDocument()
      expect(screen.queryByText('Knee Arthroscopy')).not.toBeInTheDocument()
      expect(screen.queryByText('Coronary Bypass')).not.toBeInTheDocument()
    })

    it('shows empty state when no matches', async () => {
      const user = userEvent.setup()
      render(<AdminProcedureTypeAssignment />)

      const searchInput = screen.getByPlaceholderText('Search procedure types...')
      await user.type(searchInput, 'nonexistent')

      expect(screen.getByText('No procedure types match your search.')).toBeInTheDocument()
    })
  })

  describe('template assignment', () => {
    it('opens template picker and assigns a template', async () => {
      const user = userEvent.setup()
      render(<AdminProcedureTypeAssignment />)

      // Select procedure
      await user.click(screen.getByText('Knee Arthroscopy'))

      // Open picker (scoped to picker container)
      const picker = getPickerContainer()
      await user.click(picker.getByRole('button'))

      // Select "Ortho Template" from dropdown
      await waitFor(() => {
        expect(screen.getByText('Use global default')).toBeInTheDocument()
      })
      const dropdown = getDropdown()
      await user.click(dropdown.getByText('Ortho Template'))

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalled()
        expect(mockUpdateEq).toHaveBeenCalledWith('id', 'pt-2')
      })

      expect(mockShowToast).toHaveBeenCalledWith({
        type: 'success',
        title: expect.stringContaining('Ortho Template'),
      })
    })

    it('removes explicit assignment (use global default)', async () => {
      const user = userEvent.setup()
      render(<AdminProcedureTypeAssignment />)

      // Select procedure with explicit template
      await user.click(screen.getByText('Total Hip Replacement'))

      // Open picker (scoped to picker container)
      const picker = getPickerContainer()
      await user.click(picker.getByRole('button'))

      // Select "Use global default"
      await waitFor(() => {
        expect(screen.getByText('Use global default')).toBeInTheDocument()
      })
      const dropdown = getDropdown()
      await user.click(dropdown.getByText('Use global default'))

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalled()
      })

      expect(mockShowToast).toHaveBeenCalledWith({
        type: 'success',
        title: expect.stringContaining('global default'),
      })
    })

    it('handles assignment error gracefully', async () => {
      mockUpdateResult = { error: { message: 'DB constraint violation' } }

      const user = userEvent.setup()
      render(<AdminProcedureTypeAssignment />)

      await user.click(screen.getByText('Knee Arthroscopy'))

      const picker = getPickerContainer()
      await user.click(picker.getByRole('button'))

      await waitFor(() => {
        expect(screen.getByText('Use global default')).toBeInTheDocument()
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
      render(<AdminProcedureTypeAssignment />)

      const skeletons = document.querySelectorAll('.animate-pulse')
      expect(skeletons.length).toBeGreaterThan(0)
    })

    it('shows error banner on fetch error', () => {
      mockQueryError = 'Failed to fetch procedure types'
      render(<AdminProcedureTypeAssignment />)

      expect(screen.getByText('Failed to fetch procedure types')).toBeInTheDocument()
    })

    it('shows empty state when no procedure types exist', () => {
      mockQueryDataMap.procedures = []
      render(<AdminProcedureTypeAssignment />)

      expect(screen.getByText('No procedure types configured yet.')).toBeInTheDocument()
    })
  })
})
