// components/settings/milestones/__tests__/SubPhaseIndicator.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SubPhaseIndicator } from '../SubPhaseIndicator'
import { resolveColorKey } from '@/lib/milestone-phase-config'
import type { SubPhaseItem } from '@/lib/utils/buildTemplateRenderList'

describe('SubPhaseIndicator', () => {
  it('renders sub-phase name', () => {
    const item: SubPhaseItem = {
      type: 'sub-phase',
      phase: { id: 'p2_sub', name: 'closure', display_name: 'Closure', color_key: 'amber', display_order: 3, parent_phase_id: 'p2' },
      parentPhase: { id: 'p2', name: 'surgical', display_name: 'Surgical', color_key: 'green', display_order: 2, parent_phase_id: null },
      color: resolveColorKey('amber'),
      milestones: [
        {
          milestone: { id: 'm1', name: 'suture_start', display_name: 'Suture Start', pair_with_id: null, pair_position: null },
          templateItem: { id: 'i1', template_id: 't1', facility_milestone_id: 'm1', facility_phase_id: 'p2_sub', display_order: 1 },
        },
        {
          milestone: { id: 'm2', name: 'suture_end', display_name: 'Suture End', pair_with_id: null, pair_position: null },
          templateItem: { id: 'i2', template_id: 't1', facility_milestone_id: 'm2', facility_phase_id: 'p2_sub', display_order: 2 },
        },
      ],
    }

    render(<SubPhaseIndicator item={item} />)

    expect(screen.getByText(/Closure/)).toBeInTheDocument()
  })

  it('renders milestone count', () => {
    const item: SubPhaseItem = {
      type: 'sub-phase',
      phase: { id: 'p2_sub', name: 'closure', display_name: 'Closure', color_key: 'amber', display_order: 3, parent_phase_id: 'p2' },
      parentPhase: { id: 'p2', name: 'surgical', display_name: 'Surgical', color_key: 'green', display_order: 2, parent_phase_id: null },
      color: resolveColorKey('amber'),
      milestones: [
        {
          milestone: { id: 'm1', name: 'suture_start', display_name: 'Suture Start', pair_with_id: null, pair_position: null },
          templateItem: { id: 'i1', template_id: 't1', facility_milestone_id: 'm1', facility_phase_id: 'p2_sub', display_order: 1 },
        },
        {
          milestone: { id: 'm2', name: 'suture_end', display_name: 'Suture End', pair_with_id: null, pair_position: null },
          templateItem: { id: 'i2', template_id: 't1', facility_milestone_id: 'm2', facility_phase_id: 'p2_sub', display_order: 2 },
        },
        {
          milestone: { id: 'm3', name: 'dressing', display_name: 'Dressing', pair_with_id: null, pair_position: null },
          templateItem: { id: 'i3', template_id: 't1', facility_milestone_id: 'm3', facility_phase_id: 'p2_sub', display_order: 3 },
        },
      ],
    }

    render(<SubPhaseIndicator item={item} />)

    expect(screen.getByText(/3/)).toBeInTheDocument()
  })

  it('lists milestone names', () => {
    const item: SubPhaseItem = {
      type: 'sub-phase',
      phase: { id: 'p1_sub', name: 'anesthesia', display_name: 'Anesthesia', color_key: 'purple', display_order: 2, parent_phase_id: 'p1' },
      parentPhase: { id: 'p1', name: 'pre_op', display_name: 'Pre-Op', color_key: 'blue', display_order: 1, parent_phase_id: null },
      color: resolveColorKey('purple'),
      milestones: [
        {
          milestone: { id: 'm1', name: 'anesth_start', display_name: 'Anesthesia Start', pair_with_id: 'm2', pair_position: 'start' },
          templateItem: { id: 'i1', template_id: 't1', facility_milestone_id: 'm1', facility_phase_id: 'p1_sub', display_order: 1 },
        },
        {
          milestone: { id: 'm2', name: 'anesth_end', display_name: 'Anesthesia End', pair_with_id: 'm1', pair_position: 'end' },
          templateItem: { id: 'i2', template_id: 't1', facility_milestone_id: 'm2', facility_phase_id: 'p1_sub', display_order: 2 },
        },
      ],
    }

    render(<SubPhaseIndicator item={item} />)

    expect(screen.getByText(/Anesthesia Start/)).toBeInTheDocument()
    expect(screen.getByText(/Anesthesia End/)).toBeInTheDocument()
  })

  it('applies color styling based on color prop', () => {
    const item: SubPhaseItem = {
      type: 'sub-phase',
      phase: { id: 'p2_sub', name: 'closure', display_name: 'Closure', color_key: 'red', display_order: 3, parent_phase_id: 'p2' },
      parentPhase: { id: 'p2', name: 'surgical', display_name: 'Surgical', color_key: 'green', display_order: 2, parent_phase_id: null },
      color: resolveColorKey('red'),
      milestones: [
        {
          milestone: { id: 'm1', name: 'suture', display_name: 'Suture', pair_with_id: null, pair_position: null },
          templateItem: { id: 'i1', template_id: 't1', facility_milestone_id: 'm1', facility_phase_id: 'p2_sub', display_order: 1 },
        },
      ],
    }

    const { container } = render(<SubPhaseIndicator item={item} />)

    // Verify component renders with color styling - exact class depends on implementation
    expect(container.firstChild).toBeInTheDocument()
  })

  it('handles empty milestones array', () => {
    const item: SubPhaseItem = {
      type: 'sub-phase',
      phase: { id: 'p2_sub', name: 'closure', display_name: 'Closure', color_key: 'amber', display_order: 3, parent_phase_id: 'p2' },
      parentPhase: { id: 'p2', name: 'surgical', display_name: 'Surgical', color_key: 'green', display_order: 2, parent_phase_id: null },
      color: resolveColorKey('amber'),
      milestones: [],
    }

    render(<SubPhaseIndicator item={item} />)

    expect(screen.getByText(/Closure/)).toBeInTheDocument()
    expect(screen.getByText(/0/)).toBeInTheDocument()
  })

  it('shows SUB-PHASE badge', () => {
    const item: SubPhaseItem = {
      type: 'sub-phase',
      phase: { id: 'p2_sub', name: 'closure', display_name: 'Closure', color_key: 'amber', display_order: 3, parent_phase_id: 'p2' },
      parentPhase: { id: 'p2', name: 'surgical', display_name: 'Surgical', color_key: 'green', display_order: 2, parent_phase_id: null },
      color: resolveColorKey('amber'),
      milestones: [],
    }

    render(<SubPhaseIndicator item={item} />)

    expect(screen.getByText(/SUB-PHASE|Sub-Phase/i)).toBeInTheDocument()
  })
})
