'use client'

import { useState, useRef, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '../../lib/supabase'
import { useUser } from '../../lib/UserContext'

interface DashboardLayoutProps {
  children: React.ReactNode
}

const SIDEBAR_COLLAPSED_KEY = 'orbit-sidebar-collapsed'

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [collapsed, setCollapsed] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Get user data from context
  const { userData, loading, isGlobalAdmin, isFacilityAdmin, isAdmin } = useUser()

  // Load collapsed state from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY)
    if (saved !== null) {
      setCollapsed(saved === 'true')
    }
    setMounted(true)
  }, [])

  // Save collapsed state to localStorage
  const handleToggleCollapse = () => {
    const newCollapsed = !collapsed
    setCollapsed(newCollapsed)
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(newCollapsed))
  }

  // Computed values
  const userName = `${userData.firstName} ${userData.lastName}`.trim() || 'User'
  const userInitials = userData.firstName && userData.lastName 
    ? `${userData.firstName[0]}${userData.lastName[0]}`.toUpperCase() 
    : 'U'

  const getRoleDisplay = () => {
    switch (userData.accessLevel) {
      case 'global_admin':
        return 'Global Administrator'
      case 'facility_admin':
        return 'Facility Administrator'
      default:
        return 'Staff'
    }
  }

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  // Navigation items
  const getNavigation = () => {
    const baseNav = [
      {
        name: 'Dashboard',
        href: '/dashboard',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
          </svg>
        ),
        allowedRoles: ['global_admin', 'facility_admin', 'user'],
      },
      {
        name: 'Cases',
        href: '/cases',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
        ),
        allowedRoles: ['global_admin', 'facility_admin', 'user'],
      },
      {
        name: 'Analytics',
        href: '/analytics',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        ),
        allowedRoles: ['global_admin', 'facility_admin'],
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
        allowedRoles: ['global_admin', 'facility_admin'],
      },
    ]

    return baseNav.filter(item => item.allowedRoles.includes(userData.accessLevel))
  }

  const navigation = getNavigation()

  // Loading state
  if (loading || !mounted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-slate-500 font-medium">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full bg-slate-900 flex flex-col transition-all duration-300 ease-in-out z-40 ${
          collapsed ? 'w-[72px]' : 'w-[240px]'
        }`}
      >
        {/* Logo Section */}
        <div className={`h-16 flex items-center border-b border-slate-800/50 ${collapsed ? 'justify-center px-3' : 'px-5'}`}>
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/25">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className="font-bold text-white text-lg tracking-tight">ORbit</span>
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Surgical Suite</span>
              </div>
            )}
          </Link>
        </div>

        {/* Facility Indicator */}
        {!collapsed && (
          <div className="px-5 py-3 border-b border-slate-800/50">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50"></div>
              <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">
                {isGlobalAdmin ? 'All Facilities' : 'Facility'}
              </p>
            </div>
            <p className="text-sm text-slate-300 font-medium mt-1 truncate">
              {isGlobalAdmin ? 'Global Access' : userData.facilityName || 'Unknown'}
            </p>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 py-4 overflow-y-auto">
          <div className={`${collapsed ? 'px-2' : 'px-3'}`}>
            {!collapsed && (
              <p className="text-[10px] text-slate-600 uppercase tracking-wider font-semibold mb-2 px-3">
                Navigation
              </p>
            )}
            <ul className="space-y-1">
              {navigation.map((item) => {
                const active = isActive(item.href)
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                        active
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
                      } ${collapsed ? 'justify-center' : ''}`}
                      title={collapsed ? item.name : undefined}
                    >
                      <span className={`transition-transform duration-200 ${active ? '' : 'group-hover:scale-110'}`}>
                        {item.icon}
                      </span>
                      {!collapsed && <span>{item.name}</span>}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        </nav>

        {/* User Section (collapsed only shows avatar) */}
        {collapsed ? (
          <div className="p-3 border-t border-slate-800/50">
            <div className="w-10 h-10 mx-auto bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-blue-500/20">
              {userInitials}
            </div>
          </div>
        ) : (
          <div className="p-4 border-t border-slate-800/50">
            <div className="flex items-center gap-3 px-2 py-2 rounded-xl bg-slate-800/50">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-md shadow-blue-500/20">
                {userInitials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{userName}</p>
                <p className="text-xs text-slate-500 truncate">{getRoleDisplay()}</p>
              </div>
            </div>
          </div>
        )}

        {/* Collapse Toggle */}
        <div className="p-3 border-t border-slate-800/50">
          <button
            onClick={handleToggleCollapse}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-slate-800/70 transition-all duration-200 ${
              collapsed ? 'justify-center' : ''
            }`}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg
              className={`w-5 h-5 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
            {!collapsed && <span className="font-medium">Collapse</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ease-in-out ${collapsed ? 'ml-[72px]' : 'ml-[240px]'}`}>
        {/* Top Navigation Bar */}
        <header className="h-16 bg-white border-b border-slate-200/80 flex items-center justify-between px-6 sticky top-0 z-30 shadow-sm">
          {/* Left Side - Breadcrumb / Page Title */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm">
              <Link href="/dashboard" className="text-slate-400 hover:text-slate-600 transition-colors">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                </svg>
              </Link>
              <svg className="w-4 h-4 text-slate-300" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
              <span className="font-semibold text-slate-900">
                {navigation.find(n => isActive(n.href))?.name || 'Dashboard'}
              </span>
            </div>
          </div>

          {/* Right Side - Search, Notifications, User */}
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search cases, rooms..."
                className="w-72 pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all duration-200 placeholder:text-slate-400"
              />
              <svg
                className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 bg-slate-100 rounded border border-slate-200">
                ⌘K
              </kbd>
            </div>

            {/* Divider */}
            <div className="w-px h-8 bg-slate-200 mx-2"></div>

            {/* Notifications */}
            <button className="relative p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all duration-200 group">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white"></span>
            </button>

            {/* Help */}
            <button className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all duration-200">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>

            {/* Divider */}
            <div className="w-px h-8 bg-slate-200 mx-2"></div>

            {/* User Menu */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-3 p-1.5 pr-3 hover:bg-slate-50 rounded-xl transition-all duration-200"
              >
                <div className="w-9 h-9 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-md shadow-blue-500/20">
                  {userInitials}
                </div>
                <div className="text-left hidden sm:block">
                  <p className="text-sm font-semibold text-slate-700">{userName}</p>
                  <p className="text-xs text-slate-400">{userData.facilityName || getRoleDisplay()}</p>
                </div>
                <svg 
                  className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200/80 py-2 z-50">
                  {/* User Info */}
                  <div className="px-4 py-3 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center text-white font-bold shadow-md shadow-blue-500/20">
                        {userInitials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{userName}</p>
                        <p className="text-xs text-slate-500">{getRoleDisplay()}</p>
                        {userData.facilityName && (
                          <p className="text-xs text-slate-400 truncate">{userData.facilityName}</p>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Menu Items */}
                  <div className="py-1">
                    {/* Profile Link */}
                    <Link
                      href="/profile"
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span>Your Profile</span>
                    </Link>

                    {/* Settings link - only for admins */}
                    {isAdmin && (
                      <Link
                        href="/settings"
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span>Settings</span>
                      </Link>
                    )}

                    {/* Keyboard Shortcuts */}
                    <button
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors w-full"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                      </svg>
                      <span>Keyboard Shortcuts</span>
                      <kbd className="ml-auto text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">?</kbd>
                    </button>
                  </div>

                  {/* Sign Out */}
                  <div className="pt-1 mt-1 border-t border-slate-100">
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors w-full"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
