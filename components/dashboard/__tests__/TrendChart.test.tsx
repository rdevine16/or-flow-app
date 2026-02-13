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

// Mock recharts to avoid canvas rendering issues in test env
vi.mock('recharts', () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
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

  it('renders default metric label in dropdown', () => {
    mockUseTrendData.mockReturnValue({
      data: [{ date: '2026-01-15', value: 42 }],
      loading: false,
    })
    render(<TrendChart />)
    expect(screen.getByText('OR Utilization')).toBeTruthy()
  })

  it('renders recharts components when data exists', () => {
    mockUseTrendData.mockReturnValue({
      data: [
        { date: '2026-01-15', value: 65 },
        { date: '2026-01-16', value: 70 },
      ],
      loading: false,
    })
    render(<TrendChart />)
    expect(screen.getByTestId('responsive-container')).toBeTruthy()
    expect(screen.getByTestId('line-chart')).toBeTruthy()
  })

  it('opens dropdown and shows all metric options', () => {
    mockUseTrendData.mockReturnValue({
      data: [{ date: '2026-01-15', value: 42 }],
      loading: false,
    })
    render(<TrendChart />)

    // Click the dropdown button
    fireEvent.click(screen.getByText('OR Utilization'))

    // All options should be visible
    expect(screen.getByText('Median Turnover')).toBeTruthy()
    expect(screen.getByText('Case Volume')).toBeTruthy()
    expect(screen.getByText('Facility Score')).toBeTruthy()
  })

  it('changes metric when dropdown option clicked', () => {
    mockUseTrendData.mockReturnValue({
      data: [{ date: '2026-01-15', value: 42 }],
      loading: false,
    })
    render(<TrendChart />)

    // Open dropdown
    fireEvent.click(screen.getByText('OR Utilization'))

    // Select "Case Volume"
    fireEvent.click(screen.getByText('Case Volume'))

    // useTrendData should have been called with the new metric
    expect(mockUseTrendData).toHaveBeenCalledWith('caseVolume')
  })

  it('calls useTrendData with default utilization metric', () => {
    mockUseTrendData.mockReturnValue({ data: null, loading: true })
    render(<TrendChart />)
    expect(mockUseTrendData).toHaveBeenCalledWith('utilization')
  })
})
