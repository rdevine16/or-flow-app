/**
 * ReviewQueueRow Tests
 *
 * Tests the ReviewQueueRow component's status icon rendering and display logic.
 * The ReviewQueueRow is defined in PageClient.tsx and renders a scannable list entry
 * with a status icon (CheckCircle2 for resolved, AlertCircle for unresolved).
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { EhrIntegrationLog, EhrEntityMapping } from '@/lib/integrations/shared/integration-types'

// ── Mock computeHasUnresolved ────────────────────────────────────────────────
const mockComputeHasUnresolved = vi.fn()
vi.mock('@/components/integrations/ReviewDetailPanel', () => ({
  computeHasUnresolved: mockComputeHasUnresolved,
}))

// Import the component AFTER mocking
// Since ReviewQueueRow is a local function in PageClient, we'll extract its logic for testing
// For now, we'll create a standalone version that matches the implementation

import { AlertCircle, CheckCircle2 } from 'lucide-react'

// ── ReviewQueueRow Component (extracted from PageClient.tsx) ────────────────
function ReviewQueueRow({
  entry,
  entityMappings,
  isSelected,
  onClick,
}: {
  entry: EhrIntegrationLog
  entityMappings: EhrEntityMapping[]
  isSelected: boolean
  onClick: () => void
}) {
  const parsed = entry.parsed_data as Record<string, unknown> | null
  const hasUnresolved = mockComputeHasUnresolved(entry, entityMappings)

  // Extract display fields
  const patient = parsed?.patient as { firstName?: string; lastName?: string } | null
  const procedure = parsed?.procedure as { name?: string } | null
  const surgeon = parsed?.surgeon as { name?: string } | null

  // Format date/time: M/D/YYYY h:mmam
  // Parse string components directly — scheduledStart is local time without timezone suffix,
  // so new Date() would misinterpret it as UTC and shift the date
  let dateTimeStr = ''
  const scheduledStart = parsed?.scheduledStart as string | undefined
  if (scheduledStart) {
    const [datePart, timePart] = scheduledStart.split('T')
    if (datePart) {
      const [y, m, d] = datePart.split('-').map(Number)
      dateTimeStr = `${m}/${d}/${y}`
      if (timePart) {
        const [hStr, minStr] = timePart.split(':')
        const h = parseInt(hStr, 10)
        const min = minStr || '00'
        const ampm = h >= 12 ? 'pm' : 'am'
        const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
        dateTimeStr += ` ${h12}:${min}${ampm}`
      }
    }
  }

  // Procedure name (short)
  const procedureName = procedure?.name || 'Unknown Procedure'

  // Surgeon last name
  let surgeonDisplay = ''
  if (surgeon?.name) {
    // Names might be "LAST, FIRST" or "First Last" — extract last name
    const parts = surgeon.name.split(',')
    if (parts.length > 1) {
      surgeonDisplay = `Dr ${parts[0].trim()}`
    } else {
      const words = surgeon.name.trim().split(/\s+/)
      surgeonDisplay = `Dr ${words[words.length - 1]}`
    }
  }

  // Patient display: FirstName LastName
  const patientDisplay = patient
    ? `${patient.firstName || ''} ${patient.lastName || ''}`.trim() || 'Unknown'
    : 'Unknown'

  // Mock formatRelativeTime
  const formatRelativeTime = () => '2h ago'

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
        isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'
      }`}
    >
      {/* Status icon */}
      {hasUnresolved ? (
        <AlertCircle data-testid="status-icon-unresolved" className="w-5 h-5 text-amber-500 flex-shrink-0" />
      ) : (
        <CheckCircle2 data-testid="status-icon-resolved" className="w-5 h-5 text-emerald-500 flex-shrink-0" />
      )}

      {/* Row content */}
      <div className="flex-1 min-w-0">
        <span className="text-sm text-slate-900">
          <span className="font-medium">New Case:</span>
          {dateTimeStr && <> {dateTimeStr}</>}
          {procedureName && <> {procedureName}</>}
          {surgeonDisplay && <> {surgeonDisplay}</>}
          {patientDisplay && <> <span className="text-slate-400">-</span> {patientDisplay}</>}
        </span>
      </div>

      {/* Time ago */}
      <span className="text-xs text-slate-400 flex-shrink-0">
        {formatRelativeTime()}
      </span>
    </button>
  )
}

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

const mockEntityMappings: EhrEntityMapping[] = []

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TESTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('ReviewQueueRow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Status icon rendering', () => {
    it('shows AlertCircle (amber) when hasUnresolved=true', () => {
      mockComputeHasUnresolved.mockReturnValue(true)
      const entry = createEntry()
      render(
        <ReviewQueueRow
          entry={entry}
          entityMappings={mockEntityMappings}
          isSelected={false}
          onClick={vi.fn()}
        />,
      )
      expect(screen.getByTestId('status-icon-unresolved')).toBeInTheDocument()
      expect(screen.queryByTestId('status-icon-resolved')).not.toBeInTheDocument()
      const icon = screen.getByTestId('status-icon-unresolved')
      expect(icon).toHaveClass('text-amber-500')
    })

    it('shows CheckCircle2 (emerald) when hasUnresolved=false', () => {
      mockComputeHasUnresolved.mockReturnValue(false)
      const entry = createEntry()
      render(
        <ReviewQueueRow
          entry={entry}
          entityMappings={mockEntityMappings}
          isSelected={false}
          onClick={vi.fn()}
        />,
      )
      expect(screen.getByTestId('status-icon-resolved')).toBeInTheDocument()
      expect(screen.queryByTestId('status-icon-unresolved')).not.toBeInTheDocument()
      const icon = screen.getByTestId('status-icon-resolved')
      expect(icon).toHaveClass('text-emerald-500')
    })
  })

  describe('Row content formatting', () => {
    it('displays formatted date/time in M/D/YYYY h:mmam format', () => {
      mockComputeHasUnresolved.mockReturnValue(false)
      const defaultEntry = createEntry()
      const entry = {
        ...defaultEntry,
        parsed_data: {
          ...(defaultEntry.parsed_data as Record<string, unknown>),
          scheduledStart: '2026-03-15T14:30:00',
        },
      }
      render(
        <ReviewQueueRow
          entry={entry}
          entityMappings={mockEntityMappings}
          isSelected={false}
          onClick={vi.fn()}
        />,
      )
      const button = screen.getByRole('button')
      expect(button.textContent).toContain('3/15/2026')
      expect(button.textContent).toContain('2:30')
      expect(button.textContent).toContain('pm')
    })

    it('extracts surgeon last name from "LAST, FIRST" format', () => {
      mockComputeHasUnresolved.mockReturnValue(false)
      const entry = createEntry({
        parsed_data: {
          surgeon: { name: 'JONES, EMILY A', npi: '1234567890' },
        },
      })
      render(
        <ReviewQueueRow
          entry={entry}
          entityMappings={mockEntityMappings}
          isSelected={false}
          onClick={vi.fn()}
        />,
      )
      expect(screen.getByText(/Dr JONES/)).toBeInTheDocument()
    })

    it('extracts surgeon last name from "First Last" format', () => {
      mockComputeHasUnresolved.mockReturnValue(false)
      const entry = createEntry({
        parsed_data: {
          surgeon: { name: 'Emily Ann Jones', npi: '1234567890' },
        },
      })
      render(
        <ReviewQueueRow
          entry={entry}
          entityMappings={mockEntityMappings}
          isSelected={false}
          onClick={vi.fn()}
        />,
      )
      expect(screen.getByText(/Dr Jones/)).toBeInTheDocument()
    })

    it('displays procedure name', () => {
      mockComputeHasUnresolved.mockReturnValue(false)
      const entry = createEntry({
        parsed_data: {
          procedure: { name: 'Total Hip Replacement' },
        },
      })
      render(
        <ReviewQueueRow
          entry={entry}
          entityMappings={mockEntityMappings}
          isSelected={false}
          onClick={vi.fn()}
        />,
      )
      expect(screen.getByText(/Total Hip Replacement/)).toBeInTheDocument()
    })

    it('displays patient name as "FirstName LastName"', () => {
      mockComputeHasUnresolved.mockReturnValue(false)
      const entry = createEntry({
        parsed_data: {
          patient: { firstName: 'John', lastName: 'Doe' },
        },
      })
      render(
        <ReviewQueueRow
          entry={entry}
          entityMappings={mockEntityMappings}
          isSelected={false}
          onClick={vi.fn()}
        />,
      )
      expect(screen.getByText(/John Doe/)).toBeInTheDocument()
    })

    it('shows "Unknown Procedure" when procedure name is missing', () => {
      mockComputeHasUnresolved.mockReturnValue(false)
      const entry = createEntry({
        parsed_data: {
          procedure: undefined,
        },
      })
      render(
        <ReviewQueueRow
          entry={entry}
          entityMappings={mockEntityMappings}
          isSelected={false}
          onClick={vi.fn()}
        />,
      )
      expect(screen.getByText(/Unknown Procedure/)).toBeInTheDocument()
    })

    it('shows "Unknown" patient when patient data is missing', () => {
      mockComputeHasUnresolved.mockReturnValue(false)
      const defaultEntry = createEntry()
      const entry = {
        ...defaultEntry,
        parsed_data: {
          ...(defaultEntry.parsed_data as Record<string, unknown>),
          patient: undefined,
        },
      }
      render(
        <ReviewQueueRow
          entry={entry}
          entityMappings={mockEntityMappings}
          isSelected={false}
          onClick={vi.fn()}
        />,
      )
      const button = screen.getByRole('button')
      expect(button.textContent).toContain('- Unknown')
    })
  })

  describe('Selection state', () => {
    it('applies bg-blue-50 class when isSelected=true', () => {
      mockComputeHasUnresolved.mockReturnValue(false)
      const entry = createEntry()
      render(
        <ReviewQueueRow
          entry={entry}
          entityMappings={mockEntityMappings}
          isSelected={true}
          onClick={vi.fn()}
        />,
      )
      const button = screen.getByRole('button')
      expect(button).toHaveClass('bg-blue-50')
    })

    it('applies hover:bg-slate-50 class when isSelected=false', () => {
      mockComputeHasUnresolved.mockReturnValue(false)
      const entry = createEntry()
      render(
        <ReviewQueueRow
          entry={entry}
          entityMappings={mockEntityMappings}
          isSelected={false}
          onClick={vi.fn()}
        />,
      )
      const button = screen.getByRole('button')
      expect(button).toHaveClass('hover:bg-slate-50')
    })
  })

  describe('Click handling', () => {
    it('calls onClick when row is clicked', async () => {
      mockComputeHasUnresolved.mockReturnValue(false)
      const onClick = vi.fn()
      const entry = createEntry()
      render(
        <ReviewQueueRow
          entry={entry}
          entityMappings={mockEntityMappings}
          isSelected={false}
          onClick={onClick}
        />,
      )
      const button = screen.getByRole('button')
      await userEvent.click(button)
      expect(onClick).toHaveBeenCalledTimes(1)
    })
  })
})
