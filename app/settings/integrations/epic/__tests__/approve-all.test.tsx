/**
 * Phase 15: Approve All Tests
 *
 * Tests the batch approval logic, approvable entries filtering,
 * and Approve All button rendering.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { EhrIntegrationLog, EhrEntityMapping } from '@/lib/integrations/shared/integration-types'

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockComputeHasUnresolved = vi.fn()
vi.mock('@/components/integrations/ReviewDetailPanel', () => ({
  computeHasUnresolved: (...args: unknown[]) => mockComputeHasUnresolved(...args),
}))

// ── Test helpers ─────────────────────────────────────────────────────────────

function createEntry(id: string, overrides: Partial<EhrIntegrationLog> = {}): EhrIntegrationLog {
  return {
    id,
    facility_id: 'fac-1',
    integration_id: 'int-1',
    message_type: 'SIU^S12',
    message_control_id: `MSG-${id}`,
    raw_message: 'MSH|^~\\&|EPIC|...',
    parsed_data: {
      triggerEvent: 'S12',
      externalCaseId: `SC-${id}`,
      scheduledStart: '2026-03-01T08:00:00',
      patient: { firstName: 'Jane', lastName: 'Smith' },
      surgeon: { name: 'JONES, EMILY A', npi: '1234567890' },
      procedure: { name: 'Total knee arthroplasty', code: '27447' },
      room: { name: 'OR 3' },
    },
    review_notes: null,
    status: 'pending_review',
    created_at: '2026-03-01T06:00:00Z',
    updated_at: '2026-03-01T06:00:00Z',
    ...overrides,
  }
}

// ── Minimal ReviewQueueTab (extracted logic under test) ─────────────────────
// This mirrors the ReviewQueueTab component's Approve All logic from PageClient.tsx

function ApproveAllTestHarness({
  pendingReviews,
  entityMappings,
  onApproveAll,
  approveAllLoading,
}: {
  pendingReviews: EhrIntegrationLog[]
  entityMappings: EhrEntityMapping[]
  onApproveAll: (entries: EhrIntegrationLog[]) => Promise<void>
  approveAllLoading: boolean
}) {
  const approvableEntries = pendingReviews.filter(
    entry => !mockComputeHasUnresolved(entry, entityMappings)
  )

  return (
    <div>
      <div data-testid="pending-count">
        {pendingReviews.length} import{pendingReviews.length !== 1 ? 's' : ''} pending review
      </div>
      {approvableEntries.length > 0 && (
        <button
          data-testid="approve-all-button"
          onClick={() => onApproveAll(approvableEntries)}
          disabled={approveAllLoading}
        >
          {approveAllLoading ? 'Approving...' : `Approve All (${approvableEntries.length})`}
        </button>
      )}
      <ul data-testid="entry-list">
        {pendingReviews.map(entry => (
          <li key={entry.id} data-testid={`entry-${entry.id}`}>
            {mockComputeHasUnresolved(entry, entityMappings) ? 'unresolved' : 'ready'}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TESTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('Phase 15: Approve All', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── Unit: approvableEntries filter ──────────────────────────────────────────

  describe('approvableEntries computation', () => {
    it('filters out entries with unresolved entities', () => {
      const entries = [
        createEntry('1'),
        createEntry('2'),
        createEntry('3'),
      ]
      // Entry 1: resolved, Entry 2: unresolved, Entry 3: resolved
      mockComputeHasUnresolved.mockImplementation((entry: EhrIntegrationLog) => {
        return entry.id === '2'
      })

      render(
        <ApproveAllTestHarness
          pendingReviews={entries}
          entityMappings={[]}
          onApproveAll={vi.fn()}
          approveAllLoading={false}
        />,
      )

      // Button should show count of 2 (entries 1 and 3 are approvable)
      const button = screen.getByTestId('approve-all-button')
      expect(button.textContent).toBe('Approve All (2)')
    })

    it('hides button when all entries have unresolved entities', () => {
      const entries = [createEntry('1'), createEntry('2')]
      mockComputeHasUnresolved.mockReturnValue(true)

      render(
        <ApproveAllTestHarness
          pendingReviews={entries}
          entityMappings={[]}
          onApproveAll={vi.fn()}
          approveAllLoading={false}
        />,
      )

      expect(screen.queryByTestId('approve-all-button')).not.toBeInTheDocument()
    })

    it('shows button when at least one entry is approvable', () => {
      const entries = [createEntry('1'), createEntry('2')]
      // Only entry 1 is resolved
      mockComputeHasUnresolved.mockImplementation((entry: EhrIntegrationLog) => {
        return entry.id === '2'
      })

      render(
        <ApproveAllTestHarness
          pendingReviews={entries}
          entityMappings={[]}
          onApproveAll={vi.fn()}
          approveAllLoading={false}
        />,
      )

      const button = screen.getByTestId('approve-all-button')
      expect(button.textContent).toBe('Approve All (1)')
    })

    it('passes entityMappings to computeHasUnresolved', () => {
      const entries = [createEntry('1')]
      const mappings = [
        { id: 'm1', entity_type: 'surgeon', external_identifier: 'NPI123' },
      ] as EhrEntityMapping[]
      mockComputeHasUnresolved.mockReturnValue(false)

      render(
        <ApproveAllTestHarness
          pendingReviews={entries}
          entityMappings={mappings}
          onApproveAll={vi.fn()}
          approveAllLoading={false}
        />,
      )

      expect(mockComputeHasUnresolved).toHaveBeenCalledWith(entries[0], mappings)
    })
  })

  // ── Unit: Approve All button ────────────────────────────────────────────────

  describe('Approve All button', () => {
    it('calls onApproveAll with only approvable entries when clicked', async () => {
      const entries = [createEntry('1'), createEntry('2'), createEntry('3')]
      // Entry 2 is unresolved
      mockComputeHasUnresolved.mockImplementation((entry: EhrIntegrationLog) => {
        return entry.id === '2'
      })
      const onApproveAll = vi.fn().mockResolvedValue(undefined)

      render(
        <ApproveAllTestHarness
          pendingReviews={entries}
          entityMappings={[]}
          onApproveAll={onApproveAll}
          approveAllLoading={false}
        />,
      )

      await userEvent.click(screen.getByTestId('approve-all-button'))

      expect(onApproveAll).toHaveBeenCalledTimes(1)
      const calledWith = onApproveAll.mock.calls[0][0] as EhrIntegrationLog[]
      expect(calledWith).toHaveLength(2)
      expect(calledWith.map((e: EhrIntegrationLog) => e.id)).toEqual(['1', '3'])
    })

    it('is disabled during loading state', () => {
      const entries = [createEntry('1')]
      mockComputeHasUnresolved.mockReturnValue(false)

      render(
        <ApproveAllTestHarness
          pendingReviews={entries}
          entityMappings={[]}
          onApproveAll={vi.fn()}
          approveAllLoading={true}
        />,
      )

      const button = screen.getByTestId('approve-all-button')
      expect(button).toBeDisabled()
      expect(button.textContent).toBe('Approving...')
    })

    it('shows correct count matching actual approvable entries', () => {
      const entries = [
        createEntry('1'),
        createEntry('2'),
        createEntry('3'),
        createEntry('4'),
        createEntry('5'),
      ]
      // 3 resolved, 2 unresolved
      mockComputeHasUnresolved.mockImplementation((entry: EhrIntegrationLog) => {
        return entry.id === '2' || entry.id === '4'
      })

      render(
        <ApproveAllTestHarness
          pendingReviews={entries}
          entityMappings={[]}
          onApproveAll={vi.fn()}
          approveAllLoading={false}
        />,
      )

      expect(screen.getByTestId('approve-all-button').textContent).toBe('Approve All (3)')
      // Verify the list shows correct status for each
      const list = screen.getByTestId('entry-list')
      expect(within(list).getByTestId('entry-1').textContent).toBe('ready')
      expect(within(list).getByTestId('entry-2').textContent).toBe('unresolved')
      expect(within(list).getByTestId('entry-3').textContent).toBe('ready')
      expect(within(list).getByTestId('entry-4').textContent).toBe('unresolved')
      expect(within(list).getByTestId('entry-5').textContent).toBe('ready')
    })
  })

  // ── Integration: handleApproveAll batch logic ──────────────────────────────

  describe('handleApproveAll batch processing', () => {
    // This tests the handleApproveAll pattern extracted from PageClient.tsx

    async function simulateBatchApproval(
      entries: EhrIntegrationLog[],
      executeResult: (entry: EhrIntegrationLog) => Promise<{ success: boolean; error?: string }>,
    ) {
      let successCount = 0
      let failCount = 0

      for (const entry of entries) {
        try {
          const result = await executeResult(entry)
          if (result.success) {
            successCount++
          } else {
            failCount++
          }
        } catch {
          failCount++
        }
      }

      return { successCount, failCount }
    }

    it('processes all entries sequentially and counts successes', async () => {
      const entries = [createEntry('1'), createEntry('2'), createEntry('3')]
      const processedIds: string[] = []

      const result = await simulateBatchApproval(entries, async (entry) => {
        processedIds.push(entry.id)
        return { success: true }
      })

      expect(result.successCount).toBe(3)
      expect(result.failCount).toBe(0)
      expect(processedIds).toEqual(['1', '2', '3'])
    })

    it('continues processing after a failure (does not abort)', async () => {
      const entries = [createEntry('1'), createEntry('2'), createEntry('3')]
      const processedIds: string[] = []

      const result = await simulateBatchApproval(entries, async (entry) => {
        processedIds.push(entry.id)
        if (entry.id === '2') return { success: false, error: 'Entity not found' }
        return { success: true }
      })

      expect(result.successCount).toBe(2)
      expect(result.failCount).toBe(1)
      // All 3 entries were attempted (not aborted after failure)
      expect(processedIds).toEqual(['1', '2', '3'])
    })

    it('handles thrown errors without aborting the batch', async () => {
      const entries = [createEntry('1'), createEntry('2'), createEntry('3')]

      const result = await simulateBatchApproval(entries, async (entry) => {
        if (entry.id === '2') throw new Error('Network error')
        return { success: true }
      })

      expect(result.successCount).toBe(2)
      expect(result.failCount).toBe(1)
    })

    it('returns zero counts for empty array', async () => {
      const result = await simulateBatchApproval([], async () => ({ success: true }))
      expect(result.successCount).toBe(0)
      expect(result.failCount).toBe(0)
    })

    it('tracks mixed results correctly (partial success)', async () => {
      const entries = [
        createEntry('1'),
        createEntry('2'),
        createEntry('3'),
        createEntry('4'),
        createEntry('5'),
      ]

      const result = await simulateBatchApproval(entries, async (entry) => {
        // 3 succeed, 1 returns error, 1 throws
        if (entry.id === '2') return { success: false, error: 'Missing mapping' }
        if (entry.id === '4') throw new Error('Timeout')
        return { success: true }
      })

      expect(result.successCount).toBe(3)
      expect(result.failCount).toBe(2)
    })
  })

  // ── Workflow: Approve All button + count parity ────────────────────────────

  describe('workflow: count-list parity', () => {
    it('button count matches actual approvable entries after entity resolution changes state', () => {
      const entries = [createEntry('1'), createEntry('2'), createEntry('3')]

      // Initially all unresolved
      mockComputeHasUnresolved.mockReturnValue(true)

      const { rerender } = render(
        <ApproveAllTestHarness
          pendingReviews={entries}
          entityMappings={[]}
          onApproveAll={vi.fn()}
          approveAllLoading={false}
        />,
      )

      // No button when all unresolved
      expect(screen.queryByTestId('approve-all-button')).not.toBeInTheDocument()

      // Simulate resolving entities: entries 1 and 3 become resolved
      mockComputeHasUnresolved.mockImplementation((entry: EhrIntegrationLog) => {
        return entry.id === '2'
      })

      rerender(
        <ApproveAllTestHarness
          pendingReviews={entries}
          entityMappings={[]}
          onApproveAll={vi.fn()}
          approveAllLoading={false}
        />,
      )

      // Button now shows with count 2
      const button = screen.getByTestId('approve-all-button')
      expect(button.textContent).toBe('Approve All (2)')
    })

    it('button disappears when entries are removed after approval', () => {
      mockComputeHasUnresolved.mockReturnValue(false)

      const entries = [createEntry('1'), createEntry('2')]

      const { rerender } = render(
        <ApproveAllTestHarness
          pendingReviews={entries}
          entityMappings={[]}
          onApproveAll={vi.fn()}
          approveAllLoading={false}
        />,
      )

      expect(screen.getByTestId('approve-all-button').textContent).toBe('Approve All (2)')

      // After approval, entries are removed from the list
      rerender(
        <ApproveAllTestHarness
          pendingReviews={[]}
          entityMappings={[]}
          onApproveAll={vi.fn()}
          approveAllLoading={false}
        />,
      )

      expect(screen.queryByTestId('approve-all-button')).not.toBeInTheDocument()
    })
  })
})
