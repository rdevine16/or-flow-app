import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MilestoneTable } from '../MilestoneDetailRow'
import type { MilestoneInterval } from '@/lib/utils/milestoneAnalytics'

// ============================================
// FIXTURES
// ============================================

// Forward-looking intervals: each milestone's duration = time until next milestone
const BASE_INTERVALS: MilestoneInterval[] = [
  {
    milestone_name: 'Patient In',
    facility_milestone_id: 'fm-1',
    display_order: 1,
    phase_group: 'pre_op',
    recorded_at: '2024-06-15T08:00:00Z',
    interval_minutes: 20,
    surgeon_median_minutes: 18,
    facility_median_minutes: 22,
    delta_from_surgeon: 2,
    delta_from_facility: -2,
    delta_severity: 'on-pace',
  },
  {
    milestone_name: 'Incision',
    facility_milestone_id: 'fm-2',
    display_order: 3,
    phase_group: 'surgical',
    recorded_at: '2024-06-15T08:20:00Z',
    interval_minutes: 55,
    surgeon_median_minutes: 50,
    facility_median_minutes: 52,
    delta_from_surgeon: 5,
    delta_from_facility: 3,
    delta_severity: 'on-pace',
  },
  {
    milestone_name: 'Closing',
    facility_milestone_id: 'fm-3',
    display_order: 5,
    phase_group: 'closing',
    recorded_at: '2024-06-15T09:15:00Z',
    interval_minutes: 15,
    surgeon_median_minutes: 12,
    facility_median_minutes: 14,
    delta_from_surgeon: 3,
    delta_from_facility: 1,
    delta_severity: 'slower',
  },
  {
    milestone_name: 'Patient Out',
    facility_milestone_id: 'fm-4',
    display_order: 7,
    phase_group: 'post_op',
    recorded_at: '2024-06-15T09:30:00Z',
    interval_minutes: null,
    surgeon_median_minutes: null,
    facility_median_minutes: null,
    delta_from_surgeon: null,
    delta_from_facility: null,
    delta_severity: null,
  },
]

const DEFAULT_PROPS = {
  intervals: BASE_INTERVALS,
  comparisonSource: 'surgeon' as const,
  surgeonCaseCount: 25,
  facilityCaseCount: 150,
  missingFlags: [false, false, false, false],
  totalCaseMinutes: 90,
  totalSurgicalMinutes: 55,
}

// ============================================
// TABLE STRUCTURE
// ============================================

describe('MilestoneTable — structure', () => {
  it('renders column header "Surg Med" for surgeon comparison', () => {
    render(<MilestoneTable {...DEFAULT_PROPS} />)
    expect(screen.getByText('Surg Med')).toBeDefined()
  })

  it('renders column header "Fac Med" for facility comparison', () => {
    render(<MilestoneTable {...DEFAULT_PROPS} comparisonSource="facility" />)
    expect(screen.getByText('Fac Med')).toBeDefined()
  })

  it('renders all milestone names', () => {
    render(<MilestoneTable {...DEFAULT_PROPS} />)
    expect(screen.getByText('Patient In')).toBeDefined()
    expect(screen.getByText('Incision')).toBeDefined()
    expect(screen.getByText('Closing')).toBeDefined()
    expect(screen.getByText('Patient Out')).toBeDefined()
  })

  it('renders duration values in minutes', () => {
    render(<MilestoneTable {...DEFAULT_PROPS} />)
    expect(screen.getByText('20m')).toBeDefined()  // Patient In duration
    expect(screen.getByText('55m')).toBeDefined()  // Incision duration
    expect(screen.getByText('15m')).toBeDefined()  // Closing duration
  })

  it('renders surgeon median values', () => {
    render(<MilestoneTable {...DEFAULT_PROPS} />)
    expect(screen.getByText('18m')).toBeDefined()  // Patient In surgeon median
    expect(screen.getByText('50m')).toBeDefined()  // Incision surgeon median
    expect(screen.getByText('12m')).toBeDefined()  // Closing surgeon median
  })

  it('renders facility median values when comparison is facility', () => {
    render(<MilestoneTable {...DEFAULT_PROPS} comparisonSource="facility" />)
    expect(screen.getByText('22m')).toBeDefined()  // Patient In facility median
    expect(screen.getByText('52m')).toBeDefined()  // Incision facility median
    expect(screen.getByText('14m')).toBeDefined()  // Closing facility median
  })
})

// ============================================
// DELTA BADGE INTEGRATION
// ============================================

describe('MilestoneTable — DeltaBadge integration', () => {
  it('renders DeltaBadge with correct severity for on-pace milestones', () => {
    render(<MilestoneTable {...DEFAULT_PROPS} />)
    // Incision: delta +2m, severity "on-pace" → amber badge
    const badges = screen.getAllByLabelText(/on pace|faster|slower/)
    expect(badges.length).toBeGreaterThanOrEqual(1)
  })

  it('renders DeltaBadge with slower severity', () => {
    render(<MilestoneTable {...DEFAULT_PROPS} />)
    // Closing: delta +3m, severity "slower" → red badge
    const slowerBadge = screen.getByLabelText('3m slower')
    expect(slowerBadge).toBeDefined()
  })

  it('does NOT render DeltaBadge for last milestone', () => {
    render(<MilestoneTable {...DEFAULT_PROPS} />)
    // Last milestone (Patient Out) has no duration → should show dash, not badge
    // Count of delta badges: 3 milestones (Patient In, Incision, Closing)
    // Footer no longer shows median or delta (statistically invalid to sum medians)
    const allBadges = screen.getAllByLabelText(/on pace|faster|slower/)
    expect(allBadges.length).toBe(3) // Patient In, Incision, Closing only
  })
})

// ============================================
// MISSING MILESTONES
// ============================================

describe('MilestoneTable — missing milestones', () => {
  it('renders amber background for missing milestone rows', () => {
    const missingFlags = [false, true, false, false]  // Incision is missing
    const { container } = render(
      <MilestoneTable {...DEFAULT_PROPS} missingFlags={missingFlags} />
    )
    const amberRows = container.querySelectorAll('.bg-amber-50\\/60')
    expect(amberRows.length).toBe(1)
  })

  it('shows "N/R" badge for missing milestones', () => {
    const missingFlags = [false, true, false, false]
    render(<MilestoneTable {...DEFAULT_PROPS} missingFlags={missingFlags} />)
    expect(screen.getByText('N/R')).toBeDefined()
  })
})

// ============================================
// FOOTER ROW
// ============================================

describe('MilestoneTable — summary footer', () => {
  it('renders total case time', () => {
    render(<MilestoneTable {...DEFAULT_PROPS} />)
    expect(screen.getByText('Total Case Time')).toBeDefined()
    // 90 minutes = "1h 30m"
    expect(screen.getByText('1h 30m')).toBeDefined()
  })

  it('does NOT render total median (statistically invalid)', () => {
    render(<MilestoneTable {...DEFAULT_PROPS} />)
    // Footer no longer shows summed median because median of sums ≠ sum of medians
    // This would be statistically misleading
    expect(screen.queryByText('1h 20m')).toBeNull()
  })

  it('does NOT render total delta badge (statistically invalid)', () => {
    render(<MilestoneTable {...DEFAULT_PROPS} />)
    // Footer no longer shows delta because it would be based on invalid summed median
    expect(screen.queryByText('+10m')).toBeNull()
  })

  it('does not render footer when totalCaseMinutes is null', () => {
    render(<MilestoneTable {...DEFAULT_PROPS} totalCaseMinutes={null} />)
    expect(screen.queryByText('Total Case Time')).toBeNull()
  })
})
