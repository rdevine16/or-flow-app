import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ConsistencyBadge } from '../ConsistencyBadge'

describe('ConsistencyBadge', () => {
  it('renders High with green styling', () => {
    const { container } = render(<ConsistencyBadge rating="high" />)
    expect(screen.getByText('High')).toBeDefined()
    expect(container.firstElementChild?.className).toContain('bg-green-50')
  })

  it('renders Moderate with amber styling', () => {
    const { container } = render(<ConsistencyBadge rating="medium" />)
    expect(screen.getByText('Moderate')).toBeDefined()
    expect(container.firstElementChild?.className).toContain('bg-amber-50')
  })

  it('renders Variable with red styling', () => {
    const { container } = render(<ConsistencyBadge rating="low" />)
    expect(screen.getByText('Variable')).toBeDefined()
    expect(container.firstElementChild?.className).toContain('bg-red-50')
  })

  it('renders larger size when size="lg"', () => {
    const { container } = render(<ConsistencyBadge rating="high" size="lg" />)
    expect(container.firstElementChild?.className).toContain('px-3')
    expect(container.firstElementChild?.className).toContain('text-sm')
  })
})
