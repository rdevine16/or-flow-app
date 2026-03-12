// components/staff-management/__tests__/CalendarDayCell.test.tsx
// Unit tests for CalendarDayCell component.
// Tests badge rendering, coverage indicators, and visual states.

import { describe, test, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CalendarDayCell } from '../CalendarDayCell'
import type { TimeOffRequest } from '@/types/time-off'

// ============================================
// Mock Data Factory
// ============================================

const mockRequest = (
  id: string,
  userId: string,
  firstName: string,
  lastName: string,
  status: 'pending' | 'approved' | 'denied',
  requestType: 'pto' | 'sick' | 'personal' = 'pto',
): TimeOffRequest => ({
  id,
  facility_id: 'fac-1',
  user_id: userId,
  start_date: '2026-03-10',
  end_date: '2026-03-10',
  request_type: requestType,
  status,
  notes: null,
  created_at: '2026-03-01T00:00:00Z',
  updated_at: '2026-03-01T00:00:00Z',
  user: {
    id: userId,
    first_name: firstName,
    last_name: lastName,
    email: `${firstName.toLowerCase()}@example.com`,
  },
})

// ============================================
// Tests
// ============================================

describe('CalendarDayCell', () => {
  test('renders day number', () => {
    const date = new Date(2026, 2, 15) // March 15
    render(
      <CalendarDayCell
        date={date}
        isCurrentMonth={true}
        isToday={false}
        requests={[]}
        approvedOffCount={0}
        totalStaff={10}
      />,
    )

    expect(screen.getByText('15')).toBeInTheDocument()
  })

  test('highlights today with blue ring and circle', () => {
    const date = new Date(2026, 2, 15)
    const { container } = render(
      <CalendarDayCell
        date={date}
        isCurrentMonth={true}
        isToday={true}
        requests={[]}
        approvedOffCount={0}
        totalStaff={10}
      />,
    )

    // Today should have ring-2 ring-blue-400 ring-inset
    const cell = container.firstChild as HTMLElement
    expect(cell.className).toContain('ring-2')
    expect(cell.className).toContain('ring-blue-400')

    // Day number should have blue background circle
    const dayNum = screen.getByText('15')
    expect(dayNum.className).toContain('bg-blue-600')
    expect(dayNum.className).toContain('text-white')
  })

  test('dims days outside current month', () => {
    const date = new Date(2026, 2, 30) // March 30, but rendered in April calendar
    const { container } = render(
      <CalendarDayCell
        date={date}
        isCurrentMonth={false}
        isToday={false}
        requests={[]}
        approvedOffCount={0}
        totalStaff={10}
      />,
    )

    // Cell should have bg-slate-50/50 for out-of-month days
    const cell = container.firstChild as HTMLElement
    expect(cell.className).toContain('bg-slate-50/50')

    // Day number should be text-slate-400
    const dayNum = screen.getByText('30')
    expect(dayNum.className).toContain('text-slate-400')
  })

  test('applies weekend styling', () => {
    const sunday = new Date(2026, 2, 1) // March 1, 2026 is a Sunday
    const { container } = render(
      <CalendarDayCell
        date={sunday}
        isCurrentMonth={true}
        isToday={false}
        requests={[]}
        approvedOffCount={0}
        totalStaff={10}
      />,
    )

    // Weekend should have bg-slate-50/30
    const cell = container.firstChild as HTMLElement
    expect(cell.className).toContain('bg-slate-50/30')
  })

  test('renders up to 3 request badges', () => {
    const requests = [
      mockRequest('r1', 'u1', 'Alice', 'Smith', 'approved'),
      mockRequest('r2', 'u2', 'Bob', 'Johnson', 'pending'),
      mockRequest('r3', 'u3', 'Charlie', 'Brown', 'denied'),
    ]

    render(
      <CalendarDayCell
        date={new Date(2026, 2, 15)}
        isCurrentMonth={true}
        isToday={false}
        requests={requests}
        approvedOffCount={0}
        totalStaff={10}
      />,
    )

    expect(screen.getByText(/A\. Smith/i)).toBeInTheDocument()
    expect(screen.getByText(/B\. Johnson/i)).toBeInTheDocument()
    expect(screen.getByText(/C\. Brown/i)).toBeInTheDocument()
  })

  test('shows "+N more" for more than 3 requests', () => {
    const requests = [
      mockRequest('r1', 'u1', 'Alice', 'Smith', 'approved'),
      mockRequest('r2', 'u2', 'Bob', 'Johnson', 'pending'),
      mockRequest('r3', 'u3', 'Charlie', 'Brown', 'approved'),
      mockRequest('r4', 'u4', 'Dave', 'Wilson', 'pending'),
      mockRequest('r5', 'u5', 'Eve', 'Taylor', 'approved'),
    ]

    render(
      <CalendarDayCell
        date={new Date(2026, 2, 15)}
        isCurrentMonth={true}
        isToday={false}
        requests={requests}
        approvedOffCount={0}
        totalStaff={10}
      />,
    )

    // Should show first 3 badges
    expect(screen.getByText(/A\. Smith/i)).toBeInTheDocument()
    expect(screen.getByText(/B\. Johnson/i)).toBeInTheDocument()
    expect(screen.getByText(/C\. Brown/i)).toBeInTheDocument()

    // Should NOT show 4th and 5th badges
    expect(screen.queryByText(/D\. Wilson/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/E\. Taylor/i)).not.toBeInTheDocument()

    // Should show "+2 more"
    expect(screen.getByText('+2 more')).toBeInTheDocument()
  })

  test('applies correct status colors to badges', () => {
    const requests = [
      mockRequest('r1', 'u1', 'Alice', 'Smith', 'approved'),
      mockRequest('r2', 'u2', 'Bob', 'Johnson', 'pending'),
      mockRequest('r3', 'u3', 'Charlie', 'Brown', 'denied'),
    ]

    render(
      <CalendarDayCell
        date={new Date(2026, 2, 15)}
        isCurrentMonth={true}
        isToday={false}
        requests={requests}
        approvedOffCount={0}
        totalStaff={10}
      />,
    )

    // Approved: emerald (parent button has the className)
    const approvedBadge = screen.getByText(/A\. Smith/i).closest('button')!
    expect(approvedBadge.className).toContain('bg-emerald-50')
    expect(approvedBadge.className).toContain('border-l-emerald-400')

    // Pending: amber
    const pendingBadge = screen.getByText(/B\. Johnson/i).closest('button')!
    expect(pendingBadge.className).toContain('bg-amber-50')
    expect(pendingBadge.className).toContain('border-l-amber-400')

    // Denied: slate (greyed out)
    const deniedBadge = screen.getByText(/C\. Brown/i).closest('button')!
    expect(deniedBadge.className).toContain('bg-slate-100')
    expect(deniedBadge.className).toContain('border-l-slate-300')
    expect(deniedBadge.className).toContain('line-through')
  })

  test('shows coverage indicator when approvedOffCount > 0', () => {
    render(
      <CalendarDayCell
        date={new Date(2026, 2, 15)}
        isCurrentMonth={true}
        isToday={false}
        requests={[]}
        approvedOffCount={3}
        totalStaff={10}
      />,
    )

    expect(screen.getByText('3 off')).toBeInTheDocument()
  })

  test('hides coverage indicator on out-of-month days', () => {
    render(
      <CalendarDayCell
        date={new Date(2026, 2, 15)}
        isCurrentMonth={false}
        isToday={false}
        requests={[]}
        approvedOffCount={3}
        totalStaff={10}
      />,
    )

    expect(screen.queryByText('3 off')).not.toBeInTheDocument()
  })

  test('shows amber coverage indicator when < 25% staff off', () => {
    // 2 out of 10 = 20% (below threshold)
    render(
      <CalendarDayCell
        date={new Date(2026, 2, 15)}
        isCurrentMonth={true}
        isToday={false}
        requests={[]}
        approvedOffCount={2}
        totalStaff={10}
      />,
    )

    const badge = screen.getByText('2 off')
    expect(badge.className).toContain('bg-amber-100')
    expect(badge.className).toContain('text-amber-700')
  })

  test('shows red coverage warning when >= 25% staff off', () => {
    // 3 out of 10 = 30% (above threshold, Math.ceil(10 * 0.25) = 3)
    render(
      <CalendarDayCell
        date={new Date(2026, 2, 15)}
        isCurrentMonth={true}
        isToday={false}
        requests={[]}
        approvedOffCount={3}
        totalStaff={10}
      />,
    )

    const badge = screen.getByText('3 off')
    expect(badge.className).toContain('bg-red-100')
    expect(badge.className).toContain('text-red-700')
  })

  test('coverage warning threshold calculation uses Math.ceil', () => {
    // 5 out of 18 staff = 27.8% → Math.ceil(18 * 0.25) = 5
    // 5 >= 5 → red warning
    render(
      <CalendarDayCell
        date={new Date(2026, 2, 15)}
        isCurrentMonth={true}
        isToday={false}
        requests={[]}
        approvedOffCount={5}
        totalStaff={18}
      />,
    )

    const badge = screen.getByText('5 off')
    expect(badge.className).toContain('bg-red-100')
  })

  test('handles zero totalStaff without crashing', () => {
    render(
      <CalendarDayCell
        date={new Date(2026, 2, 15)}
        isCurrentMonth={true}
        isToday={false}
        requests={[]}
        approvedOffCount={0}
        totalStaff={0}
      />,
    )

    // Should render without error, no coverage badge
    expect(screen.getByText('15')).toBeInTheDocument()
    expect(screen.queryByText(/off/i)).not.toBeInTheDocument()
  })

  test('invokes onRequestClick when badge is clicked', async () => {
    const onRequestClick = vi.fn()
    const requests = [mockRequest('r1', 'u1', 'Alice', 'Smith', 'approved')]

    render(
      <CalendarDayCell
        date={new Date(2026, 2, 15)}
        isCurrentMonth={true}
        isToday={false}
        requests={requests}
        approvedOffCount={1}
        totalStaff={10}
        onRequestClick={onRequestClick}
      />,
    )

    const user = userEvent.setup()
    const badge = screen.getByText(/A\. Smith/i)
    await user.click(badge)

    expect(onRequestClick).toHaveBeenCalledWith(requests[0])
  })

  test('does not crash when onRequestClick is undefined', async () => {
    const requests = [mockRequest('r1', 'u1', 'Alice', 'Smith', 'approved')]

    render(
      <CalendarDayCell
        date={new Date(2026, 2, 15)}
        isCurrentMonth={true}
        isToday={false}
        requests={requests}
        approvedOffCount={1}
        totalStaff={10}
      />,
    )

    const user = userEvent.setup()
    const badge = screen.getByText(/A\. Smith/i)

    // Should not throw
    await user.click(badge)
  })

  test('badge displays request type label', () => {
    const requests = [
      mockRequest('r1', 'u1', 'Alice', 'Smith', 'approved', 'pto'),
      mockRequest('r2', 'u2', 'Bob', 'Johnson', 'pending', 'sick'),
    ]

    render(
      <CalendarDayCell
        date={new Date(2026, 2, 15)}
        isCurrentMonth={true}
        isToday={false}
        requests={requests}
        approvedOffCount={1}
        totalStaff={10}
      />,
    )

    // REQUEST_TYPE_LABELS: pto = "PTO", sick = "Sick"
    expect(screen.getByText(/PTO/i)).toBeInTheDocument()
    expect(screen.getByText(/Sick/i)).toBeInTheDocument()
  })

  test('renders empty cell when no requests', () => {
    const { container } = render(
      <CalendarDayCell
        date={new Date(2026, 2, 15)}
        isCurrentMonth={true}
        isToday={false}
        requests={[]}
        approvedOffCount={0}
        totalStaff={10}
      />,
    )

    expect(screen.getByText('15')).toBeInTheDocument()

    // No badges
    expect(container.querySelector('button')).not.toBeInTheDocument()
  })
})
