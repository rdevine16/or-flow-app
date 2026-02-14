import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
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

// Mock useCaseDrawer and useMilestoneComparisons
const mockUseCaseDrawer = vi.fn()
const mockUseMilestoneComparisons = vi.fn()
vi.mock('@/lib/hooks/useCaseDrawer', () => ({
  useCaseDrawer: (...args: unknown[]) => mockUseCaseDrawer(...args),
  useMilestoneComparisons: (...args: unknown[]) => mockUseMilestoneComparisons(...args),
}))

// Mock useCaseFinancials to avoid Supabase client initialization in tests
const mockUseCaseFinancials = vi.fn()
vi.mock('@/lib/hooks/useCaseFinancials', () => ({
  useCaseFinancials: (...args: unknown[]) => mockUseCaseFinancials(...args),
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
  scheduled_duration_minutes: 120,
  actual_duration_minutes: 95,
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

function defaultComparisonReturn() {
  return {
    surgeonStats: null,
    facilityStats: null,
    loading: false,
    error: null,
  }
}

// ============================================
// TESTS
// ============================================

describe('CaseDrawer — unit', () => {
  beforeEach(() => {
    mockUseCaseDrawer.mockReturnValue(defaultDrawerReturn())
    mockUseMilestoneComparisons.mockReturnValue(defaultComparisonReturn())
    mockUseCaseFinancials.mockReturnValue({
      projection: null,
      comparison: null,
      actual: null,
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

  it('renders quick stats with computed values', () => {
    render(
      <CaseDrawer caseId="case-123" onClose={vi.fn()} categoryNameById={CATEGORY_MAP} />
    )
    // Total duration = 95 minutes (actual_duration_minutes)
    expect(screen.getByText('1h 35m')).toBeDefined()
    // Surgical time = Incision (8:50) to Closing (9:45) = 55 min
    expect(screen.getByText('55m')).toBeDefined()
    // Milestones: 4/4 recorded
    expect(screen.getByText('4/4')).toBeDefined()
  })

  it('renders 3 tabs: Financials, Milestones, Flags', () => {
    render(
      <CaseDrawer caseId="case-123" onClose={vi.fn()} categoryNameById={CATEGORY_MAP} />
    )
    expect(screen.getByText('Financials')).toBeDefined()
    // "Milestones" appears in both quick stats and tab bar — use getAllByText
    expect(screen.getAllByText('Milestones').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Flags')).toBeDefined()
  })

  it('shows flag count badge on Flags tab when flags exist', () => {
    render(
      <CaseDrawer caseId="case-123" onClose={vi.fn()} categoryNameById={CATEGORY_MAP} />
    )
    // Flag count badge should show "1"
    expect(screen.getByText('1')).toBeDefined()
  })

  it('defaults to Flags tab and shows flag content', () => {
    render(
      <CaseDrawer caseId="case-123" onClose={vi.fn()} categoryNameById={CATEGORY_MAP} />
    )
    // Flags tab content should be visible by default
    expect(screen.getByText('Late start — 10 min behind schedule')).toBeDefined()
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

  it('shows Validate button for needs_validation status when handler provided', () => {
    const unvalidatedCase = {
      ...MOCK_CASE_DETAIL,
      data_validated: false,
      case_status: { name: 'Completed' },
    }
    mockUseCaseDrawer.mockReturnValue(defaultDrawerReturn({ caseDetail: unvalidatedCase }))
    render(
      <CaseDrawer
        caseId="case-123"
        onClose={vi.fn()}
        categoryNameById={CATEGORY_MAP}
        onValidateCase={vi.fn()}
      />
    )
    expect(screen.getByText('Validate Case')).toBeDefined()
  })

  it('does not show Validate button for needs_validation when handler not provided', () => {
    const unvalidatedCase = {
      ...MOCK_CASE_DETAIL,
      data_validated: false,
      case_status: { name: 'Completed' },
    }
    mockUseCaseDrawer.mockReturnValue(defaultDrawerReturn({ caseDetail: unvalidatedCase }))
    render(
      <CaseDrawer caseId="case-123" onClose={vi.fn()} categoryNameById={CATEGORY_MAP} />
    )
    expect(screen.queryByText('Validate Case')).toBeNull()
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
    mockUseMilestoneComparisons.mockReturnValue(defaultComparisonReturn())
    mockUseCaseFinancials.mockReturnValue({
      projection: null,
      comparison: null,
      actual: null,
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
    // Should show milestone names from case_milestones
    expect(screen.getByText('Patient In')).toBeDefined()
    expect(screen.getByText('Incision')).toBeDefined()
    expect(screen.getByText('Closing')).toBeDefined()
    expect(screen.getByText('Patient Out')).toBeDefined()
  })

  it('switches to Financials tab and shows content', async () => {
    const user = userEvent.setup()
    render(
      <CaseDrawer caseId="case-123" onClose={vi.fn()} categoryNameById={CATEGORY_MAP} />
    )
    await user.click(screen.getByText('Financials'))
    // With null projection, shows "no data" message
    expect(screen.getByText('No financial data available for this case')).toBeDefined()
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
})
