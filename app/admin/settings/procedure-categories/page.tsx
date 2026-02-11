// app/admin/settings/procedure-categories/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import { procedureCategoryAudit } from '@/lib/audit-logger'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { PageLoader } from '@/components/ui/Loading'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Archive, Check, Info, Package, Pencil, Plus, X } from 'lucide-react'

interface BodyRegion {
  id: string
  name: string
  display_name: string
}

interface ProcedureCategory {
  id: string
  name: string
  display_name: string
  display_order: number
  body_region_id: string | null
  is_active: boolean
  deleted_at: string | null
  deleted_by: string | null
  body_regions?: BodyRegion | BodyRegion[] | null
}

// Helper to safely get body region from Supabase join (can return array or object)
function getBodyRegion(category: ProcedureCategory): BodyRegion | null {
  if (!category.body_regions) return null
  if (Array.isArray(category.body_regions)) {
    return category.body_regions[0] || null
  }
  return category.body_regions
}

export default function AdminProcedureCategoriesPage() {
  const supabase = createClient()
  const [categories, setCategories] = useState<ProcedureCategory[]>([])
  const [bodyRegions, setBodyRegions] = useState<BodyRegion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<ProcedureCategory | null>(null)

  // Form states
  const [formName, setFormName] = useState('')
  const [formDisplayName, setFormDisplayName] = useState('')
  const [formBodyRegionId, setFormBodyRegionId] = useState<string>('')

  // Confirmation modal
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean
    title: string
    message: React.ReactNode
    confirmLabel: string
    confirmVariant: 'danger' | 'primary'
    onConfirm: () => void
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmLabel: '',
    confirmVariant: 'danger',
    onConfirm: () => {},
  })
// Archive toggle
  const [showArchived, setShowArchived] = useState(false)
  const [archivedCount, setArchivedCount] = useState(0)

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Current user for deleted_by tracking
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }
useEffect(() => {
    fetchData()
  }, [showArchived])

const fetchData = async () => {
    setLoading(true)

    // Get current user ID
    const { data: { user } } = await supabase.auth.getUser()
    if (user) setCurrentUserId(user.id)

    // Fetch categories with body region
    let query = supabase
      .from('procedure_categories')
      .select(`
        id,
        name,
        display_name,
        display_order,
        body_region_id,
        is_active,
        deleted_at,
        deleted_by,
        body_regions (id, name, display_name)
      `)

    if (showArchived) {
      query = query.not('deleted_at', 'is', null)
    } else {
      query = query.is('deleted_at', null)
    }

    const { data: categoriesData } = await query.order('display_order')

    // Fetch body regions for dropdown (only active ones)
    const { data: regionsData } = await supabase
      .from('body_regions')
      .select('id, name, display_name')
      .is('deleted_at', null)
      .order('display_name')

    setCategories((categoriesData || []) as ProcedureCategory[])
    setBodyRegions(regionsData || [])

    // Get archived count
    const { count } = await supabase
      .from('procedure_categories')
      .select('id', { count: 'exact', head: true })
      .not('deleted_at', 'is', null)

    setArchivedCount(count || 0)
    setLoading(false)
  }

  const closeConfirmModal = () => {
    setConfirmModal(prev => ({ ...prev, isOpen: false }))
  }

  // Generate internal name from display name
  const generateName = (displayName: string): string => {
    return displayName
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50)
  }

  const resetForm = () => {
    setFormName('')
    setFormDisplayName('')
    setFormBodyRegionId('')
  }

  const handleAdd = async () => {
    if (!formDisplayName.trim()) return

    setSaving(true)
    const name = formName.trim() || generateName(formDisplayName)
    const maxOrder = categories.length > 0
      ? Math.max(...categories.map(c => c.display_order))
      : 0

    const { data, error } = await supabase
      .from('procedure_categories')
      .insert({
        name,
        display_name: formDisplayName.trim(),
        display_order: maxOrder + 1,
        body_region_id: formBodyRegionId || null,
        is_active: true,
      })
      .select(`
        id,
        name,
        display_name,
        display_order,
        body_region_id,
        is_active,
        body_regions (id, name, display_name)
      `)
      .single()

    if (!error && data) {
      const regionName = bodyRegions.find(r => r.id === formBodyRegionId)?.display_name
      await procedureCategoryAudit.created(supabase, formDisplayName.trim(), data.id, regionName)

      setCategories([...categories, data as ProcedureCategory])
      resetForm()
      setShowAddModal(false)
    }
    setSaving(false)
  }

  const handleEdit = async () => {
    if (!editingCategory || !formDisplayName.trim()) return

    setSaving(true)
    const oldDisplayName = editingCategory.display_name
    const oldBodyRegion = getBodyRegion(editingCategory)

    const { data, error } = await supabase
      .from('procedure_categories')
      .update({
        display_name: formDisplayName.trim(),
        body_region_id: formBodyRegionId || null,
      })
      .eq('id', editingCategory.id)
      .select(`
        id,
        name,
        display_name,
        display_order,
        body_region_id,
        is_active,
        body_regions (id, name, display_name)
      `)
      .single()

    if (!error && data) {
      const newRegionName = bodyRegions.find(r => r.id === formBodyRegionId)?.display_name
await procedureCategoryAudit.updated(
  supabase,
  editingCategory.id,
  oldDisplayName,
  { 
    display_name: oldDisplayName,
    body_region: oldBodyRegion?.display_name || null
  },
  {
    display_name: formDisplayName.trim(),
    body_region: bodyRegions.find(r => r.id === formBodyRegionId)?.display_name || null
  }
)

      setCategories(categories.map(c => c.id === data.id ? data as ProcedureCategory : c))
      setShowEditModal(false)
      setEditingCategory(null)
      resetForm()
    }
    setSaving(false)
  }

 const handleDelete = (category: ProcedureCategory) => {
    setConfirmModal({
      isOpen: true,
      title: 'Archive Category',
      message: (
        <p>
          Are you sure you want to archive <strong>"{category.display_name}"</strong>?
          <br /><br />
          <span className="text-slate-500">This category will be hidden but can be restored later.</span>
        </p>
      ),
      confirmLabel: 'Archive',
      confirmVariant: 'danger',
      onConfirm: async () => {
        setSaving(true)
        const { error } = await supabase
          .from('procedure_categories')
          .update({
            deleted_at: new Date().toISOString(),
            deleted_by: currentUserId
          })
          .eq('id', category.id)

        if (!error) {
          await procedureCategoryAudit.deleted(supabase, category.display_name, category.id)
          setCategories(categories.filter(c => c.id !== category.id))
          setArchivedCount(prev => prev + 1)
          showToast(`"${category.display_name}" moved to archive`, 'success')
        } else {
          showToast('Failed to archive category', 'error')
        }
        setSaving(false)
        closeConfirmModal()
      },
    })
  }

  const handleRestore = async (category: ProcedureCategory) => {
    setSaving(true)
    const { error } = await supabase
      .from('procedure_categories')
      .update({
        deleted_at: null,
        deleted_by: null
      })
      .eq('id', category.id)

    if (!error) {
      setCategories(categories.filter(c => c.id !== category.id))
      setArchivedCount(prev => prev - 1)
      showToast(`"${category.display_name}" restored successfully`, 'success')
    } else {
      showToast('Failed to restore category', 'error')
    }
    setSaving(false)
  }

  const openEditModal = (category: ProcedureCategory) => {
    setEditingCategory(category)
    setFormName(category.name)
    setFormDisplayName(category.display_name)
    setFormBodyRegionId(category.body_region_id || '')
    setShowEditModal(true)
  }

  const openAddModal = () => {
    resetForm()
    setShowAddModal(true)
  }

  // Group categories by body region for display
  const categoriesByRegion = categories.reduce((acc, cat) => {
    const bodyRegion = getBodyRegion(cat)
    const regionName = bodyRegion?.display_name || 'Uncategorized'
    if (!acc[regionName]) {
      acc[regionName] = []
    }
    acc[regionName].push(cat)
    return acc
  }, {} as Record<string, ProcedureCategory[]>)

  // Sort region names with Uncategorized last
  const sortedRegionNames = Object.keys(categoriesByRegion).sort((a, b) => {
    if (a === 'Uncategorized') return 1
    if (b === 'Uncategorized') return -1
    return a.localeCompare(b)
  })

  return (
    <DashboardLayout>
      <Container className="py-8">
          <ErrorBanner message={error} onDismiss={() => setError(null)} />
        <div className="max-w-4xl mx-auto">
          {/* Header */}
 <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">
                {showArchived ? 'Archived Procedure Categories' : 'Procedure Categories'}
              </h1>
              <p className="text-slate-500 mt-1">
                {showArchived 
                  ? 'Archived clinical groupings'
                  : 'Clinical groupings for analytics comparisons across procedure types.'
                }
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
                  onClick={openAddModal}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Category
                </button>
              )}
            </div>
          </div>

          {/* Stats Bar */}
          <div className="flex items-center gap-4 mb-4">
            <span className="text-sm text-slate-500">
              {categories.length} categor{categories.length !== 1 ? 'ies' : 'y'} across {sortedRegionNames.length} region{sortedRegionNames.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Content */}
          {loading ? (
            <div className="bg-white border border-slate-200 rounded-xl">
              <div className="flex items-center justify-center py-16">
                <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            </div>
          ) : categories.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl text-center py-16">
              <Package className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p className="text-slate-500 mb-2">No categories defined</p>
              <button
                onClick={openAddModal}
                className="mt-2 text-blue-600 hover:text-blue-700 font-medium text-sm"
              >
                Add your first category
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedRegionNames.map(regionName => (
                <div key={regionName} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  {/* Region Header */}
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                    <h3 className="text-sm font-semibold text-slate-700">{regionName}</h3>
                  </div>

                  {/* Categories Table */}
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Display Name
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Internal Name
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider w-24">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {categoriesByRegion[regionName].map(category => (
                        <tr key={category.id} className="group hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3">
                            <span className="text-sm font-medium text-slate-900">
                              {category.display_name}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <code className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
                              {category.name}
                            </code>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {showArchived ? (
                              <button
                                onClick={() => handleRestore(category)}
                                disabled={saving}
                                className="px-3 py-1.5 text-sm font-medium text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50"
                              >
                                Restore
                              </button>
                            ) : (
                              <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => openEditModal(category)}
                                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="Edit"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDelete(category)}
                                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Archive"
                                >
                                  <Archive className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}

          {/* Info Box */}
          <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex gap-3">
              <Info className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-slate-600">
                <p className="font-medium text-slate-700 mb-1">How categories work</p>
                <p>
                  Categories group procedure types for analytics comparisons. For example, both "TKA" and "Mako TKA" 
                  can be assigned to the "Total Knee Arthroplasty" category, allowing you to compare all total knee 
                  cases regardless of technique.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Container>

      {/* Add Modal */}
      <Modal
        open={showAddModal}
        onClose={() => { setShowAddModal(false); resetForm() }}
        title="Add Category"
      >
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Display Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formDisplayName}
                  onChange={(e) => setFormDisplayName(e.target.value)}
                  placeholder="e.g., Total Knee Arthroplasty"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Internal Name <span className="text-slate-400 font-normal">(auto-generated if blank)</span>
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder={formDisplayName ? generateName(formDisplayName) : 'e.g., total_knee'}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Body Region <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <select
                  value={formBodyRegionId}
                  onChange={(e) => setFormBodyRegionId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select a body region...</option>
                  {bodyRegions.map(region => (
                    <option key={region.id} value={region.id}>{region.display_name}</option>
                  ))}
                </select>
              </div>

        <Modal.Footer>
          <Modal.Cancel onClick={() => { setShowAddModal(false); resetForm() }} />
          <Modal.Action onClick={handleAdd} loading={saving} disabled={!formDisplayName.trim()}>
            Add Category
          </Modal.Action>
        </Modal.Footer>
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={showEditModal && !!editingCategory}
        onClose={() => { setShowEditModal(false); setEditingCategory(null); resetForm() }}
        title="Edit Category"
      >
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Internal Name <span className="text-slate-400 font-normal">(read-only)</span>
                </label>
                <input
                  type="text"
                  value={editingCategory?.name ?? ''}
                  disabled
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-500 font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Display Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formDisplayName}
                  onChange={(e) => setFormDisplayName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Body Region
                </label>
                <select
                  value={formBodyRegionId}
                  onChange={(e) => setFormBodyRegionId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">No body region</option>
                  {bodyRegions.map(region => (
                    <option key={region.id} value={region.id}>{region.display_name}</option>
                  ))}
                </select>
              </div>

        <Modal.Footer>
          <Modal.Cancel onClick={() => { setShowEditModal(false); setEditingCategory(null); resetForm() }} />
          <Modal.Action onClick={handleEdit} loading={saving} disabled={!formDisplayName.trim()}>
            Save Changes
          </Modal.Action>
        </Modal.Footer>
      </Modal>
{/* Toast */}
      {toast && (
        <div className={`fixed bottom-4 right-4 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50 ${
          toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {toast.type === 'success' ? (
            <Check className="w-5 h-5" />
          ) : (
            <X className="w-5 h-5" />
          )}
          {toast.message}
        </div>
      )}
      {/* Confirmation Modal */}
      <ConfirmDialog
        open={confirmModal.isOpen}
        onClose={closeConfirmModal}
        onConfirm={confirmModal.onConfirm}
        variant={confirmModal.confirmVariant === 'primary' ? 'info' : 'danger'}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmLabel}
        loading={saving}
      />
    </DashboardLayout>
  )
}