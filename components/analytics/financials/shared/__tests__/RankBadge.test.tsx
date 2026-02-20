import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RankBadge } from '../RankBadge'

describe('RankBadge', () => {
  it('renders rank number', () => {
    render(<RankBadge rank={1} />)
    expect(screen.getByText('1')).toBeDefined()
  })

  it('uses gold styling for rank 1', () => {
    const { container } = render(<RankBadge rank={1} />)
    expect(container.firstElementChild?.className).toContain('bg-amber-400')
  })

  it('uses silver styling for rank 2', () => {
    const { container } = render(<RankBadge rank={2} />)
    expect(container.firstElementChild?.className).toContain('bg-slate-400')
  })

  it('uses bronze styling for rank 3', () => {
    const { container } = render(<RankBadge rank={3} />)
    expect(container.firstElementChild?.className).toContain('bg-amber-700')
  })

  it('uses neutral styling for rank > 3', () => {
    const { container } = render(<RankBadge rank={5} />)
    expect(container.firstElementChild?.className).toContain('bg-slate-100')
  })
})
