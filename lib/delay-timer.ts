// lib/delay-timer.ts
// Pure timer calculation utilities for the delay timer feature.
// All functions are pure (no React or side-effect dependencies) for testability.

export type DelayTimerState = 'idle' | 'running' | 'paused'

export interface DelayTimerSnapshot {
  state: DelayTimerState
  /** Date.now() when timer was last started/resumed */
  startedAt: number | null
  /** Total ms accumulated across pause/resume cycles (excludes current running segment) */
  accumulatedMs: number
}

/**
 * Compute total elapsed milliseconds from a timer snapshot.
 * Pure function — depends only on inputs.
 */
export function computeElapsedMs(snapshot: DelayTimerSnapshot, now: number): number {
  if (snapshot.state === 'idle' || !snapshot.startedAt) {
    return snapshot.accumulatedMs
  }

  if (snapshot.state === 'paused') {
    return snapshot.accumulatedMs
  }

  // Running: accumulated + time since last start/resume
  const currentSegment = now - snapshot.startedAt
  return snapshot.accumulatedMs + Math.max(0, currentSegment)
}

/**
 * Convert elapsed milliseconds to whole minutes (rounded to nearest).
 * Minimum 1 minute if any time has elapsed.
 */
export function computeDurationMinutes(elapsedMs: number): number {
  if (elapsedMs <= 0) return 0
  return Math.max(1, Math.round(elapsedMs / 60000))
}

/**
 * Create initial idle snapshot.
 */
export function createIdleSnapshot(): DelayTimerSnapshot {
  return {
    state: 'idle',
    startedAt: null,
    accumulatedMs: 0,
  }
}

/**
 * Transition: idle → running.
 */
export function startTimer(now: number): DelayTimerSnapshot {
  return {
    state: 'running',
    startedAt: now,
    accumulatedMs: 0,
  }
}

/**
 * Transition: running → paused.
 * Captures the current running segment into accumulatedMs.
 */
export function pauseTimer(snapshot: DelayTimerSnapshot, now: number): DelayTimerSnapshot {
  if (snapshot.state !== 'running' || !snapshot.startedAt) return snapshot

  const currentSegment = now - snapshot.startedAt
  return {
    state: 'paused',
    startedAt: null,
    accumulatedMs: snapshot.accumulatedMs + Math.max(0, currentSegment),
  }
}

/**
 * Transition: paused → running.
 * Keeps accumulated time, starts a new running segment.
 */
export function resumeTimer(snapshot: DelayTimerSnapshot, now: number): DelayTimerSnapshot {
  if (snapshot.state !== 'paused') return snapshot

  return {
    state: 'running',
    startedAt: now,
    accumulatedMs: snapshot.accumulatedMs,
  }
}

/**
 * Compute final elapsed time from any active state.
 * Does not mutate — caller is responsible for resetting state.
 */
export function finalizeTimer(snapshot: DelayTimerSnapshot, now: number): number {
  return computeElapsedMs(snapshot, now)
}
