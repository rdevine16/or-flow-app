// lib/__tests__/demo-outlier-engine.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  scheduleBadDays,
  computeLateStartDelay,
  computeCascadeDelay,
  adjustSurgicalTime,
  adjustTurnoverTime,
  computeCallbackDelay,
  hasAnyOutlierEnabled,
  type OutlierProfile,
} from '../demo-outlier-engine'

// Helper to create a minimal outlier profile
function createProfile(overrides?: Partial<OutlierProfile>): OutlierProfile {
  return {
    outliers: {
      lateStarts: { enabled: false, frequency: 20, magnitude: 2 },
      longTurnovers: { enabled: false, frequency: 15, magnitude: 2 },
      extendedPhases: { enabled: false, frequency: 10, magnitude: 2 },
      callbackDelays: { enabled: false, frequency: 12, magnitude: 2 },
      fastCases: { enabled: false, frequency: 8, magnitude: 2 },
    },
    badDaysPerMonth: 0,
    ...overrides,
  }
}

describe('demo-outlier-engine', () => {
  // Store original Math.random
  let originalRandom: () => number

  beforeEach(() => {
    originalRandom = Math.random
  })

  afterEach(() => {
    Math.random = originalRandom
  })

  describe('scheduleBadDays', () => {
    it('returns empty set when badDaysPerMonth is 0', () => {
      const dates = ['2026-02-01', '2026-02-05', '2026-02-10']
      const result = scheduleBadDays(dates, 0)
      expect(result.size).toBe(0)
    })

    it('returns empty set when operatingDates is empty', () => {
      const result = scheduleBadDays([], 2)
      expect(result.size).toBe(0)
    })

    it('picks correct number of bad days per month', () => {
      // Feb: 6 dates, Mar: 4 dates → 2 bad days each month = 4 total
      const dates = [
        '2026-02-01',
        '2026-02-05',
        '2026-02-10',
        '2026-02-15',
        '2026-02-20',
        '2026-02-25',
        '2026-03-03',
        '2026-03-10',
        '2026-03-17',
        '2026-03-24',
      ]
      const result = scheduleBadDays(dates, 2)
      expect(result.size).toBe(4) // 2 from Feb + 2 from Mar
    })

    it('limits bad days to available dates per month', () => {
      // Only 2 dates in Feb, but requesting 3 bad days → can only pick 2
      const dates = ['2026-02-01', '2026-02-05']
      const result = scheduleBadDays(dates, 3)
      expect(result.size).toBe(2)
    })

    it('returns valid date strings from input', () => {
      const dates = ['2026-02-01', '2026-02-05', '2026-02-10']
      const result = scheduleBadDays(dates, 1)
      expect(result.size).toBe(1)
      const badDay = Array.from(result)[0]
      expect(dates).toContain(badDay)
    })
  })

  describe('computeLateStartDelay', () => {
    it('returns 0 when disabled', () => {
      const profile = createProfile()
      const result = computeLateStartDelay(profile, false)
      expect(result).toBe(0)
    })

    it('returns 0 when enabled but frequency roll fails', () => {
      const profile = createProfile({
        outliers: {
          ...createProfile().outliers,
          lateStarts: { enabled: true, frequency: 20, magnitude: 2 },
        },
      })
      // Mock Math.random to fail the frequency check (> 20%)
      Math.random = vi.fn(() => 0.3) // 30 > 20, should not fire
      const result = computeLateStartDelay(profile, false)
      expect(result).toBe(0)
    })

    it('returns value in range when enabled and frequency fires', () => {
      const profile = createProfile({
        outliers: {
          ...createProfile().outliers,
          lateStarts: { enabled: true, frequency: 20, magnitude: 2 },
        },
      })
      // Mock Math.random: first call for shouldFire (pass), second for randomInt
      let callCount = 0
      Math.random = vi.fn(() => {
        callCount++
        if (callCount === 1) return 0.1 // 10% < 20%, fires
        return 0.5 // mid-range for randomInt
      })
      const result = computeLateStartDelay(profile, false)
      // Magnitude 2 → range 20-35 min
      expect(result).toBeGreaterThanOrEqual(20)
      expect(result).toBeLessThanOrEqual(35)
    })

    it('forces 100% frequency and magnitude 3 on bad days', () => {
      const profile = createProfile({
        outliers: {
          ...createProfile().outliers,
          lateStarts: { enabled: true, frequency: 5, magnitude: 1 },
        },
      })
      // Mock Math.random: first call for shouldFire (always pass on bad day), second for randomInt
      let callCount = 0
      Math.random = vi.fn(() => {
        callCount++
        if (callCount === 1) return 0.99 // Even 99% < 100%, fires
        return 0.5 // mid-range for randomInt
      })
      const result = computeLateStartDelay(profile, true)
      // Bad day → magnitude 3 → range 30-45 min
      expect(result).toBeGreaterThanOrEqual(30)
      expect(result).toBeLessThanOrEqual(45)
    })
  })

  describe('computeCascadeDelay', () => {
    it('returns 0 when disabled', () => {
      const profile = createProfile()
      const result = computeCascadeDelay(profile, false)
      expect(result).toBe(0)
    })

    it('returns value in range when enabled', () => {
      const profile = createProfile({
        outliers: {
          ...createProfile().outliers,
          lateStarts: { enabled: true, frequency: 20, magnitude: 2 },
        },
      })
      Math.random = vi.fn(() => 0.5)
      const result = computeCascadeDelay(profile, false)
      // Magnitude 2 → cascade range 5-12 min
      expect(result).toBeGreaterThanOrEqual(5)
      expect(result).toBeLessThanOrEqual(12)
    })

    it('uses magnitude 3 on bad days', () => {
      const profile = createProfile({
        outliers: {
          ...createProfile().outliers,
          lateStarts: { enabled: true, frequency: 20, magnitude: 1 },
        },
      })
      Math.random = vi.fn(() => 0.5)
      const result = computeCascadeDelay(profile, true)
      // Bad day → magnitude 3 → cascade range 8-15 min
      expect(result).toBeGreaterThanOrEqual(8)
      expect(result).toBeLessThanOrEqual(15)
    })
  })

  describe('adjustSurgicalTime', () => {
    it('returns base time when both extended and fast are disabled', () => {
      const profile = createProfile()
      const result = adjustSurgicalTime(profile, 120, false)
      expect(result).toBe(120)
    })

    it('increases time for extended phases', () => {
      const profile = createProfile({
        outliers: {
          ...createProfile().outliers,
          extendedPhases: { enabled: true, frequency: 50, magnitude: 2 },
        },
      })
      let callCount = 0
      Math.random = vi.fn(() => {
        callCount++
        if (callCount === 1) return 0.3 // 30% < 50%, fires
        return 0.5 // mid-range → ~57.5% over base
      })
      const result = adjustSurgicalTime(profile, 100, false)
      // Magnitude 2 → 50-65% over → 150-165 min
      expect(result).toBeGreaterThan(100)
      expect(result).toBeGreaterThanOrEqual(150)
      expect(result).toBeLessThanOrEqual(165)
    })

    it('decreases time for fast cases', () => {
      const profile = createProfile({
        outliers: {
          ...createProfile().outliers,
          fastCases: { enabled: true, frequency: 40, magnitude: 2 },
        },
      })
      let callCount = 0
      Math.random = vi.fn(() => {
        callCount++
        if (callCount === 1) return 0.2 // 20% < 40%, fires
        return 0.5 // mid-range → ~20% faster
      })
      const result = adjustSurgicalTime(profile, 100, false)
      // Magnitude 2 → 18-22% faster → 78-82 min
      expect(result).toBeLessThan(100)
      expect(result).toBeGreaterThanOrEqual(78)
      expect(result).toBeLessThanOrEqual(82)
    })

    it('extended phases take precedence over fast cases', () => {
      const profile = createProfile({
        outliers: {
          ...createProfile().outliers,
          extendedPhases: { enabled: true, frequency: 100, magnitude: 2 },
          fastCases: { enabled: true, frequency: 100, magnitude: 2 },
        },
      })
      Math.random = vi.fn(() => 0.5)
      const result = adjustSurgicalTime(profile, 100, false)
      // Extended fires first → case is LONGER, not shorter
      expect(result).toBeGreaterThan(100)
    })

    it('fast cases can fire if extended does not fire', () => {
      const profile = createProfile({
        outliers: {
          ...createProfile().outliers,
          extendedPhases: { enabled: true, frequency: 10, magnitude: 2 },
          fastCases: { enabled: true, frequency: 100, magnitude: 2 },
        },
      })
      let callCount = 0
      Math.random = vi.fn(() => {
        callCount++
        if (callCount === 1) return 0.95 // 95% > 10%, extended does NOT fire
        if (callCount === 2) return 0.05 // 5% < 100%, fast DOES fire
        return 0.5
      })
      const result = adjustSurgicalTime(profile, 100, false)
      // Fast fires → case is SHORTER
      expect(result).toBeLessThan(100)
    })

    it('forces maximum magnitude on bad days', () => {
      const profile = createProfile({
        outliers: {
          ...createProfile().outliers,
          extendedPhases: { enabled: true, frequency: 10, magnitude: 1 },
        },
      })
      let callCount = 0
      Math.random = vi.fn(() => {
        callCount++
        if (callCount === 1) return 0.5 // Fires (100% on bad day)
        return 0.5
      })
      const result = adjustSurgicalTime(profile, 100, true)
      // Bad day → magnitude 3 → 60-80% over → 160-180 min
      expect(result).toBeGreaterThanOrEqual(160)
      expect(result).toBeLessThanOrEqual(180)
    })
  })

  describe('adjustTurnoverTime', () => {
    it('returns base time when disabled', () => {
      const profile = createProfile()
      const result = adjustTurnoverTime(profile, 18, false)
      expect(result).toBe(18)
    })

    it('returns base time when enabled but frequency roll fails', () => {
      const profile = createProfile({
        outliers: {
          ...createProfile().outliers,
          longTurnovers: { enabled: true, frequency: 15, magnitude: 2 },
        },
      })
      Math.random = vi.fn(() => 0.3) // 30% > 15%, does not fire
      const result = adjustTurnoverTime(profile, 18, false)
      expect(result).toBe(18)
    })

    it('returns higher value when enabled and frequency fires', () => {
      const profile = createProfile({
        outliers: {
          ...createProfile().outliers,
          longTurnovers: { enabled: true, frequency: 15, magnitude: 2 },
        },
      })
      let callCount = 0
      Math.random = vi.fn(() => {
        callCount++
        if (callCount === 1) return 0.1 // 10% < 15%, fires
        return 0.5 // mid-range
      })
      const result = adjustTurnoverTime(profile, 18, false)
      // Magnitude 2 → 30-45 min (replaces base time)
      expect(result).toBeGreaterThanOrEqual(30)
      expect(result).toBeLessThanOrEqual(45)
    })

    it('forces magnitude 3 on bad days', () => {
      const profile = createProfile({
        outliers: {
          ...createProfile().outliers,
          longTurnovers: { enabled: true, frequency: 10, magnitude: 1 },
        },
      })
      let callCount = 0
      Math.random = vi.fn(() => {
        callCount++
        if (callCount === 1) return 0.5 // Fires (100% on bad day)
        return 0.5
      })
      const result = adjustTurnoverTime(profile, 18, true)
      // Bad day → magnitude 3 → 45-60 min
      expect(result).toBeGreaterThanOrEqual(45)
      expect(result).toBeLessThanOrEqual(60)
    })
  })

  describe('computeCallbackDelay', () => {
    it('returns 0 when disabled', () => {
      const profile = createProfile()
      const result = computeCallbackDelay(profile, false)
      expect(result).toBe(0)
    })

    it('returns 0 when enabled but frequency roll fails', () => {
      const profile = createProfile({
        outliers: {
          ...createProfile().outliers,
          callbackDelays: { enabled: true, frequency: 12, magnitude: 2 },
        },
      })
      Math.random = vi.fn(() => 0.5) // 50% > 12%, does not fire
      const result = computeCallbackDelay(profile, false)
      expect(result).toBe(0)
    })

    it('returns value in range when enabled and frequency fires', () => {
      const profile = createProfile({
        outliers: {
          ...createProfile().outliers,
          callbackDelays: { enabled: true, frequency: 12, magnitude: 2 },
        },
      })
      let callCount = 0
      Math.random = vi.fn(() => {
        callCount++
        if (callCount === 1) return 0.05 // 5% < 12%, fires
        return 0.5 // mid-range
      })
      const result = computeCallbackDelay(profile, false)
      // Magnitude 2 → 15-20 min
      expect(result).toBeGreaterThanOrEqual(15)
      expect(result).toBeLessThanOrEqual(20)
    })

    it('forces magnitude 3 on bad days', () => {
      const profile = createProfile({
        outliers: {
          ...createProfile().outliers,
          callbackDelays: { enabled: true, frequency: 8, magnitude: 1 },
        },
      })
      let callCount = 0
      Math.random = vi.fn(() => {
        callCount++
        if (callCount === 1) return 0.5 // Fires (100% on bad day)
        return 0.5
      })
      const result = computeCallbackDelay(profile, true)
      // Bad day → magnitude 3 → 20-25 min
      expect(result).toBeGreaterThanOrEqual(20)
      expect(result).toBeLessThanOrEqual(25)
    })
  })

  describe('hasAnyOutlierEnabled', () => {
    it('returns false when all outliers are disabled', () => {
      const profile = createProfile()
      expect(hasAnyOutlierEnabled(profile)).toBe(false)
    })

    it('returns true when lateStarts is enabled', () => {
      const profile = createProfile({
        outliers: {
          ...createProfile().outliers,
          lateStarts: { enabled: true, frequency: 20, magnitude: 2 },
        },
      })
      expect(hasAnyOutlierEnabled(profile)).toBe(true)
    })

    it('returns true when longTurnovers is enabled', () => {
      const profile = createProfile({
        outliers: {
          ...createProfile().outliers,
          longTurnovers: { enabled: true, frequency: 15, magnitude: 2 },
        },
      })
      expect(hasAnyOutlierEnabled(profile)).toBe(true)
    })

    it('returns true when extendedPhases is enabled', () => {
      const profile = createProfile({
        outliers: {
          ...createProfile().outliers,
          extendedPhases: { enabled: true, frequency: 10, magnitude: 2 },
        },
      })
      expect(hasAnyOutlierEnabled(profile)).toBe(true)
    })

    it('returns true when callbackDelays is enabled', () => {
      const profile = createProfile({
        outliers: {
          ...createProfile().outliers,
          callbackDelays: { enabled: true, frequency: 12, magnitude: 2 },
        },
      })
      expect(hasAnyOutlierEnabled(profile)).toBe(true)
    })

    it('returns true when fastCases is enabled', () => {
      const profile = createProfile({
        outliers: {
          ...createProfile().outliers,
          fastCases: { enabled: true, frequency: 8, magnitude: 2 },
        },
      })
      expect(hasAnyOutlierEnabled(profile)).toBe(true)
    })

    it('returns true when multiple outliers are enabled', () => {
      const profile = createProfile({
        outliers: {
          ...createProfile().outliers,
          lateStarts: { enabled: true, frequency: 20, magnitude: 2 },
          extendedPhases: { enabled: true, frequency: 10, magnitude: 2 },
        },
      })
      expect(hasAnyOutlierEnabled(profile)).toBe(true)
    })
  })
})
