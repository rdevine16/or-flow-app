// components/settings/surgeon-milestones/__tests__/SurgeonMilestoneRow.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SurgeonMilestoneRow } from '../SurgeonMilestoneRow'

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

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => null } },
}))

const baseProps = {
  id: 'ms-1',
  displayName: 'Incision',
  isEnabled: true,
  procedureDefault: true,
  isBoundary: false,
  isPaired: false,
  isOverride: false,
  isSaving: false,
  onToggle: vi.fn(),
}

describe('SurgeonMilestoneRow', () => {
  it('renders milestone name', () => {
    render(<SurgeonMilestoneRow {...baseProps} />)
    expect(screen.getByText('Incision')).toBeDefined()
  })

  it('renders enabled checkbox when not boundary', () => {
    render(<SurgeonMilestoneRow {...baseProps} />)
    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).toBeDefined()
    expect((checkbox as HTMLInputElement).checked).toBe(true)
    expect((checkbox as HTMLInputElement).disabled).toBe(false)
  })

  it('renders disabled checkbox for boundary milestones', () => {
    render(<SurgeonMilestoneRow {...baseProps} isBoundary />)
    const checkbox = screen.getByRole('checkbox')
    expect((checkbox as HTMLInputElement).checked).toBe(true)
    expect((checkbox as HTMLInputElement).disabled).toBe(true)
  })

  it('calls onToggle when checkbox is clicked', () => {
    const onToggle = vi.fn()
    render(<SurgeonMilestoneRow {...baseProps} onToggle={onToggle} />)
    fireEvent.click(screen.getByRole('checkbox'))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('does not call onToggle for boundary milestones', () => {
    const onToggle = vi.fn()
    render(<SurgeonMilestoneRow {...baseProps} isBoundary onToggle={onToggle} />)
    fireEvent.click(screen.getByRole('checkbox'))
    // Disabled checkbox should not fire change
    expect(onToggle).not.toHaveBeenCalled()
  })

  it('shows override badge when isOverride is true', () => {
    render(<SurgeonMilestoneRow {...baseProps} isOverride />)
    expect(screen.getByText('Override')).toBeDefined()
  })

  it('does not show override badge when isOverride is false', () => {
    render(<SurgeonMilestoneRow {...baseProps} />)
    expect(screen.queryByText('Override')).toBeNull()
  })

  it('shows amber background when override', () => {
    const { container } = render(<SurgeonMilestoneRow {...baseProps} isOverride />)
    const row = container.firstChild as HTMLElement
    expect(row.className).toContain('bg-amber-50')
  })

  it('shows "Default: on" when procedure default is enabled', () => {
    render(<SurgeonMilestoneRow {...baseProps} procedureDefault />)
    expect(screen.getByText('Default: on')).toBeDefined()
  })

  it('shows "Default: off" when procedure default is disabled', () => {
    render(<SurgeonMilestoneRow {...baseProps} procedureDefault={false} />)
    expect(screen.getByText('Default: off')).toBeDefined()
  })

  it('does not show default indicator for boundary milestones', () => {
    render(<SurgeonMilestoneRow {...baseProps} isBoundary />)
    expect(screen.queryByText(/Default:/)).toBeNull()
  })

  it('renders saving spinner when isSaving is true', () => {
    const { container } = render(<SurgeonMilestoneRow {...baseProps} isSaving />)
    const spinner = container.querySelector('.animate-spin')
    expect(spinner).toBeDefined()
  })

  it('renders drag handle for enabled non-boundary milestones', () => {
    render(<SurgeonMilestoneRow {...baseProps} isEnabled />)
    expect(screen.getByLabelText('Drag to reorder')).toBeDefined()
  })

  it('hides drag handle for boundary milestones', () => {
    render(<SurgeonMilestoneRow {...baseProps} isBoundary />)
    expect(screen.queryByLabelText('Drag to reorder')).toBeNull()
  })

  it('hides drag handle for disabled milestones', () => {
    render(<SurgeonMilestoneRow {...baseProps} isEnabled={false} />)
    expect(screen.queryByLabelText('Drag to reorder')).toBeNull()
  })
})
