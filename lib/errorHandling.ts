/**
 * ENTERPRISE ERROR HANDLING
 * 
 * Drop-in replacement for production error handling.
 * Works with your existing Supabase setup.
 */

'use client'

import { useState, useCallback } from 'react'
import { PostgrestError } from '@supabase/supabase-js'

// ============================================
// ERROR TYPES
// ============================================

export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: Record<string, any>
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'VALIDATION_ERROR', 400, details)
    this.name = 'ValidationError'
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 'AUTHORIZATION_ERROR', 403)
    this.name = 'AuthorizationError'
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    const message = id 
      ? `${resource} with id '${id}' not found`
      : `${resource} not found`
    super(message, 'NOT_FOUND', 404)
    this.name = 'NotFoundError'
  }
}

// ============================================
// ERROR LOGGER
// ============================================

interface ErrorContext {
  userId?: string
  facilityId?: string
  action?: string
  metadata?: Record<string, any>
}

export async function logError(
  error: Error,
  context: ErrorContext = {}
): Promise<void> {
  const errorLog = {
    message: error.message,
    stack: error.stack,
    name: error.name,
    timestamp: new Date().toISOString(),
    ...context,
  }

  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.error('❌ Error logged:', errorLog)
  }

  // In production, you could log to:
  // - Supabase error_logs table
  // - Sentry
  // - DataDog
  // - CloudWatch
  
  // For now, just console.error in production too
  if (process.env.NODE_ENV === 'production') {
    console.error('Error:', error.message, context)
  }
}

// ============================================
// SUPABASE ERROR HANDLER
// ============================================

export function handleSupabaseError(error: PostgrestError | null): never {
  if (!error) {
    throw new AppError('Unknown database error', 'DB_ERROR')
  }

  // Map common Postgres error codes
  switch (error.code) {
    case '23505': // Unique violation
      throw new ValidationError('This record already exists', {
        field: error.details,
        hint: error.hint,
      })
    
    case '23503': // Foreign key violation
      throw new ValidationError('Referenced record not found', {
        field: error.details,
        hint: error.hint,
      })
    
    case '42501': // Insufficient privileges  
      throw new AuthorizationError('You do not have permission to perform this action')
    
    case 'PGRST116': // No rows returned (for .single())
      throw new NotFoundError('Record')
    
    default:
      throw new AppError(
        error.message || 'Database operation failed',
        error.code || 'DB_ERROR',
        500,
        { 
          hint: error.hint, 
          details: error.details 
        }
      )
  }
}

// ============================================
// ASYNC HANDLER HOOK (Client Components)
// ============================================

interface AsyncHandlerOptions<T> {
  onSuccess?: (data: T) => void
  onError?: (error: Error) => void | string
  showToast?: boolean
}

export function useAsyncHandler<T = any>(
  options: AsyncHandlerOptions<T> = {}
) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const execute = useCallback(
    async (fn: () => Promise<T>): Promise<T | null> => {
      setLoading(true)
      setError(null)

      try {
        const result = await fn()
        
        if (options.onSuccess) {
          options.onSuccess(result)
        }
        
        return result
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        setError(error)

        // Log error
        await logError(error)

        // Call custom error handler
        if (options.onError) {
          options.onError(error)
        }

        // You can integrate with your toast system here
        // toast.error(error.message)

        return null
      } finally {
        setLoading(false)
      }
    },
    [options]
  )

  const reset = useCallback(() => {
    setLoading(false)
    setError(null)
  }, [])

  return { execute, loading, error, reset }
}

// ============================================
// API ROUTE ERROR HANDLER (Server)
// ============================================

import { NextRequest, NextResponse } from 'next/server'

export function withErrorHandler<T>(
  handler: (req: NextRequest, ...args: any[]) => Promise<T>
) {
  return async (req: NextRequest, ...args: any[]) => {
    try {
      const result = await handler(req, ...args)
      return result
    } catch (error) {
      // Log error
      await logError(
        error instanceof Error ? error : new Error(String(error)),
        {
          action: `${req.method} ${req.url}`,
        }
      )

      // Return appropriate error response
      if (error instanceof AppError) {
        return NextResponse.json(
          {
            error: error.message,
            code: error.code,
            details: error.details,
          },
          { status: error.statusCode }
        )
      }

      // Unexpected error - don't leak details in production
      const message = process.env.NODE_ENV === 'development' 
        ? (error instanceof Error ? error.message : 'Unknown error')
        : 'Internal server error'

      return NextResponse.json(
        {
          error: message,
          code: 'INTERNAL_ERROR',
        },
        { status: 500 }
      )
    }
  }
}

// ============================================
// EXAMPLE USAGE
// ============================================

/*
// Example 1: In a client component
import { useAsyncHandler, handleSupabaseError } from '@/lib/errorHandling'
import { createClient } from '@/lib/supabase'

function MyComponent() {
  const { execute, loading, error } = useAsyncHandler({
    onSuccess: (data) => {
      console.log('Success!', data)
    },
  })

  async function handleSubmit() {
    await execute(async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('cases')
        .insert({ ... })
        .select()
        .single()
      
      if (error) handleSupabaseError(error)
      return data
    })
  }

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>

  return <button onClick={handleSubmit}>Submit</button>
}

// Example 2: In an API route
import { withErrorHandler, handleSupabaseError } from '@/lib/errorHandling'
import { createClient } from '@/lib/supabase-server'

export const POST = withErrorHandler(async (req) => {
  const supabase = await createClient()
  
  const body = await req.json()
  
  const { data, error } = await supabase
    .from('cases')
    .insert(body)
    .select()
    .single()
  
  if (error) handleSupabaseError(error)
  
  return NextResponse.json(data, { status: 201 })
})
*/
