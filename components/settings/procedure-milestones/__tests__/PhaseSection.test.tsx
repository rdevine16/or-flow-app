// components/settings/procedure-milestones/__tests__/PhaseSection.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PhaseSection } from '../PhaseSection'

describe('PhaseSection', () => {
  const defaultProps = {
    phaseName: 'surgical',
    phaseDisplayName: 'Surgical',
    colorKey: 'green',
    milestoneCount: 5,
    enabledCount: 3,
    isExpanded: true,
    onToggle: vi.fn(),
    children: <div data-testid="children">Child content</div>,
  }

  it('renders phase display name', () => {
    render(<PhaseSection {...defaultProps} />)
    expect(screen.getByText('Surgical')).toBeTruthy()
  })

  it('renders milestone count', () => {
    render(<PhaseSection {...defaultProps} />)
    expect(screen.getByText('3/5')).toBeTruthy()
  })

  it('renders children when expanded', () => {
    render(<PhaseSection {...defaultProps} />)
    expect(screen.getByTestId('children')).toBeTruthy()
  })

  it('hides children when collapsed', () => {
    render(<PhaseSection {...defaultProps} isExpanded={false} />)
    expect(screen.queryByTestId('children')).toBeFalsy()
  })

  it('calls onToggle when header is clicked', () => {
    const onToggle = vi.fn()
    render(<PhaseSection {...defaultProps} onToggle={onToggle} />)
    fireEvent.click(screen.getByText('Surgical'))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('applies correct color styling', () => {
    const { container } = render(<PhaseSection {...defaultProps} />)
    // Green phase should have green background classes
    const header = container.querySelector('button')
    expect(header?.className).toContain('bg-green-50')
  })

  it('handles null colorKey gracefully (falls back to slate)', () => {
    render(<PhaseSection {...defaultProps} colorKey={null} />)
    // Should render without errors
    expect(screen.getByText('Surgical')).toBeTruthy()
  })
})
