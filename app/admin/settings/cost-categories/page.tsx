// app/admin/settings/cost-categories/page.tsx
// Manage default cost category templates that get copied to new facilities

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../../lib/supabase'
import { useUser } from '../../../../lib/UserContext'
import DashboardLayout from '../../../../components/layouts/DashboardLayout'
import Container from '../../../../components/ui/Container'
import { costCategoryAudit } from '../../../../lib/audit-logger'

interface DefaultCostCategory {
  id: string
  name: string
  type: 'credit' | 'debit'
  description: string | null
  display_order: number
  is_active: boolean
  created_at: string
}

export default function DefaultCostCategoriesPage() {
  const router = useRouter()
  const supabase = createClient()
  const { isGlobalAdmin, loading: userLoading } = useUser()

  const [categories, setCategories] = useState<DefaultCostCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<DefaultCostCategory | null>(null)

  // Form state
  const [formName, setFormName] = useState('')
  const [formType, setFormType] = useState<'credit' | 'debit'>('debit')
  const [formDescription, setFormDescription] = useState('')
  const [formIsActive, setFormIsActive] = useState(true)

  // Filter state
  const [filterType, setFilterType] = useState<string>('all')
  const [filterActive, setFilterActive] = useState<string>('all')

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // Redirect non-admins
  useEffect(() => {
    if (!userLoading && !isGlobalAdmin) {
      router.push('/dashboard')
    }
  }, [userLoading, isGlobalAdmin, router])

  // Fetch data
  useEffect(() => {
    if (!isGlobalAdmin) return
    fetchData()
  }, [isGlobalAdmin])

  const fetchData = async () => {
    setLoading(true)

    try {
      const { data, error } = await supabase
        .from('cost_category_templates')
        .select('*')
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
    setFormIsActive(true)
    setShowModal(true)
  }

  const handleEdit = (category: DefaultCostCategory) => {
    setEditingCategory(category)
    setFormName(category.name)
    setFormType(category.type)
    setFormDescription(category.description || '')
    setFormIsActive(category.is_active)
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!formName.trim()) return

    setSaving(true)

    try {
      const data = {
        name: formName.trim(),
        type: formType,
        description: formDescription.trim() || null,
        is_active: formIsActive,
      }

      if (editingCategory) {
        // Update
        const { error } = await supabase
          .from('cost_category_templates')
          .update(data)
          .eq('id', editingCategory.id)

        if (error) throw error

        await costCategoryAudit.adminUpdated(
          supabase,
          editingCategory.id,
          { name: editingCategory.name, type: editingCategory.type, description: editingCategory.description || undefined },
          { name: data.name, type: data.type, description: data.description || undefined }
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
          .from('cost_category_templates')
          .insert({ ...data, display_order: maxOrder + 1 })
          .select()
          .single()

        if (error) throw error

        await costCategoryAudit.adminCreated(
          supabase,
          data.name,
          newCategory.id,
          data.type
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

  const handleDelete = async (category: DefaultCostCategory) => {
    setSaving(true)

    try {
      const { error } = await supabase
        .from('cost_category_templates')
        .delete()
        .eq('id', category.id)

      if (error) throw error

      await costCategoryAudit.adminDeleted(supabase, category.name, category.id)

      setCategories(categories.filter(c => c.id !== category.id))
      setDeleteConfirm(null)
    } catch (error) {
      console.error('Error deleting category:', error)
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (category: DefaultCostCategory) => {
    setSaving(true)

    try {
      const newActiveState = !category.is_active
      
      const { error } = await supabase
        .from('cost_category_templates')
        .update({ is_active: newActiveState })
        .eq('id', category.id)

      if (error) throw error

      await costCategoryAudit.adminUpdated(
        supabase,
        category.id,
        { name: category.name },
        { name: category.name, is_active: newActiveState }
      )

      setCategories(categories.map(c => 
        c.id === category.id ? { ...c, is_active: newActiveState } : c
      ))
    } catch (error) {
      console.error('Error toggling active state:', error)
    } finally {
      setSaving(false)
    }
  }

  // Filter categories
  const filteredCategories = categories.filter(category => {
    if (filterType !== 'all' && category.type !== filterType) return false
    if (filterActive === 'active' && !category.is_active) return false
    if (filterActive === 'inactive' && category.is_active) return false
    return true
  })

  const debitCategories = filteredCategories.filter(c => c.type === 'debit')
  const creditCategories = filteredCategories.filter(c => c.type === 'credit')

  if (userLoading || !isGlobalAdmin) {
    return (
      <DashboardLayout>
        <Container>
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        </Container>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <Container>
        <div className="py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Default Cost Categories</h1>
              <p className="text-slate-600 mt-1">
                Template categories copied to new facilities during onboarding
              </p>
            </div>
            <button
              onClick={handleNew}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Category
            </button>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-700">Type:</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Types</option>
                <option value="debit">Debits (Costs)</option>
                <option value="credit">Credits (Revenue)</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-700">Status:</label>
              <select
                value={filterActive}
                onChange={(e) => setFilterActive(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : (
            <div className="space-y-8">
              {/* Debits Section */}
              {(filterType === 'all' || filterType === 'debit') && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <h2 className="text-lg font-semibold text-slate-900">Debits (Costs)</h2>
                    <span className="text-sm text-slate-500">({debitCategories.length})</span>
                  </div>
                  
                  {debitCategories.length === 0 ? (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center text-slate-500">
                      No debit categories found
                    </div>
                  ) : (
                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="text-left px-4 py-3 text-sm font-medium text-slate-700">Name</th>
                            <th className="text-left px-4 py-3 text-sm font-medium text-slate-700">Description</th>
                            <th className="text-center px-4 py-3 text-sm font-medium text-slate-700">Status</th>
                            <th className="text-right px-4 py-3 text-sm font-medium text-slate-700">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {debitCategories.map((category) => (
                            <tr key={category.id} className={!category.is_active ? 'bg-slate-50 opacity-60' : ''}>
                              <td className="px-4 py-3">
                                <span className="font-medium text-slate-900">{category.name}</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-sm text-slate-600">{category.description || '—'}</span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <button
                                  onClick={() => toggleActive(category)}
                                  disabled={saving}
                                  className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${
                                    category.is_active
                                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                  }`}
                                >
                                  {category.is_active ? 'Active' : 'Inactive'}
                                </button>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center justify-end gap-1">
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
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Credits Section */}
              {(filterType === 'all' || filterType === 'credit') && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <h2 className="text-lg font-semibold text-slate-900">Credits (Revenue)</h2>
                    <span className="text-sm text-slate-500">({creditCategories.length})</span>
                  </div>
                  
                  {creditCategories.length === 0 ? (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center text-slate-500">
                      No credit categories found
                    </div>
                  ) : (
                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="text-left px-4 py-3 text-sm font-medium text-slate-700">Name</th>
                            <th className="text-left px-4 py-3 text-sm font-medium text-slate-700">Description</th>
                            <th className="text-center px-4 py-3 text-sm font-medium text-slate-700">Status</th>
                            <th className="text-right px-4 py-3 text-sm font-medium text-slate-700">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {creditCategories.map((category) => (
                            <tr key={category.id} className={!category.is_active ? 'bg-slate-50 opacity-60' : ''}>
                              <td className="px-4 py-3">
                                <span className="font-medium text-slate-900">{category.name}</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-sm text-slate-600">{category.description || '—'}</span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <button
                                  onClick={() => toggleActive(category)}
                                  disabled={saving}
                                  className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${
                                    category.is_active
                                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                  }`}
                                >
                                  {category.is_active ? 'Active' : 'Inactive'}
                                </button>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center justify-end gap-1">
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
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Info Box */}
          <div className="mt-8 p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex gap-3">
              <svg className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-slate-600">
                <p className="font-medium text-slate-700 mb-1">Template System</p>
                <p>
                  These cost categories are copied to new facilities during onboarding. Inactive categories 
                  won't be copied. Existing facilities are not affected by changes here.
                </p>
              </div>
            </div>
          </div>
        </div>
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
              
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-700">Active (included when copying to new facilities)</span>
              </label>
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