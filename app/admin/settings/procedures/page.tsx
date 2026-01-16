// app/admin/settings/procedures/page.tsx
// Manage default procedure templates that get copied to new facilities
// Now includes milestone configuration per procedure

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../../lib/supabase'
import { useUser } from '../../../../lib/UserContext'
import DashboardLayout from '../../../../components/layouts/DashboardLayout'
import Container from '../../../../components/ui/Container'
import { adminAudit } from '../../../../lib/audit-logger'

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

interface MilestoneType {
  id: string
  name: string
  display_name: string
  display_order: number
  pair_position: 'start' | 'end' | null
}

interface DefaultProcedureMilestone {
  id: string
  default_procedure_id: string
  milestone_type_id: string
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
  const [procedureCategories, setProcedureCategories] = useState<ProcedureCategory[]>([])
  const [milestoneTypes, setMilestoneTypes] = useState<MilestoneType[]>([])
  const [procedureMilestones, setProcedureMilestones] = useState<DefaultProcedureMilestone[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Expanded procedure for milestone config
  const [expandedProcedureId, setExpandedProcedureId] = useState<string | null>(null)

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editingProcedure, setEditingProcedure] = useState<DefaultProcedure | null>(null)

  // Form state
  const [formName, setFormName] = useState('')
  const [formBodyRegion, setFormBodyRegion] = useState<string>('')
  const [formProcedureCategory, setFormProcedureCategory] = useState<string>('')
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
    fetchData()
  }, [isGlobalAdmin])

  const fetchData = async () => {
    setLoading(true)

    try {
      const [proceduresRes, regionsRes, categoriesRes, milestonesRes, procMilestonesRes] = await Promise.all([
        supabase
          .from('default_procedure_types')
          .select('*, body_region:body_regions(name, display_name), procedure_category:procedure_categories(name, display_name)')
          .order('name'),
        supabase
          .from('body_regions')
          .select('id, name, display_name')
          .order('display_name'),
        supabase
          .from('procedure_categories')
          .select('id, name, display_name, body_region_id')
          .order('display_name'),
        supabase
          .from('milestone_types')
          .select('id, name, display_name, display_order, pair_position')
          .order('display_order'),
        supabase
          .from('default_procedure_milestones')
          .select('*')
      ])

      if (proceduresRes.data) setProcedures(proceduresRes.data)
      if (regionsRes.data) setBodyRegions(regionsRes.data)
      if (categoriesRes.data) setProcedureCategories(categoriesRes.data)
      if (milestonesRes.data) setMilestoneTypes(milestonesRes.data)
      if (procMilestonesRes.data) setProcedureMilestones(procMilestonesRes.data)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

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
          .from('default_procedure_types')
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

        setProcedures(procedures.map(p => 
          p.id === editingProcedure.id 
            ? { 
                ...p, 
                ...data,
                body_region: formBodyRegion 
                  ? bodyRegions.find(r => r.id === formBodyRegion) || null
                  : null,
                procedure_category: formProcedureCategory
                  ? procedureCategories.find(c => c.id === formProcedureCategory) || null
                  : null
              }
            : p
        ))
      } else {
        const { data: newProcedure, error } = await supabase
          .from('default_procedure_types')
          .insert(data)
          .select('*, body_region:body_regions(name, display_name), procedure_category:procedure_categories(name, display_name)')
          .single()

        if (error) throw error

        await adminAudit.defaultProcedureCreated(supabase, formName.trim(), newProcedure.id)

        setProcedures([...procedures, newProcedure])
      }

      setShowModal(false)
    } catch (error) {
      console.error('Error saving procedure:', error)
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
        .from('default_procedure_types')
        .delete()
        .eq('id', procedure.id)

      if (error) throw error

      await adminAudit.defaultProcedureDeleted(supabase, procedure.name, procedure.id)

      setProcedures(procedures.filter(p => p.id !== procedure.id))
    } catch (error) {
      console.error('Error deleting procedure:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (procedure: DefaultProcedure, e: React.MouseEvent) => {
    e.stopPropagation()

    setSaving(true)

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
      console.error('Error toggling procedure:', error)
    } finally {
      setSaving(false)
    }
  }

  // Milestone management functions
  const isMilestoneEnabled = (procedureId: string, milestoneId: string) => {
    return procedureMilestones.some(
      pm => pm.default_procedure_id === procedureId && pm.milestone_type_id === milestoneId
    )
  }

  const getMilestoneCount = (procedureId: string) => {
    return procedureMilestones.filter(pm => pm.default_procedure_id === procedureId).length
  }

  const toggleMilestone = async (procedureId: string, milestoneId: string) => {
    setSaving(true)

    try {
      const existing = procedureMilestones.find(
        pm => pm.default_procedure_id === procedureId && pm.milestone_type_id === milestoneId
      )

      if (existing) {
        await supabase
          .from('default_procedure_milestones')
          .delete()
          .eq('id', existing.id)
        
        setProcedureMilestones(procedureMilestones.filter(pm => pm.id !== existing.id))
      } else {
        const { data, error } = await supabase
          .from('default_procedure_milestones')
          .insert({ default_procedure_id: procedureId, milestone_type_id: milestoneId })
          .select()
          .single()

        if (!error && data) {
          setProcedureMilestones([...procedureMilestones, data])
        }
      }
    } catch (error) {
      console.error('Error toggling milestone:', error)
    } finally {
      setSaving(false)
    }
  }

  const togglePairedMilestone = async (procedureId: string, startMilestoneId: string) => {
    const startMilestone = milestoneTypes.find(m => m.id === startMilestoneId)
    if (!startMilestone) return

    const endMilestone = milestoneTypes.find(
      m => m.pair_position === 'end' && m.display_order === startMilestone.display_order + 1
    )

    setSaving(true)

    try {
      const startEnabled = isMilestoneEnabled(procedureId, startMilestoneId)
      const endMilestoneId = endMilestone?.id

      if (startEnabled) {
        const toDelete = procedureMilestones.filter(
          pm => pm.default_procedure_id === procedureId && 
                (pm.milestone_type_id === startMilestoneId || pm.milestone_type_id === endMilestoneId)
        )
        
        for (const pm of toDelete) {
          await supabase.from('default_procedure_milestones').delete().eq('id', pm.id)
        }
        
        setProcedureMilestones(procedureMilestones.filter(
          pm => !toDelete.some(d => d.id === pm.id)
        ))
      } else {
        const toInsert = [
          { default_procedure_id: procedureId, milestone_type_id: startMilestoneId }
        ]
        if (endMilestoneId) {
          toInsert.push({ default_procedure_id: procedureId, milestone_type_id: endMilestoneId })
        }

        const { data, error } = await supabase
          .from('default_procedure_milestones')
          .insert(toInsert)
          .select()

        if (!error && data) {
          setProcedureMilestones([...procedureMilestones, ...data])
        }
      }
    } catch (error) {
      console.error('Error toggling paired milestone:', error)
    } finally {
      setSaving(false)
    }
  }

  const enableAllMilestones = async (procedureId: string) => {
    setSaving(true)

    try {
      const currentIds = procedureMilestones
        .filter(pm => pm.default_procedure_id === procedureId)
        .map(pm => pm.milestone_type_id)

      const toAdd = milestoneTypes
        .filter(m => !currentIds.includes(m.id))
        .map(m => ({ default_procedure_id: procedureId, milestone_type_id: m.id }))

      if (toAdd.length > 0) {
        const { data, error } = await supabase
          .from('default_procedure_milestones')
          .insert(toAdd)
          .select()

        if (!error && data) {
          setProcedureMilestones([...procedureMilestones, ...data])
        }
      }
    } catch (error) {
      console.error('Error enabling all milestones:', error)
    } finally {
      setSaving(false)
    }
  }

  const disableAllMilestones = async (procedureId: string) => {
    setSaving(true)

    try {
      const toDelete = procedureMilestones.filter(pm => pm.default_procedure_id === procedureId)

      for (const pm of toDelete) {
        await supabase.from('default_procedure_milestones').delete().eq('id', pm.id)
      }

      setProcedureMilestones(procedureMilestones.filter(pm => pm.default_procedure_id !== procedureId))
    } catch (error) {
      console.error('Error disabling all milestones:', error)
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
                Procedure templates copied to new facilities. Click a row to configure milestones.
              </p>
            </div>
            <button
              onClick={handleNew}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
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
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
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
                <svg className="w-12 h-12 mx-auto mb-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p>No procedures found</p>
                <button
                  onClick={handleNew}
                  className="mt-2 text-blue-600 hover:text-blue-700 font-medium text-sm"
                >
                  Add your first procedure
                </button>
              </div>
            ) : (
              <>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-16">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Procedure Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Category</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Region</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Implant</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-36">Milestones</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider w-24">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredProcedures.map((procedure) => {
                      const isExpanded = expandedProcedureId === procedure.id
                      const milestoneCount = getMilestoneCount(procedure.id)
                      const totalMilestones = milestoneTypes.length

                      return (
                        <tr key={procedure.id} className="group">
                          <td colSpan={7} className="p-0">
                            {/* Main Row */}
                            <div
                              className={`flex items-center cursor-pointer hover:bg-slate-50 transition-colors ${
                                !procedure.is_active ? 'opacity-50' : ''
                              }`}
                              onClick={() => setExpandedProcedureId(isExpanded ? null : procedure.id)}
                            >
                              {/* Status */}
                              <div className="px-4 py-3 w-16">
                                <button
                                  onClick={(e) => handleToggleActive(procedure, e)}
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
                              <div className="px-4 py-3 flex-1 min-w-0">
                                <span className="text-sm font-medium text-slate-900 truncate">{procedure.name}</span>
                              </div>

                              {/* Category */}
                              <div className="px-4 py-3 w-40">
                                <span className="text-sm text-slate-500 truncate">
                                  {procedure.procedure_category?.display_name || '—'}
                                </span>
                              </div>

                              {/* Region */}
                              <div className="px-4 py-3 w-32">
                                <span className="text-sm text-slate-500">
                                  {procedure.body_region?.display_name || procedure.body_region?.name || '—'}
                                </span>
                              </div>

                              {/* Implant */}
                              <div className="px-4 py-3 w-32">
                                {procedure.implant_category ? (
                                  <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded ${
                                    procedure.implant_category === 'total_hip' 
                                      ? 'bg-purple-100 text-purple-700' 
                                      : 'bg-indigo-100 text-indigo-700'
                                  }`}>
                                    {getImplantCategoryLabel(procedure.implant_category)}
                                  </span>
                                ) : (
                                  <span className="text-sm text-slate-300">—</span>
                                )}
                              </div>

                              {/* Milestones */}
                              <div className="px-4 py-3 w-36">
                                <div className="flex items-center gap-2">
                                  <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                    <div 
                                      className={`h-full rounded-full transition-all ${milestoneCount === 0 ? 'bg-amber-400' : 'bg-blue-500'}`}
                                      style={{ width: `${totalMilestones > 0 ? (milestoneCount / totalMilestones) * 100 : 0}%` }}
                                    />
                                  </div>
                                  <span className={`text-xs ${milestoneCount === 0 ? 'text-amber-600 font-medium' : 'text-slate-500'}`}>
                                    {milestoneCount}/{totalMilestones}
                                  </span>
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="px-4 py-3 w-24 text-right">
                                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={(e) => handleEdit(procedure, e)}
                                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="Edit"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={(e) => handleDelete(procedure, e)}
                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Delete"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                  <svg 
                                    className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                                    fill="none" 
                                    stroke="currentColor" 
                                    viewBox="0 0 24 24"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </div>
                              </div>
                            </div>

                            {/* Expanded Milestone Config */}
                            {isExpanded && (
                              <div className="px-4 pb-4 bg-slate-50 border-t border-slate-100">
                                <div className="pt-4">
                                  <p className="text-sm font-medium text-slate-700 mb-3">
                                    Milestones for <span className="font-semibold">{procedure.name}</span>:
                                  </p>
                                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                                    {milestoneTypes
                                      .filter(m => m.pair_position !== 'end')
                                      .map(milestone => {
                                        const isEnabled = isMilestoneEnabled(procedure.id, milestone.id)
                                        const isPaired = milestone.pair_position === 'start'

                                        return (
                                          <label
                                            key={milestone.id}
                                            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                              isEnabled
                                                ? 'bg-white border-blue-200 shadow-sm'
                                                : 'bg-white/50 border-slate-200 hover:border-slate-300'
                                            }`}
                                          >
                                            <input
                                              type="checkbox"
                                              checked={isEnabled}
                                              onChange={() => {
                                                if (isPaired) {
                                                  togglePairedMilestone(procedure.id, milestone.id)
                                                } else {
                                                  toggleMilestone(procedure.id, milestone.id)
                                                }
                                              }}
                                              disabled={saving}
                                              className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                                            />
                                            <div className="min-w-0 flex-1">
                                              <p className={`text-sm font-medium truncate ${isEnabled ? 'text-slate-900' : 'text-slate-600'}`}>
                                                {milestone.display_name}
                                              </p>
                                              {isPaired && (
                                                <p className="text-xs text-slate-400">Start/End pair</p>
                                              )}
                                            </div>
                                          </label>
                                        )
                                      })}
                                  </div>

                                  {/* Quick Actions */}
                                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-200">
                                    <button
                                      onClick={() => enableAllMilestones(procedure.id)}
                                      disabled={saving}
                                      className="text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50"
                                    >
                                      Select All
                                    </button>
                                    <span className="text-slate-300">|</span>
                                    <button
                                      onClick={() => disableAllMilestones(procedure.id)}
                                      disabled={saving}
                                      className="text-xs font-medium text-slate-500 hover:text-slate-700 disabled:opacity-50"
                                    >
                                      Clear All
                                    </button>
                                    {saving && (
                                      <>
                                        <span className="text-slate-300">|</span>
                                        <span className="text-xs text-slate-400 flex items-center gap-1">
                                          <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                          </svg>
                                          Saving...
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </>
            )}
          </div>

          {/* Info Box */}
          <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex gap-3">
              <svg className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-slate-600">
                <p className="font-medium text-slate-700 mb-1">Template System</p>
                <p>
                  These procedures are copied to new facilities during onboarding. Configure which milestones 
                  appear for each procedure type by clicking the row. Existing facilities are not affected.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Container>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
              {editingProcedure ? 'Edit Procedure' : 'Add Procedure'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Procedure Name <span className="text-red-500">*</span>
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
                    // Optionally auto-filter categories when region changes
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
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formName.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
