// components/staff-management/UserTimeOffSummary.tsx
// Reusable per-user time-off totals display.
// Used in both StaffDirectoryTab (inline) and TimeOffReviewModal.
'use client'

import type { UserTimeOffSummary as SummaryType } from '@/types/time-off'
import Badge from '@/components/ui/Badge'

// ============================================
// Types
// ============================================

interface UserTimeOffSummaryProps {
  totals: SummaryType | undefined
  /** 'inline' = compact single-line, 'detail' = full breakdown with badges */
  variant?: 'inline' | 'detail'
}

// ============================================
// Helpers
// ============================================

function formatDays(days: number): string {
  if (days === 0) return '0d'
  const whole = Math.floor(days)
  const hasHalf = days % 1 !== 0
  if (hasHalf) {
    return whole > 0 ? `${whole}½d` : '½d'
  }
  return `${days}d`
}

// ============================================
// Component
// ============================================

export function UserTimeOffSummaryDisplay({ totals, variant = 'detail' }: UserTimeOffSummaryProps) {
  if (!totals || totals.total_days === 0) {
    if (variant === 'inline') {
      return <span className="text-slate-400">0d</span>
    }
    return (
      <p className="text-sm text-slate-400">No approved time off this year.</p>
    )
  }

  if (variant === 'inline') {
    const parts: string[] = []
    if (totals.pto_days > 0) parts.push(`PTO: ${formatDays(totals.pto_days)}`)
    if (totals.sick_days > 0) parts.push(`Sick: ${formatDays(totals.sick_days)}`)
    return <span className="text-sm text-slate-600">{parts.join(' | ') || '0d'}</span>
  }

  // Detail variant — badges with day counts
  return (
    <div className="space-y-2" role="group" aria-label="Time-off breakdown">
      <div className="flex items-center gap-4 flex-wrap">
        <TimeOffBadge label="PTO" days={totals.pto_days} variant="info" />
        <TimeOffBadge label="Sick" days={totals.sick_days} variant="warning" />
      </div>
      <p className="text-sm font-medium text-slate-700">
        Total: {formatDays(totals.total_days)}
      </p>
    </div>
  )
}

// ============================================
// Sub-component
// ============================================

function TimeOffBadge({
  label,
  days,
  variant,
}: {
  label: string
  days: number
  variant: 'info' | 'warning' | 'purple'
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Badge variant={variant} size="sm">{label}</Badge>
      <span className="text-sm text-slate-700">{formatDays(days)}</span>
    </div>
  )
}
