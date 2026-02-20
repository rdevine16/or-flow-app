// components/settings/flags/__tests__/RuleConfigureStep.test.tsx
// Unit tests for rule configuration form (step 2).

import { render, screen, fireEvent } from '@testing-library/react'
import { RuleConfigureStep } from '@/components/settings/flags/RuleConfigureStep'
import type { CustomRuleFormState, MetricCatalogEntry } from '@/types/flag-settings'

const mockMetric: MetricCatalogEntry = {
  id: 'total_duration',
  name: 'Total Duration',
  description: 'Total case duration',
  category: 'efficiency',
  dataType: 'minutes',
  unit: 'min',
  supportsMedian: true,
}

const mockMetricNoMedian: MetricCatalogEntry = {
  id: 'case_count',
  name: 'Case Count',
  description: 'Number of cases',
  category: 'utilization',
  dataType: 'count',
  unit: 'cases',
  supportsMedian: false,
}

describe('RuleConfigureStep', () => {
  const mockOnFormChange = vi.fn()
  const mockOnBack = vi.fn()
  const mockOnSubmit = vi.fn()

  const defaultForm: CustomRuleFormState = {
    metricId: 'total_duration',
    name: '',
    description: '',
    thresholdType: 'absolute',
    operator: 'gt',
    thresholdValue: 90,
    thresholdValueMax: null,
    severity: 'warning',
    comparisonScope: 'facility',
    costCategoryId: null,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Header and navigation', () => {
    it('displays metric name and description', () => {
      render(
        <RuleConfigureStep
          metric={mockMetric}
          form={defaultForm}
          onFormChange={mockOnFormChange}
          onBack={mockOnBack}
          onSubmit={mockOnSubmit}
        />
      )

      expect(screen.getByText('Total Duration')).toBeInTheDocument()
      expect(screen.getByText('Total case duration')).toBeInTheDocument()
    })

    it('displays category badge with correct category', () => {
      render(
        <RuleConfigureStep
          metric={mockMetric}
          form={defaultForm}
          onFormChange={mockOnFormChange}
          onBack={mockOnBack}
          onSubmit={mockOnSubmit}
        />
      )

      expect(screen.getByText('Efficiency')).toBeInTheDocument()
    })

    it('calls onBack when Back to metrics button is clicked', () => {
      render(
        <RuleConfigureStep
          metric={mockMetric}
          form={defaultForm}
          onFormChange={mockOnFormChange}
          onBack={mockOnBack}
          onSubmit={mockOnSubmit}
        />
      )

      const backButton = screen.getByText('Back to metrics')
      fireEvent.click(backButton)

      expect(mockOnBack).toHaveBeenCalledTimes(1)
    })

    it('calls onBack when Cancel button is clicked', () => {
      render(
        <RuleConfigureStep
          metric={mockMetric}
          form={defaultForm}
          onFormChange={mockOnFormChange}
          onBack={mockOnBack}
          onSubmit={mockOnSubmit}
        />
      )

      const cancelButton = screen.getByText('Cancel')
      fireEvent.click(cancelButton)

      expect(mockOnBack).toHaveBeenCalledTimes(1)
    })
  })

  describe('Form fields', () => {
    it('renders rule name input with correct placeholder', () => {
      render(
        <RuleConfigureStep
          metric={mockMetric}
          form={defaultForm}
          onFormChange={mockOnFormChange}
          onBack={mockOnBack}
          onSubmit={mockOnSubmit}
        />
      )

      const nameInput = screen.getByPlaceholderText(/e\.g\., High Total Duration/)
      expect(nameInput).toBeInTheDocument()
    })

    it('calls onFormChange when name is updated', () => {
      render(
        <RuleConfigureStep
          metric={mockMetric}
          form={defaultForm}
          onFormChange={mockOnFormChange}
          onBack={mockOnBack}
          onSubmit={mockOnSubmit}
        />
      )

      const nameInput = screen.getByPlaceholderText(/e\.g\./)
      fireEvent.change(nameInput, { target: { value: 'Long Cases' } })

      expect(mockOnFormChange).toHaveBeenCalledWith({ name: 'Long Cases' })
    })

    it('renders description input', () => {
      render(
        <RuleConfigureStep
          metric={mockMetric}
          form={defaultForm}
          onFormChange={mockOnFormChange}
          onBack={mockOnBack}
          onSubmit={mockOnSubmit}
        />
      )

      const descInput = screen.getByPlaceholderText('Optional description for this rule')
      expect(descInput).toBeInTheDocument()
    })

    it('calls onFormChange when description is updated', () => {
      render(
        <RuleConfigureStep
          metric={mockMetric}
          form={defaultForm}
          onFormChange={mockOnFormChange}
          onBack={mockOnBack}
          onSubmit={mockOnSubmit}
        />
      )

      const descInput = screen.getByPlaceholderText('Optional description for this rule')
      fireEvent.change(descInput, { target: { value: 'Cases taking too long' } })

      expect(mockOnFormChange).toHaveBeenCalledWith({ description: 'Cases taking too long' })
    })
  })

  describe('Threshold type filtering', () => {
    it('shows median-based threshold types when metric supports median', () => {
      render(
        <RuleConfigureStep
          metric={mockMetric}
          form={defaultForm}
          onFormChange={mockOnFormChange}
          onBack={mockOnBack}
          onSubmit={mockOnSubmit}
        />
      )

      const thresholdSelect = screen.getByRole('combobox', { name: /threshold type/i })
      expect(thresholdSelect).toBeInTheDocument()

      // Should have option for median-based types
      const options = Array.from(thresholdSelect.querySelectorAll('option'))
      const hasMedianOption = options.some((opt) => opt.textContent?.includes('Median'))
      expect(hasMedianOption).toBe(true)
    })

    it('hides median-based threshold types when metric does not support median', () => {
      render(
        <RuleConfigureStep
          metric={mockMetricNoMedian}
          form={defaultForm}
          onFormChange={mockOnFormChange}
          onBack={mockOnBack}
          onSubmit={mockOnSubmit}
        />
      )

      const thresholdSelect = screen.getByRole('combobox', { name: /threshold type/i })
      const options = Array.from(thresholdSelect.querySelectorAll('option'))

      // Should NOT have median_plus_sd option
      const hasMedianPlusSD = options.some((opt) => opt.value === 'median_plus_sd')
      expect(hasMedianPlusSD).toBe(false)
    })

    it('calls onFormChange with new threshold type and default value', () => {
      render(
        <RuleConfigureStep
          metric={mockMetric}
          form={defaultForm}
          onFormChange={mockOnFormChange}
          onBack={mockOnBack}
          onSubmit={mockOnSubmit}
        />
      )

      const thresholdSelect = screen.getByRole('combobox', { name: /threshold type/i })
      fireEvent.change(thresholdSelect, { target: { value: 'median_plus_sd' } })

      expect(mockOnFormChange).toHaveBeenCalledWith(
        expect.objectContaining({
          thresholdType: 'median_plus_sd',
          thresholdValue: 1.0,
        })
      )
    })
  })

  describe('Operator field', () => {
    it('shows operator dropdown when threshold type is not between', () => {
      render(
        <RuleConfigureStep
          metric={mockMetric}
          form={defaultForm}
          onFormChange={mockOnFormChange}
          onBack={mockOnBack}
          onSubmit={mockOnSubmit}
        />
      )

      expect(screen.getByRole('combobox', { name: /operator/i })).toBeInTheDocument()
    })

    it('hides operator dropdown when threshold type is between', () => {
      const betweenForm: CustomRuleFormState = {
        ...defaultForm,
        thresholdType: 'between',
      }

      render(
        <RuleConfigureStep
          metric={mockMetric}
          form={betweenForm}
          onFormChange={mockOnFormChange}
          onBack={mockOnBack}
          onSubmit={mockOnSubmit}
        />
      )

      expect(screen.queryByRole('combobox', { name: /operator/i })).not.toBeInTheDocument()
    })

    it('calls onFormChange when operator is changed', () => {
      render(
        <RuleConfigureStep
          metric={mockMetric}
          form={defaultForm}
          onFormChange={mockOnFormChange}
          onBack={mockOnBack}
          onSubmit={mockOnSubmit}
        />
      )

      const operatorSelect = screen.getByRole('combobox', { name: /operator/i })
      fireEvent.change(operatorSelect, { target: { value: 'lt' } })

      expect(mockOnFormChange).toHaveBeenCalledWith({ operator: 'lt' })
    })
  })

  describe('Value inputs', () => {
    it('shows single value input for non-between threshold types', () => {
      render(
        <RuleConfigureStep
          metric={mockMetric}
          form={defaultForm}
          onFormChange={mockOnFormChange}
          onBack={mockOnBack}
          onSubmit={mockOnSubmit}
        />
      )

      const inputs = screen.getAllByRole('spinbutton')
      expect(inputs.length).toBe(1) // Only one value input
    })

    it('shows two value inputs for between threshold type', () => {
      const betweenForm: CustomRuleFormState = {
        ...defaultForm,
        thresholdType: 'between',
        thresholdValue: 60,
        thresholdValueMax: 120,
      }

      render(
        <RuleConfigureStep
          metric={mockMetric}
          form={betweenForm}
          onFormChange={mockOnFormChange}
          onBack={mockOnBack}
          onSubmit={mockOnSubmit}
        />
      )

      const inputs = screen.getAllByRole('spinbutton')
      expect(inputs.length).toBe(2) // Min and max inputs
    })

    it('displays correct suffix for median_plus_sd type (SD)', () => {
      const medianForm: CustomRuleFormState = {
        ...defaultForm,
        thresholdType: 'median_plus_sd',
        thresholdValue: 1.5,
      }

      render(
        <RuleConfigureStep
          metric={mockMetric}
          form={medianForm}
          onFormChange={mockOnFormChange}
          onBack={mockOnBack}
          onSubmit={mockOnSubmit}
        />
      )

      expect(screen.getByText('SD')).toBeInTheDocument()
    })

    it('displays correct suffix for percentage_of_median type (%)', () => {
      const percentForm: CustomRuleFormState = {
        ...defaultForm,
        thresholdType: 'percentage_of_median',
        thresholdValue: 120,
      }

      render(
        <RuleConfigureStep
          metric={mockMetric}
          form={percentForm}
          onFormChange={mockOnFormChange}
          onBack={mockOnBack}
          onSubmit={mockOnSubmit}
        />
      )

      expect(screen.getByText('%')).toBeInTheDocument()
    })

    it('displays correct suffix for percentile type (th)', () => {
      const percentileForm: CustomRuleFormState = {
        ...defaultForm,
        thresholdType: 'percentile',
        thresholdValue: 90,
      }

      render(
        <RuleConfigureStep
          metric={mockMetric}
          form={percentileForm}
          onFormChange={mockOnFormChange}
          onBack={mockOnBack}
          onSubmit={mockOnSubmit}
        />
      )

      expect(screen.getByText('th')).toBeInTheDocument()
    })

    it('displays metric unit for absolute type', () => {
      render(
        <RuleConfigureStep
          metric={mockMetric}
          form={defaultForm}
          onFormChange={mockOnFormChange}
          onBack={mockOnBack}
          onSubmit={mockOnSubmit}
        />
      )

      expect(screen.getByText('min')).toBeInTheDocument()
    })

    it('calls onFormChange when value is updated', () => {
      render(
        <RuleConfigureStep
          metric={mockMetric}
          form={defaultForm}
          onFormChange={mockOnFormChange}
          onBack={mockOnBack}
          onSubmit={mockOnSubmit}
        />
      )

      const valueInput = screen.getByRole('spinbutton')
      fireEvent.change(valueInput, { target: { value: '150' } })

      expect(mockOnFormChange).toHaveBeenCalledWith({ thresholdValue: 150 })
    })
  })

  describe('Severity selector', () => {
    it('renders all three severity badges', () => {
      render(
        <RuleConfigureStep
          metric={mockMetric}
          form={defaultForm}
          onFormChange={mockOnFormChange}
          onBack={mockOnBack}
          onSubmit={mockOnSubmit}
        />
      )

      expect(screen.getByText(/severity/i)).toBeInTheDocument()
      // All 3 severity options visible as badges
      expect(screen.getByText('Info')).toBeInTheDocument()
      expect(screen.getByText('Warning')).toBeInTheDocument()
      expect(screen.getByText('Critical')).toBeInTheDocument()
    })

    it('highlights the currently selected severity', () => {
      render(
        <RuleConfigureStep
          metric={mockMetric}
          form={defaultForm}
          onFormChange={mockOnFormChange}
          onBack={mockOnBack}
          onSubmit={mockOnSubmit}
        />
      )

      // Warning is selected (defaultForm.severity = 'warning')
      const warningBtn = screen.getByText('Warning')
      expect(warningBtn).toHaveClass('bg-amber-50')

      // Info should be unselected
      const infoBtn = screen.getByText('Info')
      expect(infoBtn).toHaveClass('text-slate-400')
    })

    it('calls onFormChange when a different severity is clicked', () => {
      render(
        <RuleConfigureStep
          metric={mockMetric}
          form={defaultForm}
          onFormChange={mockOnFormChange}
          onBack={mockOnBack}
          onSubmit={mockOnSubmit}
        />
      )

      // Click Critical directly (not cycling)
      fireEvent.click(screen.getByText('Critical'))

      expect(mockOnFormChange).toHaveBeenCalledWith({ severity: 'critical' })
    })
  })

  describe('Comparison scope', () => {
    it('renders facility and personal scope buttons', () => {
      render(
        <RuleConfigureStep
          metric={mockMetric}
          form={defaultForm}
          onFormChange={mockOnFormChange}
          onBack={mockOnBack}
          onSubmit={mockOnSubmit}
        />
      )

      expect(screen.getByText('Facility')).toBeInTheDocument()
      expect(screen.getByText('Personal')).toBeInTheDocument()
    })

    it('highlights selected scope', () => {
      const personalForm: CustomRuleFormState = {
        ...defaultForm,
        comparisonScope: 'personal',
      }

      render(
        <RuleConfigureStep
          metric={mockMetric}
          form={personalForm}
          onFormChange={mockOnFormChange}
          onBack={mockOnBack}
          onSubmit={mockOnSubmit}
        />
      )

      const personalButton = screen.getByText('Personal')
      expect(personalButton).toHaveClass('bg-violet-50')
    })

    it('calls onFormChange when scope is changed', () => {
      render(
        <RuleConfigureStep
          metric={mockMetric}
          form={defaultForm}
          onFormChange={mockOnFormChange}
          onBack={mockOnBack}
          onSubmit={mockOnSubmit}
        />
      )

      const personalButton = screen.getByText('Personal')
      fireEvent.click(personalButton)

      expect(mockOnFormChange).toHaveBeenCalledWith({ comparisonScope: 'personal' })
    })

    it('shows correct description for facility scope', () => {
      render(
        <RuleConfigureStep
          metric={mockMetric}
          form={defaultForm}
          onFormChange={mockOnFormChange}
          onBack={mockOnBack}
          onSubmit={mockOnSubmit}
        />
      )

      expect(screen.getByText('Compare against all facility cases')).toBeInTheDocument()
    })

    it('shows correct description for personal scope', () => {
      const personalForm: CustomRuleFormState = {
        ...defaultForm,
        comparisonScope: 'personal',
      }

      render(
        <RuleConfigureStep
          metric={mockMetric}
          form={personalForm}
          onFormChange={mockOnFormChange}
          onBack={mockOnBack}
          onSubmit={mockOnSubmit}
        />
      )

      expect(screen.getByText("Compare against each surgeon's own historical data")).toBeInTheDocument()
    })
  })

  describe('Submit button state', () => {
    it('Add Rule button is disabled when name is empty', () => {
      render(
        <RuleConfigureStep
          metric={mockMetric}
          form={defaultForm}
          onFormChange={mockOnFormChange}
          onBack={mockOnBack}
          onSubmit={mockOnSubmit}
        />
      )

      const addButton = screen.getByText('Add Rule')
      expect(addButton).toBeDisabled()
    })

    it('Add Rule button is disabled when name is only whitespace', () => {
      const whitespaceName: CustomRuleFormState = {
        ...defaultForm,
        name: '   ',
      }

      render(
        <RuleConfigureStep
          metric={mockMetric}
          form={whitespaceName}
          onFormChange={mockOnFormChange}
          onBack={mockOnBack}
          onSubmit={mockOnSubmit}
        />
      )

      const addButton = screen.getByText('Add Rule')
      expect(addButton).toBeDisabled()
    })

    it('Add Rule button is enabled when name has content', () => {
      const filledForm: CustomRuleFormState = {
        ...defaultForm,
        name: 'Long Cases',
      }

      render(
        <RuleConfigureStep
          metric={mockMetric}
          form={filledForm}
          onFormChange={mockOnFormChange}
          onBack={mockOnBack}
          onSubmit={mockOnSubmit}
        />
      )

      const addButton = screen.getByText('Add Rule')
      expect(addButton).not.toBeDisabled()
    })

    it('calls onSubmit when Add Rule button is clicked', () => {
      const filledForm: CustomRuleFormState = {
        ...defaultForm,
        name: 'Long Cases',
      }

      render(
        <RuleConfigureStep
          metric={mockMetric}
          form={filledForm}
          onFormChange={mockOnFormChange}
          onBack={mockOnBack}
          onSubmit={mockOnSubmit}
        />
      )

      const addButton = screen.getByText('Add Rule')
      fireEvent.click(addButton)

      expect(mockOnSubmit).toHaveBeenCalledTimes(1)
    })
  })

  describe('Rule preview integration', () => {
    it('renders RulePreviewSentence component', () => {
      const filledForm: CustomRuleFormState = {
        ...defaultForm,
        name: 'Long Cases',
        thresholdType: 'absolute',
        operator: 'gt',
        thresholdValue: 120,
      }

      render(
        <RuleConfigureStep
          metric={mockMetric}
          form={filledForm}
          onFormChange={mockOnFormChange}
          onBack={mockOnBack}
          onSubmit={mockOnSubmit}
        />
      )

      expect(screen.getByText('Rule Preview')).toBeInTheDocument()
      expect(screen.getByText(/Flag cases where total duration/)).toBeInTheDocument()
    })

    it('preview updates when threshold type changes', () => {
      const filledForm: CustomRuleFormState = {
        ...defaultForm,
        name: 'Long Cases',
        thresholdType: 'median_plus_sd',
        thresholdValue: 1.5,
      }

      render(
        <RuleConfigureStep
          metric={mockMetric}
          form={filledForm}
          onFormChange={mockOnFormChange}
          onBack={mockOnBack}
          onSubmit={mockOnSubmit}
        />
      )

      const matches = screen.getAllByText(/standard deviation/i)
      expect(matches.length).toBeGreaterThan(0)
    })
  })
})
