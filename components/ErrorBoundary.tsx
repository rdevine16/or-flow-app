// components/ErrorBoundary.tsx
// Catches React errors and displays a friendly fallback UI
// Prevents the entire app from crashing on component errors

'use client'

import { Component, ReactNode } from 'react'
import { useToast } from '@/components/ui/Toast/ToastProvider'

interface ErrorBoundaryInnerProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
  showToast: (toast: { type: 'error' | 'success' | 'info'; title: string; message?: string }) => void
}

interface ErrorBoundaryProps {
  children: ReactNode
  /** Optional custom fallback UI */
  fallback?: ReactNode
  /** Called when an error is caught */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * Inner class component that receives showToast as a prop.
 * Class components are required for React error boundaries.
 */
class ErrorBoundaryInner extends Component<ErrorBoundaryInnerProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryInnerProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.props.showToast({
      type: 'error',
      title: 'Something went wrong',
      message: error.message || 'An unexpected error occurred'
    })

    this.props.onError?.(error, errorInfo)
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <DefaultErrorFallback 
          error={this.state.error} 
          onReset={this.handleReset} 
        />
      )
    }

    return this.props.children
  }
}

/**
 * Error Boundary component that catches JavaScript errors in child components.
 * Wraps the class-based boundary with a functional component to access useToast.
 * 
 * Usage:
 * ```tsx
 * <ErrorBoundary>
 *   <YourComponent />
 * </ErrorBoundary>
 * 
 * // With custom fallback:
 * <ErrorBoundary fallback={<div>Something went wrong</div>}>
 *   <YourComponent />
 * </ErrorBoundary>
 * 
 * // With error callback:
 * <ErrorBoundary onError={(error) => logToService(error)}>
 *   <YourComponent />
 * </ErrorBoundary>
 * ```
 */
export function ErrorBoundary({ children, fallback, onError }: ErrorBoundaryProps) {
  const { showToast } = useToast()

  return (
    <ErrorBoundaryInner
      fallback={fallback}
      onError={onError}
      showToast={showToast}
    >
      {children}
    </ErrorBoundaryInner>
  )
}

/**
 * Default error fallback UI - clean, professional design matching ORbit style
 */
function DefaultErrorFallback({ 
  error, 
  onReset 
}: { 
  error: Error | null
  onReset: () => void 
}) {
  return (
    <div className="min-h-[400px] flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        {/* Error Icon */}
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-100 flex items-center justify-center">
          <svg 
            className="w-8 h-8 text-red-600" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
            />
          </svg>
        </div>

        {/* Error Message */}
        <h2 className="text-xl font-semibold text-slate-900 mb-2">
          Something went wrong
        </h2>
        <p className="text-slate-600 mb-6">
          We encountered an unexpected error. Please try again or refresh the page.
        </p>

        {/* Error Details (development only) */}
        {process.env.NODE_ENV === 'development' && error && (
          <details className="mb-6 text-left">
            <summary className="text-sm text-slate-500 cursor-pointer hover:text-slate-700">
              Error details
            </summary>
            <pre className="mt-2 p-3 bg-slate-100 rounded-lg text-xs text-red-600 overflow-auto max-h-32">
              {error.message}
              {error.stack && `\n\n${error.stack}`}
            </pre>
          </details>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 justify-center">
          <button
            onClick={onReset}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Try again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
          >
            Refresh page
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Higher-order component to wrap any component with error boundary
 * 
 * Usage:
 * ```tsx
 * const SafeComponent = withErrorBoundary(MyComponent)
 * ```
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return function WithErrorBoundary(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    )
  }
}

export default ErrorBoundary