// app/settings/integrations/PageClient.tsx
// Integrations landing page — HL7v2 system cards + future integrations

'use client'

import { useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Code, Mail, Plus, Zap, CheckCircle2, XCircle, ArrowRight } from 'lucide-react'
import { useCurrentUser } from '@/hooks'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { ehrDAL } from '@/lib/dal/ehr'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/ui/Toast'
import { logger } from '@/lib/logger'
import SwitchIntegrationDialog from '@/components/integrations/SwitchIntegrationDialog'
import {
  HL7V2_INTEGRATION_TYPES,
  EHR_SYSTEM_DISPLAY_NAMES,
} from '@/lib/integrations/shared/integration-types'
import type { EhrIntegration, EhrIntegrationType } from '@/lib/integrations/shared/integration-types'

const log = logger('integrations-page')

// =====================================================
// TYPES
// =====================================================

interface FutureIntegration {
  id: string
  name: string
  description: string
  icon: React.ReactNode
  category: 'ehr' | 'scheduling' | 'communication' | 'analytics'
  comingSoon?: string
}

// =====================================================
// HL7v2 SYSTEM CARD METADATA
// =====================================================

interface Hl7v2SystemCard {
  integrationType: EhrIntegrationType
  displayName: string
  description: string
  route: string
  iconGradientFrom: string
  iconGradientTo: string
  iconBorder: string
  iconColor: string
  buttonColor: string
  buttonBg: string
  buttonHover: string
  hoverBorder: string
  icon: React.ReactNode
}

const HL7V2_SYSTEM_CARDS: Hl7v2SystemCard[] = [
  {
    integrationType: 'epic_hl7v2',
    displayName: 'Epic',
    description: 'Receive surgical scheduling data via HL7v2 SIU messages from Epic OpTime',
    route: '/settings/integrations/epic',
    iconGradientFrom: 'from-blue-50',
    iconGradientTo: 'to-indigo-50',
    iconBorder: 'border-blue-100',
    iconColor: 'text-blue-600',
    buttonColor: 'text-blue-600',
    buttonBg: 'bg-blue-50',
    buttonHover: 'hover:bg-blue-100',
    hoverBorder: 'hover:border-blue-200',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24">
        <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth={1.5} />
        <path d="M7 8h10M7 12h10M7 16h6" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
      </svg>
    ),
  },
  {
    integrationType: 'cerner_hl7v2',
    displayName: 'Oracle Cerner',
    description: 'Receive surgical scheduling data via HL7v2 SIU messages from Cerner SurgiNet',
    route: '/settings/integrations/cerner',
    iconGradientFrom: 'from-red-50',
    iconGradientTo: 'to-orange-50',
    iconBorder: 'border-red-100',
    iconColor: 'text-red-600',
    buttonColor: 'text-red-600',
    buttonBg: 'bg-red-50',
    buttonHover: 'hover:bg-red-100',
    hoverBorder: 'hover:border-red-200',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth={1.5} />
        <path d="M8 12h8M12 8v8" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
      </svg>
    ),
  },
  {
    integrationType: 'meditech_hl7v2',
    displayName: 'MEDITECH',
    description: 'Receive surgical scheduling data via HL7v2 SIU messages from MEDITECH Expanse',
    route: '/settings/integrations/meditech',
    iconGradientFrom: 'from-emerald-50',
    iconGradientTo: 'to-teal-50',
    iconBorder: 'border-emerald-100',
    iconColor: 'text-emerald-600',
    buttonColor: 'text-emerald-600',
    buttonBg: 'bg-emerald-50',
    buttonHover: 'hover:bg-emerald-100',
    hoverBorder: 'hover:border-emerald-200',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24">
        <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth={1.5} />
        <path d="M7 12h4l2-4 2 8 2-4h3" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
]

// =====================================================
// FUTURE INTEGRATIONS (non-HL7v2)
// =====================================================

const futureIntegrations: FutureIntegration[] = [
  {
    id: 'athena',
    name: 'athenahealth',
    description: 'Integrate with athenahealth for scheduling and billing',
    category: 'ehr',
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
// STATUS BADGE
// =====================================================

function IntegrationStatusBadge({ integration }: { integration: EhrIntegration | null | undefined }) {
  if (!integration) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-600 bg-slate-100 rounded-full">
        <XCircle className="w-3.5 h-3.5" />
        Not Configured
      </span>
    )
  }

  if (integration.is_active) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-full">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Connected
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-600 bg-slate-100 rounded-full">
      <XCircle className="w-3.5 h-3.5" />
      Disabled
    </span>
  )
}

// =====================================================
// COMPONENT
// =====================================================

export default function IntegrationsPage() {
  const router = useRouter()
  const { data: currentUser } = useCurrentUser()
  const { showToast } = useToast()
  const facilityId = currentUser?.facilityId

  // Fetch all HL7v2 integrations for this facility
  const { data: allIntegrations, loading: integrationsLoading, refetch } = useSupabaseQuery<EhrIntegration[]>(
    async (supabase) => {
      const { data } = await ehrDAL.listIntegrations(supabase, facilityId!)
      // Filter to only HL7v2 types
      return (data || []).filter((i) =>
        HL7V2_INTEGRATION_TYPES.includes(i.integration_type)
      )
    },
    { deps: [facilityId], enabled: !!facilityId }
  )

  // Build a lookup map: integrationType → EhrIntegration | null
  const integrationMap = useMemo(() => {
    const map: Partial<Record<EhrIntegrationType, EhrIntegration>> = {}
    for (const integration of allIntegrations || []) {
      map[integration.integration_type] = integration
    }
    return map
  }, [allIntegrations])

  // Find the currently active HL7v2 integration (if any)
  const activeHl7v2 = useMemo(
    () => (allIntegrations || []).find((i) => i.is_active) ?? null,
    [allIntegrations]
  )

  // Switch dialog state
  const [switchTarget, setSwitchTarget] = useState<EhrIntegrationType | null>(null)
  const [switching, setSwitching] = useState(false)

  const handleSwitch = useCallback(async () => {
    if (!activeHl7v2 || !switchTarget || !facilityId) return

    try {
      setSwitching(true)
      const supabase = createClient()

      // Deactivate current integration
      const { error } = await supabase
        .from('ehr_integrations')
        .update({ is_active: false })
        .eq('id', activeHl7v2.id)

      if (error) {
        log.error('Failed to deactivate integration', { error })
        showToast({
          type: 'error',
          title: 'Switch Failed',
          message: 'Could not deactivate the current integration. Please try again.',
        })
        return
      }

      log.info('Integration switched', {
        from: activeHl7v2.integration_type,
        to: switchTarget,
        facilityId,
      })

      showToast({
        type: 'success',
        title: 'Integration Switched',
        message: `Disconnected ${EHR_SYSTEM_DISPLAY_NAMES[activeHl7v2.integration_type]}. Redirecting to ${EHR_SYSTEM_DISPLAY_NAMES[switchTarget]} setup...`,
      })

      setSwitchTarget(null)

      // Navigate to the new system's config page
      const targetCard = HL7V2_SYSTEM_CARDS.find((c) => c.integrationType === switchTarget)
      if (targetCard) {
        router.push(targetCard.route)
      }
    } catch (err) {
      log.error('Switch integration error', { error: err })
      showToast({
        type: 'error',
        title: 'Switch Failed',
        message: 'An unexpected error occurred. Please try again.',
      })
    } finally {
      setSwitching(false)
    }
  }, [activeHl7v2, switchTarget, facilityId, router, showToast])

  const handleCardClick = useCallback(
    (card: Hl7v2SystemCard) => {
      // If there's an active integration for a DIFFERENT system, show switch dialog
      if (activeHl7v2 && activeHl7v2.integration_type !== card.integrationType) {
        setSwitchTarget(card.integrationType)
        return
      }
      // Otherwise navigate directly
      router.push(card.route)
    },
    [activeHl7v2, router]
  )

  return (
    <>
      <h1 className="text-2xl font-semibold text-slate-900 mb-1">Integrations</h1>
      <p className="text-slate-500 mb-6">Connect ORbit to your existing systems</p>

      {/* Active Integrations — HL7v2 Systems */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="font-medium text-slate-900">EHR Integrations</h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Connect to your hospital&apos;s EHR system via HL7v2 SIU messages.
            One HL7v2 integration per facility.
          </p>
        </div>

        <div className="p-6 space-y-4">
          {HL7V2_SYSTEM_CARDS.map((card) => {
            const integration = integrationMap[card.integrationType] ?? null
            const isActive = !!integration?.is_active
            const hasOtherActive = !!activeHl7v2 && activeHl7v2.integration_type !== card.integrationType
            const isCurrentActive = !!activeHl7v2 && activeHl7v2.integration_type === card.integrationType

            return (
              <div
                key={card.integrationType}
                className={`relative p-5 bg-white border rounded-xl hover:shadow-sm transition-all cursor-pointer ${
                  isCurrentActive
                    ? `border-emerald-200 ${card.hoverBorder}`
                    : `border-slate-200 ${card.hoverBorder}`
                }`}
                onClick={() => handleCardClick(card)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    {/* System Icon */}
                    <div className={`w-12 h-12 bg-gradient-to-br ${card.iconGradientFrom} ${card.iconGradientTo} border ${card.iconBorder} rounded-xl flex items-center justify-center ${card.iconColor} flex-shrink-0`}>
                      {card.icon}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h4 className="font-semibold text-slate-900">{card.displayName}</h4>
                        {integrationsLoading ? (
                          <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium text-slate-400 bg-slate-50 rounded-full">
                            Loading...
                          </span>
                        ) : (
                          <IntegrationStatusBadge integration={integration} />
                        )}
                      </div>
                      <p className="text-sm text-slate-500">{card.description}</p>

                      {/* Last message indicator when connected */}
                      {isActive && integration?.last_message_at && (
                        <p className="text-xs text-slate-400 mt-2">
                          Last message: {new Date(integration.last_message_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Action button */}
                  <div className="flex-shrink-0 ml-4">
                    {hasOtherActive ? (
                      <button
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSwitchTarget(card.integrationType)
                        }}
                      >
                        Switch
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium ${card.buttonColor} ${card.buttonBg} rounded-lg ${card.buttonHover} transition-colors`}
                        onClick={(e) => {
                          e.stopPropagation()
                          router.push(card.route)
                        }}
                      >
                        {isActive ? 'Manage' : 'Set Up'}
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Category tag */}
                <div className="mt-4">
                  <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-purple-100 text-purple-700">
                    HL7v2 SIU
                  </span>
                </div>
              </div>
            )
          })}
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

      {/* Switch Integration Dialog */}
      {activeHl7v2 && switchTarget && (
        <SwitchIntegrationDialog
          open={!!switchTarget}
          onClose={() => setSwitchTarget(null)}
          onConfirm={handleSwitch}
          currentType={activeHl7v2.integration_type}
          targetType={switchTarget}
          loading={switching}
        />
      )}
    </>
  )
}
