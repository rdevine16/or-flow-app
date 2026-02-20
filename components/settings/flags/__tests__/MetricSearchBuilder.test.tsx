// components/settings/flags/__tests__/MetricSearchBuilder.test.tsx
// Unit + integration tests for custom rule builder drawer flow.

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MetricSearchBuilder } from '@/components/settings/flags/MetricSearchBuilder'
import type { MetricCatalogEntry } from '@/types/flag-settings'

const mockDynamicMetrics: MetricCatalogEntry[] = [
  {
    id: 'cost_sutures',
    name: 'Suture Cost',
    description: 'Cost of suture supplies',
    category: 'financial',
    dataType: 'currency',
    unit: '$',
    source: 'case_completion_stats',
    startMilestone: null,
    endMilestone: null,
    supportsMedian: true,
    costCategoryId: 'cat-123',
  },
  {
    id: 'cost_implants',
    name: 'Implant Cost',
    description: 'Cost of implant supplies',
    category: 'financial',
    dataType: 'currency',
    unit: '$',
    source: 'case_completion_stats',
    startMilestone: null,
    endMilestone: null,
    supportsMedian: true,
    costCategoryId: 'cat-456',
  },
]

describe('MetricSearchBuilder', () => {
  const mockOnOpenChange = vi.fn()
  const mockOnSubmit = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Drawer shell and state management', () => {
    it('renders drawer when open=true', () => {
      render(
        <MetricSearchBuilder
          open={true}
          onOpenChange={mockOnOpenChange}
          onSubmit={mockOnSubmit}
          dynamicMetrics={mockDynamicMetrics}
        />
      )

      expect(screen.getByText('Add Custom Rule')).toBeInTheDocument()
      expect(screen.getByText('Select a metric to build a custom flag rule')).toBeInTheDocument()
    })

    it('does not render drawer when open=false', () => {
      const { container } = render(
        <MetricSearchBuilder
          open={false}
          onOpenChange={mockOnOpenChange}
          onSubmit={mockOnSubmit}
          dynamicMetrics={mockDynamicMetrics}
        />
      )

      expect(screen.queryByText('Add Custom Rule')).not.toBeInTheDocument()
    })

    it('starts on search step by default', () => {
      render(
        <MetricSearchBuilder
          open={true}
          onOpenChange={mockOnOpenChange}
          onSubmit={mockOnSubmit}
          dynamicMetrics={mockDynamicMetrics}
        />
      )

      expect(screen.getByText('Add Custom Rule')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Search metrics...')).toBeInTheDocument()
    })

    it('resets state when drawer is closed via close button', async () => {
      render(
        <MetricSearchBuilder
          open={true}
          onOpenChange={mockOnOpenChange}
          onSubmit={mockOnSubmit}
          dynamicMetrics={mockDynamicMetrics}
        />
      )

      // Select a metric to advance to step 2
      const metricButton = screen.getByText('Total Case Time')
      fireEvent.click(metricButton)

      await waitFor(() => {
        expect(screen.getByText('Configure Rule')).toBeInTheDocument()
      })

      // Click the close button — this triggers handleOpenChange(false) which resets state
      const closeButton = screen.getByLabelText('Close builder')
      fireEvent.click(closeButton)

      // onOpenChange should have been called with false
      expect(mockOnOpenChange).toHaveBeenCalledWith(false)
    })
  })

  describe('Step 1 → Step 2 flow', () => {
    it('advances to configure step when a metric is selected', async () => {
      render(
        <MetricSearchBuilder
          open={true}
          onOpenChange={mockOnOpenChange}
          onSubmit={mockOnSubmit}
          dynamicMetrics={mockDynamicMetrics}
        />
      )

      const metricButton = screen.getByText('Total Case Time')
      fireEvent.click(metricButton)

      await waitFor(() => {
        expect(screen.getByText('Configure Rule')).toBeInTheDocument()
        expect(screen.getByText('Configure thresholds and severity for this rule')).toBeInTheDocument()
      })
    })

    it('shows selected metric info in configure step header', async () => {
      render(
        <MetricSearchBuilder
          open={true}
          onOpenChange={mockOnOpenChange}
          onSubmit={mockOnSubmit}
          dynamicMetrics={mockDynamicMetrics}
        />
      )

      const metricButton = screen.getByText('Total Case Time')
      fireEvent.click(metricButton)

      await waitFor(() => {
        expect(screen.getByText('Total Case Time')).toBeInTheDocument()
        expect(screen.getByText('Duration from patient in to patient out')).toBeInTheDocument()
      })
    })

    it('initializes form with metric-appropriate defaults', async () => {
      render(
        <MetricSearchBuilder
          open={true}
          onOpenChange={mockOnOpenChange}
          onSubmit={mockOnSubmit}
          dynamicMetrics={mockDynamicMetrics}
        />
      )

      // Select a metric that supports median (should default to median_plus_sd)
      const metricButton = screen.getByText('Total Case Time')
      fireEvent.click(metricButton)

      await waitFor(() => {
        // Should default to median-based threshold type (metric supports median)
        const thresholdSelect = screen.getByLabelText('Threshold Type') as HTMLSelectElement
        expect(thresholdSelect.value).toMatch(/median/)
      })
    })

    it('back button returns to search step and clears selection', async () => {
      render(
        <MetricSearchBuilder
          open={true}
          onOpenChange={mockOnOpenChange}
          onSubmit={mockOnSubmit}
          dynamicMetrics={mockDynamicMetrics}
        />
      )

      // Select a metric
      const metricButton = screen.getByText('Total Case Time')
      fireEvent.click(metricButton)

      await waitFor(() => {
        expect(screen.getByText('Configure Rule')).toBeInTheDocument()
      })

      // Click back button
      const backButton = screen.getByText('Back to metrics')
      fireEvent.click(backButton)

      await waitFor(() => {
        expect(screen.getByText('Add Custom Rule')).toBeInTheDocument()
        expect(screen.getByPlaceholderText('Search metrics...')).toBeInTheDocument()
      })
    })
  })

  describe('Submit and close behavior', () => {
    it('Add Rule button is disabled when name is empty', async () => {
      render(
        <MetricSearchBuilder
          open={true}
          onOpenChange={mockOnOpenChange}
          onSubmit={mockOnSubmit}
          dynamicMetrics={mockDynamicMetrics}
        />
      )

      const metricButton = screen.getByText('Total Case Time')
      fireEvent.click(metricButton)

      await waitFor(() => {
        expect(screen.getByText('Configure Rule')).toBeInTheDocument()
      })

      const addButton = screen.getByText('Add Rule')
      expect(addButton).toBeDisabled()
    })

    it('Add Rule button is enabled when name is filled', async () => {
      render(
        <MetricSearchBuilder
          open={true}
          onOpenChange={mockOnOpenChange}
          onSubmit={mockOnSubmit}
          dynamicMetrics={mockDynamicMetrics}
        />
      )

      const metricButton = screen.getByText('Total Case Time')
      fireEvent.click(metricButton)

      await waitFor(() => {
        expect(screen.getByText('Configure Rule')).toBeInTheDocument()
      })

      const nameInput = screen.getByPlaceholderText(/e\.g\./)
      fireEvent.change(nameInput, { target: { value: 'High Total Case Time' } })

      const addButton = screen.getByText('Add Rule')
      expect(addButton).not.toBeDisabled()
    })

    it('calls onSubmit with form data when Add Rule is clicked', async () => {
      render(
        <MetricSearchBuilder
          open={true}
          onOpenChange={mockOnOpenChange}
          onSubmit={mockOnSubmit}
          dynamicMetrics={mockDynamicMetrics}
        />
      )

      const metricButton = screen.getByText('Total Case Time')
      fireEvent.click(metricButton)

      await waitFor(() => {
        expect(screen.getByText('Configure Rule')).toBeInTheDocument()
      })

      const nameInput = screen.getByPlaceholderText(/e\.g\./)
      fireEvent.change(nameInput, { target: { value: 'High Total Case Time' } })

      const addButton = screen.getByText('Add Rule')
      fireEvent.click(addButton)

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            metricId: 'total_case_time',
            name: 'High Total Case Time',
          })
        )
      })
    })

    it('closes drawer after successful submit', async () => {
      render(
        <MetricSearchBuilder
          open={true}
          onOpenChange={mockOnOpenChange}
          onSubmit={mockOnSubmit}
          dynamicMetrics={mockDynamicMetrics}
        />
      )

      const metricButton = screen.getByText('Total Case Time')
      fireEvent.click(metricButton)

      await waitFor(() => {
        expect(screen.getByText('Configure Rule')).toBeInTheDocument()
      })

      const nameInput = screen.getByPlaceholderText(/e\.g\./)
      fireEvent.change(nameInput, { target: { value: 'High Total Case Time' } })

      const addButton = screen.getByText('Add Rule')
      fireEvent.click(addButton)

      await waitFor(() => {
        expect(mockOnOpenChange).toHaveBeenCalledWith(false)
      })
    })

    it('Enter key submits form when name is filled', async () => {
      render(
        <MetricSearchBuilder
          open={true}
          onOpenChange={mockOnOpenChange}
          onSubmit={mockOnSubmit}
          dynamicMetrics={mockDynamicMetrics}
        />
      )

      const metricButton = screen.getByText('Total Case Time')
      fireEvent.click(metricButton)

      await waitFor(() => {
        expect(screen.getByText('Configure Rule')).toBeInTheDocument()
      })

      const nameInput = screen.getByPlaceholderText(/e\.g\./)
      fireEvent.change(nameInput, { target: { value: 'High Total Case Time' } })

      // Simulate Enter key press on the drawer content
      const drawer = screen.getByRole('dialog')
      fireEvent.keyDown(drawer, { key: 'Enter', code: 'Enter' })

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled()
      })
    })
  })

  describe('Dynamic cost-category metrics integration', () => {
    it('includes dynamic metrics in the search results', () => {
      render(
        <MetricSearchBuilder
          open={true}
          onOpenChange={mockOnOpenChange}
          onSubmit={mockOnSubmit}
          dynamicMetrics={mockDynamicMetrics}
        />
      )

      expect(screen.getByText('Implant Cost')).toBeInTheDocument()
    })

    it('shows PER-CATEGORY badge for dynamic metrics', () => {
      render(
        <MetricSearchBuilder
          open={true}
          onOpenChange={mockOnOpenChange}
          onSubmit={mockOnSubmit}
          dynamicMetrics={mockDynamicMetrics}
        />
      )

      const badges = screen.getAllByText('PER-CATEGORY')
      expect(badges.length).toBeGreaterThan(0) // Dynamic metrics should show badge
    })

    it('passes costCategoryId to form when dynamic metric is selected', async () => {
      render(
        <MetricSearchBuilder
          open={true}
          onOpenChange={mockOnOpenChange}
          onSubmit={mockOnSubmit}
          dynamicMetrics={mockDynamicMetrics}
        />
      )

      // Select the Implant Cost dynamic metric
      const metricButton = screen.getByText('Implant Cost')
      fireEvent.click(metricButton)

      await waitFor(() => {
        expect(screen.getByText('Configure Rule')).toBeInTheDocument()
      })

      const nameInput = screen.getByPlaceholderText(/e\.g\./)
      fireEvent.change(nameInput, { target: { value: 'High Implant Cost' } })

      const addButton = screen.getByText('Add Rule')
      fireEvent.click(addButton)

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            metricId: 'cost_implants',
            costCategoryId: 'cat-456',
          })
        )
      })
    })
  })
})
