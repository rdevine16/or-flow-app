// ============================================
// BREADCRUMB SYSTEM
// ============================================

export interface BreadcrumbItem {
  label: string
  href: string
}

// Map of "from" param values to breadcrumb trails
export const BREADCRUMB_MAP: Record<string, BreadcrumbItem[]> = {
  // Dashboard
  'dashboard': [
    { label: 'Dashboard', href: '/' },
  ],

  // Cases
  'cases': [
    { label: 'Cases', href: '/cases' },
  ],

  // Analytics - Overview
  'analytics-overview': [
    { label: 'Analytics', href: '/analytics' },
    { label: 'Overview', href: '/analytics' },
  ],

  // Analytics - Surgeon Analysis
  'analytics-surgeons': [
    { label: 'Analytics', href: '/analytics' },
    { label: 'Surgeon Analysis', href: '/analytics/surgeons' },
  ],

  // Analytics - Compare Surgeons
  'analytics-compare': [
    { label: 'Analytics', href: '/analytics' },
    { label: 'Compare Surgeons', href: '/analytics/compare' },
  ],

  // Analytics - Procedures
  'analytics-procedures': [
    { label: 'Analytics', href: '/analytics' },
    { label: 'Procedures', href: '/analytics/procedures' },
  ],

  // Analytics - Room Utilization
  'analytics-rooms': [
    { label: 'Analytics', href: '/analytics' },
    { label: 'Room Utilization', href: '/analytics/rooms' },
  ],

  // Analytics - Financials
  'analytics-financials': [
    { label: 'Analytics', href: '/analytics' },
    { label: 'Financials', href: '/analytics/financials' },
  ],
  'analytics-financials-overview': [
    { label: 'Analytics', href: '/analytics' },
    { label: 'Financials', href: '/analytics/financials' },
    { label: 'Overview', href: '/analytics/financials?tab=overview' },
  ],
  'analytics-financials-procedure': [
    { label: 'Analytics', href: '/analytics' },
    { label: 'Financials', href: '/analytics/financials' },
    { label: 'By Procedure', href: '/analytics/financials?tab=procedure' },
  ],
  'analytics-financials-surgeon': [
    { label: 'Analytics', href: '/analytics' },
    { label: 'Financials', href: '/analytics/financials' },
    { label: 'By Surgeon', href: '/analytics/financials?tab=surgeon' },
  ],
  'analytics-financials-outliers': [
    { label: 'Analytics', href: '/analytics' },
    { label: 'Financials', href: '/analytics/financials' },
    { label: 'Outliers', href: '/analytics/financials?tab=outliers' },
  ],

  // Settings
  'settings': [
    { label: 'Settings', href: '/settings' },
  ],
  'settings-facility': [
    { label: 'Settings', href: '/settings' },
    { label: 'Facility', href: '/settings/facility' },
  ],
  'settings-users': [
    { label: 'Settings', href: '/settings' },
    { label: 'Users', href: '/settings/users' },
  ],
  'settings-financials': [
    { label: 'Settings', href: '/settings' },
    { label: 'Financials', href: '/settings/financials' },
  ],

  // Admin
  'admin-facilities': [
    { label: 'Admin', href: '/admin' },
    { label: 'Facilities', href: '/admin/facilities' },
  ],
  'admin-users': [
    { label: 'Admin', href: '/admin' },
    { label: 'Users', href: '/admin/users' },
  ],
}

/**
 * Get breadcrumb items from the "from" query parameter
 */
export function getBreadcrumbsFromParam(from: string | null): BreadcrumbItem[] {
  if (!from) return []
  return BREADCRUMB_MAP[from] || []
}

/**
 * Build the "from" parameter for a link based on current location
 */
export function buildFromParam(path: string, tab?: string): string {
  // Remove leading slash and convert to breadcrumb key format
  const cleanPath = path.replace(/^\//, '').replace(/\//g, '-')
  
  if (tab) {
    return `${cleanPath}-${tab}`
  }
  
  return cleanPath || 'dashboard'
}

/**
 * Build a URL with the "from" parameter
 */
export function buildDrillDownUrl(
  targetPath: string, 
  fromPath: string, 
  fromTab?: string
): string {
  const from = buildFromParam(fromPath, fromTab)
  const separator = targetPath.includes('?') ? '&' : '?'
  return `${targetPath}${separator}from=${from}`
}

/**
 * Helper to get "from" param from URL search params
 */
export function getFromParam(searchParams: URLSearchParams | { get: (key: string) => string | null }): string | null {
  return searchParams.get('from')
}
