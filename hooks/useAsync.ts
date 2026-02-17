// hooks/useAsync.ts
// Generic hook for async operations with loading/error/success states
//
// Usage:
//   const { execute, loading, error, data } = useAsync(async () => {
//     return await fetchSomething()
//   })
//
//   <button onClick={execute} disabled={loading}>
//     {loading ? 'Loading...' : 'Fetch'}
//   </button>

import { useState, useCallback } from 'react'

interface UseAsyncState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

interface UseAsyncReturn<T, Args extends unknown[]> {
  data: T | null
  loading: boolean
  error: string | null
  execute: (...args: Args) => Promise<T | null>
  reset: () => void
  setData: (data: T | null) => void
}

export function useAsync<T, Args extends unknown[] = []>(
  asyncFunction: (...args: Args) => Promise<T>,
  options: {
    onSuccess?: (data: T) => void
    onError?: (error: Error) => void
    immediate?: boolean
  } = {}
): UseAsyncReturn<T, Args> {
  const { onSuccess, onError } = options

  const [state, setState] = useState<UseAsyncState<T>>({
    data: null,
    loading: false,
    error: null,
  })

  const execute = useCallback(
    async (...args: Args): Promise<T | null> => {
      setState(prev => ({ ...prev, loading: true, error: null }))

      try {
        const result = await asyncFunction(...args)
        setState({ data: result, loading: false, error: null })
        onSuccess?.(result)
        return result
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        setState(prev => ({ ...prev, loading: false, error: error.message }))
        onError?.(error)
        return null
      }
    },
    [asyncFunction, onSuccess, onError]
  )

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null })
  }, [])

  const setData = useCallback((data: T | null) => {
    setState(prev => ({ ...prev, data }))
  }, [])

  return {
    ...state,
    execute,
    reset,
    setData,
  }
}

// ============================================
// Mutation hook for create/update/delete ops
// ============================================

interface UseMutationOptions<T> {
  onSuccess?: (data: T) => void
  onError?: (error: Error) => void
  successMessage?: string
}

interface UseMutationReturn<T, Args extends unknown[]> {
  mutate: (...args: Args) => Promise<T | null>
  loading: boolean
  error: string | null
  reset: () => void
}

export function useMutation<T, Args extends unknown[] = []>(
  mutationFn: (...args: Args) => Promise<T>,
  options: UseMutationOptions<T> = {}
): UseMutationReturn<T, Args> {
  const { onSuccess, onError } = options

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mutate = useCallback(
    async (...args: Args): Promise<T | null> => {
      setLoading(true)
      setError(null)

      try {
        const result = await mutationFn(...args)
        onSuccess?.(result)
        return result
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err))
        setError(errorObj.message)
        onError?.(errorObj)
        return null
      } finally {
        setLoading(false)
      }
    },
    [mutationFn, onSuccess, onError]
  )

  const reset = useCallback(() => {
    setError(null)
  }, [])

  return { mutate, loading, error, reset }
}

// ============================================
// Toggle hook for boolean states
// ============================================

export function useToggle(initialValue = false): [boolean, () => void, (value: boolean) => void] {
  const [value, setValue] = useState(initialValue)
  const toggle = useCallback(() => setValue(v => !v), [])
  return [value, toggle, setValue]
}

// ============================================
// Debounced value hook
// ============================================

import { useEffect } from 'react'

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(timer)
    }
  }, [value, delay])

  return debouncedValue
}

// ============================================
// Previous value hook
// ============================================

export function usePrevious<T>(value: T): T | undefined {
  const [tuple, setTuple] = useState<[T, T | undefined]>([value, undefined])

  if (tuple[0] !== value) {
    setTuple([value, tuple[0]])
  }

  return tuple[1]
}
