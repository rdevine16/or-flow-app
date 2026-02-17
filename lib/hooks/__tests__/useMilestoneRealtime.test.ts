import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  useMilestoneRealtime,
  mergeInsert,
  mergeUpdate,
  mergeDelete,
  type CaseMilestoneState,
  type RealtimeCaseMilestone,
} from '../useMilestoneRealtime'

// ============================================================================
// TEST HELPERS
// ============================================================================

function createMockChannel() {
  let changeCallback: ((payload: unknown) => void) | null = null

  const channel = {
    on: vi.fn((_type: string, _config: unknown, cb: (payload: unknown) => void) => {
      changeCallback = cb
      return channel
    }),
    subscribe: vi.fn((cb?: (status: string) => void) => {
      if (cb) cb('SUBSCRIBED')
      return channel
    }),
  }

  return {
    channel,
    simulateEvent: (payload: unknown) => {
      if (changeCallback) changeCallback(payload)
    },
  }
}

function createMockSupabase(mockChannel: { on: unknown; subscribe: unknown }) {
  return {
    channel: vi.fn(() => mockChannel),
    removeChannel: vi.fn(),
  }
}

function makeRow(
  id: string,
  facilityMilestoneId: string,
  recordedAt: string | null = '2026-02-11T10:00:00Z'
): RealtimeCaseMilestone {
  return { id, case_id: 'case-1', facility_milestone_id: facilityMilestoneId, recorded_at: recordedAt }
}

function makeState(
  id: string,
  facilityMilestoneId: string,
  recordedAt: string | null = '2026-02-11T10:00:00Z'
): CaseMilestoneState {
  return { id, facility_milestone_id: facilityMilestoneId, recorded_at: recordedAt }
}

// ============================================================================
// UNIT TESTS — Pure merge functions
// ============================================================================

describe('mergeInsert', () => {
  it('adds a new milestone to empty state', () => {
    const row = makeRow('m1', 'fm-1')
    const result = mergeInsert([], row)
    expect(result).toEqual([makeState('m1', 'fm-1')])
  })

  it('adds a new milestone alongside existing ones', () => {
    const existing = [makeState('m1', 'fm-1')]
    const row = makeRow('m2', 'fm-2', '2026-02-11T10:05:00Z')
    const result = mergeInsert(existing, row)
    expect(result).toHaveLength(2)
    expect(result[1]).toEqual(makeState('m2', 'fm-2', '2026-02-11T10:05:00Z'))
  })

  it('skips if row ID already exists with same data', () => {
    const existing = [makeState('m1', 'fm-1', '2026-02-11T10:00:00Z')]
    const row = makeRow('m1', 'fm-1', '2026-02-11T10:00:00Z')
    const result = mergeInsert(existing, row)
    expect(result).toBe(existing) // referential equality — no change
  })

  it('updates if row ID exists but recorded_at changed', () => {
    const existing = [makeState('m1', 'fm-1', '2026-02-11T10:00:00Z')]
    const row = makeRow('m1', 'fm-1', '2026-02-11T10:05:00Z')
    const result = mergeInsert(existing, row)
    expect(result).not.toBe(existing)
    expect(result[0].recorded_at).toBe('2026-02-11T10:05:00Z')
  })

  it('replaces optimistic entry with real DB row', () => {
    const existing = [makeState('optimistic-fm-1', 'fm-1', '2026-02-11T10:00:00Z')]
    const row = makeRow('real-uuid-1', 'fm-1', '2026-02-11T10:00:00Z')
    const result = mergeInsert(existing, row)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('real-uuid-1')
    expect(result[0].recorded_at).toBe('2026-02-11T10:00:00Z')
  })

  it('replaces optimistic entry even when recorded_at differs slightly', () => {
    const existing = [makeState('optimistic-fm-1', 'fm-1', '2026-02-11T10:00:00.000Z')]
    const row = makeRow('real-uuid-1', 'fm-1', '2026-02-11T10:00:00.123Z')
    const result = mergeInsert(existing, row)
    expect(result[0].id).toBe('real-uuid-1')
    expect(result[0].recorded_at).toBe('2026-02-11T10:00:00.123Z')
  })

  it('keeps earlier row on simultaneous recording (existing is earlier)', () => {
    const existing = [makeState('m-A', 'fm-1', '2026-02-11T10:00:00Z')]
    const row = makeRow('m-B', 'fm-1', '2026-02-11T10:00:01Z')
    const result = mergeInsert(existing, row)
    expect(result).toBe(existing) // keeps A (earlier)
  })

  it('replaces with earlier row on simultaneous recording (incoming is earlier)', () => {
    const existing = [makeState('m-A', 'fm-1', '2026-02-11T10:00:01Z')]
    const row = makeRow('m-B', 'fm-1', '2026-02-11T10:00:00Z')
    const result = mergeInsert(existing, row)
    expect(result[0].id).toBe('m-B')
    expect(result[0].recorded_at).toBe('2026-02-11T10:00:00Z')
  })

  it('keeps existing when incoming has null recorded_at (simultaneous edge case)', () => {
    const existing = [makeState('m-A', 'fm-1', '2026-02-11T10:00:00Z')]
    const row = makeRow('m-B', 'fm-1', null)
    const result = mergeInsert(existing, row)
    expect(result).toBe(existing)
  })
})

describe('mergeUpdate', () => {
  it('updates existing row recorded_at', () => {
    const existing = [makeState('m1', 'fm-1', '2026-02-11T10:00:00Z')]
    const row = makeRow('m1', 'fm-1', '2026-02-11T10:05:00Z')
    const result = mergeUpdate(existing, row)
    expect(result[0].recorded_at).toBe('2026-02-11T10:05:00Z')
  })

  it('handles undo — sets recorded_at to null', () => {
    const existing = [makeState('m1', 'fm-1', '2026-02-11T10:00:00Z')]
    const row = makeRow('m1', 'fm-1', null)
    const result = mergeUpdate(existing, row)
    expect(result[0].recorded_at).toBeNull()
  })

  it('skips update for unknown row ID', () => {
    const existing = [makeState('m1', 'fm-1')]
    const row = makeRow('m-unknown', 'fm-2', '2026-02-11T10:05:00Z')
    const result = mergeUpdate(existing, row)
    expect(result).toBe(existing)
  })

  it('skips update when data is identical', () => {
    const existing = [makeState('m1', 'fm-1', '2026-02-11T10:00:00Z')]
    const row = makeRow('m1', 'fm-1', '2026-02-11T10:00:00Z')
    const result = mergeUpdate(existing, row)
    expect(result).toBe(existing)
  })

  it('does not affect other rows', () => {
    const existing = [
      makeState('m1', 'fm-1', '2026-02-11T10:00:00Z'),
      makeState('m2', 'fm-2', '2026-02-11T10:01:00Z'),
    ]
    const row = makeRow('m1', 'fm-1', null)
    const result = mergeUpdate(existing, row)
    expect(result[0].recorded_at).toBeNull()
    expect(result[1].recorded_at).toBe('2026-02-11T10:01:00Z')
  })
})

describe('mergeDelete', () => {
  it('removes row by ID', () => {
    const existing = [makeState('m1', 'fm-1'), makeState('m2', 'fm-2')]
    const result = mergeDelete(existing, 'm1')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('m2')
  })

  it('returns same array if ID not found', () => {
    const existing = [makeState('m1', 'fm-1')]
    const result = mergeDelete(existing, 'm-unknown')
    expect(result).toBe(existing)
  })

  it('handles empty state', () => {
    const result = mergeDelete([], 'm1')
    expect(result).toEqual([])
  })
})

// ============================================================================
// UNIT TESTS — Hook subscription setup & cleanup
// ============================================================================

describe('useMilestoneRealtime — subscription', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates channel with correct name and filter', () => {
    const { channel } = createMockChannel()
    const supabase = createMockSupabase(channel)

    renderHook(() =>
      useMilestoneRealtime({
        supabase,
        caseId: 'case-abc',
        enabled: true,
        setCaseMilestones: vi.fn(),
      })
    )

    expect(supabase.channel).toHaveBeenCalledWith('case-milestones:case-abc')
    expect(channel.on).toHaveBeenCalledWith(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'case_milestones',
        filter: 'case_id=eq.case-abc',
      },
      expect.any(Function)
    )
    expect(channel.subscribe).toHaveBeenCalled()
  })

  it('removes channel on unmount', () => {
    const { channel } = createMockChannel()
    const supabase = createMockSupabase(channel)

    const { unmount } = renderHook(() =>
      useMilestoneRealtime({
        supabase,
        caseId: 'case-abc',
        enabled: true,
        setCaseMilestones: vi.fn(),
      })
    )

    unmount()
    expect(supabase.removeChannel).toHaveBeenCalledWith(channel)
  })

  it('does not subscribe when disabled', () => {
    const { channel } = createMockChannel()
    const supabase = createMockSupabase(channel)

    renderHook(() =>
      useMilestoneRealtime({
        supabase,
        caseId: 'case-abc',
        enabled: false,
        setCaseMilestones: vi.fn(),
      })
    )

    expect(supabase.channel).not.toHaveBeenCalled()
  })

  it('does not subscribe when caseId is empty', () => {
    const { channel } = createMockChannel()
    const supabase = createMockSupabase(channel)

    renderHook(() =>
      useMilestoneRealtime({
        supabase,
        caseId: '',
        enabled: true,
        setCaseMilestones: vi.fn(),
      })
    )

    expect(supabase.channel).not.toHaveBeenCalled()
  })

  it('re-subscribes when caseId changes', () => {
    const { channel } = createMockChannel()
    const supabase = createMockSupabase(channel)

    const { rerender } = renderHook(
      ({ caseId }: { caseId: string }) =>
        useMilestoneRealtime({
          supabase,
          caseId,
          enabled: true,
          setCaseMilestones: vi.fn(),
        }),
      { initialProps: { caseId: 'case-1' } }
    )

    expect(supabase.channel).toHaveBeenCalledTimes(1)

    rerender({ caseId: 'case-2' })

    // Old channel removed, new channel created
    expect(supabase.removeChannel).toHaveBeenCalledWith(channel)
    expect(supabase.channel).toHaveBeenCalledTimes(2)
    expect(supabase.channel).toHaveBeenLastCalledWith('case-milestones:case-2')
  })
})

// ============================================================================
// INTEGRATION TESTS — Simulated Realtime events update state
// ============================================================================

describe('useMilestoneRealtime — event handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('INSERT event calls setCaseMilestones with correct updater', () => {
    const { channel, simulateEvent } = createMockChannel()
    const supabase = createMockSupabase(channel)
    const setCaseMilestones = vi.fn()

    renderHook(() =>
      useMilestoneRealtime({
        supabase,
        caseId: 'case-1',
        enabled: true,
        setCaseMilestones,
      })
    )

    act(() => {
      simulateEvent({
        eventType: 'INSERT',
        new: makeRow('m1', 'fm-1', '2026-02-11T10:00:00Z'),
      })
    })

    expect(setCaseMilestones).toHaveBeenCalledTimes(1)
    // Verify the functional updater produces correct result
    const updater = setCaseMilestones.mock.calls[0][0]
    const result = updater([])
    expect(result).toEqual([makeState('m1', 'fm-1', '2026-02-11T10:00:00Z')])
  })

  it('UPDATE event updates existing milestone', () => {
    const { channel, simulateEvent } = createMockChannel()
    const supabase = createMockSupabase(channel)
    const setCaseMilestones = vi.fn()

    renderHook(() =>
      useMilestoneRealtime({
        supabase,
        caseId: 'case-1',
        enabled: true,
        setCaseMilestones,
      })
    )

    act(() => {
      simulateEvent({
        eventType: 'UPDATE',
        new: makeRow('m1', 'fm-1', null), // undo
      })
    })

    const updater = setCaseMilestones.mock.calls[0][0]
    const result = updater([makeState('m1', 'fm-1', '2026-02-11T10:00:00Z')])
    expect(result[0].recorded_at).toBeNull()
  })

  it('DELETE event removes milestone', () => {
    const { channel, simulateEvent } = createMockChannel()
    const supabase = createMockSupabase(channel)
    const setCaseMilestones = vi.fn()

    renderHook(() =>
      useMilestoneRealtime({
        supabase,
        caseId: 'case-1',
        enabled: true,
        setCaseMilestones,
      })
    )

    act(() => {
      simulateEvent({
        eventType: 'DELETE',
        old: { id: 'm1' },
      })
    })

    const updater = setCaseMilestones.mock.calls[0][0]
    const result = updater([makeState('m1', 'fm-1'), makeState('m2', 'fm-2')])
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('m2')
  })

  it('INSERT replaces optimistic entry from local recording', () => {
    const { channel, simulateEvent } = createMockChannel()
    const supabase = createMockSupabase(channel)
    const setCaseMilestones = vi.fn()

    renderHook(() =>
      useMilestoneRealtime({
        supabase,
        caseId: 'case-1',
        enabled: true,
        setCaseMilestones,
      })
    )

    act(() => {
      simulateEvent({
        eventType: 'INSERT',
        new: makeRow('real-uuid', 'fm-1', '2026-02-11T10:00:00Z'),
      })
    })

    const updater = setCaseMilestones.mock.calls[0][0]
    // State has an optimistic entry
    const currentState = [makeState('optimistic-fm-1', 'fm-1', '2026-02-11T10:00:00Z')]
    const result = updater(currentState)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('real-uuid') // replaced optimistic
  })

  it('optimistic update + remote confirmation does not duplicate', () => {
    const { channel, simulateEvent } = createMockChannel()
    const supabase = createMockSupabase(channel)
    const setCaseMilestones = vi.fn()

    renderHook(() =>
      useMilestoneRealtime({
        supabase,
        caseId: 'case-1',
        enabled: true,
        setCaseMilestones,
      })
    )

    // Scenario: local code already replaced optimistic with real row.
    // Then Realtime fires INSERT for the same real row. Should be a no-op.
    act(() => {
      simulateEvent({
        eventType: 'INSERT',
        new: makeRow('real-uuid', 'fm-1', '2026-02-11T10:00:00Z'),
      })
    })

    const updater = setCaseMilestones.mock.calls[0][0]
    // State already has the real row (from local DB callback)
    const currentState = [makeState('real-uuid', 'fm-1', '2026-02-11T10:00:00Z')]
    const result = updater(currentState)
    expect(result).toBe(currentState) // referential equality — no change
  })

  it('DELETE event with missing old.id does nothing', () => {
    const { channel, simulateEvent } = createMockChannel()
    const supabase = createMockSupabase(channel)
    const setCaseMilestones = vi.fn()

    renderHook(() =>
      useMilestoneRealtime({
        supabase,
        caseId: 'case-1',
        enabled: true,
        setCaseMilestones,
      })
    )

    act(() => {
      simulateEvent({
        eventType: 'DELETE',
        old: {}, // no id
      })
    })

    expect(setCaseMilestones).not.toHaveBeenCalled()
  })
})

// ============================================================================
// WORKFLOW TESTS — Multi-event sequences
// ============================================================================

describe('useMilestoneRealtime — workflow', () => {
  it('Device A records → Device B sees update (full INSERT flow)', () => {
    // Simulates Device B's perspective:
    // - Starts with no milestones
    // - Receives INSERT from Device A via Realtime
    // - State updates to show the recorded milestone
    const { channel, simulateEvent } = createMockChannel()
    const supabase = createMockSupabase(channel)
    const setCaseMilestones = vi.fn()

    renderHook(() =>
      useMilestoneRealtime({
        supabase,
        caseId: 'case-1',
        enabled: true,
        setCaseMilestones,
      })
    )

    // Device A records Patient In
    act(() => {
      simulateEvent({
        eventType: 'INSERT',
        new: makeRow('m-patient-in', 'fm-patient-in', '2026-02-11T07:30:00Z'),
      })
    })

    const insertUpdater = setCaseMilestones.mock.calls[0][0]
    let state: CaseMilestoneState[] = insertUpdater([])
    expect(state).toHaveLength(1)
    expect(state[0].id).toBe('m-patient-in')
    expect(state[0].recorded_at).toBe('2026-02-11T07:30:00Z')

    // Device A records Timeout
    act(() => {
      simulateEvent({
        eventType: 'INSERT',
        new: makeRow('m-timeout', 'fm-timeout', '2026-02-11T07:35:00Z'),
      })
    })

    const insertUpdater2 = setCaseMilestones.mock.calls[1][0]
    state = insertUpdater2(state)
    expect(state).toHaveLength(2)

    // Device A undoes Timeout
    act(() => {
      simulateEvent({
        eventType: 'UPDATE',
        new: makeRow('m-timeout', 'fm-timeout', null),
      })
    })

    const undoUpdater = setCaseMilestones.mock.calls[2][0]
    state = undoUpdater(state)
    expect(state).toHaveLength(2)
    expect(state[1].recorded_at).toBeNull()

    // Device A re-records Timeout
    act(() => {
      simulateEvent({
        eventType: 'UPDATE',
        new: makeRow('m-timeout', 'fm-timeout', '2026-02-11T07:36:00Z'),
      })
    })

    const reRecordUpdater = setCaseMilestones.mock.calls[3][0]
    state = reRecordUpdater(state)
    expect(state[1].recorded_at).toBe('2026-02-11T07:36:00Z')
  })

  it('simultaneous recording from two devices resolves to earlier timestamp', () => {
    const { channel, simulateEvent } = createMockChannel()
    const supabase = createMockSupabase(channel)
    const setCaseMilestones = vi.fn()

    renderHook(() =>
      useMilestoneRealtime({
        supabase,
        caseId: 'case-1',
        enabled: true,
        setCaseMilestones,
      })
    )

    // Device A's INSERT arrives first
    act(() => {
      simulateEvent({
        eventType: 'INSERT',
        new: makeRow('m-A', 'fm-timeout', '2026-02-11T07:35:01Z'),
      })
    })

    const updater1 = setCaseMilestones.mock.calls[0][0]
    let state = updater1([])
    expect(state[0].id).toBe('m-A')

    // Device B's INSERT arrives second (but was actually recorded earlier)
    act(() => {
      simulateEvent({
        eventType: 'INSERT',
        new: makeRow('m-B', 'fm-timeout', '2026-02-11T07:35:00Z'),
      })
    })

    const updater2 = setCaseMilestones.mock.calls[1][0]
    state = updater2(state)
    // Should keep B (earlier timestamp)
    expect(state).toHaveLength(1)
    expect(state[0].id).toBe('m-B')
    expect(state[0].recorded_at).toBe('2026-02-11T07:35:00Z')
  })

  it('local optimistic record → remote confirmation → no duplicate', () => {
    // Full flow from local device perspective:
    // 1. User taps → optimistic entry in state
    // 2. DB write succeeds → optimistic replaced with real row
    // 3. Realtime INSERT arrives → should be a no-op (already have the row)
    const { channel, simulateEvent } = createMockChannel()
    const supabase = createMockSupabase(channel)
    const setCaseMilestones = vi.fn()

    renderHook(() =>
      useMilestoneRealtime({
        supabase,
        caseId: 'case-1',
        enabled: true,
        setCaseMilestones,
      })
    )

    // Step 1-2 happen in the page component (not in this hook).
    // After step 2, state has the real row:
    const stateAfterLocalWrite = [makeState('real-uuid', 'fm-1', '2026-02-11T10:00:00Z')]

    // Step 3: Realtime INSERT
    act(() => {
      simulateEvent({
        eventType: 'INSERT',
        new: makeRow('real-uuid', 'fm-1', '2026-02-11T10:00:00Z'),
      })
    })

    const updater = setCaseMilestones.mock.calls[0][0]
    const result = updater(stateAfterLocalWrite)
    expect(result).toBe(stateAfterLocalWrite) // no-op, no duplicate
    expect(result).toHaveLength(1)
  })
})
