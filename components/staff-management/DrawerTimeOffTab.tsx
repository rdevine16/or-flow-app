// components/staff-management/DrawerTimeOffTab.tsx
// Time-Off tab for StaffDetailDrawer — per-type breakdown + recent requests list.
'use client'

import { useMemo, useCallback, useState } from 'react'
import type { TimeOffRequest, UserTimeOffSummary, TimeOffReviewInput } from '@/types/time-off'
import { REQUEST_TYPE_LABELS, calculateBusinessDays, calculateBusinessDaysWithHolidays } from '@/types/time-off'
import type { FacilityHoliday } from '@/types/block-scheduling'
import { UserTimeOffSummaryDisplay } from './UserTimeOffSummary'
import Badge from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { CalendarDays, Clock } from 'lucide-react'
import { logger } from '@/lib/logger'

const log = logger('staff-management:drawer-time-off')

// ============================================
// Types
// ============================================

interface DrawerTimeOffTabProps {
  userId: string
  totals: UserTimeOffSummary | undefined
  requests: TimeOffRequest[]
  holidays?: FacilityHoliday[]
  currentUserId: string
  onReview: (
    requestId: string,
    review: TimeOffReviewInput,
  ) => Promise<{ success: boolean; error?: string }>
}

// ============================================
// Constants
// ============================================

const REQUEST_TYPE_BADGE_VARIANTS: Record<string, 'info' | 'warning' | 'purple'> = {
  pto: 'info',
  sick: 'warning',
  personal: 'purple',
}

const STATUS_BADGE_VARIANTS: Record<string, 'warning' | 'success' | 'error' | 'default'> = {
  pending: 'warning',
  approved: 'success',
  denied: 'error',
}

// ============================================
// Helpers
// ============================================

function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  if (startDate === endDate) return fmt(start)
  return `${fmt(start)} – ${fmt(end)}`
}

// ============================================
// Component
// ============================================

export function DrawerTimeOffTab({
  userId,
  totals,
  requests,
  holidays = [],
  currentUserId,
  onReview,
}: DrawerTimeOffTabProps) {
  const { showToast } = useToast()
  const [reviewingId, setReviewingId] = useState<string | null>(null)

  // Filter requests for this specific user, sorted by most recent first
  const userRequests = useMemo(
    () =>
      requests
        .filter((r) => r.user_id === userId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [requests, userId],
  )

  const handleInlineReview = useCallback(
    async (requestId: string, status: 'approved' | 'denied') => {
      setReviewingId(requestId)
      const result = await onReview(requestId, {
        status,
        reviewed_by: currentUserId,
        review_notes: null,
      })
      if (result.success) {
        showToast({
          type: 'success',
          title: `Request ${status === 'approved' ? 'Approved' : 'Denied'}`,
          message: `Time-off request has been ${status}.`,
        })
      } else {
        log.error('Inline review failed', { requestId, error: result.error })
        showToast({
          type: 'error',
          title: 'Review Failed',
          message: result.error ?? 'An unexpected error occurred.',
        })
      }
      setReviewingId(null)
    },
    [onReview, currentUserId, showToast],
  )

  return (
    <div className="space-y-6 p-4">
      {/* Year summary */}
      <div className="space-y-3">
        <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider">
          Time Off This Year (Approved)
        </h4>
        <UserTimeOffSummaryDisplay totals={totals} variant="detail" />
      </div>

      {/* Recent requests */}
      <div className="space-y-3">
        <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider">
          Requests ({userRequests.length})
        </h4>

        {userRequests.length === 0 ? (
          <div className="text-center py-8">
            <CalendarDays className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No time-off requests</p>
          </div>
        ) : (
          <div className="space-y-2">
            {userRequests.map((req) => {
              const days = holidays.length > 0
                ? calculateBusinessDaysWithHolidays(req.start_date, req.end_date, req.partial_day_type, holidays).ptoDaysCharged
                : calculateBusinessDays(req.start_date, req.end_date, req.partial_day_type)
              const isPending = req.status === 'pending'
              const isReviewing = reviewingId === req.id

              return (
                <div
                  key={req.id}
                  className="border border-slate-200 rounded-lg p-3 space-y-2"
                >
                  {/* Top row: type + dates + status */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge
                        variant={REQUEST_TYPE_BADGE_VARIANTS[req.request_type] ?? 'default'}
                        size="sm"
                      >
                        {REQUEST_TYPE_LABELS[req.request_type]}
                      </Badge>
                      <span className="text-sm text-slate-700 truncate">
                        {formatDateRange(req.start_date, req.end_date)}
                      </span>
                    </div>
                    <Badge
                      variant={STATUS_BADGE_VARIANTS[req.status] ?? 'default'}
                      size="sm"
                    >
                      {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                    </Badge>
                  </div>

                  {/* Duration + partial day */}
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Clock className="w-3.5 h-3.5" />
                    <span>
                      {days} day{days !== 1 ? 's' : ''}
                      {req.partial_day_type && ` (${req.partial_day_type.toUpperCase()} only)`}
                    </span>
                  </div>

                  {/* Reason */}
                  {req.reason && (
                    <p className="text-xs text-slate-600 bg-slate-50 rounded p-2 line-clamp-2">
                      {req.reason}
                    </p>
                  )}

                  {/* Review notes (if already reviewed) */}
                  {req.review_notes && !isPending && (
                    <p className="text-xs text-slate-500 italic">
                      Note: {req.review_notes}
                    </p>
                  )}

                  {/* Inline approve/deny for pending requests */}
                  {isPending && (
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => handleInlineReview(req.id, 'approved')}
                        disabled={reviewingId !== null}
                        aria-label={`Approve ${REQUEST_TYPE_LABELS[req.request_type]} request`}
                        className="px-3 py-1 text-xs font-medium rounded-md bg-emerald-50 text-emerald-700
                          hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 transition-colors disabled:opacity-50"
                      >
                        {isReviewing ? '...' : 'Approve'}
                      </button>
                      <button
                        onClick={() => handleInlineReview(req.id, 'denied')}
                        disabled={reviewingId !== null}
                        aria-label={`Deny ${REQUEST_TYPE_LABELS[req.request_type]} request`}
                        className="px-3 py-1 text-xs font-medium rounded-md bg-red-50 text-red-700
                          hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 transition-colors disabled:opacity-50"
                      >
                        {isReviewing ? '...' : 'Deny'}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
