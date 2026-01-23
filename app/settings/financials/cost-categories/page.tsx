// app/settings/financials/cost-categories/page.tsx
// Facility-level cost categories (debit/credit items)

'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../../../lib/supabase'
import { useUser } from '../../../../lib/UserContext'
import DashboardLayout from '../../../../components/layouts/DashboardLayout'
import Container from '../../../../components/ui/Container'
import SettingsLayout from '../../../../components/settings/SettingsLayout'
import { genericAuditLog } from '../../../../lib/audit-logger'

interface CostCategory {
  id: string
  facility_id: string
  name: string
  type: 'debit' | 'credit'
  description?: string
  display_order: number
  is_active: boolean
}

export default function CostCategoriesPage() {
  const supabase = createClient()
  const { effectiveFacilityId, loading: userLoading, isGlobalAdmin } = useUser()

  const [categories, setCategories] = useState<CostCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add')
  const [selectedCategory, setSelectedCategory] = useState<CostCategory | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    type: 'debit' as 'debit' | 'credit',
    description: '',
  })

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  useEffect(() => {
    if (!userLoading && effectiveFacilityId) {
      fetchCategories()
    } else if (!userLoading && !effectiveFacilityId) {
      setLoading(false)
    }
  }, [userLoading, effectiveFacilityId])

  const fetchCategories = async () => {
    if (!effectiveFacilityId) return
    setLoading(true)

    const { data, error } = await supabase
      .from('cost_categories')
      .select('*')
      .eq('facility_id', effectiveFacilityId)
      .order('type')
      .order('display_order')

    if (data) setCategories(data)
    if (error) console.error('Error fetching categories:', error)
    setLoading(false)
  }

  const copyFromDefaults = async () => {
    if (!effectiveFacilityId) return
    setSaving(true)

    try {
      // Call the function to copy defaults
      const { error } = await supabase.rpc('copy_default_cost_categories_to_facility', {
        p_facility_id: effectiveFacilityId
      })

      if (error) throw error

      await fetchCategories()
      
      await genericAuditLog(supabase, 'cost_category.copied_defaults', {
        targetType: 'facility',
        targetId: effectiveFacilityId,
        targetLabel: 'Cost Categories',
        facilityId: effectiveFacilityId,
      })
    } catch (error) {
      console.error('Error copying defaults:', error)
    } finally {
      setSaving(false)
    }
  }

  const openAddModal = (type: 'debit' | 'credit') => {
    setModalMode('add')
    setFormData({ name: '', type, description: '' })
    setSelectedCategory(null)
    setModalOpen(true)
  }

  const openEditModal = (category: CostCategory) => {
    setModalMode('edit')
    setFormData({
      name: category.name,
      type: category.type,
      description: category.description || '',
    })
    setSelectedCategory(category)
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setFormData({ name: '', type: 'debit', description: '' })
    setSelectedCategory(null)
  }

  const handleSave = async () => {
    if (!formData.name.trim() || !effectiveFacilityId) return
    setSaving(true)

    try {
      if (modalMode === 'add') {
        // Get max display order for this type
        const sameTypeCategories = categories.filter(c => c.type === formData.type)
        const maxOrder = sameTypeCategories.length > 0 
          ? Math.max(...sameTypeCategories.map(c => c.display_order))
          : 0

        const { data, error } = await supabase
          .from('cost_categories')
          .insert({
            facility_id: effectiveFacilityId,
            name: formData.name.trim(),
            type: formData.type,
            description: formData.description.trim() || null,
            display_order: maxOrder + 1,
            is_active: true,
          })
          .select()
          .single()

        if (error) throw error

        setCategories([...categories, data].sort((a, b) => {
          if (a.type !== b.type) return a.type === 'debit' ? -1 : 1
          return a.display_order - b.display_order
        }))

        await genericAuditLog(supabase, 'cost_category.created', {
          targetType: 'cost_category',
          targetId: data.id,
          targetLabel: formData.name.trim(),
          newValues: { name: formData.name.trim(), type: formData.type },
          facilityId: effectiveFacilityId,
        })
      } else if (selectedCategory) {
        const { error } = await supabase
          .from('cost_categories')
          .update({
            name: formData.name.trim(),
            description: formData.description.trim() || null,
          })
          .eq('id', selectedCategory.id)

        if (error) throw error

        setCategories(categories.map(c =>
          c.id === selectedCategory.id
            ? { ...c, name: formData.name.trim(), description: formData.description.trim() || undefined }
            : c
        ))

        await genericAuditLog(supabase, 'cost_category.updated', {
          targetType: 'cost_category',
          targetId: selectedCategory.id,
          targetLabel: formData.name.trim(),
          oldValues: { name: selectedCategory.name },
          newValues: { name: formData.name.trim() },
          facilityId: effectiveFacilityId,
        })
      }

      closeModal()
    } catch (error) {
      console.error('Error saving category:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (category: CostCategory) => {
    if (!effectiveFacilityId) return
    setSaving(true)

    try {
      const { error } = await supabase
        .from('cost_categories')
        .update({ is_active: !category.is_active })
        .eq('id', category.id)

      if (error) throw error

      setCategories(categories.map(c =>
        c.id === category.id ? { ...c, is_active: !category.is_active } : c
      ))

      await genericAuditLog(supabase, category.is_active ? 'cost_category.deactivated' : 'cost_category.activated', {
        targetType: 'cost_category',
        targetId: category.id,
        targetLabel: category.name,
        facilityId: effectiveFacilityId,
      })
    } catch (error) {
      console.error('Error toggling category:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId)
    if (!category || !effectiveFacilityId) return
    setSaving(true)

    try {
      const { error } = await supabase
        .from('cost_categories')
        .delete()
        .eq('id', categoryId)

      if (error) throw error

      setCategories(categories.filter(c => c.id !== categoryId))

      await genericAuditLog(supabase, 'cost_category.deleted', {
        targetType: 'cost_category',
        targetId: categoryId,
        targetLabel: category.name,
        facilityId: effectiveFacilityId,
      })

      setDeleteConfirm(null)
    } catch (error) {
      console.error('Error deleting category:', error)
    } finally {
      setSaving(false)
    }
  }

  const debitCategories = categories.filter(c => c.type === 'debit')
  const creditCategories = categories.filter(c => c.type === 'credit')

  if (userLoading) {
    return (
      <DashboardLayout>
        <Container>
          <SettingsLayout title="Cost Categories" description="Manage debit and credit categories for financial tracking">
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
          <SettingsLayout title="Cost Categories" description="Manage debit and credit categories for financial tracking">
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
        <SettingsLayout title="Cost Categories" description="Manage debit and credit categories for financial tracking">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : categories.length === 0 ? (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center">
              <svg className="w-12 h-12 text-slate-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <h3 className="text-lg font-medium text-slate-900 mb-2">No Cost Categories</h3>
              <p className="text-slate-600 mb-6">
                Cost categories help track expenses (debits) and offsets (credits) per procedure.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={copyFromDefaults}
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Copying...' : 'Copy Default Categories'}
                </button>
                <button
                  onClick={() => openAddModal('debit')}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Create Custom
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Debits Column */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <h3 className="font-semibold text-slate-900">Debits (Costs)</h3>
                    <span className="text-sm text-slate-500">({debitCategories.length})</span>
                  </div>
                  <button
                    onClick={() => openAddModal('debit')}
                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Add Debit Category"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200">
                  {debitCategories.length === 0 ? (
                    <div className="px-4 py-6 text-center text-slate-500 text-sm">
                      No debit categories
                    </div>
                  ) : (
                    debitCategories.map((cat) => (
                      <div key={cat.id} className={`px-4 py-3 flex items-center justify-between ${!cat.is_active ? 'opacity-50' : ''}`}>
                        <div>
                          <span className="font-medium text-slate-900">{cat.name}</span>
                          {cat.description && (
                            <p className="text-xs text-slate-500 mt-0.5">{cat.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleToggleActive(cat)}
                            className={`p-2 rounded-lg transition-colors ${
                              cat.is_active 
                                ? 'text-emerald-600 hover:bg-emerald-50' 
                                : 'text-slate-400 hover:bg-slate-100'
                            }`}
                            title={cat.is_active ? 'Deactivate' : 'Activate'}
                          >
                            <svg className="w-4 h-4" fill={cat.is_active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => openEditModal(cat)}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          {deleteConfirm === cat.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleDelete(cat.id)}
                                disabled={saving}
                                className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 disabled:opacity-50"
                              >
                                Yes
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(null)}
                                className="px-2 py-1 bg-slate-200 text-slate-700 text-xs rounded hover:bg-slate-300"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirm(cat.id)}
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Credits Column */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                    <h3 className="font-semibold text-slate-900">Credits (Offsets)</h3>
                    <span className="text-sm text-slate-500">({creditCategories.length})</span>
                  </div>
                  <button
                    onClick={() => openAddModal('credit')}
                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Add Credit Category"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200">
                  {creditCategories.length === 0 ? (
                    <div className="px-4 py-6 text-center text-slate-500 text-sm">
                      No credit categories
                    </div>
                  ) : (
                    creditCategories.map((cat) => (
                      <div key={cat.id} className={`px-4 py-3 flex items-center justify-between ${!cat.is_active ? 'opacity-50' : ''}`}>
                        <div>
                          <span className="font-medium text-slate-900">{cat.name}</span>
                          {cat.description && (
                            <p className="text-xs text-slate-500 mt-0.5">{cat.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleToggleActive(cat)}
                            className={`p-2 rounded-lg transition-colors ${
                              cat.is_active 
                                ? 'text-emerald-600 hover:bg-emerald-50' 
                                : 'text-slate-400 hover:bg-slate-100'
                            }`}
                            title={cat.is_active ? 'Deactivate' : 'Activate'}
                          >
                            <svg className="w-4 h-4" fill={cat.is_active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => openEditModal(cat)}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          {deleteConfirm === cat.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleDelete(cat.id)}
                                disabled={saving}
                                className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 disabled:opacity-50"
                              >
                                Yes
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(null)}
                                className="px-2 py-1 bg-slate-200 text-slate-700 text-xs rounded hover:bg-slate-300"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirm(cat.id)}
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Info Box */}
          {categories.length > 0 && (
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <div className="flex gap-3">
                <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">How cost categories work</p>
                  <p>
                    <strong>Debits</strong> are costs that reduce profit (e.g., Soft Goods, Implants). 
                    <strong> Credits</strong> are offsets that increase profit (e.g., Device Rep Rebates). 
                    Assign these to procedures in <a href="/settings/financials/procedure-pricing" className="underline hover:no-underline">Procedure Pricing</a>.
                  </p>
                </div>
              </div>
            </div>
          )}
        </SettingsLayout>
      </Container>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">
                {modalMode === 'add' ? `Add ${formData.type === 'debit' ? 'Debit' : 'Credit'} Category` : 'Edit Category'}
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  placeholder="e.g., Soft Goods, Implants"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Description
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  placeholder="Optional description"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formData.name.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : modalMode === 'add' ? 'Add Category' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}