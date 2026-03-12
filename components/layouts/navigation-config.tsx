// components/layouts/navigation-config.tsx
// Centralized navigation configuration for DashboardLayout

import { ReactNode } from 'react'
import { AlertTriangle, Ban, BarChart3, Bell, Box, Building2, Calculator, CalendarDays, ClipboardCheck, ClipboardList, Clock, CreditCard, Database, FileText, Flag, FlaskConical, Home, KeyRound, LayoutGrid, Package, Plug, Settings, ShieldCheck, User, UserCog } from 'lucide-react'
import type { TierSlug } from '@/lib/tier-config'

// ============================================
// Types
// ============================================

export interface NavItem {
  name: string
  href: string
  icon: ReactNode
  allowedRoles: string[]
  /** Permission key for can() gating. When set, takes precedence over allowedRoles. */
  permission?: string
  /** Minimum subscription tier required. Item shows as locked if user's tier is lower. */
  requiredTier?: TierSlug
}

export interface NavGroup {
  id: string
  label: string
  items: NavItem[]
}

export interface SubNavItem {
  id: string
  label: string
  href: string
  icon?: ReactNode
}

// ============================================
// Sidebar Width Constants
// ============================================

export const SIDEBAR_COLLAPSED = 64
export const SIDEBAR_EXPANDED = 240
export const SUBNAV_WIDTH = 256

// ============================================
// Icons
// ============================================

// Reusable icon size for nav consistency
const iconClass = "w-5 h-5"

export const navIcons = {
  home: <Home className={iconClass} />,
  dashboard: <LayoutGrid className={iconClass} />,
  facilities: <Building2 className={iconClass} />,
  procedures: <ClipboardList className={iconClass} />,
  categories: <Package className={iconClass} />,
  milestones: <Clock className={iconClass} />,
  delays: <AlertTriangle className={iconClass} />,
  implants: <FlaskConical className={iconClass} />,
  bodyRegions: <User className={iconClass} />,
  auditLog: <FileText className={iconClass} />,
  costCategories: <Calculator className={iconClass} />,
  checklist: <ClipboardCheck className={iconClass} />,
  cancellations: <Ban className={iconClass} />,
  cases: <ClipboardList className={iconClass} />,
  calendar: <CalendarDays className={iconClass} />,
  spd: <Box className={iconClass} />,
  analytics: <BarChart3 className={iconClass} />,
  dataQuality: <ShieldCheck className={iconClass} />,
  settings: <Settings className={iconClass} />,
  security: <ShieldCheck className={iconClass} />,
  permissionTemplates: <KeyRound className={iconClass} />,
  flags: <Flag className={iconClass} />,
  payers: <CreditCard className={iconClass} />,
  notifications: <Bell className={iconClass} />,
  demoGenerator: <Database className={iconClass} />,
  integrations: <Plug className={iconClass} />,
  staffManagement: <UserCog className={iconClass} />,
}

// ============================================
// Admin Navigation Groups (Global Admin only)
// ============================================

export const adminNavGroups: NavGroup[] = [
  {
    id: 'overview',
    label: 'Overview',
    items: [
      {
        name: 'Dashboard',
        href: '/admin',
        icon: navIcons.dashboard,
        allowedRoles: ['global_admin'],
      },
    ],
  },
  {
    id: 'management',
    label: 'Management',
    items: [
      {
        name: 'Facilities',
        href: '/admin/facilities',
        icon: navIcons.facilities,
        allowedRoles: ['global_admin'],
      },
      {
        name: 'Demo Generator',
        href: '/admin/demo',
        icon: navIcons.demoGenerator,
        allowedRoles: ['global_admin'],
      },
      {
        name: 'HL7v2 Test Harness',
        href: '/admin/settings/hl7v2-test-harness',
        icon: navIcons.integrations,
        allowedRoles: ['global_admin'],
      },
    ],
  },
  {
    id: 'configuration',
    label: 'Configuration',
    items: [
      {
        name: 'Configuration',
        href: '/admin/configuration',
        icon: navIcons.settings,
        allowedRoles: ['global_admin'],
      },
    ],
  },
  {
    id: 'compliance',
    label: 'Compliance',
    items: [
      {
        name: 'Audit Log',
        href: '/admin/audit-log',
        icon: navIcons.auditLog,
        allowedRoles: ['global_admin'],
      },
           {
        name: 'Global Security',        // ← ADD THIS
        href: '/admin/global-security',
        icon: navIcons.security,
        allowedRoles: ['global_admin'],
      },
    ],
  },
]

// ============================================
// Facility Navigation (all users)
// ============================================

export const facilityNavigation: NavItem[] = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: navIcons.home,
    allowedRoles: ['global_admin', 'facility_admin', 'coordinator', 'user'],
  },
  {
    name: 'Rooms',
    href: '/rooms',
    icon: navIcons.dashboard,
    allowedRoles: ['global_admin', 'facility_admin', 'coordinator', 'user'],
  },
  // Check-In hidden — not production-ready
  // {
  //   name: 'Check-In',
  //   href: '/checkin',
  //   icon: navIcons.checklist,
  //   allowedRoles: ['global_admin', 'facility_admin', 'coordinator', 'user'],
  // },
  {
    name: 'Block Schedule',
    href: '/block-schedule',
    icon: navIcons.calendar,
    allowedRoles: ['global_admin', 'facility_admin', 'coordinator', 'user'],
    permission: 'scheduling.view',
  },
  {
    name: 'Cases',
    href: '/cases',
    icon: navIcons.cases,
    allowedRoles: ['global_admin', 'facility_admin', 'coordinator', 'user'],
    permission: 'cases.view',
  },
  {
    name: 'SPD',
    href: '/spd',
    icon: navIcons.spd,
    allowedRoles: ['global_admin', 'facility_admin'],
    requiredTier: 'professional',
  },
  {
    name: 'Analytics',
    href: '/analytics',
    icon: navIcons.analytics,
    allowedRoles: ['global_admin', 'facility_admin', 'coordinator', 'user'],
    permission: 'analytics.view',
    requiredTier: 'professional',
  },
  {
    name: 'Data Quality',
    href: '/data-quality',
    icon: navIcons.dataQuality,
    allowedRoles: ['global_admin', 'facility_admin'],
    requiredTier: 'professional',
  },
  {
    name: 'Staff Management',
    href: '/staff-management',
    icon: navIcons.staffManagement,
    allowedRoles: ['global_admin', 'facility_admin'],
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: navIcons.settings,
    allowedRoles: ['global_admin', 'facility_admin', 'coordinator', 'user'],
    permission: 'settings.view',
  },
]

// ============================================
// Helpers
// ============================================

export function getFilteredNavigation(
  accessLevel: string,
  can?: (key: string) => boolean,
): NavItem[] {
  return facilityNavigation.filter(item => {
    // If a permission key is set and can() is provided, use permission gating
    if (item.permission && can) return can(item.permission)
    // Fallback to role-based filtering
    return item.allowedRoles.includes(accessLevel)
  })
  // Note: tier-locked items are NOT filtered out here.
  // They remain in the list and are rendered as locked in the Sidebar.
  // The NavLink component checks requiredTier and renders the locked state.
}

export function isNavItemActive(href: string, pathname: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard' || pathname.startsWith('/dashboard/')
  if (href === '/rooms') return pathname === '/rooms'
  if (href === '/admin') return pathname === '/admin'
  return pathname.startsWith(href)
}