import { describe, it, expect } from 'vitest'
import { computeFacilityScore } from '@/lib/facilityScoreStub'

describe('computeFacilityScore', () => {
  it('returns max score for perfect inputs', () => {
    const result = computeFacilityScore({
      utilizationPct: 100,
      medianTurnoverMinutes: 0,
      fcotsPct: 100,
      cancellationRate: 0,
    })
    expect(result.score).toBe(100)
    expect(result.grade.letter).toBe('A')
  })

  it('returns minimum score for worst-case inputs', () => {
    const result = computeFacilityScore({
      utilizationPct: 0,
      medianTurnoverMinutes: 60,
      fcotsPct: 0,
      cancellationRate: 1,
    })
    expect(result.score).toBe(0)
    expect(result.grade.letter).toBe('D')
  })

  it('handles realistic mid-range values', () => {
    const result = computeFacilityScore({
      utilizationPct: 72,
      medianTurnoverMinutes: 25,
      fcotsPct: 80,
      cancellationRate: 0.05,
    })
    // utilization: 0.72, turnover: 1 - 25/60 ≈ 0.583, fcots: 0.80, cancellation: 0.95
    // avg ≈ (0.72 + 0.583 + 0.80 + 0.95) / 4 ≈ 0.763 → 76
    expect(result.score).toBeGreaterThanOrEqual(70)
    expect(result.score).toBeLessThanOrEqual(80)
    expect(result.grade.letter).toBe('B')
  })

  it('clamps values above 100% to 1', () => {
    const result = computeFacilityScore({
      utilizationPct: 150,
      medianTurnoverMinutes: 0,
      fcotsPct: 120,
      cancellationRate: -0.1,
    })
    expect(result.score).toBe(100)
  })

  it('clamps negative values to 0', () => {
    const result = computeFacilityScore({
      utilizationPct: -10,
      medianTurnoverMinutes: 100,
      fcotsPct: -5,
      cancellationRate: 1.5,
    })
    expect(result.score).toBe(0)
  })

  it('returns correct grade boundaries', () => {
    // A: >= 80
    expect(computeFacilityScore({
      utilizationPct: 85, medianTurnoverMinutes: 10, fcotsPct: 85, cancellationRate: 0.02,
    }).grade.letter).toBe('A')

    // B: >= 65
    expect(computeFacilityScore({
      utilizationPct: 70, medianTurnoverMinutes: 20, fcotsPct: 70, cancellationRate: 0.1,
    }).grade.letter).toBe('B')

    // C: >= 50
    expect(computeFacilityScore({
      utilizationPct: 55, medianTurnoverMinutes: 30, fcotsPct: 55, cancellationRate: 0.15,
    }).grade.letter).toBe('C')

    // D: < 50
    expect(computeFacilityScore({
      utilizationPct: 20, medianTurnoverMinutes: 45, fcotsPct: 30, cancellationRate: 0.4,
    }).grade.letter).toBe('D')
  })

  it('returns component breakdowns', () => {
    const result = computeFacilityScore({
      utilizationPct: 80,
      medianTurnoverMinutes: 30,
      fcotsPct: 90,
      cancellationRate: 0.1,
    })
    expect(result.components.utilization).toBe(80)
    expect(result.components.turnover).toBe(50)  // 1 - 30/60 = 0.5 → 50
    expect(result.components.fcots).toBe(90)
    expect(result.components.cancellation).toBe(90)  // 1 - 0.1 = 0.9 → 90
  })

  it('handles zero turnover as perfect', () => {
    const result = computeFacilityScore({
      utilizationPct: 50,
      medianTurnoverMinutes: 0,
      fcotsPct: 50,
      cancellationRate: 0.5,
    })
    expect(result.components.turnover).toBe(100)
  })
})
