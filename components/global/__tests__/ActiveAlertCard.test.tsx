import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ActiveAlertCard } from '../ActiveAlertCard'
import type { DashboardAlert } from '@/lib/hooks/useDashboardAlerts'

vi.mock('next/link', () => ({
  default: ({ children, href, onClick, ...props }: { children: React.ReactNode; href: string; onClick?: () => void; [key: string]: unknown }) => (
    <a href={href} onClick={onClick} {...props}>{children}</a>
  ),
}))

const mockAlert: DashboardAlert = {
  id: 'alert-behind-schedule',
  type: 'behind_schedule',
  priority: 'high',
  title: '2 rooms running behind',
  description: 'OR 1 is 15 min over.',
  count: 2,
  linkTo: '/rooms',
}

describe('ActiveAlertCard', () => {
  const mockDismiss = vi.fn()
  const mockNavigate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders alert title and description', () => {
    render(
      <ActiveAlertCard alert={mockAlert} onDismiss={mockDismiss} onNavigate={mockNavigate} />
    )
    expect(screen.getByText('2 rooms running behind')).toBeTruthy()
    expect(screen.getByText('OR 1 is 15 min over.')).toBeTruthy()
  })

  it('renders priority dot with correct color', () => {
    const { container } = render(
      <ActiveAlertCard alert={mockAlert} onDismiss={mockDismiss} onNavigate={mockNavigate} />
    )
    expect(container.querySelector('.bg-red-500')).toBeTruthy()
  })

  it('renders medium priority dot correctly', () => {
    const mediumAlert = { ...mockAlert, priority: 'medium' as const }
    const { container } = render(
      <ActiveAlertCard alert={mediumAlert} onDismiss={mockDismiss} onNavigate={mockNavigate} />
    )
    expect(container.querySelector('.bg-amber-500')).toBeTruthy()
  })

  it('navigates when clicked', () => {
    render(
      <ActiveAlertCard alert={mockAlert} onDismiss={mockDismiss} onNavigate={mockNavigate} />
    )
    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('/rooms')
    fireEvent.click(link)
    expect(mockNavigate).toHaveBeenCalled()
  })

  it('calls onDismiss when dismiss button is clicked', () => {
    render(
      <ActiveAlertCard alert={mockAlert} onDismiss={mockDismiss} onNavigate={mockNavigate} />
    )
    const dismissButton = screen.getByRole('button', { name: /dismiss/i })
    fireEvent.click(dismissButton)
    expect(mockDismiss).toHaveBeenCalledWith('alert-behind-schedule')
  })

  it('dismiss does not trigger navigation', () => {
    render(
      <ActiveAlertCard alert={mockAlert} onDismiss={mockDismiss} onNavigate={mockNavigate} />
    )
    const dismissButton = screen.getByRole('button', { name: /dismiss/i })
    fireEvent.click(dismissButton)
    expect(mockDismiss).toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
