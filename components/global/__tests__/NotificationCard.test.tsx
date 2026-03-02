import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { NotificationCard } from '../NotificationCard'
import type { NotificationWithReadState } from '@/lib/dal/notifications'

const mockPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

function makeNotification(overrides: Partial<NotificationWithReadState> = {}): NotificationWithReadState {
  return {
    id: 'notif-1',
    facility_id: 'fac-1',
    type: 'case_auto_created',
    title: 'Case Auto-Created: Jane Doe — Total Knee Arthroplasty',
    message: 'New case imported from Epic HL7v2',
    category: 'Case Alerts',
    metadata: { link_to: '/cases/case-123', source: 'epic_hl7v2' },
    room_id: null,
    case_id: 'case-123',
    sent_by: null,
    expires_at: null,
    created_at: new Date(Date.now() - 5 * 60_000).toISOString(), // 5 min ago
    is_read: false,
    read_at: null,
    ...overrides,
  }
}

describe('NotificationCard', () => {
  const mockMarkAsRead = vi.fn()
  const mockNavigate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders title and message', () => {
    render(
      <NotificationCard
        notification={makeNotification()}
        onMarkAsRead={mockMarkAsRead}
        onNavigate={mockNavigate}
      />
    )
    expect(screen.getByText(/Case Auto-Created/)).toBeTruthy()
    expect(screen.getByText(/New case imported/)).toBeTruthy()
  })

  it('shows unread dot for unread notifications', () => {
    const { container } = render(
      <NotificationCard
        notification={makeNotification({ is_read: false })}
        onMarkAsRead={mockMarkAsRead}
        onNavigate={mockNavigate}
      />
    )
    expect(container.querySelector('.bg-blue-500')).toBeTruthy()
  })

  it('does not show unread dot for read notifications', () => {
    const { container } = render(
      <NotificationCard
        notification={makeNotification({ is_read: true, read_at: new Date().toISOString() })}
        onMarkAsRead={mockMarkAsRead}
        onNavigate={mockNavigate}
      />
    )
    expect(container.querySelector('.bg-blue-500')).toBeNull()
  })

  it('shows source label for Epic HL7v2', () => {
    render(
      <NotificationCard
        notification={makeNotification()}
        onMarkAsRead={mockMarkAsRead}
        onNavigate={mockNavigate}
      />
    )
    expect(screen.getByText('via Epic HL7v2')).toBeTruthy()
  })

  it('shows relative timestamp', () => {
    render(
      <NotificationCard
        notification={makeNotification()}
        onMarkAsRead={mockMarkAsRead}
        onNavigate={mockNavigate}
      />
    )
    expect(screen.getByText('5m ago')).toBeTruthy()
  })

  it('navigates on click and marks as read', () => {
    render(
      <NotificationCard
        notification={makeNotification()}
        onMarkAsRead={mockMarkAsRead}
        onNavigate={mockNavigate}
      />
    )
    // The outer card is a div[role="button"], the inner "Mark as read" is a <button>
    const allButtons = screen.getAllByRole('button')
    fireEvent.click(allButtons[0])
    expect(mockMarkAsRead).toHaveBeenCalledWith('notif-1')
    expect(mockPush).toHaveBeenCalledWith('/cases/case-123')
    expect(mockNavigate).toHaveBeenCalled()
  })

  it('does not call markAsRead on click if already read', () => {
    render(
      <NotificationCard
        notification={makeNotification({ is_read: true })}
        onMarkAsRead={mockMarkAsRead}
        onNavigate={mockNavigate}
      />
    )
    // When is_read is true, there's no inner "Mark as read" button, so only one button
    fireEvent.click(screen.getByRole('button'))
    expect(mockMarkAsRead).not.toHaveBeenCalled()
    expect(mockPush).toHaveBeenCalledWith('/cases/case-123')
  })

  it('renders different icon for data_quality_issue type', () => {
    const { container } = render(
      <NotificationCard
        notification={makeNotification({ type: 'data_quality_issue', metadata: { link_to: '/data-quality' } })}
        onMarkAsRead={mockMarkAsRead}
        onNavigate={mockNavigate}
      />
    )
    // Should render an icon (AlertTriangle for data_quality_issue)
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('navigates to /data-quality when data_quality_issue notification clicked', () => {
    render(
      <NotificationCard
        notification={makeNotification({
          type: 'data_quality_issue',
          title: 'Data Quality: 5 new issues detected',
          message: 'Issue types: missing_data, stale_case',
          category: 'Reports & Summaries',
          metadata: { link_to: '/data-quality', issues_count: 5, issue_types: ['missing_data', 'stale_case'] },
          case_id: null,
        })}
        onMarkAsRead={mockMarkAsRead}
        onNavigate={mockNavigate}
      />
    )
    const allButtons = screen.getAllByRole('button')
    fireEvent.click(allButtons[0])
    expect(mockPush).toHaveBeenCalledWith('/data-quality')
    expect(mockMarkAsRead).toHaveBeenCalledWith('notif-1')
  })
})
