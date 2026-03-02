import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { NotificationBell } from '../NotificationBell'
import type { DashboardAlert } from '@/lib/hooks/useDashboardAlerts'

// Mutable mock state
const mockAlertsReturn = {
  data: null as DashboardAlert[] | null,
  loading: false,
  error: null as string | null,
  refetch: vi.fn(),
  setData: vi.fn(),
  dismissAlert: vi.fn(),
  isDismissed: vi.fn(() => false),
}

const mockUnreadCountReturn = {
  count: 0,
  loading: false,
  decrement: vi.fn(),
  clearCount: vi.fn(),
  refetch: vi.fn(),
}

vi.mock('@/lib/hooks/useDashboardAlerts', () => ({
  useDashboardAlerts: () => mockAlertsReturn,
}))

vi.mock('@/lib/hooks/useUnreadCount', () => ({
  useUnreadCount: () => mockUnreadCountReturn,
}))

// Mock NotificationPanel — the panel is tested separately
vi.mock('../NotificationPanel', () => ({
  NotificationPanel: ({ open }: { open: boolean; onOpenChange: (v: boolean) => void }) =>
    open ? <div data-testid="notification-panel">Panel Open</div> : null,
}))

const mockAlerts: DashboardAlert[] = [
  {
    id: 'alert-behind-schedule',
    type: 'behind_schedule',
    priority: 'high',
    title: '2 rooms running behind',
    description: 'OR 1 is 15 min over.',
    count: 2,
    linkTo: '/rooms',
  },
  {
    id: 'alert-validation',
    type: 'validation',
    priority: 'medium',
    title: '5 cases need validation',
    description: 'Completed cases not yet validated.',
    count: 5,
    linkTo: '/cases?filter=needs_validation',
  },
]

describe('NotificationBell', () => {
  beforeEach(() => {
    mockAlertsReturn.data = mockAlerts
    mockAlertsReturn.loading = false
    mockAlertsReturn.error = null
    mockUnreadCountReturn.count = 0
  })

  it('renders the bell button', () => {
    render(<NotificationBell />)
    const button = screen.getByRole('button', { name: /notifications/i })
    expect(button).toBeTruthy()
  })

  it('shows merged badge count (alerts + unread notifications)', () => {
    mockUnreadCountReturn.count = 3
    render(<NotificationBell />)
    // 2 alerts + 3 unread = 5
    expect(screen.getByText('5')).toBeTruthy()
  })

  it('shows only alert count when no unread notifications', () => {
    mockUnreadCountReturn.count = 0
    render(<NotificationBell />)
    expect(screen.getByText('2')).toBeTruthy()
  })

  it('shows only unread count when no alerts', () => {
    mockAlertsReturn.data = []
    mockUnreadCountReturn.count = 4
    render(<NotificationBell />)
    expect(screen.getByText('4')).toBeTruthy()
  })

  it('does not show badge when no alerts and no unread', () => {
    mockAlertsReturn.data = []
    mockUnreadCountReturn.count = 0
    const { container } = render(<NotificationBell />)
    const badge = container.querySelector('.bg-red-500.text-white')
    expect(badge).toBeNull()
  })

  it('shows 9+ when total badge exceeds 9', () => {
    mockAlertsReturn.data = mockAlerts
    mockUnreadCountReturn.count = 8  // 2 + 8 = 10
    render(<NotificationBell />)
    expect(screen.getByText('9+')).toBeTruthy()
  })

  it('panel is closed by default', () => {
    render(<NotificationBell />)
    expect(screen.queryByTestId('notification-panel')).toBeNull()
  })

  it('opens panel when bell is clicked', () => {
    render(<NotificationBell />)
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }))
    expect(screen.getByTestId('notification-panel')).toBeTruthy()
  })
})
