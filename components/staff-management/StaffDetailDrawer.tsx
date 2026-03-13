// components/staff-management/StaffDetailDrawer.tsx
// Staff detail slide-out drawer with Profile / Time-Off / Actions tabs.
// Follows the CaseDrawer pattern (Radix Dialog, right-slide, drawer-overlay/drawer-content CSS).
'use client'

import { useState, useEffect, useMemo } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import type { UserListItem } from '@/lib/dal/users'
import type { TimeOffRequest, UserTimeOffSummary, TimeOffReviewInput } from '@/types/time-off'
import Badge from '@/components/ui/Badge'
import { DrawerProfileTab, deriveAccountStatus, STATUS_CONFIG } from './DrawerProfileTab'
import { DrawerTimeOffTab } from './DrawerTimeOffTab'
import { DrawerActionsTab } from './DrawerActionsTab'
import { X } from 'lucide-react'

// ============================================
// Types
// ============================================

interface StaffDetailDrawerProps {
  user: UserListItem | null
  onClose: () => void
  facilityName: string | null
  totals: UserTimeOffSummary[]
  requests: TimeOffRequest[]
  currentUserId: string
  onReview: (
    requestId: string,
    review: TimeOffReviewInput,
  ) => Promise<{ success: boolean; error?: string }>
  onUserUpdated?: () => void
}

type DrawerTab = 'profile' | 'time-off' | 'actions'

const ALL_TABS: { key: DrawerTab; label: string }[] = [
  { key: 'profile', label: 'Profile' },
  { key: 'time-off', label: 'Time Off' },
  { key: 'actions', label: 'Actions' },
]

// ============================================
// Helpers
// ============================================

const ROLE_BADGE_VARIANTS: Record<string, 'default' | 'success' | 'warning' | 'info' | 'purple' | 'error'> = {
  surgeon: 'info',
  nurse: 'success',
  'scrub tech': 'purple',
  anesthesiologist: 'warning',
  pa: 'default',
  'first assist': 'default',
  'device rep': 'error',
}

function getRoleBadgeVariant(roleName: string | null): 'default' | 'success' | 'warning' | 'info' | 'purple' | 'error' {
  if (!roleName) return 'default'
  return ROLE_BADGE_VARIANTS[roleName.toLowerCase()] ?? 'default'
}

function getRoleName(user: UserListItem): string | null {
  if (!user.role) return null
  if (Array.isArray(user.role)) return (user.role as { name: string }[])[0]?.name ?? null
  return user.role.name
}

// ============================================
// Component
// ============================================

export function StaffDetailDrawer({
  user,
  onClose,
  facilityName,
  totals,
  requests,
  currentUserId,
  onReview,
  onUserUpdated,
}: StaffDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<DrawerTab>('profile')

  // Reset to profile tab when switching users
  useEffect(() => {
    setActiveTab('profile')
  }, [user?.id])

  if (!user) return null

  const roleName = getRoleName(user)
  const isSurgeon = roleName?.toLowerCase() === 'surgeon'
  const tabs = useMemo(
    () => isSurgeon ? ALL_TABS.filter((t) => t.key !== 'time-off') : ALL_TABS,
    [isSurgeon],
  )
  const fullName = `${user.first_name} ${user.last_name}`
  const accountStatus = deriveAccountStatus(user)
  const statusCfg = STATUS_CONFIG[accountStatus]
  const userTotals = totals.find((t) => t.user_id === user.id)

  return (
    <Dialog.Root open={!!user} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="drawer-overlay fixed inset-0 bg-black/40 z-40" />
        <Dialog.Content
          className="drawer-content fixed right-0 top-0 h-full w-[480px] max-w-[90vw] bg-white shadow-2xl z-50 flex flex-col"
          aria-describedby={undefined}
        >
          <Dialog.Title className="sr-only">
            Staff Details: {fullName}
          </Dialog.Title>

          {/* Header */}
          <div className="shrink-0 border-b border-slate-200 px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-sm font-medium text-slate-600 shrink-0">
                  {user.first_name?.[0]}{user.last_name?.[0]}
                </div>
                <div className="min-w-0">
                  <p className="text-base font-semibold text-slate-900 truncate">
                    {fullName}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {roleName && (
                      <Badge variant={getRoleBadgeVariant(roleName)} size="sm">
                        {roleName}
                      </Badge>
                    )}
                    <Badge variant={statusCfg.variant} size="sm">
                      {statusCfg.label}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Close button */}
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600 shrink-0"
                aria-label="Close drawer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tab navigation */}
            <div className="flex items-center gap-1 mt-4 -mb-4 border-b-0" role="tablist" aria-label="Staff detail sections">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.key
                return (
                  <button
                    key={tab.key}
                    id={`drawer-tab-${tab.key}`}
                    onClick={() => setActiveTab(tab.key)}
                    className={`
                      px-3 py-2 text-sm font-medium rounded-t-md transition-colors
                      ${isActive
                        ? 'text-blue-600 bg-blue-50 border-b-2 border-blue-600'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                      }
                    `}
                    role="tab"
                    aria-selected={isActive}
                    aria-controls={`drawer-tabpanel-${tab.key}`}
                    tabIndex={isActive ? 0 : -1}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Tab content — scrollable */}
          <div className="flex-1 overflow-y-auto" role="tabpanel" id={`drawer-tabpanel-${activeTab}`} aria-labelledby={`drawer-tab-${activeTab}`}>
            {activeTab === 'profile' && (
              <DrawerProfileTab user={user} facilityName={facilityName} />
            )}
            {activeTab === 'time-off' && (
              <DrawerTimeOffTab
                userId={user.id}
                totals={userTotals}
                requests={requests}
                currentUserId={currentUserId}
                onReview={onReview}
              />
            )}
            {activeTab === 'actions' && (
              <DrawerActionsTab
                user={user}
                currentUserId={currentUserId}
                onUserUpdated={onUserUpdated ?? (() => {})}
              />
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
