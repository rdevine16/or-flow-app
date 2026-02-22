// app/admin/demo/__tests__/SurgeonProfilesStep.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SurgeonProfilesStep from '../steps/SurgeonProfilesStep'
import type {
  DemoSurgeon,
  DemoORRoom,
  DemoProcedureType,
  SurgeonProfile,
  BlockScheduleEntry,
  SurgeonDurationEntry,
} from '../types'
import { createDefaultOutlierProfile } from '../types'

describe('SurgeonProfilesStep', () => {
  const mockSurgeons: DemoSurgeon[] = [
    {
      id: 'surgeon-1',
      first_name: 'John',
      last_name: 'Smith',
      closing_workflow: 'standard',
      closing_handoff_minutes: 15,
    },
    {
      id: 'surgeon-2',
      first_name: 'Jane',
      last_name: 'Doe',
      closing_workflow: null,
      closing_handoff_minutes: null,
    },
  ]

  const mockRooms: DemoORRoom[] = [
    { id: 'room-1', name: 'OR 1' },
    { id: 'room-2', name: 'OR 2' },
  ]

  const mockProcedures: DemoProcedureType[] = [
    { id: 'proc-1', name: 'THA', expected_duration_minutes: 90 },
    { id: 'proc-2', name: 'TKA', expected_duration_minutes: 120 },
    { id: 'proc-3', name: 'Distal Radius ORIF', expected_duration_minutes: 60 },
  ]

  const mockBlockSchedules: BlockScheduleEntry[] = [
    { surgeon_id: 'surgeon-1', day_of_week: 1, start_time: '07:00:00', end_time: '15:00:00' },
    { surgeon_id: 'surgeon-1', day_of_week: 3, start_time: '07:00:00', end_time: '15:00:00' },
    { surgeon_id: 'surgeon-2', day_of_week: 2, start_time: '08:00:00', end_time: '16:00:00' },
  ]

  const mockDurations: SurgeonDurationEntry[] = [
    { surgeon_id: 'surgeon-1', procedure_type_id: 'proc-1', expected_duration_minutes: 85 },
    { surgeon_id: 'surgeon-1', procedure_type_id: 'proc-2', expected_duration_minutes: 115 },
  ]

  const mockProfile: SurgeonProfile = {
    surgeonId: 'surgeon-1',
    speedProfile: 'average',
    specialty: 'joint',
    operatingDays: [1, 3],
    dayRoomAssignments: { 1: ['room-1'], 3: ['room-1'] },
    procedureTypeIds: ['proc-1', 'proc-2'],
    preferredVendor: 'Stryker',
    closingWorkflow: 'standard',
    closingHandoffMinutes: 15,
    outliers: createDefaultOutlierProfile(),
    badDaysPerMonth: 0,
  }

  const mockOnUpdateProfile = vi.fn()
  const mockOnToggleSurgeon = vi.fn()
  const mockOnExpandSurgeon = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('renders step header with surgeon count', () => {
      render(
        <SurgeonProfilesStep
          surgeons={mockSurgeons}
          profiles={{}}
          onUpdateProfile={mockOnUpdateProfile}
          onToggleSurgeon={mockOnToggleSurgeon}
          blockSchedules={mockBlockSchedules}
          surgeonDurations={mockDurations}
          procedureTypes={mockProcedures}
          rooms={mockRooms}
          expandedSurgeonId={null}
          onExpandSurgeon={mockOnExpandSurgeon}
        />,
      )

      expect(screen.getByText(/surgeon profiles/i)).toBeTruthy()
    })

    it('renders all surgeon cards', () => {
      render(
        <SurgeonProfilesStep
          surgeons={mockSurgeons}
          profiles={{}}
          onUpdateProfile={mockOnUpdateProfile}
          onToggleSurgeon={mockOnToggleSurgeon}
          blockSchedules={mockBlockSchedules}
          surgeonDurations={mockDurations}
          procedureTypes={mockProcedures}
          rooms={mockRooms}
          expandedSurgeonId={null}
          onExpandSurgeon={mockOnExpandSurgeon}
        />,
      )

      expect(screen.getByText(/John Smith/i)).toBeTruthy()
      expect(screen.getByText(/Jane Doe/i)).toBeTruthy()
    })

    it('renders empty state when no surgeons exist', () => {
      render(
        <SurgeonProfilesStep
          surgeons={[]}
          profiles={{}}
          onUpdateProfile={mockOnUpdateProfile}
          onToggleSurgeon={mockOnToggleSurgeon}
          blockSchedules={[]}
          surgeonDurations={[]}
          procedureTypes={mockProcedures}
          rooms={mockRooms}
          expandedSurgeonId={null}
          onExpandSurgeon={mockOnExpandSurgeon}
        />,
      )

      expect(screen.getByText(/no surgeons/i)).toBeTruthy()
    })
  })

  describe('Surgeon Toggle', () => {
    it('shows unchecked toggle when surgeon not in profiles', () => {
      render(
        <SurgeonProfilesStep
          surgeons={mockSurgeons}
          profiles={{}}
          onUpdateProfile={mockOnUpdateProfile}
          onToggleSurgeon={mockOnToggleSurgeon}
          blockSchedules={mockBlockSchedules}
          surgeonDurations={mockDurations}
          procedureTypes={mockProcedures}
          rooms={mockRooms}
          expandedSurgeonId={null}
          onExpandSurgeon={mockOnExpandSurgeon}
        />,
      )

      const toggles = screen.getAllByRole('checkbox')
      expect(toggles[0]).not.toBeChecked()
    })

    it('shows checked toggle when surgeon is in profiles', () => {
      render(
        <SurgeonProfilesStep
          surgeons={mockSurgeons}
          profiles={{ 'surgeon-1': mockProfile }}
          onUpdateProfile={mockOnUpdateProfile}
          onToggleSurgeon={mockOnToggleSurgeon}
          blockSchedules={mockBlockSchedules}
          surgeonDurations={mockDurations}
          procedureTypes={mockProcedures}
          rooms={mockRooms}
          expandedSurgeonId={null}
          onExpandSurgeon={mockOnExpandSurgeon}
        />,
      )

      const toggles = screen.getAllByRole('checkbox')
      expect(toggles[0]).toBeChecked()
    })

    it('calls onToggleSurgeon when toggle clicked', async () => {
      const user = userEvent.setup()
      render(
        <SurgeonProfilesStep
          surgeons={mockSurgeons}
          profiles={{}}
          onUpdateProfile={mockOnUpdateProfile}
          onToggleSurgeon={mockOnToggleSurgeon}
          blockSchedules={mockBlockSchedules}
          surgeonDurations={mockDurations}
          procedureTypes={mockProcedures}
          rooms={mockRooms}
          expandedSurgeonId={null}
          onExpandSurgeon={mockOnExpandSurgeon}
        />,
      )

      const toggles = screen.getAllByRole('checkbox')
      await user.click(toggles[0])

      expect(mockOnToggleSurgeon).toHaveBeenCalledWith('surgeon-1', true)
    })
  })

  describe('Expand/Collapse', () => {
    it('shows chevron down when card is collapsed', () => {
      render(
        <SurgeonProfilesStep
          surgeons={mockSurgeons}
          profiles={{ 'surgeon-1': mockProfile }}
          onUpdateProfile={mockOnUpdateProfile}
          onToggleSurgeon={mockOnToggleSurgeon}
          blockSchedules={mockBlockSchedules}
          surgeonDurations={mockDurations}
          procedureTypes={mockProcedures}
          rooms={mockRooms}
          expandedSurgeonId={null}
          onExpandSurgeon={mockOnExpandSurgeon}
        />,
      )

      expect(screen.getByTestId('chevron-down')).toBeTruthy()
    })

    it('shows chevron up when card is expanded', () => {
      render(
        <SurgeonProfilesStep
          surgeons={mockSurgeons}
          profiles={{ 'surgeon-1': mockProfile }}
          onUpdateProfile={mockOnUpdateProfile}
          onToggleSurgeon={mockOnToggleSurgeon}
          blockSchedules={mockBlockSchedules}
          surgeonDurations={mockDurations}
          procedureTypes={mockProcedures}
          rooms={mockRooms}
          expandedSurgeonId="surgeon-1"
          onExpandSurgeon={mockOnExpandSurgeon}
        />,
      )

      expect(screen.getByTestId('chevron-up')).toBeTruthy()
    })

    it('calls onExpandSurgeon when expand button clicked', async () => {
      const user = userEvent.setup()
      render(
        <SurgeonProfilesStep
          surgeons={mockSurgeons}
          profiles={{ 'surgeon-1': mockProfile }}
          onUpdateProfile={mockOnUpdateProfile}
          onToggleSurgeon={mockOnToggleSurgeon}
          blockSchedules={mockBlockSchedules}
          surgeonDurations={mockDurations}
          procedureTypes={mockProcedures}
          rooms={mockRooms}
          expandedSurgeonId={null}
          onExpandSurgeon={mockOnExpandSurgeon}
        />,
      )

      const expandButton = screen.getByTestId('chevron-down').closest('button')
      if (expandButton) await user.click(expandButton)

      expect(mockOnExpandSurgeon).toHaveBeenCalledWith('surgeon-1')
    })
  })

  describe('Speed Profile Selection', () => {
    it('shows all three speed profile buttons', () => {
      render(
        <SurgeonProfilesStep
          surgeons={mockSurgeons}
          profiles={{ 'surgeon-1': mockProfile }}
          onUpdateProfile={mockOnUpdateProfile}
          onToggleSurgeon={mockOnToggleSurgeon}
          blockSchedules={mockBlockSchedules}
          surgeonDurations={mockDurations}
          procedureTypes={mockProcedures}
          rooms={mockRooms}
          expandedSurgeonId="surgeon-1"
          onExpandSurgeon={mockOnExpandSurgeon}
        />,
      )

      expect(screen.getByTestId('speed-fast-surgeon-1')).toBeTruthy()
      expect(screen.getByTestId('speed-average-surgeon-1')).toBeTruthy()
      expect(screen.getByTestId('speed-slow-surgeon-1')).toBeTruthy()
    })

    it('highlights the selected speed profile', () => {
      render(
        <SurgeonProfilesStep
          surgeons={mockSurgeons}
          profiles={{ 'surgeon-1': { ...mockProfile, speedProfile: 'fast' } }}
          onUpdateProfile={mockOnUpdateProfile}
          onToggleSurgeon={mockOnToggleSurgeon}
          blockSchedules={mockBlockSchedules}
          surgeonDurations={mockDurations}
          procedureTypes={mockProcedures}
          rooms={mockRooms}
          expandedSurgeonId="surgeon-1"
          onExpandSurgeon={mockOnExpandSurgeon}
        />,
      )

      const fastButton = screen.getByTestId('speed-fast-surgeon-1')
      expect(fastButton.className).toContain('green-100')
    })

    it('calls onUpdateProfile when speed profile changed', async () => {
      const user = userEvent.setup()
      render(
        <SurgeonProfilesStep
          surgeons={mockSurgeons}
          profiles={{ 'surgeon-1': mockProfile }}
          onUpdateProfile={mockOnUpdateProfile}
          onToggleSurgeon={mockOnToggleSurgeon}
          blockSchedules={mockBlockSchedules}
          surgeonDurations={mockDurations}
          procedureTypes={mockProcedures}
          rooms={mockRooms}
          expandedSurgeonId="surgeon-1"
          onExpandSurgeon={mockOnExpandSurgeon}
        />,
      )

      const fastButton = screen.getByTestId('speed-fast-surgeon-1')
      await user.click(fastButton)

      expect(mockOnUpdateProfile).toHaveBeenCalledWith('surgeon-1', { speedProfile: 'fast' })
    })
  })

  describe('Specialty Selection', () => {
    it('shows all three specialty buttons', () => {
      render(
        <SurgeonProfilesStep
          surgeons={mockSurgeons}
          profiles={{ 'surgeon-1': mockProfile }}
          onUpdateProfile={mockOnUpdateProfile}
          onToggleSurgeon={mockOnToggleSurgeon}
          blockSchedules={mockBlockSchedules}
          surgeonDurations={mockDurations}
          procedureTypes={mockProcedures}
          rooms={mockRooms}
          expandedSurgeonId="surgeon-1"
          onExpandSurgeon={mockOnExpandSurgeon}
        />,
      )

      expect(screen.getByTestId('specialty-joint-surgeon-1')).toBeTruthy()
      expect(screen.getByTestId('specialty-hand_wrist-surgeon-1')).toBeTruthy()
      expect(screen.getByTestId('specialty-spine-surgeon-1')).toBeTruthy()
    })

    it('highlights the selected specialty', () => {
      render(
        <SurgeonProfilesStep
          surgeons={mockSurgeons}
          profiles={{ 'surgeon-1': { ...mockProfile, specialty: 'spine' } }}
          onUpdateProfile={mockOnUpdateProfile}
          onToggleSurgeon={mockOnToggleSurgeon}
          blockSchedules={mockBlockSchedules}
          surgeonDurations={mockDurations}
          procedureTypes={mockProcedures}
          rooms={mockRooms}
          expandedSurgeonId="surgeon-1"
          onExpandSurgeon={mockOnExpandSurgeon}
        />,
      )

      const spineButton = screen.getByTestId('specialty-spine-surgeon-1')
      expect(spineButton.className).toContain('slate-900')
    })

    it('auto-selects procedures when specialty changes', async () => {
      const user = userEvent.setup()
      const mockProcsWithSpine: DemoProcedureType[] = [
        ...mockProcedures,
        { id: 'proc-4', name: 'Lumbar Microdiscectomy', expected_duration_minutes: 90 },
        { id: 'proc-5', name: 'ACDF', expected_duration_minutes: 120 },
      ]

      render(
        <SurgeonProfilesStep
          surgeons={mockSurgeons}
          profiles={{ 'surgeon-1': mockProfile }}
          onUpdateProfile={mockOnUpdateProfile}
          onToggleSurgeon={mockOnToggleSurgeon}
          blockSchedules={mockBlockSchedules}
          surgeonDurations={mockDurations}
          procedureTypes={mockProcsWithSpine}
          rooms={mockRooms}
          expandedSurgeonId="surgeon-1"
          onExpandSurgeon={mockOnExpandSurgeon}
        />,
      )

      const spineButton = screen.getByTestId('specialty-spine-surgeon-1')
      await user.click(spineButton)

      expect(mockOnUpdateProfile).toHaveBeenCalledWith('surgeon-1', {
        specialty: 'spine',
        procedureTypeIds: expect.arrayContaining(['proc-4', 'proc-5']),
      })
    })
  })

  describe('Operating Days Selection', () => {
    it('shows all five weekday toggles', () => {
      render(
        <SurgeonProfilesStep
          surgeons={mockSurgeons}
          profiles={{ 'surgeon-1': mockProfile }}
          onUpdateProfile={mockOnUpdateProfile}
          onToggleSurgeon={mockOnToggleSurgeon}
          blockSchedules={mockBlockSchedules}
          surgeonDurations={mockDurations}
          procedureTypes={mockProcedures}
          rooms={mockRooms}
          expandedSurgeonId="surgeon-1"
          onExpandSurgeon={mockOnExpandSurgeon}
        />,
      )

      expect(screen.getByTestId('day-1-surgeon-1')).toBeTruthy()
      expect(screen.getByTestId('day-2-surgeon-1')).toBeTruthy()
      expect(screen.getByTestId('day-3-surgeon-1')).toBeTruthy()
      expect(screen.getByTestId('day-4-surgeon-1')).toBeTruthy()
      expect(screen.getByTestId('day-5-surgeon-1')).toBeTruthy()
    })

    it('highlights selected operating days', () => {
      render(
        <SurgeonProfilesStep
          surgeons={mockSurgeons}
          profiles={{ 'surgeon-1': mockProfile }}
          onUpdateProfile={mockOnUpdateProfile}
          onToggleSurgeon={mockOnToggleSurgeon}
          blockSchedules={mockBlockSchedules}
          surgeonDurations={mockDurations}
          procedureTypes={mockProcedures}
          rooms={mockRooms}
          expandedSurgeonId="surgeon-1"
          onExpandSurgeon={mockOnExpandSurgeon}
        />,
      )

      const monButton = screen.getByTestId('day-1-surgeon-1')
      const wedButton = screen.getByTestId('day-3-surgeon-1')
      const tueButton = screen.getByTestId('day-2-surgeon-1')

      expect(monButton.className).toContain('blue-600')
      expect(wedButton.className).toContain('blue-600')
      expect(tueButton.className).not.toContain('blue-600')
    })

    it('calls onUpdateProfile when operating day toggled', async () => {
      const user = userEvent.setup()
      render(
        <SurgeonProfilesStep
          surgeons={mockSurgeons}
          profiles={{ 'surgeon-1': mockProfile }}
          onUpdateProfile={mockOnUpdateProfile}
          onToggleSurgeon={mockOnToggleSurgeon}
          blockSchedules={mockBlockSchedules}
          surgeonDurations={mockDurations}
          procedureTypes={mockProcedures}
          rooms={mockRooms}
          expandedSurgeonId="surgeon-1"
          onExpandSurgeon={mockOnExpandSurgeon}
        />,
      )

      const tueButton = screen.getByTestId('day-2-surgeon-1')
      await user.click(tueButton)

      expect(mockOnUpdateProfile).toHaveBeenCalledWith('surgeon-1', {
        operatingDays: expect.arrayContaining([1, 2, 3]),
      })
    })
  })

  describe('Block Schedule Auto-fill', () => {
    it('shows block schedule info when available', () => {
      render(
        <SurgeonProfilesStep
          surgeons={mockSurgeons}
          profiles={{ 'surgeon-1': mockProfile }}
          onUpdateProfile={mockOnUpdateProfile}
          onToggleSurgeon={mockOnToggleSurgeon}
          blockSchedules={mockBlockSchedules}
          surgeonDurations={mockDurations}
          procedureTypes={mockProcedures}
          rooms={mockRooms}
          expandedSurgeonId="surgeon-1"
          onExpandSurgeon={mockOnExpandSurgeon}
        />,
      )

      expect(screen.getByText(/07:00-15:00/i)).toBeTruthy()
    })

    it('does not show block schedule info when no blocks exist', () => {
      render(
        <SurgeonProfilesStep
          surgeons={mockSurgeons}
          profiles={{ 'surgeon-2': { ...mockProfile, surgeonId: 'surgeon-2' } }}
          onUpdateProfile={mockOnUpdateProfile}
          onToggleSurgeon={mockOnToggleSurgeon}
          blockSchedules={[]}
          surgeonDurations={mockDurations}
          procedureTypes={mockProcedures}
          rooms={mockRooms}
          expandedSurgeonId="surgeon-2"
          onExpandSurgeon={mockOnExpandSurgeon}
        />,
      )

      expect(screen.queryByText(/07:00-15:00/i)).toBeNull()
    })
  })

  describe('Procedure Type Selection', () => {
    it('shows procedure checkboxes', () => {
      render(
        <SurgeonProfilesStep
          surgeons={mockSurgeons}
          profiles={{ 'surgeon-1': mockProfile }}
          onUpdateProfile={mockOnUpdateProfile}
          onToggleSurgeon={mockOnToggleSurgeon}
          blockSchedules={mockBlockSchedules}
          surgeonDurations={mockDurations}
          procedureTypes={mockProcedures}
          rooms={mockRooms}
          expandedSurgeonId="surgeon-1"
          onExpandSurgeon={mockOnExpandSurgeon}
        />,
      )

      expect(screen.getByText('THA')).toBeTruthy()
      expect(screen.getByText('TKA')).toBeTruthy()
    })

    it('checks selected procedures', () => {
      render(
        <SurgeonProfilesStep
          surgeons={mockSurgeons}
          profiles={{ 'surgeon-1': mockProfile }}
          onUpdateProfile={mockOnUpdateProfile}
          onToggleSurgeon={mockOnToggleSurgeon}
          blockSchedules={mockBlockSchedules}
          surgeonDurations={mockDurations}
          procedureTypes={mockProcedures}
          rooms={mockRooms}
          expandedSurgeonId="surgeon-1"
          onExpandSurgeon={mockOnExpandSurgeon}
        />,
      )

      const thaButton = screen.getByTestId('proc-proc-1-surgeon-1')
      const tkaButton = screen.getByTestId('proc-proc-2-surgeon-1')

      expect(thaButton.className).toContain('blue-50')
      expect(tkaButton.className).toContain('blue-50')
    })

    it('calls onUpdateProfile when procedure toggled', async () => {
      const user = userEvent.setup()
      render(
        <SurgeonProfilesStep
          surgeons={mockSurgeons}
          profiles={{ 'surgeon-1': mockProfile }}
          onUpdateProfile={mockOnUpdateProfile}
          onToggleSurgeon={mockOnToggleSurgeon}
          blockSchedules={mockBlockSchedules}
          surgeonDurations={mockDurations}
          procedureTypes={mockProcedures}
          rooms={mockRooms}
          expandedSurgeonId="surgeon-1"
          onExpandSurgeon={mockOnExpandSurgeon}
        />,
      )

      const orButton = screen.getByTestId('proc-proc-3-surgeon-1')
      await user.click(orButton)

      expect(mockOnUpdateProfile).toHaveBeenCalled()
    })
  })

  describe('Vendor Selection', () => {
    it('shows vendor dropdown options', () => {
      render(
        <SurgeonProfilesStep
          surgeons={mockSurgeons}
          profiles={{ 'surgeon-1': mockProfile }}
          onUpdateProfile={mockOnUpdateProfile}
          onToggleSurgeon={mockOnToggleSurgeon}
          blockSchedules={mockBlockSchedules}
          surgeonDurations={mockDurations}
          procedureTypes={mockProcedures}
          rooms={mockRooms}
          expandedSurgeonId="surgeon-1"
          onExpandSurgeon={mockOnExpandSurgeon}
        />,
      )

      expect(screen.getByText(/vendor/i)).toBeTruthy()
    })

    it('displays selected vendor', () => {
      render(
        <SurgeonProfilesStep
          surgeons={mockSurgeons}
          profiles={{ 'surgeon-1': { ...mockProfile, preferredVendor: 'Zimmer Biomet' } }}
          onUpdateProfile={mockOnUpdateProfile}
          onToggleSurgeon={mockOnToggleSurgeon}
          blockSchedules={mockBlockSchedules}
          surgeonDurations={mockDurations}
          procedureTypes={mockProcedures}
          rooms={mockRooms}
          expandedSurgeonId="surgeon-1"
          onExpandSurgeon={mockOnExpandSurgeon}
        />,
      )

      expect(screen.getByText(/zimmer biomet/i)).toBeTruthy()
    })
  })

  describe('Integration: Specialty Change Auto-selects Procedures', () => {
    it('changing specialty to hand_wrist auto-selects hand procedures', async () => {
      const user = userEvent.setup()
      const mockProcsWithHand: DemoProcedureType[] = [
        ...mockProcedures,
        { id: 'proc-6', name: 'Carpal Tunnel Release', expected_duration_minutes: 30 },
        { id: 'proc-7', name: 'Trigger Finger Release', expected_duration_minutes: 20 },
      ]

      render(
        <SurgeonProfilesStep
          surgeons={mockSurgeons}
          profiles={{ 'surgeon-1': mockProfile }}
          onUpdateProfile={mockOnUpdateProfile}
          onToggleSurgeon={mockOnToggleSurgeon}
          blockSchedules={mockBlockSchedules}
          surgeonDurations={mockDurations}
          procedureTypes={mockProcsWithHand}
          rooms={mockRooms}
          expandedSurgeonId="surgeon-1"
          onExpandSurgeon={mockOnExpandSurgeon}
        />,
      )

      const handButton = screen.getByTestId('specialty-hand_wrist-surgeon-1')
      await user.click(handButton)

      expect(mockOnUpdateProfile).toHaveBeenCalledWith('surgeon-1', {
        specialty: 'hand_wrist',
        procedureTypeIds: expect.arrayContaining(['proc-6', 'proc-7']),
      })
    })
  })
})
