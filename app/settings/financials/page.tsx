// app/settings/financials/page.tsx
// Financials Overview - Hub for all financial settings

'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../../lib/supabase'
import { useUser } from '../../../lib/UserContext'
import DashboardLayout from '../../../components/layouts/DashboardLayout'
import Container from '../../../components/ui/Container'
import SettingsLayout from '../../../components/settings/SettingsLayout'
import { genericAuditLog } from '../../../lib/audit-logger'
import Link from 'next/link'

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

  const [stats, setStats] = useState<Stats>({
    costCategories: { total: 0, debits: 0, credits: 0 },
    payers: 0,
    procedurePricing: { configured: 0, total: 0 },
    surgeonVariances: 0,
    orHourlyRate: null,
  })
  const [recentActivity, setRecentActivity] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)

  // OR Rate editing
  const [editingRate, setEditingRate] = useState(false)
  const [rateInput, setRateInput] = useState('')
  const [savingRate, setSavingRate] = useState(false)

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    if (!userLoading && effectiveFacilityId) {
      fetchData()
    } else if (!userLoading && !effectiveFacilityId) {
      setLoading(false)
    }
  }, [userLoading, effectiveFacilityId])

  const fetchData = async () => {
    if (!effectiveFacilityId) return
    setLoading(true)

    try {
      // Fetch all stats in parallel
      const [
        costCategoriesRes,
        payersRes,
        proceduresRes,
        procedureCostsRes,
        surgeonVariancesRes,
        facilityRes,
        activityRes,
      ] = await Promise.all([
        // Cost categories (active only)
        supabase
          .from('facility_cost_categories')
          .select('id, type')
          .eq('facility_id', effectiveFacilityId)
          .eq('is_active', true),
        
        // Payers (active only)
        supabase
          .from('payers')
          .select('id')
          .eq('facility_id', effectiveFacilityId)
          .is('deleted_at', null),
        
        // Total procedures
        supabase
          .from('procedure_types')
          .select('id')
          .eq('facility_id', effectiveFacilityId)
          .is('deleted_at', null),
        
        // Procedures with costs configured (distinct procedure_type_ids)
        supabase
          .from('procedure_cost_items')
          .select('procedure_type_id')
          .eq('facility_id', effectiveFacilityId)
          .is('effective_to', null),
        
        // Surgeon variances (distinct surgeon/procedure combos)
        supabase
          .from('surgeon_cost_items')
          .select('surgeon_id, procedure_type_id')
          .eq('facility_id', effectiveFacilityId)
          .is('effective_to', null),
        
        // Facility for OR rate
        supabase
          .from('facilities')
          .select('or_hourly_rate')
          .eq('id', effectiveFacilityId)
          .single(),
        
        // Recent financial activity
        supabase
          .from('audit_log_with_users')
          .select('id, action, target_label, user_email, user_name, created_at')
          .eq('facility_id', effectiveFacilityId)
          .in('action', FINANCIAL_AUDIT_ACTIONS)
          .order('created_at', { ascending: false })
          .limit(10),
      ])

      // Process cost categories
      const costCategories = costCategoriesRes.data || []
      const debits = costCategories.filter(c => c.type === 'debit').length
      const credits = costCategories.filter(c => c.type === 'credit').length

      // Process procedures with costs (get unique procedure IDs)
      const procedureCosts = procedureCostsRes.data || []
      const uniqueProceduresWithCosts = new Set(procedureCosts.map(p => p.procedure_type_id)).size

      // Process surgeon variances (get unique combos)
      const surgeonVariances = surgeonVariancesRes.data || []
      const uniqueVariances = new Set(
        surgeonVariances.map(v => `${v.surgeon_id}-${v.procedure_type_id}`)
      ).size

      setStats({
        costCategories: { total: costCategories.length, debits, credits },
        payers: payersRes.data?.length || 0,
        procedurePricing: {
          configured: uniqueProceduresWithCosts,
          total: proceduresRes.data?.length || 0,
        },
        surgeonVariances: uniqueVariances,
        orHourlyRate: facilityRes.data?.or_hourly_rate || null,
      })

      setRecentActivity(activityRes.data || [])
      setRateInput(facilityRes.data?.or_hourly_rate?.toString() || '')
    } catch (error) {
      console.error('Error fetching financials data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveRate = async () => {
    if (!effectiveFacilityId) return

    const newRate = parseFloat(rateInput)
    if (isNaN(newRate) || newRate < 0) {
      showToast('Please enter a valid rate', 'error')
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

      setStats(prev => ({ ...prev, orHourlyRate: newRate }))
      setEditingRate(false)
      showToast('OR hourly rate updated', 'success')

      // Refresh activity
      fetchData()
    } catch (error) {
      console.error('Error updating OR rate:', error)
      showToast('Failed to update rate', 'error')
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
          <SettingsLayout title="Financials" description="Configure financial tracking and cost analysis">
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
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
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : (
            <div className="space-y-8">
              {/* OR Hourly Rate + Quick Actions */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* OR Hourly Rate Card */}
                <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-6 text-white">
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
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6">
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
                        <svg className="w-5 h-5 text-purple-600 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </div>
                      <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900 text-center">Cost Category</span>
                    </Link>
                    <Link
                      href="/settings/financials/payers"
                      className="group relative flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-green-200 hover:shadow-lg hover:shadow-green-500/5 transition-all"
                    >
                      <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-500 group-hover:scale-110 transition-all">
                        <svg className="w-5 h-5 text-green-600 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </div>
                      <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900 text-center">Payer</span>
                    </Link>
                    <Link
                      href="/settings/financials/procedure-pricing"
                      className="group relative flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-blue-200 hover:shadow-lg hover:shadow-blue-500/5 transition-all"
                    >
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-500 group-hover:scale-110 transition-all">
                        <svg className="w-5 h-5 text-blue-600 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </div>
                      <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900 text-center">Procedure</span>
                    </Link>
                    <Link
                      href="/settings/financials/surgeon-variance"
                      className="group relative flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-orange-200 hover:shadow-lg hover:shadow-orange-500/5 transition-all"
                    >
                      <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center group-hover:bg-orange-500 group-hover:scale-110 transition-all">
                        <svg className="w-5 h-5 text-orange-600 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
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
                  className="bg-white border border-slate-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-md transition-all group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                    </div>
                    <svg className="w-5 h-5 text-slate-300 group-hover:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
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
                  className="bg-white border border-slate-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-md transition-all group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <svg className="w-5 h-5 text-slate-300 group-hover:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-slate-900 mb-1">Payers</h3>
                  <p className="text-2xl font-bold text-slate-900">{stats.payers}</p>
                  <p className="text-sm text-slate-500">Insurance companies</p>
                </Link>

                {/* Procedure Pricing */}
                <Link
                  href="/settings/financials/procedure-pricing"
                  className="bg-white border border-slate-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-md transition-all group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <svg className="w-5 h-5 text-slate-300 group-hover:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
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
                  className="bg-white border border-slate-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-md transition-all group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <svg className="w-5 h-5 text-slate-300 group-hover:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
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
                    <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
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
                              : 'bg-amber-100 text-amber-600'
                          }
                        `}>
                          {step.complete && !step.optional ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
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
                                <span className="text-amber-600 ml-1">
                                  • {step.total - step.count} remaining
                                </span>
                              )}
                            </p>
                          ) : step.count > 0 ? (
                            <p className="text-xs text-slate-400 mt-1">{step.count} defined</p>
                          ) : null}
                        </div>
                        <svg className="w-5 h-5 text-slate-300 group-hover:text-blue-500 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-white border border-slate-200 rounded-xl p-6">
                  <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Recent Activity
                  </h3>
                  {recentActivity.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
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

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-2">
          <div className={`
            px-4 py-3 rounded-lg shadow-lg flex items-center gap-2
            ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}
          `}>
            {toast.type === 'success' ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            {toast.message}
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}