// app/settings/notifications/page.tsx
// Notifications: Configure facility-wide notification preferences (Coming Soon)

'use client'

import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import SettingsLayout from '@/components/settings/SettingsLayout'
import { PageLoader } from '@/components/ui/Loading'
import { ErrorBanner } from '@/components/ui/ErrorBanner'

// =====================================================
// TYPES
// =====================================================

interface NotificationCategory {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  settings: NotificationSetting[]
}

interface NotificationSetting {
  id: string
  label: string
  description: string
  defaultEnabled: boolean
}

// =====================================================
// NOTIFICATION CONFIGURATION (Preview of what's coming)
// =====================================================

const notificationCategories: NotificationCategory[] = [
  {
    id: 'case-alerts',
    title: 'Case Alerts',
    description: 'Real-time notifications during surgical cases',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
    settings: [
      {
        id: 'call-next-patient',
        label: 'Call Next Patient',
        description: 'Notify when a room is ready for the next patient',
        defaultEnabled: true,
      },
      {
        id: 'case-started',
        label: 'Case Started',
        description: 'Notify when a case begins (Patient In recorded)',
        defaultEnabled: false,
      },
      {
        id: 'case-completed',
        label: 'Case Completed',
        description: 'Notify when a case finishes (Patient Out recorded)',
        defaultEnabled: false,
      },
      {
        id: 'delay-recorded',
        label: 'Delay Recorded',
        description: 'Notify when a delay is logged on a case',
        defaultEnabled: true,
      },
    ],
  },
  {
    id: 'schedule-alerts',
    title: 'Schedule Alerts',
    description: 'Notifications about scheduling and timing',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    settings: [
      {
        id: 'first-case-reminder',
        label: 'First Case Reminder',
        description: 'Remind staff before the first case of the day',
        defaultEnabled: true,
      },
      {
        id: 'case-running-long',
        label: 'Case Running Long',
        description: 'Alert when a case exceeds expected duration',
        defaultEnabled: true,
      },
      {
        id: 'turnover-alert',
        label: 'Turnover Time Alert',
        description: 'Alert if turnover exceeds target time',
        defaultEnabled: false,
      },
    ],
  },
  {
    id: 'tray-management',
    title: 'Tray Management',
    description: 'Notifications for device rep coordination',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
      </svg>
    ),
    settings: [
      {
        id: 'tray-confirmation-needed',
        label: 'Tray Confirmation Needed',
        description: 'Remind reps to confirm tray availability',
        defaultEnabled: true,
      },
      {
        id: 'tray-delivered',
        label: 'Tray Delivered',
        description: 'Notify staff when trays are delivered',
        defaultEnabled: true,
      },
      {
        id: 'tray-missing',
        label: 'Missing Tray Alert',
        description: 'Alert if trays not confirmed before case',
        defaultEnabled: true,
      },
    ],
  },
  {
    id: 'reports',
    title: 'Reports & Summaries',
    description: 'Scheduled report notifications',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    settings: [
      {
        id: 'daily-summary',
        label: 'Daily Summary',
        description: 'End-of-day summary of all cases',
        defaultEnabled: false,
      },
      {
        id: 'weekly-report',
        label: 'Weekly Efficiency Report',
        description: 'Weekly OR efficiency metrics',
        defaultEnabled: true,
      },
      {
        id: 'monthly-report',
        label: 'Monthly Analytics',
        description: 'Comprehensive monthly performance report',
        defaultEnabled: true,
      },
    ],
  },
]

// =====================================================
// COMPONENT
// =====================================================

export default function NotificationsPage() {
  return (
    <DashboardLayout>
      <Container>
        <SettingsLayout title="Notifications" description="Configure how your facility receives alerts and updates">
          {/* Coming Soon Banner */}
          <div className="mb-6 p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Coming Soon</h3>
                <p className="text-sm text-slate-600 mt-1">
                  Customizable notification preferences are in development. Below is a preview of the settings you'll be able to configure.
                </p>
              </div>
            </div>
          </div>

          {/* Notification Categories */}
          <div className="space-y-6">
            {notificationCategories.map((category) => (
              <div key={category.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden opacity-75">
                {/* Category Header */}
                <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-slate-500">
                      {category.icon}
                    </div>
                    <div>
                      <h3 className="font-medium text-slate-900">{category.title}</h3>
                      <p className="text-sm text-slate-500">{category.description}</p>
                    </div>
                  </div>
                </div>

                {/* Settings List */}
                <div className="divide-y divide-slate-100">
                  {category.settings.map((setting) => (
                    <div key={setting.id} className="px-6 py-4 flex items-center justify-between">
                      <div className="flex-1 min-w-0 pr-4">
                        <p className="font-medium text-slate-900">{setting.label}</p>
                        <p className="text-sm text-slate-500 mt-0.5">{setting.description}</p>
                      </div>
                      
                      {/* Disabled Toggle */}
                      <div className="flex items-center gap-3">
                        <button
                          disabled
                          className={`relative w-11 h-6 rounded-full transition-colors cursor-not-allowed ${
                            setting.defaultEnabled ? 'bg-blue-300' : 'bg-slate-200'
                          }`}
                        >
                          <span 
                            className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                              setting.defaultEnabled ? 'translate-x-5' : ''
                            }`} 
                          />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Delivery Preferences (Coming Soon) */}
          <div className="mt-6 bg-white rounded-xl border border-slate-200 overflow-hidden opacity-75">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="font-medium text-slate-900">Delivery Preferences</h3>
              <p className="text-sm text-slate-500 mt-0.5">Choose how notifications are delivered to your team</p>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Push Notifications */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-white border border-slate-200 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">Push Notifications</p>
                      <p className="text-xs text-slate-500">iOS & Android</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Enabled</span>
                    <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium text-emerald-700 bg-emerald-100 rounded">
                      Active
                    </span>
                  </div>
                </div>

                {/* In-App Notifications */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-white border border-slate-200 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">In-App Alerts</p>
                      <p className="text-xs text-slate-500">Web & Mobile</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Enabled</span>
                    <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium text-emerald-700 bg-emerald-100 rounded">
                      Active
                    </span>
                  </div>
                </div>

                {/* Email */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-white border border-slate-200 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">Email</p>
                      <p className="text-xs text-slate-500">Reports only</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Enabled</span>
                    <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium text-slate-500 bg-slate-100 rounded">
                      Coming Soon
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quiet Hours */}
          <div className="mt-6 bg-white rounded-xl border border-slate-200 overflow-hidden opacity-75">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="font-medium text-slate-900">Quiet Hours</h3>
              <p className="text-sm text-slate-500 mt-0.5">Suppress non-urgent notifications during off hours</p>
            </div>
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-600">From</span>
                    <div className="px-3 py-2 bg-slate-100 rounded-lg text-sm text-slate-500 cursor-not-allowed">
                      10:00 PM
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-600">To</span>
                    <div className="px-3 py-2 bg-slate-100 rounded-lg text-sm text-slate-500 cursor-not-allowed">
                      6:00 AM
                    </div>
                  </div>
                </div>
                <button
                  disabled
                  className="relative w-11 h-6 rounded-full bg-slate-200 cursor-not-allowed"
                >
                  <span className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow" />
                </button>
              </div>
            </div>
          </div>

          {/* Role-Based Recipients (Coming Soon) */}
          <div className="mt-6 bg-white rounded-xl border border-slate-200 overflow-hidden opacity-75">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="font-medium text-slate-900">Default Recipients by Role</h3>
              <p className="text-sm text-slate-500 mt-0.5">Configure which roles receive specific notification types</p>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {['Surgeons', 'Anesthesiologists', 'Nurses', 'Techs', 'OR Directors', 'Device Reps'].map((role) => (
                  <div key={role} className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <input
                      type="checkbox"
                      disabled
                      defaultChecked={['Nurses', 'Techs', 'OR Directors'].includes(role)}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 cursor-not-allowed"
                    />
                    <span className="text-sm text-slate-600">{role}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </SettingsLayout>
      </Container>
    </DashboardLayout>
  )
}