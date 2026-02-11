/**
 * useSupabaseQuery — Unified data fetching hook
 *
 * Replaces the duplicated pattern found in 76+ files:
 *   const [data, setData] = useState(null)
 *   const [loading, setLoading] = useState(true)
 *   const [error, setError] = useState(null)
 *   useEffect(() => { ... fetch ... setData ... setLoading ... }, [])
 *
 * Usage:
 *   const { data: cases, loading, error, refetch } = useSupabaseQuery(
 *     (supabase) => casesDAL.listByDate(supabase, facilityId, date),
 *     [facilityId, date]  // dependency array
 *   )
 *
 * Features:
 *   - Automatic loading/error state management
 *   - Dependency-based refetching
 *   - Manual refetch capability
 *   - Abort on unmount (prevents state updates on unmounted components)
 *   - Type-safe return values from DAL functions
 */
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import type { SupabaseClient, PostgrestError } from '@supabase/supabase-js'

// ============================================
// TYPES
// ============================================

interface QueryResult<T> {
  /** The fetched data, null while loading or on error */
  data: T | null
  /** True during initial load and refetches */
  loading: boolean
  /** Supabase/Postgrest error if the query failed */
  error: PostgrestError | null
  /** Manually trigger a refetch */
  refetch: () => void
  /** True only during the initial load (not refetches) */
  initialLoading: boolean
}

interface ListQueryResult<T> {
  data: T[]
  loading: boolean
  error: PostgrestError | null
  refetch: () => void
  initialLoading: boolean
  count?: number
}

/** A function that takes a supabase client and returns a promise */
type QueryFn<T> = (supabase: SupabaseClient) => Promise<{
  data: T | null
  error: PostgrestError | null
  count?: number | null
}>

type ListQueryFn<T> = (supabase: SupabaseClient) => Promise<{
  data: T[]
  error: PostgrestError | null
  count?: number
}>

// ============================================
// HOOKS
// ============================================

/**
 * Fetch a single record from Supabase with automatic state management.
 *
 * @param queryFn  Function that receives supabase client and returns DALResult
 * @param deps     Dependency array — refetches when deps change
 * @param options  Optional configuration
 */
export function useSupabaseQuery<T>(
  queryFn: QueryFn<T>,
  deps: unknown[] = [],
  options?: { enabled?: boolean },
): QueryResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<PostgrestError | null>(null)
  const [initialLoading, setInitialLoading] = useState(true)
  const mountedRef = useRef(true)
  const fetchCountRef = useRef(0)

  const enabled = options?.enabled !== false

  const fetchData = useCallback(async () => {
    if (!enabled) {
      setLoading(false)
      setInitialLoading(false)
      return
    }

    const fetchId = ++fetchCountRef.current
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const result = await queryFn(supabase)

      // Only update state if this is still the latest fetch and component is mounted
      if (fetchId === fetchCountRef.current && mountedRef.current) {
        setData(result.data)
        setError(result.error)
      }
    } catch (err) {
      if (fetchId === fetchCountRef.current && mountedRef.current) {
        setError({
          message: err instanceof Error ? err.message : 'Unknown error',
          code: 'CLIENT_ERROR',
          details: '',
          hint: '',
        } as PostgrestError)
      }
    } finally {
      if (fetchId === fetchCountRef.current && mountedRef.current) {
        setLoading(false)
        setInitialLoading(false)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps])

  useEffect(() => {
    mountedRef.current = true
    fetchData()
    return () => {
      mountedRef.current = false
    }
  }, [fetchData])

  return { data, loading, error, refetch: fetchData, initialLoading }
}

/**
 * Fetch a list of records from Supabase with automatic state management.
 * Returns an empty array instead of null when loading/error.
 */
export function useSupabaseList<T>(
  queryFn: ListQueryFn<T>,
  deps: unknown[] = [],
  options?: { enabled?: boolean },
): ListQueryResult<T> {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<PostgrestError | null>(null)
  const [initialLoading, setInitialLoading] = useState(true)
  const [count, setCount] = useState<number | undefined>()
  const mountedRef = useRef(true)
  const fetchCountRef = useRef(0)

  const enabled = options?.enabled !== false

  const fetchData = useCallback(async () => {
    if (!enabled) {
      setLoading(false)
      setInitialLoading(false)
      return
    }

    const fetchId = ++fetchCountRef.current
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const result = await queryFn(supabase)

      if (fetchId === fetchCountRef.current && mountedRef.current) {
        setData(result.data || [])
        setError(result.error)
        setCount(result.count)
      }
    } catch (err) {
      if (fetchId === fetchCountRef.current && mountedRef.current) {
        setData([])
        setError({
          message: err instanceof Error ? err.message : 'Unknown error',
          code: 'CLIENT_ERROR',
          details: '',
          hint: '',
        } as PostgrestError)
      }
    } finally {
      if (fetchId === fetchCountRef.current && mountedRef.current) {
        setLoading(false)
        setInitialLoading(false)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps])

  useEffect(() => {
    mountedRef.current = true
    fetchData()
    return () => {
      mountedRef.current = false
    }
  }, [fetchData])

  return { data, loading, error, refetch: fetchData, initialLoading, count }
}

/**
 * Fetch multiple queries in parallel.
 * Returns when ALL queries complete.
 */
export function useSupabaseQueries<T extends Record<string, unknown>>(
  queries: { [K in keyof T]: QueryFn<T[K]> | ListQueryFn<T[K]> },
  deps: unknown[] = [],
): {
  data: { [K in keyof T]: T[K] | null }
  loading: boolean
  errors: { [K in keyof T]?: PostgrestError | null }
  refetch: () => void
} {
  const keys = Object.keys(queries) as (keyof T)[]
  const [data, setData] = useState<{ [K in keyof T]: T[K] | null }>(
    () => Object.fromEntries(keys.map(k => [k, null])) as { [K in keyof T]: T[K] | null }
  )
  const [loading, setLoading] = useState(true)
  const [errors, setErrors] = useState<{ [K in keyof T]?: PostgrestError | null }>({})
  const mountedRef = useRef(true)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    try {
      const results = await Promise.all(
        keys.map(async (key) => {
          try {
            const result = await (queries[key] as QueryFn<T[typeof key]>)(supabase)
            return { key, data: result.data, error: result.error }
          } catch (err) {
            return {
              key,
              data: null,
              error: {
                message: err instanceof Error ? err.message : 'Unknown error',
                code: 'CLIENT_ERROR',
                details: '',
                hint: '',
              } as PostgrestError,
            }
          }
        })
      )

      if (mountedRef.current) {
        const newData = {} as { [K in keyof T]: T[K] | null }
        const newErrors = {} as { [K in keyof T]?: PostgrestError | null }
        for (const result of results) {
          (newData as Record<string, unknown>)[result.key as string] = result.data
          ;(newErrors as Record<string, unknown>)[result.key as string] = result.error
        }
        setData(newData)
        setErrors(newErrors)
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    mountedRef.current = true
    fetchAll()
    return () => {
      mountedRef.current = false
    }
  }, [fetchAll])

  return { data, loading, errors, refetch: fetchAll }
}
