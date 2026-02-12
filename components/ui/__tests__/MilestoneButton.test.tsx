import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MilestoneButton, { PairedMilestoneButton } from '../MilestoneButton'

// ============================================
// MilestoneButton (single milestone)
// ============================================

describe('MilestoneButton', () => {
  const mockOnRecord = vi.fn()
  const mockOnUndo = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // --------------------------------
  // Unrecorded state
  // --------------------------------

  describe('unrecorded state', () => {
    it('should show Tap to record when not recorded', () => {
      render(
        <MilestoneButton
          displayName="Patient In"
          onRecord={mockOnRecord}
          onUndo={mockOnUndo}
        />
      )
      expect(screen.getByText('Tap to record')).toBeInTheDocument()
      expect(screen.getByText('Patient In')).toBeInTheDocument()
    })

    it('should call onRecord when clicked', async () => {
      const user = userEvent.setup()
      render(
        <MilestoneButton
          displayName="Patient In"
          onRecord={mockOnRecord}
          onUndo={mockOnUndo}
        />
      )

      await user.click(screen.getByText('Tap to record'))
      expect(mockOnRecord).toHaveBeenCalledTimes(1)
    })

    it('should not call onRecord when disabled', async () => {
      const user = userEvent.setup()
      render(
        <MilestoneButton
          displayName="Patient In"
          onRecord={mockOnRecord}
          onUndo={mockOnUndo}
          disabled={true}
        />
      )

      await user.click(screen.getByText('Tap to record'))
      expect(mockOnRecord).not.toHaveBeenCalled()
    })
  })

  // --------------------------------
  // Loading state (debounce)
  // --------------------------------

  describe('loading state', () => {
    it('should show Recording... when loading', () => {
      render(
        <MilestoneButton
          displayName="Patient In"
          onRecord={mockOnRecord}
          onUndo={mockOnUndo}
          loading={true}
        />
      )
      expect(screen.getByText('Recording...')).toBeInTheDocument()
    })

    it('should not call onRecord when loading', async () => {
      const user = userEvent.setup()
      render(
        <MilestoneButton
          displayName="Patient In"
          onRecord={mockOnRecord}
          onUndo={mockOnUndo}
          loading={true}
        />
      )

      await user.click(screen.getByText('Recording...'))
      expect(mockOnRecord).not.toHaveBeenCalled()
    })
  })

  // --------------------------------
  // Recorded state with timezone
  // --------------------------------

  describe('recorded state', () => {
    it('should display time using shared formatTimestamp in UTC', () => {
      render(
        <MilestoneButton
          displayName="Patient In"
          recordedAt="2025-01-15T14:30:00Z"
          onRecord={mockOnRecord}
          onUndo={mockOnUndo}
          timeZone="UTC"
        />
      )
      expect(screen.getByText('2:30 PM')).toBeInTheDocument()
    })

    it('should display time in facility timezone (America/New_York)', () => {
      render(
        <MilestoneButton
          displayName="Patient In"
          recordedAt="2025-01-15T14:30:00Z"
          onRecord={mockOnRecord}
          onUndo={mockOnUndo}
          timeZone="America/New_York"
        />
      )
      // 14:30 UTC = 9:30 AM EST
      expect(screen.getByText('9:30 AM')).toBeInTheDocument()
    })

    it('should disable undo button when loading', async () => {
      const user = userEvent.setup()
      render(
        <MilestoneButton
          displayName="Patient In"
          recordedAt="2025-01-15T14:30:00Z"
          onRecord={mockOnRecord}
          onUndo={mockOnUndo}
          loading={true}
        />
      )

      // The undo X button should be disabled
      const buttons = screen.getAllByRole('button')
      const undoButton = buttons.find(b => b.querySelector('svg'))
      expect(undoButton).toBeDisabled()
    })
  })
})

// ============================================
// PairedMilestoneButton
// ============================================

describe('PairedMilestoneButton', () => {
  const mockOnRecordStart = vi.fn()
  const mockOnRecordEnd = vi.fn()
  const mockOnUndoStart = vi.fn()
  const mockOnUndoEnd = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('pending state', () => {
    it('should show Tap to start', () => {
      render(
        <PairedMilestoneButton
          displayName="Anesthesia"
          onRecordStart={mockOnRecordStart}
          onRecordEnd={mockOnRecordEnd}
          onUndoStart={mockOnUndoStart}
          onUndoEnd={mockOnUndoEnd}
        />
      )
      expect(screen.getByText('Tap to start')).toBeInTheDocument()
    })

    it('should show Recording... when loading', () => {
      render(
        <PairedMilestoneButton
          displayName="Anesthesia"
          onRecordStart={mockOnRecordStart}
          onRecordEnd={mockOnRecordEnd}
          onUndoStart={mockOnUndoStart}
          onUndoEnd={mockOnUndoEnd}
          loading={true}
        />
      )
      expect(screen.getByText('Recording...')).toBeInTheDocument()
    })
  })

  describe('running state', () => {
    it('should show Stop button and start time in facility timezone', () => {
      render(
        <PairedMilestoneButton
          displayName="Anesthesia"
          startRecordedAt="2025-01-15T14:00:00Z"
          onRecordStart={mockOnRecordStart}
          onRecordEnd={mockOnRecordEnd}
          onUndoStart={mockOnUndoStart}
          onUndoEnd={mockOnUndoEnd}
          timeZone="America/Chicago"
        />
      )
      expect(screen.getByText('Stop')).toBeInTheDocument()
      // 14:00 UTC = 8:00 AM CST
      expect(screen.getByText('8:00 AM')).toBeInTheDocument()
    })

    it('should show Stopping... when loading during running state', () => {
      render(
        <PairedMilestoneButton
          displayName="Anesthesia"
          startRecordedAt="2025-01-15T14:00:00Z"
          onRecordStart={mockOnRecordStart}
          onRecordEnd={mockOnRecordEnd}
          onUndoStart={mockOnUndoStart}
          onUndoEnd={mockOnUndoEnd}
          loading={true}
        />
      )
      expect(screen.getByText('Stopping...')).toBeInTheDocument()
    })
  })

  describe('complete state', () => {
    it('should show both times in facility timezone', () => {
      render(
        <PairedMilestoneButton
          displayName="Anesthesia"
          startRecordedAt="2025-01-15T14:00:00Z"
          endRecordedAt="2025-01-15T14:45:00Z"
          onRecordStart={mockOnRecordStart}
          onRecordEnd={mockOnRecordEnd}
          onUndoStart={mockOnUndoStart}
          onUndoEnd={mockOnUndoEnd}
          timeZone="America/New_York"
        />
      )
      // 14:00 UTC = 9:00 AM EST, 14:45 UTC = 9:45 AM EST
      expect(screen.getByText('9:00 AM')).toBeInTheDocument()
      expect(screen.getByText('9:45 AM')).toBeInTheDocument()
      // Duration: 45 minutes
      expect(screen.getByText('45m')).toBeInTheDocument()
    })
  })
})
