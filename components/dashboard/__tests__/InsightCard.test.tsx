// components/dashboard/__tests__/InsightCard.test.tsx
// Unit tests for the InsightCard expandable insight component.
// Covers: collapsed/expanded render, severity badge colors, PILLAR_MAP category-to-color mapping,
// toggle callback, and that all 7 InsightCategory values map without undefined/missing entries.

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InsightCard } from '../InsightCard'
import type { Insight } from '@/lib/insightsEngine'

// ============================================
// Helpers
// ============================================

function makeInsight(overrides: Partial<Insight> = {}): Insight {
  return {
    id: 'test-insight',
    category: 'first_case_delays',
    severity: 'warning',
    title: 'First case starts are late',
    body: 'Your FCOTS rate is 65%, below the 85% target. 5 of 16 first cases started late.',
    financialImpact: 'Estimated $12K annual impact.',
    drillThroughType: 'fcots',
    metadata: {},
    ...overrides,
  }
}

// ============================================
// Collapsed state
// ============================================

describe('InsightCard: collapsed state', () => {
  it('renders title, rank badge, and one-line summary when collapsed', () => {
    const insight = makeInsight()
    render(
      <InsightCard insight={insight} rank={1} expanded={false} onToggle={vi.fn()} />
    )

    expect(screen.getByText('First case starts are late')).toBeTruthy()
    // Rank badge shows the rank number
    expect(screen.getByText('1')).toBeTruthy()
    // Collapsed body is visible (line-clamp applied by CSS, but text is in DOM)
    expect(screen.getByText(insight.body)).toBeTruthy()
  })

  it('does NOT render financialImpact when collapsed', () => {
    const insight = makeInsight()
    render(
      <InsightCard insight={insight} rank={2} expanded={false} onToggle={vi.fn()} />
    )

    // Financial impact only shows in expanded state
    expect(screen.queryByText('Estimated $12K annual impact.')).toBeNull()
  })

  it('renders category pillar tag with correct label', () => {
    const insight = makeInsight({ category: 'turnover_efficiency' })
    render(
      <InsightCard insight={insight} rank={1} expanded={false} onToggle={vi.fn()} />
    )

    expect(screen.getByText('Turnover Efficiency')).toBeTruthy()
  })
})

// ============================================
// Expanded state
// ============================================

describe('InsightCard: expanded state', () => {
  it('renders full body and financialImpact when expanded', () => {
    const insight = makeInsight()
    render(
      <InsightCard insight={insight} rank={1} expanded={true} onToggle={vi.fn()} />
    )

    expect(screen.getByText(insight.body)).toBeTruthy()
    expect(screen.getByText('Estimated $12K annual impact.')).toBeTruthy()
  })

  it('does not render financialImpact when insight has none (expanded)', () => {
    const insight = makeInsight({ financialImpact: undefined })
    render(
      <InsightCard insight={insight} rank={1} expanded={true} onToggle={vi.fn()} />
    )

    // No financial impact text rendered
    expect(screen.queryByText(/impact/i)).toBeNull()
  })

  it('applies bg-slate-50 class to button when expanded', () => {
    const insight = makeInsight()
    const { container } = render(
      <InsightCard insight={insight} rank={1} expanded={true} onToggle={vi.fn()} />
    )

    const button = container.querySelector('button')
    expect(button?.className).toContain('bg-slate-50')
  })
})

// ============================================
// Toggle interaction
// ============================================

describe('InsightCard: toggle interaction', () => {
  it('calls onToggle when card is clicked', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    const insight = makeInsight()
    render(
      <InsightCard insight={insight} rank={1} expanded={false} onToggle={onToggle} />
    )

    await user.click(screen.getByRole('button'))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('rotates chevron when expanded=true', () => {
    const insight = makeInsight()
    const { container } = render(
      <InsightCard insight={insight} rank={1} expanded={true} onToggle={vi.fn()} />
    )

    // The ChevronDown SVG gets rotate-180 when expanded.
    // SVG className is an SVGAnimatedString, so use classList.contains instead.
    const allSvgs = container.querySelectorAll('svg')
    const chevron = allSvgs[allSvgs.length - 1]
    expect(chevron?.classList.contains('rotate-180')).toBe(true)
  })

  it('does NOT rotate chevron when expanded=false', () => {
    const insight = makeInsight()
    const { container } = render(
      <InsightCard insight={insight} rank={1} expanded={false} onToggle={vi.fn()} />
    )

    const allSvgs = container.querySelectorAll('svg')
    const chevron = allSvgs[allSvgs.length - 1]
    expect(chevron?.classList.contains('rotate-180')).toBe(false)
  })
})

// ============================================
// Severity badge colors (SEVERITY_COLORS)
// ============================================

describe('InsightCard: severity badge colors', () => {
  const severityColors: Array<{ severity: Insight['severity']; expectedClass: string }> = [
    { severity: 'critical', expectedClass: 'bg-red-500' },
    { severity: 'warning', expectedClass: 'bg-amber-500' },
    { severity: 'positive', expectedClass: 'bg-emerald-500' },
    { severity: 'info', expectedClass: 'bg-slate-400' },
  ]

  for (const { severity, expectedClass } of severityColors) {
    it(`applies ${expectedClass} for severity="${severity}"`, () => {
      const insight = makeInsight({ severity })
      const { container } = render(
        <InsightCard insight={insight} rank={1} expanded={false} onToggle={vi.fn()} />
      )

      // The rank badge span carries the severity class
      const badge = container.querySelector(`.${expectedClass}`)
      expect(badge).toBeTruthy()
    })
  }
})

// ============================================
// PILLAR_MAP: all 7 InsightCategory values render a tag
// This is the critical domain check — a missing category key causes undefined pillar
// and crashes the component (cannot read .color of undefined).
// ============================================

describe('InsightCard: PILLAR_MAP — all InsightCategory values are mapped', () => {
  const allCategories: Insight['category'][] = [
    'first_case_delays',
    'turnover_efficiency',
    'callback_optimization',
    'utilization_gap',
    'cancellation_trend',
    'non_operative_time',
    'scheduling_pattern',
  ]

  const expectedLabels: Record<Insight['category'], string> = {
    first_case_delays: 'Schedule Adherence',
    turnover_efficiency: 'Turnover Efficiency',
    callback_optimization: 'Callback Timing',
    utilization_gap: 'Utilization',
    cancellation_trend: 'Cancellations',
    non_operative_time: 'Non-Op Time',
    scheduling_pattern: 'Scheduling',
  }

  for (const category of allCategories) {
    it(`renders pillar tag for category="${category}" without crashing`, () => {
      const insight = makeInsight({ category })
      // Should not throw (undefined pillar crashes on .color/.label access)
      expect(() =>
        render(
          <InsightCard insight={insight} rank={1} expanded={false} onToggle={vi.fn()} />
        )
      ).not.toThrow()

      // The label must appear in the DOM
      expect(screen.getByText(expectedLabels[category])).toBeTruthy()
    })
  }
})

// ============================================
// Rank display
// ============================================

describe('InsightCard: rank badge', () => {
  it('displays the correct rank number', () => {
    const insight = makeInsight()
    render(
      <InsightCard insight={insight} rank={3} expanded={false} onToggle={vi.fn()} />
    )

    expect(screen.getByText('3')).toBeTruthy()
  })
})
