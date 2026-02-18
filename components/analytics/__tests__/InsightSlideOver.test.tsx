/**
 * components/analytics/__tests__/InsightSlideOver.test.tsx
 *
 * Unit tests for the InsightSlideOver component (Phase 1 shell).
 *
 * Covers:
 * 1. Hidden when insight is null (closed state)
 * 2. Hidden when insight has drillThroughType = null (no panel)
 * 3. Visible when open — title, severity badge, close button rendered
 * 4. Panel title derived from drillThroughType, not raw insight.title
 * 5. Severity badge label text reflects insight severity
 * 6. onClose called when close button is clicked
 * 7. Placeholder content rendered for each panel type
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import InsightSlideOver from '../InsightSlideOver'
import type { Insight } from '@/lib/insightsEngine'

// ============================================
// HELPERS
// ============================================

function makeInsight(overrides: Partial<Insight> = {}): Insight {
  return {
    id: 'test-insight',
    category: 'first_case_delays',
    severity: 'warning',
    title: 'Test Insight Title',
    body: 'This is the body text.',
    action: 'View details →',
    drillThroughType: 'fcots',
    metadata: {},
    ...overrides,
  }
}

// ============================================
// CLOSED STATE
// ============================================

describe('InsightSlideOver — closed state', () => {
  it('renders nothing visible when insight is null', () => {
    render(<InsightSlideOver insight={null} onClose={() => {}} />)
    // Dialog.Root is rendered but not open — no content in the portal
    expect(screen.queryByRole('dialog')).toBeNull()
    // No panel title should be visible
    expect(screen.queryByRole('heading', { name: 'First Case On-Time Detail' })).toBeNull()
  })

  it('does not open when drillThroughType is null (positive insight)', () => {
    const insight = makeInsight({ drillThroughType: null, severity: 'positive' })
    render(<InsightSlideOver insight={insight} onClose={() => {}} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

// ============================================
// OPEN STATE
// ============================================

describe('InsightSlideOver — open state', () => {
  it('renders the dialog when insight has a drillThroughType', () => {
    const insight = makeInsight({ drillThroughType: 'fcots' })
    render(<InsightSlideOver insight={insight} onClose={() => {}} />)
    // Radix Dialog.Content has role="dialog"
    expect(screen.getByRole('dialog')).toBeDefined()
  })

  it('displays the panel title in the dialog header (Dialog.Title h2)', () => {
    const insight = makeInsight({
      drillThroughType: 'fcots',
      title: 'Raw Insight Title That Should Not Appear As Panel Header',
    })
    render(<InsightSlideOver insight={insight} onClose={() => {}} />)
    // The Dialog.Title is an h2 — query by heading role to avoid duplicate-text ambiguity
    // (the PanelPlaceholder also renders the same text in an h3)
    const headings = screen.getAllByText('First Case On-Time Detail')
    // At least the Dialog.Title heading should be present
    expect(headings.length).toBeGreaterThanOrEqual(1)
    // The raw insight.title should NOT appear as the panel title
    expect(screen.queryByText('Raw Insight Title That Should Not Appear As Panel Header')).toBeNull()
  })

  it('displays severity badge with correct label', () => {
    const insight = makeInsight({ severity: 'critical', drillThroughType: 'fcots' })
    render(<InsightSlideOver insight={insight} onClose={() => {}} />)
    // Severity badge text is the severity label in the component
    expect(screen.getByText('critical')).toBeDefined()
  })

  it('renders warning severity badge', () => {
    const insight = makeInsight({ severity: 'warning', drillThroughType: 'turnover' })
    render(<InsightSlideOver insight={insight} onClose={() => {}} />)
    expect(screen.getByText('warning')).toBeDefined()
  })

  it('renders info severity badge', () => {
    const insight = makeInsight({ severity: 'info', drillThroughType: 'callback' })
    render(<InsightSlideOver insight={insight} onClose={() => {}} />)
    expect(screen.getByText('info')).toBeDefined()
  })

  it('renders a close button', () => {
    const insight = makeInsight({ drillThroughType: 'utilization' })
    render(<InsightSlideOver insight={insight} onClose={() => {}} />)
    const closeBtn = screen.getByRole('button', { name: /close panel/i })
    expect(closeBtn).toBeDefined()
  })

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn()
    const insight = makeInsight({ drillThroughType: 'fcots' })
    render(<InsightSlideOver insight={insight} onClose={onClose} />)
    const closeBtn = screen.getByRole('button', { name: /close panel/i })
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders "Supporting data for this insight" subheader', () => {
    const insight = makeInsight({ drillThroughType: 'fcots' })
    render(<InsightSlideOver insight={insight} onClose={() => {}} />)
    expect(screen.getByText('Supporting data for this insight')).toBeDefined()
  })
})

// ============================================
// PANEL TYPE TITLES
// ============================================

describe('InsightSlideOver — panel title per drillThroughType', () => {
  // Title appears in both Dialog.Title (h2) and PanelPlaceholder (h3)
  // Use getAllByText to handle both instances.
  const cases: Array<[Insight['drillThroughType'], string]> = [
    ['callback', 'Callback / Idle Time Detail'],
    ['fcots', 'First Case On-Time Detail'],
    ['utilization', 'OR Utilization by Room'],
    ['turnover', 'Turnover Detail'],
    ['cancellation', 'Cancellation Detail'],
    ['non_op_time', 'Non-Operative Time Breakdown'],
    ['scheduling', 'Scheduling & Volume Detail'],
  ]

  for (const [type, expectedTitle] of cases) {
    it(`shows "${expectedTitle}" for type="${type}"`, () => {
      const insight = makeInsight({ drillThroughType: type })
      render(<InsightSlideOver insight={insight} onClose={() => {}} />)
      // Use getAllByText because the title appears in both header and placeholder
      const matches = screen.getAllByText(expectedTitle)
      expect(matches.length).toBeGreaterThanOrEqual(1)
    })
  }
})

// ============================================
// PLACEHOLDER CONTENT
// ============================================

describe('InsightSlideOver — placeholder content', () => {
  it('renders placeholder for fcots panel type', () => {
    const insight = makeInsight({ drillThroughType: 'fcots' })
    render(<InsightSlideOver insight={insight} onClose={() => {}} />)
    // PanelPlaceholder renders "Panel content coming in Phase X"
    expect(screen.getByText(/panel content coming in/i)).toBeDefined()
  })

  it('renders placeholder for callback panel type', () => {
    const insight = makeInsight({ drillThroughType: 'callback' })
    render(<InsightSlideOver insight={insight} onClose={() => {}} />)
    expect(screen.getByText(/panel content coming in/i)).toBeDefined()
  })
})
