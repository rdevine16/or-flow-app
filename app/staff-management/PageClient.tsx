// app/staff-management/PageClient.tsx
// Staff Management page — admin-only. Contains Staff Directory and Time-Off Calendar tabs.
// Review modal is owned at this level so it can be triggered from either tab.
// StaffDetailDrawer (Phase 11) slides out from the directory row click.
'use client'

import { useState, useCallback, useMemo } from 'react'
import { useUser } from '@/lib/UserContext'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { useTimeOffRequests } from '@/hooks/useTimeOffRequests'
import { usersDAL, type UserListItem } from '@/lib/dal/users'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import { PageLoader } from '@/components/ui/Loading'
import AccessDenied from '@/components/ui/AccessDenied'
import { StaffDirectoryTab } from '@/components/staff-management/StaffDirectoryTab'
import { TimeOffCalendarTab } from '@/components/staff-management/TimeOffCalendarTab'
import { TimeOffReviewModal } from '@/components/staff-management/TimeOffReviewModal'
import { StaffDetailDrawer } from '@/components/staff-management/StaffDetailDrawer'
import type { TimeOffRequest } from '@/types/time-off'
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
    userData,
    effectiveFacilityId,
    isAdmin,
  } = useUser()

  const [activeTab, setActiveTab] = useState<StaffManagementTab>('directory')
  const [selectedRequest, setSelectedRequest] = useState<TimeOffRequest | null>(null)
  const [selectedUser, setSelectedUser] = useState<UserListItem | null>(null)

  // Fetch all requests + totals for the review modal
  const facilityId = effectiveFacilityId
  const {
    requests: allRequests,
    totals,
    reviewRequest,
    refetch: refetchRequests,
  } = useTimeOffRequests({ facilityId })

  // Fetch staff list for coverage indicator
  const { data: staffList } = useSupabaseQuery<UserListItem[]>(
    async (supabase) => {
      if (!facilityId) return []
      const result = await usersDAL.listByFacility(supabase, facilityId)
      if (result.error) throw result.error
      return result.data
    },
    { deps: [facilityId], enabled: !!facilityId, initialData: [] },
  )

  // Approved requests for coverage calculation
  const approvedRequests = useMemo(
    () => allRequests.filter((r) => r.status === 'approved'),
    [allRequests],
  )

  // Calendar review modal handlers
  const handleRequestClick = useCallback((request: TimeOffRequest) => {
    setSelectedRequest(request)
  }, [])

  const handleReviewClose = useCallback(() => {
    setSelectedRequest(null)
  }, [])

  const handleReview = useCallback(
    async (requestId: string, review: Parameters<typeof reviewRequest>[1]) => {
      const result = await reviewRequest(requestId, review)
      if (result.success) {
        await refetchRequests()
      }
      return result
    },
    [reviewRequest, refetchRequests],
  )

  // Staff detail drawer handlers
  const handleSelectUser = useCallback((user: UserListItem) => {
    setSelectedUser(user)
  }, [])

  const handleDrawerClose = useCallback(() => {
    setSelectedUser(null)
  }, [])

  if (userLoading) return <PageLoader />
  if (!isAdmin) return <AccessDenied />
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
          <StaffDirectoryTab
            facilityId={facilityId}
            onSelectUser={handleSelectUser}
          />
        )}

        {activeTab === 'time-off-calendar' && (
          <TimeOffCalendarTab
            facilityId={facilityId}
            onRequestClick={handleRequestClick}
          />
        )}
      </div>

      {/* Review modal — shared across tabs (calendar click) */}
      <TimeOffReviewModal
        request={selectedRequest}
        open={selectedRequest !== null}
        onClose={handleReviewClose}
        currentUserId={userData.userId ?? ''}
        totals={totals}
        staffList={staffList ?? []}
        approvedRequests={approvedRequests}
        onReview={handleReview}
      />

      {/* Staff detail drawer — opens from directory row click */}
      <StaffDetailDrawer
        user={selectedUser}
        onClose={handleDrawerClose}
        facilityName={userData.facilityName}
        totals={totals}
        requests={allRequests}
        currentUserId={userData.userId ?? ''}
        onReview={handleReview}
      />
    </DashboardLayout>
  )
}
