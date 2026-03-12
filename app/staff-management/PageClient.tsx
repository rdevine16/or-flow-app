// app/staff-management/PageClient.tsx
// Staff Management page — admin-only. Contains Staff Directory and Time-Off Calendar tabs.
'use client'

import { useState } from 'react'
import { useUser } from '@/lib/UserContext'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import { PageLoader } from '@/components/ui/Loading'
import AccessDenied from '@/components/ui/AccessDenied'
import { StaffDirectoryTab } from '@/components/staff-management/StaffDirectoryTab'
import { Users, CalendarDays } from 'lucide-react'

// ============================================
// Tab config
// ============================================

type StaffManagementTab = 'directory' | 'time-off-calendar'

interface TabConfig {
  key: StaffManagementTab
  label: string
  icon: React.ReactNode
}

const TABS: TabConfig[] = [
  { key: 'directory', label: 'Staff Directory', icon: <Users className="w-4 h-4" /> },
  { key: 'time-off-calendar', label: 'Time-Off Calendar', icon: <CalendarDays className="w-4 h-4" /> },
]

// ============================================
// Page
// ============================================

export default function StaffManagementPageClient() {
  const {
    loading: userLoading,
    effectiveFacilityId,
    isAdmin,
  } = useUser()

  const [activeTab, setActiveTab] = useState<StaffManagementTab>('directory')

  if (userLoading) return <PageLoader />
  if (!isAdmin) return <AccessDenied />

  const facilityId = effectiveFacilityId
  if (!facilityId) return <AccessDenied />

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Staff Management</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage your team, view staff directory, and review time-off requests.
          </p>
        </div>

        {/* Tab navigation */}
        <div className="flex items-center gap-1 border-b border-slate-200">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`
                  relative flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap
                  transition-colors duration-200
                  ${isActive
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-slate-500 hover:text-slate-700 border-b-2 border-transparent'
                  }
                `}
                aria-selected={isActive}
                role="tab"
              >
                {tab.icon}
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Tab content */}
        {activeTab === 'directory' && (
          <StaffDirectoryTab facilityId={facilityId} />
        )}

        {activeTab === 'time-off-calendar' && (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <CalendarDays className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">Time-Off Calendar</p>
            <p className="text-sm text-slate-400 mt-1">Coming in Phase 9</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
