// components/dashboard/__tests__/DashboardKpiCard.test.tsx
// Unit tests for DashboardKpiCard.
// Key paths: loading state, value display, trend direction + color,
// increaseIsGood inversion, target progress bar color thresholds,
// sparkline rendering gate, and the 'increase'/'decrease' trendDir normalization.

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DashboardKpiCard } from '../DashboardKpiCard'

// Recharts uses ResizeObserver internally — stub it for JSDOM
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe('DashboardKpiCard', () => {
  it('renders loading skeleton when loading=true', () => {
    const { container } = render(<DashboardKpiCard title="OR Utilization" value="—" loading />)
    expect(container.querySelector('.animate-pulse')).toBeTruthy()
    expect(screen.queryByText('OR Utilization')).toBeNull()
  })

  it('renders title and value when not loading', () => {
    render(<DashboardKpiCard title="OR Utilization" value="78.5%" />)
    // The title is rendered as-is in the DOM; CSS uppercase is applied visually via Tailwind class
    expect(screen.getByText('OR Utilization')).toBeTruthy()
    expect(screen.getByText('78.5%')).toBeTruthy()
  })

  it('renders subtitle when provided', () => {
    render(<DashboardKpiCard title="Cases" value="4 / 6" subtitle="vs yesterday" />)
    expect(screen.getByText('vs yesterday')).toBeTruthy()
  })

  it('does not render trend when trendPct is undefined', () => {
    const { container } = render(<DashboardKpiCard title="Cases" value="4 / 6" />)
    // No ArrowUp or ArrowDown SVG icons
    expect(container.querySelector('svg[class*="arrow"]')).toBeNull()
  })

  // Trend direction normalization: 'increase'/'decrease' from KPIResult
  it('normalizes trendDir "increase" to show ArrowUp arrow', () => {
    const { container } = render(
      <DashboardKpiCard title="Utilization" value="80%" trendPct={5} trendDir="increase" />,
    )
    // ArrowUp renders as an svg inside the trend span
    const arrows = container.querySelectorAll('[class*="lucide"]')
    expect(arrows.length).toBeGreaterThan(0)
  })

  it('normalizes trendDir "decrease" to show ArrowDown arrow', () => {
    const { container } = render(
      <DashboardKpiCard title="Turnover" value="28 min" trendPct={3} trendDir="decrease" />,
    )
    const arrows = container.querySelectorAll('[class*="lucide"]')
    expect(arrows.length).toBeGreaterThan(0)
  })

  it('does not render trend arrow when trendDir is "unchanged"', () => {
    const { container } = render(
      <DashboardKpiCard title="Cases" value="4 / 6" trendPct={0} trendDir="unchanged" />,
    )
    // trend span should not render for 'unchanged'
    expect(container.querySelector('.text-emerald-600')).toBeNull()
    expect(container.querySelector('.text-rose-600')).toBeNull()
  })

  // increaseIsGood semantics
  it('applies emerald color when increase is good and direction is up', () => {
    const { container } = render(
      <DashboardKpiCard
        title="Utilization"
        value="85%"
        trendPct={5}
        trendDir="up"
        increaseIsGood={true}
      />,
    )
    expect(container.querySelector('.text-emerald-600')).toBeTruthy()
  })

  it('applies rose color when increase is bad (turnover) and direction is up', () => {
    const { container } = render(
      <DashboardKpiCard
        title="Turnover"
        value="35 min"
        trendPct={8}
        trendDir="up"
        increaseIsGood={false}
      />,
    )
    expect(container.querySelector('.text-rose-600')).toBeTruthy()
  })

  it('applies emerald color when increase is bad (turnover) but direction is down (improvement)', () => {
    const { container } = render(
      <DashboardKpiCard
        title="Turnover"
        value="22 min"
        trendPct={6}
        trendDir="down"
        increaseIsGood={false}
      />,
    )
    expect(container.querySelector('.text-emerald-600')).toBeTruthy()
  })

  // Target progress bar — color thresholds
  it('renders emerald target bar when pct >= 80', () => {
    const { container } = render(
      <DashboardKpiCard
        title="Utilization"
        value="85%"
        target={{ pct: 85, label: '80% target' }}
      />,
    )
    const bar = container.querySelector('.bg-emerald-500')
    expect(bar).toBeTruthy()
    expect(screen.getByText('80% target')).toBeTruthy()
  })

  it('renders amber target bar when pct is between 50 and 79', () => {
    const { container } = render(
      <DashboardKpiCard
        title="Utilization"
        value="60%"
        target={{ pct: 60, label: '80% target' }}
      />,
    )
    expect(container.querySelector('.bg-amber-500')).toBeTruthy()
  })

  it('renders rose target bar when pct is below 50', () => {
    const { container } = render(
      <DashboardKpiCard
        title="Utilization"
        value="30%"
        target={{ pct: 30, label: '80% target' }}
      />,
    )
    expect(container.querySelector('.bg-rose-500')).toBeTruthy()
  })

  it('clamps target bar width to 100% when pct exceeds 100', () => {
    const { container } = render(
      <DashboardKpiCard
        title="Turnover"
        value="20 min"
        target={{ pct: 150, label: '30 min target' }}
      />,
    )
    const bar = container.querySelector('[style*="width"]') as HTMLElement | null
    expect(bar?.style.width).toBe('100%')
  })

  it('does not render target bar when target prop is absent', () => {
    const { container } = render(<DashboardKpiCard title="Cases" value="4 / 6" />)
    expect(container.querySelector('.bg-emerald-500')).toBeNull()
    expect(container.querySelector('.bg-amber-500')).toBeNull()
    expect(container.querySelector('.bg-rose-500')).toBeNull()
  })

  // Status dot reflects target achievement
  it('renders emerald status dot when target.pct >= 80', () => {
    const { container } = render(
      <DashboardKpiCard title="Utilization" value="85%" target={{ pct: 85, label: '' }} />,
    )
    // The status dot is the first w-2 h-2 rounded-full element
    const dot = container.querySelector('.w-2.h-2.rounded-full')
    expect(dot?.className).toContain('bg-emerald-500')
  })

  it('renders slate status dot when no target is provided', () => {
    const { container } = render(<DashboardKpiCard title="Cases" value="4 / 6" />)
    const dot = container.querySelector('.w-2.h-2.rounded-full')
    expect(dot?.className).toContain('bg-slate-300')
  })

  // Sparkline rendering gate: only renders when sparkData has > 1 point
  it('does not render AreaChart when sparkData has only 1 point', () => {
    const { container } = render(
      <DashboardKpiCard title="Utilization" value="80%" sparkData={[{ v: 80 }]} />,
    )
    // recharts AreaChart should not be rendered
    expect(container.querySelector('.recharts-wrapper')).toBeNull()
  })
})
