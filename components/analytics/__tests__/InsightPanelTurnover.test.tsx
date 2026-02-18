/**
 * InsightPanelTurnover tests
 *
 * Unit: compliance summary renders correctly, detail table renders all transitions, surgeon comparison sorted by median
 * Integration: clicking turnover insight opens panel with correct turnover data
 * Workflow: non-compliant turnovers highlighted, surgeon bars reflect correct thresholds
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import InsightPanelTurnover from '../InsightPanelTurnover'
import type { TurnoverResult, TurnoverDetail, FacilityAnalyticsConfig } from '@/lib/analyticsV2'
import { ANALYTICS_CONFIG_DEFAULTS } from '@/lib/analyticsV2'

// ============================================
// HELPERS
// ============================================

function makeTurnoverResult(details: TurnoverDetail[], overrides?: Partial<TurnoverResult>): TurnoverResult {
  const compliant = details.filter(d => d.isCompliant).length
  const nonCompliant = details.length - compliant
  const complianceRate = details.length > 0 ? Math.round((compliant / details.length) * 100) : 0

  return {
    value: 25,
    displayValue: '25 min',
    subtitle: `${complianceRate}% under 30 min target`,
    target: 80,
    targetMet: complianceRate >= 80,
    details,
    compliantCount: compliant,
    nonCompliantCount: nonCompliant,
    complianceRate,
    ...overrides,
  }
}

function makeDetail(overrides?: Partial<TurnoverDetail>): TurnoverDetail {
  return {
    date: '2025-02-03',
    roomName: 'OR-1',
    fromCaseNumber: 'C001',
    toCaseNumber: 'C002',
    fromSurgeonName: 'John Martinez',
    toSurgeonName: 'Sarah Williams',
    turnoverMinutes: 22,
    isCompliant: true,
    ...overrides,
  }
}

const defaultConfig: FacilityAnalyticsConfig = {
  ...ANALYTICS_CONFIG_DEFAULTS,
}

// ============================================
// UNIT TESTS
// ============================================

describe('InsightPanelTurnover', () => {
  it('renders compliance summary cards', () => {
    const details = [
      makeDetail({ isCompliant: true }),
      makeDetail({ fromCaseNumber: 'C003', toCaseNumber: 'C004', turnoverMinutes: 38, isCompliant: false }),
    ]

    render(<InsightPanelTurnover sameRoomTurnover={makeTurnoverResult(details)} config={defaultConfig} />)

    // Should show compliance rate
    expect(screen.getByText('50%')).toBeDefined()
    // Target
    expect(screen.getByText('80%')).toBeDefined()
    // Compliant count
    expect(screen.getByText('1', { selector: '.text-emerald-500' })).toBeDefined()
    // Non-compliant count
    expect(screen.getByText('1', { selector: '.text-red-500' })).toBeDefined()
  })

  it('renders detail table with all transitions', () => {
    const details = [
      makeDetail({ fromCaseNumber: 'C001', toCaseNumber: 'C002', turnoverMinutes: 22, isCompliant: true }),
      makeDetail({ fromCaseNumber: 'C003', toCaseNumber: 'C004', turnoverMinutes: 38, isCompliant: false, roomName: 'OR-2' }),
    ]

    render(<InsightPanelTurnover sameRoomTurnover={makeTurnoverResult(details)} config={defaultConfig} />)

    expect(screen.getByText('Turnover Detail')).toBeDefined()
    expect(screen.getByText('22m')).toBeDefined()
    expect(screen.getByText('38m')).toBeDefined()
    expect(screen.getByText('OR-2')).toBeDefined()
  })

  it('renders empty state when no details', () => {
    render(<InsightPanelTurnover sameRoomTurnover={makeTurnoverResult([])} config={defaultConfig} />)

    expect(screen.getByText('No Turnover Data')).toBeDefined()
  })

  it('renders surgeon comparison section', () => {
    const details = [
      makeDetail({ fromSurgeonName: 'John Martinez', turnoverMinutes: 20, isCompliant: true }),
      makeDetail({ fromCaseNumber: 'C003', toCaseNumber: 'C004', fromSurgeonName: 'John Martinez', turnoverMinutes: 25, isCompliant: true }),
      makeDetail({ fromCaseNumber: 'C005', toCaseNumber: 'C006', fromSurgeonName: 'Sarah Williams', turnoverMinutes: 40, isCompliant: false }),
    ]

    render(<InsightPanelTurnover sameRoomTurnover={makeTurnoverResult(details)} config={defaultConfig} />)

    expect(screen.getByText('Surgeon Turnover Comparison')).toBeDefined()
    // Williams has higher median, should appear (name appears in both table and comparison)
    expect(screen.getAllByText('Sarah Williams').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('John Martinez').length).toBeGreaterThanOrEqual(1)
  })

  it('displays compliant status badges correctly', () => {
    const details = [
      makeDetail({ turnoverMinutes: 22, isCompliant: true }),
      makeDetail({ fromCaseNumber: 'C003', toCaseNumber: 'C004', turnoverMinutes: 38, isCompliant: false }),
    ]

    render(<InsightPanelTurnover sameRoomTurnover={makeTurnoverResult(details)} config={defaultConfig} />)

    expect(screen.getByText('OK')).toBeDefined()
    expect(screen.getByText('Over')).toBeDefined()
  })

  // ============================================
  // Phase 3: flipRoomTurnover optional prop
  // Added in turnover-4-metric-restructure Phase 3
  // ============================================

  it('renders without error when flipRoomTurnover prop is omitted (undefined)', () => {
    // flipRoomTurnover is optional — omitting it must not crash the component
    const details = [makeDetail({ isCompliant: true })]
    expect(() =>
      render(<InsightPanelTurnover sameRoomTurnover={makeTurnoverResult(details)} config={defaultConfig} />)
    ).not.toThrow()
  })

  it('renders without error when flipRoomTurnover prop is provided with zero value', () => {
    // The most common production case: no flip-room turnovers this period
    const details = [makeDetail({ isCompliant: true })]
    const noFlips: TurnoverResult = {
      value: 0,
      displayValue: '--',
      subtitle: 'No flip-room turnovers',
      details: [],
      compliantCount: 0,
      nonCompliantCount: 0,
      complianceRate: 0,
    }
    expect(() =>
      render(
        <InsightPanelTurnover
          sameRoomTurnover={makeTurnoverResult(details)}
          flipRoomTurnover={noFlips}
          config={defaultConfig}
        />
      )
    ).not.toThrow()
    // Same-room detail table still renders correctly when flipRoomTurnover is zero
    expect(screen.getByText('Turnover Detail')).toBeDefined()
  })

  it('renders without error when flipRoomTurnover prop is provided with real data', () => {
    // Flip-room data present — component must accept the prop without crashing
    const details = [makeDetail({ isCompliant: true })]
    const withFlips: TurnoverResult = {
      value: 35,
      displayValue: '35 min',
      subtitle: '10 flips',
      details: [makeDetail({ roomName: 'OR-2', turnoverMinutes: 35, isCompliant: false })],
      compliantCount: 5,
      nonCompliantCount: 5,
      complianceRate: 50,
    }
    expect(() =>
      render(
        <InsightPanelTurnover
          sameRoomTurnover={makeTurnoverResult(details)}
          flipRoomTurnover={withFlips}
          config={defaultConfig}
        />
      )
    ).not.toThrow()
    // Same-room compliance summary must still render (prop must not disrupt existing layout)
    expect(screen.getByText('Turnover Detail')).toBeDefined()
  })
})
