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

// ============================================
// UNIFIED BREADCRUMB SYSTEM (v2)
// Route-based breadcrumb resolution
// ============================================

export interface RouteSegment {
  label: string
  href: string | null
}

export interface ResolveBreadcrumbsOptions {
  isAdmin: boolean
  facilityName: string | null
  /** Resolve settings page labels. Called for /settings/* paths not in the route map. */
  getSettingsLabel?: (pathname: string) => string | undefined
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Static route-to-breadcrumb map.
 * - Last segment has href: null (current page)
 * - [dynamic] labels get replaced by dynamicLabels from BreadcrumbContext
 * - [id] in hrefs gets replaced with the actual path segment value
 */
export const ROUTE_BREADCRUMBS: Record<string, RouteSegment[]> = {
  // Dashboard
  '/': [{ label: 'Dashboard', href: null }],
  '/dashboard': [{ label: 'Dashboard', href: null }],
  '/data-quality': [
    { label: 'Data Quality', href: null },
  ],

  // Cases
  '/cases': [{ label: 'Cases', href: null }],
  '/cases/new': [
    { label: 'Cases', href: '/cases' },
    { label: 'New Case', href: null },
  ],
  '/cases/bulk-create': [
    { label: 'Cases', href: '/cases' },
    { label: 'Bulk Create', href: null },
  ],
  '/cases/[id]': [
    { label: 'Cases', href: '/cases' },
    { label: '[dynamic]', href: null },
  ],
  '/cases/[id]/edit': [
    { label: 'Cases', href: '/cases' },
    { label: '[dynamic]', href: '/cases/[id]' },
    { label: 'Edit', href: null },
  ],
  '/cases/[id]/cancel': [
    { label: 'Cases', href: '/cases' },
    { label: '[dynamic]', href: '/cases/[id]' },
    { label: 'Cancel', href: null },
  ],

  // Analytics
  '/analytics': [{ label: 'Analytics', href: null }],
  '/analytics/surgeons': [
    { label: 'Analytics', href: '/analytics' },
    { label: 'Surgeon Performance', href: null },
  ],
  '/analytics/block-utilization': [
    { label: 'Analytics', href: '/analytics' },
    { label: 'Block & Room Utilization', href: null },
  ],
  '/analytics/financials': [
    { label: 'Analytics', href: '/analytics' },
    { label: 'Financial Analytics', href: null },
  ],
  '/analytics/orbit-score': [
    { label: 'Analytics', href: '/analytics' },
    { label: 'ORbit Score', href: null },
  ],
  '/analytics/flags': [
    { label: 'Analytics', href: '/analytics' },
    { label: 'Flags', href: null },
  ],
  '/analytics/kpi': [
    { label: 'Analytics', href: '/analytics' },
    { label: 'KPI Dashboard', href: null },
  ],

  // Flat pages
  '/rooms': [{ label: 'Rooms', href: null }],
  '/block-schedule': [{ label: 'Block Schedule', href: null }],
  '/checkin': [{ label: 'Check-In', href: null }],
  '/spd': [{ label: 'SPD', href: null }],
  '/profile': [{ label: 'Profile', href: null }],

  // Settings (deeper paths handled by getSettingsLabel fallback)
  '/settings': [{ label: 'Settings', href: null }],

  // Admin routes
  '/admin': [{ label: 'Admin', href: null }],
  '/admin/facilities': [
    { label: 'Admin', href: '/admin' },
    { label: 'Facilities', href: null },
  ],
  '/admin/facilities/new': [
    { label: 'Admin', href: '/admin' },
    { label: 'Facilities', href: '/admin/facilities' },
    { label: 'New Facility', href: null },
  ],
  '/admin/facilities/[id]': [
    { label: 'Admin', href: '/admin' },
    { label: 'Facilities', href: '/admin/facilities' },
    { label: '[dynamic]', href: null },
  ],
  '/admin/audit-log': [
    { label: 'Admin', href: '/admin' },
    { label: 'Audit Log', href: null },
  ],
  '/admin/cancellation-reasons': [
    { label: 'Admin', href: '/admin' },
    { label: 'Cancellation Reasons', href: null },
  ],
  '/admin/checklist-templates': [
    { label: 'Admin', href: '/admin' },
    { label: 'Checklist Templates', href: null },
  ],
  '/admin/complexities': [
    { label: 'Admin', href: '/admin' },
    { label: 'Complexities', href: null },
  ],
  '/admin/demo': [
    { label: 'Admin', href: '/admin' },
    { label: 'Demo', href: null },
  ],
  '/admin/docs': [
    { label: 'Admin', href: '/admin' },
    { label: 'Docs', href: null },
  ],
  '/admin/global-security': [
    { label: 'Admin', href: '/admin' },
    { label: 'Global Security', href: null },
  ],
  '/admin/permission-templates': [
    { label: 'Admin', href: '/admin' },
    { label: 'Permission Templates', href: null },
  ],
  '/admin/settings/body-regions': [
    { label: 'Admin', href: '/admin' },
    { label: 'Settings', href: null },
    { label: 'Body Regions', href: null },
  ],
  '/admin/settings/cost-categories': [
    { label: 'Admin', href: '/admin' },
    { label: 'Settings', href: null },
    { label: 'Cost Categories', href: null },
  ],
  '/admin/settings/delay-types': [
    { label: 'Admin', href: '/admin' },
    { label: 'Settings', href: null },
    { label: 'Delay Types', href: null },
  ],
  '/admin/settings/implant-companies': [
    { label: 'Admin', href: '/admin' },
    { label: 'Settings', href: null },
    { label: 'Implant Companies', href: null },
  ],
  '/admin/settings/milestones': [
    { label: 'Admin', href: '/admin' },
    { label: 'Settings', href: null },
    { label: 'Milestones', href: null },
  ],
  '/admin/settings/procedure-categories': [
    { label: 'Admin', href: '/admin' },
    { label: 'Settings', href: null },
    { label: 'Procedure Categories', href: null },
  ],
  '/admin/settings/procedures': [
    { label: 'Admin', href: '/admin' },
    { label: 'Settings', href: null },
    { label: 'Procedures', href: null },
  ],
}

/** Replace UUID-like path segments with [id] placeholder */
function toTemplatePath(pathname: string): { templatePath: string; idValue: string | null } {
  const parts = pathname.split('/')
  let idValue: string | null = null
  const templateParts = parts.map(part => {
    if (UUID_REGEX.test(part)) {
      idValue = part
      return '[id]'
    }
    return part
  })
  return { templatePath: templateParts.join('/'), idValue }
}

/** Extract the dynamic label key from a template path (e.g., '/cases/[id]' from '/cases/[id]/edit') */
function extractDynamicKey(templatePath: string): string | null {
  const idx = templatePath.indexOf('[id]')
  if (idx === -1) return null
  return templatePath.substring(0, idx + 4)
}

/**
 * Resolve breadcrumb segments for a given pathname.
 *
 * Resolution order:
 * 1. Exact match in ROUTE_BREADCRUMBS
 * 2. Dynamic segment substitution (UUID → [id])
 * 3. Settings fallback via getSettingsLabel option
 * 4. Longest-prefix fallback
 */
export function resolveBreadcrumbs(
  pathname: string,
  dynamicLabels: Map<string, string>,
  options: ResolveBreadcrumbsOptions
): RouteSegment[] {
  let segments: RouteSegment[] | undefined
  let templatePath = pathname
  let idValue: string | null = null

  // 1. Exact match
  segments = ROUTE_BREADCRUMBS[pathname]

  // 2. Dynamic segment substitution
  if (!segments) {
    const result = toTemplatePath(pathname)
    templatePath = result.templatePath
    idValue = result.idValue
    segments = ROUTE_BREADCRUMBS[templatePath]
  }

  // 3. Settings fallback
  if (!segments && pathname.startsWith('/settings/') && options.getSettingsLabel) {
    const label = options.getSettingsLabel(pathname)
    if (label) {
      segments = [
        { label: 'Settings', href: '/settings' },
        { label, href: null },
      ]
    }
  }

  // 4. Longest-prefix fallback
  if (!segments) {
    const parts = pathname.split('/')
    for (let len = parts.length - 1; len > 0; len--) {
      const prefix = parts.slice(0, len).join('/') || '/'
      if (ROUTE_BREADCRUMBS[prefix]) {
        segments = ROUTE_BREADCRUMBS[prefix]
        break
      }
      const { templatePath: tp } = toTemplatePath(prefix)
      if (ROUTE_BREADCRUMBS[tp]) {
        segments = ROUTE_BREADCRUMBS[tp]
        break
      }
    }
  }

  if (!segments) return []

  // Deep clone to avoid mutating the map
  const result = segments.map(s => ({ ...s }))

  // Replace [dynamic] labels and [id] in hrefs
  const dynamicKey = extractDynamicKey(templatePath)
  for (const seg of result) {
    if (seg.label === '[dynamic]') {
      seg.label = (dynamicKey ? dynamicLabels.get(dynamicKey) : undefined) ?? 'Loading...'
    }
    if (seg.href && idValue) {
      seg.href = seg.href.replace('[id]', idValue)
    }
  }

  // Prepend facility segment for non-admin routes
  if (!options.isAdmin && options.facilityName) {
    result.unshift({ label: options.facilityName, href: '/' })
  }

  return result
}
