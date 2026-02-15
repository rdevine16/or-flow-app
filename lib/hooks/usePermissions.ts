// lib/hooks/usePermissions.ts
// Fetches resolved permissions for the current user via the
// get_user_permissions() Supabase RPC. Returns a flat map of
// permission keys → booleans plus convenience helpers: can, canAny, canAll.
//
// Usage:
//   const { can, canAny, canAll, loading } = usePermissions()
//   if (can('cases.create')) { ... }

'use client'

import { useCallback } from 'react'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'

// ============================================
// Types
// ============================================

export interface UsePermissionsReturn {
  /** Raw permission map from the RPC */
  permissions: Record<string, boolean>
  /** Check if user has a specific permission */
  can: (key: string) => boolean
  /** Check if user has any of the specified permissions */
  canAny: (...keys: string[]) => boolean
  /** Check if user has all of the specified permissions */
  canAll: (...keys: string[]) => boolean
  /** Whether permissions are still loading */
  loading: boolean
}

// ============================================
// Hook
// ============================================

export function usePermissions(
  accessLevel: string | undefined,
  enabled: boolean = true,
): UsePermissionsReturn {
  const { data, loading } = useSupabaseQuery<Record<string, boolean>>(
    async (supabase) => {
      const { data: perms, error } = await supabase.rpc('get_user_permissions')
      if (error) throw error
      return (perms as Record<string, boolean>) ?? {}
    },
    {
      deps: [accessLevel],
      enabled,
    },
  )

  const permissions = data ?? {}

  const can = useCallback(
    (key: string) => {
      // Admins always bypass
      if (accessLevel === 'global_admin' || accessLevel === 'facility_admin') return true
      return permissions[key] === true
    },
    [permissions, accessLevel],
  )

  const canAny = useCallback(
    (...keys: string[]) => keys.some((k) => can(k)),
    [can],
  )

  const canAll = useCallback(
    (...keys: string[]) => keys.every((k) => can(k)),
    [can],
  )

  return { permissions, can, canAny, canAll, loading }
}
