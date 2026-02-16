// components/ui/ProfitBadge.tsx
// Rating badge that shows margin quality (EXCELLENT, GOOD, FAIR, POOR).
// Uses ORbit Score-aligned colors.

import type { MarginRating } from '@/lib/utils/financialAnalytics'

interface ProfitBadgeProps {
  rating: MarginRating
}

const BADGE_STYLES: Record<MarginRating, string> = {
  excellent: 'bg-teal-50 text-teal-700 ring-teal-600/20',
  good: 'bg-green-50 text-green-700 ring-green-600/20',
  fair: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  poor: 'bg-red-50 text-red-700 ring-red-600/20',
}

const BADGE_LABELS: Record<MarginRating, string> = {
  excellent: 'EXCELLENT',
  good: 'GOOD',
  fair: 'FAIR',
  poor: 'POOR',
}

export function ProfitBadge({ rating }: ProfitBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded ring-1 ring-inset ${BADGE_STYLES[rating]}`}
      aria-label={`Margin rated ${rating}`}
    >
      {BADGE_LABELS[rating]}
    </span>
  )
}

export default ProfitBadge
