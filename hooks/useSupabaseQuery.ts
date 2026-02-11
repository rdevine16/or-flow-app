// hooks/useSupabaseQuery.ts
// Generic hook for Supabase data fetching with automatic loading/error/refetch
//
// Replaces the pattern duplicated across 55+ pages:
//   const [data, setData] = useState(null)
//   const [loading, setLoading] = useState(true)
//   const [error, setError] = useState(null)
//   useEffect(() => { fetchData() }, [deps])
//
// Usage:
//   const { data, loading, error, refetch } = useSupabaseQuery(
//     async (supabase) => {
//       const { data, error } = await supabase.from('items').select('*')
//       if (error) throw error
//       return data
//     },
//     { deps: [facilityId], enabled: !!facilityId }
//   )

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase'

// ============================================
// Types
// ============================================

type SupabaseClient = ReturnType<typeof createClient>

interface UseSupabaseQueryOptions {
  /** Dependencies that trigger refetch when changed */
  deps?: unknown[]
  /** Whether the query should execute (default: true) */
  enabled?: boolean
  /** Initial data value before first fetch */
  initialData?: unknown
}

interface UseSupabaseQueryReturn<T> {
  data: T | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  setData: (dataOrUpdater: T | null | ((prev: T | null) => T | null)) => void
}

// ============================================
// Hook
// ============================================

export function useSupabaseQuery<T>(
  queryFn: (supabase: SupabaseClient) => Promise<T>,
  options: UseSupabaseQueryOptions = {}
): UseSupabaseQueryReturn<T> {
  const { deps = [], enabled = true, initialData } = options

  const [data, setData] = useState<T | null>((initialData as T) ?? null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)
  const supabaseRef = useRef(createClient())

  const fetchData = useCallback(async () => {
    if (!enabled) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const result = await queryFn(supabaseRef.current)
      if (mountedRef.current) {
        setData(result)
      }
    } catch (err) {
      if (mountedRef.current) {
        const message = err instanceof Error ? err.message : 'An error occurred'
        setError(message)
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false)
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

  return {
    data,
    loading,
    error,
    refetch: fetchData,
    setData,
  }
}

// ============================================
// Multi-query variant for pages that need
// several parallel fetches before rendering
// ============================================

interface UseSupabaseQueriesOptions {
  enabled?: boolean
  deps?: unknown[]
}

interface UseSupabaseQueriesReturn<T extends Record<string, unknown>> {
  data: T | null
  loading: boolean
  errors: Partial<Record<keyof T, string>>
  refetch: () => Promise<void>
}

export function useSupabaseQueries<T extends Record<string, unknown>>(
  queries: { [K in keyof T]: (supabase: SupabaseClient) => Promise<T[K]> },
  options: UseSupabaseQueriesOptions = {}
): UseSupabaseQueriesReturn<T> {
  const { enabled = true, deps = [] } = options

  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({})
  const mountedRef = useRef(true)
  const supabaseRef = useRef(createClient())

  const fetchAll = useCallback(async () => {
    if (!enabled) {
      setLoading(false)
      return
    }

    setLoading(true)
    setErrors({})

    const keys = Object.keys(queries) as (keyof T)[]
    const results: Partial<T> = {}
    const newErrors: Partial<Record<keyof T, string>> = {}

    await Promise.allSettled(
      keys.map(async (key) => {
        try {
          results[key] = await queries[key](supabaseRef.current)
        } catch (err) {
          newErrors[key] = err instanceof Error ? err.message : 'Failed'
        }
      })
    )

    if (mountedRef.current) {
      if (Object.keys(newErrors).length === 0) {
        setData(results as T)
      } else {
        setData(results as T) // partial data still available
        setErrors(newErrors)
      }
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps])

  useEffect(() => {
    mountedRef.current = true
    fetchAll()
    return () => {
      mountedRef.current = false
    }
  }, [fetchAll])

  return { data, loading, errors, refetch: fetchAll }
}

// ============================================
// Convenience: useCurrentUser + facilityId
// Used by nearly every page as the first fetch
// ============================================

interface CurrentUserData {
  userId: string
  facilityId: string
}

export function useCurrentUser() {
  return useSupabaseQuery<CurrentUserData>(
    async (supabase) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data: userData, error } = await supabase
        .from('users')
        .select('facility_id')
        .eq('id', user.id)
        .single()

      if (error) throw error
      if (!userData?.facility_id) throw new Error('No facility assigned')

      return { userId: user.id, facilityId: userData.facility_id }
    }
  )
}