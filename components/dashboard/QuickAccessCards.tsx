// components/dashboard/QuickAccessCards.tsx
// Bottom-row navigation shortcut cards linking to deeper analytics pages.
// Premium analytics links show locked for lower tiers.

'use client'

import Link from 'next/link'
import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  DollarSign,
  Lock,
  Users,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useUser } from '@/lib/UserContext'
import type { TierSlug } from '@/lib/tier-config'

// ============================================
// Types
// ============================================

interface QuickAccessItem {
  title: string
  description: string
  href: string
  icon: ReactNode
  requiredTier?: TierSlug
  /** RBAC permission key — hides the card entirely when user lacks this permission */
  permission?: string
}

// ============================================
// Config
// ============================================

const QUICK_ACCESS_ITEMS: QuickAccessItem[] = [
  {
    title: 'Surgeon Scorecards',
    description: 'Individual ORbit Score breakdowns',
    href: '/analytics/orbit-score',
    icon: <Users className="w-5 h-5" />,
    requiredTier: 'professional',
  },
  {
    title: 'Block Utilization',
    description: 'Block schedule usage and efficiency',
    href: '/analytics/block-utilization',
    icon: <CalendarDays className="w-5 h-5" />,
    requiredTier: 'professional',
  },
  {
    title: 'Financial Summary',
    description: 'Revenue and cost analysis',
    href: '/analytics/financials',
    icon: <DollarSign className="w-5 h-5" />,
    requiredTier: 'enterprise',
    permission: 'financials.view',
  },
  {
    title: 'KPI Analytics',
    description: 'Detailed performance metrics',
    href: '/analytics/kpi',
    icon: <BarChart3 className="w-5 h-5" />,
    requiredTier: 'professional',
  },
  {
    title: 'Case Analytics',
    description: 'Case history and trends',
    href: '/cases',
    icon: <ClipboardList className="w-5 h-5" />,
  },
]

// ============================================
// Component
// ============================================

export function QuickAccessCards() {
  const { isTierAtLeast, can } = useUser()

  return (
    <div>
      <h2 className="text-base font-semibold text-slate-900 mb-4">Quick Access</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {QUICK_ACCESS_ITEMS.map((item) => {
          // Hide entirely when user lacks the required RBAC permission
          if (item.permission && !can(item.permission)) return null
          const isLocked = item.requiredTier ? !isTierAtLeast(item.requiredTier) : false

          if (isLocked) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="group relative bg-white rounded-xl shadow-sm border border-slate-100 p-5 opacity-60"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex-shrink-0 text-slate-300">
                    {item.icon}
                  </div>
                  <h3 className="text-sm font-semibold text-slate-400">
                    {item.title}
                  </h3>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {item.description}
                </p>
                <div className="absolute top-3 right-3">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                </div>
              </Link>
            )
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className="group bg-white rounded-xl shadow-sm border border-slate-100 p-5 hover:shadow-md hover:border-slate-200 hover:-translate-y-0.5 transition-all duration-200"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="flex-shrink-0 text-slate-400 group-hover:text-blue-600 transition-colors">
                  {item.icon}
                </div>
                <h3 className="text-sm font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                  {item.title}
                </h3>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                {item.description}
              </p>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
