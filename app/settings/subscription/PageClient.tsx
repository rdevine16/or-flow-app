// app/settings/subscription/page.tsx
// Subscription: View plan details, usage, and billing (Coming Soon)

'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Check, Clock } from 'lucide-react'
import { getLocalDateString } from '@/lib/date-utils'

// =====================================================
// TYPES
// =====================================================

interface UsageStats {
  casesThisMonth: number
  casesLastMonth: number
  activeUsers: number
  storageUsedMB: number
}

// =====================================================
// PLAN DATA
// =====================================================

const plans = [
  {
    id: 'starter',
    name: 'Starter',
    price: 750,
    billingPeriod: 'month',
    description: 'For small ASCs getting started',
    features: [
      'Up to 100 cases/month',
      'Up to 5 users',
      'Basic analytics',
      'Email support',
    ],
    limits: {
      casesPerMonth: 100,
      users: 5,
    },
  },
  {
    id: 'professional',
    name: 'Professional',
    price: 1500,
    billingPeriod: 'month',
    description: 'For growing surgical centers',
    features: [
      'Up to 300 cases/month',
      'Up to 20 users',
      'Advanced analytics',
      'Device rep portal',
      'Priority support',
    ],
    limits: {
      casesPerMonth: 300,
      users: 20,
    },
    popular: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 2500,
    billingPeriod: 'month',
    description: 'For high-volume facilities',
    features: [
      'Unlimited cases',
      'Unlimited users',
      'Custom analytics',
      'API access',
      'Dedicated support',
      'Custom integrations',
    ],
    limits: {
      casesPerMonth: Infinity,
      users: Infinity,
    },
  },
]

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
  const { effectiveFacilityId, loading: userLoading } = useUser()
  const { showToast } = useToast()
  const [stats, setStats] = useState<UsageStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Simulated current plan (would come from database in production)
  const currentPlan = plans[1] // Professional

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
        storageUsedMB: 124, // Placeholder
      })
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Error Fetching Usage Stats',
        message: error instanceof Error ? error.message : 'Failed to fetch usage statistics'
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

  const getUsagePercentage = (used: number, limit: number) => {
    if (limit === Infinity) return 0
    return Math.min((used / limit) * 100, 100)
  }

  const formatNumber = (num: number) => {
    if (num === Infinity) return 'Unlimited'
    return num.toLocaleString()
  }

  return (
    <>
      <h1 className="text-2xl font-semibold text-slate-900 mb-1">Subscription</h1>
      <p className="text-slate-500 mb-6">Manage your plan, view usage, and billing details</p>
      <ErrorBanner message={error} onDismiss={() => setError(null)} />
      {/* Coming Soon Banner */}
          <div className="mb-6 p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Coming Soon</h3>
                <p className="text-sm text-slate-600 mt-1">
                  Self-service subscription management is in development. Contact us to discuss your plan needs.
                </p>
              </div>
            </div>
          </div>

          {loading ? (
            <SubscriptionSkeleton />
          ) : (
            <div className="space-y-6">
              {/* Current Plan Card */}
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 text-white">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <p className="text-slate-400 text-sm mb-1">Current Plan</p>
                    <h2 className="text-2xl font-semibold">{currentPlan.name}</h2>
                    <p className="text-slate-400 mt-1">{currentPlan.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold">${currentPlan.price}</p>
                    <p className="text-slate-400 text-sm">per {currentPlan.billingPeriod}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 pt-4 border-t border-slate-700">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-400 rounded-full" />
                    <span className="text-sm text-slate-300">Active</span>
                  </div>
                  <span className="text-slate-600">•</span>
                  <span className="text-sm text-slate-400">Next billing: February 1, 2026</span>
                </div>
              </div>

              {/* Usage Stats */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200">
                  <h3 className="font-medium text-slate-900">Current Usage</h3>
                  <p className="text-sm text-slate-500 mt-0.5">Your usage this billing period</p>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Cases This Month */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-slate-600">Cases This Month</span>
                        <span className="text-sm font-medium text-slate-900">
                          {stats?.casesThisMonth || 0} / {formatNumber(currentPlan.limits.casesPerMonth)}
                        </span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all ${
                            getUsagePercentage(stats?.casesThisMonth || 0, currentPlan.limits.casesPerMonth) > 90
                              ? 'bg-red-500'
                              : getUsagePercentage(stats?.casesThisMonth || 0, currentPlan.limits.casesPerMonth) > 75
                              ? 'bg-amber-500'
                              : 'bg-blue-500'
                          }`}
                          style={{ width: `${getUsagePercentage(stats?.casesThisMonth || 0, currentPlan.limits.casesPerMonth)}%` }}
                        />
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        {stats?.casesLastMonth || 0} cases last month
                      </p>
                    </div>

                    {/* Active Users */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-slate-600">Active Users</span>
                        <span className="text-sm font-medium text-slate-900">
                          {stats?.activeUsers || 0} / {formatNumber(currentPlan.limits.users)}
                        </span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all ${
                            getUsagePercentage(stats?.activeUsers || 0, currentPlan.limits.users) > 90
                              ? 'bg-red-500'
                              : getUsagePercentage(stats?.activeUsers || 0, currentPlan.limits.users) > 75
                              ? 'bg-amber-500'
                              : 'bg-green-500'
                          }`}
                          style={{ width: `${getUsagePercentage(stats?.activeUsers || 0, currentPlan.limits.users)}%` }}
                        />
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        {currentPlan.limits.users - (stats?.activeUsers || 0)} seats available
                      </p>
                    </div>

                    {/* Storage */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-slate-600">Storage Used</span>
                        <span className="text-sm font-medium text-slate-900">
                          {stats?.storageUsedMB || 0} MB / 5 GB
                        </span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-purple-500 rounded-full transition-all"
                          style={{ width: `${((stats?.storageUsedMB || 0) / 5000) * 100}%` }}
                        />
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        Audit logs and attachments
                      </p>
                    </div>

                    {/* API Calls (Coming Soon) */}
                    <div className="opacity-50">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-slate-600">API Calls</span>
                        <span className="text-sm font-medium text-slate-400">
                          Coming Soon
                        </span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-slate-200 rounded-full w-0" />
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        Available with API access
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Available Plans */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden opacity-75">
                <div className="px-6 py-4 border-b border-slate-200">
                  <h3 className="font-medium text-slate-900">Available Plans</h3>
                  <p className="text-sm text-slate-500 mt-0.5">Compare features and upgrade when ready</p>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {plans.map((plan) => {
                      const isCurrent = plan.id === currentPlan.id
                      
                      return (
                        <div 
                          key={plan.id} 
                          className={`relative p-4 rounded-xl border-2 transition-colors ${
                            isCurrent 
                              ? 'border-blue-500 bg-blue-50/50' 
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          {plan.popular && (
                            <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-blue-600 text-white text-xs font-semibold rounded-full">
                              Most Popular
                            </span>
                          )}
                          
                          {isCurrent && (
                            <span className="absolute top-4 right-4 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                              Current
                            </span>
                          )}

                          <h4 className="font-semibold text-slate-900 text-lg">{plan.name}</h4>
                          <p className="text-sm text-slate-500 mt-1">{plan.description}</p>
                          
                          <div className="mt-4 mb-4">
                            <span className="text-3xl font-bold text-slate-900">${plan.price}</span>
                            <span className="text-slate-500">/{plan.billingPeriod}</span>
                          </div>

                          <ul className="space-y-2 mb-4">
                            {plan.features.map((feature, idx) => (
                              <li key={idx} className="flex items-center gap-2 text-sm text-slate-600">
                                <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                                {feature}
                              </li>
                            ))}
                          </ul>

                          <button
                            disabled
                            className={`w-full py-2 px-4 rounded-lg text-sm font-medium transition-colors cursor-not-allowed ${
                              isCurrent
                                ? 'bg-slate-100 text-slate-400'
                                : 'bg-slate-100 text-slate-400'
                            }`}
                          >
                            {isCurrent ? 'Current Plan' : 'Contact Sales'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Billing Information */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden opacity-75">
                <div className="px-6 py-4 border-b border-slate-200">
                  <h3 className="font-medium text-slate-900">Billing Information</h3>
                  <p className="text-sm text-slate-500 mt-0.5">Payment method and billing history</p>
                </div>
                <div className="p-6">
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200 mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-8 bg-gradient-to-r from-slate-700 to-slate-800 rounded flex items-center justify-center">
                        <span className="text-white text-xs font-bold">VISA</span>
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">•••• •••• •••• 4242</p>
                        <p className="text-sm text-slate-500">Expires 12/2027</p>
                      </div>
                    </div>
                    <button
                      disabled
                      className="px-3 py-1.5 text-sm text-slate-400 bg-white border border-slate-200 rounded-lg cursor-not-allowed"
                    >
                      Update
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Billing Contact</span>
                    <span className="text-sm text-slate-900">billing@facility.com</span>
                  </div>
                </div>
              </div>

              {/* Contact Sales CTA */}
              <div className="p-6 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">Need a custom plan?</h3>
                    <p className="text-blue-100 mt-1">
                      Contact us to discuss enterprise pricing and custom integrations.
                    </p>
                  </div>
                  <a
                    href="mailto:sales@orbitsurgical.com?subject=Enterprise%20Plan%20Inquiry"
                    className="px-4 py-2.5 bg-white text-blue-600 font-medium rounded-lg hover:bg-blue-50 transition-colors flex-shrink-0"
                  >
                    Contact Sales
                  </a>
                </div>
            </div>
          </div>
        )}
    </>
  )
}