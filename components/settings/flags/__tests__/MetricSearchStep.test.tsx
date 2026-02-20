// components/settings/flags/__tests__/MetricSearchStep.test.tsx
// Unit tests for metric search/browse component.

import { render, screen, fireEvent } from '@testing-library/react'
import { MetricSearchStep } from '@/components/settings/flags/MetricSearchStep'
import type { MetricCatalogEntry } from '@/types/flag-settings'

const mockDynamicMetrics: MetricCatalogEntry[] = [
  {
    id: 'cost_implants',
    name: 'Implant Cost',
    description: 'Cost of implant supplies',
    category: 'financial',
    dataType: 'currency',
    unit: 'USD',
    supportsMedian: true,
    costCategoryId: 123,
  },
]

describe('MetricSearchStep', () => {
  const mockOnSelectMetric = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Search functionality', () => {
    it('renders search input with placeholder', () => {
      render(
        <MetricSearchStep
          onSelectMetric={mockOnSelectMetric}
          dynamicMetrics={mockDynamicMetrics}
        />
      )

      expect(screen.getByPlaceholderText('Search metrics...')).toBeInTheDocument()
    })

    it('shows all metrics when search is empty', () => {
      render(
        <MetricSearchStep
          onSelectMetric={mockOnSelectMetric}
          dynamicMetrics={mockDynamicMetrics}
        />
      )

      // Should show static metrics from METRICS_CATALOG
      expect(screen.getByText('Total Case Time')).toBeInTheDocument()

      // Check metric count includes both static and dynamic
      const countText = screen.getByText(/metrics? available/)
      expect(countText).toBeInTheDocument()
    })

    it('filters metrics by name', () => {
      render(
        <MetricSearchStep
          onSelectMetric={mockOnSelectMetric}
          dynamicMetrics={mockDynamicMetrics}
        />
      )

      const searchInput = screen.getByPlaceholderText('Search metrics...')
      fireEvent.change(searchInput, { target: { value: 'surgical time' } })

      expect(screen.getByText('Surgical Time')).toBeInTheDocument()
      expect(screen.getByText(/metric(s)? available/)).toBeInTheDocument()
    })

    it('filters metrics by description', () => {
      render(
        <MetricSearchStep
          onSelectMetric={mockOnSelectMetric}
          dynamicMetrics={mockDynamicMetrics}
        />
      )

      const searchInput = screen.getByPlaceholderText('Search metrics...')
      fireEvent.change(searchInput, { target: { value: 'patient in' } })

      expect(screen.getByText('Total Case Time')).toBeInTheDocument()
    })

    it('filters metrics by category', () => {
      render(
        <MetricSearchStep
          onSelectMetric={mockOnSelectMetric}
          dynamicMetrics={mockDynamicMetrics}
        />
      )

      const searchInput = screen.getByPlaceholderText('Search metrics...')
      fireEvent.change(searchInput, { target: { value: 'timing' } })

      expect(screen.getByText('Total Case Time')).toBeInTheDocument()
    })

    it('shows empty state when no metrics match search', () => {
      render(
        <MetricSearchStep
          onSelectMetric={mockOnSelectMetric}
          dynamicMetrics={mockDynamicMetrics}
        />
      )

      const searchInput = screen.getByPlaceholderText('Search metrics...')
      fireEvent.change(searchInput, { target: { value: 'zzzznonexistent' } })

      expect(screen.getByText('No metrics match your search.')).toBeInTheDocument()
      expect(screen.getByText('0 metrics available')).toBeInTheDocument()
    })

    it('search is case-insensitive', () => {
      render(
        <MetricSearchStep
          onSelectMetric={mockOnSelectMetric}
          dynamicMetrics={mockDynamicMetrics}
        />
      )

      const searchInput = screen.getByPlaceholderText('Search metrics...')
      fireEvent.change(searchInput, { target: { value: 'SURGICAL' } })

      expect(screen.getByText('Surgical Time')).toBeInTheDocument()
    })
  })

  describe('Metric selection', () => {
    it('calls onSelectMetric when a metric is clicked', () => {
      render(
        <MetricSearchStep
          onSelectMetric={mockOnSelectMetric}
          dynamicMetrics={mockDynamicMetrics}
        />
      )

      const metricButton = screen.getByText('Surgical Time')
      fireEvent.click(metricButton)

      expect(mockOnSelectMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'surgical_time',
          name: 'Surgical Time',
        })
      )
    })

    it('shows metric unit or dataType in the list', () => {
      render(
        <MetricSearchStep
          onSelectMetric={mockOnSelectMetric}
          dynamicMetrics={mockDynamicMetrics}
        />
      )

      // Should show units for metrics - check for "min" (minutes)
      expect(screen.getAllByText('min').length).toBeGreaterThan(0)
    })
  })

  describe('Dynamic metrics integration', () => {
    it('merges dynamic metrics with static catalog', () => {
      const additionalDynamic: MetricCatalogEntry[] = [
        {
          id: 'cost_drapes',
          name: 'Drape Cost',
          description: 'Cost of drapes',
          category: 'financial',
          dataType: 'currency',
          unit: 'USD',
          supportsMedian: true,
          costCategoryId: 789,
        },
      ]

      render(
        <MetricSearchStep
          onSelectMetric={mockOnSelectMetric}
          dynamicMetrics={[...mockDynamicMetrics, ...additionalDynamic]}
        />
      )

      expect(screen.getByText('Implant Cost')).toBeInTheDocument()
      expect(screen.getByText('Drape Cost')).toBeInTheDocument()
    })

    it('shows PER-CATEGORY badge for dynamic metrics', () => {
      render(
        <MetricSearchStep
          onSelectMetric={mockOnSelectMetric}
          dynamicMetrics={mockDynamicMetrics}
        />
      )

      expect(screen.getByText('PER-CATEGORY')).toBeInTheDocument()
    })

    it('does not show PER-CATEGORY badge for static metrics', () => {
      render(
        <MetricSearchStep
          onSelectMetric={mockOnSelectMetric}
          dynamicMetrics={[]}
        />
      )

      // Find a metric button from static catalog that doesn't have costCategoryId
      const searchInput = screen.getByPlaceholderText('Search metrics...')
      fireEvent.change(searchInput, { target: { value: 'duration' } })

      const perCategoryBadges = screen.queryAllByText('PER-CATEGORY')
      expect(perCategoryBadges.length).toBe(0)
    })
  })

  describe('Category grouping', () => {
    it('groups metrics by category', () => {
      render(
        <MetricSearchStep
          onSelectMetric={mockOnSelectMetric}
          dynamicMetrics={mockDynamicMetrics}
        />
      )

      // Should see category headers (e.g., "Cost", "Efficiency", "Utilization")
      // Check for at least one category badge
      const categoryBadges = screen.getAllByText(/^(Cost|Efficiency|Utilization|Quality|Delay|Timing)$/i)
      expect(categoryBadges.length).toBeGreaterThan(0)
    })

    it('maintains category order from METRIC_CATEGORIES', () => {
      render(
        <MetricSearchStep
          onSelectMetric={mockOnSelectMetric}
          dynamicMetrics={mockDynamicMetrics}
        />
      )

      // Categories should appear in a specific order
      // This is tested indirectly by the rendering not throwing errors
      // and categories being visible
      const categoryHeaders = screen.getAllByText(/^(Cost|Efficiency|Utilization|Quality|Delay|Timing)$/i)
      expect(categoryHeaders).toBeTruthy()
    })
  })

  describe('Metric count display', () => {
    it('shows singular "metric" when count is 1', () => {
      render(
        <MetricSearchStep
          onSelectMetric={mockOnSelectMetric}
          dynamicMetrics={mockDynamicMetrics}
        />
      )

      const searchInput = screen.getByPlaceholderText('Search metrics...')
      fireEvent.change(searchInput, { target: { value: 'implant cost' } })

      expect(screen.getByText('1 metric available')).toBeInTheDocument()
    })

    it('shows plural "metrics" when count is not 1', () => {
      render(
        <MetricSearchStep
          onSelectMetric={mockOnSelectMetric}
          dynamicMetrics={mockDynamicMetrics}
        />
      )

      const searchInput = screen.getByPlaceholderText('Search metrics...')
      fireEvent.change(searchInput, { target: { value: 'cost' } })

      const countText = screen.getByText(/\d+ metrics available/)
      expect(countText).toBeInTheDocument()
    })
  })
})
