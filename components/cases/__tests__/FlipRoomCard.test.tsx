import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FlipRoomCard from '../FlipRoomCard'

// ============================================
// HELPERS
// ============================================

const NOW = new Date('2025-01-15T10:00:00Z').getTime()

function renderCard(overrides: Partial<Parameters<typeof FlipRoomCard>[0]> = {}) {
  const defaultProps = {
    caseNumber: 'CASE-123',
    roomName: 'OR 2',
    procedureName: 'Total Hip Arthroplasty',
    lastMilestoneDisplayName: null as string | null,
    lastMilestoneRecordedAt: null as string | null,
    calledBackAt: null as string | null,
    currentTime: NOW,
    timeZone: 'America/New_York',
    onCallBack: vi.fn(),
    onUndoCallBack: vi.fn(),
    callingBack: false,
    ...overrides,
  }
  return { ...render(<FlipRoomCard {...defaultProps} />), props: defaultProps }
}

// ============================================
// UNIT TESTS: rendering
// ============================================

describe('FlipRoomCard — unit', () => {
  it('should render the header with "Flip Room" title', () => {
    renderCard()
    expect(screen.getByText('Flip Room')).toBeDefined()
  })

  it('should display the room name as a badge', () => {
    renderCard({ roomName: 'OR 2' })
    expect(screen.getByText('OR 2')).toBeDefined()
  })

  it('should display the procedure name', () => {
    renderCard({ procedureName: 'Total Knee Arthroplasty' })
    expect(screen.getByText('Total Knee Arthroplasty')).toBeDefined()
  })

  it('should display the case number', () => {
    renderCard({ caseNumber: 'CASE-456' })
    expect(screen.getByText('CASE-456')).toBeDefined()
  })

  it('should show "Not started" when no milestone is recorded', () => {
    renderCard({ lastMilestoneDisplayName: null })
    expect(screen.getByText('Not started')).toBeDefined()
  })

  it('should show milestone name when a milestone is recorded', () => {
    renderCard({
      lastMilestoneDisplayName: 'Incision',
      lastMilestoneRecordedAt: '2025-01-15T09:30:00Z',
    })
    expect(screen.getByText('Incision')).toBeDefined()
  })

  it('should show elapsed time for recorded milestone', () => {
    // 30 minutes ago
    renderCard({
      lastMilestoneDisplayName: 'Patient In',
      lastMilestoneRecordedAt: '2025-01-15T09:30:00Z',
      currentTime: NOW,
    })
    // formatElapsedMs(30 * 60 * 1000) = "30:00" or similar
    const elapsedEl = screen.getByText(/30/)
    expect(elapsedEl).toBeDefined()
  })

  it('should show "Call Patient Back" button when not called back', () => {
    renderCard({ calledBackAt: null })
    expect(screen.getByText('Call Patient Back')).toBeDefined()
  })

  it('should show "Patient Called" with timestamp when called back', () => {
    renderCard({ calledBackAt: '2025-01-15T09:45:00Z' })
    expect(screen.getByText(/Patient Called/)).toBeDefined()
  })

  it('should show Undo button when called back', () => {
    renderCard({ calledBackAt: '2025-01-15T09:45:00Z' })
    expect(screen.getByText('Undo')).toBeDefined()
  })
})

// ============================================
// INTEGRATION TESTS: interactions
// ============================================

describe('FlipRoomCard — integration', () => {
  it('should call onCallBack when "Call Patient Back" is clicked', async () => {
    const user = userEvent.setup()
    const { props } = renderCard({ calledBackAt: null })
    await user.click(screen.getByText('Call Patient Back'))
    expect(props.onCallBack).toHaveBeenCalledTimes(1)
  })

  it('should call onUndoCallBack when "Undo" is clicked', async () => {
    const user = userEvent.setup()
    const { props } = renderCard({ calledBackAt: '2025-01-15T09:45:00Z' })
    await user.click(screen.getByText('Undo'))
    expect(props.onUndoCallBack).toHaveBeenCalledTimes(1)
  })

  it('should show "Calling..." during loading state', () => {
    renderCard({ callingBack: true, calledBackAt: null })
    expect(screen.getByText('Calling...')).toBeDefined()
  })

  it('should disable call-back button during loading', async () => {
    const user = userEvent.setup()
    const { props } = renderCard({ callingBack: true, calledBackAt: null })
    const button = screen.getByText('Calling...').closest('button')!
    expect(button.disabled).toBe(true)
    await user.click(button)
    expect(props.onCallBack).not.toHaveBeenCalled()
  })

  it('should disable undo button during loading', async () => {
    const user = userEvent.setup()
    const { props } = renderCard({ callingBack: true, calledBackAt: '2025-01-15T09:45:00Z' })
    const undoButton = screen.getByText('Undo')
    expect(undoButton.closest('button')!.disabled).toBe(true)
    await user.click(undoButton)
    expect(props.onUndoCallBack).not.toHaveBeenCalled()
  })

  it('should not show call-back button when called back', () => {
    renderCard({ calledBackAt: '2025-01-15T09:45:00Z' })
    expect(screen.queryByText('Call Patient Back')).toBeNull()
  })

  it('should not show called confirmation when not called back', () => {
    renderCard({ calledBackAt: null })
    expect(screen.queryByText(/Patient Called/)).toBeNull()
    expect(screen.queryByText('Undo')).toBeNull()
  })
})

// ============================================
// WORKFLOW TESTS
// ============================================

describe('FlipRoomCard — workflow', () => {
  it('should display full flip room context: room + procedure + milestone + call-back', () => {
    renderCard({
      caseNumber: 'CASE-789',
      roomName: 'OR 3',
      procedureName: 'Total Knee Arthroplasty',
      lastMilestoneDisplayName: 'Anesthesia Start',
      lastMilestoneRecordedAt: '2025-01-15T09:45:00Z',
      calledBackAt: null,
    })
    expect(screen.getByText('Flip Room')).toBeDefined()
    expect(screen.getByText('OR 3')).toBeDefined()
    expect(screen.getByText('Total Knee Arthroplasty')).toBeDefined()
    expect(screen.getByText('CASE-789')).toBeDefined()
    expect(screen.getByText('Anesthesia Start')).toBeDefined()
    expect(screen.getByText('Call Patient Back')).toBeDefined()
  })

  it('should display called-back state with undo option', () => {
    renderCard({
      caseNumber: 'CASE-789',
      roomName: 'OR 3',
      procedureName: 'Total Knee Arthroplasty',
      lastMilestoneDisplayName: 'Incision',
      lastMilestoneRecordedAt: '2025-01-15T09:00:00Z',
      calledBackAt: '2025-01-15T09:50:00Z',
    })
    expect(screen.getByText('OR 3')).toBeDefined()
    expect(screen.getByText('Incision')).toBeDefined()
    expect(screen.getByText(/Patient Called/)).toBeDefined()
    expect(screen.getByText('Undo')).toBeDefined()
    expect(screen.queryByText('Call Patient Back')).toBeNull()
  })

  it('should display not-started case waiting for flip room', () => {
    renderCard({
      roomName: 'OR 2',
      procedureName: 'Total Hip Arthroplasty',
      lastMilestoneDisplayName: null,
      lastMilestoneRecordedAt: null,
      calledBackAt: null,
    })
    expect(screen.getByText('Not started')).toBeDefined()
    expect(screen.getByText('Call Patient Back')).toBeDefined()
  })
})
