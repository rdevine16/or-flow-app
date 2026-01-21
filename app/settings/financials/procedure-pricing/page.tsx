// app/settings/financials/procedure-pricing/page.tsx
// Manage procedure costs, cost items, and reimbursement rates

'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '../../../../lib/supabase'
import { useUser } from '../../../../lib/UserContext'
import DashboardLayout from '../../../../components/layouts/DashboardLayout'
import Container from '../../../../components/ui/Container'
import FinancialsLayout from '../../../../components/settings/FinancialsLayout'
import { genericAuditLog, procedureCostItemAudit } from '../../../../lib/audit-logger'

// =====================================================
// TYPES
// =====================================================

interface Facility {
  id: string
  name: string
  or_hourly_rate: number | null
}

interface ProcedureType {
  id: string
  name: string
}

interface CostCategory {
  id: string
  name: string
  type: 'credit' | 'debit'
  description?: string | null
}

interface ProcedureCostItem {
  id: string
  procedure_type_id: string
  cost_category_id: string
  amount: number
  notes: string | null
  cost_category?: CostCategory
}

interface ProcedureReimbursement {
  id: string
  procedure_type_id: string
  payer_id: string | null
  reimbursement: number
  effective_date: string
}

interface Payer {
  id: string
  name: string
  deleted_at: string | null
}

// =====================================================
// COMPONENT
// =====================================================

export default function ProcedurePricingPage() {
  const supabase = createClient()
  const { effectiveFacilityId, loading: userLoading } = useUser()

  // Core state
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Facility state
  const [currentFacility, setCurrentFacility] = useState<Facility | null>(null)
  const [orHourlyRate, setOrHourlyRate] = useState<string>('')
  const [editingOrRate, setEditingOrRate] = useState(false)

  // Data state
  const [procedures, setProcedures] = useState<ProcedureType[]>([])
  const [costCategories, setCostCategories] = useState<CostCategory[]>([])
  const [procedureCostItems, setProcedureCostItems] = useState<ProcedureCostItem[]>([])
  const [reimbursements, setReimbursements] = useState<ProcedureReimbursement[]>([])
  const [payers, setPayers] = useState<Payer[]>([])

  // Slide-out state
  const [slideOutOpen, setSlideOutOpen] = useState(false)
  const [selectedProcedure, setSelectedProcedure] = useState<ProcedureType | null>(null)

  // Form state for slide-out
  const [formCostItems, setFormCostItems] = useState<{ category_id: string; amount: string; notes: string }[]>([])
  const [formDefaultReimbursement, setFormDefaultReimbursement] = useState('')
  const [formPayerReimbursements, setFormPayerReimbursements] = useState<{ payer_id: string; reimbursement: string }[]>([])

  // =====================================================
  // DATA FETCHING
  // =====================================================

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
      const [
        facilityResult,
        proceduresResult,
        categoriesResult,
        costItemsResult,
        reimbursementsResult,
        payersResult
      ] = await Promise.all([
        supabase
          .from('facilities')
          .select('id, name, or_hourly_rate')
          .eq('id', effectiveFacilityId)
          .single(),
        supabase
          .from('procedure_types')
          .select('id, name')
          .eq('facility_id', effectiveFacilityId)
          .order('name'),
        supabase
          .from('cost_categories')
          .select('id, name, type, description')
          .eq('facility_id', effectiveFacilityId)
          .eq('is_active', true)
          .order('type')
          .order('display_order'),
        supabase
          .from('procedure_cost_items')
          .select('id, procedure_type_id, cost_category_id, amount, notes, cost_category:cost_categories(id, name, type)')
          .in('procedure_type_id', 
            (await supabase.from('procedure_types').select('id').eq('facility_id', effectiveFacilityId)).data?.map(p => p.id) || []
          ),
        supabase
          .from('procedure_reimbursements')
          .select('id, procedure_type_id, payer_id, reimbursement, effective_date')
          .in('procedure_type_id',
            (await supabase.from('procedure_types').select('id').eq('facility_id', effectiveFacilityId)).data?.map(p => p.id) || []
          ),
        supabase
          .from('payers')
          .select('id, name, deleted_at')
          .eq('facility_id', effectiveFacilityId)
          .order('name'),
      ])

      if (facilityResult.data) {
        setCurrentFacility(facilityResult.data)
        setOrHourlyRate(facilityResult.data.or_hourly_rate?.toString() || '')
      }
      setProcedures(proceduresResult.data || [])
      setCostCategories(categoriesResult.data || [])
      setProcedureCostItems(costItemsResult.data?.map(item => ({
        ...item,
        cost_category: Array.isArray(item.cost_category) ? item.cost_category[0] : item.cost_category
      })) || [])
      setReimbursements(reimbursementsResult.data || [])
      setPayers(payersResult.data || [])
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  // =====================================================
  // OR HOURLY RATE
  // =====================================================

  const handleSaveOrRate = async () => {
    if (!effectiveFacilityId || !currentFacility) return
    setSaving(true)

    const oldRate = currentFacility.or_hourly_rate
    const newRate = orHourlyRate ? parseFloat(orHourlyRate) : null

    try {
      const { error } = await supabase
        .from('facilities')
        .update({ or_hourly_rate: newRate })
        .eq('id', effectiveFacilityId)

      if (error) throw error

      setCurrentFacility({ ...currentFacility, or_hourly_rate: newRate })
      setEditingOrRate(false)

      await genericAuditLog(supabase, 'facility.or_rate_updated', {
        targetType: 'facility',
        targetId: effectiveFacilityId,
        targetLabel: currentFacility.name,
        oldValues: { or_hourly_rate: oldRate },
        newValues: { or_hourly_rate: newRate },
        facilityId: effectiveFacilityId,
      })
    } catch (error) {
      console.error('Error saving OR rate:', error)
    } finally {
      setSaving(false)
    }
  }

  // =====================================================
  // PROCEDURE COST CALCULATIONS
  // =====================================================

  const getProcedureCostItems = (procedureId: string) => {
    return procedureCostItems.filter(item => item.procedure_type_id === procedureId)
  }

  const getDefaultReimbursement = (procedureId: string): number | null => {
    const defaultRate = reimbursements.find(
      r => r.procedure_type_id === procedureId && r.payer_id === null
    )
    return defaultRate?.reimbursement || null
  }

  const calculateTotals = (procedureId: string) => {
    const items = getProcedureCostItems(procedureId)
    const debits = items
      .filter(i => i.cost_category?.type === 'debit')
      .reduce((sum, i) => sum + i.amount, 0)
    const credits = items
      .filter(i => i.cost_category?.type === 'credit')
      .reduce((sum, i) => sum + i.amount, 0)
    return { debits, credits, net: debits - credits }
  }

  const calculateBaseMargin = (procedureId: string): number | null => {
    const reimbursement = getDefaultReimbursement(procedureId)
    if (reimbursement === null) return null
    const { net } = calculateTotals(procedureId)
    return reimbursement - net
  }

  const isConfigured = (procedureId: string): boolean => {
    const hasReimbursement = getDefaultReimbursement(procedureId) !== null
    const hasCosts = getProcedureCostItems(procedureId).length > 0
    return hasReimbursement || hasCosts
  }

  // =====================================================
  // SLIDE-OUT PANEL
  // =====================================================

  const openSlideOut = (procedure: ProcedureType) => {
    setSelectedProcedure(procedure)
    
    // Load existing cost items
    const items = getProcedureCostItems(procedure.id)
    setFormCostItems(items.map(item => ({
      category_id: item.cost_category_id,
      amount: item.amount.toString(),
      notes: item.notes || ''
    })))

    // Load reimbursements
    setFormDefaultReimbursement(getDefaultReimbursement(procedure.id)?.toString() || '')
    
    const payerRates = reimbursements.filter(
      r => r.procedure_type_id === procedure.id && r.payer_id !== null
    )
    setFormPayerReimbursements(payerRates.map(r => ({
      payer_id: r.payer_id!,
      reimbursement: r.reimbursement.toString()
    })))

    setSlideOutOpen(true)
  }

  const closeSlideOut = () => {
    setSlideOutOpen(false)
    setSelectedProcedure(null)
    setFormCostItems([])
    setFormDefaultReimbursement('')
    setFormPayerReimbursements([])
  }

  const addCostItem = () => {
    const usedCategories = formCostItems.map(i => i.category_id)
    const availableCategories = costCategories.filter(c => !usedCategories.includes(c.id))
    
    if (availableCategories.length > 0) {
      setFormCostItems([
        ...formCostItems,
        { category_id: availableCategories[0].id, amount: '', notes: '' }
      ])
    }
  }

  const removeCostItem = (index: number) => {
    setFormCostItems(formCostItems.filter((_, i) => i !== index))
  }

  const addPayerReimbursement = () => {
    const activePayers = payers.filter(p => !p.deleted_at)
    const usedPayerIds = formPayerReimbursements.map(pr => pr.payer_id)
    const availablePayers = activePayers.filter(p => !usedPayerIds.includes(p.id))

    if (availablePayers.length > 0) {
      setFormPayerReimbursements([
        ...formPayerReimbursements,
        { payer_id: availablePayers[0].id, reimbursement: '' }
      ])
    }
  }

  const removePayerReimbursement = (index: number) => {
    setFormPayerReimbursements(formPayerReimbursements.filter((_, i) => i !== index))
  }

  // =====================================================
  // SAVE PROCEDURE FINANCIALS
  // =====================================================

  const handleSave = async () => {
    if (!selectedProcedure || !effectiveFacilityId) return
    setSaving(true)

    try {
      // Handle cost items
      const existingItems = getProcedureCostItems(selectedProcedure.id)

      // Delete items that were removed
      for (const existing of existingItems) {
        const stillExists = formCostItems.some(f => f.category_id === existing.cost_category_id)
        if (!stillExists) {
          await supabase.from('procedure_cost_items').delete().eq('id', existing.id)
          await procedureCostItemAudit.deleted(
            supabase,
            selectedProcedure.name,
            existing.cost_category?.name || '',
            existing.id,
            effectiveFacilityId
          )
        }
      }

      // Update or create items
      for (const formItem of formCostItems) {
        if (!formItem.amount) continue
        const amount = parseFloat(formItem.amount)
        if (isNaN(amount)) continue

        const existing = existingItems.find(e => e.cost_category_id === formItem.category_id)
        const category = costCategories.find(c => c.id === formItem.category_id)

        if (existing) {
          // Update
          await supabase
            .from('procedure_cost_items')
            .update({ amount, notes: formItem.notes || null })
            .eq('id', existing.id)

          if (existing.amount !== amount) {
            await procedureCostItemAudit.updated(
              supabase,
              selectedProcedure.name,
              category?.name || '',
              existing.amount,
              amount,
              existing.id,
              effectiveFacilityId
            )
          }
        } else {
          // Create
          const { data: newItem } = await supabase
            .from('procedure_cost_items')
            .insert({
              procedure_type_id: selectedProcedure.id,
              cost_category_id: formItem.category_id,
              amount,
              notes: formItem.notes || null
            })
            .select()
            .single()

          if (newItem) {
            await procedureCostItemAudit.created(
              supabase,
              selectedProcedure.name,
              category?.name || '',
              amount,
              newItem.id,
              effectiveFacilityId
            )
          }
        }
      }

      // Handle default reimbursement
      const defaultReimbursement = formDefaultReimbursement ? parseFloat(formDefaultReimbursement) : null
      const existingDefault = reimbursements.find(
        r => r.procedure_type_id === selectedProcedure.id && r.payer_id === null
      )

      if (defaultReimbursement !== null) {
        if (existingDefault) {
          await supabase
            .from('procedure_reimbursements')
            .update({ reimbursement: defaultReimbursement, effective_date: new Date().toISOString().split('T')[0] })
            .eq('id', existingDefault.id)
        } else {
          await supabase
            .from('procedure_reimbursements')
            .insert({
              procedure_type_id: selectedProcedure.id,
              payer_id: null,
              reimbursement: defaultReimbursement,
              effective_date: new Date().toISOString().split('T')[0]
            })
        }
      } else if (existingDefault) {
        await supabase.from('procedure_reimbursements').delete().eq('id', existingDefault.id)
      }

      // Handle payer-specific reimbursements
      for (const payerRate of formPayerReimbursements) {
        const existingPayerRate = reimbursements.find(
          r => r.procedure_type_id === selectedProcedure.id && r.payer_id === payerRate.payer_id
        )
        const reimbursementValue = payerRate.reimbursement ? parseFloat(payerRate.reimbursement) : null

        if (reimbursementValue !== null) {
          if (existingPayerRate) {
            await supabase
              .from('procedure_reimbursements')
              .update({ reimbursement: reimbursementValue, effective_date: new Date().toISOString().split('T')[0] })
              .eq('id', existingPayerRate.id)
          } else {
            await supabase
              .from('procedure_reimbursements')
              .insert({
                procedure_type_id: selectedProcedure.id,
                payer_id: payerRate.payer_id,
                reimbursement: reimbursementValue,
                effective_date: new Date().toISOString().split('T')[0]
              })
          }
        } else if (existingPayerRate) {
          await supabase.from('procedure_reimbursements').delete().eq('id', existingPayerRate.id)
        }
      }

      // Refresh data
      await fetchData()
      closeSlideOut()
    } catch (error) {
      console.error('Error saving:', error)
    } finally {
      setSaving(false)
    }
  }

  // =====================================================
  // HELPERS
  // =====================================================

  const formatCurrency = (value: number | null): string => {
    if (value === null) return '—'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const activePayers = payers.filter(p => !p.deleted_at)

  // Calculate form totals for preview
  const formTotals = useMemo(() => {
    const debits = formCostItems
      .filter(i => {
        const cat = costCategories.find(c => c.id === i.category_id)
        return cat?.type === 'debit' && i.amount
      })
      .reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0)
    
    const credits = formCostItems
      .filter(i => {
        const cat = costCategories.find(c => c.id === i.category_id)
        return cat?.type === 'credit' && i.amount
      })
      .reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0)

    const reimbursement = formDefaultReimbursement ? parseFloat(formDefaultReimbursement) : null
    const margin = reimbursement !== null ? reimbursement - debits + credits : null

    return { debits, credits, reimbursement, margin }
  }, [formCostItems, formDefaultReimbursement, costCategories])

  // =====================================================
  // RENDER
  // =====================================================

  if (userLoading) {
    return (
      <DashboardLayout>
        <Container>
          <FinancialsLayout>
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          </FinancialsLayout>
        </Container>
      </DashboardLayout>
    )
  }

  if (!effectiveFacilityId) {
    return (
      <DashboardLayout>
        <Container>
          <FinancialsLayout>
            <div className="text-center py-12 text-slate-500">
              No facility selected
            </div>
          </FinancialsLayout>
        </Container>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <Container>
        <FinancialsLayout>
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-xl font-semibold text-slate-900">Procedure Pricing</h1>
            <p className="text-sm text-slate-600 mt-1">
              Configure costs and reimbursements for each procedure type
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : (
            <>
              {/* OR Hourly Rate */}
              <div className="mb-6 p-5 bg-white rounded-xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-slate-900">OR Hourly Rate</h3>
                    <p className="text-sm text-slate-500 mt-0.5">Cost per hour to operate the OR</p>
                  </div>
                  {editingOrRate ? (
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                        <input
                          type="number"
                          value={orHourlyRate}
                          onChange={(e) => setOrHourlyRate(e.target.value)}
                          className="w-32 pl-7 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          placeholder="0"
                        />
                      </div>
                      <span className="text-sm text-slate-500">/hr</span>
                      <button
                        onClick={handleSaveOrRate}
                        disabled={saving}
                        className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={() => {
                          setOrHourlyRate(currentFacility?.or_hourly_rate?.toString() || '')
                          setEditingOrRate(false)
                        }}
                        className="px-3 py-2 text-slate-600 text-sm hover:bg-slate-100 rounded-lg"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-semibold text-slate-900">
                        {currentFacility?.or_hourly_rate
                          ? `${formatCurrency(currentFacility.or_hourly_rate)}/hr`
                          : <span className="text-slate-400">Not set</span>
                        }
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

              {/* Cost Categories Check */}
              {costCategories.length === 0 && (
                <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <div className="flex gap-3">
                    <svg className="w-5 h-5 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-amber-800">No cost categories defined</p>
                      <p className="text-sm text-amber-700 mt-1">
                        Add cost categories first to configure procedure costs. Go to{' '}
                        <a href="/settings/financials/cost-categories" className="underline hover:no-underline">
                          Cost Categories
                        </a>
                        {' '}to set them up.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Procedures Table */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200">
                  <h3 className="font-medium text-slate-900">Procedure Pricing</h3>
                  <p className="text-sm text-slate-500">{procedures.length} procedures</p>
                </div>

                {procedures.length === 0 ? (
                  <div className="px-6 py-12 text-center">
                    <p className="text-slate-500">No procedures defined yet.</p>
                    <p className="text-sm text-slate-400 mt-1">
                      Add procedures in Settings → Procedure Types first.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    {/* Table Header */}
                    <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <div className="col-span-4">Procedure</div>
                      <div className="col-span-2 text-right">Reimbursement</div>
                      <div className="col-span-2 text-right">Total Costs</div>
                      <div className="col-span-2 text-right">Credits</div>
                      <div className="col-span-2 text-right">Base Margin</div>
                    </div>

                    {/* Table Body */}
                    <div className="divide-y divide-slate-100">
                      {procedures.map((procedure) => {
                        const configured = isConfigured(procedure.id)
                        const baseMargin = calculateBaseMargin(procedure.id)
                        const totals = calculateTotals(procedure.id)

                        return (
                          <div
                            key={procedure.id}
                            onClick={() => openSlideOut(procedure)}
                            className={`grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-slate-50 transition-colors cursor-pointer ${
                              !configured ? 'bg-amber-50/30' : ''
                            }`}
                          >
                            <div className="col-span-4 flex items-center gap-2">
                              <p className="font-medium text-slate-900">{procedure.name}</p>
                              {!configured && (
                                <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded bg-amber-100 text-amber-700">
                                  Not configured
                                </span>
                              )}
                            </div>
                            <div className="col-span-2 text-right">
                              <span className={`text-sm ${getDefaultReimbursement(procedure.id) ? 'text-slate-900' : 'text-slate-400'}`}>
                                {formatCurrency(getDefaultReimbursement(procedure.id))}
                              </span>
                            </div>
                            <div className="col-span-2 text-right">
                              <span className={`text-sm ${totals.debits > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                                {totals.debits > 0 ? formatCurrency(totals.debits) : '—'}
                              </span>
                            </div>
                            <div className="col-span-2 text-right">
                              <span className={`text-sm ${totals.credits > 0 ? 'text-green-600' : 'text-slate-400'}`}>
                                {totals.credits > 0 ? `+${formatCurrency(totals.credits)}` : '—'}
                              </span>
                            </div>
                            <div className="col-span-2 text-right">
                              <span className={`text-sm font-medium ${
                                baseMargin !== null
                                  ? baseMargin >= 0 ? 'text-emerald-600' : 'text-red-600'
                                  : 'text-slate-400'
                              }`}>
                                {formatCurrency(baseMargin)}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </FinancialsLayout>
      </Container>

      {/* Slide-out Panel */}
      {slideOutOpen && selectedProcedure && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/30 z-40"
            onClick={closeSlideOut}
          />

          {/* Panel */}
          <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {selectedProcedure.name}
                </h2>
                <p className="text-sm text-slate-500">Configure costs and reimbursements</p>
              </div>
              <button
                onClick={closeSlideOut}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Cost Items Section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-semibold text-slate-900">Cost Items</h4>
                  <button
                    onClick={addCostItem}
                    disabled={formCostItems.length >= costCategories.length}
                    className="text-sm text-blue-600 hover:text-blue-700 disabled:text-slate-400 disabled:cursor-not-allowed"
                  >
                    + Add cost item
                  </button>
                </div>

                {formCostItems.length === 0 ? (
                  <p className="text-sm text-slate-500 italic">No cost items configured</p>
                ) : (
                  <div className="space-y-3">
                    {formCostItems.map((item, index) => {
                      const category = costCategories.find(c => c.id === item.category_id)
                      return (
                        <div key={index} className="p-3 bg-slate-50 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <select
                              value={item.category_id}
                              onChange={(e) => {
                                const updated = [...formCostItems]
                                updated[index].category_id = e.target.value
                                setFormCostItems(updated)
                              }}
                              className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            >
                              {costCategories.map(c => (
                                <option key={c.id} value={c.id}>
                                  {c.name} ({c.type})
                                </option>
                              ))}
                            </select>
                            <div className="relative w-28">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                              <input
                                type="number"
                                value={item.amount}
                                onChange={(e) => {
                                  const updated = [...formCostItems]
                                  updated[index].amount = e.target.value
                                  setFormCostItems(updated)
                                }}
                                className="w-full pl-7 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                placeholder="0"
                              />
                            </div>
                            <button
                              onClick={() => removeCostItem(index)}
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${category?.type === 'credit' ? 'bg-green-500' : 'bg-red-500'}`} />
                            <span className="text-xs text-slate-500">{category?.type === 'credit' ? 'Credit (adds to margin)' : 'Debit (subtracts from margin)'}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Totals */}
                <div className="mt-4 p-3 bg-slate-100 rounded-lg text-sm">
                  <div className="flex justify-between text-slate-600">
                    <span>Total Debits:</span>
                    <span className="text-red-600">{formatCurrency(formTotals.debits)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 mt-1">
                    <span>Total Credits:</span>
                    <span className="text-green-600">+{formatCurrency(formTotals.credits)}</span>
                  </div>
                </div>
              </div>

              {/* Reimbursement Section */}
              <div>
                <h4 className="text-sm font-semibold text-slate-900 mb-4">Reimbursement</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Default Reimbursement
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                      <input
                        type="number"
                        value={formDefaultReimbursement}
                        onChange={(e) => setFormDefaultReimbursement(e.target.value)}
                        className="w-full pl-7 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        placeholder="0"
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Used when no payer is specified</p>
                  </div>

                  {/* Payer-specific rates */}
                  {activePayers.length > 0 && (
                    <div className="pt-4 border-t border-slate-200">
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-sm font-medium text-slate-700">
                          Payer-Specific Rates
                        </label>
                        <button
                          onClick={addPayerReimbursement}
                          disabled={formPayerReimbursements.length >= activePayers.length}
                          className="text-sm text-blue-600 hover:text-blue-700 disabled:text-slate-400 disabled:cursor-not-allowed"
                        >
                          + Add payer rate
                        </button>
                      </div>

                      {formPayerReimbursements.length === 0 ? (
                        <p className="text-sm text-slate-500 italic">No payer-specific rates configured</p>
                      ) : (
                        <div className="space-y-3">
                          {formPayerReimbursements.map((pr, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <select
                                value={pr.payer_id}
                                onChange={(e) => {
                                  const updated = [...formPayerReimbursements]
                                  updated[index].payer_id = e.target.value
                                  setFormPayerReimbursements(updated)
                                }}
                                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                              >
                                {activePayers.map(p => (
                                  <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                              </select>
                              <div className="relative w-28">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                                <input
                                  type="number"
                                  value={pr.reimbursement}
                                  onChange={(e) => {
                                    const updated = [...formPayerReimbursements]
                                    updated[index].reimbursement = e.target.value
                                    setFormPayerReimbursements(updated)
                                  }}
                                  className="w-full pl-7 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                  placeholder="0"
                                />
                              </div>
                              <button
                                onClick={() => removePayerReimbursement(index)}
                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Calculated Margin */}
              <div className="pt-4 border-t border-slate-200">
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-600 mb-1">Base Margin (before OR time)</p>
                  <p className={`text-2xl font-semibold ${
                    formTotals.margin !== null
                      ? formTotals.margin >= 0 ? 'text-emerald-600' : 'text-red-600'
                      : 'text-slate-400'
                  }`}>
                    {formTotals.margin !== null ? formatCurrency(formTotals.margin) : '—'}
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-white px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={closeSlideOut}
                className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  )
}