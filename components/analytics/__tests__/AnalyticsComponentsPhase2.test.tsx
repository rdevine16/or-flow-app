/**
 * components/analytics/__tests__/AnalyticsComponentsPhase2.test.tsx
 *
 * Unit tests for the 10 Phase-2 presentational components added to
 * AnalyticsComponents.tsx for the Surgeon Day Analysis Redesign.
 *
 * Covers:
 * FlagBadge
 *   1. Compact mode — renders only the icon, shows title tooltip with label+detail
 *   2. Full mode (default) — renders icon AND label text in same span
 *   3. Warning severity applies orange classes
 *   4. Caution severity applies amber classes
 *   5. Info severity applies blue classes
 *   6. Positive severity applies green classes
 *   7. Unknown severity falls back to info (blue) classes
 *
 * FlagCountPills
 *   8.  Returns null when both counts are 0
 *   9.  Shows only warning pill when positiveCount is 0
 *  10. Shows only positive pill when warningCount is 0
 *  11. Shows both pills when both counts > 0
 *  12. Pluralises "flag" correctly (1 flag vs 2 flags)
 *
 * UptimeRing
 *  13. Clamps negative percent to 0
 *  14. Clamps percent above 100 to 100
 *  15. Displays rounded percent label
 *
 * CasePhaseBarNested
 *  16. Applies selection ring when isSelected=true
 *  17. No ring when isSelected=false
 *  18. Phases below 1% width threshold are skipped
 *  19. Sub-phases below 1% width threshold are skipped
 *  20. Renders compact flag badges for each flag
 *
 * DayTimeline
 *  21. Empty state — renders "No cases to display on timeline"
 *  22. Groups cases by room — each room gets its own labelled row
 *  23. Two cases in the same room produce only one room heading
 *  24. Warning flag produces orange dot indicator
 *  25. Positive flag produces green dot indicator
 *
 * SidebarFlagList
 *  26. Empty state — "No flags" + "All cases running normally"
 *  27. Empty state has green-tinted icon container
 *  28. Warning severity applies orange background row
 *  29. Caution severity applies amber background row
 *  30. Info severity applies blue background row
 *  31. Positive severity applies green background row
 *  32. Unknown severity falls back to slate background
 *  33. Renders case number and flag detail for each entry
 *  34. Renders icon emoji for each flag
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  FlagBadge,
  FlagCountPills,
  UptimeRing,
  CasePhaseBarNested,
  DayTimeline,
  SidebarFlagList,
  type TimelineCaseData,
  type TimelineCasePhase,
} from '../AnalyticsComponents'
import type { CaseFlag } from '@/lib/flag-detection'

// ============================================
// SHARED FIXTURES
// ============================================

function makeFlag(overrides?: Partial<CaseFlag>): CaseFlag {
  return {
    type: 'late_start',
    severity: 'warning',
    label: 'Late Start',
    detail: '+12m vs scheduled',
    icon: '⚠️',
    ...overrides,
  }
}

function makePhase(overrides?: Partial<TimelineCasePhase>): TimelineCasePhase {
  return {
    phaseId: 'pre-op',
    label: 'Pre-Op',
    color: '#3B82F6',
    durationSeconds: 600,
    subphases: [],
    ...overrides,
  }
}

function makeCase(overrides?: Partial<TimelineCaseData>): TimelineCaseData {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0)
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0, 0)
  return {
    id: 'case-1',
    caseNumber: 'CASE-001',
    procedure: 'Knee Replacement',
    room: 'OR-1',
    startTime: start,
    endTime: end,
    phases: [makePhase()],
    ...overrides,
  }
}

// ============================================
// FLAG BADGE TESTS
// ============================================

describe('FlagBadge', () => {
  it('compact mode — renders icon, suppresses label, shows title tooltip', () => {
    const flag = makeFlag()
    const { container } = render(<FlagBadge flag={flag} compact />)
    const span = container.querySelector('span')!
    expect(span).toBeTruthy()
    // Tooltip carries full context
    expect(span.title).toBe('Late Start: +12m vs scheduled')
    // Icon appears in content
    expect(span.textContent).toContain('⚠️')
    // Label text must NOT appear as separate visible text in compact mode
    // (icon and label are siblings in a gap-1 flex span in full mode,
    //  but in compact mode there is no separate label child)
    // The full text of the compact span is just the icon character
    expect(span.children.length).toBe(0) // no child elements — just text
  })

  it('full mode — the span text content includes both icon and label', () => {
    const flag = makeFlag()
    const { container } = render(<FlagBadge flag={flag} />)
    const span = container.querySelector('span')!
    expect(span.textContent).toContain('⚠️')
    expect(span.textContent).toContain('Late Start')
  })

  it('warning severity applies orange background and text', () => {
    const flag = makeFlag({ severity: 'warning' })
    const { container } = render(<FlagBadge flag={flag} />)
    expect(container.querySelector('.bg-orange-50')).toBeTruthy()
    expect(container.querySelector('.text-orange-700')).toBeTruthy()
  })

  it('caution severity applies amber background', () => {
    const flag = makeFlag({ severity: 'caution' })
    const { container } = render(<FlagBadge flag={flag} />)
    expect(container.querySelector('.bg-amber-50')).toBeTruthy()
    expect(container.querySelector('.text-amber-700')).toBeTruthy()
  })

  it('info severity applies blue background', () => {
    const flag = makeFlag({ severity: 'info' })
    const { container } = render(<FlagBadge flag={flag} />)
    expect(container.querySelector('.bg-blue-50')).toBeTruthy()
    expect(container.querySelector('.text-blue-700')).toBeTruthy()
  })

  it('positive severity applies green background', () => {
    const flag = makeFlag({ severity: 'positive' })
    const { container } = render(<FlagBadge flag={flag} />)
    expect(container.querySelector('.bg-green-50')).toBeTruthy()
    expect(container.querySelector('.text-green-700')).toBeTruthy()
  })

  it('unknown severity falls back to info (blue) styling', () => {
    const flag = makeFlag({ severity: 'unknown' as CaseFlag['severity'] })
    const { container } = render(<FlagBadge flag={flag} />)
    expect(container.querySelector('.bg-blue-50')).toBeTruthy()
  })
})

// ============================================
// FLAG COUNT PILLS TESTS
// ============================================

describe('FlagCountPills', () => {
  it('returns null when both counts are 0', () => {
    const { container } = render(<FlagCountPills warningCount={0} positiveCount={0} />)
    expect(container.firstChild).toBeNull()
  })

  it('shows only warning pill when positiveCount is 0', () => {
    render(<FlagCountPills warningCount={3} positiveCount={0} />)
    expect(screen.getByText(/3 flags/)).toBeTruthy()
    expect(screen.queryByText(/fast/)).toBeNull()
  })

  it('shows only positive pill when warningCount is 0', () => {
    render(<FlagCountPills warningCount={0} positiveCount={2} />)
    expect(screen.getByText(/2 fast/)).toBeTruthy()
    expect(screen.queryByText(/flags/)).toBeNull()
  })

  it('shows both pills when both counts > 0', () => {
    render(<FlagCountPills warningCount={2} positiveCount={1} />)
    expect(screen.getByText(/2 flags/)).toBeTruthy()
    expect(screen.getByText(/1 fast/)).toBeTruthy()
  })

  it('uses singular "flag" for count of 1', () => {
    render(<FlagCountPills warningCount={1} positiveCount={0} />)
    const el = screen.getByText(/1 flag/)
    // Must say "1 flag" not "1 flags"
    expect(el.textContent).not.toContain('1 flags')
    expect(el.textContent).toContain('1 flag')
  })

  it('uses plural "flags" for count of 2', () => {
    render(<FlagCountPills warningCount={2} positiveCount={0} />)
    expect(screen.getByText(/2 flags/)).toBeTruthy()
  })
})

// ============================================
// UPTIME RING TESTS
// ============================================

describe('UptimeRing', () => {
  it('displays the rounded percent label', () => {
    render(<UptimeRing percent={72.6} />)
    expect(screen.getByText('73%')).toBeTruthy()
  })

  it('clamps negative percent to 0%', () => {
    render(<UptimeRing percent={-10} />)
    expect(screen.getByText('0%')).toBeTruthy()
  })

  it('clamps percent above 100 to 100%', () => {
    render(<UptimeRing percent={150} />)
    expect(screen.getByText('100%')).toBeTruthy()
  })

  it('renders Surgical and Other legend labels', () => {
    render(<UptimeRing percent={50} />)
    expect(screen.getByText('Surgical')).toBeTruthy()
    expect(screen.getByText('Other')).toBeTruthy()
  })
})

// ============================================
// CASE PHASE BAR NESTED TESTS
// ============================================

describe('CasePhaseBarNested', () => {
  const BASE = {
    caseNumber: 'CASE-042',
    procedureName: 'Hip Arthroplasty',
    phases: [
      makePhase({ phaseId: 'pre', label: 'Pre-Op', durationSeconds: 600, color: '#3B82F6' }),
      makePhase({ phaseId: 'surg', label: 'Surgical', durationSeconds: 1800, color: '#22C55E' }),
    ],
    totalSeconds: 2400,
    maxTotalSeconds: 4000,
    flags: [],
    onSelect: vi.fn(),
  }

  it('applies selection ring classes when isSelected=true', () => {
    const { container } = render(<CasePhaseBarNested {...BASE} isSelected />)
    const outer = container.firstChild as HTMLElement
    expect(outer.className).toContain('bg-blue-50')
    expect(outer.className).toContain('ring-2')
    expect(outer.className).toContain('ring-blue-400')
  })

  it('does not apply ring when isSelected=false', () => {
    const { container } = render(<CasePhaseBarNested {...BASE} isSelected={false} />)
    const outer = container.firstChild as HTMLElement
    expect(outer.className).not.toContain('ring-2')
    expect(outer.className).not.toContain('bg-blue-50')
  })

  it('renders case number and procedure name', () => {
    render(<CasePhaseBarNested {...BASE} isSelected={false} />)
    expect(screen.getByText('CASE-042')).toBeTruthy()
    expect(screen.getByText('Hip Arthroplasty')).toBeTruthy()
  })

  it('skips phases narrower than 1% of total seconds', () => {
    // 1s / 2400 total = 0.042% — below 1% threshold → returns null
    // 2399s / 2400 total = 99.96% — above threshold → renders
    const phasesWithTiny = [
      makePhase({ phaseId: 'tiny', durationSeconds: 1, color: '#FF0000' }),
      makePhase({ phaseId: 'big', durationSeconds: 2399, color: '#22C55E' }),
    ]
    const { container } = render(
      <CasePhaseBarNested
        {...BASE}
        phases={phasesWithTiny}
        totalSeconds={2400}
      />
    )
    // The bar flex container holds direct children for each rendered phase.
    // The 1s phase (0.04%) returns null; the 2399s phase renders.
    // Each rendered phase is a div with an inline background-color style.
    const barContainer = container.querySelector('.h-7.rounded-md')!
    // Only the big phase should be a child div; the tiny one is null
    const phaseDivs = Array.from(barContainer.children).filter(
      el => (el as HTMLElement).style.backgroundColor !== ''
    )
    expect(phaseDivs.length).toBe(1)
  })

  it('renders compact flag badges for each flag', () => {
    const flags = [
      makeFlag({ label: 'Late Start', severity: 'warning', icon: '⚠️' }),
      makeFlag({ label: 'Fast Case', severity: 'positive', icon: '⚡' }),
    ]
    const { container } = render(
      <CasePhaseBarNested {...BASE} isSelected={false} flags={flags} />
    )
    // compact FlagBadge renders a span with title="Label: detail"
    const badges = container.querySelectorAll('span[title]')
    expect(badges.length).toBe(2)
  })

  it('skips sub-phases narrower than 1% of phase duration', () => {
    // 1s / 1800 = 0.055% → should be skipped
    // 360s / 1800 = 20% → should render
    const phasesWithTinySub = [
      makePhase({
        phaseId: 'surg',
        durationSeconds: 1800,
        subphases: [
          { label: 'Tiny Sub', color: '#FF0000', durationSeconds: 1, offsetSeconds: 0 },
          { label: 'Big Sub', color: '#00FF00', durationSeconds: 360, offsetSeconds: 1 },
        ],
      }),
    ]
    const { container } = render(
      <CasePhaseBarNested
        {...BASE}
        phases={phasesWithTinySub}
        totalSeconds={1800}
      />
    )
    // Sub-phase inset pills have class absolute top-0 bottom-0 rounded-sm
    const subDivs = container.querySelectorAll('.absolute.top-0.bottom-0.rounded-sm')
    // Only the 360s sub (20%) should render; the 1s sub (0.055%) is skipped
    expect(subDivs.length).toBe(1)
  })
})

// ============================================
// DAY TIMELINE TESTS
// ============================================

describe('DayTimeline', () => {
  it('renders empty state message when no cases provided', () => {
    render(<DayTimeline cases={[]} caseFlags={{}} />)
    expect(screen.getByText('No cases to display on timeline')).toBeTruthy()
  })

  it('groups cases by room and renders room labels', () => {
    const caseOR1 = makeCase({ id: 'c1', room: 'OR-1', caseNumber: 'CASE-001' })
    const caseOR2 = makeCase({ id: 'c2', room: 'OR-2', caseNumber: 'CASE-002' })
    render(<DayTimeline cases={[caseOR1, caseOR2]} caseFlags={{}} />)
    expect(screen.getByText('OR-1')).toBeTruthy()
    expect(screen.getByText('OR-2')).toBeTruthy()
  })

  it('places two cases from the same room into one room group heading', () => {
    const now = new Date()
    const case1 = makeCase({ id: 'c1', room: 'OR-3', caseNumber: 'CASE-010' })
    const case2: TimelineCaseData = {
      id: 'c2',
      caseNumber: 'CASE-011',
      procedure: 'Shoulder Repair',
      room: 'OR-3',
      startTime: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 11, 0, 0),
      endTime: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 13, 0, 0),
      phases: [makePhase()],
    }
    render(<DayTimeline cases={[case1, case2]} caseFlags={{}} />)
    // A single OR-3 heading — not two
    const headings = screen.getAllByText('OR-3')
    expect(headings.length).toBe(1)
  })

  it('renders an orange dot indicator for cases with warning flags', () => {
    const c = makeCase({ id: 'c1' })
    const flags = { 'c1': [makeFlag({ severity: 'warning' })] }
    const { container } = render(<DayTimeline cases={[c]} caseFlags={flags} />)
    // Flag indicator is a small div with bg-orange-500
    const orangeDot = container.querySelector('.bg-orange-500')
    expect(orangeDot).toBeTruthy()
  })

  it('renders a green dot indicator for cases with only positive flags', () => {
    const c = makeCase({ id: 'c1' })
    const flags = { 'c1': [makeFlag({ severity: 'positive' })] }
    const { container } = render(<DayTimeline cases={[c]} caseFlags={flags} />)
    const greenDot = container.querySelector('.bg-green-500')
    expect(greenDot).toBeTruthy()
  })
})

// ============================================
// SIDEBAR FLAG LIST TESTS
// ============================================

describe('SidebarFlagList', () => {
  it('renders empty state with "No flags" message', () => {
    render(<SidebarFlagList flags={[]} />)
    expect(screen.getByText('No flags')).toBeTruthy()
    expect(screen.getByText('All cases running normally')).toBeTruthy()
  })

  it('empty state has a green-tinted icon container', () => {
    const { container } = render(<SidebarFlagList flags={[]} />)
    expect(container.querySelector('.bg-green-50')).toBeTruthy()
  })

  it('warning severity applies orange background row', () => {
    const { container } = render(
      <SidebarFlagList flags={[{ caseNumber: 'CASE-001', flag: makeFlag({ severity: 'warning' }) }]} />
    )
    expect(container.querySelector('.bg-orange-50')).toBeTruthy()
  })

  it('caution severity applies amber background row', () => {
    const { container } = render(
      <SidebarFlagList flags={[{ caseNumber: 'CASE-001', flag: makeFlag({ severity: 'caution' }) }]} />
    )
    expect(container.querySelector('.bg-amber-50')).toBeTruthy()
  })

  it('info severity applies blue background row', () => {
    const { container } = render(
      <SidebarFlagList flags={[{ caseNumber: 'CASE-001', flag: makeFlag({ severity: 'info' }) }]} />
    )
    expect(container.querySelector('.bg-blue-50')).toBeTruthy()
  })

  it('positive severity applies green background row', () => {
    const { container } = render(
      <SidebarFlagList flags={[{ caseNumber: 'CASE-001', flag: makeFlag({ severity: 'positive' }) }]} />
    )
    expect(container.querySelector('.bg-green-50')).toBeTruthy()
  })

  it('unknown severity falls back to slate background', () => {
    const { container } = render(
      <SidebarFlagList flags={[{ caseNumber: 'CASE-001', flag: makeFlag({ severity: 'unknown' as CaseFlag['severity'] }) }]} />
    )
    expect(container.querySelector('.bg-slate-50')).toBeTruthy()
  })

  it('renders case number and flag detail for each entry', () => {
    const flags = [
      { caseNumber: 'CASE-007', flag: makeFlag({ label: 'Late Start', detail: '+12m vs scheduled' }) },
      { caseNumber: 'CASE-008', flag: makeFlag({ label: 'Long Turnover', detail: '47m turnover' }) },
    ]
    render(<SidebarFlagList flags={flags} />)
    expect(screen.getByText('Case CASE-007')).toBeTruthy()
    expect(screen.getByText('+12m vs scheduled')).toBeTruthy()
    expect(screen.getByText('Case CASE-008')).toBeTruthy()
    expect(screen.getByText('47m turnover')).toBeTruthy()
  })

  it('renders icon emoji for each flag', () => {
    const flag = makeFlag({ icon: '🔥', label: 'Hot Case' })
    render(<SidebarFlagList flags={[{ caseNumber: 'CASE-001', flag }]} />)
    expect(screen.getByText('🔥')).toBeTruthy()
  })
})
