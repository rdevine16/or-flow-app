// components/settings/AdminSettingsLayout.tsx
// Settings layout for global admin pages with admin-specific navigation

'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

// =====================================================
// TYPES
// =====================================================

interface SettingsItem {
  id: string
  label: string
  href: string
  icon: React.ReactNode
  description: string
  badge?: 'new' | 'admin'
}

interface SettingsGroup {
  id: string
  label: string
  items: SettingsItem[]
}

// =====================================================
// ICONS
// =====================================================

const icons = {
  procedures: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  ),
  milestones: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  bodyRegions: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  delays: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  implants: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
    </svg>
  ),
  auditLog: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
}

// =====================================================
// ADMIN SETTINGS CONFIGURATION
// =====================================================

const adminSettingsGroups: SettingsGroup[] = [
  {
    id: 'defaults',
    label: 'Default Templates',
    items: [
      {
        id: 'procedures',
        label: 'Default Procedures',
        href: '/admin/settings/procedures',
        description: 'Procedure templates for new facilities',
        icon: icons.procedures,
      },
      {
        id: 'milestones',
        label: 'Global Milestones',
        href: '/admin/settings/milestones',
        description: 'Milestone templates for new facilities',
        icon: icons.milestones,
      },
      {
        id: 'delay-types',
        label: 'Default Delay Types',
        href: '/admin/settings/delay-types',
        description: 'Delay type templates for new facilities',
        icon: icons.delays,
      },
    ],
  },
  {
    id: 'global',
    label: 'Global Settings',
    items: [
      {
        id: 'body-regions',
        label: 'Body Regions',
        href: '/admin/settings/body-regions',
        description: 'Anatomical regions for procedures',
        icon: icons.bodyRegions,
      },
      {
        id: 'implant-templates',
        label: 'Implant Templates',
        href: '/admin/settings/implant-templates',
        description: 'Default implant configurations',
        icon: icons.implants,
        badge: 'new',
      },
    ],
  },
  {
    id: 'compliance',
    label: 'Security & Compliance',
    items: [
      {
        id: 'audit-log',
        label: 'Global Audit Log',
        href: '/admin/settings/audit-log',
        description: 'System-wide activity history',
        icon: icons.auditLog,
        badge: 'admin',
      },
    ],
  },
]

// =====================================================
// COMPONENT
// =====================================================

interface AdminSettingsLayoutProps {
  children: React.ReactNode
  title: string
  description: string
}

export default function AdminSettingsLayout({ children, title, description }: AdminSettingsLayoutProps) {
  const pathname = usePathname()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Render badge
  const renderBadge = (badge?: 'new' | 'admin') => {
    if (!badge) return null
    
    if (badge === 'new') {
      return (
        <span className="ml-auto px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-emerald-100 text-emerald-700 rounded">
          New
        </span>
      )
    }
    
    if (badge === 'admin') {
      return (
        <span className="ml-auto px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-amber-100 text-amber-700 rounded">
          Admin
        </span>
      )
    }
  }

  return (
    <div className="flex gap-8">
      {/* Sidebar */}
      <div className={`${sidebarCollapsed ? 'w-16' : 'w-72'} flex-shrink-0 transition-all duration-200`}>
        <div className="sticky top-24">
          {/* Collapse Toggle */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="mb-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg 
              className={`w-5 h-5 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>

          <nav className="space-y-6">
            {adminSettingsGroups.map((group) => (
              <div key={group.id}>
                {/* Group Header */}
                {!sidebarCollapsed && (
                  <h3 className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    {group.label}
                  </h3>
                )}
                
                {/* Group Items */}
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const isActive = pathname === item.href
                    
                    return (
                      <Link
                        key={item.id}
                        href={item.href}
                        className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                          isActive
                            ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/10'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                        title={sidebarCollapsed ? item.label : undefined}
                      >
                        <span className={`flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'}`}>
                          {item.icon}
                        </span>
                        
                        {!sidebarCollapsed && (
                          <>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{item.label}</p>
                              {!isActive && (
                                <p className="text-xs text-slate-400 truncate mt-0.5 group-hover:text-slate-500">
                                  {item.description}
                                </p>
                              )}
                            </div>
                            {renderBadge(item.badge)}
                          </>
                        )}
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* Help Card */}
          {!sidebarCollapsed && (
            <div className="mt-8 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
              <div className="flex items-center gap-2 text-slate-900 font-medium mb-2">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Global Admin
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Changes here affect templates for new facilities. Existing facilities manage their own settings.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
          <p className="text-slate-500 mt-1">{description}</p>
        </div>
        
        {/* Page Content */}
        {children}
      </div>
    </div>
  )
}
