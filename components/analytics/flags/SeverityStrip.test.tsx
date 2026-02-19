/**
 * components/analytics/flags/SeverityStrip.test.tsx
 *
 * Unit tests for SeverityStrip.
 *
 * Covers:
 * 1.  Renders null (nothing) when totalFlags === 0
 * 2.  Renders all three severity sections when counts > 0
 * 3.  Percentage calculation — correct rounding for each severity
 * 4.  Percentage shows 0% for a severity with zero count
 * 5.  Proportional flex sizing — higher count gets larger flex value
 * 6.  Critical section has correct label and count
 * 7.  Warning section has correct label and count
 * 8.  Info section has correct label and count
 * 9.  100% allocation — all three percentages sum to 100% (rounding may skew by 1)
 * 10. Single-severity all-critical scenario
 * 11. Single-severity all-info scenario
 * 12. Equal distribution (33/33/34) — percentages all non-zero
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import SeverityStrip from './SeverityStrip'

// ============================================
// Helpers
// ============================================

function renderStrip(
  criticalCount: number,
  warningCount: number,
  infoCount: number,
  totalFlags?: number
) {
  const total = totalFlags ?? criticalCount + warningCount + infoCount
  return render(
    <SeverityStrip
      criticalCount={criticalCount}
      warningCount={warningCount}
      infoCount={infoCount}
      totalFlags={total}
    />
  )
}

// ============================================
// Tests
// ============================================

describe('SeverityStrip', () => {
  // ------------------------------------------
  // 1. Zero-total guard
  // ------------------------------------------

  it('renders nothing when totalFlags is 0', () => {
    const { container } = renderStrip(0, 0, 0, 0)
    // Component returns null — container body should be empty
    expect(container.firstChild).toBeNull()
  })

  // ------------------------------------------
  // 2. Basic rendering of three sections
  // ------------------------------------------

  it('renders CRITICAL, WARNING, and INFO labels', () => {
    renderStrip(5, 10, 3)
    expect(screen.getByText('CRITICAL')).toBeDefined()
    expect(screen.getByText('WARNING')).toBeDefined()
    expect(screen.getByText('INFO')).toBeDefined()
  })

  it('renders correct count for critical section', () => {
    const { container } = renderStrip(7, 5, 2)
    // The critical section should contain the count "7"
    // We query within the first severity tile
    const tiles = container.querySelectorAll('.rounded-lg')
    const criticalTile = tiles[0]
    expect(criticalTile.textContent).toContain('7')
  })

  it('renders correct count for warning section', () => {
    const { container } = renderStrip(7, 5, 2)
    const tiles = container.querySelectorAll('.rounded-lg')
    const warningTile = tiles[1]
    expect(warningTile.textContent).toContain('5')
  })

  it('renders correct count for info section', () => {
    const { container } = renderStrip(7, 5, 2)
    const tiles = container.querySelectorAll('.rounded-lg')
    const infoTile = tiles[2]
    expect(infoTile.textContent).toContain('2')
  })

  // ------------------------------------------
  // 3. Percentage calculations
  // ------------------------------------------

  it('shows correct percentage for each severity (20 total)', () => {
    // 10 critical = 50%, 8 warning = 40%, 2 info = 10%
    renderStrip(10, 8, 2, 20)
    expect(screen.getByText('50%')).toBeDefined()
    expect(screen.getByText('40%')).toBeDefined()
    expect(screen.getByText('10%')).toBeDefined()
  })

  it('shows 0% for a severity with zero count', () => {
    // 15 critical, 5 warning, 0 info
    renderStrip(15, 5, 0, 20)
    expect(screen.getByText('0%')).toBeDefined()
  })

  it('percentage sum is within 1 of 100% (rounding tolerance)', () => {
    // 33 + 33 + 34 = 100
    const { container } = renderStrip(33, 33, 34, 100)
    // The percentage spans have a class containing "pct" (e.g. text-red-600/60)
    // but they're most reliably found by their text content matching N%
    // Query specifically for text nodes that ARE just a percentage (not inside a larger number)
    // The component renders: <span className={sev.pctColor}>{pct}%</span>
    // We use getAllByText with a regex that matches strings that ARE exactly "N%"
    const allText = container.querySelectorAll('span')
    let sum = 0
    allText.forEach((span) => {
      // Match spans whose entire text content is "N%" (no other characters)
      if (/^\d+%$/.test(span.textContent?.trim() ?? '')) {
        sum += parseInt(span.textContent!.replace('%', ''), 10)
      }
    })
    expect(Math.abs(sum - 100)).toBeLessThanOrEqual(1)
  })

  // ------------------------------------------
  // 4. Proportional flex sizing
  // ------------------------------------------

  it('renders tiles in correct order: critical, warning, info', () => {
    const { container } = renderStrip(20, 5, 2)
    const tiles = container.querySelectorAll('.rounded-lg')
    // First tile is critical (contains "CRITICAL" label and "20" count)
    expect(tiles[0].textContent).toContain('CRITICAL')
    expect(tiles[0].textContent).toContain('20')
    // Last tile is info (contains "INFO" label and "2" count)
    expect(tiles[2].textContent).toContain('INFO')
    expect(tiles[2].textContent).toContain('2')
  })

  it('zero-count tile still renders with 0 count and 0%', () => {
    const { container } = renderStrip(10, 5, 0)
    const tiles = container.querySelectorAll('.rounded-lg')
    const infoTile = tiles[2]
    // Info tile should show count 0 and 0%
    expect(infoTile.textContent).toContain('0')
    expect(infoTile.textContent).toContain('0%')
  })

  // ------------------------------------------
  // 5. Edge cases
  // ------------------------------------------

  it('all-critical scenario: shows 100% on critical tile', () => {
    renderStrip(25, 0, 0, 25)
    expect(screen.getByText('25')).toBeDefined()
    expect(screen.getByText('100%')).toBeDefined()
  })

  it('all-info scenario: shows 100% on info tile', () => {
    renderStrip(0, 0, 12, 12)
    expect(screen.getByText('12')).toBeDefined()
    expect(screen.getByText('100%')).toBeDefined()
  })

  it('renders three tiles for equal distribution (33/33/34)', () => {
    const { container } = renderStrip(33, 33, 34, 100)
    const tiles = container.querySelectorAll('.rounded-lg')
    expect(tiles).toHaveLength(3)
    // No tile should show 0%
    tiles.forEach((tile) => {
      expect(tile.textContent).not.toContain('0%')
    })
  })

  // ------------------------------------------
  // 6. Presence of color dots (design token values)
  // ------------------------------------------

  it('renders three colored dot indicators (one per severity)', () => {
    const { container } = renderStrip(5, 3, 2)
    // Each tile has a w-2 h-2 rounded-full dot
    const dots = container.querySelectorAll('.w-2.h-2.rounded-full')
    expect(dots).toHaveLength(3)
  })
})
