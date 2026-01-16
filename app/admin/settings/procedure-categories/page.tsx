'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../../../lib/supabase'
import DashboardLayout from '../../../../components/layouts/DashboardLayout'
import Container from '../../../../components/ui/Container'
import { procedureCategoryAudit } from '../../../../lib/audit-logger'

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

// Confirmation Modal Component
function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel,
  confirmVariant = 'danger',
  onConfirm,
  onCancel,
  isLoading,
}: {
  isOpen: boolean
  title: string
  message: React.ReactNode
  confirmLabel: string
  confirmVariant?: 'danger' | 'primary'
  onConfirm: () => void
  onCancel: () => void
  isLoading?: boolean
}) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl">
        <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
        <div className="text-sm text-slate-600 mb-6">{message}</div>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 rounded-lg transition-colors disabled:opacity-50 ${
              confirmVariant === 'danger'
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isLoading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminProcedureCategoriesPage() {
  const supabase = createClient()
  const [categories, setCategories] = useState<ProcedureCategory[]>([])
  const [bodyRegions, setBodyRegions] = useState<BodyRegion[]>([])
  const [loading, setLoading] = useState(true)
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

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)

    // Fetch categories with body region
    const { data: categoriesData } = await supabase
      .from('procedure_categories')
      .select(`
        id,
        name,
        display_name,
        display_order,
        body_region_id,
        is_active,
        body_regions (id, name, display_name)
      `)
      .order('display_order')

    // Fetch body regions for dropdown
    const { data: regionsData } = await supabase
      .from('body_regions')
      .select('id, name, display_name')
      .order('display_name')

    setCategories((categoriesData || []) as ProcedureCategory[])
    setBodyRegions(regionsData || [])
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
      title: 'Delete Category',
      message: (
        <p>
          Are you sure you want to delete <strong>"{category.display_name}"</strong>?
          This action cannot be undone.
        </p>
      ),
      confirmLabel: 'Delete',
      confirmVariant: 'danger',
      onConfirm: async () => {
        setSaving(true)
        const { error } = await supabase
          .from('procedure_categories')
          .delete()
          .eq('id', category.id)

        if (!error) {
          await procedureCategoryAudit.deleted(supabase, category.display_name, category.id)
          setCategories(categories.filter(c => c.id !== category.id))
        }
        setSaving(false)
        closeConfirmModal()
      },
    })
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
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Procedure Categories</h1>
              <p className="text-slate-500 mt-1">
                Clinical groupings for analytics comparisons across procedure types.
              </p>
            </div>
            <button
              onClick={openAddModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Category
            </button>
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
              <svg className="w-12 h-12 mx-auto mb-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
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
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => openEditModal(category)}
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Edit"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleDelete(category)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
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
              <svg className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
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
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Add Category</h3>

            <div className="space-y-4">
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
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowAddModal(false)
                  resetForm()
                }}
                className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={!formDisplayName.trim() || saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Adding...' : 'Add Category'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingCategory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Edit Category</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Internal Name <span className="text-slate-400 font-normal">(read-only)</span>
                </label>
                <input
                  type="text"
                  value={editingCategory.name}
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
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowEditModal(false)
                  setEditingCategory(null)
                  resetForm()
                }}
                className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEdit}
                disabled={!formDisplayName.trim() || saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmLabel={confirmModal.confirmLabel}
        confirmVariant={confirmModal.confirmVariant}
        onConfirm={confirmModal.onConfirm}
        onCancel={closeConfirmModal}
        isLoading={saving}
      />
    </DashboardLayout>
  )
}
