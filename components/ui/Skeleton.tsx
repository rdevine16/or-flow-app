// components/ui/Skeleton.tsx
// Professional skeleton loading placeholders

'use client'

interface SkeletonProps {
  className?: string
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
}

export function Skeleton({ className = '', rounded = 'md' }: SkeletonProps) {
  const roundedClasses = {
    sm: 'rounded',
    md: 'rounded-md',
    lg: 'rounded-lg',
    xl: 'rounded-xl',
    full: 'rounded-full',
  }

  return (
    <div 
      className={`animate-pulse bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 bg-[length:200%_100%] ${roundedClasses[rounded]} ${className}`}
      style={{
        animation: 'shimmer 1.5s ease-in-out infinite',
      }}
    />
  )
}

// Add shimmer keyframes to your globals.css:
// @keyframes shimmer {
//   0% { background-position: 200% 0; }
//   100% { background-position: -200% 0; }
// }

// Pre-built skeleton components for common patterns

export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton 
          key={i} 
          className={`h-4 ${i === lines - 1 ? 'w-3/4' : 'w-full'}`}
        />
      ))}
    </div>
  )
}

export function SkeletonMetricCard() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
      <Skeleton className="h-4 w-24 mb-3" />
      <Skeleton className="h-9 w-20 mb-2" />
      <Skeleton className="h-3 w-16" />
    </div>
  )
}

export function SkeletonMetricGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonMetricCard key={i} />
      ))}
    </div>
  )
}

export function SkeletonTableRow({ columns = 5 }: { columns?: number }) {
  return (
    <tr className="border-b border-slate-100">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className={`h-4 ${i === 0 ? 'w-24' : i === columns - 1 ? 'w-16' : 'w-full'}`} />
        </td>
      ))}
    </tr>
  )
}

export function SkeletonTable({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-3">
        <div className="flex gap-4">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1" />
          ))}
        </div>
      </div>
      {/* Rows */}
      <table className="w-full">
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <SkeletonTableRow key={i} columns={columns} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function SkeletonCaseCard() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <div className="flex items-center gap-4">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-20" />
      </div>
    </div>
  )
}

export function SkeletonCaseList({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCaseCard key={i} />
      ))}
    </div>
  )
}

export function SkeletonChart({ height = 300 }: { height?: number }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>
      <div style={{ height }} className="flex items-end gap-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="flex-1 flex flex-col justify-end">
            <Skeleton 
              className="w-full" 
              style={{ height: `${Math.random() * 60 + 20}%` }}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-8" />
        ))}
      </div>
    </div>
  )
}

export function SkeletonProfile() {
  return (
    <div className="flex items-center gap-4">
      <Skeleton className="w-12 h-12" rounded="xl" />
      <div className="space-y-2">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-24" />
      </div>
    </div>
  )
}

export function SkeletonPage() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10" rounded="xl" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <Skeleton className="h-10 w-28 rounded-xl" />
      </div>

      {/* Metric cards */}
      <SkeletonMetricGrid count={4} />

      {/* Chart */}
      <SkeletonChart />

      {/* Table */}
      <SkeletonTable rows={5} columns={5} />
    </div>
  )
}

// Empty state component
interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
  }
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4 text-slate-400">
        {icon || (
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
        )}
      </div>
      <h3 className="text-lg font-semibold text-slate-900 mb-1">{title}</h3>
      <p className="text-sm text-slate-500 text-center max-w-sm mb-4">{description}</p>
      {action && (
        <button 
          onClick={action.onClick}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors shadow-sm shadow-blue-500/20"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}

// Error state component
interface ErrorStateProps {
  title?: string
  description?: string
  onRetry?: () => void
}

export function ErrorState({ 
  title = 'Something went wrong', 
  description = 'We encountered an error loading this content.',
  onRetry 
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mb-4 text-red-500">
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-slate-900 mb-1">{title}</h3>
      <p className="text-sm text-slate-500 text-center max-w-sm mb-4">{description}</p>
      {onRetry && (
        <button 
          onClick={onRetry}
          className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-xl hover:bg-slate-800 transition-colors"
        >
          Try Again
        </button>
      )}
    </div>
  )
}
