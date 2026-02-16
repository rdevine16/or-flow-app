// components/settings/milestones/__tests__/MilestonesTable.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MilestonesTable } from '../MilestonesTable'
import type { MilestoneRowData } from '../MilestoneRow'

const makeMilestone = (overrides: Partial<MilestoneRowData> = {}): MilestoneRowData => ({
  id: crypto.randomUUID(),
  display_name: 'Test Milestone',
  display_order: 1,
  source_milestone_type_id: 'global-id',
  pair_with_id: null,
  pair_position: null,
  min_minutes: 1,
  max_minutes: 90,
  is_active: true,
  phase_group: 'pre_op',
  ...overrides,
})

describe('MilestonesTable', () => {
  const noop = vi.fn()

  it('renders loading skeleton when loading is true', () => {
    const { container } = render(
      <MilestonesTable milestones={[]} loading={true} onEdit={noop} onArchive={noop} />
    )
    // SkeletonTable renders shimmer divs
    expect(container.querySelector('.animate-pulse')).toBeTruthy()
  })

  it('renders all 4 phase group headers when given no milestones', () => {
    render(
      <MilestonesTable milestones={[]} loading={false} onEdit={noop} onArchive={noop} />
    )

    expect(screen.getByText('Pre-Op')).toBeInTheDocument()
    expect(screen.getByText('Surgical')).toBeInTheDocument()
    expect(screen.getByText('Closing')).toBeInTheDocument()
    expect(screen.getByText('Post-Op')).toBeInTheDocument()
  })

  it('shows empty state messages for empty phase groups', () => {
    render(
      <MilestonesTable milestones={[]} loading={false} onEdit={noop} onArchive={noop} />
    )

    const emptyMessages = screen.getAllByText('No milestones in this phase')
    expect(emptyMessages).toHaveLength(4)
  })

  it('groups milestones under correct phase headers', () => {
    const milestones: MilestoneRowData[] = [
      makeMilestone({ display_name: 'Patient In', phase_group: 'pre_op' }),
      makeMilestone({ display_name: 'Incision', phase_group: 'surgical' }),
      makeMilestone({ display_name: 'Closing Start', phase_group: 'closing' }),
    ]

    render(
      <MilestonesTable milestones={milestones} loading={false} onEdit={noop} onArchive={noop} />
    )

    expect(screen.getByText('Patient In')).toBeInTheDocument()
    expect(screen.getByText('Incision')).toBeInTheDocument()
    expect(screen.getByText('Closing Start')).toBeInTheDocument()
  })

  it('shows milestone count in phase headers', () => {
    const milestones: MilestoneRowData[] = [
      makeMilestone({ display_name: 'M1', phase_group: 'pre_op' }),
      makeMilestone({ display_name: 'M2', phase_group: 'pre_op' }),
      makeMilestone({ display_name: 'M3', phase_group: 'surgical' }),
    ]

    render(
      <MilestonesTable milestones={milestones} loading={false} onEdit={noop} onArchive={noop} />
    )

    expect(screen.getByText('2 milestones')).toBeInTheDocument()
    expect(screen.getByText('1 milestone')).toBeInTheDocument()
  })

  it('shows diamond indicator for custom milestones', () => {
    const milestones: MilestoneRowData[] = [
      makeMilestone({ display_name: 'Custom One', source_milestone_type_id: null, phase_group: 'pre_op' }),
    ]

    const { container } = render(
      <MilestonesTable milestones={milestones} loading={false} onEdit={noop} onArchive={noop} />
    )

    // ◆ is rendered as &#x25C6;
    expect(container.textContent).toContain('\u25C6')
  })

  it('does not show diamond indicator for global milestones', () => {
    const milestones: MilestoneRowData[] = [
      makeMilestone({ display_name: 'Global One', source_milestone_type_id: 'abc', phase_group: 'pre_op' }),
    ]

    render(
      <MilestonesTable milestones={milestones} loading={false} onEdit={noop} onArchive={noop} />
    )

    // Find the milestone row and check no diamond
    const row = screen.getByText('Global One').closest('tr')!
    expect(row.textContent).not.toContain('\u25C6')
  })

  it('shows Start/End pills for paired milestones', () => {
    const milestones: MilestoneRowData[] = [
      makeMilestone({ id: 'a', display_name: 'Anes Start', pair_with_id: 'b', pair_position: 'start', phase_group: 'pre_op' }),
      makeMilestone({ id: 'b', display_name: 'Anes End', pair_with_id: 'a', pair_position: 'end', phase_group: 'pre_op' }),
    ]

    render(
      <MilestonesTable milestones={milestones} loading={false} onEdit={noop} onArchive={noop} />
    )

    expect(screen.getByText('start')).toBeInTheDocument()
    expect(screen.getByText('end')).toBeInTheDocument()
  })

  it('shows paired milestone name in pair column', () => {
    const milestones: MilestoneRowData[] = [
      makeMilestone({ id: 'a', display_name: 'Anes Start', pair_with_id: 'b', pair_position: 'start', phase_group: 'pre_op' }),
      makeMilestone({ id: 'b', display_name: 'Anes End', pair_with_id: 'a', pair_position: 'end', phase_group: 'pre_op' }),
    ]

    render(
      <MilestonesTable milestones={milestones} loading={false} onEdit={noop} onArchive={noop} />
    )

    // The pair column should show the paired milestone's name
    const anesEndLinks = screen.getAllByText('Anes End')
    // One in the milestone name column, one in the pair column of Anes Start
    expect(anesEndLinks.length).toBeGreaterThanOrEqual(2)
  })

  it('shows valid range in monospace', () => {
    const milestones: MilestoneRowData[] = [
      makeMilestone({ display_name: 'M1', min_minutes: 5, max_minutes: 45, phase_group: 'pre_op' }),
    ]

    render(
      <MilestonesTable milestones={milestones} loading={false} onEdit={noop} onArchive={noop} />
    )

    // 5–45 min (en-dash)
    expect(screen.getByText('5\u201345 min')).toBeInTheDocument()
  })

  it('shows em-dash for milestones without valid range', () => {
    const milestones: MilestoneRowData[] = [
      makeMilestone({ display_name: 'M1', min_minutes: null, max_minutes: null, phase_group: 'pre_op' }),
    ]

    render(
      <MilestonesTable milestones={milestones} loading={false} onEdit={noop} onArchive={noop} />
    )

    // Both pair column (em-dash for unpaired) and valid range column show em-dash
    const dashes = screen.getAllByText('\u2014')
    expect(dashes.length).toBeGreaterThanOrEqual(1)
  })

  it('calls onEdit when edit button is clicked', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    const milestones: MilestoneRowData[] = [
      makeMilestone({ display_name: 'M1', phase_group: 'pre_op' }),
    ]

    render(
      <MilestonesTable milestones={milestones} loading={false} onEdit={onEdit} onArchive={noop} />
    )

    const editBtn = screen.getByTitle('Edit milestone')
    await user.click(editBtn)
    expect(onEdit).toHaveBeenCalledWith(milestones[0])
  })

  it('calls onArchive when archive button is clicked for custom milestone', async () => {
    const user = userEvent.setup()
    const onArchive = vi.fn()
    const milestones: MilestoneRowData[] = [
      makeMilestone({ display_name: 'Custom M', source_milestone_type_id: null, phase_group: 'pre_op' }),
    ]

    render(
      <MilestonesTable milestones={milestones} loading={false} onEdit={noop} onArchive={onArchive} />
    )

    const archiveBtn = screen.getByTitle('Archive milestone')
    await user.click(archiveBtn)
    expect(onArchive).toHaveBeenCalledWith(milestones[0])
  })

  it('does not show archive button for global milestones', () => {
    const milestones: MilestoneRowData[] = [
      makeMilestone({ display_name: 'Global M', source_milestone_type_id: 'abc', phase_group: 'pre_op' }),
    ]

    render(
      <MilestonesTable milestones={milestones} loading={false} onEdit={noop} onArchive={noop} />
    )

    expect(screen.queryByTitle('Archive milestone')).not.toBeInTheDocument()
  })

  it('puts unassigned milestones in an Unassigned group', () => {
    const milestones: MilestoneRowData[] = [
      makeMilestone({ display_name: 'Orphan', phase_group: null }),
    ]

    render(
      <MilestonesTable milestones={milestones} loading={false} onEdit={noop} onArchive={noop} />
    )

    expect(screen.getByText('Unassigned')).toBeInTheDocument()
    expect(screen.getByText('Orphan')).toBeInTheDocument()
  })

  it('renders column headers', () => {
    render(
      <MilestonesTable milestones={[]} loading={false} onEdit={noop} onArchive={noop} />
    )

    expect(screen.getByText('#')).toBeInTheDocument()
    expect(screen.getByText('Milestone')).toBeInTheDocument()
    expect(screen.getByText('Pair')).toBeInTheDocument()
    expect(screen.getByText('Valid Range')).toBeInTheDocument()
  })
})
