// app/block-schedule/__tests__/PageClient-tabs.test.tsx
//
// Simplified integration test for BlockSchedulePage tab switching (Phase 3).
// Tests the core tab switching logic without the full page complexity.
// Tests:
//  - Tab state controls content visibility
//  - Room schedule placeholder renders correctly

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BlockScheduleTabs } from '@/components/block-schedule/BlockScheduleTabs'
import { useState } from 'react'
import { CalendarDays } from 'lucide-react'

// Simplified version of PageClient tab switching logic
function TabSwitchingTestComponent() {
  const [activeTab, setActiveTab] = useState<'surgeon-blocks' | 'room-schedule'>('surgeon-blocks')

  return (
    <div>
      <BlockScheduleTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'surgeon-blocks' ? (
        <div data-testid="surgeon-blocks-content">
          <div data-testid="block-sidebar">Surgeon Filter Sidebar</div>
          <div data-testid="week-calendar">Week Calendar Grid</div>
        </div>
      ) : (
        <div data-testid="room-schedule-placeholder" className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <CalendarDays className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <h2 className="text-lg font-medium text-slate-600 mb-1">Room Schedule</h2>
            <p className="text-sm text-slate-400">
              Daily room assignments with surgeon and staff scheduling
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

describe('BlockSchedulePage - Tab Switching (Phase 3)', () => {
  it('renders tabs and shows surgeon blocks content by default', () => {
    render(<TabSwitchingTestComponent />)

    expect(screen.getByRole('tab', { name: 'Surgeon Blocks' })).toBeDefined()
    expect(screen.getByRole('tab', { name: 'Room Schedule' })).toBeDefined()

    // Surgeon Blocks tab should be active
    const surgeonBlocksTab = screen.getByRole('tab', { name: 'Surgeon Blocks' })
    expect(surgeonBlocksTab.getAttribute('aria-selected')).toBe('true')

    // Surgeon blocks content should be visible
    expect(screen.getByTestId('surgeon-blocks-content')).toBeDefined()
    expect(screen.getByTestId('block-sidebar')).toBeDefined()
    expect(screen.getByTestId('week-calendar')).toBeDefined()

    // Room schedule placeholder should NOT be visible
    expect(screen.queryByTestId('room-schedule-placeholder')).toBeNull()
  })

  it('switches to room schedule placeholder when Room Schedule tab is clicked', async () => {
    const user = userEvent.setup()
    render(<TabSwitchingTestComponent />)

    // Click Room Schedule tab
    const roomScheduleTab = screen.getByRole('tab', { name: 'Room Schedule' })
    await user.click(roomScheduleTab)

    // Room Schedule tab should now be active
    expect(roomScheduleTab.getAttribute('aria-selected')).toBe('true')

    // Room schedule placeholder should be visible
    expect(screen.getByTestId('room-schedule-placeholder')).toBeDefined()
    // The h2 "Room Schedule" should be in the placeholder
    const placeholder = screen.getByTestId('room-schedule-placeholder')
    expect(placeholder.textContent).toContain('Room Schedule')
    expect(placeholder.textContent).toContain('Daily room assignments with surgeon and staff scheduling')

    // Surgeon blocks content should NOT be visible
    expect(screen.queryByTestId('surgeon-blocks-content')).toBeNull()
  })

  it('switches back to surgeon blocks when Surgeon Blocks tab is clicked', async () => {
    const user = userEvent.setup()
    render(<TabSwitchingTestComponent />)

    // Switch to Room Schedule
    await user.click(screen.getByRole('tab', { name: 'Room Schedule' }))
    expect(screen.getByTestId('room-schedule-placeholder')).toBeDefined()

    // Switch back to Surgeon Blocks
    await user.click(screen.getByRole('tab', { name: 'Surgeon Blocks' }))

    // Surgeon Blocks tab should be active again
    const surgeonBlocksTab = screen.getByRole('tab', { name: 'Surgeon Blocks' })
    expect(surgeonBlocksTab.getAttribute('aria-selected')).toBe('true')

    // Surgeon blocks content should be visible again
    expect(screen.getByTestId('surgeon-blocks-content')).toBeDefined()

    // Room schedule placeholder should NOT be visible
    expect(screen.queryByTestId('room-schedule-placeholder')).toBeNull()
  })

  it('maintains correct tab state across multiple switches', async () => {
    const user = userEvent.setup()
    render(<TabSwitchingTestComponent />)

    // Start: Surgeon Blocks active
    expect(screen.getByRole('tab', { name: 'Surgeon Blocks' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tab', { name: 'Room Schedule' }).getAttribute('aria-selected')).toBe('false')

    // Switch to Room Schedule
    await user.click(screen.getByRole('tab', { name: 'Room Schedule' }))
    expect(screen.getByRole('tab', { name: 'Surgeon Blocks' }).getAttribute('aria-selected')).toBe('false')
    expect(screen.getByRole('tab', { name: 'Room Schedule' }).getAttribute('aria-selected')).toBe('true')

    // Switch back to Surgeon Blocks
    await user.click(screen.getByRole('tab', { name: 'Surgeon Blocks' }))
    expect(screen.getByRole('tab', { name: 'Surgeon Blocks' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tab', { name: 'Room Schedule' }).getAttribute('aria-selected')).toBe('false')

    // Switch to Room Schedule again
    await user.click(screen.getByRole('tab', { name: 'Room Schedule' }))
    expect(screen.getByRole('tab', { name: 'Surgeon Blocks' }).getAttribute('aria-selected')).toBe('false')
    expect(screen.getByRole('tab', { name: 'Room Schedule' }).getAttribute('aria-selected')).toBe('true')
  })
})
