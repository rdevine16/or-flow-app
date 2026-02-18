// components/ui/__tests__/ScoreRing.test.tsx
// Unit tests for the extracted ScoreRing SVG component.

import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ScoreRing } from '../ScoreRing'

describe('ScoreRing', () => {
  it('renders an SVG element', () => {
    const { container } = render(<ScoreRing score={76} />)
    const svg = container.querySelector('svg')
    expect(svg).toBeTruthy()
  })

  it('uses default size of 100 when no size prop provided', () => {
    const { container } = render(<ScoreRing score={50} />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('width')).toBe('100')
    expect(svg?.getAttribute('height')).toBe('100')
  })

  it('respects a custom size prop', () => {
    const { container } = render(<ScoreRing score={50} size={52} />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('width')).toBe('52')
    expect(svg?.getAttribute('height')).toBe('52')
  })

  it('renders the score as text inside the SVG', () => {
    const { container } = render(<ScoreRing score={83} />)
    const text = container.querySelector('text')
    expect(text?.textContent).toBe('83')
  })

  it('renders two circles — track and filled arc', () => {
    const { container } = render(<ScoreRing score={60} />)
    const circles = container.querySelectorAll('circle')
    expect(circles.length).toBe(2)
  })

  it('renders score 0 without crashing', () => {
    const { container } = render(<ScoreRing score={0} />)
    const text = container.querySelector('text')
    expect(text?.textContent).toBe('0')
  })

  it('renders score 100 without crashing', () => {
    const { container } = render(<ScoreRing score={100} />)
    const text = container.querySelector('text')
    expect(text?.textContent).toBe('100')
  })

  // Integration: verify that different scores produce different strokeDasharray values
  // This confirms the arc fill calculation is wired to the score prop.
  it('produces a larger strokeDasharray filled segment for a higher score', () => {
    const { container: low } = render(<ScoreRing score={10} />)
    const { container: high } = render(<ScoreRing score={90} />)

    const getFilledArc = (c: HTMLElement) => {
      const circles = c.querySelectorAll('circle')
      // The second circle is the filled arc
      return circles[1]?.getAttribute('stroke-dasharray') ?? ''
    }

    const lowFilled = parseFloat(getFilledArc(low).split(' ')[0])
    const highFilled = parseFloat(getFilledArc(high).split(' ')[0])
    expect(highFilled).toBeGreaterThan(lowFilled)
  })
})
