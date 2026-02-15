'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useUser } from '@/lib/UserContext'
import { AlertTriangle, Ban, BarChart3, Bell, Building2, Calculator, ChevronsLeft, ClipboardCheck, ClipboardList, Clock, CreditCard, DollarSign, FileText, Flag, FlaskConical, Info, KeyRound, LayoutGrid, Puzzle, Tag, User, Users, Zap } from 'lucide-react'

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
  /** Permission key for can() gating. When set, takes precedence over requiredAccess. */
  permission?: string
  requiredAccess?: ('global_admin' | 'facility_admin' | 'coordinator' | 'user')[]
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
    <ClipboardCheck className="w-5 h-5" />
  ),
  overview: (
    <Building2 className="w-5 h-5" />
  ),
  subscription: (
    <CreditCard className="w-5 h-5" />
  ),
  notifications: (
    <Bell className="w-5 h-5" />
  ),
  integrations: (
    <Puzzle className="w-5 h-5" />
  ),
  // Existing icons
  facilities: (
    <Building2 className="w-5 h-5" />
  ),
  users: (
    <Users className="w-5 h-5" />
  ),
  procedures: (
    <ClipboardList className="w-5 h-5" />
  ),
  milestones: (
    <Clock className="w-5 h-5" />
  ),
  surgeonPrefs: (
    <Zap className="w-5 h-5" />
  ),
  delays: (
    <AlertTriangle className="w-5 h-5" />
  ),
  rooms: (
    <LayoutGrid className="w-5 h-5" />
  ),
  implantCompanies: (
    <FlaskConical className="w-5 h-5" />
  ),
  deviceReps: (
    <Users className="w-5 h-5" />
  ),
  auditLog: (
    <FileText className="w-5 h-5" />
  ),
  financials: (
    <DollarSign className="w-5 h-5" />
  ),
  pricing: (
    <Tag className="w-5 h-5" />
  ),
  payers: (
    <Building2 className="w-5 h-5" />
  ),
  surgeonVariance: (
    <User className="w-5 h-5" />
  ),
  costCategories: (
    <Calculator className="w-5 h-5" />
  ),
  cancellations: (
    <Ban className="w-5 h-5" />
  ),
  analytics: (
    <BarChart3 className="w-5 h-5" />
  ),
  flags: (
    <Flag className="w-5 h-5" />
  ),
  permissions: (
    <KeyRound className="w-5 h-5" />
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
        permission: 'settings.manage',
      },
      {
        id: 'subscription',
        label: 'Subscription',
        href: '/settings/subscription',
        description: 'Plan, usage, and billing',
        icon: icons.subscription,
        badge: 'coming',
        permission: 'settings.manage',
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
        permission: 'settings.manage',
      },
      {
        id: 'checklist-builder',
        label: 'Checklist Builder',
        href: '/settings/checklist-builder',
        description: 'Customize pre-op checklist',
        icon: icons.checkin,
        permission: 'settings.manage',
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
      {
        id: 'permissions',
        label: 'Roles & Permissions',
        href: '/settings/permissions',
        description: 'Configure access per role',
        icon: icons.permissions,
        permission: 'users.manage',
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
        permission: 'settings.manage',
      },
      {
        id: 'surgeon-preferences',
        label: 'Surgeon Preferences',
        href: '/settings/surgeon-preferences',
        description: 'Quick-fill templates for surgeons',
        icon: icons.surgeonPrefs,
        badge: 'new',
        permission: 'settings.manage',
      },
      {
        id: 'delay-types',
        label: 'Delay Types',
        href: '/settings/delay-types',
        description: 'Categorize surgical delays',
        icon: icons.delays,
        permission: 'settings.manage',
      },
      {
        id: 'cancellation-reasons',
        label: 'Cancellation Reasons',
        href: '/settings/cancellation-reasons',
        description: 'Track why cases are cancelled',
        icon: icons.cancellations,
        permission: 'settings.manage',
      },
      {
        id: 'complexities',
        label: 'Case Complexities',
        href: '/settings/complexities',
        description: 'Complexity factors for cases',
        icon: icons.delays,
        permission: 'settings.manage',
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
        permission: 'settings.manage',
      },
      {
        id: 'flags',
        label: 'Case Flags',
        href: '/settings/flags',
        description: 'Auto-detection rules & delay types',
        icon: icons.flags,
        badge: 'new',
        permission: 'settings.manage',
      },
      {
        id: 'implant-companies',
        label: 'Implant Companies',
        href: '/settings/implant-companies',
        description: 'Surgical implant vendors',
        icon: icons.implantCompanies,
        badge: 'new',
        permission: 'settings.manage',
      },
      {
        id: 'integrations',
        label: 'Integrations',
        href: '/settings/integrations',
        description: 'Connect external systems',
        icon: icons.integrations,
        badge: 'coming',
        permission: 'settings.manage',
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
      permission: 'financials.view',
    },
    {
      id: 'cost-categories',
      label: 'Cost Categories',
      href: '/settings/financials/cost-categories',
      description: 'Debit and credit categories',
      icon: icons.costCategories,
      permission: 'financials.view',
    },
    {
      id: 'payers',
      label: 'Payers',
      href: '/settings/financials/payers',
      description: 'Insurance companies and contracts',
      icon: icons.payers,
      permission: 'financials.view',
    },
    {
      id: 'procedure-pricing',
      label: 'Procedure Pricing',
      href: '/settings/financials/procedure-pricing',
      description: 'Costs and reimbursements per procedure',
      icon: icons.pricing,
      permission: 'financials.view',
    },
    {
      id: 'surgeon-variance',
      label: 'Surgeon Variance',
      href: '/settings/financials/surgeon-variance',
      description: 'Surgeon-specific cost overrides',
      icon: icons.surgeonVariance,
      permission: 'financials.view',
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
        permission: 'settings.manage',
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
        permission: 'audit.view',
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
  const { userData, loading, can } = useUser()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Filter groups and items based on permissions (preferred) or access level (fallback)
  const visibleGroups = settingsGroups.map(group => ({
    ...group,
    items: group.items.filter(item => {
      // Permission key takes precedence — use can() for dynamic resolution
      if (item.permission) return can(item.permission)
      // Fallback to role-based filtering for items without permission keys
      if (!item.requiredAccess) return true
      if (!userData.accessLevel) return false
      return item.requiredAccess.includes(userData.accessLevel)
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
        <span className="ml-auto px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide bg-green-100 text-green-600 rounded">
          New
        </span>
      )
    }
    
    if (badge === 'admin') {
      return (
        <span className="ml-auto px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide bg-amber-100 text-amber-700 rounded">
          Admin
        </span>
      )
    }

    if (badge === 'coming') {
      return (
        <span className="ml-auto px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide bg-slate-100 text-slate-500 rounded">
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
            <ChevronsLeft 
              className={`w-5 h-5 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`} 
            />
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
                    <h3 className={`px-3 mb-2 text-xs font-semibold uppercase tracking-wider ${
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
                <Info className="w-4 h-4 text-blue-600" />
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