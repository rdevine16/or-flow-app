// components/layouts/DashboardLayout.tsx
// Main layout orchestrator - composes Sidebar, Header, and content panels
// Reduced from ~900 lines to ~250 lines by extracting components

'use client'

import { useState, useEffect, useMemo } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import { useSubNav } from '@/lib/SubNavContext'
import { getImpersonationState, endImpersonation } from '@/lib/impersonation'
import { authAudit, adminAudit } from '@/lib/audit-logger'
import ErrorBoundary from '../ErrorBoundary'
import { useToast } from '@/components/ui/Toast/ToastProvider'


// Layout components
import Sidebar from './Sidebar'
import SubNavigation, { SUBNAV_WIDTH } from './SubNavigation'
import Header, { TrialBanner, ImpersonationBanner, BranchBanner } from './Header'
import BlockedScreen from './BlockedScreen'
import { getFilteredNavigation, SIDEBAR_COLLAPSED, SIDEBAR_EXPANDED } from './navigation-config'

interface DashboardLayoutProps {
  children: React.ReactNode
}

interface ImpersonationState {
  facilityId: string
  facilityName: string
  facilityLogo: string | null
  sessionId: string
}

interface FacilityStatus {
  subscriptionStatus: string | null
  trialEndsAt: string | null
  facilityName: string | null
  facilityLogo: string | null
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  // User data from context
  const { userData, loading, isGlobalAdmin, isAdmin, can } = useUser()

  // Sub-nav from context
  const { items: subNavItems, title: subNavTitle, isVisible: hasSubNav } = useSubNav()
  const { showToast } = useToast() 
  // Local state
  const [mounted, setMounted] = useState(false)
  const [sidebarExpanded, setSidebarExpanded] = useState(false)
  const [impersonation, setImpersonation] = useState<ImpersonationState | null>(null)
  const [facilityStatus, setFacilityStatus] = useState<FacilityStatus | null>(null)
  const [mustChangePassword, setMustChangePassword] = useState(false)
  const [userAccessLevel, setUserAccessLevel] = useState<string | null>(null)

  // Derived state
  const effectiveIsGlobalAdmin = userAccessLevel === 'global_admin' || isGlobalAdmin
  const isAdminMode = effectiveIsGlobalAdmin && !impersonation
  const navigation = isAdminMode ? [] : getFilteredNavigation(userData.accessLevel, can)
  const sidebarWidth = sidebarExpanded ? SIDEBAR_EXPANDED : SIDEBAR_COLLAPSED
  const contentMarginLeft = sidebarWidth + (hasSubNav ? SUBNAV_WIDTH : 0)
  // ============================================
  // Effects
  // ============================================

  // Check facility access
  useEffect(() => {
    
    async function checkFacilityAccess() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          return
        }

        const { data: userRecord } = await supabase
          .from('users')
          .select('facility_id, must_change_password, access_level')
          .eq('id', user.id)
          .single()

        if (userRecord?.access_level) setUserAccessLevel(userRecord.access_level)
        if (userRecord?.must_change_password) {
          setMustChangePassword(true)
          return
        }
        if (userRecord?.access_level === 'global_admin') {
          return
        }
        if (!userRecord?.facility_id) {
          return
        }

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
} catch (error) {
  showToast({
    type: 'error',
    title: 'Access Check Failed',
    message: error instanceof Error ? error.message : 'Unable to verify facility access'
  })
}
    }
    if (!loading) checkFacilityAccess()
  }, [loading, supabase, showToast])

  // Load impersonation state
  useEffect(() => {
    async function loadImpersonation() {
      const impState = getImpersonationState()
      if (impState && effectiveIsGlobalAdmin) {
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

  // ============================================
  // Handlers
  // ============================================

  const handleEndImpersonation = async () => {
    if (impersonation) {
      await adminAudit.impersonationEnded(supabase, impersonation.facilityName, impersonation.facilityId)
    }
    await endImpersonation(supabase)
    setImpersonation(null)
    router.push('/admin/facilities')
  }

  const handleLogout = async () => {
    if (impersonation) {
      await adminAudit.impersonationEnded(supabase, impersonation.facilityName, impersonation.facilityId)
      await endImpersonation(supabase)
    }
    await authAudit.logout(supabase)
    await supabase.auth.signOut()
    router.push('/login')
  }

  // ============================================
  // Trial/Access Helpers
  // ============================================

  const isTrialExpired = () => {
    if (!facilityStatus) return false
    if (facilityStatus.subscriptionStatus !== 'trial') return false
    if (!facilityStatus.trialEndsAt) return false
    return new Date(facilityStatus.trialEndsAt) < new Date()
  }

  const isDisabled = () => facilityStatus?.subscriptionStatus === 'disabled'

  const trialDaysRemaining = useMemo(() => {
    if (!facilityStatus?.trialEndsAt || facilityStatus.subscriptionStatus !== 'trial') return null
    // eslint-disable-next-line react-hooks/purity
    const diff = new Date(facilityStatus.trialEndsAt).getTime() - Date.now()
    return Math.ceil(diff / 86400000)
  }, [facilityStatus?.trialEndsAt, facilityStatus?.subscriptionStatus])
  const showTrialWarning = trialDaysRemaining !== null && trialDaysRemaining > 0 && trialDaysRemaining <= 7

  // ============================================
  // Loading/Redirect States
  // ============================================

  if (!mounted) {
    return <LoadingScreen message="Loading..." />
  }

  if (!loading && !userData.firstName && !userData.lastName) {
    router.push('/login')
    return <LoadingScreen message="Redirecting..." />
  }

  if (mustChangePassword) {
    router.push('/auth/change-password')
    return null
  }

  if (isTrialExpired() && !effectiveIsGlobalAdmin) {
    return <BlockedScreen type="trial" facilityName={facilityStatus?.facilityName} onLogout={handleLogout} />
  }

  if (isDisabled() && !effectiveIsGlobalAdmin) {
    return <BlockedScreen type="disabled" facilityName={facilityStatus?.facilityName} onLogout={handleLogout} />
  }

  // ============================================
  // Main Render
  // ============================================

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Panel 1: Sidebar */}
      <Sidebar
        pathname={pathname}
        isAdminMode={isAdminMode}
        navigation={navigation}
        onExpandChange={setSidebarExpanded}
      />

      {/* Panel 2: Sub-Navigation (if visible) */}
      {hasSubNav && (
        <SubNavigation
          items={subNavItems}
          title={subNavTitle}
          pathname={pathname}
          sidebarWidth={sidebarWidth}
        />
      )}

      {/* Panel 3: Main Content */}
      <div
        style={{ marginLeft: contentMarginLeft }}
        className="min-h-screen flex flex-col transition-all duration-300 ease-out"
      >
        {/* Banners */}
        <BranchBanner />
        {showTrialWarning && <TrialBanner daysRemaining={trialDaysRemaining!} />}
        {impersonation && effectiveIsGlobalAdmin && (
          <ImpersonationBanner
            facilityName={impersonation.facilityName}
            onEndImpersonation={handleEndImpersonation}
          />
        )}

        {/* Header */}
        <Header
          pathname={pathname}
          navigation={navigation}
          userData={userData}
          impersonation={impersonation}
          facilityStatus={facilityStatus}
          isAdmin={isAdmin}
          onEndImpersonation={handleEndImpersonation}
          onLogout={handleLogout}
        />

        {/* Page Content */}
        <main className="flex-1 p-6">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}

// ============================================
// Loading Screen
// ============================================

function LoadingScreen({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-2 border-slate-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-500 font-medium">{message}</p>
      </div>
    </div>
  )
}
