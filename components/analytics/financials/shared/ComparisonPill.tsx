// +/- comparison badge with arrow icon
// Green for positive (good), red for negative (bad)
// invert=true flips the logic (e.g., lower duration = good)

import { fmt } from '../utils'

interface ComparisonPillProps {
  value: number
  unit?: string
  format?: 'currency' | null
  invert?: boolean
}

export function ComparisonPill({ value, unit = '', format = null, invert = false }: ComparisonPillProps) {
  const isPositive = value > 0
  const isGood = invert ? !isPositive : isPositive

  const display =
    format === 'currency'
      ? `${isPositive ? '+' : ''}${fmt(value)}`
      : `${isPositive ? '+' : ''}${Math.round(value)}${unit ? ` ${unit}` : ''}`

  if (Math.abs(value) < 0.5) {
    return <span className="text-xs text-slate-400">{display}</span>
  }

  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
        isGood ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
      }`}
    >
      <svg
        className={`w-2.5 h-2.5 ${isGood ? '' : 'rotate-180'}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25"
        />
      </svg>
      {display}
    </span>
  )
}
