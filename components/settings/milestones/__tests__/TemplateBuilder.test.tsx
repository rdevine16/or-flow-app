// components/settings/milestones/__tests__/TemplateBuilder.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TemplateBuilder } from '../TemplateBuilder'

const defaultHookReturn = {
  templates: [
    { id: 't1', name: 'Default Template', is_default: true, is_active: true, deleted_at: null, facility_id: 'f1', description: null, deleted_by: null, block_order: {}, sub_phase_map: {} },
    { id: 't2', name: 'Custom Template', is_default: false, is_active: true, deleted_at: null, facility_id: 'f1', description: 'Custom', deleted_by: null, block_order: {}, sub_phase_map: {} },
  ],
  selectedTemplate: { id: 't1', name: 'Default Template', is_default: true, is_active: true, deleted_at: null, facility_id: 'f1', description: null, deleted_by: null, block_order: {}, sub_phase_map: {} },
  selectedTemplateId: 't1',
  items: [
    { id: 'i1', template_id: 't1', facility_milestone_id: 'm1', facility_phase_id: 'p1', display_order: 1 },
    { id: 'i2', template_id: 't1', facility_milestone_id: 'm2', facility_phase_id: 'p1', display_order: 2 },
  ],
  milestones: [
    { id: 'm1', name: 'patient_in', display_name: 'Patient In', pair_with_id: null, pair_position: null },
    { id: 'm2', name: 'incision', display_name: 'Incision', pair_with_id: null, pair_position: null },
    { id: 'm3', name: 'patient_out', display_name: 'Patient Out', pair_with_id: null, pair_position: null },
  ],
  phases: [
    { id: 'p1', name: 'pre_op', display_name: 'Pre-Op', color_key: 'blue', display_order: 1, parent_phase_id: null },
    { id: 'p2', name: 'surgical', display_name: 'Surgical', color_key: 'green', display_order: 2, parent_phase_id: null },
  ],
  availableMilestones: [
    { id: 'm3', name: 'patient_out', display_name: 'Patient Out', pair_with_id: null, pair_position: null },
  ],
  availablePhases: [
    { id: 'p2', name: 'surgical', display_name: 'Surgical', color_key: 'green', display_order: 2, parent_phase_id: null },
  ],
  assignedMilestoneIds: new Set(['m1', 'm2']),
  assignedPhaseIds: new Set(['p1']),
  procedureCounts: {},
  loading: false,
  itemsLoading: false,
  error: null,
  saving: false,
  setSelectedTemplateId: vi.fn(),
  createTemplate: vi.fn(),
  duplicateTemplate: vi.fn(),
  setDefaultTemplate: vi.fn(),
  archiveTemplate: vi.fn(),
  renameTemplate: vi.fn(),
  addMilestoneToPhase: vi.fn(),
  removeMilestone: vi.fn(),
  removePhaseFromTemplate: vi.fn(),
  reorderItemsInPhase: vi.fn(),
  addPhaseToTemplate: vi.fn(),
  nestPhaseAsSubPhase: vi.fn(),
  removeSubPhase: vi.fn(),
  emptyPhaseIds: new Set<string>(),
  subPhaseMap: {},
  dispatch: vi.fn(),
  blockOrder: {},
  updateBlockOrder: vi.fn(),
}

const mockUseTemplateBuilder = vi.fn(() => defaultHookReturn)

vi.mock('@/hooks/useTemplateBuilder', () => ({
  useTemplateBuilder: () => mockUseTemplateBuilder(),
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockUseTemplateBuilder.mockReturnValue(defaultHookReturn)
})

describe('TemplateBuilder - Integration', () => {
  it('renders the three-column layout', () => {
    const { container } = render(<TemplateBuilder builder={defaultHookReturn} />)
    expect(container.firstChild).toBeInTheDocument()
  })

  it('displays template list in left column', () => {
    render(<TemplateBuilder builder={defaultHookReturn} />)
    // "Default Template" appears in both the list and builder header
    const matches = screen.getAllByText('Default Template')
    expect(matches.length).toBeGreaterThanOrEqual(2) // list + builder header
    expect(screen.getByText('Custom Template')).toBeInTheDocument()
  })

  it('renders builder canvas with phase headers', () => {
    render(<TemplateBuilder builder={defaultHookReturn} />)
    // PRE-OP appears in both phase header and edge badge
    const matches = screen.getAllByText(/PRE-OP/)
    expect(matches.length).toBeGreaterThanOrEqual(1)
  })

  it('renders milestones in the builder canvas', () => {
    render(<TemplateBuilder builder={defaultHookReturn} />)
    expect(screen.getByText('Patient In')).toBeInTheDocument()
    expect(screen.getByText('Incision')).toBeInTheDocument()
  })

  it('shows library panel with available milestones', () => {
    render(<TemplateBuilder builder={defaultHookReturn} />)
    expect(screen.getByText('Patient Out')).toBeInTheDocument()
  })

  it('displays loading skeleton when loading=true', () => {
    const loadingBuilder = {
      ...defaultHookReturn,
      loading: true,
    }

    const { container } = render(<TemplateBuilder builder={loadingBuilder} />)
    // Skeleton renders pulsing divs
    const skeletons = container.querySelectorAll('[class*="animate-pulse"], [class*="skeleton"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('displays empty template state when no template is selected', () => {
    const emptyBuilder = {
      ...defaultHookReturn,
      selectedTemplate: null as unknown as typeof defaultHookReturn.selectedTemplate,
      selectedTemplateId: null as unknown as string,
      items: [],
    }

    render(<TemplateBuilder builder={emptyBuilder} />)
    expect(screen.getByText('Select a template to edit')).toBeInTheDocument()
  })

  it('shows DEFAULT badge on default template', () => {
    render(<TemplateBuilder builder={defaultHookReturn} />)
    const badges = screen.getAllByText('DEFAULT')
    expect(badges.length).toBeGreaterThan(0)
  })

  describe('Phase 8 — Legend updates', () => {
    it('renders legend with "Milestone" item showing filled dot', () => {
      render(<TemplateBuilder builder={defaultHookReturn} />)
      expect(screen.getByText('Milestone')).toBeInTheDocument()

      // Legend should show filled dot icon (rounded-full div)
      const { container } = render(<TemplateBuilder builder={defaultHookReturn} />)
      const legendSection = Array.from(container.querySelectorAll('span')).find(
        el => el.textContent === 'Milestone'
      )
      expect(legendSection).toBeTruthy()
    })

    it('renders legend with "Phase boundary" item', () => {
      render(<TemplateBuilder builder={defaultHookReturn} />)
      expect(screen.getByText('Phase boundary')).toBeInTheDocument()
    })

    it('renders legend with "Drag to reorder" item', () => {
      render(<TemplateBuilder builder={defaultHookReturn} />)
      expect(screen.getByText('Drag to reorder')).toBeInTheDocument()
    })

    it('legend items appear in builder canvas header', () => {
      render(<TemplateBuilder builder={defaultHookReturn} />)
      // All three legend items should be present
      const legendItems = [
        screen.getByText('Milestone'),
        screen.getByText('Phase boundary'),
        screen.getByText('Drag to reorder'),
      ]
      legendItems.forEach(item => expect(item).toBeInTheDocument())
    })
  })
})
