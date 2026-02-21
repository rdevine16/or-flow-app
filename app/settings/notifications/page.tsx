// app/settings/notifications/page.tsx
// Facility notification preferences — toggle notifications on/off and choose channels

'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { PageLoader } from '@/components/ui/Loading'
import {
  Bell,
  CalendarDays,
  ClipboardList,
  FileBarChart,
  FlaskConical,
} from 'lucide-react'

// =====================================================
// TYPES
// =====================================================

interface FacilityNotification {
  id: string
  facility_id: string
  notification_type: string
  category: string
  display_label: string
  is_enabled: boolean
  channels: string[]
  display_order: number
}

// =====================================================
// CONSTANTS
// =====================================================

const CATEGORIES = [
  { key: 'case_alerts', label: 'Case Alerts', description: 'Real-time notifications during surgical cases', icon: ClipboardList },
  { key: 'schedule_alerts', label: 'Schedule Alerts', description: 'Notifications about scheduling and timing', icon: CalendarDays },
  { key: 'tray_management', label: 'Tray Management', description: 'Notifications for device rep coordination', icon: FlaskConical },
  { key: 'reports', label: 'Reports & Summaries', description: 'Scheduled report notifications', icon: FileBarChart },
] as const

const CHANNEL_OPTIONS = [
  { key: 'push', label: 'Push' },
  { key: 'in_app', label: 'In-App' },
  { key: 'email', label: 'Email' },
] as const

// =====================================================
// COMPONENT
// =====================================================

export default function NotificationsPage() {
  const supabase = createClient()
  const { userData, loading: userLoading } = useUser()
  const { showToast } = useToast()
  const facilityId = userData.facilityId

  const [savingId, setSavingId] = useState<string | null>(null)

  const { data: notifications, loading, error, refetch } = useSupabaseQuery<FacilityNotification[]>(
    async (sb) => {
      const { data, error } = await sb
        .from('facility_notification_settings')
        .select('id, facility_id, notification_type, category, display_label, is_enabled, channels, display_order')
        .eq('facility_id', facilityId!)
        .is('deleted_at', null)
        .order('display_order')
        .order('display_label')

      if (error) throw error
      return data || []
    },
    { deps: [facilityId], enabled: !!facilityId }
  )

  const items = notifications || []

  // Group by category
  const groupedNotifications = CATEGORIES.map((cat) => ({
    ...cat,
    items: items.filter((n) => n.category === cat.key),
  })).filter((g) => g.items.length > 0)

  const handleToggle = useCallback(
    async (notification: FacilityNotification) => {
      setSavingId(notification.id)

      try {
        const { error } = await supabase
          .from('facility_notification_settings')
          .update({ is_enabled: !notification.is_enabled })
          .eq('id', notification.id)

        if (error) throw error
        refetch()
      } catch (err) {
        showToast({
          type: 'error',
          title: 'Error updating notification',
          message: err instanceof Error ? err.message : 'Please try again',
        })
      } finally {
        setSavingId(null)
      }
    },
    [supabase, refetch, showToast]
  )

  const handleChannelToggle = useCallback(
    async (notification: FacilityNotification, channel: string) => {
      setSavingId(notification.id)

      const newChannels = notification.channels.includes(channel)
        ? notification.channels.filter((c) => c !== channel)
        : [...notification.channels, channel]

      try {
        const { error } = await supabase
          .from('facility_notification_settings')
          .update({ channels: newChannels })
          .eq('id', notification.id)

        if (error) throw error
        refetch()
      } catch (err) {
        showToast({
          type: 'error',
          title: 'Error updating channels',
          message: err instanceof Error ? err.message : 'Please try again',
        })
      } finally {
        setSavingId(null)
      }
    },
    [supabase, refetch, showToast]
  )

  if (userLoading || !facilityId) {
    return (
      <>
        <h1 className="text-2xl font-semibold text-slate-900 mb-1">Notifications</h1>
        <p className="text-slate-500 mb-6">Configure how your facility receives alerts and updates</p>
        <PageLoader message="Loading notifications..." />
      </>
    )
  }

  return (
    <>
      <h1 className="text-2xl font-semibold text-slate-900 mb-1">Notifications</h1>
      <p className="text-slate-500 mb-6">Configure how your facility receives alerts and updates</p>

      <ErrorBanner message={error} />

      {loading ? (
        <PageLoader message="Loading notifications..." />
      ) : items.length === 0 ? (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center">
          <Bell className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">No Notifications Configured</h3>
          <p className="text-slate-600">
            Notification types haven&apos;t been set up for your facility yet. Contact your administrator to configure notifications.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedNotifications.map((group) => {
            const Icon = group.icon
            return (
              <div
                key={group.key}
                className="bg-white rounded-xl border border-slate-200 overflow-hidden"
              >
                {/* Category Header */}
                <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-slate-500">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-medium text-slate-900">{group.label}</h3>
                      <p className="text-sm text-slate-500">{group.description}</p>
                    </div>
                  </div>
                </div>

                {/* Settings List */}
                <div className="divide-y divide-slate-100">
                  {group.items.map((notification) => {
                    const isSaving = savingId === notification.id

                    return (
                      <div key={notification.id} className="px-6 py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0 pr-4">
                            <p className="font-medium text-slate-900">
                              {notification.display_label}
                            </p>
                          </div>

                          {/* Enable/Disable Toggle */}
                          <button
                            onClick={() => handleToggle(notification)}
                            disabled={isSaving}
                            className={`relative w-11 h-6 rounded-full transition-colors ${
                              isSaving ? 'opacity-50 cursor-wait' : 'cursor-pointer'
                            } ${
                              notification.is_enabled ? 'bg-blue-600' : 'bg-slate-300'
                            }`}
                          >
                            <span
                              className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                                notification.is_enabled ? 'translate-x-5' : ''
                              }`}
                            />
                          </button>
                        </div>

                        {/* Channel checkboxes — only show when enabled */}
                        {notification.is_enabled && (
                          <div className="mt-3 flex items-center gap-4 pl-0">
                            <span className="text-xs text-slate-400 uppercase tracking-wider">
                              Channels:
                            </span>
                            {CHANNEL_OPTIONS.map((ch) => (
                              <label
                                key={ch.key}
                                className={`flex items-center gap-1.5 cursor-pointer ${
                                  isSaving ? 'opacity-50 pointer-events-none' : ''
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={notification.channels.includes(ch.key)}
                                  onChange={() =>
                                    handleChannelToggle(notification, ch.key)
                                  }
                                  disabled={isSaving}
                                  className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                                />
                                <span className="text-sm text-slate-600">{ch.label}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
