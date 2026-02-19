/**
 * components/analytics/flags/__tests__/SurgeonFlagTable.test.tsx
 *
 * Unit tests for SurgeonFlagTable — sortable surgeon flag distribution table.
 *
 * Covers:
 * 1. Renders nothing when data is empty (returns null)
 * 2. Renders all surgeon rows from input data
 * 3. Renders column headers (Surgeon, Cases, Flags, Flag Rate, Trend, Top Flag)
 * 4. Displays name, cases, flags, and topFlag for each row
 * 5. Flag rate color coding:
 *    - rate > 35 → rose (high)
 *    - rate 25-35 → amber (medium)
 *    - rate <= 25 → emerald (low)
 * 6. Trend badge color coding:
 *    - positive trend → rose (more flags = bad)
 *    - negative trend → emerald (fewer flags = good)
 *    - zero trend → shows dash
 * 7. Sorting:
 *    - Default sort is by rate descending
 *    - Clicking "Cases" sorts by cases descending
 *    - Clicking "Cases" again toggles to ascending
 *    - Clicking "Surgeon" sorts by name ascending
 *    - Clicking a different column resets to default direction
 * 8. onSurgeonClick fires with the correct surgeonId when row is clicked
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { SurgeonFlagRow } from '@/types/flag-analytics'

import SurgeonFlagTable from '../SurgeonFlagTable'

// ============================================
// Fixtures
// ============================================

function makeSurgeon(
  overrides: Partial<SurgeonFlagRow> & { surgeonId: string; name: string }
): SurgeonFlagRow {
  return {
    cases: 20,
    flags: 5,
    rate: 25,
    trend: 0,
    topFlag: 'Late Patient',
    ...overrides,
  }
}

const SURGEONS: SurgeonFlagRow[] = [
  makeSurgeon({ surgeonId: 'sg-1', name: 'Dr. Smith', cases: 30, flags: 12, rate: 40, trend: 5, topFlag: 'Late Patient' }),
  makeSurgeon({ surgeonId: 'sg-2', name: 'Dr. Jones', cases: 25, flags: 6, rate: 24, trend: -3, topFlag: 'Equipment Delay' }),
  makeSurgeon({ surgeonId: 'sg-3', name: 'Dr. Adams', cases: 15, flags: 5, rate: 33, trend: 0, topFlag: 'Consent Issue' }),
]

// ============================================
// Tests
// ============================================

describe('SurgeonFlagTable', () => {
  // ------------------------------------------
  // 1. Empty state — returns null
  // ------------------------------------------

  it('renders nothing when data array is empty', () => {
    const { container } = render(<SurgeonFlagTable data={[]} />)
    expect(container.firstChild).toBeNull()
  })

  // ------------------------------------------
  // 2. Renders surgeon rows
  // ------------------------------------------

  it('renders a row for each surgeon', () => {
    render(<SurgeonFlagTable data={SURGEONS} />)
    expect(screen.getByText('Dr. Smith')).toBeDefined()
    expect(screen.getByText('Dr. Jones')).toBeDefined()
    expect(screen.getByText('Dr. Adams')).toBeDefined()
  })

  it('renders the cases count for each surgeon', () => {
    render(<SurgeonFlagTable data={SURGEONS} />)
    expect(screen.getByText('30')).toBeDefined()
    expect(screen.getByText('25')).toBeDefined()
    expect(screen.getByText('15')).toBeDefined()
  })

  it('renders the flags count for each surgeon', () => {
    render(<SurgeonFlagTable data={SURGEONS} />)
    expect(screen.getByText('12')).toBeDefined()
    expect(screen.getByText('6')).toBeDefined()
    expect(screen.getByText('5')).toBeDefined()
  })

  it('renders the topFlag for each surgeon', () => {
    render(<SurgeonFlagTable data={SURGEONS} />)
    expect(screen.getByText('Late Patient')).toBeDefined()
    expect(screen.getByText('Equipment Delay')).toBeDefined()
    expect(screen.getByText('Consent Issue')).toBeDefined()
  })

  // ------------------------------------------
  // 3. Column headers
  // ------------------------------------------

  it('renders the Surgeon column header', () => {
    render(<SurgeonFlagTable data={SURGEONS} />)
    expect(screen.getByText('Surgeon')).toBeDefined()
  })

  it('renders the Cases column header', () => {
    render(<SurgeonFlagTable data={SURGEONS} />)
    expect(screen.getByText('Cases')).toBeDefined()
  })

  it('renders the Flags column header', () => {
    render(<SurgeonFlagTable data={SURGEONS} />)
    expect(screen.getByText('Flags')).toBeDefined()
  })

  it('renders the Flag Rate column header', () => {
    render(<SurgeonFlagTable data={SURGEONS} />)
    expect(screen.getByText('Flag Rate')).toBeDefined()
  })

  it('renders the Trend column header', () => {
    render(<SurgeonFlagTable data={SURGEONS} />)
    expect(screen.getByText('Trend')).toBeDefined()
  })

  it('renders the Top Flag column header', () => {
    render(<SurgeonFlagTable data={SURGEONS} />)
    expect(screen.getByText('Top Flag')).toBeDefined()
  })

  // ------------------------------------------
  // 4. Flag rate color coding
  // ------------------------------------------

  it('FlagRateBadge uses rose classes for rate > 35', () => {
    const high = [makeSurgeon({ surgeonId: 'sg-h', name: 'Dr. High', rate: 36 })]
    const { container } = render(<SurgeonFlagTable data={high} />)
    const badge = container.querySelector('.bg-rose-50')
    expect(badge).not.toBeNull()
    expect(badge?.classList.contains('text-rose-600')).toBe(true)
  })

  it('FlagRateBadge uses amber classes for rate between 25 and 35', () => {
    const medium = [makeSurgeon({ surgeonId: 'sg-m', name: 'Dr. Medium', rate: 28 })]
    const { container } = render(<SurgeonFlagTable data={medium} />)
    const badge = container.querySelector('.bg-amber-50')
    expect(badge).not.toBeNull()
    expect(badge?.classList.contains('text-amber-600')).toBe(true)
  })

  it('FlagRateBadge uses emerald classes for rate <= 25', () => {
    const low = [makeSurgeon({ surgeonId: 'sg-l', name: 'Dr. Low', rate: 25 })]
    const { container } = render(<SurgeonFlagTable data={low} />)
    const badge = container.querySelector('.bg-emerald-50')
    expect(badge).not.toBeNull()
    expect(badge?.classList.contains('text-emerald-600')).toBe(true)
  })

  it('FlagRateBadge displays the rate formatted to one decimal', () => {
    const surgeon = [makeSurgeon({ surgeonId: 'sg-r', name: 'Dr. Rate', rate: 32.7 })]
    render(<SurgeonFlagTable data={surgeon} />)
    expect(screen.getByText('32.7%')).toBeDefined()
  })

  // ------------------------------------------
  // 5. Trend badge color coding
  // ------------------------------------------

  it('positive trend shows rose badge (more flags = bad)', () => {
    const increasing = [makeSurgeon({ surgeonId: 'sg-up', name: 'Dr. Up', trend: 8 })]
    const { container } = render(<SurgeonFlagTable data={increasing} />)
    const badge = container.querySelector('.bg-rose-50.text-rose-600')
    expect(badge).not.toBeNull()
  })

  it('negative trend shows emerald badge (fewer flags = good)', () => {
    const decreasing = [makeSurgeon({ surgeonId: 'sg-dn', name: 'Dr. Down', trend: -5 })]
    const { container } = render(<SurgeonFlagTable data={decreasing} />)
    const badge = container.querySelector('.bg-emerald-50.text-emerald-600')
    expect(badge).not.toBeNull()
  })

  it('zero trend shows an em dash, no colored trend badge', () => {
    const flat = [makeSurgeon({ surgeonId: 'sg-fl', name: 'Dr. Flat', trend: 0 })]
    const { container } = render(<SurgeonFlagTable data={flat} />)
    // Zero trend: TrendBadge renders a plain span with text-slate-400 (no colored badge classes)
    // The trend cell is the 5th td (index 4: name, cases, flags, rate, trend)
    const rows = container.querySelectorAll('tbody tr')
    const trendCell = rows[0].querySelectorAll('td')[4]
    expect(trendCell).not.toBeUndefined()
    // Should not contain a colored trend badge inside the trend cell
    expect(trendCell.querySelector('.bg-rose-50')).toBeNull()
    expect(trendCell.querySelector('.bg-emerald-50')).toBeNull()
    // Should have the em dash span
    const dashSpan = trendCell.querySelector('span.text-slate-400')
    expect(dashSpan).not.toBeNull()
  })

  // ------------------------------------------
  // 6. Sorting — default is rate descending
  // ------------------------------------------

  it('defaults to sorting by rate descending (highest rate first)', () => {
    render(<SurgeonFlagTable data={SURGEONS} />)
    const rows = screen.getAllByRole('row')
    // Header row + 3 data rows; data rows[0] = rows[1]
    // Dr. Smith (rate=40) should come before Dr. Adams (rate=33) which before Dr. Jones (rate=24)
    const firstDataCell = rows[1].querySelector('td')
    expect(firstDataCell?.textContent).toContain('Dr. Smith')
    const secondDataCell = rows[2].querySelector('td')
    expect(secondDataCell?.textContent).toContain('Dr. Adams')
  })

  it('clicking Cases header sorts by cases descending', () => {
    render(<SurgeonFlagTable data={SURGEONS} />)
    const casesHeader = screen.getByText('Cases')
    fireEvent.click(casesHeader)
    const rows = screen.getAllByRole('row')
    // Dr. Smith (cases=30) > Dr. Jones (cases=25) > Dr. Adams (cases=15)
    const firstDataCell = rows[1].querySelector('td')
    expect(firstDataCell?.textContent).toContain('Dr. Smith')
  })

  it('clicking Cases header twice toggles to ascending sort', () => {
    render(<SurgeonFlagTable data={SURGEONS} />)
    const casesHeader = screen.getByText('Cases')
    fireEvent.click(casesHeader) // desc
    fireEvent.click(casesHeader) // asc
    const rows = screen.getAllByRole('row')
    // Dr. Adams (cases=15) should be first ascending
    const firstDataCell = rows[1].querySelector('td')
    expect(firstDataCell?.textContent).toContain('Dr. Adams')
  })

  it('clicking Surgeon header sorts by name ascending', () => {
    render(<SurgeonFlagTable data={SURGEONS} />)
    const surgeonHeader = screen.getByText('Surgeon')
    fireEvent.click(surgeonHeader)
    const rows = screen.getAllByRole('row')
    // Alphabetical: Dr. Adams < Dr. Jones < Dr. Smith
    const firstDataCell = rows[1].querySelector('td')
    expect(firstDataCell?.textContent).toContain('Dr. Adams')
  })

  it('clicking Flags header sorts by flags descending', () => {
    render(<SurgeonFlagTable data={SURGEONS} />)
    const flagsHeader = screen.getByText('Flags')
    fireEvent.click(flagsHeader)
    const rows = screen.getAllByRole('row')
    // Dr. Smith (flags=12) first
    const firstDataCell = rows[1].querySelector('td')
    expect(firstDataCell?.textContent).toContain('Dr. Smith')
  })

  // ------------------------------------------
  // 7. onSurgeonClick callback
  // ------------------------------------------

  it('calls onSurgeonClick with the correct surgeonId when a row is clicked', () => {
    const handleClick = vi.fn()
    render(<SurgeonFlagTable data={SURGEONS} onSurgeonClick={handleClick} />)
    const rows = screen.getAllByRole('row')
    // Click the first data row (Dr. Smith, sg-1) in default desc-rate order
    fireEvent.click(rows[1])
    expect(handleClick).toHaveBeenCalledOnce()
    expect(handleClick).toHaveBeenCalledWith('sg-1')
  })

  it('does not throw when onSurgeonClick is not provided and a row is clicked', () => {
    render(<SurgeonFlagTable data={SURGEONS} />)
    const rows = screen.getAllByRole('row')
    expect(() => fireEvent.click(rows[1])).not.toThrow()
  })

  // ------------------------------------------
  // 8. Single row
  // ------------------------------------------

  it('renders correctly with a single surgeon row', () => {
    const single = [makeSurgeon({ surgeonId: 'sg-only', name: 'Dr. Only', rate: 20 })]
    render(<SurgeonFlagTable data={single} />)
    expect(screen.getByText('Dr. Only')).toBeDefined()
  })
})
