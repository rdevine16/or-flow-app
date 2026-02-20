// components/settings/flags/__tests__/ThresholdInline.test.tsx
// Unit tests for ThresholdInline component

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThresholdInline } from '../ThresholdInline'
import type { FlagRule } from '@/types/flag-settings'

const mockAbsoluteRule: FlagRule = {
  id: 'rule-1',
  facility_id: 'fac-1',
  name: 'Long Incision-to-Close',
  description: 'Case took too long',
  category: 'timing',
  metric: 'incision_to_close_duration',
  start_milestone: 'incision',
  end_milestone: 'closure',
  operator: 'gt',
  threshold_type: 'absolute',
  threshold_value: 90,
  threshold_value_max: null,
  comparison_scope: 'facility',
  severity: 'warning',
  display_order: 1,
  is_built_in: true,
  is_enabled: true,
  is_active: true,
  source_rule_id: null,
  cost_category_id: null,
  deleted_at: null,
  deleted_by: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

const mockBetweenRule: FlagRule = {
  ...mockAbsoluteRule,
  id: 'rule-2',
  threshold_type: 'between',
  threshold_value: 30,
  threshold_value_max: 60,
}

const mockMedianSDRule: FlagRule = {
  ...mockAbsoluteRule,
  id: 'rule-3',
  threshold_type: 'median_plus_sd',
  threshold_value: 1.5,
}

describe('ThresholdInline', () => {
  const mockHandlers = {
    onThresholdTypeChange: vi.fn(),
    onOperatorChange: vi.fn(),
    onValueChange: vi.fn(),
    onValueMaxChange: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('threshold type selector', () => {
    it('renders threshold type dropdown', () => {
      render(<ThresholdInline rule={mockAbsoluteRule} {...mockHandlers} />)
      const select = screen.getByDisplayValue('Absolute Value')
      expect(select).toBeDefined()
    })

    it('calls onThresholdTypeChange with new type and default value when type changes', async () => {
      const user = userEvent.setup()
      render(<ThresholdInline rule={mockAbsoluteRule} {...mockHandlers} />)

      const select = screen.getByDisplayValue('Absolute Value')
      await user.selectOptions(select, 'percentile')

      expect(mockHandlers.onThresholdTypeChange).toHaveBeenCalledWith('percentile', 90)
    })

    it('uses computed value as default when switching from median+SD to absolute', async () => {
      const user = userEvent.setup()
      const baselines = { median: 60, sd: 10 }
      render(
        <ThresholdInline
          rule={mockMedianSDRule}
          {...mockHandlers}
          baselines={baselines}
        />
      )

      // Computed: 60 + (1.5 * 10) = 75
      const select = screen.getByDisplayValue('Median + Std Deviations')
      await user.selectOptions(select, 'absolute')

      expect(mockHandlers.onThresholdTypeChange).toHaveBeenCalledWith('absolute', 75)
    })
  })

  describe('operator selector', () => {
    it('renders operator dropdown for non-between thresholds', () => {
      render(<ThresholdInline rule={mockAbsoluteRule} {...mockHandlers} />)
      const select = screen.getByDisplayValue('>')
      expect(select).toBeDefined()
    })

    it('hides operator dropdown for between threshold type', () => {
      render(<ThresholdInline rule={mockBetweenRule} {...mockHandlers} />)
      const operatorSelects = screen.queryAllByDisplayValue('>')
      expect(operatorSelects.length).toBe(0)
    })

    it('calls onOperatorChange when operator is changed', async () => {
      const user = userEvent.setup()
      render(<ThresholdInline rule={mockAbsoluteRule} {...mockHandlers} />)

      const select = screen.getByDisplayValue('>')
      await user.selectOptions(select, 'gte')

      expect(mockHandlers.onOperatorChange).toHaveBeenCalledWith('gte')
    })
  })

  describe('value inputs - absolute', () => {
    it('renders single value input for absolute threshold', () => {
      render(<ThresholdInline rule={mockAbsoluteRule} {...mockHandlers} />)
      const input = screen.getByDisplayValue('90')
      expect(input).toBeDefined()
    })

    it('calls onValueChange when value is edited', () => {
      render(<ThresholdInline rule={mockAbsoluteRule} {...mockHandlers} />)

      const input = screen.getByDisplayValue('90') as HTMLInputElement
      fireEvent.change(input, { target: { value: '120' } })

      expect(mockHandlers.onValueChange).toHaveBeenCalledWith(120)
    })

    it('displays unit suffix (min) for duration metrics', () => {
      render(<ThresholdInline rule={mockAbsoluteRule} {...mockHandlers} />)
      expect(screen.getByText('min')).toBeDefined()
    })
  })

  describe('value inputs - between', () => {
    it('renders two value inputs for between threshold', () => {
      render(<ThresholdInline rule={mockBetweenRule} {...mockHandlers} />)
      const inputs = screen.getAllByRole('spinbutton')
      expect(inputs.length).toBe(2)
      expect(inputs[0]).toHaveValue(30)
      expect(inputs[1]).toHaveValue(60)
    })

    it('renders "to" separator between inputs', () => {
      render(<ThresholdInline rule={mockBetweenRule} {...mockHandlers} />)
      expect(screen.getByText('to')).toBeDefined()
    })

    it('calls onValueChange when min value is edited', () => {
      render(<ThresholdInline rule={mockBetweenRule} {...mockHandlers} />)

      const inputs = screen.getAllByRole('spinbutton') as HTMLInputElement[]
      fireEvent.change(inputs[0], { target: { value: '20' } })

      expect(mockHandlers.onValueChange).toHaveBeenCalledWith(20)
    })

    it('calls onValueMaxChange when max value is edited', () => {
      render(<ThresholdInline rule={mockBetweenRule} {...mockHandlers} />)

      const inputs = screen.getAllByRole('spinbutton') as HTMLInputElement[]
      fireEvent.change(inputs[1], { target: { value: '80' } })

      expect(mockHandlers.onValueMaxChange).toHaveBeenCalledWith(80)
    })
  })

  describe('value inputs - median+SD', () => {
    it('renders + prefix for median+SD', () => {
      render(<ThresholdInline rule={mockMedianSDRule} {...mockHandlers} />)
      expect(screen.getByText('+')).toBeDefined()
    })

    it('displays SD suffix for median+SD', () => {
      render(<ThresholdInline rule={mockMedianSDRule} {...mockHandlers} />)
      expect(screen.getByText('SD')).toBeDefined()
    })

    it('computes and displays baseline value when baselines provided', () => {
      const baselines = { median: 60, sd: 10 }
      render(
        <ThresholdInline
          rule={mockMedianSDRule}
          {...mockHandlers}
          baselines={baselines}
        />
      )

      // Computed: 60 + (1.5 * 10) = 75
      expect(screen.getByText(/≈/)).toBeDefined()
      expect(screen.getByText(/75 min/)).toBeDefined()
    })

    it('shows "Per surgeon × procedure" when baselines not available', () => {
      render(<ThresholdInline rule={mockMedianSDRule} {...mockHandlers} />)
      expect(screen.getByText(/Per surgeon × procedure/)).toBeDefined()
    })

    it('shows breakdown in baseline computation', () => {
      const baselines = { median: 60, sd: 10 }
      render(
        <ThresholdInline
          rule={mockMedianSDRule}
          {...mockHandlers}
          baselines={baselines}
        />
      )

      // Should show: (60m + 15)
      expect(screen.getByText(/\(60m \+ 15\)/)).toBeDefined()
    })
  })

  describe('disabled state', () => {
    it('disables all inputs when disabled=true', () => {
      render(<ThresholdInline rule={mockAbsoluteRule} {...mockHandlers} disabled={true} />)

      const typeSelect = screen.getByDisplayValue('Absolute Value')
      const operatorSelect = screen.getByDisplayValue('>')
      const valueInput = screen.getByDisplayValue('90')

      expect(typeSelect.getAttribute('disabled')).not.toBeNull()
      expect(operatorSelect.getAttribute('disabled')).not.toBeNull()
      expect(valueInput.getAttribute('disabled')).not.toBeNull()
    })
  })

  describe('unit suffix logic', () => {
    it('shows % for percentage_of_median threshold type', () => {
      const rule = { ...mockAbsoluteRule, threshold_type: 'percentage_of_median' as const }
      render(<ThresholdInline rule={rule} {...mockHandlers} />)
      expect(screen.getByText('%')).toBeDefined()
    })

    it('shows th for percentile threshold type', () => {
      const rule = { ...mockAbsoluteRule, threshold_type: 'percentile' as const }
      render(<ThresholdInline rule={rule} {...mockHandlers} />)
      expect(screen.getByText('th')).toBeDefined()
    })
  })

  describe('step attribute logic', () => {
    it('uses 0.5 step for median+SD', () => {
      render(<ThresholdInline rule={mockMedianSDRule} {...mockHandlers} />)
      const input = screen.getByDisplayValue('1.5')
      expect(input.getAttribute('step')).toBe('0.5')
    })

    it('uses 5 step for percentages', () => {
      const rule = { ...mockAbsoluteRule, threshold_type: 'percentage_of_median' as const }
      render(<ThresholdInline rule={rule} {...mockHandlers} />)
      const input = screen.getByRole('spinbutton')
      expect(input.getAttribute('step')).toBe('5')
    })

    it('uses 5 step for percentiles', () => {
      const rule = { ...mockAbsoluteRule, threshold_type: 'percentile' as const }
      render(<ThresholdInline rule={rule} {...mockHandlers} />)
      const input = screen.getByRole('spinbutton')
      expect(input.getAttribute('step')).toBe('5')
    })
  })

  describe('min/max constraints', () => {
    it('sets min=0.5 for median+SD', () => {
      render(<ThresholdInline rule={mockMedianSDRule} {...mockHandlers} />)
      const input = screen.getByDisplayValue('1.5')
      expect(input.getAttribute('min')).toBe('0.5')
    })

    it('sets max=5 for median+SD', () => {
      render(<ThresholdInline rule={mockMedianSDRule} {...mockHandlers} />)
      const input = screen.getByDisplayValue('1.5')
      expect(input.getAttribute('max')).toBe('5')
    })

    it('sets max=99 for percentile', () => {
      const rule = { ...mockAbsoluteRule, threshold_type: 'percentile' as const, threshold_value: 90 }
      render(<ThresholdInline rule={rule} {...mockHandlers} />)
      const input = screen.getByDisplayValue('90')
      expect(input.getAttribute('max')).toBe('99')
    })
  })
})
