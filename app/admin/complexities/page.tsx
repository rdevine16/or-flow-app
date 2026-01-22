// app/admin/settings/complexities/page.tsx
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

  // Expanded row
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Modal
  const [showModal, setShowModal] = useState(false)
  const [editingComplexity, setEditingComplexity] = useState<Complexity | null>(null)

  // Form
  const [formDisplayName, setFormDisplayName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formIsActive, setFormIsActive] = useState(true)

  // Delete
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // Filters
  const [filterActive, setFilterActive] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

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
          .from('complexities')
          .select('*')
          .is('facility_id', null)  // Only templates
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
          .from('complexities')
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
          .from('complexities')
          .insert({
            facility_id: null,  // Template
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
      const { error } = await supabase.from('complexities').delete().eq('id', id)
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
        .from('complexities')
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

  const filteredComplexities = complexities.filter(c => {
    const matchesActive = filterActive === 'all' ||
      (filterActive === 'active' && c.is_active) ||
      (filterActive === 'inactive' && !c.is_active)
    const matchesSearch = !searchQuery ||
      c.display_name.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesActive && matchesSearch
  })

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
              <h1 className="text-2xl font-bold text-slate-900">Case Complexities</h1>
              <p className="text-slate-500 mt-1">Templates copied to new facilities</p>
            </div>
            <button
              onClick={handleNew}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Complexity
            </button>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1 max-w-xs">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
            <select
              value={filterActive}
              onChange={(e) => setFilterActive(e.target.value)}
              className="px-4 py-2 border border-slate-200 rounded-lg"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            ) : filteredComplexities.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-500">No complexities found</p>
                <button onClick={handleNew} className="mt-4 text-blue-600 hover:text-blue-700 font-medium">
                  Add your first complexity
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {filteredComplexities.map((complexity) => {
                  const linkedCategories = procedureCategories.filter(c => 
                    complexity.procedure_category_ids?.includes(c.id)
                  )
                  const isExpanded = expandedId === complexity.id

                  return (
                    <div key={complexity.id}>
                      {/* Row */}
                      <div
                        onClick={() => setExpandedId(isExpanded ? null : complexity.id)}
                        className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-slate-50 cursor-pointer"
                      >
                        <div className="col-span-3 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                            <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                          </div>
                          <span className="font-medium text-slate-900">{complexity.display_name}</span>
                        </div>

                        <div className="col-span-3">
                          <span className="text-sm text-slate-500">{complexity.description || '—'}</span>
                        </div>

                        <div className="col-span-3">
                          {linkedCategories.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {linkedCategories.map(cat => (
                                <span key={cat.id} className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                                  {cat.display_name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">All procedures</span>
                          )}
                        </div>

                        <div className="col-span-1">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            complexity.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {complexity.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>

                        <div className="col-span-2 flex items-center justify-end gap-1">
                          <button
                            onClick={(e) => handleEdit(complexity, e)}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          {deleteConfirm === complexity.id ? (
                            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                              <button onClick={() => handleDelete(complexity.id)} className="px-2 py-1 bg-red-600 text-white text-xs rounded">
                                Confirm
                              </button>
                              <button onClick={() => setDeleteConfirm(null)} className="px-2 py-1 bg-slate-200 text-xs rounded">
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); setDeleteConfirm(complexity.id) }}
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
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

                      {/* Expanded */}
                      {isExpanded && (
                        <div className="px-6 pb-4 bg-slate-50 border-t border-slate-100">
                          <div className="pt-4 pl-11">
                            <p className="text-sm font-medium text-slate-700 mb-3">
                              Applies to procedure categories (empty = all):
                            </p>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                              {procedureCategories.map((category) => {
                                const isLinked = complexity.procedure_category_ids?.includes(category.id)
                                return (
                                  <label
                                    key={category.id}
                                    className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer ${
                                      isLinked ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200 hover:bg-slate-50'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isLinked}
                                      onChange={() => toggleCategory(complexity.id, category.id)}
                                      disabled={saving}
                                      className="w-4 h-4 text-blue-600 rounded"
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
            )}
          </div>

          {/* Info */}
          <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex gap-3">
              <svg className="w-5 h-5 text-slate-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-slate-600">
                <p className="font-medium text-slate-700 mb-1">Template System</p>
                <p>These are copied to new facilities. Changes here don't affect existing facilities.</p>
              </div>
            </div>
          </div>
        </div>
      </Container>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
              {editingComplexity ? 'Edit Complexity' : 'Add Complexity'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Display Name *</label>
                <input
                  type="text"
                  value={formDisplayName}
                  onChange={(e) => setFormDisplayName(e.target.value)}
                  placeholder="e.g., Valgus Deformity"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600"
                />
                <span className="text-sm text-slate-700">Active</span>
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formDisplayName.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingComplexity ? 'Save' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}