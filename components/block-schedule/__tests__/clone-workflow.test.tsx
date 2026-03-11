// components/block-schedule/__tests__/clone-workflow.test.tsx
// Workflow tests for Phase 8: Clone Day / Clone Week functionality
//
// Tests the complete user workflow:
// 1. User views room schedule grid with assignments
// 2. User clicks "Clone previous week" → sees confirm dialog → confirms → data is cloned
// 3. User clicks day "Clone" link → sees confirm dialog → confirms → data is cloned
// 4. User verifies cloned data appears in grid after refresh

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DndContext } from '@dnd-kit/core'
import { RoomScheduleGrid } from '../RoomScheduleGrid'
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/ConfirmDialog'
import type { RoomDateAssignment, RoomDateStaff } from '@/types/room-scheduling'
import { useState } from 'react'

// Mock hooks
vi.mock('@/hooks/useLookups', () => ({
  useRooms: vi.fn(),
}))

import { useRooms } from '@/hooks/useLookups'

// Simulated page component that combines RoomScheduleGrid + ConfirmDialog
// (mirrors how PageClient wires up clone functionality in Phase 8)
function RoomSchedulePageSimulator({
  onCloneWeekExecute,
  onCloneDayExecute,
}: {
  onCloneWeekExecute: (sourceWeekStart: string, targetWeekStart: string) => Promise<boolean>
  onCloneDayExecute: (sourceDate: string, targetDate: string) => Promise<boolean>
}) {
  const { confirmDialog, showConfirm } = useConfirmDialog()
  const [refreshCounter, setRefreshCounter] = useState(0)

  const handleCloneWeek = (sourceWeekStart: string, targetWeekStart: string) => {
    showConfirm({
      variant: 'warning',
      title: 'Clone previous week?',
      message: 'This will replace all assignments for the current week with assignments from the previous week.',
      confirmText: 'Clone week',
      onConfirm: async () => {
        const success = await onCloneWeekExecute(sourceWeekStart, targetWeekStart)
        if (success) {
          setRefreshCounter((c) => c + 1)
        }
      },
    })
  }

  const handleCloneDay = (sourceDate: string, targetDate: string) => {
    const dayName = new Date(targetDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' })
    showConfirm({
      variant: 'warning',
      title: `Clone previous ${dayName}?`,
      message: `This will replace all assignments for ${dayName} with assignments from the previous ${dayName}.`,
      confirmText: 'Clone day',
      onConfirm: async () => {
        const success = await onCloneDayExecute(sourceDate, targetDate)
        if (success) {
          setRefreshCounter((c) => c + 1)
        }
      },
    })
  }

  return (
    <DndContext>
      <RoomScheduleGrid
        facilityId="fac-1"
        currentWeekStart={new Date(2026, 2, 9)} // March 9, 2026 (Sunday)
        onWeekChange={vi.fn()}
        assignments={[]}
        staffAssignments={[]}
        assignmentsLoading={false}
        assignmentsError={null}
        onCloneWeek={handleCloneWeek}
        onCloneDay={handleCloneDay}
      />
      {confirmDialog}
      <div data-testid="refresh-counter">{refreshCounter}</div>
    </DndContext>
  )
}

describe('Clone Workflow Tests (Phase 8)', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(useRooms).mockReturnValue({
      data: [
        { id: 'room-1', name: 'OR 1' },
        { id: 'room-2', name: 'OR 2' },
      ],
      loading: false,
      error: null,
      refresh: vi.fn(),
    })
  })

  describe('Workflow: Clone week', () => {
    it('full workflow: click clone week → confirm → hook executes → refresh triggered', async () => {
      const user = userEvent.setup()
      const mockCloneWeek = vi.fn().mockResolvedValue(true)

      render(<RoomSchedulePageSimulator onCloneWeekExecute={mockCloneWeek} onCloneDayExecute={vi.fn()} />)

      // Step 1: User views grid
      expect(screen.getByText('OR 1')).toBeDefined()
      expect(screen.getByText('OR 2')).toBeDefined()

      // Step 2: User clicks "Clone previous week"
      const cloneWeekButton = screen.getByRole('button', { name: /Clone previous week/i })
      await user.click(cloneWeekButton)

      // Step 3: Confirm dialog appears
      await waitFor(() => {
        expect(screen.getByText('Clone previous week?')).toBeDefined()
        expect(
          screen.getByText(
            'This will replace all assignments for the current week with assignments from the previous week.'
          )
        ).toBeDefined()
      })

      // Step 4: User confirms
      const confirmButton = screen.getByRole('button', { name: /Clone week/i })
      await user.click(confirmButton)

      // Step 5: Hook is called with correct dates
      await waitFor(() => {
        expect(mockCloneWeek).toHaveBeenCalledOnce()
        expect(mockCloneWeek).toHaveBeenCalledWith('2026-03-02', '2026-03-09')
      })

      // Step 6: Refresh is triggered (simulated by counter increment)
      await waitFor(() => {
        expect(screen.getByTestId('refresh-counter').textContent).toBe('1')
      })
    })

    it('workflow: click clone week → cancel → hook NOT executed', async () => {
      const user = userEvent.setup()
      const mockCloneWeek = vi.fn().mockResolvedValue(true)

      render(<RoomSchedulePageSimulator onCloneWeekExecute={mockCloneWeek} onCloneDayExecute={vi.fn()} />)

      // User clicks clone week
      const cloneWeekButton = screen.getByRole('button', { name: /Clone previous week/i })
      await user.click(cloneWeekButton)

      // Confirm dialog appears
      await waitFor(() => {
        expect(screen.getByText('Clone previous week?')).toBeDefined()
      })

      // User cancels
      const cancelButton = screen.getByRole('button', { name: /Cancel/i })
      await user.click(cancelButton)

      // Hook is NOT called
      expect(mockCloneWeek).not.toHaveBeenCalled()

      // Refresh counter stays at 0
      expect(screen.getByTestId('refresh-counter').textContent).toBe('0')
    })

    it('workflow: clone fails → refresh NOT triggered', async () => {
      const user = userEvent.setup()
      const mockCloneWeek = vi.fn().mockResolvedValue(false) // Clone fails

      render(<RoomSchedulePageSimulator onCloneWeekExecute={mockCloneWeek} onCloneDayExecute={vi.fn()} />)

      // Click and confirm
      await user.click(screen.getByRole('button', { name: /Clone previous week/i }))
      await waitFor(() => screen.getByRole('button', { name: /Clone week/i }))
      await user.click(screen.getByRole('button', { name: /Clone week/i }))

      // Hook called but returned false
      await waitFor(() => {
        expect(mockCloneWeek).toHaveBeenCalledOnce()
      })

      // Refresh NOT triggered (counter stays 0)
      await new Promise((resolve) => setTimeout(resolve, 100))
      expect(screen.getByTestId('refresh-counter').textContent).toBe('0')
    })
  })

  describe('Workflow: Clone day', () => {
    it('integration: click clone day triggers dialog, confirming calls hook with correct dates', async () => {
      const user = userEvent.setup()
      const mockCloneDay = vi.fn().mockResolvedValue(true)

      render(<RoomSchedulePageSimulator onCloneWeekExecute={vi.fn()} onCloneDayExecute={mockCloneDay} />)

      // Step 1: User views grid
      expect(screen.getByText('Sun')).toBeDefined()

      // Step 2: User clicks first day clone link (Sunday)
      const cloneDayLinks = screen.getAllByRole('button', { name: /Clone/i }).filter((btn) => {
        return btn.textContent === 'Clone'
      })
      expect(cloneDayLinks.length).toBe(7)

      await user.click(cloneDayLinks[0]) // Sunday

      // Step 3: Dialog is triggered - wait for confirm button with flexible timing
      const confirmButton = await screen.findByRole('button', { name: /Clone day/i }, { timeout: 2000 })

      // Step 4: User confirms
      await user.click(confirmButton)

      // Step 5: Hook is called with correct dates for Sunday
      await waitFor(() => {
        expect(mockCloneDay).toHaveBeenCalledOnce()
        expect(mockCloneDay).toHaveBeenCalledWith('2026-03-02', '2026-03-09') // Previous Sun → Current Sun
      })

      // Step 6: Refresh is triggered
      await waitFor(() => {
        expect(screen.getByTestId('refresh-counter').textContent).toBe('1')
      })
    })
  })

  describe('Workflow: Combined clone operations', () => {
    it('user can clone week, then clone individual day in same session', async () => {
      const user = userEvent.setup()
      const mockCloneWeek = vi.fn().mockResolvedValue(true)
      const mockCloneDay = vi.fn().mockResolvedValue(true)

      render(<RoomSchedulePageSimulator onCloneWeekExecute={mockCloneWeek} onCloneDayExecute={mockCloneDay} />)

      // Clone week
      await user.click(screen.getByRole('button', { name: /Clone previous week/i }))
      await waitFor(() => screen.getByRole('button', { name: /Clone week/i }))
      await user.click(screen.getByRole('button', { name: /Clone week/i }))

      await waitFor(() => {
        expect(mockCloneWeek).toHaveBeenCalledOnce()
      })

      // Refresh counter = 1
      await waitFor(() => {
        expect(screen.getByTestId('refresh-counter').textContent).toBe('1')
      })

      // Now clone a day
      const cloneDayLinks = screen.getAllByRole('button', { name: /Clone/i }).filter((btn) => {
        return btn.textContent === 'Clone'
      })
      await user.click(cloneDayLinks[2]) // Tuesday

      await waitFor(() => screen.getByRole('button', { name: /Clone day/i }))
      await user.click(screen.getByRole('button', { name: /Clone day/i }))

      await waitFor(() => {
        expect(mockCloneDay).toHaveBeenCalledOnce()
      })

      // Refresh counter = 2
      await waitFor(() => {
        expect(screen.getByTestId('refresh-counter').textContent).toBe('2')
      })
    })
  })

  describe('ORbit Domain: Trigger Chain Awareness', () => {
    it('clone operation triggers data refresh to show updated assignments', async () => {
      const user = userEvent.setup()
      let cloneCallCount = 0
      const mockCloneWeek = vi.fn().mockImplementation(() => {
        cloneCallCount++
        return Promise.resolve(true)
      })

      render(<RoomSchedulePageSimulator onCloneWeekExecute={mockCloneWeek} onCloneDayExecute={vi.fn()} />)

      // Clone week
      await user.click(screen.getByRole('button', { name: /Clone previous week/i }))
      await waitFor(() => screen.getByRole('button', { name: /Clone week/i }))
      await user.click(screen.getByRole('button', { name: /Clone week/i }))

      // Verify clone was called
      await waitFor(() => {
        expect(cloneCallCount).toBe(1)
      })

      // Verify refresh was triggered (counter incremented)
      // In real PageClient, this would call fetchWeek() to reload assignments
      await waitFor(() => {
        expect(screen.getByTestId('refresh-counter').textContent).toBe('1')
      })
    })
  })
})
