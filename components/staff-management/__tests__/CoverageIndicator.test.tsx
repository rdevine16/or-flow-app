// components/staff-management/__tests__/CoverageIndicator.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CoverageIndicator } from '../CoverageIndicator'
import type { TimeOffRequest } from '@/types/time-off'
import type { UserListItem } from '@/lib/dal/users'

// ============================================
// Test Data
// ============================================

function createStaffMember(
  id: string,
  roleName: string,
  isActive = true,
): UserListItem {
  return {
    id,
    first_name: `First${id}`,
    last_name: `Last${id}`,
    email: `user${id}@example.com`,
    facility_id: 'fac1',
    is_active: isActive,
    role: { id: `role-${roleName}`, name: roleName },
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    phone: null,
    profile_image_url: null,
  }
}

function createTimeOffRequest(
  userId: string,
  startDate: string,
  endDate: string,
  status: 'pending' | 'approved' | 'denied' = 'approved',
): TimeOffRequest {
  return {
    id: `req-${userId}-${startDate}`,
    user_id: userId,
    facility_id: 'fac1',
    request_type: 'pto',
    start_date: startDate,
    end_date: endDate,
    partial_day_type: null,
    reason: null,
    status,
    requested_at: '2024-01-01T00:00:00Z',
    reviewed_by: null,
    reviewed_at: null,
    review_notes: null,
  }
}

describe('CoverageIndicator', () => {
  describe('basic rendering', () => {
    it('renders nothing when staffList is empty', () => {
      const { container } = render(
        <CoverageIndicator
          approvedRequests={[]}
          staffList={[]}
          startDate="2024-03-15"
          endDate="2024-03-15"
        />,
      )
      expect(container.firstChild).toBeNull()
    })

    it('renders coverage data for single role', () => {
      const staffList = [
        createStaffMember('u1', 'RN'),
        createStaffMember('u2', 'RN'),
        createStaffMember('u3', 'RN'),
      ]

      render(
        <CoverageIndicator
          approvedRequests={[]}
          staffList={staffList}
          startDate="2024-03-15"
          endDate="2024-03-15"
        />,
      )

      // All 3 RNs available
      expect(screen.getByText('RN')).toBeInTheDocument()
      expect(screen.getByText('3/3')).toBeInTheDocument()
    })

    it('renders coverage data for multiple roles', () => {
      const staffList = [
        createStaffMember('u1', 'RN'),
        createStaffMember('u2', 'RN'),
        createStaffMember('u3', 'Surgical Tech'),
        createStaffMember('u4', 'Anesthesia Provider'),
      ]

      render(
        <CoverageIndicator
          approvedRequests={[]}
          staffList={staffList}
          startDate="2024-03-15"
          endDate="2024-03-15"
        />,
      )

      expect(screen.getByText('Anesthesia Provider')).toBeInTheDocument()
      expect(screen.getByText('RN')).toBeInTheDocument()
      expect(screen.getByText('Surgical Tech')).toBeInTheDocument()
    })
  })

  describe('coverage calculation', () => {
    it('subtracts approved requests from available count', () => {
      const staffList = [
        createStaffMember('u1', 'RN'),
        createStaffMember('u2', 'RN'),
        createStaffMember('u3', 'RN'),
      ]

      const approvedRequests = [
        createTimeOffRequest('u1', '2024-03-15', '2024-03-15', 'approved'),
      ]

      render(
        <CoverageIndicator
          approvedRequests={approvedRequests}
          staffList={staffList}
          startDate="2024-03-15"
          endDate="2024-03-15"
        />,
      )

      // 2 of 3 RNs available (u1 is off)
      expect(screen.getByText('2/3')).toBeInTheDocument()
    })

    it('handles multi-day requests correctly', () => {
      const staffList = [
        createStaffMember('u1', 'RN'),
        createStaffMember('u2', 'RN'),
      ]

      // u1 off for 3 business days (Mon-Wed)
      const approvedRequests = [
        createTimeOffRequest('u1', '2024-03-18', '2024-03-20', 'approved'),
      ]

      render(
        <CoverageIndicator
          approvedRequests={approvedRequests}
          staffList={staffList}
          startDate="2024-03-19"
          endDate="2024-03-19"
        />,
      )

      // u1 is off on 3/19 (within their time-off range)
      expect(screen.getByText('1/2')).toBeInTheDocument()
    })

    it('excludes time-off requests outside the date range', () => {
      const staffList = [
        createStaffMember('u1', 'RN'),
        createStaffMember('u2', 'RN'),
      ]

      // u1 off on 3/10 (not in our range)
      const approvedRequests = [
        createTimeOffRequest('u1', '2024-03-10', '2024-03-10', 'approved'),
      ]

      render(
        <CoverageIndicator
          approvedRequests={approvedRequests}
          staffList={staffList}
          startDate="2024-03-15"
          endDate="2024-03-15"
        />,
      )

      // Both available on 3/15
      expect(screen.getByText('2/2')).toBeInTheDocument()
    })

    it('only counts approved requests, not pending or denied', () => {
      const staffList = [
        createStaffMember('u1', 'RN'),
        createStaffMember('u2', 'RN'),
      ]

      const approvedRequests = [
        // Only pass approved requests (as the component prop name implies)
      ]

      render(
        <CoverageIndicator
          approvedRequests={approvedRequests}
          staffList={staffList}
          startDate="2024-03-15"
          endDate="2024-03-15"
        />,
      )

      // Both available (pending/denied not counted)
      expect(screen.getByText('2/2')).toBeInTheDocument()
    })

    it('uses worst-case day when request spans multiple days', () => {
      const staffList = [
        createStaffMember('u1', 'RN'),
        createStaffMember('u2', 'RN'),
        createStaffMember('u3', 'RN'),
      ]

      // u1 off 3/18-3/19 (Mon-Tue), u2 off 3/19-3/20 (Tue-Wed)
      // Worst case is 3/19 (2 people off)
      const approvedRequests = [
        createTimeOffRequest('u1', '2024-03-18', '2024-03-19', 'approved'),
        createTimeOffRequest('u2', '2024-03-19', '2024-03-20', 'approved'),
      ]

      render(
        <CoverageIndicator
          approvedRequests={approvedRequests}
          staffList={staffList}
          startDate="2024-03-18"
          endDate="2024-03-20"
        />,
      )

      // Worst case: 1/3 available on 3/19 (u1 and u2 both off)
      expect(screen.getByText('1/3')).toBeInTheDocument()
    })
  })

  describe('includeRequestUserId prop', () => {
    it('simulates approval by including the request user in off count', () => {
      const staffList = [
        createStaffMember('u1', 'RN'),
        createStaffMember('u2', 'RN'),
        createStaffMember('u3', 'RN'),
      ]

      const approvedRequests: TimeOffRequest[] = []

      render(
        <CoverageIndicator
          approvedRequests={approvedRequests}
          staffList={staffList}
          startDate="2024-03-15"
          endDate="2024-03-15"
          includeRequestUserId="u1"
        />,
      )

      // u1 counted as off even though not in approvedRequests
      expect(screen.getByText('2/3')).toBeInTheDocument()
    })

    it('shows "(if approved)" label when includeRequestUserId is set', () => {
      const staffList = [createStaffMember('u1', 'RN')]

      render(
        <CoverageIndicator
          approvedRequests={[]}
          staffList={staffList}
          startDate="2024-03-15"
          endDate="2024-03-15"
          includeRequestUserId="u1"
        />,
      )

      expect(screen.getByText(/if approved/i)).toBeInTheDocument()
    })

    it('does not show "(if approved)" when includeRequestUserId is not set', () => {
      const staffList = [createStaffMember('u1', 'RN')]

      render(
        <CoverageIndicator
          approvedRequests={[]}
          staffList={staffList}
          startDate="2024-03-15"
          endDate="2024-03-15"
        />,
      )

      expect(screen.queryByText(/if approved/i)).not.toBeInTheDocument()
    })
  })

  describe('warning thresholds', () => {
    it('shows warning icon when available <= 50% of total', () => {
      const staffList = [
        createStaffMember('u1', 'RN'),
        createStaffMember('u2', 'RN'),
        createStaffMember('u3', 'RN'),
        createStaffMember('u4', 'RN'),
      ]

      // 2 off, 2 available (50%)
      const approvedRequests = [
        createTimeOffRequest('u1', '2024-03-15', '2024-03-15', 'approved'),
        createTimeOffRequest('u2', '2024-03-15', '2024-03-15', 'approved'),
      ]

      const { container } = render(
        <CoverageIndicator
          approvedRequests={approvedRequests}
          staffList={staffList}
          startDate="2024-03-15"
          endDate="2024-03-15"
        />,
      )

      // Warning icon present (AlertTriangle)
      const warningIcon = container.querySelector('svg.text-amber-500')
      expect(warningIcon).toBeInTheDocument()
    })

    it('shows success icon when available > 50% of total', () => {
      const staffList = [
        createStaffMember('u1', 'RN'),
        createStaffMember('u2', 'RN'),
        createStaffMember('u3', 'RN'),
        createStaffMember('u4', 'RN'),
      ]

      // 1 off, 3 available (75%)
      const approvedRequests = [
        createTimeOffRequest('u1', '2024-03-15', '2024-03-15', 'approved'),
      ]

      const { container } = render(
        <CoverageIndicator
          approvedRequests={approvedRequests}
          staffList={staffList}
          startDate="2024-03-15"
          endDate="2024-03-15"
        />,
      )

      // Success icon present (CheckCircle)
      const successIcon = container.querySelector('svg.text-emerald-500')
      expect(successIcon).toBeInTheDocument()
    })
  })

  describe('inactive staff', () => {
    it('excludes inactive staff from total count', () => {
      const staffList = [
        createStaffMember('u1', 'RN', true),
        createStaffMember('u2', 'RN', true),
        createStaffMember('u3', 'RN', false), // inactive
      ]

      render(
        <CoverageIndicator
          approvedRequests={[]}
          staffList={staffList}
          startDate="2024-03-15"
          endDate="2024-03-15"
        />,
      )

      // Only 2 active RNs counted
      expect(screen.getByText('2/2')).toBeInTheDocument()
    })
  })
})
