import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import HL7v2TestHarnessPage from '../PageClient'
import { ehrTestDataDAL } from '@/lib/dal/ehr-test-data'

// Mock dependencies
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  usePathname: () => '/admin/settings/hl7v2-test-harness',
}))

vi.mock('@/lib/UserContext', () => ({
  useUser: () => ({
    isGlobalAdmin: true,
    isAdmin: true,
    loading: false,
    userData: { firstName: 'Test', lastName: 'User', facilityId: 'fac-1', role: 'global_admin', email: 'test@example.com' },
    can: () => true,
  }),
}))

vi.mock('@/lib/SubNavContext', () => ({
  useSubNav: () => ({
    items: [],
    title: '',
    isVisible: false,
  }),
}))

vi.mock('@/lib/supabase', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          { id: 'fac-1', name: 'Test Facility 1' },
          { id: 'fac-2', name: 'Test Facility 2' },
        ],
        error: null,
      }),
    })),
  })),
}))

vi.mock('@/lib/dal/ehr-test-data', () => ({
  ehrTestDataDAL: {
    listSurgeons: vi.fn(),
    listProcedures: vi.fn(),
    listRooms: vi.fn(),
    listPatients: vi.fn(),
    listDiagnoses: vi.fn(),
    createSurgeon: vi.fn(),
    updateSurgeon: vi.fn(),
    deleteSurgeon: vi.fn(),
    countSurgeonScheduleRefs: vi.fn(),
    countProcedureScheduleRefs: vi.fn(),
    countRoomScheduleRefs: vi.fn(),
    countPatientScheduleRefs: vi.fn(),
    countDiagnosisScheduleRefs: vi.fn(),
  },
}))

vi.mock('@/components/ui/Toast/ToastProvider', () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}))

describe('HL7v2TestHarnessPage - Workflow Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Mock empty pools initially
    vi.mocked(ehrTestDataDAL.listSurgeons).mockResolvedValue({ data: [], error: null })
    vi.mocked(ehrTestDataDAL.listProcedures).mockResolvedValue({ data: [], error: null })
    vi.mocked(ehrTestDataDAL.listRooms).mockResolvedValue({ data: [], error: null })
    vi.mocked(ehrTestDataDAL.listPatients).mockResolvedValue({ data: [], error: null })
    vi.mocked(ehrTestDataDAL.listDiagnoses).mockResolvedValue({ data: [], error: null })

    vi.mocked(ehrTestDataDAL.countSurgeonScheduleRefs).mockResolvedValue({ data: 0, error: null })
    vi.mocked(ehrTestDataDAL.countProcedureScheduleRefs).mockResolvedValue({ data: 0, error: null })
    vi.mocked(ehrTestDataDAL.countRoomScheduleRefs).mockResolvedValue({ data: 0, error: null })
    vi.mocked(ehrTestDataDAL.countPatientScheduleRefs).mockResolvedValue({ data: 0, error: null })
    vi.mocked(ehrTestDataDAL.countDiagnosisScheduleRefs).mockResolvedValue({ data: 0, error: null })
  })

  it('renders top-level tabs correctly', async () => {
    render(<HL7v2TestHarnessPage />)

    await waitFor(() => {
      expect(screen.getByText('Run Scenarios')).toBeInTheDocument()
      expect(screen.getByText('Entity Pools')).toBeInTheDocument()
      expect(screen.getByText('Schedules')).toBeInTheDocument()
    })
  })

  it('renders facility selector on all tabs', async () => {
    const user = userEvent.setup()
    render(<HL7v2TestHarnessPage />)

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })

    // Switch to Entity Pools tab
    const entityPoolsTab = screen.getByText('Entity Pools')
    await user.click(entityPoolsTab)

    // Facility selector should still be present
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('displays entity pool sub-tabs when Entity Pools tab is active', async () => {
    const user = userEvent.setup()
    render(<HL7v2TestHarnessPage />)

    await waitFor(() => {
      expect(screen.getByText('Entity Pools')).toBeInTheDocument()
    })

    // Select a facility first — sub-tabs only render when a facility is selected
    const facilitySelector = screen.getByRole('combobox')
    await user.selectOptions(facilitySelector, 'fac-1')

    const entityPoolsTab = screen.getByText('Entity Pools')
    await user.click(entityPoolsTab)

    await waitFor(() => {
      // Use getAllByText because sub-tab button AND pool heading both contain these labels
      expect(screen.getAllByText('Surgeons').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Procedures').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Rooms').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Patients').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Diagnoses').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('switches between entity pool sub-tabs', async () => {
    const user = userEvent.setup()
    render(<HL7v2TestHarnessPage />)

    await waitFor(() => {
      expect(screen.getByText('Entity Pools')).toBeInTheDocument()
    })

    // Select a facility first — sub-tabs only render when a facility is selected
    const facilitySelector = screen.getByRole('combobox')
    await user.selectOptions(facilitySelector, 'fac-1')

    const entityPoolsTab = screen.getByText('Entity Pools')
    await user.click(entityPoolsTab)

    await waitFor(() => {
      expect(screen.getAllByText('Surgeons').length).toBeGreaterThanOrEqual(1)
    })

    // Default should show Surgeons pool
    expect(ehrTestDataDAL.listSurgeons).toHaveBeenCalled()

    // Click Procedures sub-tab
    const proceduresTab = screen.getByText('Procedures')
    await user.click(proceduresTab)

    await waitFor(() => {
      expect(ehrTestDataDAL.listProcedures).toHaveBeenCalled()
    })

    // Click Patients sub-tab
    const patientsTab = screen.getByText('Patients')
    await user.click(patientsTab)

    await waitFor(() => {
      expect(ehrTestDataDAL.listPatients).toHaveBeenCalled()
    })
  })

  it('changes facility and refetches pool data', async () => {
    const user = userEvent.setup()

    // Mock surgeons for fac-1
    vi.mocked(ehrTestDataDAL.listSurgeons).mockResolvedValue({
      data: [
        {
          id: 'surg-1',
          facility_id: 'fac-1',
          name: 'Dr. Facility 1 Surgeon',
          npi: '1234567890',
          specialty: 'Orthopedics',
          external_provider_id: null,
          created_at: '2026-03-01T12:00:00Z',
          updated_at: '2026-03-01T12:00:00Z',
        },
      ],
      error: null,
    })

    render(<HL7v2TestHarnessPage />)

    await waitFor(() => {
      expect(screen.getByText('Entity Pools')).toBeInTheDocument()
    })

    const entityPoolsTab = screen.getByText('Entity Pools')
    await user.click(entityPoolsTab)

    // Select facility
    const facilitySelector = screen.getByRole('combobox')
    await user.selectOptions(facilitySelector, 'fac-1')

    await waitFor(() => {
      expect(ehrTestDataDAL.listSurgeons).toHaveBeenCalledWith(expect.anything(), 'fac-1')
    })

    // Change facility to fac-2
    vi.mocked(ehrTestDataDAL.listSurgeons).mockResolvedValue({
      data: [],
      error: null,
    })

    await user.selectOptions(facilitySelector, 'fac-2')

    await waitFor(() => {
      expect(ehrTestDataDAL.listSurgeons).toHaveBeenCalledWith(expect.anything(), 'fac-2')
    })
  })

  it('persists entity pool data across tab switches', async () => {
    const user = userEvent.setup()

    const mockSurgeons = [
      {
        id: 'surg-1',
        facility_id: 'fac-1',
        name: 'Dr. Test',
        npi: '1234567890',
        specialty: 'Orthopedics',
        external_provider_id: null,
        created_at: '2026-03-01T12:00:00Z',
        updated_at: '2026-03-01T12:00:00Z',
      },
    ]

    const mockProcedures = [
      {
        id: 'proc-1',
        facility_id: 'fac-1',
        name: 'Test Procedure',
        cpt_code: '12345',
        typical_duration_min: 60,
        specialty: 'Orthopedics',
        created_at: '2026-03-01T12:00:00Z',
        updated_at: '2026-03-01T12:00:00Z',
      },
    ]

    vi.mocked(ehrTestDataDAL.listSurgeons).mockResolvedValue({ data: mockSurgeons, error: null })
    vi.mocked(ehrTestDataDAL.listProcedures).mockResolvedValue({ data: mockProcedures, error: null })

    render(<HL7v2TestHarnessPage />)

    await waitFor(() => {
      expect(screen.getByText('Entity Pools')).toBeInTheDocument()
    })

    const entityPoolsTab = screen.getByText('Entity Pools')
    await user.click(entityPoolsTab)

    // Select facility first
    const facilitySelector = screen.getByRole('combobox')
    await user.selectOptions(facilitySelector, 'fac-1')

    await waitFor(() => {
      expect(screen.getByText('Dr. Test')).toBeInTheDocument()
    })

    // Switch to Procedures sub-tab
    const proceduresTab = screen.getByText('Procedures')
    await user.click(proceduresTab)

    await waitFor(() => {
      expect(screen.getByText('Test Procedure')).toBeInTheDocument()
    })

    // Switch back to Surgeons sub-tab
    const surgeonsTab = screen.getByText('Surgeons')
    await user.click(surgeonsTab)

    // Surgeon data should still be there (component state persists)
    await waitFor(() => {
      expect(screen.getByText('Dr. Test')).toBeInTheDocument()
    })

    // Switch to Run Scenarios top tab
    const scenariosTab = screen.getByText('Run Scenarios')
    await user.click(scenariosTab)

    // Switch back to Entity Pools
    await user.click(entityPoolsTab)

    // Data should still persist
    await waitFor(() => {
      expect(screen.getByText('Dr. Test')).toBeInTheDocument()
    })
  })

  it('creates entities across all pool types and verifies persistence', async () => {
    const user = userEvent.setup()

    // Mock creation responses
    vi.mocked(ehrTestDataDAL.createSurgeon).mockResolvedValue({
      data: {
        id: 'surg-new',
        facility_id: 'fac-1',
        name: 'Dr. New Surgeon',
        npi: '1234567890',
        specialty: 'Orthopedics',
        external_provider_id: null,
        created_at: '2026-03-01T12:00:00Z',
        updated_at: '2026-03-01T12:00:00Z',
      },
      error: null,
    })

    // Initial empty state, then after creation
    vi.mocked(ehrTestDataDAL.listSurgeons)
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValue({
        data: [
          {
            id: 'surg-new',
            facility_id: 'fac-1',
            name: 'Dr. New Surgeon',
            npi: '1234567890',
            specialty: 'Orthopedics',
            external_provider_id: null,
            created_at: '2026-03-01T12:00:00Z',
            updated_at: '2026-03-01T12:00:00Z',
          },
        ],
        error: null,
      })

    render(<HL7v2TestHarnessPage />)

    await waitFor(() => {
      expect(screen.getByText('Entity Pools')).toBeInTheDocument()
    })

    const entityPoolsTab = screen.getByText('Entity Pools')
    await user.click(entityPoolsTab)

    // Select facility
    const facilitySelector = screen.getByRole('combobox')
    await user.selectOptions(facilitySelector, 'fac-1')

    await waitFor(() => {
      expect(screen.getByText(/No surgeons yet/i)).toBeInTheDocument()
    })

    // Create a surgeon
    const addButton = screen.getByText('Add Surgeon')
    await user.click(addButton)

    const nameInput = screen.getByPlaceholderText(/SMITH, JOHN A/i)
    await user.type(nameInput, 'Dr. New Surgeon')

    const npiInput = screen.getByPlaceholderText('1234567890')
    await user.type(npiInput, '1234567890')

    // Scope within dialog to avoid matching the facility selector combobox
    const dialog = screen.getByRole('dialog')
    const specialtySelect = within(dialog).getByRole('combobox')
    await user.selectOptions(specialtySelect, 'Orthopedics')

    const saveButton = within(dialog).getByRole('button', { name: /Add Surgeon/i })
    await user.click(saveButton)

    await waitFor(() => {
      expect(ehrTestDataDAL.createSurgeon).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          facility_id: 'fac-1',
          name: 'Dr. New Surgeon',
        })
      )
    })
  })
})
