// components/staff-management/CalendarDayCell.tsx
// Individual day cell in the time-off calendar grid.
// Shows day number, request badges (color-coded by status), and coverage indicator.
'use client'

import type { TimeOffRequest, TimeOffStatus } from '@/types/time-off'
import { REQUEST_TYPE_LABELS } from '@/types/time-off'

// ============================================
// Types
// ============================================

interface CalendarDayCellProps {
  date: Date
  isCurrentMonth: boolean
  isToday: boolean
  requests: TimeOffRequest[]
  approvedOffCount: number
  totalStaff: number
  onRequestClick?: (request: TimeOffRequest) => void
}

// ============================================
// Constants
// ============================================

const STATUS_COLORS: Record<TimeOffStatus, string> = {
  pending: 'bg-amber-50 border-l-2 border-l-amber-400 text-amber-800',
  approved: 'bg-emerald-50 border-l-2 border-l-emerald-400 text-emerald-800',
  denied: 'bg-slate-100 border-l-2 border-l-slate-300 text-slate-400',
}

const MAX_VISIBLE_BADGES = 3

// ============================================
// Component
// ============================================

export function CalendarDayCell({
  date,
  isCurrentMonth,
  isToday,
  requests,
  approvedOffCount,
  totalStaff,
  onRequestClick,
}: CalendarDayCellProps) {
  const visible = requests.slice(0, MAX_VISIBLE_BADGES)
  const overflow = requests.length - MAX_VISIBLE_BADGES
  const dayNum = date.getDate()
  const isWeekend = date.getDay() === 0 || date.getDay() === 6

  // Coverage warning threshold: red when >= 25% of staff are off
  const coverageWarning = totalStaff > 0 && approvedOffCount >= Math.ceil(totalStaff * 0.25)

  const dateLabel = date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <div
      className={`
        min-h-[110px] border-b border-r border-slate-200 p-1.5 transition-colors
        ${!isCurrentMonth ? 'bg-slate-50/50' : isWeekend ? 'bg-slate-50/30' : 'bg-white'}
        ${isToday ? 'ring-2 ring-blue-400 ring-inset' : ''}
      `}
      role="gridcell"
      aria-label={`${dateLabel}${requests.length > 0 ? `, ${requests.length} request${requests.length !== 1 ? 's' : ''}` : ''}${approvedOffCount > 0 ? `, ${approvedOffCount} staff off` : ''}`}
    >
      {/* Day header: number + coverage badge */}
      <div className="flex items-center justify-between mb-1">
        <span
          className={`
            text-xs font-medium leading-5
            ${isToday
              ? 'bg-blue-600 text-white w-5 h-5 rounded-full flex items-center justify-center'
              : isCurrentMonth
                ? 'text-slate-700'
                : 'text-slate-400'
            }
          `}
          aria-current={isToday ? 'date' : undefined}
        >
          {dayNum}
        </span>

        {approvedOffCount > 0 && isCurrentMonth && (
          <span
            className={`
              text-[10px] font-medium px-1 py-0.5 rounded
              ${coverageWarning
                ? 'bg-red-100 text-red-700'
                : 'bg-amber-100 text-amber-700'
              }
            `}
            title={`${approvedOffCount} of ${totalStaff} staff off`}
            role="status"
          >
            {approvedOffCount} off
          </span>
        )}
      </div>

      {/* Request badges */}
      <div className="space-y-0.5">
        {visible.map((req) => (
          <button
            key={req.id}
            onClick={(e) => {
              e.stopPropagation()
              onRequestClick?.(req)
            }}
            className={`
              w-full text-left rounded px-1.5 py-0.5 text-[11px] leading-tight truncate
              ${STATUS_COLORS[req.status]}
              hover:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-opacity cursor-pointer
              ${req.status === 'denied' ? 'line-through' : ''}
            `}
            aria-label={`${req.user?.first_name} ${req.user?.last_name}, ${REQUEST_TYPE_LABELS[req.request_type]}, ${req.status}. Click to review.`}
            title={`${req.user?.first_name} ${req.user?.last_name} — ${REQUEST_TYPE_LABELS[req.request_type]} (${req.status})`}
          >
            <span className="font-medium">
              {req.user?.first_name?.[0]}. {req.user?.last_name}
            </span>
            {' '}
            <span className="opacity-75">{REQUEST_TYPE_LABELS[req.request_type]}</span>
          </button>
        ))}

        {overflow > 0 && (
          <p className="text-[10px] text-slate-400 text-center mt-0.5" aria-label={`${overflow} more requests`}>
            +{overflow} more
          </p>
        )}
      </div>
    </div>
  )
}
