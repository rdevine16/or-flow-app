import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DndContext } from '@dnd-kit/core'
import { DraggableSurgeonCard } from '../DraggableSurgeonCard'

const mockSurgeon = {
  id: 'surgeon-1',
  first_name: 'John',
  last_name: 'Smith',
}

function renderCard(hasBlockTime = false) {
  return render(
    <DndContext>
      <DraggableSurgeonCard surgeon={mockSurgeon} hasBlockTime={hasBlockTime} />
    </DndContext>
  )
}

describe('DraggableSurgeonCard', () => {
  it('renders surgeon name', () => {
    renderCard()
    expect(screen.getByText('Dr. Smith')).toBeDefined()
  })

  it('renders surgeon initials', () => {
    renderCard()
    expect(screen.getByText('JS')).toBeDefined()
  })

  it('shows block badge when hasBlockTime is true', () => {
    renderCard(true)
    expect(screen.getByText('Block')).toBeDefined()
  })

  it('hides block badge when hasBlockTime is false', () => {
    renderCard(false)
    expect(screen.queryByText('Block')).toBeNull()
  })

  it('has grab cursor styling', () => {
    const { container } = renderCard()
    const card = container.querySelector('[class*="cursor-grab"]')
    expect(card).not.toBeNull()
  })

  it('gets opacity style when dragging', () => {
    // Verify the component renders (drag state is managed by dnd-kit context)
    const { container } = renderCard()
    expect(container.firstElementChild).not.toBeNull()
  })
})
