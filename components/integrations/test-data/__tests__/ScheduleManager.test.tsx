import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ScheduleManager from '../ScheduleManager'
import { ehrTestDataDAL } from '@/lib/dal/ehr-test-data'
import type {
  EhrTestScheduleWithEntities,
  EhrTestTriggerEvent,
} from '@/lib/integrations/shared/integration-types'

// Mock dependencies
vi.mock('@/lib/supabase', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ count: 0, error: null })),
      })),
    })),
  })),
}))

vi.mock('@/lib/dal/ehr-test-data', () => ({
  ehrTestDataDAL: {
    listSchedules: vi.fn(),
    createSchedule: vi.fn(),
    updateSchedule: vi.fn(),
    deleteSchedule: vi.fn(),
    listOriginalSchedules: vi.fn(),
    listPatients: vi.fn(),
    listSurgeons: vi.fn(),
    listProcedures: vi.fn(),
    listRooms: vi.fn(),
    listDiagnoses: vi.fn(),
  },
}))

vi.mock('@/components/ui/Toast/ToastProvider', () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}))

// Mock the ScheduleEntryForm to avoid its complex dependencies
vi.mock('../ScheduleEntryForm', () => ({
  default: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? (
      <div role="dialog" data-testid="schedule-entry-form">
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}))

// -- Test data ----------------------------------------------------------------

function makeSchedule(
  overrides: Partial<EhrTestScheduleWithEntities> & { trigger_event: EhrTestTriggerEvent }
): EhrTestScheduleWithEntities {
  return {
    id: `sched-${Math.random().toString(36).slice(2, 8)}`,
    facility_id: 'fac-1',
    patient_id: 'pat-1',
    surgeon_id: 'surg-1',
    procedure_id: 'proc-1',
    room_id: 'room-1',
    diagnosis_id: null,
    scheduled_date: '2026-03-15',
    start_time: '07:30',
    duration_min: 60,
    external_case_id: 'TEST-ABCD1234',
    references_schedule_id: null,
    notes: null,
    sequence_order: 0,
    created_at: '2026-03-01T12:00:00Z',
    updated_at: '2026-03-01T12:00:00Z',
    patient: { id: 'pat-1', facility_id: 'fac-1', first_name: 'Jane', last_name: 'Doe', mrn: 'MRN-001', date_of_birth: '1980-01-15', gender: 'F', address_line: null, city: null, state: null, zip: null, phone: null, created_at: '', updated_at: '' },
    surgeon: { id: 'surg-1', facility_id: 'fac-1', name: 'Dr. Smith', npi: '1234567890', specialty: 'Orthopedics', external_provider_id: null, created_at: '', updated_at: '' },
    procedure: { id: 'proc-1', facility_id: 'fac-1', name: 'Total Knee Replacement', cpt_code: '27447', typical_duration_min: 90, specialty: 'Orthopedics', created_at: '', updated_at: '' },
    room: { id: 'room-1', facility_id: 'fac-1', name: 'OR-1', location_code: 'MAIN-1', room_type: 'operating_room', created_at: '', updated_at: '' },
    diagnosis: null,
    referenced_schedule: null,
    ...overrides,
  }
}

const mockS12 = makeSchedule({
  id: 'sched-1',
  trigger_event: 'S12',
  sequence_order: 1,
  external_case_id: 'TEST-AAAA1111',
  notes: 'Tests standard new case',
})

const mockS13 = makeSchedule({
  id: 'sched-2',
  trigger_event: 'S13',
  sequence_order: 2,
  external_case_id: 'TEST-AAAA1111',
  references_schedule_id: 'sched-1',
  referenced_schedule: { id: 'sched-1', external_case_id: 'TEST-AAAA1111', trigger_event: 'S12' },
  start_time: '09:00',
  notes: null,
})

const mockS15 = makeSchedule({
  id: 'sched-3',
  trigger_event: 'S15',
  sequence_order: 3,
  external_case_id: 'TEST-AAAA1111',
  references_schedule_id: 'sched-1',
  referenced_schedule: { id: 'sched-1', external_case_id: 'TEST-AAAA1111', trigger_event: 'S12' },
  patient: { id: 'pat-2', facility_id: 'fac-1', first_name: 'John', last_name: 'Adams', mrn: 'MRN-002', date_of_birth: null, gender: 'M', address_line: null, city: null, state: null, zip: null, phone: null, created_at: '', updated_at: '' },
  patient_id: 'pat-2',
  notes: 'Tests cancel scenario',
})

const mockSchedules = [mockS12, mockS13, mockS15]

// Helper to wait for data to load
async function waitForTableLoaded() {
  await waitFor(() => {
    expect(screen.getByText('Schedule Entries')).toBeInTheDocument()
    // The table should be rendered (look for at least one trigger event badge)
    expect(screen.getByText('S12 New')).toBeInTheDocument()
  })
}

// -- Tests --------------------------------------------------------------------

describe('ScheduleManager - Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(ehrTestDataDAL.listSchedules).mockResolvedValue({
      data: mockSchedules,
      error: null,
    })
  })

  it('renders schedule table with all entries', async () => {
    render(<ScheduleManager facilityId="fac-1" />)
    await waitForTableLoaded()

    // Patient "Doe, Jane" appears in 2 rows (S12 and S13), "Adams, John" in 1
    const doeEntries = screen.getAllByText('Doe, Jane')
    expect(doeEntries.length).toBe(2)
    expect(screen.getByText('Adams, John')).toBeInTheDocument()

    // All rows show procedure and room
    const procEntries = screen.getAllByText('Total Knee Replacement')
    expect(procEntries.length).toBe(3)
    const roomEntries = screen.getAllByText('OR-1')
    expect(roomEntries.length).toBe(3)
  })

  it('shows correct count badge', async () => {
    render(<ScheduleManager facilityId="fac-1" />)
    await waitForTableLoaded()

    // The badge is inside the header flex container
    const header = screen.getByText('Schedule Entries').parentElement
    const badge = header?.querySelector('span')
    expect(badge?.textContent).toBe('3')
  })

  it('renders trigger event badges with correct labels', async () => {
    render(<ScheduleManager facilityId="fac-1" />)
    await waitForTableLoaded()

    expect(screen.getByText('S12 New')).toBeInTheDocument()
    expect(screen.getByText('S13 Resched')).toBeInTheDocument()
    expect(screen.getByText('S15 Cancel')).toBeInTheDocument()
  })

  it('displays sequence order numbers', async () => {
    render(<ScheduleManager facilityId="fac-1" />)
    await waitForTableLoaded()

    // Header row + 3 data rows
    const rows = screen.getAllByRole('row')
    expect(rows.length).toBeGreaterThanOrEqual(4)
  })

  it('shows reference link for S13/S15 entries', async () => {
    render(<ScheduleManager facilityId="fac-1" />)
    await waitForTableLoaded()

    // S13 and S15 both reference S12 with external_case_id TEST-AAAA1111
    // Displayed as truncated: "AAAA1111" (after removing "TEST-" prefix)
    const refLinks = screen.getAllByText('AAAA1111')
    expect(refLinks.length).toBe(2)
  })

  it('formats time as 12-hour format', async () => {
    render(<ScheduleManager facilityId="fac-1" />)
    await waitForTableLoaded()

    // S12 and S15 at 7:30 AM, S13 at 9:00 AM
    const morningTimes = screen.getAllByText('7:30 AM')
    expect(morningTimes.length).toBe(2)
    expect(screen.getByText('9:00 AM')).toBeInTheDocument()
  })

  it('formats date as short format', async () => {
    render(<ScheduleManager facilityId="fac-1" />)
    await waitForTableLoaded()

    const dateCells = screen.getAllByText('Mar 15')
    expect(dateCells.length).toBe(3)
  })

  it('shows duration in minutes', async () => {
    render(<ScheduleManager facilityId="fac-1" />)
    await waitForTableLoaded()

    const durationCells = screen.getAllByText('60m')
    expect(durationCells.length).toBe(3)
  })

  it('shows notes section when entries have notes', async () => {
    render(<ScheduleManager facilityId="fac-1" />)
    await waitForTableLoaded()

    expect(screen.getByText('Tests standard new case')).toBeInTheDocument()
    expect(screen.getByText('Tests cancel scenario')).toBeInTheDocument()
  })

  it('shows empty state when no facility selected', () => {
    render(<ScheduleManager facilityId="" />)
    expect(screen.getByText('Select a facility above')).toBeInTheDocument()
  })

  it('shows empty state when no schedules exist', async () => {
    vi.mocked(ehrTestDataDAL.listSchedules).mockResolvedValue({
      data: [],
      error: null,
    })

    render(<ScheduleManager facilityId="fac-1" />)

    await waitFor(() => {
      expect(screen.getByText(/No schedule entries yet/i)).toBeInTheDocument()
    })
  })
})

describe('ScheduleManager - Search Filtering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(ehrTestDataDAL.listSchedules).mockResolvedValue({
      data: mockSchedules,
      error: null,
    })
  })

  it('filters by patient name', async () => {
    const user = userEvent.setup()
    render(<ScheduleManager facilityId="fac-1" />)
    await waitForTableLoaded()

    const searchInput = screen.getByPlaceholderText(/Search by patient/i)
    await user.type(searchInput, 'Adams')

    // Only the S15 entry shows (patient is John Adams)
    expect(screen.getByText('Adams, John')).toBeInTheDocument()
    expect(screen.queryByText('Doe, Jane')).not.toBeInTheDocument()
  })

  it('filters by surgeon name', async () => {
    const user = userEvent.setup()
    render(<ScheduleManager facilityId="fac-1" />)
    await waitForTableLoaded()

    const searchInput = screen.getByPlaceholderText(/Search by patient/i)
    await user.type(searchInput, 'Smith')

    // All entries have Dr. Smith
    const smithCells = screen.getAllByText('Dr. Smith')
    expect(smithCells.length).toBe(3)
  })

  it('filters by procedure name', async () => {
    const user = userEvent.setup()
    render(<ScheduleManager facilityId="fac-1" />)
    await waitForTableLoaded()

    const searchInput = screen.getByPlaceholderText(/Search by patient/i)
    await user.type(searchInput, 'knee')

    const kneeEntries = screen.getAllByText('Total Knee Replacement')
    expect(kneeEntries.length).toBe(3)
  })

  it('filters by trigger event', async () => {
    const user = userEvent.setup()
    render(<ScheduleManager facilityId="fac-1" />)
    await waitForTableLoaded()

    const searchInput = screen.getByPlaceholderText(/Search by patient/i)
    await user.type(searchInput, 's15')

    expect(screen.getByText('S15 Cancel')).toBeInTheDocument()
    expect(screen.queryByText('S12 New')).not.toBeInTheDocument()
  })

  it('filters by external case ID', async () => {
    const user = userEvent.setup()
    render(<ScheduleManager facilityId="fac-1" />)
    await waitForTableLoaded()

    const searchInput = screen.getByPlaceholderText(/Search by patient/i)
    await user.type(searchInput, 'AAAA1111')

    // All entries share the same external_case_id
    const entries = screen.getAllByText('Dr. Smith')
    expect(entries.length).toBe(3)
  })

  it('filters by notes', async () => {
    const user = userEvent.setup()
    render(<ScheduleManager facilityId="fac-1" />)
    await waitForTableLoaded()

    const searchInput = screen.getByPlaceholderText(/Search by patient/i)
    await user.type(searchInput, 'cancel scenario')

    // Only S15 has "Tests cancel scenario" in notes
    expect(screen.getByText('Adams, John')).toBeInTheDocument()
    expect(screen.queryByText('Doe, Jane')).not.toBeInTheDocument()
  })

  it('shows empty search results message', async () => {
    const user = userEvent.setup()
    render(<ScheduleManager facilityId="fac-1" />)
    await waitForTableLoaded()

    const searchInput = screen.getByPlaceholderText(/Search by patient/i)
    await user.type(searchInput, 'zzzznonexistent')

    expect(screen.getByText(/No schedule entries match your search/i)).toBeInTheDocument()
  })
})

describe('ScheduleManager - Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(ehrTestDataDAL.listSchedules).mockResolvedValue({
      data: mockSchedules,
      error: null,
    })
  })

  it('opens add form when clicking Add Entry button', async () => {
    const user = userEvent.setup()
    render(<ScheduleManager facilityId="fac-1" />)
    await waitForTableLoaded()

    const addButton = screen.getByText('Add Entry')
    await user.click(addButton)

    await waitFor(() => {
      expect(screen.getByTestId('schedule-entry-form')).toBeInTheDocument()
    })
  })

  it('opens edit form when clicking edit action', async () => {
    const user = userEvent.setup()
    render(<ScheduleManager facilityId="fac-1" />)
    await waitForTableLoaded()

    const editButtons = screen.getAllByTitle('Edit')
    await user.click(editButtons[0])

    await waitFor(() => {
      expect(screen.getByTestId('schedule-entry-form')).toBeInTheDocument()
    })
  })

  it('shows delete confirmation dialog', async () => {
    const user = userEvent.setup()
    render(<ScheduleManager facilityId="fac-1" />)
    await waitForTableLoaded()

    const deleteButtons = screen.getAllByTitle('Delete')
    await user.click(deleteButtons[0])

    await waitFor(() => {
      expect(screen.getByText(/Delete schedule entry\?/i)).toBeInTheDocument()
    })
  })

  it('calls deleteSchedule on confirm and refreshes list', async () => {
    const user = userEvent.setup()
    vi.mocked(ehrTestDataDAL.deleteSchedule).mockResolvedValue({ error: null })

    render(<ScheduleManager facilityId="fac-1" />)
    await waitForTableLoaded()

    // Click delete on the second entry (S13 — not S12)
    const deleteButtons = screen.getAllByTitle('Delete')
    await user.click(deleteButtons[1])

    await waitFor(() => {
      expect(screen.getByText(/Delete schedule entry\?/i)).toBeInTheDocument()
    })

    // Find the confirm button inside the delete dialog — use the one that says "Confirm" or "Delete"
    const dialog = screen.getByText(/Delete schedule entry\?/i).closest('[role="dialog"]') || document.body
    const confirmButtons = Array.from(dialog.querySelectorAll('button')).filter(
      (btn) => btn.textContent?.match(/confirm|delete/i) && !btn.textContent?.match(/cancel/i)
    )
    await user.click(confirmButtons[0])

    await waitFor(() => {
      expect(ehrTestDataDAL.deleteSchedule).toHaveBeenCalledWith(expect.anything(), 'sched-2')
    })
  })
})

describe('ScheduleManager - Workflow Tests', () => {
  it('admin views entries, searches, and interacts with CRUD actions', async () => {
    const user = userEvent.setup()
    vi.mocked(ehrTestDataDAL.listSchedules).mockResolvedValue({
      data: mockSchedules,
      error: null,
    })

    render(<ScheduleManager facilityId="fac-1" />)

    // Step 1: All entries loaded
    await waitForTableLoaded()
    expect(screen.getByText('S12 New')).toBeInTheDocument()
    expect(screen.getByText('S13 Resched')).toBeInTheDocument()
    expect(screen.getByText('S15 Cancel')).toBeInTheDocument()

    // Step 2: Search narrows results
    const searchInput = screen.getByPlaceholderText(/Search by patient/i)
    await user.type(searchInput, 'Adams')
    expect(screen.getByText('Adams, John')).toBeInTheDocument()
    expect(screen.queryByText('Doe, Jane')).not.toBeInTheDocument()

    // Step 3: Clear search shows all again
    await user.clear(searchInput)
    await waitFor(() => {
      const doeEntries = screen.getAllByText('Doe, Jane')
      expect(doeEntries.length).toBe(2)
    })

    // Step 4: Open add form
    const addButton = screen.getByText('Add Entry')
    await user.click(addButton)
    expect(screen.getByTestId('schedule-entry-form')).toBeInTheDocument()

    // Step 5: Close form
    const closeButton = screen.getByText('Close')
    await user.click(closeButton)
    expect(screen.queryByTestId('schedule-entry-form')).not.toBeInTheDocument()
  })
})
