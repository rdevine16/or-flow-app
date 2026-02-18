import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import Sparkline, { dailyDataToSparkline } from '../Sparkline'
import type { DailyTrackerData } from '@/lib/analyticsV2'

describe('Sparkline — rendering', () => {
  it('renders empty SVG for empty data array', () => {
    const { container } = render(<Sparkline data={[]} />)
    const svg = container.querySelector('svg')
    expect(svg).toBeDefined()
    expect(svg?.getAttribute('aria-label')).toBe('No data')
    // Should have no path or circle children
    expect(container.querySelector('path')).toBeNull()
    expect(container.querySelector('circle')).toBeNull()
  })

  it('renders empty SVG for undefined-like data', () => {
    const { container } = render(<Sparkline data={[]} />)
    const svg = container.querySelector('svg')
    expect(svg).toBeDefined()
    expect(svg?.getAttribute('aria-label')).toBe('No data')
  })

  it('renders single data point as centered dot without NaN', () => {
    const { container } = render(<Sparkline data={[42]} width={120} height={32} />)
    const svg = container.querySelector('svg')
    expect(svg).toBeDefined()
    expect(svg?.getAttribute('aria-label')).toBe('Sparkline with 1 data point')

    const circle = container.querySelector('circle')
    expect(circle).toBeDefined()
    expect(circle?.getAttribute('cx')).toBe('60') // width / 2
    expect(circle?.getAttribute('cy')).toBe('16') // height / 2

    // No path elements for a single point
    expect(container.querySelector('path')).toBeNull()

    // No NaN anywhere in the SVG
    expect(container.innerHTML).not.toContain('NaN')
  })

  it('renders line and endpoint dot for multiple data points', () => {
    const { container } = render(<Sparkline data={[10, 20, 30, 25, 35]} />)
    const paths = container.querySelectorAll('path')
    expect(paths.length).toBe(2) // area + line

    const circle = container.querySelector('circle')
    expect(circle).toBeDefined()
    expect(circle?.getAttribute('fill')).toBe('#fff')
  })

  it('renders without area fill when showArea is false', () => {
    const { container } = render(<Sparkline data={[10, 20, 30]} showArea={false} />)
    const paths = container.querySelectorAll('path')
    expect(paths.length).toBe(1) // line only, no area
  })

  it('handles all-zero data without NaN', () => {
    const { container } = render(<Sparkline data={[0, 0, 0, 0]} />)
    expect(container.innerHTML).not.toContain('NaN')

    const paths = container.querySelectorAll('path')
    expect(paths.length).toBe(2) // area + line (flat)
  })

  it('handles all-same values without NaN', () => {
    const { container } = render(<Sparkline data={[50, 50, 50]} />)
    expect(container.innerHTML).not.toContain('NaN')

    const paths = container.querySelectorAll('path')
    expect(paths.length).toBe(2)
  })
})

describe('Sparkline — dimensions', () => {
  it('SVG dimensions match width and height props', () => {
    const { container } = render(<Sparkline data={[1, 2, 3]} width={200} height={48} />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('width')).toBe('200')
    expect(svg?.getAttribute('height')).toBe('48')
  })

  it('uses default dimensions when not specified', () => {
    const { container } = render(<Sparkline data={[1, 2, 3]} />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('width')).toBe('120')
    expect(svg?.getAttribute('height')).toBe('32')
  })
})

describe('Sparkline — color and styling', () => {
  it('uses custom color for stroke and endpoint', () => {
    const { container } = render(<Sparkline data={[10, 20]} color="#ef4444" />)
    const line = container.querySelectorAll('path')[1] // second path is line
    expect(line?.getAttribute('stroke')).toBe('#ef4444')

    const circle = container.querySelector('circle')
    expect(circle?.getAttribute('stroke')).toBe('#ef4444')
  })

  it('applies custom className to SVG', () => {
    const { container } = render(<Sparkline data={[1, 2, 3]} className="w-full" />)
    const svg = container.querySelector('svg')
    expect(svg?.className.baseVal).toContain('w-full')
  })

  it('applies custom strokeWidth', () => {
    const { container } = render(<Sparkline data={[10, 20]} strokeWidth={3} />)
    const line = container.querySelectorAll('path')[1]
    expect(line?.getAttribute('stroke-width')).toBe('3')
  })
})

describe('Sparkline — accessibility', () => {
  it('has role="img" on the SVG', () => {
    const { container } = render(<Sparkline data={[1, 2, 3]} />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('role')).toBe('img')
  })

  it('includes trend direction in aria-label', () => {
    const { container } = render(<Sparkline data={[10, 30]} />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('aria-label')).toBe('Sparkline trending from 10 to 30')
  })
})

describe('dailyDataToSparkline', () => {
  it('returns empty array for undefined input', () => {
    expect(dailyDataToSparkline(undefined)).toEqual([])
  })

  it('returns empty array for empty array input', () => {
    expect(dailyDataToSparkline([])).toEqual([])
  })

  it('extracts numericValue from DailyTrackerData', () => {
    const data: DailyTrackerData[] = [
      { date: '2024-01-01', color: 'green', tooltip: 'Day 1', numericValue: 85 },
      { date: '2024-01-02', color: 'yellow', tooltip: 'Day 2', numericValue: 72 },
      { date: '2024-01-03', color: 'red', tooltip: 'Day 3', numericValue: 60 },
    ]
    expect(dailyDataToSparkline(data)).toEqual([85, 72, 60])
  })

  it('preserves order of values', () => {
    const data: DailyTrackerData[] = [
      { date: '2024-01-01', color: 'green', tooltip: '', numericValue: 1 },
      { date: '2024-01-02', color: 'green', tooltip: '', numericValue: 5 },
      { date: '2024-01-03', color: 'green', tooltip: '', numericValue: 3 },
    ]
    expect(dailyDataToSparkline(data)).toEqual([1, 5, 3])
  })
})
