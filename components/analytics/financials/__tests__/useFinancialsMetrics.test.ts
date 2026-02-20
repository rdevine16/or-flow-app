import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useFinancialsMetrics } from '../useFinancialsMetrics'
import type { CaseCompletionStats, FacilityProcedureStats, SurgeonProcedureStats, FacilitySettings } from '../types'

// Helper to create a minimal valid case
function makeCase(overrides: Partial<CaseCompletionStats> = {}): CaseCompletionStats {
  return {
    id: 'c1',
    case_id: 'c1',
    case_number: 'ORB-001',
    facility_id: 'f1',
    surgeon_id: 's1',
    procedure_type_id: 'p1',
    payer_id: 'pay1',
    or_room_id: 'r1',
    case_date: '2026-02-10',
    scheduled_start_time: null,
    actual_start_time: null,
    total_duration_minutes: 90,
    surgical_duration_minutes: 60,
    anesthesia_duration_minutes: null,
    call_to_patient_in_minutes: null,
    schedule_variance_minutes: null,
    room_turnover_minutes: null,
    surgical_turnover_minutes: null,
    is_first_case_of_day_room: false,
    is_first_case_of_day_surgeon: false,
    surgeon_room_count: null,
    surgeon_case_sequence: null,
    room_case_sequence: null,
    reimbursement: 10000,
    soft_goods_cost: null,
    hard_goods_cost: null,
    or_cost: null,
    profit: 3000,
    or_hourly_rate: null,
    total_debits: 4000,
    total_credits: 0,
    net_cost: null,
    or_time_cost: 3000,
    cost_source: null,
    surgeon: { first_name: 'John', last_name: 'Smith' },
    procedure_types: { id: 'p1', name: 'THA' },
    payers: { id: 'pay1', name: 'BlueCross' },
    or_rooms: { name: 'OR 1' },
    ...overrides,
  }
}

const emptyFacilityProcStats: FacilityProcedureStats[] = []
const emptySurgeonProcStats: SurgeonProcedureStats[] = []
const facilitySettings: FacilitySettings = { or_hourly_rate: 1500 }

describe('useFinancialsMetrics', () => {
  describe('basic aggregation', () => {
    it('computes correct totals for a single case', () => {
      const cases = [makeCase()]
      const { result } = renderHook(() =>
        useFinancialsMetrics(cases, emptySurgeonProcStats, emptyFacilityProcStats, facilitySettings)
      )
      const m = result.current
      expect(m.totalCases).toBe(1)
      expect(m.totalProfit).toBe(3000)
      expect(m.totalReimbursement).toBe(10000)
      expect(m.avgMargin).toBe(30)
    })

    it('filters out cases with null profit', () => {
      const cases = [makeCase(), makeCase({ id: 'c2', case_id: 'c2', profit: null })]
      const { result } = renderHook(() =>
        useFinancialsMetrics(cases, emptySurgeonProcStats, emptyFacilityProcStats, facilitySettings)
      )
      expect(result.current.totalCases).toBe(1)
    })

    it('returns zero metrics for empty cases', () => {
      const { result } = renderHook(() =>
        useFinancialsMetrics([], emptySurgeonProcStats, emptyFacilityProcStats, facilitySettings)
      )
      expect(result.current.totalCases).toBe(0)
      expect(result.current.totalProfit).toBe(0)
      expect(result.current.payerMix).toHaveLength(0)
      expect(result.current.profitBins).toHaveLength(0)
      expect(result.current.monthlyTrend).toHaveLength(0)
    })
  })

  describe('payer mix', () => {
    it('groups cases by payer', () => {
      const cases = [
        makeCase({ payer_id: 'pay1', payers: { id: 'pay1', name: 'BlueCross' }, profit: 4000, reimbursement: 10000 }),
        makeCase({ id: 'c2', case_id: 'c2', payer_id: 'pay1', payers: { id: 'pay1', name: 'BlueCross' }, profit: 3000, reimbursement: 9000 }),
        makeCase({ id: 'c3', case_id: 'c3', payer_id: 'pay2', payers: { id: 'pay2', name: 'Aetna' }, profit: 2000, reimbursement: 8000 }),
      ]
      const { result } = renderHook(() =>
        useFinancialsMetrics(cases, emptySurgeonProcStats, emptyFacilityProcStats, facilitySettings)
      )

      const mix = result.current.payerMix
      expect(mix).toHaveLength(2)

      const blueCross = mix.find(p => p.payerName === 'BlueCross')
      expect(blueCross?.caseCount).toBe(2)
      expect(blueCross?.totalProfit).toBe(7000)
      expect(blueCross?.avgReimbursement).toBe(9500)

      const aetna = mix.find(p => p.payerName === 'Aetna')
      expect(aetna?.caseCount).toBe(1)
      expect(aetna?.pctOfCases).toBeCloseTo(33.33, 1)
    })

    it('handles cases with no payer', () => {
      const cases = [makeCase({ payer_id: null, payers: null })]
      const { result } = renderHook(() =>
        useFinancialsMetrics(cases, emptySurgeonProcStats, emptyFacilityProcStats, facilitySettings)
      )
      expect(result.current.payerMix).toHaveLength(1)
      expect(result.current.payerMix[0].payerName).toBe('Unknown Payer')
    })
  })

  describe('profit bins', () => {
    it('creates histogram bins from case profits', () => {
      const cases = [
        makeCase({ profit: 1200 }),
        makeCase({ id: 'c2', case_id: 'c2', profit: 1800 }),
        makeCase({ id: 'c3', case_id: 'c3', profit: 2300 }),
        makeCase({ id: 'c4', case_id: 'c4', profit: 3100 }),
      ]
      const { result } = renderHook(() =>
        useFinancialsMetrics(cases, emptySurgeonProcStats, emptyFacilityProcStats, facilitySettings)
      )

      const bins = result.current.profitBins
      expect(bins.length).toBeGreaterThan(0)

      // Total count across all bins should equal case count
      const totalBinCount = bins.reduce((sum, b) => sum + b.count, 0)
      expect(totalBinCount).toBe(4)
    })

    it('handles negative profits', () => {
      const cases = [
        makeCase({ profit: -500 }),
        makeCase({ id: 'c2', case_id: 'c2', profit: 2000 }),
      ]
      const { result } = renderHook(() =>
        useFinancialsMetrics(cases, emptySurgeonProcStats, emptyFacilityProcStats, facilitySettings)
      )

      const bins = result.current.profitBins
      // Should have bins spanning from negative to positive
      expect(bins[0].min).toBeLessThan(0)
    })
  })

  describe('monthly trend', () => {
    it('aggregates cases by month', () => {
      const cases = [
        makeCase({ case_date: '2026-01-15', profit: 3000 }),
        makeCase({ id: 'c2', case_id: 'c2', case_date: '2026-01-20', profit: 4000 }),
        makeCase({ id: 'c3', case_id: 'c3', case_date: '2026-02-10', profit: 5000 }),
      ]
      const { result } = renderHook(() =>
        useFinancialsMetrics(cases, emptySurgeonProcStats, emptyFacilityProcStats, facilitySettings)
      )

      const trend = result.current.monthlyTrend
      expect(trend).toHaveLength(2)
      expect(trend[0].label).toBe('Jan')
      expect(trend[0].caseCount).toBe(2)
      expect(trend[0].totalProfit).toBe(7000)
      expect(trend[1].label).toBe('Feb')
      expect(trend[1].caseCount).toBe(1)
    })

    it('sorts months chronologically', () => {
      const cases = [
        makeCase({ case_date: '2026-02-10' }),
        makeCase({ id: 'c2', case_id: 'c2', case_date: '2025-12-10' }),
        makeCase({ id: 'c3', case_id: 'c3', case_date: '2026-01-10' }),
      ]
      const { result } = renderHook(() =>
        useFinancialsMetrics(cases, emptySurgeonProcStats, emptyFacilityProcStats, facilitySettings)
      )

      const trend = result.current.monthlyTrend
      expect(trend[0].label).toBe('Dec')
      expect(trend[1].label).toBe('Jan')
      expect(trend[2].label).toBe('Feb')
    })
  })

  describe('sparklines', () => {
    it('extracts last 6 months of sparkline data', () => {
      // Create 7 months of data
      const cases = Array.from({ length: 7 }, (_, i) => {
        const month = (i + 8) % 12 + 1 // Aug through Feb
        const year = month <= 2 ? 2026 : 2025
        return makeCase({
          id: `c${i}`,
          case_id: `c${i}`,
          case_date: `${year}-${String(month).padStart(2, '0')}-15`,
          profit: 1000 * (i + 1),
          reimbursement: 5000,
          total_duration_minutes: 80 + i * 5,
        })
      })

      const { result } = renderHook(() =>
        useFinancialsMetrics(cases, emptySurgeonProcStats, emptyFacilityProcStats, facilitySettings)
      )

      // Should have at most 6 sparkline points
      expect(result.current.sparklines.profit.length).toBeLessThanOrEqual(6)
      expect(result.current.sparklines.margin.length).toBeLessThanOrEqual(6)
      expect(result.current.sparklines.volume.length).toBeLessThanOrEqual(6)
    })
  })

})
