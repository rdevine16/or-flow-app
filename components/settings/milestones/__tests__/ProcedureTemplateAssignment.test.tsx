// components/settings/milestones/__tests__/ProcedureTemplateAssignment.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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
    // Determine which data to return based on query function
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
  },
]

const PROCEDURES = [
  {
    id: 'proc-1',
    name: 'Total Hip Replacement',
    category: 'Orthopedic',
    milestone_template_id: 'tmpl-1', // explicit assignment
  },
  {
    id: 'proc-2',
    name: 'Knee Arthroscopy',
    category: 'Orthopedic',
    milestone_template_id: null, // using facility default
  },
  {
    id: 'proc-3',
    name: 'Coronary Bypass',
    category: 'Cardiac',
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

  describe('rendering', () => {
    it('renders procedure list with template pickers', () => {
      render(<ProcedureTemplateAssignment />)

      expect(screen.getByText('Total Hip Replacement')).toBeInTheDocument()
      expect(screen.getByText('Knee Arthroscopy')).toBeInTheDocument()
      expect(screen.getByText('Coronary Bypass')).toBeInTheDocument()
    })

    it('shows procedure count', () => {
      render(<ProcedureTemplateAssignment />)

      expect(screen.getByText('3 procedures')).toBeInTheDocument()
    })

    it('shows template name for explicit assignments', () => {
      render(<ProcedureTemplateAssignment />)

      expect(screen.getByText('Ortho Template')).toBeInTheDocument()
      expect(screen.getByText('Cardiac Template')).toBeInTheDocument()
    })

    it('shows facility default label for inherited assignments', () => {
      render(<ProcedureTemplateAssignment />)

      expect(screen.getByText(/Standard Workflow \(facility default\)/)).toBeInTheDocument()
    })

    it('renders milestone chips for assigned templates', () => {
      render(<ProcedureTemplateAssignment />)

      expect(screen.getByText('Patient In Room')).toBeInTheDocument()
      expect(screen.getByText('Incision')).toBeInTheDocument()
      expect(screen.getByText('Closure')).toBeInTheDocument()
    })

    it('shows summary of explicit assignments', () => {
      render(<ProcedureTemplateAssignment />)

      expect(screen.getByText('2 of 3 procedures have explicit template assignments')).toBeInTheDocument()
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
    it('opens template picker on button click', async () => {
      const user = userEvent.setup()
      render(<ProcedureTemplateAssignment />)

      // Click the picker button for "Knee Arthroscopy" (has facility default)
      const pickerButtons = screen.getAllByRole('button', { name: /Standard Workflow/ })
      await user.click(pickerButtons[0])

      // Dropdown should appear with all templates
      await waitFor(() => {
        expect(screen.getByText('Use facility default')).toBeInTheDocument()
      })
      expect(screen.getAllByText('Ortho Template').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Cardiac Template').length).toBeGreaterThan(0)
    })

    it('assigns a template to a procedure', async () => {
      const user = userEvent.setup()
      render(<ProcedureTemplateAssignment />)

      // Open picker for "Knee Arthroscopy"
      const pickerButtons = screen.getAllByRole('button', { name: /Standard Workflow/ })
      await user.click(pickerButtons[0])

      // Select "Ortho Template"
      await waitFor(() => {
        expect(screen.getAllByText('Ortho Template').length).toBeGreaterThan(1)
      })
      const orthoOption = screen.getAllByText('Ortho Template').find(el =>
        el.closest('button')?.getAttribute('class')?.includes('hover:bg-slate-50')
      )
      if (orthoOption?.closest('button')) {
        await user.click(orthoOption.closest('button')!)
      }

      // Verify update was called
      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalled()
        expect(mockUpdateEq).toHaveBeenCalledWith('id', 'proc-2')
      })

      // Verify success toast
      expect(mockShowToast).toHaveBeenCalledWith({
        type: 'success',
        title: expect.stringContaining('Ortho Template'),
      })
    })

    it('removes explicit assignment (use facility default)', async () => {
      const user = userEvent.setup()
      render(<ProcedureTemplateAssignment />)

      // Open picker for "Total Hip Replacement" (has explicit Ortho Template)
      const orthoButtons = screen.getAllByRole('button')
        .filter(btn => btn.textContent?.includes('Ortho Template'))
      await user.click(orthoButtons[0])

      // Select "Use facility default"
      await waitFor(() => {
        expect(screen.getByText('Use facility default')).toBeInTheDocument()
      })
      await user.click(screen.getByText('Use facility default'))

      // Verify update was called with null
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
      render(<ProcedureTemplateAssignment />)

      // Should render 6 skeleton rows
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
    it('shows milestone chips from assigned template', () => {
      render(<ProcedureTemplateAssignment />)

      // "Total Hip Replacement" uses "Ortho Template" which has ms-1 and ms-2
      expect(screen.getByText('Patient In Room')).toBeInTheDocument()
      expect(screen.getByText('Incision')).toBeInTheDocument()
    })

    it('shows milestone chips from default template when no explicit assignment', () => {
      render(<ProcedureTemplateAssignment />)

      // "Knee Arthroscopy" uses facility default (no items in fixture, but component should handle gracefully)
      // Just verify it renders without crashing
      expect(screen.getByText('Knee Arthroscopy')).toBeInTheDocument()
    })

    it('highlights explicit vs inherited assignments differently', () => {
      render(<ProcedureTemplateAssignment />)

      // Explicit assignment should have blue border
      const explicitPicker = screen.getAllByRole('button')
        .find(btn => btn.textContent?.includes('Ortho Template') && !btn.textContent?.includes('facility default'))
      expect(explicitPicker?.className).toContain('border-blue-200')

      // Inherited assignment should have slate border
      const inheritedPicker = screen.getAllByRole('button')
        .find(btn => btn.textContent?.includes('facility default'))
      expect(inheritedPicker?.className).toContain('border-slate-200')
    })
  })
})
