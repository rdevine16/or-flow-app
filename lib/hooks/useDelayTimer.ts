// lib/hooks/useDelayTimer.ts
// Custom hook for delay timer state management.
// Wraps pure functions from lib/delay-timer.ts with React state and a 1-second tick.

import { useState, useRef, useCallback, useEffect } from 'react'
import {
  DelayTimerState,
  DelayTimerSnapshot,
  createIdleSnapshot,
  startTimer,
  pauseTimer,
  resumeTimer,
  computeElapsedMs,
  computeDurationMinutes,
  finalizeTimer,
} from '@/lib/delay-timer'

export interface UseDelayTimerReturn {
  state: DelayTimerState
  elapsedMs: number
  durationMinutes: number
  /** true when timer is running or paused (not idle) */
  isActive: boolean
  start: () => void
  pause: () => void
  resume: () => void
  /** Stops the timer and returns the final duration in minutes */
  stop: () => number
  reset: () => void
}

export function useDelayTimer(): UseDelayTimerReturn {
  const [snapshot, setSnapshot] = useState<DelayTimerSnapshot>(createIdleSnapshot)
  const [now, setNow] = useState(Date.now)
  const snapshotRef = useRef<DelayTimerSnapshot>(createIdleSnapshot())
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Keep ref in sync with state for synchronous reads in stop()
  useEffect(() => {
    snapshotRef.current = snapshot
  }, [snapshot])

  // Tick every second while running
  useEffect(() => {
    if (snapshot.state === 'running') {
      intervalRef.current = setInterval(() => {
        setNow(Date.now())
      }, 1000)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [snapshot.state])

  const elapsedMs = computeElapsedMs(snapshot, now)
  const durationMinutes = computeDurationMinutes(elapsedMs)
  const isActive = snapshot.state !== 'idle'

  const start = useCallback(() => {
    const t = Date.now()
    const next = startTimer(t)
    snapshotRef.current = next
    setSnapshot(next)
    setNow(t)
  }, [])

  const pause = useCallback(() => {
    const t = Date.now()
    const next = pauseTimer(snapshotRef.current, t)
    snapshotRef.current = next
    setSnapshot(next)
    setNow(t)
  }, [])

  const resume = useCallback(() => {
    const t = Date.now()
    const next = resumeTimer(snapshotRef.current, t)
    snapshotRef.current = next
    setSnapshot(next)
    setNow(t)
  }, [])

  const stop = useCallback((): number => {
    const t = Date.now()
    const finalElapsed = finalizeTimer(snapshotRef.current, t)
    const idle = createIdleSnapshot()
    snapshotRef.current = idle
    setSnapshot(idle)
    setNow(t)
    return computeDurationMinutes(finalElapsed)
  }, [])

  const reset = useCallback(() => {
    const idle = createIdleSnapshot()
    snapshotRef.current = idle
    setSnapshot(idle)
    setNow(Date.now())
  }, [])

  return {
    state: snapshot.state,
    elapsedMs,
    durationMinutes,
    isActive,
    start,
    pause,
    resume,
    stop,
    reset,
  }
}
