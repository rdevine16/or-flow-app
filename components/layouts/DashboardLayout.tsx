'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

interface DashboardLayoutProps {
  children: React.ReactNode
}

const navigation = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    name: 'Cases',
    href: '/cases',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
  {
    name: 'Analytics',
    href: '/analytics',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
]

// ORbit Logo - Icon Only (for collapsed sidebar)
const LogoIcon = () => (
  <svg width="32" height="32" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Core circle */}
    <circle cx="32" cy="32" r="12" stroke="#3b82f6" strokeWidth="4" fill="none"/>
    {/* Orbital ring */}
    <ellipse cx="32" cy="32" rx="22" ry="8" stroke="#60a5fa" strokeWidth="2" fill="none" transform="rotate(-25 32 32)"/>
    {/* Tracking dot */}
    <circle cx="50" cy="20" r="5" fill="#10b981"/>
  </svg>
)

// ORbit Logo - Full with text (for expanded sidebar)
const LogoFull = () => (
  <svg width="110" height="32" viewBox="0 0 220 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Icon part */}
    <circle cx="32" cy="32" r="12" stroke="#3b82f6" strokeWidth="4" fill="none"/>
    <ellipse cx="32" cy="32" rx="22" ry="8" stroke="#60a5fa" strokeWidth="2" fill="none" transform="rotate(-25 32 32)"/>
    <circle cx="50" cy="20" r="5" fill="#10b981"/>
    {/* Text: "OR" in blue */}
    <text x="70" y="42" fontFamily="system-ui, -apple-system, sans-serif" fontSize="28" fontWeight="700" fill="#3b82f6">OR</text>
    {/* Text: "bit" in slate */}
    <text x="113" y="42" fontFamily="system-ui, -apple-system, sans-serif" fontSize="28" fontWeight="600" fill="#94a3b8">bit</text>
  </svg>
)

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname()
  // Start with null so we know when localStorage has been checked
  const [collapsed, setCollapsed] = useState<boolean | null>(null)

  // Load collapsed state from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed')
    // If there's a saved preference, use it; otherwise default to false (expanded)
    setCollapsed(saved !== null ? JSON.parse(saved) : false)
  }, [])

  // Save collapsed state to localStorage when it changes
  useEffect(() => {
    // Only save after initial load (when collapsed is not null)
    if (collapsed !== null) {
      localStorage.setItem('sidebar-collapsed', JSON.stringify(collapsed))
    }
  }, [collapsed])

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  // Don't render until we've loaded the preference from localStorage
  // This prevents the flash of wrong state
  if (collapsed === null) {
    return (
      <div className="min-h-screen bg-slate-50 flex">
        {/* Empty placeholder that matches the layout structure */}
        <aside className="fixed top-0 left-0 h-full bg-slate-900 w-16 z-40" />
        <div className="flex-1 ml-16">
          <header className="h-14 bg-white border-b border-slate-200" />
          <main className="p-6" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full bg-slate-900 text-white transition-all duration-300 z-40 flex flex-col ${
          collapsed ? 'w-16' : 'w-56'
        }`}
      >
        {/* Logo */}
        <div className={`h-14 flex items-center border-b border-slate-800 ${collapsed ? 'justify-center px-2' : 'px-4'}`}>
          <Link href="/dashboard" className="flex items-center">
            {collapsed ? <LogoIcon /> : <LogoFull />}
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4">
          <ul className="space-y-1 px-2">
            {navigation.map((item) => {
              const active = isActive(item.href)
              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    } ${collapsed ? 'justify-center' : ''}`}
                    title={collapsed ? item.name : undefined}
                  >
                    {item.icon}
                    {!collapsed && <span>{item.name}</span>}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Collapse Button */}
        <div className="p-2 border-t border-slate-800">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ${
              collapsed ? 'justify-center' : ''
            }`}
          >
            <svg
              className={`w-5 h-5 transition-transform ${collapsed ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className={`flex-1 transition-all duration-300 ${collapsed ? 'ml-16' : 'ml-56'}`}>
        {/* Top Bar */}
        <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <h1 className="text-sm font-medium text-slate-600">
              {navigation.find(n => isActive(n.href))?.name || 'Dashboard'}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search..."
                className="w-64 pl-9 pr-4 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              <svg
                className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Notifications */}
            <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors relative">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>

            {/* User Menu */}
            <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-xs font-medium text-blue-600">
                AD
              </div>
              <div className="text-sm">
                <p className="font-medium text-slate-700">Admin</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
