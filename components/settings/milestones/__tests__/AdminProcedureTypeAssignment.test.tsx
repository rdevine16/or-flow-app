// components/settings/milestones/__tests__/AdminProcedureTypeAssignment.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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
  },
]

const PROCEDURES = [
  {
    id: 'pt-1',
    name: 'Total Hip Replacement',
    category: 'Orthopedic',
    milestone_template_type_id: 'tmpl-1',
  },
  {
    id: 'pt-2',
    name: 'Knee Arthroscopy',
    category: 'Orthopedic',
    milestone_template_type_id: null,
  },
  {
    id: 'pt-3',
    name: 'Coronary Bypass',
    category: 'Cardiac',
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

  describe('rendering', () => {
    it('renders procedure type list with template pickers', () => {
      render(<AdminProcedureTypeAssignment />)

      expect(screen.getByText('Total Hip Replacement')).toBeInTheDocument()
      expect(screen.getByText('Knee Arthroscopy')).toBeInTheDocument()
      expect(screen.getByText('Coronary Bypass')).toBeInTheDocument()
    })

    it('shows procedure type count', () => {
      render(<AdminProcedureTypeAssignment />)

      expect(screen.getByText('3 procedure types')).toBeInTheDocument()
    })

    it('shows template name for explicit assignments', () => {
      render(<AdminProcedureTypeAssignment />)

      expect(screen.getByText('Ortho Template')).toBeInTheDocument()
      expect(screen.getByText('Cardiac Template')).toBeInTheDocument()
    })

    it('shows global default label for inherited assignments', () => {
      render(<AdminProcedureTypeAssignment />)

      expect(screen.getByText(/Standard Workflow \(global default\)/)).toBeInTheDocument()
    })

    it('renders info banner about global seeding', () => {
      render(<AdminProcedureTypeAssignment />)

      expect(screen.getByText(/Assign milestone templates to global procedure types/)).toBeInTheDocument()
    })

    it('renders milestone chips for assigned templates', () => {
      render(<AdminProcedureTypeAssignment />)

      expect(screen.getByText('Patient In Room')).toBeInTheDocument()
      expect(screen.getByText('Incision')).toBeInTheDocument()
      expect(screen.getByText('Closure')).toBeInTheDocument()
    })

    it('shows summary of explicit assignments', () => {
      render(<AdminProcedureTypeAssignment />)

      expect(screen.getByText('2 of 3 procedure types have explicit template assignments')).toBeInTheDocument()
    })

    it('shows categories when present', () => {
      render(<AdminProcedureTypeAssignment />)

      // "Orthopedic" appears twice (two procedures in that category)
      expect(screen.getAllByText('Orthopedic').length).toBe(2)
      expect(screen.getByText('Cardiac')).toBeInTheDocument()
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
      expect(screen.getByText('1 procedure type')).toBeInTheDocument()
    })

    it('filters procedure types by category', async () => {
      const user = userEvent.setup()
      render(<AdminProcedureTypeAssignment />)

      const searchInput = screen.getByPlaceholderText('Search procedure types...')
      await user.type(searchInput, 'Cardiac')

      expect(screen.queryByText('Total Hip Replacement')).not.toBeInTheDocument()
      expect(screen.getByText('Coronary Bypass')).toBeInTheDocument()
      expect(screen.getByText('1 procedure type')).toBeInTheDocument()
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
    it('opens template picker on button click', async () => {
      const user = userEvent.setup()
      render(<AdminProcedureTypeAssignment />)

      // Click the picker for "Knee Arthroscopy" (has global default)
      const pickerButtons = screen.getAllByRole('button', { name: /Standard Workflow/ })
      await user.click(pickerButtons[0])

      await waitFor(() => {
        expect(screen.getByText('Use global default')).toBeInTheDocument()
      })
      expect(screen.getAllByText('Ortho Template').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Cardiac Template').length).toBeGreaterThan(0)
    })

    it('assigns a template to a procedure type', async () => {
      const user = userEvent.setup()
      render(<AdminProcedureTypeAssignment />)

      // Open picker for "Knee Arthroscopy" (inherited)
      const pickerButtons = screen.getAllByRole('button', { name: /Standard Workflow/ })
      await user.click(pickerButtons[0])

      await waitFor(() => {
        expect(screen.getAllByText('Ortho Template').length).toBeGreaterThan(1)
      })
      const orthoOption = screen.getAllByText('Ortho Template').find(el =>
        el.closest('button')?.getAttribute('class')?.includes('hover:bg-slate-50')
      )
      if (orthoOption?.closest('button')) {
        await user.click(orthoOption.closest('button')!)
      }

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

      // Open picker for "Total Hip Replacement" (has explicit Ortho Template)
      const orthoButtons = screen.getAllByRole('button')
        .filter(btn => btn.textContent?.includes('Ortho Template'))
      await user.click(orthoButtons[0])

      await waitFor(() => {
        expect(screen.getByText('Use global default')).toBeInTheDocument()
      })
      await user.click(screen.getByText('Use global default'))

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

      const pickerButtons = screen.getAllByRole('button', { name: /Standard Workflow/ })
      await user.click(pickerButtons[0])

      await waitFor(() => {
        expect(screen.getAllByText('Ortho Template').length).toBeGreaterThan(0)
      })
      const orthoOption = screen.getAllByText('Ortho Template').find(el =>
        el.closest('button')?.getAttribute('class')?.includes('hover:bg-slate-50')
      )
      if (orthoOption?.closest('button')) {
        await user.click(orthoOption.closest('button')!)
      }

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

  describe('template cascade visualization', () => {
    it('shows milestone chips from assigned template', () => {
      render(<AdminProcedureTypeAssignment />)

      expect(screen.getByText('Patient In Room')).toBeInTheDocument()
      expect(screen.getByText('Incision')).toBeInTheDocument()
    })

    it('highlights explicit vs inherited assignments differently', () => {
      render(<AdminProcedureTypeAssignment />)

      // Explicit assignment should have blue border
      const explicitPicker = screen.getAllByRole('button')
        .find(btn => btn.textContent?.includes('Ortho Template') && !btn.textContent?.includes('global default'))
      expect(explicitPicker?.className).toContain('border-blue-200')

      // Inherited assignment should have slate border
      const inheritedPicker = screen.getAllByRole('button')
        .find(btn => btn.textContent?.includes('global default'))
      expect(inheritedPicker?.className).toContain('border-slate-200')
    })
  })
})
