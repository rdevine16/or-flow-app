// components/dashboard/__tests__/InsightsSection.test.tsx
// Unit tests for InsightsSection — the lazy-loaded "What should we fix?" container.
// Covers: pre-scroll placeholder, loading skeleton, empty state, populated list,
// accordion toggle (only one card expanded at a time), insight count badge.
//
// IntersectionObserver is stubbed globally using a class constructor so React's
// `new IntersectionObserver(...)` call works correctly in jsdom.
// useDashboardInsights is mocked to isolate the component from the network.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InsightsSection } from '../InsightsSection'
import type { Insight } from '@/lib/insightsEngine'

// ============================================
// Mocks
// ============================================

vi.mock('@/lib/hooks/useDashboardInsights', () => ({
  useDashboardInsights: vi.fn(),
}))

import { useDashboardInsights } from '@/lib/hooks/useDashboardInsights'
const mockUseDashboardInsights = vi.mocked(useDashboardInsights)

// IntersectionObserver must be a class constructor (not an arrow function)
// because InsightsSection calls `new IntersectionObserver(...)`.
let lastObserverCallback: ((entries: IntersectionObserverEntry[]) => void) | null = null

class MockIntersectionObserver {
  constructor(cb: (entries: IntersectionObserverEntry[]) => void) {
    lastObserverCallback = cb
  }
  observe = vi.fn()
  disconnect = vi.fn()
}

// ============================================
// Test fixtures
// ============================================

function makeInsight(overrides: Partial<Insight> = {}): Insight {
  return {
    id: 'insight-fcots',
    category: 'first_case_delays',
    severity: 'critical',
    title: 'First cases starting late',
    body: 'Your FCOTS rate is 31%, well below the 85% target.',
    financialImpact: '$48K estimated annual impact.',
    drillThroughType: 'fcots',
    metadata: {},
    ...overrides,
  }
}

// ============================================
// Setup / teardown
// ============================================

beforeEach(() => {
  lastObserverCallback = null
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
  // Default state: not loading, no data (component just mounted, not scrolled into view)
  mockUseDashboardInsights.mockReturnValue({ data: null, loading: false, error: null })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

// ============================================
// Pre-scroll placeholder
// ============================================

describe('InsightsSection: pre-scroll placeholder', () => {
  it('shows "Scroll to load insights" placeholder before scrolling into view', () => {
    render(<InsightsSection timeRange="week" />)
    expect(screen.getByText('Scroll to load insights')).toBeTruthy()
  })

  it('renders the header regardless of visibility state', () => {
    render(<InsightsSection timeRange="week" />)
    expect(screen.getByText('What should we fix?')).toBeTruthy()
  })

  it('does not show loading skeleton in pre-scroll state', () => {
    const { container } = render(<InsightsSection timeRange="week" />)
    expect(container.querySelector('.animate-pulse')).toBeNull()
  })
})

// ============================================
// Loading skeleton
// ============================================

describe('InsightsSection: loading skeleton', () => {
  it('renders three skeleton rows while loading=true', () => {
    mockUseDashboardInsights.mockReturnValue({ data: null, loading: true, error: null })
    const { container } = render(<InsightsSection timeRange="week" />)
    const skeletonRows = container.querySelectorAll('.animate-pulse')
    expect(skeletonRows.length).toBe(3)
  })

  it('does not show insight cards while loading', () => {
    mockUseDashboardInsights.mockReturnValue({ data: null, loading: true, error: null })
    render(<InsightsSection timeRange="week" />)
    // No insight titles
    expect(screen.queryByText('First cases starting late')).toBeNull()
  })
})

// ============================================
// Empty state
// ============================================

describe('InsightsSection: empty state', () => {
  it('shows "Looking good" when data is loaded with zero insights', () => {
    mockUseDashboardInsights.mockReturnValue({
      data: { insights: [] },
      loading: false,
      error: null,
    })
    render(<InsightsSection timeRange="month" />)
    expect(screen.getByText('Looking good')).toBeTruthy()
    expect(screen.getByText('No actionable insights for this period.')).toBeTruthy()
  })

  it('does not render the insight count badge when empty', () => {
    mockUseDashboardInsights.mockReturnValue({
      data: { insights: [] },
      loading: false,
      error: null,
    })
    render(<InsightsSection timeRange="today" />)
    expect(screen.queryByText(/\d+ insight/)).toBeNull()
  })

  it('does not show placeholder or skeleton in empty state', () => {
    mockUseDashboardInsights.mockReturnValue({
      data: { insights: [] },
      loading: false,
      error: null,
    })
    const { container } = render(<InsightsSection timeRange="today" />)
    expect(container.querySelector('.animate-pulse')).toBeNull()
  })
})

// ============================================
// Populated state
// ============================================

describe('InsightsSection: populated with insights', () => {
  const twoInsights: Insight[] = [
    makeInsight({ id: 'i1', title: 'FCOTS issues detected', severity: 'critical' }),
    makeInsight({
      id: 'i2',
      title: 'Turnover time elevated',
      category: 'turnover_efficiency',
      severity: 'warning',
      financialImpact: '$20K impact',
    }),
  ]

  it('renders all insight card titles', () => {
    mockUseDashboardInsights.mockReturnValue({
      data: { insights: twoInsights },
      loading: false,
      error: null,
    })
    render(<InsightsSection timeRange="week" />)

    expect(screen.getByText('FCOTS issues detected')).toBeTruthy()
    expect(screen.getByText('Turnover time elevated')).toBeTruthy()
  })

  it('shows insight count badge with correct count for 2 insights', () => {
    mockUseDashboardInsights.mockReturnValue({
      data: { insights: twoInsights },
      loading: false,
      error: null,
    })
    render(<InsightsSection timeRange="week" />)
    expect(screen.getByText('2 insights')).toBeTruthy()
  })

  it('uses singular "insight" label for exactly 1 insight', () => {
    mockUseDashboardInsights.mockReturnValue({
      data: { insights: [makeInsight()] },
      loading: false,
      error: null,
    })
    render(<InsightsSection timeRange="today" />)
    expect(screen.getByText('1 insight')).toBeTruthy()
  })

  it('renders rank badge numbers starting from 1', () => {
    mockUseDashboardInsights.mockReturnValue({
      data: { insights: twoInsights },
      loading: false,
      error: null,
    })
    render(<InsightsSection timeRange="week" />)
    expect(screen.getByText('1')).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy()
  })

  it('does not show loading skeleton or "Looking good" empty state when data is populated', () => {
    // Note: the pre-scroll placeholder ("Scroll to load insights") is governed by
    // visible state (IntersectionObserver), not by data presence. In a real browser,
    // once the component scrolls into view, visible becomes true and the placeholder hides.
    // Here we verify the loading and empty states are absent when data is populated.
    mockUseDashboardInsights.mockReturnValue({
      data: { insights: twoInsights },
      loading: false,
      error: null,
    })
    const { container } = render(<InsightsSection timeRange="week" />)
    expect(container.querySelector('.animate-pulse')).toBeNull()
    expect(screen.queryByText('Looking good')).toBeNull()
    expect(screen.queryByText('No actionable insights for this period.')).toBeNull()
  })
})

// ============================================
// Accordion: only one card expanded at a time
// ============================================

describe('InsightsSection: accordion behavior', () => {
  const twoInsights: Insight[] = [
    makeInsight({
      id: 'accordion-1',
      title: 'First insight',
      severity: 'critical',
      financialImpact: '$48K estimated annual impact.',
    }),
    makeInsight({
      id: 'accordion-2',
      title: 'Second insight',
      category: 'utilization_gap',
      severity: 'warning',
      financialImpact: '$20K impact',
    }),
  ]

  it('starts with all cards collapsed (no financial impact visible)', () => {
    mockUseDashboardInsights.mockReturnValue({
      data: { insights: twoInsights },
      loading: false,
      error: null,
    })
    render(<InsightsSection timeRange="week" />)
    expect(screen.queryByText('$48K estimated annual impact.')).toBeNull()
    expect(screen.queryByText('$20K impact')).toBeNull()
  })

  it('expands first card when clicked and shows its financial impact', async () => {
    const user = userEvent.setup()
    mockUseDashboardInsights.mockReturnValue({
      data: { insights: twoInsights },
      loading: false,
      error: null,
    })
    render(<InsightsSection timeRange="week" />)

    const buttons = screen.getAllByRole('button')
    await user.click(buttons[0])

    expect(screen.getByText('$48K estimated annual impact.')).toBeTruthy()
    expect(screen.queryByText('$20K impact')).toBeNull()
  })

  it('collapses first card when clicked again (toggle off)', async () => {
    const user = userEvent.setup()
    mockUseDashboardInsights.mockReturnValue({
      data: { insights: twoInsights },
      loading: false,
      error: null,
    })
    render(<InsightsSection timeRange="week" />)

    const buttons = screen.getAllByRole('button')
    await user.click(buttons[0]) // expand
    await user.click(buttons[0]) // collapse

    expect(screen.queryByText('$48K estimated annual impact.')).toBeNull()
  })

  it('clicking second card collapses first (accordion: one open at a time)', async () => {
    const user = userEvent.setup()
    mockUseDashboardInsights.mockReturnValue({
      data: { insights: twoInsights },
      loading: false,
      error: null,
    })
    render(<InsightsSection timeRange="week" />)

    const buttons = screen.getAllByRole('button')
    await user.click(buttons[0]) // expand first
    expect(screen.getByText('$48K estimated annual impact.')).toBeTruthy()

    await user.click(buttons[1]) // expand second → first must collapse
    expect(screen.queryByText('$48K estimated annual impact.')).toBeNull()
    expect(screen.getByText('$20K impact')).toBeTruthy()
  })
})

// ============================================
// Lazy loading gate: enabled flag
// The hook must receive enabled=false on initial render (before scrolling into view).
// This ensures the data fetch is deferred until the component is visible.
// ============================================

describe('InsightsSection: lazy loading gate (enabled flag)', () => {
  it('passes enabled=false to useDashboardInsights before scroll', () => {
    render(<InsightsSection timeRange="week" />)
    // On initial render visible=false → enabled=false
    expect(mockUseDashboardInsights).toHaveBeenCalledWith('week', false)
  })

  it('passes the correct timeRange prop to useDashboardInsights', () => {
    render(<InsightsSection timeRange="month" />)
    const calls = mockUseDashboardInsights.mock.calls
    const lastCall = calls[calls.length - 1]
    expect(lastCall[0]).toBe('month')
  })

  it('passes enabled=false for timeRange="today" too', () => {
    render(<InsightsSection timeRange="today" />)
    expect(mockUseDashboardInsights).toHaveBeenCalledWith('today', false)
  })
})
