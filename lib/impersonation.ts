// lib/impersonation.ts
// Impersonation management for global admins
// Allows viewing any facility's data while staying logged in as admin

import { SupabaseClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'

const log = logger('impersonation')

// Storage key for impersonation state
const IMPERSONATION_KEY = 'orbit-impersonation'

export interface ImpersonationState {
  facilityId: string
  facilityName: string
  sessionId: string
  startedAt: string
}

/**
 * Start impersonating a facility
 * Creates an admin_session record and stores state in localStorage
 */
export async function startImpersonation(
  supabase: SupabaseClient,
  adminUserId: string,
  facilityId: string,
  facilityName: string
): Promise<{ success: boolean; sessionId?: string; error?: string }> {
  try {
    // Create admin_session record
    const { data: session, error } = await supabase
      .from('admin_sessions')
      .insert({
        admin_user_id: adminUserId,
        viewing_facility_id: facilityId,
        is_active: true,
      })
      .select('id')
      .single()

    if (error) {
      log.error('[IMPERSONATION] Failed to create session:', error)
      return { success: false, error: error.message }
    }

    // Store in localStorage for client-side access
    const state: ImpersonationState = {
      facilityId,
      facilityName,
      sessionId: session.id,
      startedAt: new Date().toISOString(),
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem(IMPERSONATION_KEY, JSON.stringify(state))
    }

    return { success: true, sessionId: session.id }
  } catch (err) {
    log.error('[IMPERSONATION] Exception starting impersonation:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

/**
 * End impersonation session
 * Updates the admin_session record and clears localStorage
 */
export async function endImpersonation(
  supabase: SupabaseClient
): Promise<{ success: boolean; error?: string }> {
  try {
    const state = getImpersonationState()
    
    if (!state) {
      // No active impersonation, just clear storage to be safe
      clearImpersonationStorage()
      return { success: true }
    }

    // Update admin_session record
    const { error } = await supabase
      .from('admin_sessions')
      .update({
        ended_at: new Date().toISOString(),
        is_active: false,
      })
      .eq('id', state.sessionId)

    if (error) {
      log.error('[IMPERSONATION] Failed to end session:', error)
      // Still clear localStorage even if DB update fails
    }

    // Clear localStorage
    clearImpersonationStorage()

    return { success: true }
  } catch (err) {
    log.error('[IMPERSONATION] Exception ending impersonation:', err)
    clearImpersonationStorage() // Clear anyway
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

/**
 * Get current impersonation state from localStorage
 */
export function getImpersonationState(): ImpersonationState | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const stored = localStorage.getItem(IMPERSONATION_KEY)
    if (!stored) return null
    return JSON.parse(stored) as ImpersonationState
  } catch {
    return null
  }
}

/**
 * Check if currently impersonating
 */
export function isImpersonating(): boolean {
  return getImpersonationState() !== null
}

/**
 * Get the facility ID to use for queries
 * Returns impersonated facility if active, otherwise the user's actual facility
 */
export function getEffectiveFacilityId(userFacilityId: string | null): string | null {
  const state = getImpersonationState()
  if (state) {
    return state.facilityId
  }
  return userFacilityId
}

/**
 * Clear impersonation from localStorage only
 * Use when you need to force-clear without DB update
 */
export function clearImpersonationStorage(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(IMPERSONATION_KEY)
  }
}

/**
 * Hook-friendly function to get impersonation context
 * Returns all the info needed to display impersonation banner and handle queries
 */
export function useImpersonationContext(userFacilityId: string | null, isGlobalAdmin: boolean) {
  const state = getImpersonationState()
  const isActive = state !== null && isGlobalAdmin

  return {
    isImpersonating: isActive,
    impersonatedFacilityId: isActive ? state.facilityId : null,
    impersonatedFacilityName: isActive ? state.facilityName : null,
    sessionId: isActive ? state.sessionId : null,
    effectiveFacilityId: isActive ? state.facilityId : userFacilityId,
  }
}

/**
 * Server-side: Check for active impersonation session
 * Use this in API routes to verify impersonation is legitimate
 */
export async function verifyImpersonationSession(
  supabase: SupabaseClient,
  adminUserId: string,
  sessionId: string
): Promise<{ valid: boolean; facilityId?: string }> {
  try {
    const { data: session, error } = await supabase
      .from('admin_sessions')
      .select('viewing_facility_id, is_active')
      .eq('id', sessionId)
      .eq('admin_user_id', adminUserId)
      .single()

    if (error || !session) {
      return { valid: false }
    }

    if (!session.is_active) {
      return { valid: false }
    }

    return { valid: true, facilityId: session.viewing_facility_id }
  } catch {
    return { valid: false }
  }
}

/**
 * Get all impersonation sessions for audit purposes
 */
export async function getImpersonationHistory(
  supabase: SupabaseClient,
  options: {
    adminUserId?: string
    facilityId?: string
    limit?: number
  } = {}
): Promise<{
  sessions: Array<{
    id: string
    admin_user_id: string
    viewing_facility_id: string
    started_at: string
    ended_at: string | null
    is_active: boolean
  }>
  error?: string
}> {
  try {
    let query = supabase
      .from('admin_sessions')
      .select('*')
      .order('started_at', { ascending: false })

    if (options.adminUserId) {
      query = query.eq('admin_user_id', options.adminUserId)
    }

    if (options.facilityId) {
      query = query.eq('viewing_facility_id', options.facilityId)
    }

    if (options.limit) {
      query = query.limit(options.limit)
    }

    const { data, error } = await query

    if (error) {
      return { sessions: [], error: error.message }
    }

    return { sessions: data || [] }
  } catch (err) {
    return { sessions: [], error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
