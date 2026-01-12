'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { createClient } from './supabase'

// User data type - matches what DashboardLayout uses
interface UserData {
  firstName: string
  lastName: string
  accessLevel: 'global_admin' | 'facility_admin' | 'user'
  facilityId: string | null
  facilityName: string | null
}

interface UserContextType {
  userData: UserData
  loading: boolean
  isGlobalAdmin: boolean
  isFacilityAdmin: boolean
  isAdmin: boolean
}

const defaultUserData: UserData = {
  firstName: '',
  lastName: '',
  accessLevel: 'user',
  facilityId: null,
  facilityName: null,
}

const UserContext = createContext<UserContextType>({
  userData: defaultUserData,
  loading: true,
  isGlobalAdmin: false,
  isFacilityAdmin: false,
  isAdmin: false,
})

export function UserProvider({ children }: { children: ReactNode }) {
  const supabase = createClient()
  const [userData, setUserData] = useState<UserData>(defaultUserData)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchUser() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        
        if (user) {
          const { data: userRecord } = await supabase
            .from('users')
            .select(`
              first_name,
              last_name,
              access_level,
              facility_id,
              facilities (name)
            `)
            .eq('id', user.id)
            .single()
          
          if (userRecord) {
            const facilities = userRecord.facilities as { name: string }[] | null
            const facility = facilities?.[0] || null
            setUserData({
              firstName: userRecord.first_name,
              lastName: userRecord.last_name,
              accessLevel: userRecord.access_level,
              facilityId: userRecord.facility_id,
              facilityName: facility?.name || null,
            })
          }
        }
      } catch (error) {
        console.error('Error fetching user:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchUser()
  }, [])

  const isGlobalAdmin = userData.accessLevel === 'global_admin'
  const isFacilityAdmin = userData.accessLevel === 'facility_admin'
  const isAdmin = isGlobalAdmin || isFacilityAdmin

  return (
    <UserContext.Provider value={{ userData, loading, isGlobalAdmin, isFacilityAdmin, isAdmin }}>
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
