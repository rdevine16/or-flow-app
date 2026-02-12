import { describe, it, expect } from 'vitest'
import { computeMilestonePace, MIN_SAMPLE_SIZE, type MilestonePaceInfo } from '../pace-utils'

// ============================================
// computeMilestonePace — per-milestone pace calculation
// ============================================

describe('computeMilestonePace', () => {
  // ---- UNIT TESTS ----

  it('should compute positive variance when actual is faster than expected', () => {
    const result = computeMilestonePace(20, 15, 25)
    expect(result.expectedMinutes).toBe(20)
    expect(result.actualMinutes).toBe(15)
    expect(result.varianceMinutes).toBe(5) // 5 min ahead
    expect(result.sampleSize).toBe(25)
  })

  it('should compute negative variance when actual is slower than expected', () => {
    const result = computeMilestonePace(20, 28, 25)
    expect(result.expectedMinutes).toBe(20)
    expect(result.actualMinutes).toBe(28)
    expect(result.varianceMinutes).toBe(-8) // 8 min behind
  })

  it('should compute zero variance when actual equals expected', () => {
    const result = computeMilestonePace(20, 20, 25)
    expect(result.varianceMinutes).toBe(0) // on pace
  })

  it('should round fractional minutes', () => {
    const result = computeMilestonePace(20.7, 15.3, 12)
    expect(result.expectedMinutes).toBe(21)
    expect(result.actualMinutes).toBe(15)
    expect(result.varianceMinutes).toBe(5) // rounded: 21 - 15 = 6? No, Math.round(20.7 - 15.3) = Math.round(5.4) = 5
  })

  it('should handle zero expected minutes', () => {
    const result = computeMilestonePace(0, 0, 25)
    expect(result.expectedMinutes).toBe(0)
    expect(result.actualMinutes).toBe(0)
    expect(result.varianceMinutes).toBe(0)
  })

  it('should handle large values', () => {
    const result = computeMilestonePace(180, 200, 50)
    expect(result.varianceMinutes).toBe(-20) // 20 min behind
  })

  it('should preserve sampleSize from input', () => {
    const result = computeMilestonePace(20, 15, 42)
    expect(result.sampleSize).toBe(42)
  })

  it('should return correct type structure', () => {
    const result: MilestonePaceInfo = computeMilestonePace(10, 8, 15)
    expect(result).toHaveProperty('expectedMinutes')
    expect(result).toHaveProperty('actualMinutes')
    expect(result).toHaveProperty('varianceMinutes')
    expect(result).toHaveProperty('sampleSize')
    expect(typeof result.expectedMinutes).toBe('number')
    expect(typeof result.actualMinutes).toBe('number')
    expect(typeof result.varianceMinutes).toBe('number')
    expect(typeof result.sampleSize).toBe('number')
  })
})

// ============================================
// MIN_SAMPLE_SIZE — insufficient data threshold
// ============================================

describe('MIN_SAMPLE_SIZE', () => {
  it('should be 10', () => {
    expect(MIN_SAMPLE_SIZE).toBe(10)
  })

  it('should correctly identify insufficient data', () => {
    const result = computeMilestonePace(20, 15, 5)
    expect(result.sampleSize < MIN_SAMPLE_SIZE).toBe(true)
  })

  it('should correctly identify sufficient data', () => {
    const result = computeMilestonePace(20, 15, 10)
    expect(result.sampleSize >= MIN_SAMPLE_SIZE).toBe(true)
  })

  it('should correctly identify boundary case (exactly 10)', () => {
    const result = computeMilestonePace(20, 15, 10)
    expect(result.sampleSize >= MIN_SAMPLE_SIZE).toBe(true)
  })
})

// ============================================
// Integration: Paired milestone duration calculation
// ============================================

describe('computeMilestonePace — paired milestone duration', () => {
  it('should compute correct pace for paired milestone duration (ahead)', () => {
    // Anesthesia: expected 18 min, actual 15 min
    const expectedDuration = 18 // closing median - incision median
    const actualDuration = 15
    const result = computeMilestonePace(expectedDuration, actualDuration, 30)
    expect(result.varianceMinutes).toBe(3) // 3 min ahead
  })

  it('should compute correct pace for paired milestone duration (behind)', () => {
    const expectedDuration = 18
    const actualDuration = 25
    const result = computeMilestonePace(expectedDuration, actualDuration, 30)
    expect(result.varianceMinutes).toBe(-7) // 7 min behind
  })

  it('should handle paired milestone with millisecond precision', () => {
    // Real-world: actualMs from Date subtraction / 60000
    const actualMs = 900000 // 15 min in ms
    const actualMinutes = actualMs / 60000
    const result = computeMilestonePace(18, actualMinutes, 30)
    expect(result.actualMinutes).toBe(15)
    expect(result.varianceMinutes).toBe(3)
  })
})

// ============================================
// Workflow: Full milestone pace tracking scenario
// ============================================

describe('computeMilestonePace — full case workflow', () => {
  it('should track pace across multiple milestones in sequence', () => {
    // Patient In at time 0 (no pace for patient_in — it IS the start)
    const patientInTime = new Date('2025-01-15T08:00:00Z').getTime()

    // Incision at 20 min (expected 25 min from start)
    const incisionTime = new Date('2025-01-15T08:20:00Z').getTime()
    const incisionActual = (incisionTime - patientInTime) / 60000 // 20 min
    const incisionPace = computeMilestonePace(25, incisionActual, 30)
    expect(incisionPace.varianceMinutes).toBe(5) // 5 min ahead

    // Closing at 80 min (expected 90 min from start)
    const closingTime = new Date('2025-01-15T09:20:00Z').getTime()
    const closingActual = (closingTime - patientInTime) / 60000 // 80 min
    const closingPace = computeMilestonePace(90, closingActual, 30)
    expect(closingPace.varianceMinutes).toBe(10) // 10 min ahead

    // Patient Out at 100 min (expected 110 min from start)
    const patientOutTime = new Date('2025-01-15T09:40:00Z').getTime()
    const patientOutActual = (patientOutTime - patientInTime) / 60000 // 100 min
    const patientOutPace = computeMilestonePace(110, patientOutActual, 30)
    expect(patientOutPace.varianceMinutes).toBe(10) // 10 min ahead

    // Surgical time (paired): incision to closing
    const surgicalExpected = 90 - 25 // 65 min
    const surgicalActual = (closingTime - incisionTime) / 60000 // 60 min
    const surgicalPace = computeMilestonePace(surgicalExpected, surgicalActual, 30)
    expect(surgicalPace.varianceMinutes).toBe(5) // 5 min ahead
  })

  it('should handle a case running behind schedule', () => {
    const patientInTime = new Date('2025-01-15T08:00:00Z').getTime()

    // Incision at 35 min (expected 25 min) — behind
    const incisionTime = new Date('2025-01-15T08:35:00Z').getTime()
    const incisionActual = (incisionTime - patientInTime) / 60000
    const incisionPace = computeMilestonePace(25, incisionActual, 30)
    expect(incisionPace.varianceMinutes).toBe(-10) // 10 min behind

    // Patient Out at 130 min (expected 110 min) — still behind
    const patientOutTime = new Date('2025-01-15T10:10:00Z').getTime()
    const patientOutActual = (patientOutTime - patientInTime) / 60000
    const patientOutPace = computeMilestonePace(110, patientOutActual, 30)
    expect(patientOutPace.varianceMinutes).toBe(-20) // 20 min behind
  })
})
