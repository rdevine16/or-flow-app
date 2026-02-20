'use client'

// Animated counter with requestAnimationFrame + ease-out cubic
// Used for hero KPI values. Animates from previous value on change.

import { useState, useEffect, useRef } from 'react'

interface AnimatedNumberProps {
  value: number
  prefix?: string
  suffix?: string
  decimals?: number
  duration?: number
}

export function AnimatedNumber({
  value,
  prefix = '$',
  suffix,
  decimals = 0,
  duration = 800,
}: AnimatedNumberProps) {
  const [display, setDisplay] = useState(value)
  const prevValueRef = useRef(0)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const from = prevValueRef.current
    const to = value
    const start = performance.now()

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      // Ease-out cubic: 1 - (1 - p)^3
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = from + (to - from) * eased

      setDisplay(decimals > 0 ? parseFloat(current.toFixed(decimals)) : Math.round(current))

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        prevValueRef.current = to
      }
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [value, duration, decimals])

  const formatted = decimals > 0
    ? display.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : display.toLocaleString()

  return (
    <span>
      {prefix}{formatted}{suffix}
    </span>
  )
}
