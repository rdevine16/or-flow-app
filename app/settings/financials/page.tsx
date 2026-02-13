// app/settings/financials/page.tsx
// Financials Overview - Hub for all financial settings

'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import SettingsLayout from '@/components/settings/SettingsLayout'
import { Building2, Calculator, Check, ChevronRight, ClipboardCheck, Clock, PenLine, Plus, Tag, User } from 'lucide-react'
import { genericAuditLog } from '@/lib/audit-logger'
import Link from 'next/link'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { PageLoader } from '@/components/ui/Loading'
import { ErrorBanner } from '@/components/ui/ErrorBanner'


// Financial audit actions for filtering recent activity
const FINANCIAL_AUDIT_ACTIONS = [
  // Cost Categories
  'cost_category.created',
  'cost_category.updated',
  'cost_category.deleted',
  'cost_category.restored',
  'cost_category.activated',
  'cost_category.deactivated',
  // Payers
  'payer.created',
  'payer.updated',
  'payer.deleted',
  'payer.restored',
  // Procedure Pricing
  'procedure_cost_item.created',
  'procedure_cost_item.updated',
  'procedure_cost_item.deleted',
  'procedure_reimbursement.created',
  'procedure_reimbursement.updated',
  'procedure_reimbursement.deleted',
  'procedure_type.costs_updated',
  // Surgeon Variance
  'surgeon_cost_item.created',
  'surgeon_cost_item.updated',
  'surgeon_cost_item.deleted',
  // OR Rate
  'facility.or_rate_updated',
]

// Human-readable labels for audit actions
const AUDIT_ACTION_LABELS: Record<string, string> = {
  'cost_category.created': 'created a cost category',
  'cost_category.updated': 'updated a cost category',
  'cost_category.deleted': 'deleted a cost category',
  'cost_category.restored': 'restored a cost category',
  'cost_category.activated': 'activated a cost category',
  'cost_category.deactivated': 'deactivated a cost category',
  'payer.created': 'created a payer',
  'payer.updated': 'updated a payer',
  'payer.deleted': 'deleted a payer',
  'payer.restored': 'restored a payer',
  'procedure_cost_item.created': 'added cost to procedure',
  'procedure_cost_item.updated': 'updated procedure cost',
  'procedure_cost_item.deleted': 'removed procedure cost',
  'procedure_reimbursement.created': 'created reimbursement rate',
  'procedure_reimbursement.updated': 'updated reimbursement rate',
  'procedure_reimbursement.deleted': 'deleted reimbursement rate',
  'procedure_type.costs_updated': 'updated procedure costs',
  'surgeon_cost_item.created': 'created surgeon variance',
  'surgeon_cost_item.updated': 'updated surgeon variance',
  'surgeon_cost_item.deleted': 'deleted surgeon variance',
  'facility.or_rate_updated': 'updated OR hourly rate',
}

interface Stats {
  costCategories: { total: number; debits: number; credits: number }
  payers: number
  procedurePricing: { configured: number; total: number }
  surgeonVariances: number
  orHourlyRate: number | null
}

interface AuditEntry {
  id: string
  action: string
  target_label: string | null
  user_email: string
  user_name: string | null
  created_at: string
}

export default function FinancialsOverviewPage() {
  const supabase = createClient()
  const { effectiveFacilityId, loading: userLoading } = useUser()
  const { showToast } = useToast() 

  // Fetch all financial stats + recent activity
  const { data: pageData, loading, error, refetch } = useSupabaseQuery<{
    stats: Stats
    recentActivity: AuditEntry[]
  }>(
    async (sb) => {
      const [
        costCategoriesRes, payersRes, proceduresRes,
        procedureCostsRes, surgeonVariancesRes, facilityRes, activityRes,
      ] = await Promise.all([
        sb.from('facility_cost_categories').select('id, type').eq('facility_id', effectiveFacilityId!).eq('is_active', true),
        sb.from('payers').select('id').eq('facility_id', effectiveFacilityId!).is('deleted_at', null),
        sb.from('procedure_types').select('id').eq('facility_id', effectiveFacilityId!).is('deleted_at', null),
        sb.from('procedure_cost_items').select('procedure_type_id').eq('facility_id', effectiveFacilityId!).is('effective_to', null),
        sb.from('surgeon_cost_items').select('surgeon_id, procedure_type_id').eq('facility_id', effectiveFacilityId!).is('effective_to', null),
        sb.from('facilities').select('or_hourly_rate').eq('id', effectiveFacilityId!).single(),
        sb.from('audit_log_with_users').select('id, action, target_label, user_email, user_name, created_at')
          .eq('facility_id', effectiveFacilityId!).in('action', FINANCIAL_AUDIT_ACTIONS)
          .order('created_at', { ascending: false }).limit(10),
      ])

      const costCategories = costCategoriesRes.data || []
      const debits = costCategories.filter(c => c.type === 'debit').length
      const credits = costCategories.filter(c => c.type === 'credit').length
      const procedureCosts = procedureCostsRes.data || []
      const uniqueProceduresWithCosts = new Set(procedureCosts.map(p => p.procedure_type_id)).size
      const surgeonVariances = surgeonVariancesRes.data || []
      const uniqueVariances = new Set(surgeonVariances.map(v => `${v.surgeon_id}-${v.procedure_type_id}`)).size

      return {
        stats: {
          costCategories: { total: costCategories.length, debits, credits },
          payers: payersRes.data?.length || 0,
          procedurePricing: { configured: uniqueProceduresWithCosts, total: proceduresRes.data?.length || 0 },
          surgeonVariances: uniqueVariances,
          orHourlyRate: facilityRes.data?.or_hourly_rate || null,
        },
        recentActivity: activityRes.data || [],
      }
    },
    { deps: [effectiveFacilityId], enabled: !userLoading && !!effectiveFacilityId }
  )

  const stats = pageData?.stats || {
    costCategories: { total: 0, debits: 0, credits: 0 },
    payers: 0, procedurePricing: { configured: 0, total: 0 },
    surgeonVariances: 0, orHourlyRate: null,
  }
  const recentActivity = pageData?.recentActivity || []

  // OR Rate editing
  const [editingRate, setEditingRate] = useState(false)
  const [rateInput, setRateInput] = useState('')
  const [savingRate, setSavingRate] = useState(false)

  // Sync rate input from query data
  useEffect(() => {
    if (pageData?.stats.orHourlyRate != null) {
      setRateInput(pageData.stats.orHourlyRate.toString())
    }
  }, [pageData])

  const handleSaveRate = async () => {
    if (!effectiveFacilityId) return

    const newRate = parseFloat(rateInput)
if (isNaN(newRate) || newRate < 0) {
  showToast({
    type: 'error',
    title: 'Validation Error',
    message: 'Please enter a valid rate'
  })
  return
}

    setSavingRate(true)
    try {
      const { error } = await supabase
        .from('facilities')
        .update({ or_hourly_rate: newRate })
        .eq('id', effectiveFacilityId)

      if (error) throw error

      // Audit log
      await genericAuditLog(supabase, 'facility.or_rate_updated', {
        targetType: 'facility',
        targetId: effectiveFacilityId,
        targetLabel: 'OR Hourly Rate',
        oldValues: { or_hourly_rate: stats.orHourlyRate },
        newValues: { or_hourly_rate: newRate },
        facilityId: effectiveFacilityId,
      })

setRateInput(newRate.toString())
setEditingRate(false)
showToast({
  type: 'success',
  title: 'Rate Updated',
  message: 'OR hourly rate has been updated successfully'
})

      // Refresh activity
      refetch()
} catch (error) {
  showToast({
    type: 'error',
    title: 'Error Updating Rate',
    message: error instanceof Error ? error.message : 'Failed to update OR hourly rate'
  })


    } finally {
      setSavingRate(false)
    }
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  // Setup checklist items
  const setupSteps = [
    {
      label: 'Cost Categories',
      description: 'Define your cost line items',
      href: '/settings/financials/cost-categories',
      complete: stats.costCategories.total > 0,
      count: stats.costCategories.total,
    },
    {
      label: 'Payers',
      description: 'Add insurance companies',
      href: '/settings/financials/payers',
      complete: stats.payers > 0,
      count: stats.payers,
    },
    {
      label: 'Procedure Pricing',
      description: 'Set default costs per procedure',
      href: '/settings/financials/procedure-pricing',
      complete: stats.procedurePricing.configured > 0,
      count: stats.procedurePricing.configured,
      total: stats.procedurePricing.total,
    },
    {
      label: 'Surgeon Variance',
      description: 'Optional surgeon-specific overrides',
      href: '/settings/financials/surgeon-variance',
      complete: true, // Always "complete" since it's optional
      optional: true,
      count: stats.surgeonVariances,
    },
  ]

  if (userLoading) {
    return (
      <DashboardLayout>
        <Container>
          <ErrorBanner message={error} />
          <SettingsLayout title="Financials" description="Configure financial tracking and cost analysis">
            <PageLoader message="Loading financials..." />
          </SettingsLayout>
        </Container>
      </DashboardLayout>
    )
  }

  if (!effectiveFacilityId) {
    return (
      <DashboardLayout>
        <Container>
          <SettingsLayout title="Financials" description="Configure financial tracking and cost analysis">
            <div className="text-center py-12">
              <p className="text-slate-500">No facility selected</p>
            </div>
          </SettingsLayout>
        </Container>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <Container>
        <SettingsLayout title="Financials" description="Configure financial tracking and cost analysis">
          {loading ? (
            <PageLoader message="Loading financial data..." />
          ) : (
            <div className="space-y-8">
              {/* OR Hourly Rate + Quick Actions */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* OR Hourly Rate Card */}
                <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-6 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-100 text-sm font-medium mb-1">OR Hourly Rate</p>
                      {editingRate ? (
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl">$</span>
                            <input
                              type="number"
                              value={rateInput}
                              onChange={(e) => setRateInput(e.target.value)}
                              className="w-32 pl-8 pr-3 py-2 text-xl font-bold text-slate-900 rounded-lg focus:ring-2 focus:ring-blue-300"
                              placeholder="0.00"
                              step="0.01"
                              min="0"
                              autoFocus
                            />
                          </div>
                          <span className="text-blue-100">/hr</span>
                        </div>
                      ) : (
                        <p className="text-4xl font-bold">
                          {stats.orHourlyRate !== null ? `$${stats.orHourlyRate.toFixed(2)}` : 'Not set'}
                          <span className="text-xl text-blue-200 font-normal">/hr</span>
                        </p>
                      )}
                      <p className="text-blue-200 text-sm mt-2">Used to calculate time-based OR costs</p>
                    </div>
                    <div>
                      {editingRate ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditingRate(false)
                              setRateInput(stats.orHourlyRate?.toString() || '')
                            }}
                            className="px-4 py-2 text-sm font-medium text-blue-100 hover:text-white transition-colors"
                            disabled={savingRate}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleSaveRate}
                            disabled={savingRate}
                            className="px-4 py-2 bg-white text-blue-600 rounded-lg text-sm font-semibold hover:bg-blue-50 transition-colors disabled:opacity-50"
                          >
                            {savingRate ? 'Saving...' : 'Save'}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setEditingRate(true)}
                          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                          title="Edit rate"
                        >
                          <PenLine className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-slate-900">Quick Actions</h3>
                    <span className="text-xs text-slate-400 uppercase tracking-wide">Jump to</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Link
                      href="/settings/financials/cost-categories"
                      className="group relative flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-purple-200 hover:shadow-lg hover:shadow-purple-500/5 transition-all"
                    >
                      <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center group-hover:bg-purple-500 group-hover:scale-110 transition-all">
                        <Plus className="w-5 h-5 text-purple-600 group-hover:text-white transition-colors" />
                      </div>
                      <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900 text-center">Cost Category</span>
                    </Link>
                    <Link
                      href="/settings/financials/payers"
                      className="group relative flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-green-200 hover:shadow-lg hover:shadow-green-500/5 transition-all"
                    >
                      <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-500 group-hover:scale-110 transition-all">
                        <Plus className="w-5 h-5 text-green-600 group-hover:text-white transition-colors" />
                      </div>
                      <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900 text-center">Payer</span>
                    </Link>
                    <Link
                      href="/settings/financials/procedure-pricing"
                      className="group relative flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-blue-200 hover:shadow-lg hover:shadow-blue-500/5 transition-all"
                    >
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-500 group-hover:scale-110 transition-all">
                        <Plus className="w-5 h-5 text-blue-600 group-hover:text-white transition-colors" />
                      </div>
                      <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900 text-center">Procedure</span>
                    </Link>
                    <Link
                      href="/settings/financials/surgeon-variance"
                      className="group relative flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-orange-200 hover:shadow-lg hover:shadow-orange-500/5 transition-all"
                    >
                      <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center group-hover:bg-orange-500 group-hover:scale-110 transition-all">
                        <Plus className="w-5 h-5 text-orange-600 group-hover:text-white transition-colors" />
                      </div>
                      <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900 text-center">Surgeon Override</span>
                    </Link>
                  </div>
                </div>
              </div>

              {/* Stats Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Cost Categories */}
                <Link
                  href="/settings/financials/cost-categories"
                  className="bg-white border border-slate-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-md transition-all group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Tag className="w-5 h-5 text-purple-600" />
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 transition-colors" />
                  </div>
                  <h3 className="font-semibold text-slate-900 mb-1">Cost Categories</h3>
                  <p className="text-2xl font-bold text-slate-900">{stats.costCategories.total}</p>
                  <p className="text-sm text-slate-500">
                    {stats.costCategories.debits} debits, {stats.costCategories.credits} credits
                  </p>
                </Link>

                {/* Payers */}
                <Link
                  href="/settings/financials/payers"
                  className="bg-white border border-slate-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-md transition-all group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-green-600" />
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 transition-colors" />
                  </div>
                  <h3 className="font-semibold text-slate-900 mb-1">Payers</h3>
                  <p className="text-2xl font-bold text-slate-900">{stats.payers}</p>
                  <p className="text-sm text-slate-500">Insurance companies</p>
                </Link>

                {/* Procedure Pricing */}
                <Link
                  href="/settings/financials/procedure-pricing"
                  className="bg-white border border-slate-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-md transition-all group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Calculator className="w-5 h-5 text-blue-600" />
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 transition-colors" />
                  </div>
                  <h3 className="font-semibold text-slate-900 mb-1">Procedure Pricing</h3>
                  <p className="text-2xl font-bold text-slate-900">
                    {stats.procedurePricing.configured}
                    <span className="text-lg text-slate-400 font-normal">/{stats.procedurePricing.total}</span>
                  </p>
                  <p className="text-sm text-slate-500">Procedures configured</p>
                </Link>

                {/* Surgeon Variance */}
                <Link
                  href="/settings/financials/surgeon-variance"
                  className="bg-white border border-slate-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-md transition-all group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                      <User className="w-5 h-5 text-orange-600" />
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 transition-colors" />
                  </div>
                  <h3 className="font-semibold text-slate-900 mb-1">Surgeon Variance</h3>
                  <p className="text-2xl font-bold text-slate-900">{stats.surgeonVariances}</p>
                  <p className="text-sm text-slate-500">Surgeon overrides</p>
                </Link>
              </div>

              {/* Two Column Layout: Setup Checklist + Recent Activity */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Setup Checklist */}
                <div className="bg-white border border-slate-200 rounded-xl p-6">
                  <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <ClipboardCheck className="w-5 h-5 text-slate-400" />
                    Setup Checklist
                  </h3>
                  <div className="space-y-3">
                    {setupSteps.map((step, index) => (
                      <Link
                        key={step.href}
                        href={step.href}
                        className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors group"
                      >
                        <div className={`
                          w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5
                          ${step.complete && !step.optional
                            ? 'bg-green-100 text-green-600'
                            : step.optional
                              ? 'bg-slate-100 text-slate-400'
                              : 'bg-amber-100 text-amber-700'
                          }
                        `}>
                          {step.complete && !step.optional ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <span className="text-xs font-semibold">{index + 1}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-slate-900 group-hover:text-blue-600 transition-colors">
                              {step.label}
                            </p>
                            {step.optional && (
                              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                                Optional
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-500">{step.description}</p>
                          {step.total !== undefined ? (
                            <p className="text-xs text-slate-400 mt-1">
                              {step.count} of {step.total} configured
                              {step.count < step.total && (
                                <span className="text-amber-700 ml-1">
                                  • {step.total - step.count} remaining
                                </span>
                              )}
                            </p>
                          ) : step.count > 0 ? (
                            <p className="text-xs text-slate-400 mt-1">{step.count} defined</p>
                          ) : null}
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 transition-colors flex-shrink-0" />
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-white border border-slate-200 rounded-xl p-6">
                  <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-slate-400" />
                    Recent Activity
                  </h3>
                  {recentActivity.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Clock className="w-6 h-6 text-slate-400" />
                      </div>
                      <p className="text-slate-500 text-sm">No recent activity</p>
                      <p className="text-slate-400 text-xs mt-1">Changes to financial settings will appear here</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {recentActivity.map((entry) => {
  // Build display name: prefer full name, fallback to email
  const displayName = entry.user_name || entry.user_email?.split('@')[0] || 'Someone'
  
  // Get initials for avatar
  const nameParts = entry.user_name?.split(' ') || []
  const initials = nameParts.length >= 2
    ? `${nameParts[0].charAt(0)}${nameParts[1].charAt(0)}`
    : entry.user_name?.charAt(0) || entry.user_email?.charAt(0).toUpperCase() || '?'
                        return (
                          <div key={entry.id} className="flex items-start gap-3 py-2">
                            <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-medium text-slate-600">
                                {initials}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-slate-700">
                                <span className="font-medium">{displayName}</span>
                                {' '}
                                {AUDIT_ACTION_LABELS[entry.action] || entry.action}
                                {entry.target_label && (
                                  <span className="text-slate-500"> • {entry.target_label}</span>
                                )}
                              </p>
                              <p className="text-xs text-slate-400 mt-0.5">
                                {formatTimeAgo(entry.created_at)}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}
        </SettingsLayout>
      </Container>
    </DashboardLayout>
  )
}