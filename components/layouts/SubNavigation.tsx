// components/layouts/SubNavigation.tsx
// Secondary navigation panel for page-specific sub-navigation

'use client'

import Link from 'next/link'
import { SUBNAV_WIDTH } from './navigation-config'

export interface SubNavItem {
  id: string
  label: string
  href: string
  icon?: React.ReactNode
}

interface SubNavigationProps {
  items: SubNavItem[]
  title: string
  pathname: string
  sidebarWidth: number
}

export default function SubNavigation({
  items,
  title,
  pathname,
  sidebarWidth,
}: SubNavigationProps) {
  if (items.length === 0) return null

  return (
    <aside
      style={{ left: sidebarWidth, width: SUBNAV_WIDTH }}
      className="fixed top-0 h-full bg-white border-r border-slate-200 z-40 flex flex-col transition-all duration-300 ease-out"
    >
      {/* Header */}
      <div className="h-16 flex items-center px-5 border-b border-slate-200">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {items.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative
                ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
            >
              {item.icon && (
                <span
                  className={`flex-shrink-0 ${
                    isActive
                      ? 'text-blue-600'
                      : 'text-slate-400 group-hover:text-slate-600'
                  }`}
                >
                  {item.icon}
                </span>
              )}
              <span>{item.label}</span>
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-600 rounded-r-full" />
              )}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}

export { SUBNAV_WIDTH }
