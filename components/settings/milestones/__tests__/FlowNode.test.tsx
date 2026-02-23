// components/settings/milestones/__tests__/FlowNode.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EdgeMilestone, InteriorMilestone, UnassignedMilestone } from '../FlowNode'
import { resolveColorKey } from '@/lib/milestone-phase-config'
import type { EdgeMilestoneItem, InteriorMilestoneItem, UnassignedMilestoneItem } from '@/lib/utils/buildTemplateRenderList'

describe('FlowNode', () => {
  describe('EdgeMilestone', () => {
    it('renders edge milestone with start position', () => {
      const item: EdgeMilestoneItem = {
        type: 'edge-milestone',
        milestone: { id: 'm1', name: 'patient_in', display_name: 'Patient In', pair_with_id: null, pair_position: null },
        templateItem: { id: 'i1', template_id: 't1', facility_milestone_id: 'm1', facility_phase_id: 'p1', display_order: 1 },
        phase: { id: 'p1', name: 'pre_op', display_name: 'Pre-Op', color_key: 'blue', display_order: 1, parent_phase_id: null },
        color: resolveColorKey('blue'),
        edge: 'start',
      }

      render(<EdgeMilestone item={item} onRemove={vi.fn()} />)

      expect(screen.getByText('Patient In')).toBeInTheDocument()
    })

    it('renders edge milestone with end position', () => {
      const item: EdgeMilestoneItem = {
        type: 'edge-milestone',
        milestone: { id: 'm2', name: 'patient_out', display_name: 'Patient Out', pair_with_id: null, pair_position: null },
        templateItem: { id: 'i2', template_id: 't1', facility_milestone_id: 'm2', facility_phase_id: 'p3', display_order: 5 },
        phase: { id: 'p3', name: 'post_op', display_name: 'Post-Op', color_key: 'purple', display_order: 3, parent_phase_id: null },
        color: resolveColorKey('purple'),
        edge: 'end',
      }

      render(<EdgeMilestone item={item} onRemove={vi.fn()} />)

      expect(screen.getByText('Patient Out')).toBeInTheDocument()
    })

    it('calls onRemove when remove button clicked', async () => {
      const onRemove = vi.fn()
      const user = userEvent.setup()
      const item: EdgeMilestoneItem = {
        type: 'edge-milestone',
        milestone: { id: 'm1', name: 'incision', display_name: 'Incision', pair_with_id: null, pair_position: null },
        templateItem: { id: 'i1', template_id: 't1', facility_milestone_id: 'm1', facility_phase_id: 'p2', display_order: 2 },
        phase: { id: 'p2', name: 'surgical', display_name: 'Surgical', color_key: 'green', display_order: 2, parent_phase_id: null },
        color: resolveColorKey('green'),
        edge: 'start',
      }

      const { container } = render(<EdgeMilestone item={item} onRemove={onRemove} />)

      // Look for X button (implementation may vary)
      const removeButton = container.querySelector('button svg')?.closest('button')
      if (removeButton) {
        await user.click(removeButton)
        expect(onRemove).toHaveBeenCalledWith('i1')
      }
    })

    it('shows pair indicator for start milestone', () => {
      const item: EdgeMilestoneItem = {
        type: 'edge-milestone',
        milestone: {
          id: 'm6',
          name: 'anesth_start',
          display_name: 'Anesthesia Start',
          pair_with_id: 'm7',
          pair_position: 'start',
        },
        templateItem: { id: 'i6', template_id: 't1', facility_milestone_id: 'm6', facility_phase_id: 'p1', display_order: 2 },
        phase: { id: 'p1', name: 'pre_op', display_name: 'Pre-Op', color_key: 'blue', display_order: 1, parent_phase_id: null },
        color: resolveColorKey('blue'),
        edge: 'start',
      }

      render(<EdgeMilestone item={item} onRemove={vi.fn()} />)

      expect(screen.getByText('Anesthesia Start')).toBeInTheDocument()
    })

    it('shows pair indicator for end milestone', () => {
      const item: EdgeMilestoneItem = {
        type: 'edge-milestone',
        milestone: {
          id: 'm7',
          name: 'anesth_end',
          display_name: 'Anesthesia End',
          pair_with_id: 'm6',
          pair_position: 'end',
        },
        templateItem: { id: 'i7', template_id: 't1', facility_milestone_id: 'm7', facility_phase_id: 'p1', display_order: 3 },
        phase: { id: 'p1', name: 'pre_op', display_name: 'Pre-Op', color_key: 'blue', display_order: 1, parent_phase_id: null },
        color: resolveColorKey('blue'),
        edge: 'end',
      }

      render(<EdgeMilestone item={item} onRemove={vi.fn()} />)

      expect(screen.getByText('Anesthesia End')).toBeInTheDocument()
    })
  })

  describe('InteriorMilestone', () => {
    it('renders interior milestone', () => {
      const item: InteriorMilestoneItem = {
        type: 'interior-milestone',
        milestone: { id: 'm3', name: 'timeout', display_name: 'Timeout', pair_with_id: null, pair_position: null },
        templateItem: { id: 'i3', template_id: 't1', facility_milestone_id: 'm3', facility_phase_id: 'p1', display_order: 3 },
        phase: { id: 'p1', name: 'pre_op', display_name: 'Pre-Op', color_key: 'blue', display_order: 1, parent_phase_id: null },
        color: resolveColorKey('blue'),
      }

      render(<InteriorMilestone item={item} onRemove={vi.fn()} />)

      expect(screen.getByText('Timeout')).toBeInTheDocument()
    })

    it('calls onRemove when remove button clicked', async () => {
      const onRemove = vi.fn()
      const user = userEvent.setup()
      const item: InteriorMilestoneItem = {
        type: 'interior-milestone',
        milestone: { id: 'm4', name: 'step_a', display_name: 'Step A', pair_with_id: null, pair_position: null },
        templateItem: { id: 'i4', template_id: 't1', facility_milestone_id: 'm4', facility_phase_id: 'p2', display_order: 4 },
        phase: { id: 'p2', name: 'surgical', display_name: 'Surgical', color_key: 'green', display_order: 2, parent_phase_id: null },
        color: resolveColorKey('green'),
      }

      const { container } = render(<InteriorMilestone item={item} onRemove={onRemove} />)

      const removeButton = container.querySelector('button svg')?.closest('button')
      if (removeButton) {
        await user.click(removeButton)
        expect(onRemove).toHaveBeenCalledWith('i4')
      }
    })
  })

  describe('UnassignedMilestone', () => {
    it('renders unassigned milestone', () => {
      const item: UnassignedMilestoneItem = {
        type: 'unassigned-milestone',
        milestone: { id: 'm5', name: 'orphan', display_name: 'Orphan Milestone', pair_with_id: null, pair_position: null },
        templateItem: { id: 'i5', template_id: 't1', facility_milestone_id: 'm5', facility_phase_id: null, display_order: 10 },
      }

      render(<UnassignedMilestone item={item} onRemove={vi.fn()} />)

      expect(screen.getByText('Orphan Milestone')).toBeInTheDocument()
    })

    it('does not display phase information for unassigned milestones', () => {
      const item: UnassignedMilestoneItem = {
        type: 'unassigned-milestone',
        milestone: { id: 'm5', name: 'orphan', display_name: 'Orphan Milestone', pair_with_id: null, pair_position: null },
        templateItem: { id: 'i5', template_id: 't1', facility_milestone_id: 'm5', facility_phase_id: null, display_order: 10 },
      }

      const { container } = render(<UnassignedMilestone item={item} onRemove={vi.fn()} />)

      // Unassigned milestones should not show phase badges or colors
      expect(container.textContent).not.toContain('Pre-Op')
      expect(container.textContent).not.toContain('Surgical')
    })
  })

  describe('Phase 8 — Filled dot rendering', () => {
    it('EdgeMilestone renders filled circle dot, not checkmark SVG', () => {
      const item: EdgeMilestoneItem = {
        type: 'edge-milestone',
        milestone: { id: 'm1', name: 'patient_in', display_name: 'Patient In', pair_with_id: null, pair_position: null },
        templateItem: { id: 'i1', template_id: 't1', facility_milestone_id: 'm1', facility_phase_id: 'p1', display_order: 1 },
        phase: { id: 'p1', name: 'pre_op', display_name: 'Pre-Op', color_key: 'blue', display_order: 1, parent_phase_id: null },
        color: resolveColorKey('blue'),
        edge: 'start',
      }

      const { container } = render(<EdgeMilestone item={item} onRemove={vi.fn()} />)

      // Look for filled circle div (rounded-full)
      const filledDot = container.querySelector('[class*="rounded-full"]')
      expect(filledDot).toBeInTheDocument()
      expect(filledDot).toHaveClass('w-4', 'h-4', 'rounded-full')

      // Ensure no checkmark SVG path exists
      const checkmarkPath = container.querySelector('path[d*="M20 6L9 17l-5-5"]')
      expect(checkmarkPath).toBeNull()
    })

    it('InteriorMilestone renders filled circle dot, not checkmark SVG', () => {
      const item: InteriorMilestoneItem = {
        type: 'interior-milestone',
        milestone: { id: 'm3', name: 'timeout', display_name: 'Timeout', pair_with_id: null, pair_position: null },
        templateItem: { id: 'i3', template_id: 't1', facility_milestone_id: 'm3', facility_phase_id: 'p1', display_order: 3 },
        phase: { id: 'p1', name: 'pre_op', display_name: 'Pre-Op', color_key: 'blue', display_order: 1, parent_phase_id: null },
        color: resolveColorKey('blue'),
      }

      const { container } = render(<InteriorMilestone item={item} onRemove={vi.fn()} />)

      // Look for filled circle div
      const filledDot = container.querySelector('[class*="rounded-full"]')
      expect(filledDot).toBeInTheDocument()

      // No checkmark path
      const checkmarkPath = container.querySelector('path[d*="M20 6L9 17l-5-5"]')
      expect(checkmarkPath).toBeNull()
    })

    it('UnassignedMilestone renders filled circle dot in slate color', () => {
      const item: UnassignedMilestoneItem = {
        type: 'unassigned-milestone',
        milestone: { id: 'm5', name: 'orphan', display_name: 'Orphan Milestone', pair_with_id: null, pair_position: null },
        templateItem: { id: 'i5', template_id: 't1', facility_milestone_id: 'm5', facility_phase_id: null, display_order: 10 },
      }

      const { container } = render(<UnassignedMilestone item={item} onRemove={vi.fn()} />)

      // Look for filled circle div
      const filledDot = container.querySelector('[class*="rounded-full"]')
      expect(filledDot).toBeInTheDocument()

      // No checkmark path
      const checkmarkPath = container.querySelector('path[d*="M20 6L9 17l-5-5"]')
      expect(checkmarkPath).toBeNull()
    })
  })
})
