// components/dashboard/QuickAccessCards.tsx
// Bottom-row navigation shortcut cards linking to deeper analytics pages.
// These are navigation aids, not data displays.

'use client'

import Link from 'next/link'
import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  DollarSign,
  Users,
} from 'lucide-react'
import type { ReactNode } from 'react'

// ============================================
// Types
// ============================================

interface QuickAccessItem {
  title: string
  description: string
  href: string
  icon: ReactNode
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
  },
  {
    title: 'Block Utilization',
    description: 'Block schedule usage and efficiency',
    href: '/analytics/block-utilization',
    icon: <CalendarDays className="w-5 h-5" />,
  },
  {
    title: 'Financial Summary',
    description: 'Revenue and cost analysis',
    href: '/analytics/financials',
    icon: <DollarSign className="w-5 h-5" />,
  },
  {
    title: 'KPI Analytics',
    description: 'Detailed performance metrics',
    href: '/analytics/kpi',
    icon: <BarChart3 className="w-5 h-5" />,
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
  return (
    <div>
      <h2 className="text-base font-semibold text-slate-900 mb-4">Quick Access</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {QUICK_ACCESS_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group bg-white rounded-xl shadow-sm border border-slate-100 p-5 hover:shadow-md hover:border-slate-200 transition-all duration-200"
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
        ))}
      </div>
    </div>
  )
}
