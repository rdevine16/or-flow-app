'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { getBreadcrumbsFromParam, BreadcrumbItem } from '@/lib/breadcrumbs'
import { ChevronLeft, ChevronRight, Home } from 'lucide-react'

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
    <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
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
        <ChevronLeft className="w-4 h-4" />
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
        <Home className="w-5 h-5" />
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
