// components/settings/flags/__tests__/RulePreviewSentence.test.tsx
// Unit tests for natural-language rule preview component.

import { render, screen } from '@testing-library/react'
import { RulePreviewSentence } from '@/components/settings/flags/RulePreviewSentence'
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

const mockCurrencyMetric: MetricCatalogEntry = {
  id: 'or_cost',
  name: 'OR Cost',
  description: 'Operating room cost',
  category: 'cost',
  dataType: 'currency',
  unit: 'USD',
  supportsMedian: true,
}

const mockPercentageMetric: MetricCatalogEntry = {
  id: 'on_time_rate',
  name: 'On-Time Rate',
  description: 'Percentage of on-time starts',
  category: 'timing',
  dataType: 'percentage',
  unit: '%',
  supportsMedian: false,
}

describe('RulePreviewSentence', () => {
  describe('Threshold type: median_plus_sd', () => {
    it('renders correct sentence for 1 SD', () => {
      const form: CustomRuleFormState = {
        metricId: 'total_duration',
        name: 'Long Cases',
        description: '',
        thresholdType: 'median_plus_sd',
        operator: 'gt',
        thresholdValue: 1.0,
        thresholdValueMax: null,
        severity: 'warning',
        comparisonScope: 'facility',
        costCategoryId: null,
      }

      render(<RulePreviewSentence form={form} metric={mockMetric} />)

      expect(
        screen.getByText(/Flag cases where total duration is greater than 1 standard deviation from the facility median/)
      ).toBeInTheDocument()
    })

    it('renders correct sentence for 2 SDs (plural)', () => {
      const form: CustomRuleFormState = {
        metricId: 'total_duration',
        name: 'Very Long Cases',
        description: '',
        thresholdType: 'median_plus_sd',
        operator: 'gt',
        thresholdValue: 2.0,
        thresholdValueMax: null,
        severity: 'critical',
        comparisonScope: 'facility',
        costCategoryId: null,
      }

      render(<RulePreviewSentence form={form} metric={mockMetric} />)

      expect(
        screen.getByText(/Flag cases where total duration is greater than 2 standard deviations from the facility median/)
      ).toBeInTheDocument()
    })

    it('uses personal scope in sentence', () => {
      const form: CustomRuleFormState = {
        metricId: 'total_duration',
        name: 'Long Cases',
        description: '',
        thresholdType: 'median_plus_sd',
        operator: 'gt',
        thresholdValue: 1.5,
        thresholdValueMax: null,
        severity: 'warning',
        comparisonScope: 'personal',
        costCategoryId: null,
      }

      render(<RulePreviewSentence form={form} metric={mockMetric} />)

      expect(
        screen.getByText(/from the personal median/)
      ).toBeInTheDocument()
    })
  })

  describe('Threshold type: absolute', () => {
    it('formats currency values correctly', () => {
      const form: CustomRuleFormState = {
        metricId: 'or_cost',
        name: 'High OR Cost',
        description: '',
        thresholdType: 'absolute',
        operator: 'gt',
        thresholdValue: 5000,
        thresholdValueMax: null,
        severity: 'warning',
        comparisonScope: 'facility',
        costCategoryId: null,
      }

      render(<RulePreviewSentence form={form} metric={mockCurrencyMetric} />)

      expect(
        screen.getByText(/Flag cases where or cost is greater than \$5,000/)
      ).toBeInTheDocument()
    })

    it('formats percentage values correctly', () => {
      const form: CustomRuleFormState = {
        metricId: 'on_time_rate',
        name: 'Low On-Time Rate',
        description: '',
        thresholdType: 'absolute',
        operator: 'lt',
        thresholdValue: 80,
        thresholdValueMax: null,
        severity: 'warning',
        comparisonScope: 'facility',
        costCategoryId: null,
      }

      render(<RulePreviewSentence form={form} metric={mockPercentageMetric} />)

      expect(
        screen.getByText(/Flag cases where on-time rate is less than 80%/)
      ).toBeInTheDocument()
    })

    it('formats minutes values correctly', () => {
      const form: CustomRuleFormState = {
        metricId: 'total_duration',
        name: 'Long Cases',
        description: '',
        thresholdType: 'absolute',
        operator: 'gt',
        thresholdValue: 120,
        thresholdValueMax: null,
        severity: 'warning',
        comparisonScope: 'facility',
        costCategoryId: null,
      }

      render(<RulePreviewSentence form={form} metric={mockMetric} />)

      expect(
        screen.getByText(/Flag cases where total duration is greater than 120 min/)
      ).toBeInTheDocument()
    })
  })

  describe('Threshold type: percentage_of_median', () => {
    it('renders correct sentence with scope', () => {
      const form: CustomRuleFormState = {
        metricId: 'total_duration',
        name: 'Long Cases',
        description: '',
        thresholdType: 'percentage_of_median',
        operator: 'gt',
        thresholdValue: 120,
        thresholdValueMax: null,
        severity: 'warning',
        comparisonScope: 'facility',
        costCategoryId: null,
      }

      render(<RulePreviewSentence form={form} metric={mockMetric} />)

      expect(
        screen.getByText(/Flag cases where total duration is greater than 120% of the facility median/)
      ).toBeInTheDocument()
    })

    it('uses personal scope correctly', () => {
      const form: CustomRuleFormState = {
        metricId: 'total_duration',
        name: 'Long Cases',
        description: '',
        thresholdType: 'percentage_of_median',
        operator: 'gt',
        thresholdValue: 150,
        thresholdValueMax: null,
        severity: 'warning',
        comparisonScope: 'personal',
        costCategoryId: null,
      }

      render(<RulePreviewSentence form={form} metric={mockMetric} />)

      expect(
        screen.getByText(/of the personal median/)
      ).toBeInTheDocument()
    })
  })

  describe('Threshold type: percentile', () => {
    it('renders correct sentence with ordinal suffix', () => {
      const form: CustomRuleFormState = {
        metricId: 'total_duration',
        name: 'Long Cases',
        description: '',
        thresholdType: 'percentile',
        operator: 'gt',
        thresholdValue: 90,
        thresholdValueMax: null,
        severity: 'warning',
        comparisonScope: 'facility',
        costCategoryId: null,
      }

      render(<RulePreviewSentence form={form} metric={mockMetric} />)

      expect(
        screen.getByText(/Flag cases where total duration is greater than the 90th percentile/)
      ).toBeInTheDocument()
    })

    it('handles 1st, 2nd, 3rd ordinals correctly', () => {
      const testCases = [
        { value: 1, expected: '1st' },
        { value: 2, expected: '2nd' },
        { value: 3, expected: '3rd' },
        { value: 21, expected: '21st' },
        { value: 22, expected: '22nd' },
        { value: 23, expected: '23rd' },
      ]

      testCases.forEach(({ value, expected }) => {
        const form: CustomRuleFormState = {
          metricId: 'total_duration',
          name: 'Test',
          description: '',
          thresholdType: 'percentile',
          operator: 'gt',
          thresholdValue: value,
          thresholdValueMax: null,
          severity: 'warning',
          comparisonScope: 'facility',
          costCategoryId: null,
        }

        const { container } = render(<RulePreviewSentence form={form} metric={mockMetric} />)
        expect(container.textContent).toContain(expected)
      })
    })

    it('handles 11th, 12th, 13th ordinals correctly', () => {
      const testCases = [11, 12, 13]

      testCases.forEach((value) => {
        const form: CustomRuleFormState = {
          metricId: 'total_duration',
          name: 'Test',
          description: '',
          thresholdType: 'percentile',
          operator: 'gt',
          thresholdValue: value,
          thresholdValueMax: null,
          severity: 'warning',
          comparisonScope: 'facility',
          costCategoryId: null,
        }

        const { container } = render(<RulePreviewSentence form={form} metric={mockMetric} />)
        expect(container.textContent).toContain(`${value}th`)
      })
    })
  })

  describe('Threshold type: between', () => {
    it('renders correct sentence with range', () => {
      const form: CustomRuleFormState = {
        metricId: 'total_duration',
        name: 'Medium Cases',
        description: '',
        thresholdType: 'between',
        operator: 'between',
        thresholdValue: 60,
        thresholdValueMax: 120,
        severity: 'info',
        comparisonScope: 'facility',
        costCategoryId: null,
      }

      render(<RulePreviewSentence form={form} metric={mockMetric} />)

      expect(
        screen.getByText(/Flag cases where total duration is between 60 min and 120 min/)
      ).toBeInTheDocument()
    })

    it('handles missing max value gracefully', () => {
      const form: CustomRuleFormState = {
        metricId: 'total_duration',
        name: 'Medium Cases',
        description: '',
        thresholdType: 'between',
        operator: 'between',
        thresholdValue: 60,
        thresholdValueMax: null,
        severity: 'info',
        comparisonScope: 'facility',
        costCategoryId: null,
      }

      render(<RulePreviewSentence form={form} metric={mockMetric} />)

      expect(
        screen.getByText(/between 60 min and \.\.\./)
      ).toBeInTheDocument()
    })

    it('formats currency range correctly', () => {
      const form: CustomRuleFormState = {
        metricId: 'or_cost',
        name: 'Mid-Range Cost',
        description: '',
        thresholdType: 'between',
        operator: 'between',
        thresholdValue: 1000,
        thresholdValueMax: 5000,
        severity: 'info',
        comparisonScope: 'facility',
        costCategoryId: null,
      }

      render(<RulePreviewSentence form={form} metric={mockCurrencyMetric} />)

      expect(
        screen.getByText(/between \$1,000 and \$5,000/)
      ).toBeInTheDocument()
    })
  })

  describe('Operator labels', () => {
    it('converts operator to readable label (gt → greater than)', () => {
      const form: CustomRuleFormState = {
        metricId: 'total_duration',
        name: 'Long Cases',
        description: '',
        thresholdType: 'absolute',
        operator: 'gt',
        thresholdValue: 120,
        thresholdValueMax: null,
        severity: 'warning',
        comparisonScope: 'facility',
        costCategoryId: null,
      }

      render(<RulePreviewSentence form={form} metric={mockMetric} />)

      expect(screen.getByText(/greater than/)).toBeInTheDocument()
    })

    it('converts operator to readable label (lt → less than)', () => {
      const form: CustomRuleFormState = {
        metricId: 'total_duration',
        name: 'Short Cases',
        description: '',
        thresholdType: 'absolute',
        operator: 'lt',
        thresholdValue: 30,
        thresholdValueMax: null,
        severity: 'info',
        comparisonScope: 'facility',
        costCategoryId: null,
      }

      render(<RulePreviewSentence form={form} metric={mockMetric} />)

      expect(screen.getByText(/less than/)).toBeInTheDocument()
    })

    it('converts operator to readable label (gte → greater than or equal)', () => {
      const form: CustomRuleFormState = {
        metricId: 'total_duration',
        name: 'Exact Duration',
        description: '',
        thresholdType: 'absolute',
        operator: 'gte',
        thresholdValue: 60,
        thresholdValueMax: null,
        severity: 'info',
        comparisonScope: 'facility',
        costCategoryId: null,
      }

      render(<RulePreviewSentence form={form} metric={mockMetric} />)

      expect(screen.getByText(/greater than or equal/)).toBeInTheDocument()
    })
  })

  describe('Metric name formatting', () => {
    it('converts metric name to lowercase in sentence', () => {
      const form: CustomRuleFormState = {
        metricId: 'total_duration',
        name: 'Long Cases',
        description: '',
        thresholdType: 'absolute',
        operator: 'gt',
        thresholdValue: 120,
        thresholdValueMax: null,
        severity: 'warning',
        comparisonScope: 'facility',
        costCategoryId: null,
      }

      render(<RulePreviewSentence form={form} metric={mockMetric} />)

      expect(screen.getByText(/total duration/)).toBeInTheDocument()
    })
  })

  describe('Threshold description', () => {
    it('shows threshold type description when available', () => {
      const form: CustomRuleFormState = {
        metricId: 'total_duration',
        name: 'Long Cases',
        description: '',
        thresholdType: 'median_plus_sd',
        operator: 'gt',
        thresholdValue: 1.0,
        thresholdValueMax: null,
        severity: 'warning',
        comparisonScope: 'facility',
        costCategoryId: null,
      }

      render(<RulePreviewSentence form={form} metric={mockMetric} />)

      // Check for threshold description (from THRESHOLD_TYPES constant)
      const description = screen.getByText(/Flag when value exceeds the median by N standard deviations/)
      expect(description).toBeInTheDocument()
    })
  })

  describe('Null metric handling', () => {
    it('renders nothing when metric is undefined', () => {
      const form: CustomRuleFormState = {
        metricId: 'total_duration',
        name: 'Long Cases',
        description: '',
        thresholdType: 'absolute',
        operator: 'gt',
        thresholdValue: 120,
        thresholdValueMax: null,
        severity: 'warning',
        comparisonScope: 'facility',
        costCategoryId: null,
      }

      const { container } = render(<RulePreviewSentence form={form} metric={undefined} />)

      expect(container.firstChild).toBeNull()
    })
  })
})
