/**
 * CaseDrawerHistory.test.tsx — Integration tests for CaseDrawerHistory
 *
 * Tests:
 * - Loading state renders skeleton
 * - Error state renders error message
 * - Empty state delegates to CaseHistoryTimeline
 * - Entries render via CaseHistoryTimeline
 * - "Load more" button appears when hasMore=true
 * - "Load more" button calls onLoadMore when clicked
 * - "Load more" button is disabled when loading=true
 * - "Load more" button does not appear when hasMore=false
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CaseDrawerHistory from '../CaseDrawerHistory'
import type { CaseHistoryEntry } from '@/lib/integrations/shared/integration-types'

// Mock CaseHistoryTimeline to verify it receives correct props
vi.mock('../CaseHistoryTimeline', () => ({
  default: ({ entries }: { entries: CaseHistoryEntry[] }) => (
    <div data-testid="case-history-timeline">
      {entries.length === 0 ? (
        <p>No history recorded for this case</p>
      ) : (
        <ul>
          {entries.map(e => (
            <li key={e.id}>{e.changeType}</li>
          ))}
        </ul>
      )}
    </div>
  ),
}))

describe('CaseDrawerHistory', () => {
  const mockLoadMore = vi.fn()

  it('renders loading skeleton when loading with no entries', () => {
    render(
      <CaseDrawerHistory
        entries={[]}
        loading={true}
        error={null}
        hasMore={false}
        onLoadMore={mockLoadMore}
      />
    )

    // Should render skeleton placeholders
    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('renders error state when error is present', () => {
    render(
      <CaseDrawerHistory
        entries={[]}
        loading={false}
        error="Database connection failed"
        hasMore={false}
        onLoadMore={mockLoadMore}
      />
    )

    expect(screen.getByText('Failed to load history')).toBeInTheDocument()
    expect(screen.getByText('Database connection failed')).toBeInTheDocument()
  })

  it('renders timeline when entries are present', () => {
    const entries: CaseHistoryEntry[] = [
      {
        facilityId: 'facility-1',
        id: 'hist-1',
        caseId: 'case-123',
        changeType: 'created',
        changeSource: 'manual',
        changedFields: {},
        changedBy: 'user-1',
        changedByName: 'Dr. Smith',
        ehrIntegrationLogId: null,
        createdAt: '2026-03-01T10:00:00Z',
      },
    ]

    render(
      <CaseDrawerHistory
        entries={entries}
        loading={false}
        error={null}
        hasMore={false}
        onLoadMore={mockLoadMore}
      />
    )

    expect(screen.getByTestId('case-history-timeline')).toBeInTheDocument()
    expect(screen.getByText('created')).toBeInTheDocument()
  })

  it('renders empty state via CaseHistoryTimeline when no entries', () => {
    render(
      <CaseDrawerHistory
        entries={[]}
        loading={false}
        error={null}
        hasMore={false}
        onLoadMore={mockLoadMore}
      />
    )

    expect(screen.getByTestId('case-history-timeline')).toBeInTheDocument()
    expect(screen.getByText('No history recorded for this case')).toBeInTheDocument()
  })

  it('renders "Load more" button when hasMore=true', () => {
    const entries: CaseHistoryEntry[] = [
      {
        facilityId: 'facility-1',
        id: 'hist-1',
        caseId: 'case-123',
        changeType: 'created',
        changeSource: 'manual',
        changedFields: {},
        changedBy: 'user-1',
        changedByName: 'Dr. Smith',
        ehrIntegrationLogId: null,
        createdAt: '2026-03-01T10:00:00Z',
      },
    ]

    render(
      <CaseDrawerHistory
        entries={entries}
        loading={false}
        error={null}
        hasMore={true}
        onLoadMore={mockLoadMore}
      />
    )

    expect(screen.getByRole('button', { name: /load more/i })).toBeInTheDocument()
  })

  it('does not render "Load more" button when hasMore=false', () => {
    const entries: CaseHistoryEntry[] = [
      {
        facilityId: 'facility-1',
        id: 'hist-1',
        caseId: 'case-123',
        changeType: 'created',
        changeSource: 'manual',
        changedFields: {},
        changedBy: 'user-1',
        changedByName: 'Dr. Smith',
        ehrIntegrationLogId: null,
        createdAt: '2026-03-01T10:00:00Z',
      },
    ]

    render(
      <CaseDrawerHistory
        entries={entries}
        loading={false}
        error={null}
        hasMore={false}
        onLoadMore={mockLoadMore}
      />
    )

    expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument()
  })

  it('calls onLoadMore when "Load more" button is clicked', async () => {
    const user = userEvent.setup()
    const entries: CaseHistoryEntry[] = [
      {
        facilityId: 'facility-1',
        id: 'hist-1',
        caseId: 'case-123',
        changeType: 'created',
        changeSource: 'manual',
        changedFields: {},
        changedBy: 'user-1',
        changedByName: 'Dr. Smith',
        ehrIntegrationLogId: null,
        createdAt: '2026-03-01T10:00:00Z',
      },
    ]

    render(
      <CaseDrawerHistory
        entries={entries}
        loading={false}
        error={null}
        hasMore={true}
        onLoadMore={mockLoadMore}
      />
    )

    const button = screen.getByRole('button', { name: /load more/i })
    await user.click(button)

    expect(mockLoadMore).toHaveBeenCalledTimes(1)
  })

  it('disables "Load more" button when loading=true', () => {
    const entries: CaseHistoryEntry[] = [
      {
        facilityId: 'facility-1',
        id: 'hist-1',
        caseId: 'case-123',
        changeType: 'created',
        changeSource: 'manual',
        changedFields: {},
        changedBy: 'user-1',
        changedByName: 'Dr. Smith',
        ehrIntegrationLogId: null,
        createdAt: '2026-03-01T10:00:00Z',
      },
    ]

    render(
      <CaseDrawerHistory
        entries={entries}
        loading={true}
        error={null}
        hasMore={true}
        onLoadMore={mockLoadMore}
      />
    )

    const button = screen.getByRole('button', { name: /load more/i })
    expect(button).toBeDisabled()
  })

  it('shows spinner in "Load more" button when loading=true', () => {
    const entries: CaseHistoryEntry[] = [
      {
        facilityId: 'facility-1',
        id: 'hist-1',
        caseId: 'case-123',
        changeType: 'created',
        changeSource: 'manual',
        changedFields: {},
        changedBy: 'user-1',
        changedByName: 'Dr. Smith',
        ehrIntegrationLogId: null,
        createdAt: '2026-03-01T10:00:00Z',
      },
    ]

    const { container } = render(
      <CaseDrawerHistory
        entries={entries}
        loading={true}
        error={null}
        hasMore={true}
        onLoadMore={mockLoadMore}
      />
    )

    // Check for spinner with animate-spin class
    const spinner = container.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })

  it('does not render skeleton when loading with existing entries (pagination)', () => {
    const entries: CaseHistoryEntry[] = [
      {
        facilityId: 'facility-1',
        id: 'hist-1',
        caseId: 'case-123',
        changeType: 'created',
        changeSource: 'manual',
        changedFields: {},
        changedBy: 'user-1',
        changedByName: 'Dr. Smith',
        ehrIntegrationLogId: null,
        createdAt: '2026-03-01T10:00:00Z',
      },
    ]

    render(
      <CaseDrawerHistory
        entries={entries}
        loading={true}
        error={null}
        hasMore={true}
        onLoadMore={mockLoadMore}
      />
    )

    // Should still render timeline (not skeleton) because entries exist
    expect(screen.getByTestId('case-history-timeline')).toBeInTheDocument()
    // Skeleton should NOT be present
    expect(screen.queryByTestId('skeleton')).not.toBeInTheDocument()
  })
})
