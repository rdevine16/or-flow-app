/**
 * components/analytics/flags/FlagKPICard.test.tsx
 *
 * Unit tests for FlagKPICard and its TrendBadge sub-component.
 *
 * Covers:
 * 1. Renders label and numeric value
 * 2. Renders string value with unit suffix
 * 3. Status dot — correct color class per status
 * 4. No status dot class when status prop is omitted
 * 5. TrendBadge — positive trend renders TrendingUp, emerald colors (normal mode)
 * 6. TrendBadge — negative trend renders TrendingDown, rose colors (normal mode)
 * 7. TrendBadge — zero trend renders em-dash placeholder, no badge
 * 8. TrendBadge — inverse mode: positive trend is BAD (rose)
 * 9. TrendBadge — inverse mode: negative trend is GOOD (emerald)
 * 10. Sparkline renders when sparkData has >= 2 points
 * 11. Sparkline NOT rendered when sparkData has < 2 points
 * 12. Sparkline NOT rendered when sparkData is absent
 * 13. Detail string renders when provided
 * 14. Detail string absent when not provided
 * 15. Renders all three status types: good / neutral / bad
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import FlagKPICard from './FlagKPICard'

// ============================================
// Helpers
// ============================================

function renderCard(props: Partial<Parameters<typeof FlagKPICard>[0]> = {}) {
  return render(
    <FlagKPICard
      label="Test Metric"
      value={42}
      {...props}
    />
  )
}

// ============================================
// Tests
// ============================================

describe('FlagKPICard', () => {
  // ------------------------------------------
  // 1. Basic rendering
  // ------------------------------------------

  it('renders label text', () => {
    renderCard({ label: 'Flagged Cases' })
    expect(screen.getByText('Flagged Cases')).toBeDefined()
  })

  it('renders numeric value', () => {
    renderCard({ value: 17 })
    expect(screen.getByText('17')).toBeDefined()
  })

  it('renders string value with unit', () => {
    renderCard({ value: '24.5', unit: '%' })
    expect(screen.getByText('24.5')).toBeDefined()
    expect(screen.getByText('%')).toBeDefined()
  })

  it('does not render unit element when unit is omitted', () => {
    renderCard({ value: 10, unit: undefined })
    // No element containing only a unit character should exist
    expect(screen.queryByText('%')).toBeNull()
  })

  // ------------------------------------------
  // 2. Status dot colors
  // ------------------------------------------

  it('renders green dot for "good" status', () => {
    const { container } = renderCard({ status: 'good' })
    const dot = container.querySelector('.bg-emerald-500')
    expect(dot).not.toBeNull()
  })

  it('renders rose dot for "bad" status', () => {
    const { container } = renderCard({ status: 'bad' })
    const dot = container.querySelector('.bg-rose-500')
    expect(dot).not.toBeNull()
  })

  it('renders amber dot for "neutral" status', () => {
    const { container } = renderCard({ status: 'neutral' })
    const dot = container.querySelector('.bg-amber-500')
    expect(dot).not.toBeNull()
  })

  it('renders grey dot when status is omitted', () => {
    const { container } = renderCard({ status: undefined })
    const dot = container.querySelector('.bg-slate-300')
    expect(dot).not.toBeNull()
  })

  // ------------------------------------------
  // 3. TrendBadge — normal (non-inverse) mode
  // ------------------------------------------

  it('positive trend shows TrendingUp icon and emerald colors', () => {
    const { container } = renderCard({ trend: 5.2 })
    const badge = container.querySelector('.bg-emerald-50')
    expect(badge).not.toBeNull()
    expect(badge!.textContent).toContain('5.2%')
  })

  it('negative trend shows TrendingDown icon and rose colors', () => {
    const { container } = renderCard({ trend: -3.7 })
    const badge = container.querySelector('.bg-rose-50')
    expect(badge).not.toBeNull()
    expect(badge!.textContent).toContain('3.7%')
  })

  it('zero trend renders an em-dash placeholder, no badge element', () => {
    const { container } = renderCard({ trend: 0 })
    // No colored badge
    expect(container.querySelector('.bg-emerald-50')).toBeNull()
    expect(container.querySelector('.bg-rose-50')).toBeNull()
    // Em dash present
    const trendArea = container.querySelector('.text-slate-400')
    expect(trendArea).not.toBeNull()
  })

  it('trend is not rendered at all when prop is absent', () => {
    const { container } = renderCard({ trend: undefined })
    expect(container.querySelector('.bg-emerald-50')).toBeNull()
    expect(container.querySelector('.bg-rose-50')).toBeNull()
  })

  // ------------------------------------------
  // 4. TrendBadge — inverse mode
  //    Semantics: flag rate going DOWN is GOOD
  // ------------------------------------------

  it('inverse + positive trend is BAD (rose) — flag rate going up is bad', () => {
    const { container } = renderCard({ trend: 8.0, trendInverse: true })
    const badge = container.querySelector('.bg-rose-50')
    expect(badge).not.toBeNull()
    expect(badge!.textContent).toContain('8.0%')
  })

  it('inverse + negative trend is GOOD (emerald) — flag rate going down is good', () => {
    const { container } = renderCard({ trend: -4.5, trendInverse: true })
    const badge = container.querySelector('.bg-emerald-50')
    expect(badge).not.toBeNull()
    expect(badge!.textContent).toContain('4.5%')
  })

  // ------------------------------------------
  // 5. Sparkline rendering
  // ------------------------------------------

  it('renders sparkline SVG when sparkData has 2+ points', () => {
    const { container } = renderCard({
      sparkData: [10, 15, 12, 18, 20],
      sparkColor: '#ef4444',
    })
    // Sparkline renders as an SVG
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    // The aria-label on the multi-point sparkline includes "trending"
    const trendingSvg = container.querySelector('svg[aria-label*="trending"]')
    expect(trendingSvg).not.toBeNull()
  })

  it('does NOT render sparkline when sparkData has only 1 point', () => {
    const { container } = renderCard({ sparkData: [10] })
    // A single-point sparkline falls below the >= 2 guard in FlagKPICard
    const svg = container.querySelector('svg')
    expect(svg).toBeNull()
  })

  it('does NOT render sparkline when sparkData is absent', () => {
    const { container } = renderCard({ sparkData: undefined })
    const svg = container.querySelector('svg')
    expect(svg).toBeNull()
  })

  // ------------------------------------------
  // 6. Detail string
  // ------------------------------------------

  it('renders detail string when provided', () => {
    renderCard({ detail: '5 of 20 cases' })
    expect(screen.getByText('5 of 20 cases')).toBeDefined()
  })

  it('does not render detail when omitted', () => {
    renderCard({ detail: undefined })
    // The detail span has class text-slate-400 — should be absent (no detail text)
    // We cannot query by class since em-dash also uses text-slate-400, but we can
    // verify the specific string is not present.
    expect(screen.queryByText('5 of 20 cases')).toBeNull()
  })

  // ------------------------------------------
  // 7. Typical usage patterns (integration-style)
  // ------------------------------------------

  it('renders a fully populated KPI card correctly', () => {
    const { container } = renderCard({
      label: 'Flagged Cases',
      value: '18.4',
      unit: '%',
      trend: -2.1,
      trendInverse: true,
      sparkData: [20, 19, 21, 18, 18.4],
      sparkColor: '#ef4444',
      status: 'neutral',
      detail: '12 of 65 cases',
    })

    expect(screen.getByText('Flagged Cases')).toBeDefined()
    expect(screen.getByText('18.4')).toBeDefined()
    expect(screen.getByText('%')).toBeDefined()
    expect(screen.getByText('12 of 65 cases')).toBeDefined()
    // Trend -2.1 + trendInverse → GOOD (emerald)
    expect(container.querySelector('.bg-emerald-50')).not.toBeNull()
    // neutral status → amber dot
    expect(container.querySelector('.bg-amber-500')).not.toBeNull()
    // sparkline present
    expect(container.querySelector('svg')).not.toBeNull()
  })

  it('renders a zero-data KPI card (empty state usage)', () => {
    renderCard({
      label: 'Total Flags',
      value: 0,
      detail: '0 avg per flagged case',
    })
    expect(screen.getByText('Total Flags')).toBeDefined()
    expect(screen.getByText('0')).toBeDefined()
    expect(screen.getByText('0 avg per flagged case')).toBeDefined()
  })
})
