// components/layouts/navigation-config.tsx
// Centralized navigation configuration for DashboardLayout

import { ReactNode } from 'react'

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

// Reusable icon wrapper for consistent sizing
const Icon = ({ children }: { children: ReactNode }) => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    {children}
  </svg>
)

export const navIcons = {
  dashboard: (
    <Icon>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
    </Icon>
  ),
  facilities: (
    <Icon>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </Icon>
  ),
  procedures: (
    <Icon>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </Icon>
  ),
  categories: (
    <Icon>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </Icon>
  ),
  milestones: (
    <Icon>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </Icon>
  ),
  procedureMilestones: (
    <Icon>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </Icon>
  ),
  delays: (
    <Icon>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </Icon>
  ),
  implants: (
    <Icon>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
    </Icon>
  ),
  bodyRegions: (
    <Icon>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </Icon>
  ),
  auditLog: (
    <Icon>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </Icon>
  ),
  costCategories: (
    <Icon>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </Icon>
  ),
  checklist: (
    <Icon>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </Icon>
  ),
  cancellations: (
    <Icon>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
    </Icon>
  ),
  cases: (
    <Icon>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </Icon>
  ),
  calendar: (
    <Icon>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </Icon>
  ),
  spd: (
    <Icon>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </Icon>
  ),
  analytics: (
    <Icon>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </Icon>
  ),
  dataQuality: (
    <Icon>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </Icon>
  ),
  settings: (
    <Icon>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </Icon>
  ),
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