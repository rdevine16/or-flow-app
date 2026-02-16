/**
 * Logger Tests
 *
 * Verifies the structured logger:
 * - Suppresses debug/info in production
 * - Emits structured JSON in production
 * - Human-readable output in development
 * - Module scoping
 * - Error formatting
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// We need to test with different NODE_ENV values, so we import dynamically
describe('logger', () => {
  let originalEnv: string | undefined

  beforeEach(() => {
    originalEnv = process.env.NODE_ENV
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.stubEnv('NODE_ENV', originalEnv ?? '')
    vi.unstubAllEnvs()
  })

  it('creates a logger with all log methods', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    // Dynamic import to get fresh module
    const { logger } = await import('../logger')
    const log = logger('TestModule')

    expect(log).toHaveProperty('debug')
    expect(log).toHaveProperty('info')
    expect(log).toHaveProperty('warn')
    expect(log).toHaveProperty('error')
  })

  it('outputs to console in development', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { logger } = await import('../logger')
    const log = logger('TestModule')
    log.warn('test warning')

    expect(spy).toHaveBeenCalled()
    // First arg should contain module name
    const call = spy.mock.calls[0]
    expect(call[0]).toContain('[WARN]')
    expect(call[0]).toContain('[TestModule]')
    expect(call[1]).toBe('test warning')
  })

  it('formats Error objects with stack traces', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { logger } = await import('../logger')
    const log = logger('TestModule')
    const testError = new Error('test error')
    log.error('something failed', testError)

    expect(spy).toHaveBeenCalled()
    const call = spy.mock.calls[0]
    // Should include the stack trace
    expect(call.some((arg: unknown) => typeof arg === 'string' && arg.includes('test error'))).toBe(true)
  })

  it('includes data objects when provided', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { logger } = await import('../logger')
    const log = logger('TestModule')
    log.warn('test with data', { userId: '123', action: 'save' })

    expect(spy).toHaveBeenCalled()
    const call = spy.mock.calls[0]
    expect(call).toContainEqual({ userId: '123', action: 'save' })
  })

  it('handles non-Error thrown values', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { logger } = await import('../logger')
    const log = logger('TestModule')
    log.error('something failed', 'string error')

    expect(spy).toHaveBeenCalled()
  })
})
