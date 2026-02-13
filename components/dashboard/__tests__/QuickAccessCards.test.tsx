import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QuickAccessCards } from '../QuickAccessCards'

describe('QuickAccessCards', () => {
  it('renders the section heading', () => {
    render(<QuickAccessCards />)
    expect(screen.getByText('Quick Access')).toBeTruthy()
  })

  it('renders all 5 navigation cards', () => {
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
})
