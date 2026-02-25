// app/admin/settings/procedures/page.tsx
// Manage default procedure templates that get copied to new facilities.
// Milestone configuration has moved to Admin > Milestones (Templates + Procedure Types tabs).

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import { adminAudit } from '@/lib/audit-logger'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { Modal } from '@/components/ui/Modal'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Check, ClipboardList, Info, Pencil, Plus, Search, Trash2 } from 'lucide-react'

interface DefaultProcedure {
  id: string
  name: string
  body_region_id: string | null
  procedure_category_id: string | null
  implant_category: string | null
  is_active: boolean
  created_at: string
  body_region?: { name: string; display_name: string } | null
  procedure_category?: { name: string; display_name: string } | null
}

interface BodyRegion {
  id: string
  name: string
  display_name: string
}

interface ProcedureCategory {
  id: string
  name: string
  display_name: string
  body_region_id: string | null
}

const IMPLANT_CATEGORIES = [
  { value: '', label: 'None' },
  { value: 'total_hip', label: 'Total Hip' },
  { value: 'total_knee', label: 'Total Knee' },
]

export default function DefaultProceduresPage() {
  const router = useRouter()
  const supabase = createClient()
  const { isGlobalAdmin, loading: userLoading } = useUser()
  const { showToast } = useToast()

  const [saving, setSaving] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editingProcedure, setEditingProcedure] = useState<DefaultProcedure | null>(null)
  const [formName, setFormName] = useState('')
  const [formBodyRegion, setFormBodyRegion] = useState<string>('')
  const [formProcedureCategory, setFormProcedureCategory] = useState<string>('')
  const [formImplantCategory, setFormImplantCategory] = useState<string>('')
  const [formIsActive, setFormIsActive] = useState(true)
  const [filterRegion, setFilterRegion] = useState<string>('all')
  const [filterActive, setFilterActive] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Redirect non-admins
  useEffect(() => {
    if (!userLoading && !isGlobalAdmin) {
      router.push('/dashboard')
    }
  }, [userLoading, isGlobalAdmin, router])

  const { data: queryData, loading, error, refetch: refetchData } = useSupabaseQuery<{
    procedures: DefaultProcedure[]
    bodyRegions: BodyRegion[]
    procedureCategories: ProcedureCategory[]
  }>(
    async (sb) => {
      const [proceduresRes, regionsRes, categoriesRes] = await Promise.all([
        sb.from('procedure_type_templates')
          .select('*, body_region:body_regions(name, display_name), procedure_category:procedure_categories(name, display_name)')
          .order('name'),
        sb.from('body_regions').select('id, name, display_name').order('display_name'),
        sb.from('procedure_categories').select('id, name, display_name, body_region_id').order('display_name'),
      ])

      return {
        procedures: proceduresRes.data || [],
        bodyRegions: regionsRes.data || [],
        procedureCategories: categoriesRes.data || [],
      }
    },
    { enabled: isGlobalAdmin }
  )

  const procedures = queryData?.procedures || []
  const bodyRegions = queryData?.bodyRegions || []
  const procedureCategories = queryData?.procedureCategories || []

  const handleNew = () => {
    setEditingProcedure(null)
    setFormName('')
    setFormBodyRegion('')
    setFormProcedureCategory('')
    setFormImplantCategory('')
    setFormIsActive(true)
    setShowModal(true)
  }

  const handleEdit = (procedure: DefaultProcedure, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingProcedure(procedure)
    setFormName(procedure.name)
    setFormBodyRegion(procedure.body_region_id || '')
    setFormProcedureCategory(procedure.procedure_category_id || '')
    setFormImplantCategory(procedure.implant_category || '')
    setFormIsActive(procedure.is_active)
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!formName.trim()) return

    setSaving(true)

    try {
      const data = {
        name: formName.trim(),
        body_region_id: formBodyRegion || null,
        procedure_category_id: formProcedureCategory || null,
        implant_category: formImplantCategory || null,
        is_active: formIsActive,
      }

      if (editingProcedure) {
        const { error } = await supabase
          .from('procedure_type_templates')
          .update(data)
          .eq('id', editingProcedure.id)

        if (error) throw error

        await adminAudit.defaultProcedureUpdated(supabase, formName.trim(), editingProcedure.id, {
          name: formName.trim(),
          body_region_id: formBodyRegion || null,
          procedure_category_id: formProcedureCategory || null,
          implant_category: formImplantCategory || null,
          is_active: formIsActive,
        })

        refetchData()
      } else {
        const { data: newProcedure, error } = await supabase
          .from('procedure_type_templates')
          .insert(data)
          .select('*, body_region:body_regions(name, display_name), procedure_category:procedure_categories(name, display_name)')
          .single()

        if (error) throw error

        await adminAudit.defaultProcedureCreated(supabase, formName.trim(), newProcedure.id)

        refetchData()
      }

      setShowModal(false)
    } catch (error) {
      showToast({
  type: 'error',
  title: 'Error saving procedure:',
  message: error instanceof Error ? error.message : 'Error saving procedure:'
})
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (procedure: DefaultProcedure, e: React.MouseEvent) => {
    e.stopPropagation()

    if (!confirm(`Delete "${procedure.name}"? This cannot be undone.`)) return

    setSaving(true)

    try {
      const { error } = await supabase
        .from('procedure_type_templates')
        .delete()
        .eq('id', procedure.id)

      if (error) throw error

      await adminAudit.defaultProcedureDeleted(supabase, procedure.name, procedure.id)

      refetchData()
    } catch (error) {
      showToast({
  type: 'error',
  title: 'Error deleting procedure:',
  message: error instanceof Error ? error.message : 'Error deleting procedure:'
})
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (procedure: DefaultProcedure, e: React.MouseEvent) => {
    e.stopPropagation()

    setSaving(true)

    try {
      const { error } = await supabase
        .from('procedure_type_templates')
        .update({ is_active: !procedure.is_active })
        .eq('id', procedure.id)

      if (error) throw error

        refetchData()
    } catch (error) {
      showToast({
  type: 'error',
  title: 'Error toggling procedure:',
  message: error instanceof Error ? error.message : 'Error toggling procedure:'
})
    } finally {
      setSaving(false)
    }
  }

  const getImplantCategoryLabel = (category: string) => {
    return IMPLANT_CATEGORIES.find(c => c.value === category)?.label || category
  }

  // Filter procedures
  const filteredProcedures = procedures.filter(proc => {
    if (filterRegion !== 'all' && proc.body_region_id !== filterRegion) return false
    if (filterActive === 'active' && !proc.is_active) return false
    if (filterActive === 'inactive' && proc.is_active) return false
    if (searchQuery && !proc.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })

  const activeCount = procedures.filter(p => p.is_active).length
  const inactiveCount = procedures.filter(p => !p.is_active).length

  // Loading state
  if (userLoading || loading) {
    return (
      <DashboardLayout>
        <Container className="py-8">
          <ErrorBanner message={error} />
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        </Container>
      </DashboardLayout>
    )
  }

  if (!isGlobalAdmin) return null

  return (
    <DashboardLayout>
      <Container className="py-8">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Default Procedures</h1>
              <p className="text-slate-500 mt-1">
                Procedure templates copied to new facilities.
              </p>
            </div>
            <button
              onClick={handleNew}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Procedure
            </button>
          </div>

          {/* Stats & Filters Bar */}
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <span className="text-sm text-slate-500">
              {activeCount} active, {inactiveCount} inactive
            </span>
            <div className="flex-1" />
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-48"
              />
            </div>
            <select
              value={filterRegion}
              onChange={(e) => setFilterRegion(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="all">All Regions</option>
              {bodyRegions.map(region => (
                <option key={region.id} value={region.id}>{region.name}</option>
              ))}
            </select>
            <select
              value={filterActive}
              onChange={(e) => setFilterActive(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {/* Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {filteredProcedures.length === 0 ? (
              <div className="text-center py-16 text-slate-500">
                <ClipboardList className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                <p>No procedures found</p>
                <button
                  onClick={handleNew}
                  className="mt-2 text-blue-600 hover:text-blue-700 font-medium text-sm"
                >
                  Add your first procedure
                </button>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-16">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Procedure Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Region</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Implant</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProcedures.map((procedure) => (
                    <tr key={procedure.id} className={`group hover:bg-slate-50 transition-colors ${!procedure.is_active ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3 w-16">
                        <button
                          onClick={(e) => handleToggleActive(procedure, e)}
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                            procedure.is_active
                              ? 'border-green-500 bg-green-500'
                              : 'border-slate-300 hover:border-slate-400'
                          }`}
                        >
                          {procedure.is_active && (
                            <Check className="w-3 h-3 text-white" />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-slate-900">{procedure.name}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-500">
                          {procedure.procedure_category?.display_name || '\u2014'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-500">
                          {procedure.body_region?.display_name || procedure.body_region?.name || '\u2014'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {procedure.implant_category ? (
                          <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded ${
                            procedure.implant_category === 'total_hip'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-indigo-100 text-indigo-700'
                          }`}>
                            {getImplantCategoryLabel(procedure.implant_category)}
                          </span>
                        ) : (
                          <span className="text-sm text-slate-300">{'\u2014'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => handleEdit(procedure, e)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => handleDelete(procedure, e)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Info Box */}
          <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex gap-3">
              <Info className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-slate-600">
                <p className="font-medium text-slate-700 mb-1">Milestone Templates</p>
                <p>
                  Milestone assignment for procedures is now managed through the template system.
                  Go to <strong>Admin &gt; Milestones</strong> to build templates and assign them to procedure types.
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
        title={editingProcedure ? 'Edit Procedure' : 'Add Procedure'}
      >
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Procedure Name <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., Mako THA"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Body Region
                </label>
                <select
                  value={formBodyRegion}
                  onChange={(e) => {
                    setFormBodyRegion(e.target.value)
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">None</option>
                  {bodyRegions.map((region) => (
                    <option key={region.id} value={region.id}>{region.display_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Procedure Category
                </label>
                <select
                  value={formProcedureCategory}
                  onChange={(e) => setFormProcedureCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">None</option>
                  {procedureCategories
                    .filter(c => !formBodyRegion || c.body_region_id === formBodyRegion || c.body_region_id === null)
                    .map((category) => (
                      <option key={category.id} value={category.id}>{category.display_name}</option>
                    ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  Used for analytics grouping and comparisons
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Implant Tracking
                </label>
                <select
                  value={formImplantCategory}
                  onChange={(e) => setFormImplantCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {IMPLANT_CATEGORIES.map((category) => (
                    <option key={category.value} value={category.value}>{category.label}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  Enable implant size tracking for hip or knee procedures
                </p>
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
            {editingProcedure ? 'Save Changes' : 'Add Procedure'}
          </Modal.Action>
        </Modal.Footer>
      </Modal>
    </DashboardLayout>
  )
}
