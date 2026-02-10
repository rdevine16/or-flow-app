// app/settings/integrations/page.tsx
// Integrations: Coming soon placeholder with future integration cards

'use client'

import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import SettingsLayout from '@/components/settings/SettingsLayout'
import { PageLoader } from '@/components/ui/Loading'
import { ErrorBanner } from '@/components/ui/ErrorBanner'

// =====================================================
// TYPES
// =====================================================

interface Integration {
  id: string
  name: string
  description: string
  icon: React.ReactNode
  category: 'ehr' | 'scheduling' | 'communication' | 'analytics'
  status: 'coming' | 'beta' | 'available'
  comingSoon?: string // e.g., "Q2 2026"
}

// =====================================================
// INTEGRATION DATA
// =====================================================

const integrations: Integration[] = [
  {
    id: 'epic',
    name: 'Epic',
    description: 'Sync case data and patient scheduling with Epic EHR',
    category: 'ehr',
    status: 'coming',
    comingSoon: 'Q2 2026',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24">
        <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth={1.5} />
        <path d="M7 8h10M7 12h10M7 16h6" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'cerner',
    name: 'Cerner',
    description: 'Connect to Cerner for real-time case synchronization',
    category: 'ehr',
    status: 'coming',
    comingSoon: 'Q3 2026',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth={1.5} />
        <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'athena',
    name: 'athenahealth',
    description: 'Integrate with athenahealth for scheduling and billing',
    category: 'ehr',
    status: 'coming',
    comingSoon: 'Q3 2026',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24">
        <path d="M12 3L3 9v12h18V9l-9-6z" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 21v-6h6v6" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    description: 'Sync block schedules and OR availability with Google Calendar',
    category: 'scheduling',
    status: 'coming',
    comingSoon: 'Q1 2026',
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth={1.5} />
        <path d="M3 10h18" stroke="currentColor" strokeWidth={1.5} />
        <path d="M8 2v4M16 2v4" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
        <rect x="7" y="14" width="3" height="3" rx="0.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: 'outlook',
    name: 'Microsoft Outlook',
    description: 'Calendar sync and email notifications via Outlook',
    category: 'scheduling',
    status: 'coming',
    comingSoon: 'Q1 2026',
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none">
        <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" strokeWidth={1.5} />
        <path d="M2 8l10 6 10-6" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Send case alerts and notifications to Slack channels',
    category: 'communication',
    status: 'coming',
    comingSoon: 'Q2 2026',
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none">
        <path d="M14.5 10c0 .83-.67 1.5-1.5 1.5H9.5V10c0-.83.67-1.5 1.5-1.5h2c.83 0 1.5.67 1.5 1.5z" stroke="currentColor" strokeWidth={1.5} />
        <path d="M20.5 10c0 .83-.67 1.5-1.5 1.5h-3V8.5h3c.83 0 1.5.67 1.5 1.5z" stroke="currentColor" strokeWidth={1.5} />
        <path d="M10 14.5c-.83 0-1.5.67-1.5 1.5v2c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-3.5H10z" stroke="currentColor" strokeWidth={1.5} />
        <path d="M10 3.5c-.83 0-1.5.67-1.5 1.5v3h3.5V5c0-.83-.67-1.5-1.5-1.5h-.5z" stroke="currentColor" strokeWidth={1.5} />
      </svg>
    ),
  },
  {
    id: 'teams',
    name: 'Microsoft Teams',
    description: 'Push notifications and alerts to Teams channels',
    category: 'communication',
    status: 'coming',
    comingSoon: 'Q2 2026',
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth={1.5} />
        <path d="M8 8h8v8H8z" stroke="currentColor" strokeWidth={1.5} />
        <circle cx="17" cy="7" r="2" stroke="currentColor" strokeWidth={1.5} />
      </svg>
    ),
  },
  {
    id: 'powerbi',
    name: 'Power BI',
    description: 'Export OR efficiency data to Power BI dashboards',
    category: 'analytics',
    status: 'coming',
    comingSoon: 'Q4 2026',
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none">
        <rect x="4" y="12" width="4" height="8" rx="1" stroke="currentColor" strokeWidth={1.5} />
        <rect x="10" y="8" width="4" height="12" rx="1" stroke="currentColor" strokeWidth={1.5} />
        <rect x="16" y="4" width="4" height="16" rx="1" stroke="currentColor" strokeWidth={1.5} />
      </svg>
    ),
  },
  {
    id: 'tableau',
    name: 'Tableau',
    description: 'Connect ORbit data to Tableau for advanced analytics',
    category: 'analytics',
    status: 'coming',
    comingSoon: 'Q4 2026',
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none">
        <path d="M12 3v18M3 12h18" stroke="currentColor" strokeWidth={2} />
        <path d="M7 7v4M17 13v4M7 17h4M13 7h4" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
      </svg>
    ),
  },
]

const categories = [
  { id: 'all', label: 'All' },
  { id: 'ehr', label: 'EHR Systems' },
  { id: 'scheduling', label: 'Scheduling' },
  { id: 'communication', label: 'Communication' },
  { id: 'analytics', label: 'Analytics' },
]

// =====================================================
// COMPONENT
// =====================================================

export default function IntegrationsPage() {
  return (
    <DashboardLayout>
      <Container>
        <SettingsLayout title="Integrations" description="Connect ORbit to your existing systems">
          {/* Coming Soon Banner */}
          <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Integrations Coming Soon</h3>
                <p className="text-sm text-slate-600 mt-1">
                  We're building integrations with popular healthcare systems. Interested in a specific integration? 
                  <a href="mailto:support@orbitsurgical.com" className="text-blue-600 hover:underline ml-1">Let us know</a>.
                </p>
              </div>
            </div>
          </div>

          {/* Integration Cards */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="font-medium text-slate-900">Available Integrations</h3>
              <p className="text-sm text-slate-500 mt-0.5">Connect your tools to streamline OR operations</p>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {integrations.map((integration) => (
                  <div
                    key={integration.id}
                    className="relative p-5 bg-slate-50 border border-slate-200 rounded-xl hover:border-slate-300 transition-colors"
                  >
                    {/* Coming Soon Badge */}
                    <div className="absolute top-4 right-4">
                      <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-slate-500 bg-white border border-slate-200 rounded-full">
                        {integration.comingSoon || 'Coming Soon'}
                      </span>
                    </div>

                    {/* Icon */}
                    <div className="w-12 h-12 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 mb-4">
                      {integration.icon}
                    </div>

                    {/* Content */}
                    <h4 className="font-semibold text-slate-900 mb-1">{integration.name}</h4>
                    <p className="text-sm text-slate-500 leading-relaxed">{integration.description}</p>

                    {/* Category Tag */}
                    <div className="mt-4">
                      <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded ${
                        integration.category === 'ehr' ? 'bg-purple-100 text-purple-700' :
                        integration.category === 'scheduling' ? 'bg-blue-100 text-blue-700' :
                        integration.category === 'communication' ? 'bg-green-100 text-green-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {categories.find(c => c.id === integration.category)?.label}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Request Integration Card */}
          <div className="mt-6 p-6 bg-white border border-dashed border-slate-300 rounded-xl text-center">
            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <h4 className="font-semibold text-slate-900 mb-1">Need a different integration?</h4>
            <p className="text-sm text-slate-500 mb-4">
              We're always looking to expand our integration options. Let us know what tools you'd like to connect.
            </p>
            <a
              href="mailto:support@orbitsurgical.com?subject=Integration%20Request"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Request an Integration
            </a>
          </div>

          {/* API Access Card */}
          <div className="mt-6 p-6 bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl text-white">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
              </div>
              <div>
                <h4 className="font-semibold text-lg mb-1">API Access</h4>
                <p className="text-slate-300 text-sm leading-relaxed mb-4">
                  Build custom integrations with our REST API. Access case data, milestones, analytics, and more programmatically.
                </p>
                <span className="inline-flex items-center px-3 py-1 text-xs font-medium text-slate-300 bg-white/10 rounded-full">
                  Coming Q2 2026
                </span>
              </div>
            </div>
          </div>
        </SettingsLayout>
      </Container>
    </DashboardLayout>
  )
}