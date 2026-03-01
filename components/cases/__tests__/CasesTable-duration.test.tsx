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
// UNIT TESTS: Duration column rendering
// ============================================

describe('CasesTable — Duration column', () => {
  it('shows actual duration for completed case from case_completion_stats', () => {
    const cases = [makeCaseItem({ case_completion_stats: { total_duration_minutes: 135 } })]
    renderTable(cases)

    expect(screen.getByText('2h 15m')).toBeInTheDocument()
  })

  it('shows minutes-only format for durations under 1 hour', () => {
    const cases = [makeCaseItem({ case_completion_stats: { total_duration_minutes: 45 } })]
    renderTable(cases)

    expect(screen.getByText('45m')).toBeInTheDocument()
  })

  it('shows dash for completed case with null case_completion_stats', () => {
    const cases = [makeCaseItem({ case_completion_stats: null })]
    const { container } = renderTable(cases)

    // Duration cell should have a dash (em-dash)
    const durationCells = container.querySelectorAll('.tabular-nums')
    const hasDash = Array.from(durationCells).some(cell => cell.textContent === '\u2014')
    expect(hasDash).toBe(true)
  })

  it('shows expected duration for scheduled cases with procedure type', () => {
    const cases = [makeCaseItem({
      case_status: { name: 'Scheduled' },
      procedure_type: { id: 'proc-1', name: 'Total Hip', procedure_category_id: null, expected_duration_minutes: 90 },
      case_completion_stats: null,
    })]
    renderTable(cases)

    expect(screen.getByText('1h 30m')).toBeInTheDocument()
  })

  it('shows dash for scheduled cases with no expected duration', () => {
    const cases = [makeCaseItem({
      case_status: { name: 'Scheduled' },
      procedure_type: { id: 'proc-1', name: 'Total Hip', procedure_category_id: null, expected_duration_minutes: null },
      case_completion_stats: null,
    })]
    renderTable(cases)

    expect(screen.queryByText(/\d+h/)).not.toBeInTheDocument()
    expect(screen.queryByText(/\d+m$/)).not.toBeInTheDocument()
  })

  it('shows dash for cancelled cases', () => {
    const cases = [makeCaseItem({ case_status: { name: 'Cancelled' }, case_completion_stats: null })]
    renderTable(cases)

    expect(screen.queryByText(/\d+h/)).not.toBeInTheDocument()
    expect(screen.queryByText(/\d+m$/)).not.toBeInTheDocument()
  })

  it('shows elapsed time in green for in-progress cases', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-14T10:30:00'))

    const cases = [makeCaseItem({
      case_status: { name: 'in_progress' },
      start_time: '08:00:00',
      scheduled_date: '2026-02-14',
      case_completion_stats: null,
    })]
    renderTable(cases)

    const durationEl = screen.getByText('2h 30m')
    expect(durationEl).toBeInTheDocument()
    expect(durationEl.className).toContain('text-green-600')
    expect(durationEl.className).toContain('tabular-nums')

    vi.useRealTimers()
  })

  it('shows exact hours for round-hour durations', () => {
    const cases = [makeCaseItem({ case_completion_stats: { total_duration_minutes: 120 } })]
    renderTable(cases)

    expect(screen.getByText('2h 0m')).toBeInTheDocument()
  })

  it('shows Duration column header as plain label (non-sortable)', () => {
    const cases = [makeCaseItem()]
    renderTable(cases)

    expect(screen.getByText('Duration')).toBeInTheDocument()
    // Should not be inside a button (non-sortable)
    const durationHeader = screen.getByText('Duration')
    expect(durationHeader.closest('button')).toBeNull()
  })
})
