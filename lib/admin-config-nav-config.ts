// lib/admin-config-nav-config.ts
// Navigation config for the global admin Configuration landing page.
// Mirrors the pattern from settings-nav-config.ts.

import { type LucideIcon } from 'lucide-react'
import {
  AlertTriangle,
  Ban,
  BarChart3,
  Bell,
  Calculator,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  Flag,
  FlaskConical,
  Clock,
  KeyRound,
  Mic,
  Package,
  User,
} from 'lucide-react'
import type { TierSlug } from '@/lib/tier-config'

// =====================================================
// TYPES
// =====================================================

export type BadgeType = 'new' | 'admin' | 'soon'

export interface AdminConfigNavItem {
  id: string
  label: string
  href: string
  icon: LucideIcon
  description: string
  badge?: BadgeType
  permission?: string
  requiredTier?: TierSlug
}

export interface AdminConfigCategory {
  id: string
  label: string
  items: AdminConfigNavItem[]
  requiredTier?: TierSlug
}

// =====================================================
// ADMIN CONFIGURATION CATEGORIES (4 categories, 14 items)
// =====================================================

export const adminConfigCategories: AdminConfigCategory[] = [
  {
    id: 'clinical-workflows',
    label: 'Clinical Workflows',
    items: [
      {
        id: 'procedures',
        label: 'Procedures',
        href: '/admin/settings/procedures',
        icon: ClipboardList,
        description: 'Surgical procedure types and definitions',
      },
      {
        id: 'procedure-categories',
        label: 'Categories',
        href: '/admin/settings/procedure-categories',
        icon: Package,
        description: 'Procedure classification and grouping',
      },
      {
        id: 'milestones',
        label: 'Milestones',
        href: '/admin/settings/milestones',
        icon: Clock,
        description: 'Case tracking points and templates',
      },
      {
        id: 'delay-types',
        label: 'Delay Types',
        href: '/admin/settings/delay-types',
        icon: AlertTriangle,
        description: 'Categorize surgical delays',
      },
      {
        id: 'cancellation-reasons',
        label: 'Cancellation Reasons',
        href: '/admin/cancellation-reasons',
        icon: Ban,
        description: 'Track why cases are cancelled',
      },
      {
        id: 'complexities',
        label: 'Complexities',
        href: '/admin/complexities',
        icon: AlertTriangle,
        description: 'Case complexity factors',
      },
    ],
  },
  {
    id: 'analytics-rules',
    label: 'Analytics & Rules',
    items: [
      {
        id: 'flag-rules',
        label: 'Flag Rules',
        href: '/admin/settings/flag-rules',
        icon: Flag,
        description: 'Auto-detection rules for case flags',
      },
      {
        id: 'analytics-defaults',
        label: 'Analytics Defaults',
        href: '/admin/settings/analytics',
        icon: BarChart3,
        description: 'Default FCOTS and metric targets',
      },
    ],
  },
  {
    id: 'financial',
    label: 'Financial',
    items: [
      {
        id: 'payers',
        label: 'Payers',
        href: '/admin/settings/payers',
        icon: CreditCard,
        description: 'Insurance companies and contracts',
      },
      {
        id: 'cost-categories',
        label: 'Cost Categories',
        href: '/admin/settings/cost-categories',
        icon: Calculator,
        description: 'Debit and credit categories',
      },
      {
        id: 'implant-companies',
        label: 'Implant Companies',
        href: '/admin/settings/implant-companies',
        icon: FlaskConical,
        description: 'Surgical implant vendors',
      },
    ],
  },
  {
    id: 'system',
    label: 'System',
    items: [
      {
        id: 'notifications',
        label: 'Notifications',
        href: '/admin/settings/notifications',
        icon: Bell,
        description: 'System notification templates',
      },
      {
        id: 'body-regions',
        label: 'Body Regions',
        href: '/admin/settings/body-regions',
        icon: User,
        description: 'Anatomical regions for procedures',
      },
      {
        id: 'checklist-templates',
        label: 'Checklist Templates',
        href: '/admin/checklist-templates',
        icon: ClipboardCheck,
        description: 'Pre-op checklist templates',
      },
      {
        id: 'permission-templates',
        label: 'Permission Templates',
        href: '/admin/permission-templates',
        icon: KeyRound,
        description: 'Role-based permission presets',
      },
      {
        id: 'voice-templates',
        label: 'Voice Templates',
        href: '/admin/voice-templates',
        icon: Mic,
        description: 'Default voice commands for new facilities',
      },
    ],
  },
]

// =====================================================
// LOOKUP UTILITIES
// =====================================================

/** Filter categories based on user permissions and subscription tier. */
export function getVisibleAdminCategories(
  can: (key: string) => boolean,
  isTierAtLeast?: (requiredTier: TierSlug) => boolean
): AdminConfigCategory[] {
  return adminConfigCategories
    .filter(category => {
      if (!category.requiredTier || !isTierAtLeast) return true
      return isTierAtLeast(category.requiredTier)
    })
    .map(category => ({
      ...category,
      items: category.items.filter(item => {
        if (item.permission && !can(item.permission)) return false
        if (item.requiredTier && isTierAtLeast && !isTierAtLeast(item.requiredTier)) return false
        return true
      }),
    }))
    .filter(category => category.items.length > 0)
}
