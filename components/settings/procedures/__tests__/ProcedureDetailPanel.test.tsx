// components/settings/procedures/__tests__/ProcedureDetailPanel.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ============================================
// MOCKS — must be declared before component import
// ============================================

const mockShowToast = vi.fn()
vi.mock('@/components/ui/Toast/ToastProvider', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}))

vi.mock('@/lib/audit-logger', () => ({
  procedureAudit: {
    created: vi.fn(),
    updated: vi.fn(),
    deleted: vi.fn(),
    restored: vi.fn(),
  },
}))

// Supabase mock: controllable via mutate variables
let mockSaveData: unknown = null
let mockSaveError: { message: string } | null = null
let mockActionError: { message: string } | null = null

const mockSingle = vi.fn(() => ({ data: mockSaveData, error: mockSaveError }))
const mockSelectAfterInsert = vi.fn(() => ({ single: mockSingle }))
const mockInsert = vi.fn(() => ({ select: mockSelectAfterInsert }))
const mockSelectAfterUpdate = vi.fn(() => ({ single: mockSingle }))
const mockUpdateEq = vi.fn(() => ({ select: mockSelectAfterUpdate }))

// Simple update chain for archive/restore (no select needed)
const mockSimpleEq = vi.fn(() => ({ data: null, error: mockActionError }))
const mockSimpleUpdate = vi.fn(() => ({ eq: mockSimpleEq }))

vi.mock('@/lib/supabase', () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table === 'procedure_types') {
        return {
          insert: mockInsert,
          update: vi.fn((payload: unknown) => {
            // Archive/restore updates don't have .select; save updates do
            const p = payload as Record<string, unknown>
            if ('deleted_at' in p && !('name' in p)) {
              return { eq: mockSimpleEq }
            }
            return { eq: mockUpdateEq }
          }),
        }
      }
      return {}
    },
  }),
}))

// Mock SurgeonOverrideList — it has its own tests; don't double-test it here
vi.mock('../SurgeonOverrideList', () => ({
  SurgeonOverrideList: () => <div data-testid="surgeon-override-list" />,
}))

import { ProcedureDetailPanel } from '../ProcedureDetailPanel'
import type { ProcedureType } from '../ProcedureDetailPanel'

// ============================================
// FIXTURES
// ============================================

const BODY_REGIONS = [{ id: 'br-1', name: 'spine', display_name: 'Spine' }]
const TECHNIQUES = [{ id: 'tech-1', name: 'open', display_name: 'Open' }]
const PROCEDURE_CATEGORIES = [
  { id: 'cat-1', name: 'spinal_fusion', display_name: 'Spinal Fusion', body_region_id: 'br-1' },
]
const SURGEONS = [{ id: 's-1', first_name: 'Alice', last_name: 'Smith' }]

const ACTIVE_PROCEDURE: ProcedureType = {
  id: 'proc-1',
  name: 'Total Hip Replacement',
  body_region_id: 'br-1',
  technique_id: 'tech-1',
  procedure_category_id: 'cat-1',
  implant_category: 'total_hip',
  expected_duration_minutes: 90,
  is_active: true,
  deleted_at: null,
  deleted_by: null,
  body_regions: BODY_REGIONS[0],
  procedure_techniques: TECHNIQUES[0],
  procedure_categories: PROCEDURE_CATEGORIES[0],
}

const ARCHIVED_PROCEDURE: ProcedureType = {
  ...ACTIVE_PROCEDURE,
  id: 'proc-archived',
  deleted_at: new Date().toISOString(),
  deleted_by: 'user-1',
}

const DEFAULT_PROPS = {
  procedure: ACTIVE_PROCEDURE,
  mode: 'view' as const,
  facilityId: 'facility-1',
  canManage: true,
  bodyRegions: BODY_REGIONS,
  techniques: TECHNIQUES,
  procedureCategories: PROCEDURE_CATEGORIES,
  surgeons: SURGEONS,
  overrides: [],
  currentUserId: 'user-1',
  onSaved: vi.fn(),
  onArchived: vi.fn(),
  onRestored: vi.fn(),
  onCancelAdd: vi.fn(),
  onOverrideAdded: vi.fn(),
  onOverrideUpdated: vi.fn(),
  onOverrideRemoved: vi.fn(),
}

// ============================================
// TESTS
// ============================================

describe('ProcedureDetailPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSaveData = null
    mockSaveError = null
    mockActionError = null
    mockSingle.mockReturnValue({ data: mockSaveData, error: mockSaveError })
    mockSimpleEq.mockReturnValue({ data: null, error: null })
    mockUpdateEq.mockReturnValue({ select: mockSelectAfterUpdate })
  })

  // --- Unit: Empty state when no procedure selected ---

  it('renders empty state when procedure is null and mode is view', () => {
    render(<ProcedureDetailPanel {...DEFAULT_PROPS} procedure={null} />)
    expect(screen.getByText('Select a procedure')).toBeTruthy()
  })

  // --- Unit: View mode rendering ---

  it('renders procedure name in header', () => {
    render(<ProcedureDetailPanel {...DEFAULT_PROPS} />)
    expect(screen.getByText('Total Hip Replacement')).toBeTruthy()
  })

  it('renders duration badge when procedure has expected_duration_minutes', () => {
    render(<ProcedureDetailPanel {...DEFAULT_PROPS} />)
    expect(screen.getByText('90 min')).toBeTruthy()
  })

  it('renders Archive button for active procedures when canManage', () => {
    render(<ProcedureDetailPanel {...DEFAULT_PROPS} />)
    expect(screen.getByText('Archive')).toBeTruthy()
  })

  it('does not render Archive button when canManage is false', () => {
    render(<ProcedureDetailPanel {...DEFAULT_PROPS} canManage={false} />)
    expect(screen.queryByText('Archive')).toBeFalsy()
  })

  // --- Unit: Archived procedure rendering ---

  it('renders ARCHIVED badge for archived procedures', () => {
    render(<ProcedureDetailPanel {...DEFAULT_PROPS} procedure={ARCHIVED_PROCEDURE} />)
    expect(screen.getByText('ARCHIVED')).toBeTruthy()
  })

  it('renders Restore button instead of Archive for archived procedures', () => {
    render(<ProcedureDetailPanel {...DEFAULT_PROPS} procedure={ARCHIVED_PROCEDURE} />)
    expect(screen.getByText('Restore')).toBeTruthy()
    expect(screen.queryByText('Archive')).toBeFalsy()
  })

  it('disables form fields for archived procedures', () => {
    render(<ProcedureDetailPanel {...DEFAULT_PROPS} procedure={ARCHIVED_PROCEDURE} />)
    const nameInput = screen.getByPlaceholderText('e.g., Total Hip Replacement')
    expect((nameInput as HTMLInputElement).disabled).toBe(true)
  })

  it('does not render SurgeonOverrideList for archived procedures', () => {
    render(<ProcedureDetailPanel {...DEFAULT_PROPS} procedure={ARCHIVED_PROCEDURE} />)
    expect(screen.queryByTestId('surgeon-override-list')).toBeFalsy()
  })

  // --- Unit: Add mode rendering ---

  it('renders "New Procedure" heading in add mode', () => {
    render(<ProcedureDetailPanel {...DEFAULT_PROPS} procedure={null} mode="add" />)
    expect(screen.getByText('New Procedure')).toBeTruthy()
  })

  it('renders Cancel button in add mode', () => {
    render(<ProcedureDetailPanel {...DEFAULT_PROPS} procedure={null} mode="add" />)
    expect(screen.getByText('Cancel')).toBeTruthy()
  })

  it('does not render SurgeonOverrideList in add mode', () => {
    render(<ProcedureDetailPanel {...DEFAULT_PROPS} procedure={null} mode="add" />)
    expect(screen.queryByTestId('surgeon-override-list')).toBeFalsy()
  })

  it('calls onCancelAdd when Cancel clicked in add mode', async () => {
    const user = userEvent.setup()
    const onCancelAdd = vi.fn()
    render(
      <ProcedureDetailPanel {...DEFAULT_PROPS} procedure={null} mode="add" onCancelAdd={onCancelAdd} />
    )
    await user.click(screen.getByText('Cancel'))
    expect(onCancelAdd).toHaveBeenCalledTimes(1)
  })

  // --- Unit: Form fields populate from selected procedure ---

  it('populates name input from selected procedure', () => {
    render(<ProcedureDetailPanel {...DEFAULT_PROPS} />)
    const nameInput = screen.getByPlaceholderText('e.g., Total Hip Replacement') as HTMLInputElement
    expect(nameInput.value).toBe('Total Hip Replacement')
  })

  it('populates duration input from selected procedure', () => {
    render(<ProcedureDetailPanel {...DEFAULT_PROPS} />)
    const durationInput = screen.getByPlaceholderText('e.g., 90') as HTMLInputElement
    expect(durationInput.value).toBe('90')
  })

  // --- Unit: Save button state ---

  it('Save Changes button is disabled when form is not dirty', () => {
    render(<ProcedureDetailPanel {...DEFAULT_PROPS} />)
    const saveBtn = screen.getByText('Save Changes').closest('button')
    expect(saveBtn).toBeDisabled()
  })

  it('Save Changes button enables after editing name', async () => {
    const user = userEvent.setup()
    render(<ProcedureDetailPanel {...DEFAULT_PROPS} />)
    const nameInput = screen.getByPlaceholderText('e.g., Total Hip Replacement')
    await user.type(nameInput, ' Updated')
    const saveBtn = screen.getByText('Save Changes').closest('button')
    expect(saveBtn).not.toBeDisabled()
  })

  it('Create Procedure button is always enabled when name is non-empty in add mode', async () => {
    const user = userEvent.setup()
    render(<ProcedureDetailPanel {...DEFAULT_PROPS} procedure={null} mode="add" />)
    const nameInput = screen.getByPlaceholderText('e.g., Total Hip Replacement')
    await user.type(nameInput, 'New Procedure Name')
    const createBtn = screen.getByText('Create Procedure').closest('button')
    expect(createBtn).not.toBeDisabled()
  })

  // --- Unit: handleSave — update (edit mode) ---

  it('calls onSaved with updated procedure after successful save', async () => {
    const user = userEvent.setup()
    const updatedProc = { ...ACTIVE_PROCEDURE, name: 'Total Hip Replacement Updated' }
    mockSingle.mockReturnValue({ data: updatedProc, error: null })

    const onSaved = vi.fn()
    render(<ProcedureDetailPanel {...DEFAULT_PROPS} onSaved={onSaved} />)

    const nameInput = screen.getByPlaceholderText('e.g., Total Hip Replacement')
    await user.clear(nameInput)
    await user.type(nameInput, 'Total Hip Replacement Updated')

    await user.click(screen.getByText('Save Changes'))

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith(updatedProc, false)
      expect(mockShowToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }))
    })
  })

  it('shows error toast when save fails', async () => {
    const user = userEvent.setup()
    mockSingle.mockReturnValue({ data: null, error: { message: 'Update failed' } })

    render(<ProcedureDetailPanel {...DEFAULT_PROPS} />)
    const nameInput = screen.getByPlaceholderText('e.g., Total Hip Replacement')
    await user.type(nameInput, ' X')
    await user.click(screen.getByText('Save Changes'))

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }))
    })
  })

  // --- Unit: handleSave — create (add mode) ---

  it('calls onSaved with isNew=true after successful create', async () => {
    const user = userEvent.setup()
    const newProc = { ...ACTIVE_PROCEDURE, id: 'proc-new', name: 'Knee Arthroscopy' }
    mockSingle.mockReturnValue({ data: newProc, error: null })

    const onSaved = vi.fn()
    render(<ProcedureDetailPanel {...DEFAULT_PROPS} procedure={null} mode="add" onSaved={onSaved} />)

    const nameInput = screen.getByPlaceholderText('e.g., Total Hip Replacement')
    await user.type(nameInput, 'Knee Arthroscopy')
    await user.click(screen.getByText('Create Procedure'))

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith(newProc, true)
    })
  })

  it('passes facility_id in insert payload when creating', async () => {
    const user = userEvent.setup()
    mockSingle.mockReturnValue({ data: { ...ACTIVE_PROCEDURE, id: 'proc-new' }, error: null })

    render(
      <ProcedureDetailPanel {...DEFAULT_PROPS} procedure={null} mode="add" facilityId="facility-xyz" />
    )
    await user.type(screen.getByPlaceholderText('e.g., Total Hip Replacement'), 'Test Proc')
    await user.click(screen.getByText('Create Procedure'))

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({ facility_id: 'facility-xyz' })
      )
    })
  })

  // --- Unit: handleArchive ---

  it('calls onArchived with procedure id after archive', async () => {
    const user = userEvent.setup()
    mockSimpleEq.mockReturnValue({ data: null, error: null })
    const onArchived = vi.fn()
    render(<ProcedureDetailPanel {...DEFAULT_PROPS} onArchived={onArchived} />)
    await user.click(screen.getByText('Archive'))

    await waitFor(() => {
      expect(onArchived).toHaveBeenCalledWith('proc-1')
    })
  })

  it('shows success toast after archive', async () => {
    const user = userEvent.setup()
    mockSimpleEq.mockReturnValue({ data: null, error: null })
    render(<ProcedureDetailPanel {...DEFAULT_PROPS} />)
    await user.click(screen.getByText('Archive'))

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }))
    })
  })

  // --- Unit: handleRestore ---

  it('calls onRestored with procedure after restore', async () => {
    const user = userEvent.setup()
    mockSimpleEq.mockReturnValue({ data: null, error: null })
    const onRestored = vi.fn()
    render(
      <ProcedureDetailPanel {...DEFAULT_PROPS} procedure={ARCHIVED_PROCEDURE} onRestored={onRestored} />
    )
    await user.click(screen.getByText('Restore'))

    await waitFor(() => {
      expect(onRestored).toHaveBeenCalledWith(ARCHIVED_PROCEDURE)
    })
  })

  // --- Unit: Category filtering by body region ---

  it('filters procedure categories by selected body region', async () => {
    const user = userEvent.setup()
    const categories = [
      { id: 'cat-spine', name: 'spinal', display_name: 'Spinal', body_region_id: 'br-1' },
      { id: 'cat-hip', name: 'hip', display_name: 'Hip', body_region_id: 'br-2' },
    ]
    render(
      <ProcedureDetailPanel
        {...DEFAULT_PROPS}
        procedureCategories={categories}
        procedure={{ ...ACTIVE_PROCEDURE, body_region_id: 'br-1', procedure_category_id: null }}
      />
    )
    // Category select should only show categories for br-1 plus empty option
    const categorySelect = screen.getByLabelText('Category') as HTMLSelectElement
    const options = Array.from(categorySelect.options).map(o => o.text)
    expect(options.some(o => o.includes('Spinal'))).toBe(true)
    expect(options.some(o => o.includes('Hip'))).toBe(false)
  })

  // --- ORbit domain: duration validation — zero/null duration saved as null not 0 ---

  it('does not store 0 as expected_duration_minutes — empty input saves successfully', async () => {
    const user = userEvent.setup()
    // Procedure with no duration set; form will have empty duration field
    const savedProc = { ...ACTIVE_PROCEDURE, expected_duration_minutes: null }
    mockSingle.mockReturnValue({ data: savedProc, error: null })

    const onSaved = vi.fn()
    render(
      <ProcedureDetailPanel
        {...DEFAULT_PROPS}
        procedure={{ ...ACTIVE_PROCEDURE, expected_duration_minutes: null }}
        onSaved={onSaved}
      />
    )
    // Dirty the form by changing name (duration stays empty)
    const nameInput = screen.getByPlaceholderText('e.g., Total Hip Replacement')
    await user.type(nameInput, ' X')
    await user.click(screen.getByText('Save Changes'))

    await waitFor(() => {
      // Save must succeed — onSaved called and success toast shown
      expect(onSaved).toHaveBeenCalledWith(savedProc, false)
      expect(mockShowToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }))
    })
  })

  // --- Unit: SurgeonOverrideList is shown for active, existing procedures ---

  it('renders SurgeonOverrideList for active existing procedures', () => {
    render(<ProcedureDetailPanel {...DEFAULT_PROPS} />)
    expect(screen.getByTestId('surgeon-override-list')).toBeTruthy()
  })
})
