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
// Skeleton Components
// ============================================

interface SkeletonProps {
  className?: string
}

function SkeletonBase({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-slate-200 rounded ${className}`}
      role="status"
      aria-label="Loading content"
    />
  )
}

export const Skeleton = {
  // Text line
  Line: ({ className = '' }: SkeletonProps) => (
    <SkeletonBase className={`h-4 ${className}`} />
  ),

  // Text paragraph (3 lines)
  Text: ({ className = '' }: SkeletonProps) => (
    <div className={`space-y-2 ${className}`}>
      <SkeletonBase className="h-4 w-full" />
      <SkeletonBase className="h-4 w-5/6" />
      <SkeletonBase className="h-4 w-4/6" />
    </div>
  ),

  // Title
  Title: ({ className = '' }: SkeletonProps) => (
    <SkeletonBase className={`h-8 w-1/3 ${className}`} />
  ),

  // Avatar/Circle
  Avatar: ({ className = '' }: SkeletonProps) => (
    <SkeletonBase className={`h-10 w-10 rounded-full ${className}`} />
  ),

  // Button
  Button: ({ className = '' }: SkeletonProps) => (
    <SkeletonBase className={`h-10 w-24 ${className}`} />
  ),

  // Card
  Card: ({ className = '' }: SkeletonProps) => (
    <div className={`bg-white border border-slate-200 rounded-lg p-6 ${className}`}>
      <div className="flex items-center gap-4 mb-4">
        <SkeletonBase className="h-10 w-10 rounded-full" />
        <div className="flex-1">
          <SkeletonBase className="h-4 w-1/3 mb-2" />
          <SkeletonBase className="h-3 w-1/2" />
        </div>
      </div>
      <div className="space-y-2">
        <SkeletonBase className="h-4 w-full" />
        <SkeletonBase className="h-4 w-5/6" />
        <SkeletonBase className="h-4 w-4/6" />
      </div>
    </div>
  ),

  // Table Row
  TableRow: ({ className = '' }: SkeletonProps) => (
    <div className={`flex items-center gap-4 py-3 ${className}`}>
      <SkeletonBase className="h-4 w-1/4" />
      <SkeletonBase className="h-4 w-1/4" />
      <SkeletonBase className="h-4 w-1/4" />
      <SkeletonBase className="h-4 w-1/4" />
    </div>
  ),

  // Table (5 rows)
  Table: ({ className = '' }: SkeletonProps) => (
    <div className={`bg-white border border-slate-200 rounded-lg overflow-hidden ${className}`}>
      <div className="border-b border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center gap-4">
          <SkeletonBase className="h-4 w-1/4" />
          <SkeletonBase className="h-4 w-1/4" />
          <SkeletonBase className="h-4 w-1/4" />
          <SkeletonBase className="h-4 w-1/4" />
        </div>
      </div>
      <div className="divide-y divide-slate-100">
        {[...Array(5)].map((_, i) => (
          <Skeleton.TableRow key={i} className="px-4" />
        ))}
      </div>
    </div>
  ),

  // Input Field
  Input: ({ className = '' }: SkeletonProps) => (
    <div className={className}>
      <SkeletonBase className="h-4 w-24 mb-2" />
      <SkeletonBase className="h-10 w-full" />
    </div>
  ),

  // Form (3 fields + button)
  Form: ({ className = '' }: SkeletonProps) => (
    <div className={`space-y-4 ${className}`}>
      <Skeleton.Input />
      <Skeleton.Input />
      <Skeleton.Input />
      <SkeletonBase className="h-10 w-32 mt-6" />
    </div>
  ),
}

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
