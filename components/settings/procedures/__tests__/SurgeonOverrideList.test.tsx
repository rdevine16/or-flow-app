// components/settings/procedures/__tests__/SurgeonOverrideList.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ============================================
// MOCKS — must be declared before component import
// ============================================

const mockShowToast = vi.fn()
vi.mock('@/components/ui/Toast/ToastProvider', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}))

let mockInsertResult: { data: unknown; error: null | { message: string } } = {
  data: null,
  error: null,
}
let mockUpdateError: { message: string } | null = null
let mockDeleteError: { message: string } | null = null

const mockSingle = vi.fn(() => mockInsertResult)
const mockSelect = vi.fn(() => ({ single: mockSingle }))
const mockInsertChain = { select: mockSelect }
const mockInsert = vi.fn(() => mockInsertChain)
const mockUpdateChain = {
  eq: vi.fn(() => mockUpdateChain),
  then: (resolve: (v: unknown) => void) => resolve({ error: mockUpdateError }),
}
const mockUpdate = vi.fn(() => mockUpdateChain)

vi.mock('@/lib/supabase', () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table === 'surgeon_procedure_duration') {
        return {
          insert: mockInsert,
          update: mockUpdate,
        }
      }
      return {}
    },
  }),
}))

import { SurgeonOverrideList } from '../SurgeonOverrideList'

// ============================================
// FIXTURES
// ============================================

const SURGEONS = [
  { id: 'surgeon-1', first_name: 'Alice', last_name: 'Smith' },
  { id: 'surgeon-2', first_name: 'Bob', last_name: 'Jones' },
]

const EXISTING_OVERRIDES = [
  { id: 'override-1', surgeon_id: 'surgeon-1', procedure_type_id: 'proc-1', expected_duration_minutes: 90 },
]

const DEFAULT_PROPS = {
  overrides: EXISTING_OVERRIDES,
  procedureId: 'proc-1',
  facilityId: 'facility-1',
  surgeons: SURGEONS,
  canManage: true,
  onAdded: vi.fn(),
  onUpdated: vi.fn(),
  onRemoved: vi.fn(),
}

// ============================================
// TESTS
// ============================================

describe('SurgeonOverrideList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpdateError = null
    mockDeleteError = null
    mockInsertResult = { data: null, error: null }
    mockUpdateChain.eq.mockReturnValue(mockUpdateChain)
  })

  // --- Unit: Rendering ---

  it('renders the section heading', () => {
    render(<SurgeonOverrideList {...DEFAULT_PROPS} />)
    expect(screen.getByText('Surgeon Overrides')).toBeTruthy()
  })

  it('renders override count badge when overrides exist', () => {
    render(<SurgeonOverrideList {...DEFAULT_PROPS} />)
    expect(screen.getByText('1')).toBeTruthy()
  })

  it('shows surgeon name and duration for each existing override', () => {
    render(<SurgeonOverrideList {...DEFAULT_PROPS} />)
    expect(screen.getByText('Smith, Alice')).toBeTruthy()
    expect(screen.getByText('90 min')).toBeTruthy()
  })

  it('renders empty state when no overrides exist', () => {
    render(<SurgeonOverrideList {...DEFAULT_PROPS} overrides={[]} />)
    expect(screen.getByText(/No surgeon-specific overrides/)).toBeTruthy()
  })

  it('does not render Add Override button when canManage is false', () => {
    render(<SurgeonOverrideList {...DEFAULT_PROPS} canManage={false} />)
    expect(screen.queryByText('Add Override')).toBeFalsy()
  })

  it('does not render Add Override button when all surgeons have overrides', () => {
    const fullOverrides = SURGEONS.map((s, i) => ({
      id: `override-${i}`,
      surgeon_id: s.id,
      procedure_type_id: 'proc-1',
      expected_duration_minutes: 60,
    }))
    render(<SurgeonOverrideList {...DEFAULT_PROPS} overrides={fullOverrides} />)
    expect(screen.queryByText('Add Override')).toBeFalsy()
  })

  it('shows Add Override button only for surgeons not yet overridden', () => {
    // Only surgeon-1 has an override; surgeon-2 is available
    render(<SurgeonOverrideList {...DEFAULT_PROPS} />)
    expect(screen.getByText('Add Override')).toBeTruthy()
  })

  // --- Unit: Edit mode ---

  it('enters edit mode showing duration input when Edit button clicked', async () => {
    const user = userEvent.setup()
    render(<SurgeonOverrideList {...DEFAULT_PROPS} />)
    const editButtons = screen.getAllByRole('button').filter(b => b.querySelector('.lucide-pencil'))
    await user.click(editButtons[0])
    const inputs = screen.getAllByRole('spinbutton')
    expect(inputs.length).toBeGreaterThan(0)
    expect((inputs[0] as HTMLInputElement).value).toBe('90')
  })

  it('cancels edit mode when X button clicked', async () => {
    const user = userEvent.setup()
    render(<SurgeonOverrideList {...DEFAULT_PROPS} />)
    const editButtons = screen.getAllByRole('button').filter(b => b.querySelector('.lucide-pencil'))
    await user.click(editButtons[0])
    // Should have a cancel button
    const cancelBtn = screen.getAllByRole('button').find(b => b.querySelector('.lucide-x'))
    expect(cancelBtn).toBeTruthy()
    await user.click(cancelBtn!)
    // Input should be gone
    expect(screen.queryByRole('spinbutton')).toBeFalsy()
  })

  // --- Unit: Add form ---

  it('opens add form when Add Override clicked', async () => {
    const user = userEvent.setup()
    render(<SurgeonOverrideList {...DEFAULT_PROPS} />)
    await user.click(screen.getByText('Add Override'))
    // Select dropdown for available surgeon should appear
    expect(screen.getByRole('combobox')).toBeTruthy()
    // Duration input
    expect(screen.getByPlaceholderText('min')).toBeTruthy()
  })

  it('hides Add Override button while add form is open', async () => {
    const user = userEvent.setup()
    render(<SurgeonOverrideList {...DEFAULT_PROPS} />)
    await user.click(screen.getByText('Add Override'))
    expect(screen.queryByText('Add Override')).toBeFalsy()
  })

  it('only lists unoverridden surgeons in the add-form select', async () => {
    const user = userEvent.setup()
    render(<SurgeonOverrideList {...DEFAULT_PROPS} />)
    await user.click(screen.getByText('Add Override'))
    // surgeon-1 is already overridden, only surgeon-2 should appear
    const select = screen.getByRole('combobox') as HTMLSelectElement
    const options = Array.from(select.options).map(o => o.text)
    expect(options.some(o => o.includes('Smith'))).toBe(false)
    expect(options.some(o => o.includes('Jones'))).toBe(true)
  })

  // --- Unit: Supabase mutation — handleAdd ---

  it('calls onAdded and shows success toast after successful insert', async () => {
    const user = userEvent.setup()
    const newOverride = {
      id: 'override-new',
      surgeon_id: 'surgeon-2',
      procedure_type_id: 'proc-1',
      expected_duration_minutes: 75,
    }
    mockInsertResult = { data: newOverride, error: null }

    const onAdded = vi.fn()
    render(<SurgeonOverrideList {...DEFAULT_PROPS} onAdded={onAdded} />)
    await user.click(screen.getByText('Add Override'))

    const durationInput = screen.getByPlaceholderText('min')
    await user.type(durationInput, '75')

    const confirmBtn = screen.getAllByRole('button').find(b => b.querySelector('.lucide-check'))
    await user.click(confirmBtn!)

    await waitFor(() => {
      expect(onAdded).toHaveBeenCalledWith(newOverride)
      expect(mockShowToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }))
    })
  })

  it('shows error toast when insert fails', async () => {
    const user = userEvent.setup()
    mockInsertResult = { data: null, error: { message: 'DB error' } }
    // Make single() throw
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } })

    render(<SurgeonOverrideList {...DEFAULT_PROPS} />)
    await user.click(screen.getByText('Add Override'))
    const durationInput = screen.getByPlaceholderText('min')
    await user.type(durationInput, '60')
    const confirmBtn = screen.getAllByRole('button').find(b => b.querySelector('.lucide-check'))
    await user.click(confirmBtn!)

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }))
    })
  })

  // --- Unit: Validation — negative/zero duration is rejected ---

  it('does not call insert when duration is 0', async () => {
    const user = userEvent.setup()
    render(<SurgeonOverrideList {...DEFAULT_PROPS} />)
    await user.click(screen.getByText('Add Override'))
    const durationInput = screen.getByPlaceholderText('min')
    await user.type(durationInput, '0')
    const confirmBtn = screen.getAllByRole('button').find(b => b.querySelector('.lucide-check'))
    await user.click(confirmBtn!)
    expect(mockInsert).not.toHaveBeenCalled()
  })

  // --- Unit: Soft-delete correctness ---

  it('sends deleted_at update (not hard delete) when deleting an override', async () => {
    const user = userEvent.setup()
    render(<SurgeonOverrideList {...DEFAULT_PROPS} />)
    const deleteBtn = screen.getAllByRole('button').find(b => b.querySelector('.lucide-trash-2'))
    await user.click(deleteBtn!)

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ deleted_at: expect.any(String) })
      )
    })
  })

  it('calls onRemoved with override id after successful soft-delete', async () => {
    const user = userEvent.setup()
    const onRemoved = vi.fn()
    render(<SurgeonOverrideList {...DEFAULT_PROPS} onRemoved={onRemoved} />)
    const deleteBtn = screen.getAllByRole('button').find(b => b.querySelector('.lucide-trash-2'))
    await user.click(deleteBtn!)

    await waitFor(() => {
      expect(onRemoved).toHaveBeenCalledWith('override-1')
    })
  })

  // --- ORbit domain: facility scoping ---

  it('passes facility_id in insert payload', async () => {
    const user = userEvent.setup()
    const newOverride = {
      id: 'override-new',
      surgeon_id: 'surgeon-2',
      procedure_type_id: 'proc-1',
      expected_duration_minutes: 45,
    }
    mockInsertResult = { data: newOverride, error: null }

    render(<SurgeonOverrideList {...DEFAULT_PROPS} facilityId="facility-abc" />)
    await user.click(screen.getByText('Add Override'))
    const durationInput = screen.getByPlaceholderText('min')
    await user.type(durationInput, '45')
    const confirmBtn = screen.getAllByRole('button').find(b => b.querySelector('.lucide-check'))
    await user.click(confirmBtn!)

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({ facility_id: 'facility-abc' })
      )
    })
  })
})
