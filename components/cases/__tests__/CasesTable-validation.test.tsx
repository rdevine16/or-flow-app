import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import CasesTable from '../CasesTable'
import type { CaseListItem } from '@/lib/dal/cases'
import type { CasesPageTab, SortParams } from '@/lib/dal'

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
    or_room_id: 'room-1',
    surgeon_id: 'surgeon-1',
    facility_id: 'facility-1',
    created_at: '2026-02-14T00:00:00Z',
    created_by: 'user-1',
    scheduled_duration_minutes: 120,
    surgeon: { first_name: 'John', last_name: 'Smith' },
    or_room: { name: 'OR-1' },
    case_status: { name: 'Completed' },
    procedure_type: { id: 'proc-1', name: 'Total Hip', procedure_category_id: null },
    ...overrides,
  }
}

const DEFAULT_SORT: SortParams = { sortBy: 'date', sortDirection: 'desc' }

function renderTable(cases: CaseListItem[], dqCaseIds: Set<string>, activeTab: CasesPageTab = 'all') {
  return render(
    <CasesTable
      cases={cases}
      loading={false}
      error={null}
      activeTab={activeTab}
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
      dqCaseIds={dqCaseIds}
    />
  )
}

// ============================================
// UNIT TESTS: ValidationBadge rendering
// ============================================

describe('CasesTable — Validation column', () => {
  it('shows "Validated" badge for completed case with no DQ issues', () => {
    const cases = [makeCaseItem({ id: 'c1', case_status: { name: 'Completed' } })]
    renderTable(cases, new Set())

    expect(screen.getByText('Validated')).toBeInTheDocument()
    expect(screen.queryByText('Needs Validation')).not.toBeInTheDocument()
  })

  it('shows "Needs Validation" badge for case in dqCaseIds', () => {
    const cases = [makeCaseItem({ id: 'c1', case_status: { name: 'Completed' } })]
    renderTable(cases, new Set(['c1']))

    expect(screen.getByText('Needs Validation')).toBeInTheDocument()
    expect(screen.queryByText('Validated')).not.toBeInTheDocument()
  })

  it('shows dash for scheduled case (validation not applicable)', () => {
    const cases = [makeCaseItem({ id: 'c1', case_status: { name: 'Scheduled' } })]
    renderTable(cases, new Set())

    // Should not show either badge
    expect(screen.queryByText('Validated')).not.toBeInTheDocument()
    expect(screen.queryByText('Needs Validation')).not.toBeInTheDocument()
  })

  it('shows dash for cancelled case (validation not applicable)', () => {
    const cases = [makeCaseItem({ id: 'c1', case_status: { name: 'Cancelled' } })]
    renderTable(cases, new Set())

    expect(screen.queryByText('Validated')).not.toBeInTheDocument()
    expect(screen.queryByText('Needs Validation')).not.toBeInTheDocument()
  })

  it('shows "Validated" for in_progress case with no DQ issues', () => {
    const cases = [makeCaseItem({ id: 'c1', case_status: { name: 'In Progress' } })]
    renderTable(cases, new Set())

    expect(screen.getByText('Validated')).toBeInTheDocument()
  })

  it('shows "Needs Validation" link pointing to DQ page with caseId', () => {
    const cases = [makeCaseItem({ id: 'c1', case_status: { name: 'Completed' } })]
    renderTable(cases, new Set(['c1']))

    const link = screen.getByText('Needs Validation').closest('a')
    expect(link).toHaveAttribute('href', '/dashboard/data-quality?caseId=c1')
  })

  it('shows Validation column header', () => {
    const cases = [makeCaseItem()]
    renderTable(cases, new Set())

    expect(screen.getByText('Validation')).toBeInTheDocument()
  })

  it('shows correct badges for mixed case statuses', () => {
    const cases = [
      makeCaseItem({ id: 'c1', case_status: { name: 'Completed' }, case_number: 'CASE-001' }),
      makeCaseItem({ id: 'c2', case_status: { name: 'Completed' }, case_number: 'CASE-002' }),
      makeCaseItem({ id: 'c3', case_status: { name: 'Scheduled' }, case_number: 'CASE-003' }),
    ]
    // c2 has DQ issues
    renderTable(cases, new Set(['c2']))

    // c1: completed, no DQ → Validated
    // c2: completed, has DQ → Needs Validation
    // c3: scheduled → dash
    expect(screen.getByText('Validated')).toBeInTheDocument()
    expect(screen.getByText('Needs Validation')).toBeInTheDocument()
  })
})
