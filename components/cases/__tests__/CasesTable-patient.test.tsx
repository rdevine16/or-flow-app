import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import CasesTable from '../CasesTable'
import type { CaseListItem } from '@/lib/dal/cases'
import type { SortParams } from '@/lib/dal'

// ============================================
// MOCKS
// ============================================

vi.mock('@/lib/UserContext', () => ({
  useUser: () => ({
    can: () => true,
    canAny: () => true,
    canAll: () => true,
    permissionsLoading: false,
    userData: { accessLevel: 'facility_admin', userId: 'user-1', facilityId: 'fac-1' },
    loading: false,
    isGlobalAdmin: false,
    isAdmin: true,
    isImpersonating: false,
    effectiveFacilityId: 'fac-1',
  }),
}))

// ============================================
// HELPERS
// ============================================

function makeCaseItem(overrides: Partial<CaseListItem> = {}): CaseListItem {
  return {
    id: 'case-1',
    case_number: 'CASE-001',
    scheduled_date: '2026-02-14',
    start_time: '08:00:00',
    status_id: 'status-1',
    data_validated: true,
    is_excluded_from_metrics: false,
    or_room_id: 'room-1',
    surgeon_id: 'surgeon-1',
    facility_id: 'facility-1',
    created_at: '2026-02-14T00:00:00Z',
    created_by: 'user-1',
    surgeon: { first_name: 'John', last_name: 'Smith' },
    or_room: { name: 'OR-1' },
    case_status: { name: 'Completed' },
    procedure_type: { id: 'proc-1', name: 'Total Hip', procedure_category_id: null, expected_duration_minutes: 90 },
    case_completion_stats: { total_duration_minutes: 120 },
    patient_id: null,
    source: 'manual',
    patient: null,
    ...overrides,
  }
}

const DEFAULT_SORT: SortParams = { sortBy: 'date', sortDirection: 'desc' }

function renderTable(cases: CaseListItem[]) {
  return render(
    <CasesTable
      cases={cases}
      loading={false}
      error={null}
      activeTab="all"
      sort={DEFAULT_SORT}
      onSortChange={vi.fn()}
      page={1}
      pageSize={25}
      totalCount={cases.length}
      totalPages={1}
      onPageChange={vi.fn()}
      flagSummaries={new Map()}
      categoryNameById={new Map()}
      selectedRows={new Set()}
      onToggleRow={vi.fn()}
      onToggleAllRows={vi.fn()}
      onRowClick={vi.fn()}
      onCancelCase={vi.fn()}
      onExportSelected={vi.fn()}
      dqCaseIds={new Set()}
    />
  )
}

// ============================================
// UNIT TESTS: Patient column rendering
// ============================================

describe('CasesTable — Patient column', () => {
  it('shows Patient column header', () => {
    renderTable([makeCaseItem()])
    expect(screen.getByText('Patient')).toBeInTheDocument()
  })

  it('shows patient name as "Last, First" when patient exists', () => {
    const cases = [makeCaseItem({
      patient_id: 'patient-1',
      patient: { first_name: 'Jane', last_name: 'Doe', mrn: 'MRN-123', date_of_birth: '1990-01-15' },
    })]
    renderTable(cases)
    expect(screen.getByText('Doe, Jane')).toBeInTheDocument()
  })

  it('shows dash when patient is null', () => {
    const cases = [makeCaseItem({ patient_id: null, patient: null })]
    const { container } = renderTable(cases)

    // Find cells that display em-dash for null patient
    const cells = container.querySelectorAll('span')
    const hasDash = Array.from(cells).some(cell => cell.textContent === '\u2014')
    expect(hasDash).toBe(true)
  })

  it('shows last name only when first name is null', () => {
    const cases = [makeCaseItem({
      patient_id: 'patient-1',
      patient: { first_name: null, last_name: 'Johnson', mrn: null, date_of_birth: null },
    })]
    renderTable(cases)
    expect(screen.getByText('Johnson')).toBeInTheDocument()
  })

  it('shows first name only when last name is null', () => {
    const cases = [makeCaseItem({
      patient_id: 'patient-1',
      patient: { first_name: 'Alice', last_name: null, mrn: null, date_of_birth: null },
    })]
    renderTable(cases)
    expect(screen.getByText('Alice')).toBeInTheDocument()
  })
})

// ============================================
// UNIT TESTS: Epic badge rendering
// ============================================

describe('CasesTable — Epic badge', () => {
  it('shows Epic badge when source is "epic"', () => {
    const cases = [makeCaseItem({
      source: 'epic',
      procedure_type: { id: 'proc-1', name: 'Total Hip', procedure_category_id: null, expected_duration_minutes: 90 },
    })]
    renderTable(cases)
    expect(screen.getByText('Epic')).toBeInTheDocument()
  })

  it('does not show Epic badge for manual source', () => {
    const cases = [makeCaseItem({ source: 'manual' })]
    renderTable(cases)
    expect(screen.queryByText('Epic')).not.toBeInTheDocument()
  })
})
