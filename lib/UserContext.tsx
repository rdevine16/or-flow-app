// lib/UserContext.tsx
'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from './supabase'
import { getImpersonationState } from './impersonation'

interface UserData {
  userId: string | null
  userEmail: string | null
  firstName: string
  lastName: string
  accessLevel: 'global_admin' | 'facility_admin' | 'user'
  facilityId: string | null
  facilityName: string | null
  facilityTimezone: string
}

interface UserContextType {
  userData: UserData
  loading: boolean
  isGlobalAdmin: boolean
  isFacilityAdmin: boolean
  isAdmin: boolean
  isImpersonating: boolean
  impersonatedFacilityId: string | null
  impersonatedFacilityName: string | null
  effectiveFacilityId: string | null
  refreshImpersonation: () => void
}

const defaultUserData: UserData = {
  userId: null,
  userEmail: null,
  firstName: '',
  lastName: '',
  accessLevel: 'user',
  facilityId: null,
  facilityName: null,
  facilityTimezone: 'America/New_York',
}

const UserContext = createContext<UserContextType>({
  userData: defaultUserData,
  loading: true,
  isGlobalAdmin: false,
  isFacilityAdmin: false,
  isAdmin: false,
  isImpersonating: false,
  impersonatedFacilityId: null,
  impersonatedFacilityName: null,
  effectiveFacilityId: null,
  refreshImpersonation: () => {},
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

    const fetchUser = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        
        if (!isMounted) return
        
        if (!user) {
          setUserData(defaultUserData)
          setLoading(false)
          return
        }

        // Store auth user info immediately
        const authUserId = user.id
        const authUserEmail = user.email || null

        const { data: userRecord, error: dbError } = await supabase
          .from('users')
          .select(`
            first_name,
            last_name,
            access_level,
            facility_id,
            facilities (name, timezone)
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

          setUserData({
            userId: authUserId,
            userEmail: authUserEmail,
            firstName: userRecord.first_name || '',
            lastName: userRecord.last_name || '',
            accessLevel: userRecord.access_level || 'user',
            facilityId: userRecord.facility_id,
            facilityName: facility?.name || null,
            facilityTimezone: facility?.timezone || 'America/New_York',
          })
        }
      } catch (error) {
        console.error('UserContext: Error', error)
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

    return () => {
      isMounted = false
      subscription.unsubscribe()
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [supabase, router])

  const isGlobalAdmin = userData.accessLevel === 'global_admin'
  const isFacilityAdmin = userData.accessLevel === 'facility_admin'
  const isAdmin = isGlobalAdmin || isFacilityAdmin
  const isImpersonating = isGlobalAdmin && impersonatedFacilityId !== null
  const effectiveFacilityId = isImpersonating ? impersonatedFacilityId : userData.facilityId

  return (
    <UserContext.Provider value={{
      userData,
      loading,
      isGlobalAdmin,
      isFacilityAdmin,
      isAdmin,
      isImpersonating,
      impersonatedFacilityId,
      impersonatedFacilityName,
      effectiveFacilityId,
      refreshImpersonation,
    }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  return useContext(UserContext)
}