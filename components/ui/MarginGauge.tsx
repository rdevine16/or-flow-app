// components/ui/MarginGauge.tsx
// Circular SVG gauge showing margin percentage with animated ring draw.
// Reusable across hero rows, forecast footers, surgeon scorecards.

'use client'

import { useEffect, useRef } from 'react'

export type MarginRating = 'excellent' | 'good' | 'fair' | 'poor'

interface MarginGaugeProps {
  /** Margin percentage to display (0-100+) */
  percentage: number | null
  /** Visual size variant */
  size?: 'sm' | 'md' | 'lg'
  /** Rating determines ring color */
  rating: MarginRating
  /** Optional label below the gauge */
  label?: string
}

const SIZE_CONFIG = {
  sm: { px: 40, stroke: 3, fontSize: 11, showLabel: false },
  md: { px: 48, stroke: 3.5, fontSize: 13, showLabel: true },
  lg: { px: 68, stroke: 4, fontSize: 16, showLabel: true },
} as const

const RATING_COLORS: Record<MarginRating, string> = {
  excellent: '#0d9488', // teal-600
  good: '#16a34a',     // green-600
  fair: '#d97706',     // amber-600
  poor: '#dc2626',     // red-600
}

export function MarginGauge({
  percentage,
  size = 'md',
  rating,
  label,
}: MarginGaugeProps) {
  const circleRef = useRef<SVGCircleElement>(null)
  const config = SIZE_CONFIG[size]
  const radius = (config.px - config.stroke) / 2
  const circumference = 2 * Math.PI * radius
  const displayPct = percentage != null ? Math.max(0, Math.min(percentage, 100)) : 0
  const offset = circumference - (displayPct / 100) * circumference
  const color = RATING_COLORS[rating]

  // Animate stroke on mount
  useEffect(() => {
    const circle = circleRef.current
    if (!circle || percentage == null) return
    circle.style.strokeDashoffset = String(circumference)
    // Force reflow before animating
    circle.getBoundingClientRect()
    circle.style.transition = 'stroke-dashoffset 0.8s ease-out'
    circle.style.strokeDashoffset = String(offset)
  }, [percentage, circumference, offset])

  const formattedPct = percentage != null ? Math.round(percentage) : '--'
  const ariaText = percentage != null
    ? `Margin: ${Math.round(percentage)} percent, rated ${rating}`
    : 'Margin data unavailable'

  return (
    <div
      className="flex flex-col items-center gap-0.5"
      role="img"
      aria-label={ariaText}
    >
      <svg
        width={config.px}
        height={config.px}
        viewBox={`0 0 ${config.px} ${config.px}`}
      >
        {/* Background track */}
        <circle
          cx={config.px / 2}
          cy={config.px / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={config.stroke}
          className="text-slate-200"
        />
        {/* Foreground ring */}
        <circle
          ref={circleRef}
          cx={config.px / 2}
          cy={config.px / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={config.stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={percentage != null ? offset : circumference}
          transform={`rotate(-90 ${config.px / 2} ${config.px / 2})`}
          style={percentage == null ? undefined : { transition: 'stroke-dashoffset 0.8s ease-out' }}
        />
        {/* Center text */}
        <text
          x={config.px / 2}
          y={config.showLabel ? config.px / 2 - 2 : config.px / 2 + 1}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={config.fontSize}
          fontWeight="700"
          fill="currentColor"
          className="text-slate-800"
        >
          {formattedPct}{percentage != null ? '%' : ''}
        </text>
        {config.showLabel && (
          <text
            x={config.px / 2}
            y={config.px / 2 + config.fontSize - 2}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={8}
            fill="currentColor"
            className="text-slate-400"
          >
            Margin
          </text>
        )}
      </svg>
      {label && (
        <span className="text-[10px] text-slate-500 leading-tight">{label}</span>
      )}
    </div>
  )
}

export default MarginGauge
