// components/global/NotificationPanel.tsx
// Slide-out notification panel with two sections:
// 1. Active Alerts (computed, ephemeral) — from useDashboardAlerts
// 2. Persistent Notifications (from DB) — from useNotifications
// Uses @radix-ui/react-dialog for accessibility + existing drawer animations.

'use client'

import * as Dialog from '@radix-ui/react-dialog'
import Link from 'next/link'
import {
  X,
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
  Inbox,
} from 'lucide-react'
import { useState } from 'react'
import { useNotifications } from '@/lib/hooks/useNotifications'
import { useUnreadCount } from '@/lib/hooks/useUnreadCount'
import { useDashboardAlerts, type DashboardAlert } from '@/lib/hooks/useDashboardAlerts'
import { NotificationCard } from './NotificationCard'
import { ActiveAlertCard } from './ActiveAlertCard'

// ============================================
// Props
// ============================================

interface NotificationPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// ============================================
// Component
// ============================================

export function NotificationPanel({ open, onOpenChange }: NotificationPanelProps) {
  const {
    notifications,
    loading: notifLoading,
    error: notifError,
    filter,
    setFilter,
    hasMore,
    loadMore,
    loadingMore,
    markAsRead,
    markAllAsRead,
    refetch: refetchNotifications,
  } = useNotifications()

  const { decrement, clearCount, refetch: refetchCount } = useUnreadCount()

  const {
    data: alerts,
    loading: alertsLoading,
    dismissAlert,
  } = useDashboardAlerts()

  const [alertsCollapsed, setAlertsCollapsed] = useState(false)

  const activeAlerts = alerts ?? []
  const hasAlerts = activeAlerts.length > 0
  const hasUnread = notifications.some(n => !n.is_read)

  const handleMarkAsRead = async (id: string) => {
    await markAsRead(id)
    decrement()
  }

  const handleMarkAllAsRead = async () => {
    await markAllAsRead()
    clearCount()
  }

  const handleDismissAlert = (id: string) => {
    dismissAlert(id)
  }

  const handleNavigate = () => {
    onOpenChange(false)
  }

  const handleRetry = () => {
    refetchNotifications()
    refetchCount()
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        {/* Backdrop */}
        <Dialog.Overlay className="drawer-overlay fixed inset-0 bg-black/30 z-40" />

        {/* Panel */}
        <Dialog.Content
          className="drawer-content fixed right-0 top-0 h-full w-full sm:w-96 sm:max-w-[90vw] bg-white shadow-2xl z-50 flex flex-col outline-none"
          aria-describedby={undefined}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
            <Dialog.Title className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Bell className="w-4.5 h-4.5 text-slate-500" />
              Notifications
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600"
                aria-label="Close notifications"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </Dialog.Close>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto">
            {/* ─── Active Alerts Section ─── */}
            {(hasAlerts || alertsLoading) && (
              <div className="border-b border-slate-100">
                <button
                  onClick={() => setAlertsCollapsed(!alertsCollapsed)}
                  className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors"
                >
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Active Alerts
                  </span>
                  <div className="flex items-center gap-2">
                    {activeAlerts.length > 0 && (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">
                        {activeAlerts.length}
                      </span>
                    )}
                    {alertsCollapsed ? (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    ) : (
                      <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </div>
                </button>

                {!alertsCollapsed && (
                  <div className="pb-2">
                    {alertsLoading ? (
                      <AlertSkeleton />
                    ) : activeAlerts.length === 0 ? (
                      <div className="px-5 py-3 text-xs text-slate-400 text-center">
                        No active alerts
                      </div>
                    ) : (
                      <>
                        {activeAlerts.map((alert: DashboardAlert) => (
                          <ActiveAlertCard
                            key={alert.id}
                            alert={alert}
                            onDismiss={handleDismissAlert}
                            onNavigate={handleNavigate}
                          />
                        ))}
                        <div className="px-5 pt-1 pb-1">
                          <Link
                            href="/dashboard"
                            onClick={handleNavigate}
                            className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
                          >
                            View all on Dashboard
                          </Link>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ─── Notifications Section ─── */}
            <div>
              {/* Tabs + Mark all read */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
                <div className="flex gap-1">
                  <TabButton
                    active={filter === 'all'}
                    onClick={() => setFilter('all')}
                    label="All"
                  />
                  <TabButton
                    active={filter === 'unread'}
                    onClick={() => setFilter('unread')}
                    label="Unread"
                  />
                </div>
                {hasUnread && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              {/* Notification list */}
              {notifLoading ? (
                <NotificationSkeleton />
              ) : notifError ? (
                <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
                  <AlertCircle className="w-8 h-8 text-red-400 mb-3" />
                  <p className="text-sm font-medium text-slate-700">Failed to load notifications</p>
                  <p className="text-xs text-slate-400 mt-1">{notifError}</p>
                  <button
                    onClick={handleRetry}
                    className="mt-3 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors px-3 py-1.5 rounded-lg hover:bg-blue-50"
                  >
                    Retry
                  </button>
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
                  <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center mb-3">
                    <Inbox className="w-5 h-5 text-slate-300" />
                  </div>
                  <p className="text-sm font-medium text-slate-600">
                    {filter === 'unread' ? 'All caught up' : 'No notifications yet'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {filter === 'unread'
                      ? 'You have no unread notifications.'
                      : 'Notifications from integrations and data quality will appear here.'}
                  </p>
                </div>
              ) : (
                <div>
                  {notifications.map(notification => (
                    <NotificationCard
                      key={notification.id}
                      notification={notification}
                      onMarkAsRead={handleMarkAsRead}
                      onNavigate={handleNavigate}
                    />
                  ))}

                  {/* Load more */}
                  {hasMore && (
                    <div className="px-5 py-3 text-center">
                      <button
                        onClick={loadMore}
                        disabled={loadingMore}
                        className="text-xs font-medium text-blue-600 hover:text-blue-700 disabled:text-slate-400 transition-colors"
                      >
                        {loadingMore ? (
                          <span className="flex items-center gap-1.5 justify-center">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Loading...
                          </span>
                        ) : (
                          'Load more'
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-slate-300" />
                <span className="text-[11px] text-slate-400">
                  Read: 30d &middot; Unread: 90d retention
                </span>
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// ============================================
// Sub-components
// ============================================

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
        active
          ? 'bg-slate-900 text-white'
          : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
      }`}
    >
      {label}
    </button>
  )
}

function AlertSkeleton() {
  return (
    <div className="px-4 py-2 space-y-2">
      {[1, 2].map(i => (
        <div key={i} className="flex items-start gap-3 animate-pulse py-2">
          <div className="w-2 h-2 rounded-full bg-amber-200 mt-1.5" />
          <div className="w-4 h-4 rounded bg-slate-200 mt-0.5" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 bg-slate-200 rounded w-2/3" />
            <div className="h-3 bg-slate-100 rounded w-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

function NotificationSkeleton() {
  return (
    <div className="px-4 py-3 space-y-3">
      {[1, 2, 3].map(i => (
        <div key={i} className="flex items-start gap-3 animate-pulse">
          <div className="w-2 h-2 rounded-full bg-slate-200 mt-2" />
          <div className="w-4 h-4 rounded bg-slate-200 mt-0.5" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 bg-slate-200 rounded w-3/4" />
            <div className="h-3 bg-slate-100 rounded w-full" />
            <div className="h-2.5 bg-slate-100 rounded w-1/4" />
          </div>
        </div>
      ))}
    </div>
  )
}
