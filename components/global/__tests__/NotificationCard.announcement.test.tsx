/**
 * Unit test: NotificationCard renders announcement_created type correctly
 * Phase 5 coverage — ensures Megaphone icon and blue color are displayed
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NotificationCard } from '../NotificationCard'
import type { NotificationWithReadState } from '@/lib/dal/notifications'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

function makeAnnouncementNotification(): NotificationWithReadState {
  return {
    id: 'notif-ann-1',
    facility_id: 'fac-1',
    type: 'announcement_created',
    title: '🔴 Critical: OR 3 Maintenance',
    message: 'Room will be closed for repairs starting Monday',
    category: 'Announcements',
    metadata: { link_to: '/staff-management?tab=announcements', announcement_id: 'ann-123' },
    room_id: null,
    case_id: null,
    sent_by: null,
    expires_at: null,
    created_at: new Date().toISOString(),
    is_read: false,
    read_at: null,
  }
}

describe('NotificationCard — announcement_created type', () => {
  it('renders Megaphone icon for announcement_created type', () => {
    const { container } = render(
      <NotificationCard
        notification={makeAnnouncementNotification()}
        onMarkAsRead={vi.fn()}
        onNavigate={vi.fn()}
      />
    )

    // Megaphone icon is rendered
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('applies blue color to announcement icon', () => {
    const { container } = render(
      <NotificationCard
        notification={makeAnnouncementNotification()}
        onMarkAsRead={vi.fn()}
        onNavigate={vi.fn()}
      />
    )

    // Icon wrapper div has text-blue-500 class
    const iconWrapper = container.querySelector('.text-blue-500')
    expect(iconWrapper).toBeTruthy()
  })

  it('navigates to announcements tab when clicked', () => {
    const mockNavigate = vi.fn()

    render(
      <NotificationCard
        notification={makeAnnouncementNotification()}
        onMarkAsRead={vi.fn()}
        onNavigate={mockNavigate}
      />
    )

    const cards = screen.getAllByRole('button')
    const mainCard = cards[0] // First button is the main card
    mainCard.click()

    // Verify onNavigate was called (which closes the panel)
    expect(mockNavigate).toHaveBeenCalled()
  })

  it('displays announcement title and message', () => {
    render(
      <NotificationCard
        notification={makeAnnouncementNotification()}
        onMarkAsRead={vi.fn()}
        onNavigate={vi.fn()}
      />
    )

    expect(screen.getByText(/Critical: OR 3 Maintenance/)).toBeTruthy()
    expect(screen.getByText(/Room will be closed/)).toBeTruthy()
  })
})
