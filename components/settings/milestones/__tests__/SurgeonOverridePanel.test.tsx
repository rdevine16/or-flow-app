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
    name: 'Fast-Track Template',
    description: 'For quick procedures',
    is_default: false,
    is_active: true,
    deleted_at: null,
    deleted_by: null,
  },
]

const SURGEONS = [
  { id: 'surgeon-1', first_name: 'Alice', last_name: 'Smith' },
  { id: 'surgeon-2', first_name: 'Bob', last_name: 'Johnson' },
  { id: 'surgeon-3', first_name: 'Carol', last_name: 'Williams' },
]

const PROCEDURES = [
  { id: 'proc-1', name: 'Total Hip Replacement', category: 'Orthopedic', milestone_template_id: 'tmpl-1' },
  { id: 'proc-2', name: 'Knee Arthroscopy', category: 'Orthopedic', milestone_template_id: null },
  { id: 'proc-3', name: 'ACL Repair', category: 'Orthopedic', milestone_template_id: 'tmpl-1' },
]

const OVERRIDES = [
  {
    id: 'override-1',
    facility_id: 'fac-1',
    surgeon_id: 'surgeon-1',
    procedure_type_id: 'proc-1',
    milestone_template_id: 'tmpl-2', // Alice uses Fast-Track for Hip Replacement
  },
  {
    id: 'override-2',
    facility_id: 'fac-1',
    surgeon_id: 'surgeon-1',
    procedure_type_id: 'proc-3',
    milestone_template_id: 'tmpl-2', // Alice uses Fast-Track for ACL Repair too
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

  describe('rendering', () => {
    it('renders surgeon list in left panel', () => {
      render(<SurgeonOverridePanel />)

      expect(screen.getByText('Smith, Alice')).toBeInTheDocument()
      expect(screen.getByText('Johnson, Bob')).toBeInTheDocument()
      expect(screen.getByText('Williams, Carol')).toBeInTheDocument()
    })

    it('shows override count badges on surgeons with overrides', () => {
      render(<SurgeonOverridePanel />)

      // Alice has 2 overrides
      const aliceRow = screen.getByText('Smith, Alice').closest('button')
      expect(aliceRow).toBeTruthy()
      expect(aliceRow?.textContent).toContain('2')

      // Bob has no overrides (no badge)
      const bobRow = screen.getByText('Johnson, Bob').closest('button')
      expect(bobRow?.textContent).not.toMatch(/\d/)
    })

    it('auto-selects first surgeon on mount', () => {
      render(<SurgeonOverridePanel />)

      // Alice Smith should be selected (blue background)
      const aliceRow = screen.getByText('Smith, Alice').closest('button')
      expect(aliceRow?.className).toContain('bg-blue-50')
    })

    it('shows procedure list for selected surgeon', () => {
      render(<SurgeonOverridePanel />)

      // Alice is selected, should show her name in header
      expect(screen.getByText(/Alice Smith/)).toBeInTheDocument()
      expect(screen.getByText('2 overrides configured')).toBeInTheDocument()

      // Should show all procedures
      expect(screen.getByText('Total Hip Replacement')).toBeInTheDocument()
      expect(screen.getByText('Knee Arthroscopy')).toBeInTheDocument()
      expect(screen.getByText('ACL Repair')).toBeInTheDocument()
    })

    it('shows Override badge for procedures with surgeon override', () => {
      render(<SurgeonOverridePanel />)

      // Alice has 2 overrides (Total Hip and ACL Repair)
      expect(screen.getAllByText('Override').length).toBe(2)

      // Knee Arthroscopy does NOT have override for Alice
      expect(screen.getByText('Inherited')).toBeInTheDocument()
    })

    it('shows template name for overridden procedures', () => {
      render(<SurgeonOverridePanel />)

      // Alice overrides Total Hip with Fast-Track
      expect(screen.getAllByText('Fast-Track Template').length).toBeGreaterThan(0)
    })

    it('shows procedure default label for inherited procedures', () => {
      render(<SurgeonOverridePanel />)

      // Knee Arthroscopy inherits from procedure (which is null → facility default)
      expect(screen.getByText(/Standard Workflow \(procedure default\)/)).toBeInTheDocument()
    })

    it('renders milestone chips for effective template', () => {
      render(<SurgeonOverridePanel />)

      expect(screen.getAllByText('Patient In Room').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Incision').length).toBeGreaterThan(0)
    })
  })

  describe('surgeon selection', () => {
    it('switches selected surgeon on click', async () => {
      const user = userEvent.setup()
      render(<SurgeonOverridePanel />)

      // Click Bob
      await user.click(screen.getByText('Johnson, Bob'))

      // Bob should be highlighted
      const bobRow = screen.getByText('Johnson, Bob').closest('button')
      expect(bobRow?.className).toContain('bg-blue-50')

      // Right panel should show Bob's name
      expect(screen.getByText(/Bob Johnson/)).toBeInTheDocument()
      expect(screen.getByText('0 overrides configured')).toBeInTheDocument()
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

      const searchInput = screen.getByPlaceholderText('Filter procedures...')
      await user.type(searchInput, 'Hip')

      expect(screen.getByText('Total Hip Replacement')).toBeInTheDocument()
      expect(screen.queryByText('Knee Arthroscopy')).not.toBeInTheDocument()
      expect(screen.queryByText('ACL Repair')).not.toBeInTheDocument()
    })

    it('filters procedure list by category', async () => {
      const user = userEvent.setup()
      render(<SurgeonOverridePanel />)

      const searchInput = screen.getByPlaceholderText('Filter procedures...')
      await user.type(searchInput, 'Orthopedic')

      expect(screen.getByText('Total Hip Replacement')).toBeInTheDocument()
      expect(screen.getByText('Knee Arthroscopy')).toBeInTheDocument()
      expect(screen.getByText('ACL Repair')).toBeInTheDocument()
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

      // Open picker for "Knee Arthroscopy" (no override yet)
      const inheritedPickers = screen.getAllByRole('button')
        .filter(btn => btn.textContent?.includes('procedure default'))
      await user.click(inheritedPickers[0])

      // Select "Fast-Track Template"
      await waitFor(() => {
        expect(screen.getAllByText('Fast-Track Template').length).toBeGreaterThan(1)
      })
      const fastTrackOption = screen.getAllByText('Fast-Track Template').find(el =>
        el.closest('button')?.getAttribute('class')?.includes('hover:bg-slate-50')
      )
      if (fastTrackOption?.closest('button')) {
        await user.click(fastTrackOption.closest('button')!)
      }

      // Verify insert was called
      await waitFor(() => {
        expect(mockInsert).toHaveBeenCalled()
      })

      expect(mockShowToast).toHaveBeenCalledWith({
        type: 'success',
        title: expect.stringContaining('Fast-Track Template'),
      })
    })

    it('updates existing override', async () => {
      const user = userEvent.setup()
      render(<SurgeonOverridePanel />)

      // Open picker for "Total Hip Replacement" (has override to Fast-Track)
      const fastTrackPickers = screen.getAllByRole('button')
        .filter(btn => btn.textContent?.includes('Fast-Track Template') && !btn.textContent?.includes('procedure default'))
      await user.click(fastTrackPickers[0])

      // Select "Ortho Template"
      await waitFor(() => {
        expect(screen.getAllByText('Ortho Template').length).toBeGreaterThan(0)
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
        expect(mockUpdateEq).toHaveBeenCalledWith('id', 'override-1')
      })

      expect(mockShowToast).toHaveBeenCalledWith({
        type: 'success',
        title: expect.stringContaining('Ortho Template'),
      })
    })

    it('removes override (use procedure default)', async () => {
      const user = userEvent.setup()
      render(<SurgeonOverridePanel />)

      // Open picker for "Total Hip Replacement" (has override)
      const fastTrackPickers = screen.getAllByRole('button')
        .filter(btn => btn.textContent?.includes('Fast-Track Template') && !btn.textContent?.includes('procedure default'))
      await user.click(fastTrackPickers[0])

      // Select "Use procedure default"
      await waitFor(() => {
        expect(screen.getByText('Use procedure default')).toBeInTheDocument()
      })
      await user.click(screen.getByText('Use procedure default'))

      // Verify delete was called
      await waitFor(() => {
        expect(mockDelete).toHaveBeenCalled()
        expect(mockDeleteEq).toHaveBeenCalledWith('id', 'override-1')
      })

      expect(mockShowToast).toHaveBeenCalledWith({
        type: 'success',
        title: expect.stringContaining('procedure default'),
      })
    })

    it('handles override creation error gracefully', async () => {
      mockInsertResult = { data: null, error: { message: 'Unique constraint violation' } }

      const user = userEvent.setup()
      render(<SurgeonOverridePanel />)

      const inheritedPickers = screen.getAllByRole('button')
        .filter(btn => btn.textContent?.includes('procedure default'))
      await user.click(inheritedPickers[0])

      await waitFor(() => {
        expect(screen.getAllByText('Fast-Track Template').length).toBeGreaterThan(1)
      })
      const fastTrackOption = screen.getAllByText('Fast-Track Template').find(el =>
        el.closest('button')?.getAttribute('class')?.includes('hover:bg-slate-50')
      )
      if (fastTrackOption?.closest('button')) {
        await user.click(fastTrackOption.closest('button')!)
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

  describe('template cascade verification', () => {
    it('shows correct template priority: override > procedure > facility default', () => {
      render(<SurgeonOverridePanel />)

      // Total Hip has override (Fast-Track) even though procedure has Ortho
      expect(screen.getByText('Total Hip Replacement')).toBeInTheDocument()
      expect(screen.getAllByText('Override').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Fast-Track Template').length).toBeGreaterThan(0)

      // Knee Arthroscopy has no override, inherits from procedure (which is null → facility default)
      expect(screen.getByText('Knee Arthroscopy')).toBeInTheDocument()
      expect(screen.getByText('Inherited')).toBeInTheDocument()
      expect(screen.getByText(/Standard Workflow \(procedure default\)/)).toBeInTheDocument()

      // ACL Repair has override (Fast-Track) even though procedure has Ortho
      expect(screen.getByText('ACL Repair')).toBeInTheDocument()
      // Override badge and Fast-Track template are already verified above
    })

    it('highlights override rows differently', () => {
      render(<SurgeonOverridePanel />)

      // We can verify badges appear correctly (override vs inherited)
      // Rows with overrides get amber-colored badges
      const overrideBadge = screen.getAllByText('Override')[0]
      expect(overrideBadge.className).toContain('bg-amber-100')

      // Rows without overrides get slate-colored badges
      const inheritedBadge = screen.getByText('Inherited')
      expect(inheritedBadge.className).toContain('bg-slate-100')
    })
  })
})
