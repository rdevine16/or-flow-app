import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProfitBadge } from '../ProfitBadge'

describe('ProfitBadge', () => {
  it('renders EXCELLENT label for excellent rating', () => {
    render(<ProfitBadge rating="excellent" />)
    expect(screen.getByText('EXCELLENT')).toBeDefined()
  })

  it('renders GOOD label for good rating', () => {
    render(<ProfitBadge rating="good" />)
    expect(screen.getByText('GOOD')).toBeDefined()
  })

  it('renders FAIR label for fair rating', () => {
    render(<ProfitBadge rating="fair" />)
    expect(screen.getByText('FAIR')).toBeDefined()
  })

  it('renders POOR label for poor rating', () => {
    render(<ProfitBadge rating="poor" />)
    expect(screen.getByText('POOR')).toBeDefined()
  })

  it('uses teal styling for excellent', () => {
    const { container } = render(<ProfitBadge rating="excellent" />)
    const badge = container.firstElementChild
    expect(badge?.className).toContain('bg-teal-50')
    expect(badge?.className).toContain('text-teal-700')
  })

  it('uses red styling for poor', () => {
    const { container } = render(<ProfitBadge rating="poor" />)
    const badge = container.firstElementChild
    expect(badge?.className).toContain('bg-red-50')
    expect(badge?.className).toContain('text-red-700')
  })

  it('has aria-label for accessibility', () => {
    render(<ProfitBadge rating="good" />)
    const badge = screen.getByLabelText('Margin rated good')
    expect(badge).toBeDefined()
  })
})
