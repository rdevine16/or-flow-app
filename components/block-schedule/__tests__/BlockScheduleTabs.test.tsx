import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BlockScheduleTabs, type BlockScheduleTab } from '../BlockScheduleTabs'

describe('BlockScheduleTabs', () => {
  it('renders both tabs', () => {
    const mockOnTabChange = vi.fn()
    render(<BlockScheduleTabs activeTab="surgeon-blocks" onTabChange={mockOnTabChange} />)

    expect(screen.getByRole('tab', { name: 'Surgeon Blocks' })).toBeDefined()
    expect(screen.getByRole('tab', { name: 'Room Schedule' })).toBeDefined()
  })

  it('marks the active tab with aria-selected=true', () => {
    const mockOnTabChange = vi.fn()
    render(<BlockScheduleTabs activeTab="surgeon-blocks" onTabChange={mockOnTabChange} />)

    const surgeonBlocksTab = screen.getByRole('tab', { name: 'Surgeon Blocks' })
    const roomScheduleTab = screen.getByRole('tab', { name: 'Room Schedule' })

    expect(surgeonBlocksTab.getAttribute('aria-selected')).toBe('true')
    expect(roomScheduleTab.getAttribute('aria-selected')).toBe('false')
  })

  it('applies active styles to the active tab', () => {
    const mockOnTabChange = vi.fn()
    render(<BlockScheduleTabs activeTab="surgeon-blocks" onTabChange={mockOnTabChange} />)

    const surgeonBlocksTab = screen.getByRole('tab', { name: 'Surgeon Blocks' })
    const roomScheduleTab = screen.getByRole('tab', { name: 'Room Schedule' })

    // Active tab should have blue text and blue border
    expect(surgeonBlocksTab.className).toContain('text-blue-600')
    expect(surgeonBlocksTab.className).toContain('border-blue-600')

    // Inactive tab should have slate text and transparent border
    expect(roomScheduleTab.className).toContain('text-slate-500')
    expect(roomScheduleTab.className).toContain('border-transparent')
  })

  it('calls onTabChange when surgeon-blocks tab is clicked', async () => {
    const user = userEvent.setup()
    const mockOnTabChange = vi.fn()
    render(<BlockScheduleTabs activeTab="room-schedule" onTabChange={mockOnTabChange} />)

    const surgeonBlocksTab = screen.getByRole('tab', { name: 'Surgeon Blocks' })
    await user.click(surgeonBlocksTab)

    expect(mockOnTabChange).toHaveBeenCalledOnce()
    expect(mockOnTabChange).toHaveBeenCalledWith('surgeon-blocks')
  })

  it('calls onTabChange when room-schedule tab is clicked', async () => {
    const user = userEvent.setup()
    const mockOnTabChange = vi.fn()
    render(<BlockScheduleTabs activeTab="surgeon-blocks" onTabChange={mockOnTabChange} />)

    const roomScheduleTab = screen.getByRole('tab', { name: 'Room Schedule' })
    await user.click(roomScheduleTab)

    expect(mockOnTabChange).toHaveBeenCalledOnce()
    expect(mockOnTabChange).toHaveBeenCalledWith('room-schedule')
  })

  it('allows clicking the already-active tab (no-op is handled by parent)', async () => {
    const user = userEvent.setup()
    const mockOnTabChange = vi.fn()
    render(<BlockScheduleTabs activeTab="surgeon-blocks" onTabChange={mockOnTabChange} />)

    const surgeonBlocksTab = screen.getByRole('tab', { name: 'Surgeon Blocks' })
    await user.click(surgeonBlocksTab)

    // Should still call the handler — parent decides if it's a no-op
    expect(mockOnTabChange).toHaveBeenCalledOnce()
    expect(mockOnTabChange).toHaveBeenCalledWith('surgeon-blocks')
  })

  it('switches active state when activeTab prop changes', () => {
    const mockOnTabChange = vi.fn()
    const { rerender } = render(
      <BlockScheduleTabs activeTab="surgeon-blocks" onTabChange={mockOnTabChange} />
    )

    let surgeonBlocksTab = screen.getByRole('tab', { name: 'Surgeon Blocks' })
    let roomScheduleTab = screen.getByRole('tab', { name: 'Room Schedule' })

    expect(surgeonBlocksTab.getAttribute('aria-selected')).toBe('true')
    expect(roomScheduleTab.getAttribute('aria-selected')).toBe('false')

    // Change active tab via prop
    rerender(<BlockScheduleTabs activeTab="room-schedule" onTabChange={mockOnTabChange} />)

    surgeonBlocksTab = screen.getByRole('tab', { name: 'Surgeon Blocks' })
    roomScheduleTab = screen.getByRole('tab', { name: 'Room Schedule' })

    expect(surgeonBlocksTab.getAttribute('aria-selected')).toBe('false')
    expect(roomScheduleTab.getAttribute('aria-selected')).toBe('true')
  })

  it('renders with border-b on the container', () => {
    const mockOnTabChange = vi.fn()
    const { container } = render(
      <BlockScheduleTabs activeTab="surgeon-blocks" onTabChange={mockOnTabChange} />
    )

    const tabContainer = container.firstChild as HTMLElement
    expect(tabContainer.className).toContain('border-b')
    expect(tabContainer.className).toContain('border-slate-200')
  })
})
