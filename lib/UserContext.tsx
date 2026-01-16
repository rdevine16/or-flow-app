'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { createClient } from './supabase'
import { getImpersonationState } from './impersonation'

// User data type - matches what DashboardLayout uses
interface UserData {
  firstName: string
  lastName: string
  accessLevel: 'global_admin' | 'facility_admin' | 'user'
  facilityId: string | null
  facilityName: string | null
  facilityTimezone: string  // Added for timezone support
}

interface UserContextType {
  userData: UserData
  loading: boolean
  isGlobalAdmin: boolean
  isFacilityAdmin: boolean
  isAdmin: boolean
  // NEW: Impersonation-aware properties
  isImpersonating: boolean
  impersonatedFacilityId: string | null
  impersonatedFacilityName: string | null
  effectiveFacilityId: string | null  // USE THIS for all queries
  refreshImpersonation: () => void    // Call after starting/ending impersonation
}

const defaultUserData: UserData = {
  firstName: '',
  lastName: '',
  accessLevel: 'user',
  facilityId: null,
  facilityName: null,
  facilityTimezone: 'America/New_York',  // Default fallback
}

const UserContext = createContext<UserContextType>({
  userData: defaultUserData,
  loading: true,
  isGlobalAdmin: false,
  isFacilityAdmin: false,
  isAdmin: false,
  // Impersonation defaults
  isImpersonating: false,
  impersonatedFacilityId: null,
  impersonatedFacilityName: null,
  effectiveFacilityId: null,
  refreshImpersonation: () => {},
})

export function UserProvider({ children }: { children: ReactNode }) {
  const supabase = createClient()
  const [userData, setUserData] = useState<UserData>(defaultUserData)
  const [loading, setLoading] = useState(true)
  
  // Impersonation state
  const [impersonatedFacilityId, setImpersonatedFacilityId] = useState<string | null>(null)
  const [impersonatedFacilityName, setImpersonatedFacilityName] = useState<string | null>(null)

  // Function to check/refresh impersonation state from localStorage
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

  // Extract fetchUser so we can call it from auth listener
const fetchUser = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    console.log('Auth user:', user)  // ← Add this
    
    if (user) {
      const { data: userRecord, error } = await supabase
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
      
      console.log('User record:', userRecord, 'Error:', error) 
        
        if (userRecord) {
          const facilities = userRecord.facilities as { name: string; timezone: string }[] | null
          const facility = facilities?.[0] || null
          setUserData({
            firstName: userRecord.first_name,
            lastName: userRecord.last_name,
            accessLevel: userRecord.access_level,
            facilityId: userRecord.facility_id,
            facilityName: facility?.name || null,
            facilityTimezone: facility?.timezone || 'America/New_York',
          })
        }
      } else {
        // No user - reset to defaults
        setUserData(defaultUserData)
      }
    } catch (error) {
      console.error('Error fetching user:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Initial fetch
    fetchUser()
    
    // Check impersonation state on mount
    refreshImpersonation()
    
    // Listen for auth state changes (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          // Clear all user state
          setUserData(defaultUserData)
          setImpersonatedFacilityId(null)
          setImpersonatedFacilityName(null)
          setLoading(false)
        } else if (event === 'SIGNED_IN' && session?.user) {
          // New user signed in - re-fetch their data
          setLoading(true)
          await fetchUser()
          refreshImpersonation()
        }
      }
    )
    
    // Listen for storage changes (in case impersonation starts/ends in another tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'orbit-impersonation') {
        refreshImpersonation()
      }
    }
    
    window.addEventListener('storage', handleStorageChange)
    
    return () => {
      subscription.unsubscribe()
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])

  const isGlobalAdmin = userData.accessLevel === 'global_admin'
  const isFacilityAdmin = userData.accessLevel === 'facility_admin'
  const isAdmin = isGlobalAdmin || isFacilityAdmin
  
  // Impersonation is only active for global admins
  const isImpersonating = isGlobalAdmin && impersonatedFacilityId !== null
  
  // THE KEY: Use impersonated facility if active, otherwise user's actual facility
  const effectiveFacilityId = isImpersonating 
    ? impersonatedFacilityId 
    : userData.facilityId

  return (
    <UserContext.Provider value={{ 
      userData, 
      loading, 
      isGlobalAdmin, 
      isFacilityAdmin, 
      isAdmin,
      // Impersonation values
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

// Hook to use the context
export function useUser() {
  const context = useContext(UserContext)
  if (!context) {
    throw new Error('useUser must be used within a UserProvider')
  }
  return context
}
