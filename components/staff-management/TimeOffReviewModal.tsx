// components/staff-management/TimeOffReviewModal.tsx
// Admin review modal for approving/denying time-off requests.
// Shows: staff details, request info, per-user totals, coverage impact, approve/deny actions.
'use client'

import { useState, useCallback } from 'react'
import { Modal } from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import { UserTimeOffSummaryDisplay } from './UserTimeOffSummary'
import { CoverageIndicator } from './CoverageIndicator'
import type {
  TimeOffRequest,
  TimeOffReviewInput,
  UserTimeOffSummary,
} from '@/types/time-off'
import { REQUEST_TYPE_LABELS, calculateBusinessDays } from '@/types/time-off'
import type { UserListItem } from '@/lib/dal/users'
import { CalendarDays, User } from 'lucide-react'
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
  /** Full staff list for coverage calculation */
  staffList: UserListItem[]
  /** Approved requests for coverage calculation */
  approvedRequests: TimeOffRequest[]
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
  staffList,
  approvedRequests,
  onReview,
}: TimeOffReviewModalProps) {
  const [reviewNotes, setReviewNotes] = useState('')
  const [submitting, setSubmitting] = useState<'approve' | 'deny' | null>(null)

  const resetState = useCallback(() => {
    setReviewNotes('')
    setSubmitting(null)
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

      const review: TimeOffReviewInput = {
        status,
        reviewed_by: currentUserId,
        review_notes: reviewNotes.trim() || null,
      }

      const result = await onReview(request.id, review)

      if (result.success) {
        log.info(`Time-off request ${action}d`, { requestId: request.id })
        handleClose()
      } else {
        log.error(`Failed to ${action} request`, { requestId: request.id, error: result.error })
        setSubmitting(null)
      }
    },
    [request, currentUserId, reviewNotes, onReview, handleClose],
  )

  if (!request) return null

  const userName = request.user
    ? `${request.user.first_name} ${request.user.last_name}`
    : 'Unknown'
  const roleName = getRoleName(request)
  const userTotals = totals.find((t) => t.user_id === request.user_id)
  const businessDays = calculateBusinessDays(
    request.start_date,
    request.end_date,
    request.partial_day_type,
  )
  const isPending = request.status === 'pending'

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
        <div className="grid grid-cols-2 gap-4">
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

      {/* Coverage impact */}
      {isPending && (
        <div className="pt-4 border-t border-slate-200">
          <CoverageIndicator
            approvedRequests={approvedRequests}
            staffList={staffList}
            startDate={request.start_date}
            endDate={request.end_date}
            includeRequestUserId={request.user_id}
          />
        </div>
      )}

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

          <Modal.Footer>
            <Modal.Cancel onClick={handleClose} />
            <Modal.Action
              onClick={() => handleReview('denied')}
              loading={submitting === 'deny'}
              disabled={submitting !== null}
              variant="danger"
            >
              Deny
            </Modal.Action>
            <Modal.Action
              onClick={() => handleReview('approved')}
              loading={submitting === 'approve'}
              disabled={submitting !== null}
              variant="primary"
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
