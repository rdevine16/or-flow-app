// hooks/useUrlFilters.ts
// Reusable hook for managing filters with URL sync
// Keeps filters in URL for sharing/bookmarking while avoiding navigation issues

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'

/**
 * Hook for managing filters with URL synchronization
 * 
 * Features:
 * - Filters sync to URL for sharing/bookmarking
 * - No server navigation (uses window.history API)
 * - Works offline
 * - Browser back/forward compatible
 * 
 * @example
 * const [filters, setFilters] = useUrlFilters({
 *   dateRange: 'week',
 *   status: [],
 *   surgeonIds: []
 * })
 * 
 * // Update a filter
 * setFilters({ ...filters, dateRange: 'month' })
 */

export interface FilterOptions<T = Record<string, unknown>> {
  /**
   * Called when filters change
   * Use this to trigger data fetching
   */
  onChange?: (filters: T) => void

  /**
   * Custom URL builder
   * Override to customize how filters map to URL params
   */
  toUrl?: (filters: T) => URLSearchParams

  /**
   * Custom URL parser
   * Override to customize how URL params map to filters
   */
  fromUrl?: (searchParams: URLSearchParams, defaults: T) => T
}

export function useUrlFilters<T extends Record<string, unknown>>(
  defaultFilters: T,
  options: FilterOptions<T> = {}
) {
  const searchParams = useSearchParams()
  
  // Parse filters from URL on mount
  const [filters, setFiltersState] = useState<T>(() => {
    if (options.fromUrl) {
      return options.fromUrl(searchParams, defaultFilters)
    }
    
    // Default URL parsing
    return parseFiltersFromUrl(searchParams, defaultFilters)
  })

  // Update URL when filters change (no navigation)
  useEffect(() => {
    const params = options.toUrl
      ? options.toUrl(filters)
      : buildUrlFromFilters(filters, defaultFilters)

    const queryString = params.toString()
    const newUrl = queryString ? `${window.location.pathname}?${queryString}` : window.location.pathname

    // Use History API instead of router to avoid server navigation
    window.history.replaceState(null, '', newUrl)

    // Notify parent if callback provided
    if (options.onChange) {
      options.onChange(filters)
    }
  }, [filters, options, defaultFilters])

  const setFilters = useCallback((newFilters: T | ((prev: T) => T)) => {
    setFiltersState(newFilters)
  }, [])

  return [filters, setFilters] as const
}

/**
 * Default parser: Converts URL search params to filter object
 */
function parseFiltersFromUrl<T>(
  searchParams: URLSearchParams,
  defaults: T
): T {
  const result = { ...defaults } as Record<string, unknown>
  
  for (const key in defaults) {
    const defaultValue = defaults[key]
    
    // Handle arrays (e.g., status=delayed&status=cancelled)
    if (Array.isArray(defaultValue)) {
      const values = searchParams.getAll(key)
      if (values.length > 0) {
        result[key] = values
      }
    }
    // Handle strings
    else {
      const value = searchParams.get(key)
      if (value !== null) {
        result[key] = value
      }
    }
  }

  return result as T
}

/**
 * Default builder: Converts filter object to URL search params
 */
function buildUrlFromFilters<T>(
  filters: T,
  defaults: T
): URLSearchParams {
  const params = new URLSearchParams()
  
  for (const key in filters) {
    const value = filters[key]
    const defaultValue = defaults[key]
    
    // Skip if value equals default (keeps URL clean)
    if (JSON.stringify(value) === JSON.stringify(defaultValue)) {
      continue
    }
    
    // Handle arrays
    if (Array.isArray(value)) {
      value.forEach(item => {
        if (item !== null && item !== undefined && item !== '') {
          params.append(key, String(item))
        }
      })
    }
    // Handle non-empty values
    else if (value !== null && value !== undefined && value !== '') {
      params.set(key, String(value))
    }
  }
  
  return params
}