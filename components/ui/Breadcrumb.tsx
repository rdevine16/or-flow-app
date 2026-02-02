'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { getBreadcrumbsFromParam, BreadcrumbItem } from '@/lib/breadcrumbs'

interface BreadcrumbProps {
  // Optional: override breadcrumbs instead of reading from URL
  items?: BreadcrumbItem[]
  // Optional: current page label (shown but not clickable)
  currentPage?: string
}

export default function Breadcrumb({ items, currentPage }: BreadcrumbProps) {
  const searchParams = useSearchParams()
  
  // Get breadcrumbs from URL param or use provided items
  const breadcrumbs = items || getBreadcrumbsFromParam(searchParams.get('from'))
  
  // Don't render if no breadcrumbs
  if (breadcrumbs.length === 0 && !currentPage) {
    return null
  }

  return (
    <nav className="flex items-center gap-1.5 text-sm" aria-label="Breadcrumb">
      {breadcrumbs.map((crumb, index) => (
        <span key={crumb.href} className="flex items-center gap-1.5">
          {index > 0 && (
            <ChevronIcon />
          )}
          <Link
            href={crumb.href}
            className="text-slate-500 hover:text-slate-900 transition-colors"
          >
            {crumb.label}
          </Link>
        </span>
      ))}
      
      {currentPage && (
        <span className="flex items-center gap-1.5">
          {breadcrumbs.length > 0 && <ChevronIcon />}
          <span className="text-slate-900 font-medium">{currentPage}</span>
        </span>
      )}
    </nav>
  )
}

function ChevronIcon() {
  return (
    <svg 
      className="w-4 h-4 text-slate-400 flex-shrink-0" 
      fill="none" 
      stroke="currentColor" 
      viewBox="0 0 24 24"
    >
      <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        strokeWidth={2} 
        d="M9 5l7 7-7 7" 
      />
    </svg>
  )
}

/**
 * Compact version with back arrow - use when space is limited
 */
export function BreadcrumbCompact({ items, currentPage }: BreadcrumbProps) {
  const searchParams = useSearchParams()
  
  const breadcrumbs = items || getBreadcrumbsFromParam(searchParams.get('from'))
  
  if (breadcrumbs.length === 0) {
    return null
  }

  // Get the last breadcrumb item (where "back" should go)
  const backTo = breadcrumbs[breadcrumbs.length - 1]

  return (
    <nav className="flex items-center gap-2 text-sm" aria-label="Breadcrumb">
      <Link
        href={backTo.href}
        className="flex items-center gap-1.5 text-slate-500 hover:text-slate-900 transition-colors"
      >
        <svg 
          className="w-4 h-4" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M15 19l-7-7 7-7" 
          />
        </svg>
        <span>
          {breadcrumbs.map(b => b.label).join(' / ')}
        </span>
      </Link>
    </nav>
  )
}

/**
 * Header-integrated version - designed to sit in the top header bar
 * Shows: ORbit logo > breadcrumb path
 */
export function HeaderBreadcrumb({ items, currentPage }: BreadcrumbProps) {
  const searchParams = useSearchParams()
  
  const breadcrumbs = items || getBreadcrumbsFromParam(searchParams.get('from'))
  
  return (
    <nav className="flex items-center gap-2 text-sm min-w-0" aria-label="Breadcrumb">
      {/* Home/Logo link */}
      <Link 
        href="/" 
        className="flex-shrink-0 text-slate-400 hover:text-slate-600 transition-colors"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      </Link>

      {/* Breadcrumb trail */}
      {breadcrumbs.length > 0 && (
        <>
          <ChevronIcon />
          {breadcrumbs.map((crumb, index) => (
            <span key={crumb.href} className="flex items-center gap-2 min-w-0">
              {index > 0 && <ChevronIcon />}
              <Link
                href={crumb.href}
                className="text-slate-500 hover:text-slate-900 transition-colors truncate"
              >
                {crumb.label}
              </Link>
            </span>
          ))}
        </>
      )}

      {/* Current page */}
      {currentPage && (
        <>
          <ChevronIcon />
          <span className="text-slate-900 font-medium truncate">{currentPage}</span>
        </>
      )}
    </nav>
  )
}
