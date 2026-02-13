// app/admin/settings/cost-categories/page.tsx
// Manage default cost category templates that get copied to new facilities

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import { costCategoryAudit } from '@/lib/audit-logger'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { useSupabaseQuery, useCurrentUser } from '@/hooks/useSupabaseQuery'
import { Modal } from '@/components/ui/Modal'
import { ArchiveConfirm } from '@/components/ui/ConfirmDialog'
import { PageLoader } from '@/components/ui/Loading'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Archive, Info, PenLine, Plus } from 'lucide-react'

interface DefaultCostCategory {
  id: string
  name: string
  type: 'credit' | 'debit'
  description: string | null
  display_order: number
  is_active: boolean
  deleted_at: string | null
  deleted_by: string | null
  created_at: string
}

interface DeleteModalState {
  isOpen: boolean
  category: DefaultCostCategory | null
  loading: boolean
}

export default function DefaultCostCategoriesPage() {
  const router = useRouter()
  const supabase = createClient()
  const { isGlobalAdmin, loading: userLoading } = useUser()
  const { showToast } = useToast()
  const { data: currentUserData } = useCurrentUser()
  const currentUserId = currentUserData?.userId || null

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

  // Delete modal
  const [deleteModal, setDeleteModal] = useState<DeleteModalState>({
    isOpen: false,
    category: null,
    loading: false
  })

  // Archive view toggle
  const [showArchived, setShowArchived] = useState(false)

  // Redirect non-admins
  useEffect(() => {
    if (!userLoading && !isGlobalAdmin) {
      router.push('/dashboard')
    }
  }, [userLoading, isGlobalAdmin, router])

  const { data: queryData, loading, error, refetch: refetchData } = useSupabaseQuery<{
    categories: DefaultCostCategory[]
    archivedCount: number
  }>(
    async (sb) => {
      let query = sb.from('cost_category_templates').select('*')

      if (showArchived) {
        query = query.not('deleted_at', 'is', null)
      } else {
        query = query.is('deleted_at', null)
      }

      query = query.order('type').order('display_order')
      const { data, error } = await query
      if (error) throw error

      const { count } = await sb
        .from('cost_category_templates')
        .select('id', { count: 'exact', head: true })
        .not('deleted_at', 'is', null)

      return { categories: data || [], archivedCount: count || 0 }
    },
    { deps: [showArchived], enabled: isGlobalAdmin }
  )

  const categories = queryData?.categories || []
  const archivedCount = queryData?.archivedCount || 0

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

        refetchData()
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

        refetchData()
      }

      setShowModal(false)
    } catch (error) {
      showToast({ type: 'error', title: error instanceof Error ? error.message : 'Error saving category' })
    } finally {
      setSaving(false)
    }
  }

 const openDeleteModal = (category: DefaultCostCategory) => {
    setDeleteModal({
      isOpen: true,
      category,
      loading: false
    })
  }

  const closeDeleteModal = () => {
    setDeleteModal({
      isOpen: false,
      category: null,
      loading: false
    })
  }

const handleDelete = async () => {
  if (!deleteModal.category || !currentUserId) return
  setSaving(true)

  const category = deleteModal.category

  try {
    const { error: templateError } = await supabase
      .from('cost_category_templates')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: currentUserId
      })
      .eq('id', category.id)

    if (templateError) throw templateError

    const { error: categoryError } = await supabase
      .from('cost_categories')
      .update({ 
        deleted_at: new Date().toISOString(),
        deleted_by: currentUserId 
      })
      .eq('id', category.id)

    if (categoryError) throw categoryError

    await costCategoryAudit.adminDeleted(supabase, category.name, category.id)

    refetchData()
    
    showToast({ type: 'success', title: `"${category.name}" moved to archive` })
    
    closeDeleteModal()
  } catch (error) {
    showToast({ type: 'error', title: error instanceof Error ? error.message : 'Error archiving category' })
  } finally {
    setSaving(false)
  }
}

const handleRestore = async (category: DefaultCostCategory) => {
  setSaving(true)

  try {
    const { error } = await supabase
      .from('cost_category_templates')
      .update({
        deleted_at: null,
        deleted_by: null
      })
      .eq('id', category.id)

    if (error) throw error

    refetchData()
    
    showToast({ type: 'success', title: `"${category.name}" restored successfully` })
  } catch (error) {
    showToast({ type: 'error', title: error instanceof Error ? error.message : 'Failed to restore category' })
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

      refetchData()
    } catch (error) {
      showToast({ type: 'error', title: error instanceof Error ? error.message : 'Error toggling active state' })
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
          <ErrorBanner message={error} />
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
           <div className="flex items-center gap-3">
              {/* Archive Toggle */}
              <button
                onClick={() => setShowArchived(!showArchived)}
                className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
                  showArchived
                    ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Archive className="w-4 h-4" />
                {showArchived ? 'View Active' : `Archive (${archivedCount})`}
              </button>

              {/* Add Category - hide when viewing archived */}
              {!showArchived && (
                <button
                  onClick={handleNew}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Add Category
                </button>
              )}
            </div>
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
                                    <PenLine className="w-4 h-4" />
                                  </button>
                                  {showArchived ? (
                                    <button
                                      onClick={() => handleRestore(category)}
                                      disabled={saving}
                                      className="px-3 py-1.5 text-sm font-medium text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                                    >
                                      Restore
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => openDeleteModal(category)}
                                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                      title="Archive"
                                    >
                                      <Archive className="w-4 h-4" />
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
                                    <PenLine className="w-4 h-4" />
                                  </button>
                                 {showArchived ? (
                                    <button
                                      onClick={() => handleRestore(category)}
                                      disabled={saving}
                                      className="px-3 py-1.5 text-sm font-medium text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                                    >
                                      Restore
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => openDeleteModal(category)}
                                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                      title="Archive"
                                    >
                                      <Archive className="w-4 h-4" />
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
              <Info className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
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
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editingCategory ? 'Edit Cost Category' : 'Add Cost Category'}
      >
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Category Name <span className="text-red-600">*</span>
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
                  Type <span className="text-red-600">*</span>
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

        <Modal.Footer>
          <Modal.Cancel onClick={() => setShowModal(false)} />
          <Modal.Action
            onClick={handleSave}
            loading={saving}
            disabled={!formName.trim()}
          >
            {editingCategory ? 'Save Changes' : 'Add Category'}
          </Modal.Action>
        </Modal.Footer>
      </Modal>

      {/* Archive Confirmation Modal */}
      <ArchiveConfirm
        open={deleteModal.isOpen && !!deleteModal.category}
        onClose={closeDeleteModal}
        onConfirm={handleDelete}
        itemName={deleteModal.category?.name || ''}
        itemType="cost category template"
        loading={saving}
      />
    </DashboardLayout>
  )
}