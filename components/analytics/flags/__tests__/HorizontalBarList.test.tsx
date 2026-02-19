/**
 * components/analytics/flags/__tests__/HorizontalBarList.test.tsx
 *
 * Unit tests for HorizontalBarList — reusable horizontal bar breakdown component.
 *
 * Covers:
 * 1. Renders items with name, count, and percentage
 * 2. Handles empty array — renders nothing (no bar rows)
 * 3. Severity dots — critical/warning/info show the correct dot element
 * 4. Color dots — when severity is absent but color is provided
 * 5. avgDuration display — renders "~Xm" when provided, hides when null/absent
 * 6. Bar width calculation uses the max count by default
 * 7. maxCount override controls bar widths
 * 8. Multiple items are all rendered
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import HorizontalBarList from '../HorizontalBarList'

// ============================================
// Fixtures
// ============================================

const SINGLE_ITEM = [
  { name: 'Late Patient', count: 12, pct: 40 },
]

const MULTI_ITEMS = [
  { name: 'Late Patient', count: 12, pct: 40 },
  { name: 'Equipment Delay', count: 8, pct: 26.7 },
  { name: 'Consent Issue', count: 5, pct: 16.7 },
]

const SEVERITY_ITEMS = [
  { name: 'Threshold exceeded', count: 7, pct: 30, severity: 'critical' as const },
  { name: 'Slow turnover', count: 5, pct: 22, severity: 'warning' as const },
  { name: 'Minor delay', count: 3, pct: 13, severity: 'info' as const },
]

const COLOR_ITEM = [
  { name: 'OR 1', count: 9, pct: 35, color: '#6366f1' },
]

const AVG_DURATION_ITEM = [
  { name: 'Equipment Delay', count: 8, pct: 30, avgDuration: 22 },
]

const NO_AVG_DURATION_ITEM = [
  { name: 'Late Patient', count: 5, pct: 20, avgDuration: null },
]

// ============================================
// Tests
// ============================================

describe('HorizontalBarList', () => {
  // ------------------------------------------
  // 1. Renders items with name, count, and pct
  // ------------------------------------------

  it('renders the item name', () => {
    render(<HorizontalBarList items={SINGLE_ITEM} />)
    expect(screen.getByText('Late Patient')).toBeDefined()
  })

  it('renders the item count', () => {
    render(<HorizontalBarList items={SINGLE_ITEM} />)
    expect(screen.getByText('12')).toBeDefined()
  })

  it('renders the item percentage as integer string', () => {
    render(<HorizontalBarList items={SINGLE_ITEM} />)
    expect(screen.getByText('40%')).toBeDefined()
  })

  it('renders all items when given a multi-item array', () => {
    render(<HorizontalBarList items={MULTI_ITEMS} />)
    expect(screen.getByText('Late Patient')).toBeDefined()
    expect(screen.getByText('Equipment Delay')).toBeDefined()
    expect(screen.getByText('Consent Issue')).toBeDefined()
  })

  it('renders the correct count for each item', () => {
    render(<HorizontalBarList items={MULTI_ITEMS} />)
    expect(screen.getByText('12')).toBeDefined()
    expect(screen.getByText('8')).toBeDefined()
    expect(screen.getByText('5')).toBeDefined()
  })

  // ------------------------------------------
  // 2. Empty array — renders no bar rows
  // ------------------------------------------

  it('renders an empty container when items array is empty', () => {
    const { container } = render(<HorizontalBarList items={[]} />)
    // The outer flex div still renders, but there are no child items
    const children = container.querySelector('.flex.flex-col')
    expect(children?.children.length).toBe(0)
  })

  // ------------------------------------------
  // 3. Severity dots
  // ------------------------------------------

  it('renders severity dots for items with severity set', () => {
    const { container } = render(<HorizontalBarList items={SEVERITY_ITEMS} />)
    // Each severity item renders a span dot (w-1.5 h-1.5 rounded-full)
    const dots = container.querySelectorAll('span.w-1\\.5.h-1\\.5.rounded-full')
    expect(dots.length).toBe(3)
  })

  it('critical severity dot has bg-red-500 class', () => {
    const { container } = render(
      <HorizontalBarList items={[SEVERITY_ITEMS[0]]} />
    )
    const dot = container.querySelector('span.bg-red-500')
    expect(dot).not.toBeNull()
  })

  it('warning severity dot has bg-amber-500 class', () => {
    const { container } = render(
      <HorizontalBarList items={[SEVERITY_ITEMS[1]]} />
    )
    const dot = container.querySelector('span.bg-amber-500')
    expect(dot).not.toBeNull()
  })

  it('info severity dot has bg-blue-500 class', () => {
    const { container } = render(
      <HorizontalBarList items={[SEVERITY_ITEMS[2]]} />
    )
    const dot = container.querySelector('span.bg-blue-500')
    expect(dot).not.toBeNull()
  })

  // ------------------------------------------
  // 4. Color dots (no severity)
  // ------------------------------------------

  it('renders a color dot with inline style when color is provided and severity is absent', () => {
    const { container } = render(<HorizontalBarList items={COLOR_ITEM} />)
    // Color dot uses inline backgroundColor, not a utility class
    const dot = container.querySelector('span.w-1\\.5.h-1\\.5.rounded-full[style]')
    expect(dot).not.toBeNull()
    expect((dot as HTMLElement).style.backgroundColor).toBe('rgb(99, 102, 241)')
  })

  it('does not render a severity dot when only color is provided', () => {
    const { container } = render(<HorizontalBarList items={COLOR_ITEM} />)
    // Should not have bg-red-500, bg-amber-500, or bg-blue-500 utility dots
    expect(container.querySelector('span.bg-red-500')).toBeNull()
    expect(container.querySelector('span.bg-amber-500')).toBeNull()
    expect(container.querySelector('span.bg-blue-500')).toBeNull()
  })

  // ------------------------------------------
  // 5. avgDuration display
  // ------------------------------------------

  it('renders "~Xm" when avgDuration is provided', () => {
    render(<HorizontalBarList items={AVG_DURATION_ITEM} />)
    expect(screen.getByText('~22m')).toBeDefined()
  })

  it('does not render avgDuration text when avgDuration is null', () => {
    render(<HorizontalBarList items={NO_AVG_DURATION_ITEM} />)
    expect(screen.queryByText(/~\d+m/)).toBeNull()
  })

  it('does not render avgDuration text when avgDuration is not provided', () => {
    render(<HorizontalBarList items={SINGLE_ITEM} />)
    expect(screen.queryByText(/~\d+m/)).toBeNull()
  })

  // ------------------------------------------
  // 6. Bar width calculation uses max count
  // ------------------------------------------

  it('sets the widest bar to 100% width when no maxCount override', () => {
    const { container } = render(<HorizontalBarList items={MULTI_ITEMS} />)
    // The first item (count=12) is the max — its bar should be 100%
    const bars = container.querySelectorAll('.h-full.rounded-full')
    // First bar = 12/12 = 100%
    expect((bars[0] as HTMLElement).style.width).toBe('100%')
  })

  it('scales non-max bars relative to max count', () => {
    const { container } = render(<HorizontalBarList items={MULTI_ITEMS} />)
    const bars = container.querySelectorAll('.h-full.rounded-full')
    // Second bar = 8/12 = 66.666...%
    const expectedPct = (8 / 12) * 100
    const actualWidth = parseFloat((bars[1] as HTMLElement).style.width)
    expect(actualWidth).toBeCloseTo(expectedPct, 1)
  })

  // ------------------------------------------
  // 7. maxCount override
  // ------------------------------------------

  it('uses maxCount override for bar width calculation', () => {
    const { container } = render(
      <HorizontalBarList items={SINGLE_ITEM} maxCount={24} />
    )
    const bar = container.querySelector('.h-full.rounded-full') as HTMLElement
    // 12/24 = 50%
    expect(parseFloat(bar.style.width)).toBeCloseTo(50, 1)
  })

  // ------------------------------------------
  // 8. Percentage formatting
  // ------------------------------------------

  it('renders percentage with toFixed(0) formatting', () => {
    const item = [{ name: 'Test', count: 3, pct: 33.333 }]
    render(<HorizontalBarList items={item} />)
    // toFixed(0) on 33.333 = "33"
    expect(screen.getByText('33%')).toBeDefined()
  })

  it('renders percentage that rounds up with toFixed(0)', () => {
    const item = [{ name: 'Test', count: 5, pct: 66.667 }]
    render(<HorizontalBarList items={item} />)
    // toFixed(0) on 66.667 = "67"
    expect(screen.getByText('67%')).toBeDefined()
  })
})
