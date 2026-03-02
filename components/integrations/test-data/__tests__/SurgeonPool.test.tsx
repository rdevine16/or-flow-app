import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SurgeonPool from '../SurgeonPool'
import { ehrTestDataDAL } from '@/lib/dal/ehr-test-data'
import type { EhrTestSurgeon } from '@/lib/integrations/shared/integration-types'

// Mock dependencies
vi.mock('@/lib/supabase', () => ({
  createClient: vi.fn(() => ({} as never)),
}))

vi.mock('@/lib/dal/ehr-test-data', () => ({
  ehrTestDataDAL: {
    listSurgeons: vi.fn(),
    createSurgeon: vi.fn(),
    updateSurgeon: vi.fn(),
    deleteSurgeon: vi.fn(),
    countSurgeonScheduleRefs: vi.fn(),
  },
}))

vi.mock('@/components/ui/Toast/ToastProvider', () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}))

const mockSurgeons: EhrTestSurgeon[] = [
  {
    id: 'surg-1',
    facility_id: 'fac-1',
    name: 'Dr. Alice Smith',
    npi: '1234567890',
    specialty: 'Orthopedics',
    external_provider_id: 'EPIC-PROV-001',
    created_at: '2026-03-01T12:00:00Z',
    updated_at: '2026-03-01T12:00:00Z',
  },
  {
    id: 'surg-2',
    facility_id: 'fac-1',
    name: 'Dr. Bob Jones',
    npi: '9876543210',
    specialty: 'General Surgery',
    external_provider_id: 'EPIC-PROV-002',
    created_at: '2026-03-01T12:00:00Z',
    updated_at: '2026-03-01T12:00:00Z',
  },
]

describe('SurgeonPool - Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(ehrTestDataDAL.listSurgeons).mockResolvedValue({
      data: mockSurgeons,
      error: null,
    })
    vi.mocked(ehrTestDataDAL.countSurgeonScheduleRefs).mockResolvedValue({
      data: 0,
      error: null,
    })
  })

  it('renders surgeon list with correct data', async () => {
    render(<SurgeonPool facilityId="fac-1" />)

    await waitFor(() => {
      expect(screen.getByText('Dr. Alice Smith')).toBeInTheDocument()
      expect(screen.getByText('Dr. Bob Jones')).toBeInTheDocument()
    })

    expect(screen.getByText('1234567890')).toBeInTheDocument()
    expect(screen.getByText('Orthopedics')).toBeInTheDocument()
  })

  it('shows correct count badge', async () => {
    render(<SurgeonPool facilityId="fac-1" />)

    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument()
    })
  })

  it('filters surgeons by name', async () => {
    const user = userEvent.setup()
    render(<SurgeonPool facilityId="fac-1" />)

    await waitFor(() => {
      expect(screen.getByText('Dr. Alice Smith')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText(/Search by name/i)
    await user.type(searchInput, 'Alice')

    expect(screen.getByText('Dr. Alice Smith')).toBeInTheDocument()
    expect(screen.queryByText('Dr. Bob Jones')).not.toBeInTheDocument()
  })

  it('filters surgeons by NPI', async () => {
    const user = userEvent.setup()
    render(<SurgeonPool facilityId="fac-1" />)

    await waitFor(() => {
      expect(screen.getByText('Dr. Alice Smith')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText(/Search by name/i)
    await user.type(searchInput, '1234567890')

    expect(screen.getByText('Dr. Alice Smith')).toBeInTheDocument()
    expect(screen.queryByText('Dr. Bob Jones')).not.toBeInTheDocument()
  })

  it('opens add form when clicking Add Surgeon button', async () => {
    const user = userEvent.setup()
    render(<SurgeonPool facilityId="fac-1" />)

    const addButtons = await screen.findAllByText('Add Surgeon')
    const mainAddButton = addButtons[0] // First one is the main button
    await user.click(mainAddButton)

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
  })

  it('validates required name field', async () => {
    const user = userEvent.setup()
    render(<SurgeonPool facilityId="fac-1" />)

    const addButtons = await screen.findAllByText('Add Surgeon')
    await user.click(addButtons[0])

    await waitFor(() => {
      const modalSaveButtons = screen.getAllByText('Add Surgeon')
      const saveButton = modalSaveButtons.find((el) => el.closest('button') && el.closest('[role="dialog"]'))
      expect(saveButton?.closest('button')).toBeDisabled()
    })

    const nameInput = screen.getByPlaceholderText(/SMITH, JOHN A/i)
    await user.type(nameInput, 'Dr. New Surgeon')

    await waitFor(() => {
      const modalSaveButtons = screen.getAllByText('Add Surgeon')
      const saveButton = modalSaveButtons.find((el) => el.closest('button') && el.closest('[role="dialog"]'))
      expect(saveButton?.closest('button')).not.toBeDisabled()
    })
  })

  it('shows delete confirmation with cascade count', async () => {
    const user = userEvent.setup()
    vi.mocked(ehrTestDataDAL.countSurgeonScheduleRefs).mockResolvedValue({
      data: 5,
      error: null,
    })

    render(<SurgeonPool facilityId="fac-1" />)

    await waitFor(() => {
      expect(screen.getByText('Dr. Alice Smith')).toBeInTheDocument()
    })

    const deleteButtons = screen.getAllByTitle('Delete')
    await user.click(deleteButtons[0])

    await waitFor(() => {
      expect(screen.getByText(/This will also delete 5 schedule entries/i)).toBeInTheDocument()
    })
  })

  it('shows empty state when no surgeons exist', async () => {
    vi.mocked(ehrTestDataDAL.listSurgeons).mockResolvedValue({
      data: [],
      error: null,
    })

    render(<SurgeonPool facilityId="fac-1" />)

    await waitFor(() => {
      expect(screen.getByText(/No surgeons yet/i)).toBeInTheDocument()
    })
  })

  it('shows empty search results message', async () => {
    const user = userEvent.setup()
    render(<SurgeonPool facilityId="fac-1" />)

    await waitFor(() => {
      expect(screen.getByText('Dr. Alice Smith')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText(/Search by name/i)
    await user.type(searchInput, 'NonexistentSurgeon')

    expect(screen.getByText(/No surgeons match your search/i)).toBeInTheDocument()
  })
})

describe('SurgeonPool - Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(ehrTestDataDAL.listSurgeons).mockResolvedValue({
      data: mockSurgeons,
      error: null,
    })
    vi.mocked(ehrTestDataDAL.countSurgeonScheduleRefs).mockResolvedValue({
      data: 0,
      error: null,
    })
  })

  it('creates a new surgeon and refreshes the list', async () => {
    const user = userEvent.setup()
    const newSurgeon: EhrTestSurgeon = {
      id: 'surg-3',
      facility_id: 'fac-1',
      name: 'Dr. Carol White',
      npi: '1111111111',
      specialty: 'Cardiology',
      external_provider_id: null,
      created_at: '2026-03-01T12:00:00Z',
      updated_at: '2026-03-01T12:00:00Z',
    }

    vi.mocked(ehrTestDataDAL.createSurgeon).mockResolvedValue({
      data: newSurgeon,
      error: null,
    })

    // After creation, list should include new surgeon
    vi.mocked(ehrTestDataDAL.listSurgeons).mockResolvedValueOnce({
      data: mockSurgeons,
      error: null,
    }).mockResolvedValueOnce({
      data: [...mockSurgeons, newSurgeon],
      error: null,
    })

    render(<SurgeonPool facilityId="fac-1" />)

    await waitFor(() => {
      expect(screen.getByText('Dr. Alice Smith')).toBeInTheDocument()
    })

    const addButtons = screen.getAllByText('Add Surgeon')
    await user.click(addButtons[0])

    const nameInput = screen.getByPlaceholderText(/SMITH, JOHN A/i)
    await user.type(nameInput, 'Dr. Carol White')

    const npiInput = screen.getByPlaceholderText('1234567890')
    await user.type(npiInput, '1111111111')

    const specialtySelect = screen.getByRole('combobox')
    await user.selectOptions(specialtySelect, 'Cardiology')

    const saveButtons = screen.getAllByText('Add Surgeon')
    const saveButton = saveButtons.find((el) => el.closest('button'))
    await user.click(saveButton!)

    await waitFor(() => {
      expect(ehrTestDataDAL.createSurgeon).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          facility_id: 'fac-1',
          name: 'Dr. Carol White',
          npi: '1111111111',
          specialty: 'Cardiology',
        })
      )
    })
  })

  it('updates an existing surgeon and persists changes', async () => {
    const user = userEvent.setup()
    vi.mocked(ehrTestDataDAL.updateSurgeon).mockResolvedValue({
      data: { ...mockSurgeons[0], npi: '9999999999' },
      error: null,
    })

    render(<SurgeonPool facilityId="fac-1" />)

    await waitFor(() => {
      expect(screen.getByText('Dr. Alice Smith')).toBeInTheDocument()
    })

    const editButtons = screen.getAllByTitle('Edit')
    await user.click(editButtons[0])

    await waitFor(() => {
      expect(screen.getByText('Edit Surgeon')).toBeInTheDocument()
    })

    const npiInput = screen.getByPlaceholderText('1234567890')
    await user.clear(npiInput)
    await user.type(npiInput, '9999999999')

    const saveButton = screen.getByText('Save Changes')
    await user.click(saveButton)

    await waitFor(() => {
      expect(ehrTestDataDAL.updateSurgeon).toHaveBeenCalledWith(
        expect.anything(),
        'surg-1',
        expect.objectContaining({
          npi: '9999999999',
        })
      )
    })
  })

  it('deletes a surgeon and updates the list', async () => {
    const user = userEvent.setup()
    vi.mocked(ehrTestDataDAL.deleteSurgeon).mockResolvedValue({
      error: null,
    })

    // After deletion, list should exclude deleted surgeon
    vi.mocked(ehrTestDataDAL.listSurgeons)
      .mockResolvedValueOnce({ data: mockSurgeons, error: null })
      .mockResolvedValueOnce({ data: [mockSurgeons[1]], error: null })

    render(<SurgeonPool facilityId="fac-1" />)

    await waitFor(() => {
      expect(screen.getByText('Dr. Alice Smith')).toBeInTheDocument()
    })

    const deleteButtons = screen.getAllByTitle('Delete')
    await user.click(deleteButtons[0])

    await waitFor(() => {
      expect(screen.getByText(/Delete surgeon?/i)).toBeInTheDocument()
    })

    const confirmButton = screen.getByRole('button', { name: /confirm|delete/i })
    await user.click(confirmButton)

    await waitFor(() => {
      expect(ehrTestDataDAL.deleteSurgeon).toHaveBeenCalledWith(expect.anything(), 'surg-1')
    })
  })
})

describe('SurgeonPool - Workflow Tests', () => {
  it('completes full CRUD workflow: create → edit → delete', async () => {
    const user = userEvent.setup()

    // Initial state
    vi.mocked(ehrTestDataDAL.listSurgeons).mockResolvedValue({
      data: [],
      error: null,
    })

    const { rerender } = render(<SurgeonPool facilityId="fac-1" />)

    await waitFor(() => {
      expect(screen.getByText(/No surgeons yet/i)).toBeInTheDocument()
    })

    // CREATE
    const newSurgeon: EhrTestSurgeon = {
      id: 'surg-new',
      facility_id: 'fac-1',
      name: 'Dr. Test Surgeon',
      npi: '1234567890',
      specialty: 'Orthopedics',
      external_provider_id: null,
      created_at: '2026-03-01T12:00:00Z',
      updated_at: '2026-03-01T12:00:00Z',
    }

    vi.mocked(ehrTestDataDAL.createSurgeon).mockResolvedValue({
      data: newSurgeon,
      error: null,
    })

    vi.mocked(ehrTestDataDAL.listSurgeons).mockResolvedValue({
      data: [newSurgeon],
      error: null,
    })

    const addButtons = screen.getAllByText('Add Surgeon')
    await user.click(addButtons[0])

    const nameInput = screen.getByPlaceholderText(/SMITH, JOHN A/i)
    await user.type(nameInput, 'Dr. Test Surgeon')

    const saveButtons = screen.getAllByText('Add Surgeon')
    const saveButton = saveButtons.find((el) => el.closest('button'))
    await user.click(saveButton!)

    // Trigger refetch by remounting
    rerender(<SurgeonPool facilityId="fac-1" />)

    await waitFor(() => {
      expect(screen.getByText('Dr. Test Surgeon')).toBeInTheDocument()
    })

    // EDIT
    const updatedSurgeon = { ...newSurgeon, npi: '9999999999' }
    vi.mocked(ehrTestDataDAL.updateSurgeon).mockResolvedValue({
      data: updatedSurgeon,
      error: null,
    })

    vi.mocked(ehrTestDataDAL.listSurgeons).mockResolvedValue({
      data: [updatedSurgeon],
      error: null,
    })

    const editButton = screen.getByTitle('Edit')
    await user.click(editButton)

    const npiInput = screen.getByPlaceholderText('1234567890')
    await user.clear(npiInput)
    await user.type(npiInput, '9999999999')

    const saveChangesButton = screen.getByText('Save Changes')
    await user.click(saveChangesButton)

    rerender(<SurgeonPool facilityId="fac-1" />)

    // DELETE
    vi.mocked(ehrTestDataDAL.deleteSurgeon).mockResolvedValue({ error: null })
    vi.mocked(ehrTestDataDAL.listSurgeons).mockResolvedValue({
      data: [],
      error: null,
    })

    const deleteButton = screen.getByTitle('Delete')
    await user.click(deleteButton)

    await waitFor(() => {
      expect(screen.getByText(/Delete surgeon?/i)).toBeInTheDocument()
    })

    const confirmButton = screen.getByRole('button', { name: /confirm|delete/i })
    await user.click(confirmButton)

    await waitFor(() => {
      expect(ehrTestDataDAL.deleteSurgeon).toHaveBeenCalled()
    })
  })
})
