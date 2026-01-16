// components/layouts/DashboardLayout.tsx
// Enhanced with Admin navigation, impersonation banner, trial expiration blocking, and BREADCRUMBS

'use client'

import { useState, useRef, useEffect, Suspense } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '../../lib/supabase'
import { useUser } from '../../lib/UserContext'
import { getImpersonationState, endImpersonation } from '../../lib/impersonation'
import { authAudit, adminAudit } from '../../lib/audit-logger'
import { getBreadcrumbsFromParam, BreadcrumbItem } from '../../lib/breadcrumbs'

interface DashboardLayoutProps {
  children: React.ReactNode
}

const SIDEBAR_COLLAPSED_KEY = 'orbit-sidebar-collapsed'

// Breadcrumb component that reads from URL
function HeaderBreadcrumb({ 
  facilityName,
  fallbackPageName 
}: { 
  facilityName?: string | null
  fallbackPageName: string 
}) {
  const searchParams = useSearchParams()
  const breadcrumbs = getBreadcrumbsFromParam(searchParams.get('from'))
  
  // If no breadcrumbs from URL, show simple facility > page
  if (breadcrumbs.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm">
        {facilityName && (
          <>
            <span className="text-slate-400">{facilityName}</span>
            <ChevronIcon />
          </>
        )}
        <span className="font-semibold text-slate-900">{fallbackPageName}</span>
      </div>
    )
  }

  // Show full breadcrumb trail
  return (
    <nav className="flex items-center gap-2 text-sm" aria-label="Breadcrumb">
      {facilityName && (
        <>
          <span className="text-slate-400">{facilityName}</span>
          <ChevronIcon />
        </>
      )}
      {breadcrumbs.map((crumb, index) => (
        <span key={crumb.href} className="flex items-center gap-2">
          {index > 0 && <ChevronIcon />}
          <Link
            href={crumb.href}
            className="text-slate-500 hover:text-slate-900 transition-colors"
          >
            {crumb.label}
          </Link>
        </span>
      ))}
    </nav>
  )
}

function ChevronIcon() {
  return (
    <svg className="w-4 h-4 text-slate-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  )
}

// Wrapper to handle Suspense for useSearchParams
function BreadcrumbWrapper({ 
  facilityName, 
  fallbackPageName 
}: { 
  facilityName?: string | null
  fallbackPageName: string 
}) {
  return (
    <Suspense fallback={
      <div className="flex items-center gap-2 text-sm">
        {facilityName && (
          <>
            <span className="text-slate-400">{facilityName}</span>
            <ChevronIcon />
          </>
        )}
        <span className="font-semibold text-slate-900">{fallbackPageName}</span>
      </div>
    }>
      <HeaderBreadcrumb facilityName={facilityName} fallbackPageName={fallbackPageName} />
    </Suspense>
  )
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [collapsed, setCollapsed] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  
  // Impersonation state
  const [impersonation, setImpersonation] = useState<{
    facilityId: string
    facilityName: string
    facilityLogo: string | null
    sessionId: string
  } | null>(null)

  // Trial/subscription state
  const [facilityStatus, setFacilityStatus] = useState<{
    subscriptionStatus: string | null
    trialEndsAt: string | null
    facilityName: string | null
    facilityLogo: string | null
  } | null>(null)
  const [mustChangePassword, setMustChangePassword] = useState(false)
  const [checkingAccess, setCheckingAccess] = useState(true)
  const [userAccessLevel, setUserAccessLevel] = useState<string | null>(null)

  // Get user data from context
  const { userData, loading, isGlobalAdmin, isFacilityAdmin, isAdmin } = useUser()

  // Computed: use local access level if available, fallback to context
  const effectiveIsGlobalAdmin = userAccessLevel === 'global_admin' || isGlobalAdmin

  // Check facility subscription status and password change requirement
 useEffect(() => {
  async function checkFacilityAccess() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setCheckingAccess(false)
        return
      }

      // Get user record to check access_level, must_change_password and facility_id
      const { data: userRecord } = await supabase
        .from('users')
        .select('facility_id, must_change_password, access_level')
        .eq('id', user.id)
        .single()

      // Store access level locally for immediate use
      if (userRecord?.access_level) {
        setUserAccessLevel(userRecord.access_level)
      }

      // Check if password change is required
      if (userRecord?.must_change_password) {
        setMustChangePassword(true)
        setCheckingAccess(false)
        return
      }

      // Global admins always have access (skip facility check)
      if (userRecord?.access_level === 'global_admin') {
        setCheckingAccess(false)
        return
      }

      if (!userRecord?.facility_id) {
        setCheckingAccess(false)
        return
      }

      // Get facility status
      const { data: facility } = await supabase
        .from('facilities')
        .select('name, subscription_status, trial_ends_at, logo_url')
        .eq('id', userRecord.facility_id)
        .single()

      if (facility) {
        setFacilityStatus({
          subscriptionStatus: facility.subscription_status,
          trialEndsAt: facility.trial_ends_at,
          facilityName: facility.name,
          facilityLogo: facility.logo_url,
        })
      }

      setCheckingAccess(false)
    } catch (error) {
      console.error('Error checking facility access:', error)
      setCheckingAccess(false)  // ← IMPORTANT: Always stop loading even on error
    }
  }

  if (!loading) {
    checkFacilityAccess()
  }
}, [loading, supabase])

  // Load collapsed state and impersonation state on mount
  useEffect(() => {
    const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY)
    if (saved !== null) {
      setCollapsed(saved === 'true')
    }
    
    // Check for impersonation and fetch logo
    async function loadImpersonation() {
      const impState = getImpersonationState()
      if (impState && effectiveIsGlobalAdmin) {
        // Fetch logo for impersonated facility
        const { data: facility } = await supabase
          .from('facilities')
          .select('logo_url')
          .eq('id', impState.facilityId)
          .single()
        
        setImpersonation({
          facilityId: impState.facilityId,
          facilityName: impState.facilityName,
          facilityLogo: facility?.logo_url || null,
          sessionId: impState.sessionId,
        })
      }
    }
    
    loadImpersonation()
    setMounted(true)
  }, [effectiveIsGlobalAdmin, supabase])

  // Save collapsed state to localStorage
  const handleToggleCollapse = () => {
    const newCollapsed = !collapsed
    setCollapsed(newCollapsed)
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(newCollapsed))
  }

  // Handle ending impersonation
  const handleEndImpersonation = async () => {
    if (impersonation) {
      await adminAudit.impersonationEnded(supabase, impersonation.facilityName, impersonation.facilityId)
    }
    await endImpersonation(supabase)
    setImpersonation(null)
    router.push('/admin/facilities')
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

  // Check if trial is expired
  const isTrialExpired = () => {
    if (!facilityStatus) return false
    if (facilityStatus.subscriptionStatus !== 'trial') return false
    if (!facilityStatus.trialEndsAt) return false
    
    return new Date(facilityStatus.trialEndsAt) < new Date()
  }

  // Check if facility is disabled
  const isDisabled = () => {
    if (!facilityStatus) return false
    return facilityStatus.subscriptionStatus === 'disabled'
  }

  // Get days until trial ends (for warning banner)
  const getTrialDaysRemaining = () => {
    if (!facilityStatus?.trialEndsAt) return null
    if (facilityStatus.subscriptionStatus !== 'trial') return null
    
    const diff = new Date(facilityStatus.trialEndsAt).getTime() - Date.now()
    return Math.ceil(diff / 86400000)
  }

  const trialDaysRemaining = getTrialDaysRemaining()
  const showTrialWarning = trialDaysRemaining !== null && trialDaysRemaining > 0 && trialDaysRemaining <= 7

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
    // Log impersonation end if active
    if (impersonation) {
      await adminAudit.impersonationEnded(supabase, impersonation.facilityName, impersonation.facilityId)
      await endImpersonation(supabase)
    }
    
    // Log sign out
    await authAudit.logout(supabase)
    
    await supabase.auth.signOut()
    router.push('/login')
  }

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  // Navigation items
  const getNavigation = () => {
    // Global admin NOT impersonating = Admin only
    if (effectiveIsGlobalAdmin && !impersonation) {
      return [
        {
          name: 'Admin',
          href: '/admin',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          ),
          allowedRoles: ['global_admin'],
        },
      ]
    }

    // Build standard nav for facility users OR global admin while impersonating
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

    // Add Admin to nav for global admin while impersonating
    if (effectiveIsGlobalAdmin && impersonation) {
      baseNav.push({
        name: 'Admin',
        href: '/admin',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        ),
        allowedRoles: ['global_admin'],
      })
    }

    return baseNav.filter(item => item.allowedRoles.includes(userData.accessLevel))
  }

  const navigation = getNavigation()

  // Get current page name for fallback
  const currentPageName = navigation.find(n => isActive(n.href))?.name || 'Dashboard'
  
  // Get facility name to display
  const displayFacilityName = impersonation ? impersonation.facilityName : userData.facilityName

  // Loading state
  if (loading || !mounted || checkingAccess) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-slate-500 font-medium">Loading...</p>
        </div>
      </div>
    )
  }

  // Redirect to password change if required
  if (mustChangePassword) {
    router.push('/auth/change-password')
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-slate-500 font-medium">Redirecting...</p>
        </div>
      </div>
    )
  }

  // Note: Global admins without impersonation will only see "Admin" in nav
  // No auto-redirect needed - they'll naturally navigate to /admin

  // Trial Expired Block Screen
  if (isTrialExpired() && !effectiveIsGlobalAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-6">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white text-center">Trial Period Ended</h1>
          </div>
          
          <div className="p-6">
            <p className="text-slate-600 text-center mb-6">
              Your trial for <span className="font-semibold">{facilityStatus?.facilityName}</span> has expired. 
              Please contact your administrator to continue using ORbit.
            </p>
            
            <div className="bg-slate-50 rounded-xl p-4 mb-6">
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Need help?</h3>
              <p className="text-sm text-slate-500">
                Contact support at <a href="mailto:support@orbitsurgical.com" className="text-blue-600 hover:underline">support@orbitsurgical.com</a>
              </p>
            </div>
            
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign Out
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Facility Disabled Block Screen
  if (isDisabled() && !effectiveIsGlobalAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="bg-gradient-to-r from-red-500 to-red-600 p-6">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white text-center">Account Disabled</h1>
          </div>
          
          <div className="p-6">
            <p className="text-slate-600 text-center mb-6">
              Access to <span className="font-semibold">{facilityStatus?.facilityName}</span> has been disabled. 
              Please contact your administrator for assistance.
            </p>
            
            <div className="bg-slate-50 rounded-xl p-4 mb-6">
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Need help?</h3>
              <p className="text-sm text-slate-500">
                Contact support at <a href="mailto:support@orbitsurgical.com" className="text-blue-600 hover:underline">support@orbitsurgical.com</a>
              </p>
            </div>
            
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign Out
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside 
        className={`${collapsed ? 'w-20' : 'w-64'} bg-white border-r border-slate-200 flex flex-col transition-all duration-300 ease-in-out fixed h-full z-40`}
      >
        {/* Logo Section */}
        <div className={`h-16 flex items-center ${collapsed ? 'justify-center px-2' : 'justify-between px-4'} border-b border-slate-200`}>
          {!collapsed ? (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25">
                <span className="text-white font-bold text-lg">O</span>
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                ORbit
              </span>
            </div>
          ) : (
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25">
              <span className="text-white font-bold text-lg">O</span>
            </div>
          )}
          
          {!collapsed && (
            <button
              onClick={handleToggleCollapse}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              aria-label="Collapse sidebar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>
          )}
        </div>

        {/* Expand button when collapsed */}
        {collapsed && (
          <button
            onClick={handleToggleCollapse}
            className="mx-auto mt-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Expand sidebar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </button>
        )}

        {/* Navigation */}
        <nav className={`flex-1 ${collapsed ? 'px-3' : 'px-4'} py-6 space-y-1.5 overflow-y-auto`}>
          {navigation.map((item) => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center ${collapsed ? 'justify-center' : ''} gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative
                  ${active 
                    ? 'bg-blue-50 text-blue-700' 
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                title={collapsed ? item.name : undefined}
              >
                <span className={`${active ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'} transition-colors`}>
                  {item.icon}
                </span>
                {!collapsed && item.name}
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-600 rounded-r-full" />
                )}
              </Link>
            )
          })}
        </nav>

        {/* Bottom Section - Version */}
        <div className={`p-4 border-t border-slate-200 ${collapsed ? 'text-center' : ''}`}>
          <p className="text-xs text-slate-400">
            {collapsed ? 'v1.0' : 'Version 1.0.0'}
          </p>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col ${collapsed ? 'ml-20' : 'ml-64'} transition-all duration-300 ease-in-out`}>
        {/* Trial Warning Banner */}
        {showTrialWarning && (
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-medium">
                Your trial expires in {trialDaysRemaining} day{trialDaysRemaining !== 1 ? 's' : ''}. 
                <span className="ml-1 opacity-90">Contact support to continue using ORbit.</span>
              </span>
            </div>
            <a 
              href="mailto:support@orbitsurgical.com"
              className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
            >
              Contact Support
            </a>
          </div>
        )}

        {/* Impersonation Banner */}
        {impersonation && effectiveIsGlobalAdmin && (
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <span className="text-sm font-medium text-amber-800">
                Viewing as: <span className="font-semibold">{impersonation.facilityName}</span>
              </span>
            </div>
            <button
              onClick={handleEndImpersonation}
              className="flex items-center gap-2 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Exit
            </button>
          </div>
        )}

        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-30">
          {/* Left Side - Breadcrumb */}
          <div className="flex items-center gap-4 min-w-0 flex-1">
            {/* Facility Logo */}
            {(impersonation?.facilityLogo || facilityStatus?.facilityLogo) && (
              <div className="w-8 h-8 rounded-lg border border-slate-200 bg-white p-1 flex items-center justify-center flex-shrink-0">
                <img
                  src={impersonation?.facilityLogo || facilityStatus?.facilityLogo || ''}
                  alt="Facility logo"
                  className="max-w-full max-h-full object-contain"
                />
              </div>
            )}
            
            {/* Smart Breadcrumb */}
            <BreadcrumbWrapper 
              facilityName={displayFacilityName}
              fallbackPageName={currentPageName}
            />
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

                    {/* Admin link - only for global admins */}
                    {effectiveIsGlobalAdmin && (
                      <Link
                        href="/admin"
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        <span>Admin Dashboard</span>
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
