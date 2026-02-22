// app/admin/facilities/new/__tests__/ClinicalTemplatesStep.test.tsx
// Tests for ClinicalTemplatesStep component (Step 3 of facility wizard)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ClinicalTemplatesStep from '../ClinicalTemplatesStep'
import type { TemplateConfig, TemplateCounts } from '../types'
import { DEFAULT_TEMPLATE_CONFIG, DEFAULT_TEMPLATE_COUNTS } from '../types'

describe('ClinicalTemplatesStep', () => {
  const mockOnChange = vi.fn()

  const LOADED_COUNTS: TemplateCounts = {
    ...DEFAULT_TEMPLATE_COUNTS,
    milestones: 12,
    procedures: 25,
    procedureMilestoneConfig: 8,
    delayTypes: 6,
    cancellationReasons: 4,
    complexities: 3,
    checklistFields: 10,
  }

  function setup(
    config: Partial<TemplateConfig> = {},
    counts: TemplateCounts = LOADED_COUNTS,
    loadingCounts = false,
  ) {
    const fullConfig: TemplateConfig = { ...DEFAULT_TEMPLATE_CONFIG, ...config }
    return render(
      <ClinicalTemplatesStep
        config={fullConfig}
        counts={counts}
        loadingCounts={loadingCounts}
        onChange={mockOnChange}
      />,
    )
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ============================================================================
  // RENDERING
  // ============================================================================

  describe('Rendering', () => {
    it('renders the clinical templates step with heading and description', () => {
      setup()
      expect(screen.getByText('Clinical Templates')).toBeTruthy()
      expect(screen.getByText(/Select which clinical data templates/)).toBeTruthy()
    })

    it('renders Clinical Data section header', () => {
      setup()
      expect(screen.getByText('Clinical Data')).toBeTruthy()
    })

    it('renders Workflow & Policies section header', () => {
      setup()
      expect(screen.getByText('Workflow & Policies')).toBeTruthy()
    })

    it('renders all 7 clinical template cards', () => {
      setup()
      expect(screen.getByTestId('template-card-milestones')).toBeTruthy()
      expect(screen.getByTestId('template-card-procedures')).toBeTruthy()
      expect(screen.getByTestId('template-card-procedureMilestoneConfig')).toBeTruthy()
      expect(screen.getByTestId('template-card-delayTypes')).toBeTruthy()
      expect(screen.getByTestId('template-card-cancellationReasons')).toBeTruthy()
      expect(screen.getByTestId('template-card-complexities')).toBeTruthy()
      expect(screen.getByTestId('template-card-checklistFields')).toBeTruthy()
    })

    it('renders template counts as badges', () => {
      setup()
      expect(screen.getByText('12')).toBeTruthy() // milestones
      expect(screen.getByText('25')).toBeTruthy() // procedures
      expect(screen.getByText('6')).toBeTruthy()  // delayTypes
    })

    it('renders category descriptions', () => {
      setup()
      expect(screen.getByText(/Surgical workflow milestone types/)).toBeTruthy()
      expect(screen.getByText(/Procedure type definitions/)).toBeTruthy()
      expect(screen.getByText(/Standard delay reason/)).toBeTruthy()
    })

    it('renders loading skeletons when counts are loading', () => {
      setup({}, DEFAULT_TEMPLATE_COUNTS, true)
      // Should not render count numbers when loading
      expect(screen.queryByText('12')).toBeNull()
    })

    it('renders all checkboxes as checked when all config is true', () => {
      setup()
      const checkboxes = screen.getAllByRole('checkbox')
      checkboxes.forEach((cb) => {
        expect((cb as HTMLInputElement).checked).toBe(true)
      })
    })

    it('renders master Select All button', () => {
      setup()
      expect(screen.getByTestId('clinical-select-all')).toBeTruthy()
    })

    it('shows "Deselect All" when all are selected', () => {
      setup()
      expect(screen.getByTestId('clinical-select-all').textContent).toBe('Deselect All')
    })

    it('shows "Select All" when not all are selected', () => {
      setup({ milestones: false })
      expect(screen.getByTestId('clinical-select-all').textContent).toBe('Select All')
    })
  })

  // ============================================================================
  // INDIVIDUAL TOGGLES
  // ============================================================================

  describe('Individual Toggles', () => {
    it('toggles milestones off when clicked', () => {
      setup()
      const card = screen.getByTestId('template-card-milestones')
      const checkbox = card.querySelector('input[type="checkbox"]') as HTMLInputElement
      fireEvent.click(checkbox)
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({ milestones: false }),
      )
    })

    it('toggles delayTypes off when clicked', () => {
      setup()
      const card = screen.getByTestId('template-card-delayTypes')
      const checkbox = card.querySelector('input[type="checkbox"]') as HTMLInputElement
      fireEvent.click(checkbox)
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({ delayTypes: false }),
      )
    })

    it('toggles a category on when clicked from off', () => {
      setup({ cancellationReasons: false })
      const card = screen.getByTestId('template-card-cancellationReasons')
      const checkbox = card.querySelector('input[type="checkbox"]') as HTMLInputElement
      fireEvent.click(checkbox)
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({ cancellationReasons: true }),
      )
    })
  })

  // ============================================================================
  // AUTO-LINK: PROCEDURE-MILESTONE CONFIG
  // ============================================================================

  describe('Auto-Link Behavior', () => {
    it('auto-disables procedureMilestoneConfig when milestones is toggled off', () => {
      setup({ milestones: true, procedures: true, procedureMilestoneConfig: true })
      const card = screen.getByTestId('template-card-milestones')
      const checkbox = card.querySelector('input[type="checkbox"]') as HTMLInputElement
      fireEvent.click(checkbox)
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          milestones: false,
          procedureMilestoneConfig: false,
        }),
      )
    })

    it('auto-disables procedureMilestoneConfig when procedures is toggled off', () => {
      setup({ milestones: true, procedures: true, procedureMilestoneConfig: true })
      const card = screen.getByTestId('template-card-procedures')
      const checkbox = card.querySelector('input[type="checkbox"]') as HTMLInputElement
      fireEvent.click(checkbox)
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          procedures: false,
          procedureMilestoneConfig: false,
        }),
      )
    })

    it('auto-enables procedureMilestoneConfig when both milestones and procedures are on', () => {
      setup({ milestones: false, procedures: true, procedureMilestoneConfig: false })
      const card = screen.getByTestId('template-card-milestones')
      const checkbox = card.querySelector('input[type="checkbox"]') as HTMLInputElement
      fireEvent.click(checkbox)
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          milestones: true,
          procedures: true,
          procedureMilestoneConfig: true,
        }),
      )
    })

    it('shows auto-linked hint when procedureMilestoneConfig is disabled due to dependencies', () => {
      setup({ milestones: false, procedures: true })
      expect(screen.getByText(/Auto-enabled when both Milestones and Procedures/)).toBeTruthy()
    })

    it('does not show auto-linked hint when both dependencies are enabled', () => {
      setup({ milestones: true, procedures: true })
      expect(screen.queryByText(/Auto-enabled when both Milestones and Procedures/)).toBeNull()
    })

    it('disables procedureMilestoneConfig checkbox when dependencies are not met', () => {
      setup({ milestones: false, procedures: true })
      const card = screen.getByTestId('template-card-procedureMilestoneConfig')
      const checkbox = card.querySelector('input[type="checkbox"]') as HTMLInputElement
      expect(checkbox.disabled).toBe(true)
    })
  })

  // ============================================================================
  // SECTION TOGGLES
  // ============================================================================

  describe('Section Toggles', () => {
    it('deselects all clinical data categories when section toggle is clicked', () => {
      setup()
      const sectionButtons = screen.getAllByText('Deselect Section')
      fireEvent.click(sectionButtons[0]) // Clinical Data section
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          milestones: false,
          procedures: false,
          procedureMilestoneConfig: false,
        }),
      )
    })

    it('selects all workflow categories when section toggle is clicked', () => {
      setup({
        delayTypes: false,
        cancellationReasons: false,
        complexities: false,
        checklistFields: false,
      })
      const sectionButtons = screen.getAllByText('Select Section')
      // The second "Select Section" is Workflow & Policies
      fireEvent.click(sectionButtons[sectionButtons.length - 1])
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          delayTypes: true,
          cancellationReasons: true,
          complexities: true,
          checklistFields: true,
        }),
      )
    })
  })

  // ============================================================================
  // MASTER TOGGLE
  // ============================================================================

  describe('Master Toggle', () => {
    it('deselects all categories when all are selected', () => {
      setup()
      fireEvent.click(screen.getByTestId('clinical-select-all'))
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          milestones: false,
          procedures: false,
          procedureMilestoneConfig: false,
          delayTypes: false,
          cancellationReasons: false,
          complexities: false,
          checklistFields: false,
        }),
      )
    })

    it('selects all categories when some are deselected', () => {
      setup({ milestones: false, delayTypes: false })
      fireEvent.click(screen.getByTestId('clinical-select-all'))
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          milestones: true,
          procedures: true,
          procedureMilestoneConfig: true,
          delayTypes: true,
          cancellationReasons: true,
          complexities: true,
          checklistFields: true,
        }),
      )
    })
  })

  // ============================================================================
  // DISABLED STATE
  // ============================================================================

  describe('Disabled State', () => {
    it('disables checkbox when template count is 0', () => {
      const zeroCounts = {
        ...LOADED_COUNTS,
        complexities: 0,
      }
      setup({}, zeroCounts)
      const card = screen.getByTestId('template-card-complexities')
      const checkbox = card.querySelector('input[type="checkbox"]') as HTMLInputElement
      expect(checkbox.disabled).toBe(true)
    })

    it('shows amber badge for zero-count categories', () => {
      const zeroCounts = {
        ...LOADED_COUNTS,
        complexities: 0,
      }
      setup({}, zeroCounts)
      const card = screen.getByTestId('template-card-complexities')
      const badge = card.querySelector('.bg-amber-50')
      expect(badge).toBeTruthy()
      expect(badge?.textContent).toBe('0')
    })
  })
})
