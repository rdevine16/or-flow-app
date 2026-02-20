import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SurgeonDetail from '../SurgeonDetail'
import type { SurgeonStats, CaseCompletionStats, FinancialsMetrics } from '../types'

// ============================================
// MOCKS
// ============================================

vi.mock('recharts', () => ({
  ComposedChart: ({ children }: { children: React.ReactNode }) => <div data-testid="composed-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  Area: () => <div data-testid="area" />,
  Line: () => <div data-testid="line" />,
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Cell: () => null,
  CartesianGrid: () => null,
}))

// Use empty facilityId to bypass internal supabase fetch (guard at line 450)
vi.mock('@/lib/supabase', () => ({
  createClient: () => ({}),
}))

// IMPORTANT: showToast must be a stable reference to avoid infinite re-render loop
// (fetchPhaseData's useCallback depends on showToast — if it changes, the useEffect re-fires)
const stableShowToast = vi.fn()
vi.mock('@/components/ui/Toast/ToastProvider', () => ({
  useToast: () => ({ showToast: stableShowToast }),
}))

vi.mock('../shared', () => ({
  Sparkline: () => <div data-testid="sparkline" />,
  SparklineLight: () => <div data-testid="sparkline-light" />,
  ComparisonPill: ({ value, unit }: { value: number; unit?: string }) => (
    <span data-testid="comparison-pill">{value} {unit}</span>
  ),
  ConsistencyBadge: ({ rating }: { rating: string }) => (
    <span data-testid="consistency-badge">{rating}</span>
  ),
  InfoTip: () => null,
  SortTH: () => null,
  PhasePill: ({ label, minutes }: { label: string; minutes: number | null }) => (
    <span data-testid="phase-pill">{label}: {minutes}m</span>
  ),
}))

vi.mock('../SurgeonHero', () => ({
  SurgeonHero: ({ name, caseCount }: { name: string; caseCount: number }) => (
    <div data-testid="surgeon-hero">{name} - {caseCount} cases</div>
  ),
}))

vi.mock('../CaseEconomicsCard', () => ({
  CaseEconomicsCard: () => <div data-testid="case-economics-card" />,
}))

vi.mock('../PayerMixCard', () => ({
  PayerMixCard: () => <div data-testid="payer-mix-card" />,
}))

// ============================================
// FIXTURES
// ============================================

function makeSurgeon(overrides: Partial<SurgeonStats> = {}): SurgeonStats {
  return {
    surgeonId: 'surg-1',
    surgeonName: 'Dr. Smith',
    caseCount: 5,
    totalReimbursement: 50000,
    totalDebits: 15000,
    totalCredits: 5000,
    totalORCost: 10000,
    totalProfit: 20000,
    avgProfit: 4000,
    medianProfit: 3800,
    stddevProfit: 500,
    profitRange: { p25: 3000, p75: 5000 },
    avgMarginPercent: 40,
    profitPerORHour: 850,
    avgDurationMinutes: 120,
    medianDurationMinutes: 115,
    stddevDurationMinutes: 15,
    totalORMinutes: 600,
    durationVsFacilityMinutes: -5,
    profitVsFacility: 200,
    profitImpact: 75,
    consistencyRating: 'high',
    medianSurgicalTurnover: 20,
    procedureBreakdown: [
      {
        procedureId: 'proc-1',
        procedureName: 'Knee Replacement',
        caseCount: 3,
        avgDuration: 100,
        medianDuration: 95,
        avgProfit: 4500,
        medianProfit: 4200,
        facilityMedianDuration: 110,
        durationDiff: -10,
      },
    ],
    ...overrides,
  }
}

function makeCase(overrides: Partial<CaseCompletionStats> = {}): CaseCompletionStats {
  return {
    id: 'cs-1',
    case_id: 'case-1',
    case_number: 'C-001',
    facility_id: 'fac-1',
    surgeon_id: 'surg-1',
    procedure_type_id: 'proc-1',
    payer_id: 'payer-1',
    or_room_id: 'room-1',
    case_date: '2026-02-15',
    scheduled_start_time: null,
    actual_start_time: null,
    total_duration_minutes: 120,
    surgical_duration_minutes: 80,
    anesthesia_duration_minutes: 100,
    call_to_patient_in_minutes: null,
    schedule_variance_minutes: null,
    room_turnover_minutes: null,
    surgical_turnover_minutes: null,
    is_first_case_of_day_room: false,
    is_first_case_of_day_surgeon: false,
    surgeon_room_count: null,
    surgeon_case_sequence: null,
    room_case_sequence: null,
    reimbursement: 10000,
    soft_goods_cost: 3000,
    hard_goods_cost: 1000,
    or_cost: 2000,
    profit: 4000,
    or_hourly_rate: 800,
    total_debits: 3000,
    total_credits: 1000,
    net_cost: 4000,
    or_time_cost: 2000,
    cost_source: 'manual',
    procedure_types: { id: 'proc-1', name: 'Knee Replacement' },
    payers: { id: 'payer-1', name: 'Blue Cross' },
    or_rooms: { name: 'OR-1' },
    surgeon: { first_name: 'John', last_name: 'Smith' },
    ...overrides,
  }
}

function makeMetrics(): FinancialsMetrics {
  return {
    totalCases: 20,
    totalProfit: 80000,
    avgProfit: 4000,
    medianProfit: 3500,
    profitPerORHour: 750,
    avgMargin: 35,
    totalReimbursement: 200000,
    totalDebits: 60000,
    totalCredits: 20000,
    totalORCost: 40000,
    avgReimbursement: 10000,
    avgDebits: 3000,
    avgCredits: 1000,
    avgORCost: 2000,
    surgeonStats: [makeSurgeon()],
    procedureStats: [],
    facilityProcedureStats: [],
  }
}

// facilityId="" to bypass internal supabase fetch (component guard returns early)
const defaultProps = {
  surgeon: makeSurgeon(),
  cases: [makeCase()],
  metrics: makeMetrics(),
  facilityId: '',
  onBack: vi.fn(),
}

// ============================================
// TESTS
// ============================================

describe('SurgeonDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    defaultProps.onBack = vi.fn()
  })

  it('renders breadcrumb with surgeon name', () => {
    render(<SurgeonDetail {...defaultProps} />)
    expect(screen.getByText('All Surgeons')).toBeDefined()
    expect(screen.getByText('Dr. Smith')).toBeDefined()
  })

  it('calls onBack when breadcrumb is clicked', () => {
    render(<SurgeonDetail {...defaultProps} />)
    fireEvent.click(screen.getByText('All Surgeons'))
    expect(defaultProps.onBack).toHaveBeenCalledTimes(1)
  })

  it('renders SurgeonHero', () => {
    render(<SurgeonDetail {...defaultProps} />)
    expect(screen.getByTestId('surgeon-hero')).toBeDefined()
    expect(screen.getByTestId('surgeon-hero').textContent).toContain('Dr. Smith')
  })

  it('renders three sub-tab buttons', () => {
    render(<SurgeonDetail {...defaultProps} />)
    expect(screen.getByText('Overview')).toBeDefined()
    expect(screen.getByText('Daily Activity')).toBeDefined()
    expect(screen.getByText('By Procedure')).toBeDefined()
  })

  it('shows Overview with metric cards by default', () => {
    render(<SurgeonDetail {...defaultProps} />)
    expect(screen.getByText('Time vs Facility')).toBeDefined()
    expect(screen.getByText('Profit Impact')).toBeDefined()
    expect(screen.getByText('Typical Surgical Time')).toBeDefined()
    expect(screen.getByText('Consistency')).toBeDefined()
    expect(screen.getByTestId('case-economics-card')).toBeDefined()
    expect(screen.getByTestId('payer-mix-card')).toBeDefined()
  })

  it('switches to Daily Activity placeholder', () => {
    render(<SurgeonDetail {...defaultProps} />)
    fireEvent.click(screen.getByText('Daily Activity'))
    expect(screen.getByText(/Day-by-day case breakdown/)).toBeDefined()
  })

  it('switches to By Procedure placeholder', () => {
    render(<SurgeonDetail {...defaultProps} />)
    fireEvent.click(screen.getByText('By Procedure'))
    expect(screen.getByText(/Surgeon vs facility comparison/)).toBeDefined()
  })

  it('shows "Faster" when surgeon is faster than facility', () => {
    render(
      <SurgeonDetail
        {...defaultProps}
        surgeon={makeSurgeon({ durationVsFacilityMinutes: -5 })}
      />,
    )
    expect(screen.getByText('-5 min')).toBeDefined()
    expect(screen.getByText('Faster than facility typical')).toBeDefined()
  })

  it('shows "Slower" when surgeon is slower than facility', () => {
    render(
      <SurgeonDetail
        {...defaultProps}
        surgeon={makeSurgeon({ durationVsFacilityMinutes: 8 })}
      />,
    )
    expect(screen.getByText('+8 min')).toBeDefined()
    expect(screen.getByText('Slower than facility typical')).toBeDefined()
  })

  it('renders recent cases with case numbers', () => {
    const cases = [
      makeCase({ case_id: 'c1', case_number: 'C-001', case_date: '2026-02-15' }),
      makeCase({ case_id: 'c2', case_number: 'C-002', case_date: '2026-02-14' }),
    ]
    render(
      <SurgeonDetail
        {...defaultProps}
        cases={cases}
        surgeon={makeSurgeon({ caseCount: 2 })}
      />,
    )
    expect(screen.getByText('Recent Cases')).toBeDefined()
    expect(screen.getByText('C-001')).toBeDefined()
    expect(screen.getByText('C-002')).toBeDefined()
  })

  it('hides recent cases when no cases', () => {
    render(<SurgeonDetail {...defaultProps} cases={[]} surgeon={makeSurgeon({ caseCount: 0 })} />)
    expect(screen.queryByText('Recent Cases')).toBeNull()
  })

  it('shows "Not enough data" for single-month trend', () => {
    render(<SurgeonDetail {...defaultProps} surgeon={makeSurgeon({ caseCount: 1 })} />)
    expect(screen.getByText('Not enough data for trend chart')).toBeDefined()
  })

  it('renders profit distribution summary stats', () => {
    // Use cases with different profits to generate non-empty bins
    const cases = [
      makeCase({ case_id: 'c1', profit: 2000, case_date: '2026-02-10' }),
      makeCase({ case_id: 'c2', profit: 5000, case_date: '2026-02-12' }),
    ]
    render(
      <SurgeonDetail
        {...defaultProps}
        cases={cases}
        surgeon={makeSurgeon({ caseCount: 2, totalProfit: 7000 })}
      />,
    )
    expect(screen.getByText('Profit Distribution')).toBeDefined()
    expect(screen.getByText('Min')).toBeDefined()
    expect(screen.getByText('Median')).toBeDefined()
    expect(screen.getByText('Max')).toBeDefined()
  })

  it('"View all days" link switches to daily tab', () => {
    render(<SurgeonDetail {...defaultProps} />)
    fireEvent.click(screen.getByText('View all days in Daily Activity'))
    expect(screen.getByText(/Day-by-day case breakdown/)).toBeDefined()
  })
})
