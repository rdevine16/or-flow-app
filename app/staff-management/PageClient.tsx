// app/staff-management/PageClient.tsx
// Staff Management page — admin-only. Contains Staff Directory and Time-Off Calendar tabs.
// Review modal is owned at this level so it can be triggered from either tab.
// StaffDetailDrawer (Phase 11) slides out from the directory row click.
'use client'

import { useState, useCallback } from 'react'
import { useUser } from '@/lib/UserContext'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { useUserRoles } from '@/hooks/useLookups'
import { useTimeOffRequests } from '@/hooks/useTimeOffRequests'
import { usersDAL, type UserListItem } from '@/lib/dal/users'
import { facilitiesDAL, type Facility } from '@/lib/dal/facilities'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import { PageLoader } from '@/components/ui/Loading'
import AccessDenied from '@/components/ui/AccessDenied'
import { StaffDirectoryTab } from '@/components/staff-management/StaffDirectoryTab'
import { TimeOffCalendarTab } from '@/components/staff-management/TimeOffCalendarTab'
import { TimeOffReviewModal } from '@/components/staff-management/TimeOffReviewModal'
import { StaffDetailDrawer } from '@/components/staff-management/StaffDetailDrawer'
import InviteUserModal from '@/components/InviteUserModal'
import type { TimeOffRequest } from '@/types/time-off'
import { HolidaysTab } from '@/components/staff-management/HolidaysTab'
import { Users, CalendarDays, Calendar, Building2 } from 'lucide-react'
import { logger } from '@/lib/logger'

const log = logger('staff-management:page')

// ============================================
// Tab config
// ============================================

type StaffManagementTab = 'directory' | 'time-off-calendar' | 'holidays'

interface TabConfig {
  key: StaffManagementTab
  label: string
  icon: React.ReactNode
}

const TABS: TabConfig[] = [
  { key: 'directory', label: 'Staff Directory', icon: <Users className="w-4 h-4" /> },
  { key: 'time-off-calendar', label: 'Time-Off Calendar', icon: <CalendarDays className="w-4 h-4" /> },
  { key: 'holidays', label: 'Holidays', icon: <Calendar className="w-4 h-4" /> },
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
    isGlobalAdmin,
    isImpersonating,
  } = useUser()

  const [activeTab, setActiveTab] = useState<StaffManagementTab>('directory')
  const [selectedRequest, setSelectedRequest] = useState<TimeOffRequest | null>(null)
  const [selectedUser, setSelectedUser] = useState<UserListItem | null>(null)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showDeactivated, setShowDeactivated] = useState(false)
  const [calendarRefreshTrigger, setCalendarRefreshTrigger] = useState(0)

  // Global admin facility selector
  const showFacilitySelector = isGlobalAdmin && !isImpersonating
  const [selectedFacilityOverride, setSelectedFacilityOverride] = useState<string>('')
  // '' = use default (effectiveFacilityId), 'all' = all facilities, uuid = specific facility

  // Fetch facilities for global admin selector
  const { data: allFacilities } = useSupabaseQuery<Facility[]>(
    async (supabase) => {
      const result = await facilitiesDAL.listAll(supabase)
      if (result.error) throw result.error
      return result.data
    },
    { deps: [], enabled: showFacilitySelector, initialData: [] },
  )

  // Compute the active facility ID (null = all facilities mode)
  const activeFacilityId: string | null = !showFacilitySelector
    ? effectiveFacilityId
    : selectedFacilityOverride === 'all'
      ? null
      : selectedFacilityOverride || effectiveFacilityId

  // Roles for InviteUserModal
  const { data: roles } = useUserRoles()

  // Fetch all requests + totals for the review modal (requires specific facility)
  const facilityId = activeFacilityId
  const {
    requests: allRequests,
    totals,
    reviewRequest,
    refetch: refetchRequests,
  } = useTimeOffRequests({ facilityId })

  // Fetch staff list for directory refresh on user updates
  const { refetch: refetchStaff } = useSupabaseQuery<UserListItem[]>(
    async (supabase) => {
      if (activeFacilityId === null) {
        // All facilities mode (global admin)
        const result = await usersDAL.listAllFacilities(supabase)
        if (result.error) throw result.error
        return result.data
      }
      if (!activeFacilityId) return []
      const result = await usersDAL.listByFacility(supabase, activeFacilityId)
      if (result.error) throw result.error
      return result.data
    },
    { deps: [activeFacilityId], enabled: activeFacilityId !== undefined, initialData: [] },
  )

  // Handle user updates (edit, deactivate, invite) — refresh directory + close drawer
  const handleUserUpdated = useCallback(() => {
    refetchStaff()
    refetchRequests()
    setSelectedUser(null)
  }, [refetchStaff, refetchRequests])

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
        setCalendarRefreshTrigger((n) => n + 1)

        // Fire-and-forget email notification to the staff member
        const request = allRequests.find((r) => r.id === requestId)
        if (request?.user?.email) {
          fetch('/api/time-off/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              facilityId,
              status: review.status,
              staffEmail: request.user.email,
              staffFirstName: request.user.first_name,
              reviewerName: `${userData.firstName ?? ''} ${userData.lastName ?? ''}`.trim() || 'Admin',
              requestType: request.request_type,
              startDate: request.start_date,
              endDate: request.end_date,
              reviewNotes: review.review_notes ?? null,
              facilityName: userData.facilityName ?? 'Your Facility',
            }),
          }).catch((err) => {
            log.error('Failed to send time-off email notification', { error: String(err) })
          })
        }
      }
      return result
    },
    [reviewRequest, refetchRequests, allRequests, facilityId, userData],
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
  if (!showFacilitySelector && !facilityId) return <AccessDenied />

  const isAllFacilitiesMode = activeFacilityId === null

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Staff Management</h1>
            <p className="text-sm text-slate-500 mt-1">
              Manage your team, view staff directory, and review time-off requests.
            </p>
          </div>

          {/* Global admin facility selector */}
          {showFacilitySelector && (
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-400" />
              <select
                value={selectedFacilityOverride || 'default'}
                onChange={(e) => {
                  const val = e.target.value
                  setSelectedFacilityOverride(val === 'default' ? '' : val)
                  setSelectedUser(null)
                  setSelectedRequest(null)
                }}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[160px] sm:min-w-[200px]"
                aria-label="Select facility"
              >
                <option value="default">
                  {userData.facilityName ?? 'Current Facility'}
                </option>
                <option value="all">All Facilities</option>
                {(allFacilities ?? [])
                  .filter((f) => f.id !== effectiveFacilityId)
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
              </select>
            </div>
          )}
        </div>

        {/* Tab navigation */}
        <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto" role="tablist" aria-label="Staff management sections">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                id={`tab-${tab.key}`}
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
                aria-controls={`tabpanel-${tab.key}`}
                tabIndex={isActive ? 0 : -1}
              >
                {tab.icon}
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Tab content */}
        {activeTab === 'directory' && (
          <div role="tabpanel" id="tabpanel-directory" aria-labelledby="tab-directory">
            <StaffDirectoryTab
              facilityId={activeFacilityId}
              onSelectUser={handleSelectUser}
              showDeactivated={showDeactivated}
              onToggleDeactivated={() => setShowDeactivated((v) => !v)}
              onAddStaff={() => setShowInviteModal(true)}
              isAllFacilitiesMode={isAllFacilitiesMode}
            />
          </div>
        )}

        {activeTab === 'time-off-calendar' && (
          <div role="tabpanel" id="tabpanel-time-off-calendar" aria-labelledby="tab-time-off-calendar">
            {!isAllFacilitiesMode && activeFacilityId ? (
              <TimeOffCalendarTab
                facilityId={activeFacilityId}
                onRequestClick={handleRequestClick}
                refreshTrigger={calendarRefreshTrigger}
              />
            ) : isAllFacilitiesMode ? (
              <div className="bg-white rounded-xl border border-slate-200 px-6 py-12 text-center">
                <CalendarDays className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">Select a specific facility</p>
                <p className="text-sm text-slate-400 mt-1">
                  The time-off calendar requires a single facility. Use the facility selector above to choose one.
                </p>
              </div>
            ) : null}
          </div>
        )}

        {activeTab === 'holidays' && (
          <div role="tabpanel" id="tabpanel-holidays" aria-labelledby="tab-holidays">
            {!isAllFacilitiesMode && activeFacilityId ? (
              <HolidaysTab facilityId={activeFacilityId} />
            ) : isAllFacilitiesMode ? (
              <div className="bg-white rounded-xl border border-slate-200 px-6 py-12 text-center">
                <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">Select a specific facility</p>
                <p className="text-sm text-slate-400 mt-1">
                  Holidays are facility-specific. Use the facility selector above to choose one.
                </p>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Review modal — shared across tabs (calendar click) */}
      <TimeOffReviewModal
        request={selectedRequest}
        open={selectedRequest !== null}
        onClose={handleReviewClose}
        currentUserId={userData.userId ?? ''}
        totals={totals}
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
        onUserUpdated={handleUserUpdated}
      />

      {/* Invite modal — triggered from Add Staff button */}
      <InviteUserModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onSuccess={() => {
          setShowInviteModal(false)
          refetchStaff()
        }}
        facilityId={activeFacilityId ?? effectiveFacilityId}
        roles={roles ?? []}
      />
    </DashboardLayout>
  )
}
