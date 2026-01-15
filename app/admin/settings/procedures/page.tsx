// app/admin/settings/procedures/page.tsx
// Manage default procedure templates that get copied to new facilities
// Now includes milestone configuration per procedure

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
      const [proceduresRes, regionsRes, milestonesRes, procMilestonesRes] = await Promise.all([
        supabase
          .from('default_procedure_types')
          .select('*, body_region:body_regions(name)')
          .order('name'),
        supabase
          .from('body_regions')
          .select('id, name')
          .order('name'),
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
    setFormImplantCategory('')
    setFormIsActive(true)
    setShowModal(true)
  }

  const handleEdit = (procedure: DefaultProcedure, e: React.MouseEvent) => {
    e.stopPropagation()
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

        await adminAudit.defaultProcedureCreated(supabase, formName.trim(), newProcedure.id)

        // Auto-add all milestones to new procedure
        const milestoneInserts = milestoneTypes.map(m => ({
          default_procedure_id: newProcedure.id,
          milestone_type_id: m.id,
          display_order: m.display_order
        }))

        const { data: newProcMilestones } = await supabase
          .from('default_procedure_milestones')
          .insert(milestoneInserts)
          .select()

        if (newProcMilestones) {
          setProcedureMilestones([...procedureMilestones, ...newProcMilestones])
        }

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

  const handleDelete = async (procedure: DefaultProcedure, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(`Delete "${procedure.name}"? This cannot be undone.`)) return

    try {
      const { error } = await supabase
        .from('default_procedure_types')
        .delete()
        .eq('id', procedure.id)

      if (error) throw error

      await adminAudit.defaultProcedureDeleted(supabase, procedure.name, procedure.id)

      setProcedures(procedures.filter(p => p.id !== procedure.id))
      setProcedureMilestones(procedureMilestones.filter(pm => pm.default_procedure_id !== procedure.id))
    } catch (error) {
      console.error('Error deleting procedure:', error)
      alert('Failed to delete procedure')
    }
  }

  const handleToggleActive = async (procedure: DefaultProcedure, e: React.MouseEvent) => {
    e.stopPropagation()
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
      console.error('Error toggling active:', error)
    }
  }

  // Milestone toggle functions
  const isMilestoneEnabled = (procedureId: string, milestoneId: string): boolean => {
    return procedureMilestones.some(
      pm => pm.default_procedure_id === procedureId && pm.milestone_type_id === milestoneId
    )
  }

  const toggleMilestone = async (procedureId: string, milestoneId: string) => {
    setSaving(true)
    const isEnabled = isMilestoneEnabled(procedureId, milestoneId)

    try {
      if (isEnabled) {
        await supabase
          .from('default_procedure_milestones')
          .delete()
          .eq('default_procedure_id', procedureId)
          .eq('milestone_type_id', milestoneId)

        setProcedureMilestones(procedureMilestones.filter(
          pm => !(pm.default_procedure_id === procedureId && pm.milestone_type_id === milestoneId)
        ))
      } else {
        const milestone = milestoneTypes.find(m => m.id === milestoneId)
        const { data } = await supabase
          .from('default_procedure_milestones')
          .insert({
            default_procedure_id: procedureId,
            milestone_type_id: milestoneId,
            display_order: milestone?.display_order || 0
          })
          .select()
          .single()

        if (data) {
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

    // Find the paired "end" milestone
    const endMilestone = milestoneTypes.find(m => 
      m.pair_position === 'end' && 
      m.name.replace('_end', '').replace('draping_complete', 'prepped').replace('closing_complete', 'closing') === 
      startMilestone.name.replace('_start', '')
    )

    await toggleMilestone(procedureId, startMilestoneId)
    if (endMilestone) {
      await toggleMilestone(procedureId, endMilestone.id)
    }
  }

  const getMilestoneCount = (procedureId: string): number => {
    return procedureMilestones.filter(pm => pm.default_procedure_id === procedureId).length
  }

  const enableAllMilestones = async (procedureId: string) => {
    setSaving(true)
    try {
      const toAdd = milestoneTypes.filter(m => !isMilestoneEnabled(procedureId, m.id))
      if (toAdd.length > 0) {
        const inserts = toAdd.map(m => ({
          default_procedure_id: procedureId,
          milestone_type_id: m.id,
          display_order: m.display_order
        }))
        const { data } = await supabase
          .from('default_procedure_milestones')
          .insert(inserts)
          .select()

        if (data) {
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
      await supabase
        .from('default_procedure_milestones')
        .delete()
        .eq('default_procedure_id', procedureId)

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

  // Loading state
  if (userLoading || loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    )
  }

  if (!isGlobalAdmin) return null

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 py-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Link href="/admin" className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <h1 className="text-2xl font-bold text-slate-900">Procedure Types</h1>
            </div>
            <p className="text-slate-500">
              Configure default procedure types and their milestones for new facilities
            </p>
          </div>
          <button
            onClick={handleNew}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors shadow-lg shadow-blue-600/25"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Procedure
          </button>
        </div>

        {/* Info Banner */}
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
          <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-amber-800">Template System</p>
            <p className="text-sm text-amber-700 mt-0.5">
              These are defaults copied to new facilities during onboarding. Existing facilities are not affected by changes here.
              Click a procedure row to configure which milestones appear for that procedure type.
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-xs">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search procedures..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          <select
            value={filterRegion}
            onChange={(e) => setFilterRegion(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          >
            <option value="all">All Regions</option>
            {bodyRegions.map(region => (
              <option key={region.id} value={region.id}>{region.name}</option>
            ))}
          </select>
          <select
            value={filterActive}
            onChange={(e) => setFilterActive(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          >
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>

        {/* Procedures List */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {filteredProcedures.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-12 h-12 text-slate-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
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
            <div className="divide-y divide-slate-100">
              {filteredProcedures.map((procedure) => {
                const isExpanded = expandedProcedureId === procedure.id
                const milestoneCount = getMilestoneCount(procedure.id)
                const totalMilestones = milestoneTypes.length

                return (
                  <div key={procedure.id}>
                    {/* Procedure Row */}
                    <div
                      className={`flex items-center gap-4 px-6 py-4 cursor-pointer hover:bg-slate-50 transition-colors ${
                        !procedure.is_active ? 'opacity-60' : ''
                      }`}
                      onClick={() => setExpandedProcedureId(isExpanded ? null : procedure.id)}
                    >
                      {/* Active Toggle */}
                      <button
                        onClick={(e) => handleToggleActive(procedure, e)}
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
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

                      {/* Procedure Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${procedure.is_active ? 'text-slate-900' : 'text-slate-500'}`}>
                            {procedure.name}
                          </span>
                          {procedure.implant_category && (
                            <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${
                              procedure.implant_category === 'total_hip' 
                                ? 'bg-purple-100 text-purple-700' 
                                : 'bg-indigo-100 text-indigo-700'
                            }`}>
                              {getImplantCategoryLabel(procedure.implant_category)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs text-slate-500">
                            {procedure.body_region?.name || 'No region'}
                          </span>
                          <span className="text-xs text-slate-400">•</span>
                          <span className={`text-xs ${milestoneCount === 0 ? 'text-amber-600 font-medium' : 'text-slate-500'}`}>
                            {milestoneCount} of {totalMilestones} milestones
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="flex items-center gap-3">
                        <div className="w-20 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-500 rounded-full transition-all"
                            style={{ width: `${totalMilestones > 0 ? (milestoneCount / totalMilestones) * 100 : 0}%` }}
                          />
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => handleEdit(procedure, e)}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => handleDelete(procedure, e)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                        <svg 
                          className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>

                    {/* Expanded Milestone Configuration */}
                    {isExpanded && (
                      <div className="px-6 pb-4 bg-slate-50 border-t border-slate-100">
                        <div className="pt-4">
                          <p className="text-sm font-medium text-slate-700 mb-3">
                            Select which milestones appear for <span className="font-semibold">{procedure.name}</span> cases:
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
                  </div>
                )
              })}
            </div>
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
                    placeholder="e.g., Mako THA"
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
