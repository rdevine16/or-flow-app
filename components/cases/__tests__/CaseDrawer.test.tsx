import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CaseDrawer from '../CaseDrawer'
import type { CaseDetail } from '@/lib/dal/cases'

// ============================================
// MOCKS
// ============================================

// Mock next/link to render <a>
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

// Mock useCaseDrawer
const mockUseCaseDrawer = vi.fn()
vi.mock('@/lib/hooks/useCaseDrawer', () => ({
  useCaseDrawer: (...args: unknown[]) => mockUseCaseDrawer(...args),
}))

// Mock useMilestoneComparison (used by CaseDrawerMilestones internally)
vi.mock('@/lib/hooks/useMilestoneComparison', () => ({
  useMilestoneComparison: () => ({
    data: {
      intervals: [
        { milestone_name: 'Patient In', facility_milestone_id: 'fm-1', display_order: 1, phase_group: 'pre_op', recorded_at: '2024-06-15T08:30:00Z', interval_minutes: null, surgeon_median_minutes: null, facility_median_minutes: null, delta_from_surgeon: null, delta_from_facility: null, delta_severity: null },
        { milestone_name: 'Incision', facility_milestone_id: 'fm-2', display_order: 3, phase_group: 'surgical', recorded_at: '2024-06-15T08:50:00Z', interval_minutes: 20, surgeon_median_minutes: 18, facility_median_minutes: 22, delta_from_surgeon: 2, delta_from_facility: -2, delta_severity: 'on-pace' },
        { milestone_name: 'Closing', facility_milestone_id: 'fm-3', display_order: 5, phase_group: 'closing', recorded_at: '2024-06-15T09:45:00Z', interval_minutes: 55, surgeon_median_minutes: 50, facility_median_minutes: 52, delta_from_surgeon: 5, delta_from_facility: 3, delta_severity: 'on-pace' },
        { milestone_name: 'Patient Out', facility_milestone_id: 'fm-4', display_order: 7, phase_group: 'post_op', recorded_at: '2024-06-15T10:05:00Z', interval_minutes: 15, surgeon_median_minutes: 12, facility_median_minutes: 14, delta_from_surgeon: 3, delta_from_facility: 1, delta_severity: 'slower' },
      ],
      time_allocation: [
        { label: 'Pre-Op', phase_group: 'pre_op', minutes: 20, percentage: 22, color: 'bg-blue-500' },
        { label: 'Surgical', phase_group: 'surgical', minutes: 55, percentage: 61, color: 'bg-teal-500' },
      ],
      missing_milestones: [],
      total_case_minutes: 95,
      total_surgical_minutes: 55,
      comparison_source: 'surgeon' as const,
    },
    loading: false,
    error: null,
    comparisonSource: 'surgeon' as const,
    setComparisonSource: vi.fn(),
    surgeonCaseCount: 25,
    facilityCaseCount: 150,
    refetch: vi.fn(),
  }),
}))

// Mock useFinancialComparison to avoid Supabase client initialization in tests
const mockUseFinancialComparison = vi.fn()
vi.mock('@/lib/hooks/useFinancialComparison', () => ({
  useFinancialComparison: (...args: unknown[]) => mockUseFinancialComparison(...args),
}))

// Mock useSupabaseQuery (used by validation tab lazy-loading)
vi.mock('@/hooks/useSupabaseQuery', () => ({
  useSupabaseQuery: () => ({ data: null, loading: false, error: null, refetch: vi.fn(), setData: vi.fn() }),
}))

// Mock fetchMetricIssues
vi.mock('@/lib/dataQuality', () => ({
  fetchMetricIssues: vi.fn().mockResolvedValue([]),
  getSeverityColor: () => 'bg-slate-100 text-slate-900 border-slate-200',
  formatTimeAgo: () => 'just now',
  formatDetectedValue: () => 'N/A',
}))

// Mock useUser to provide can() for permission gating
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
    impersonatedFacilityId: null,
    impersonatedFacilityName: null,
    effectiveFacilityId: 'fac-1',
    refreshImpersonation: () => {},
  }),
}))

// Mock ProcedureIcon to avoid Lucide rendering complexity
vi.mock('@/components/ui/ProcedureIcon', () => ({
  default: ({ categoryName }: { categoryName: string | null }) => (
    <span data-testid="procedure-icon">{categoryName ?? 'generic'}</span>
  ),
}))

// ============================================
// FIXTURES
// ============================================

const MOCK_CASE_DETAIL: CaseDetail = {
  id: 'case-123',
  case_number: 'CASE-2024-001',
  scheduled_date: '2024-06-15',
  start_time: '08:30:00',
  status_id: 'status-completed',
  data_validated: true,
  or_room_id: 'room-1',
  surgeon_id: 'surgeon-1',
  facility_id: 'fac-1',
  created_at: '2024-06-14T10:00:00Z',
  created_by: 'user-1',
  surgeon: { first_name: 'James', last_name: 'Wilson' },
  or_room: { name: 'OR-3' },
  case_status: { name: 'Completed' },
  procedure_type: { id: 'pt-1', name: 'Total Hip Replacement', procedure_category_id: 'cat-ortho' },
  patient_dob: null,
  patient_phone: null,
  laterality: null,
  anesthesia_type: null,
  scheduled_duration_minutes: 95,
  notes: null,
  rep_required_override: null,
  called_back_at: null,
  called_back_by: null,
  complexity_id: null,
  case_milestones: [
    {
      id: 'ms-1',
      case_id: 'case-123',
      facility_milestone_id: 'fm-1',
      recorded_at: '2024-06-15T08:30:00Z',
      recorded_by: 'user-1',
      facility_milestone: { name: 'Patient In', display_name: 'Patient In', display_order: 1 },
    },
    {
      id: 'ms-2',
      case_id: 'case-123',
      facility_milestone_id: 'fm-2',
      recorded_at: '2024-06-15T08:50:00Z',
      recorded_by: 'user-1',
      facility_milestone: { name: 'Incision', display_name: 'Incision', display_order: 3 },
    },
    {
      id: 'ms-3',
      case_id: 'case-123',
      facility_milestone_id: 'fm-3',
      recorded_at: '2024-06-15T09:45:00Z',
      recorded_by: 'user-1',
      facility_milestone: { name: 'Closing', display_name: 'Closing', display_order: 5 },
    },
    {
      id: 'ms-4',
      case_id: 'case-123',
      facility_milestone_id: 'fm-4',
      recorded_at: '2024-06-15T10:05:00Z',
      recorded_by: 'user-1',
      facility_milestone: { name: 'Patient Out', display_name: 'Patient Out', display_order: 7 },
    },
  ],
  case_flags: [
    {
      id: 'flag-1',
      case_id: 'case-123',
      delay_type_id: null,
      flag_type: 'warning',
      severity: 'warning',
      note: 'Late start — 10 min behind schedule',
      duration_minutes: 10,
    },
  ],
  case_staff: [],
  case_implant_companies: [],
}

const CATEGORY_MAP = new Map([['cat-ortho', 'Orthopedic']])

function defaultDrawerReturn(overrides: Partial<ReturnType<typeof mockUseCaseDrawer>> = {}) {
  return {
    caseDetail: MOCK_CASE_DETAIL,
    loading: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  }
}

// ============================================
// TESTS
// ============================================

describe('CaseDrawer — unit', () => {
  beforeEach(() => {
    mockUseCaseDrawer.mockReturnValue(defaultDrawerReturn())
    mockUseFinancialComparison.mockReturnValue({
      data: null,
      loading: false,
      error: null,
    })
  })

  it('does not render dialog when caseId is null', () => {
    mockUseCaseDrawer.mockReturnValue(defaultDrawerReturn({ caseDetail: null }))
    render(
      <CaseDrawer caseId={null} onClose={vi.fn()} categoryNameById={CATEGORY_MAP} />
    )
    expect(screen.queryByText('CASE-2024-001')).toBeNull()
  })

  it('renders case number and status badge in header', () => {
    render(
      <CaseDrawer caseId="case-123" onClose={vi.fn()} categoryNameById={CATEGORY_MAP} />
    )
    expect(screen.getByText('CASE-2024-001')).toBeDefined()
    expect(screen.getByText('Completed')).toBeDefined()
  })

  it('renders surgeon name with link to analytics', () => {
    render(
      <CaseDrawer caseId="case-123" onClose={vi.fn()} categoryNameById={CATEGORY_MAP} />
    )
    const surgeonLink = screen.getByText('Dr. James Wilson')
    expect(surgeonLink).toBeDefined()
    expect(surgeonLink.closest('a')?.getAttribute('href')).toBe('/analytics/surgeons?surgeon=surgeon-1')
  })

  it('renders room and date', () => {
    render(
      <CaseDrawer caseId="case-123" onClose={vi.fn()} categoryNameById={CATEGORY_MAP} />
    )
    expect(screen.getByText('OR-3')).toBeDefined()
    // Date format: "Sat, Jun 15, 2024 at 8:30 AM"
    expect(screen.getByText(/Jun 15, 2024/)).toBeDefined()
  })

  it('renders procedure name and icon', () => {
    render(
      <CaseDrawer caseId="case-123" onClose={vi.fn()} categoryNameById={CATEGORY_MAP} />
    )
    expect(screen.getByText('Total Hip Replacement')).toBeDefined()
    expect(screen.getByTestId('procedure-icon')).toBeDefined()
  })

  it('renders 3 tabs: Financials, Milestones, Flags (no dqCaseIds)', () => {
    render(
      <CaseDrawer caseId="case-123" onClose={vi.fn()} categoryNameById={CATEGORY_MAP} />
    )
    expect(screen.getByText('Financials')).toBeDefined()
    expect(screen.getByText('Milestones')).toBeDefined()
    expect(screen.getByText('Flags')).toBeDefined()
    expect(screen.queryByText('Validation')).toBeNull()
  })

  it('shows Validation tab when case is in dqCaseIds', () => {
    const dqSet = new Set(['case-123'])
    render(
      <CaseDrawer caseId="case-123" onClose={vi.fn()} categoryNameById={CATEGORY_MAP} dqCaseIds={dqSet} />
    )
    expect(screen.getByText('Validation')).toBeDefined()
  })

  it('hides Validation tab when case is NOT in dqCaseIds', () => {
    const dqSet = new Set(['other-case'])
    render(
      <CaseDrawer caseId="case-123" onClose={vi.fn()} categoryNameById={CATEGORY_MAP} dqCaseIds={dqSet} />
    )
    expect(screen.queryByText('Validation')).toBeNull()
  })

  it('hides Validation tab when dqCaseIds is empty', () => {
    const dqSet = new Set<string>()
    render(
      <CaseDrawer caseId="case-123" onClose={vi.fn()} categoryNameById={CATEGORY_MAP} dqCaseIds={dqSet} />
    )
    expect(screen.queryByText('Validation')).toBeNull()
  })

  it('shows flag count badge on Flags tab when flags exist', () => {
    render(
      <CaseDrawer caseId="case-123" onClose={vi.fn()} categoryNameById={CATEGORY_MAP} />
    )
    // Flag count badge should show "1"
    expect(screen.getByText('1')).toBeDefined()
  })

  it('defaults to Financials tab (Phase 5 changed default from Flags)', () => {
    render(
      <CaseDrawer caseId="case-123" onClose={vi.fn()} categoryNameById={CATEGORY_MAP} />
    )
    // Default tab is now Financials, not Flags
    // With mock returning null financial data, shows empty state
    expect(screen.getByText('No financial data available')).toBeDefined()
  })

  it('shows loading skeleton when loading', () => {
    mockUseCaseDrawer.mockReturnValue(defaultDrawerReturn({ caseDetail: null, loading: true }))
    render(
      <CaseDrawer caseId="case-123" onClose={vi.fn()} categoryNameById={CATEGORY_MAP} />
    )
    // Should not show case content
    expect(screen.queryByText('CASE-2024-001')).toBeNull()
  })

  it('shows error message on fetch failure', () => {
    mockUseCaseDrawer.mockReturnValue(
      defaultDrawerReturn({ caseDetail: null, error: 'Network error' })
    )
    render(
      <CaseDrawer caseId="case-123" onClose={vi.fn()} categoryNameById={CATEGORY_MAP} />
    )
    expect(screen.getByText('Failed to load case details')).toBeDefined()
    expect(screen.getByText('Network error')).toBeDefined()
  })

  it('shows Cancel button for scheduled cases when handler provided', () => {
    const scheduledCase = {
      ...MOCK_CASE_DETAIL,
      data_validated: false,
      case_status: { name: 'Scheduled' },
    }
    mockUseCaseDrawer.mockReturnValue(defaultDrawerReturn({ caseDetail: scheduledCase }))
    render(
      <CaseDrawer
        caseId="case-123"
        onClose={vi.fn()}
        categoryNameById={CATEGORY_MAP}
        onCancelCase={vi.fn()}
      />
    )
    expect(screen.getByText('Cancel Case')).toBeDefined()
  })

  it('does not show Validate button for validated cases', () => {
    render(
      <CaseDrawer caseId="case-123" onClose={vi.fn()} categoryNameById={CATEGORY_MAP} />
    )
    expect(screen.queryByText('Validate Case')).toBeNull()
  })

  it('links to full case detail page', () => {
    render(
      <CaseDrawer caseId="case-123" onClose={vi.fn()} categoryNameById={CATEGORY_MAP} />
    )
    const detailLink = screen.getByText('Open full detail')
    expect(detailLink.closest('a')?.getAttribute('href')).toBe('/cases/case-123')
  })
})

describe('CaseDrawer — tab switching', () => {
  beforeEach(() => {
    mockUseCaseDrawer.mockReturnValue(defaultDrawerReturn())
    mockUseFinancialComparison.mockReturnValue({
      data: null,
      loading: false,
      error: null,
    })
  })

  it('switches to Milestones tab and renders milestone timeline', async () => {
    const user = userEvent.setup()
    render(
      <CaseDrawer caseId="case-123" onClose={vi.fn()} categoryNameById={CATEGORY_MAP} />
    )
    // "Milestones" appears in quick stats and tab bar — click the tab button
    const milestonesElements = screen.getAllByText('Milestones')
    const tabButton = milestonesElements.find(el => el.closest('button'))
    expect(tabButton).toBeDefined()
    await user.click(tabButton!)
    // Should show milestone names (appear in both timeline and detail rows)
    expect(screen.getAllByText('Patient In').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Incision').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Closing').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Patient Out').length).toBeGreaterThanOrEqual(1)
  })

  it('switches to Financials tab and shows content', async () => {
    const user = userEvent.setup()
    render(
      <CaseDrawer caseId="case-123" onClose={vi.fn()} categoryNameById={CATEGORY_MAP} />
    )
    await user.click(screen.getByText('Financials'))
    // With null projection, shows "no data" message
    expect(screen.getByText('No financial data available')).toBeDefined()
  })

  it('switches back to Flags tab', async () => {
    const user = userEvent.setup()
    render(
      <CaseDrawer caseId="case-123" onClose={vi.fn()} categoryNameById={CATEGORY_MAP} />
    )
    // Switch to Milestones tab
    const milestonesElements = screen.getAllByText('Milestones')
    const tabButton = milestonesElements.find(el => el.closest('button'))
    await user.click(tabButton!)
    expect(screen.queryByText('Late start — 10 min behind schedule')).toBeNull()
    // Switch back to Flags
    await user.click(screen.getByText('Flags'))
    expect(screen.getByText('Late start — 10 min behind schedule')).toBeDefined()
  })

  it('switches to Validation tab when present and shows validation content', async () => {
    const user = userEvent.setup()
    const dqSet = new Set(['case-123'])
    render(
      <CaseDrawer caseId="case-123" onClose={vi.fn()} categoryNameById={CATEGORY_MAP} dqCaseIds={dqSet} />
    )
    // Validation tab should be present
    const validationTab = screen.getByText('Validation')
    expect(validationTab).toBeDefined()
    await user.click(validationTab)
    // With null data from mock, shows "No validation issues" empty state
    expect(screen.getByText('No validation issues')).toBeDefined()
  })

  it('switches from Validation back to Flags and restores content', async () => {
    const user = userEvent.setup()
    const dqSet = new Set(['case-123'])
    render(
      <CaseDrawer caseId="case-123" onClose={vi.fn()} categoryNameById={CATEGORY_MAP} dqCaseIds={dqSet} />
    )
    // Switch to Validation
    await user.click(screen.getByText('Validation'))
    expect(screen.queryByText('Late start — 10 min behind schedule')).toBeNull()
    // Switch back to Flags
    await user.click(screen.getByText('Flags'))
    expect(screen.getByText('Late start — 10 min behind schedule')).toBeDefined()
  })

  it('resets to default Financials tab when caseId changes (prevents stale validation content)', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const dqSet = new Set(['case-123'])

    // Render with case-123 which has DQ issues
    const { rerender } = render(
      <CaseDrawer caseId="case-123" onClose={onClose} categoryNameById={CATEGORY_MAP} dqCaseIds={dqSet} />
    )

    // Switch to Validation tab
    await user.click(screen.getByText('Validation'))
    expect(screen.getByText('No validation issues')).toBeDefined()

    // Now switch to case-456 which has NO DQ issues
    const case456 = {
      ...MOCK_CASE_DETAIL,
      id: 'case-456',
      case_number: 'CASE-2024-002',
    }
    mockUseCaseDrawer.mockReturnValue(defaultDrawerReturn({ caseDetail: case456 }))
    rerender(
      <CaseDrawer caseId="case-456" onClose={onClose} categoryNameById={CATEGORY_MAP} dqCaseIds={dqSet} />
    )

    // Should reset to Financials tab (default), no Validation tab
    expect(screen.getByText('No financial data available')).toBeDefined()
    expect(screen.queryByText('Validation')).toBeNull()
    expect(screen.queryByText('No validation issues')).toBeNull()
  })

  it('resets to default Financials tab when switching cases', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()

    const { rerender } = render(
      <CaseDrawer caseId="case-123" onClose={onClose} categoryNameById={CATEGORY_MAP} />
    )

    // Switch to Milestones tab
    const milestonesElements = screen.getAllByText('Milestones')
    const tabButton = milestonesElements.find(el => el.closest('button'))
    await user.click(tabButton!)

    // Switch to different case
    const case456 = {
      ...MOCK_CASE_DETAIL,
      id: 'case-456',
      case_number: 'CASE-2024-002',
    }
    mockUseCaseDrawer.mockReturnValue(defaultDrawerReturn({ caseDetail: case456 }))
    rerender(
      <CaseDrawer caseId="case-456" onClose={onClose} categoryNameById={CATEGORY_MAP} />
    )

    // Should reset to Financials tab (default)
    expect(screen.getByText('No financial data available')).toBeDefined()
  })
})

// ============================================
// PHASE 9: Header Regression Tests
// ============================================

describe('CaseDrawer — header regression (Phase 5)', () => {
  beforeEach(() => {
    mockUseCaseDrawer.mockReturnValue(defaultDrawerReturn())
    mockUseFinancialComparison.mockReturnValue({ data: null, loading: false, error: null })
  })

  it('does NOT render QuickStats cards (removed in Phase 5)', () => {
    render(
      <CaseDrawer caseId="case-123" onClose={vi.fn()} categoryNameById={CATEGORY_MAP} />
    )
    // QuickStats had "Total Duration", "Surgical Time", "Milestones" heading cards
    // These should no longer appear in the header
    expect(screen.queryByText('Total Duration')).toBeNull()
    expect(screen.queryByText('Surgical Time')).toBeNull()
  })

  it('does NOT render "Review in Data Quality" button (removed in Phase 5)', () => {
    render(
      <CaseDrawer caseId="case-123" onClose={vi.fn()} categoryNameById={CATEGORY_MAP} />
    )
    expect(screen.queryByText('Review in Data Quality')).toBeNull()
  })

  it('does NOT show Cancel Case for completed cases', () => {
    render(
      <CaseDrawer
        caseId="case-123"
        onClose={vi.fn()}
        categoryNameById={CATEGORY_MAP}
        onCancelCase={vi.fn()}
      />
    )
    expect(screen.queryByText('Cancel Case')).toBeNull()
  })

  it('shows Cancel Case only for scheduled cases', () => {
    const scheduledCase = {
      ...MOCK_CASE_DETAIL,
      case_status: { name: 'Scheduled' },
    }
    mockUseCaseDrawer.mockReturnValue(defaultDrawerReturn({ caseDetail: scheduledCase }))
    render(
      <CaseDrawer
        caseId="case-123"
        onClose={vi.fn()}
        categoryNameById={CATEGORY_MAP}
        onCancelCase={vi.fn()}
      />
    )
    expect(screen.getByText('Cancel Case')).toBeDefined()
  })

  it('does NOT show Cancel Case for in_progress cases', () => {
    const inProgressCase = {
      ...MOCK_CASE_DETAIL,
      case_status: { name: 'In Progress' },
    }
    mockUseCaseDrawer.mockReturnValue(defaultDrawerReturn({ caseDetail: inProgressCase }))
    render(
      <CaseDrawer
        caseId="case-123"
        onClose={vi.fn()}
        categoryNameById={CATEGORY_MAP}
        onCancelCase={vi.fn()}
      />
    )
    expect(screen.queryByText('Cancel Case')).toBeNull()
  })

  it('renders "Open full detail" link pointing to case detail page', () => {
    render(
      <CaseDrawer caseId="case-123" onClose={vi.fn()} categoryNameById={CATEGORY_MAP} />
    )
    const link = screen.getByText('Open full detail')
    expect(link.closest('a')?.getAttribute('href')).toBe('/cases/case-123')
  })

  it('header contains case number, status badge, procedure, surgeon, room, date', () => {
    render(
      <CaseDrawer caseId="case-123" onClose={vi.fn()} categoryNameById={CATEGORY_MAP} />
    )
    expect(screen.getByText('CASE-2024-001')).toBeDefined()
    expect(screen.getByText('Completed')).toBeDefined()
    expect(screen.getByText('Total Hip Replacement')).toBeDefined()
    expect(screen.getByText('Dr. James Wilson')).toBeDefined()
    expect(screen.getByText('OR-3')).toBeDefined()
    expect(screen.getByText(/Jun 15, 2024/)).toBeDefined()
  })
})

// ============================================
// PHASE 9: Cross-tab Consistency Tests
// ============================================

describe('CaseDrawer — cross-tab consistency', () => {
  beforeEach(() => {
    mockUseCaseDrawer.mockReturnValue(defaultDrawerReturn())
    mockUseFinancialComparison.mockReturnValue({ data: null, loading: false, error: null })
  })

  it('milestones tab renders after switching from financials', async () => {
    const user = userEvent.setup()
    render(
      <CaseDrawer caseId="case-123" onClose={vi.fn()} categoryNameById={CATEGORY_MAP} />
    )
    // Go to Financials first
    await user.click(screen.getByText('Financials'))
    expect(screen.getByText('No financial data available')).toBeDefined()

    // Switch to Milestones
    const milestonesElements = screen.getAllByText('Milestones')
    const tabButton = milestonesElements.find(el => el.closest('button'))
    await user.click(tabButton!)
    // Milestone content should render
    expect(screen.getAllByText('Patient In').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('4/4 milestones recorded')).toBeDefined()
  })

  it('financials tab renders after switching from milestones', async () => {
    const user = userEvent.setup()
    render(
      <CaseDrawer caseId="case-123" onClose={vi.fn()} categoryNameById={CATEGORY_MAP} />
    )
    // Switch to Milestones first
    const milestonesElements = screen.getAllByText('Milestones')
    const tabButton = milestonesElements.find(el => el.closest('button'))
    await user.click(tabButton!)
    // Now switch to Financials
    await user.click(screen.getByText('Financials'))
    // Should render without error
    expect(screen.getByText('No financial data available')).toBeDefined()
  })

  it('tab switching preserves header content', async () => {
    const user = userEvent.setup()
    render(
      <CaseDrawer caseId="case-123" onClose={vi.fn()} categoryNameById={CATEGORY_MAP} />
    )
    // Header should be stable across all tab switches
    expect(screen.getByText('CASE-2024-001')).toBeDefined()

    await user.click(screen.getByText('Financials'))
    expect(screen.getByText('CASE-2024-001')).toBeDefined()

    const milestonesElements = screen.getAllByText('Milestones')
    const tabButton = milestonesElements.find(el => el.closest('button'))
    await user.click(tabButton!)
    expect(screen.getByText('CASE-2024-001')).toBeDefined()

    await user.click(screen.getByText('Flags'))
    expect(screen.getByText('CASE-2024-001')).toBeDefined()
  })
})
