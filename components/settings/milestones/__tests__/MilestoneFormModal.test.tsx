// components/settings/milestones/__tests__/MilestoneFormModal.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MilestoneFormModal } from '../MilestoneFormModal'

const noop = vi.fn()

describe('MilestoneFormModal', () => {
  describe('Add mode', () => {
    it('renders add modal with empty form fields', () => {
      render(
        <MilestoneFormModal
          open={true}
          onClose={noop}
          mode="add"
          saving={false}
          onSubmit={noop}
        />
      )

      expect(screen.getByText('Add Custom Milestone')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('e.g., Array Placement')).toHaveValue('')
      expect(screen.getByText('Add Milestone')).toBeInTheDocument()
    })

    it('shows internal name field in add mode', () => {
      render(
        <MilestoneFormModal
          open={true}
          onClose={noop}
          mode="add"
          saving={false}
          onSubmit={noop}
        />
      )

      expect(screen.getByText(/Internal Name/)).toBeInTheDocument()
    })

    it('calls onSubmit with form data when Add Milestone clicked', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn()

      render(
        <MilestoneFormModal
          open={true}
          onClose={noop}
          mode="add"
          saving={false}
          onSubmit={onSubmit}
        />
      )

      await user.type(screen.getByPlaceholderText('e.g., Array Placement'), 'My Milestone')
      await user.click(screen.getByText('Add Milestone'))

      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          displayName: 'My Milestone',
          internalName: 'my_milestone',
        })
      )
    })

    it('disables Add Milestone button when display name is empty', () => {
      render(
        <MilestoneFormModal
          open={true}
          onClose={noop}
          mode="add"
          saving={false}
          onSubmit={noop}
        />
      )

      expect(screen.getByText('Add Milestone').closest('button')).toBeDisabled()
    })
  })

  describe('Edit mode', () => {
    const milestone = {
      id: 'test-id',
      display_name: 'Patient In',
      source_milestone_type_id: null,
      pair_with_id: null,
      pair_position: null as 'start' | 'end' | null,
      min_minutes: 5,
      max_minutes: 60,
      phase_group: 'pre_op' as const,
      validation_type: 'sequence_gap' as const,
    }

    it('renders edit modal with pre-filled values', () => {
      render(
        <MilestoneFormModal
          open={true}
          onClose={noop}
          mode="edit"
          milestone={milestone}
          saving={false}
          onSubmit={noop}
        />
      )

      expect(screen.getByText('Edit Milestone')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Patient In')).toBeInTheDocument()
      expect(screen.getByText('Save Changes')).toBeInTheDocument()
    })

    it('does not show internal name field in edit mode', () => {
      render(
        <MilestoneFormModal
          open={true}
          onClose={noop}
          mode="edit"
          milestone={milestone}
          saving={false}
          onSubmit={noop}
        />
      )

      expect(screen.queryByText(/Internal Name/)).not.toBeInTheDocument()
    })

    it('shows validation range fields in edit mode', () => {
      render(
        <MilestoneFormModal
          open={true}
          onClose={noop}
          mode="edit"
          milestone={milestone}
          saving={false}
          onSubmit={noop}
        />
      )

      expect(screen.getByText('Expected Duration Range')).toBeInTheDocument()
      expect(screen.getByDisplayValue('5')).toBeInTheDocument()
      expect(screen.getByDisplayValue('60')).toBeInTheDocument()
    })

    it('shows Archive button for custom milestones', () => {
      const onArchive = vi.fn()
      render(
        <MilestoneFormModal
          open={true}
          onClose={noop}
          mode="edit"
          milestone={milestone}
          saving={false}
          onSubmit={noop}
          onArchive={onArchive}
        />
      )

      expect(screen.getByText('Archive')).toBeInTheDocument()
    })

    it('hides Archive button for global milestones', () => {
      const globalMilestone = { ...milestone, source_milestone_type_id: 'global-123' }
      render(
        <MilestoneFormModal
          open={true}
          onClose={noop}
          mode="edit"
          milestone={globalMilestone}
          saving={false}
          onSubmit={noop}
          onArchive={noop}
        />
      )

      expect(screen.queryByText('Archive')).not.toBeInTheDocument()
    })

    it('shows global milestone info box for global milestones', () => {
      const globalMilestone = { ...milestone, source_milestone_type_id: 'global-123' }
      render(
        <MilestoneFormModal
          open={true}
          onClose={noop}
          mode="edit"
          milestone={globalMilestone}
          saving={false}
          onSubmit={noop}
        />
      )

      expect(screen.getByText(/global milestone/i)).toBeInTheDocument()
    })

    it('shows paired milestone info when milestone is paired', () => {
      const pairedMilestone = {
        ...milestone,
        pair_with_id: 'pair-id',
        pair_position: 'start' as const,
      }
      render(
        <MilestoneFormModal
          open={true}
          onClose={noop}
          mode="edit"
          milestone={pairedMilestone}
          pairedName="Anes End"
          saving={false}
          onSubmit={noop}
        />
      )

      expect(screen.getByText('Paired Milestone')).toBeInTheDocument()
      expect(screen.getByText('Anes End')).toBeInTheDocument()
    })
  })

  it('does not render content when closed', () => {
    render(
      <MilestoneFormModal
        open={false}
        onClose={noop}
        mode="add"
        saving={false}
        onSubmit={noop}
      />
    )

    expect(screen.queryByPlaceholderText('e.g., Array Placement')).not.toBeInTheDocument()
  })
})
