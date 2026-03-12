// components/staff-management/__tests__/TimeOffReviewModal.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TimeOffReviewModal } from '../TimeOffReviewModal'
import type { TimeOffRequest, UserTimeOffSummary } from '@/types/time-off'
import type { UserListItem } from '@/lib/dal/users'

// Mock toast provider (phase 14)
const mockShowToast = vi.fn()
vi.mock('@/components/ui/Toast/ToastProvider', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}))

// ============================================
// Test Data
// ============================================

function createUser(id: string, firstName: string, lastName: string) {
  return {
    id,
    first_name: firstName,
    last_name: lastName,
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
  }
}

function createStaffMember(id: string, roleName: string): UserListItem {
  return {
    id,
    first_name: `First${id}`,
    last_name: `Last${id}`,
    email: `user${id}@example.com`,
    facility_id: 'fac1',
    is_active: true,
    role: { id: `role-${roleName}`, name: roleName },
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    phone: null,
    profile_image_url: null,
  }
}

function createRequest(
  id: string,
  userId: string,
  status: 'pending' | 'approved' | 'denied' = 'pending',
  requestType: 'pto' | 'sick' | 'personal' = 'pto',
): TimeOffRequest {
  return {
    id,
    user_id: userId,
    facility_id: 'fac1',
    request_type: requestType,
    start_date: '2024-03-15',
    end_date: '2024-03-17',
    partial_day_type: null,
    reason: 'Vacation with family',
    status,
    requested_at: '2024-03-01T00:00:00Z',
    reviewed_by: status !== 'pending' ? 'admin1' : null,
    reviewed_at: status !== 'pending' ? '2024-03-02T00:00:00Z' : null,
    review_notes: status !== 'pending' ? 'Approved due to sufficient coverage' : null,
    user: createUser('u1', 'Jane', 'Smith'),
    user_role: {
      user_id: 'u1',
      role: { id: 'role-rn', name: 'RN' },
    },
    reviewer: status !== 'pending' ? createUser('admin1', 'Admin', 'User') : null,
  }
}

const mockTotals: UserTimeOffSummary[] = [
  {
    user_id: 'u1',
    pto_days: 5,
    sick_days: 2,
    personal_days: 1,
    total_days: 8,
  },
]

const mockStaffList: UserListItem[] = [
  createStaffMember('u1', 'RN'),
  createStaffMember('u2', 'RN'),
  createStaffMember('u3', 'Surgical Tech'),
]

describe('TimeOffReviewModal', () => {
  const defaultProps = {
    request: null,
    open: false,
    onClose: vi.fn(),
    currentUserId: 'admin1',
    totals: mockTotals,
    staffList: mockStaffList,
    approvedRequests: [],
    onReview: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('basic rendering', () => {
    it('renders nothing when request is null', () => {
      const { container } = render(<TimeOffReviewModal {...defaultProps} />)
      expect(container.firstChild).toBeNull()
    })

    it('renders modal when open=true and request is provided', () => {
      const request = createRequest('req1', 'u1', 'pending')

      render(
        <TimeOffReviewModal
          {...defaultProps}
          request={request}
          open={true}
        />,
      )

      expect(screen.getByText('Review Time-Off Request')).toBeInTheDocument()
      expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    })

    it('displays user name and role', () => {
      const request = createRequest('req1', 'u1', 'pending')

      render(
        <TimeOffReviewModal
          {...defaultProps}
          request={request}
          open={true}
        />,
      )

      expect(screen.getByText('Jane Smith')).toBeInTheDocument()
      expect(screen.getAllByText('RN').length).toBeGreaterThan(0)
    })

    it('displays request type with correct badge', () => {
      const request = createRequest('req1', 'u1', 'pending', 'pto')

      render(
        <TimeOffReviewModal
          {...defaultProps}
          request={request}
          open={true}
        />,
      )

      expect(screen.getAllByText('PTO').length).toBeGreaterThan(0)
    })

    it('displays date range formatted correctly', () => {
      const request = createRequest('req1', 'u1', 'pending')

      render(
        <TimeOffReviewModal
          {...defaultProps}
          request={request}
          open={true}
        />,
      )

      // Should show formatted date range
      expect(screen.getByText(/Mar 15, 2024/)).toBeInTheDocument()
      expect(screen.getByText(/Mar 17, 2024/)).toBeInTheDocument()
    })

    it('displays single date when start and end are same', () => {
      const request: TimeOffRequest = {
        ...createRequest('req1', 'u1', 'pending'),
        start_date: '2024-03-15',
        end_date: '2024-03-15',
      }

      render(
        <TimeOffReviewModal
          {...defaultProps}
          request={request}
          open={true}
        />,
      )

      // Should only show one instance of the date
      const dateElements = screen.getAllByText(/Mar 15, 2024/)
      expect(dateElements.length).toBe(1)
    })

    it('displays reason when provided', () => {
      const request = createRequest('req1', 'u1', 'pending')

      render(
        <TimeOffReviewModal
          {...defaultProps}
          request={request}
          open={true}
        />,
      )

      expect(screen.getByText('Vacation with family')).toBeInTheDocument()
    })

    it('does not display reason section when reason is null', () => {
      const request: TimeOffRequest = {
        ...createRequest('req1', 'u1', 'pending'),
        reason: null,
      }

      render(
        <TimeOffReviewModal
          {...defaultProps}
          request={request}
          open={true}
        />,
      )

      expect(screen.queryByText('Reason')).not.toBeInTheDocument()
    })
  })

  describe('status badges', () => {
    it('shows pending badge for pending request', () => {
      const request = createRequest('req1', 'u1', 'pending')

      render(
        <TimeOffReviewModal
          {...defaultProps}
          request={request}
          open={true}
        />,
      )

      expect(screen.getByText('Pending')).toBeInTheDocument()
    })

    it('shows approved badge for approved request', () => {
      const request = createRequest('req1', 'u1', 'approved')

      render(
        <TimeOffReviewModal
          {...defaultProps}
          request={request}
          open={true}
        />,
      )

      expect(screen.getByText('Approved')).toBeInTheDocument()
    })

    it('shows denied badge for denied request', () => {
      const request = createRequest('req1', 'u1', 'denied')

      render(
        <TimeOffReviewModal
          {...defaultProps}
          request={request}
          open={true}
        />,
      )

      expect(screen.getByText('Denied')).toBeInTheDocument()
    })
  })

  describe('user time-off summary', () => {
    it('displays per-user totals from totals prop', () => {
      const request = createRequest('req1', 'u1', 'pending')

      render(
        <TimeOffReviewModal
          {...defaultProps}
          request={request}
          open={true}
        />,
      )

      expect(screen.getByText('Time Off This Year (Approved)')).toBeInTheDocument()
      // UserTimeOffSummaryDisplay will show the totals
      expect(screen.getByText(/Total: 8d/)).toBeInTheDocument()
    })

    it('handles missing user totals gracefully', () => {
      const request = createRequest('req1', 'u999', 'pending') // user not in totals

      render(
        <TimeOffReviewModal
          {...defaultProps}
          request={request}
          open={true}
        />,
      )

      expect(screen.getByText('No approved time off this year.')).toBeInTheDocument()
    })
  })

  describe('coverage indicator', () => {
    it('shows coverage indicator for pending requests', () => {
      const request = createRequest('req1', 'u1', 'pending')

      render(
        <TimeOffReviewModal
          {...defaultProps}
          request={request}
          open={true}
        />,
      )

      expect(screen.getByText(/Coverage Impact/)).toBeInTheDocument()
      expect(screen.getByText(/if approved/i)).toBeInTheDocument()
    })

    it('does not show coverage indicator for approved requests', () => {
      const request = createRequest('req1', 'u1', 'approved')

      render(
        <TimeOffReviewModal
          {...defaultProps}
          request={request}
          open={true}
        />,
      )

      expect(screen.queryByText(/Coverage Impact/)).not.toBeInTheDocument()
    })

    it('does not show coverage indicator for denied requests', () => {
      const request = createRequest('req1', 'u1', 'denied')

      render(
        <TimeOffReviewModal
          {...defaultProps}
          request={request}
          open={true}
        />,
      )

      expect(screen.queryByText(/Coverage Impact/)).not.toBeInTheDocument()
    })
  })

  describe('review actions (pending requests)', () => {
    it('shows approve and deny buttons for pending requests', () => {
      const request = createRequest('req1', 'u1', 'pending')

      render(
        <TimeOffReviewModal
          {...defaultProps}
          request={request}
          open={true}
        />,
      )

      expect(screen.getByRole('button', { name: /Approve/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Deny/i })).toBeInTheDocument()
    })

    it('shows review notes textarea for pending requests', () => {
      const request = createRequest('req1', 'u1', 'pending')

      render(
        <TimeOffReviewModal
          {...defaultProps}
          request={request}
          open={true}
        />,
      )

      expect(screen.getByLabelText(/Review Notes/i)).toBeInTheDocument()
    })

    it('calls onReview with approved status when Approve clicked', async () => {
      const request = createRequest('req1', 'u1', 'pending')
      const onReview = vi.fn().mockResolvedValue({ success: true })

      render(
        <TimeOffReviewModal
          {...defaultProps}
          request={request}
          open={true}
          onReview={onReview}
        />,
      )

      const approveButton = screen.getByRole('button', { name: /Approve/i })
      await userEvent.click(approveButton)

      await waitFor(() => {
        expect(onReview).toHaveBeenCalledWith('req1', {
          status: 'approved',
          reviewed_by: 'admin1',
          review_notes: null,
        })
      })
    })

    it('calls onReview with denied status when Deny clicked', async () => {
      const request = createRequest('req1', 'u1', 'pending')
      const onReview = vi.fn().mockResolvedValue({ success: true })

      render(
        <TimeOffReviewModal
          {...defaultProps}
          request={request}
          open={true}
          onReview={onReview}
        />,
      )

      const denyButton = screen.getByRole('button', { name: /Deny/i })
      await userEvent.click(denyButton)

      await waitFor(() => {
        expect(onReview).toHaveBeenCalledWith('req1', {
          status: 'denied',
          reviewed_by: 'admin1',
          review_notes: null,
        })
      })
    })

    it('includes review notes when provided', async () => {
      const request = createRequest('req1', 'u1', 'pending')
      const onReview = vi.fn().mockResolvedValue({ success: true })

      render(
        <TimeOffReviewModal
          {...defaultProps}
          request={request}
          open={true}
          onReview={onReview}
        />,
      )

      const notesInput = screen.getByLabelText(/Review Notes/i)
      await userEvent.type(notesInput, 'Coverage looks good')

      const approveButton = screen.getByRole('button', { name: /Approve/i })
      await userEvent.click(approveButton)

      await waitFor(() => {
        expect(onReview).toHaveBeenCalledWith('req1', {
          status: 'approved',
          reviewed_by: 'admin1',
          review_notes: 'Coverage looks good',
        })
      })
    })

    it('closes modal after successful review', async () => {
      const request = createRequest('req1', 'u1', 'pending')
      const onReview = vi.fn().mockResolvedValue({ success: true })
      const onClose = vi.fn()

      render(
        <TimeOffReviewModal
          {...defaultProps}
          request={request}
          open={true}
          onReview={onReview}
          onClose={onClose}
        />,
      )

      const approveButton = screen.getByRole('button', { name: /Approve/i })
      await userEvent.click(approveButton)

      await waitFor(() => {
        expect(onClose).toHaveBeenCalled()
      })
    })

    it('does not close modal if review fails', async () => {
      const request = createRequest('req1', 'u1', 'pending')
      const onReview = vi.fn().mockResolvedValue({ success: false, error: 'Network error' })
      const onClose = vi.fn()

      render(
        <TimeOffReviewModal
          {...defaultProps}
          request={request}
          open={true}
          onReview={onReview}
          onClose={onClose}
        />,
      )

      const approveButton = screen.getByRole('button', { name: /Approve/i })
      await userEvent.click(approveButton)

      await waitFor(() => {
        expect(onReview).toHaveBeenCalled()
      })

      expect(onClose).not.toHaveBeenCalled()
    })
  })

  describe('already reviewed requests', () => {
    it('shows reviewer info for reviewed requests', () => {
      const request = createRequest('req1', 'u1', 'approved')

      render(
        <TimeOffReviewModal
          {...defaultProps}
          request={request}
          open={true}
        />,
      )

      expect(screen.getByText(/Reviewed by/i)).toBeInTheDocument()
      expect(screen.getByText('Admin User')).toBeInTheDocument()
    })

    it('shows review notes if provided', () => {
      const request = createRequest('req1', 'u1', 'approved')

      render(
        <TimeOffReviewModal
          {...defaultProps}
          request={request}
          open={true}
        />,
      )

      expect(screen.getByText('Approved due to sufficient coverage')).toBeInTheDocument()
    })

    it('shows Close button instead of Approve/Deny for reviewed requests', () => {
      const request = createRequest('req1', 'u1', 'approved')

      render(
        <TimeOffReviewModal
          {...defaultProps}
          request={request}
          open={true}
        />,
      )

      expect(screen.getByRole('button', { name: /Close/i })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Approve/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Deny/i })).not.toBeInTheDocument()
    })

    it('does not show review notes textarea for reviewed requests', () => {
      const request = createRequest('req1', 'u1', 'approved')

      render(
        <TimeOffReviewModal
          {...defaultProps}
          request={request}
          open={true}
        />,
      )

      expect(screen.queryByLabelText(/Review Notes/i)).not.toBeInTheDocument()
    })
  })

  // ------------------------------------------
  // Phase 14: Toast notifications
  // ------------------------------------------
  describe('toast notifications', () => {
    it('shows success toast when request is approved', async () => {
      const user = userEvent.setup()
      const mockOnReview = vi.fn().mockResolvedValue({ success: true })
      const request = createRequest('req1', 'u1', 'pending')

      render(
        <TimeOffReviewModal
          {...defaultProps}
          request={request}
          open={true}
          onReview={mockOnReview}
        />,
      )

      const approveButton = screen.getByRole('button', { name: /Approve/i })
      await user.click(approveButton)

      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'success',
            title: 'Request Approved',
            message: expect.stringContaining('approved'),
          })
        )
      })
    })

    it('shows success toast when request is denied', async () => {
      const user = userEvent.setup()
      const mockOnReview = vi.fn().mockResolvedValue({ success: true })
      const request = createRequest('req1', 'u1', 'pending')

      render(
        <TimeOffReviewModal
          {...defaultProps}
          request={request}
          open={true}
          onReview={mockOnReview}
        />,
      )

      const denyButton = screen.getByRole('button', { name: /Deny/i })
      await user.click(denyButton)

      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'success',
            title: 'Request Denied',
            message: expect.stringContaining('denied'),
          })
        )
      })
    })

    it('shows error toast when review fails', async () => {
      const user = userEvent.setup()
      const mockOnReview = vi.fn().mockResolvedValue({ success: false, error: 'Database error' })
      const request = createRequest('req1', 'u1', 'pending')

      render(
        <TimeOffReviewModal
          {...defaultProps}
          request={request}
          open={true}
          onReview={mockOnReview}
        />,
      )

      const approveButton = screen.getByRole('button', { name: /Approve/i })
      await user.click(approveButton)

      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'error',
            title: 'Approval Failed',
            message: 'Database error',
          })
        )
      })
    })

    it('displays error message in modal when review fails', async () => {
      const user = userEvent.setup()
      const mockOnReview = vi.fn().mockResolvedValue({ success: false, error: 'Network timeout' })
      const request = createRequest('req1', 'u1', 'pending')

      render(
        <TimeOffReviewModal
          {...defaultProps}
          request={request}
          open={true}
          onReview={mockOnReview}
        />,
      )

      const approveButton = screen.getByRole('button', { name: /Approve/i })
      await user.click(approveButton)

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument()
        expect(screen.getByText(/Network timeout/i)).toBeInTheDocument()
      })
    })
  })
})
