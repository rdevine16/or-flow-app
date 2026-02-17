// components/settings/milestones/__tests__/PhaseBlock.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PhaseBlock } from '../PhaseBlock'
import type { PhaseBlockMilestone } from '../PhaseBlock'

const mockMilestones: PhaseBlockMilestone[] = [
  {
    id: 'ms-1',
    display_name: 'Anesthesia Start',
    phase_group: 'pre_op',
    is_boundary: false,
    pair_with_id: 'ms-2',
    pair_position: 'start',
    pair_group: 'anesthesia',
    min_minutes: 5,
    max_minutes: 15,
  },
  {
    id: 'ms-2',
    display_name: 'Anesthesia End',
    phase_group: 'pre_op',
    is_boundary: false,
    pair_with_id: 'ms-1',
    pair_position: 'end',
    pair_group: 'anesthesia',
    min_minutes: null,
    max_minutes: null,
  },
  {
    id: 'ms-3',
    display_name: 'Bed Prep',
    phase_group: 'pre_op',
    is_boundary: false,
    pair_with_id: null,
    pair_position: null,
    pair_group: null,
    min_minutes: null,
    max_minutes: null,
  },
]

describe('PhaseBlock', () => {
  describe('header', () => {
    it('renders phase label and milestone count in table mode', () => {
      render(
        <PhaseBlock
          phaseColor="#3B82F6"
          phaseLabel="Pre-Op"
          phaseKey="pre_op"
          mode="table"
          milestones={mockMilestones}
        />
      )

      expect(screen.getByText('Pre-Op')).toBeInTheDocument()
      expect(screen.getByText('3 milestones')).toBeInTheDocument()
    })

    it('renders enabled/total count in config mode', () => {
      render(
        <PhaseBlock
          phaseColor="#3B82F6"
          phaseLabel="Pre-Op"
          phaseKey="pre_op"
          mode="config"
          milestones={mockMilestones}
          config={{ 'ms-1': true, 'ms-2': false, 'ms-3': true }}
          onToggle={vi.fn()}
        />
      )

      expect(screen.getByText('2/3')).toBeInTheDocument()
    })

    it('shows pair issue count when present', () => {
      const { container } = render(
        <PhaseBlock
          phaseColor="#3B82F6"
          phaseLabel="Pre-Op"
          phaseKey="pre_op"
          mode="table"
          milestones={mockMilestones}
          pairIssueCount={2}
        />
      )

      // Find the pair issue indicator by its red text color class
      const issueSpan = container.querySelector('.text-red-500')
      expect(issueSpan).toBeInTheDocument()
      expect(issueSpan?.textContent).toContain('2')
    })

    it('uses singular "milestone" for count of 1', () => {
      render(
        <PhaseBlock
          phaseColor="#3B82F6"
          phaseLabel="Pre-Op"
          phaseKey="pre_op"
          mode="table"
          milestones={[mockMilestones[0]]}
        />
      )

      expect(screen.getByText('1 milestone')).toBeInTheDocument()
    })
  })

  describe('collapse/expand', () => {
    it('starts expanded by default', () => {
      render(
        <PhaseBlock
          phaseColor="#3B82F6"
          phaseLabel="Pre-Op"
          phaseKey="pre_op"
          mode="table"
          milestones={mockMilestones}
        />
      )

      expect(screen.getByText('Anesthesia Start')).toBeInTheDocument()
      expect(screen.getByText('Bed Prep')).toBeInTheDocument()
    })

    it('collapses when header is clicked', () => {
      render(
        <PhaseBlock
          phaseColor="#3B82F6"
          phaseLabel="Pre-Op"
          phaseKey="pre_op"
          mode="table"
          milestones={mockMilestones}
        />
      )

      // Click the header to collapse
      fireEvent.click(screen.getByText('Pre-Op'))

      // Milestone rows should be hidden
      expect(screen.queryByText('Anesthesia Start')).not.toBeInTheDocument()
    })

    it('re-expands when header is clicked again', () => {
      render(
        <PhaseBlock
          phaseColor="#3B82F6"
          phaseLabel="Pre-Op"
          phaseKey="pre_op"
          mode="table"
          milestones={mockMilestones}
        />
      )

      // Click to collapse, then click to expand
      fireEvent.click(screen.getByText('Pre-Op'))
      fireEvent.click(screen.getByText('Pre-Op'))

      expect(screen.getByText('Anesthesia Start')).toBeInTheDocument()
    })
  })

  describe('table mode', () => {
    it('renders numbered rows', () => {
      render(
        <PhaseBlock
          phaseColor="#3B82F6"
          phaseLabel="Pre-Op"
          phaseKey="pre_op"
          mode="table"
          milestones={mockMilestones}
          startCounter={1}
        />
      )

      expect(screen.getByText('1')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument()
    })

    it('calls onDelete when archive button is clicked', () => {
      const onDelete = vi.fn()
      render(
        <PhaseBlock
          phaseColor="#3B82F6"
          phaseLabel="Pre-Op"
          phaseKey="pre_op"
          mode="table"
          milestones={mockMilestones}
          onDelete={onDelete}
        />
      )

      // Find archive buttons (there should be 3, one per milestone)
      const allButtons = screen.getAllByRole('button')
      const archiveButtons = allButtons.filter((btn) =>
        btn.querySelector('svg.lucide-archive')
      )
      expect(archiveButtons.length).toBe(3)

      fireEvent.click(archiveButtons[0])
      expect(onDelete).toHaveBeenCalledWith('ms-1')
    })

    it('calls onEditMilestone when pencil button is clicked', () => {
      const onEdit = vi.fn()
      render(
        <PhaseBlock
          phaseColor="#3B82F6"
          phaseLabel="Pre-Op"
          phaseKey="pre_op"
          mode="table"
          milestones={mockMilestones}
          onEditMilestone={onEdit}
        />
      )

      const allButtons = screen.getAllByRole('button')
      const pencilButtons = allButtons.filter((btn) =>
        btn.querySelector('svg.lucide-pencil')
      )
      expect(pencilButtons.length).toBe(3)

      fireEvent.click(pencilButtons[1])
      expect(onEdit).toHaveBeenCalledWith('ms-2')
    })

    it('renders interval badge when min_minutes and max_minutes are set', () => {
      render(
        <PhaseBlock
          phaseColor="#3B82F6"
          phaseLabel="Pre-Op"
          phaseKey="pre_op"
          mode="table"
          milestones={mockMilestones}
        />
      )

      // ms-1 has min_minutes: 5, max_minutes: 15 → "5–15 min"
      expect(screen.getByText('5\u201315 min')).toBeInTheDocument()
      // ms-2 and ms-3 have null intervals → no badge
      expect(screen.queryByText('\u226490 min')).not.toBeInTheDocument()
    })

    it('renders interval badge with only max_minutes', () => {
      const milestones: PhaseBlockMilestone[] = [
        {
          id: 'ms-max',
          display_name: 'Max Only',
          phase_group: 'pre_op',
          is_boundary: false,
          pair_with_id: null,
          pair_position: null,
          pair_group: null,
          min_minutes: null,
          max_minutes: 30,
        },
      ]
      render(
        <PhaseBlock
          phaseColor="#3B82F6"
          phaseLabel="Pre-Op"
          phaseKey="pre_op"
          mode="table"
          milestones={milestones}
        />
      )

      expect(screen.getByText('\u226430 min')).toBeInTheDocument()
    })

    it('renders interval badge with only min_minutes', () => {
      const milestones: PhaseBlockMilestone[] = [
        {
          id: 'ms-min',
          display_name: 'Min Only',
          phase_group: 'pre_op',
          is_boundary: false,
          pair_with_id: null,
          pair_position: null,
          pair_group: null,
          min_minutes: 10,
          max_minutes: null,
        },
      ]
      render(
        <PhaseBlock
          phaseColor="#3B82F6"
          phaseLabel="Pre-Op"
          phaseKey="pre_op"
          mode="table"
          milestones={milestones}
        />
      )

      expect(screen.getByText('\u226510 min')).toBeInTheDocument()
    })

    it('respects startCounter for numbering', () => {
      render(
        <PhaseBlock
          phaseColor="#22C55E"
          phaseLabel="Surgical"
          phaseKey="surgical"
          mode="table"
          milestones={mockMilestones}
          startCounter={5}
        />
      )

      expect(screen.getByText('5')).toBeInTheDocument()
      expect(screen.getByText('6')).toBeInTheDocument()
      expect(screen.getByText('7')).toBeInTheDocument()
    })
  })

  describe('config mode', () => {
    it('renders checkboxes based on config', () => {
      const { container } = render(
        <PhaseBlock
          phaseColor="#3B82F6"
          phaseLabel="Pre-Op"
          phaseKey="pre_op"
          mode="config"
          milestones={mockMilestones}
          config={{ 'ms-1': true, 'ms-2': false, 'ms-3': true }}
          onToggle={vi.fn()}
        />
      )

      // Enabled checkboxes should have blue background
      const blueCheckboxes = container.querySelectorAll('.bg-blue-500')
      expect(blueCheckboxes.length).toBe(2)
    })

    it('calls onToggle when a row is clicked', () => {
      const onToggle = vi.fn()
      render(
        <PhaseBlock
          phaseColor="#3B82F6"
          phaseLabel="Pre-Op"
          phaseKey="pre_op"
          mode="config"
          milestones={mockMilestones}
          config={{ 'ms-1': true, 'ms-2': false, 'ms-3': true }}
          onToggle={onToggle}
        />
      )

      fireEvent.click(screen.getByText('Anesthesia End'))
      expect(onToggle).toHaveBeenCalledWith('ms-2')
    })

    it('shows override badges for overridden milestones', () => {
      render(
        <PhaseBlock
          phaseColor="#3B82F6"
          phaseLabel="Pre-Op"
          phaseKey="pre_op"
          mode="config"
          milestones={mockMilestones}
          config={{ 'ms-1': true, 'ms-2': false, 'ms-3': true }}
          parentConfig={{ 'ms-1': true, 'ms-2': true, 'ms-3': true }}
          overriddenIds={new Set(['ms-2'])}
          overrideLabel="OVERRIDE"
          onToggle={vi.fn()}
        />
      )

      expect(screen.getByText('OVERRIDE')).toBeInTheDocument()
      expect(screen.getByText('was on')).toBeInTheDocument()
    })

    it('shows "SURGEON" override label when specified', () => {
      render(
        <PhaseBlock
          phaseColor="#3B82F6"
          phaseLabel="Pre-Op"
          phaseKey="pre_op"
          mode="config"
          milestones={mockMilestones}
          config={{ 'ms-1': false, 'ms-2': true, 'ms-3': true }}
          parentConfig={{ 'ms-1': true, 'ms-2': true, 'ms-3': true }}
          overriddenIds={new Set(['ms-1'])}
          overrideLabel="SURGEON"
          onToggle={vi.fn()}
        />
      )

      expect(screen.getByText('SURGEON')).toBeInTheDocument()
    })

    it('applies line-through to disabled milestones', () => {
      render(
        <PhaseBlock
          phaseColor="#3B82F6"
          phaseLabel="Pre-Op"
          phaseKey="pre_op"
          mode="config"
          milestones={mockMilestones}
          config={{ 'ms-1': true, 'ms-2': false, 'ms-3': true }}
          onToggle={vi.fn()}
        />
      )

      const disabledName = screen.getByText('Anesthesia End')
      expect(disabledName.className).toContain('line-through')
      expect(disabledName.className).toContain('opacity-40')
    })
  })

  describe('empty state', () => {
    it('renders empty state message when no milestones', () => {
      render(
        <PhaseBlock
          phaseColor="#3B82F6"
          phaseLabel="Pre-Op"
          phaseKey="pre_op"
          mode="table"
          milestones={[]}
        />
      )

      expect(screen.getByText('No optional milestones')).toBeInTheDocument()
    })
  })

  describe('left border color', () => {
    it('applies phase color to left border', () => {
      const { container } = render(
        <PhaseBlock
          phaseColor="#22C55E"
          phaseLabel="Surgical"
          phaseKey="surgical"
          mode="table"
          milestones={mockMilestones}
        />
      )

      const block = container.querySelector('[style*="border-left"]') as HTMLElement
      expect(block).toBeInTheDocument()
      // JSDOM converts hex to rgb
      expect(block.style.borderLeft).toContain('rgb(34, 197, 94)')
    })
  })

  describe('child phase nesting', () => {
    const childMilestones: PhaseBlockMilestone[] = [
      {
        id: 'child-ms-1',
        display_name: 'Child Milestone A',
        phase_group: 'sub_phase',
        is_boundary: false,
        pair_with_id: null,
        pair_position: null,
        pair_group: null,
        min_minutes: null,
        max_minutes: null,
      },
      {
        id: 'child-ms-2',
        display_name: 'Child Milestone B',
        phase_group: 'sub_phase',
        is_boundary: false,
        pair_with_id: null,
        pair_position: null,
        pair_group: null,
        min_minutes: 3,
        max_minutes: 10,
      },
    ]

    it('renders child phase header and milestones in table mode', () => {
      render(
        <PhaseBlock
          phaseColor="#3B82F6"
          phaseLabel="Pre-Op"
          phaseKey="pre_op"
          mode="table"
          milestones={mockMilestones}
          childPhases={[
            {
              phaseColor: '#22C55E',
              phaseLabel: 'Sub Phase',
              phaseKey: 'sub_phase',
              milestones: childMilestones,
            },
          ]}
        />
      )

      expect(screen.getByText('Sub Phase')).toBeInTheDocument()
      expect(screen.getByText('Child Milestone A')).toBeInTheDocument()
      expect(screen.getByText('Child Milestone B')).toBeInTheDocument()
    })

    it('includes child milestones in parent header count (table mode)', () => {
      render(
        <PhaseBlock
          phaseColor="#3B82F6"
          phaseLabel="Pre-Op"
          phaseKey="pre_op"
          mode="table"
          milestones={mockMilestones}
          childPhases={[
            {
              phaseColor: '#22C55E',
              phaseLabel: 'Sub Phase',
              phaseKey: 'sub_phase',
              milestones: childMilestones,
            },
          ]}
        />
      )

      // 3 parent + 2 child = 5
      expect(screen.getByText('5 milestones')).toBeInTheDocument()
    })

    it('includes child milestones in config mode counts', () => {
      render(
        <PhaseBlock
          phaseColor="#3B82F6"
          phaseLabel="Pre-Op"
          phaseKey="pre_op"
          mode="config"
          milestones={mockMilestones}
          config={{
            'ms-1': true,
            'ms-2': false,
            'ms-3': true,
            'child-ms-1': true,
            'child-ms-2': false,
          }}
          onToggle={vi.fn()}
          childPhases={[
            {
              phaseColor: '#22C55E',
              phaseLabel: 'Sub Phase',
              phaseKey: 'sub_phase',
              milestones: childMilestones,
            },
          ]}
        />
      )

      // 2 parent enabled + 1 child enabled = 3/5
      expect(screen.getByText('3/5')).toBeInTheDocument()
    })

    it('renders child phase interval badges', () => {
      render(
        <PhaseBlock
          phaseColor="#3B82F6"
          phaseLabel="Pre-Op"
          phaseKey="pre_op"
          mode="table"
          milestones={[]}
          childPhases={[
            {
              phaseColor: '#22C55E',
              phaseLabel: 'Sub Phase',
              phaseKey: 'sub_phase',
              milestones: childMilestones,
            },
          ]}
        />
      )

      // child-ms-2 has 3-10 min
      expect(screen.getByText('3\u201310 min')).toBeInTheDocument()
    })

    it('calls onToggle for child milestone clicks in config mode', () => {
      const onToggle = vi.fn()
      render(
        <PhaseBlock
          phaseColor="#3B82F6"
          phaseLabel="Pre-Op"
          phaseKey="pre_op"
          mode="config"
          milestones={[]}
          config={{ 'child-ms-1': true, 'child-ms-2': true }}
          onToggle={onToggle}
          childPhases={[
            {
              phaseColor: '#22C55E',
              phaseLabel: 'Sub Phase',
              phaseKey: 'sub_phase',
              milestones: childMilestones,
            },
          ]}
        />
      )

      fireEvent.click(screen.getByText('Child Milestone A'))
      expect(onToggle).toHaveBeenCalledWith('child-ms-1')
    })

    it('calls onDelete for child milestone archive in table mode', () => {
      const onDelete = vi.fn()
      render(
        <PhaseBlock
          phaseColor="#3B82F6"
          phaseLabel="Pre-Op"
          phaseKey="pre_op"
          mode="table"
          milestones={[]}
          onDelete={onDelete}
          childPhases={[
            {
              phaseColor: '#22C55E',
              phaseLabel: 'Sub Phase',
              phaseKey: 'sub_phase',
              milestones: childMilestones,
            },
          ]}
        />
      )

      const archiveButtons = screen.getAllByRole('button').filter((btn) =>
        btn.querySelector('svg.lucide-archive')
      )
      expect(archiveButtons.length).toBe(2)
      fireEvent.click(archiveButtons[0])
      expect(onDelete).toHaveBeenCalledWith('child-ms-1')
    })

    it('continues numbering from parent milestones', () => {
      render(
        <PhaseBlock
          phaseColor="#3B82F6"
          phaseLabel="Pre-Op"
          phaseKey="pre_op"
          mode="table"
          milestones={mockMilestones}
          startCounter={1}
          childPhases={[
            {
              phaseColor: '#22C55E',
              phaseLabel: 'Sub Phase',
              phaseKey: 'sub_phase',
              milestones: childMilestones,
            },
          ]}
        />
      )

      // Parent milestones: 1, 2, 3
      // Child milestones: 4, 5
      expect(screen.getByText('4')).toBeInTheDocument()
      expect(screen.getByText('5')).toBeInTheDocument()
    })

    it('renders empty child phase with "No milestones" message', () => {
      render(
        <PhaseBlock
          phaseColor="#3B82F6"
          phaseLabel="Pre-Op"
          phaseKey="pre_op"
          mode="table"
          milestones={mockMilestones}
          childPhases={[
            {
              phaseColor: '#22C55E',
              phaseLabel: 'Empty Sub',
              phaseKey: 'empty_sub',
              milestones: [],
            },
          ]}
        />
      )

      expect(screen.getByText('Empty Sub')).toBeInTheDocument()
      expect(screen.getByText('No milestones')).toBeInTheDocument()
    })

    it('hides child phases when parent is collapsed', () => {
      render(
        <PhaseBlock
          phaseColor="#3B82F6"
          phaseLabel="Pre-Op"
          phaseKey="pre_op"
          mode="table"
          milestones={mockMilestones}
          childPhases={[
            {
              phaseColor: '#22C55E',
              phaseLabel: 'Sub Phase',
              phaseKey: 'sub_phase',
              milestones: childMilestones,
            },
          ]}
        />
      )

      // Collapse parent
      fireEvent.click(screen.getByText('Pre-Op'))
      expect(screen.queryByText('Sub Phase')).not.toBeInTheDocument()
      expect(screen.queryByText('Child Milestone A')).not.toBeInTheDocument()
    })

    it('can collapse child phase independently', () => {
      render(
        <PhaseBlock
          phaseColor="#3B82F6"
          phaseLabel="Pre-Op"
          phaseKey="pre_op"
          mode="table"
          milestones={mockMilestones}
          childPhases={[
            {
              phaseColor: '#22C55E',
              phaseLabel: 'Sub Phase',
              phaseKey: 'sub_phase',
              milestones: childMilestones,
            },
          ]}
        />
      )

      // Child phase header should be visible
      expect(screen.getByText('Sub Phase')).toBeInTheDocument()
      expect(screen.getByText('Child Milestone A')).toBeInTheDocument()

      // Collapse child phase
      fireEvent.click(screen.getByText('Sub Phase'))
      expect(screen.queryByText('Child Milestone A')).not.toBeInTheDocument()
      // Parent milestones still visible
      expect(screen.getByText('Anesthesia Start')).toBeInTheDocument()
    })
  })
})
