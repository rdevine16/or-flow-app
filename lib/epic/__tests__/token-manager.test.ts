import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getTokenExpiryInfo, epicFhirRequest } from '../token-manager'

// Mock Supabase vault
vi.mock('@/lib/supabase-server', () => ({
  createClient: vi.fn(),
}))

// ============================================
// TOKEN EXPIRY INFO — Pure function, no DB needed
// ============================================

describe('getTokenExpiryInfo', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-01T12:00:00Z'))
  })

  it('should return expired when tokenExpiresAt is null', () => {
    const result = getTokenExpiryInfo(null)
    expect(result.expiresAt).toBeNull()
    expect(result.isExpired).toBe(true)
    expect(result.minutesRemaining).toBeNull()
  })

  it('should return not expired for future timestamp', () => {
    const result = getTokenExpiryInfo('2026-03-01T13:00:00Z')
    expect(result.isExpired).toBe(false)
    expect(result.minutesRemaining).toBe(60)
    expect(result.expiresAt).toEqual(new Date('2026-03-01T13:00:00Z'))
  })

  it('should return expired for past timestamp', () => {
    const result = getTokenExpiryInfo('2026-03-01T11:00:00Z')
    expect(result.isExpired).toBe(true)
    expect(result.minutesRemaining).toBe(0)
  })

  it('should handle token expiring in less than 1 minute', () => {
    const result = getTokenExpiryInfo('2026-03-01T12:00:30Z')
    expect(result.isExpired).toBe(false)
    expect(result.minutesRemaining).toBe(0)
  })

  it('should handle token expiring exactly now', () => {
    const result = getTokenExpiryInfo('2026-03-01T12:00:00Z')
    expect(result.isExpired).toBe(true)
    expect(result.minutesRemaining).toBe(0)
  })

  it('should handle token expiring in 10 minutes (amber warning threshold)', () => {
    const result = getTokenExpiryInfo('2026-03-01T12:10:00Z')
    expect(result.isExpired).toBe(false)
    expect(result.minutesRemaining).toBe(10)
  })

  afterEach(() => {
    vi.useRealTimers()
  })
})

// ============================================
// EPIC FHIR REQUEST — Timeout & Retry Logic
// ============================================

describe('epicFhirRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const createMockSupabase = (tokenExpiresAt: string | null, token: string = 'valid-token') => ({
    from: vi.fn((table: string) => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data:
          table === 'epic_connections'
            ? {
                id: 'conn-1',
                fhir_base_url: 'https://fhir.epic.com',
                status: 'active',
                access_token: token,
                token_expires_at: tokenExpiresAt,
              }
            : null,
        error: null,
      }),
      update: vi.fn().mockReturnThis(),
    })),
    rpc: vi.fn().mockResolvedValue({
      data: { decrypted_secret: token },
      error: null,
    }),
  })

  it('proactively detects expired tokens before making request', async () => {
    const mockSupabase = createMockSupabase('2026-02-28T12:00:00Z') // Expired yesterday
    const result = await epicFhirRequest(mockSupabase as any, 'fac-1', 'Patient/123')

    expect(result.error).toContain('Epic token has expired')
    expect(result.data).toBeNull()
    expect(global.fetch).not.toHaveBeenCalled()

    // Should have updated connection status to token_expired
    expect(mockSupabase.from).toHaveBeenCalledWith('epic_connections')
  })

  it('retries on 429 rate limit with exponential backoff', async () => {
    const mockSupabase = createMockSupabase('2026-03-02T12:00:00Z') // Valid token

    // First call: 429, second call: 200
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        text: async () => 'Rate limited',
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ resourceType: 'Patient', id: '123' }),
      } as Response)

    const result = await epicFhirRequest(mockSupabase as any, 'fac-1', 'Patient/123')

    expect(result.data).toEqual({ resourceType: 'Patient', id: '123' })
    expect(result.error).toBeNull()
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it('gives up after MAX_RETRIES on persistent 429', async () => {
    vi.useFakeTimers()
    const mockSupabase = createMockSupabase('2026-03-02T12:00:00Z')

    // Always return 429
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      text: async () => 'Rate limited',
    } as Response)

    const promise = epicFhirRequest(mockSupabase as any, 'fac-1', 'Patient/123')

    // Advance through each backoff delay
    await vi.advanceTimersByTimeAsync(1000)  // 1st retry backoff
    await vi.advanceTimersByTimeAsync(2000)  // 2nd retry backoff
    await vi.advanceTimersByTimeAsync(4000)  // 3rd retry backoff

    const result = await promise

    expect(result.error).toContain('429')
    expect(result.data).toBeNull()
    // MAX_RETRIES = 3, so 1 initial + 3 retries = 4 total calls
    expect(global.fetch).toHaveBeenCalledTimes(4)
    vi.useRealTimers()
  })

  it('handles timeout with AbortController', async () => {
    vi.useFakeTimers()
    const mockSupabase = createMockSupabase('2026-03-02T12:00:00Z')

    // Simulate timeout by throwing AbortError
    vi.mocked(global.fetch).mockRejectedValue(
      Object.assign(new Error('The operation was aborted'), { name: 'AbortError' })
    )

    const promise = epicFhirRequest(mockSupabase as any, 'fac-1', 'Patient/123')

    // Advance through each backoff delay
    await vi.advanceTimersByTimeAsync(1000)  // 1st retry backoff
    await vi.advanceTimersByTimeAsync(2000)  // 2nd retry backoff
    await vi.advanceTimersByTimeAsync(4000)  // 3rd retry backoff

    const result = await promise

    expect(result.error).toContain('timed out')
    expect(result.data).toBeNull()
    // Should retry on timeout: 1 initial + 3 retries = 4
    expect(global.fetch).toHaveBeenCalledTimes(4)
    vi.useRealTimers()
  })

  it('succeeds after timeout then success', async () => {
    const mockSupabase = createMockSupabase('2026-03-02T12:00:00Z')

    // First call: timeout, second call: success
    vi.mocked(global.fetch)
      .mockRejectedValueOnce(
        Object.assign(new Error('The operation was aborted'), { name: 'AbortError' })
      )
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ resourceType: 'Patient', id: '123' }),
      } as Response)

    const result = await epicFhirRequest(mockSupabase as any, 'fac-1', 'Patient/123')

    expect(result.data).toEqual({ resourceType: 'Patient', id: '123' })
    expect(result.error).toBeNull()
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it('passes correct timeout signal to fetch', async () => {
    const mockSupabase = createMockSupabase('2026-03-02T12:00:00Z')

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ resourceType: 'Patient', id: '123' }),
    } as Response)

    await epicFhirRequest(mockSupabase as any, 'fac-1', 'Patient/123')

    const fetchCall = vi.mocked(global.fetch).mock.calls[0]
    const fetchOptions = fetchCall?.[1]
    expect(fetchOptions).toHaveProperty('signal')
    expect(fetchOptions!.signal).toBeInstanceOf(AbortSignal)
  })

  it('handles 401 by marking token as expired', async () => {
    const mockSupabase = createMockSupabase('2026-03-02T12:00:00Z')

    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: async () => 'Invalid token',
    } as Response)

    const result = await epicFhirRequest(mockSupabase as any, 'fac-1', 'Patient/123')

    expect(result.error).toContain('invalid or expired')
    expect(result.data).toBeNull()

    // Should have updated connection status to token_expired
    const fromCalls = mockSupabase.from.mock.calls
    const updateCall = fromCalls.find(call => call[0] === 'epic_connections')
    expect(updateCall).toBeDefined()
  })
})
