import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAutoPush } from '../useAutoPush'

// ============================================
// MOCKS
// ============================================

const mockShowToast = vi.fn()

vi.mock('@/components/ui/Toast/ToastProvider', () => ({
  useToast: () => ({
    showToast: mockShowToast,
  }),
}))

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}))

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
    get _store() { return store },
  }
})()

Object.defineProperty(window, 'localStorage', { value: localStorageMock })

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

// ============================================
// TESTS
// ============================================

describe('useAutoPush - Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('reads initial enabled state from localStorage', () => {
    localStorageMock.setItem('hl7v2-auto-push-fac-1', 'true')

    const { result } = renderHook(() => useAutoPush('fac-1'))

    expect(result.current.enabled).toBe(true)
  })

  it('defaults to disabled when no localStorage value', () => {
    const { result } = renderHook(() => useAutoPush('fac-1'))

    expect(result.current.enabled).toBe(false)
  })

  it('defaults to disabled when facilityId is empty', () => {
    const { result } = renderHook(() => useAutoPush(''))

    expect(result.current.enabled).toBe(false)
  })

  it('persists enabled state to localStorage on toggle', () => {
    const { result } = renderHook(() => useAutoPush('fac-1'))

    act(() => {
      result.current.setEnabled(true)
    })

    expect(localStorageMock.setItem).toHaveBeenCalledWith('hl7v2-auto-push-fac-1', 'true')
    expect(result.current.enabled).toBe(true)

    act(() => {
      result.current.setEnabled(false)
    })

    expect(localStorageMock.setItem).toHaveBeenCalledWith('hl7v2-auto-push-fac-1', 'false')
    expect(result.current.enabled).toBe(false)
  })

  it('uses different localStorage keys per facility', () => {
    localStorageMock.setItem('hl7v2-auto-push-fac-1', 'true')
    localStorageMock.setItem('hl7v2-auto-push-fac-2', 'false')

    const { result: result1 } = renderHook(() => useAutoPush('fac-1'))
    const { result: result2 } = renderHook(() => useAutoPush('fac-2'))

    expect(result1.current.enabled).toBe(true)
    expect(result2.current.enabled).toBe(false)
  })

  it('re-reads localStorage when facilityId changes', () => {
    localStorageMock.setItem('hl7v2-auto-push-fac-1', 'true')
    localStorageMock.setItem('hl7v2-auto-push-fac-2', 'false')

    const { result, rerender } = renderHook(
      ({ facilityId }: { facilityId: string }) => useAutoPush(facilityId),
      { initialProps: { facilityId: 'fac-1' } }
    )

    expect(result.current.enabled).toBe(true)

    rerender({ facilityId: 'fac-2' })
    expect(result.current.enabled).toBe(false)
  })
})

describe('useAutoPush - Push API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('calls auto-push API with correct params for create', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, skipped: false, triggerEvent: 'S12' }),
    })

    const { result } = renderHook(() => useAutoPush('fac-1'))

    let success: boolean = false
    await act(async () => {
      success = await result.current.push('sched-1', 'create')
    })

    expect(success).toBe(true)
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/integrations/test-harness/auto-push',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduleId: 'sched-1',
          facilityId: 'fac-1',
          action: 'create',
        }),
      })
    )
  })

  it('calls auto-push API with scheduleData for delete', async () => {
    const scheduleData = {
      id: 'sched-1',
      facility_id: 'fac-1',
      patient_id: 'pat-1',
      surgeon_id: 'surg-1',
      procedure_id: 'proc-1',
      room_id: 'room-1',
      trigger_event: 'S12' as const,
      scheduled_date: '2026-03-15',
      start_time: '07:30',
      duration_min: 60,
      external_case_id: 'TEST-ABC',
      diagnosis_id: null,
      references_schedule_id: null,
      notes: null,
      sequence_order: 1,
      created_at: '',
      updated_at: '',
      patient: null,
      surgeon: null,
      procedure: null,
      room: null,
      diagnosis: null,
      referenced_schedule: null,
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, skipped: false, triggerEvent: 'S15' }),
    })

    const { result } = renderHook(() => useAutoPush('fac-1'))

    await act(async () => {
      await result.current.push('sched-1', 'delete', scheduleData)
    })

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(callBody.action).toBe('delete')
    expect(callBody.scheduleData).toBeDefined()
    expect(callBody.scheduleData.id).toBe('sched-1')
  })

  it('sets success status after successful push', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, skipped: false, triggerEvent: 'S12' }),
    })

    const { result } = renderHook(() => useAutoPush('fac-1'))

    await act(async () => {
      await result.current.push('sched-1', 'create')
    })

    const status = result.current.getStatus('sched-1')
    expect(status).toBeDefined()
    expect(status?.state).toBe('success')
    expect(status?.message).toBe('S12 sent')
  })

  it('sets error status after failed push', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: false, skipped: false, errorMessage: 'Connection refused' }),
    })

    const { result } = renderHook(() => useAutoPush('fac-1'))

    let success: boolean = true
    await act(async () => {
      success = await result.current.push('sched-1', 'create')
    })

    expect(success).toBe(false)
    const status = result.current.getStatus('sched-1')
    expect(status?.state).toBe('error')
    expect(status?.message).toBe('Connection refused')
  })

  it('handles skipped push (no integration)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: false, skipped: true, reason: 'no_integration' }),
    })

    const { result } = renderHook(() => useAutoPush('fac-1'))

    await act(async () => {
      await result.current.push('sched-1', 'create')
    })

    expect(mockShowToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'warning', title: 'Auto-push skipped' })
    )
  })

  it('handles network error gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    const { result } = renderHook(() => useAutoPush('fac-1'))

    let success: boolean = true
    await act(async () => {
      success = await result.current.push('sched-1', 'create')
    })

    expect(success).toBe(false)
    const status = result.current.getStatus('sched-1')
    expect(status?.state).toBe('error')
    expect(status?.message).toBe('Network error')
  })

  it('handles HTTP error response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Internal server error' }),
    })

    const { result } = renderHook(() => useAutoPush('fac-1'))

    let success: boolean = true
    await act(async () => {
      success = await result.current.push('sched-1', 'create')
    })

    expect(success).toBe(false)
    const status = result.current.getStatus('sched-1')
    expect(status?.state).toBe('error')
  })

  it('auto-clears status after 5 seconds', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, skipped: false, triggerEvent: 'S12' }),
    })

    const { result } = renderHook(() => useAutoPush('fac-1'))

    await act(async () => {
      await result.current.push('sched-1', 'create')
    })

    // Status should exist
    expect(result.current.getStatus('sched-1')).toBeDefined()

    // Advance timers by 5 seconds
    act(() => {
      vi.advanceTimersByTime(5000)
    })

    // Status should be cleared
    expect(result.current.getStatus('sched-1')).toBeUndefined()
  })

  it('returns false when facilityId is empty', async () => {
    const { result } = renderHook(() => useAutoPush(''))

    let success: boolean = true
    await act(async () => {
      success = await result.current.push('sched-1', 'create')
    })

    expect(success).toBe(false)
    expect(mockFetch).not.toHaveBeenCalled()
  })
})

describe('useAutoPush - Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('toggle persists across remounts for same facility', () => {
    const { result, unmount } = renderHook(() => useAutoPush('fac-1'))

    act(() => {
      result.current.setEnabled(true)
    })
    expect(result.current.enabled).toBe(true)

    unmount()

    // Remount with same facility
    const { result: result2 } = renderHook(() => useAutoPush('fac-1'))
    expect(result2.current.enabled).toBe(true)
  })

  it('multiple pushes track separate statuses', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, skipped: false, triggerEvent: 'S12' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: false, skipped: false, errorMessage: 'Failed' }),
      })

    const { result } = renderHook(() => useAutoPush('fac-1'))

    await act(async () => {
      await result.current.push('sched-1', 'create')
    })
    await act(async () => {
      await result.current.push('sched-2', 'update')
    })

    expect(result.current.getStatus('sched-1')?.state).toBe('success')
    expect(result.current.getStatus('sched-2')?.state).toBe('error')
  })

  it('clearStatus removes a specific entry', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, skipped: false, triggerEvent: 'S12' }),
    })

    const { result } = renderHook(() => useAutoPush('fac-1'))

    await act(async () => {
      await result.current.push('sched-1', 'create')
    })

    expect(result.current.getStatus('sched-1')).toBeDefined()

    act(() => {
      result.current.clearStatus('sched-1')
    })

    expect(result.current.getStatus('sched-1')).toBeUndefined()
  })
})
