import { describe, it, expect } from 'vitest'
import {
  computeElapsedMs,
  computeDurationMinutes,
  createIdleSnapshot,
  startTimer,
  pauseTimer,
  resumeTimer,
  finalizeTimer,
  type DelayTimerSnapshot,
} from '../delay-timer'

// ============================================
// HELPERS
// ============================================

const T0 = 1_000_000_000_000 // arbitrary base timestamp

// ============================================
// UNIT TESTS: createIdleSnapshot
// ============================================

describe('createIdleSnapshot — unit', () => {
  it('should return idle state with zeroed values', () => {
    const s = createIdleSnapshot()
    expect(s.state).toBe('idle')
    expect(s.startedAt).toBeNull()
    expect(s.accumulatedMs).toBe(0)
  })
})

// ============================================
// UNIT TESTS: startTimer
// ============================================

describe('startTimer — unit', () => {
  it('should return running state with startedAt set to now', () => {
    const s = startTimer(T0)
    expect(s.state).toBe('running')
    expect(s.startedAt).toBe(T0)
    expect(s.accumulatedMs).toBe(0)
  })
})

// ============================================
// UNIT TESTS: pauseTimer
// ============================================

describe('pauseTimer — unit', () => {
  it('should transition running → paused and accumulate elapsed time', () => {
    const running: DelayTimerSnapshot = { state: 'running', startedAt: T0, accumulatedMs: 0 }
    const paused = pauseTimer(running, T0 + 30_000) // 30 seconds later
    expect(paused.state).toBe('paused')
    expect(paused.startedAt).toBeNull()
    expect(paused.accumulatedMs).toBe(30_000)
  })

  it('should accumulate on top of existing accumulatedMs', () => {
    const running: DelayTimerSnapshot = { state: 'running', startedAt: T0, accumulatedMs: 60_000 }
    const paused = pauseTimer(running, T0 + 15_000)
    expect(paused.accumulatedMs).toBe(75_000)
  })

  it('should return snapshot unchanged if not running', () => {
    const idle = createIdleSnapshot()
    expect(pauseTimer(idle, T0)).toBe(idle)
  })

  it('should return snapshot unchanged if paused', () => {
    const paused: DelayTimerSnapshot = { state: 'paused', startedAt: null, accumulatedMs: 10_000 }
    expect(pauseTimer(paused, T0)).toBe(paused)
  })

  it('should handle zero elapsed (immediate pause)', () => {
    const running: DelayTimerSnapshot = { state: 'running', startedAt: T0, accumulatedMs: 0 }
    const paused = pauseTimer(running, T0)
    expect(paused.accumulatedMs).toBe(0)
    expect(paused.state).toBe('paused')
  })
})

// ============================================
// UNIT TESTS: resumeTimer
// ============================================

describe('resumeTimer — unit', () => {
  it('should transition paused → running with accumulated preserved', () => {
    const paused: DelayTimerSnapshot = { state: 'paused', startedAt: null, accumulatedMs: 45_000 }
    const resumed = resumeTimer(paused, T0 + 100_000)
    expect(resumed.state).toBe('running')
    expect(resumed.startedAt).toBe(T0 + 100_000)
    expect(resumed.accumulatedMs).toBe(45_000)
  })

  it('should return snapshot unchanged if not paused', () => {
    const running: DelayTimerSnapshot = { state: 'running', startedAt: T0, accumulatedMs: 0 }
    expect(resumeTimer(running, T0 + 1000)).toBe(running)
  })

  it('should return snapshot unchanged if idle', () => {
    const idle = createIdleSnapshot()
    expect(resumeTimer(idle, T0)).toBe(idle)
  })
})

// ============================================
// UNIT TESTS: computeElapsedMs
// ============================================

describe('computeElapsedMs — unit', () => {
  it('should return 0 for idle snapshot', () => {
    expect(computeElapsedMs(createIdleSnapshot(), T0)).toBe(0)
  })

  it('should return accumulated + current segment for running timer', () => {
    const running: DelayTimerSnapshot = { state: 'running', startedAt: T0, accumulatedMs: 10_000 }
    expect(computeElapsedMs(running, T0 + 5_000)).toBe(15_000)
  })

  it('should return only accumulated for paused timer', () => {
    const paused: DelayTimerSnapshot = { state: 'paused', startedAt: null, accumulatedMs: 30_000 }
    expect(computeElapsedMs(paused, T0 + 999_999)).toBe(30_000) // now is irrelevant
  })

  it('should never return negative (clock skew protection)', () => {
    const running: DelayTimerSnapshot = { state: 'running', startedAt: T0 + 100, accumulatedMs: 0 }
    expect(computeElapsedMs(running, T0)).toBe(0) // now < startedAt
  })

  it('should return accumulated when startedAt is null in idle', () => {
    const snap: DelayTimerSnapshot = { state: 'idle', startedAt: null, accumulatedMs: 5_000 }
    expect(computeElapsedMs(snap, T0)).toBe(5_000)
  })
})

// ============================================
// UNIT TESTS: computeDurationMinutes
// ============================================

describe('computeDurationMinutes — unit', () => {
  it('should return 0 for 0ms', () => {
    expect(computeDurationMinutes(0)).toBe(0)
  })

  it('should return 0 for negative values', () => {
    expect(computeDurationMinutes(-5000)).toBe(0)
  })

  it('should return 1 for anything under 30 seconds (minimum 1 minute)', () => {
    expect(computeDurationMinutes(1000)).toBe(1) // 1 second → 1 min minimum
    expect(computeDurationMinutes(29_999)).toBe(1) // 29.999s → rounds to 0, but min is 1
  })

  it('should round to nearest minute', () => {
    expect(computeDurationMinutes(90_000)).toBe(2) // 1.5 min → rounds to 2
    expect(computeDurationMinutes(60_000)).toBe(1) // exactly 1 min
    expect(computeDurationMinutes(150_000)).toBe(3) // 2.5 min → rounds to 3
  })

  it('should handle large values (hours)', () => {
    expect(computeDurationMinutes(3_600_000)).toBe(60) // 1 hour
    expect(computeDurationMinutes(5_400_000)).toBe(90) // 1.5 hours
  })
})

// ============================================
// UNIT TESTS: finalizeTimer
// ============================================

describe('finalizeTimer — unit', () => {
  it('should return total elapsed for a running timer', () => {
    const running: DelayTimerSnapshot = { state: 'running', startedAt: T0, accumulatedMs: 60_000 }
    expect(finalizeTimer(running, T0 + 30_000)).toBe(90_000)
  })

  it('should return accumulated for a paused timer', () => {
    const paused: DelayTimerSnapshot = { state: 'paused', startedAt: null, accumulatedMs: 120_000 }
    expect(finalizeTimer(paused, T0)).toBe(120_000)
  })

  it('should return 0 for an idle timer', () => {
    expect(finalizeTimer(createIdleSnapshot(), T0)).toBe(0)
  })
})

// ============================================
// INTEGRATION: pause/resume cycles
// ============================================

describe('delay timer — integration: pause/resume cycles', () => {
  it('should accumulate across one pause/resume cycle', () => {
    // Start at T0
    const s1 = startTimer(T0)
    // Run for 2 minutes, then pause
    const s2 = pauseTimer(s1, T0 + 120_000)
    expect(s2.accumulatedMs).toBe(120_000)
    // Resume at T0 + 3 minutes
    const s3 = resumeTimer(s2, T0 + 180_000)
    // Run for 1 more minute — total should be 3 minutes (2 + 1)
    const elapsed = computeElapsedMs(s3, T0 + 240_000)
    expect(elapsed).toBe(180_000) // 3 minutes
  })

  it('should accumulate across multiple pause/resume cycles', () => {
    // Start
    const s1 = startTimer(T0)
    // Run 1 min → pause
    const s2 = pauseTimer(s1, T0 + 60_000)
    // Resume
    const s3 = resumeTimer(s2, T0 + 120_000)
    // Run 1 min → pause
    const s4 = pauseTimer(s3, T0 + 180_000)
    // Resume
    const s5 = resumeTimer(s4, T0 + 240_000)
    // Run 1 min → finalize
    const elapsed = finalizeTimer(s5, T0 + 300_000)
    expect(elapsed).toBe(180_000) // 3 minutes of actual running
  })

  it('should give correct duration after pause/resume cycle', () => {
    const s1 = startTimer(T0)
    const s2 = pauseTimer(s1, T0 + 90_000) // 1.5 min
    const s3 = resumeTimer(s2, T0 + 200_000)
    const elapsed = finalizeTimer(s3, T0 + 290_000) // +1.5 min more
    expect(computeDurationMinutes(elapsed)).toBe(3) // 3 minutes total
  })
})

// ============================================
// INTEGRATION: immutability
// ============================================

describe('delay timer — integration: immutability', () => {
  it('should not mutate the original snapshot on pause', () => {
    const s1 = startTimer(T0)
    const s1Copy = { ...s1 }
    pauseTimer(s1, T0 + 10_000)
    expect(s1).toEqual(s1Copy)
  })

  it('should not mutate the original snapshot on resume', () => {
    const s1: DelayTimerSnapshot = { state: 'paused', startedAt: null, accumulatedMs: 5000 }
    const s1Copy = { ...s1 }
    resumeTimer(s1, T0)
    expect(s1).toEqual(s1Copy)
  })
})

// ============================================
// WORKFLOW: full delay timer scenarios
// ============================================

describe('delay timer — workflow', () => {
  it('should handle a complete start → pause → resume → stop flow', () => {
    // Surgeon starts timing a delay
    const s1 = startTimer(T0)
    expect(s1.state).toBe('running')

    // After 5 minutes, delay is temporarily resolved
    const s2 = pauseTimer(s1, T0 + 300_000)
    expect(s2.state).toBe('paused')
    expect(computeElapsedMs(s2, T0 + 999_999)).toBe(300_000)

    // Delay resumes 2 minutes later
    const s3 = resumeTimer(s2, T0 + 420_000)
    expect(s3.state).toBe('running')

    // Delay resolved 3 more minutes later — stop
    const elapsed = finalizeTimer(s3, T0 + 600_000)
    expect(elapsed).toBe(480_000) // 5 + 3 = 8 minutes of actual delay
    expect(computeDurationMinutes(elapsed)).toBe(8)
  })

  it('should handle start → immediate stop (very short delay)', () => {
    const s1 = startTimer(T0)
    const elapsed = finalizeTimer(s1, T0 + 15_000) // 15 seconds
    expect(computeDurationMinutes(elapsed)).toBe(1) // minimum 1 minute
  })

  it('should handle start → stop without any pauses', () => {
    const s1 = startTimer(T0)
    const elapsed = finalizeTimer(s1, T0 + 600_000) // 10 minutes
    expect(computeDurationMinutes(elapsed)).toBe(10)
  })
})
