// lib/UserContext.tsx
'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { logger } from './logger'
import { createClient } from './supabase'
import { getImpersonationState } from './impersonation'
import { usePermissions } from '@/lib/hooks/usePermissions'
import { useSubscriptionTier } from '@/lib/hooks/useSubscriptionTier'
import type { TierSlug, TierFeatureKey } from '@/lib/tier-config'

interface UserData {
  userId: string | null
  userEmail: string | null
  firstName: string
  lastName: string
  profileImageUrl: string | null
  accessLevel: 'global_admin' | 'facility_admin' | 'coordinator' | 'user'
  roleName: string | null
  facilityId: string | null
  facilityName: string | null
  facilityTimezone: string
}

interface UserContextType {
  userData: UserData
  loading: boolean
  isGlobalAdmin: boolean
  isAdmin: boolean
  isImpersonating: boolean
  impersonatedFacilityId: string | null
  impersonatedFacilityName: string | null
  effectiveFacilityId: string | null
  refreshImpersonation: () => void
  // Permission system
  can: (key: string) => boolean
  canAny: (...keys: string[]) => boolean
  canAll: (...keys: string[]) => boolean
  permissionsLoading: boolean
  // Subscription tier
  tier: TierSlug
  tierName: string
  tierLoading: boolean
  isTierAtLeast: (requiredTier: TierSlug) => boolean
  hasFeature: (feature: TierFeatureKey) => boolean
}

const defaultUserData: UserData = {
  userId: null,
  userEmail: null,
  firstName: '',
  lastName: '',
  profileImageUrl: null,
  accessLevel: 'user',
  roleName: null,
  facilityId: null,
  facilityName: null,
  facilityTimezone: 'America/New_York',
}

const defaultCan = () => false
const defaultCanMulti = () => false
const defaultIsTierAtLeast = () => true // Default to true (enterprise) before data loads
const defaultHasFeature = () => true

const UserContext = createContext<UserContextType>({
  userData: defaultUserData,
  loading: true,
  isGlobalAdmin: false,
  isAdmin: false,
  isImpersonating: false,
  impersonatedFacilityId: null,
  impersonatedFacilityName: null,
  effectiveFacilityId: null,
  refreshImpersonation: () => {},
  can: defaultCan,
  canAny: defaultCanMulti,
  canAll: defaultCanMulti,
  permissionsLoading: true,
  tier: 'enterprise',
  tierName: 'Enterprise',
  tierLoading: true,
  isTierAtLeast: defaultIsTierAtLeast,
  hasFeature: defaultHasFeature,
})

export function UserProvider({ children }: { children: ReactNode }) {
  const supabase = createClient()
  const router = useRouter()
  const [userData, setUserData] = useState<UserData>(defaultUserData)
  const [loading, setLoading] = useState(true)
  const [impersonatedFacilityId, setImpersonatedFacilityId] = useState<string | null>(null)
  const [impersonatedFacilityName, setImpersonatedFacilityName] = useState<string | null>(null)

  const refreshImpersonation = () => {
    const impersonation = getImpersonationState()
    if (impersonation) {
      setImpersonatedFacilityId(impersonation.facilityId)
      setImpersonatedFacilityName(impersonation.facilityName)
    } else {
      setImpersonatedFacilityId(null)
      setImpersonatedFacilityName(null)
    }
  }

  useEffect(() => {
    let isMounted = true

    const fetchUser = async (retryCount = 0) => {
      try {
        const { data: { user } } = await supabase.auth.getUser()

        if (!isMounted) return

        if (!user) {
          setUserData(defaultUserData)
          setLoading(false)
          return
        }

        // Store auth user info immediately
        const authUserId = user.id
        const authUserEmail = user.email || null

        const { data: userRecord } = await supabase
          .from('users')
          .select(`
            first_name,
            last_name,
            profile_image_url,
            access_level,
            facility_id,
            facilities (name, timezone),
            role:user_roles(name)
          `)
          .eq('id', user.id)
          .single()

        if (!isMounted) return

        if (userRecord) {
          const facilities = userRecord.facilities as { name: string; timezone: string }[] | { name: string; timezone: string } | null

          // Handle both array and single object from Supabase
          let facility: { name: string; timezone: string } | null = null
          if (Array.isArray(facilities)) {
            facility = facilities[0] || null
          } else if (facilities) {
            facility = facilities
          }

          // Extract role name from join
          const roleData = userRecord.role as { name: string } | { name: string }[] | null
          const roleName = Array.isArray(roleData)
            ? roleData[0]?.name ?? null
            : roleData?.name ?? null

          setUserData({
            userId: authUserId,
            userEmail: authUserEmail,
            firstName: userRecord.first_name || '',
            lastName: userRecord.last_name || '',
            profileImageUrl: userRecord.profile_image_url || null,
            accessLevel: userRecord.access_level || 'user',
            roleName,
            facilityId: userRecord.facility_id,
            facilityName: facility?.name || null,
            facilityTimezone: facility?.timezone || 'America/New_York',
          })
        }
      } catch (error) {
        // Retry once on transient network failures before giving up
        if (retryCount < 1 && error instanceof TypeError && isMounted) {
          logger('UserContext').warn('Network error fetching user, retrying...', error)
          setTimeout(() => fetchUser(retryCount + 1), 1000)
          return
        }
        logger('UserContext').error('Failed to fetch user', error)
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    fetchUser()
    refreshImpersonation()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          setUserData(defaultUserData)
          setImpersonatedFacilityId(null)
          setImpersonatedFacilityName(null)
          setLoading(false)
          router.push('/login')
        } else if (event === 'SIGNED_IN' && session?.user) {
          setLoading(true)
          fetchUser()
          refreshImpersonation()
        }
      }
    )

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'orbit-impersonation') {
        refreshImpersonation()
      }
    }
    window.addEventListener('storage', handleStorageChange)

    // Prevent scroll wheel from changing focused number inputs
    const handleWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'number') {
        ;(target as HTMLInputElement).blur()
      }
    }
    document.addEventListener('wheel', handleWheel, { passive: true })

    return () => {
      isMounted = false
      subscription.unsubscribe()
      window.removeEventListener('storage', handleStorageChange)
      document.removeEventListener('wheel', handleWheel)
    }
  }, [supabase, router])

  const isGlobalAdmin = userData.accessLevel === 'global_admin'
  const isAdmin = isGlobalAdmin || userData.accessLevel === 'facility_admin'
  const isImpersonating = isGlobalAdmin && impersonatedFacilityId !== null
  const effectiveFacilityId = isImpersonating ? impersonatedFacilityId : userData.facilityId

  // Permissions: fetch when user data is loaded
  const {
    can,
    canAny,
    canAll,
    loading: permissionsLoading,
  } = usePermissions(userData.accessLevel, !loading && !!userData.userId)

  // Subscription tier: fetch for the effective facility
  const {
    tier,
    tierName,
    loading: tierLoading,
    isTierAtLeast,
    hasFeature,
  } = useSubscriptionTier(effectiveFacilityId)

  return (
    <UserContext.Provider value={{
      userData,
      loading,
      isGlobalAdmin,
      isAdmin,
      isImpersonating,
      impersonatedFacilityId,
      impersonatedFacilityName,
      effectiveFacilityId,
      refreshImpersonation,
      can,
      canAny,
      canAll,
      permissionsLoading,
      tier,
      tierName,
      tierLoading,
      isTierAtLeast,
      hasFeature,
    }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  return useContext(UserContext)
}