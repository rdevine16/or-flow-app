import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MarginBadge } from '../MarginBadge'

describe('MarginBadge', () => {
  it('shows green for margin >= 30', () => {
    const { container } = render(<MarginBadge value={35} />)
    expect(screen.getByText('35.0%')).toBeDefined()
    expect(container.firstElementChild?.className).toContain('bg-green-50')
  })

  it('shows amber for margin >= 15 and < 30', () => {
    const { container } = render(<MarginBadge value={20} />)
    expect(screen.getByText('20.0%')).toBeDefined()
    expect(container.firstElementChild?.className).toContain('bg-amber-50')
  })

  it('shows red for margin >= 0 and < 15', () => {
    const { container } = render(<MarginBadge value={10} />)
    expect(screen.getByText('10.0%')).toBeDefined()
    expect(container.firstElementChild?.className).toContain('bg-red-50')
  })

  it('shows dark red for negative margin', () => {
    const { container } = render(<MarginBadge value={-5} />)
    expect(screen.getByText('-5.0%')).toBeDefined()
    expect(container.firstElementChild?.className).toContain('bg-red-100')
  })
})
