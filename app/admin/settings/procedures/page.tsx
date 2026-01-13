// app/admin/settings/procedures/page.tsx
// Manage default procedure templates that get copied to new facilities

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '../../../../lib/supabase'
import { useUser } from '../../../../lib/UserContext'
import DashboardLayout from '../../../../components/layouts/DashboardLayout'

interface DefaultProcedure {
  id: string
  name: string
  body_region_id: string | null
  is_active: boolean
  created_at: string
  body_region?: { name: string } | null
}

interface BodyRegion {
  id: string
  name: string
}

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
        // Fetch procedures
        const { data: proceduresData } = await supabase
          .from('default_procedure_types')
          .select('*, body_region:body_regions(name)')
          .order('name')

        if (proceduresData) {
          setProcedures(proceduresData)
        }

        // Fetch body regions
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

  // Open modal for new procedure
  const handleNew = () => {
    setEditingProcedure(null)
    setFormName('')
    setFormBodyRegion('')
    setFormIsActive(true)
    setShowModal(true)
  }

  // Open modal for editing
  const handleEdit = (procedure: DefaultProcedure) => {
    setEditingProcedure(procedure)
    setFormName(procedure.name)
    setFormBodyRegion(procedure.body_region_id || '')
    setFormIsActive(procedure.is_active)
    setShowModal(true)
  }

  // Save procedure (create or update)
  const handleSave = async () => {
    if (!formName.trim()) return

    setSaving(true)

    try {
      const data = {
        name: formName.trim(),
        body_region_id: formBodyRegion || null,
        is_active: formIsActive,
      }

      if (editingProcedure) {
        // Update existing
        const { error } = await supabase
          .from('default_procedure_types')
          .update(data)
          .eq('id', editingProcedure.id)

        if (error) throw error

        // Update local state
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
        // Create new
        const { data: newProcedure, error } = await supabase
          .from('default_procedure_types')
          .insert(data)
          .select('*, body_region:body_regions(name)')
          .single()

        if (error) throw error

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

  // Delete procedure
  const handleDelete = async (procedure: DefaultProcedure) => {
    if (!confirm(`Delete "${procedure.name}"? This cannot be undone.`)) return

    try {
      const { error } = await supabase
        .from('default_procedure_types')
        .delete()
        .eq('id', procedure.id)

      if (error) throw error

      setProcedures(procedures.filter(p => p.id !== procedure.id))
    } catch (error) {
      console.error('Error deleting procedure:', error)
      alert('Failed to delete procedure')
    }
  }

  // Toggle active status
  const handleToggleActive = async (procedure: DefaultProcedure) => {
    try {
      const { error } = await supabase
        .from('default_procedure_types')
        .update({ is_active: !procedure.is_active })
        .eq('id', procedure.id)

      if (error) throw error

      setProcedures(procedures.map(p =>
        p.id === procedure.id ? { ...p, is_active: !p.is_active } : p
      ))
    } catch (error) {
      console.error('Error toggling status:', error)
    }
  }

  // Filter procedures
  const filteredProcedures = procedures.filter(p => {
    if (filterRegion !== 'all' && p.body_region_id !== filterRegion) return false
    if (filterActive === 'active' && !p.is_active) return false
    if (filterActive === 'inactive' && p.is_active) return false
    if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })

  // Group by body region for display
  const groupedProcedures = filteredProcedures.reduce((acc, proc) => {
    const regionName = (proc.body_region as any)?.name || 'Uncategorized'
    if (!acc[regionName]) acc[regionName] = []
    acc[regionName].push(proc)
    return acc
  }, {} as Record<string, DefaultProcedure[]>)

  // Loading state
  if (userLoading || loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </DashboardLayout>
    )
  }

  if (!isGlobalAdmin) return null

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link
            href="/admin"
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Default Procedures</h1>
            <p className="text-slate-500">Template procedures copied to new facilities</p>
          </div>
        </div>
        <button
          onClick={handleNew}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Procedure
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 shadow-sm">
        <div className="flex flex-wrap gap-4">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <svg className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

          {/* Body Region Filter */}
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

          {/* Active Filter */}
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

      {/* Stats */}
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
          <p className="text-sm text-slate-500">Inactive</p>
          <p className="text-2xl font-bold text-slate-400">{procedures.filter(p => !p.is_active).length}</p>
        </div>
      </div>

      {/* Procedures List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {Object.keys(groupedProcedures).length === 0 ? (
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
          Object.entries(groupedProcedures)
            .sort(([a], [b]) => a === 'Uncategorized' ? 1 : b === 'Uncategorized' ? -1 : a.localeCompare(b))
            .map(([regionName, procs]) => (
              <div key={regionName}>
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                  <h3 className="font-semibold text-slate-700">{regionName}</h3>
                  <p className="text-xs text-slate-500">{procs.length} procedure{procs.length !== 1 ? 's' : ''}</p>
                </div>
                <div className="divide-y divide-slate-100">
                  {procs.map((procedure) => (
                    <div
                      key={procedure.id}
                      className={`px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors ${
                        !procedure.is_active ? 'opacity-50' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
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
                        <span className={`font-medium ${procedure.is_active ? 'text-slate-900' : 'text-slate-500'}`}>
                          {procedure.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
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
            ))
        )}
      </div>

      {/* Add/Edit Modal */}
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
    </DashboardLayout>
  )
}
