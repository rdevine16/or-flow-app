// components/settings/milestones/__tests__/SurgeonOverridePanel.test.tsx
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
const mockSetOverrides = vi.fn()

vi.mock('@/hooks/useSupabaseQuery', () => ({
  useSupabaseQuery: (queryFn: () => Promise<unknown[]>) => {
    const fnStr = queryFn.toString()

    if (fnStr.includes('users')) {
      return {
        data: mockQueryDataMap.surgeons || [],
        loading: mockQueryLoading,
        error: mockQueryError,
      }
    }
    if (fnStr.includes('procedure_types')) {
      return {
        data: mockQueryDataMap.procedures || [],
        loading: mockQueryLoading,
        error: mockQueryError,
      }
    }
    if (fnStr.includes('milestone_templates')) {
      return {
        data: mockQueryDataMap.templates || [],
        loading: mockQueryLoading,
        error: mockQueryError,
      }
    }
    if (fnStr.includes('surgeon_template_overrides')) {
      return {
        data: mockQueryDataMap.overrides || [],
        loading: mockQueryLoading,
        error: mockQueryError,
        setData: mockSetOverrides,
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

let mockInsertResult: { data: unknown; error: null | { message: string } } = { data: null, error: null }
let mockUpdateResult: { error: null | { message: string } } = { error: null }
let mockDeleteResult: { error: null | { message: string } } = { error: null }

const mockSingle = vi.fn(() => mockInsertResult)
const mockSelectChain = vi.fn(() => ({ single: mockSingle }))
const mockInsert = vi.fn(() => ({ select: mockSelectChain }))
const mockUpdateEq = vi.fn(() => mockUpdateResult)
const mockUpdate = vi.fn(() => ({ eq: mockUpdateEq }))
const mockDeleteEq = vi.fn(() => mockDeleteResult)
const mockDelete = vi.fn(() => ({ eq: mockDeleteEq }))

vi.mock('@/lib/supabase', () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table === 'user_roles') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => ({ data: { id: 'role-surgeon' }, error: null })),
            })),
          })),
        }
      }
      return {
        insert: mockInsert,
        update: mockUpdate,
        delete: mockDelete,
      }
    },
  }),
}))

import { SurgeonOverridePanel } from '../SurgeonOverridePanel'

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
    name: 'Fast-Track Template',
    description: 'For quick procedures',
    is_default: false,
    is_active: true,
    deleted_at: null,
    deleted_by: null,
    block_order: {},
    sub_phase_map: {},
  },
]

const SURGEONS = [
  { id: 'surgeon-1', first_name: 'Alice', last_name: 'Smith' },
  { id: 'surgeon-2', first_name: 'Bob', last_name: 'Johnson' },
  { id: 'surgeon-3', first_name: 'Carol', last_name: 'Williams' },
]

const PROCEDURES = [
  { id: 'proc-1', name: 'Total Hip Replacement', category_name: 'Orthopedic', milestone_template_id: 'tmpl-1' },
  { id: 'proc-2', name: 'Knee Arthroscopy', category_name: 'Orthopedic', milestone_template_id: null },
  { id: 'proc-3', name: 'ACL Repair', category_name: 'Orthopedic', milestone_template_id: 'tmpl-1' },
]

const OVERRIDES = [
  {
    id: 'override-1',
    facility_id: 'fac-1',
    surgeon_id: 'surgeon-1',
    procedure_type_id: 'proc-1',
    milestone_template_id: 'tmpl-2',
  },
  {
    id: 'override-2',
    facility_id: 'fac-1',
    surgeon_id: 'surgeon-1',
    procedure_type_id: 'proc-3',
    milestone_template_id: 'tmpl-2',
  },
]

const MILESTONES = [
  { id: 'ms-1', name: 'patient_in_room', display_name: 'Patient In Room', pair_with_id: null, pair_position: null },
  { id: 'ms-2', name: 'incision', display_name: 'Incision', pair_with_id: null, pair_position: null },
]

const PHASES = [
  { id: 'ph-1', name: 'pre_op', display_name: 'Pre-Op', color_key: 'blue', display_order: 1, parent_phase_id: null },
  { id: 'ph-2', name: 'surgical', display_name: 'Surgical', color_key: 'green', display_order: 2, parent_phase_id: null },
]

const TEMPLATE_ITEMS = [
  { id: 'item-1', template_id: 'tmpl-2', facility_milestone_id: 'ms-1', facility_phase_id: 'ph-1', display_order: 1 },
  { id: 'item-2', template_id: 'tmpl-2', facility_milestone_id: 'ms-2', facility_phase_id: 'ph-2', display_order: 2 },
]

// ─── Tests ───────────────────────────────────────────────

describe('SurgeonOverridePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockQueryDataMap = {
      surgeons: [...SURGEONS],
      procedures: [...PROCEDURES],
      templates: [...TEMPLATES],
      overrides: [...OVERRIDES],
      items: [...TEMPLATE_ITEMS],
      milestones: [...MILESTONES],
      phases: [...PHASES],
    }
    mockQueryLoading = false
    mockQueryError = null
    mockInsertResult = { data: null, error: null }
    mockUpdateResult = { error: null }
    mockDeleteResult = { error: null }
  })

  describe('rendering — 3-column layout', () => {
    it('renders surgeon list in column 1', () => {
      render(<SurgeonOverridePanel />)

      expect(screen.getByText('Smith, Alice')).toBeInTheDocument()
      expect(screen.getByText('Johnson, Bob')).toBeInTheDocument()
      expect(screen.getByText('Williams, Carol')).toBeInTheDocument()
    })

    it('shows override count badges on surgeons with overrides', () => {
      render(<SurgeonOverridePanel />)

      // Alice has 2 overrides
      const aliceRow = screen.getByText('Smith, Alice').closest('button')
      expect(aliceRow?.textContent).toContain('2')

      // Bob has no overrides (no badge)
      const bobRow = screen.getByText('Johnson, Bob').closest('button')
      expect(bobRow?.textContent).not.toMatch(/\d/)
    })

    it('shows empty states when no selection', () => {
      render(<SurgeonOverridePanel />)

      // Column 2 shows "Select a surgeon" prompt
      expect(screen.getByText('Select a surgeon')).toBeInTheDocument()

      // Column 3 shows empty state
      expect(screen.getByText('Select a surgeon and procedure')).toBeInTheDocument()
    })

    it('shows surgeon count in footer', () => {
      render(<SurgeonOverridePanel />)

      expect(screen.getByText('3 surgeons')).toBeInTheDocument()
    })
  })

  describe('surgeon selection', () => {
    it('shows procedure list when surgeon is clicked', async () => {
      const user = userEvent.setup()
      render(<SurgeonOverridePanel />)

      await user.click(screen.getByText('Smith, Alice'))

      // Column 2 should show procedures
      expect(screen.getByText('Total Hip Replacement')).toBeInTheDocument()
      expect(screen.getByText('Knee Arthroscopy')).toBeInTheDocument()
      expect(screen.getByText('ACL Repair')).toBeInTheDocument()
    })

    it('highlights selected surgeon', async () => {
      const user = userEvent.setup()
      render(<SurgeonOverridePanel />)

      await user.click(screen.getByText('Smith, Alice'))

      const aliceRow = screen.getByText('Smith, Alice').closest('button')
      expect(aliceRow?.className).toContain('bg-blue-50')
    })

    it('shows Override badge on procedures with surgeon override', async () => {
      const user = userEvent.setup()
      render(<SurgeonOverridePanel />)

      await user.click(screen.getByText('Smith, Alice'))

      // Alice has 2 overrides (Total Hip and ACL Repair)
      expect(screen.getAllByText('Override').length).toBe(2)
    })

    it('shows override count in column 2 footer', async () => {
      const user = userEvent.setup()
      render(<SurgeonOverridePanel />)

      await user.click(screen.getByText('Smith, Alice'))

      expect(screen.getByText('2 overrides')).toBeInTheDocument()
    })

    it('resets procedure selection when switching surgeons', async () => {
      const user = userEvent.setup()
      render(<SurgeonOverridePanel />)

      // Select surgeon and procedure
      await user.click(screen.getByText('Smith, Alice'))
      await user.click(screen.getByText('Total Hip Replacement'))

      // Switch surgeon
      await user.click(screen.getByText('Johnson, Bob'))

      // Column 3 should show prompt (no procedure selected)
      expect(screen.getByText('Select a procedure')).toBeInTheDocument()
    })
  })

  describe('procedure selection — column 3 detail', () => {
    it('shows template detail when surgeon + procedure selected', async () => {
      const user = userEvent.setup()
      render(<SurgeonOverridePanel />)

      await user.click(screen.getByText('Smith, Alice'))
      await user.click(screen.getByText('Total Hip Replacement'))

      // Column 3 should show header
      expect(screen.getByText('Smith, Alice', { selector: 'h3' })).toBeInTheDocument()
      expect(screen.getByText('Total Hip Replacement', { selector: 'p' })).toBeInTheDocument()
    })

    it('shows Override badge for overridden procedure', async () => {
      const user = userEvent.setup()
      render(<SurgeonOverridePanel />)

      await user.click(screen.getByText('Smith, Alice'))
      await user.click(screen.getByText('Total Hip Replacement'))

      // Override badge in column 3
      const badges = screen.getAllByText('Override')
      expect(badges.length).toBeGreaterThan(0)
    })

    it('shows Inherited badge for non-overridden procedure', async () => {
      const user = userEvent.setup()
      render(<SurgeonOverridePanel />)

      await user.click(screen.getByText('Smith, Alice'))
      await user.click(screen.getByText('Knee Arthroscopy'))

      expect(screen.getByText('Inherited')).toBeInTheDocument()
    })

    it('shows timeline preview for selected procedure', async () => {
      const user = userEvent.setup()
      render(<SurgeonOverridePanel />)

      await user.click(screen.getByText('Smith, Alice'))
      await user.click(screen.getByText('Total Hip Replacement'))

      // Template items for tmpl-2 (Fast-Track) include Patient In Room and Incision
      expect(screen.getByText('Patient In Room')).toBeInTheDocument()
      expect(screen.getByText('Incision')).toBeInTheDocument()
    })
  })

  describe('surgeon search filtering', () => {
    it('filters surgeon list by name', async () => {
      const user = userEvent.setup()
      render(<SurgeonOverridePanel />)

      const searchInput = screen.getByPlaceholderText('Search surgeons...')
      await user.type(searchInput, 'Smith')

      expect(screen.getByText('Smith, Alice')).toBeInTheDocument()
      expect(screen.queryByText('Johnson, Bob')).not.toBeInTheDocument()
      expect(screen.queryByText('Williams, Carol')).not.toBeInTheDocument()
      expect(screen.getByText('1 surgeon')).toBeInTheDocument()
    })

    it('shows empty state when no surgeons match', async () => {
      const user = userEvent.setup()
      render(<SurgeonOverridePanel />)

      const searchInput = screen.getByPlaceholderText('Search surgeons...')
      await user.type(searchInput, 'Nonexistent')

      expect(screen.getByText('No surgeons match your search.')).toBeInTheDocument()
    })
  })

  describe('procedure search filtering', () => {
    it('filters procedure list by name', async () => {
      const user = userEvent.setup()
      render(<SurgeonOverridePanel />)

      // Select surgeon first
      await user.click(screen.getByText('Smith, Alice'))

      const searchInput = screen.getByPlaceholderText('Filter procedures...')
      await user.type(searchInput, 'Hip')

      expect(screen.getByText('Total Hip Replacement')).toBeInTheDocument()
      expect(screen.queryByText('Knee Arthroscopy')).not.toBeInTheDocument()
      expect(screen.queryByText('ACL Repair')).not.toBeInTheDocument()
    })
  })

  describe('override mutations', () => {
    it('creates new override for a procedure', async () => {
      mockInsertResult = {
        data: {
          id: 'override-new',
          facility_id: 'fac-1',
          surgeon_id: 'surgeon-1',
          procedure_type_id: 'proc-2',
          milestone_template_id: 'tmpl-2',
        },
        error: null,
      }

      const user = userEvent.setup()
      render(<SurgeonOverridePanel />)

      // Select surgeon and procedure
      await user.click(screen.getByText('Smith, Alice'))
      await user.click(screen.getByText('Knee Arthroscopy'))

      // Open template picker in column 3
      const pickerButton = screen.getByRole('button', { name: /procedure default/ })
      await user.click(pickerButton)

      // Select "Fast-Track Template"
      await waitFor(() => {
        expect(screen.getAllByText('Fast-Track Template').length).toBeGreaterThan(0)
      })
      const fastTrackOption = screen.getAllByText('Fast-Track Template').find(el =>
        el.closest('button')?.getAttribute('class')?.includes('hover:bg-slate-50')
      )
      if (fastTrackOption?.closest('button')) {
        await user.click(fastTrackOption.closest('button')!)
      }

      await waitFor(() => {
        expect(mockInsert).toHaveBeenCalled()
      })

      expect(mockShowToast).toHaveBeenCalledWith({
        type: 'success',
        title: expect.stringContaining('Fast-Track Template'),
      })
    })

    it('removes override (use procedure default)', async () => {
      const user = userEvent.setup()
      render(<SurgeonOverridePanel />)

      // Select surgeon and overridden procedure
      await user.click(screen.getByText('Smith, Alice'))
      await user.click(screen.getByText('Total Hip Replacement'))

      // Open picker
      const pickerButton = screen.getByRole('button', { name: /Fast-Track Template/ })
      await user.click(pickerButton)

      // Select "Use procedure default"
      await waitFor(() => {
        expect(screen.getByText('Use procedure default')).toBeInTheDocument()
      })
      await user.click(screen.getByText('Use procedure default'))

      await waitFor(() => {
        expect(mockDelete).toHaveBeenCalled()
        expect(mockDeleteEq).toHaveBeenCalledWith('id', 'override-1')
      })

      expect(mockShowToast).toHaveBeenCalledWith({
        type: 'success',
        title: expect.stringContaining('procedure default'),
      })
    })
  })

  describe('loading and error states', () => {
    it('shows skeleton while loading', () => {
      mockQueryLoading = true
      render(<SurgeonOverridePanel />)

      const skeletons = document.querySelectorAll('.animate-pulse')
      expect(skeletons.length).toBeGreaterThan(0)
    })

    it('shows error banner on fetch error', () => {
      mockQueryError = 'Failed to fetch surgeons'
      render(<SurgeonOverridePanel />)

      expect(screen.getByText('Failed to fetch surgeons')).toBeInTheDocument()
    })

    it('shows empty state when no surgeons exist', () => {
      mockQueryDataMap.surgeons = []
      render(<SurgeonOverridePanel />)

      expect(screen.getByText('No Surgeons')).toBeInTheDocument()
      expect(screen.getByText(/No surgeons found for this facility/)).toBeInTheDocument()
    })
  })
})
