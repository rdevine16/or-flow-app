// components/staff-management/TimeOffReviewModal.tsx
// Admin review modal for approving/denying time-off requests.
// Shows: staff details, request info, per-user totals, approve/deny actions.
'use client'

import { useState, useCallback } from 'react'
import { Modal } from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import { UserTimeOffSummaryDisplay } from './UserTimeOffSummary'
import type {
  TimeOffRequest,
  TimeOffReviewInput,
  UserTimeOffSummary,
} from '@/types/time-off'
import { REQUEST_TYPE_LABELS, calculateBusinessDays, calculateBusinessDaysWithHolidays } from '@/types/time-off'
import type { FacilityHoliday } from '@/types/block-scheduling'
import { CalendarDays, User, AlertCircle, Gift } from 'lucide-react'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { logger } from '@/lib/logger'

const log = logger('staff-management:review-modal')

// ============================================
// Types
// ============================================

interface TimeOffReviewModalProps {
  /** The request being reviewed */
  request: TimeOffRequest | null
  /** Whether the modal is open */
  open: boolean
  /** Close handler */
  onClose: () => void
  /** The current admin's user ID (for reviewed_by) */
  currentUserId: string
  /** Per-user time-off totals for the year */
  totals: UserTimeOffSummary[]
  /** Facility holidays for holiday-aware PTO calculation */
  holidays?: FacilityHoliday[]
  /** Callback when the request is approved/denied */
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
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  if (startDate === endDate) return fmt(start)
  return `${fmt(start)} — ${fmt(end)}`
}

function getRoleName(request: TimeOffRequest): string | null {
  if (!request.user_role?.role) return null
  return request.user_role.role.name
}

// ============================================
// Component
// ============================================

export function TimeOffReviewModal({
  request,
  open,
  onClose,
  currentUserId,
  totals,
  holidays = [],
  onReview,
}: TimeOffReviewModalProps) {
  const { showToast } = useToast()
  const [reviewNotes, setReviewNotes] = useState('')
  const [submitting, setSubmitting] = useState<'approve' | 'deny' | null>(null)
  const [reviewError, setReviewError] = useState<string | null>(null)

  const resetState = useCallback(() => {
    setReviewNotes('')
    setSubmitting(null)
    setReviewError(null)
  }, [])

  const handleClose = useCallback(() => {
    resetState()
    onClose()
  }, [onClose, resetState])

  const handleReview = useCallback(
    async (status: 'approved' | 'denied') => {
      if (!request) return

      const action = status === 'approved' ? 'approve' : 'deny'
      setSubmitting(action)
      setReviewError(null)

      const review: TimeOffReviewInput = {
        status,
        reviewed_by: currentUserId,
        review_notes: reviewNotes.trim() || null,
      }

      const result = await onReview(request.id, review)

      if (result.success) {
        log.info(`Time-off request ${action}d`, { requestId: request.id })
        const userName = request.user
          ? `${request.user.first_name} ${request.user.last_name}`
          : 'Staff member'
        showToast({
          type: 'success',
          title: `Request ${status === 'approved' ? 'Approved' : 'Denied'}`,
          message: `${userName}'s time-off request has been ${status}.`,
        })
        handleClose()
      } else {
        log.error(`Failed to ${action} request`, { requestId: request.id, error: result.error })
        setReviewError(result.error ?? `Failed to ${action} request. Please try again.`)
        showToast({
          type: 'error',
          title: `${action === 'approve' ? 'Approval' : 'Denial'} Failed`,
          message: result.error ?? 'An unexpected error occurred.',
        })
        setSubmitting(null)
      }
    },
    [request, currentUserId, reviewNotes, onReview, handleClose, showToast],
  )

  if (!request) return null

  const userName = request.user
    ? `${request.user.first_name} ${request.user.last_name}`
    : 'Unknown'
  const roleName = getRoleName(request)
  const userTotals = totals.find((t) => t.user_id === request.user_id)

  // Holiday-aware PTO calculation
  const ptoBreakdown = holidays.length > 0
    ? calculateBusinessDaysWithHolidays(
        request.start_date,
        request.end_date,
        request.partial_day_type,
        holidays,
      )
    : null
  const businessDays = ptoBreakdown
    ? ptoBreakdown.ptoDaysCharged
    : calculateBusinessDays(request.start_date, request.end_date, request.partial_day_type)

  const isPending = request.status === 'pending'
  const isSelfReview = request.user_id === currentUserId

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Review Time-Off Request"
      icon={<CalendarDays className="w-5 h-5 text-blue-600" />}
      size="lg"
      scrollable
    >
      {/* Staff header */}
      <div className="flex items-center gap-3 pb-4 border-b border-slate-200">
        <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-sm font-medium text-slate-600 shrink-0">
          {request.user ? (
            <>
              {request.user.first_name[0]}
              {request.user.last_name[0]}
            </>
          ) : (
            <User className="w-4 h-4" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-base font-semibold text-slate-900">{userName}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {roleName && (
              <Badge variant="default" size="sm">{roleName}</Badge>
            )}
            {request.user?.email && (
              <span className="text-xs text-slate-500 truncate">{request.user.email}</span>
            )}
          </div>
        </div>
        <div className="ml-auto">
          <Badge
            variant={STATUS_BADGE_VARIANTS[request.status] ?? 'default'}
            size="sm"
          >
            {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
          </Badge>
        </div>
      </div>

      {/* Request details */}
      <div className="space-y-3 pt-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-slate-500 mb-1">Request Type</p>
            <Badge
              variant={REQUEST_TYPE_BADGE_VARIANTS[request.request_type] ?? 'default'}
              size="md"
            >
              {REQUEST_TYPE_LABELS[request.request_type]}
            </Badge>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Duration</p>
            <p className="text-sm font-medium text-slate-900">
              {businessDays} business day{businessDays !== 1 ? 's' : ''}
              {request.partial_day_type && (
                <span className="text-slate-500 font-normal ml-1">
                  ({request.partial_day_type.toUpperCase()} only)
                </span>
              )}
            </p>
          </div>
        </div>

        <div>
          <p className="text-xs text-slate-500 mb-1">Date Range</p>
          <p className="text-sm font-medium text-slate-900">
            {formatDateRange(request.start_date, request.end_date)}
          </p>
        </div>

        {/* Holiday breakdown (when holidays overlap with the request) */}
        {ptoBreakdown && ptoBreakdown.holidays.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1.5" role="region" aria-label="Holiday impact on PTO calculation">
            <p className="text-xs font-medium text-blue-800 flex items-center gap-1.5">
              <Gift className="w-3.5 h-3.5" />
              Holidays in this period
            </p>
            {ptoBreakdown.holidays.map((h) => (
              <div key={h.date} className="flex items-center justify-between text-xs text-blue-700">
                <span>
                  {h.name}
                  {h.isPartial && (
                    <span className="text-blue-500 ml-1">(partial day)</span>
                  )}
                </span>
                <span className="text-blue-500">
                  {new Date(h.date + 'T00:00:00').toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>
            ))}
            <p className="text-xs font-medium text-blue-900 pt-1 border-t border-blue-200">
              PTO days charged: {businessDays}
              {ptoBreakdown.holidayDays > 0 && (
                <span className="font-normal text-blue-600 ml-1">
                  ({ptoBreakdown.totalCalendarDays - ptoBreakdown.weekendDays} weekday{ptoBreakdown.totalCalendarDays - ptoBreakdown.weekendDays !== 1 ? 's' : ''} &minus; {ptoBreakdown.holidayDays} holiday{ptoBreakdown.holidayDays !== 1 ? 's' : ''})
                </span>
              )}
            </p>
          </div>
        )}

        {request.reason && (
          <div>
            <p className="text-xs text-slate-500 mb-1">Reason</p>
            <p className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3">
              {request.reason}
            </p>
          </div>
        )}
      </div>

      {/* User time-off summary for the year */}
      <div className="pt-4 border-t border-slate-200">
        <p className="text-xs text-slate-500 mb-2">Time Off This Year (Approved)</p>
        <UserTimeOffSummaryDisplay totals={userTotals} variant="detail" />
      </div>

      {/* Already reviewed info */}
      {!isPending && request.reviewer && (
        <div className="pt-4 border-t border-slate-200">
          <p className="text-xs text-slate-500 mb-1">Reviewed by</p>
          <p className="text-sm text-slate-700">
            {request.reviewer.first_name} {request.reviewer.last_name}
            {request.reviewed_at && (
              <span className="text-slate-400 ml-2">
                on {new Date(request.reviewed_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            )}
          </p>
          {request.review_notes && (
            <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3 mt-2">
              {request.review_notes}
            </p>
          )}
        </div>
      )}

      {/* Review notes input + action buttons (only for pending) */}
      {isPending && (
        <>
          {/* Self-review warning */}
          {isSelfReview && (
            <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700" role="alert">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>You are reviewing your own request. Consider having another admin review it instead.</span>
            </div>
          )}

          <div className="pt-4 border-t border-slate-200">
            <label htmlFor="review-notes" className="text-xs text-slate-500 mb-1 block">
              Review Notes (optional)
            </label>
            <textarea
              id="review-notes"
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="Add a note for the staff member..."
              rows={2}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                resize-none"
            />
          </div>

          {/* Error display */}
          {reviewError && (
            <div className="flex items-start gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700" role="alert">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{reviewError}</span>
            </div>
          )}

          <Modal.Footer>
            <Modal.Cancel onClick={handleClose} />
            <Modal.Action
              onClick={() => handleReview('denied')}
              loading={submitting === 'deny'}
              disabled={submitting !== null}
              variant="danger"
              aria-label={`Deny time-off request for ${userName}`}
            >
              Deny
            </Modal.Action>
            <Modal.Action
              onClick={() => handleReview('approved')}
              loading={submitting === 'approve'}
              disabled={submitting !== null}
              variant="primary"
              aria-label={`Approve time-off request for ${userName}`}
            >
              Approve
            </Modal.Action>
          </Modal.Footer>
        </>
      )}

      {/* Close button for already-reviewed requests */}
      {!isPending && (
        <Modal.Footer>
          <Modal.Cancel onClick={handleClose}>Close</Modal.Cancel>
        </Modal.Footer>
      )}
    </Modal>
  )
}
