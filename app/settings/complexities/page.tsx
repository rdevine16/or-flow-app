// app/settings/complexities/page.tsx
// Facility Admin: Manage facility's complexities with proper table headers

'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import SettingsLayout from '@/components/settings/SettingsLayout'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { Modal } from '@/components/ui/Modal'
import { PageLoader } from '@/components/ui/Loading'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Button } from '@/components/ui/Button'
import { AlertTriangle, Archive, ChevronDown, Pencil, Plus } from 'lucide-react'

interface Complexity {
  id: string
  facility_id: string | null
  name: string
  display_name: string
  description: string | null
  procedure_category_ids: string[]
  is_active: boolean
  display_order: number
  deleted_at: string | null
}

interface ProcedureCategory {
  id: string
  name: string
  display_name: string
}

export default function FacilityComplexitiesPage() {
  const supabase = createClient()
  const { effectiveFacilityId, isFacilityAdmin, isGlobalAdmin, loading: userLoading } = useUser()
  const { showToast } = useToast()
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
  const [archiveConfirm, setArchiveConfirm] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [archivedComplexities, setArchivedComplexities] = useState<Complexity[]>([])
  const canEdit = isFacilityAdmin || isGlobalAdmin

  useEffect(() => {
    if (!userLoading && effectiveFacilityId) {
      fetchData()
    } else if (!userLoading) {
      setLoading(false)
    }
  }, [userLoading, effectiveFacilityId])

  const fetchData = async () => {
    if (!effectiveFacilityId) return
    setLoading(true)

    try {
      const [complexitiesRes, categoriesRes] = await Promise.all([
        supabase
          .from('complexities')
          .select('*')
          .eq('facility_id', effectiveFacilityId)
          .is('deleted_at', null)
          .order('display_order'),
        supabase
          .from('procedure_categories')
          .select('id, name, display_name')
          .order('display_name')
      ])

      if (complexitiesRes.data) setComplexities(complexitiesRes.data)
      if (categoriesRes.data) setProcedureCategories(categoriesRes.data)
    } catch (error) {
      setError('Failed to load complexities. Please try again.')
      showToast({
        type: 'error',
        title: 'Failed to load complexities',
        message: error instanceof Error ? error.message : 'Please try again'
      })
    } finally {
      setLoading(false)
    }
  }
const fetchArchivedComplexities = async () => {
    if (!effectiveFacilityId) return
    try {
      const { data } = await supabase
        .from('complexities')
        .select('*')
        .eq('facility_id', effectiveFacilityId)
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false })
      if (data) setArchivedComplexities(data)
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Error fetching archived complexities',
        message: error instanceof Error ? error.message : 'Error fetching archived complexities'
      })
    }
  }

  useEffect(() => {
    if (showArchived && effectiveFacilityId) {
      fetchArchivedComplexities()
    }
  }, [showArchived, effectiveFacilityId])
  const handleNew = () => {
    setEditingComplexity(null)
    setFormDisplayName('')
    setFormDescription('')
    setShowModal(true)
  }

  const handleEdit = (complexity: Complexity, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingComplexity(complexity)
    setFormDisplayName(complexity.display_name)
    setFormDescription(complexity.description || '')
    setShowModal(true)
  }


  const handleSave = async () => {
    if (!formDisplayName.trim() || !effectiveFacilityId) return
    setSaving(true)

    try {
      const name = formDisplayName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')

      if (editingComplexity) {
        const { error } = await supabase
          .from('complexities')
          .update({
            display_name: formDisplayName.trim(),
            description: formDescription.trim() || null,
          })
          .eq('id', editingComplexity.id)

        if (error) throw error

        setComplexities(complexities.map(c =>
          c.id === editingComplexity.id
            ? { ...c, display_name: formDisplayName.trim(), description: formDescription.trim() || null }
            : c
        ))
      } else {
        const { data, error } = await supabase
          .from('complexities')
          .insert({
            facility_id: effectiveFacilityId,
            name: formDisplayName.trim().toLowerCase().replace(/\s+/g, '_'),
            display_name: formDisplayName.trim(),
            description: formDescription.trim() || null,
            is_active: true,
            display_order: complexities.length,
            procedure_category_ids: [],
          })
          .select()
          .single()

        if (error) throw error
        setComplexities([...complexities, data])
      }

      setShowModal(false)
    } catch (error) {
      showToast({
  type: 'error',
  title: 'Error saving complexity',
  message: error instanceof Error ? error.message : 'Error saving complexity'
})
      alert('Error saving')
    } finally {
      setSaving(false)
    }
  }

  const handleArchive = async (id: string) => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('complexities')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
      setComplexities(complexities.filter(c => c.id !== id))
      setArchiveConfirm(null)
    } catch (error) {
      showToast({
  type: 'error',
  title: 'Error archiving complexity',
  message: error instanceof Error ? error.message : 'Error archiving complexity'
})
      alert('Error archiving')
    } finally {
      setSaving(false)
    }
  }

  const handleRestore = async (id: string) => {
    setSaving(true)
    try {
      const { data, error } = await supabase
        .from('complexities')
        .update({ deleted_at: null })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      if (data) {
        setComplexities([...complexities, data])
        setArchivedComplexities(archivedComplexities.filter(c => c.id !== id))
      }
    } catch (error) {
      showToast({
  type: 'error',
  title: 'Error:',
  message: error instanceof Error ? error.message : 'Error restoring complexity'
})
      alert('Error restoring')
    } finally {
      setSaving(false)
    }
  }


  const toggleCategory = async (complexityId: string, categoryId: string) => {
    if (!canEdit) return
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
    const cats = procedureCategories.filter(c => complexity.procedure_category_ids?.includes(c.id))
    return cats
  }

  return (
    <DashboardLayout>
      <Container>
          <ErrorBanner message={error} onDismiss={() => setError(null)} />
        <SettingsLayout title="Case Complexities" description="Complexity factors that can be tagged on cases">
          {loading ? (
            <PageLoader message="Loading complexities..." />
          ) : !effectiveFacilityId ? (
            <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
              <p className="text-slate-500">No facility selected</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-slate-900">Complexities</h3>
                  <p className="text-sm text-slate-500">{complexities.length} complexity factors</p>
                </div>
                {canEdit && (
                  <Button onClick={handleNew}>
                    <Plus className="w-4 h-4" />
                    Add Complexity
                  </Button>
                )}
              </div>

              {/* Table */}
              {complexities.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <p className="text-slate-500">No complexities defined yet.</p>
                  {canEdit && (
                    <button onClick={handleNew} className="mt-2 text-blue-600 hover:underline text-sm">
                      Add your first complexity
                    </button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
{/* Table Header */}
                  <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <div className="col-span-4">Complexity Name</div>
                    <div className="col-span-3">Description</div>
                    <div className="col-span-3">Procedure Categories</div>
                    <div className="col-span-2 text-right">Actions</div>
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
                            <div className="col-span-4 flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-orange-100">
                                <AlertTriangle className="w-4 h-4 text-orange-600" />
                              </div>
                              <p className="font-medium text-slate-900">
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

                            {/* Actions */}
                            <div className="col-span-2 flex items-center justify-end gap-1">
                              {canEdit && (
                                <>
                                  <button
                                    onClick={(e) => handleEdit(complexity, e)}
                                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="Edit"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>
 {archiveConfirm === complexity.id ? (
                                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                      <button onClick={() => handleArchive(complexity.id)} className="px-2 py-1 bg-amber-600 text-white text-xs rounded hover:bg-amber-700">
                                        Archive
                                      </button>
                                      <button onClick={() => setArchiveConfirm(null)} className="px-2 py-1 bg-slate-200 text-slate-700 text-xs rounded hover:bg-slate-300">
                                        Cancel
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setArchiveConfirm(complexity.id) }}
                                      className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                      title="Archive"
                                    >
                                      <Archive className="w-4 h-4" />
                                    </button>
                                  )}
                                </>
                              )}
                              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            </div>
                          </div>

                          {/* Expanded Row - Category Assignment */}
                          {isExpanded && (
                            <div className="px-6 pb-4 bg-slate-50 border-t border-slate-100">
                              <div className="pt-4 pl-11">
                                <p className="text-sm font-medium text-slate-700 mb-3">
                                  {canEdit ? 'Applies to procedure categories (empty = all):' : 'Applies to:'}
                                </p>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                                  {procedureCategories.map((category) => {
                                    const isLinked = complexity.procedure_category_ids?.includes(category.id)
                                    return (
                                      <label
                                        key={category.id}
                                        className={`flex items-center gap-2 p-2 rounded-lg border ${canEdit ? 'cursor-pointer' : ''} ${isLinked ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isLinked}
                                          onChange={() => toggleCategory(complexity.id, category.id)}
                                          disabled={!canEdit || saving}
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
        </SettingsLayout>
      </Container>
 {/* Show Archived Toggle */}
              {canEdit && (
                <div className="px-6 py-3 border-t border-slate-200 flex items-center justify-between bg-slate-50">
                  <span className="text-sm text-slate-600">
                    {archivedComplexities.length > 0 ? `${archivedComplexities.length} archived` : 'No archived complexities'}
                  </span>
                  <button
                    onClick={() => setShowArchived(!showArchived)}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    {showArchived ? 'Hide Archived' : 'Show Archived'}
                  </button>
                </div>
              )}

              {/* Archived Complexities */}
              {showArchived && archivedComplexities.length > 0 && (
                <div className="border-t border-slate-200">
                  <div className="px-6 py-3 bg-amber-50 border-b border-amber-100">
                    <h4 className="text-sm font-medium text-amber-800">Archived Complexities</h4>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {archivedComplexities.map((complexity) => (
                      <div key={complexity.id} className="px-6 py-3 flex items-center justify-between bg-slate-50/50">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-100">
                            <AlertTriangle className="w-4 h-4 text-slate-400" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-500">{complexity.display_name}</p>
                            <p className="text-xs text-slate-400">
                              Archived {new Date(complexity.deleted_at!).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRestore(complexity.id)}
                          disabled={saving}
                          className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                        >
                          Restore
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
      {/* Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={`${editingComplexity ? 'Edit' : 'Add'} Complexity`}
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

        <Modal.Footer>
          <Modal.Cancel onClick={() => setShowModal(false)} />
          <Modal.Action onClick={handleSave} loading={saving} disabled={!formDisplayName.trim()}>
            Save
          </Modal.Action>
        </Modal.Footer>
      </Modal>
    </DashboardLayout>
  )
}