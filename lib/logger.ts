/**
 * Structured Logger
 *
 * Lightweight drop-in replacement for console.log/warn/error.
 * - Development: full output with module context and timestamps
 * - Production: suppresses debug/info, formats error/warn as structured JSON
 * - Zero dependencies, no async, no DB writes
 *
 * For persistent error tracking (DB + Sentry), use `errorLogger` from '@/lib/error-logger'.
 *
 * Usage:
 *   import { logger } from '@/lib/logger'
 *
 *   const log = logger('CaseDetail')        // Create module-scoped logger
 *   log.debug('Fetching case', { id })       // Suppressed in production
 *   log.info('Case loaded', { caseNumber })  // Suppressed in production
 *   log.warn('Missing milestone', { name })  // Always outputs
 *   log.error('Failed to save', error)       // Always outputs, structured
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const IS_PRODUCTION = process.env.NODE_ENV === 'production'
const MIN_LEVEL: LogLevel = IS_PRODUCTION ? 'warn' : 'debug'

interface LogEntry {
  level: LogLevel
  module: string
  message: string
  timestamp: string
  data?: Record<string, unknown>
  error?: {
    name: string
    message: string
    stack?: string
  }
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LEVEL]
}

function formatError(err: unknown): LogEntry['error'] | undefined {
  if (!err) return undefined
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack }
  }
  if (typeof err === 'object') {
    return { name: 'Unknown', message: JSON.stringify(err) }
  }
  return { name: 'Unknown', message: String(err) }
}

function createEntry(
  level: LogLevel,
  module: string,
  message: string,
  dataOrError?: Record<string, unknown> | Error | unknown,
  error?: Error | unknown
): LogEntry {
  const entry: LogEntry = {
    level,
    module,
    message,
    timestamp: new Date().toISOString(),
  }

  // Handle overloaded signatures: (msg, error) or (msg, data, error)
  if (dataOrError instanceof Error) {
    entry.error = formatError(dataOrError)
  } else if (dataOrError && typeof dataOrError === 'object' && !(dataOrError instanceof Error)) {
    entry.data = dataOrError as Record<string, unknown>
  }

  if (error) {
    entry.error = formatError(error)
  }

  return entry
}

function emit(entry: LogEntry): void {
  if (IS_PRODUCTION) {
    // Structured JSON for log aggregators (Vercel, Datadog, etc.)
    const output = JSON.stringify(entry)
    if (entry.level === 'error') {
      console.error(output)
    } else {
      console.warn(output)
    }
  } else {
    // Human-readable for development
    const prefix = `[${entry.level.toUpperCase()}] [${entry.module}]`
    const args: unknown[] = [prefix, entry.message]
    if (entry.data) args.push(entry.data)
    if (entry.error) args.push(entry.error.stack || entry.error.message)

    switch (entry.level) {
      case 'debug':
        console.debug(...args)
        break
      case 'info':
        console.info(...args)
        break
      case 'warn':
        console.warn(...args)
        break
      case 'error':
        console.error(...args)
        break
    }
  }
}

export interface Logger {
  debug(message: string, data?: Record<string, unknown>): void
  info(message: string, data?: Record<string, unknown>): void
  warn(message: string, data?: Record<string, unknown>): void
  warn(message: string, error: Error | unknown): void
  error(message: string, error?: Error | unknown, data?: Record<string, unknown>): void
}

/**
 * Create a module-scoped logger.
 *
 * @param module - The component/file/module name (e.g. 'CaseDetail', 'orbitScoreEngine', 'api/demo-data')
 */
export function logger(module: string): Logger {
  return {
    debug(message: string, data?: Record<string, unknown>) {
      if (!shouldLog('debug')) return
      emit(createEntry('debug', module, message, data))
    },
    info(message: string, data?: Record<string, unknown>) {
      if (!shouldLog('info')) return
      emit(createEntry('info', module, message, data))
    },
    warn(message: string, dataOrError?: Record<string, unknown> | Error | unknown) {
      if (!shouldLog('warn')) return
      emit(createEntry('warn', module, message, dataOrError))
    },
    error(message: string, error?: Error | unknown, data?: Record<string, unknown>) {
      if (!shouldLog('error')) return
      emit(createEntry('error', module, message, data, error))
    },
  }
}
