'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { buildFromParam } from '@/lib/breadcrumbs'
import { ReactNode } from 'react'

interface DrillDownLinkProps {
  /** Target URL (e.g., /cases/abc123) */
  href: string
  /** Current tab if within a tabbed view (e.g., "outliers") */
  fromTab?: string
  /** Override the automatic "from" path detection */
  fromPath?: string
  /** Link content */
  children: ReactNode
  /** Additional CSS classes */
  className?: string
  /** Any other props to pass to Link */
  [key: string]: any
}

/**
 * A Link component that automatically adds the "from" breadcrumb parameter
 * based on the current page location.
 * 
 * Usage:
 * <DrillDownLink href={`/cases/${caseId}`} fromTab="outliers">
 *   View Case
 * </DrillDownLink>
 */
export default function DrillDownLink({
  href,
  fromTab,
  fromPath,
  children,
  className,
  ...props
}: DrillDownLinkProps) {
  const pathname = usePathname()
  
  // Build the "from" parameter
  const from = buildFromParam(fromPath || pathname, fromTab)
  
  // Add "from" to the URL
  const separator = href.includes('?') ? '&' : '?'
  const urlWithFrom = `${href}${separator}from=${from}`
  
  return (
    <Link href={urlWithFrom} className={className} {...props}>
      {children}
    </Link>
  )
}

/**
 * Hook to get a URL builder function for drill-down links
 * Useful when you need the URL string directly (not a component)
 * 
 * Usage:
 * const buildUrl = useDrillDownUrl('outliers')
 * const url = buildUrl(`/cases/${caseId}`)
 */
export function useDrillDownUrl(fromTab?: string) {
  const pathname = usePathname()
  
  return (targetHref: string, overrideFromPath?: string) => {
    const from = buildFromParam(overrideFromPath || pathname, fromTab)
    const separator = targetHref.includes('?') ? '&' : '?'
    return `${targetHref}${separator}from=${from}`
  }
}
