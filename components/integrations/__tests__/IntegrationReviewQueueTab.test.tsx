/**
 * IntegrationReviewQueueTab.test.tsx — Unit tests for shared Review Queue tab
 *
 * Tests that the component correctly renders pending reviews, handles approve/reject,
 * and opens the ImportReviewDrawer with correct props including incomingColumnLabel.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import IntegrationReviewQueueTab from '@/components/integrations/IntegrationReviewQueueTab'
import type { EhrIntegrationLog, EhrEntityMapping } from '@/lib/integrations/shared/integration-types'

// Mock ImportReviewDrawer to avoid full component rendering
vi.mock('@/components/integrations/ImportReviewDrawer', () => ({
  default: ({ isOpen, incomingColumnLabel }: { isOpen: boolean; incomingColumnLabel?: string }) => (
    isOpen ? <div data-testid="import-review-drawer">Drawer Open - Label: {incomingColumnLabel}</div> : null
  ),
}))

describe('IntegrationReviewQueueTab', () => {
  const mockOnApprove = vi.fn()
  const mockOnApproveAll = vi.fn()
  const mockOnReject = vi.fn()
  const mockOnResolveEntity = vi.fn()
  const mockOnRemapCaseOnly = vi.fn()
  const mockOnCreateEntity = vi.fn()
  const mockOnPhiAccess = vi.fn()
  const mockGetEntitiesForType = vi.fn()

  const mockPendingReview: EhrIntegrationLog = {
    id: 'log-123',
    facility_id: 'fac-456',
    integration_id: 'int-789',
    message_type: 'SIU_S12',
    processing_status: 'pending_review',
    parsed_data: {
      patient: { firstName: 'John', lastName: 'Smith' },
      surgeon: { name: 'Johnson, Sarah' },
      procedure: { name: 'Total Knee Arthroplasty' },
      scheduledStart: '2026-03-15T09:00:00',
    },
    review_notes: {
      matched_surgeon: { orbit_entity_id: 'surgeon-1', orbit_display_name: 'Dr Sarah Johnson' },
      matched_procedure: { orbit_entity_id: 'proc-1', orbit_display_name: 'Total Knee Arthroplasty' },
      matched_room: { orbit_entity_id: 'room-1', orbit_display_name: 'OR 1' },
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  const mockEntityMappings: EhrEntityMapping[] = []

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetEntitiesForType.mockImplementation((type: string) => {
      if (type === 'surgeon') return [{ id: 'surgeon-1', label: 'Dr Sarah Johnson' }]
      if (type === 'procedure') return [{ id: 'proc-1', label: 'Total Knee Arthroplasty' }]
      if (type === 'room') return [{ id: 'room-1', label: 'OR 1' }]
      return []
    })
  })

  describe('loading state', () => {
    it('shows skeleton loaders when loading', () => {
      render(
        <IntegrationReviewQueueTab
          pendingReviews={[]}
          loading={true}
          actionLoading={null}
          approveAllLoading={false}
          getEntitiesForType={mockGetEntitiesForType}
          entityMappings={mockEntityMappings}
          onApprove={mockOnApprove}
          onApproveAll={mockOnApproveAll}
          onReject={mockOnReject}
          onResolveEntity={mockOnResolveEntity}
          onRemapCaseOnly={mockOnRemapCaseOnly}
          onCreateEntity={mockOnCreateEntity}
          onPhiAccess={mockOnPhiAccess}
        />
      )

      // Skeleton loaders should have animate-pulse class
      const skeletons = document.querySelectorAll('.animate-pulse')
      expect(skeletons.length).toBeGreaterThan(0)
    })
  })

  describe('empty state', () => {
    it('shows empty state when no pending reviews', () => {
      render(
        <IntegrationReviewQueueTab
          pendingReviews={[]}
          loading={false}
          actionLoading={null}
          approveAllLoading={false}
          getEntitiesForType={mockGetEntitiesForType}
          entityMappings={mockEntityMappings}
          onApprove={mockOnApprove}
          onApproveAll={mockOnApproveAll}
          onReject={mockOnReject}
          onResolveEntity={mockOnResolveEntity}
          onRemapCaseOnly={mockOnRemapCaseOnly}
          onCreateEntity={mockOnCreateEntity}
          onPhiAccess={mockOnPhiAccess}
        />
      )

      expect(screen.getByText(/No pending reviews/)).toBeInTheDocument()
      expect(screen.getByText(/All imports are up to date/)).toBeInTheDocument()
    })
  })

  describe('pending reviews list', () => {
    it('renders pending review count', () => {
      render(
        <IntegrationReviewQueueTab
          pendingReviews={[mockPendingReview]}
          loading={false}
          actionLoading={null}
          approveAllLoading={false}
          getEntitiesForType={mockGetEntitiesForType}
          entityMappings={mockEntityMappings}
          onApprove={mockOnApprove}
          onApproveAll={mockOnApproveAll}
          onReject={mockOnReject}
          onResolveEntity={mockOnResolveEntity}
          onRemapCaseOnly={mockOnRemapCaseOnly}
          onCreateEntity={mockOnCreateEntity}
          onPhiAccess={mockOnPhiAccess}
        />
      )

      expect(screen.getByText('1 import pending review')).toBeInTheDocument()
    })

    it('renders plural count correctly', () => {
      const twoReviews = [
        mockPendingReview,
        { ...mockPendingReview, id: 'log-456' },
      ]
      render(
        <IntegrationReviewQueueTab
          pendingReviews={twoReviews}
          loading={false}
          actionLoading={null}
          approveAllLoading={false}
          getEntitiesForType={mockGetEntitiesForType}
          entityMappings={mockEntityMappings}
          onApprove={mockOnApprove}
          onApproveAll={mockOnApproveAll}
          onReject={mockOnReject}
          onResolveEntity={mockOnResolveEntity}
          onRemapCaseOnly={mockOnRemapCaseOnly}
          onCreateEntity={mockOnCreateEntity}
          onPhiAccess={mockOnPhiAccess}
        />
      )

      expect(screen.getByText('2 imports pending review')).toBeInTheDocument()
    })

    it('renders review row with parsed data', () => {
      render(
        <IntegrationReviewQueueTab
          pendingReviews={[mockPendingReview]}
          loading={false}
          actionLoading={null}
          approveAllLoading={false}
          getEntitiesForType={mockGetEntitiesForType}
          entityMappings={mockEntityMappings}
          onApprove={mockOnApprove}
          onApproveAll={mockOnApproveAll}
          onReject={mockOnReject}
          onResolveEntity={mockOnResolveEntity}
          onRemapCaseOnly={mockOnRemapCaseOnly}
          onCreateEntity={mockOnCreateEntity}
          onPhiAccess={mockOnPhiAccess}
        />
      )

      expect(screen.getByText(/New Case:/)).toBeInTheDocument()
      expect(screen.getByText(/3\/15\/2026/)).toBeInTheDocument()
      expect(screen.getByText(/Total Knee Arthroplasty/)).toBeInTheDocument()
      expect(screen.getByText(/Dr Johnson/)).toBeInTheDocument()
      expect(screen.getByText(/John Smith/)).toBeInTheDocument()
    })

    it('extracts surgeon last name from comma-separated format', () => {
      render(
        <IntegrationReviewQueueTab
          pendingReviews={[mockPendingReview]}
          loading={false}
          actionLoading={null}
          approveAllLoading={false}
          getEntitiesForType={mockGetEntitiesForType}
          entityMappings={mockEntityMappings}
          onApprove={mockOnApprove}
          onApproveAll={mockOnApproveAll}
          onReject={mockOnReject}
          onResolveEntity={mockOnResolveEntity}
          onRemapCaseOnly={mockOnRemapCaseOnly}
          onCreateEntity={mockOnCreateEntity}
          onPhiAccess={mockOnPhiAccess}
        />
      )

      // "Johnson, Sarah" should display as "Dr Johnson"
      expect(screen.getByText(/Dr Johnson/)).toBeInTheDocument()
    })

    it('extracts surgeon last name from space-separated format', () => {
      const reviewWithSpaceName = {
        ...mockPendingReview,
        parsed_data: {
          ...mockPendingReview.parsed_data,
          surgeon: { name: 'Sarah Johnson' },
        },
      }
      render(
        <IntegrationReviewQueueTab
          pendingReviews={[reviewWithSpaceName]}
          loading={false}
          actionLoading={null}
          approveAllLoading={false}
          getEntitiesForType={mockGetEntitiesForType}
          entityMappings={mockEntityMappings}
          onApprove={mockOnApprove}
          onApproveAll={mockOnApproveAll}
          onReject={mockOnReject}
          onResolveEntity={mockOnResolveEntity}
          onRemapCaseOnly={mockOnRemapCaseOnly}
          onCreateEntity={mockOnCreateEntity}
          onPhiAccess={mockOnPhiAccess}
        />
      )

      // "Sarah Johnson" should display as "Dr Johnson"
      expect(screen.getByText(/Dr Johnson/)).toBeInTheDocument()
    })

    it('handles missing procedure gracefully', () => {
      const reviewNoProcedure = {
        ...mockPendingReview,
        parsed_data: {
          ...mockPendingReview.parsed_data,
          procedure: null,
        },
      }
      render(
        <IntegrationReviewQueueTab
          pendingReviews={[reviewNoProcedure]}
          loading={false}
          actionLoading={null}
          approveAllLoading={false}
          getEntitiesForType={mockGetEntitiesForType}
          entityMappings={mockEntityMappings}
          onApprove={mockOnApprove}
          onApproveAll={mockOnApproveAll}
          onReject={mockOnReject}
          onResolveEntity={mockOnResolveEntity}
          onRemapCaseOnly={mockOnRemapCaseOnly}
          onCreateEntity={mockOnCreateEntity}
          onPhiAccess={mockOnPhiAccess}
        />
      )

      expect(screen.getByText(/Unknown Procedure/)).toBeInTheDocument()
    })

    it('handles missing patient gracefully', () => {
      const reviewNoPatient = {
        ...mockPendingReview,
        parsed_data: {
          ...mockPendingReview.parsed_data,
          patient: null,
        },
      }
      render(
        <IntegrationReviewQueueTab
          pendingReviews={[reviewNoPatient]}
          loading={false}
          actionLoading={null}
          approveAllLoading={false}
          getEntitiesForType={mockGetEntitiesForType}
          entityMappings={mockEntityMappings}
          onApprove={mockOnApprove}
          onApproveAll={mockOnApproveAll}
          onReject={mockOnReject}
          onResolveEntity={mockOnResolveEntity}
          onRemapCaseOnly={mockOnRemapCaseOnly}
          onCreateEntity={mockOnCreateEntity}
          onPhiAccess={mockOnPhiAccess}
        />
      )

      expect(screen.getByText(/Unknown/)).toBeInTheDocument()
    })
  })

  describe('approve all functionality', () => {
    it('shows Approve All button when there are approvable entries', () => {
      render(
        <IntegrationReviewQueueTab
          pendingReviews={[mockPendingReview]}
          loading={false}
          actionLoading={null}
          approveAllLoading={false}
          getEntitiesForType={mockGetEntitiesForType}
          entityMappings={mockEntityMappings}
          onApprove={mockOnApprove}
          onApproveAll={mockOnApproveAll}
          onReject={mockOnReject}
          onResolveEntity={mockOnResolveEntity}
          onRemapCaseOnly={mockOnRemapCaseOnly}
          onCreateEntity={mockOnCreateEntity}
          onPhiAccess={mockOnPhiAccess}
        />
      )

      expect(screen.getByRole('button', { name: /Approve All \(1\)/i })).toBeInTheDocument()
    })

    it('calls onApproveAll with approvable entries when clicked', async () => {
      const user = userEvent.setup()
      render(
        <IntegrationReviewQueueTab
          pendingReviews={[mockPendingReview]}
          loading={false}
          actionLoading={null}
          approveAllLoading={false}
          getEntitiesForType={mockGetEntitiesForType}
          entityMappings={mockEntityMappings}
          onApprove={mockOnApprove}
          onApproveAll={mockOnApproveAll}
          onReject={mockOnReject}
          onResolveEntity={mockOnResolveEntity}
          onRemapCaseOnly={mockOnRemapCaseOnly}
          onCreateEntity={mockOnCreateEntity}
          onPhiAccess={mockOnPhiAccess}
        />
      )

      await user.click(screen.getByRole('button', { name: /Approve All/i }))
      expect(mockOnApproveAll).toHaveBeenCalledWith([mockPendingReview])
    })

    it('disables Approve All button when approveAllLoading is true', () => {
      render(
        <IntegrationReviewQueueTab
          pendingReviews={[mockPendingReview]}
          loading={false}
          actionLoading={null}
          approveAllLoading={true}
          getEntitiesForType={mockGetEntitiesForType}
          entityMappings={mockEntityMappings}
          onApprove={mockOnApprove}
          onApproveAll={mockOnApproveAll}
          onReject={mockOnReject}
          onResolveEntity={mockOnResolveEntity}
          onRemapCaseOnly={mockOnRemapCaseOnly}
          onCreateEntity={mockOnCreateEntity}
          onPhiAccess={mockOnPhiAccess}
        />
      )

      expect(screen.getByRole('button', { name: /Approve All/i })).toBeDisabled()
    })

    it('does NOT show Approve All when all entries have unresolved mappings', () => {
      const unresolvedReview = {
        ...mockPendingReview,
        review_notes: {
          unmatched_surgeon: { ehr_identifier: '12345', ehr_name: 'Unknown Surgeon' },
        },
      }
      render(
        <IntegrationReviewQueueTab
          pendingReviews={[unresolvedReview]}
          loading={false}
          actionLoading={null}
          approveAllLoading={false}
          getEntitiesForType={mockGetEntitiesForType}
          entityMappings={mockEntityMappings}
          onApprove={mockOnApprove}
          onApproveAll={mockOnApproveAll}
          onReject={mockOnReject}
          onResolveEntity={mockOnResolveEntity}
          onRemapCaseOnly={mockOnRemapCaseOnly}
          onCreateEntity={mockOnCreateEntity}
          onPhiAccess={mockOnPhiAccess}
        />
      )

      expect(screen.queryByRole('button', { name: /Approve All/i })).not.toBeInTheDocument()
    })
  })

  describe('ImportReviewDrawer integration', () => {
    it('opens drawer when review row clicked', async () => {
      const user = userEvent.setup()
      render(
        <IntegrationReviewQueueTab
          pendingReviews={[mockPendingReview]}
          loading={false}
          actionLoading={null}
          approveAllLoading={false}
          getEntitiesForType={mockGetEntitiesForType}
          entityMappings={mockEntityMappings}
          onApprove={mockOnApprove}
          onApproveAll={mockOnApproveAll}
          onReject={mockOnReject}
          onResolveEntity={mockOnResolveEntity}
          onRemapCaseOnly={mockOnRemapCaseOnly}
          onCreateEntity={mockOnCreateEntity}
          onPhiAccess={mockOnPhiAccess}
        />
      )

      await user.click(screen.getByText(/New Case:/))
      expect(screen.getByTestId('import-review-drawer')).toBeInTheDocument()
    })

    it('passes incomingColumnLabel to ImportReviewDrawer', async () => {
      const user = userEvent.setup()
      render(
        <IntegrationReviewQueueTab
          pendingReviews={[mockPendingReview]}
          loading={false}
          actionLoading={null}
          approveAllLoading={false}
          getEntitiesForType={mockGetEntitiesForType}
          entityMappings={mockEntityMappings}
          incomingColumnLabel="Cerner (Incoming)"
          onApprove={mockOnApprove}
          onApproveAll={mockOnApproveAll}
          onReject={mockOnReject}
          onResolveEntity={mockOnResolveEntity}
          onRemapCaseOnly={mockOnRemapCaseOnly}
          onCreateEntity={mockOnCreateEntity}
          onPhiAccess={mockOnPhiAccess}
        />
      )

      await user.click(screen.getByText(/New Case:/))
      expect(screen.getByText(/Cerner \(Incoming\)/)).toBeInTheDocument()
    })

    it('passes undefined incomingColumnLabel when not provided', async () => {
      const user = userEvent.setup()
      render(
        <IntegrationReviewQueueTab
          pendingReviews={[mockPendingReview]}
          loading={false}
          actionLoading={null}
          approveAllLoading={false}
          getEntitiesForType={mockGetEntitiesForType}
          entityMappings={mockEntityMappings}
          onApprove={mockOnApprove}
          onApproveAll={mockOnApproveAll}
          onReject={mockOnReject}
          onResolveEntity={mockOnResolveEntity}
          onRemapCaseOnly={mockOnRemapCaseOnly}
          onCreateEntity={mockOnCreateEntity}
          onPhiAccess={mockOnPhiAccess}
        />
      )

      await user.click(screen.getByText(/New Case:/))
      // Drawer should render "Drawer Open - Label: undefined" when no label provided
      expect(screen.getByTestId('import-review-drawer')).toHaveTextContent('Drawer Open - Label:')
    })
  })
})
