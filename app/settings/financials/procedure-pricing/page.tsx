// app/settings/financials/procedure-pricing/page.tsx
// Configure costs and reimbursements for each procedure type

'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../../../lib/supabase'
import { useUser } from '../../../../lib/UserContext'
import DashboardLayout from '../../../../components/layouts/DashboardLayout'
import Container from '../../../../components/ui/Container'
import SettingsLayout from '../../../../components/settings/SettingsLayout'
import { genericAuditLog } from '../../../../lib/audit-logger'

// Types
interface CostCategory {
  id: string
  name: string
  type: 'debit' | 'credit'
  description?: string
}

interface ProcedureCostItem {
  id: string
  procedure_type_id: string
  cost_category_id: string
  amount: number
  cost_category?: CostCategory
}

interface ProcedureReimbursement {
  id: string
  procedure_type_id: string
  payer_id: string | null
  reimbursement: number
  effective_date: string
  payer?: { id: string; name: string }
}

interface ProcedureType {
  id: string
  name: string
  facility_id: string
}

interface Payer {
  id: string
  name: string
}

interface FacilitySettings {
  or_hourly_rate: number | null
}

export default function ProcedurePricingPage() {
  const supabase = createClient()
  const { effectiveFacilityId, loading: userLoading } = useUser()

  // Data state
  const [procedures, setProcedures] = useState<ProcedureType[]>([])
  const [costCategories, setCostCategories] = useState<CostCategory[]>([])
  const [procedureCostItems, setProcedureCostItems] = useState<ProcedureCostItem[]>([])
  const [procedureReimbursements, setProcedureReimbursements] = useState<ProcedureReimbursement[]>([])
  const [payers, setPayers] = useState<Payer[]>([])
  const [facilitySettings, setFacilitySettings] = useState<FacilitySettings | null>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Panel state
  const [selectedProcedure, setSelectedProcedure] = useState<ProcedureType | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)

  // Panel editing state
  const [editingCostItems, setEditingCostItems] = useState<Map<string, number>>(new Map())
  const [defaultReimbursement, setDefaultReimbursement] = useState<number>(0)
  const [payerReimbursements, setPayerReimbursements] = useState<Map<string, number>>(new Map())

  // OR Rate editing
  const [editingOrRate, setEditingOrRate] = useState(false)
  const [orRateValue, setOrRateValue] = useState('')

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

    const [proceduresRes, categoriesRes, costItemsRes, reimbursementsRes, payersRes, facilityRes] = await Promise.all([
      supabase
        .from('procedure_types')
        .select('id, name, facility_id')
        .eq('facility_id', effectiveFacilityId)
        .order('name'),
      supabase
        .from('cost_categories')
        .select('id, name, type, description')
        .eq('facility_id', effectiveFacilityId)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('type')
        .order('display_order'),
      supabase
        .from('procedure_cost_items')
        .select('*, cost_category:cost_categories(id, name, type)')
        .eq('facility_id', effectiveFacilityId),
      supabase
        .from('procedure_reimbursements')
        .select('*, payer:payers(id, name)')
        .eq('facility_id', effectiveFacilityId),
      supabase
        .from('payers')
        .select('id, name')
        .eq('facility_id', effectiveFacilityId)
        .order('name'),
      supabase
        .from('facilities')
        .select('or_hourly_rate')
        .eq('id', effectiveFacilityId)
        .single(),
    ])

    if (proceduresRes.data) setProcedures(proceduresRes.data)
    if (categoriesRes.data) setCostCategories(categoriesRes.data)
    if (costItemsRes.data) setProcedureCostItems(costItemsRes.data)
    if (reimbursementsRes.data) setProcedureReimbursements(reimbursementsRes.data)
    if (payersRes.data) setPayers(payersRes.data)
    if (facilityRes.data) {
      setFacilitySettings(facilityRes.data)
      setOrRateValue(facilityRes.data.or_hourly_rate?.toString() || '')
    }

    setLoading(false)
  }

  const openProcedurePanel = (procedure: ProcedureType) => {
    setSelectedProcedure(procedure)

    // Load existing cost items
    const existingCostItems = procedureCostItems.filter(i => i.procedure_type_id === procedure.id)
    const costMap = new Map<string, number>()
    existingCostItems.forEach(item => {
      costMap.set(item.cost_category_id, item.amount)
    })
    setEditingCostItems(costMap)

    // Load existing reimbursements
    const existingReimbursements = procedureReimbursements.filter(r => r.procedure_type_id === procedure.id)
    const defaultReimb = existingReimbursements.find(r => r.payer_id === null)
    setDefaultReimbursement(defaultReimb?.reimbursement || 0)

    const payerMap = new Map<string, number>()
    existingReimbursements.filter(r => r.payer_id !== null).forEach(r => {
      payerMap.set(r.payer_id!, r.reimbursement)
    })
    setPayerReimbursements(payerMap)

    setPanelOpen(true)
  }

  const closePanel = () => {
    setPanelOpen(false)
    setSelectedProcedure(null)
    setEditingCostItems(new Map())
    setDefaultReimbursement(0)
    setPayerReimbursements(new Map())
  }

  const handleCostItemChange = (categoryId: string, value: string) => {
    const newMap = new Map(editingCostItems)
    if (value === '' || parseFloat(value) === 0) {
      newMap.delete(categoryId)
    } else {
      newMap.set(categoryId, parseFloat(value) || 0)
    }
    setEditingCostItems(newMap)
  }

  const handlePayerReimbursementChange = (payerId: string, value: string) => {
    const newMap = new Map(payerReimbursements)
    if (value === '' || parseFloat(value) === 0) {
      newMap.delete(payerId)
    } else {
      newMap.set(payerId, parseFloat(value) || 0)
    }
    setPayerReimbursements(newMap)
  }

  const handleSaveProcedure = async () => {
    if (!selectedProcedure || !effectiveFacilityId) return
    setSaving(true)

    try {
      // Delete existing cost items
      await supabase
        .from('procedure_cost_items')
        .delete()
        .eq('procedure_type_id', selectedProcedure.id)

      // Insert new cost items
      const costItemsToInsert = Array.from(editingCostItems.entries())
        .filter(([_, amount]) => amount > 0)
        .map(([categoryId, amount]) => ({
          facility_id: effectiveFacilityId,
          procedure_type_id: selectedProcedure.id,
          cost_category_id: categoryId,
          amount,
        }))

      if (costItemsToInsert.length > 0) {
        await supabase.from('procedure_cost_items').insert(costItemsToInsert)
      }

      // Delete existing reimbursements
      await supabase
        .from('procedure_reimbursements')
        .delete()
        .eq('procedure_type_id', selectedProcedure.id)

      // Insert default reimbursement
      const reimbursementsToInsert: any[] = []
      if (defaultReimbursement > 0) {
        reimbursementsToInsert.push({
          facility_id: effectiveFacilityId,
          procedure_type_id: selectedProcedure.id,
          payer_id: null,
          reimbursement: defaultReimbursement,
          effective_date: new Date().toISOString().split('T')[0],
        })
      }

      // Insert payer-specific reimbursements
      payerReimbursements.forEach((amount, payerId) => {
        if (amount > 0) {
          reimbursementsToInsert.push({
            facility_id: effectiveFacilityId,
            procedure_type_id: selectedProcedure.id,
            payer_id: payerId,
            reimbursement: amount,
            effective_date: new Date().toISOString().split('T')[0],
          })
        }
      })

      if (reimbursementsToInsert.length > 0) {
        await supabase.from('procedure_reimbursements').insert(reimbursementsToInsert)
      }

      await genericAuditLog(supabase, 'procedure_pricing.updated', {
        targetType: 'procedure_type',
        targetId: selectedProcedure.id,
        targetLabel: selectedProcedure.name,
        newValues: {
          costItems: Object.fromEntries(editingCostItems),
          defaultReimbursement,
          payerReimbursements: Object.fromEntries(payerReimbursements),
        },
        facilityId: effectiveFacilityId,
      })

      await fetchData()
      closePanel()
    } catch (error) {
      console.error('Error saving procedure pricing:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleSaveOrRate = async () => {
    if (!effectiveFacilityId) return
    setSaving(true)

    try {
      const { error } = await supabase
        .from('facilities')
        .update({ or_hourly_rate: parseFloat(orRateValue) || null })
        .eq('id', effectiveFacilityId)

      if (error) throw error

      setFacilitySettings({ or_hourly_rate: parseFloat(orRateValue) || null })
      setEditingOrRate(false)

      await genericAuditLog(supabase, 'facility.or_rate_updated', {
        targetType: 'facility',
        targetId: effectiveFacilityId,
        targetLabel: 'OR Hourly Rate',
        newValues: { or_hourly_rate: parseFloat(orRateValue) || null },
        facilityId: effectiveFacilityId,
      })
    } catch (error) {
      console.error('Error saving OR rate:', error)
    } finally {
      setSaving(false)
    }
  }

  // Calculate totals for panel
  const calculateTotals = () => {
    let totalDebits = 0
    let totalCredits = 0

    editingCostItems.forEach((amount, categoryId) => {
      const category = costCategories.find(c => c.id === categoryId)
      if (category?.type === 'debit') {
        totalDebits += amount
      } else {
        totalCredits += amount
      }
    })

    const margin = defaultReimbursement - totalDebits + totalCredits
    return { totalDebits, totalCredits, margin }
  }

  // Get procedure summary for list
  const getProcedureSummary = (procedureId: string) => {
    const costItems = procedureCostItems.filter(i => i.procedure_type_id === procedureId)
    const reimbursements = procedureReimbursements.filter(r => r.procedure_type_id === procedureId)
    const defaultReimb = reimbursements.find(r => r.payer_id === null)?.reimbursement || 0

    let totalDebits = 0
    let totalCredits = 0
    costItems.forEach(item => {
      const cat = item.cost_category
      if (cat?.type === 'debit') totalDebits += item.amount
      else totalCredits += item.amount
    })

    return {
      costItemCount: costItems.length,
      reimbursement: defaultReimb,
      totalDebits,
      totalCredits,
      margin: defaultReimb - totalDebits + totalCredits,
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const totals = calculateTotals()

  if (userLoading) {
    return (
      <DashboardLayout>
        <Container>
          <SettingsLayout title="Procedure Pricing" description="Configure costs and reimbursements for each procedure type">
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
          <SettingsLayout title="Procedure Pricing" description="Configure costs and reimbursements for each procedure type">
            <div className="text-center py-12 text-slate-500">
              No facility selected
            </div>
          </SettingsLayout>
        </Container>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <Container>
        <SettingsLayout title="Procedure Pricing" description="Configure costs and reimbursements for each procedure type">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* OR Hourly Rate Card */}
              <div className="bg-white border border-slate-200 rounded-xl p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900">OR Hourly Rate</h3>
                    <p className="text-sm text-slate-500 mt-0.5">Used to calculate OR time costs in profit analysis</p>
                  </div>
                  {editingOrRate ? (
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                        <input
                          type="number"
                          value={orRateValue}
                          onChange={(e) => setOrRateValue(e.target.value)}
                          className="w-32 pl-7 pr-3 py-2 border border-slate-200 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          placeholder="0.00"
                          step="0.01"
                        />
                      </div>
                      <span className="text-slate-500">/hr</span>
                      <button
                        onClick={handleSaveOrRate}
                        disabled={saving}
                        className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setEditingOrRate(false)
                          setOrRateValue(facilitySettings?.or_hourly_rate?.toString() || '')
                        }}
                        className="px-3 py-2 text-slate-600 hover:bg-slate-100 text-sm rounded-lg"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-semibold text-slate-900">
                        {facilitySettings?.or_hourly_rate
                          ? `$${facilitySettings.or_hourly_rate.toLocaleString()}/hr`
                          : 'Not set'}
                      </span>
                      <button
                        onClick={() => setEditingOrRate(true)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Cost Categories Warning */}
              {costCategories.length === 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <div className="flex gap-3">
                    <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                      <p className="text-sm text-amber-800 font-medium">No cost categories defined</p>
                      <p className="text-sm text-amber-700 mt-0.5">
                        Set up cost categories first to assign costs to procedures.{' '}
                        <a href="/settings/financials/cost-categories" className="underline hover:no-underline">
                          Go to Cost Categories →
                        </a>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Procedures Table */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900">Procedures</h3>
                    <p className="text-sm text-slate-500">{procedures.length} procedure types</p>
                  </div>
                </div>

                {procedures.length === 0 ? (
                  <div className="px-6 py-12 text-center">
                    <svg className="w-12 h-12 text-slate-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <p className="text-slate-500 mb-4">No procedures configured</p>
                    <a
                      href="/settings/procedures"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                    >
                      Go to Procedure Types
                    </a>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="px-6 py-3 text-left text-xs font-semibold text-blue-600 uppercase tracking-wider">
                            Procedure Name
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-semibold text-blue-600 uppercase tracking-wider">
                            Reimbursement
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-semibold text-blue-600 uppercase tracking-wider">
                            Debits
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-semibold text-blue-600 uppercase tracking-wider">
                            Credits
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-semibold text-blue-600 uppercase tracking-wider">
                            Margin
                          </th>
                          <th className="px-6 py-3 text-center text-xs font-semibold text-blue-600 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {procedures.map((proc) => {
                          const summary = getProcedureSummary(proc.id)
                          const hasData = summary.reimbursement > 0 || summary.totalDebits > 0 || summary.totalCredits > 0
                          
                          return (
                            <tr key={proc.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-6 py-4">
                                <span className="font-medium text-slate-900">{proc.name}</span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                {summary.reimbursement > 0 ? (
                                  <span className="text-slate-700">{formatCurrency(summary.reimbursement)}</span>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                              <td className="px-6 py-4 text-right">
                                {summary.totalDebits > 0 ? (
                                  <span className="text-red-600">{formatCurrency(summary.totalDebits)}</span>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                              <td className="px-6 py-4 text-right">
                                {summary.totalCredits > 0 ? (
                                  <span className="text-emerald-600">{formatCurrency(summary.totalCredits)}</span>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                              <td className="px-6 py-4 text-right">
                                {hasData ? (
                                  <span className={`font-semibold ${summary.margin >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {formatCurrency(summary.margin)}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => openProcedurePanel(proc)}
                                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="Edit pricing"
                                  >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

{/* Info Box with Cross-Links */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <div className="flex gap-3">
                  <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">How procedure pricing works</p>
                    <p className="mb-3">
                      Set default reimbursements and costs for each procedure. 
                      <strong> Debits</strong> (red) are costs that reduce margin. 
                      <strong> Credits</strong> (green) are offsets that increase margin.
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-blue-700">
                      <span className="font-medium text-blue-800">Related:</span>
                      <a href="/settings/financials/cost-categories" className="underline hover:no-underline inline-flex items-center gap-1">
                        Cost Categories
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                      <a href="/settings/financials/payers" className="underline hover:no-underline inline-flex items-center gap-1">
                        Payers
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                      <a href="/settings/financials/surgeon-variance" className="underline hover:no-underline inline-flex items-center gap-1">
                        Surgeon Variance
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </SettingsLayout>
      </Container>

      {/* Edit Panel (Slideout) */}
      {panelOpen && selectedProcedure && (
        <div className="fixed inset-0 bg-black/50 flex justify-end z-50">
          <div 
            className="absolute inset-0" 
            onClick={closePanel}
          />
          <div className="relative w-full max-w-xl bg-white shadow-xl flex flex-col animate-slide-in-right">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{selectedProcedure.name}</h3>
                <p className="text-sm text-slate-500 mt-0.5">Configure costs and reimbursements</p>
              </div>
              <button
                onClick={closePanel}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Margin Preview */}
              <div className={`p-4 rounded-xl ${totals.margin >= 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-700">Estimated Margin</span>
                  <span className={`text-2xl font-bold ${totals.margin >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {formatCurrency(totals.margin)}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-slate-500">Reimbursement</span>
                    <p className="font-medium text-slate-900">{formatCurrency(defaultReimbursement)}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Debits</span>
                    <p className="font-medium text-red-600">−{formatCurrency(totals.totalDebits)}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Credits</span>
                    <p className="font-medium text-emerald-600">+{formatCurrency(totals.totalCredits)}</p>
                  </div>
                </div>
              </div>

              {/* Default Reimbursement */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Default Reimbursement</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                  <input
                    type="number"
                    value={defaultReimbursement || ''}
                    onChange={(e) => setDefaultReimbursement(parseFloat(e.target.value) || 0)}
                    className="w-full pl-7 pr-3 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    placeholder="0.00"
                    step="0.01"
                  />
                </div>
              </div>

              {/* Cost Items */}
              {costCategories.length > 0 ? (
                <>
                  {/* Debits */}
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                      Debits (Costs)
                      <span className="text-xs font-normal text-slate-500">— reduce margin</span>
                    </h4>
                    <div className="space-y-3">
                      {costCategories.filter(c => c.type === 'debit').map((cat) => (
                        <div key={cat.id} className="flex items-center gap-4">
                          <label className="flex-1 text-sm text-slate-700">{cat.name}</label>
                          <div className="relative w-32">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                            <input
                              type="number"
                              value={editingCostItems.get(cat.id) ?? ''}
                              onChange={(e) => handleCostItemChange(cat.id, e.target.value)}
                              className="w-full pl-7 pr-3 py-2 border border-slate-200 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                              placeholder="0.00"
                              step="0.01"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Credits */}
                  {costCategories.filter(c => c.type === 'credit').length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                        Credits (Offsets)
                        <span className="text-xs font-normal text-slate-500">— increase margin</span>
                      </h4>
                      <div className="space-y-3">
                        {costCategories.filter(c => c.type === 'credit').map((cat) => (
                          <div key={cat.id} className="flex items-center gap-4">
                            <label className="flex-1 text-sm text-slate-700">{cat.name}</label>
                            <div className="relative w-32">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                              <input
                                type="number"
                                value={editingCostItems.get(cat.id) ?? ''}
                                onChange={(e) => handleCostItemChange(cat.id, e.target.value)}
                                className="w-full pl-7 pr-3 py-2 border border-slate-200 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                placeholder="0.00"
                                step="0.01"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-800">
                    No cost categories defined.{' '}
                    <a href="/settings/financials/cost-categories" className="underline hover:no-underline font-medium">
                      Add cost categories →
                    </a>
                  </p>
                </div>
              )}

              {/* Payer-Specific Reimbursements */}
              <div>
                <h4 className="text-sm font-semibold text-slate-900 mb-1">Payer-Specific Reimbursements</h4>
                <p className="text-xs text-slate-500 mb-3">Override the default reimbursement for specific payers</p>
                {payers.length > 0 ? (
                  <div className="space-y-3">
                    {payers.map((payer) => (
                      <div key={payer.id} className="flex items-center gap-4">
                        <label className="flex-1 text-sm text-slate-700">{payer.name}</label>
                        <div className="relative w-32">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                          <input
                            type="number"
                            value={payerReimbursements.get(payer.id) ?? ''}
                            onChange={(e) => handlePayerReimbursementChange(payer.id, e.target.value)}
                            className="w-full pl-7 pr-3 py-2 border border-slate-200 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            placeholder={defaultReimbursement > 0 ? defaultReimbursement.toFixed(2) : '0.00'}
                            step="0.01"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">
                    No payers defined.{' '}
                    <a href="/settings/financials/payers" className="text-blue-600 underline hover:no-underline">
                      Add payers →
                    </a>
                  </p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={closePanel}
                className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProcedure}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Animation styles */}
      <style jsx>{`
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.2s ease-out;
        }
      `}</style>
    </DashboardLayout>
  )
}