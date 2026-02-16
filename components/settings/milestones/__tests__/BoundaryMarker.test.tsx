// components/settings/milestones/__tests__/BoundaryMarker.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BoundaryMarker } from '../BoundaryMarker'

describe('BoundaryMarker', () => {
  it('renders the milestone name', () => {
    render(
      <BoundaryMarker
        name="Patient In Room"
        topColor="#3B82F6"
        bottomColor="#3B82F6"
        solid
      />
    )

    expect(screen.getByText('Patient In Room')).toBeInTheDocument()
  })

  it('renders a lock icon', () => {
    const { container } = render(
      <BoundaryMarker
        name="Incision"
        topColor="#3B82F6"
        bottomColor="#22C55E"
      />
    )

    // Lock icon is from lucide-react
    const lockSvg = container.querySelector('svg.lucide-lock')
    expect(lockSvg).toBeInTheDocument()
  })

  it('uses solid color for dot when solid=true', () => {
    const { container } = render(
      <BoundaryMarker
        name="Patient In Room"
        topColor="#3B82F6"
        bottomColor="#3B82F6"
        solid
      />
    )

    // The dot is the first child div with rounded-full
    const dot = container.querySelector('.rounded-full') as HTMLElement
    expect(dot).toBeInTheDocument()
    expect(dot.style.background).toBe('rgb(59, 130, 246)')
  })

  it('uses gradient for dot when solid=false', () => {
    const { container } = render(
      <BoundaryMarker
        name="Incision"
        topColor="#3B82F6"
        bottomColor="#22C55E"
        solid={false}
      />
    )

    const dot = container.querySelector('.rounded-full') as HTMLElement
    expect(dot).toBeInTheDocument()
    expect(dot.style.background).toContain('linear-gradient')
    // JSDOM converts hex to rgb
    expect(dot.style.background).toContain('rgb(59, 130, 246)')
    expect(dot.style.background).toContain('rgb(34, 197, 94)')
  })

  it('renders vertical color line', () => {
    const { container } = render(
      <BoundaryMarker
        name="Closing"
        topColor="#22C55E"
        bottomColor="#F59E0B"
      />
    )

    const line = container.querySelector('.w-\\[2\\.5px\\]') as HTMLElement
    expect(line).toBeInTheDocument()
    expect(line.style.background).toContain('linear-gradient')
  })
})
