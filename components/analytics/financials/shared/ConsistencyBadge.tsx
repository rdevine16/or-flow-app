// Consistency rating badge: High / Moderate / Variable
// Based on coefficient of variation of duration

import type { ConsistencyRating } from '../types'

interface ConsistencyBadgeProps {
  rating: ConsistencyRating
  size?: 'sm' | 'lg'
}

const config: Record<ConsistencyRating, { label: string; className: string }> = {
  high: { label: 'High', className: 'bg-green-50 text-green-600 ring-green-200/50' },
  medium: { label: 'Moderate', className: 'bg-amber-50 text-amber-700 ring-amber-200/50' },
  low: { label: 'Variable', className: 'bg-red-50 text-red-600 ring-red-200/50' },
}

export function ConsistencyBadge({ rating, size = 'sm' }: ConsistencyBadgeProps) {
  const cfg = config[rating]
  const sizeClass = size === 'lg' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs'

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg font-semibold ring-1 ${sizeClass} ${cfg.className}`}>
      {cfg.label}
    </span>
  )
}
