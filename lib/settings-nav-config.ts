// lib/settings-nav-config.ts
// Single source of truth for all settings navigation.
// Imported by SettingsTabLayout, SettingsLanding, and any future settings components.

import { type LucideIcon } from 'lucide-react'
import {
  AlertTriangle,
  Ban,
  BarChart3,
  Bell,
  Building2,
  Calculator,
  ClipboardCheck,
  ClipboardList,
  Clock,
  CreditCard,
  DollarSign,
  FileText,
  Flag,
  FlaskConical,
  KeyRound,
  Layers,
  LayoutGrid,
  Puzzle,
  Tag,
  User,
  Users,
  Zap,
} from 'lucide-react'

// =====================================================
// TYPES
// =====================================================

export type BadgeType = 'new' | 'admin' | 'soon'

export interface SettingsNavItem {
  id: string
  label: string
  href: string
  icon: LucideIcon
  description: string
  badge?: BadgeType
  /** Permission key for can() gating. Takes precedence over requiredAccess. */
  permission?: string
}

export interface SettingsCategory {
  id: string
  label: string
  /** Abbreviated label for the horizontal tab bar */
  tabLabel: string
  items: SettingsNavItem[]
}

// =====================================================
// SETTINGS CATEGORIES (8 tabs, 28 items)
// =====================================================

export const settingsCategories: SettingsCategory[] = [
  {
    id: 'general',
    label: 'General',
    tabLabel: 'General',
    items: [
      {
        id: 'overview',
        label: 'Overview',
        href: '/settings/general',
        icon: Building2,
        description: 'Facility details and account info',
      },
      {
        id: 'notifications',
        label: 'Notifications',
        href: '/settings/notifications',
        icon: Bell,
        description: 'Configure alert preferences',
        badge: 'soon',
        permission: 'settings.manage',
      },
      {
        id: 'subscription',
        label: 'Subscription',
        href: '/settings/subscription',
        icon: CreditCard,
        description: 'Plan, usage, and billing',
        badge: 'soon',
        permission: 'settings.manage',
      },
    ],
  },
  {
    id: 'checkin',
    label: 'Patient Check-In',
    tabLabel: 'Check-In',
    items: [
      {
        id: 'checkin-settings',
        label: 'Arrival Settings',
        href: '/settings/checkin',
        icon: ClipboardCheck,
        description: 'Configure arrival times',
        permission: 'settings.manage',
      },
      {
        id: 'checklist-builder',
        label: 'Checklist Builder',
        href: '/settings/checklist-builder',
        icon: ClipboardCheck,
        description: 'Customize pre-op checklist',
        permission: 'settings.manage',
      },
    ],
  },
  {
    id: 'organization',
    label: 'Organization',
    tabLabel: 'Org',
    items: [
      {
        id: 'users',
        label: 'Users & Roles',
        href: '/settings/users',
        icon: Users,
        description: 'Staff accounts and permissions',
      },
      {
        id: 'permissions',
        label: 'Roles & Permissions',
        href: '/settings/permissions',
        icon: KeyRound,
        description: 'Configure access per role',
        permission: 'users.manage',
      },
    ],
  },
  {
    id: 'case-management',
    label: 'Case Management',
    tabLabel: 'Case Mgmt',
    items: [
      {
        id: 'procedures',
        label: 'Procedure Types',
        href: '/settings/procedures',
        icon: ClipboardList,
        description: 'Surgical procedures for case creation',
      },
      {
        id: 'milestones',
        label: 'Milestones',
        href: '/settings/milestones',
        icon: Clock,
        description: 'Tracking points during cases',
      },
      {
        id: 'phases',
        label: 'Phases',
        href: '/settings/phases',
        icon: Layers,
        description: 'Surgical phase boundaries for analytics',
        badge: 'new',
        permission: 'settings.manage',
      },
      {
        id: 'procedure-milestones',
        label: 'Procedure Milestones',
        href: '/settings/procedure-milestones',
        icon: Clock,
        description: 'Which milestones appear per procedure',
        permission: 'settings.manage',
      },
      {
        id: 'surgeon-preferences',
        label: 'Surgeon Preferences',
        href: '/settings/surgeon-preferences',
        icon: Zap,
        description: 'Quick-fill templates for surgeons',
        badge: 'new',
        permission: 'settings.manage',
      },
      {
        id: 'surgeon-milestones',
        label: 'Surgeon Milestones',
        href: '/settings/surgeon-milestones',
        icon: User,
        description: 'Per-surgeon milestone overrides',
        badge: 'new',
        permission: 'settings.manage',
      },
      {
        id: 'delay-types',
        label: 'Delay Types',
        href: '/settings/delay-types',
        icon: AlertTriangle,
        description: 'Categorize surgical delays',
        permission: 'settings.manage',
      },
      {
        id: 'cancellation-reasons',
        label: 'Cancellation Reasons',
        href: '/settings/cancellation-reasons',
        icon: Ban,
        description: 'Track why cases are cancelled',
        permission: 'settings.manage',
      },
      {
        id: 'complexities',
        label: 'Case Complexities',
        href: '/settings/complexities',
        icon: AlertTriangle,
        description: 'Complexity factors for cases',
        permission: 'settings.manage',
      },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    tabLabel: 'Ops',
    items: [
      {
        id: 'rooms',
        label: 'OR Rooms',
        href: '/settings/rooms',
        icon: LayoutGrid,
        description: 'Operating rooms for scheduling',
      },
      {
        id: 'closures',
        label: 'Closures',
        href: '/settings/closures',
        icon: Clock,
        description: 'Scheduled room closures',
        permission: 'settings.manage',
      },
      {
        id: 'analytics',
        label: 'Analytics',
        href: '/settings/analytics',
        icon: BarChart3,
        description: 'FCOTS, utilization & metric targets',
        badge: 'new',
        permission: 'settings.manage',
      },
      {
        id: 'flags',
        label: 'Case Flags',
        href: '/settings/flags',
        icon: Flag,
        description: 'Auto-detection rules & delay types',
        badge: 'new',
        permission: 'settings.manage',
      },
      {
        id: 'integrations',
        label: 'Integrations',
        href: '/settings/integrations',
        icon: Puzzle,
        description: 'Connect external systems',
        badge: 'soon',
        permission: 'settings.manage',
      },
    ],
  },
  {
    id: 'device-reps',
    label: 'Device Reps',
    tabLabel: 'Reps',
    items: [
      {
        id: 'device-reps',
        label: 'Device Reps',
        href: '/settings/device-reps',
        icon: User,
        description: 'Manage implant company rep access',
      },
      {
        id: 'implant-companies',
        label: 'Implant Companies',
        href: '/settings/implant-companies',
        icon: FlaskConical,
        description: 'Surgical implant vendors',
        badge: 'new',
        permission: 'settings.manage',
      },
    ],
  },
  {
    id: 'financials',
    label: 'Financials',
    tabLabel: 'Financials',
    items: [
      {
        id: 'financials-overview',
        label: 'Overview',
        href: '/settings/financials',
        icon: DollarSign,
        description: 'Financial settings dashboard',
        permission: 'financials.view',
      },
      {
        id: 'facility-details',
        label: 'Facility Details',
        href: '/settings/facilities',
        icon: Building2,
        description: 'Facility financial information',
        permission: 'financials.view',
      },
      {
        id: 'cost-categories',
        label: 'Cost Categories',
        href: '/settings/financials/cost-categories',
        icon: Calculator,
        description: 'Debit and credit categories',
        permission: 'financials.view',
      },
      {
        id: 'payers',
        label: 'Payers',
        href: '/settings/financials/payers',
        icon: Building2,
        description: 'Insurance companies and contracts',
        permission: 'financials.view',
      },
      {
        id: 'procedure-pricing',
        label: 'Procedure Pricing',
        href: '/settings/financials/procedure-pricing',
        icon: Tag,
        description: 'Costs and reimbursements per procedure',
        permission: 'financials.view',
      },
      {
        id: 'surgeon-variance',
        label: 'Surgeon Variance',
        href: '/settings/financials/surgeon-variance',
        icon: User,
        description: 'Surgeon-specific cost overrides',
        permission: 'financials.view',
      },
    ],
  },
  {
    id: 'security',
    label: 'Security & Compliance',
    tabLabel: 'Security',
    items: [
      {
        id: 'audit-log',
        label: 'Audit Log',
        href: '/settings/audit-log',
        icon: FileText,
        description: 'System activity history',
        badge: 'admin',
        permission: 'audit.view',
      },
    ],
  },
]

// =====================================================
// LOOKUP UTILITIES
// =====================================================

/** Map a settings path to its category ID. Handles nested routes like /settings/financials/cost-categories. */
export function getCategoryForPath(pathname: string): string | null {
  // Try exact match first, then prefix match (for nested routes like /settings/financials/cost-categories)
  for (const category of settingsCategories) {
    for (const item of category.items) {
      if (pathname === item.href || pathname.startsWith(item.href + '/')) {
        return category.id
      }
    }
  }
  return null
}

/** Get a category by its ID */
export function getCategoryById(categoryId: string): SettingsCategory | undefined {
  return settingsCategories.find(c => c.id === categoryId)
}

/** Get the nav item for a given path */
export function getNavItemForPath(pathname: string): SettingsNavItem | undefined {
  for (const category of settingsCategories) {
    for (const item of category.items) {
      if (pathname === item.href || pathname.startsWith(item.href + '/')) {
        return item
      }
    }
  }
  return undefined
}

/** Filter categories based on user permissions. Returns only categories with visible items. */
export function getVisibleCategories(
  can: (key: string) => boolean
): SettingsCategory[] {
  return settingsCategories
    .map(category => ({
      ...category,
      items: category.items.filter(item => {
        if (!item.permission) return true
        return can(item.permission)
      }),
    }))
    .filter(category => category.items.length > 0)
}
