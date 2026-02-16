import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CaseDrawerMilestones from '../CaseDrawerMilestones'
import type { MilestoneComparisonData, MilestoneInterval } from '@/lib/utils/milestoneAnalytics'

// ============================================
// MOCK useMilestoneComparison
// ============================================

const mockSetComparisonSource = vi.fn()
const mockRefetch = vi.fn()

let mockReturn: {
  data: MilestoneComparisonData | null
  loading: boolean
  error: string | null
  comparisonSource: 'surgeon' | 'facility'
  setComparisonSource: (source: 'surgeon' | 'facility') => void
  surgeonCaseCount: number
  facilityCaseCount: number
  refetch: () => Promise<void>
}

vi.mock('@/lib/hooks/useMilestoneComparison', () => ({
  useMilestoneComparison: () => mockReturn,
}))

// ============================================
// FIXTURES
// ============================================

const INTERVALS: MilestoneInterval[] = [
  {
    milestone_name: 'Patient In',
    facility_milestone_id: 'fm-1',
    display_order: 1,
    phase_group: 'pre_op',
    recorded_at: '2024-06-15T08:00:00Z',
    interval_minutes: null,
    surgeon_median_minutes: null,
    facility_median_minutes: null,
    delta_from_surgeon: null,
    delta_from_facility: null,
    delta_severity: null,
  },
  {
    milestone_name: 'Incision',
    facility_milestone_id: 'fm-2',
    display_order: 3,
    phase_group: 'surgical',
    recorded_at: '2024-06-15T08:20:00Z',
    interval_minutes: 20,
    surgeon_median_minutes: 18,
    facility_median_minutes: 22,
    delta_from_surgeon: 2,
    delta_from_facility: -2,
    delta_severity: 'on-pace',
  },
  {
    milestone_name: 'Closing',
    facility_milestone_id: 'fm-3',
    display_order: 5,
    phase_group: 'closing',
    recorded_at: '2024-06-15T09:15:00Z',
    interval_minutes: 55,
    surgeon_median_minutes: 50,
    facility_median_minutes: 52,
    delta_from_surgeon: 5,
    delta_from_facility: 3,
    delta_severity: 'on-pace',
  },
  {
    milestone_name: 'Patient Out',
    facility_milestone_id: 'fm-4',
    display_order: 7,
    phase_group: 'post_op',
    recorded_at: '2024-06-15T09:30:00Z',
    interval_minutes: 15,
    surgeon_median_minutes: 12,
    facility_median_minutes: 14,
    delta_from_surgeon: 3,
    delta_from_facility: 1,
    delta_severity: 'slower',
  },
]

const FULL_DATA: MilestoneComparisonData = {
  intervals: INTERVALS,
  time_allocation: [
    { label: 'Pre-Op', phase_group: 'pre_op', minutes: 20, percentage: 22, color: 'bg-blue-500' },
    { label: 'Surgical', phase_group: 'surgical', minutes: 55, percentage: 61, color: 'bg-teal-500' },
    { label: 'Post-Op', phase_group: 'post_op', minutes: 15, percentage: 17, color: 'bg-slate-400' },
  ],
  missing_milestones: [],
  total_case_minutes: 90,
  total_surgical_minutes: 55,
  comparison_source: 'surgeon',
}

const DEFAULT_PROPS = {
  caseId: 'case-1',
  surgeonId: 'surgeon-1',
  procedureTypeId: 'pt-1',
  facilityId: 'fac-1',
  caseStatus: 'completed',
}

// ============================================
// SETUP
// ============================================

beforeEach(() => {
  vi.clearAllMocks()
  mockReturn = {
    data: FULL_DATA,
    loading: false,
    error: null,
    comparisonSource: 'surgeon',
    setComparisonSource: mockSetComparisonSource,
    surgeonCaseCount: 25,
    facilityCaseCount: 150,
    refetch: mockRefetch,
  }
})

// ============================================
// UNIT TESTS
// ============================================

describe('CaseDrawerMilestones — unit', () => {
  it('renders empty state when no milestones', () => {
    mockReturn.data = { ...FULL_DATA, intervals: [] }
    render(<CaseDrawerMilestones {...DEFAULT_PROPS} />)
    expect(screen.getByText('No milestones')).toBeDefined()
    expect(screen.getByText('No milestones are configured for this procedure')).toBeDefined()
  })

  it('renders loading skeleton when loading with no data', () => {
    mockReturn.data = null
    mockReturn.loading = true
    const { container } = render(<CaseDrawerMilestones {...DEFAULT_PROPS} />)
    expect(container.querySelector('.animate-pulse')).toBeDefined()
  })

  it('renders error state', () => {
    mockReturn.data = null
    mockReturn.error = 'Connection failed'
    render(<CaseDrawerMilestones {...DEFAULT_PROPS} />)
    expect(screen.getByText('Failed to load milestone data')).toBeDefined()
    expect(screen.getByText('Connection failed')).toBeDefined()
  })

  it('renders all milestone names', () => {
    render(<CaseDrawerMilestones {...DEFAULT_PROPS} />)
    // Names appear in both timeline labels and detail rows
    expect(screen.getAllByText('Patient In').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Incision').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Closing').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Patient Out').length).toBeGreaterThanOrEqual(1)
  })

  it('shows recorded count', () => {
    render(<CaseDrawerMilestones {...DEFAULT_PROPS} />)
    expect(screen.getByText('4/4 milestones recorded')).toBeDefined()
  })

  it('renders duration summary section', () => {
    render(<CaseDrawerMilestones {...DEFAULT_PROPS} />)
    // The footer row shows "Total Case Time" in the MilestoneTable component
    expect(screen.getByText('Total Case Time')).toBeDefined()
  })
})

describe('CaseDrawerMilestones — comparison toggle', () => {
  it('renders comparison toggle with case counts', () => {
    render(<CaseDrawerMilestones {...DEFAULT_PROPS} />)
    expect(screen.getByText('Surgeon Median')).toBeDefined()
    expect(screen.getByText('Facility Median')).toBeDefined()
    expect(screen.getByText('(25)')).toBeDefined()
    expect(screen.getByText('(150)')).toBeDefined()
  })

  it('calls setComparisonSource when toggle clicked', () => {
    render(<CaseDrawerMilestones {...DEFAULT_PROPS} />)
    fireEvent.click(screen.getByText('Facility Median'))
    expect(mockSetComparisonSource).toHaveBeenCalledWith('facility')
  })
})

describe('CaseDrawerMilestones — missing milestones', () => {
  it('shows missing milestone alert for completed cases', () => {
    // Phase 6 removed the alert banner — missing milestones are now shown
    // inline in the table with amber background and AlertTriangle icon
    mockReturn.data = {
      ...FULL_DATA,
      // Simulate two unrecorded milestones with later ones recorded
      intervals: [
        { ...INTERVALS[0], recorded_at: '2024-06-15T08:00:00Z' },
        { ...INTERVALS[1], recorded_at: null, milestone_name: 'Anesthesia Start' },
        { ...INTERVALS[2], recorded_at: null, milestone_name: 'Prep Complete' },
        { ...INTERVALS[3], recorded_at: '2024-06-15T09:30:00Z' },
      ],
      missing_milestones: ['Anesthesia Start', 'Prep Complete'],
    }
    const { container } = render(<CaseDrawerMilestones {...DEFAULT_PROPS} caseStatus="completed" />)
    // Missing milestones get amber background rows
    const amberRows = container.querySelectorAll('.bg-amber-50\\/60')
    expect(amberRows.length).toBeGreaterThanOrEqual(2)
  })

  it('does not show missing milestone alert for non-completed cases', () => {
    mockReturn.data = {
      ...FULL_DATA,
      missing_milestones: ['Anesthesia Start'],
    }
    render(<CaseDrawerMilestones {...DEFAULT_PROPS} caseStatus="in_progress" />)
    expect(screen.queryByText('1 milestone not recorded')).toBeNull()
  })
})

describe('CaseDrawerMilestones — time allocation', () => {
  it('renders time allocation bar when data available', () => {
    render(<CaseDrawerMilestones {...DEFAULT_PROPS} />)
    expect(screen.getByText('Where did the time go?')).toBeDefined()
  })
})

describe('CaseDrawerMilestones — workflow', () => {
  it('renders complete milestone view with timeline, detail rows, and summary', () => {
    render(<CaseDrawerMilestones {...DEFAULT_PROPS} />)
    // All milestone names (appear in both timeline and table)
    expect(screen.getAllByText('Patient In').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Patient Out').length).toBeGreaterThanOrEqual(1)
    // Footer row in table
    expect(screen.getByText('Total Case Time')).toBeDefined()
    // Comparison toggle
    expect(screen.getByText('Surgeon Median')).toBeDefined()
    // Time allocation
    expect(screen.getByText('Where did the time go?')).toBeDefined()
  })
})

// ============================================
// PHASE 9: Integration Test Matrix
// ============================================

describe('CaseDrawerMilestones — scheduled case with 0 milestones', () => {
  it('shows "Case not started" message for scheduled case with no data', () => {
    mockReturn.data = { ...FULL_DATA, intervals: [] }
    render(<CaseDrawerMilestones {...DEFAULT_PROPS} caseStatus="scheduled" />)
    expect(screen.getByText('Case not started')).toBeDefined()
    expect(screen.getByText('Milestone data will appear once the case begins')).toBeDefined()
  })
})

describe('CaseDrawerMilestones — in-progress case with partial milestones', () => {
  it('shows partial count and renders available data', () => {
    mockReturn.data = {
      ...FULL_DATA,
      intervals: [
        { ...INTERVALS[0], recorded_at: '2024-06-15T08:00:00Z' },
        { ...INTERVALS[1], recorded_at: '2024-06-15T08:20:00Z' },
        { ...INTERVALS[2], recorded_at: null, interval_minutes: null, delta_severity: null, delta_from_surgeon: null, delta_from_facility: null },
        { ...INTERVALS[3], recorded_at: null, interval_minutes: null, delta_severity: null, delta_from_surgeon: null, delta_from_facility: null },
      ],
    }
    render(<CaseDrawerMilestones {...DEFAULT_PROPS} caseStatus="in_progress" />)
    expect(screen.getByText('2/4 milestones recorded')).toBeDefined()
  })
})

describe('CaseDrawerMilestones — surgeon first case (no median data)', () => {
  it('renders with zero surgeon case count', () => {
    mockReturn.surgeonCaseCount = 0
    mockReturn.facilityCaseCount = 100
    mockReturn.data = {
      ...FULL_DATA,
      intervals: INTERVALS.map(iv => ({
        ...iv,
        surgeon_median_minutes: null,
        delta_from_surgeon: null,
      })),
    }
    render(<CaseDrawerMilestones {...DEFAULT_PROPS} />)
    // Should still render the table and toggle
    expect(screen.getByText('Surgeon Median')).toBeDefined()
    // Toggle hides count when count === 0, so "(0)" should not appear
    expect(screen.queryByText('(0)')).toBeNull()
    // But facility count should still show
    expect(screen.getByText('(100)')).toBeDefined()
  })
})

describe('CaseDrawerMilestones — completed case with 2 missing milestones', () => {
  it('shows correct counter and amber rows for missing milestones', () => {
    mockReturn.data = {
      ...FULL_DATA,
      intervals: [
        { ...INTERVALS[0], recorded_at: '2024-06-15T08:00:00Z', milestone_name: 'Patient In' },
        {
          milestone_name: 'Anes Start',
          facility_milestone_id: 'fm-a',
          display_order: 2,
          phase_group: 'pre_op',
          recorded_at: null,
          interval_minutes: null,
          surgeon_median_minutes: 6,
          facility_median_minutes: 7,
          delta_from_surgeon: null,
          delta_from_facility: null,
          delta_severity: null,
        },
        { ...INTERVALS[1], recorded_at: '2024-06-15T08:20:00Z' },
        {
          milestone_name: 'Prep Complete',
          facility_milestone_id: 'fm-b',
          display_order: 4,
          phase_group: 'surgical',
          recorded_at: null,
          interval_minutes: null,
          surgeon_median_minutes: 8,
          facility_median_minutes: 10,
          delta_from_surgeon: null,
          delta_from_facility: null,
          delta_severity: null,
        },
        { ...INTERVALS[2], recorded_at: '2024-06-15T09:15:00Z' },
        { ...INTERVALS[3], recorded_at: '2024-06-15T09:30:00Z' },
      ],
      missing_milestones: ['Anes Start', 'Prep Complete'],
    }
    render(<CaseDrawerMilestones {...DEFAULT_PROPS} caseStatus="completed" />)
    // Shows 4 of 6 recorded
    expect(screen.getByText('4/6 milestones recorded')).toBeDefined()
    // The text should be amber (not all recorded)
    const counterEl = screen.getByText('4/6 milestones recorded')
    expect(counterEl.className).toContain('text-amber')
  })
})

describe('CaseDrawerMilestones — hides time allocation when no data', () => {
  it('does not render allocation bar when time_allocation is empty', () => {
    mockReturn.data = { ...FULL_DATA, time_allocation: [] }
    render(<CaseDrawerMilestones {...DEFAULT_PROPS} />)
    expect(screen.queryByText('Where did the time go?')).toBeNull()
  })
})
