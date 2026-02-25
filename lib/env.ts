/**
 * Validated Environment Variables
 *
 * Centralizes all environment variable access with runtime validation.
 * Replaces scattered `process.env.X!` non-null assertions throughout the codebase.
 *
 * Usage:
 *   import { env } from '@/lib/env'
 *   const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
 *
 *   // Server-only (API routes):
 *   import { serverEnv } from '@/lib/env'
 *   const adminClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, serverEnv.SUPABASE_SERVICE_ROLE_KEY)
 */

// ============================================
// PUBLIC ENV (available in browser + server)
// ============================================

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}\n` +
        `See .env.example for required configuration.`
    )
  }
  return value
}

/**
 * Public environment variables (NEXT_PUBLIC_* prefix).
 * Safe to use in both client and server components.
 */
export const env = {
  get NEXT_PUBLIC_SUPABASE_URL(): string {
    return requireEnv('NEXT_PUBLIC_SUPABASE_URL')
  },
  get NEXT_PUBLIC_SUPABASE_ANON_KEY(): string {
    return requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  },
  get NEXT_PUBLIC_APP_URL(): string {
    // Accept both names for backward compatibility (env files may use either)
    const value = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL
    if (!value) {
      throw new Error(
        'Missing required environment variable: NEXT_PUBLIC_APP_URL (or NEXT_PUBLIC_SITE_URL)\n' +
          'See .env.example for required configuration.'
      )
    }
    return value
  },
  get NODE_ENV(): string {
    return process.env.NODE_ENV || 'development'
  },
  get IS_PRODUCTION(): boolean {
    return process.env.NODE_ENV === 'production'
  },
  get IS_DEVELOPMENT(): boolean {
    return process.env.NODE_ENV === 'development'
  },
} as const

// ============================================
// SERVER-ONLY ENV (never import in client code)
// ============================================

/**
 * Server-only environment variables.
 * These contain secrets and must NEVER be imported in client components.
 *
 * Importing this in a 'use client' file will throw at build time
 * because the values won't exist in the browser bundle.
 */
export const serverEnv = {
  get SUPABASE_SERVICE_ROLE_KEY(): string {
    if (typeof window !== 'undefined') {
      throw new Error(
        'serverEnv.SUPABASE_SERVICE_ROLE_KEY was accessed in browser code. ' +
          'This is a security vulnerability. Only import serverEnv in API routes or server components.'
      )
    }
    return requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  },
  get RESEND_API_KEY(): string {
    if (typeof window !== 'undefined') {
      throw new Error(
        'serverEnv.RESEND_API_KEY was accessed in browser code. ' +
          'Only import serverEnv in API routes or server components.'
      )
    }
    return requireEnv('RESEND_API_KEY')
  },
} as const
