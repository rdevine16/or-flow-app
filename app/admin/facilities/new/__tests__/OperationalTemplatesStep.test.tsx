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
      expect(screen.getByText('Operational Configuration')).toBeTruthy()
      expect(screen.getByText(/Financial, analytics, and notification defaults/)).toBeTruthy()
    })

    it('renders Financial section header', () => {
      setup()
      expect(screen.getByText('Financial')).toBeTruthy()
    })

    it('renders Analytics & Alerts section header', () => {
      setup()
      expect(screen.getByText('Analytics & Alerts')).toBeTruthy()
    })

    it('renders all 6 operational template cards', () => {
      setup()
      expect(screen.getByTestId('template-card-costCategories')).toBeTruthy()
      expect(screen.getByTestId('template-card-implantCompanies')).toBeTruthy()
      expect(screen.getByTestId('template-card-payers')).toBeTruthy()
      expect(screen.getByTestId('template-card-analyticsSettings')).toBeTruthy()
      expect(screen.getByTestId('template-card-flagRules')).toBeTruthy()
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
      expect(screen.getByText(/Medical device vendor directory/)).toBeTruthy()
      expect(screen.getByText(/Insurance payer configurations/)).toBeTruthy()
    })

    it('renders loading skeletons when counts are loading', () => {
      setup({}, DEFAULT_TEMPLATE_COUNTS, true)
      expect(screen.queryByText('8')).toBeNull()
    })

    it('renders all template rows as checked when all config is true', () => {
      setup()
      const checkboxes = screen.getAllByRole('checkbox')
      checkboxes.forEach((cb) => {
        expect(cb.getAttribute('aria-checked')).toBe('true')
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
      fireEvent.click(screen.getByTestId('template-card-costCategories'))
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({ costCategories: false }),
      )
    })

    it('toggles flagRules off when clicked', () => {
      setup()
      fireEvent.click(screen.getByTestId('template-card-flagRules'))
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({ flagRules: false }),
      )
    })

    it('toggles a category on when clicked from off', () => {
      setup({ payers: false })
      fireEvent.click(screen.getByTestId('template-card-payers'))
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({ payers: true }),
      )
    })

    it('does not affect other categories when toggling one', () => {
      setup()
      fireEvent.click(screen.getByTestId('template-card-costCategories'))
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
          notificationSettings: true,
        }),
      )
    })
  })

  // ============================================================================
  // DISABLED STATE
  // ============================================================================

  describe('Disabled State', () => {
    it('disables button when template count is 0', () => {
      const zeroCounts = {
        ...LOADED_COUNTS,
        notificationSettings: 0,
      }
      setup({}, zeroCounts)
      const card = screen.getByTestId('template-card-notificationSettings') as HTMLButtonElement
      expect(card.disabled).toBe(true)
    })

    it('shows zero count badge for zero-count categories', () => {
      const zeroCounts = {
        ...LOADED_COUNTS,
        notificationSettings: 0,
      }
      setup({}, zeroCounts)
      const card = screen.getByTestId('template-card-notificationSettings')
      expect(card.textContent).toContain('0')
    })

    it('does not disable button when count > 0', () => {
      setup()
      const card = screen.getByTestId('template-card-flagRules') as HTMLButtonElement
      expect(card.disabled).toBe(false)
    })
  })
})
