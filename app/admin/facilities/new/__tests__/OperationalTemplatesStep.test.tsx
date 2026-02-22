// app/admin/facilities/new/__tests__/OperationalTemplatesStep.test.tsx
// Tests for OperationalTemplatesStep component (Step 4 of facility wizard)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import OperationalTemplatesStep from '../OperationalTemplatesStep'
import type { TemplateConfig, TemplateCounts } from '../types'
import { DEFAULT_TEMPLATE_CONFIG, DEFAULT_TEMPLATE_COUNTS } from '../types'

describe('OperationalTemplatesStep', () => {
  const mockOnChange = vi.fn()

  const LOADED_COUNTS: TemplateCounts = {
    ...DEFAULT_TEMPLATE_COUNTS,
    costCategories: 8,
    implantCompanies: 15,
    payers: 20,
    analyticsSettings: 1,
    flagRules: 32,
    phaseDefinitions: 5,
    notificationSettings: 1,
  }

  function setup(
    config: Partial<TemplateConfig> = {},
    counts: TemplateCounts = LOADED_COUNTS,
    loadingCounts = false,
  ) {
    const fullConfig: TemplateConfig = { ...DEFAULT_TEMPLATE_CONFIG, ...config }
    return render(
      <OperationalTemplatesStep
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
    it('renders the operational templates step with heading and description', () => {
      setup()
      expect(screen.getByText('Operational Templates')).toBeTruthy()
      expect(screen.getByText(/Select which operational and analytics templates/)).toBeTruthy()
    })

    it('renders Financial section header', () => {
      setup()
      expect(screen.getByText('Financial')).toBeTruthy()
    })

    it('renders Analytics & Alerts section header', () => {
      setup()
      expect(screen.getByText('Analytics & Alerts')).toBeTruthy()
    })

    it('renders all 7 operational template cards', () => {
      setup()
      expect(screen.getByTestId('template-card-costCategories')).toBeTruthy()
      expect(screen.getByTestId('template-card-implantCompanies')).toBeTruthy()
      expect(screen.getByTestId('template-card-payers')).toBeTruthy()
      expect(screen.getByTestId('template-card-analyticsSettings')).toBeTruthy()
      expect(screen.getByTestId('template-card-flagRules')).toBeTruthy()
      expect(screen.getByTestId('template-card-phaseDefinitions')).toBeTruthy()
      expect(screen.getByTestId('template-card-notificationSettings')).toBeTruthy()
    })

    it('renders template counts as badges', () => {
      setup()
      expect(screen.getByText('8')).toBeTruthy()  // costCategories
      expect(screen.getByText('15')).toBeTruthy() // implantCompanies
      expect(screen.getByText('20')).toBeTruthy() // payers
      expect(screen.getByText('32')).toBeTruthy() // flagRules
    })

    it('renders category descriptions', () => {
      setup()
      expect(screen.getByText(/Financial cost tracking categories/)).toBeTruthy()
      expect(screen.getByText(/Implant vendor definitions/)).toBeTruthy()
      expect(screen.getByText(/Insurance payer definitions/)).toBeTruthy()
    })

    it('renders loading skeletons when counts are loading', () => {
      setup({}, DEFAULT_TEMPLATE_COUNTS, true)
      expect(screen.queryByText('8')).toBeNull()
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
      expect(screen.getByTestId('operational-select-all')).toBeTruthy()
    })

    it('shows "Deselect All" when all are selected', () => {
      setup()
      expect(screen.getByTestId('operational-select-all').textContent).toBe('Deselect All')
    })

    it('shows "Select All" when not all are selected', () => {
      setup({ costCategories: false })
      expect(screen.getByTestId('operational-select-all').textContent).toBe('Select All')
    })
  })

  // ============================================================================
  // INDIVIDUAL TOGGLES
  // ============================================================================

  describe('Individual Toggles', () => {
    it('toggles costCategories off when clicked', () => {
      setup()
      const card = screen.getByTestId('template-card-costCategories')
      const checkbox = card.querySelector('input[type="checkbox"]') as HTMLInputElement
      fireEvent.click(checkbox)
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({ costCategories: false }),
      )
    })

    it('toggles flagRules off when clicked', () => {
      setup()
      const card = screen.getByTestId('template-card-flagRules')
      const checkbox = card.querySelector('input[type="checkbox"]') as HTMLInputElement
      fireEvent.click(checkbox)
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({ flagRules: false }),
      )
    })

    it('toggles a category on when clicked from off', () => {
      setup({ payers: false })
      const card = screen.getByTestId('template-card-payers')
      const checkbox = card.querySelector('input[type="checkbox"]') as HTMLInputElement
      fireEvent.click(checkbox)
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({ payers: true }),
      )
    })

    it('does not affect other categories when toggling one', () => {
      setup()
      const card = screen.getByTestId('template-card-costCategories')
      const checkbox = card.querySelector('input[type="checkbox"]') as HTMLInputElement
      fireEvent.click(checkbox)
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          costCategories: false,
          implantCompanies: true,
          payers: true,
          flagRules: true,
        }),
      )
    })
  })

  // ============================================================================
  // SECTION TOGGLES
  // ============================================================================

  describe('Section Toggles', () => {
    it('deselects all financial categories when section toggle is clicked', () => {
      setup()
      const sectionButtons = screen.getAllByText('Deselect Section')
      fireEvent.click(sectionButtons[0]) // Financial section
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          costCategories: false,
          implantCompanies: false,
          payers: false,
        }),
      )
    })

    it('selects all analytics categories when section toggle is clicked', () => {
      setup({
        analyticsSettings: false,
        flagRules: false,
        phaseDefinitions: false,
        notificationSettings: false,
      })
      const sectionButtons = screen.getAllByText('Select Section')
      fireEvent.click(sectionButtons[sectionButtons.length - 1])
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          analyticsSettings: true,
          flagRules: true,
          phaseDefinitions: true,
          notificationSettings: true,
        }),
      )
    })

    it('section toggle does not affect other sections', () => {
      setup()
      const sectionButtons = screen.getAllByText('Deselect Section')
      fireEvent.click(sectionButtons[0]) // Financial section
      // Analytics categories should remain untouched
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          analyticsSettings: true,
          flagRules: true,
          phaseDefinitions: true,
          notificationSettings: true,
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
      fireEvent.click(screen.getByTestId('operational-select-all'))
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          costCategories: false,
          implantCompanies: false,
          payers: false,
          analyticsSettings: false,
          flagRules: false,
          phaseDefinitions: false,
          notificationSettings: false,
        }),
      )
    })

    it('selects all categories when some are deselected', () => {
      setup({ costCategories: false, flagRules: false })
      fireEvent.click(screen.getByTestId('operational-select-all'))
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          costCategories: true,
          implantCompanies: true,
          payers: true,
          analyticsSettings: true,
          flagRules: true,
          phaseDefinitions: true,
          notificationSettings: true,
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
        notificationSettings: 0,
      }
      setup({}, zeroCounts)
      const card = screen.getByTestId('template-card-notificationSettings')
      const checkbox = card.querySelector('input[type="checkbox"]') as HTMLInputElement
      expect(checkbox.disabled).toBe(true)
    })

    it('shows amber badge for zero-count categories', () => {
      const zeroCounts = {
        ...LOADED_COUNTS,
        notificationSettings: 0,
      }
      setup({}, zeroCounts)
      const card = screen.getByTestId('template-card-notificationSettings')
      const badge = card.querySelector('.bg-amber-50')
      expect(badge).toBeTruthy()
      expect(badge?.textContent).toBe('0')
    })

    it('does not disable checkbox when count > 0', () => {
      setup()
      const card = screen.getByTestId('template-card-flagRules')
      const checkbox = card.querySelector('input[type="checkbox"]') as HTMLInputElement
      expect(checkbox.disabled).toBe(false)
    })
  })
})
