/**
 * Error Monitoring & Logging System
 * Comprehensive error tracking for production debugging
 * 
 * Supports:
 * - Client-side error tracking
 * - Server-side error logging
 * - Performance monitoring
 * - Custom event tracking
 * - Multi-facility support
 * - Integration with Sentry (optional)
 */

import { createClient } from '@/lib/supabase'

// Error severity levels
export enum ErrorSeverity {
  DEBUG = 'debug',
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

// Error categories
export enum ErrorCategory {
  AUTHENTICATION = 'authentication',
  DATABASE = 'database',
  API = 'api',
  VALIDATION = 'validation',
  NETWORK = 'network',
  SYSTEM = 'system',
  GENERAL = 'general',
}

interface ErrorContext {
  userId?: string
  email?: string
  route?: string
  action?: string
  url?: string
  facilityId?: string | null
  metadata?: Record<string, unknown>
}

interface ErrorLog {
  id: string
  timestamp: Date
  severity: ErrorSeverity
  category: ErrorCategory
  message: string
  stack?: string
  context: ErrorContext
  userAgent?: string
  facilityId?: string | null
}

/**
 * Main Error Logger Class
 */
class ErrorLogger {
  private isDevelopment: boolean
  private queue: ErrorLog[] = []
  private flushInterval: NodeJS.Timeout | null = null
  
  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development'
    
    // Auto-flush errors to database every 30 seconds
    if (typeof window !== 'undefined') {
      this.flushInterval = setInterval(() => {
        this.flush()
      }, 30000)
    }
  }
  
  /**
   * Get current user's facility_id (null for global admins)
   */
  private async getCurrentFacilityId(): Promise<string | null> {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) return null
      
      const { data: userData } = await supabase
        .from('users')
        .select('facility_id')
        .eq('id', user.id)
        .single()
      
      // Return null for global admins (no facility), or the facility_id
      return userData?.facility_id || null
    } catch (error) {
      console.error('Failed to get facility_id:', error)
      return null
    }
  }
  
  /**
   * Log an error
   */
  async log(
    message: string,
    severity: ErrorSeverity = ErrorSeverity.ERROR,
    category: ErrorCategory = ErrorCategory.GENERAL,
    error?: Error,
    context?: ErrorContext
  ): Promise<void> {
    // Get facility_id if not provided in context
    const facilityId = context?.facilityId !== undefined 
      ? context.facilityId 
      : await this.getCurrentFacilityId()
    
    const errorLog: ErrorLog = {
      id: this.generateId(),
      timestamp: new Date(),
      severity,
      category,
      message,
      stack: error?.stack,
      context: {
        ...context,
        facilityId,
        route: typeof window !== 'undefined' ? window.location.pathname : undefined,
        url: typeof window !== 'undefined' ? window.location.href : undefined,
      },
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      facilityId,
    }
    
    // Console log in development
    if (this.isDevelopment) {
      this.consoleLog(errorLog)
    }
    
    // Add to queue for batch processing
    this.queue.push(errorLog)
    
    // Send to Sentry if configured
    if (this.shouldSendToSentry(severity)) {
      this.sendToSentry(errorLog, error)
    }
    
    // Flush immediately for critical errors
    if (severity === ErrorSeverity.CRITICAL) {
      await this.flush()
    }
  }
  
  /**
   * Convenience methods
   */
  async debug(message: string, context?: ErrorContext): Promise<void> {
    await this.log(message, ErrorSeverity.DEBUG, ErrorCategory.GENERAL, undefined, context)
  }
  
  async info(message: string, context?: ErrorContext): Promise<void> {
    await this.log(message, ErrorSeverity.INFO, ErrorCategory.GENERAL, undefined, context)
  }
  
  async warning(message: string, context?: ErrorContext): Promise<void> {
    await this.log(message, ErrorSeverity.WARNING, ErrorCategory.GENERAL, undefined, context)
  }
  
  async error(message: string, error?: Error, context?: ErrorContext): Promise<void> {
    await this.log(message, ErrorSeverity.ERROR, ErrorCategory.GENERAL, error, context)
  }
  
  async critical(message: string, error?: Error, context?: ErrorContext): Promise<void> {
    await this.log(message, ErrorSeverity.CRITICAL, ErrorCategory.GENERAL, error, context)
  }
  
  /**
   * Log authentication errors
   */
  async authError(message: string, email?: string, error?: Error): Promise<void> {
    await this.log(
      message,
      ErrorSeverity.ERROR,
      ErrorCategory.AUTHENTICATION,
      error,
      { email }
    )
  }
  
  /**
   * Log database errors
   */
  async dbError(message: string, query?: string, error?: Error): Promise<void> {
    await this.log(
      message,
      ErrorSeverity.ERROR,
      ErrorCategory.DATABASE,
      error,
      { metadata: { query } }
    )
  }
  
  /**
   * Console log with formatting
   */
  private consoleLog(errorLog: ErrorLog): void {
    const style = this.getConsoleStyle(errorLog.severity)
    const facilityInfo = errorLog.facilityId ? `[Facility: ${errorLog.facilityId}]` : '[Global Admin]'
    const prefix = `[${errorLog.severity.toUpperCase()}] [${errorLog.category}] ${facilityInfo}`
    
    console.log(
      `%c${prefix} ${errorLog.message}`,
      style,
      errorLog.context
    )
    
    if (errorLog.stack) {
      console.log('%cStack:', 'color: gray', errorLog.stack)
    }
  }
  
  /**
   * Get console style for severity
   */
  private getConsoleStyle(severity: ErrorSeverity): string {
    const styles = {
      [ErrorSeverity.DEBUG]: 'color: gray',
      [ErrorSeverity.INFO]: 'color: blue',
      [ErrorSeverity.WARNING]: 'color: orange; font-weight: bold',
      [ErrorSeverity.ERROR]: 'color: red; font-weight: bold',
      [ErrorSeverity.CRITICAL]: 'color: white; background: red; font-weight: bold; padding: 2px 4px',
    }
    return styles[severity]
  }
  
  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }
  
  /**
   * Flush queued errors to database
   */
  async flush(): Promise<void> {
    if (this.queue.length === 0) return
    
    const errors = [...this.queue]
    this.queue = []
    
    try {
      const supabase = createClient()
      
      // Insert errors in batch
      const { error } = await supabase.from('error_logs').insert(
        errors.map(e => ({
          severity: e.severity,
          category: e.category,
          message: e.message,
          stack: e.stack,
          context: e.context,
          user_agent: e.userAgent,
          url: e.context.url,
          facility_id: e.facilityId,
          created_at: e.timestamp.toISOString(),
        }))
      )
      
      if (error) {
        console.error('Failed to flush errors to database:', error)
        // Re-queue failed errors
        this.queue.push(...errors)
      }
    } catch (err) {
      console.error('Error flushing logs:', err)
      // Re-queue failed errors
      this.queue.push(...errors)
    }
  }
  
  /**
   * Check if error should be sent to Sentry
   */
  private shouldSendToSentry(severity: ErrorSeverity): boolean {
    return (
      !this.isDevelopment &&
      (severity === ErrorSeverity.ERROR || severity === ErrorSeverity.CRITICAL)
    )
  }
  
  /**
   * Send error to Sentry
   */
  private sendToSentry(errorLog: ErrorLog, error?: Error): void {
    if (typeof window === 'undefined') return

    // @ts-expect-error - Sentry is loaded globally
    if (window.Sentry) {
      // @ts-expect-error - Sentry is loaded globally
      window.Sentry.captureException(error || new Error(errorLog.message), {
        level: errorLog.severity,
        tags: {
          category: errorLog.category,
          facilityId: errorLog.facilityId || 'global_admin',
        },
        extra: errorLog.context,
      })
    }
  }
  
  /**
   * Cleanup on unmount
   */
  cleanup(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval)
    }
    this.flush()
  }
}

// Singleton instance
export const errorLogger = new ErrorLogger()

/**
 * Performance monitoring
 */
export function measurePerformance(name: string, fn: () => void): void {
  const start = performance.now()
  fn()
  const duration = performance.now() - start
  
  if (duration > 1000) {
    errorLogger.warning(`Slow operation: ${name} took ${duration.toFixed(2)}ms`)
  }
}

export async function measureAsync<T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = performance.now()
  const result = await fn()
  const duration = performance.now() - start
  
  if (duration > 2000) {
    errorLogger.warning(`Slow async operation: ${name} took ${duration.toFixed(2)}ms`)
  }
  
  return result
}

/**
 * Database migration for error_logs table
 */
export const CREATE_ERROR_LOGS_TABLE = `
-- Error Logs Table (Updated with facility_id support)
CREATE TABLE IF NOT EXISTS error_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  severity TEXT NOT NULL CHECK (severity IN ('debug', 'info', 'warning', 'error', 'critical')),
  category TEXT NOT NULL CHECK (category IN ('authentication', 'database', 'api', 'validation', 'network', 'system', 'general')),
  message TEXT NOT NULL,
  stack TEXT,
  context JSONB,
  user_agent TEXT,
  url TEXT,
  facility_id UUID REFERENCES facilities(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for querying
CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON error_logs(severity);
CREATE INDEX IF NOT EXISTS idx_error_logs_category ON error_logs(category);
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_facility_id ON error_logs(facility_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_context_user ON error_logs USING GIN ((context->'userId'));

-- RLS Policies (only admins can view error logs)
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Global admins can view all error logs"
  ON error_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.access_level = 'global_admin'
    )
  );

CREATE POLICY "Facility admins can view their facility errors"
  ON error_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.access_level IN ('admin', 'super_admin')
      AND users.facility_id = error_logs.facility_id
    )
  );

-- Allow service role to insert errors
CREATE POLICY "Allow service role to insert errors"
  ON error_logs FOR INSERT
  WITH CHECK (true);

-- Function to cleanup old error logs (keep 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_error_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM error_logs
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup (if using pg_cron)
-- SELECT cron.schedule('cleanup-error-logs', '0 3 * * 0', 'SELECT cleanup_old_error_logs()');
`

/**
 * Migration to add facility_id to existing error_logs table
 */
export const ADD_FACILITY_ID_TO_ERROR_LOGS = `
-- Add facility_id column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'error_logs' AND column_name = 'facility_id'
  ) THEN
    ALTER TABLE error_logs ADD COLUMN facility_id UUID REFERENCES facilities(id) ON DELETE SET NULL;
    CREATE INDEX idx_error_logs_facility_id ON error_logs(facility_id);
  END IF;
END $$;

-- Update category constraint to include 'general' and 'system'
ALTER TABLE error_logs DROP CONSTRAINT IF EXISTS error_logs_category_check;
ALTER TABLE error_logs ADD CONSTRAINT error_logs_category_check 
  CHECK (category IN ('authentication', 'database', 'api', 'validation', 'network', 'system', 'general'));
`

/**
 * Usage Examples:
 * 
 * // Basic logging (automatically tracks facility)
 * await errorLogger.error('Failed to fetch user data', error, { userId: '123' })
 * 
 * // Authentication errors (category set to 'authentication')
 * await errorLogger.authError('Invalid credentials', email, error)
 * 
 * // Database errors (category set to 'database')
 * await errorLogger.dbError('Query failed', 'SELECT * FROM users', error)
 * 
 * // Override facility_id (useful for specific scenarios)
 * await errorLogger.info('System event', { facilityId: null }) // Force global admin
 * 
 * // Performance monitoring
 * await measureAsync('fetchUserData', async () => {
 *   return await supabase.from('users').select('*')
 * })
 */