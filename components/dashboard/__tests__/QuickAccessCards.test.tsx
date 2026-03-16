import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QuickAccessCards } from '../QuickAccessCards'

// ============================================
// Mocks
// ============================================

let mockCan: (key: string) => boolean = () => true
let mockIsTierAtLeast: (tier: string) => boolean = () => true

vi.mock('@/lib/UserContext', () => ({
  useUser: () => ({
    can: mockCan,
    isTierAtLeast: mockIsTierAtLeast,
  }),
}))

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

// ============================================
// Tests
// ============================================

describe('QuickAccessCards', () => {
  beforeEach(() => {
    mockCan = () => true
    mockIsTierAtLeast = () => true
  })

  it('renders the section heading', () => {
    render(<QuickAccessCards />)
    expect(screen.getByText('Quick Access')).toBeTruthy()
  })

  it('renders all 5 navigation cards when user has all permissions', () => {
    render(<QuickAccessCards />)
    expect(screen.getByText('Surgeon Scorecards')).toBeTruthy()
    expect(screen.getByText('Block Utilization')).toBeTruthy()
    expect(screen.getByText('Financial Summary')).toBeTruthy()
    expect(screen.getByText('KPI Analytics')).toBeTruthy()
    expect(screen.getByText('Case Analytics')).toBeTruthy()
  })

  it('renders descriptions for each card', () => {
    render(<QuickAccessCards />)
    expect(screen.getByText('Individual ORbit Score breakdowns')).toBeTruthy()
    expect(screen.getByText('Block schedule usage and efficiency')).toBeTruthy()
    expect(screen.getByText('Revenue and cost analysis')).toBeTruthy()
    expect(screen.getByText('Detailed performance metrics')).toBeTruthy()
    expect(screen.getByText('Case history and trends')).toBeTruthy()
  })

  it('renders correct links', () => {
    render(<QuickAccessCards />)
    const links = screen.getAllByRole('link')

    expect(links.length).toBe(5)

    const hrefs = links.map((link) => link.getAttribute('href'))
    expect(hrefs).toContain('/analytics/orbit-score')
    expect(hrefs).toContain('/analytics/block-utilization')
    expect(hrefs).toContain('/analytics/financials')
    expect(hrefs).toContain('/analytics/kpi')
    expect(hrefs).toContain('/cases')
  })

  // ============================================
  // Permission-based gating (Phase 7)
  // ============================================

  describe('Financial permission gating', () => {
    it('hides Financial Summary card when can(financials.view) returns false', () => {
      mockCan = (key) => key !== 'financials.view'

      render(<QuickAccessCards />)
      expect(screen.queryByText('Financial Summary')).toBeNull()
      expect(screen.queryByText('Revenue and cost analysis')).toBeNull()
      // Other cards still render
      expect(screen.getByText('Surgeon Scorecards')).toBeTruthy()
      expect(screen.getByText('KPI Analytics')).toBeTruthy()
      expect(screen.getByText('Case Analytics')).toBeTruthy()
    })

    it('renders only 4 links when financials.view is denied', () => {
      mockCan = (key) => key !== 'financials.view'

      render(<QuickAccessCards />)
      const links = screen.getAllByRole('link')
      expect(links.length).toBe(4)

      const hrefs = links.map((link) => link.getAttribute('href'))
      expect(hrefs).not.toContain('/analytics/financials')
    })

    it('shows Financial Summary card when can(financials.view) returns true', () => {
      mockCan = () => true

      render(<QuickAccessCards />)
      expect(screen.getByText('Financial Summary')).toBeTruthy()
    })
  })
})
