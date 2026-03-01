// app/settings/integrations/PageClient.tsx
// Integrations page with active Epic card and future integration placeholders

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Code, Mail, Plus, Zap, CheckCircle2, AlertCircle, XCircle, ArrowRight } from 'lucide-react'
import { useCurrentUser } from '@/hooks'
import type { EpicConnectionStatus } from '@/lib/epic/types'

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
  comingSoon?: string
}

interface EpicStatusResponse {
  connection: {
    id: string
    status: EpicConnectionStatus
    last_connected_at: string | null
    connected_by: string | null
    token_expires_at: string | null
    fhir_base_url: string
  } | null
  mappingStats: {
    surgeon: { total: number; mapped: number }
    room: { total: number; mapped: number }
    procedure: { total: number; mapped: number }
  } | null
}

// =====================================================
// INTEGRATION DATA (non-Epic — still coming soon)
// =====================================================

const futureIntegrations: Integration[] = [
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

// =====================================================
// EPIC STATUS INDICATOR
// =====================================================

function EpicStatusBadge({ status }: { status: EpicConnectionStatus | null }) {
  if (!status || status === 'disconnected') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-600 bg-slate-100 rounded-full">
        <XCircle className="w-3.5 h-3.5" />
        Not Connected
      </span>
    )
  }

  if (status === 'connected') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-full">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Connected
      </span>
    )
  }

  if (status === 'token_expired') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-amber-700 bg-amber-50 rounded-full">
        <AlertCircle className="w-3.5 h-3.5" />
        Token Expired
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 rounded-full">
      <AlertCircle className="w-3.5 h-3.5" />
      Error
    </span>
  )
}

// =====================================================
// COMPONENT
// =====================================================

export default function IntegrationsPage() {
  const router = useRouter()
  const { data: currentUser } = useCurrentUser()
  const [epicStatus, setEpicStatus] = useState<EpicStatusResponse | null>(null)
  const [epicLoading, setEpicLoading] = useState(true)

  useEffect(() => {
    if (!currentUser?.facilityId) return

    async function fetchEpicStatus() {
      try {
        const res = await fetch(`/api/epic/status?facility_id=${currentUser!.facilityId}`)
        if (res.ok) {
          const data = await res.json()
          setEpicStatus(data)
        }
      } catch {
        // Silently fail — Epic may not be configured
      } finally {
        setEpicLoading(false)
      }
    }

    fetchEpicStatus()
  }, [currentUser?.facilityId])

  const epicConnection = epicStatus?.connection
  const isConnected = epicConnection?.status === 'connected'

  return (
    <>
      <h1 className="text-2xl font-semibold text-slate-900 mb-1">Integrations</h1>
      <p className="text-slate-500 mb-6">Connect ORbit to your existing systems</p>

      {/* Active Integrations */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="font-medium text-slate-900">Active Integrations</h3>
          <p className="text-sm text-slate-500 mt-0.5">Integrations available for your facility</p>
        </div>

        <div className="p-6">
          {/* Epic Card — Active */}
          <div
            className="relative p-5 bg-white border border-slate-200 rounded-xl hover:border-blue-200 hover:shadow-sm transition-all cursor-pointer"
            onClick={() => router.push('/settings/integrations/epic')}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                {/* Epic Icon */}
                <div className="w-12 h-12 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-xl flex items-center justify-center text-blue-600 flex-shrink-0">
                  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24">
                    <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth={1.5} />
                    <path d="M7 8h10M7 12h10M7 16h6" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
                  </svg>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h4 className="font-semibold text-slate-900">Epic</h4>
                    {epicLoading ? (
                      <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium text-slate-400 bg-slate-50 rounded-full">
                        Loading...
                      </span>
                    ) : (
                      <EpicStatusBadge status={epicConnection?.status ?? null} />
                    )}
                  </div>
                  <p className="text-sm text-slate-500">
                    Sync surgical cases and patient scheduling with Epic EHR via SMART on FHIR
                  </p>

                  {/* Mapping stats when connected */}
                  {isConnected && epicStatus?.mappingStats && (
                    <div className="flex items-center gap-4 mt-3">
                      {(['surgeon', 'room', 'procedure'] as const).map((type) => {
                        const stat = epicStatus.mappingStats![type]
                        if (stat.total === 0) return null
                        return (
                          <span key={type} className="text-xs text-slate-500">
                            <span className="font-medium text-slate-700">{stat.mapped}/{stat.total}</span>{' '}
                            {type}s mapped
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Action button */}
              <div className="flex-shrink-0 ml-4">
                <button
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation()
                    router.push('/settings/integrations/epic')
                  }}
                >
                  {isConnected ? 'Manage' : 'Set Up'}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Category tag */}
            <div className="mt-4">
              <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-purple-100 text-purple-700">
                EHR Systems
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Coming Soon Banner */}
      <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <Zap className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">More Integrations Coming Soon</h3>
            <p className="text-sm text-slate-600 mt-1">
              We&apos;re building integrations with popular healthcare systems. Interested in a specific integration?
              <a href="mailto:support@orbitsurgical.com" className="text-blue-600 hover:underline ml-1">Let us know</a>.
            </p>
          </div>
        </div>
      </div>

      {/* Future Integration Cards */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="font-medium text-slate-900">Planned Integrations</h3>
          <p className="text-sm text-slate-500 mt-0.5">Coming soon to ORbit</p>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {futureIntegrations.map((integration) => (
              <div
                key={integration.id}
                className="relative p-4 bg-slate-50 border border-slate-200 rounded-xl"
              >
                <div className="absolute top-4 right-4">
                  <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-slate-500 bg-white border border-slate-200 rounded-full">
                    {integration.comingSoon || 'Coming Soon'}
                  </span>
                </div>

                <div className="w-12 h-12 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 mb-4">
                  {integration.icon}
                </div>

                <h4 className="font-semibold text-slate-900 mb-1">{integration.name}</h4>
                <p className="text-sm text-slate-500 leading-relaxed">{integration.description}</p>

                <div className="mt-4">
                  <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded ${
                    integration.category === 'ehr' ? 'bg-purple-100 text-purple-700' :
                    integration.category === 'scheduling' ? 'bg-blue-100 text-blue-700' :
                    integration.category === 'communication' ? 'bg-green-100 text-green-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {integration.category === 'ehr' ? 'EHR Systems' :
                     integration.category === 'scheduling' ? 'Scheduling' :
                     integration.category === 'communication' ? 'Communication' :
                     'Analytics'}
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
          <Plus className="w-6 h-6 text-slate-400" />
        </div>
        <h4 className="font-semibold text-slate-900 mb-1">Need a different integration?</h4>
        <p className="text-sm text-slate-500 mb-4">
          We&apos;re always looking to expand our integration options. Let us know what tools you&apos;d like to connect.
        </p>
        <a
          href="mailto:support@orbitsurgical.com?subject=Integration%20Request"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
        >
          <Mail className="w-4 h-4" />
          Request an Integration
        </a>
      </div>

      {/* API Access Card */}
      <div className="mt-6 p-6 bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl text-white">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
            <Code className="w-6 h-6" />
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
    </>
  )
}
