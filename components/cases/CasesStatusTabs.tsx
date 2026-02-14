// components/cases/CasesStatusTabs.tsx
// Shopify-style status tabs with count badges for the Cases page.
// Each tab filters cases by status; counts reflect the active date range.

'use client'

import type { CasesPageTab } from '@/lib/dal'
import { statusColors } from '@/lib/design-tokens'

// ============================================
// TAB CONFIGURATION
// ============================================

interface TabConfig {
  key: CasesPageTab
  label: string
  colorKey: keyof typeof statusColors
}

const TABS: TabConfig[] = [
  { key: 'all', label: 'All', colorKey: 'scheduled' },
  { key: 'today', label: 'Today', colorKey: 'scheduled' },
  { key: 'scheduled', label: 'Scheduled', colorKey: 'scheduled' },
  { key: 'in_progress', label: 'In Progress', colorKey: 'in_progress' },
  { key: 'completed', label: 'Completed', colorKey: 'completed' },
  { key: 'needs_validation', label: 'Needs Validation', colorKey: 'needs_validation' },
]

// ============================================
// COMPONENT
// ============================================

interface CasesStatusTabsProps {
  activeTab: CasesPageTab
  onTabChange: (tab: CasesPageTab) => void
  counts: Record<CasesPageTab, number>
  loading?: boolean
}

export default function CasesStatusTabs({
  activeTab,
  onTabChange,
  counts,
  loading = false,
}: CasesStatusTabsProps) {
  return (
    <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto">
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key
        const count = counts[tab.key]
        const colors = statusColors[tab.colorKey]

        return (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={`
              relative flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap
              transition-colors duration-200
              ${isActive
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-500 hover:text-slate-700 border-b-2 border-transparent'
              }
            `}
            aria-selected={isActive}
            role="tab"
          >
            <span>{tab.label}</span>
            <span
              className={`
                inline-flex items-center justify-center min-w-[20px] h-5 px-1.5
                text-xs font-semibold rounded-full
                transition-colors duration-200
                ${loading
                  ? 'bg-slate-100 text-slate-400'
                  : isActive
                    ? `${colors.bg} ${colors.text}`
                    : 'bg-slate-100 text-slate-500'
                }
              `}
            >
              {loading ? '\u2014' : count}
            </span>
          </button>
        )
      })}
    </div>
  )
}
