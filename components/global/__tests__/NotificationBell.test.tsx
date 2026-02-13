import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { NotificationBell } from '../NotificationBell'
import type { DashboardAlert } from '@/lib/hooks/useDashboardAlerts'

// Mutable mock state
const mockReturn = {
  data: null as DashboardAlert[] | null,
  loading: false,
  error: null as string | null,
}

vi.mock('@/lib/hooks/useDashboardAlerts', () => ({
  useDashboardAlerts: () => mockReturn,
}))

vi.mock('next/link', () => ({
  default: ({ children, href, onClick, ...props }: { children: React.ReactNode; href: string; onClick?: () => void; [key: string]: unknown }) => (
    <a href={href} onClick={onClick} {...props}>{children}</a>
  ),
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
  {
    id: 'alert-stale-cases',
    type: 'stale_cases',
    priority: 'low',
    title: '3 past cases still scheduled',
    description: 'Cases with a past date still marked scheduled.',
    count: 3,
    linkTo: '/cases?filter=stale',
  },
]

describe('NotificationBell', () => {
  beforeEach(() => {
    // Default: 3 alerts loaded
    mockReturn.data = mockAlerts
    mockReturn.loading = false
    mockReturn.error = null
  })

  it('renders the bell button', () => {
    render(<NotificationBell />)
    const button = screen.getByRole('button', { name: /notifications/i })
    expect(button).toBeTruthy()
  })

  it('shows alert count badge when alerts exist', () => {
    render(<NotificationBell />)
    expect(screen.getByText('3')).toBeTruthy()
  })

  it('dropdown is closed by default', () => {
    render(<NotificationBell />)
    expect(screen.queryByText('Notifications')).toBeNull()
  })

  it('opens dropdown when bell is clicked', () => {
    render(<NotificationBell />)
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }))
    expect(screen.getByText('Notifications')).toBeTruthy()
  })

  it('shows all alert items in dropdown', () => {
    render(<NotificationBell />)
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }))

    expect(screen.getByText('2 rooms running behind')).toBeTruthy()
    expect(screen.getByText('5 cases need validation')).toBeTruthy()
    expect(screen.getByText('3 past cases still scheduled')).toBeTruthy()
  })

  it('renders alert descriptions in dropdown', () => {
    render(<NotificationBell />)
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }))
    expect(screen.getByText('OR 1 is 15 min over.')).toBeTruthy()
  })

  it('renders clickable alert items with correct links', () => {
    render(<NotificationBell />)
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }))

    const links = screen.getAllByRole('link')
    const hrefs = links.map((link) => link.getAttribute('href'))
    expect(hrefs).toContain('/rooms')
    expect(hrefs).toContain('/cases?filter=needs_validation')
    expect(hrefs).toContain('/cases?filter=stale')
  })

  it('shows View all on Dashboard link', () => {
    render(<NotificationBell />)
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }))

    expect(screen.getByText('View all on Dashboard')).toBeTruthy()
    const dashboardLink = screen.getByText('View all on Dashboard').closest('a')
    expect(dashboardLink?.getAttribute('href')).toBe('/dashboard')
  })

  it('closes dropdown when bell is clicked again', () => {
    render(<NotificationBell />)
    const button = screen.getByRole('button', { name: /notifications/i })

    fireEvent.click(button)
    expect(screen.getByText('Notifications')).toBeTruthy()

    fireEvent.click(button)
    expect(screen.queryByText('Notifications')).toBeNull()
  })

  it('shows empty state when no alerts', () => {
    mockReturn.data = []

    render(<NotificationBell />)
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }))

    expect(screen.getByText('All clear')).toBeTruthy()
    expect(screen.getByText('No items need attention.')).toBeTruthy()
  })

  it('does not show badge when no alerts', () => {
    mockReturn.data = []

    const { container } = render(<NotificationBell />)
    const badge = container.querySelector('.bg-red-500.text-white')
    expect(badge).toBeNull()
  })

  it('shows loading state in dropdown', () => {
    mockReturn.data = null
    mockReturn.loading = true

    const { container } = render(<NotificationBell />)
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }))

    expect(screen.getByText('Loading...')).toBeTruthy()
    expect(container.querySelector('.animate-spin')).toBeTruthy()
  })
})
