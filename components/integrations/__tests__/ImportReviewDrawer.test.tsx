/**
 * ImportReviewDrawer Tests
 *
 * Tests the Radix Dialog slide-over drawer that wraps ReviewDetailPanel
 * and provides approve/reject actions in the header.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ImportReviewDrawer from '../ImportReviewDrawer'
import type { EhrIntegrationLog, EhrEntityMapping } from '@/lib/integrations/shared/integration-types'

// ── Mock ReviewDetailPanel ────────────────────────────────────────────────────
vi.mock('../ReviewDetailPanel', () => ({
  default: ({ entry }: { entry: EhrIntegrationLog }) => (
    <div data-testid="review-detail-panel">
      <span data-testid="entry-id">{entry.id}</span>
    </div>
  ),
  computeHasUnresolved: vi.fn((entry: EhrIntegrationLog) => {
    // Return true if entry has review_notes.unmatched_surgeons
    const reviewNotes = entry.review_notes as { unmatched_surgeons?: unknown[] } | null
    return Boolean(reviewNotes?.unmatched_surgeons && reviewNotes.unmatched_surgeons.length > 0)
  }),
}))

// ── Test Data ────────────────────────────────────────────────────────────────

function createEntry(overrides: Partial<EhrIntegrationLog> = {}): EhrIntegrationLog {
  return {
    id: 'log-1',
    facility_id: 'fac-1',
    integration_id: 'int-1',
    message_type: 'SIU^S12',
    message_control_id: 'MSG001',
    raw_message: 'MSH|^~\\&|EPIC|...',
    parsed_data: {
      triggerEvent: 'S12',
      externalCaseId: 'SC10001',
      scheduledStart: '2026-03-01T08:00:00',
      patient: { firstName: 'Jane', lastName: 'Smith' },
      surgeon: { name: 'JONES, EMILY A', npi: '1234567890' },
      procedure: { name: 'Total knee arthroplasty', code: '27447' },
      room: { external_room_id: 'OR3', name: 'Operating Room 3' },
    },
    review_notes: null,
    status: 'pending_review',
    created_at: '2026-03-01T06:00:00Z',
    updated_at: '2026-03-01T06:00:00Z',
    ...overrides,
  }
}

const mockEntityMappings: EhrEntityMapping[] = [
  {
    id: 'map-1',
    facility_id: 'fac-1',
    integration_id: 'int-1',
    entity_type: 'surgeon',
    external_identifier: '1234567890',
    external_display_name: 'JONES, EMILY A',
    orbit_entity_id: 'surg-2',
    orbit_display_name: 'Jones, Emily',
    match_method: 'auto',
    match_confidence: 0.85,
    created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z',
  },
]

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  entry: createEntry(),
  allSurgeons: [{ id: 'surg-1', label: 'Smith, John' }],
  allProcedures: [{ id: 'proc-1', label: 'Total Knee Replacement' }],
  allRooms: [{ id: 'room-1', label: 'OR 1' }],
  entityMappings: mockEntityMappings,
  onResolveEntity: vi.fn(),
  onRemapCaseOnly: vi.fn(),
  onCreateEntity: vi.fn(),
  onApprove: vi.fn(),
  onReject: vi.fn(),
  onPhiAccess: vi.fn(),
  actionLoading: null as string | null,
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TESTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('ImportReviewDrawer', () => {
  describe('Rendering', () => {
    it('renders drawer when isOpen=true with entry', () => {
      render(<ImportReviewDrawer {...defaultProps} />)
      expect(screen.getByTestId('import-review-drawer')).toBeInTheDocument()
      expect(screen.getByText('Review Import')).toBeInTheDocument()
    })

    it('does not render when entry is null', () => {
      render(<ImportReviewDrawer {...defaultProps} entry={null} />)
      expect(screen.queryByTestId('import-review-drawer')).not.toBeInTheDocument()
    })

    it('renders ReviewDetailPanel with correct entry', () => {
      render(<ImportReviewDrawer {...defaultProps} />)
      expect(screen.getByTestId('review-detail-panel')).toBeInTheDocument()
      expect(screen.getByTestId('entry-id')).toHaveTextContent('log-1')
    })

    it('displays formatted summary line with date, time, procedure, and surgeon', () => {
      const { container } = render(<ImportReviewDrawer {...defaultProps} />)
      const drawerContent = container.querySelector('[data-testid="import-review-drawer"]')
      expect(drawerContent).toBeInTheDocument()
      expect(drawerContent?.textContent).toContain('3/1/2026')
      expect(drawerContent?.textContent).toContain('8:00')
      expect(drawerContent?.textContent).toContain('Total knee arthroplasty')
      expect(drawerContent?.textContent).toContain('Dr JONES')
    })

    it('extracts surgeon last name from comma-separated format', () => {
      const defaultEntry = createEntry()
      const entry = {
        ...defaultEntry,
        parsed_data: {
          ...(defaultEntry.parsed_data as Record<string, unknown>),
          surgeon: { name: 'JONES, EMILY A', npi: '1234567890' },
        },
      }
      const { container } = render(<ImportReviewDrawer {...defaultProps} entry={entry} />)
      const drawerContent = container.querySelector('[data-testid="import-review-drawer"]')
      expect(drawerContent?.textContent).toContain('Dr JONES')
    })

    it('extracts surgeon last name from space-separated format', () => {
      const defaultEntry = createEntry()
      const entry = {
        ...defaultEntry,
        parsed_data: {
          ...(defaultEntry.parsed_data as Record<string, unknown>),
          surgeon: { name: 'Emily Ann Jones', npi: '1234567890' },
        },
      }
      const { container } = render(<ImportReviewDrawer {...defaultProps} entry={entry} />)
      const drawerContent = container.querySelector('[data-testid="import-review-drawer"]')
      expect(drawerContent?.textContent).toContain('Dr Jones')
    })
  })

  describe('Approve button', () => {
    it('is enabled when hasUnresolved=false', () => {
      const entry = createEntry({ review_notes: null })
      render(<ImportReviewDrawer {...defaultProps} entry={entry} />)
      const approveBtn = screen.getByRole('button', { name: /Approve Import/i })
      expect(approveBtn).not.toBeDisabled()
    })

    it('is disabled when hasUnresolved=true', () => {
      const entry = createEntry({
        review_notes: {
          unmatched_surgeons: [{ npi: '1234567890', name: 'JONES, EMILY A' }],
        },
      })
      render(<ImportReviewDrawer {...defaultProps} entry={entry} />)
      const approveBtn = screen.getByRole('button', { name: /Approve Import/i })
      expect(approveBtn).toBeDisabled()
      expect(approveBtn).toHaveAttribute('title', 'Resolve all unmatched entities first')
    })

    it('is disabled when actionLoading matches approve-{entryId}', () => {
      render(<ImportReviewDrawer {...defaultProps} actionLoading="approve-log-1" />)
      const approveBtn = screen.getByRole('button', { name: /Approve Import/i })
      expect(approveBtn).toBeDisabled()
    })

    it('shows loader icon when actionLoading matches approve-{entryId}', () => {
      render(<ImportReviewDrawer {...defaultProps} actionLoading="approve-log-1" />)
      const approveBtn = screen.getByRole('button', { name: /Approve Import/i })
      // Loader2 has animate-spin class
      const loader = approveBtn.querySelector('.animate-spin')
      expect(loader).toBeInTheDocument()
    })

    it('calls onApprove with entry when clicked', async () => {
      const onApprove = vi.fn()
      const entry = createEntry({ review_notes: null })
      render(<ImportReviewDrawer {...defaultProps} entry={entry} onApprove={onApprove} />)
      const approveBtn = screen.getByRole('button', { name: /Approve Import/i })
      await userEvent.click(approveBtn)
      expect(onApprove).toHaveBeenCalledTimes(1)
      expect(onApprove).toHaveBeenCalledWith(entry)
    })
  })

  describe('Reject button', () => {
    it('is always enabled when not loading', () => {
      render(<ImportReviewDrawer {...defaultProps} />)
      const rejectBtn = screen.getByRole('button', { name: /Reject/i })
      expect(rejectBtn).not.toBeDisabled()
    })

    it('is disabled when actionLoading matches reject-{entryId}', () => {
      render(<ImportReviewDrawer {...defaultProps} actionLoading="reject-log-1" />)
      const rejectBtn = screen.getByRole('button', { name: /Reject/i })
      expect(rejectBtn).toBeDisabled()
    })

    it('shows loader icon when actionLoading matches reject-{entryId}', () => {
      render(<ImportReviewDrawer {...defaultProps} actionLoading="reject-log-1" />)
      const rejectBtn = screen.getByRole('button', { name: /Reject/i })
      const loader = rejectBtn.querySelector('.animate-spin')
      expect(loader).toBeInTheDocument()
    })

    it('calls onReject with entry when clicked', async () => {
      const onReject = vi.fn()
      const entry = createEntry()
      render(<ImportReviewDrawer {...defaultProps} entry={entry} onReject={onReject} />)
      const rejectBtn = screen.getByRole('button', { name: /Reject/i })
      await userEvent.click(rejectBtn)
      expect(onReject).toHaveBeenCalledTimes(1)
      expect(onReject).toHaveBeenCalledWith(entry)
    })
  })

  describe('Close button', () => {
    it('calls onClose when X button clicked', async () => {
      const onClose = vi.fn()
      render(<ImportReviewDrawer {...defaultProps} onClose={onClose} />)
      const closeBtn = screen.getByRole('button', { name: /Close drawer/i })
      await userEvent.click(closeBtn)
      await waitFor(() => {
        expect(onClose).toHaveBeenCalled()
      })
    })
  })

  describe('Summary line formatting', () => {
    it('handles missing scheduledStart gracefully', () => {
      const entry = createEntry({
        parsed_data: {
          procedure: { name: 'ACL Reconstruction' },
        },
      })
      render(<ImportReviewDrawer {...defaultProps} entry={entry} />)
      expect(screen.getByText(/ACL Reconstruction/)).toBeInTheDocument()
    })

    it('handles missing procedure gracefully', () => {
      const defaultEntry = createEntry()
      const entry = {
        ...defaultEntry,
        parsed_data: {
          ...(defaultEntry.parsed_data as Record<string, unknown>),
          procedure: undefined, // Remove procedure
          surgeon: { name: 'Smith, John', npi: '1234567890' },
        },
      }
      const { container } = render(<ImportReviewDrawer {...defaultProps} entry={entry} />)
      const drawerContent = container.querySelector('[data-testid="import-review-drawer"]')
      expect(drawerContent?.textContent).toContain('3/1/2026')
      expect(drawerContent?.textContent).toContain('8:00')
      expect(drawerContent?.textContent).toContain('Dr Smith')
    })

    it('handles missing surgeon gracefully', () => {
      const defaultEntry = createEntry()
      const entry = {
        ...defaultEntry,
        parsed_data: {
          ...(defaultEntry.parsed_data as Record<string, unknown>),
          surgeon: undefined, // Remove surgeon
          procedure: { name: 'Total Hip Replacement' },
        },
      }
      const { container } = render(<ImportReviewDrawer {...defaultProps} entry={entry} />)
      const drawerContent = container.querySelector('[data-testid="import-review-drawer"]')
      expect(drawerContent?.textContent).toContain('3/1/2026')
      expect(drawerContent?.textContent).toContain('8:00')
      expect(drawerContent?.textContent).toContain('Total Hip Replacement')
    })

    it('returns "Unknown import" when parsed_data is null', () => {
      const entry = createEntry({ parsed_data: null })
      render(<ImportReviewDrawer {...defaultProps} entry={entry} />)
      expect(screen.getByText('Unknown import')).toBeInTheDocument()
    })
  })
})
