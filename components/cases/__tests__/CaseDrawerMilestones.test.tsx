import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import CaseDrawerMilestones from '../CaseDrawerMilestones'
import type { CaseMilestone } from '@/lib/dal/cases'
import type { SurgeonProcedureStats, FacilityProcedureStats } from '@/lib/hooks/useCaseDrawer'

// ============================================
// FIXTURES
// ============================================

const MILESTONES: CaseMilestone[] = [
  {
    id: 'ms-1',
    case_id: 'case-1',
    facility_milestone_id: 'fm-1',
    recorded_at: '2024-06-15T08:00:00Z',
    recorded_by: 'user-1',
    facility_milestone: { name: 'Patient In', display_name: 'Patient In', display_order: 1 },
  },
  {
    id: 'ms-2',
    case_id: 'case-1',
    facility_milestone_id: 'fm-2',
    recorded_at: '2024-06-15T08:20:00Z',
    recorded_by: 'user-1',
    facility_milestone: { name: 'Incision', display_name: 'Incision', display_order: 3 },
  },
  {
    id: 'ms-3',
    case_id: 'case-1',
    facility_milestone_id: 'fm-3',
    recorded_at: '2024-06-15T09:15:00Z',
    recorded_by: 'user-1',
    facility_milestone: { name: 'Closing', display_name: 'Closing', display_order: 5 },
  },
  {
    id: 'ms-4',
    case_id: 'case-1',
    facility_milestone_id: 'fm-4',
    recorded_at: '2024-06-15T09:30:00Z',
    recorded_by: 'user-1',
    facility_milestone: { name: 'Patient Out', display_name: 'Patient Out', display_order: 7 },
  },
]

const MILESTONES_WITH_PENDING: CaseMilestone[] = [
  ...MILESTONES.slice(0, 2),
  {
    id: 'ms-3b',
    case_id: 'case-1',
    facility_milestone_id: 'fm-3',
    recorded_at: '', // pending
    recorded_by: null,
    facility_milestone: { name: 'Closing', display_name: 'Closing', display_order: 5 },
  },
  {
    id: 'ms-4b',
    case_id: 'case-1',
    facility_milestone_id: 'fm-4',
    recorded_at: '', // pending
    recorded_by: null,
    facility_milestone: { name: 'Patient Out', display_name: 'Patient Out', display_order: 7 },
  },
]

const SURGEON_STATS: SurgeonProcedureStats = {
  surgeon_id: 'surgeon-1',
  procedure_type_id: 'pt-1',
  facility_id: 'fac-1',
  sample_size: 25,
  median_duration: 100, // total: 90 actual = green (faster)
  median_surgical_duration: 60, // surgical: 55 actual = green
  median_call_to_patient_in: 15, // pre-op: 20 actual = amber (within 10%? no, 33% over)
}

const FACILITY_STATS: FacilityProcedureStats = {
  procedure_type_id: 'pt-1',
  facility_id: 'fac-1',
  sample_size: 150,
  surgeon_count: 8,
  median_duration: 95,
  median_surgical_duration: 58,
  median_call_to_patient_in: 18,
}

// ============================================
// UNIT TESTS
// ============================================

describe('CaseDrawerMilestones — unit', () => {
  it('renders empty state when no milestones', () => {
    render(
      <CaseDrawerMilestones
        milestones={[]}
        surgeonStats={null}
        facilityStats={null}
        comparisonLoading={false}
        surgeonName={null}
      />
    )
    expect(screen.getByText('No milestones')).toBeDefined()
    expect(screen.getByText('No milestones are configured for this case')).toBeDefined()
  })

  it('renders all milestone names in order', () => {
    render(
      <CaseDrawerMilestones
        milestones={MILESTONES}
        surgeonStats={null}
        facilityStats={null}
        comparisonLoading={false}
        surgeonName={null}
      />
    )
    expect(screen.getByText('Patient In')).toBeDefined()
    expect(screen.getByText('Incision')).toBeDefined()
    expect(screen.getByText('Closing')).toBeDefined()
    expect(screen.getByText('Patient Out')).toBeDefined()
  })

  it('shows recorded count', () => {
    render(
      <CaseDrawerMilestones
        milestones={MILESTONES}
        surgeonStats={null}
        facilityStats={null}
        comparisonLoading={false}
        surgeonName={null}
      />
    )
    expect(screen.getByText('4/4 recorded')).toBeDefined()
  })

  it('shows partial recorded count for milestones with pending items', () => {
    render(
      <CaseDrawerMilestones
        milestones={MILESTONES_WITH_PENDING}
        surgeonStats={null}
        facilityStats={null}
        comparisonLoading={false}
        surgeonName={null}
      />
    )
    expect(screen.getByText('2/4 recorded')).toBeDefined()
  })

  it('shows "Pending" for unrecorded milestones', () => {
    render(
      <CaseDrawerMilestones
        milestones={MILESTONES_WITH_PENDING}
        surgeonStats={null}
        facilityStats={null}
        comparisonLoading={false}
        surgeonName={null}
      />
    )
    expect(screen.getAllByText('Pending').length).toBe(2)
  })

  it('shows interval labels between consecutive recorded milestones', () => {
    render(
      <CaseDrawerMilestones
        milestones={MILESTONES}
        surgeonStats={null}
        facilityStats={null}
        comparisonLoading={false}
        surgeonName={null}
      />
    )
    // Patient In → Incision = 20min (also appears in Pre-Op summary)
    expect(screen.getAllByText('20m').length).toBeGreaterThanOrEqual(1)
    // Incision → Closing = 55min (also appears in Surgical Time summary)
    expect(screen.getAllByText('55m').length).toBeGreaterThanOrEqual(1)
    // Closing → Patient Out = 15min
    expect(screen.getAllByText('15m').length).toBeGreaterThanOrEqual(1)
  })

  it('renders duration summary section', () => {
    render(
      <CaseDrawerMilestones
        milestones={MILESTONES}
        surgeonStats={null}
        facilityStats={null}
        comparisonLoading={false}
        surgeonName={null}
      />
    )
    expect(screen.getByText('Duration Summary')).toBeDefined()
    expect(screen.getByText('Total Case Time')).toBeDefined()
    expect(screen.getByText('Surgical Time')).toBeDefined()
    expect(screen.getByText('Pre-Op Time')).toBeDefined()
  })

  it('shows "no benchmark" when no stats provided', () => {
    render(
      <CaseDrawerMilestones
        milestones={MILESTONES}
        surgeonStats={null}
        facilityStats={null}
        comparisonLoading={false}
        surgeonName={null}
      />
    )
    expect(screen.getByText('No benchmark data available for this procedure')).toBeDefined()
  })
})

describe('CaseDrawerMilestones — comparison badges', () => {
  it('renders surgeon and facility comparison badges when stats available', () => {
    render(
      <CaseDrawerMilestones
        milestones={MILESTONES}
        surgeonStats={SURGEON_STATS}
        facilityStats={FACILITY_STATS}
        comparisonLoading={false}
        surgeonName="James Wilson"
      />
    )
    // Should show sample size context
    expect(screen.getByText(/Surgeon median based on 25 cases/)).toBeDefined()
    expect(screen.getByText(/Facility median based on 150 cases/)).toBeDefined()
  })

  it('shows surgeon name in comparison badges', () => {
    render(
      <CaseDrawerMilestones
        milestones={MILESTONES}
        surgeonStats={SURGEON_STATS}
        facilityStats={FACILITY_STATS}
        comparisonLoading={false}
        surgeonName="James Wilson"
      />
    )
    // Surgeon badge should show abbreviated name "Dr. Wilson"
    expect(screen.getAllByText(/Dr\. Wilson/).length).toBeGreaterThan(0)
  })

  it('shows "No data" badges when surgeon stats missing but facility stats present', () => {
    render(
      <CaseDrawerMilestones
        milestones={MILESTONES}
        surgeonStats={null}
        facilityStats={FACILITY_STATS}
        comparisonLoading={false}
        surgeonName="James Wilson"
      />
    )
    // Surgeon badges should show "No data"
    expect(screen.getAllByText(/No data/).length).toBeGreaterThan(0)
    // Facility badges should show actual deltas
    expect(screen.getByText(/Facility median based on 150 cases/)).toBeDefined()
  })
})

describe('CaseDrawerMilestones — workflow', () => {
  it('renders complete milestone view with timeline, intervals, and comparisons', () => {
    const { container } = render(
      <CaseDrawerMilestones
        milestones={MILESTONES}
        surgeonStats={SURGEON_STATS}
        facilityStats={FACILITY_STATS}
        comparisonLoading={false}
        surgeonName="James Wilson"
      />
    )
    // Timeline section exists
    expect(screen.getByText('Milestone Timeline')).toBeDefined()
    // All 4 milestones rendered
    expect(screen.getByText('Patient In')).toBeDefined()
    expect(screen.getByText('Patient Out')).toBeDefined()
    // Intervals are shown (may appear in both timeline and summary)
    expect(screen.getAllByText('20m').length).toBeGreaterThanOrEqual(1)
    // Summary section exists
    expect(screen.getByText('Duration Summary')).toBeDefined()
    // Comparison badges exist (at least some)
    expect(container.querySelectorAll('[class*="bg-green-50"], [class*="bg-amber-50"], [class*="bg-red-50"]').length).toBeGreaterThan(0)
    // Sample size context
    expect(screen.getByText(/25 cases/)).toBeDefined()
  })
})
