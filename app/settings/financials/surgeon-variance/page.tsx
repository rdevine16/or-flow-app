// app/settings/financials/surgeon-variance/page.tsx
// Updated with effective dating support for historical cost preservation
// Changes from original:
// 1. Fetch only active records (effective_to IS NULL)
// 2. Save ends old records + creates new ones (instead of delete+insert)
// 3. Delete soft-deletes by setting effective_to (instead of hard delete)

'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import SettingsLayout from '@/components/settings/SettingsLayout'
import SearchableDropdown from '@/components/ui/SearchableDropdown'
import { genericAuditLog } from '@/lib/audit-logger'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { DeleteConfirm } from '@/components/ui/ConfirmDialog'
import { PageLoader } from '@/components/ui/Loading'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Calculator, ExternalLink, Info, Pencil, Plus, Trash2, X } from 'lucide-react'

interface Surgeon {
  id: string
  first_name: string
  last_name: string
}

interface ProcedureType {
  id: string
  name: string
}

interface CostCategory {
  id: string
  name: string
  type: 'debit' | 'credit'
}

interface SurgeonCostItem {
  id: string
  surgeon_id: string
  procedure_type_id: string
  cost_category_id: string
  amount: number
  effective_from: string | null
  effective_to: string | null
}

interface ProcedureCostItem {
  id: string
  procedure_type_id: string
  cost_category_id: string
  amount: number
}

// Grouped override for display
interface SurgeonProcedureOverride {
  surgeonId: string
  surgeonName: string
  procedureId: string
  procedureName: string
  overrideCount: number
  items: SurgeonCostItem[]
}

// Helper to get today's date in YYYY-MM-DD format
const getTodayDate = () => new Date().toISOString().split('T')[0]

// Helper to get yesterday's date in YYYY-MM-DD format
const getYesterdayDate = () => {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().split('T')[0]
}

export default function SurgeonVariancePage() {
  const supabase = createClient()
  const { effectiveFacilityId, loading: userLoading } = useUser()
  const { showToast } = useToast()

  const [surgeons, setSurgeons] = useState<Surgeon[]>([])
  const [procedures, setProcedures] = useState<ProcedureType[]>([])
  const [costCategories, setCostCategories] = useState<CostCategory[]>([])
  const [surgeonCostItems, setSurgeonCostItems] = useState<SurgeonCostItem[]>([])
  const [procedureCostItems, setProcedureCostItems] = useState<ProcedureCostItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Filter state
  const [filterSurgeonId, setFilterSurgeonId] = useState<string>('')

  // Edit/Add panel state
  const [panelOpen, setPanelOpen] = useState(false)
  const [panelMode, setPanelMode] = useState<'add' | 'edit'>('add')
  const [selectedSurgeonId, setSelectedSurgeonId] = useState<string>('')
  const [selectedProcedureId, setSelectedProcedureId] = useState<string>('')
  const [editingItems, setEditingItems] = useState<Map<string, number>>(new Map())

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<SurgeonProcedureOverride | null>(null)

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
    setError(null)

    try {
      const today = getTodayDate()

      const [surgeonsRes, proceduresRes, categoriesRes, surgeonItemsRes, procedureItemsRes] = await Promise.all([
        supabase
          .from('users')
          .select('id, first_name, last_name')
          .eq('facility_id', effectiveFacilityId)
          .eq('role_id', (await supabase.from('user_roles').select('id').eq('name', 'surgeon').single()).data?.id)
          .order('last_name'),
        supabase
          .from('procedure_types')
          .select('id, name')
          .eq('facility_id', effectiveFacilityId)
          .is('deleted_at', null)
          .order('name'),
        supabase
          .from('cost_categories')
          .select('id, name, type')
          .eq('facility_id', effectiveFacilityId)
          .eq('is_active', true)
          .is('deleted_at', null) 
          .order('type')
          .order('display_order'),
        supabase
          .from('surgeon_cost_items')
          .select('id, surgeon_id, procedure_type_id, cost_category_id, amount, effective_from, effective_to')
          .eq('facility_id', effectiveFacilityId)
          .or(`effective_to.is.null,effective_to.gt.${today}`),
        supabase
          .from('procedure_cost_items')
          .select('id, procedure_type_id, cost_category_id, amount')
          .eq('facility_id', effectiveFacilityId),
      ])

      if (surgeonsRes.error) throw surgeonsRes.error

      if (surgeonsRes.data) setSurgeons(surgeonsRes.data)
      if (proceduresRes.data) setProcedures(proceduresRes.data)
      if (categoriesRes.data) setCostCategories(categoriesRes.data)
      if (surgeonItemsRes.data) setSurgeonCostItems(surgeonItemsRes.data)
      if (procedureItemsRes.data) setProcedureCostItems(procedureItemsRes.data)
    } catch (err) {
      setError('Failed to load surgeon variance data. Please try again.')
      showToast({ type: 'error', title: 'Failed to load data', message: err instanceof Error ? err.message : 'Please try again' })
    } finally {
      setLoading(false)
    }
  }

  // Group surgeon cost items by surgeon+procedure
  const getGroupedOverrides = (): SurgeonProcedureOverride[] => {
    const grouped = new Map<string, SurgeonProcedureOverride>()

    surgeonCostItems.forEach(item => {
      const key = `${item.surgeon_id}-${item.procedure_type_id}`
      const surgeon = surgeons.find(s => s.id === item.surgeon_id)
      const procedure = procedures.find(p => p.id === item.procedure_type_id)

      if (!surgeon || !procedure) return

      if (!grouped.has(key)) {
        grouped.set(key, {
          surgeonId: item.surgeon_id,
          surgeonName: `Dr. ${surgeon.first_name} ${surgeon.last_name}`,
          procedureId: item.procedure_type_id,
          procedureName: procedure.name,
          overrideCount: 0,
          items: [],
        })
      }

      const group = grouped.get(key)!
      group.overrideCount++
      group.items.push(item)
    })

    let result = Array.from(grouped.values())

    // Apply filter
    if (filterSurgeonId) {
      result = result.filter(o => o.surgeonId === filterSurgeonId)
    }

    // Sort by surgeon name, then procedure
    result.sort((a, b) => {
      const surgeonCompare = a.surgeonName.localeCompare(b.surgeonName)
      if (surgeonCompare !== 0) return surgeonCompare
      return a.procedureName.localeCompare(b.procedureName)
    })

    return result
  }

  const openAddPanel = () => {
    setSelectedSurgeonId('')
    setSelectedProcedureId('')
    setEditingItems(new Map())
    setPanelMode('add')
    setPanelOpen(true)
  }

  const openEditPanel = (override: SurgeonProcedureOverride) => {
    setSelectedSurgeonId(override.surgeonId)
    setSelectedProcedureId(override.procedureId)

    const editMap = new Map<string, number>()
    override.items.forEach(item => {
      editMap.set(item.cost_category_id, item.amount)
    })
    setEditingItems(editMap)

    setPanelMode('edit')
    setPanelOpen(true)
  }

  const closePanel = () => {
    setPanelOpen(false)
    setSelectedSurgeonId('')
    setSelectedProcedureId('')
    setEditingItems(new Map())
  }

  const handleAmountChange = (categoryId: string, value: string) => {
    const newMap = new Map(editingItems)
    if (value === '') {
      newMap.delete(categoryId)
    } else {
      newMap.set(categoryId, parseFloat(value) || 0)
    }
    setEditingItems(newMap)
  }

  const getDefaultAmount = (categoryId: string): number | null => {
    if (!selectedProcedureId) return null
    const item = procedureCostItems.find(
      i => i.procedure_type_id === selectedProcedureId && i.cost_category_id === categoryId
    )
    return item?.amount ?? null
  }

  // CHANGED: Updated save logic for effective dating
  const handleSave = async () => {
    if (!selectedSurgeonId || !selectedProcedureId || !effectiveFacilityId) return
    setSaving(true)

    const today = getTodayDate()
    const yesterday = getYesterdayDate()

    try {
      // Get existing active items for this surgeon/procedure
      const existingItems = surgeonCostItems.filter(
        item => item.surgeon_id === selectedSurgeonId && 
                item.procedure_type_id === selectedProcedureId
      )

      // Step 1: End-date all existing active records (set effective_to = yesterday)
      if (existingItems.length > 0) {
        const existingIds = existingItems.map(item => item.id)
        
        const { error: updateError } = await supabase
          .from('surgeon_cost_items')
          .update({ effective_to: yesterday })
          .in('id', existingIds)

        if (updateError) throw updateError
      }

      // Step 2: Insert new records with effective_from = today
      const itemsToInsert = Array.from(editingItems.entries())
        .filter(([_, amount]) => amount > 0)
        .map(([categoryId, amount]) => ({
          facility_id: effectiveFacilityId,
          surgeon_id: selectedSurgeonId,
          procedure_type_id: selectedProcedureId,
          cost_category_id: categoryId,
          amount,
          effective_from: today,
          effective_to: null,
        }))

      if (itemsToInsert.length > 0) {
        const { error } = await supabase
          .from('surgeon_cost_items')
          .insert(itemsToInsert)

        if (error) throw error
      }

      const surgeon = surgeons.find(s => s.id === selectedSurgeonId)
      const procedure = procedures.find(p => p.id === selectedProcedureId)

      await genericAuditLog(supabase, 'surgeon_cost_item.updated', {
        targetType: 'surgeon_cost_item',
        targetId: selectedSurgeonId,
        targetLabel: `Dr. ${surgeon?.last_name} - ${procedure?.name}`,
        oldValues: existingItems.length > 0 
          ? Object.fromEntries(existingItems.map(i => [i.cost_category_id, i.amount]))
          : undefined,
        newValues: Object.fromEntries(editingItems),
        metadata: { effective_from: today },
        facilityId: effectiveFacilityId,
      })

      await fetchData()
      closePanel()
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Error saving overrides',
        message: error instanceof Error ? error.message : 'Error saving overrides'
      })
    } finally {
      setSaving(false)
    }
  }

  // CHANGED: Updated delete logic for effective dating (soft delete)
  const handleDelete = async (surgeonId: string, procedureId: string) => {
    if (!effectiveFacilityId) return
    setSaving(true)

    const today = getTodayDate()

    try {
      // Soft delete: Set effective_to = today for all active records
      const { error } = await supabase
        .from('surgeon_cost_items')
        .update({ effective_to: today })
        .eq('surgeon_id', surgeonId)
        .eq('procedure_type_id', procedureId)
        .is('effective_to', null)

      if (error) throw error

      const surgeon = surgeons.find(s => s.id === surgeonId)
      const procedure = procedures.find(p => p.id === procedureId)

      await genericAuditLog(supabase, 'surgeon_cost_item.deleted', {
        targetType: 'surgeon_cost_item',
        targetId: surgeonId,
        targetLabel: `Dr. ${surgeon?.last_name} - ${procedure?.name}`,
        metadata: { effective_to: today, soft_delete: true },
        facilityId: effectiveFacilityId,
      })

      await fetchData()
      setDeleteTarget(null)
    } catch (error) {
      showToast({
  type: 'error',
  title: 'Error deleting:',
  message: error instanceof Error ? error.message : 'Error deleting:'
})
    } finally {
      setSaving(false)
    }
  }

  // Check if surgeon+procedure combo already has overrides
  const hasExistingOverride = (surgeonId: string, procedureId: string): boolean => {
    return surgeonCostItems.some(
      item => item.surgeon_id === surgeonId && item.procedure_type_id === procedureId
    )
  }

  // Get procedures that don't have overrides for selected surgeon (for Add mode)
  const getAvailableProcedures = (): ProcedureType[] => {
    if (!selectedSurgeonId) return procedures
    return procedures.filter(p => !hasExistingOverride(selectedSurgeonId, p.id))
  }

  const groupedOverrides = getGroupedOverrides()
  const selectedSurgeon = surgeons.find(s => s.id === selectedSurgeonId)
  const selectedProcedure = procedures.find(p => p.id === selectedProcedureId)

  return (
    <DashboardLayout>
      <Container>
          <ErrorBanner message={error} onDismiss={() => setError(null)} />
        <SettingsLayout 
          title="Surgeon Variance" 
          description="Configure surgeon-specific cost overrides"
        >
          {loading ? (
            <PageLoader message="Loading surgeon variance data..." />
          ) : costCategories.length === 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
              <h3 className="text-lg font-medium text-amber-900 mb-2">Set Up Cost Categories First</h3>
              <p className="text-amber-700 mb-4">
                You need to create cost categories before configuring surgeon variances.
              </p>
              <a
                href="/settings/financials/cost-categories"
                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
              >
                Set Up Cost Categories
              </a>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Header with Add button and filter */}
              <div className="flex items-center justify-between gap-4">
                <div className="w-64">
                  <SearchableDropdown
                    placeholder="Filter by surgeon..."
                    value={filterSurgeonId}
                    onChange={setFilterSurgeonId}
                    options={[
                      { id: '', label: 'All Surgeons' },
                      ...surgeons.map(s => ({
                        id: s.id,
                        label: `Dr. ${s.first_name} ${s.last_name}`
                      }))
                    ]}
                  />
                </div>
                <Button onClick={openAddPanel}>
                  <Plus className="w-5 h-5" />
                  Add Override
                </Button>
              </div>

              {/* Overrides list */}
              {groupedOverrides.length === 0 ? (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center">
                  <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Calculator className="w-6 h-6 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-medium text-slate-900 mb-2">No Cost Overrides</h3>
                  <p className="text-slate-600 mb-4">
                    {filterSurgeonId 
                      ? "No overrides found for this surgeon."
                      : "All cases will use default procedure costs. Add an override to customize costs for specific surgeons."}
                  </p>
                  {!filterSurgeonId && (
                    <Button onClick={openAddPanel}>
                      <Plus className="w-5 h-5" />
                      Add First Override
                    </Button>
                  )}
                </div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                          Surgeon
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                          Procedure
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">
                          Overrides
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {groupedOverrides.map((override) => (
                        <tr 
                          key={`${override.surgeonId}-${override.procedureId}`}
                          className="hover:bg-slate-50 transition-colors"
                        >
                          <td className="px-6 py-4">
                            <span className="font-medium text-slate-900">{override.surgeonName}</span>
                          </td>
                          <td className="px-6 py-4 text-slate-600">
                            {override.procedureName}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                              {override.overrideCount} {override.overrideCount === 1 ? 'category' : 'categories'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => openEditPanel(override)}
                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Edit"
                              >
                                <Pencil className="w-5 h-5" />
                              </button>
                              <button
                                  onClick={() => setDeleteTarget(override)}
                                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 className="w-5 h-5" />
                                </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

{/* Info Box with Cross-Links */}
<div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
  <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
  <div className="text-sm text-blue-800">
    <p className="font-medium mb-1">How surgeon variance works</p>
    <p className="mb-3">Override default procedure costs for specific surgeons. When a case is completed, the system checks for surgeon-specific overrides first. If none exist, the default procedure costs from Procedure Pricing are used. Changes only affect future cases — historical costs are preserved.</p>
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-blue-700">
      <span className="font-medium text-blue-800">Defaults from:</span>
      <a href="/settings/financials/procedure-pricing" className="underline hover:no-underline inline-flex items-center gap-1">
        Procedure Pricing
        <ExternalLink className="w-3 h-3" />
      </a>
      <a href="/settings/financials/cost-categories" className="underline hover:no-underline inline-flex items-center gap-1">
        Cost Categories
        <ExternalLink className="w-3 h-3" />
      </a>
    </div>
  </div>
</div>
            </div>
          )}
        </SettingsLayout>
      </Container>

      {/* Add/Edit Panel */}
      {panelOpen && (
        <div className="fixed inset-0 bg-black/50 flex justify-end z-50">
          <div className="w-full max-w-lg bg-white shadow-xl flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {panelMode === 'add' ? 'Add Cost Override' : 'Edit Cost Override'}
                </h3>
                {panelMode === 'edit' && selectedSurgeon && selectedProcedure && (
                  <p className="text-sm text-slate-500 mt-0.5">
                    Dr. {selectedSurgeon.first_name} {selectedSurgeon.last_name} • {selectedProcedure.name}
                  </p>
                )}
              </div>
              <button
                onClick={closePanel}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Surgeon/Procedure selection (Add mode only) */}
              {panelMode === 'add' && (
                <div className="space-y-4 mb-6 pb-6 border-b border-slate-200">
                  <SearchableDropdown
                    label="Surgeon"
                    placeholder="Select Surgeon"
                    value={selectedSurgeonId}
                    onChange={(id) => {
                      setSelectedSurgeonId(id)
                      setSelectedProcedureId('') // Reset procedure when surgeon changes
                    }}
                    options={surgeons.map(s => ({
                      id: s.id,
                      label: `Dr. ${s.first_name} ${s.last_name}`
                    }))}
                  />
                  <SearchableDropdown
                    label="Procedure"
                    placeholder={selectedSurgeonId ? "Select Procedure" : "Select surgeon first"}
                    value={selectedProcedureId}
                    onChange={setSelectedProcedureId}
                    options={getAvailableProcedures().map(p => ({
                      id: p.id,
                      label: p.name
                    }))}
                    disabled={!selectedSurgeonId}
                  />
                  {selectedSurgeonId && getAvailableProcedures().length === 0 && (
                    <p className="text-sm text-amber-600">
                      This surgeon already has overrides for all procedures.
                    </p>
                  )}
                </div>
              )}

              {/* Cost categories (show when surgeon + procedure selected) */}
              {selectedSurgeonId && selectedProcedureId ? (
                <>
                  <p className="text-sm text-slate-600 mb-4">
                    Leave blank to use the procedure default. Enter a value to override.
                  </p>

                  {/* Debits */}
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                      Debits (Costs)
                    </h4>
                    <div className="space-y-3">
                      {costCategories.filter(c => c.type === 'debit').map((cat) => {
                        const defaultAmount = getDefaultAmount(cat.id)
                        const currentValue = editingItems.get(cat.id)
                        return (
                          <div key={cat.id} className="flex items-center gap-4">
                            <label className="flex-1 text-sm text-slate-700">
                              {cat.name}
                              {defaultAmount !== null && (
                                <span className="text-slate-400 ml-2">(default: ${defaultAmount.toFixed(2)})</span>
                              )}
                            </label>
                            <div className="relative w-32">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                              <input
                                type="number"
                                value={currentValue ?? ''}
                                onChange={(e) => handleAmountChange(cat.id, e.target.value)}
                                className="w-full pl-7 pr-3 py-2 border border-slate-200 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                placeholder={defaultAmount?.toFixed(2) ?? '0.00'}
                                step="0.01"
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Credits */}
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                      Credits (Offsets)
                    </h4>
                    <div className="space-y-3">
                      {costCategories.filter(c => c.type === 'credit').map((cat) => {
                        const defaultAmount = getDefaultAmount(cat.id)
                        const currentValue = editingItems.get(cat.id)
                        return (
                          <div key={cat.id} className="flex items-center gap-4">
                            <label className="flex-1 text-sm text-slate-700">
                              {cat.name}
                              {defaultAmount !== null && (
                                <span className="text-slate-400 ml-2">(default: ${defaultAmount.toFixed(2)})</span>
                              )}
                            </label>
                            <div className="relative w-32">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                              <input
                                type="number"
                                value={currentValue ?? ''}
                                onChange={(e) => handleAmountChange(cat.id, e.target.value)}
                                className="w-full pl-7 pr-3 py-2 border border-slate-200 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                placeholder={defaultAmount?.toFixed(2) ?? '0.00'}
                                step="0.01"
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Effective date notice */}
                  <div className="mt-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-700">
                      <span className="font-medium">Note:</span> Changes take effect today and apply to new cases only. Historical case costs are preserved.
                    </p>
                  </div>
                </>
              ) : panelMode === 'add' ? (
                <p className="text-sm text-slate-400 italic">
                  Select a surgeon and procedure to configure cost overrides.
                </p>
              ) : null}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <Button variant="ghost" onClick={closePanel}>
                Cancel
              </Button>
              <Button onClick={handleSave} loading={saving} disabled={!selectedSurgeonId || !selectedProcedureId}>
                Save Overrides
              </Button>
            </div>
          </div>
        </div>
      )}

      <DeleteConfirm
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget) await handleDelete(deleteTarget.surgeonId, deleteTarget.procedureId)
        }}
        itemName={deleteTarget ? `${deleteTarget.surgeonName} — ${deleteTarget.procedureName}` : ''}
        itemType="cost override"
      />
    </DashboardLayout>
  )
}