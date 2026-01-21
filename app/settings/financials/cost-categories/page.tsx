// app/settings/financials/cost-categories/page.tsx
// Manage facility-specific cost categories

'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../../../lib/supabase'
import { useUser } from '../../../../lib/UserContext'
import DashboardLayout from '../../../../components/layouts/DashboardLayout'
import Container from '../../../../components/ui/Container'
import FinancialsLayout from '../../../../components/settings/FinancialsLayout'
import { costCategoryAudit } from '../../../../lib/audit-logger'

interface CostCategory {
  id: string
  facility_id: string
  name: string
  type: 'credit' | 'debit'
  description: string | null
  display_order: number
  is_active: boolean
  created_at: string
}

export default function CostCategoriesPage() {
  const supabase = createClient()
  const { effectiveFacilityId, loading: userLoading } = useUser()

  const [categories, setCategories] = useState<CostCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<CostCategory | null>(null)

  // Form state
  const [formName, setFormName] = useState('')
  const [formType, setFormType] = useState<'credit' | 'debit'>('debit')
  const [formDescription, setFormDescription] = useState('')

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // Fetch data when facility changes
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
      const { data, error } = await supabase
        .from('cost_categories')
        .select('*')
        .eq('facility_id', effectiveFacilityId)
        .eq('is_active', true)
        .order('type')
        .order('display_order')

      if (data) setCategories(data)
      if (error) console.error('Error fetching categories:', error)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleNew = () => {
    setEditingCategory(null)
    setFormName('')
    setFormType('debit')
    setFormDescription('')
    setShowModal(true)
  }

  const handleEdit = (category: CostCategory) => {
    setEditingCategory(category)
    setFormName(category.name)
    setFormType(category.type)
    setFormDescription(category.description || '')
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!formName.trim() || !effectiveFacilityId) return

    setSaving(true)

    try {
      const data = {
        name: formName.trim(),
        type: formType,
        description: formDescription.trim() || null,
        facility_id: effectiveFacilityId,
      }

      if (editingCategory) {
        // Update
        const { error } = await supabase
          .from('cost_categories')
          .update({
            name: data.name,
            type: data.type,
            description: data.description,
          })
          .eq('id', editingCategory.id)

        if (error) throw error

        await costCategoryAudit.updated(
          supabase,
          editingCategory.id,
          { name: editingCategory.name, type: editingCategory.type, description: editingCategory.description || undefined },
          { name: data.name, type: data.type, description: data.description || undefined },
          effectiveFacilityId
        )

        setCategories(categories.map(c => 
          c.id === editingCategory.id ? { ...c, ...data } : c
        ))
      } else {
        // Create
        const maxOrder = categories
          .filter(c => c.type === formType)
          .reduce((max, c) => Math.max(max, c.display_order), 0)

        const { data: newCategory, error } = await supabase
          .from('cost_categories')
          .insert({ ...data, display_order: maxOrder + 1, is_active: true })
          .select()
          .single()

        if (error) throw error

        await costCategoryAudit.created(
          supabase,
          data.name,
          newCategory.id,
          data.type,
          effectiveFacilityId
        )

        setCategories([...categories, newCategory].sort((a, b) => {
          if (a.type !== b.type) return a.type.localeCompare(b.type)
          return a.display_order - b.display_order
        }))
      }

      setShowModal(false)
    } catch (error) {
      console.error('Error saving category:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (category: CostCategory) => {
    if (!effectiveFacilityId) return
    setSaving(true)

    try {
      // Soft delete by setting is_active to false
      const { error } = await supabase
        .from('cost_categories')
        .update({ is_active: false })
        .eq('id', category.id)

      if (error) throw error

      await costCategoryAudit.deleted(supabase, category.name, category.id, effectiveFacilityId)

      setCategories(categories.filter(c => c.id !== category.id))
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
              <h1 className="text-xl font-semibold text-slate-900">Cost Categories</h1>
              <p className="text-sm text-slate-600 mt-1">
                Define cost and revenue categories for procedure pricing
              </p>
            </div>
            <button
              onClick={handleNew}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Category
            </button>
          </div>

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
              <p className="text-slate-600 mb-4">Get started by adding your first cost category.</p>
              <button
                onClick={handleNew}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Category
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Debits Section */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <h2 className="text-base font-semibold text-slate-900">Debits (Costs)</h2>
                  <span className="text-sm text-slate-500">({debitCategories.length})</span>
                </div>
                
                {debitCategories.length === 0 ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center text-slate-500 text-sm">
                    No debit categories. These represent costs subtracted from profit.
                  </div>
                ) : (
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <div className="divide-y divide-slate-200">
                      {debitCategories.map((category) => (
                        <div key={category.id} className="px-4 py-3 flex items-center justify-between hover:bg-slate-50">
                          <div>
                            <span className="font-medium text-slate-900">{category.name}</span>
                            {category.description && (
                              <p className="text-sm text-slate-500 mt-0.5">{category.description}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleEdit(category)}
                              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            {deleteConfirm === category.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleDelete(category)}
                                  disabled={saving}
                                  className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 disabled:opacity-50"
                                >
                                  Confirm
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
                                onClick={() => setDeleteConfirm(category.id)}
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
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Credits Section */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <h2 className="text-base font-semibold text-slate-900">Credits (Revenue)</h2>
                  <span className="text-sm text-slate-500">({creditCategories.length})</span>
                </div>
                
                {creditCategories.length === 0 ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center text-slate-500 text-sm">
                    No credit categories. These represent additional revenue added to profit.
                  </div>
                ) : (
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <div className="divide-y divide-slate-200">
                      {creditCategories.map((category) => (
                        <div key={category.id} className="px-4 py-3 flex items-center justify-between hover:bg-slate-50">
                          <div>
                            <span className="font-medium text-slate-900">{category.name}</span>
                            {category.description && (
                              <p className="text-sm text-slate-500 mt-0.5">{category.description}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleEdit(category)}
                              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            {deleteConfirm === category.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleDelete(category)}
                                  disabled={saving}
                                  className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 disabled:opacity-50"
                                >
                                  Confirm
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
                                onClick={() => setDeleteConfirm(category.id)}
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
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </FinancialsLayout>
      </Container>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
              {editingCategory ? 'Edit Cost Category' : 'Add Cost Category'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Category Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., Soft Goods"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  autoFocus
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Type <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="type"
                      value="debit"
                      checked={formType === 'debit'}
                      onChange={() => setFormType('debit')}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-700">Debit (Cost)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="type"
                      value="credit"
                      checked={formType === 'credit'}
                      onChange={() => setFormType('credit')}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-700">Credit (Revenue)</span>
                  </label>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Debits subtract from profit, credits add to it
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Brief description of what this category covers..."
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
                disabled={saving || !formName.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Saving...' : editingCategory ? 'Save Changes' : 'Add Category'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}