// app/admin/complexities/page.tsx
// Global Admin: Manage complexity TEMPLATES (facility_id = NULL)

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { Modal } from '@/components/ui/Modal'
import { DeleteConfirm } from '@/components/ui/ConfirmDialog'
import { PageLoader } from '@/components/ui/Loading'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { AlertTriangle, ChevronDown, Info, Loader2, PenLine, Plus, Trash2 } from 'lucide-react'


interface Complexity {
  id: string
  facility_id: string | null
  name: string
  display_name: string
  description: string | null
  procedure_category_ids: string[]
  is_active: boolean
  display_order: number
}

interface ProcedureCategory {
  id: string
  name: string
  display_name: string
}
const { showToast } = useToast()

export default function ComplexitiesAdminPage() {
  const router = useRouter()
  const supabase = createClient()
  const { isGlobalAdmin, loading: userLoading } = useUser()

  const [complexities, setComplexities] = useState<Complexity[]>([])
  const [procedureCategories, setProcedureCategories] = useState<ProcedureCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingComplexity, setEditingComplexity] = useState<Complexity | null>(null)
  const [formDisplayName, setFormDisplayName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formIsActive, setFormIsActive] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<Complexity | null>(null)

  useEffect(() => {
    if (!userLoading && !isGlobalAdmin) {
      router.push('/dashboard')
    }
  }, [userLoading, isGlobalAdmin, router])

  useEffect(() => {
    if (isGlobalAdmin) fetchData()
  }, [isGlobalAdmin])

  const fetchData = async () => {
    setLoading(true)
    try {
const [complexitiesRes, categoriesRes] = await Promise.all([
  supabase
    .from('complexity_templates')
    .select('*')
    .order('display_order'), 
        supabase
          .from('procedure_categories')
          .select('id, name, display_name')
          .order('display_name')
      ])

      if (complexitiesRes.data) setComplexities(complexitiesRes.data)
      if (categoriesRes.data) setProcedureCategories(categoriesRes.data)
} catch (error) {
  const message = error instanceof Error 
    ? error.message 
    : 'An error occurred'
  showToast({
    type: 'error',
    title: 'Error',
    message: `Error fetching complexities: ${message}`
  })
    } finally {
      setLoading(false)
    }
  }

  const handleNew = () => {
    setEditingComplexity(null)
    setFormDisplayName('')
    setFormDescription('')
    setFormIsActive(true)
    setShowModal(true)
  }

  const handleEdit = (complexity: Complexity, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingComplexity(complexity)
    setFormDisplayName(complexity.display_name)
    setFormDescription(complexity.description || '')
    setFormIsActive(complexity.is_active)
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!formDisplayName.trim()) return
    setSaving(true)

    try {
      const name = formDisplayName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')

      if (editingComplexity) {
        const { error } = await supabase
          .from('complexity_templates')
          .update({
            display_name: formDisplayName.trim(),
            description: formDescription.trim() || null,
            is_active: formIsActive,
          })
          .eq('id', editingComplexity.id)

        if (error) throw error

        setComplexities(complexities.map(c =>
          c.id === editingComplexity.id
            ? { ...c, display_name: formDisplayName.trim(), description: formDescription.trim() || null, is_active: formIsActive }
            : c
        ))
      } else {
const { data, error } = await supabase
  .from('complexity_templates') 
  .insert({
    name,
    display_name: formDisplayName.trim(),
    description: formDescription.trim() || null,
    procedure_category_ids: [],
    is_active: formIsActive,
    display_order: complexities.length
  })
          .select()
          .single()

        if (error) throw error
        setComplexities([...complexities, data])
      }

      setShowModal(false)
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error)
  showToast({
    type: 'error',
    title: 'Error saving complexity',
    message: errorMessage  // ✅ Just the error message!
  })
} finally {
  setSaving(false)
}
  }

  const handleDelete = async (id: string) => {
    setSaving(true)
    try {
      const { error } = await supabase.from('complexity_templates').delete().eq('id', id)
      if (error) throw error
      setComplexities(complexities.filter(c => c.id !== id))
      setDeleteTarget(null)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      showToast({
  type: 'error',
  title: 'Error:',
  message: `Error: ${errorMessage}`
})
      alert('Error deleting')
    } finally {
      setSaving(false)
    }
  }

  const toggleCategory = async (complexityId: string, categoryId: string) => {
    const complexity = complexities.find(c => c.id === complexityId)
    if (!complexity) return

    setSaving(true)
    try {
      const currentIds = complexity.procedure_category_ids || []
      const newIds = currentIds.includes(categoryId)
        ? currentIds.filter(id => id !== categoryId)
        : [...currentIds, categoryId]

      const { error } = await supabase
        .from('complexity_templates')
        .update({ procedure_category_ids: newIds })
        .eq('id', complexityId)

      if (error) throw error

      setComplexities(complexities.map(c =>
        c.id === complexityId ? { ...c, procedure_category_ids: newIds } : c
      ))
    } catch (error) {
      showToast({
  type: 'error',
  title: 'Error:',
  message: error instanceof Error ? error.message : 'Error:'
})
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (complexity: Complexity, e: React.MouseEvent) => {
    e.stopPropagation()
    setSaving(true)
    try {
      const { error } = await supabase
        .from('complexity_templates')
        .update({ is_active: !complexity.is_active })
        .eq('id', complexity.id)

      if (error) throw error
      setComplexities(complexities.map(c =>
        c.id === complexity.id ? { ...c, is_active: !c.is_active } : c
      ))
    } catch (error) {
      showToast({
  type: 'error',
  title: 'Error:',
  message: error instanceof Error ? error.message : 'Error:'
})
    } finally {
      setSaving(false)
    }
  }

  const getCategoryNames = (complexity: Complexity) => {
    return procedureCategories.filter(c => complexity.procedure_category_ids?.includes(c.id))
  }

  if (userLoading || !isGlobalAdmin) {
    return (
      <DashboardLayout>
        <Container>
          <ErrorBanner message={error} onDismiss={() => setError(null)} />
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
          {/* Page Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900">Case Complexity Templates</h1>
            <p className="text-slate-500 mt-1">Global templates copied to new facilities</p>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-slate-900">Templates</h3>
                  <p className="text-sm text-slate-500">{complexities.length} complexity templates</p>
                </div>
                <button
                  onClick={handleNew}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Template
                </button>
              </div>

              {/* Table */}
              {complexities.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <p className="text-slate-500">No complexity templates defined yet.</p>
                  <button onClick={handleNew} className="mt-2 text-blue-600 hover:underline text-sm">
                    Add your first template
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  {/* Table Header */}
                  <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <div className="col-span-3">Complexity Name</div>
                    <div className="col-span-3">Description</div>
                    <div className="col-span-3">Procedure Categories</div>
                    <div className="col-span-2">Active</div>
                    <div className="col-span-1 text-right">Actions</div>
                  </div>

                  {/* Table Body */}
                  <div className="divide-y divide-slate-100">
                    {complexities.map((complexity) => {
                      const linkedCategories = getCategoryNames(complexity)
                      const isExpanded = expandedId === complexity.id

                      return (
                        <div key={complexity.id}>
                          {/* Row */}
                          <div
                            onClick={() => setExpandedId(isExpanded ? null : complexity.id)}
                            className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-slate-50 cursor-pointer transition-colors"
                          >
                            {/* Complexity Name */}
                            <div className="col-span-3 flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${complexity.is_active ? 'bg-orange-100' : 'bg-slate-100'}`}>
                                <AlertTriangle className={`w-4 h-4 ${complexity.is_active ? 'text-orange-600' : 'text-slate-400'}`} />
                              </div>
                              <p className={`font-medium ${complexity.is_active ? 'text-slate-900' : 'text-slate-400'}`}>
                                {complexity.display_name}
                              </p>
                            </div>

                            {/* Description */}
                            <div className="col-span-3">
                              <span className="text-sm text-slate-600">{complexity.description || '—'}</span>
                            </div>

                            {/* Procedure Categories */}
                            <div className="col-span-3">
                              {linkedCategories.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {linkedCategories.slice(0, 2).map(cat => (
                                    <span key={cat.id} className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                                      {cat.display_name}
                                    </span>
                                  ))}
                                  {linkedCategories.length > 2 && (
                                    <span className="text-xs text-slate-400">+{linkedCategories.length - 2} more</span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-sm text-slate-400">All procedures</span>
                              )}
                            </div>

                            {/* Active Toggle */}
                            <div className="col-span-2">
                              <button
                                onClick={(e) => toggleActive(complexity, e)}
                                className={`relative w-11 h-6 rounded-full transition-colors ${complexity.is_active ? 'bg-blue-600' : 'bg-slate-200'}`}
                              >
                                <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${complexity.is_active ? 'translate-x-5' : ''}`} />
                              </button>
                            </div>

                            {/* Actions */}
                            <div className="col-span-1 flex items-center justify-end gap-1">
                              <button
                                onClick={(e) => handleEdit(complexity, e)}
                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Edit"
                              >
                                <PenLine className="w-4 h-4" />
                              </button>
                              <button
                                  onClick={(e) => { e.stopPropagation(); setDeleteTarget(complexity) }}
                                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            </div>
                          </div>

                          {/* Expanded Row - Category Assignment */}
                          {isExpanded && (
                            <div className="px-6 pb-4 bg-slate-50 border-t border-slate-100">
                              <div className="pt-4 pl-11">
                                <p className="text-sm font-medium text-slate-700 mb-3">
                                  Applies to procedure categories (empty = all procedures):
                                </p>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                                  {procedureCategories.map((category) => {
                                    const isLinked = complexity.procedure_category_ids?.includes(category.id)
                                    return (
                                      <label
                                        key={category.id}
                                        className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer ${isLinked ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isLinked}
                                          onChange={() => toggleCategory(complexity.id, category.id)}
                                          disabled={saving}
                                          className="w-4 h-4 text-blue-600 rounded disabled:opacity-50"
                                        />
                                        <span className={`text-sm ${isLinked ? 'text-blue-700 font-medium' : 'text-slate-600'}`}>
                                          {category.display_name}
                                        </span>
                                      </label>
                                    )
                                  })}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Info Box */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="flex gap-3">
              <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Template System</p>
                <p className="text-blue-700">
                  These templates are copied to new facilities when they're created. 
                  Changes here don't affect existing facilities — each facility manages their own copy.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Container>

      {/* Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={`${editingComplexity ? 'Edit' : 'Add'} Template`}
      >
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Display Name *</label>
                <input
                  type="text"
                  value={formDisplayName}
                  onChange={(e) => setFormDisplayName(e.target.value)}
                  placeholder="e.g., Valgus Deformity"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={2}
                  placeholder="Optional description..."
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600"
                />
                <span className="text-sm text-slate-700">Active (included when copying to new facilities)</span>
              </label>

        <Modal.Footer>
          <Modal.Cancel onClick={() => setShowModal(false)} />
          <Modal.Action
            onClick={handleSave}
            loading={saving}
            disabled={!formDisplayName.trim()}
          >
            Save
          </Modal.Action>
        </Modal.Footer>
      </Modal>
      <DeleteConfirm
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget) await handleDelete(deleteTarget.id)
        }}
        itemName={deleteTarget?.display_name || ''}
        itemType="complexity"
      />
    </DashboardLayout>
  )
}