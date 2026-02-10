// components/ui/Loading.tsx
'use client'

import { ReactNode } from 'react'

// ============================================
// Spinner
// ============================================

type SpinnerSize = 'sm' | 'md' | 'lg' | 'xl'
type SpinnerColor = 'blue' | 'white' | 'slate' | 'green' | 'red'

interface SpinnerProps {
  size?: SpinnerSize
  color?: SpinnerColor
  className?: string
}

const sizeClasses: Record<SpinnerSize, string> = {
  sm: 'w-4 h-4 border-2',
  md: 'w-8 h-8 border-2',
  lg: 'w-12 h-12 border-3',
  xl: 'w-16 h-16 border-4',
}

const colorClasses: Record<SpinnerColor, string> = {
  blue: 'border-blue-600 border-t-transparent',
  white: 'border-white border-t-transparent',
  slate: 'border-slate-600 border-t-transparent',
  green: 'border-green-600 border-t-transparent',
  red: 'border-red-600 border-t-transparent',
}

export function Spinner({ size = 'md', color = 'blue', className = '' }: SpinnerProps) {
  return (
    <div
      className={`
        ${sizeClasses[size]}
        ${colorClasses[color]}
        rounded-full
        animate-spin
        ${className}
      `}
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only">Loading...</span>
    </div>
  )
}

// ============================================
// Page Loader (Full Screen)
// ============================================

interface PageLoaderProps {
  message?: string
}

export function PageLoader({ message = 'Loading...' }: PageLoaderProps) {
  return (
    <div className="flex flex-col items-center justify-center h-64">
      <Spinner size="lg" />
      {message && (
        <p className="mt-4 text-sm text-slate-600">{message}</p>
      )}
    </div>
  )
}

// ============================================
// Skeleton Components — MOVED to Skeleton.tsx
// Use: import { Skeleton, SkeletonTable, ... } from '@/components/ui/Skeleton'
// ============================================

// ============================================
// Loading Overlay
// ============================================

interface LoadingOverlayProps {
  show: boolean
  message?: string
  children?: ReactNode
}

export function LoadingOverlay({ show, message, children }: LoadingOverlayProps) {
  if (!show) return <>{children}</>

  return (
    <div className="relative">
      {children && (
        <div className="opacity-50 pointer-events-none">
          {children}
        </div>
      )}
      <div className="absolute inset-0 flex items-center justify-center bg-white/80">
        <div className="flex flex-col items-center">
          <Spinner size="lg" />
          {message && (
            <p className="mt-4 text-sm text-slate-600">{message}</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================
// Usage Examples (in comments)
// ============================================

/*
// Basic spinner
<Spinner />
<Spinner size="sm" />
<Spinner size="lg" color="white" />

// Full page loader
<PageLoader message="Loading your data..." />

// Skeleton loaders
<Skeleton.Line />
<Skeleton.Text />
<Skeleton.Title />
<Skeleton.Card />
<Skeleton.Table />

// Loading overlay
<LoadingOverlay show={isLoading} message="Saving...">
  <YourContent />
</LoadingOverlay>
*/