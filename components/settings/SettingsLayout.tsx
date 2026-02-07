'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

// =====================================================
// TYPES
// =====================================================

interface SettingsItem {
  id: string
  label: string
  href: string
  icon: React.ReactNode
  description: string
  badge?: 'new' | 'admin' | 'coming'
  requiredAccess?: ('global_admin' | 'facility_admin' | 'user')[]
}

interface SettingsGroup {
  id: string
  label: string
  items: SettingsItem[]
}

// =====================================================
// ICONS
// =====================================================

const icons = {
  // General section icons
    checkin: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  overview: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  subscription: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  ),
  notifications: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  ),
  integrations: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
    </svg>
  ),
  // Existing icons
  facilities: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  users: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  procedures: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  ),
  milestones: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  surgeonPrefs: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  delays: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  rooms: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
    </svg>
  ),
  implantCompanies: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
    </svg>
  ),
  deviceReps: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  auditLog: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  financials: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  pricing: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
    </svg>
  ),
  payers: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  surgeonVariance: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  costCategories: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  ),
  cancellations: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
    </svg>
  ),
  analytics: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  flags: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
    </svg>
  ),
}

// =====================================================
// SETTINGS CONFIGURATION
// =====================================================

const settingsGroups: SettingsGroup[] = [
  // NEW: General section at the top
  {
    id: 'general',
    label: 'General',
    items: [
      {
        id: 'overview',
        label: 'Overview',
        href: '/settings/general',
        description: 'Facility details and account info',
        icon: icons.overview,
      },
      {
        id: 'notifications',
        label: 'Notifications',
        href: '/settings/notifications',
        description: 'Configure alert preferences',
        icon: icons.notifications,
        badge: 'coming',
        requiredAccess: ['global_admin', 'facility_admin'],
      },
      {
        id: 'subscription',
        label: 'Subscription',
        href: '/settings/subscription',
        description: 'Plan, usage, and billing',
        icon: icons.subscription,
        badge: 'coming',
        requiredAccess: ['global_admin', 'facility_admin'],
      },
    ],
  },
  {
    id: 'checkin',
    label: 'Patient Check-In',
    items: [
      {
        id: 'checkin-settings',
        label: 'Arrival Settings',
        href: '/settings/checkin',
        description: 'Configure arrival times',
        icon: icons.checkin,
        requiredAccess: ['global_admin', 'facility_admin'],
      },
      {
        id: 'checklist-builder',
        label: 'Checklist Builder',
        href: '/settings/checklist-builder',
        description: 'Customize pre-op checklist',
        icon: icons.checkin,
        requiredAccess: ['global_admin', 'facility_admin'],
      },
    ],
  },
  {
    id: 'organization',
    label: 'Organization',
    items: [
      {
        id: 'users',
        label: 'Users & Roles',
        href: '/settings/users',
        description: 'Staff accounts and permissions',
        icon: icons.users,
      },
    ],
  },
  {
    id: 'case-management',
    label: 'Case Management',
    items: [
      {
        id: 'procedures',
        label: 'Procedure Types',
        href: '/settings/procedures',
        description: 'Surgical procedures for case creation',
        icon: icons.procedures,
      },
      {
        id: 'milestones',
        label: 'Milestones',
        href: '/settings/milestones',
        description: 'Tracking points during cases',
        icon: icons.milestones,
      },
      {
        id: 'procedure-milestones',
        label: 'Procedure Milestones',
        href: '/settings/procedure-milestones',
        description: 'Which milestones appear per procedure',
        icon: icons.milestones,
        requiredAccess: ['global_admin', 'facility_admin'],
      },
      {
        id: 'surgeon-preferences',
        label: 'Surgeon Preferences',
        href: '/settings/surgeon-preferences',
        description: 'Quick-fill templates for surgeons',
        icon: icons.surgeonPrefs,
        badge: 'new',
        requiredAccess: ['global_admin', 'facility_admin'],
      },
      {
        id: 'delay-types',
        label: 'Delay Types',
        href: '/settings/delay-types',
        description: 'Categorize surgical delays',
        icon: icons.delays,
        requiredAccess: ['global_admin', 'facility_admin'],
      },
      {
        id: 'cancellation-reasons',
        label: 'Cancellation Reasons',
        href: '/settings/cancellation-reasons',
        description: 'Track why cases are cancelled',
        icon: icons.cancellations,
        requiredAccess: ['global_admin', 'facility_admin'],
      },
      {
        id: 'complexities',
        label: 'Case Complexities',
        href: '/settings/complexities',
        description: 'Complexity factors for cases',
        icon: icons.delays,
        requiredAccess: ['global_admin', 'facility_admin'],
      },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    items: [
      {
        id: 'rooms',
        label: 'OR Rooms',
        href: '/settings/rooms',
        description: 'Operating rooms for scheduling',
        icon: icons.rooms,
      },
      {
        id: 'analytics',
        label: 'Analytics',
        href: '/settings/analytics',
        description: 'FCOTS, utilization & metric targets',
        icon: icons.analytics,
        badge: 'new',
        requiredAccess: ['global_admin', 'facility_admin'],
      },
      {
        id: 'flags',
        label: 'Case Flags',
        href: '/settings/flags',
        description: 'Auto-detection rules & delay types',
        icon: icons.flags,
        badge: 'new',
        requiredAccess: ['global_admin', 'facility_admin'],
      },
      {
        id: 'implant-companies',
        label: 'Implant Companies',
        href: '/settings/implant-companies',
        description: 'Surgical implant vendors',
        icon: icons.implantCompanies,
        badge: 'new',
        requiredAccess: ['global_admin', 'facility_admin'],
      },
      {
        id: 'integrations',
        label: 'Integrations',
        href: '/settings/integrations',
        description: 'Connect external systems',
        icon: icons.integrations,
        badge: 'coming',
        requiredAccess: ['global_admin', 'facility_admin'],
      },
    ],
  },
  {
  id: 'financials',
  label: 'Financials',
  items: [
    {
      id: 'financials-overview',
      label: 'Overview',
      href: '/settings/financials',
      description: 'Financial settings dashboard',
      icon: icons.financials,
      requiredAccess: ['global_admin', 'facility_admin'],
    },
    {
      id: 'cost-categories',
      label: 'Cost Categories',
      href: '/settings/financials/cost-categories',
      description: 'Debit and credit categories',
      icon: icons.costCategories,
      requiredAccess: ['global_admin', 'facility_admin'],
    },
    {
      id: 'payers',
      label: 'Payers',
      href: '/settings/financials/payers',
      description: 'Insurance companies and contracts',
      icon: icons.payers,
      requiredAccess: ['global_admin', 'facility_admin'],
    },
    {
      id: 'procedure-pricing',
      label: 'Procedure Pricing',
      href: '/settings/financials/procedure-pricing',
      description: 'Costs and reimbursements per procedure',
      icon: icons.pricing,
      requiredAccess: ['global_admin', 'facility_admin'],
    },
    {
      id: 'surgeon-variance',
      label: 'Surgeon Variance',
      href: '/settings/financials/surgeon-variance',
      description: 'Surgeon-specific cost overrides',
      icon: icons.surgeonVariance,
      requiredAccess: ['global_admin', 'facility_admin'],
    },
  ],
},
  {
    id: 'device-reps',
    label: 'Device Reps',
    items: [
      {
        id: 'rep-access',
        label: 'Rep Access',
        href: '/settings/device-reps',
        description: 'Manage implant company rep access',
        icon: icons.deviceReps,
        badge: 'new',
        requiredAccess: ['global_admin', 'facility_admin'],
      },
    ],
  },
  {
    id: 'security',
    label: 'Security & Compliance',
    items: [
      {
        id: 'audit-log',
        label: 'Audit Log',
        href: '/settings/audit-log',
        description: 'System activity history',
        icon: icons.auditLog,
        badge: 'admin',
        requiredAccess: ['global_admin', 'facility_admin'],
      },
    ],
  },
]

// =====================================================
// COMPONENT
// =====================================================

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

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

  // Filter groups and items based on user's access level
  const visibleGroups = settingsGroups.map(group => ({
    ...group,
    items: group.items.filter(item => {
      if (!item.requiredAccess) return true
      if (!accessLevel) return false
      return item.requiredAccess.includes(accessLevel as 'global_admin' | 'facility_admin' | 'user')
    })
  })).filter(group => group.items.length > 0)

  // Check if current path is within a group (for highlighting section)
  const isInGroup = (groupId: string) => {
    const group = settingsGroups.find(g => g.id === groupId)
    if (!group) return false
    return group.items.some(item => pathname.startsWith(item.href))
  }

  // Render badge
  const renderBadge = (badge?: 'new' | 'admin' | 'coming') => {
    if (!badge) return null
    
    if (badge === 'new') {
      return (
        <span className="ml-auto px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-emerald-100 text-emerald-700 rounded">
          New
        </span>
      )
    }
    
    if (badge === 'admin') {
      return (
        <span className="ml-auto px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-amber-100 text-amber-700 rounded">
          Admin
        </span>
      )
    }

    if (badge === 'coming') {
      return (
        <span className="ml-auto px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-slate-100 text-slate-500 rounded">
          Soon
        </span>
      )
    }
  }

  return (
    <div className="flex gap-8">
      {/* Sidebar */}
      <div className={`${sidebarCollapsed ? 'w-16' : 'w-72'} flex-shrink-0 transition-all duration-200`}>
        <div className="sticky top-24">
          {/* Collapse Toggle */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="mb-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg 
              className={`w-5 h-5 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>

          {loading ? (
            // Loading skeleton
            <div className="space-y-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-2">
                  <div className="h-3 bg-slate-200 rounded w-20 animate-pulse" />
                  <div className="space-y-1">
                    {[1, 2].map((j) => (
                      <div key={j} className="flex items-center gap-3 px-3 py-2.5 rounded-lg">
                        <div className="w-5 h-5 bg-slate-200 rounded animate-pulse" />
                        {!sidebarCollapsed && <div className="h-4 bg-slate-200 rounded w-24 animate-pulse" />}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <nav className="space-y-6">
              {visibleGroups.map((group) => (
                <div key={group.id}>
                  {/* Group Header */}
                  {!sidebarCollapsed && (
                    <h3 className={`px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider ${
                      isInGroup(group.id) ? 'text-blue-600' : 'text-slate-400'
                    }`}>
                      {group.label}
                    </h3>
                  )}
                  
                  {/* Group Items */}
                  <div className="space-y-1">
                    {group.items.map((item) => {
                      const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                      
                      return (
                        <Link
                          key={item.id}
                          href={item.href}
                          className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                            isActive
                              ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/10'
                              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                          }`}
                          title={sidebarCollapsed ? item.label : undefined}
                        >
                          <span className={`flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'}`}>
                            {item.icon}
                          </span>
                          
                          {!sidebarCollapsed && (
                            <>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{item.label}</p>
                                {!isActive && (
                                  <p className="text-xs text-slate-400 truncate mt-0.5 group-hover:text-slate-500">
                                    {item.description}
                                  </p>
                                )}
                              </div>
                              {renderBadge(item.badge)}
                            </>
                          )}
                        </Link>
                      )
                    })}
                  </div>
                </div>
              ))}
            </nav>
          )}

          {/* Help Card */}
          {!sidebarCollapsed && (
            <div className="mt-8 p-4 bg-gradient-to-br from-slate-100 to-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2 text-slate-900 font-medium mb-2">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Need Help?
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Changes here apply to new cases. Existing cases won't be affected.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
          <p className="text-slate-500 mt-1">{description}</p>
        </div>
        
        {/* Page Content */}
        {children}
      </div>
    </div>
  )
}