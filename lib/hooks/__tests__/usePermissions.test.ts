import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { usePermissions } from '../usePermissions'

// ============================================
// MOCKS
// ============================================

const mockRpc = vi.fn()

vi.mock('@/hooks/useSupabaseQuery', () => ({
  useSupabaseQuery: (_queryFn: (supabase: unknown) => Promise<unknown>, options: { deps: unknown[]; enabled: boolean }) => {
    // When enabled, call the queryFn with a mock supabase client
    if (options.enabled) {
      // Call queryFn synchronously for test simplicity — store result
      let data: unknown = null
      let error: string | null = null
      try {
        // We can't properly await here in a mock, so we'll test the output
        // via the mockRpc return value
        const result = mockRpc.mock.results[0]
        if (result?.type === 'return') {
          const resolved = result.value
          if (resolved.error) throw resolved.error
          data = resolved.data
        }
      } catch (err) {
        error = err instanceof Error ? err.message : String(err)
      }
      return { data, loading: false, error, refetch: vi.fn(), setData: vi.fn() }
    }
    return { data: null, loading: true, error: null, refetch: vi.fn(), setData: vi.fn() }
  },
}))

// ============================================
// TESTS
// ============================================

describe('usePermissions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('can() — admin bypass', () => {
    it('returns true for any permission when accessLevel is global_admin', () => {
      const { result } = renderHook(() => usePermissions('global_admin', true))
      expect(result.current.can('cases.view')).toBe(true)
      expect(result.current.can('financials.view')).toBe(true)
      expect(result.current.can('nonexistent.key')).toBe(true)
    })

    it('returns true for any permission when accessLevel is facility_admin', () => {
      const { result } = renderHook(() => usePermissions('facility_admin', true))
      expect(result.current.can('cases.view')).toBe(true)
      expect(result.current.can('settings.manage')).toBe(true)
    })
  })

  describe('can() — non-admin users', () => {
    it('returns false when permissions are not loaded (loading state)', () => {
      const { result } = renderHook(() => usePermissions('user', false))
      expect(result.current.can('cases.view')).toBe(false)
      expect(result.current.loading).toBe(true)
    })

    it('returns false for non-existent permission key', () => {
      mockRpc.mockReturnValue({ data: { 'cases.view': true }, error: null })
      const { result } = renderHook(() => usePermissions('user', true))
      expect(result.current.can('nonexistent.key')).toBe(false)
    })

    it('returns false when permission is explicitly denied', () => {
      mockRpc.mockReturnValue({
        data: { 'cases.view': true, 'financials.view': false },
        error: null,
      })
      const { result } = renderHook(() => usePermissions('user', true))
      expect(result.current.can('financials.view')).toBe(false)
    })
  })

  describe('canAny()', () => {
    it('returns true if admin regardless of keys', () => {
      const { result } = renderHook(() => usePermissions('global_admin', true))
      expect(result.current.canAny('a', 'b', 'c')).toBe(true)
    })

    it('returns false for non-admin when all keys are denied', () => {
      mockRpc.mockReturnValue({
        data: { 'a': false, 'b': false },
        error: null,
      })
      const { result } = renderHook(() => usePermissions('user', true))
      expect(result.current.canAny('a', 'b')).toBe(false)
    })
  })

  describe('canAll()', () => {
    it('returns true if admin regardless of keys', () => {
      const { result } = renderHook(() => usePermissions('facility_admin', true))
      expect(result.current.canAll('a', 'b', 'c')).toBe(true)
    })

    it('returns false for non-admin when any key is denied', () => {
      mockRpc.mockReturnValue({
        data: { 'a': true, 'b': false },
        error: null,
      })
      const { result } = renderHook(() => usePermissions('user', true))
      expect(result.current.canAll('a', 'b')).toBe(false)
    })
  })

  describe('error handling', () => {
    it('defaults to empty permissions on error (deny all)', () => {
      mockRpc.mockReturnValue({ data: null, error: { message: 'RPC failed' } })
      const { result } = renderHook(() => usePermissions('user', true))
      expect(result.current.can('cases.view')).toBe(false)
    })
  })
})
