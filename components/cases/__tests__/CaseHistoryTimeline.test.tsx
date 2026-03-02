/**
 * CaseHistoryTimeline.test.tsx — Unit tests for CaseHistoryTimeline component
 *
 * Tests:
 * - Empty state renders when no entries
 * - Entries render with correct badges and colors per change_type
 * - "View message" link appears only for HL7v2-sourced entries
 * - Change descriptions format correctly for each field type
 * - Entries are sorted by createdAt descending (newest first)
 * - Change type badges display correct colors
 * - Source badges display correct labels
 * - System attribution shows when changedBy is null
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import CaseHistoryTimeline from '../CaseHistoryTimeline'
import type { CaseHistoryEntry } from '@/lib/integrations/shared/integration-types'

describe('CaseHistoryTimeline', () => {
  it('renders empty state when no entries', () => {
    render(<CaseHistoryTimeline entries={[]} />)

    expect(screen.getByText(/no history recorded/i)).toBeInTheDocument()
    expect(screen.getByText(/history tracking starts when/i)).toBeInTheDocument()
  })

  it('renders single entry with correct change type badge', () => {
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

    render(<CaseHistoryTimeline entries={entries} />)

    expect(screen.getByText('Created')).toBeInTheDocument()
    expect(screen.getByText('Manual')).toBeInTheDocument()
    expect(screen.getByText('by Dr. Smith')).toBeInTheDocument()
    expect(screen.getByText('Case created')).toBeInTheDocument()
  })

  it('renders updated entry with old → new change description', () => {
    const entries: CaseHistoryEntry[] = [
      {
        facilityId: 'facility-1',
        id: 'hist-2',
        caseId: 'case-123',
        changeType: 'updated',
        changeSource: 'manual',
        changedFields: {
          scheduled_date: { old: '2026-03-01', new: '2026-03-02' },
        },
        changedBy: 'user-1',
        changedByName: 'Dr. Smith',
        ehrIntegrationLogId: null,
        createdAt: '2026-03-01T11:00:00Z',
      },
    ]

    render(<CaseHistoryTimeline entries={entries} />)

    expect(screen.getByText('Updated')).toBeInTheDocument()
    expect(screen.getByText(/scheduled date/i)).toBeInTheDocument()
    expect(screen.getByText('2026-03-01')).toBeInTheDocument()
    expect(screen.getByText('2026-03-02')).toBeInTheDocument()
  })

  it('renders status_change entry with amber badge', () => {
    const entries: CaseHistoryEntry[] = [
      {
        facilityId: 'facility-1',
        id: 'hist-3',
        caseId: 'case-123',
        changeType: 'status_change',
        changeSource: 'system',
        changedFields: {
          status_id: { old: 'Scheduled', new: 'In Progress' },
        },
        changedBy: null,
        changedByName: null,
        ehrIntegrationLogId: null,
        createdAt: '2026-03-01T12:00:00Z',
      },
    ]

    render(<CaseHistoryTimeline entries={entries} />)

    expect(screen.getByText('Status Change')).toBeInTheDocument()
    expect(screen.getByText('System')).toBeInTheDocument()
    expect(screen.getByText('by System')).toBeInTheDocument()

    // Check for amber badge styling
    const badge = screen.getByText('Status Change')
    expect(badge.className).toContain('bg-amber')
  })

  it('renders cancelled entry with red badge and notes', () => {
    const entries: CaseHistoryEntry[] = [
      {
        facilityId: 'facility-1',
        id: 'hist-4',
        caseId: 'case-123',
        changeType: 'cancelled',
        changeSource: 'manual',
        changedFields: {
          cancellation_notes: { old: null, new: 'Patient no-show' },
        },
        changedBy: 'user-1',
        changedByName: 'Dr. Smith',
        ehrIntegrationLogId: null,
        createdAt: '2026-03-01T13:00:00Z',
      },
    ]

    render(<CaseHistoryTimeline entries={entries} />)

    expect(screen.getByText('Cancelled')).toBeInTheDocument()
    expect(screen.getByText('Case cancelled')).toBeInTheDocument()
    expect(screen.getByText('Patient no-show')).toBeInTheDocument()

    // Check for red badge styling
    const badge = screen.getByText('Cancelled')
    expect(badge.className).toContain('bg-red')
  })

  it('renders "View message" link for epic_hl7v2 source', () => {
    const entries: CaseHistoryEntry[] = [
      {
        facilityId: 'facility-1',
        id: 'hist-5',
        caseId: 'case-123',
        changeType: 'updated',
        changeSource: 'epic_hl7v2',
        changedFields: {
          scheduled_date: { old: '2026-03-01', new: '2026-03-02' },
        },
        changedBy: null,
        changedByName: null,
        ehrIntegrationLogId: 'log-456',
        createdAt: '2026-03-01T14:00:00Z',
      },
    ]

    render(<CaseHistoryTimeline entries={entries} />)

    expect(screen.getByText('Epic HL7v2')).toBeInTheDocument()

    const link = screen.getByRole('link', { name: /view message/i })
    expect(link).toBeInTheDocument()
    expect(link.getAttribute('href')).toContain('/settings/integrations/epic')
    expect(link.getAttribute('href')).toContain('logId=log-456')
  })

  it('does not render "View message" link for manual source', () => {
    const entries: CaseHistoryEntry[] = [
      {
        facilityId: 'facility-1',
        id: 'hist-6',
        caseId: 'case-123',
        changeType: 'updated',
        changeSource: 'manual',
        changedFields: {
          scheduled_date: { old: '2026-03-01', new: '2026-03-02' },
        },
        changedBy: 'user-1',
        changedByName: 'Dr. Smith',
        ehrIntegrationLogId: null,
        createdAt: '2026-03-01T15:00:00Z',
      },
    ]

    render(<CaseHistoryTimeline entries={entries} />)

    expect(screen.queryByRole('link', { name: /view message/i })).not.toBeInTheDocument()
  })

  it('sorts entries by createdAt descending (newest first)', () => {
    const entries: CaseHistoryEntry[] = [
      {
        facilityId: 'facility-1',
        id: 'hist-old',
        caseId: 'case-123',
        changeType: 'created',
        changeSource: 'manual',
        changedFields: {},
        changedBy: 'user-1',
        changedByName: 'Dr. Smith',
        ehrIntegrationLogId: null,
        createdAt: '2026-03-01T10:00:00Z',
      },
      {
        facilityId: 'facility-1',
        id: 'hist-new',
        caseId: 'case-123',
        changeType: 'updated',
        changeSource: 'manual',
        changedFields: { scheduled_date: { old: '2026-03-01', new: '2026-03-02' } },
        changedBy: 'user-1',
        changedByName: 'Dr. Smith',
        ehrIntegrationLogId: null,
        createdAt: '2026-03-01T15:00:00Z',
      },
    ]

    render(<CaseHistoryTimeline entries={entries} />)

    // Get all badges in order
    const badges = screen.getAllByText(/Created|Updated/)
    expect(badges[0]).toHaveTextContent('Updated')
    expect(badges[1]).toHaveTextContent('Created')
  })

  it('renders multiple field changes in a single entry', () => {
    const entries: CaseHistoryEntry[] = [
      {
        facilityId: 'facility-1',
        id: 'hist-7',
        caseId: 'case-123',
        changeType: 'updated',
        changeSource: 'manual',
        changedFields: {
          scheduled_date: { old: '2026-03-01', new: '2026-03-02' },
          room_id: { old: 'OR-1', new: 'OR-2' },
          surgeon_id: { old: 'Dr. Jones', new: 'Dr. Smith' },
        },
        changedBy: 'user-1',
        changedByName: 'Admin User',
        ehrIntegrationLogId: null,
        createdAt: '2026-03-01T16:00:00Z',
      },
    ]

    render(<CaseHistoryTimeline entries={entries} />)

    expect(screen.getByText(/scheduled date/i)).toBeInTheDocument()
    expect(screen.getByText(/room/i)).toBeInTheDocument()
    expect(screen.getByText(/surgeon/i)).toBeInTheDocument()
    expect(screen.getByText('OR-1')).toBeInTheDocument()
    expect(screen.getByText('OR-2')).toBeInTheDocument()
    expect(screen.getByText('Dr. Jones')).toBeInTheDocument()
    expect(screen.getByText('Dr. Smith')).toBeInTheDocument()
  })

  it('renders "System" attribution when changedBy is null', () => {
    const entries: CaseHistoryEntry[] = [
      {
        facilityId: 'facility-1',
        id: 'hist-8',
        caseId: 'case-123',
        changeType: 'status_change',
        changeSource: 'system',
        changedFields: {
          status_id: { old: 'Scheduled', new: 'In Progress' },
        },
        changedBy: null,
        changedByName: null,
        ehrIntegrationLogId: null,
        createdAt: '2026-03-01T17:00:00Z',
      },
    ]

    render(<CaseHistoryTimeline entries={entries} />)

    expect(screen.getByText('by System')).toBeInTheDocument()
  })

  it('handles created entry with initial field values', () => {
    const entries: CaseHistoryEntry[] = [
      {
        facilityId: 'facility-1',
        id: 'hist-9',
        caseId: 'case-123',
        changeType: 'created',
        changeSource: 'manual',
        changedFields: {
          scheduled_date: { old: null, new: '2026-03-01' },
          room_id: { old: null, new: 'OR-1' },
        },
        changedBy: 'user-1',
        changedByName: 'Dr. Smith',
        ehrIntegrationLogId: null,
        createdAt: '2026-03-01T18:00:00Z',
      },
    ]

    render(<CaseHistoryTimeline entries={entries} />)

    // For created entries, should show only new values, not old → new
    expect(screen.getByText('2026-03-01')).toBeInTheDocument()
    expect(screen.getByText('OR-1')).toBeInTheDocument()
    // Should NOT show arrows for created entries
    expect(screen.queryByText('→')).not.toBeInTheDocument()
  })

  it('renders vertical line between entries', () => {
    const entries: CaseHistoryEntry[] = [
      {
        facilityId: 'facility-1',
        id: 'hist-10',
        caseId: 'case-123',
        changeType: 'created',
        changeSource: 'manual',
        changedFields: {},
        changedBy: 'user-1',
        changedByName: 'Dr. Smith',
        ehrIntegrationLogId: null,
        createdAt: '2026-03-01T19:00:00Z',
      },
      {
        facilityId: 'facility-1',
        id: 'hist-11',
        caseId: 'case-123',
        changeType: 'updated',
        changeSource: 'manual',
        changedFields: { scheduled_date: { old: '2026-03-01', new: '2026-03-02' } },
        changedBy: 'user-1',
        changedByName: 'Dr. Smith',
        ehrIntegrationLogId: null,
        createdAt: '2026-03-01T20:00:00Z',
      },
    ]

    const { container } = render(<CaseHistoryTimeline entries={entries} />)

    // Check for vertical line divs (bg-slate-200)
    const lines = container.querySelectorAll('.bg-slate-200')
    expect(lines.length).toBeGreaterThan(0)
  })
})
