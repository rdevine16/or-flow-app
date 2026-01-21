// app/settings/financials/surgeon-variance/page.tsx
// Surgeon-specific cost overrides

'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../../../lib/supabase'
import { useUser } from '../../../../lib/UserContext'
import DashboardLayout from '../../../../components/layouts/DashboardLayout'
import Container from '../../../../components/ui/Container'
import SettingsLayout from '../../../../components/settings/SettingsLayout'
import { genericAuditLog } from '../../../../lib/audit-logger'

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
  cost_category?: CostCategory
}

interface ProcedureCostItem {
  id: string
  procedure_type_id: string
  cost_category_id: string
  amount: number
}

export default function SurgeonVariancePage() {
  const supabase = createClient()
  const { effectiveFacilityId, loading: userLoading } = useUser()

  const [surgeons, setSurgeons] = useState<Surgeon[]>([])
  const [procedures, setProcedures] = useState<ProcedureType[]>([])
  const [costCategories, setCostCategories] = useState<CostCategory[]>([])
  const [surgeonCostItems, setSurgeonCostItems] = useState<SurgeonCostItem[]>([])
  const [procedureCostItems, setProcedureCostItems] = useState<ProcedureCostItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Selection state
  const [selectedSurgeon, setSelectedSurgeon] = useState<string | null>(null)
  const [selectedProcedure, setSelectedProcedure] = useState<string | null>(null)

  // Edit panel state
  const [editPanelOpen, setEditPanelOpen] = useState(false)
  const [editingItems, setEditingItems] = useState<Map<string, number>>(new Map())

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
        .order('type')
        .order('display_order'),
      supabase
        .from('surgeon_cost_items')
        .select('*, cost_category:cost_categories(id, name, type)')
        .eq('facility_id', effectiveFacilityId),
      supabase
        .from('procedure_cost_items')
        .select('id, procedure_type_id, cost_category_id, amount')
        .eq('facility_id', effectiveFacilityId),
    ])

    if (surgeonsRes.data) setSurgeons(surgeonsRes.data)
    if (proceduresRes.data) setProcedures(proceduresRes.data)
    if (categoriesRes.data) setCostCategories(categoriesRes.data)
    if (surgeonItemsRes.data) setSurgeonCostItems(surgeonItemsRes.data)
    if (procedureItemsRes.data) setProcedureCostItems(procedureItemsRes.data)

    setLoading(false)
  }

  const openEditPanel = (surgeonId: string, procedureId: string) => {
    setSelectedSurgeon(surgeonId)
    setSelectedProcedure(procedureId)

    // Get existing surgeon cost items for this combination
    const existingItems = surgeonCostItems.filter(
      item => item.surgeon_id === surgeonId && item.procedure_type_id === procedureId
    )

    // Initialize editing map with existing values
    const editMap = new Map<string, number>()
    existingItems.forEach(item => {
      editMap.set(item.cost_category_id, item.amount)
    })
    setEditingItems(editMap)

    setEditPanelOpen(true)
  }

  const closeEditPanel = () => {
    setEditPanelOpen(false)
    setSelectedSurgeon(null)
    setSelectedProcedure(null)
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

  const handleSave = async () => {
    if (!selectedSurgeon || !selectedProcedure || !effectiveFacilityId) return
    setSaving(true)

    try {
      // Delete existing items for this surgeon/procedure
      await supabase
        .from('surgeon_cost_items')
        .delete()
        .eq('surgeon_id', selectedSurgeon)
        .eq('procedure_type_id', selectedProcedure)

      // Insert new items
      const itemsToInsert = Array.from(editingItems.entries())
        .filter(([_, amount]) => amount > 0)
        .map(([categoryId, amount]) => ({
          facility_id: effectiveFacilityId,
          surgeon_id: selectedSurgeon,
          procedure_type_id: selectedProcedure,
          cost_category_id: categoryId,
          amount,
        }))

      if (itemsToInsert.length > 0) {
        const { error } = await supabase
          .from('surgeon_cost_items')
          .insert(itemsToInsert)

        if (error) throw error
      }

      // Refresh data
      await fetchData()

      const surgeon = surgeons.find(s => s.id === selectedSurgeon)
      const procedure = procedures.find(p => p.id === selectedProcedure)

      await genericAuditLog(supabase, 'surgeon_cost_item.updated', {
        targetType: 'surgeon_cost_item',
        targetId: selectedSurgeon,
        targetLabel: `Dr. ${surgeon?.last_name} - ${procedure?.name}`,
        newValues: Object.fromEntries(editingItems),
        facilityId: effectiveFacilityId,
      })

      closeEditPanel()
    } catch (error) {
      console.error('Error saving surgeon cost items:', error)
    } finally {
      setSaving(false)
    }
  }

  const getDefaultAmount = (categoryId: string) => {
    if (!selectedProcedure) return null
    const item = procedureCostItems.find(
      i => i.procedure_type_id === selectedProcedure && i.cost_category_id === categoryId
    )
    return item?.amount ?? null
  }

  const getSurgeonVarianceCount = (surgeonId: string) => {
    return surgeonCostItems.filter(item => item.surgeon_id === surgeonId).length
  }

  const getVarianceSummary = (surgeonId: string, procedureId: string) => {
    const items = surgeonCostItems.filter(
      item => item.surgeon_id === surgeonId && item.procedure_type_id === procedureId
    )
    return items.length
  }

  const selectedSurgeonData = surgeons.find(s => s.id === selectedSurgeon)
  const selectedProcedureData = procedures.find(p => p.id === selectedProcedure)

  if (userLoading) {
    return (
      <DashboardLayout>
        <Container>
          <SettingsLayout title="Surgeon Variance" description="Configure surgeon-specific cost overrides">
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
          <SettingsLayout title="Surgeon Variance" description="Configure surgeon-specific cost overrides">
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
        <SettingsLayout title="Surgeon Variance" description="Configure surgeon-specific cost overrides">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : costCategories.length === 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
              <svg className="w-10 h-10 text-amber-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h3 className="text-lg font-medium text-amber-900 mb-2">No Cost Categories</h3>
              <p className="text-amber-700 mb-4">
                Set up cost categories first before configuring surgeon variances.
              </p>
              <a
                href="/settings/financials/cost-categories"
                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
              >
                Set Up Cost Categories
              </a>
            </div>
          ) : surgeons.length === 0 ? (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center">
              <h3 className="text-lg font-medium text-slate-900 mb-2">No Surgeons</h3>
              <p className="text-slate-600">
                Add surgeons to your facility to configure cost variances.
              </p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                <p className="text-sm text-slate-600">
                  Click a surgeon/procedure cell to override the default costs. Surgeon variances take precedence over procedure defaults.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider sticky left-0 bg-slate-50">
                        Surgeon
                      </th>
                      {procedures.map((proc) => (
                        <th key={proc.id} className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider min-w-[120px]">
                          {proc.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {surgeons.map((surgeon) => (
                      <tr key={surgeon.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm font-medium text-slate-900 sticky left-0 bg-white">
                          <div className="flex items-center gap-2">
                            <span>Dr. {surgeon.first_name} {surgeon.last_name}</span>
                            {getSurgeonVarianceCount(surgeon.id) > 0 && (
                              <span className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
                                {getSurgeonVarianceCount(surgeon.id)} override{getSurgeonVarianceCount(surgeon.id) !== 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        </td>
                        {procedures.map((proc) => {
                          const varianceCount = getVarianceSummary(surgeon.id, proc.id)
                          return (
                            <td key={proc.id} className="px-4 py-3 text-center">
                              <button
                                onClick={() => openEditPanel(surgeon.id, proc.id)}
                                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                                  varianceCount > 0
                                    ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                    : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                                }`}
                              >
                                {varianceCount > 0 ? `${varianceCount} override${varianceCount !== 1 ? 's' : ''}` : 'Default'}
                              </button>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </SettingsLayout>
      </Container>

      {/* Edit Panel */}
      {editPanelOpen && selectedSurgeonData && selectedProcedureData && (
        <div className="fixed inset-0 bg-black/50 flex justify-end z-50">
          <div className="w-full max-w-lg bg-white shadow-xl flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Cost Overrides
                </h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  Dr. {selectedSurgeonData.first_name} {selectedSurgeonData.last_name} • {selectedProcedureData.name}
                </p>
              </div>
              <button
                onClick={closeEditPanel}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
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
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
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
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={closeEditPanel}
                className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Overrides'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}