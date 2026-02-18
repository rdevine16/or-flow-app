/**
 * components/analytics/__tests__/CasePhaseBar.test.tsx
 *
 * Unit + integration tests for CasePhaseBar and PhaseLegend components.
 *
 * Covers:
 * 1. Basic rendering — correct number of phase segments
 * 2. Subphase insets — 60% height inset bands within parent segments
 * 3. Missing data — hatched pattern indicator with correct tooltip
 * 4. Narrow phases — segments below 1% width are skipped
 * 5. Label visibility — values shown only when segment is wide enough
 * 6. Subphases with 0 parent value — no insets rendered
 * 7. Multiple subphases within a single parent
 * 8. PhaseLegend — basic rendering with parent items
 * 9. PhaseLegend — subphase items render with nesting indicators
 * 10. Integration — realistic phase_definitions data through CasePhaseBar
 * 11. Workflow — CasePhaseBar click handler fires with correct caseId
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import {
  CasePhaseBar,
  PhaseLegend,
  type CasePhaseBarPhase,
  type PhaseLegendItem,
} from '../AnalyticsComponents'

// ============================================
// TEST DATA
// ============================================

function makePhases(overrides?: Partial<CasePhaseBarPhase>[]): CasePhaseBarPhase[] {
  const defaults: CasePhaseBarPhase[] = [
    { label: 'Pre-Op', value: 600, color: '#3B82F6' },
    { label: 'Surgical', value: 1800, color: '#22C55E' },
    { label: 'Closing', value: 300, color: '#F59E0B' },
    { label: 'Post-Op', value: 300, color: '#8B5CF6' },
  ]
  if (!overrides) return defaults
  return defaults.map((d, i) => ({ ...d, ...(overrides[i] || {}) }))
}

const BASE_PROPS = {
  caseNumber: 'CASE-001',
  procedureName: 'Knee Replacement',
  totalValue: 3000,
  maxValue: 4000,
  caseId: 'case-uuid-1',
}

// ============================================
// CasePhaseBar TESTS
// ============================================

describe('CasePhaseBar', () => {
  it('renders correct number of phase segments', () => {
    const phases = makePhases()
    const { container } = render(
      <CasePhaseBar {...BASE_PROPS} phases={phases} />
    )
    // 4 phases, all > 1% width → 4 segments
    const segments = container.querySelectorAll('.group\\/phase')
    expect(segments).toHaveLength(4)
  })

  it('renders case number and procedure name', () => {
    render(<CasePhaseBar {...BASE_PROPS} phases={makePhases()} />)
    expect(screen.getByText('CASE-001')).toBeDefined()
    expect(screen.getByText('Knee Replacement')).toBeDefined()
  })

  it('renders formatted total value', () => {
    render(<CasePhaseBar {...BASE_PROPS} phases={makePhases()} />)
    // 3000 seconds = 50:00
    expect(screen.getByText('50:00')).toBeDefined()
  })

  it('skips phases with less than 1% width', () => {
    const phases: CasePhaseBarPhase[] = [
      { label: 'Big', value: 2990, color: '#3B82F6' },
      { label: 'Tiny', value: 10, color: '#22C55E' }, // 10/3000 = 0.33%
    ]
    const { container } = render(
      <CasePhaseBar {...BASE_PROPS} phases={phases} />
    )
    const segments = container.querySelectorAll('.group\\/phase')
    expect(segments).toHaveLength(1)
  })

  it('renders missing phase with hatched pattern and correct tooltip', () => {
    const phases: CasePhaseBarPhase[] = [
      { label: 'Pre-Op', value: 600, color: '#3B82F6' },
      { label: 'Missing Phase', value: 0, color: '#64748B', isMissing: true },
      { label: 'Post-Op', value: 300, color: '#8B5CF6' },
    ]
    const { container } = render(
      <CasePhaseBar {...BASE_PROPS} totalValue={900} phases={phases} />
    )
    // The missing segment should have the hatched background
    const segments = container.querySelectorAll('.group\\/phase')
    // 3 segments: Pre-Op (>1%), Missing (forced visible), Post-Op (>1%)
    expect(segments).toHaveLength(3)

    const missingSegment = segments[1] as HTMLElement
    expect(missingSegment.style.backgroundImage).toContain('repeating-linear-gradient')
    expect(missingSegment.getAttribute('title')).toBe('Missing Phase: missing milestone data')
  })

  it('renders missing phase even when value is 0 (below 1% threshold)', () => {
    const phases: CasePhaseBarPhase[] = [
      { label: 'Normal', value: 1000, color: '#3B82F6' },
      { label: 'Missing', value: 0, color: '#64748B', isMissing: true },
    ]
    const { container } = render(
      <CasePhaseBar {...BASE_PROPS} totalValue={1000} phases={phases} />
    )
    const segments = container.querySelectorAll('.group\\/phase')
    expect(segments).toHaveLength(2)
  })

  it('renders subphase inset bands within parent segment', () => {
    const phases: CasePhaseBarPhase[] = [
      {
        label: 'Pre-Op',
        value: 600,
        color: '#3B82F6',
        subphases: [
          { label: 'Anesthesia', value: 200, color: '#93C5FD' },
        ],
      },
      { label: 'Surgical', value: 1800, color: '#22C55E' },
    ]
    const { container } = render(
      <CasePhaseBar {...BASE_PROPS} totalValue={2400} phases={phases} />
    )

    // The inset container should exist (top-[20%] h-[60%])
    const insetContainer = container.querySelector('.top-\\[20\\%\\]')
    expect(insetContainer).not.toBeNull()

    // The subphase band should be inside it
    const subBands = insetContainer!.querySelectorAll('.rounded-sm')
    expect(subBands).toHaveLength(1)

    const band = subBands[0] as HTMLElement
    expect(band.getAttribute('title')).toBe('Anesthesia: 3:20')
    // jsdom converts hex to rgb
    expect(band.style.backgroundColor).toBe('rgb(147, 197, 253)')
    // subphase width = 200/600 ≈ 33.33%
    expect(parseFloat(band.style.width)).toBeCloseTo(33.33, 1)
  })

  it('renders multiple subphases within one parent', () => {
    const phases: CasePhaseBarPhase[] = [
      {
        label: 'Pre-Op',
        value: 600,
        color: '#3B82F6',
        subphases: [
          { label: 'Anesthesia', value: 200, color: '#93C5FD' },
          { label: 'Positioning', value: 150, color: '#BFDBFE' },
        ],
      },
    ]
    const { container } = render(
      <CasePhaseBar {...BASE_PROPS} totalValue={600} phases={phases} />
    )

    const insetContainer = container.querySelector('.top-\\[20\\%\\]')
    expect(insetContainer).not.toBeNull()

    const subBands = insetContainer!.querySelectorAll('.rounded-sm')
    expect(subBands).toHaveLength(2)
  })

  it('does not render subphase insets when parent value is 0', () => {
    const phases: CasePhaseBarPhase[] = [
      {
        label: 'Empty Parent',
        value: 0,
        color: '#3B82F6',
        isMissing: true,
        subphases: [
          { label: 'Sub', value: 100, color: '#93C5FD' },
        ],
      },
    ]
    const { container } = render(
      <CasePhaseBar {...BASE_PROPS} totalValue={100} phases={phases} />
    )

    // Missing segment should exist but no inset container
    const insetContainer = container.querySelector('.top-\\[20\\%\\]')
    expect(insetContainer).toBeNull()
  })

  it('skips subphases with less than 1% width within parent', () => {
    const phases: CasePhaseBarPhase[] = [
      {
        label: 'Pre-Op',
        value: 10000,
        color: '#3B82F6',
        subphases: [
          { label: 'Tiny', value: 5, color: '#93C5FD' }, // 0.05% of parent
          { label: 'Big', value: 3000, color: '#BFDBFE' },
        ],
      },
    ]
    const { container } = render(
      <CasePhaseBar {...BASE_PROPS} totalValue={10000} phases={phases} />
    )

    const insetContainer = container.querySelector('.top-\\[20\\%\\]')
    const subBands = insetContainer!.querySelectorAll('.rounded-sm')
    expect(subBands).toHaveLength(1) // only Big renders
  })

  it('shows value label only when segment is wide enough (>18%)', () => {
    const phases: CasePhaseBarPhase[] = [
      { label: 'Big', value: 2500, color: '#3B82F6' },     // 83% → shows label
      { label: 'Medium', value: 400, color: '#22C55E' },    // 13% → no label
      { label: 'Small', value: 100, color: '#F59E0B' },     // 3% → no label
    ]
    const { container } = render(
      <CasePhaseBar {...BASE_PROPS} phases={phases} />
    )

    // Only the Big phase should have an inline label
    const labels = container.querySelectorAll('.text-white\\/90')
    expect(labels).toHaveLength(1)
    expect(labels[0].textContent).toBe('41:40') // 2500 seconds
  })

  it('calls onCaseClick with correct caseId', () => {
    const onClick = vi.fn()
    const { container } = render(
      <CasePhaseBar {...BASE_PROPS} phases={makePhases()} onCaseClick={onClick} />
    )

    const clickTarget = container.querySelector('.group')!
    fireEvent.click(clickTarget)
    expect(onClick).toHaveBeenCalledWith('case-uuid-1')
  })

  it('uses custom formatValue when provided', () => {
    const customFmt = (val: number) => `${val}s`
    render(
      <CasePhaseBar {...BASE_PROPS} phases={makePhases()} formatValue={customFmt} />
    )
    expect(screen.getByText('3000s')).toBeDefined()
  })

  // Integration: realistic dynamic phase data
  it('renders a realistic mix of complete, missing, and subphase data', () => {
    const phases: CasePhaseBarPhase[] = [
      {
        label: 'Pre-Op',
        value: 900,
        color: '#3B82F6',
        subphases: [
          { label: 'Anesthesia', value: 300, color: '#93C5FD' },
        ],
      },
      { label: 'Surgical', value: 2400, color: '#22C55E' },
      { label: 'Closing', value: 0, color: '#64748B', isMissing: true },
      { label: 'Post-Op', value: 600, color: '#8B5CF6' },
    ]
    const { container } = render(
      <CasePhaseBar
        {...BASE_PROPS}
        totalValue={3900}
        maxValue={5000}
        phases={phases}
      />
    )

    const segments = container.querySelectorAll('.group\\/phase')
    expect(segments).toHaveLength(4) // Pre-Op, Surgical, Closing (missing), Post-Op

    // Pre-Op has inset
    const insetContainer = container.querySelector('.top-\\[20\\%\\]')
    expect(insetContainer).not.toBeNull()

    // Closing is hatched
    const closingSegment = segments[2] as HTMLElement
    expect(closingSegment.style.backgroundImage).toContain('repeating-linear-gradient')
  })
})

// ============================================
// PhaseLegend TESTS
// ============================================

describe('PhaseLegend', () => {
  it('renders all legend items', () => {
    const items: PhaseLegendItem[] = [
      { label: 'Pre-Op', color: '#3B82F6' },
      { label: 'Surgical', color: '#22C55E' },
    ]
    render(<PhaseLegend items={items} />)
    expect(screen.getByText('Pre-Op')).toBeDefined()
    expect(screen.getByText('Surgical')).toBeDefined()
  })

  it('renders color swatches with correct colors', () => {
    const items: PhaseLegendItem[] = [
      { label: 'Pre-Op', color: '#3B82F6' },
    ]
    const { container } = render(<PhaseLegend items={items} />)
    const swatch = container.querySelector('.rounded-sm') as HTMLElement
    // jsdom converts hex to rgb
    expect(swatch.style.backgroundColor).toBe('rgb(59, 130, 246)')
  })

  it('renders subphase items with indentation and smaller swatch', () => {
    const items: PhaseLegendItem[] = [
      { label: 'Pre-Op', color: '#3B82F6' },
      { label: 'Anesthesia', color: '#93C5FD', isSubphase: true },
    ]
    const { container } = render(<PhaseLegend items={items} />)

    // Subphase item should have ml-2 class
    const legendItems = container.querySelectorAll('.flex.items-center.gap-1\\.5')
    expect(legendItems).toHaveLength(2)

    const subItem = legendItems[1]
    expect(subItem.className).toContain('ml-2')

    // Subphase swatch should be w-2 h-2 (smaller than parent's w-2.5 h-2.5)
    const subSwatch = subItem.querySelector('.rounded-sm') as HTMLElement
    expect(subSwatch.className).toContain('w-2')
    expect(subSwatch.className).toContain('h-2')
    expect(subSwatch.className).not.toContain('w-2.5')
  })

  it('renders parent items with standard swatch size', () => {
    const items: PhaseLegendItem[] = [
      { label: 'Pre-Op', color: '#3B82F6' },
    ]
    const { container } = render(<PhaseLegend items={items} />)
    const swatch = container.querySelector('.rounded-sm') as HTMLElement
    expect(swatch.className).toContain('w-2.5')
    expect(swatch.className).toContain('h-2.5')
  })

  it('renders subphase label text in lighter color', () => {
    const items: PhaseLegendItem[] = [
      { label: 'Parent', color: '#3B82F6' },
      { label: 'Sub', color: '#93C5FD', isSubphase: true },
    ]
    const { container } = render(<PhaseLegend items={items} />)
    const labels = container.querySelectorAll('.text-xs')
    const parentLabel = labels[0]
    const subLabel = labels[1]

    expect(parentLabel.className).toContain('text-slate-500')
    expect(subLabel.className).toContain('text-slate-400')
  })

  // Integration: realistic dynamic legend from phase_definitions
  it('renders a full legend with parents and nested subphases', () => {
    const items: PhaseLegendItem[] = [
      { label: 'Pre-Op', color: '#3B82F6' },
      { label: 'Anesthesia', color: '#93C5FD', isSubphase: true },
      { label: 'Surgical', color: '#22C55E' },
      { label: 'Closing', color: '#F59E0B' },
      { label: 'Post-Op', color: '#8B5CF6' },
    ]
    render(<PhaseLegend items={items} />)

    // All 5 labels rendered
    expect(screen.getByText('Pre-Op')).toBeDefined()
    expect(screen.getByText('Anesthesia')).toBeDefined()
    expect(screen.getByText('Surgical')).toBeDefined()
    expect(screen.getByText('Closing')).toBeDefined()
    expect(screen.getByText('Post-Op')).toBeDefined()
  })
})
