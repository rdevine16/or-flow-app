import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DeltaBadge } from '../DeltaBadge'

describe('DeltaBadge — format: time', () => {
  it('shows positive time delta with + and up arrow', () => {
    render(<DeltaBadge delta={9} format="time" />)
    expect(screen.getByText('+9m')).toBeDefined()
    expect(screen.getByText('\u25B2')).toBeDefined() // up arrow
  })

  it('shows negative time delta with - and down arrow', () => {
    render(<DeltaBadge delta={-3} format="time" />)
    expect(screen.getByText('-3m')).toBeDefined()
    expect(screen.getByText('\u25BC')).toBeDefined() // down arrow
  })

  it('shows "on pace" for zero delta', () => {
    render(<DeltaBadge delta={0} format="time" />)
    expect(screen.getByText('on pace')).toBeDefined()
  })

  it('formats hours and minutes for large deltas', () => {
    render(<DeltaBadge delta={90} format="time" />)
    expect(screen.getByText('+1h 30m')).toBeDefined()
  })
})

describe('DeltaBadge — format: currency', () => {
  it('shows positive currency delta', () => {
    render(<DeltaBadge delta={380} format="currency" />)
    expect(screen.getByText('+$380')).toBeDefined()
  })

  it('shows negative currency delta', () => {
    render(<DeltaBadge delta={-150} format="currency" />)
    expect(screen.getByText('-$150')).toBeDefined()
  })
})

describe('DeltaBadge — format: percentage', () => {
  it('shows positive percentage delta', () => {
    render(<DeltaBadge delta={12} format="percentage" />)
    expect(screen.getByText('+12%')).toBeDefined()
  })
})

describe('DeltaBadge — severity', () => {
  it('uses explicit severity when provided', () => {
    const { container } = render(<DeltaBadge delta={5} format="time" severity="critical" />)
    const badge = container.firstElementChild
    expect(badge?.className).toContain('bg-red-100')
  })

  it('uses faster severity for favorable delta', () => {
    const { container } = render(<DeltaBadge delta={100} format="currency" />)
    const badge = container.firstElementChild
    expect(badge?.className).toContain('bg-green-50')
  })

  it('uses slower severity for unfavorable delta', () => {
    const { container } = render(<DeltaBadge delta={-100} format="currency" />)
    const badge = container.firstElementChild
    expect(badge?.className).toContain('bg-red-50')
  })

  it('inverts logic when invert=true (decrease is good)', () => {
    const { container } = render(<DeltaBadge delta={-5} format="time" invert />)
    const badge = container.firstElementChild
    // Negative with invert = faster (good)
    expect(badge?.className).toContain('bg-green-50')
  })

  it('inverts logic: increase is bad when invert=true', () => {
    const { container } = render(<DeltaBadge delta={5} format="time" invert />)
    const badge = container.firstElementChild
    // Positive with invert = slower (bad)
    expect(badge?.className).toContain('bg-red-50')
  })
})

describe('DeltaBadge — accessibility', () => {
  it('provides screen reader text for positive delta', () => {
    render(<DeltaBadge delta={9} format="time" severity="slower" />)
    const badge = screen.getByLabelText('9m slower')
    expect(badge).toBeDefined()
  })

  it('provides screen reader text for negative favorable delta', () => {
    render(<DeltaBadge delta={-3} format="time" severity="faster" />)
    const badge = screen.getByLabelText('3m faster')
    expect(badge).toBeDefined()
  })

  it('provides screen reader text for zero delta', () => {
    render(<DeltaBadge delta={0} format="time" />)
    const badge = screen.getByLabelText('on pace')
    expect(badge).toBeDefined()
  })

  it('provides screen reader text for currency', () => {
    render(<DeltaBadge delta={380} format="currency" />)
    // Positive delta without invert → auto-severity 'faster' → "faster" direction word
    const badge = screen.getByLabelText('$380 faster')
    expect(badge).toBeDefined()
  })
})
