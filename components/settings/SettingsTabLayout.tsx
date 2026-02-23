'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useUser } from '@/lib/UserContext'
import {
  getCategoryForPath,
  getVisibleCategories,
  type SettingsCategory,
  type BadgeType,
} from '@/lib/settings-nav-config'

// =====================================================
// BADGE RENDERER
// =====================================================

function SettingsBadge({ type }: { type: BadgeType }) {
  const styles: Record<BadgeType, string> = {
    new: 'bg-green-100 text-green-600',
    admin: 'bg-amber-100 text-amber-700',
    soon: 'bg-slate-100 text-slate-500',
  }
  const labels: Record<BadgeType, string> = {
    new: 'New',
    admin: 'Admin',
    soon: 'Soon',
  }

  return (
    <span className={`ml-auto px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide rounded ${styles[type]}`}>
      {labels[type]}
    </span>
  )
}

// =====================================================
// TAB BAR
// =====================================================

function TabBar({
  categories,
  activeCategoryId,
}: {
  categories: SettingsCategory[]
  activeCategoryId: string | null
}) {
  return (
    <div className="sticky top-0 z-20 bg-white border-b border-slate-200">
      <div className="px-6">
        <nav className="flex gap-1 -mb-px" aria-label="Settings categories">
          {categories.map(category => {
            const isActive = category.id === activeCategoryId
            const firstItem = category.items[0]
            if (!firstItem) return null

            return (
              <Link
                key={category.id}
                href={firstItem.href}
                className={`
                  px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
                  ${isActive
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }
                `}
              >
                {category.tabLabel}
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}

// =====================================================
// SUB-NAV SIDEBAR
// =====================================================

function SubNav({
  category,
  pathname,
  notificationDots,
}: {
  category: SettingsCategory
  pathname: string
  notificationDots?: Record<string, boolean>
}) {
  return (
    <nav className="w-[220px] flex-shrink-0 sticky top-[49px] self-start max-h-[calc(100vh-49px)] overflow-y-auto py-4 pl-6">
      <div className="space-y-1">
        {category.items.map(item => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          const Icon = item.icon
          const hasDot = notificationDots?.[item.id]

          return (
            <Link
              key={item.id}
              href={item.href}
              className={`
                group flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors
                ${isActive
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }
              `}
            >
              <div className="relative flex-shrink-0">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'}`} />
                {hasDot && (
                  <div className={`absolute -top-0.5 -right-0.5 w-[7px] h-[7px] rounded-full ${isActive ? 'bg-amber-400' : 'bg-amber-500'} border border-white`} />
                )}
              </div>
              <span className="flex-1 truncate">{item.label}</span>
              {item.badge && <SettingsBadge type={item.badge} />}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

// =====================================================
// MAIN COMPONENT
// =====================================================

interface SettingsTabLayoutProps {
  children: React.ReactNode
}

export default function SettingsTabLayout({ children }: SettingsTabLayoutProps) {
  const pathname = usePathname()
  const { can } = useUser()

  const visibleCategories = getVisibleCategories(can)
  const activeCategoryId = getCategoryForPath(pathname)
  const activeCategory = visibleCategories.find(c => c.id === activeCategoryId)
  return (
    <div className="flex flex-col min-h-0">
      {/* Tab Bar */}
      <TabBar categories={visibleCategories} activeCategoryId={activeCategoryId} />

      {/* Sub-nav + Content */}
      <div className="flex flex-1 min-h-0">
        {activeCategory && (
          <SubNav
            category={activeCategory}
            pathname={pathname}
          />
        )}

        {/* Content Area */}
        <div className="flex-1 min-w-0 p-6 animate-fade-in">
          {children}
        </div>
      </div>
    </div>
  )
}
