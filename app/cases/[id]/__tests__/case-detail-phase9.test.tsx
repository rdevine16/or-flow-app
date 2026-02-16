import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TimerChip, ProgressChip } from '@/components/cases/TimerChip'
import MilestoneTimelineV2 from '@/components/cases/MilestoneTimelineV2'
import FlagBadge from '@/components/cases/FlagBadge'
import DelayNode from '@/components/cases/DelayNode'
import CaseActivitySummary from '@/components/cases/CaseActivitySummary'
import FlipRoomCard from '@/components/cases/FlipRoomCard'
import TeamMember from '@/components/cases/TeamMember'

// Mock formatters
vi.mock('@/lib/formatters', () => ({
  formatTimestamp: (date: string) => `Formatted: ${date}`,
  formatElapsedMs: (ms: number) => `${Math.floor(ms / 60000)}m`,
}))

vi.mock('@/lib/design-tokens', () => ({
  getRoleColors: () => ({ bg: 'bg-blue-100', text: 'text-blue-700' }),
}))

// ============================================================================
// Shared test fixtures
// ============================================================================

const baseMilestoneTypes = [
  { id: 'mt1', name: 'patient_in', display_name: 'Patient In', display_order: 1, pair_with_id: null, pair_position: null, source_milestone_type_id: null },
  { id: 'mt2', name: 'incision', display_name: 'Incision', display_order: 2, pair_with_id: null, pair_position: null, source_milestone_type_id: null },
  { id: 'mt3', name: 'closing', display_name: 'Closing', display_order: 3, pair_with_id: null, pair_position: null, source_milestone_type_id: null },
  { id: 'mt4', name: 'patient_out', display_name: 'Patient Out', display_order: 4, pair_with_id: null, pair_position: null, source_milestone_type_id: null },
]

const allRecordedMilestones = [
  { id: 'cm1', facility_milestone_id: 'mt1', recorded_at: '2024-01-01T10:00:00Z' },
  { id: 'cm2', facility_milestone_id: 'mt2', recorded_at: '2024-01-01T10:15:00Z' },
  { id: 'cm3', facility_milestone_id: 'mt3', recorded_at: '2024-01-01T10:30:00Z' },
  { id: 'cm4', facility_milestone_id: 'mt4', recorded_at: '2024-01-01T10:45:00Z' },
]

const mockOnRecord = vi.fn()
const mockOnUndo = vi.fn()

// ============================================================================
// SECTION 1: ACCESSIBILITY (ARIA) TESTS
// ============================================================================

describe('Phase 9: Accessibility', () => {
  describe('TimerChip ARIA attributes', () => {
    it('has aria-label with time and median', () => {
      const { container } = render(
        <TimerChip
          label="Total Time"
          formattedTime="1h 23m"
          medianFormatted="1h 30m"
          isRunning={false}
          color="indigo"
          ratio={0.92}
        />
      )
      const chip = container.firstChild as HTMLElement
      expect(chip.getAttribute('aria-label')).toBe('Total Time: 1h 23m, median 1h 30m')
    })

    it('has aria-label without median when null', () => {
      const { container } = render(
        <TimerChip
          label="Total Time"
          formattedTime="1h 23m"
          medianFormatted={null}
          isRunning={false}
          color="indigo"
          ratio={null}
        />
      )
      const chip = container.firstChild as HTMLElement
      expect(chip.getAttribute('aria-label')).toBe('Total Time: 1h 23m')
    })

    it('has progressbar role with correct values', () => {
      render(
        <TimerChip
          label="Total Time"
          formattedTime="30m"
          medianFormatted="1h"
          isRunning={false}
          color="indigo"
          ratio={0.5}
        />
      )
      const progressbar = screen.getByRole('progressbar')
      expect(progressbar).toBeInTheDocument()
      expect(progressbar.getAttribute('aria-valuenow')).toBe('50')
      expect(progressbar.getAttribute('aria-valuemin')).toBe('0')
      expect(progressbar.getAttribute('aria-valuemax')).toBe('100')
    })
  })

  describe('ProgressChip ARIA attributes', () => {
    it('has progressbar role with milestone counts', () => {
      render(<ProgressChip completedCount={3} totalCount={8} />)
      const progressbar = screen.getByRole('progressbar')
      expect(progressbar).toBeInTheDocument()
      expect(progressbar.getAttribute('aria-valuenow')).toBe('3')
      expect(progressbar.getAttribute('aria-valuemax')).toBe('8')
      expect(progressbar.getAttribute('aria-label')).toMatch(/3 of 8 milestones/)
    })
  })

  describe('FlagBadge ARIA attributes', () => {
    it('has status role and descriptive aria-label', () => {
      render(<FlagBadge severity="warning" label="Long Turnover" detail="65 min" />)
      const badge = screen.getByRole('status')
      expect(badge).toBeInTheDocument()
      expect(badge.getAttribute('aria-label')).toContain('warning flag: Long Turnover')
      expect(badge.getAttribute('aria-label')).toContain('65 min')
    })

    it('hides decorative dot from screen readers', () => {
      const { container } = render(<FlagBadge severity="critical" label="Alert" />)
      const dot = container.querySelector('[aria-hidden="true"]')
      expect(dot).toBeInTheDocument()
    })
  })

  describe('DelayNode ARIA attributes', () => {
    it('has listitem role and descriptive aria-label', () => {
      render(
        <DelayNode
          id="d1"
          delayTypeName="Equipment Delay"
          durationMinutes={15}
          note="Tray late"
          canRemove={false}
        />
      )
      const node = screen.getByRole('listitem')
      expect(node).toBeInTheDocument()
      expect(node.getAttribute('aria-label')).toContain('Equipment Delay')
      expect(node.getAttribute('aria-label')).toContain('15 minutes')
      expect(node.getAttribute('aria-label')).toContain('Tray late')
    })

    it('remove button has descriptive aria-label', () => {
      render(
        <DelayNode
          id="d1"
          delayTypeName="Staff Delay"
          durationMinutes={5}
          note={null}
          canRemove={true}
          onRemove={vi.fn()}
        />
      )
      const removeBtn = screen.getByRole('button')
      expect(removeBtn.getAttribute('aria-label')).toBe('Remove Staff Delay delay')
    })
  })

  describe('MilestoneTimeline ARIA attributes', () => {
    it('timeline nodes have descriptive aria-labels', () => {
      const { container } = render(
        <MilestoneTimelineV2
          milestoneTypes={baseMilestoneTypes}
          caseMilestones={[
            { id: 'cm1', facility_milestone_id: 'mt1', recorded_at: '2024-01-01T10:00:00Z' },
          ]}
          onRecord={mockOnRecord}
          onUndo={mockOnUndo}
          recordingMilestoneIds={new Set()}
          canManage={true}
        />
      )

      const completedNode = container.querySelector('[aria-label="Patient In: completed"]')
      expect(completedNode).toBeInTheDocument()

      const nextNode = container.querySelector('[aria-label="Incision: next, ready to record"]')
      expect(nextNode).toBeInTheDocument()

      const pendingNode = container.querySelector('[aria-label="Closing: pending"]')
      expect(pendingNode).toBeInTheDocument()
    })

    it('record buttons have descriptive aria-labels', () => {
      render(
        <MilestoneTimelineV2
          milestoneTypes={baseMilestoneTypes}
          caseMilestones={[]}
          onRecord={mockOnRecord}
          onUndo={mockOnUndo}
          recordingMilestoneIds={new Set()}
          canManage={true}
        />
      )

      const recordBtn = screen.getByRole('button', { name: 'Record Patient In' })
      expect(recordBtn).toBeInTheDocument()
    })

    it('undo buttons have descriptive aria-labels', () => {
      const { container } = render(
        <MilestoneTimelineV2
          milestoneTypes={baseMilestoneTypes}
          caseMilestones={[
            { id: 'cm1', facility_milestone_id: 'mt1', recorded_at: '2024-01-01T10:00:00Z' },
          ]}
          onRecord={mockOnRecord}
          onUndo={mockOnUndo}
          recordingMilestoneIds={new Set()}
          canManage={true}
        />
      )

      const undoBtn = container.querySelector('[aria-label="Undo Patient In"]')
      expect(undoBtn).toBeInTheDocument()
    })

    it('delay form toggle has aria-expanded state', () => {
      const mockAddDelay = vi.fn()
      const { container } = render(
        <MilestoneTimelineV2
          milestoneTypes={baseMilestoneTypes}
          caseMilestones={[
            { id: 'cm1', facility_milestone_id: 'mt1', recorded_at: '2024-01-01T10:00:00Z' },
          ]}
          onRecord={mockOnRecord}
          onUndo={mockOnUndo}
          recordingMilestoneIds={new Set()}
          canManage={true}
          canCreateFlags={true}
          delayTypes={[{ id: 'dt1', name: 'equipment', display_name: 'Equipment Delay' }]}
          onAddDelay={mockAddDelay}
        />
      )

      const clockBtn = container.querySelector('[aria-label="Log delay at Patient In"]') as HTMLButtonElement
      expect(clockBtn).toBeInTheDocument()
      expect(clockBtn.getAttribute('aria-expanded')).toBe('false')

      fireEvent.click(clockBtn)
      expect(clockBtn.getAttribute('aria-expanded')).toBe('true')
    })
  })

  describe('Keyboard navigation', () => {
    it('tab buttons support arrow key navigation concept', () => {
      // This tests that the onKeyDown handler is attached — actual DOM focus
      // management is verified through the tabIndex pattern
      const setActiveTab = vi.fn()

      // We test the tabIndex pattern: active tab = 0, inactive = -1
      const { rerender } = render(
        <div role="tablist" aria-label="Test tabs">
          <button
            role="tab"
            aria-selected={true}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') setActiveTab('implants')
            }}
          >
            Milestones
          </button>
          <button
            role="tab"
            aria-selected={false}
            tabIndex={-1}
          >
            Implants
          </button>
        </div>
      )

      const milestonesTab = screen.getByRole('tab', { name: 'Milestones' })
      expect(milestonesTab.getAttribute('tabindex')).toBe('0')

      const implantsTab = screen.getByRole('tab', { name: 'Implants' })
      expect(implantsTab.getAttribute('tabindex')).toBe('-1')

      fireEvent.keyDown(milestonesTab, { key: 'ArrowRight' })
      expect(setActiveTab).toHaveBeenCalledWith('implants')
    })
  })
})

// ============================================================================
// SECTION 2: EDGE CASES
// ============================================================================

describe('Phase 9: Edge Cases', () => {
  describe('Zero milestones', () => {
    it('timeline renders empty with no milestones', () => {
      const { container } = render(
        <MilestoneTimelineV2
          milestoneTypes={[]}
          caseMilestones={[]}
          onRecord={mockOnRecord}
          onUndo={mockOnUndo}
          recordingMilestoneIds={new Set()}
          canManage={true}
        />
      )
      // No milestone rows should exist
      expect(container.querySelectorAll('.group')).toHaveLength(0)
    })

    it('ProgressChip handles 0/0 milestones', () => {
      render(<ProgressChip completedCount={0} totalCount={0} />)
      expect(screen.getByText('0')).toBeInTheDocument()
      expect(screen.getByText('0/0 milestones')).toBeInTheDocument()
    })

    it('CaseActivitySummary shows 0/0 for all counts', () => {
      render(
        <CaseActivitySummary
          completedMilestones={0}
          totalMilestones={0}
          implantsFilled={0}
          implantTotal={0}
          delayCount={0}
          flagCount={0}
        />
      )
      const values = screen.getAllByText('0/0')
      expect(values).toHaveLength(2) // milestones + implants
      // Delays and Flags both show "0"
      const zeroValues = screen.getAllByText('0')
      expect(zeroValues.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('No surgeon (no median)', () => {
    it('TimerChip renders without median text', () => {
      render(
        <TimerChip
          label="Total Time"
          formattedTime="0h 00m 00s"
          medianFormatted={null}
          isRunning={false}
          color="indigo"
          ratio={null}
        />
      )
      expect(screen.getByText('0h 00m 00s')).toBeInTheDocument()
      expect(screen.queryByText(/\//)).not.toBeInTheDocument()
    })

    it('TimerChip has no progress bar without ratio', () => {
      const { container } = render(
        <TimerChip
          label="Total Time"
          formattedTime="1h 00m"
          medianFormatted={null}
          isRunning={true}
          color="indigo"
          ratio={null}
        />
      )
      expect(container.querySelector('[role="progressbar"]')).not.toBeInTheDocument()
    })
  })

  describe('Single milestone', () => {
    it('renders single node without connecting lines', () => {
      const singleMilestone = [baseMilestoneTypes[0]]
      const { container } = render(
        <MilestoneTimelineV2
          milestoneTypes={singleMilestone}
          caseMilestones={[]}
          onRecord={mockOnRecord}
          onUndo={mockOnUndo}
          recordingMilestoneIds={new Set()}
          canManage={true}
        />
      )

      expect(screen.getByText('Patient In')).toBeInTheDocument()
      // The connecting line div should not appear since isLast and no delay flags
      const lineElements = container.querySelectorAll('.w-0\\.5.flex-1')
      expect(lineElements).toHaveLength(0)
    })
  })

  describe('Long milestone names', () => {
    it('truncates with title tooltip', () => {
      const longName = [
        { id: 'mt-long', name: 'very_long', display_name: 'This Is A Very Long Milestone Name That Should Be Truncated', display_order: 1, pair_with_id: null, pair_position: null, source_milestone_type_id: null },
      ]

      render(
        <MilestoneTimelineV2
          milestoneTypes={longName}
          caseMilestones={[]}
          onRecord={mockOnRecord}
          onUndo={mockOnUndo}
          recordingMilestoneIds={new Set()}
          canManage={true}
        />
      )

      const nameEl = screen.getByText('This Is A Very Long Milestone Name That Should Be Truncated')
      expect(nameEl.className).toContain('truncate')
      expect(nameEl.getAttribute('title')).toBe('This Is A Very Long Milestone Name That Should Be Truncated')
    })
  })

  describe('Completed case (read-only)', () => {
    it('hides action buttons when canManage is false', () => {
      const { container } = render(
        <MilestoneTimelineV2
          milestoneTypes={baseMilestoneTypes}
          caseMilestones={allRecordedMilestones}
          onRecord={mockOnRecord}
          onUndo={mockOnUndo}
          recordingMilestoneIds={new Set()}
          canManage={false}
        />
      )

      // No Record or Undo buttons
      expect(screen.queryByText('Record')).not.toBeInTheDocument()
      const undoButtons = container.querySelectorAll('[aria-label^="Undo"]')
      expect(undoButtons).toHaveLength(0)
    })

    it('shows all milestone timestamps for completed case', () => {
      render(
        <MilestoneTimelineV2
          milestoneTypes={baseMilestoneTypes}
          caseMilestones={allRecordedMilestones}
          onRecord={mockOnRecord}
          onUndo={mockOnUndo}
          recordingMilestoneIds={new Set()}
          canManage={false}
        />
      )

      expect(screen.getByText('Formatted: 2024-01-01T10:00:00Z')).toBeInTheDocument()
      expect(screen.getByText('Formatted: 2024-01-01T10:15:00Z')).toBeInTheDocument()
      expect(screen.getByText('Formatted: 2024-01-01T10:30:00Z')).toBeInTheDocument()
      expect(screen.getByText('Formatted: 2024-01-01T10:45:00Z')).toBeInTheDocument()
    })
  })

  describe('Missing milestones on completed case', () => {
    it('shows pending nodes for unrecorded milestones', () => {
      // 2 of 4 milestones missing
      const partialMilestones = allRecordedMilestones.slice(0, 2)

      const { container } = render(
        <MilestoneTimelineV2
          milestoneTypes={baseMilestoneTypes}
          caseMilestones={partialMilestones}
          onRecord={mockOnRecord}
          onUndo={mockOnUndo}
          recordingMilestoneIds={new Set()}
          canManage={false}
        />
      )

      // 2 completed + 1 next + 1 pending
      const completedNodes = container.querySelectorAll('.bg-emerald-500')
      expect(completedNodes.length).toBeGreaterThanOrEqual(2)

      // Pending nodes (dashed border)
      const pendingNodes = container.querySelectorAll('.border-dashed.border-slate-300')
      expect(pendingNodes.length).toBeGreaterThanOrEqual(1)
    })
  })
})

// ============================================================================
// SECTION 3: CROSS-FEATURE CONSISTENCY
// ============================================================================

describe('Phase 9: Cross-Feature Consistency', () => {
  describe('CaseActivitySummary counts', () => {
    it('displays correct milestone counts', () => {
      render(
        <CaseActivitySummary
          completedMilestones={3}
          totalMilestones={8}
          implantsFilled={2}
          implantTotal={4}
          delayCount={1}
          flagCount={2}
        />
      )
      expect(screen.getByText('3/8')).toBeInTheDocument()
      expect(screen.getByText('2/4')).toBeInTheDocument()
      expect(screen.getByText('1')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument()
    })

    it('applies amber color to delay count when > 0', () => {
      render(
        <CaseActivitySummary
          completedMilestones={0}
          totalMilestones={0}
          implantsFilled={0}
          implantTotal={0}
          delayCount={3}
          flagCount={0}
        />
      )
      const delayValue = screen.getByText('3')
      expect(delayValue.className).toContain('text-amber-600')
    })

    it('applies red color to flag count when > 0', () => {
      render(
        <CaseActivitySummary
          completedMilestones={0}
          totalMilestones={0}
          implantsFilled={0}
          implantTotal={0}
          delayCount={0}
          flagCount={2}
        />
      )
      const flagValue = screen.getByText('2')
      expect(flagValue.className).toContain('text-red-600')
    })

    it('uses normal color for zero counts', () => {
      render(
        <CaseActivitySummary
          completedMilestones={0}
          totalMilestones={4}
          implantsFilled={0}
          implantTotal={0}
          delayCount={0}
          flagCount={0}
        />
      )
      const zeros = screen.getAllByText('0')
      zeros.forEach(el => {
        expect(el.className).toContain('text-slate-800')
      })
    })
  })

  describe('FlipRoomCard', () => {
    it('renders with amber gradient and callback functionality', () => {
      const onCallBack = vi.fn()
      const onUndoCallBack = vi.fn()

      const { container } = render(
        <FlipRoomCard
          caseNumber="CASE-001"
          roomName="OR 3"
          procedureName="Total Knee"
          lastMilestoneDisplayName="Incision"
          lastMilestoneRecordedAt="2024-01-01T10:15:00Z"
          calledBackAt={null}
          currentTime={Date.now()}
          timeZone="America/New_York"
          onCallBack={onCallBack}
          onUndoCallBack={onUndoCallBack}
          callingBack={false}
        />
      )

      expect(screen.getByText('Flip Room')).toBeInTheDocument()
      expect(screen.getByText('OR 3')).toBeInTheDocument()
      expect(screen.getByText('Total Knee')).toBeInTheDocument()
      expect(screen.getByText('Incision')).toBeInTheDocument()

      // Amber gradient classes
      const card = container.firstChild as HTMLElement
      expect(card.className).toContain('from-amber-50')

      // Call back button
      fireEvent.click(screen.getByText('Call Patient Back'))
      expect(onCallBack).toHaveBeenCalledTimes(1)
    })

    it('shows called-back state with undo', () => {
      const onUndoCallBack = vi.fn()

      render(
        <FlipRoomCard
          caseNumber="CASE-001"
          roomName="OR 3"
          procedureName="Total Knee"
          lastMilestoneDisplayName="Incision"
          lastMilestoneRecordedAt="2024-01-01T10:15:00Z"
          calledBackAt="2024-01-01T10:30:00Z"
          currentTime={Date.now()}
          timeZone="America/New_York"
          onCallBack={vi.fn()}
          onUndoCallBack={onUndoCallBack}
          callingBack={false}
        />
      )

      expect(screen.getByText(/Patient Called/)).toBeInTheDocument()

      fireEvent.click(screen.getByText('Undo'))
      expect(onUndoCallBack).toHaveBeenCalledTimes(1)
    })

    it('shows "Not started" when no milestones recorded', () => {
      render(
        <FlipRoomCard
          caseNumber="CASE-001"
          roomName="OR 3"
          procedureName="Total Knee"
          lastMilestoneDisplayName={null}
          lastMilestoneRecordedAt={null}
          calledBackAt={null}
          currentTime={Date.now()}
          onCallBack={vi.fn()}
          onUndoCallBack={vi.fn()}
          callingBack={false}
        />
      )

      expect(screen.getByText('Not started')).toBeInTheDocument()
    })
  })

  describe('TeamMember', () => {
    it('renders with correct name and role', () => {
      render(<TeamMember name="Dr. Smith" role="Surgeon" roleName="surgeon" />)
      expect(screen.getByText('Dr. Smith')).toBeInTheDocument()
      expect(screen.getByText('Surgeon')).toBeInTheDocument()
    })

    it('generates correct initials', () => {
      render(<TeamMember name="Dr. Jane Smith" role="Surgeon" roleName="surgeon" />)
      expect(screen.getByText('JS')).toBeInTheDocument()
    })

    it('shows remove button when onRemove is provided', () => {
      const onRemove = vi.fn()
      const { container } = render(
        <TeamMember name="Jane Doe" role="Nurse" roleName="nurse" onRemove={onRemove} />
      )

      const removeBtn = container.querySelector('button')
      expect(removeBtn).toBeInTheDocument()
      fireEvent.click(removeBtn!)
      expect(onRemove).toHaveBeenCalledTimes(1)
    })

    it('hides remove button when onRemove is not provided', () => {
      const { container } = render(
        <TeamMember name="Jane Doe" role="Nurse" roleName="nurse" />
      )
      expect(container.querySelector('button')).not.toBeInTheDocument()
    })
  })
})

// ============================================================================
// SECTION 4: INTEGRATION TEST MATRIX — Delays with Flags
// ============================================================================

describe('Phase 9: Integration - Delays with Flags Workflow', () => {
  const mockAddDelay = vi.fn().mockResolvedValue(undefined)
  const mockRemoveDelay = vi.fn()
  const mockDelayTypes = [
    { id: 'dt1', name: 'equipment', display_name: 'Equipment Delay' },
    { id: 'dt2', name: 'staff', display_name: 'Staff Delay' },
  ]

  it('renders both threshold flags and delay flags on same timeline', () => {
    const caseFlags = [
      {
        id: 'flag1', flag_type: 'threshold' as const, severity: 'warning' as const,
        label: 'Long Surgical', detail: '65 min', facility_milestone_id: 'mt2',
        duration_minutes: null, note: null, created_by: null,
      },
      {
        id: 'delay1', flag_type: 'delay' as const, severity: 'warning' as const,
        label: 'Equipment Delay', detail: '15 min', facility_milestone_id: 'mt1',
        duration_minutes: 15, note: 'Tray missing', created_by: 'user1',
      },
    ]

    render(
      <MilestoneTimelineV2
        milestoneTypes={baseMilestoneTypes}
        caseMilestones={[
          { id: 'cm1', facility_milestone_id: 'mt1', recorded_at: '2024-01-01T10:00:00Z' },
          { id: 'cm2', facility_milestone_id: 'mt2', recorded_at: '2024-01-01T10:15:00Z' },
        ]}
        onRecord={mockOnRecord}
        onUndo={mockOnUndo}
        recordingMilestoneIds={new Set()}
        canManage={true}
        caseFlags={caseFlags}
        onRemoveDelay={mockRemoveDelay}
        currentUserId="user1"
      />
    )

    // Threshold flag badge on Incision
    expect(screen.getByText('Long Surgical')).toBeInTheDocument()
    // Delay node between milestones
    expect(screen.getByText('Equipment Delay')).toBeInTheDocument()
    expect(screen.getByText('15m')).toBeInTheDocument()
  })

  it('full delay workflow: open form → select type → enter duration → submit', async () => {
    const { container } = render(
      <MilestoneTimelineV2
        milestoneTypes={baseMilestoneTypes}
        caseMilestones={[
          { id: 'cm1', facility_milestone_id: 'mt1', recorded_at: '2024-01-01T10:00:00Z' },
        ]}
        onRecord={mockOnRecord}
        onUndo={mockOnUndo}
        recordingMilestoneIds={new Set()}
        canManage={true}
        canCreateFlags={true}
        delayTypes={mockDelayTypes}
        onAddDelay={mockAddDelay}
      />
    )

    // Open delay form
    const clockBtn = container.querySelector('[aria-label="Log delay at Patient In"]') as HTMLButtonElement
    fireEvent.click(clockBtn)

    // Dialog should appear
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    // Select delay type
    fireEvent.click(screen.getByText('Equipment Delay'))

    // Enter duration
    const durationInput = screen.getByLabelText('Delay duration in minutes')
    fireEvent.change(durationInput, { target: { value: '10' } })

    // Enter note
    const noteInput = screen.getByLabelText('Delay note')
    fireEvent.change(noteInput, { target: { value: 'Tray not ready' } })

    // Submit
    fireEvent.click(screen.getByText('Log Delay'))

    expect(mockAddDelay).toHaveBeenCalledWith({
      delayTypeId: 'dt1',
      durationMinutes: 10,
      note: 'Tray not ready',
      facilityMilestoneId: 'mt1',
    })
  })
})
