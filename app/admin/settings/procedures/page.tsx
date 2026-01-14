// app/admin/settings/procedures/page.tsx
// Manage default procedure templates that get copied to new facilities

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '../../../../lib/supabase'
import { useUser } from '../../../../lib/UserContext'
import DashboardLayout from '../../../../components/layouts/DashboardLayout'
import { adminAudit } from '../../../../lib/audit-logger'

interface DefaultProcedure {
  id: string
  name: string
  body_region_id: string | null
  implant_category: string | null
  is_active: boolean
  created_at: string
  body_region?: { name: string } | null
}

interface BodyRegion {
  id: string
  name: string
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

  const [procedures, setProcedures] = useState<DefaultProcedure[]>([])
  const [bodyRegions, setBodyRegions] = useState<BodyRegion[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editingProcedure, setEditingProcedure] = useState<DefaultProcedure | null>(null)

  // Form state
  const [formName, setFormName] = useState('')
  const [formBodyRegion, setFormBodyRegion] = useState<string>('')
  const [formImplantCategory, setFormImplantCategory] = useState<string>('')
  const [formIsActive, setFormIsActive] = useState(true)

  // Filter state
  const [filterRegion, setFilterRegion] = useState<string>('all')
  const [filterActive, setFilterActive] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Redirect non-admins
  useEffect(() => {
    if (!userLoading && !isGlobalAdmin) {
      router.push('/dashboard')
    }
  }, [userLoading, isGlobalAdmin, router])

  // Fetch data
  useEffect(() => {
    if (!isGlobalAdmin) return

    async function fetchData() {
      setLoading(true)

      try {
        const { data: proceduresData } = await supabase
          .from('default_procedure_types')
          .select('*, body_region:body_regions(name)')
          .order('name')

        if (proceduresData) {
          setProcedures(proceduresData)
        }

        const { data: regionsData } = await supabase
          .from('body_regions')
          .select('id, name')
          .order('name')

        if (regionsData) {
          setBodyRegions(regionsData)
        }
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [isGlobalAdmin, supabase])

  const handleNew = () => {
    setEditingProcedure(null)
    setFormName('')
    setFormBodyRegion('')
    setFormImplantCategory('')
    setFormIsActive(true)
    setShowModal(true)
  }

  const handleEdit = (procedure: DefaultProcedure) => {
    setEditingProcedure(procedure)
    setFormName(procedure.name)
    setFormBodyRegion(procedure.body_region_id || '')
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
        implant_category: formImplantCategory || null,
        is_active: formIsActive,
      }

      if (editingProcedure) {
        const { error } = await supabase
          .from('default_procedure_types')
          .update(data)
          .eq('id', editingProcedure.id)

        if (error) throw error

        // Audit log the update
        await adminAudit.defaultProcedureUpdated(supabase, formName.trim(), editingProcedure.id, {
          name: formName.trim(),
          body_region_id: formBodyRegion || null,
          implant_category: formImplantCategory || null,
          is_active: formIsActive,
        })

        setProcedures(procedures.map(p => 
          p.id === editingProcedure.id 
            ? { 
                ...p, 
                ...data,
                body_region: formBodyRegion 
                  ? bodyRegions.find(r => r.id === formBodyRegion) || null
                  : null
              }
            : p
        ))
      } else {
        const { data: newProcedure, error } = await supabase
          .from('default_procedure_types')
          .insert(data)
          .select('*, body_region:body_regions(name)')
          .single()

        if (error) throw error

        // Audit log the creation
        await adminAudit.defaultProcedureCreated(supabase, formName.trim(), newProcedure.id)

        setProcedures([...procedures, newProcedure].sort((a, b) => a.name.localeCompare(b.name)))
      }

      setShowModal(false)
    } catch (error) {
      console.error('Error saving procedure:', error)
      alert('Failed to save procedure')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (procedure: DefaultProcedure) => {
    if (!confirm(`Delete "${procedure.name}"? This cannot be undone.`)) return

    try {
      const { error } = await supabase
        .from('default_procedure_types')
        .delete()
        .eq('id', procedure.id)

      if (error) throw error

      // Audit log the deletion
      await adminAudit.defaultProcedureDeleted(supabase, procedure.name, procedure.id)

      setProcedures(procedures.filter(p => p.id !== procedure.id))
    } catch (error) {
      console.error('Error deleting procedure:', error)
      alert('Failed to delete procedure')
    }
  }

  const handleToggleActive = async (procedure: DefaultProcedure) => {
    try {
      const { error } = await supabase
        .from('default_procedure_types')
        .update({ is_active: !procedure.is_active })
        .eq('id', procedure.id)

      if (error) throw error

      await adminAudit.defaultProcedureUpdated(supabase, procedure.name, procedure.id, {
        is_active: !procedure.is_active,
      })

      setProcedures(procedures.map(p => 
        p.id === procedure.id ? { ...p, is_active: !p.is_active } : p
      ))
    } catch (error) {
      console.error('Error toggling status:', error)
    }
  }

  // Filter procedures
  const filteredProcedures = procedures.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesRegion = filterRegion === 'all' || p.body_region_id === filterRegion
    const matchesActive = filterActive === 'all' || 
      (filterActive === 'active' && p.is_active) || 
      (filterActive === 'inactive' && !p.is_active)
    return matchesSearch && matchesRegion && matchesActive
  })

  // Group by region
  const groupedProcedures = filteredProcedures.reduce((acc, p) => {
    const regionName = p.body_region?.name || 'Uncategorized'
    if (!acc[regionName]) acc[regionName] = []
    acc[regionName].push(p)
    return acc
  }, {} as Record<string, DefaultProcedure[]>)

  if (userLoading || loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-8 h-8 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    )
  }

  if (!isGlobalAdmin) return null

  // Helper to get implant category label
  const getImplantCategoryLabel = (value: string | null) => {
    if (!value) return null
    const category = IMPLANT_CATEGORIES.find(c => c.value === value)
    return category?.label || null
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto p-4 lg:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
              <Link href="/admin" className="hover:text-blue-600">Admin</Link>
              <span>/</span>
              <Link href="/admin/settings" className="hover:text-blue-600">Settings</Link>
              <span>/</span>
              <span className="text-slate-700">Procedures</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Default Procedure Types</h1>
            <p className="text-slate-500 text-sm mt-1">Manage procedure templates for new facilities</p>
          </div>
          <button
            onClick={handleNew}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Procedure
          </button>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search procedures..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
              />
            </div>

            <select
              value={filterRegion}
              onChange={(e) => setFilterRegion(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
            >
              <option value="all">All Body Regions</option>
              {bodyRegions.map((region) => (
                <option key={region.id} value={region.id}>{region.name}</option>
              ))}
            </select>

            <select
              value={filterActive}
              onChange={(e) => setFilterActive(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
            >
              <option value="all">All Status</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <p className="text-sm text-slate-500">Total Procedures</p>
            <p className="text-2xl font-bold text-slate-900">{procedures.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <p className="text-sm text-slate-500">Active</p>
            <p className="text-2xl font-bold text-emerald-600">{procedures.filter(p => p.is_active).length}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <p className="text-sm text-slate-500">With Implant Tracking</p>
            <p className="text-2xl font-bold text-blue-600">{procedures.filter(p => p.implant_category).length}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {filteredProcedures.length === 0 ? (
            <div className="p-12 text-center">
              <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-slate-500">No procedures found</p>
              <button
                onClick={handleNew}
                className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
              >
                Add your first procedure
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <div className="col-span-1">Active</div>
                <div className="col-span-4">Procedure Name</div>
                <div className="col-span-2">Body Region</div>
                <div className="col-span-2">Implant Tracking</div>
                <div className="col-span-1">Status</div>
                <div className="col-span-2 text-right">Actions</div>
              </div>

              {/* Table Body */}
              <div className="divide-y divide-slate-100">
                {filteredProcedures.map((procedure) => (
                  <div
                    key={procedure.id}
                    className={`grid grid-cols-12 gap-4 px-6 py-3 items-center hover:bg-slate-50 transition-colors ${
                      !procedure.is_active ? 'opacity-60' : ''
                    }`}
                  >
                    {/* Active Toggle */}
                    <div className="col-span-1">
                      <button
                        onClick={() => handleToggleActive(procedure)}
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                          procedure.is_active
                            ? 'border-emerald-500 bg-emerald-500'
                            : 'border-slate-300 hover:border-slate-400'
                        }`}
                      >
                        {procedure.is_active && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    </div>

                    {/* Procedure Name */}
                    <div className="col-span-4">
                      <span className={`font-medium ${procedure.is_active ? 'text-slate-900' : 'text-slate-500'}`}>
                        {procedure.name}
                      </span>
                    </div>

                    {/* Body Region */}
                    <div className="col-span-2">
                      <span className="text-sm text-slate-600">
                        {procedure.body_region?.name || '—'}
                      </span>
                    </div>

                    {/* Implant Tracking */}
                    <div className="col-span-2">
                      {procedure.implant_category ? (
                        <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${
                          procedure.implant_category === 'total_hip' 
                            ? 'bg-purple-100 text-purple-700' 
                            : 'bg-indigo-100 text-indigo-700'
                        }`}>
                          {getImplantCategoryLabel(procedure.implant_category)}
                        </span>
                      ) : (
                        <span className="text-sm text-slate-400">—</span>
                      )}
                    </div>

                    {/* Status */}
                    <div className="col-span-1">
                      <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${
                        procedure.is_active 
                          ? 'bg-emerald-100 text-emerald-700' 
                          : 'bg-slate-100 text-slate-500'
                      }`}>
                        {procedure.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="col-span-2 flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleEdit(procedure)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(procedure)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
              <div className="p-4 border-b border-slate-200 flex justify-between items-center">
                <h3 className="font-semibold text-slate-900">
                  {editingProcedure ? 'Edit Procedure' : 'Add Procedure'}
                </h3>
                <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Procedure Name *
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g., Total Hip Replacement"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Body Region
                  </label>
                  <select
                    value={formBodyRegion}
                    onChange={(e) => setFormBodyRegion(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="">None</option>
                    {bodyRegions.map((region) => (
                      <option key={region.id} value={region.id}>{region.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Implant Tracking
                  </label>
                  <select
                    value={formImplantCategory}
                    onChange={(e) => setFormImplantCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
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
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  <span className="text-sm text-slate-700">Active (included when copying to new facilities)</span>
                </label>
              </div>
              <div className="p-4 border-t border-slate-200 flex justify-end gap-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !formName.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-lg font-medium transition-colors"
                >
                  {saving ? 'Saving...' : editingProcedure ? 'Save Changes' : 'Add Procedure'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
