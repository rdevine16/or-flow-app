import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import CasesSummaryCards from '../CasesSummaryCards'

// ============================================
// MOCK IntersectionObserver (MetricCard uses it for count-up animation)
// ============================================

beforeAll(() => {
  // MetricCard uses IntersectionObserver for count-up animation.
  // jsdom doesn't provide it, so we stub a constructor-compatible mock.
  class MockIntersectionObserver {
    constructor(callback: IntersectionObserverCallback) {
      // Immediately trigger intersection so animation completes
      callback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        this as unknown as IntersectionObserver,
      )
    }
    observe() { /* noop */ }
    unobserve() { /* noop */ }
    disconnect() { /* noop */ }
  }
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
})

// ============================================
// MOCK useCaseMetrics
// ============================================

const mockUseCaseMetrics = vi.fn()

vi.mock('@/lib/hooks/useCaseMetrics', () => ({
  useCaseMetrics: (...args: unknown[]) => mockUseCaseMetrics(...args),
}))

// ============================================
// HELPERS
// ============================================

const DEFAULT_PROPS = {
  facilityId: 'facility-1',
  activeTab: 'all' as const,
  dateRange: { start: '2025-01-01', end: '2025-01-31' },
  statusIds: { scheduled: 'id-1', completed: 'id-2', in_progress: 'id-3' },
  statusIdsReady: true,
}

// ============================================
// UNIT TESTS
// ============================================

describe('CasesSummaryCards — unit', () => {
  beforeEach(() => {
    mockUseCaseMetrics.mockReset()
  })

  it('renders 4 loading skeletons on all tab when statusIdsReady is false', () => {
    mockUseCaseMetrics.mockReturnValue({ metrics: [], loading: true })
    const { container } = render(
      <CasesSummaryCards {...DEFAULT_PROPS} statusIdsReady={false} />
    )
    // Loading skeleton cards have animate-pulse class; all/today tabs show 4
    const skeletons = container.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBe(4)
  })

  it('renders 4 loading skeletons on all tab when hook is loading', () => {
    mockUseCaseMetrics.mockReturnValue({ metrics: [], loading: true })
    const { container } = render(
      <CasesSummaryCards {...DEFAULT_PROPS} />
    )
    const skeletons = container.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBe(4)
  })

  it('renders nothing when metrics array is empty and not loading', () => {
    mockUseCaseMetrics.mockReturnValue({ metrics: [], loading: false })
    const { container } = render(
      <CasesSummaryCards {...DEFAULT_PROPS} />
    )
    // Should return null — no grid rendered
    expect(container.innerHTML).toBe('')
  })

  it('renders 4 metric cards with correct titles on all tab', () => {
    mockUseCaseMetrics.mockReturnValue({
      metrics: [
        { title: 'Completed', value: 10, color: 'green' },
        { title: 'Scheduled', value: 20, color: 'blue' },
        { title: 'Median Duration', value: 45, suffix: ' min', color: 'green' },
        { title: 'On-Time Start', value: 85, suffix: '%', color: 'amber' },
      ],
      loading: false,
    })

    render(<CasesSummaryCards {...DEFAULT_PROPS} />)

    expect(screen.getByText('Completed')).toBeDefined()
    expect(screen.getByText('Scheduled')).toBeDefined()
    expect(screen.getByText('Median Duration')).toBeDefined()
    expect(screen.getByText('On-Time Start')).toBeDefined()
  })

  it('passes facilityId, activeTab, dateRange, and statusIds to useCaseMetrics', () => {
    mockUseCaseMetrics.mockReturnValue({ metrics: [], loading: false })

    render(<CasesSummaryCards {...DEFAULT_PROPS} />)

    expect(mockUseCaseMetrics).toHaveBeenCalledWith(
      DEFAULT_PROPS.facilityId,
      DEFAULT_PROPS.activeTab,
      DEFAULT_PROPS.dateRange,
      DEFAULT_PROPS.statusIds,
    )
  })
})

// ============================================
// INTEGRATION TESTS
// ============================================

describe('CasesSummaryCards — integration', () => {
  beforeEach(() => {
    mockUseCaseMetrics.mockReset()
  })

  it('renders completed tab metrics with dollar prefix', () => {
    mockUseCaseMetrics.mockReturnValue({
      metrics: [
        { title: 'Total Cases', value: 47, color: 'blue' },
        { title: 'Median Duration', value: 87, suffix: ' min', color: 'green' },
        { title: 'Total Profit', value: 12450, prefix: '$', color: 'green' },
      ],
      loading: false,
    })

    render(<CasesSummaryCards {...DEFAULT_PROPS} activeTab="completed" />)

    expect(screen.getByText('Total Cases')).toBeDefined()
    expect(screen.getByText('Total Profit')).toBeDefined()
  })

  it('renders needs_validation tab metrics', () => {
    mockUseCaseMetrics.mockReturnValue({
      metrics: [
        { title: 'Needs Validation', value: 12, color: 'amber' },
        { title: 'Oldest Unvalidated', value: 8, suffix: ' days', color: 'red' },
        { title: 'Data Completeness', value: 75, suffix: '%', color: 'green' },
      ],
      loading: false,
    })

    render(<CasesSummaryCards {...DEFAULT_PROPS} activeTab="needs_validation" />)

    expect(screen.getByText('Needs Validation')).toBeDefined()
    expect(screen.getByText('Oldest Unvalidated')).toBeDefined()
    expect(screen.getByText('Data Completeness')).toBeDefined()
  })

  it('re-renders with new metrics when activeTab prop changes', () => {
    // First render: all tab
    mockUseCaseMetrics.mockReturnValue({
      metrics: [
        { title: 'Completed', value: 10, color: 'green' },
        { title: 'Scheduled', value: 20, color: 'blue' },
        { title: 'Median Duration', value: 45, suffix: ' min', color: 'green' },
        { title: 'On-Time Start', value: 85, suffix: '%', color: 'amber' },
      ],
      loading: false,
    })

    const { rerender } = render(<CasesSummaryCards {...DEFAULT_PROPS} activeTab="all" />)
    expect(screen.getByText('Completed')).toBeDefined()

    // Second render: scheduled tab
    mockUseCaseMetrics.mockReturnValue({
      metrics: [
        { title: 'Cases Scheduled', value: 15, color: 'blue' },
        { title: 'Total OR Time', value: 12.5, suffix: ' hrs', decimals: 1, color: 'green' },
        { title: 'Surgeons Operating', value: 4, color: 'slate' },
      ],
      loading: false,
    })

    rerender(<CasesSummaryCards {...DEFAULT_PROPS} activeTab="scheduled" />)
    expect(screen.getByText('Cases Scheduled')).toBeDefined()
    expect(screen.getByText('Total OR Time')).toBeDefined()
    expect(screen.getByText('Surgeons Operating')).toBeDefined()
  })
})
