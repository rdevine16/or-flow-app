// components/layouts/navigation-config.tsx
// Centralized navigation configuration for DashboardLayout

import { ReactNode } from 'react'
import { AlertTriangle, Ban, BarChart3, BookOpen, Box, Building2, Calculator, CalendarDays, ClipboardCheck, ClipboardList, Clock, FileText, FlaskConical, LayoutGrid, Package, Settings, ShieldCheck, User, Wrench } from 'lucide-react'

// ============================================
// Types
// ============================================

export interface NavItem {
  name: string
  href: string
  icon: ReactNode
  allowedRoles: string[]
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
  dashboard: <LayoutGrid className={iconClass} />,
  facilities: <Building2 className={iconClass} />,
  procedures: <ClipboardList className={iconClass} />,
  categories: <Package className={iconClass} />,
  milestones: <Clock className={iconClass} />,
  procedureMilestones: <ClipboardCheck className={iconClass} />,
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
  docs: <BookOpen className={iconClass} />,
  refactor: <Wrench className={iconClass} />,
  settings: <Settings className={iconClass} />,
  security: <ShieldCheck className={iconClass} />,
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
    ],
  },
  {
    id: 'configuration',
    label: 'Configuration',
    items: [
      {
        name: 'Procedures',
        href: '/admin/settings/procedures',
        icon: navIcons.procedures,
        allowedRoles: ['global_admin'],
      },
      {
        name: 'Categories',
        href: '/admin/settings/procedure-categories',
        icon: navIcons.categories,
        allowedRoles: ['global_admin'],
      },
      {
        name: 'Milestones',
        href: '/admin/settings/milestones',
        icon: navIcons.milestones,
        allowedRoles: ['global_admin'],
      },
      {
        name: 'Procedure Milestones',
        href: '/admin/settings/procedure-milestones',
        icon: navIcons.procedureMilestones,
        allowedRoles: ['global_admin'],
      },
      {
        name: 'Delay Types',
        href: '/admin/settings/delay-types',
        icon: navIcons.delays,
        allowedRoles: ['global_admin'],
      },
      {
        name: 'Cancellation Reasons',
        href: '/admin/cancellation-reasons',
        icon: navIcons.cancellations,
        allowedRoles: ['global_admin'],
      },
      {
        name: 'Complexities',
        href: '/admin/complexities',
        icon: navIcons.delays,
        allowedRoles: ['global_admin'],
      },
      {
        name: 'Body Regions',
        href: '/admin/settings/body-regions',
        icon: navIcons.bodyRegions,
        allowedRoles: ['global_admin'],
      },
      {
        name: 'Implant Companies',
        href: '/admin/settings/implant-companies',
        icon: navIcons.implants,
        allowedRoles: ['global_admin'],
      },
      {
        name: 'Checklist Templates',
        href: '/admin/checklist-templates',
        icon: navIcons.checklist,
        allowedRoles: ['global_admin'],
      },
      {
        name: 'Cost Categories',
        href: '/admin/settings/cost-categories',
        icon: navIcons.costCategories,
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
  {
    id: 'developer',
    label: 'Developer',
    items: [
      {
        name: 'Docs',
        href: '/admin/docs',
        icon: navIcons.docs,
        allowedRoles: ['global_admin'],
      },
      {
        name: 'Refactor',
        href: '/refactor',
        icon: navIcons.refactor,
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
    icon: navIcons.dashboard,
    allowedRoles: ['global_admin', 'facility_admin', 'user'],
  },
  {
    name: 'Check-In',
    href: '/checkin',
    icon: navIcons.checklist,
    allowedRoles: ['global_admin', 'facility_admin', 'user'],
  },
  {
    name: 'Block Schedule',
    href: '/block-schedule',
    icon: navIcons.calendar,
    allowedRoles: ['global_admin', 'facility_admin'],
  },
  {
    name: 'Cases',
    href: '/cases',
    icon: navIcons.cases,
    allowedRoles: ['global_admin', 'facility_admin', 'user'],
  },
  {
    name: 'SPD',
    href: '/spd',
    icon: navIcons.spd,
    allowedRoles: ['global_admin', 'facility_admin'],
  },
  {
    name: 'Analytics',
    href: '/analytics',
    icon: navIcons.analytics,
    allowedRoles: ['global_admin', 'facility_admin'],
  },
  {
    name: 'Data Quality',
    href: '/dashboard/data-quality',
    icon: navIcons.dataQuality,
    allowedRoles: ['facility_admin'],
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: navIcons.settings,
    allowedRoles: ['global_admin', 'facility_admin'],
  },
]

// ============================================
// Helpers
// ============================================

export function getFilteredNavigation(accessLevel: string): NavItem[] {
  return facilityNavigation.filter(item => item.allowedRoles.includes(accessLevel))
}

export function isNavItemActive(href: string, pathname: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard'
  if (href === '/admin') return pathname === '/admin'
  return pathname.startsWith(href)
}