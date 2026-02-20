// Colored margin percentage badge
// Green >= 30%, amber >= 15%, red >= 0%, dark red < 0%

import { formatPercent } from '../utils'

interface MarginBadgeProps {
  value: number
}

export function MarginBadge({ value }: MarginBadgeProps) {
  const colorClass =
    value >= 30
      ? 'bg-green-50 text-green-600'
      : value >= 15
        ? 'bg-amber-50 text-amber-700'
        : value >= 0
          ? 'bg-red-50 text-red-600'
          : 'bg-red-100 text-red-800'

  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold tabular-nums ${colorClass}`}>
      {formatPercent(value)}
    </span>
  )
}
