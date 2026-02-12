import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MilestoneCard, { type MilestoneCardData } from '../MilestoneCard'

// ============================================
// HELPERS
// ============================================

function buildCard(overrides: Partial<MilestoneCardData> = {}): MilestoneCardData {
  return {
    milestone: {
      id: 'fm-1',
      name: 'patient_in',
      display_name: 'Patient In',
      display_order: 1,
      pair_with_id: null,
      pair_position: null,
      source_milestone_type_id: null,
    },
    recorded: undefined,
    isPaired: false,
    partner: undefined,
    partnerRecorded: undefined,
    elapsedDisplay: '',
    displayName: 'Patient In',
    isComplete: false,
    isInProgress: false,
    ...overrides,
  }
}

function buildRecordedCard(overrides: Partial<MilestoneCardData> = {}): MilestoneCardData {
  return buildCard({
    recorded: { id: 'cm-1', facility_milestone_id: 'fm-1', recorded_at: '2025-01-15T14:30:00Z' },
    isComplete: true,
    ...overrides,
  })
}

function buildPairedInProgressCard(): MilestoneCardData {
  return buildCard({
    milestone: {
      id: 'fm-anesthesia-start',
      name: 'anesthesia_start',
      display_name: 'Anesthesia',
      display_order: 2,
      pair_with_id: 'fm-anesthesia-end',
      pair_position: 'start',
      source_milestone_type_id: null,
    },
    recorded: { id: 'cm-2', facility_milestone_id: 'fm-anesthesia-start', recorded_at: '2025-01-15T14:00:00Z' },
    isPaired: true,
    partner: {
      id: 'fm-anesthesia-end',
      name: 'anesthesia_end',
      display_name: 'Anesthesia End',
      display_order: 3,
      pair_with_id: 'fm-anesthesia-start',
      pair_position: 'end',
      source_milestone_type_id: null,
    },
    partnerRecorded: undefined,
    elapsedDisplay: '30m 0s',
    displayName: 'Anesthesia',
    isComplete: false,
    isInProgress: true,
  })
}

// ============================================
// TESTS
// ============================================

describe('MilestoneCard', () => {
  const mockOnRecord = vi.fn()
  const mockOnRecordEnd = vi.fn()
  const mockOnUndo = vi.fn()
  const mockOnUndoEnd = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // --------------------------------
  // Not started state
  // --------------------------------

  describe('not started state', () => {
    it('should show Record button when milestone is not started', () => {
      render(
        <MilestoneCard
          card={buildCard()}
          onRecord={mockOnRecord}
          onRecordEnd={mockOnRecordEnd}
          onUndo={mockOnUndo}
          onUndoEnd={mockOnUndoEnd}
        />
      )
      expect(screen.getByText('Record')).toBeInTheDocument()
      expect(screen.getByText('Waiting to record')).toBeInTheDocument()
    })

    it('should call onRecord when Record button is clicked', async () => {
      const user = userEvent.setup()
      render(
        <MilestoneCard
          card={buildCard()}
          onRecord={mockOnRecord}
          onRecordEnd={mockOnRecordEnd}
          onUndo={mockOnUndo}
          onUndoEnd={mockOnUndoEnd}
        />
      )

      await user.click(screen.getByText('Record'))
      expect(mockOnRecord).toHaveBeenCalledTimes(1)
    })
  })

  // --------------------------------
  // Loading / debounce state
  // --------------------------------

  describe('loading state (debounce protection)', () => {
    it('should show Recording... text when loading', () => {
      render(
        <MilestoneCard
          card={buildCard()}
          onRecord={mockOnRecord}
          onRecordEnd={mockOnRecordEnd}
          onUndo={mockOnUndo}
          onUndoEnd={mockOnUndoEnd}
          loading={true}
        />
      )
      expect(screen.getByText('Recording...')).toBeInTheDocument()
    })

    it('should disable Record button when loading', async () => {
      const user = userEvent.setup()
      render(
        <MilestoneCard
          card={buildCard()}
          onRecord={mockOnRecord}
          onRecordEnd={mockOnRecordEnd}
          onUndo={mockOnUndo}
          onUndoEnd={mockOnUndoEnd}
          loading={true}
        />
      )

      await user.click(screen.getByText('Recording...'))
      expect(mockOnRecord).not.toHaveBeenCalled()
    })

    it('should disable undo button when loading on a completed milestone', async () => {
      const user = userEvent.setup()
      render(
        <MilestoneCard
          card={buildRecordedCard()}
          onRecord={mockOnRecord}
          onRecordEnd={mockOnRecordEnd}
          onUndo={mockOnUndo}
          onUndoEnd={mockOnUndoEnd}
          loading={true}
        />
      )

      const undoButton = screen.getByTitle('Undo')
      expect(undoButton).toBeDisabled()
      await user.click(undoButton)
      expect(mockOnUndo).not.toHaveBeenCalled()
    })

    it('should show Completing... text on paired in-progress card when loading', () => {
      render(
        <MilestoneCard
          card={buildPairedInProgressCard()}
          onRecord={mockOnRecord}
          onRecordEnd={mockOnRecordEnd}
          onUndo={mockOnUndo}
          onUndoEnd={mockOnUndoEnd}
          loading={true}
        />
      )
      expect(screen.getByText('Completing...')).toBeInTheDocument()
    })
  })

  // --------------------------------
  // Completed state
  // --------------------------------

  describe('completed state', () => {
    it('should show recorded time for completed milestone', () => {
      render(
        <MilestoneCard
          card={buildRecordedCard()}
          onRecord={mockOnRecord}
          onRecordEnd={mockOnRecordEnd}
          onUndo={mockOnUndo}
          onUndoEnd={mockOnUndoEnd}
          timeZone="UTC"
        />
      )
      expect(screen.getByText('2:30 PM')).toBeInTheDocument()
    })

    it('should display time in facility timezone', () => {
      render(
        <MilestoneCard
          card={buildRecordedCard()}
          onRecord={mockOnRecord}
          onRecordEnd={mockOnRecordEnd}
          onUndo={mockOnUndo}
          onUndoEnd={mockOnUndoEnd}
          timeZone="America/New_York"
        />
      )
      // 14:30 UTC = 9:30 AM EST
      expect(screen.getByText('9:30 AM')).toBeInTheDocument()
    })

    it('should show undo button on completed milestone', () => {
      render(
        <MilestoneCard
          card={buildRecordedCard()}
          onRecord={mockOnRecord}
          onRecordEnd={mockOnRecordEnd}
          onUndo={mockOnUndo}
          onUndoEnd={mockOnUndoEnd}
        />
      )
      expect(screen.getByTitle('Undo')).toBeInTheDocument()
    })

    it('should call onUndo when undo button is clicked', async () => {
      const user = userEvent.setup()
      render(
        <MilestoneCard
          card={buildRecordedCard()}
          onRecord={mockOnRecord}
          onRecordEnd={mockOnRecordEnd}
          onUndo={mockOnUndo}
          onUndoEnd={mockOnUndoEnd}
        />
      )

      await user.click(screen.getByTitle('Undo'))
      expect(mockOnUndo).toHaveBeenCalledTimes(1)
    })
  })

  // --------------------------------
  // Paired in-progress state
  // --------------------------------

  describe('paired in-progress state', () => {
    it('should show Complete button for paired in-progress milestone', () => {
      render(
        <MilestoneCard
          card={buildPairedInProgressCard()}
          onRecord={mockOnRecord}
          onRecordEnd={mockOnRecordEnd}
          onUndo={mockOnUndo}
          onUndoEnd={mockOnUndoEnd}
        />
      )
      expect(screen.getByText('Complete')).toBeInTheDocument()
    })

    it('should call onRecordEnd when Complete is clicked', async () => {
      const user = userEvent.setup()
      render(
        <MilestoneCard
          card={buildPairedInProgressCard()}
          onRecord={mockOnRecord}
          onRecordEnd={mockOnRecordEnd}
          onUndo={mockOnUndo}
          onUndoEnd={mockOnUndoEnd}
        />
      )

      await user.click(screen.getByText('Complete'))
      expect(mockOnRecordEnd).toHaveBeenCalledTimes(1)
    })

    it('should show elapsed time for in-progress paired milestone', () => {
      render(
        <MilestoneCard
          card={buildPairedInProgressCard()}
          onRecord={mockOnRecord}
          onRecordEnd={mockOnRecordEnd}
          onUndo={mockOnUndo}
          onUndoEnd={mockOnUndoEnd}
        />
      )
      expect(screen.getByText('30m 0s')).toBeInTheDocument()
    })

    it('should display start time in facility timezone', () => {
      render(
        <MilestoneCard
          card={buildPairedInProgressCard()}
          onRecord={mockOnRecord}
          onRecordEnd={mockOnRecordEnd}
          onUndo={mockOnUndo}
          onUndoEnd={mockOnUndoEnd}
          timeZone="America/Chicago"
        />
      )
      // 14:00 UTC = 8:00 AM CST
      expect(screen.getByText(/8:00 AM/)).toBeInTheDocument()
    })
  })
})
