import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PhasePill } from '../PhasePill'

describe('PhasePill', () => {
  it('renders label and minutes', () => {
    render(<PhasePill label="Pre-Op" minutes={12} color="blue" />)
    expect(screen.getByText('Pre-Op 12m')).toBeDefined()
  })

  it('applies correct color styles for each phase_group', () => {
    const { container: blueContainer } = render(<PhasePill label="Pre-Op" minutes={8} color="blue" />)
    expect(blueContainer.firstElementChild?.className).toContain('bg-blue-50')

    const { container: greenContainer } = render(<PhasePill label="Surgical" minutes={62} color="green" />)
    expect(greenContainer.firstElementChild?.className).toContain('bg-green-50')

    const { container: amberContainer } = render(<PhasePill label="Closing" minutes={9} color="amber" />)
    expect(amberContainer.firstElementChild?.className).toContain('bg-amber-50')

    const { container: violetContainer } = render(<PhasePill label="Post-Op" minutes={5} color="violet" />)
    expect(violetContainer.firstElementChild?.className).toContain('bg-violet-50')
  })

  it('returns null when minutes is null', () => {
    const { container } = render(<PhasePill label="Pre-Op" minutes={null} color="blue" />)
    expect(container.firstChild).toBeNull()
  })
})
