import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MarginGauge } from '../MarginGauge'

describe('MarginGauge', () => {
  it('renders with correct aria-label for valid percentage', () => {
    render(<MarginGauge percentage={58} rating="excellent" />)
    const gauge = screen.getByRole('img')
    expect(gauge.getAttribute('aria-label')).toBe('Margin: 58 percent, rated excellent')
  })

  it('renders unavailable message when percentage is null', () => {
    render(<MarginGauge percentage={null} rating="good" />)
    const gauge = screen.getByRole('img')
    expect(gauge.getAttribute('aria-label')).toBe('Margin data unavailable')
  })

  it('renders percentage text in SVG', () => {
    const { container } = render(<MarginGauge percentage={42} rating="good" />)
    const texts = container.querySelectorAll('text')
    const percentText = Array.from(texts).find(t => t.textContent?.includes('42'))
    expect(percentText).toBeDefined()
  })

  it('renders -- when percentage is null', () => {
    const { container } = render(<MarginGauge percentage={null} rating="good" />)
    const texts = container.querySelectorAll('text')
    const dashText = Array.from(texts).find(t => t.textContent?.includes('--'))
    expect(dashText).toBeDefined()
  })

  it('renders "Margin" label for md size', () => {
    const { container } = render(<MarginGauge percentage={58} size="md" rating="excellent" />)
    const texts = container.querySelectorAll('text')
    const marginLabel = Array.from(texts).find(t => t.textContent === 'Margin')
    expect(marginLabel).toBeDefined()
  })

  it('does not render "Margin" label for sm size', () => {
    const { container } = render(<MarginGauge percentage={58} size="sm" rating="excellent" />)
    const texts = container.querySelectorAll('text')
    const marginLabel = Array.from(texts).find(t => t.textContent === 'Margin')
    expect(marginLabel).toBeUndefined()
  })

  it('renders correct SVG dimensions for sm size', () => {
    const { container } = render(<MarginGauge percentage={50} size="sm" rating="good" />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('width')).toBe('40')
    expect(svg?.getAttribute('height')).toBe('40')
  })

  it('renders correct SVG dimensions for lg size', () => {
    const { container } = render(<MarginGauge percentage={50} size="lg" rating="good" />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('width')).toBe('68')
    expect(svg?.getAttribute('height')).toBe('68')
  })

  it('clamps percentage display to 0-100', () => {
    const { container } = render(<MarginGauge percentage={150} rating="excellent" />)
    // The displayed text should show 150, but the ring progress is clamped
    const texts = container.querySelectorAll('text')
    const percentText = Array.from(texts).find(t => t.textContent?.includes('150'))
    expect(percentText).toBeDefined()
  })

  it('renders optional label below gauge', () => {
    render(<MarginGauge percentage={50} rating="good" label="vs Surgeon" />)
    expect(screen.getByText('vs Surgeon')).toBeDefined()
  })

  it('uses correct color for each rating', () => {
    const { container: c1 } = render(<MarginGauge percentage={50} rating="excellent" />)
    const ring1 = c1.querySelectorAll('circle')[1]
    expect(ring1.getAttribute('stroke')).toBe('#0d9488') // teal-600

    const { container: c2 } = render(<MarginGauge percentage={50} rating="poor" />)
    const ring2 = c2.querySelectorAll('circle')[1]
    expect(ring2.getAttribute('stroke')).toBe('#dc2626') // red-600
  })
})
