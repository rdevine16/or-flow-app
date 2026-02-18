/**
 * Error Tracking — Production Error Capture
 *
 * Abstraction layer over error tracking providers (Sentry, LogRocket, etc.)
 * Currently scaffolded for Sentry. Install with:
 *
 *   npm install @sentry/nextjs
 *
 * Then uncomment the Sentry imports below and configure in sentry.*.config.ts
 *
 * Usage:
 *   import { captureError, captureMessage, setUser } from '@/lib/error-tracking'
 *
 *   // In catch blocks:
 *   captureError(error, { tags: { page: 'analytics' } })
 *
 *   // Set user context after login:
 *   setUser({ id: user.id, email: user.email, facilityId })
 */

// ============================================
// PROVIDER INTERFACE
// ============================================

import { logger } from '@/lib/logger'

const log = logger('error-tracking')

interface ErrorContext {
  tags?: Record<string, string>
  extra?: Record<string, unknown>
  level?: 'fatal' | 'error' | 'warning' | 'info'
  fingerprint?: string[]
}

interface UserContext {
  id: string
  email?: string
  facilityId?: string
  role?: string
}

// ============================================
// IMPLEMENTATION
// When Sentry is installed, swap these stubs for real calls.
// ============================================

// import * as Sentry from '@sentry/nextjs'

/**
 * Capture an error and send to tracking provider
 */
export function captureError(error: Error | unknown, context?: ErrorContext): void {
  // === SENTRY (uncomment when installed) ===
  // Sentry.captureException(error, {
  //   tags: context?.tags,
  //   extra: context?.extra,
  //   level: context?.level || 'error',
  //   fingerprint: context?.fingerprint,
  // })

  // === FALLBACK: structured console logging ===
  if (process.env.NODE_ENV === 'development') {
    console.error('[ErrorTracking]', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      ...context,
      timestamp: new Date().toISOString(),
    })
  } else {
    // Production: log structured JSON for log aggregators (Vercel, CloudWatch, etc.)
    console.error(JSON.stringify({
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : 'UnknownError',
      stack: error instanceof Error ? error.stack : undefined,
      tags: context?.tags,
      level: context?.level || 'error',
      timestamp: new Date().toISOString(),
    }))
  }
}

/**
 * Capture a message (non-error event)
 */
export function captureMessage(message: string, context?: ErrorContext): void {
  // Sentry.captureMessage(message, { tags: context?.tags, extra: context?.extra })

  if (process.env.NODE_ENV !== 'production') {
    log.warn(message, context)
  }
}

/**
 * Set user context for all subsequent error reports
 */
export function setUser(user: UserContext | null): void {
  // Sentry.setUser(user ? { id: user.id, email: user.email, ...user } : null)

  if (process.env.NODE_ENV === 'development' && user) {
    console.info('[ErrorTracking] User context set:', user.id)
  }
}

/**
 * Add breadcrumb for debugging context
 */
export function addBreadcrumb(): void {
  // Sentry.addBreadcrumb({ category, message, data, level: 'info' })
}

/**
 * Start a performance transaction
 */
export function startTransaction(name: string, op: string): {
  finish: () => void
  setTag: (key: string, value: string) => void
} {
  // const transaction = Sentry.startTransaction({ name, op })
  // return {
  //   finish: () => transaction.finish(),
  //   setTag: (key, value) => transaction.setTag(key, value),
  // }

  const start = performance.now()
  return {
    finish: () => {
      if (process.env.NODE_ENV === 'development') {
        const duration = (performance.now() - start).toFixed(1)
        console.info(`[Perf] ${op}/${name}: ${duration}ms`)
      }
    },
    setTag: () => {},
  }
}
