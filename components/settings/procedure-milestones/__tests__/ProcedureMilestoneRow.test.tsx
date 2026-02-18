// components/settings/procedure-milestones/__tests__/ProcedureMilestoneRow.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ProcedureMilestoneRow } from '../ProcedureMilestoneRow'

// Mock @dnd-kit/sortable
vi.mock('@dnd-kit/sortable', () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
}))

// Mock @dnd-kit/utilities
vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => null } },
}))

describe('ProcedureMilestoneRow', () => {
  const defaultProps = {
    id: 'ms-1',
    milestoneId: 'ms-1',
    displayName: 'Patient In Room',
    isEnabled: true,
    isBoundary: false,
    isPaired: false,
    isSaving: false,
    onToggle: vi.fn(),
  }

  it('renders milestone name', () => {
    render(<ProcedureMilestoneRow {...defaultProps} />)
    expect(screen.getByText('Patient In Room')).toBeTruthy()
  })

  it('renders enabled checkbox when enabled and not boundary', () => {
    render(<ProcedureMilestoneRow {...defaultProps} />)
    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).toBeTruthy()
    expect((checkbox as HTMLInputElement).checked).toBe(true)
    expect((checkbox as HTMLInputElement).disabled).toBe(false)
  })

  it('renders locked checkbox for boundary milestones', () => {
    render(<ProcedureMilestoneRow {...defaultProps} isBoundary />)
    const checkbox = screen.getByRole('checkbox')
    expect((checkbox as HTMLInputElement).checked).toBe(true)
    expect((checkbox as HTMLInputElement).disabled).toBe(true)
  })

  it('renders lock icon for boundary milestones', () => {
    const { container } = render(<ProcedureMilestoneRow {...defaultProps} isBoundary />)
    // Lock icon should be present, drag handle should not
    expect(container.querySelector('[aria-label="Drag to reorder"]')).toBeFalsy()
    expect(container.querySelector('.lucide-lock')).toBeTruthy()
  })

  it('calls onToggle when non-boundary checkbox is clicked', () => {
    const onToggle = vi.fn()
    render(<ProcedureMilestoneRow {...defaultProps} onToggle={onToggle} />)
    fireEvent.click(screen.getByRole('checkbox'))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('does not call onToggle when boundary checkbox is clicked', () => {
    const onToggle = vi.fn()
    render(<ProcedureMilestoneRow {...defaultProps} isBoundary onToggle={onToggle} />)
    const checkbox = screen.getByRole('checkbox')
    fireEvent.click(checkbox)
    // Checkbox is disabled, so onToggle should not fire
    expect(onToggle).not.toHaveBeenCalled()
  })

  it('shows drag handle only for enabled non-boundary milestones', () => {
    const { container } = render(<ProcedureMilestoneRow {...defaultProps} />)
    expect(container.querySelector('[aria-label="Drag to reorder"]')).toBeTruthy()
  })

  it('hides drag handle for boundary milestones', () => {
    const { container } = render(<ProcedureMilestoneRow {...defaultProps} isBoundary />)
    expect(container.querySelector('[aria-label="Drag to reorder"]')).toBeFalsy()
  })

  it('hides drag handle for disabled milestones', () => {
    const { container } = render(<ProcedureMilestoneRow {...defaultProps} isEnabled={false} />)
    expect(container.querySelector('[aria-label="Drag to reorder"]')).toBeFalsy()
  })

  it('renders unchecked checkbox for disabled milestones', () => {
    render(<ProcedureMilestoneRow {...defaultProps} isEnabled={false} />)
    const checkbox = screen.getByRole('checkbox')
    expect((checkbox as HTMLInputElement).checked).toBe(false)
  })

  it('disables checkbox while saving', () => {
    render(<ProcedureMilestoneRow {...defaultProps} isSaving />)
    const checkbox = screen.getByRole('checkbox')
    expect((checkbox as HTMLInputElement).disabled).toBe(true)
  })
})
