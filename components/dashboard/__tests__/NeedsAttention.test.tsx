import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NeedsAttention } from '../NeedsAttention'
import type { DashboardAlert } from '@/lib/hooks/useDashboardAlerts'

const mockAlerts: DashboardAlert[] = [
  {
    id: 'alert-behind-schedule',
    type: 'behind_schedule',
    priority: 'high',
    title: '2 rooms running behind',
    description: 'OR 1 is 15 min over and 1 other room.',
    count: 2,
    linkTo: '/rooms',
  },
  {
    id: 'alert-validation',
    type: 'validation',
    priority: 'medium',
    title: '5 cases need validation',
    description: 'Completed cases with all milestones recorded but not yet validated.',
    count: 5,
    linkTo: '/cases?filter=needs_validation',
  },
  {
    id: 'alert-stale-cases',
    type: 'stale_cases',
    priority: 'low',
    title: '3 past cases still scheduled',
    description: 'Cases with a past date that were never updated from scheduled status.',
    count: 3,
    linkTo: '/cases?filter=stale',
  },
]

describe('NeedsAttention', () => {
  it('renders loading skeleton when loading', () => {
    const { container } = render(<NeedsAttention alerts={[]} loading />)
    expect(container.querySelector('.animate-pulse')).toBeTruthy()
    expect(screen.getByText('Needs Attention')).toBeTruthy()
  })

  it('renders empty state when no alerts', () => {
    render(<NeedsAttention alerts={[]} />)
    expect(screen.getByText('All clear')).toBeTruthy()
    expect(screen.getByText('No items need attention right now.')).toBeTruthy()
  })

  it('renders alert items with titles', () => {
    render(<NeedsAttention alerts={mockAlerts} />)
    expect(screen.getByText('2 rooms running behind')).toBeTruthy()
    expect(screen.getByText('5 cases need validation')).toBeTruthy()
    expect(screen.getByText('3 past cases still scheduled')).toBeTruthy()
  })

  it('renders alert descriptions', () => {
    render(<NeedsAttention alerts={mockAlerts} />)
    expect(screen.getByText('OR 1 is 15 min over and 1 other room.')).toBeTruthy()
  })

  it('shows item count badge', () => {
    render(<NeedsAttention alerts={mockAlerts} />)
    expect(screen.getByText('3 items')).toBeTruthy()
  })

  it('shows singular item count for single alert', () => {
    render(<NeedsAttention alerts={[mockAlerts[0]]} />)
    expect(screen.getByText('1 item')).toBeTruthy()
  })

  it('renders clickable alert items with correct links', () => {
    render(<NeedsAttention alerts={mockAlerts} />)
    const links = screen.getAllByRole('link')

    const hrefs = links.map((link) => link.getAttribute('href'))
    expect(hrefs).toContain('/rooms')
    expect(hrefs).toContain('/cases?filter=needs_validation')
    expect(hrefs).toContain('/cases?filter=stale')
  })

  it('truncates to 6 items and shows overflow link', () => {
    const manyAlerts: DashboardAlert[] = Array.from({ length: 8 }, (_, i) => ({
      id: `alert-${i}`,
      type: 'validation' as const,
      priority: 'medium' as const,
      title: `Alert ${i + 1}`,
      description: `Description ${i + 1}`,
      count: i + 1,
      linkTo: '/cases',
    }))

    render(<NeedsAttention alerts={manyAlerts} />)

    // Should show 6 alert items, not the 7th or 8th
    expect(screen.getByText('Alert 1')).toBeTruthy()
    expect(screen.getByText('Alert 6')).toBeTruthy()
    expect(screen.queryByText('Alert 7')).toBeNull()
    // Overflow link shows the remaining count
    expect(screen.getByText('+2 more')).toBeTruthy()
  })

  it('shows "View all" header link when alerts are present', () => {
    render(<NeedsAttention alerts={mockAlerts} />)
    expect(screen.getByText('View all')).toBeTruthy()
  })

  it('does not show "View all" header link when no alerts', () => {
    render(<NeedsAttention alerts={[]} />)
    expect(screen.queryByText('View all')).toBeNull()
  })

  it('does not show overflow link when 6 or fewer items', () => {
    render(<NeedsAttention alerts={mockAlerts} />)
    expect(screen.queryByText(/\+\d+ more/)).toBeNull()
  })

  it('does not show count badge when no alerts', () => {
    render(<NeedsAttention alerts={[]} />)
    expect(screen.queryByText('0 items')).toBeNull()
  })

  // Phase 6: urgent count badge (red pill)
  it('shows red urgent badge when high-priority alerts exist', () => {
    // mockAlerts[0] is priority 'high' — one urgent alert
    render(<NeedsAttention alerts={mockAlerts} />)
    const badge = screen.getByText('1')
    expect(badge.className).toContain('bg-red-500')
    expect(badge.className).toContain('text-white')
  })

  it('does not show urgent badge when no high-priority alerts', () => {
    const noHighAlerts: DashboardAlert[] = [
      { ...mockAlerts[1] }, // medium
      { ...mockAlerts[2] }, // low
    ]
    render(<NeedsAttention alerts={noHighAlerts} />)
    // The red pill must not appear — only the slate count badge should
    const redBadges = document.querySelectorAll('.bg-red-500')
    expect(redBadges.length).toBe(0)
  })

  it('urgent badge count reflects only high-priority alerts', () => {
    const multiHighAlerts: DashboardAlert[] = [
      { ...mockAlerts[0], id: 'h1' },                           // high
      { ...mockAlerts[0], id: 'h2', title: 'Second urgent' },   // high
      { ...mockAlerts[1] },                                       // medium — must not count
    ]
    render(<NeedsAttention alerts={multiHighAlerts} />)
    const badge = screen.getByText('2')
    expect(badge.className).toContain('bg-red-500')
  })
})
