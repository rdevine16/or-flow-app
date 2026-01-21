// app/settings/financials/surgeon-variance/page.tsx
// Manage surgeon-specific cost overrides and additions

'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '../../../../../lib/supabase'
import { useUser } from '../../../../../lib/UserContext'
import DashboardLayout from '../../../../../components/layouts/DashboardLayout'
import Container from '../../../../../components/ui/Container'
import FinancialsLayout from '../../../../../components/settings/FinancialsLayout'
import { surgeonCostItemAudit } from '../../../../../lib/audit-logger'

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
  type: 'credit' | 'debit'
}

interface ProcedureCostItem {
  id: string
  procedure_type_id: string
  cost_category_id: string
  amount: number
  cost_category?: CostCategory
}

interface SurgeonCostItem {
  id: string
  surgeon_id: string
  procedure_type_id: string
  cost_category_id: string
  amount: number
  notes: string | null
  surgeon?: Surgeon
  procedure_type?: ProcedureType
  cost_category?: CostCategory
}

interface GroupedVariance {
  surgeon: Surgeon
  procedures: {
    procedure: ProcedureType
    items: SurgeonCostItem[]
    procedureDefaults: ProcedureCostItem[]
  }[]
}

export default function SurgeonVariancePage() {
  const supabase = createClient()
  const { effectiveFacilityId, loading: userLoading } = useUser()

  const [surgeonCostItems, setSurgeonCostItems] = useState<SurgeonCostItem[]>([])
  const [procedureCostItems, setProcedureCostItems] = useState<ProcedureCostItem[]>([])
  const [surgeons, setSurgeons] = useState<Surgeon[]>([])
  const [procedures, setProcedures] = useState<ProcedureType[]>([])
  const [categories, setCategories] = useState<CostCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Filters
  const [filterSurgeon, setFilterSurgeon] = useState<string>('all')
  const [filterProcedure, setFilterProcedure] = useState<string>('all')

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<SurgeonCostItem | null>(null)

  // Form state
  const [formSurgeonId, setFormSurgeonId] = useState('')
  const [formProcedureId, setFormProcedureId] = useState('')
  const [formCategoryId, setFormCategoryId] = useState('')
  const [formAmount, setFormAmount] = useState('')
  const [formNotes, setFormNotes] = useState('')

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // Fetch data
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
      // Fetch surgeons (users with surgeon role)
      const { data: surgeonsData } = await supabase
        .from('users')
        .select('id, first_name, last_name, user_roles!inner(name)')
        .eq('facility_id', effectiveFacilityId)
        .eq('is_active', true)
        .eq('user_roles.name', 'surgeon')
        .order('last_name')

      // Fetch procedure types
      const { data: proceduresData } = await supabase
        .from('procedure_types')
        .select('id, name')
        .eq('facility_id', effectiveFacilityId)
        .order('name')

      // Fetch cost categories
      const { data: categoriesData } = await supabase
        .from('cost_categories')
        .select('id, name, type')
        .eq('facility_id', effectiveFacilityId)
        .eq('is_active', true)
        .order('type')
        .order('display_order')

      // Fetch procedure cost items (defaults)
      const { data: procedureCostsData } = await supabase
        .from('procedure_cost_items')
        .select(`
          id,
          procedure_type_id,
          cost_category_id,
          amount,
          cost_category:cost_categories(id, name, type)
        `)
        .in('procedure_type_id', (proceduresData || []).map(p => p.id))

      // Fetch surgeon cost items
      const { data: surgeonCostsData } = await supabase
        .from('surgeon_cost_items')
        .select(`
          id,
          surgeon_id,
          procedure_type_id,
          cost_category_id,
          amount,
          notes,
          surgeon:users(id, first_name, last_name),
          procedure_type:procedure_types(id, name),
          cost_category:cost_categories(id, name, type)
        `)
        .in('surgeon_id', (surgeonsData || []).map(s => s.id))
        .order('surgeon_id')

      setSurgeons(surgeonsData?.map(s => ({
        id: s.id,
        first_name: s.first_name,
        last_name: s.last_name
      })) || [])
      setProcedures(proceduresData || [])
      setCategories(categoriesData || [])
      setProcedureCostItems(procedureCostsData?.map(item => ({
        ...item,
        cost_category: Array.isArray(item.cost_category) ? item.cost_category[0] : item.cost_category
      })) || [])
      setSurgeonCostItems(surgeonCostsData?.map(item => ({
        ...item,
        surgeon: Array.isArray(item.surgeon) ? item.surgeon[0] : item.surgeon,
        procedure_type: Array.isArray(item.procedure_type) ? item.procedure_type[0] : item.procedure_type,
        cost_category: Array.isArray(item.cost_category) ? item.cost_category[0] : item.cost_category
      })) || [])
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Group and filter data
  const groupedData = useMemo(() => {
    let filtered = surgeonCostItems

    // Apply filters
    if (filterSurgeon !== 'all') {
      filtered = filtered.filter(item => item.surgeon_id === filterSurgeon)
    }
    if (filterProcedure !== 'all') {
      filtered = filtered.filter(item => item.procedure_type_id === filterProcedure)
    }

    // Group by surgeon, then by procedure
    const grouped: GroupedVariance[] = []
    const surgeonMap = new Map<string, GroupedVariance>()

    filtered.forEach(item => {
      if (!item.surgeon) return

      let surgeonGroup = surgeonMap.get(item.surgeon_id)
      if (!surgeonGroup) {
        surgeonGroup = {
          surgeon: item.surgeon,
          procedures: []
        }
        surgeonMap.set(item.surgeon_id, surgeonGroup)
        grouped.push(surgeonGroup)
      }

      let procedureGroup = surgeonGroup.procedures.find(
        p => p.procedure.id === item.procedure_type_id
      )
      if (!procedureGroup && item.procedure_type) {
        const defaults = procedureCostItems.filter(
          pci => pci.procedure_type_id === item.procedure_type_id
        )
        procedureGroup = {
          procedure: item.procedure_type,
          items: [],
          procedureDefaults: defaults
        }
        surgeonGroup.procedures.push(procedureGroup)
      }

      if (procedureGroup) {
        procedureGroup.items.push(item)
      }
    })

    // Sort
    grouped.sort((a, b) => a.surgeon.last_name.localeCompare(b.surgeon.last_name))
    grouped.forEach(g => {
      g.procedures.sort((a, b) => a.procedure.name.localeCompare(b.procedure.name))
    })

    return grouped
  }, [surgeonCostItems, procedureCostItems, filterSurgeon, filterProcedure])

  const handleNew = () => {
    setEditingItem(null)
    setFormSurgeonId('')
    setFormProcedureId('')
    setFormCategoryId('')
    setFormAmount('')
    setFormNotes('')
    setShowModal(true)
  }

  const handleEdit = (item: SurgeonCostItem) => {
    setEditingItem(item)
    setFormSurgeonId(item.surgeon_id)
    setFormProcedureId(item.procedure_type_id)
    setFormCategoryId(item.cost_category_id)
    setFormAmount(item.amount.toString())
    setFormNotes(item.notes || '')
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!formSurgeonId || !formProcedureId || !formCategoryId || !formAmount || !effectiveFacilityId) return

    setSaving(true)

    try {
      const amount = parseFloat(formAmount)
      if (isNaN(amount)) throw new Error('Invalid amount')

      const surgeon = surgeons.find(s => s.id === formSurgeonId)
      const procedure = procedures.find(p => p.id === formProcedureId)
      const category = categories.find(c => c.id === formCategoryId)

      if (editingItem) {
        // Update
        const { error } = await supabase
          .from('surgeon_cost_items')
          .update({
            amount,
            notes: formNotes.trim() || null,
          })
          .eq('id', editingItem.id)

        if (error) throw error

        await surgeonCostItemAudit.updated(
          supabase,
          `Dr. ${surgeon?.last_name}`,
          procedure?.name || '',
          category?.name || '',
          editingItem.amount,
          amount,
          editingItem.id,
          effectiveFacilityId
        )

        setSurgeonCostItems(surgeonCostItems.map(item =>
          item.id === editingItem.id
            ? { ...item, amount, notes: formNotes.trim() || null }
            : item
        ))
      } else {
        // Create
        const { data: newItem, error } = await supabase
          .from('surgeon_cost_items')
          .insert({
            surgeon_id: formSurgeonId,
            procedure_type_id: formProcedureId,
            cost_category_id: formCategoryId,
            amount,
            notes: formNotes.trim() || null,
          })
          .select(`
            id,
            surgeon_id,
            procedure_type_id,
            cost_category_id,
            amount,
            notes,
            surgeon:users(id, first_name, last_name),
            procedure_type:procedure_types(id, name),
            cost_category:cost_categories(id, name, type)
          `)
          .single()

        if (error) throw error

        await surgeonCostItemAudit.created(
          supabase,
          `Dr. ${surgeon?.last_name}`,
          procedure?.name || '',
          category?.name || '',
          amount,
          newItem.id,
          effectiveFacilityId
        )

        const normalizedItem = {
          ...newItem,
          surgeon: Array.isArray(newItem.surgeon) ? newItem.surgeon[0] : newItem.surgeon,
          procedure_type: Array.isArray(newItem.procedure_type) ? newItem.procedure_type[0] : newItem.procedure_type,
          cost_category: Array.isArray(newItem.cost_category) ? newItem.cost_category[0] : newItem.cost_category
        }

        setSurgeonCostItems([...surgeonCostItems, normalizedItem])
      }

      setShowModal(false)
    } catch (error) {
      console.error('Error saving:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (item: SurgeonCostItem) => {
    if (!effectiveFacilityId) return
    setSaving(true)

    try {
      const { error } = await supabase
        .from('surgeon_cost_items')
        .delete()
        .eq('id', item.id)

      if (error) throw error

      await surgeonCostItemAudit.deleted(
        supabase,
        `Dr. ${item.surgeon?.last_name}`,
        item.procedure_type?.name || '',
        item.cost_category?.name || '',
        item.id,
        effectiveFacilityId
      )

      setSurgeonCostItems(surgeonCostItems.filter(i => i.id !== item.id))
      setDeleteConfirm(null)
    } catch (error) {
      console.error('Error deleting:', error)
    } finally {
      setSaving(false)
    }
  }

  // Get procedure default for a category
  const getProcedureDefault = (procedureId: string, categoryId: string) => {
    const item = procedureCostItems.find(
      pci => pci.procedure_type_id === procedureId && pci.cost_category_id === categoryId
    )
    return item?.amount
  }

  // Get categories available for variance (either on procedure or new)
  const getAvailableCategories = () => {
    if (!formProcedureId) return categories

    const procedureCategories = procedureCostItems
      .filter(pci => pci.procedure_type_id === formProcedureId)
      .map(pci => pci.cost_category_id)

    // Show categories that are either on the procedure OR not yet used by this surgeon for this procedure
    const existingForSurgeonProcedure = surgeonCostItems
      .filter(sci => sci.surgeon_id === formSurgeonId && sci.procedure_type_id === formProcedureId)
      .map(sci => sci.cost_category_id)

    return categories.filter(c => 
      !existingForSurgeonProcedure.includes(c.id) || (editingItem && editingItem.cost_category_id === c.id)
    )
  }

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
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Surgeon Variance</h1>
              <p className="text-sm text-slate-600 mt-1">
                Override or add cost items for specific surgeons
              </p>
            </div>
            <button
              onClick={handleNew}
              disabled={surgeons.length === 0 || procedures.length === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Variance
            </button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-700">Surgeon:</label>
              <select
                value={filterSurgeon}
                onChange={(e) => setFilterSurgeon(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Surgeons</option>
                {surgeons.map(surgeon => (
                  <option key={surgeon.id} value={surgeon.id}>
                    Dr. {surgeon.last_name}, {surgeon.first_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-700">Procedure:</label>
              <select
                value={filterProcedure}
                onChange={(e) => setFilterProcedure(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Procedures</option>
                {procedures.map(procedure => (
                  <option key={procedure.id} value={procedure.id}>
                    {procedure.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : groupedData.length === 0 ? (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center">
              <svg className="w-12 h-12 text-slate-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <h3 className="text-lg font-medium text-slate-900 mb-2">No Surgeon Variances</h3>
              <p className="text-slate-600 mb-4">
                {surgeons.length === 0 
                  ? 'Add surgeons to your facility first.'
                  : 'Add variance overrides when surgeons have different costs than the procedure defaults.'}
              </p>
              {surgeons.length > 0 && procedures.length > 0 && (
                <button
                  onClick={handleNew}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Variance
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {groupedData.map((surgeonGroup) => (
                <div key={surgeonGroup.surgeon.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  {/* Surgeon Header */}
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                    <h3 className="font-semibold text-slate-900">
                      Dr. {surgeonGroup.surgeon.last_name}, {surgeonGroup.surgeon.first_name}
                    </h3>
                  </div>

                  {/* Procedures */}
                  <div className="divide-y divide-slate-200">
                    {surgeonGroup.procedures.map((procGroup) => (
                      <div key={procGroup.procedure.id} className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium text-slate-700">{procGroup.procedure.name}</h4>
                        </div>

                        {/* Cost Items */}
                        <div className="space-y-2">
                          {procGroup.items.map((item) => {
                            const defaultAmount = getProcedureDefault(item.procedure_type_id, item.cost_category_id)
                            const isOverride = defaultAmount !== undefined
                            const diff = defaultAmount !== undefined ? item.amount - defaultAmount : null

                            return (
                              <div
                                key={item.id}
                                className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg"
                              >
                                <div className="flex items-center gap-3">
                                  <div className={`w-2 h-2 rounded-full ${
                                    item.cost_category?.type === 'credit' ? 'bg-green-500' : 'bg-red-500'
                                  }`} />
                                  <div>
                                    <span className="text-sm font-medium text-slate-900">
                                      {item.cost_category?.name}
                                    </span>
                                    {isOverride && (
                                      <span className="text-xs text-slate-500 ml-2">
                                        (vs ${defaultAmount?.toLocaleString()} default)
                                      </span>
                                    )}
                                    {!isOverride && (
                                      <span className="text-xs text-blue-600 ml-2">(added)</span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-4">
                                  <div className="text-right">
                                    <span className="font-medium text-slate-900">
                                      ${item.amount.toLocaleString()}
                                    </span>
                                    {diff !== null && diff !== 0 && (
                                      <span className={`text-xs ml-2 ${
                                        diff > 0 ? 'text-red-600' : 'text-green-600'
                                      }`}>
                                        {diff > 0 ? '↑' : '↓'}${Math.abs(diff).toLocaleString()}
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => handleEdit(item)}
                                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                      title="Edit"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                      </svg>
                                    </button>
                                    {deleteConfirm === item.id ? (
                                      <div className="flex items-center gap-1">
                                        <button
                                          onClick={() => handleDelete(item)}
                                          disabled={saving}
                                          className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 disabled:opacity-50"
                                        >
                                          Delete
                                        </button>
                                        <button
                                          onClick={() => setDeleteConfirm(null)}
                                          className="px-2 py-1 bg-slate-200 text-slate-700 text-xs rounded hover:bg-slate-300"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={() => setDeleteConfirm(item.id)}
                                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                        title="Delete"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>

                        {/* Notes if any */}
                        {procGroup.items.some(i => i.notes) && (
                          <div className="mt-2 text-xs text-slate-500">
                            {procGroup.items.filter(i => i.notes).map(i => (
                              <p key={i.id}>📝 {i.cost_category?.name}: {i.notes}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Info Box */}
          <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex gap-3">
              <svg className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-slate-600">
                <p className="font-medium text-slate-700 mb-1">How Variance Works</p>
                <ul className="list-disc list-inside space-y-1">
                  <li><strong>Override:</strong> If a category exists on the procedure, surgeon's value replaces it</li>
                  <li><strong>Addition:</strong> If a category doesn't exist on the procedure, it's added for this surgeon only</li>
                </ul>
              </div>
            </div>
          </div>
        </FinancialsLayout>
      </Container>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
              {editingItem ? 'Edit Surgeon Variance' : 'Add Surgeon Variance'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Surgeon <span className="text-red-500">*</span>
                </label>
                <select
                  value={formSurgeonId}
                  onChange={(e) => setFormSurgeonId(e.target.value)}
                  disabled={!!editingItem}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100"
                >
                  <option value="">Select surgeon...</option>
                  {surgeons.map(surgeon => (
                    <option key={surgeon.id} value={surgeon.id}>
                      Dr. {surgeon.last_name}, {surgeon.first_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Procedure <span className="text-red-500">*</span>
                </label>
                <select
                  value={formProcedureId}
                  onChange={(e) => setFormProcedureId(e.target.value)}
                  disabled={!!editingItem}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100"
                >
                  <option value="">Select procedure...</option>
                  {procedures.map(procedure => (
                    <option key={procedure.id} value={procedure.id}>
                      {procedure.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Cost Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={formCategoryId}
                  onChange={(e) => setFormCategoryId(e.target.value)}
                  disabled={!!editingItem}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100"
                >
                  <option value="">Select category...</option>
                  {getAvailableCategories().map(category => {
                    const defaultAmount = formProcedureId 
                      ? getProcedureDefault(formProcedureId, category.id)
                      : undefined
                    return (
                      <option key={category.id} value={category.id}>
                        {category.name} ({category.type})
                        {defaultAmount !== undefined ? ` - Default: $${defaultAmount}` : ' - New'}
                      </option>
                    )
                  })}
                </select>
                {formCategoryId && formProcedureId && (
                  <p className="text-xs text-slate-500 mt-1">
                    {getProcedureDefault(formProcedureId, formCategoryId) !== undefined
                      ? '⚠️ This will override the procedure default'
                      : '➕ This will be added for this surgeon only'}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Amount <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                  <input
                    type="number"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="e.g., Uses Zimmer Persona system"
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formSurgeonId || !formProcedureId || !formCategoryId || !formAmount}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Saving...' : editingItem ? 'Save Changes' : 'Add Variance'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}