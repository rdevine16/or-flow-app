// Horizontal micro-bar with overlaid value
// Used in procedure/surgeon ranking tables

import { fmt } from '../utils'

interface MicroBarProps {
  value: number
  max: number
  color: string
}

export function MicroBar({ value, max, color }: MicroBarProps) {
  const pct = max > 0 ? Math.min((Math.abs(value) / max) * 100, 100) : 0

  return (
    <div className="relative flex items-center gap-2 min-w-[110px]">
      <div className="absolute inset-y-0 left-0 right-10 flex items-center">
        <div
          className="h-5 rounded-sm opacity-15"
          style={{
            width: `${pct}%`,
            backgroundColor: color,
            minWidth: value !== 0 ? '2px' : '0',
          }}
        />
      </div>
      <span className="relative font-medium text-sm tabular-nums" style={{ color }}>
        {value < 0 ? `(${fmt(value)})` : fmt(value)}
      </span>
    </div>
  )
}
