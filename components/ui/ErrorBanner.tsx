'use client'

// components/ui/ErrorBanner.tsx
// Dismissible error banner with retry action
// Replaces inline error banner patterns across all pages
//
// Usage:
//   <ErrorBanner
//     message={error}
//     onRetry={() => fetchData()}
//     onDismiss={() => setError(null)}
//   />

import { AlertCircle, X } from 'lucide-react'


interface ErrorBannerProps {
  /** Error message to display */
  message: string | null
  /** Called when the user clicks "Try again" */
  onRetry?: () => void
  /** Called when the user dismisses the banner */
  onDismiss?: () => void
  /** Optional custom retry label */
  retryLabel?: string
  /** Optional className override */
  className?: string
}

export function ErrorBanner({
  message,
  onRetry,
  onDismiss,
  retryLabel = 'Try again',
  className = '',
}: ErrorBannerProps) {
  if (!message) return null

  return (
    <div
      className={`p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 ${className}`}
      role="alert"
    >
      <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-red-800">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-1.5 text-sm text-red-600 underline hover:text-red-700 transition-colors"
          >
            {retryLabel}
          </button>
        )}
      </div>

      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-red-400 hover:text-red-600 transition-colors flex-shrink-0"
          aria-label="Dismiss error"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}