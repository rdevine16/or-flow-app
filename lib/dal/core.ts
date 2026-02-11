/**
 * Data Access Layer — Core
 *
 * Provides typed result wrappers and shared utilities for all DAL modules.
 * Every database query in the application should flow through the DAL.
 *
 * Benefits:
 * - Single place for error handling and logging
 * - Typed results eliminate scattered `any` and null checks
 * - Easy to add caching, retries, or metrics later
 * - Testable: mock the DAL, not Supabase internals
 *
 * Usage:
 *   import { cases } from '@/lib/dal'
 *   const { data, error } = await cases.listByFacility(supabase, facilityId)
 */

import type { SupabaseClient, PostgrestError } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'

const log = logger('dal')

// ============================================
// Result Types
// ============================================

/** Successful query result */
export interface DalSuccess<T> {
  data: T
  error: null
  count?: number
}

/** Failed query result */
export interface DalError {
  data: null
  error: {
    message: string
    code?: string
    details?: string
  }
  count?: undefined
}

/** Union result type for all DAL operations */
export type DalResult<T> = DalSuccess<T> | DalError

// ============================================
// Error Handling
// ============================================

/**
 * Wrap a Supabase query with consistent error handling and logging.
 * Use this for all DAL operations to ensure uniform error shape.
 */
export async function query<T>(
  operation: string,
  fn: () => Promise<{ data: T | null; error: PostgrestError | null; count?: number | null }>
): Promise<DalResult<T>> {
  try {
    const result = await fn()

    if (result.error) {
      log.error(`${operation} failed`, result.error)
      return {
        data: null,
        error: {
          message: result.error.message,
          code: result.error.code,
          details: result.error.details,
        },
      }
    }

    if (result.data === null) {
      return {
        data: null,
        error: { message: `${operation}: no data returned` },
      }
    }

    return {
      data: result.data,
      error: null,
      count: result.count ?? undefined,
    }
  } catch (err) {
    log.error(`${operation} threw unexpectedly`, err)
    return {
      data: null,
      error: {
        message: err instanceof Error ? err.message : 'Unknown error',
      },
    }
  }
}

/**
 * Wrap a Supabase mutation (insert/update/delete) with error handling.
 * Returns void on success since mutations typically don't return useful data.
 */
export async function mutate(
  operation: string,
  fn: () => Promise<{ error: PostgrestError | null }>
): Promise<{ success: boolean; error: DalError['error'] | null }> {
  try {
    const result = await fn()

    if (result.error) {
      log.error(`${operation} failed`, result.error)
      return {
        success: false,
        error: {
          message: result.error.message,
          code: result.error.code,
          details: result.error.details,
        },
      }
    }

    return { success: true, error: null }
  } catch (err) {
    log.error(`${operation} threw unexpectedly`, err)
    return {
      success: false,
      error: {
        message: err instanceof Error ? err.message : 'Unknown error',
      },
    }
  }
}

/**
 * Type alias for the Supabase client parameter.
 * DAL functions accept this to work with both browser and server clients.
 */
export type SupabaseParam = SupabaseClient
