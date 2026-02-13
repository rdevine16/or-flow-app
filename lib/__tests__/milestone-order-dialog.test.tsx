import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { useConfirmDialog } from '@/components/ui/ConfirmDialog'
import { checkMilestoneOrder, type MilestoneTypeForOrder, type RecordedMilestoneForOrder } from '../milestone-order'

// ============================================
// MOCKS
// ============================================

vi.mock('@/components/ui/Toast/ToastProvider', () => ({
  useToast: () => ({
    showToast: vi.fn(),
    toasts: [],
    dismissToast: vi.fn(),
    dismissAll: vi.fn(),
  }),
}))

vi.mock('@/lib/design-tokens', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/design-tokens')>()
  return {
    ...actual,
  }
})

// ============================================
// TEST WRAPPER — mimics page.tsx recordMilestone + showConfirm interaction
// ============================================

const milestoneTypes: MilestoneTypeForOrder[] = [
  { id: 'fm-patient-in', display_name: 'Patient In', display_order: 0 },
  { id: 'fm-anes-start', display_name: 'Anesthesia Start', display_order: 1 },
  { id: 'fm-incision', display_name: 'Incision', display_order: 2 },
  { id: 'fm-closing', display_name: 'Closing', display_order: 3 },
  { id: 'fm-patient-out', display_name: 'Patient Out', display_order: 4 },
]

interface TestWrapperProps {
  initialMilestones?: RecordedMilestoneForOrder[]
  onRecordComplete: (milestoneTypeId: string) => void
}

function TestOrderWarning({ initialMilestones = [], onRecordComplete }: TestWrapperProps) {
  const [caseMilestones] = useState<RecordedMilestoneForOrder[]>(initialMilestones)
  const { confirmDialog, showConfirm } = useConfirmDialog()

  const recordMilestone = (milestoneTypeId: string) => {
    const { isOutOfOrder, skippedCount } = checkMilestoneOrder(
      milestoneTypeId,
      milestoneTypes,
      caseMilestones,
    )

    if (isOutOfOrder) {
      const milestoneType = milestoneTypes.find(mt => mt.id === milestoneTypeId)
      showConfirm({
        variant: 'warning',
        title: 'Out-of-order milestone',
        message: `You're recording ${milestoneType?.display_name || 'this milestone'} with ${skippedCount} earlier milestone${skippedCount === 1 ? '' : 's'} unrecorded. Continue anyway?`,
        confirmText: 'Record anyway',
        cancelText: 'Cancel',
        onConfirm: () => onRecordComplete(milestoneTypeId),
      })
      return
    }

    onRecordComplete(milestoneTypeId)
  }

  return (
    <div>
      {confirmDialog}
      {milestoneTypes.map(mt => (
        <button key={mt.id} onClick={() => recordMilestone(mt.id)}>
          Record {mt.display_name}
        </button>
      ))}
    </div>
  )
}

// ============================================
// INTEGRATION: Warning dialog appears for out-of-order
// ============================================

describe('Out-of-order warning dialog — integration', () => {
  let onRecordComplete: ReturnType<typeof vi.fn>

  beforeEach(() => {
    onRecordComplete = vi.fn()
  })

  it('should NOT show warning when recording in order', async () => {
    const user = userEvent.setup()
    render(
      <TestOrderWarning
        initialMilestones={[]}
        onRecordComplete={onRecordComplete}
      />
    )

    // Patient In is the first milestone — no predecessors
    await user.click(screen.getByText('Record Patient In'))

    // No dialog shown — callback fires immediately
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(onRecordComplete).toHaveBeenCalledWith('fm-patient-in')
  })

  it('should show warning dialog when recording out of order', async () => {
    const user = userEvent.setup()
    render(
      <TestOrderWarning
        initialMilestones={[]}
        onRecordComplete={onRecordComplete}
      />
    )

    // Incision without Patient In or Anes Start — out of order
    await user.click(screen.getByText('Record Incision'))

    // Dialog should appear
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Out-of-order milestone')).toBeInTheDocument()
    expect(screen.getByText(/You're recording Incision with 2 earlier milestones unrecorded/)).toBeInTheDocument()
    expect(screen.getByText('Record anyway')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()

    // Callback should NOT have fired yet
    expect(onRecordComplete).not.toHaveBeenCalled()
  })

  it('should record milestone when user confirms the override', async () => {
    const user = userEvent.setup()
    render(
      <TestOrderWarning
        initialMilestones={[]}
        onRecordComplete={onRecordComplete}
      />
    )

    // Trigger out-of-order warning
    await user.click(screen.getByText('Record Incision'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    // Click "Record anyway"
    await user.click(screen.getByText('Record anyway'))

    // Callback should fire with the milestone ID
    await waitFor(() => {
      expect(onRecordComplete).toHaveBeenCalledWith('fm-incision')
    })
  })

  it('should NOT record milestone when user cancels', async () => {
    const user = userEvent.setup()
    render(
      <TestOrderWarning
        initialMilestones={[]}
        onRecordComplete={onRecordComplete}
      />
    )

    // Trigger out-of-order warning
    await user.click(screen.getByText('Record Incision'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    // Click "Cancel"
    await user.click(screen.getByText('Cancel'))

    // Dialog should close, callback should NOT fire
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    expect(onRecordComplete).not.toHaveBeenCalled()
  })

  it('should show singular "milestone" for 1 skipped predecessor', async () => {
    const user = userEvent.setup()
    render(
      <TestOrderWarning
        initialMilestones={[
          { facility_milestone_id: 'fm-patient-in', recorded_at: '2025-01-15T08:00:00Z' },
        ]}
        onRecordComplete={onRecordComplete}
      />
    )

    // Incision with patient_in recorded but anes_start missing — 1 skipped
    await user.click(screen.getByText('Record Incision'))

    expect(screen.getByText(/with 1 earlier milestone unrecorded/)).toBeInTheDocument()
  })

  it('should show correct count when skipping to patient_out', async () => {
    const user = userEvent.setup()
    render(
      <TestOrderWarning
        initialMilestones={[]}
        onRecordComplete={onRecordComplete}
      />
    )

    // Patient Out with nothing recorded — 4 skipped
    await user.click(screen.getByText('Record Patient Out'))

    expect(screen.getByText(/with 4 earlier milestones unrecorded/)).toBeInTheDocument()
  })

  it('should use warning variant (amber) for the dialog', async () => {
    const user = userEvent.setup()
    render(
      <TestOrderWarning
        initialMilestones={[]}
        onRecordComplete={onRecordComplete}
      />
    )

    await user.click(screen.getByText('Record Incision'))

    // Warning variant uses amber icon background
    const dialog = screen.getByRole('dialog')
    const iconContainer = dialog.querySelector('.bg-amber-100')
    expect(iconContainer).toBeInTheDocument()
  })
})

// ============================================
// WORKFLOW: Full recording sequence with warnings
// ============================================

describe('Out-of-order warning dialog — workflow', () => {
  it('should allow normal flow when milestones are recorded in order', async () => {
    const user = userEvent.setup()
    const onRecordComplete = vi.fn()
    render(
      <TestOrderWarning
        initialMilestones={[
          { facility_milestone_id: 'fm-patient-in', recorded_at: '2025-01-15T08:00:00Z' },
          { facility_milestone_id: 'fm-anes-start', recorded_at: '2025-01-15T08:05:00Z' },
        ]}
        onRecordComplete={onRecordComplete}
      />
    )

    // Incision is next in order — no warning
    await user.click(screen.getByText('Record Incision'))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(onRecordComplete).toHaveBeenCalledWith('fm-incision')
  })

  it('should warn then allow override then record for out-of-order sequence', async () => {
    const user = userEvent.setup()
    const onRecordComplete = vi.fn()
    render(
      <TestOrderWarning
        initialMilestones={[
          { facility_milestone_id: 'fm-patient-in', recorded_at: '2025-01-15T08:00:00Z' },
        ]}
        onRecordComplete={onRecordComplete}
      />
    )

    // Step 1: Try to record closing (skipping anes_start and incision)
    await user.click(screen.getByText('Record Closing'))

    // Step 2: Warning appears with count 2
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/with 2 earlier milestones unrecorded/)).toBeInTheDocument()
    expect(onRecordComplete).not.toHaveBeenCalled()

    // Step 3: User overrides
    await user.click(screen.getByText('Record anyway'))

    // Step 4: Milestone records
    await waitFor(() => {
      expect(onRecordComplete).toHaveBeenCalledWith('fm-closing')
    })
  })

  it('should handle cancel then re-attempt as separate interactions', async () => {
    const user = userEvent.setup()
    const onRecordComplete = vi.fn()
    render(
      <TestOrderWarning
        initialMilestones={[]}
        onRecordComplete={onRecordComplete}
      />
    )

    // Attempt 1: Try incision, get warning, cancel
    await user.click(screen.getByText('Record Incision'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await user.click(screen.getByText('Cancel'))
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    expect(onRecordComplete).not.toHaveBeenCalled()

    // Attempt 2: Try incision again, get warning, override
    await user.click(screen.getByText('Record Incision'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await user.click(screen.getByText('Record anyway'))

    await waitFor(() => {
      expect(onRecordComplete).toHaveBeenCalledWith('fm-incision')
    })
  })
})
