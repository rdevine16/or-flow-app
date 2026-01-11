'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function SettingsPage() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function redirectBasedOnRole() {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        const { data } = await supabase
          .from('users')
          .select('access_level')
          .eq('id', user.id)
          .single()
        
        if (data?.access_level === 'global_admin') {
          router.replace('/settings/facilities')
        } else {
          router.replace('/settings/procedures')
        }
      } else {
        router.replace('/settings/procedures')
      }
    }
    
    redirectBasedOnRole()
  }, [router, supabase])

  // Show loading while determining redirect
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-500">Loading settings...</p>
      </div>
    </div>
  )
}
