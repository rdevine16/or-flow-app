import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Sparkline } from '../Sparkline'

describe('Sparkline', () => {
  it('renders SVG with correct dimensions', () => {
    const { container } = render(<Sparkline data={[10, 20, 30]} />)
    const svg = container.querySelector('svg')
    expect(svg).toBeDefined()
    expect(svg?.getAttribute('width')).toBe('56')
    expect(svg?.getAttribute('height')).toBe('20')
  })

  it('renders polyline and endpoint circle', () => {
    const { container } = render(<Sparkline data={[10, 20, 30]} />)
    expect(container.querySelector('polyline')).toBeDefined()
    expect(container.querySelector('circle')).toBeDefined()
  })

  it('returns null for fewer than 2 data points', () => {
    const { container } = render(<Sparkline data={[10]} />)
    expect(container.firstChild).toBeNull()
  })

  it('returns null for empty data', () => {
    const { container } = render(<Sparkline data={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('accepts custom color and dimensions', () => {
    const { container } = render(<Sparkline data={[5, 15]} color="#ef4444" width={80} height={30} />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('width')).toBe('80')
    expect(svg?.getAttribute('height')).toBe('30')
    const polyline = container.querySelector('polyline')
    expect(polyline?.getAttribute('stroke')).toBe('#ef4444')
  })

  it('handles flat data (all same values)', () => {
    const { container } = render(<Sparkline data={[100, 100, 100]} />)
    expect(container.querySelector('polyline')).toBeDefined()
  })
})
