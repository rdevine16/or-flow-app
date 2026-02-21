/**
 * Unit tests for MilestoneTimeline component
 *
 * This test suite verifies that the MilestoneTimeline component renders
 * milestone nodes with correct status indicators (recorded/missing/issue),
 * edit controls, pair badges, and handles loading/empty states.
 *
 * The timeline displays a vertical track of milestones for a single case
 * in the ReviewDrawer, allowing inline editing of milestone timestamps.
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import MilestoneTimeline, { type EditableMilestone } from '../MilestoneTimeline'

// Helper to create a mock milestone
const createMockMilestone = (overrides?: Partial<EditableMilestone>): EditableMilestone => ({
  id: 'fm-1',
  name: 'incision',
  display_name: 'Incision',
  display_order: 1,
  pair_with_id: null,
  recorded_at: '2026-02-20T08:30:00Z',
  original_recorded_at: '2026-02-20T08:30:00Z',
  isEditing: false,
  hasChanged: false,
  canEdit: true,
  ...overrides,
})

describe('MilestoneTimeline', () => {
  const defaultProps = {
    milestones: [createMockMilestone()],
    issueMilestoneIds: new Set<string>(),
    loading: false,
    onToggleEdit: vi.fn(),
    onTimeChange: vi.fn(),
  }

  describe('loading and empty states', () => {
    it('shows loading spinner when loading is true', () => {
      render(<MilestoneTimeline {...defaultProps} loading={true} />)
      const timeline = screen.getByTestId('milestone-timeline')
      const spinner = timeline.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
    })

    it('shows empty state when milestones array is empty', () => {
      render(<MilestoneTimeline {...defaultProps} milestones={[]} />)
      expect(screen.getByText(/No milestones found for this case/i)).toBeInTheDocument()
    })

    it('does not show loading spinner or empty state when milestones exist', () => {
      render(<MilestoneTimeline {...defaultProps} />)
      const timeline = screen.getByTestId('milestone-timeline')
      const spinner = timeline.querySelector('.animate-spin')
      expect(spinner).not.toBeInTheDocument()
      expect(screen.queryByText(/No milestones found/i)).not.toBeInTheDocument()
    })
  })

  describe('milestone node colors and status indicators', () => {
    it('renders green node for recorded milestone', () => {
      render(<MilestoneTimeline {...defaultProps} />)
      const timeline = screen.getByTestId('milestone-timeline')
      const greenNode = timeline.querySelector('.bg-green-500')
      expect(greenNode).toBeInTheDocument()
    })

    it('renders hollow node (border only) for missing milestone', () => {
      const missingMilestone = createMockMilestone({ recorded_at: null })
      render(<MilestoneTimeline {...defaultProps} milestones={[missingMilestone]} />)
      const timeline = screen.getByTestId('milestone-timeline')
      const hollowNode = timeline.querySelector('.border-2.border-slate-300')
      expect(hollowNode).toBeInTheDocument()
    })

    it('renders amber node for milestone with issue', () => {
      const milestonWithIssue = createMockMilestone({ id: 'fm-issue' })
      render(
        <MilestoneTimeline
          {...defaultProps}
          milestones={[milestonWithIssue]}
          issueMilestoneIds={new Set(['fm-issue'])}
        />
      )
      const timeline = screen.getByTestId('milestone-timeline')
      const amberNode = timeline.querySelector('.bg-amber-500')
      expect(amberNode).toBeInTheDocument()
    })

    it('renders blue node for modified milestone', () => {
      const modifiedMilestone = createMockMilestone({ hasChanged: true })
      render(<MilestoneTimeline {...defaultProps} milestones={[modifiedMilestone]} />)
      const timeline = screen.getByTestId('milestone-timeline')
      const blueNode = timeline.querySelector('.bg-blue-500')
      expect(blueNode).toBeInTheDocument()
    })

    it('shows check icon on recorded milestone without issue or changes', () => {
      render(<MilestoneTimeline {...defaultProps} />)
      const timeline = screen.getByTestId('milestone-timeline')
      const checkIcon = timeline.querySelector('svg.lucide-check')
      expect(checkIcon).toBeInTheDocument()
    })

    it('does not show check icon on missing milestone', () => {
      const missingMilestone = createMockMilestone({ recorded_at: null })
      render(<MilestoneTimeline {...defaultProps} milestones={[missingMilestone]} />)
      const timeline = screen.getByTestId('milestone-timeline')
      const checkIcon = timeline.querySelector('svg.lucide-check')
      expect(checkIcon).not.toBeInTheDocument()
    })

    it('does not show check icon on milestone with issue', () => {
      const milestoneWithIssue = createMockMilestone({ id: 'fm-issue' })
      render(
        <MilestoneTimeline
          {...defaultProps}
          milestones={[milestoneWithIssue]}
          issueMilestoneIds={new Set(['fm-issue'])}
        />
      )
      const timeline = screen.getByTestId('milestone-timeline')
      const checkIcon = timeline.querySelector('svg.lucide-check')
      expect(checkIcon).not.toBeInTheDocument()
    })
  })

  describe('milestone display and labels', () => {
    it('displays milestone display_name', () => {
      render(<MilestoneTimeline {...defaultProps} />)
      expect(screen.getByText('Incision')).toBeInTheDocument()
    })

    it('displays formatted time for recorded milestone', () => {
      render(<MilestoneTimeline {...defaultProps} />)
      // formatTimeWithSeconds formats as "8:30:00 AM" (may vary by locale)
      // Just check that it's not showing "Not recorded"
      expect(screen.queryByText('Not recorded')).not.toBeInTheDocument()
      // And that a time-like string is present
      expect(screen.getByText(/\d{1,2}:\d{2}:\d{2}/)).toBeInTheDocument()
    })

    it('displays "Not recorded" for missing milestone', () => {
      const missingMilestone = createMockMilestone({ recorded_at: null })
      render(<MilestoneTimeline {...defaultProps} milestones={[missingMilestone]} />)
      expect(screen.getByText('Not recorded')).toBeInTheDocument()
    })

    it('shows "Modified" badge on changed milestone', () => {
      const modifiedMilestone = createMockMilestone({ hasChanged: true })
      render(<MilestoneTimeline {...defaultProps} milestones={[modifiedMilestone]} />)
      expect(screen.getByText('Modified')).toBeInTheDocument()
    })

    it('shows "Issue" badge on milestone with issue', () => {
      const milestoneWithIssue = createMockMilestone({ id: 'fm-issue' })
      const { container } = render(
        <MilestoneTimeline
          {...defaultProps}
          milestones={[milestoneWithIssue]}
          issueMilestoneIds={new Set(['fm-issue'])}
        />
      )
      // Badge text is uppercase in component (bg-amber-200 text-amber-700)
      const issueBadge = container.querySelector('.bg-amber-200.text-amber-700')
      expect(issueBadge).toBeInTheDocument()
      expect(issueBadge?.textContent).toMatch(/ISSUE/i)
    })
  })

  describe('edit controls', () => {
    it('shows "Edit" button for recorded milestone when canEdit is true', () => {
      render(<MilestoneTimeline {...defaultProps} />)
      expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
    })

    it('shows "Add" button for missing milestone when canEdit is true', () => {
      const missingMilestone = createMockMilestone({ recorded_at: null })
      render(<MilestoneTimeline {...defaultProps} milestones={[missingMilestone]} />)
      expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument()
    })

    it('does not show edit button when canEdit is false', () => {
      const nonEditableMilestone = createMockMilestone({ canEdit: false })
      render(<MilestoneTimeline {...defaultProps} milestones={[nonEditableMilestone]} />)
      expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Add' })).not.toBeInTheDocument()
    })

    it('shows "Done" button when milestone is in editing mode', () => {
      const editingMilestone = createMockMilestone({ isEditing: true })
      render(<MilestoneTimeline {...defaultProps} milestones={[editingMilestone]} />)
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument()
    })

    it('calls onToggleEdit when Edit button is clicked', () => {
      const onToggleEdit = vi.fn()
      render(<MilestoneTimeline {...defaultProps} onToggleEdit={onToggleEdit} />)
      const editButton = screen.getByRole('button', { name: 'Edit' })
      fireEvent.click(editButton)
      expect(onToggleEdit).toHaveBeenCalledWith(0)
    })

    it('calls onToggleEdit when Done button is clicked', () => {
      const onToggleEdit = vi.fn()
      const editingMilestone = createMockMilestone({ isEditing: true })
      render(
        <MilestoneTimeline
          {...defaultProps}
          milestones={[editingMilestone]}
          onToggleEdit={onToggleEdit}
        />
      )
      const doneButton = screen.getByRole('button', { name: 'Done' })
      fireEvent.click(doneButton)
      expect(onToggleEdit).toHaveBeenCalledWith(0)
    })

    it('shows datetime-local input when isEditing is true', () => {
      const editingMilestone = createMockMilestone({ isEditing: true })
      const { container } = render(
        <MilestoneTimeline {...defaultProps} milestones={[editingMilestone]} />
      )
      const input = container.querySelector('input[type="datetime-local"]')
      expect(input).toBeInTheDocument()
      expect(input).toHaveAttribute('value', '2026-02-20T08:30:00')
    })

    it('calls onTimeChange when datetime input value changes', () => {
      const onTimeChange = vi.fn()
      const editingMilestone = createMockMilestone({ isEditing: true })
      const { container } = render(
        <MilestoneTimeline
          {...defaultProps}
          milestones={[editingMilestone]}
          onTimeChange={onTimeChange}
        />
      )
      const input = container.querySelector('input[type="datetime-local"]') as HTMLInputElement
      expect(input).toBeInTheDocument()
      fireEvent.change(input, { target: { value: '2026-02-20T09:15:00' } })
      expect(onTimeChange).toHaveBeenCalledWith(0, expect.any(String))
    })
  })

  describe('paired milestones', () => {
    it('shows "Start" badge for first milestone in pair', () => {
      const startMilestone = createMockMilestone({
        id: 'fm-start',
        name: 'patient_in',
        display_name: 'Patient In',
        display_order: 1,
        pair_with_id: 'fm-end',
      })
      const endMilestone = createMockMilestone({
        id: 'fm-end',
        name: 'incision',
        display_name: 'Incision',
        display_order: 2,
        pair_with_id: 'fm-start',
      })
      render(
        <MilestoneTimeline
          {...defaultProps}
          milestones={[startMilestone, endMilestone]}
        />
      )
      expect(screen.getByText('Start')).toBeInTheDocument()
    })

    it('shows "End" badge for second milestone in pair', () => {
      const startMilestone = createMockMilestone({
        id: 'fm-start',
        name: 'patient_in',
        display_name: 'Patient In',
        display_order: 1,
        pair_with_id: 'fm-end',
      })
      const endMilestone = createMockMilestone({
        id: 'fm-end',
        name: 'incision',
        display_name: 'Incision',
        display_order: 2,
        pair_with_id: 'fm-start',
      })
      render(
        <MilestoneTimeline
          {...defaultProps}
          milestones={[startMilestone, endMilestone]}
        />
      )
      expect(screen.getByText('End')).toBeInTheDocument()
    })

    it('shows down arrow icon for start milestone', () => {
      const startMilestone = createMockMilestone({
        id: 'fm-start',
        display_order: 1,
        pair_with_id: 'fm-end',
      })
      const endMilestone = createMockMilestone({
        id: 'fm-end',
        display_order: 2,
        pair_with_id: 'fm-start',
      })
      render(
        <MilestoneTimeline
          {...defaultProps}
          milestones={[startMilestone, endMilestone]}
        />
      )
      const timeline = screen.getByTestId('milestone-timeline')
      const downArrow = timeline.querySelector('svg.lucide-arrow-down')
      expect(downArrow).toBeInTheDocument()
    })

    it('shows up arrow icon for end milestone', () => {
      const startMilestone = createMockMilestone({
        id: 'fm-start',
        display_order: 1,
        pair_with_id: 'fm-end',
      })
      const endMilestone = createMockMilestone({
        id: 'fm-end',
        display_order: 2,
        pair_with_id: 'fm-start',
      })
      render(
        <MilestoneTimeline
          {...defaultProps}
          milestones={[startMilestone, endMilestone]}
        />
      )
      const timeline = screen.getByTestId('milestone-timeline')
      const upArrow = timeline.querySelector('svg.lucide-arrow-up')
      expect(upArrow).toBeInTheDocument()
    })

    it('does not show pair badges for unpaired milestone', () => {
      render(<MilestoneTimeline {...defaultProps} />)
      expect(screen.queryByText('Start')).not.toBeInTheDocument()
      expect(screen.queryByText('End')).not.toBeInTheDocument()
    })
  })

  describe('legend', () => {
    it('renders legend with three status types', () => {
      render(<MilestoneTimeline {...defaultProps} />)
      expect(screen.getByText('Recorded')).toBeInTheDocument()
      expect(screen.getByText('Missing')).toBeInTheDocument()
      expect(screen.getByText('Issue')).toBeInTheDocument()
    })

    it('legend is visible when milestones exist', () => {
      render(<MilestoneTimeline {...defaultProps} />)
      expect(screen.getByText('Recorded')).toBeVisible()
    })

    it('legend is not visible in loading state', () => {
      render(<MilestoneTimeline {...defaultProps} loading={true} />)
      expect(screen.queryByText('Recorded')).not.toBeInTheDocument()
    })

    it('legend is not visible in empty state', () => {
      render(<MilestoneTimeline {...defaultProps} milestones={[]} />)
      expect(screen.queryByText('Recorded')).not.toBeInTheDocument()
    })
  })

  describe('multiple milestones', () => {
    it('renders multiple milestones in order', () => {
      const milestones = [
        createMockMilestone({ id: 'fm-1', display_name: 'Patient In', display_order: 1 }),
        createMockMilestone({ id: 'fm-2', display_name: 'Incision', display_order: 2 }),
        createMockMilestone({ id: 'fm-3', display_name: 'Closure', display_order: 3 }),
      ]
      render(<MilestoneTimeline {...defaultProps} milestones={milestones} />)
      expect(screen.getByText('Patient In')).toBeInTheDocument()
      expect(screen.getByText('Incision')).toBeInTheDocument()
      expect(screen.getByText('Closure')).toBeInTheDocument()
    })

    it('renders connecting lines between milestones', () => {
      const milestones = [
        createMockMilestone({ id: 'fm-1', display_order: 1 }),
        createMockMilestone({ id: 'fm-2', display_order: 2 }),
      ]
      const { container } = render(<MilestoneTimeline {...defaultProps} milestones={milestones} />)
      const timeline = container.querySelector('[data-testid="milestone-timeline"]')
      // Connecting lines have class 'bg-slate-200' and 'min-h-[24px]'
      const lines = timeline?.querySelectorAll('.bg-slate-200.min-h-\\[24px\\]')
      // Should have N-1 lines for N milestones
      expect(lines?.length).toBe(1)
    })

    it('does not render connecting line after last milestone', () => {
      const milestones = [
        createMockMilestone({ id: 'fm-1', display_order: 1 }),
        createMockMilestone({ id: 'fm-2', display_order: 2 }),
      ]
      const { container } = render(<MilestoneTimeline {...defaultProps} milestones={milestones} />)
      const timeline = container.querySelector('[data-testid="milestone-timeline"]')
      const lines = timeline?.querySelectorAll('.bg-slate-200.min-h-\\[24px\\]')
      // Exactly 1 line between 2 milestones (not 2 lines)
      expect(lines?.length).toBe(1)
    })
  })

  describe('issue highlighting', () => {
    it('applies amber background highlight to milestone row when it has an issue', () => {
      const milestoneWithIssue = createMockMilestone({ id: 'fm-issue' })
      const { container } = render(
        <MilestoneTimeline
          {...defaultProps}
          milestones={[milestoneWithIssue]}
          issueMilestoneIds={new Set(['fm-issue'])}
        />
      )
      // Issue rows have bg-amber-50
      const highlightedRow = container.querySelector('.bg-amber-50')
      expect(highlightedRow).toBeInTheDocument()
    })

    it('does not apply highlight to milestone without issue', () => {
      const { container } = render(<MilestoneTimeline {...defaultProps} />)
      const highlightedRow = container.querySelector('.bg-amber-50')
      expect(highlightedRow).not.toBeInTheDocument()
    })
  })
})
