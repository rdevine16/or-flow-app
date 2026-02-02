// components/ui/Loading.tsx
// Standardized loading states for ORbit
//
// Usage:
//   import { Spinner, PageLoader, Skeleton, SkeletonCard } from '@/components/ui/Loading'

import { ReactNode } from 'react'

// ============================================
// Spinner - Consistent loading spinner
// ============================================

type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

interface SpinnerProps {
  size?: SpinnerSize
  className?: string
  color?: 'blue' | 'white' | 'slate' | 'teal'
}

const spinnerSizes: Record<SpinnerSize, string> = {
  xs: 'h-3 w-3 border',
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-8 w-8 border-2',
  xl: 'h-12 w-12 border-3',
}

const spinnerColors = {
  blue: 'border-blue-600 border-t-transparent',
  white: 'border-white border-t-transparent',
  slate: 'border-slate-400 border-t-transparent',
  teal: 'border-teal-500 border-t-transparent',
}

export function Spinner({ size = 'md', color = 'blue', className = '' }: SpinnerProps) {
  return (
    <div
      className={`
        ${spinnerSizes[size]}
        ${spinnerColors[color]}
        rounded-full animate-spin
        ${className}
      `}
      role="status"
      aria-label="Loading"
    />
  )
}

// ============================================
// PageLoader - Full page centered loading
// ============================================

interface PageLoaderProps {
  message?: string
  size?: SpinnerSize
}

export function PageLoader({ message = 'Loading...', size = 'lg' }: PageLoaderProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] py-12">
      <Spinner size={size} />
      {message && (
        <p className="mt-4 text-sm text-slate-500">{message}</p>
      )}
    </div>
  )
}

// ============================================
// InlineLoader - For inline loading states
// ============================================

interface InlineLoaderProps {
  message?: string
  size?: SpinnerSize
}

export function InlineLoader({ message, size = 'sm' }: InlineLoaderProps) {
  return (
    <span className="inline-flex items-center gap-2 text-slate-500">
      <Spinner size={size} />
      {message && <span className="text-sm">{message}</span>}
    </span>
  )
}

// ============================================
// LoadingOverlay - Overlay for forms/modals
// ============================================

interface LoadingOverlayProps {
  show: boolean
  message?: string
}

export function LoadingOverlay({ show, message }: LoadingOverlayProps) {
  if (!show) return null

  return (
    <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
      <div className="flex flex-col items-center">
        <Spinner size="lg" />
        {message && (
          <p className="mt-3 text-sm text-slate-600">{message}</p>
        )}
      </div>
    </div>
  )
}

// ============================================
// ButtonLoader - For button loading states
// ============================================

interface ButtonLoaderProps {
  loading: boolean
  children: ReactNode
  loadingText?: string
}

export function ButtonLoader({ loading, children, loadingText }: ButtonLoaderProps) {
  if (!loading) return <>{children}</>

  return (
    <span className="inline-flex items-center gap-2">
      <Spinner size="xs" color="white" />
      {loadingText || children}
    </span>
  )
}

// ============================================
// Skeleton - Base skeleton building blocks
// ============================================

interface SkeletonProps {
  className?: string
}

// Base skeleton element
export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div className={`bg-slate-200 animate-pulse rounded ${className}`} />
  )
}

// Text line skeleton
export function SkeletonText({ lines = 1, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={`h-4 ${i === lines - 1 && lines > 1 ? 'w-3/4' : 'w-full'}`}
        />
      ))}
    </div>
  )
}

// Circle skeleton (for avatars)
export function SkeletonCircle({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12',
  }
  return <Skeleton className={`${sizes[size]} rounded-full`} />
}

// ============================================
// SkeletonCard - Common card loading state
// ============================================

interface SkeletonCardProps {
  hasHeader?: boolean
  lines?: number
  className?: string
}

export function SkeletonCard({ hasHeader = true, lines = 3, className = '' }: SkeletonCardProps) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 overflow-hidden ${className}`}>
      {hasHeader && (
        <div className="px-6 py-4 border-b border-slate-200">
          <Skeleton className="h-5 w-32" />
        </div>
      )}
      <div className="p-6 space-y-4">
        <SkeletonText lines={lines} />
      </div>
    </div>
  )
}

// ============================================
// SkeletonTable - Table loading state
// ============================================

interface SkeletonTableProps {
  rows?: number
  columns?: number
}

export function SkeletonTable({ rows = 5, columns = 4 }: SkeletonTableProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-3 border-b border-slate-200 bg-slate-50">
        <div className="flex gap-4">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1" />
          ))}
        </div>
      </div>
      {/* Rows */}
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="px-6 py-4">
            <div className="flex gap-4 items-center">
              {Array.from({ length: columns }).map((_, colIndex) => (
                <Skeleton
                  key={colIndex}
                  className={`h-4 flex-1 ${colIndex === 0 ? 'max-w-[200px]' : ''}`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================
// SkeletonList - List loading state
// ============================================

interface SkeletonListProps {
  items?: number
  hasAvatar?: boolean
}

export function SkeletonList({ items = 5, hasAvatar = false }: SkeletonListProps) {
  return (
    <div className="space-y-3">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-4 bg-white rounded-lg border border-slate-200">
          {hasAvatar && <SkeletonCircle size="md" />}
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </div>
  )
}

// ============================================
// SkeletonStats - Stats grid loading state
// ============================================

interface SkeletonStatsProps {
  count?: number
}

export function SkeletonStats({ count = 4 }: SkeletonStatsProps) {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-${count} gap-4`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-slate-200 p-4">
          <Skeleton className="h-4 w-20 mb-2" />
          <Skeleton className="h-8 w-16" />
        </div>
      ))}
    </div>
  )
}

// ============================================
// SkeletonForm - Form loading state
// ============================================

interface SkeletonFormProps {
  fields?: number
}

export function SkeletonForm({ fields = 4 }: SkeletonFormProps) {
  return (
    <div className="space-y-6">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
      <div className="flex justify-end gap-3 pt-4">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
      </div>
    </div>
  )
}

// ============================================
// DashboardSkeleton - Full dashboard loading
// ============================================

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats row */}
      <SkeletonStats count={4} />
      
      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SkeletonCard lines={5} />
        <SkeletonCard lines={5} />
      </div>
      
      {/* Table */}
      <SkeletonTable rows={5} columns={5} />
    </div>
  )
}
