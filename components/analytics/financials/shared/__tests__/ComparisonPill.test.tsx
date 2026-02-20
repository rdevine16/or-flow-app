import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ComparisonPill } from '../ComparisonPill'

describe('ComparisonPill', () => {
  it('renders positive value with green styling', () => {
    const { container } = render(<ComparisonPill value={5} unit="min" />)
    expect(screen.getByText('+5 min')).toBeDefined()
    expect(container.firstElementChild?.className).toContain('bg-green-50')
  })

  it('renders negative value with red styling', () => {
    const { container } = render(<ComparisonPill value={-3} unit="min" />)
    expect(screen.getByText('-3 min')).toBeDefined()
    expect(container.firstElementChild?.className).toContain('bg-red-50')
  })

  it('inverts the good/bad logic when invert=true', () => {
    const { container } = render(<ComparisonPill value={-5} unit="min" invert />)
    // Negative is now good (e.g., faster duration)
    expect(container.firstElementChild?.className).toContain('bg-green-50')
  })

  it('renders currency format', () => {
    render(<ComparisonPill value={1500} format="currency" />)
    expect(screen.getByText('+$1,500')).toBeDefined()
  })

  it('renders neutral for near-zero values', () => {
    const { container } = render(<ComparisonPill value={0.3} unit="min" />)
    expect(container.firstElementChild?.className).toContain('text-slate-400')
  })
})
