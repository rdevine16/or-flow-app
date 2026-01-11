'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

interface SettingsSection {
  id: string
  label: string
  href: string
  icon: React.ReactNode
  description: string
  requiredAccess?: ('global_admin' | 'facility_admin' | 'user')[]
}

const settingsSections: SettingsSection[] = [
  {
    id: 'facilities',
    label: 'Facilities',
    href: '/settings/facilities',
    description: 'Manage hospitals and surgery centers',
    requiredAccess: ['global_admin'], // Only global admins see this
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    id: 'procedures',
    label: 'Procedure Types',
    href: '/settings/procedures',
    description: 'Manage surgical procedure types',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
  {
    id: 'rooms',
    label: 'OR Rooms',
    href: '/settings/rooms',
    description: 'Manage operating rooms',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
      </svg>
    ),
  },
  {
    id: 'milestones',
    label: 'Milestones',
    href: '/settings/milestones',
    description: 'Configure surgical milestones',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: 'users',
    label: 'Users & Roles',
    href: '/settings/users',
    description: 'Manage staff and permissions',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
]

interface SettingsLayoutProps {
  children: React.ReactNode
  title: string
  description: string
}

export default function SettingsLayout({ children, title, description }: SettingsLayoutProps) {
  const pathname = usePathname()
  const supabase = createClient()
  const [accessLevel, setAccessLevel] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchAccessLevel() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase
          .from('users')
          .select('access_level')
          .eq('id', user.id)
          .single()
        
        if (data) {
          setAccessLevel(data.access_level)
        }
      }
      setLoading(false)
    }
    fetchAccessLevel()
  }, [])

  // Filter sections based on user's access level
  const visibleSections = settingsSections.filter(section => {
    if (!section.requiredAccess) return true // No restriction = everyone can see
    if (!accessLevel) return false // Still loading or no access level
    return section.requiredAccess.includes(accessLevel as any)
  })

  return (
    <div className="flex gap-8">
      {/* Sidebar */}
      <div className="w-64 flex-shrink-0">
        <div className="sticky top-24">
          <nav className="space-y-1">
            {loading ? (
              // Loading skeleton
              <>
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl">
                    <div className="w-5 h-5 bg-slate-200 rounded animate-pulse" />
                    <div className="h-4 bg-slate-200 rounded w-24 animate-pulse" />
                  </div>
                ))}
              </>
            ) : (
              visibleSections.map((section) => {
                const isActive = pathname === section.href
                return (
                  <Link
                    key={section.id}
                    href={section.href}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                      isActive
                        ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/10'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <span className={isActive ? 'text-white' : 'text-slate-400'}>
                      {section.icon}
                    </span>
                    <div>
                      <p className="font-medium text-sm">{section.label}</p>
                    </div>
                  </Link>
                )
              })
            )}
          </nav>

          {/* Help Card */}
          <div className="mt-8 p-4 bg-gradient-to-br from-slate-100 to-slate-50 rounded-xl border border-slate-200">
            <div className="flex items-center gap-2 text-slate-900 font-medium mb-2">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Need Help?
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Changes made here will apply to all new cases. Existing cases won't be affected.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
          <p className="text-slate-500 mt-1">{description}</p>
        </div>
        {children}
      </div>
    </div>
  )
}
