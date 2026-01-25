// app/admin/complexities/page.tsx
// Global Admin: Manage complexity TEMPLATES (facility_id = NULL)

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../lib/supabase'
import { useUser } from '../../../lib/UserContext'
import DashboardLayout from '../../../components/layouts/DashboardLayout'
import Container from '../../../components/ui/Container'

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

export default function ComplexitiesAdminPage() {
  const router = useRouter()
  const supabase = createClient()
  const { isGlobalAdmin, loading: userLoading } = useUser()

  const [complexities, setComplexities] = useState<Complexity[]>([])
  const [procedureCategories, setProcedureCategories] = useState<ProcedureCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingComplexity, setEditingComplexity] = useState<Complexity | null>(null)
  const [formDisplayName, setFormDisplayName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formIsActive, setFormIsActive] = useState(true)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

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
      console.error('Error:', error)
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
      console.error('Error:', error)
      alert('Error saving')
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
      setDeleteConfirm(null)
    } catch (error) {
      console.error('Error:', error)
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
      console.error('Error:', error)
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
      console.error('Error:', error)
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
              <svg className="animate-spin h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
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
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
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
                                <svg className={`w-4 h-4 ${complexity.is_active ? 'text-orange-600' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
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
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              {deleteConfirm === complexity.id ? (
                                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                  <button onClick={() => handleDelete(complexity.id)} className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700">
                                    Confirm
                                  </button>
                                  <button onClick={() => setDeleteConfirm(null)} className="px-2 py-1 bg-slate-200 text-slate-700 text-xs rounded hover:bg-slate-300">
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={(e) => { e.stopPropagation(); setDeleteConfirm(complexity.id) }}
                                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Delete"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              )}
                              <svg className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
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
              <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
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
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">{editingComplexity ? 'Edit' : 'Add'} Template</h3>
            </div>
            <div className="p-6 space-y-4">
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
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formDisplayName.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}