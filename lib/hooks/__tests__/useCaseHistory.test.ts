/**
 * useCaseHistory.test.ts — Unit tests for the useCaseHistory hook
 *
 * Tests:
 * - Returns correct shape (entries, loading, error, totalCount, refetch, loadMore, hasMore)
 * - Hook structure and return type validation
 */

import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useCaseHistory } from '../useCaseHistory'
import type { CaseHistoryEntry } from '@/lib/integrations/shared/integration-types'

// Mock the DAL
vi.mock('@/lib/dal/case-history', () => ({
  caseHistoryDAL: {
    getCaseHistory: vi.fn(),
    getCaseHistoryCount: vi.fn(),
    resolveChangedFieldNames: vi.fn((_, entries) => Promise.resolve(entries)),
    getFieldLabel: vi.fn((field: string) => field.replace(/_/g, ' ')),
  },
}))

// Mock useSupabaseQuery with a simpler pattern
vi.mock('@/hooks/useSupabaseQuery', () => ({
  useSupabaseQuery: vi.fn(() => ({
    data: null,
    loading: false,
    error: null,
    refetch: vi.fn(),
    setData: vi.fn(),
  })),
}))

import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
const mockUseSupabaseQuery = vi.mocked(useSupabaseQuery)

describe('useCaseHistory', () => {
  it('returns correct shape with all required properties', () => {
    const { result } = renderHook(() =>
      useCaseHistory('case-123', { enabled: false })
    )

    expect(result.current).toMatchObject({
      entries: expect.any(Array),
      loading: expect.any(Boolean),
      error: null,
      totalCount: null,
      hasMore: expect.any(Boolean),
    })
    expect(result.current.refetch).toBeInstanceOf(Function)
    expect(result.current.loadMore).toBeInstanceOf(Function)
  })

  it('calculates hasMore=false when entries.length >= totalCount', () => {
    const mockData = {
      entries: [
        {
          facilityId: 'facility-1',
          id: 'hist-1',
          caseId: 'case-123',
          changeType: 'created' as const,
          changeSource: 'manual' as const,
          changedFields: {},
          changedBy: 'user-1',
          changedByName: 'Dr. Smith',
          ehrIntegrationLogId: null,
          createdAt: '2026-03-01T10:00:00Z',
        },
      ] as CaseHistoryEntry[],
      totalCount: 1,
    }

    mockUseSupabaseQuery.mockReturnValueOnce({
      data: mockData,
      loading: false,
      error: null,
      refetch: vi.fn(),
      setData: vi.fn(),
    })

    const { result } = renderHook(() =>
      useCaseHistory('case-123', { enabled: true })
    )

    expect(result.current.hasMore).toBe(false)
  })

  it('calculates hasMore=true when entries.length < totalCount', () => {
    const mockData = {
      entries: Array.from({ length: 50 }, (_, i) => ({
        id: `hist-${i}`,
        caseId: 'case-123',
        changeType: 'updated' as const,
        changeSource: 'manual' as const,
        changedFields: {},
        changedBy: 'user-1',
        changedByName: 'Dr. Smith',
        ehrIntegrationLogId: null,
        createdAt: `2026-03-01T${10 + i}:00:00Z`,
      })) as CaseHistoryEntry[],
      totalCount: 75,
    }

    mockUseSupabaseQuery.mockReturnValueOnce({
      data: mockData,
      loading: false,
      error: null,
      refetch: vi.fn(),
      setData: vi.fn(),
    })

    const { result } = renderHook(() =>
      useCaseHistory('case-123', { enabled: true, limit: 50 })
    )

    expect(result.current.hasMore).toBe(true)
    expect(result.current.totalCount).toBe(75)
  })

  it('returns empty arrays when data is null', () => {
    mockUseSupabaseQuery.mockReturnValueOnce({
      data: null,
      loading: false,
      error: null,
      refetch: vi.fn(),
      setData: vi.fn(),
    })

    const { result } = renderHook(() =>
      useCaseHistory('case-123', { enabled: true })
    )

    expect(result.current.entries).toEqual([])
    expect(result.current.totalCount).toBeNull()
    expect(result.current.hasMore).toBe(false)
  })
})
