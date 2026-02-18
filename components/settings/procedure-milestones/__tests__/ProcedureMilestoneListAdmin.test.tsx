// components/settings/procedure-milestones/__tests__/ProcedureMilestoneListAdmin.test.tsx
// Tests for ProcedureMilestoneList in admin template mode (custom URL + label props)

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  ProcedureMilestoneList,
  type FacilityMilestoneWithPhase,
  type PhaseInfo,
  type ProcedureMilestoneConfigItem,
} from '../ProcedureMilestoneList'

// Mock @dnd-kit
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  closestCenter: vi.fn(),
  KeyboardSensor: vi.fn(),
  PointerSensor: vi.fn(),
  useSensor: vi.fn(),
  useSensors: () => [],
}))

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  sortableKeyboardCoordinates: vi.fn(),
  verticalListSortingStrategy: 'vertical',
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
}))

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => null } },
}))

// Test data using milestone_types mapped to the FacilityMilestoneWithPhase shape
const milestones: FacilityMilestoneWithPhase[] = [
  { id: 'mt-patient-in', name: 'patient_in', display_name: 'Patient In Room', display_order: 1, pair_position: null, pair_with_id: null, phase_group: 'pre_op' },
  { id: 'mt-anes-start', name: 'anes_start', display_name: 'Anesthesia Start', display_order: 2, pair_position: 'start', pair_with_id: 'mt-anes-end', phase_group: 'pre_op' },
  { id: 'mt-anes-end', name: 'anes_end', display_name: 'Anesthesia End', display_order: 3, pair_position: 'end', pair_with_id: 'mt-anes-start', phase_group: 'pre_op' },
  { id: 'mt-incision', name: 'incision', display_name: 'Incision', display_order: 6, pair_position: null, pair_with_id: null, phase_group: 'surgical' },
  { id: 'mt-closing', name: 'closing', display_name: 'Closing', display_order: 7, pair_position: null, pair_with_id: null, phase_group: 'closing' },
  { id: 'mt-patient-out', name: 'patient_out', display_name: 'Patient Out', display_order: 9, pair_position: null, pair_with_id: null, phase_group: 'post_op' },
]

const phases: PhaseInfo[] = [
  { name: 'pre_op', display_name: 'Pre-Op', display_order: 1, color_key: 'blue', start_milestone_id: 'mt-patient-in', end_milestone_id: 'mt-incision' },
  { name: 'surgical', display_name: 'Surgical', display_order: 2, color_key: 'green', start_milestone_id: 'mt-incision', end_milestone_id: 'mt-closing' },
  { name: 'closing', display_name: 'Closing', display_order: 3, color_key: 'amber', start_milestone_id: 'mt-closing', end_milestone_id: 'mt-patient-out' },
  { name: 'post_op', display_name: 'Post-Op', display_order: 4, color_key: 'purple', start_milestone_id: 'mt-patient-out', end_milestone_id: 'mt-patient-out' },
]

const boundaryMilestoneIds = new Set(['mt-patient-in', 'mt-incision', 'mt-closing', 'mt-patient-out'])

const configs: ProcedureMilestoneConfigItem[] = [
  { id: 'cfg-1', procedure_type_id: 'proc-tmpl-1', facility_milestone_id: 'mt-patient-in', display_order: 1, is_enabled: true },
  { id: 'cfg-2', procedure_type_id: 'proc-tmpl-1', facility_milestone_id: 'mt-anes-start', display_order: 2, is_enabled: true },
  { id: 'cfg-3', procedure_type_id: 'proc-tmpl-1', facility_milestone_id: 'mt-incision', display_order: 6, is_enabled: true },
  { id: 'cfg-4', procedure_type_id: 'proc-tmpl-1', facility_milestone_id: 'mt-closing', display_order: 7, is_enabled: true },
  { id: 'cfg-5', procedure_type_id: 'proc-tmpl-1', facility_milestone_id: 'mt-patient-out', display_order: 9, is_enabled: true },
]

const defaultProps = {
  procedureId: 'proc-tmpl-1',
  milestones,
  configs,
  phases,
  boundaryMilestoneIds,
  savingKeys: new Set<string>(),
  isAnySaving: false,
  onToggle: vi.fn(),
  onTogglePaired: vi.fn(),
  onReorder: vi.fn(),
  onEnableAll: vi.fn(),
  onDisableAll: vi.fn(),
}

describe('ProcedureMilestoneList — Admin template mode', () => {
  it('renders custom milestones settings URL for admin page', () => {
    render(
      <ProcedureMilestoneList
        {...defaultProps}
        milestonesSettingsUrl="/admin/settings/milestones"
        milestonesSettingsLabel="Need a new milestone type? Create one in Milestone Types settings"
      />
    )

    const link = screen.getByText(/Need a new milestone type/)
    expect(link).toBeTruthy()
    expect(link.closest('a')?.getAttribute('href')).toBe('/admin/settings/milestones')
  })

  it('renders default milestones settings URL when not overridden', () => {
    render(<ProcedureMilestoneList {...defaultProps} />)

    const link = screen.getByText(/Need a new milestone/)
    expect(link.closest('a')?.getAttribute('href')).toBe('/settings/milestones')
  })

  it('renders phase sections with milestone_types mapped data', () => {
    render(
      <ProcedureMilestoneList
        {...defaultProps}
        milestonesSettingsUrl="/admin/settings/milestones"
      />
    )

    expect(screen.getByText('Pre-Op')).toBeTruthy()
    expect(screen.getByText('Surgical')).toBeTruthy()
    expect(screen.getByText('Patient In Room')).toBeTruthy()
    expect(screen.getByText('Incision')).toBeTruthy()
  })

  it('locks boundary milestone_types same as facility milestones', () => {
    render(
      <ProcedureMilestoneList
        {...defaultProps}
        milestonesSettingsUrl="/admin/settings/milestones"
      />
    )

    // Patient In (boundary) should have disabled checkbox
    const patientInRow = screen.getByText('Patient In Room').closest('div')
    const patientInCheckbox = patientInRow?.querySelector('input[type="checkbox"]')
    expect(patientInCheckbox).toBeTruthy()
    expect((patientInCheckbox as HTMLInputElement).disabled).toBe(true)
  })

  it('allows toggling non-boundary milestone_types', () => {
    render(
      <ProcedureMilestoneList
        {...defaultProps}
        milestonesSettingsUrl="/admin/settings/milestones"
      />
    )

    // Anesthesia Start (non-boundary) should have enabled checkbox
    const anesRow = screen.getByText('Anesthesia Start').closest('div')
    const anesCheckbox = anesRow?.querySelector('input[type="checkbox"]')
    expect(anesCheckbox).toBeTruthy()
    expect((anesCheckbox as HTMLInputElement).disabled).toBe(false)
  })

  it('hides pair-end milestones in template mode', () => {
    render(
      <ProcedureMilestoneList
        {...defaultProps}
        milestonesSettingsUrl="/admin/settings/milestones"
      />
    )

    // Anesthesia End (pair_position='end') should be hidden
    expect(screen.queryByText('Anesthesia End')).toBeFalsy()
  })
})
