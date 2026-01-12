// hooks/useElapsedTime.ts
// Custom hook for live elapsed time display - updates every second

import { useState, useEffect, useCallback } from 'react'
import { formatElapsedTime } from '../lib/pace-utils'

interface UseElapsedTimeResult {
  elapsedSeconds: number
  formattedTime: string
  isRunning: boolean
}

/**
 * Hook that tracks elapsed time from a start date
 * Updates every second while the component is mounted
 * 
 * @param startTime - The Date when the timer started (e.g., patient_in milestone)
 * @param isActive - Whether the timer should be running (e.g., case is in_progress)
 */
export function useElapsedTime(
  startTime: Date | null,
  isActive: boolean = true
): UseElapsedTimeResult {
  const calculateElapsed = useCallback(() => {
    if (!startTime) return 0
    return Math.max(0, Math.floor((Date.now() - startTime.getTime()) / 1000))
  }, [startTime])

  const [elapsedSeconds, setElapsedSeconds] = useState<number>(calculateElapsed)

  useEffect(() => {
    // Update immediately when startTime changes
    setElapsedSeconds(calculateElapsed())

    // Only run interval if we have a start time and timer is active
    if (!startTime || !isActive) return

    const interval = setInterval(() => {
      setElapsedSeconds(calculateElapsed())
    }, 1000)

    return () => clearInterval(interval)
  }, [startTime, isActive, calculateElapsed])

  return {
    elapsedSeconds,
    formattedTime: formatElapsedTime(elapsedSeconds),
    isRunning: isActive && startTime !== null
  }
}

/**
 * Hook for tracking current time (for pace calculations)
 * Updates every second
 */
export function useCurrentTime(): Date {
  const [currentTime, setCurrentTime] = useState<Date>(new Date())

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  return currentTime
}
