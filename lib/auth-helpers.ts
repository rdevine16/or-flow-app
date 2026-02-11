// lib/auth-helpers.ts
// Helper functions for authentication-related operations

import { SupabaseClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'

const log = logger('auth-helpers')

/**
 * Update user's last login timestamp
 */
export async function updateLastLogin(supabase: SupabaseClient, userId: string) {
  const { error } = await supabase
    .from('users')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', userId)

  if (error) {
    log.error('Failed to update last login:', error)
  }
}

/**
 * Check if user is active (not deactivated)
 * Returns { isActive: boolean, error?: string }
 */
export async function checkUserActive(
  supabase: SupabaseClient, 
  userId: string
): Promise<{ isActive: boolean; error?: string }> {
  const { data, error } = await supabase
    .from('users')
    .select('is_active')
    .eq('id', userId)
    .single()

  if (error) {
    log.error('Failed to check user status:', error)
    return { isActive: false, error: 'Unable to verify account status' }
  }

  if (data?.is_active === false) {
    return { isActive: false, error: 'Your account has been deactivated. Please contact your administrator.' }
  }

  return { isActive: true }
}

/**
 * Format last login for display
 */
export function formatLastLogin(lastLoginAt: string | null): string {
  if (!lastLoginAt) return 'Never'

  const date = new Date(lastLoginAt)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}
