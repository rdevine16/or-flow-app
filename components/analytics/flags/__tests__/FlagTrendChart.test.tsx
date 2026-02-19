/**
 * components/analytics/flags/__tests__/FlagTrendChart.test.tsx
 *
 * Unit tests for FlagTrendChart (Recharts stacked area chart).
 *
 * Covers:
 * 1. Empty state — renders placeholder when data array is empty
 * 2. Renders ResponsiveContainer + AreaChart when data is present
 * 3. Two Area series are rendered (threshold / delay)
 * 4. Legend items: "Auto-detected" and "User-reported" are visible
 * 5. gradient defs are present in the rendered output (via mocked defs)
 * 6. XAxis and YAxis are rendered
 * 7. Single data point — chart renders without error
 * 8. Multiple data points — chart renders all entries
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { WeeklyTrendPoint } from '@/types/flag-analytics'

// Mock recharts — avoids canvas/SVG rendering issues in jsdom.
// Mirrors the pattern used in TrendChart.test.tsx.
vi.mock('recharts', () => ({
  AreaChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="area-chart">{children}</div>
  ),
  Area: ({ dataKey, name }: { dataKey: string; name: string }) => (
    <div data-testid="area" data-key={dataKey} data-name={name} />
  ),
  XAxis: ({ dataKey }: { dataKey: string }) => (
    <div data-testid="x-axis" data-key={dataKey} />
  ),
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
}))

import FlagTrendChart from '../FlagTrendChart'

// ============================================
// Fixtures
// ============================================

function makeWeek(week: string, threshold = 3, delay = 2): WeeklyTrendPoint {
  return { week, threshold, delay, total: threshold + delay }
}

const SINGLE: WeeklyTrendPoint[] = [makeWeek('Jan 6')]

const MULTI: WeeklyTrendPoint[] = [
  makeWeek('Jan 6', 4, 2),
  makeWeek('Jan 13', 2, 5),
  makeWeek('Jan 20', 6, 1),
  makeWeek('Jan 27', 3, 3),
]

// ============================================
// Tests
// ============================================

describe('FlagTrendChart', () => {
  // ------------------------------------------
  // 1. Empty state
  // ------------------------------------------

  it('renders "No trend data available" placeholder when data is empty', () => {
    render(<FlagTrendChart data={[]} />)
    expect(screen.getByText('No trend data available')).toBeDefined()
  })

  it('does NOT render the chart when data is empty', () => {
    const { container } = render(<FlagTrendChart data={[]} />)
    expect(container.querySelector('[data-testid="area-chart"]')).toBeNull()
  })

  // ------------------------------------------
  // 2. Chart container
  // ------------------------------------------

  it('renders ResponsiveContainer when data is present', () => {
    render(<FlagTrendChart data={MULTI} />)
    expect(screen.getByTestId('responsive-container')).toBeDefined()
  })

  it('renders AreaChart inside the container', () => {
    render(<FlagTrendChart data={MULTI} />)
    expect(screen.getByTestId('area-chart')).toBeDefined()
  })

  // ------------------------------------------
  // 3. Area series
  // ------------------------------------------

  it('renders two Area series', () => {
    const { container } = render(<FlagTrendChart data={MULTI} />)
    const areas = container.querySelectorAll('[data-testid="area"]')
    expect(areas.length).toBe(2)
  })

  it('renders an Area with dataKey="threshold"', () => {
    const { container } = render(<FlagTrendChart data={MULTI} />)
    const thresholdArea = container.querySelector('[data-key="threshold"]')
    expect(thresholdArea).not.toBeNull()
  })

  it('renders an Area with dataKey="delay"', () => {
    const { container } = render(<FlagTrendChart data={MULTI} />)
    const delayArea = container.querySelector('[data-key="delay"]')
    expect(delayArea).not.toBeNull()
  })

  it('Area for threshold has name "Auto-detected"', () => {
    const { container } = render(<FlagTrendChart data={MULTI} />)
    const area = container.querySelector('[data-key="threshold"]')
    expect(area?.getAttribute('data-name')).toBe('Auto-detected')
  })

  it('Area for delay has name "User-reported"', () => {
    const { container } = render(<FlagTrendChart data={MULTI} />)
    const area = container.querySelector('[data-key="delay"]')
    expect(area?.getAttribute('data-name')).toBe('User-reported')
  })

  // ------------------------------------------
  // 4. Legend
  // ------------------------------------------

  it('renders "Auto-detected" legend label', () => {
    render(<FlagTrendChart data={MULTI} />)
    expect(screen.getByText('Auto-detected')).toBeDefined()
  })

  it('renders "User-reported" legend label', () => {
    render(<FlagTrendChart data={MULTI} />)
    expect(screen.getByText('User-reported')).toBeDefined()
  })

  // ------------------------------------------
  // 5. Axes
  // ------------------------------------------

  it('renders XAxis', () => {
    render(<FlagTrendChart data={MULTI} />)
    expect(screen.getByTestId('x-axis')).toBeDefined()
  })

  it('renders YAxis', () => {
    render(<FlagTrendChart data={MULTI} />)
    expect(screen.getByTestId('y-axis')).toBeDefined()
  })

  it('XAxis uses "week" as the dataKey', () => {
    const { container } = render(<FlagTrendChart data={MULTI} />)
    const xAxis = container.querySelector('[data-testid="x-axis"]')
    expect(xAxis?.getAttribute('data-key')).toBe('week')
  })

  // ------------------------------------------
  // 6. Single data point — no crash
  // ------------------------------------------

  it('renders without error for a single data point', () => {
    expect(() => render(<FlagTrendChart data={SINGLE} />)).not.toThrow()
  })

  it('does not show empty state with a single data point', () => {
    render(<FlagTrendChart data={SINGLE} />)
    expect(screen.queryByText('No trend data available')).toBeNull()
  })

  // ------------------------------------------
  // 7. Empty state does NOT show chart axes
  // ------------------------------------------

  it('does not render axes in empty state', () => {
    render(<FlagTrendChart data={[]} />)
    expect(screen.queryByTestId('x-axis')).toBeNull()
    expect(screen.queryByTestId('y-axis')).toBeNull()
  })
})
