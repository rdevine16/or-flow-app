import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MicroBar } from '../MicroBar'

describe('MicroBar', () => {
  it('renders positive value with dollar sign', () => {
    render(<MicroBar value={5000} max={10000} color="#10b981" />)
    expect(screen.getByText('$5,000')).toBeDefined()
  })

  it('renders negative value in parentheses', () => {
    render(<MicroBar value={-500} max={10000} color="#ef4444" />)
    expect(screen.getByText('($500)')).toBeDefined()
  })

  it('renders bar with correct proportional width', () => {
    const { container } = render(<MicroBar value={5000} max={10000} color="#10b981" />)
    const bar = container.querySelector('.rounded-sm')
    expect(bar?.getAttribute('style')).toContain('width: 50%')
  })

  it('caps bar width at 100% for value exceeding max', () => {
    const { container } = render(<MicroBar value={15000} max={10000} color="#10b981" />)
    const bar = container.querySelector('.rounded-sm')
    expect(bar?.getAttribute('style')).toContain('width: 100%')
  })

  it('handles zero value', () => {
    render(<MicroBar value={0} max={10000} color="#10b981" />)
    expect(screen.getByText('$0')).toBeDefined()
  })
})
