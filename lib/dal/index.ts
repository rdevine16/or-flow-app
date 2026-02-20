/**
 * Data Access Layer (DAL) — Index
 *
 * Centralizes ALL Supabase database queries into type-safe functions.
 * Instead of 83+ files writing raw `.from().select()` queries inline,
 * all database access goes through this layer.
 *
 * Benefits:
 *   1. Single source of truth for query shapes
 *   2. Type safety — return types are explicit, not inferred from `any`
 *   3. Easier to test — mock this layer, not Supabase client
 *   4. Easier to refactor — change a query in one place
 *   5. Observability — add logging/metrics here
 *
 * Usage:
 *   import { casesDAL } from '@/lib/dal'
 *   const cases = await casesDAL.listByFacility(supabase, facilityId, date)
 *
 * Convention:
 *   - Every function takes `supabase` as first arg (client or server)
 *   - Returns `{ data, error }` to match Supabase patterns
 *   - Throws on critical errors, returns null on not-found
 */

export { casesDAL } from './cases'
export type { CasesPageTab, CaseFlagSummary, CasesFilterParams } from './cases'
export { usersDAL } from './users'
export { facilitiesDAL } from './facilities'
export { lookupsDAL } from './lookups'
export * as flagRulesDAL from './flag-rules'

// ============================================
// SHARED TYPES
// ============================================

import type { SupabaseClient, PostgrestError } from '@supabase/supabase-js'

/** Any Supabase client (browser or server) */
export type AnySupabaseClient = SupabaseClient

/** Standard DAL return type */
export interface DALResult<T> {
  data: T | null
  error: PostgrestError | null
}

/** Standard DAL list return type */
export interface DALListResult<T> {
  data: T[]
  error: PostgrestError | null
  count?: number
}

/** Pagination params */
export interface PaginationParams {
  page?: number
  pageSize?: number
}

/** Sort params for server-side sorting */
export interface SortParams {
  sortBy: string
  sortDirection: 'asc' | 'desc'
}

/** Date range filter */
export interface DateRange {
  start: string  // YYYY-MM-DD
  end: string    // YYYY-MM-DD
}
