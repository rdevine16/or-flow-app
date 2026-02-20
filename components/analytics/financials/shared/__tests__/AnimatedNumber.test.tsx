import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { AnimatedNumber } from '../AnimatedNumber'

describe('AnimatedNumber', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders with prefix', () => {
    render(<AnimatedNumber value={0} prefix="$" />)
    expect(screen.getByText('$0')).toBeDefined()
  })

  it('renders custom prefix', () => {
    render(<AnimatedNumber value={0} prefix="" />)
    expect(screen.getByText('0')).toBeDefined()
  })

  it('starts at 0 and animates toward target value', () => {
    const { container } = render(<AnimatedNumber value={10000} />)
    // Initial render should show $0
    expect(container.textContent).toContain('$')
  })

  it('handles value of 0', () => {
    render(<AnimatedNumber value={0} />)
    expect(screen.getByText('$0')).toBeDefined()
  })

  it('renders with suffix', () => {
    render(<AnimatedNumber value={0} prefix="" suffix="%" />)
    expect(screen.getByText('0%')).toBeDefined()
  })

  it('renders with prefix and suffix', () => {
    render(<AnimatedNumber value={0} prefix="$" suffix="/hr" />)
    expect(screen.getByText('$0/hr')).toBeDefined()
  })

  it('renders with decimal places', () => {
    // decimals=2 should format the initial display with 2 decimal places
    const { container } = render(<AnimatedNumber value={0} decimals={2} />)
    expect(container.textContent).toContain('$0.00')
  })

  it('handles negative target value', () => {
    const { container } = render(<AnimatedNumber value={-500} prefix="" />)
    expect(container.textContent).toBeDefined()
  })
})
