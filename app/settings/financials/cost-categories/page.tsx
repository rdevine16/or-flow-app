// app/settings/financials/cost-categories/page.tsx
// Facility-level cost categories (debit/credit items)
// With soft delete - items can be restored within 30 days

'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import SettingsLayout from '@/components/settings/SettingsLayout'
import { genericAuditLog } from '@/lib/audit-logger'
import { useToast } from '@/components/ui/Toast/ToastProvider'

interface CostCategory {
  id: string
  facility_id: string
  name: string
  type: 'debit' | 'credit'
  description?: string
  display_order: number
  is_active: boolean
  deleted_at?: string | null
  deleted_by?: string | null
}

interface DeleteModalState {
  isOpen: boolean
  category: CostCategory | null
  dependencies: {
    procedureCostItems: number
    surgeonCostItems: number
  }
  loading: boolean
}

export default function CostCategoriesPage() {
  const supabase = createClient()
  const { effectiveFacilityId, loading: userLoading, isGlobalAdmin } = useUser()
  const { showToast } = useToast() 
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

  // Delete confirmation modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [categoryToDelete, setCategoryToDelete] = useState<CostCategory | null>(null)

  // Show/hide recently deleted section
  const [showDeleted, setShowDeleted] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [deleteModalState, setDeleteModalState] = useState<DeleteModalState>({
    isOpen: false,
    category: null,
    dependencies: { procedureCostItems: 0, surgeonCostItems: 0 },
    loading: false
  })

  // Get current user ID on mount
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUserId(user?.id || null)
    }
    getCurrentUser()
  }, [])

 
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

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  
  const { data, error } = await supabase
    .from('cost_categories')
      .select('*')
      .eq('facility_id', effectiveFacilityId)
      .or(`deleted_at.is.null,deleted_at.gte.${thirtyDaysAgo.toISOString()}`)
      .order('type')
      .order('display_order')

    if (data) setCategories(data)
if (error) {
  showToast({
    type: 'error',
    title: 'Error Loading Categories',
    message: error instanceof Error ? error.message : 'Failed to load cost categories'
  })
}
    setLoading(false)
  }

  const copyFromDefaults = async () => {
    if (!effectiveFacilityId) return
    setSaving(true)

    try {
      const { error } = await supabase.rpc('copy_cost_category_templates_to_facility', {
        p_facility_id: effectiveFacilityId
      })

      if (error) throw error

      await fetchCategories()
      showToast({
  type: 'success',
  title: 'Defaults Copied',
  message: 'Default categories have been copied successfully'
})
      await genericAuditLog(supabase, 'cost_category.copied_defaults', {
        targetType: 'facility',
        targetId: effectiveFacilityId,
        targetLabel: 'Cost Categories',
        facilityId: effectiveFacilityId,
      })
} catch (error) {
  showToast({
    type: 'error',
    title: 'Error Copying Defaults',
    message: error instanceof Error ? error.message : 'Failed to copy default categories'
  })

    } 
    finally {
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
        const sameTypeCategories = categories.filter(c => c.type === formData.type && !c.deleted_at)
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
      showToast({
  type: 'error',
  title: 'Error saving category:',
  message: error instanceof Error ? error.message : 'Error saving category:'
})
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

  // Open delete confirmation modal
const openDeleteModal = async (category: CostCategory) => {
    setDeleteModalState({
      isOpen: true,
      category,
      dependencies: { procedureCostItems: 0, surgeonCostItems: 0 },
      loading: true
    })

    // Check dependencies
    const [procResult, surgResult] = await Promise.all([
      supabase
        .from('procedure_cost_items')
        .select('id', { count: 'exact', head: true })
        .eq('cost_category_id', category.id),
      supabase
        .from('surgeon_cost_items')
        .select('id', { count: 'exact', head: true })
        .eq('cost_category_id', category.id)
    ])

    setDeleteModalState(prev => ({
      ...prev,
      dependencies: {
        procedureCostItems: procResult.count || 0,
        surgeonCostItems: surgResult.count || 0
      },
      loading: false
    }))
  }

  const closeDeleteModal = () => {
    setDeleteModalState({
      isOpen: false,
      category: null,
      dependencies: { procedureCostItems: 0, surgeonCostItems: 0 },
      loading: false
    })
  }

  // Soft delete - sets deleted_at timestamp
 const handleDelete = async () => {
    if (!deleteModalState.category || !effectiveFacilityId || !currentUserId) return
    setSaving(true)

    const category = deleteModalState.category

    try {
      const { error } = await supabase
        .from('cost_categories')
        .update({ 
          deleted_at: new Date().toISOString(),
          deleted_by: currentUserId
        })
        .eq('id', category.id)

      if (error) throw error

      setCategories(categories.map(c =>
        c.id === category.id 
          ? { ...c, deleted_at: new Date().toISOString(), deleted_by: currentUserId } 
          : c
      ))

      showToast({
        type: 'success',
        title: 'Category Archived',
        message: `"${category.name}" has been moved to archive`
      })

      await genericAuditLog(supabase, 'cost_category.deleted', {
        targetType: 'cost_category',
        targetId: category.id,
        targetLabel: category.name,
        facilityId: effectiveFacilityId,
      })

      closeDeleteModal()
    } catch (error) {
      console.error('Error archiving category:', error)
      showToast({
        type: 'error',
        title: 'Failed to Archive Category',
        message: error instanceof Error ? error.message : 'Failed to archive category'
      })
    } finally {
      setSaving(false)
    }
  }

  // Restore a soft-deleted category
const handleRestore = async (category: CostCategory) => {
    if (!effectiveFacilityId) return
    setSaving(true)

    try {
      const { error } = await supabase
        .from('cost_categories')
        .update({ deleted_at: null, deleted_by: null })
        .eq('id', category.id)

      if (error) throw error

      setCategories(categories.map(c =>
        c.id === category.id ? { ...c, deleted_at: null, deleted_by: null } : c
      ))

showToast({
  type: 'success',
  title: 'Category Restored',
  message: `"${category.name}" has been restored successfully`
})
      await genericAuditLog(supabase, 'cost_category.restored', {
        targetType: 'cost_category',
        targetId: category.id,
        targetLabel: category.name,
        facilityId: effectiveFacilityId,
      })
    } catch (error) {
      console.error('Error restoring category:', error)
      showToast({
        type: 'error',
        title: 'Failed to Restore Category',
        message: error instanceof Error ? error.message : 'Failed to restore category'
      })
    } finally {
      setSaving(false)
    }
  }

  // Helper to calculate days until permanent deletion
  const getDaysRemaining = (deletedAt: string): number => {
    const deleted = new Date(deletedAt)
    const expiresAt = new Date(deleted)
    expiresAt.setDate(expiresAt.getDate() + 30)
    const now = new Date()
    const diffTime = expiresAt.getTime() - now.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  // Filter active vs deleted categories
  const activeCategories = categories.filter(c => !c.deleted_at)
  const deletedCategories = categories.filter(c => c.deleted_at)
  const debitCategories = activeCategories.filter(c => c.type === 'debit')
  const creditCategories = activeCategories.filter(c => c.type === 'credit')

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
          ) : activeCategories.length === 0 && deletedCategories.length === 0 ? (
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
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Create from Scratch
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
                          <button
                            onClick={() => openDeleteModal(cat)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
</svg>
                          </button>
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
                          <button
                            onClick={() => openDeleteModal(cat)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
</svg>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Recently Deleted Section */}
          {deletedCategories.length > 0 && (
            <div className="mt-8">
              <button
                onClick={() => setShowDeleted(!showDeleted)}
                className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors mb-4"
              >
                <svg 
                  className={`w-4 h-4 transition-transform ${showDeleted ? 'rotate-90' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                Recently Deleted ({deletedCategories.length})
              </button>

              {showDeleted && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 bg-slate-100 border-b border-slate-200">
                    <p className="text-sm text-slate-600">
                      These items can be restored within 30 days of deletion. After that, they will be permanently removed from view.
                    </p>
                  </div>
                  <div className="divide-y divide-slate-200">
                    {deletedCategories.map((cat) => {
                      const daysLeft = getDaysRemaining(cat.deleted_at!)
                      return (
                        <div key={cat.id} className="px-4 py-3 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-2.5 h-2.5 rounded-full ${cat.type === 'debit' ? 'bg-red-300' : 'bg-emerald-300'}`} />
                            <div>
                              <span className="font-medium text-slate-600">{cat.name}</span>
                              <p className="text-xs text-slate-400">
                                {daysLeft > 0 
                                  ? `${daysLeft} day${daysLeft !== 1 ? 's' : ''} until removed`
                                  : 'Expires today'
                                }
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleRestore(cat)}
                            disabled={saving}
                            className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                          >
                            Restore
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Info Box with Cross-Links */}
<div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
  <div className="flex gap-3">
    <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
    <div className="text-sm text-blue-800">
      <p className="font-medium mb-1">How cost categories work</p>
      <p className="mb-3">
        <strong>Debits</strong> are costs that reduce profit (e.g., Soft Goods, Implants). 
        <strong> Credits</strong> are offsets that increase profit (e.g., Device Rep Rebates).
      </p>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-blue-700">
        <span className="font-medium text-blue-800">Used in:</span>
        <a href="/settings/financials/procedure-pricing" className="underline hover:no-underline inline-flex items-center gap-1">
          Procedure Pricing
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

{/* Archive Confirmation Modal */}
      {deleteModalState.isOpen && deleteModalState.category && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Archive Cost Category</h3>
            </div>
            <div className="p-6">
              {deleteModalState.loading ? (
                <div className="flex items-center justify-center py-8">
                  <svg className="animate-spin h-6 w-6 text-blue-500" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
              ) : (
                <>
                  <p className="text-slate-600 mb-4">
                    Are you sure you want to archive <span className="font-semibold text-slate-900">"{deleteModalState.category.name}"</span>?
                  </p>
                  {(deleteModalState.dependencies.procedureCostItems > 0 || deleteModalState.dependencies.surgeonCostItems > 0) && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg mb-4">
                      <div className="flex gap-3">
                        <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <div>
                          <p className="font-medium text-amber-800">This category is in use:</p>
                          <ul className="mt-1 text-sm text-amber-700 list-disc list-inside">
                            {deleteModalState.dependencies.procedureCostItems > 0 && (
                              <li>{deleteModalState.dependencies.procedureCostItems} procedure cost item{deleteModalState.dependencies.procedureCostItems !== 1 ? 's' : ''}</li>
                            )}
                            {deleteModalState.dependencies.surgeonCostItems > 0 && (
                              <li>{deleteModalState.dependencies.surgeonCostItems} surgeon variance item{deleteModalState.dependencies.surgeonCostItems !== 1 ? 's' : ''}</li>
                            )}
                          </ul>
                          <p className="mt-2 text-sm text-amber-700">
                            Archiving will hide it from new procedures but existing data will be preserved.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  <p className="text-sm text-slate-500">You can restore archived categories within 30 days.</p>
                </>
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button onClick={closeDeleteModal} className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={saving || deleteModalState.loading}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'Archiving...' : 'Archive Category'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}