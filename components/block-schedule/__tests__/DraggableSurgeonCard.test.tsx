import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DraggableSurgeonCard } from '../DraggableSurgeonCard'

const mockSurgeon = {
  id: 'surgeon-1',
  first_name: 'John',
  last_name: 'Smith',
}

describe('DraggableSurgeonCard', () => {
  it('renders surgeon name', () => {
    render(<DraggableSurgeonCard surgeon={mockSurgeon} hasBlockTime={false} />)
    expect(screen.getByText('Dr. Smith')).toBeDefined()
  })

  it('renders surgeon initials', () => {
    render(<DraggableSurgeonCard surgeon={mockSurgeon} hasBlockTime={false} />)
    expect(screen.getByText('JS')).toBeDefined()
  })

  it('shows block badge when hasBlockTime is true', () => {
    render(<DraggableSurgeonCard surgeon={mockSurgeon} hasBlockTime={true} />)
    expect(screen.getByText('Block')).toBeDefined()
  })

  it('hides block badge when hasBlockTime is false', () => {
    render(<DraggableSurgeonCard surgeon={mockSurgeon} hasBlockTime={false} />)
    expect(screen.queryByText('Block')).toBeNull()
  })

  it('sets data-surgeon-id attribute', () => {
    const { container } = render(
      <DraggableSurgeonCard surgeon={mockSurgeon} hasBlockTime={false} />
    )
    const card = container.querySelector('[data-surgeon-id="surgeon-1"]')
    expect(card).not.toBeNull()
  })

  it('has grab cursor styling', () => {
    const { container } = render(
      <DraggableSurgeonCard surgeon={mockSurgeon} hasBlockTime={false} />
    )
    const card = container.firstElementChild
    expect(card?.className).toContain('cursor-grab')
  })
})
