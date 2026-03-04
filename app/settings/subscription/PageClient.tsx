// app/settings/subscription/PageClient.tsx
// Subscription: View current plan, feature comparison, usage stats, and upgrade request.

'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Check, X, ArrowRight, Mail } from 'lucide-react'
import { getLocalDateString } from '@/lib/date-utils'
import {
  type TierSlug,
  type TierFeatureKey,
  TIER_DEFINITIONS,
  TIER_SLUGS,
} from '@/lib/tier-config'

// =====================================================
// TYPES
// =====================================================

interface UsageStats {
  casesThisMonth: number
  casesLastMonth: number
  activeUsers: number
}

// =====================================================
// FEATURE COMPARISON DATA
// =====================================================

interface FeatureRow {
  label: string
  key: TierFeatureKey | 'basic_flow' | 'dashboard' | 'case_management'
  /** If true, feature is available on all tiers */
  allTiers?: boolean
}

const FEATURE_ROWS: FeatureRow[] = [
  { label: 'Day-of Surgical Flow', key: 'basic_flow', allTiers: true },
  { label: 'Dashboard & Room Status', key: 'dashboard', allTiers: true },
  { label: 'Case Management', key: 'case_management', allTiers: true },
  { label: 'Advanced Analytics', key: 'analytics' },
  { label: 'ORbit Score', key: 'orbit_score' },
  { label: 'Flag Detection', key: 'flags' },
  { label: 'Data Quality Engine', key: 'data_quality' },
  { label: 'SPD Tracking', key: 'spd' },
  { label: 'Financial Analytics', key: 'financials' },
  { label: 'EHR Integrations', key: 'integrations' },
]

function isFeatureEnabled(tier: TierSlug, row: FeatureRow): boolean {
  if (row.allTiers) return true
  return TIER_DEFINITIONS[tier].features[row.key as TierFeatureKey] ?? false
}

// =====================================================
// SKELETON
// =====================================================

function SubscriptionSkeleton() {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="h-6 bg-slate-200 rounded w-32 mb-4 animate-pulse" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-slate-100 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  )
}

// =====================================================
// COMPONENT
// =====================================================

export default function SubscriptionPage() {
  const supabase = createClient()
  const {
    effectiveFacilityId,
    loading: userLoading,
    tier,
    tierName,
    tierLoading,
    isTierAtLeast,
  } = useUser()
  const { showToast } = useToast()
  const [stats, setStats] = useState<UsageStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const currentPlanDef = TIER_DEFINITIONS[tier]

  const fetchUsageStats = useCallback(async () => {
    if (!effectiveFacilityId) return
    setLoading(true)

    try {
      const now = new Date()
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const lastOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)

      const [thisMonthRes, lastMonthRes, usersRes] = await Promise.all([
        supabase
          .from('cases')
          .select('id', { count: 'exact', head: true })
          .eq('facility_id', effectiveFacilityId)
          .gte('scheduled_date', getLocalDateString(firstOfMonth)),
        supabase
          .from('cases')
          .select('id', { count: 'exact', head: true })
          .eq('facility_id', effectiveFacilityId)
          .gte('scheduled_date', getLocalDateString(firstOfLastMonth))
          .lte('scheduled_date', getLocalDateString(lastOfLastMonth)),
        supabase
          .from('users')
          .select('id', { count: 'exact', head: true })
          .eq('facility_id', effectiveFacilityId)
          .eq('is_active', true),
      ])

      setStats({
        casesThisMonth: thisMonthRes.count || 0,
        casesLastMonth: lastMonthRes.count || 0,
        activeUsers: usersRes.count || 0,
      })
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Error Fetching Usage Stats',
        message: err instanceof Error ? err.message : 'Failed to fetch usage statistics',
      })
    } finally {
      setLoading(false)
    }
  }, [effectiveFacilityId, supabase, showToast])

  useEffect(() => {
    if (!userLoading && effectiveFacilityId) {
      fetchUsageStats()
    } else if (!userLoading) {
      setLoading(false)
    }
  }, [userLoading, effectiveFacilityId, fetchUsageStats])

  const isLoading = loading || tierLoading

  return (
    <>
      <h1 className="text-2xl font-semibold text-slate-900 mb-1">Subscription</h1>
      <p className="text-slate-500 mb-6">View your current plan, compare features, and request upgrades</p>
      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      {isLoading ? (
        <SubscriptionSkeleton />
      ) : (
        <div className="space-y-6">
          {/* Current Plan Card */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 text-white">
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className="text-slate-400 text-sm mb-1">Current Plan</p>
                <h2 className="text-2xl font-semibold">{tierName}</h2>
                <p className="text-slate-400 mt-1">{currentPlanDef.description}</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold">
                  ${currentPlanDef.priceMonthly.toLocaleString()}
                </p>
                <p className="text-slate-400 text-sm">per month</p>
              </div>
            </div>

            <div className="flex items-center gap-4 pt-4 border-t border-slate-700">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-400 rounded-full" />
                <span className="text-sm text-slate-300">Active</span>
              </div>
            </div>
          </div>

          {/* Usage Stats */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="font-medium text-slate-900">Current Usage</h3>
              <p className="text-sm text-slate-500 mt-0.5">Activity this billing period</p>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Cases This Month */}
                <div className="p-4 bg-slate-50 rounded-xl">
                  <p className="text-sm text-slate-500 mb-1">Cases This Month</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {stats?.casesThisMonth ?? 0}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {stats?.casesLastMonth ?? 0} last month
                  </p>
                </div>

                {/* Active Users */}
                <div className="p-4 bg-slate-50 rounded-xl">
                  <p className="text-sm text-slate-500 mb-1">Active Users</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {stats?.activeUsers ?? 0}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Across all roles
                  </p>
                </div>

                {/* Features Enabled */}
                <div className="p-4 bg-slate-50 rounded-xl">
                  <p className="text-sm text-slate-500 mb-1">Features Enabled</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {Object.values(currentPlanDef.features).filter(Boolean).length} / {Object.keys(currentPlanDef.features).length}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Premium feature categories
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Feature Comparison Grid */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="font-medium text-slate-900">Plan Comparison</h3>
              <p className="text-sm text-slate-500 mt-0.5">See what each plan includes</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left text-sm font-medium text-slate-500 px-6 py-3 w-1/3">
                      Feature
                    </th>
                    {TIER_SLUGS.map((slug) => {
                      const def = TIER_DEFINITIONS[slug]
                      const isCurrent = slug === tier
                      return (
                        <th
                          key={slug}
                          className={`text-center text-sm font-medium px-4 py-3 ${
                            isCurrent ? 'text-blue-700 bg-blue-50/50' : 'text-slate-700'
                          }`}
                        >
                          <div>{def.name}</div>
                          <div className="text-xs font-normal text-slate-400 mt-0.5">
                            ${def.priceMonthly.toLocaleString()}/mo
                          </div>
                          {isCurrent && (
                            <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                              Current
                            </span>
                          )}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {FEATURE_ROWS.map((row) => (
                    <tr key={row.key} className="border-b border-slate-100 last:border-0">
                      <td className="text-sm text-slate-700 px-6 py-3">{row.label}</td>
                      {TIER_SLUGS.map((slug) => {
                        const enabled = isFeatureEnabled(slug, row)
                        const isCurrent = slug === tier
                        return (
                          <td
                            key={slug}
                            className={`text-center px-4 py-3 ${
                              isCurrent ? 'bg-blue-50/30' : ''
                            }`}
                          >
                            {enabled ? (
                              <Check className="h-5 w-5 text-green-500 mx-auto" />
                            ) : (
                              <X className="h-5 w-5 text-slate-300 mx-auto" />
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Upgrade CTA */}
          {!isTierAtLeast('enterprise') && (
            <div className="p-6 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg">Ready to unlock more?</h3>
                  <p className="text-blue-100 mt-1">
                    Upgrade to{' '}
                    {isTierAtLeast('professional') ? 'Enterprise' : 'Professional'} for{' '}
                    {isTierAtLeast('professional')
                      ? 'financials, integrations, and unlimited customization.'
                      : 'analytics, scoring, flags, and data quality.'}
                  </p>
                </div>
                <a
                  href="mailto:support@orbitsurgical.com?subject=Subscription%20Upgrade%20Request"
                  className="px-4 py-2.5 bg-white text-blue-600 font-medium rounded-lg hover:bg-blue-50 transition-colors flex-shrink-0 inline-flex items-center gap-2"
                >
                  <Mail className="h-4 w-4" />
                  Request Upgrade
                </a>
              </div>
            </div>
          )}

          {/* Enterprise Contact CTA (always visible) */}
          <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-slate-900">Need a custom plan?</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Contact us to discuss enterprise pricing and custom integrations.
                </p>
              </div>
              <a
                href="mailto:support@orbitsurgical.com?subject=Enterprise%20Plan%20Inquiry"
                className="px-4 py-2.5 text-slate-700 font-medium border border-slate-300 rounded-lg hover:bg-white transition-colors flex-shrink-0 inline-flex items-center gap-2"
              >
                Contact Sales
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
