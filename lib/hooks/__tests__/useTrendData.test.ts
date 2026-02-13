import { describe, it, expect } from 'vitest'
import type { CaseWithMilestones } from '@/lib/analyticsV2'
import {
  groupCasesByDate,
  computeDailyMetric,
  TREND_METRIC_OPTIONS,
} from '../useTrendData'

// ============================================
// Test data factory
// ============================================

function makeCase(overrides: Partial<CaseWithMilestones> = {}): CaseWithMilestones {
  return {
    id: overrides.id ?? 'case-1',
    case_number: overrides.case_number ?? 'C001',
    facility_id: 'fac-1',
    scheduled_date: overrides.scheduled_date ?? '2026-01-15',
    start_time: overrides.start_time ?? '07:30:00',
    surgeon_id: 'surg-1',
    or_room_id: overrides.or_room_id ?? 'room-1',
    status_id: 'status-1',
    case_statuses: overrides.case_statuses ?? { name: 'completed' },
    case_milestones: overrides.case_milestones ?? [],
    or_rooms: overrides.or_rooms ?? { id: 'room-1', name: 'OR 1' },
    ...overrides,
  }
}

// ============================================
// groupCasesByDate
// ============================================

describe('groupCasesByDate', () => {
  it('groups cases by scheduled_date', () => {
    const cases = [
      makeCase({ id: 'c1', scheduled_date: '2026-01-15' }),
      makeCase({ id: 'c2', scheduled_date: '2026-01-15' }),
      makeCase({ id: 'c3', scheduled_date: '2026-01-16' }),
    ]

    const grouped = groupCasesByDate(cases)
    expect(grouped.size).toBe(2)
    expect(grouped.get('2026-01-15')?.length).toBe(2)
    expect(grouped.get('2026-01-16')?.length).toBe(1)
  })

  it('returns empty map for empty array', () => {
    const grouped = groupCasesByDate([])
    expect(grouped.size).toBe(0)
  })

  it('handles single case', () => {
    const cases = [makeCase({ id: 'c1', scheduled_date: '2026-01-20' })]
    const grouped = groupCasesByDate(cases)
    expect(grouped.size).toBe(1)
    expect(grouped.get('2026-01-20')?.length).toBe(1)
  })
})

// ============================================
// computeDailyMetric
// ============================================

describe('computeDailyMetric', () => {
  it('caseVolume counts completed cases', () => {
    const cases = [
      makeCase({ id: 'c1', case_statuses: { name: 'completed' } }),
      makeCase({ id: 'c2', case_statuses: { name: 'completed' } }),
      makeCase({ id: 'c3', case_statuses: { name: 'scheduled' } }),
    ]

    const result = computeDailyMetric('caseVolume', cases)
    expect(result).toBe(2)
  })

  it('caseVolume returns 0 for no completed cases', () => {
    const cases = [
      makeCase({ id: 'c1', case_statuses: { name: 'scheduled' } }),
    ]
    expect(computeDailyMetric('caseVolume', cases)).toBe(0)
  })

  it('caseVolume returns 0 for empty array', () => {
    expect(computeDailyMetric('caseVolume', [])).toBe(0)
  })

  it('utilization returns a number', () => {
    const cases = [makeCase()]
    const result = computeDailyMetric('utilization', cases)
    expect(typeof result).toBe('number')
    expect(result).toBeGreaterThanOrEqual(0)
  })

  it('turnover returns a number', () => {
    const cases = [makeCase()]
    const result = computeDailyMetric('turnover', cases)
    expect(typeof result).toBe('number')
    expect(result).toBeGreaterThanOrEqual(0)
  })

  it('facilityScore returns a number between 0 and 100', () => {
    const cases = [makeCase()]
    const result = computeDailyMetric('facilityScore', cases)
    expect(typeof result).toBe('number')
    expect(result).toBeGreaterThanOrEqual(0)
    expect(result).toBeLessThanOrEqual(100)
  })
})

// ============================================
// TREND_METRIC_OPTIONS
// ============================================

describe('TREND_METRIC_OPTIONS', () => {
  it('has 4 metric options', () => {
    expect(TREND_METRIC_OPTIONS.length).toBe(4)
  })

  it('includes all required metrics', () => {
    const values = TREND_METRIC_OPTIONS.map((o) => o.value)
    expect(values).toContain('utilization')
    expect(values).toContain('turnover')
    expect(values).toContain('caseVolume')
    expect(values).toContain('facilityScore')
  })

  it('each option has label and unit', () => {
    for (const option of TREND_METRIC_OPTIONS) {
      expect(option.label.length).toBeGreaterThan(0)
      expect(option.unit.length).toBeGreaterThan(0)
    }
  })
})
