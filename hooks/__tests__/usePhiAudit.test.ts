import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { usePhiAudit } from '../usePhiAudit'
import { ehrDAL } from '@/lib/dal/ehr'
import { ehrAudit } from '@/lib/audit-logger'

// Mock dependencies
vi.mock('@/lib/supabase', () => ({
  createClient: vi.fn(() => ({})), // Mock Supabase client
}))

vi.mock('@/lib/dal/ehr', () => ({
  ehrDAL: {
    logPhiAccess: vi.fn(),
  },
}))

vi.mock('@/lib/audit-logger', () => ({
  ehrAudit: {
    phiAccessed: vi.fn(),
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: vi.fn(() => ({
    warn: vi.fn(),
    error: vi.fn(),
  })),
}))

describe('usePhiAudit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should log PHI access when logAccess is called', async () => {
    vi.mocked(ehrDAL.logPhiAccess).mockResolvedValue({ error: null })
    vi.mocked(ehrAudit.phiAccessed).mockResolvedValue(undefined)

    const { result } = renderHook(() =>
      usePhiAudit({
        userId: 'user-123',
        userEmail: 'admin@example.com',
        facilityId: 'fac-1',
      })
    )

    await result.current.logAccess('log-1', 'SIU_S12')

    await waitFor(() => {
      expect(ehrDAL.logPhiAccess).toHaveBeenCalledWith(expect.any(Object), {
        userId: 'user-123',
        userEmail: 'admin@example.com',
        facilityId: 'fac-1',
        logEntryId: 'log-1',
        accessType: 'view_raw_message',
      })
      expect(ehrAudit.phiAccessed).toHaveBeenCalledWith(
        expect.any(Object),
        'fac-1',
        'log-1',
        'SIU_S12'
      )
    })
  })

  it('should deduplicate rapid expansions of the same log entry', async () => {
    vi.mocked(ehrDAL.logPhiAccess).mockResolvedValue({ error: null })
    vi.mocked(ehrAudit.phiAccessed).mockResolvedValue(undefined)

    const { result } = renderHook(() =>
      usePhiAudit({
        userId: 'user-123',
        facilityId: 'fac-1',
      })
    )

    // Call logAccess three times for the same log entry
    await result.current.logAccess('log-1', 'SIU_S12')
    await result.current.logAccess('log-1', 'SIU_S12')
    await result.current.logAccess('log-1', 'SIU_S12')

    await waitFor(() => {
      // Should only be called once
      expect(ehrDAL.logPhiAccess).toHaveBeenCalledTimes(1)
      expect(ehrAudit.phiAccessed).toHaveBeenCalledTimes(1)
    })
  })

  it('should allow logging different log entries', async () => {
    vi.mocked(ehrDAL.logPhiAccess).mockResolvedValue({ error: null })
    vi.mocked(ehrAudit.phiAccessed).mockResolvedValue(undefined)

    const { result } = renderHook(() =>
      usePhiAudit({
        userId: 'user-123',
        facilityId: 'fac-1',
      })
    )

    await result.current.logAccess('log-1', 'SIU_S12')
    await result.current.logAccess('log-2', 'SIU_S13')
    await result.current.logAccess('log-3', 'SIU_S14')

    await waitFor(() => {
      expect(ehrDAL.logPhiAccess).toHaveBeenCalledTimes(3)
      expect(ehrAudit.phiAccessed).toHaveBeenCalledTimes(3)
    })
  })

  it('should not log when userId is missing', async () => {
    const { result } = renderHook(() =>
      usePhiAudit({
        userId: undefined,
        facilityId: 'fac-1',
      })
    )

    await result.current.logAccess('log-1', 'SIU_S12')

    expect(ehrDAL.logPhiAccess).not.toHaveBeenCalled()
    expect(ehrAudit.phiAccessed).not.toHaveBeenCalled()
  })

  it('should not log when facilityId is missing', async () => {
    const { result } = renderHook(() =>
      usePhiAudit({
        userId: 'user-123',
        facilityId: undefined,
      })
    )

    await result.current.logAccess('log-1', 'SIU_S12')

    expect(ehrDAL.logPhiAccess).not.toHaveBeenCalled()
    expect(ehrAudit.phiAccessed).not.toHaveBeenCalled()
  })

  it('should handle PHI access log error gracefully', async () => {
    const mockError = { message: 'RLS violation', code: '42501' }
    vi.mocked(ehrDAL.logPhiAccess).mockResolvedValue({ error: mockError })
    vi.mocked(ehrAudit.phiAccessed).mockResolvedValue(undefined)

    const { result } = renderHook(() =>
      usePhiAudit({
        userId: 'user-123',
        facilityId: 'fac-1',
      })
    )

    // Should not throw
    await expect(result.current.logAccess('log-1', 'SIU_S12')).resolves.not.toThrow()

    await waitFor(() => {
      expect(ehrDAL.logPhiAccess).toHaveBeenCalled()
      // Should still call ehrAudit even if PHI log fails
      expect(ehrAudit.phiAccessed).toHaveBeenCalled()
    })
  })

  it('should handle audit logger error gracefully', async () => {
    vi.mocked(ehrDAL.logPhiAccess).mockResolvedValue({ error: null })
    vi.mocked(ehrAudit.phiAccessed).mockRejectedValue(new Error('Audit error'))

    const { result } = renderHook(() =>
      usePhiAudit({
        userId: 'user-123',
        facilityId: 'fac-1',
      })
    )

    // Should not throw
    await expect(result.current.logAccess('log-1', 'SIU_S12')).resolves.not.toThrow()

    await waitFor(() => {
      expect(ehrDAL.logPhiAccess).toHaveBeenCalled()
    })
  })

  it('should handle missing userEmail gracefully', async () => {
    vi.mocked(ehrDAL.logPhiAccess).mockResolvedValue({ error: null })
    vi.mocked(ehrAudit.phiAccessed).mockResolvedValue(undefined)

    const { result } = renderHook(() =>
      usePhiAudit({
        userId: 'user-123',
        facilityId: 'fac-1',
        // userEmail omitted
      })
    )

    await result.current.logAccess('log-1', 'SIU_S12')

    await waitFor(() => {
      expect(ehrDAL.logPhiAccess).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          userId: 'user-123',
          userEmail: undefined,
        })
      )
    })
  })
})
