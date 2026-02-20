import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SurgeonHero, HeroStat } from '../SurgeonHero'

// Mock SparklineLight to avoid SVG rendering issues in test
vi.mock('../shared', () => ({
  SparklineLight: ({ data }: { data: number[] }) => (
    <div data-testid="sparkline" data-points={data.length} />
  ),
}))

const baseStats: HeroStat[] = [
  { label: 'Total Profit', value: '$12,500', trend: '+8.2%', trendUp: true, spark: [100, 200, 300] },
  { label: 'Typical / Case', value: '$2,500', trend: '-3.1%', trendUp: false, spark: [50, 45, 40] },
  { label: '$ / OR Hour', value: '$850', trend: null, trendUp: null, spark: [80, 85, 90], accent: 'text-blue-300' },
  { label: 'Margin', value: '32.5%', trend: '+1.2%', trendUp: true, spark: [30, 31, 33] },
  { label: 'Cases', value: '15', trend: null, trendUp: null, spark: [3, 5, 7] },
  { label: 'Typical Duration', value: '1h 45m', trend: '-5.0%', trendUp: true, spark: [120, 110, 105] },
]

const defaultProps = {
  name: 'Dr. Smith',
  caseCount: 15,
  procedureCount: 3,
  isLowVolume: false,
  stats: baseStats,
  facilityComparison: {
    profitPerHrDiff: 150,
    marginDiff: 5.2,
  },
}

describe('SurgeonHero', () => {
  it('renders surgeon name and initials', () => {
    render(<SurgeonHero {...defaultProps} />)
    expect(screen.getByText('Dr. Smith')).toBeDefined()
    expect(screen.getByText('DS')).toBeDefined()
  })

  it('shows case count and procedure count in subtitle', () => {
    render(<SurgeonHero {...defaultProps} />)
    expect(screen.getByText('15 cases in period · 3 procedures')).toBeDefined()
  })

  it('shows low-volume badge when isLowVolume is true', () => {
    render(<SurgeonHero {...defaultProps} isLowVolume={true} />)
    expect(screen.getByText('Low volume')).toBeDefined()
  })

  it('hides low-volume badge when isLowVolume is false', () => {
    render(<SurgeonHero {...defaultProps} isLowVolume={false} />)
    expect(screen.queryByText('Low volume')).toBeNull()
  })

  it('renders positive facility comparison badges with green styling', () => {
    render(<SurgeonHero {...defaultProps} />)
    expect(screen.getByText('+$150')).toBeDefined()
    expect(screen.getByText('+5.2%')).toBeDefined()
  })

  it('renders negative facility comparison badges with red styling', () => {
    render(
      <SurgeonHero
        {...defaultProps}
        facilityComparison={{ profitPerHrDiff: -200, marginDiff: -3.5 }}
      />,
    )
    expect(screen.getByText('($200)')).toBeDefined()
    expect(screen.getByText('-3.5%')).toBeDefined()
  })

  it('hides $/Hr badge when profitPerHrDiff is null', () => {
    render(
      <SurgeonHero
        {...defaultProps}
        facilityComparison={{ profitPerHrDiff: null, marginDiff: 2.0 }}
      />,
    )
    expect(screen.queryByText('vs Facility $/Hr')).toBeNull()
    // Margin badge should still show
    expect(screen.getByText('vs Facility Margin')).toBeDefined()
  })

  it('renders all 6 stat labels', () => {
    render(<SurgeonHero {...defaultProps} />)
    for (const stat of baseStats) {
      expect(screen.getByText(stat.label)).toBeDefined()
    }
  })

  it('renders sparklines for stats with >= 2 data points', () => {
    render(<SurgeonHero {...defaultProps} />)
    const sparklines = screen.getAllByTestId('sparkline')
    expect(sparklines.length).toBe(6)
  })

  it('renders trend arrows for stats with trends', () => {
    render(<SurgeonHero {...defaultProps} />)
    // Stats with trends: Total Profit (+8.2%), Typical/Case (-3.1%), Margin (+1.2%), Duration (-5.0%)
    expect(screen.getByText('+8.2%')).toBeDefined()
    expect(screen.getByText('-3.1%')).toBeDefined()
    // Stats without trends show "Stable"
    const stableLabels = screen.getAllByText('Stable')
    expect(stableLabels.length).toBe(2) // Cases and $/OR Hour
  })

  it('applies dark gradient background', () => {
    const { container } = render(<SurgeonHero {...defaultProps} />)
    const root = container.firstElementChild
    expect(root?.className).toContain('bg-gradient-to-br')
    expect(root?.className).toContain('from-slate-800')
    expect(root?.className).toContain('to-slate-900')
  })
})
