import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// Mock the useTrendData hook
const mockUseTrendData = vi.fn()
vi.mock('@/lib/hooks/useTrendData', () => ({
  useTrendData: (...args: unknown[]) => mockUseTrendData(...args),
  TREND_METRIC_OPTIONS: [
    { value: 'utilization', label: 'OR Utilization', unit: '%' },
    { value: 'turnover', label: 'Median Turnover', unit: 'min' },
    { value: 'caseVolume', label: 'Case Volume', unit: 'cases' },
    { value: 'facilityScore', label: 'Facility Score', unit: 'pts' },
  ],
}))

// Mock recharts to avoid canvas rendering issues in test env.
// Phase 6 uses AreaChart + Area (converted from LineChart + Line).
vi.mock('recharts', () => ({
  AreaChart: ({ children }: { children: React.ReactNode }) => <div data-testid="area-chart">{children}</div>,
  Area: () => <div data-testid="area" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
}))

import { TrendChart } from '../TrendChart'

describe('TrendChart', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading skeleton when data is loading', () => {
    mockUseTrendData.mockReturnValue({ data: null, loading: true })
    const { container } = render(<TrendChart />)
    expect(container.querySelector('.animate-pulse')).toBeTruthy()
  })

  it('renders empty state when no data', () => {
    mockUseTrendData.mockReturnValue({ data: [], loading: false })
    render(<TrendChart />)
    expect(screen.getByText('No data available for the last 30 days')).toBeTruthy()
  })

  it('renders chart title', () => {
    mockUseTrendData.mockReturnValue({
      data: [{ date: '2026-01-15', value: 42 }],
      loading: false,
    })
    render(<TrendChart />)
    expect(screen.getByText('30-Day Trend')).toBeTruthy()
  })

  it('renders all metric toggle buttons upfront (segmented control, not dropdown)', () => {
    mockUseTrendData.mockReturnValue({
      data: [{ date: '2026-01-15', value: 42 }],
      loading: false,
    })
    render(<TrendChart />)
    // All four buttons should be visible without any click — segmented toggle, not a dropdown
    expect(screen.getByText('OR Utilization')).toBeTruthy()
    expect(screen.getByText('Median Turnover')).toBeTruthy()
    expect(screen.getByText('Case Volume')).toBeTruthy()
    expect(screen.getByText('Facility Score')).toBeTruthy()
  })

  it('renders AreaChart (not LineChart) when data exists', () => {
    mockUseTrendData.mockReturnValue({
      data: [
        { date: '2026-01-15', value: 65 },
        { date: '2026-01-16', value: 70 },
      ],
      loading: false,
    })
    render(<TrendChart />)
    expect(screen.getByTestId('responsive-container')).toBeTruthy()
    expect(screen.getByTestId('area-chart')).toBeTruthy()
    expect(screen.getByTestId('area')).toBeTruthy()
    // LineChart must not be present — this was the old chart type
    expect(screen.queryByTestId('line-chart')).toBeNull()
  })

  it('changes metric when segmented toggle button clicked', () => {
    mockUseTrendData.mockReturnValue({
      data: [{ date: '2026-01-15', value: 42 }],
      loading: false,
    })
    render(<TrendChart />)

    // Click "Case Volume" directly — no dropdown open step needed
    fireEvent.click(screen.getByText('Case Volume'))

    expect(mockUseTrendData).toHaveBeenCalledWith('caseVolume')
  })

  it('changes metric to Median Turnover when toggle clicked', () => {
    mockUseTrendData.mockReturnValue({
      data: [{ date: '2026-01-15', value: 42 }],
      loading: false,
    })
    render(<TrendChart />)

    fireEvent.click(screen.getByText('Median Turnover'))

    expect(mockUseTrendData).toHaveBeenCalledWith('turnover')
  })

  it('calls useTrendData with default utilization metric on mount', () => {
    mockUseTrendData.mockReturnValue({ data: null, loading: true })
    render(<TrendChart />)
    expect(mockUseTrendData).toHaveBeenCalledWith('utilization')
  })

  it('active metric button has dark background class', () => {
    mockUseTrendData.mockReturnValue({
      data: [{ date: '2026-01-15', value: 42 }],
      loading: false,
    })
    render(<TrendChart />)

    const utilizationBtn = screen.getByText('OR Utilization').closest('button')
    expect(utilizationBtn?.className).toContain('bg-slate-800')
    expect(utilizationBtn?.className).toContain('text-white')

    // Inactive buttons should not have the active class
    const turnoverBtn = screen.getByText('Median Turnover').closest('button')
    expect(turnoverBtn?.className).not.toContain('bg-slate-800')
  })
})
