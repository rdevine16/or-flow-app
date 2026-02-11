// app/settings/procedures/page.tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import SettingsLayout from '@/components/settings/SettingsLayout'
import { procedureAudit } from '@/lib/audit-logger'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { useSupabaseQuery, useCurrentUser } from '@/hooks/useSupabaseQuery'
import { PageLoader, Spinner } from '@/components/ui/Loading'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input, Select, Label } from '@/components/ui/Input'
import { Plus, Pencil, Archive, Search, AlertTriangle, Undo2 } from 'lucide-react'

// =====================================================
// TYPES
// =====================================================

interface BodyRegion {
  id: string
  name: string
  display_name: string
}

interface ProcedureTechnique {
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

interface ProcedureType {
  id: string
  name: string
  body_region_id: string | null
  technique_id: string | null
  procedure_category_id: string | null
  implant_category: string | null
  is_active: boolean
  deleted_at: string | null
  deleted_by: string | null
  body_regions: BodyRegion | BodyRegion[] | null
  procedure_techniques: ProcedureTechnique | ProcedureTechnique[] | null
  procedure_categories: ProcedureCategory | ProcedureCategory[] | null
}

interface ModalState {
  isOpen: boolean
  mode: 'add' | 'edit'
  procedure: ProcedureType | null
}

interface DeleteModalState {
  isOpen: boolean
  procedure: ProcedureType | null
  dependencies: {
    cases: number
    milestoneConfigs: number
  }
  loading: boolean
}

// =====================================================
// CONSTANTS
// =====================================================

const IMPLANT_CATEGORIES = [
  { value: '', label: 'None' },
  { value: 'total_hip', label: 'Total Hip' },
  { value: 'total_knee', label: 'Total Knee' },
]

// =====================================================
// COMPONENT
// =====================================================

export default function ProceduresSettingsPage() {
  const supabase = createClient()
  const { showToast } = useToast()
  
  // User context - handles impersonation automatically
const { effectiveFacilityId, loading: userLoading } = useUser()
  
  // Data state
  const [showArchived, setShowArchived] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const { data: currentUserData } = useCurrentUser()
  const currentUserId = currentUserData?.userId || null

  // Reference data (body regions, techniques, categories) - fetched once
  const { data: refData } = useSupabaseQuery<{
    bodyRegions: BodyRegion[]
    techniques: ProcedureTechnique[]
    procedureCategories: ProcedureCategory[]
  }>(
    async (sb) => {
      const [regionsResult, techniquesResult, categoriesResult] = await Promise.all([
        sb.from('body_regions').select('id, name, display_name').order('display_name'),
        sb.from('procedure_techniques').select('id, name, display_name').order('display_name'),
        sb.from('procedure_categories').select('id, name, display_name, body_region_id').order('display_name'),
      ])
      return {
        bodyRegions: regionsResult.data || [],
        techniques: techniquesResult.data || [],
        procedureCategories: categoriesResult.data || [],
      }
    },
    { deps: [], enabled: true }
  )

  const bodyRegions = refData?.bodyRegions || []
  const techniques = refData?.techniques || []
  const procedureCategories = refData?.procedureCategories || []

  // Procedures + archived count - depends on showArchived
  const { data: procData, loading, error, setData: setProcData, refetch: refetchProcedures } = useSupabaseQuery<{
    procedures: ProcedureType[]
    archivedCount: number
  }>(
    async (sb) => {
      let procedureQuery = sb
        .from('procedure_types')
        .select(`
          id, name, body_region_id, technique_id, procedure_category_id,
          implant_category, is_active, deleted_at, deleted_by,
          body_regions (id, name, display_name),
          procedure_techniques (id, name, display_name),
          procedure_categories (id, name, display_name, body_region_id)
        `)
        .eq('facility_id', effectiveFacilityId!)

      if (showArchived) {
        procedureQuery = procedureQuery.not('deleted_at', 'is', null)
      } else {
        procedureQuery = procedureQuery.is('deleted_at', null)
      }
      procedureQuery = procedureQuery.order('name')

      const archivedCountQuery = sb
        .from('procedure_types')
        .select('id', { count: 'exact', head: true })
        .eq('facility_id', effectiveFacilityId!)
        .not('deleted_at', 'is', null)

      const [proceduresResult, archivedResult] = await Promise.all([procedureQuery, archivedCountQuery])
      if (proceduresResult.error) throw proceduresResult.error

      return {
        procedures: (proceduresResult.data as ProcedureType[]) || [],
        archivedCount: archivedResult.count || 0,
      }
    },
    { deps: [effectiveFacilityId, showArchived], enabled: !userLoading && !!effectiveFacilityId }
  )

  const procedures = procData?.procedures || []
  const archivedCount = procData?.archivedCount || 0

  // Helper to update procedures optimistically
  const setProcedures = (updater: ProcedureType[] | ((prev: ProcedureType[]) => ProcedureType[])) => {
    setProcData(prev => {
      const currentProcs = prev?.procedures || []
      const newProcs = typeof updater === 'function' ? updater(currentProcs) : updater
      return { procedures: newProcs, archivedCount: prev?.archivedCount || 0 }
    })
  }
  const setArchivedCount = (updater: number | ((prev: number) => number)) => {
    setProcData(prev => {
      const currentCount = prev?.archivedCount || 0
      const newCount = typeof updater === 'function' ? updater(currentCount) : updater
      return { procedures: prev?.procedures || [], archivedCount: newCount }
    })
  }
  
  // UI state
  const [saving, setSaving] = useState(false)
  
  // Modal state
  const [modal, setModal] = useState<ModalState>({ isOpen: false, mode: 'add', procedure: null })
  const [deleteModal, setDeleteModal] = useState<DeleteModalState>({
    isOpen: false,
    procedure: null,
    dependencies: { cases: 0, milestoneConfigs: 0 },
    loading: false
  })
  
  // Form state
  const [formData, setFormData] = useState({ 
    name: '', 
    body_region_id: '', 
    technique_id: '', 
    procedure_category_id: '',
    implant_category: '' 
  })

  // =====================================================
  // MODAL HANDLERS
  // =====================================================

  const openAddModal = () => {
    setFormData({ name: '', body_region_id: '', technique_id: '', procedure_category_id: '', implant_category: '' })
    setModal({ isOpen: true, mode: 'add', procedure: null })
  }

  const openEditModal = (procedure: ProcedureType) => {
    setFormData({
      name: procedure.name,
      body_region_id: procedure.body_region_id || '',
      technique_id: procedure.technique_id || '',
      procedure_category_id: procedure.procedure_category_id || '',
      implant_category: procedure.implant_category || '',
    })
    setModal({ isOpen: true, mode: 'edit', procedure })
  }

  const closeModal = () => {
    setModal({ isOpen: false, mode: 'add', procedure: null })
    setFormData({ name: '', body_region_id: '', technique_id: '', procedure_category_id: '', implant_category: '' })
  }

  // =====================================================
  // SAVE HANDLER
  // =====================================================

  const handleSave = async () => {
    if (!formData.name.trim() || !effectiveFacilityId) return
    
    setSaving(true)

    try {
      if (modal.mode === 'add') {
        const { data, error } = await supabase
          .from('procedure_types')
          .insert({
            name: formData.name.trim(),
            facility_id: effectiveFacilityId,
            body_region_id: formData.body_region_id || null,
            technique_id: formData.technique_id || null,
            procedure_category_id: formData.procedure_category_id || null,
            implant_category: formData.implant_category || null,
            is_active: true,
          })
          .select(`
            id, 
            name, 
            body_region_id,
            technique_id,
            procedure_category_id,
            implant_category,
            is_active,
            deleted_at,
            deleted_by,
            body_regions (id, name, display_name),
            procedure_techniques (id, name, display_name),
            procedure_categories (id, name, display_name, body_region_id)
          `)
          .single()

        if (error) throw error

        setProcedures([...procedures, data as ProcedureType].sort((a, b) => a.name.localeCompare(b.name)))
        closeModal()
        showToast({ type: 'success', title: 'Procedure created successfully' })
        
        await procedureAudit.created(supabase, formData.name.trim(), data.id)
      } else if (modal.mode === 'edit' && modal.procedure) {
        const oldName = modal.procedure.name
        
        const { data, error } = await supabase
          .from('procedure_types')
          .update({
            name: formData.name.trim(),
            body_region_id: formData.body_region_id || null,
            technique_id: formData.technique_id || null,
            procedure_category_id: formData.procedure_category_id || null,
            implant_category: formData.implant_category || null,
          })
          .eq('id', modal.procedure.id)
          .select(`
            id, 
            name, 
            body_region_id,
            technique_id,
            procedure_category_id,
            implant_category,
            is_active,
            deleted_at,
            deleted_by,
            body_regions (id, name, display_name),
            procedure_techniques (id, name, display_name),
            procedure_categories (id, name, display_name, body_region_id)
          `)
          .single()

        if (error) throw error

        setProcedures(
          procedures
            .map(p => p.id === modal.procedure!.id ? data as ProcedureType : p)
            .sort((a, b) => a.name.localeCompare(b.name))
        )
        closeModal()
        showToast({ type: 'success', title: 'Procedure updated successfully' })
        
        if (oldName !== formData.name.trim()) {
          await procedureAudit.updated(supabase, modal.procedure.id, oldName, formData.name.trim())
        }
      }
    } catch (err) {
      showToast({ type: 'error', title: modal.mode === 'add' ? 'Failed to create procedure' : 'Failed to update procedure', message: err instanceof Error ? err.message : 'Please try again' })
    } finally {
      setSaving(false)
    }
  }

  // =====================================================
  // DELETE HANDLERS (SOFT DELETE)
  // =====================================================

  const openDeleteModal = async (procedure: ProcedureType) => {
    setDeleteModal({
      isOpen: true,
      procedure,
      dependencies: { cases: 0, milestoneConfigs: 0 },
      loading: true
    })

    try {
      const [casesResult, configsResult] = await Promise.all([
        supabase
          .from('cases')
          .select('id', { count: 'exact', head: true })
          .eq('procedure_type_id', procedure.id),
        supabase
          .from('procedure_milestone_config')
          .select('id', { count: 'exact', head: true })
          .eq('procedure_type_id', procedure.id)
      ])

      setDeleteModal(prev => ({
        ...prev,
        dependencies: {
          cases: casesResult.count || 0,
          milestoneConfigs: configsResult.count || 0
        },
        loading: false
      }))
    } catch (err) {
      setDeleteModal(prev => ({ ...prev, loading: false }))
      showToast({ type: 'error', title: 'Failed to check dependencies' })
    }
  }

  const closeDeleteModal = () => {
    setDeleteModal({
      isOpen: false,
      procedure: null,
      dependencies: { cases: 0, milestoneConfigs: 0 },
      loading: false
    })
  }

  const handleDelete = async () => {
if (!deleteModal.procedure || !currentUserId) return
    
    setSaving(true)

    try {
      const { error } = await supabase
        .from('procedure_types')
        .update({
          deleted_at: new Date().toISOString(),
deleted_by: currentUserId
        })
        .eq('id', deleteModal.procedure.id)

      if (error) throw error

      setProcedures(procedures.filter(p => p.id !== deleteModal.procedure!.id))
      setArchivedCount(prev => prev + 1)
      showToast({ type: 'success', title: `"${deleteModal.procedure.name}" moved to archive` })
      
      await procedureAudit.deleted(supabase, deleteModal.procedure.name, deleteModal.procedure.id)
    } catch (err) {
      showToast({ type: 'error', title: 'Failed to archive procedure', message: err instanceof Error ? err.message : 'Please try again' })
    } finally {
      setSaving(false)
      closeDeleteModal()
    }
  }

  // =====================================================
  // RESTORE HANDLER
  // =====================================================

  const handleRestore = async (procedure: ProcedureType) => {
    setSaving(true)

    try {
      const { error } = await supabase
        .from('procedure_types')
        .update({
          deleted_at: null,
          deleted_by: null
        })
        .eq('id', procedure.id)

      if (error) throw error

      setProcedures(procedures.filter(p => p.id !== procedure.id))
      setArchivedCount(prev => prev - 1)
      showToast({ type: 'success', title: `"${procedure.name}" restored successfully` })
      
      await procedureAudit.restored(supabase, procedure.name, procedure.id)
    } catch (err) {
      showToast({ type: 'error', title: 'Failed to restore procedure', message: err instanceof Error ? err.message : 'Please try again' })
    } finally {
      setSaving(false)
    }
  }

  // =====================================================
  // HELPER FUNCTIONS
  // =====================================================

  const getRegionName = (procedure: ProcedureType): string => {
    if (!procedure.body_regions) return '—'
    const region = Array.isArray(procedure.body_regions) ? procedure.body_regions[0] : procedure.body_regions
    return region?.display_name || '—'
  }

  const getTechniqueName = (procedure: ProcedureType): string => {
    if (!procedure.procedure_techniques) return '—'
    const technique = Array.isArray(procedure.procedure_techniques) ? procedure.procedure_techniques[0] : procedure.procedure_techniques
    return technique?.display_name || '—'
  }

  const getCategoryName = (procedure: ProcedureType): string => {
    if (!procedure.procedure_categories) return '—'
    const category = Array.isArray(procedure.procedure_categories) ? procedure.procedure_categories[0] : procedure.procedure_categories
    return category?.display_name || '—'
  }

  const getImplantCategoryLabel = (category: string | null): string => {
    if (!category) return '—'
    const found = IMPLANT_CATEGORIES.find(c => c.value === category)
    return found?.label || '—'
  }

  const formatRelativeTime = (dateString: string): string => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return 'today'
    if (diffDays === 1) return 'yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
    return `${Math.floor(diffDays / 365)} years ago`
  }

  // Filter categories based on selected body region
  const filteredCategories = formData.body_region_id
    ? procedureCategories.filter(c => !c.body_region_id || c.body_region_id === formData.body_region_id)
    : procedureCategories

  // Filter procedures by search query
  const filteredProcedures = searchQuery
    ? procedures.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : procedures

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <DashboardLayout>
      <Container className="py-8">
          <ErrorBanner message={error} />
        <SettingsLayout
          title="Procedure Types"
          description="Manage the procedure types available at your facility."
        >
          {loading || userLoading ? (
            <PageLoader message="Loading procedures..." />
          ) : !effectiveFacilityId ? (
            <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
              <p className="text-slate-500">No facility selected</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-200">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-medium text-slate-900">
                      {showArchived ? 'Archived Procedures' : 'Procedures'}
                    </h3>
                    <p className="text-sm text-slate-500">
                      {showArchived 
                        ? `${procedures.length} archived procedure${procedures.length !== 1 ? 's' : ''}`
                        : `${procedures.length} active procedure${procedures.length !== 1 ? 's' : ''}`
                      }
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Archive Toggle */}
                    <button
                      onClick={() => setShowArchived(!showArchived)}
                      className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                        showArchived
                          ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <Archive className="w-4 h-4" />
                      {showArchived ? 'View Active' : `Archive (${archivedCount})`}
                    </button>

                    {/* Add Button (only when viewing active) */}
                    {!showArchived && (
                      <Button onClick={openAddModal}>
                        <Plus className="w-4 h-4" />
                        Add Procedure
                      </Button>
                    )}
                  </div>
                </div>

                {/* Search (show if more than 5 items) */}
                {procedures.length > 5 && (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search procedures..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                    />
                  </div>
                )}
              </div>

              {/* Table */}
              {filteredProcedures.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  {searchQuery ? (
                    <p className="text-slate-500">No procedures match "{searchQuery}"</p>
                  ) : showArchived ? (
                    <p className="text-slate-500">No archived procedures.</p>
                  ) : (
                    <>
                      <p className="text-slate-500">No procedures defined yet.</p>
                      <button
                        onClick={openAddModal}
                        className="mt-2 text-blue-600 hover:underline text-sm"
                      >
                        Add your first procedure
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  {/* Table Header */}
                  <div className={`grid gap-4 px-6 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider ${
                    showArchived ? 'grid-cols-10' : 'grid-cols-12'
                  }`}>
                    <div className={showArchived ? 'col-span-3' : 'col-span-3'}>Procedure Name</div>
                    <div className="col-span-2">Body Region</div>
                    <div className="col-span-2">Category</div>
                    {!showArchived && <div className="col-span-2">Technique</div>}
                    {!showArchived && <div className="col-span-2">Implant Tracking</div>}
                    {showArchived && <div className="col-span-2">Archived</div>}
                    <div className="col-span-1 text-right">Actions</div>
                  </div>

                  {/* Table Body */}
                  <div className="divide-y divide-slate-100">
                    {filteredProcedures.map((procedure) => (
                      <div 
                        key={procedure.id} 
                        className={`grid gap-4 px-6 py-4 items-center transition-colors ${
                          showArchived 
                            ? 'grid-cols-10 bg-amber-50/50' 
                            : 'grid-cols-12 hover:bg-slate-50'
                        }`}
                      >
                        {/* Procedure Name */}
                        <div className={showArchived ? 'col-span-3' : 'col-span-3'}>
                          <p className={`font-medium ${showArchived ? 'text-slate-500' : 'text-slate-900'}`}>
                            {procedure.name}
                          </p>
                          {showArchived && (
                            <span className="inline-flex items-center mt-1 px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700">
                              Archived
                            </span>
                          )}
                        </div>

                        {/* Body Region */}
                        <div className="col-span-2">
                          <span className={`text-sm ${showArchived ? 'text-slate-400' : 'text-slate-600'}`}>
                            {getRegionName(procedure)}
                          </span>
                        </div>

                        {/* Category */}
                        <div className="col-span-2">
                          {procedure.procedure_category_id ? (
                            <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${
                              showArchived 
                                ? 'bg-slate-100 text-slate-500' 
                                : 'bg-emerald-100 text-emerald-700'
                            }`}>
                              {getCategoryName(procedure)}
                            </span>
                          ) : (
                            <span className="text-sm text-slate-400">—</span>
                          )}
                        </div>

                        {/* Technique (active view only) */}
                        {!showArchived && (
                          <div className="col-span-2">
                            <span className="text-sm text-slate-600">{getTechniqueName(procedure)}</span>
                          </div>
                        )}

                        {/* Implant Tracking (active view only) */}
                        {!showArchived && (
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
                        )}

                        {/* Archived Date (archived view only) */}
                        {showArchived && procedure.deleted_at && (
                          <div className="col-span-2">
                            <span className="text-sm text-slate-400">
                              {formatRelativeTime(procedure.deleted_at)}
                            </span>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="col-span-1 flex items-center justify-end gap-1">
                          {showArchived ? (
                            /* Restore Button */
                            <button
                              onClick={() => handleRestore(procedure)}
                              disabled={saving}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50"
                            >
                              <Undo2 className="w-4 h-4" />
                              Restore
                            </button>
                          ) : (
                            /* Edit & Delete Buttons */
                            <>
                              <button
                                onClick={() => openEditModal(procedure)}
                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Edit"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => openDeleteModal(procedure)}
                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Archive"
                              >
                                <Archive className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =====================================================
              ADD/EDIT MODAL
              ===================================================== */}
          <Modal
            open={modal.isOpen}
            onClose={closeModal}
            title={modal.mode === 'add' ? 'Add Procedure' : 'Edit Procedure'}
          >
            <div>
              <Label htmlFor="procName">Procedure Name *</Label>
              <Input
                id="procName"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Total Hip Replacement"
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="bodyRegion">Body Region</Label>
              <Select
                id="bodyRegion"
                value={formData.body_region_id}
                onChange={(e) => setFormData({ ...formData, body_region_id: e.target.value })}
              >
                <option value="">Select region...</option>
                {bodyRegions.map((region) => (
                  <option key={region.id} value={region.id}>
                    {region.display_name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="procCategory">Procedure Category</Label>
              <Select
                id="procCategory"
                value={formData.procedure_category_id}
                onChange={(e) => setFormData({ ...formData, procedure_category_id: e.target.value })}
              >
                <option value="">Select category...</option>
                {filteredCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.display_name}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-slate-500 mt-1.5">
                Used for analytics grouping and comparisons
              </p>
            </div>
            <div>
              <Label htmlFor="technique">Technique</Label>
              <Select
                id="technique"
                value={formData.technique_id}
                onChange={(e) => setFormData({ ...formData, technique_id: e.target.value })}
              >
                <option value="">Select technique...</option>
                {techniques.map((technique) => (
                  <option key={technique.id} value={technique.id}>
                    {technique.display_name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="implant">Implant Tracking</Label>
              <Select
                id="implant"
                value={formData.implant_category}
                onChange={(e) => setFormData({ ...formData, implant_category: e.target.value })}
              >
                {IMPLANT_CATEGORIES.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-slate-500 mt-1.5">
                Enable implant size tracking for hip or knee procedures
              </p>
            </div>
            <Modal.Footer>
              <Modal.Cancel onClick={closeModal} />
              <Modal.Action
                onClick={handleSave}
                loading={saving}
                disabled={!formData.name.trim()}
              >
                {modal.mode === 'add' ? 'Add Procedure' : 'Save Changes'}
              </Modal.Action>
            </Modal.Footer>
          </Modal>

          {/* =====================================================
              DELETE CONFIRMATION MODAL
              ===================================================== */}
          <Modal
            open={deleteModal.isOpen && !!deleteModal.procedure}
            onClose={closeDeleteModal}
            title="Archive Procedure"
          >
            {deleteModal.loading ? (
              <div className="flex items-center justify-center py-8">
                <Spinner size="md" color="blue" />
              </div>
            ) : deleteModal.procedure && (
              <>
                <p className="text-slate-600">
                  Are you sure you want to archive <span className="font-semibold text-slate-900">"{deleteModal.procedure.name}"</span>?
                </p>

                {/* Dependency Warning */}
                {(deleteModal.dependencies.cases > 0 || deleteModal.dependencies.milestoneConfigs > 0) && (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-amber-800">This procedure is in use:</p>
                        <ul className="mt-1 text-sm text-amber-700 list-disc list-inside">
                          {deleteModal.dependencies.cases > 0 && (
                            <li>{deleteModal.dependencies.cases} case{deleteModal.dependencies.cases !== 1 ? 's' : ''}</li>
                          )}
                          {deleteModal.dependencies.milestoneConfigs > 0 && (
                            <li>{deleteModal.dependencies.milestoneConfigs} milestone configuration{deleteModal.dependencies.milestoneConfigs !== 1 ? 's' : ''}</li>
                          )}
                        </ul>
                        <p className="mt-2 text-sm text-amber-700">
                          Archiving will hide it from new cases but existing data will be preserved.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <p className="text-sm text-slate-500">
                  You can restore archived procedures at any time.
                </p>
              </>
            )}
            <Modal.Footer>
              <Modal.Cancel onClick={closeDeleteModal} />
              <Modal.Action
                onClick={handleDelete}
                loading={saving}
                disabled={deleteModal.loading}
                variant="danger"
              >
                Archive Procedure
              </Modal.Action>
            </Modal.Footer>
          </Modal>

          {/* =====================================================
              TOAST NOTIFICATION
              ===================================================== */}
        </SettingsLayout>
      </Container>
    </DashboardLayout>
  )
}