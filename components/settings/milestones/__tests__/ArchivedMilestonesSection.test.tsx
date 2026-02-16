// components/settings/milestones/__tests__/ArchivedMilestonesSection.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ArchivedMilestonesSection } from '../ArchivedMilestonesSection'

const noop = vi.fn()

describe('ArchivedMilestonesSection', () => {
  it('renders nothing when no archived milestones', () => {
    const { container } = render(
      <ArchivedMilestonesSection milestones={[]} saving={false} onRestore={noop} />
    )
    expect(container.innerHTML).toBe('')
  })

  it('shows count of archived milestones in collapsed header', () => {
    const milestones = [
      { id: '1', display_name: 'Archived One', source_milestone_type_id: null, deleted_at: new Date().toISOString() },
      { id: '2', display_name: 'Archived Two', source_milestone_type_id: 'global', deleted_at: new Date().toISOString() },
    ]

    render(
      <ArchivedMilestonesSection milestones={milestones} saving={false} onRestore={noop} />
    )

    expect(screen.getByText('Archived (2)')).toBeInTheDocument()
  })

  it('does not show milestone list by default (collapsed)', () => {
    const milestones = [
      { id: '1', display_name: 'Hidden One', source_milestone_type_id: null, deleted_at: new Date().toISOString() },
    ]

    render(
      <ArchivedMilestonesSection milestones={milestones} saving={false} onRestore={noop} />
    )

    expect(screen.queryByText('Hidden One')).not.toBeInTheDocument()
  })

  it('expands to show milestones when toggle clicked', async () => {
    const user = userEvent.setup()
    const milestones = [
      { id: '1', display_name: 'Visible Now', source_milestone_type_id: null, deleted_at: new Date().toISOString() },
    ]

    render(
      <ArchivedMilestonesSection milestones={milestones} saving={false} onRestore={noop} />
    )

    await user.click(screen.getByText('Archived (1)'))
    expect(screen.getByText('Visible Now')).toBeInTheDocument()
  })

  it('shows Restore button for each archived milestone', async () => {
    const user = userEvent.setup()
    const milestones = [
      { id: '1', display_name: 'Archived M', source_milestone_type_id: null, deleted_at: new Date().toISOString() },
    ]

    render(
      <ArchivedMilestonesSection milestones={milestones} saving={false} onRestore={noop} />
    )

    await user.click(screen.getByText('Archived (1)'))
    expect(screen.getByText('Restore')).toBeInTheDocument()
  })

  it('calls onRestore when Restore button clicked', async () => {
    const user = userEvent.setup()
    const onRestore = vi.fn()
    const milestones = [
      { id: '1', display_name: 'Restorable', source_milestone_type_id: null, deleted_at: new Date().toISOString() },
    ]

    render(
      <ArchivedMilestonesSection milestones={milestones} saving={false} onRestore={onRestore} />
    )

    await user.click(screen.getByText('Archived (1)'))
    await user.click(screen.getByText('Restore'))
    expect(onRestore).toHaveBeenCalledWith(milestones[0])
  })

  it('shows diamond indicator for custom archived milestones', async () => {
    const user = userEvent.setup()
    const milestones = [
      { id: '1', display_name: 'Custom Archived', source_milestone_type_id: null, deleted_at: new Date().toISOString() },
    ]

    const { container } = render(
      <ArchivedMilestonesSection milestones={milestones} saving={false} onRestore={noop} />
    )

    await user.click(screen.getByText('Archived (1)'))
    expect(container.textContent).toContain('\u25C6')
  })

  it('does not show diamond for global archived milestones', async () => {
    const user = userEvent.setup()
    const milestones = [
      { id: '1', display_name: 'Global Archived', source_milestone_type_id: 'global-id', deleted_at: new Date().toISOString() },
    ]

    render(
      <ArchivedMilestonesSection milestones={milestones} saving={false} onRestore={noop} />
    )

    await user.click(screen.getByText('Archived (1)'))
    const row = screen.getByText('Global Archived').closest('div')!
    expect(row.textContent).not.toContain('\u25C6')
  })

  it('shows "Today" for recently archived milestones', async () => {
    const user = userEvent.setup()
    const milestones = [
      { id: '1', display_name: 'Recent', source_milestone_type_id: null, deleted_at: new Date().toISOString() },
    ]

    render(
      <ArchivedMilestonesSection milestones={milestones} saving={false} onRestore={noop} />
    )

    await user.click(screen.getByText('Archived (1)'))
    expect(screen.getByText(/Archived Today/)).toBeInTheDocument()
  })

  it('disables Restore button when saving', async () => {
    const user = userEvent.setup()
    const milestones = [
      { id: '1', display_name: 'Saving', source_milestone_type_id: null, deleted_at: new Date().toISOString() },
    ]

    render(
      <ArchivedMilestonesSection milestones={milestones} saving={true} onRestore={noop} />
    )

    await user.click(screen.getByText('Archived (1)'))
    expect(screen.getByText('Restore').closest('button')).toBeDisabled()
  })
})
