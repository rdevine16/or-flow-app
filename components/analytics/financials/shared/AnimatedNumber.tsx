'use client'

// Animated counter with requestAnimationFrame + ease-out cubic
// Used for hero KPI values

import { useState, useEffect, useRef } from 'react'

interface AnimatedNumberProps {
  value: number
  prefix?: string
  duration?: number
}

export function AnimatedNumber({ value, prefix = '$', duration = 800 }: AnimatedNumberProps) {
  const [display, setDisplay] = useState(0)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const start = performance.now()

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      // Ease-out cubic: 1 - (1 - p)^3
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(eased * value))

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [value, duration])

  return (
    <span>
      {prefix}{display.toLocaleString()}
    </span>
  )
}
