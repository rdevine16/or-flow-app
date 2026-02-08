// components/ui/StatusBadge.tsx
'use client'

import { getStatusColors } from '@/lib/design-tokens'

type CaseStatus = 'scheduled' | 'checked_in' | 'in_progress' | 'completed' | 'cancelled' | 'delayed'

interface StatusBadgeProps {
  status: CaseStatus | string
  className?: string
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const colors = getStatusColors(status)
  
  // Format display text
  const displayText = status
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

  return (
    <span
      className={`
        inline-flex items-center
        px-2.5 py-0.5
        rounded-full
        text-xs font-medium
        ${colors.bg}
        ${colors.text}
        ${colors.border}
        border
        ${className}
      `}
    >
      {displayText}
    </span>
  )
}

// ============================================
// Alternative: Badge with Dot Indicator
// ============================================

interface StatusBadgeDotProps extends StatusBadgeProps {
  showDot?: boolean
}

export function StatusBadgeDot({ status, showDot = true, className = '' }: StatusBadgeDotProps) {
  const colors = getStatusColors(status)
  
  const displayText = status
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

  return (
    <span
      className={`
        inline-flex items-center gap-1.5
        px-2.5 py-0.5
        rounded-full
        text-xs font-medium
        ${colors.bg}
        ${colors.text}
        ${colors.border}
        border
        ${className}
      `}
    >
      {showDot && (
        <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
      )}
      {displayText}
    </span>
  )
}

// ============================================
// Usage Examples
// ============================================

/*
// Basic usage
<StatusBadge status="scheduled" />
<StatusBadge status="in_progress" />
<StatusBadge status="completed" />

// With dot indicator
<StatusBadgeDot status="scheduled" />

// Custom styling
<StatusBadge status="delayed" className="text-sm px-4 py-1" />
*/
