// components/settings/procedure-milestones/__tests__/ProcedureMilestoneList.test.tsx
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

const milestones: FacilityMilestoneWithPhase[] = [
  { id: 'ms-patient-in', name: 'patient_in', display_name: 'Patient In Room', display_order: 1, pair_position: null, pair_with_id: null, phase_group: 'pre_op' },
  { id: 'ms-anes-start', name: 'anes_start', display_name: 'Anesthesia Start', display_order: 2, pair_position: 'start', pair_with_id: 'ms-anes-end', phase_group: 'pre_op' },
  { id: 'ms-anes-end', name: 'anes_end', display_name: 'Anesthesia End', display_order: 3, pair_position: 'end', pair_with_id: 'ms-anes-start', phase_group: 'pre_op' },
  { id: 'ms-incision', name: 'incision', display_name: 'Incision', display_order: 6, pair_position: null, pair_with_id: null, phase_group: 'surgical' },
  { id: 'ms-closing', name: 'closing', display_name: 'Closing', display_order: 7, pair_position: 'start', pair_with_id: 'ms-closing-complete', phase_group: 'closing' },
  { id: 'ms-closing-complete', name: 'closing_complete', display_name: 'Closing Complete', display_order: 8, pair_position: 'end', pair_with_id: 'ms-closing', phase_group: 'closing' },
  { id: 'ms-patient-out', name: 'patient_out', display_name: 'Patient Out', display_order: 9, pair_position: null, pair_with_id: null, phase_group: 'post_op' },
]

const phases: PhaseInfo[] = [
  { name: 'pre_op', display_name: 'Pre-Op', display_order: 1, color_key: 'blue', start_milestone_id: 'ms-patient-in', end_milestone_id: 'ms-incision' },
  { name: 'surgical', display_name: 'Surgical', display_order: 2, color_key: 'green', start_milestone_id: 'ms-incision', end_milestone_id: 'ms-closing' },
  { name: 'closing', display_name: 'Closing', display_order: 3, color_key: 'amber', start_milestone_id: 'ms-closing', end_milestone_id: 'ms-closing-complete' },
  { name: 'post_op', display_name: 'Post-Op', display_order: 4, color_key: 'purple', start_milestone_id: 'ms-closing-complete', end_milestone_id: 'ms-patient-out' },
]

const boundaryMilestoneIds = new Set([
  'ms-patient-in', 'ms-incision', 'ms-closing', 'ms-closing-complete', 'ms-patient-out',
])

const configs: ProcedureMilestoneConfigItem[] = [
  { id: 'cfg-1', procedure_type_id: 'proc-1', facility_milestone_id: 'ms-patient-in', display_order: 1, is_enabled: true },
  { id: 'cfg-2', procedure_type_id: 'proc-1', facility_milestone_id: 'ms-anes-start', display_order: 2, is_enabled: true },
  { id: 'cfg-3', procedure_type_id: 'proc-1', facility_milestone_id: 'ms-anes-end', display_order: 3, is_enabled: true },
  { id: 'cfg-4', procedure_type_id: 'proc-1', facility_milestone_id: 'ms-incision', display_order: 6, is_enabled: true },
  { id: 'cfg-5', procedure_type_id: 'proc-1', facility_milestone_id: 'ms-closing', display_order: 7, is_enabled: true },
  { id: 'cfg-6', procedure_type_id: 'proc-1', facility_milestone_id: 'ms-closing-complete', display_order: 8, is_enabled: true },
  { id: 'cfg-7', procedure_type_id: 'proc-1', facility_milestone_id: 'ms-patient-out', display_order: 9, is_enabled: true },
]

const defaultProps = {
  procedureId: 'proc-1',
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

describe('ProcedureMilestoneList', () => {
  it('renders all phase sections', () => {
    render(<ProcedureMilestoneList {...defaultProps} />)
    expect(screen.getByText('Pre-Op')).toBeTruthy()
    expect(screen.getByText('Surgical')).toBeTruthy()
    // "Closing" appears as both a phase header and milestone name, use getAllByText
    expect(screen.getAllByText('Closing').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Post-Op')).toBeTruthy()
  })

  it('renders visible milestones (hides pair end milestones)', () => {
    render(<ProcedureMilestoneList {...defaultProps} />)
    // Start milestones and unpaired should be visible
    expect(screen.getByText('Patient In Room')).toBeTruthy()
    expect(screen.getByText('Anesthesia Start')).toBeTruthy()
    expect(screen.getByText('Incision')).toBeTruthy()
    // "Closing" appears both as phase header and milestone name
    expect(screen.getAllByText('Closing').length).toBe(2)
    expect(screen.getByText('Patient Out')).toBeTruthy()

    // End milestones (pair_position='end') should be hidden
    expect(screen.queryByText('Anesthesia End')).toBeFalsy()
    expect(screen.queryByText('Closing Complete')).toBeFalsy()
  })

  it('renders boundary milestones with locked checkboxes', () => {
    render(<ProcedureMilestoneList {...defaultProps} />)
    // Boundary milestones should have disabled checkboxes
    const checkboxes = screen.getAllByRole('checkbox')
    // Patient In (boundary) should be disabled
    const patientInRow = screen.getByText('Patient In Room').closest('div')
    const patientInCheckbox = patientInRow?.querySelector('input[type="checkbox"]')
    expect(patientInCheckbox).toBeTruthy()
    expect((patientInCheckbox as HTMLInputElement).disabled).toBe(true)
  })

  it('renders non-boundary milestones with toggleable checkboxes', () => {
    render(<ProcedureMilestoneList {...defaultProps} />)
    // Anesthesia Start (non-boundary) should be enabled
    const anesRow = screen.getByText('Anesthesia Start').closest('div')
    const anesCheckbox = anesRow?.querySelector('input[type="checkbox"]')
    expect(anesCheckbox).toBeTruthy()
    expect((anesCheckbox as HTMLInputElement).disabled).toBe(false)
  })

  it('renders link to milestones settings page', () => {
    render(<ProcedureMilestoneList {...defaultProps} />)
    const link = screen.getByText(/Need a new milestone/)
    expect(link).toBeTruthy()
    expect(link.closest('a')?.getAttribute('href')).toBe('/settings/milestones')
  })

  it('renders Select All and Clear All buttons', () => {
    render(<ProcedureMilestoneList {...defaultProps} />)
    expect(screen.getByText('Select All')).toBeTruthy()
    expect(screen.getByText('Clear All')).toBeTruthy()
  })

  it('groups milestones correctly by phase_group', () => {
    render(<ProcedureMilestoneList {...defaultProps} />)
    // Pre-Op should contain Patient In Room and Anesthesia Start
    // Surgical should contain Incision
    // These are rendered in order within their phase sections
    const allText = document.body.textContent || ''
    const preOpIdx = allText.indexOf('Pre-Op')
    const patientInIdx = allText.indexOf('Patient In Room')
    const surgicalIdx = allText.indexOf('Surgical')
    const incisionIdx = allText.indexOf('Incision')

    // Patient In should come after Pre-Op label but before Surgical label
    expect(patientInIdx).toBeGreaterThan(preOpIdx)
    expect(patientInIdx).toBeLessThan(surgicalIdx)

    // Incision should come after Surgical label
    expect(incisionIdx).toBeGreaterThan(surgicalIdx)
  })
})
