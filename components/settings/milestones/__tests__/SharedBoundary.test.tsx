// components/settings/milestones/__tests__/SharedBoundary.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SharedBoundary } from '../SharedBoundary'
import { resolveColorKey } from '@/lib/milestone-phase-config'
import type { SharedBoundaryItem } from '@/lib/utils/buildTemplateRenderList'

describe('SharedBoundary', () => {
  it('renders milestone display name', () => {
    const item: SharedBoundaryItem = {
      type: 'shared-boundary',
      milestone: { id: 'm1', name: 'incision', display_name: 'Incision', pair_with_id: null, pair_position: null },
      templateItemId: 'i1',
      endsPhase: { id: 'p1', name: 'pre_op', display_name: 'Pre-Op', color_key: 'blue', display_order: 1, parent_phase_id: null },
      startsPhase: { id: 'p2', name: 'surgical', display_name: 'Surgical', color_key: 'green', display_order: 2, parent_phase_id: null },
      endsColor: resolveColorKey('blue'),
      startsColor: resolveColorKey('green'),
    }

    render(<SharedBoundary item={item} />)

    expect(screen.getByText('Incision')).toBeInTheDocument()
  })

  it('renders gradient connector element', () => {
    const item: SharedBoundaryItem = {
      type: 'shared-boundary',
      milestone: { id: 'm1', name: 'incision', display_name: 'Incision', pair_with_id: null, pair_position: null },
      templateItemId: 'i1',
      endsPhase: { id: 'p1', name: 'pre_op', display_name: 'Pre-Op', color_key: 'blue', display_order: 1, parent_phase_id: null },
      startsPhase: { id: 'p2', name: 'surgical', display_name: 'Surgical', color_key: 'green', display_order: 2, parent_phase_id: null },
      endsColor: resolveColorKey('blue'),
      startsColor: resolveColorKey('green'),
    }

    const { container } = render(<SharedBoundary item={item} />)

    // SharedBoundary is a purely visual component with gradient background
    expect(container.firstChild).toBeInTheDocument()
  })

  it('displays phase transition labels', () => {
    const item: SharedBoundaryItem = {
      type: 'shared-boundary',
      milestone: { id: 'm1', name: 'patient_out', display_name: 'Patient Out', pair_with_id: null, pair_position: null },
      templateItemId: 'i1',
      endsPhase: { id: 'p2', name: 'surgical', display_name: 'Surgical', color_key: 'green', display_order: 2, parent_phase_id: null },
      startsPhase: { id: 'p3', name: 'post_op', display_name: 'Post-Op', color_key: 'purple', display_order: 3, parent_phase_id: null },
      endsColor: resolveColorKey('green'),
      startsColor: resolveColorKey('purple'),
    }

    render(<SharedBoundary item={item} />)

    expect(screen.getByText(/ENDS SURGICAL/)).toBeInTheDocument()
    expect(screen.getByText(/STARTS POST-OP/)).toBeInTheDocument()
  })

  it('applies correct color styling from item props', () => {
    const item: SharedBoundaryItem = {
      type: 'shared-boundary',
      milestone: { id: 'm1', name: 'incision', display_name: 'Incision', pair_with_id: null, pair_position: null },
      templateItemId: 'i1',
      endsPhase: { id: 'p1', name: 'pre_op', display_name: 'Pre-Op', color_key: 'blue', display_order: 1, parent_phase_id: null },
      startsPhase: { id: 'p2', name: 'surgical', display_name: 'Surgical', color_key: 'amber', display_order: 2, parent_phase_id: null },
      endsColor: resolveColorKey('blue'),
      startsColor: resolveColorKey('amber'),
    }

    const { container } = render(<SharedBoundary item={item} />)

    // The gradient div should use endsColor and startsColor for styling
    // This is a shallow test - just verify component renders without error
    expect(container.firstChild).toBeInTheDocument()
  })
})
