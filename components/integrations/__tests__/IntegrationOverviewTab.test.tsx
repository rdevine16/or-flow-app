/**
 * IntegrationOverviewTab.test.tsx — Unit tests for shared Overview tab
 *
 * Tests that the component correctly renders setup state, integration state,
 * stats, and handles all user actions with system-specific config.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import IntegrationOverviewTab from '@/components/integrations/IntegrationOverviewTab'
import { getSystemConfig } from '@/components/integrations/system-config'
import type { EhrIntegration } from '@/lib/integrations/shared/integration-types'

describe('IntegrationOverviewTab', () => {
  const mockOnSetup = vi.fn()
  const mockOnToggleActive = vi.fn()
  const mockOnRotateKey = vi.fn()
  const mockOnUpdateRetention = vi.fn()
  const mockOnNavigateTab = vi.fn()
  const mockOnNavigateLogsWithFilter = vi.fn()

  const epicConfig = getSystemConfig('epic_hl7v2')
  const cernerConfig = getSystemConfig('cerner_hl7v2')

  const mockIntegration: EhrIntegration = {
    id: 'int-123',
    facility_id: 'fac-456',
    integration_type: 'epic_hl7v2',
    integration_name: 'Epic HL7v2',
    is_active: true,
    config: {
      api_key: 'test-api-key-abc123',
      retention_days: 90,
    },
    last_message_at: new Date().toISOString(),
    last_error: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  const mockStats = {
    totalProcessed: 42,
    pendingReview: 5,
    errors: 2,
    messagesToday: 8,
  }

  const endpointUrl = 'https://orbit.example.com/api/integrations/hl7v2/epic/receive'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('setup state (no integration)', () => {
    it('renders setup prompt when integration is null', () => {
      render(
        <IntegrationOverviewTab
          systemConfig={epicConfig}
          integration={null}
          stats={null}
          endpointUrl={endpointUrl}
          actionLoading={null}
          onSetup={mockOnSetup}
          onToggleActive={mockOnToggleActive}
          onRotateKey={mockOnRotateKey}
          onUpdateRetention={mockOnUpdateRetention}
          onNavigateTab={mockOnNavigateTab}
          onNavigateLogsWithFilter={mockOnNavigateLogsWithFilter}
        />
      )

      expect(screen.getByText('Set Up HL7v2 Integration')).toBeInTheDocument()
      expect(screen.getByText(/Generate an API key to start receiving surgical scheduling messages/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Initialize Integration/i })).toBeInTheDocument()
    })

    it('displays system-specific display name in setup prompt', () => {
      render(
        <IntegrationOverviewTab
          systemConfig={cernerConfig}
          integration={null}
          stats={null}
          endpointUrl={endpointUrl}
          actionLoading={null}
          onSetup={mockOnSetup}
          onToggleActive={mockOnToggleActive}
          onRotateKey={mockOnRotateKey}
          onUpdateRetention={mockOnUpdateRetention}
          onNavigateTab={mockOnNavigateTab}
          onNavigateLogsWithFilter={mockOnNavigateLogsWithFilter}
        />
      )

      expect(screen.getByText(/Oracle Cerner/)).toBeInTheDocument()
    })

    it('calls onSetup when Initialize button clicked', async () => {
      const user = userEvent.setup()
      render(
        <IntegrationOverviewTab
          systemConfig={epicConfig}
          integration={null}
          stats={null}
          endpointUrl={endpointUrl}
          actionLoading={null}
          onSetup={mockOnSetup}
          onToggleActive={mockOnToggleActive}
          onRotateKey={mockOnRotateKey}
          onUpdateRetention={mockOnUpdateRetention}
          onNavigateTab={mockOnNavigateTab}
          onNavigateLogsWithFilter={mockOnNavigateLogsWithFilter}
        />
      )

      await user.click(screen.getByRole('button', { name: /Initialize Integration/i }))
      expect(mockOnSetup).toHaveBeenCalledOnce()
    })

    it('disables Initialize button when actionLoading is "setup"', () => {
      render(
        <IntegrationOverviewTab
          systemConfig={epicConfig}
          integration={null}
          stats={null}
          endpointUrl={endpointUrl}
          actionLoading="setup"
          onSetup={mockOnSetup}
          onToggleActive={mockOnToggleActive}
          onRotateKey={mockOnRotateKey}
          onUpdateRetention={mockOnUpdateRetention}
          onNavigateTab={mockOnNavigateTab}
          onNavigateLogsWithFilter={mockOnNavigateLogsWithFilter}
        />
      )

      expect(screen.getByRole('button', { name: /Initialize Integration/i })).toBeDisabled()
    })
  })

  describe('integration active state', () => {
    it('renders SetupInstructionsCard with correct props', () => {
      render(
        <IntegrationOverviewTab
          systemConfig={epicConfig}
          integration={mockIntegration}
          stats={mockStats}
          endpointUrl={endpointUrl}
          actionLoading={null}
          onSetup={mockOnSetup}
          onToggleActive={mockOnToggleActive}
          onRotateKey={mockOnRotateKey}
          onUpdateRetention={mockOnUpdateRetention}
          onNavigateTab={mockOnNavigateTab}
          onNavigateLogsWithFilter={mockOnNavigateLogsWithFilter}
        />
      )

      // SetupInstructionsCard renders the endpoint URL and API key
      const endpointElements = screen.getAllByText(/orbit\.example\.com/)
      expect(endpointElements.length).toBeGreaterThan(0)
      const apiKeyElements = screen.getAllByText(/test-api-key/)
      expect(apiKeyElements.length).toBeGreaterThan(0)
    })

    it('renders connection status with active state', () => {
      render(
        <IntegrationOverviewTab
          systemConfig={epicConfig}
          integration={mockIntegration}
          stats={mockStats}
          endpointUrl={endpointUrl}
          actionLoading={null}
          onSetup={mockOnSetup}
          onToggleActive={mockOnToggleActive}
          onRotateKey={mockOnRotateKey}
          onUpdateRetention={mockOnUpdateRetention}
          onNavigateTab={mockOnNavigateTab}
          onNavigateLogsWithFilter={mockOnNavigateLogsWithFilter}
        />
      )

      expect(screen.getByText('Active')).toBeInTheDocument()
    })

    it('renders connection status with inactive state', () => {
      const inactiveIntegration = { ...mockIntegration, is_active: false }
      render(
        <IntegrationOverviewTab
          systemConfig={epicConfig}
          integration={inactiveIntegration}
          stats={mockStats}
          endpointUrl={endpointUrl}
          actionLoading={null}
          onSetup={mockOnSetup}
          onToggleActive={mockOnToggleActive}
          onRotateKey={mockOnRotateKey}
          onUpdateRetention={mockOnUpdateRetention}
          onNavigateTab={mockOnNavigateTab}
          onNavigateLogsWithFilter={mockOnNavigateLogsWithFilter}
        />
      )

      expect(screen.getByText('Inactive')).toBeInTheDocument()
    })

    it('displays stats correctly', () => {
      render(
        <IntegrationOverviewTab
          systemConfig={epicConfig}
          integration={mockIntegration}
          stats={mockStats}
          endpointUrl={endpointUrl}
          actionLoading={null}
          onSetup={mockOnSetup}
          onToggleActive={mockOnToggleActive}
          onRotateKey={mockOnRotateKey}
          onUpdateRetention={mockOnUpdateRetention}
          onNavigateTab={mockOnNavigateTab}
          onNavigateLogsWithFilter={mockOnNavigateLogsWithFilter}
        />
      )

      expect(screen.getByText('42')).toBeInTheDocument() // totalProcessed
      expect(screen.getByText('5')).toBeInTheDocument() // pendingReview
      expect(screen.getByText('2')).toBeInTheDocument() // errors
      expect(screen.getByText('8')).toBeInTheDocument() // messagesToday
    })

    it('displays zero stats when stats is null', () => {
      render(
        <IntegrationOverviewTab
          systemConfig={epicConfig}
          integration={mockIntegration}
          stats={null}
          endpointUrl={endpointUrl}
          actionLoading={null}
          onSetup={mockOnSetup}
          onToggleActive={mockOnToggleActive}
          onRotateKey={mockOnRotateKey}
          onUpdateRetention={mockOnUpdateRetention}
          onNavigateTab={mockOnNavigateTab}
          onNavigateLogsWithFilter={mockOnNavigateLogsWithFilter}
        />
      )

      // All stat values should be 0
      const statElements = screen.getAllByText('0')
      expect(statElements.length).toBeGreaterThan(0)
    })
  })

  describe('quick actions', () => {
    it('calls onToggleActive when Disable button clicked (when active)', async () => {
      const user = userEvent.setup()
      render(
        <IntegrationOverviewTab
          systemConfig={epicConfig}
          integration={mockIntegration}
          stats={mockStats}
          endpointUrl={endpointUrl}
          actionLoading={null}
          onSetup={mockOnSetup}
          onToggleActive={mockOnToggleActive}
          onRotateKey={mockOnRotateKey}
          onUpdateRetention={mockOnUpdateRetention}
          onNavigateTab={mockOnNavigateTab}
          onNavigateLogsWithFilter={mockOnNavigateLogsWithFilter}
        />
      )

      await user.click(screen.getByRole('button', { name: /Disable/i }))
      expect(mockOnToggleActive).toHaveBeenCalledOnce()
    })

    it('shows Enable button when integration is inactive', () => {
      const inactiveIntegration = { ...mockIntegration, is_active: false }
      render(
        <IntegrationOverviewTab
          systemConfig={epicConfig}
          integration={inactiveIntegration}
          stats={mockStats}
          endpointUrl={endpointUrl}
          actionLoading={null}
          onSetup={mockOnSetup}
          onToggleActive={mockOnToggleActive}
          onRotateKey={mockOnRotateKey}
          onUpdateRetention={mockOnUpdateRetention}
          onNavigateTab={mockOnNavigateTab}
          onNavigateLogsWithFilter={mockOnNavigateLogsWithFilter}
        />
      )

      expect(screen.getByRole('button', { name: /Enable/i })).toBeInTheDocument()
    })

    it('calls onRotateKey when Rotate API Key button clicked', async () => {
      const user = userEvent.setup()
      render(
        <IntegrationOverviewTab
          systemConfig={epicConfig}
          integration={mockIntegration}
          stats={mockStats}
          endpointUrl={endpointUrl}
          actionLoading={null}
          onSetup={mockOnSetup}
          onToggleActive={mockOnToggleActive}
          onRotateKey={mockOnRotateKey}
          onUpdateRetention={mockOnUpdateRetention}
          onNavigateTab={mockOnNavigateTab}
          onNavigateLogsWithFilter={mockOnNavigateLogsWithFilter}
        />
      )

      await user.click(screen.getByRole('button', { name: /Rotate API Key/i }))
      expect(mockOnRotateKey).toHaveBeenCalledOnce()
    })

    it('disables toggle button when actionLoading is "toggle"', () => {
      render(
        <IntegrationOverviewTab
          systemConfig={epicConfig}
          integration={mockIntegration}
          stats={mockStats}
          endpointUrl={endpointUrl}
          actionLoading="toggle"
          onSetup={mockOnSetup}
          onToggleActive={mockOnToggleActive}
          onRotateKey={mockOnRotateKey}
          onUpdateRetention={mockOnUpdateRetention}
          onNavigateTab={mockOnNavigateTab}
          onNavigateLogsWithFilter={mockOnNavigateLogsWithFilter}
        />
      )

      expect(screen.getByRole('button', { name: /Disable/i })).toBeDisabled()
    })

    it('disables rotate button when actionLoading is "rotate"', () => {
      render(
        <IntegrationOverviewTab
          systemConfig={epicConfig}
          integration={mockIntegration}
          stats={mockStats}
          endpointUrl={endpointUrl}
          actionLoading="rotate"
          onSetup={mockOnSetup}
          onToggleActive={mockOnToggleActive}
          onRotateKey={mockOnRotateKey}
          onUpdateRetention={mockOnUpdateRetention}
          onNavigateTab={mockOnNavigateTab}
          onNavigateLogsWithFilter={mockOnNavigateLogsWithFilter}
        />
      )

      expect(screen.getByRole('button', { name: /Rotate API Key/i })).toBeDisabled()
    })
  })

  describe('navigation actions', () => {
    it('calls onNavigateTab("review") when Pending Review card clicked', async () => {
      const user = userEvent.setup()
      render(
        <IntegrationOverviewTab
          systemConfig={epicConfig}
          integration={mockIntegration}
          stats={mockStats}
          endpointUrl={endpointUrl}
          actionLoading={null}
          onSetup={mockOnSetup}
          onToggleActive={mockOnToggleActive}
          onRotateKey={mockOnRotateKey}
          onUpdateRetention={mockOnUpdateRetention}
          onNavigateTab={mockOnNavigateTab}
          onNavigateLogsWithFilter={mockOnNavigateLogsWithFilter}
        />
      )

      // Find the Pending Review card by its text
      const pendingReviewCard = screen.getByText('Pending Review').closest('button')
      expect(pendingReviewCard).toBeInTheDocument()
      await user.click(pendingReviewCard!)
      expect(mockOnNavigateTab).toHaveBeenCalledWith('review')
    })

    it('calls onNavigateLogsWithFilter("error") when Errors card clicked', async () => {
      const user = userEvent.setup()
      render(
        <IntegrationOverviewTab
          systemConfig={epicConfig}
          integration={mockIntegration}
          stats={mockStats}
          endpointUrl={endpointUrl}
          actionLoading={null}
          onSetup={mockOnSetup}
          onToggleActive={mockOnToggleActive}
          onRotateKey={mockOnRotateKey}
          onUpdateRetention={mockOnUpdateRetention}
          onNavigateTab={mockOnNavigateTab}
          onNavigateLogsWithFilter={mockOnNavigateLogsWithFilter}
        />
      )

      const errorsCard = screen.getByText('Errors').closest('button')
      expect(errorsCard).toBeInTheDocument()
      await user.click(errorsCard!)
      expect(mockOnNavigateLogsWithFilter).toHaveBeenCalledWith('error')
    })
  })

  describe('retention policy', () => {
    it('displays current retention days', () => {
      render(
        <IntegrationOverviewTab
          systemConfig={epicConfig}
          integration={mockIntegration}
          stats={mockStats}
          endpointUrl={endpointUrl}
          actionLoading={null}
          onSetup={mockOnSetup}
          onToggleActive={mockOnToggleActive}
          onRotateKey={mockOnRotateKey}
          onUpdateRetention={mockOnUpdateRetention}
          onNavigateTab={mockOnNavigateTab}
          onNavigateLogsWithFilter={mockOnNavigateLogsWithFilter}
        />
      )

      // Retention dropdown should show 90 days (default)
      const select = screen.getByRole('combobox') as HTMLSelectElement
      expect(select.value).toBe('90')
    })

    it('shows Save button when retention changed', async () => {
      const user = userEvent.setup()
      render(
        <IntegrationOverviewTab
          systemConfig={epicConfig}
          integration={mockIntegration}
          stats={mockStats}
          endpointUrl={endpointUrl}
          actionLoading={null}
          onSetup={mockOnSetup}
          onToggleActive={mockOnToggleActive}
          onRotateKey={mockOnRotateKey}
          onUpdateRetention={mockOnUpdateRetention}
          onNavigateTab={mockOnNavigateTab}
          onNavigateLogsWithFilter={mockOnNavigateLogsWithFilter}
        />
      )

      const select = screen.getByRole('combobox')
      await user.selectOptions(select, '30')

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Save/i })).toBeInTheDocument()
      })
    })

    it('calls onUpdateRetention with new value when Save clicked', async () => {
      const user = userEvent.setup()
      render(
        <IntegrationOverviewTab
          systemConfig={epicConfig}
          integration={mockIntegration}
          stats={mockStats}
          endpointUrl={endpointUrl}
          actionLoading={null}
          onSetup={mockOnSetup}
          onToggleActive={mockOnToggleActive}
          onRotateKey={mockOnRotateKey}
          onUpdateRetention={mockOnUpdateRetention}
          onNavigateTab={mockOnNavigateTab}
          onNavigateLogsWithFilter={mockOnNavigateLogsWithFilter}
        />
      )

      const select = screen.getByRole('combobox')
      await user.selectOptions(select, '180')

      await waitFor(() => {
        const saveButton = screen.getByRole('button', { name: /Save/i })
        expect(saveButton).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /Save/i }))
      expect(mockOnUpdateRetention).toHaveBeenCalledWith(180)
    })

    it('disables Save button when actionLoading is "retention"', async () => {
      const user = userEvent.setup()
      render(
        <IntegrationOverviewTab
          systemConfig={epicConfig}
          integration={mockIntegration}
          stats={mockStats}
          endpointUrl={endpointUrl}
          actionLoading="retention"
          onSetup={mockOnSetup}
          onToggleActive={mockOnToggleActive}
          onRotateKey={mockOnRotateKey}
          onUpdateRetention={mockOnUpdateRetention}
          onNavigateTab={mockOnNavigateTab}
          onNavigateLogsWithFilter={mockOnNavigateLogsWithFilter}
        />
      )

      const select = screen.getByRole('combobox')
      await user.selectOptions(select, '60')

      await waitFor(() => {
        const saveButton = screen.getByRole('button', { name: /Save/i })
        expect(saveButton).toBeDisabled()
      })
    })

    it('defaults to 90 days when retention_days is undefined', () => {
      const integrationWithoutRetention = {
        ...mockIntegration,
        config: { api_key: 'test-key' },
      }
      render(
        <IntegrationOverviewTab
          systemConfig={epicConfig}
          integration={integrationWithoutRetention}
          stats={mockStats}
          endpointUrl={endpointUrl}
          actionLoading={null}
          onSetup={mockOnSetup}
          onToggleActive={mockOnToggleActive}
          onRotateKey={mockOnRotateKey}
          onUpdateRetention={mockOnUpdateRetention}
          onNavigateTab={mockOnNavigateTab}
          onNavigateLogsWithFilter={mockOnNavigateLogsWithFilter}
        />
      )

      const select = screen.getByRole('combobox') as HTMLSelectElement
      expect(select.value).toBe('90')
    })
  })
})
