// app/settings/procedures/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import SettingsLayout from '@/components/settings/SettingsLayout'
import { procedureAudit } from '@/lib/audit-logger'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { PageLoader } from '@/components/ui/Loading'
import { ErrorBanner } from '@/components/ui/ErrorBanner'

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
  const [procedures, setProcedures] = useState<ProcedureType[]>([])
  const [bodyRegions, setBodyRegions] = useState<BodyRegion[]>([])
  const [techniques, setTechniques] = useState<ProcedureTechnique[]>([])
  const [procedureCategories, setProcedureCategories] = useState<ProcedureCategory[]>([])
  
  // UI state
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [archivedCount, setArchivedCount] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  
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

  // Toast notification (you can replace with your toast system)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  // Get current user ID on mount
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUserId(user?.id || null)
    }
    getCurrentUser()
  }, [])
  // =====================================================
  // DATA FETCHING
  // =====================================================

  useEffect(() => {
    if (!userLoading && effectiveFacilityId) {
      fetchData()
    } else if (!userLoading && !effectiveFacilityId) {
      setLoading(false)
    }
  }, [userLoading, effectiveFacilityId, showArchived])

  const fetchData = async () => {
    if (!effectiveFacilityId) return
    setLoading(true)

    // Build procedure query based on archive toggle
    let procedureQuery = supabase
      .from('procedure_types')
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
      .eq('facility_id', effectiveFacilityId)

    if (showArchived) {
      // Show only archived
      procedureQuery = procedureQuery.not('deleted_at', 'is', null)
    } else {
      // Show only active (not deleted)
      procedureQuery = procedureQuery.is('deleted_at', null)
    }

    procedureQuery = procedureQuery.order('name')

    // Fetch archived count separately
    const archivedCountQuery = supabase
      .from('procedure_types')
      .select('id', { count: 'exact', head: true })
      .eq('facility_id', effectiveFacilityId)
      .not('deleted_at', 'is', null)

    const [proceduresResult, regionsResult, techniquesResult, categoriesResult, archivedResult] = await Promise.all([
      procedureQuery,
      supabase.from('body_regions').select('id, name, display_name').order('display_name'),
      supabase.from('procedure_techniques').select('id, name, display_name').order('display_name'),
      supabase.from('procedure_categories').select('id, name, display_name, body_region_id').order('display_name'),
      archivedCountQuery
    ])

    setProcedures(proceduresResult.data as ProcedureType[] || [])
    setBodyRegions(regionsResult.data || [])
    setTechniques(techniquesResult.data || [])
    setProcedureCategories(categoriesResult.data || [])
    setArchivedCount(archivedResult.count || 0)
    setLoading(false)
  }

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

      if (!error && data) {
        setProcedures([...procedures, data as ProcedureType].sort((a, b) => a.name.localeCompare(b.name)))
        closeModal()
        showToast({ type: 'success', title: 'Procedure created successfully' })
        
        // Audit log
        await procedureAudit.created(supabase, formData.name.trim(), data.id)
      } else {
        showToast({ type: 'error', title: 'Failed to create procedure' })
      }
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

      if (!error && data) {
        setProcedures(
          procedures
            .map(p => p.id === modal.procedure!.id ? data as ProcedureType : p)
            .sort((a, b) => a.name.localeCompare(b.name))
        )
        closeModal()
        showToast({ type: 'success', title: 'Procedure updated successfully' })
        
        // Audit log if name changed
        if (oldName !== formData.name.trim()) {
          await procedureAudit.updated(supabase, modal.procedure.id, oldName, formData.name.trim())
        }
      } else {
        showToast({ type: 'error', title: 'Failed to update procedure' })
      }
    }

    setSaving(false)
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

    // Check dependencies
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

    // Soft delete: set deleted_at and deleted_by
    const { error } = await supabase
      .from('procedure_types')
      .update({
        deleted_at: new Date().toISOString(),
deleted_by: currentUserId
      })
      .eq('id', deleteModal.procedure.id)

    if (!error) {
      setProcedures(procedures.filter(p => p.id !== deleteModal.procedure!.id))
      setArchivedCount(prev => prev + 1)
      showToast({ type: 'success', title: `"${deleteModal.procedure.name}" moved to archive` })
      
      // Audit log
      await procedureAudit.deleted(supabase, deleteModal.procedure.name, deleteModal.procedure.id)
    } else {
      showToast({ type: 'error', title: 'Failed to archive procedure' })
    }

    setSaving(false)
    closeDeleteModal()
  }

  // =====================================================
  // RESTORE HANDLER
  // =====================================================

  const handleRestore = async (procedure: ProcedureType) => {
    setSaving(true)

    const { error } = await supabase
      .from('procedure_types')
      .update({
        deleted_at: null,
        deleted_by: null
      })
      .eq('id', procedure.id)

    if (!error) {
      setProcedures(procedures.filter(p => p.id !== procedure.id))
      setArchivedCount(prev => prev - 1)
      showToast({ type: 'success', title: `"${procedure.name}" restored successfully` })
      
      // Audit log
      await procedureAudit.restored(supabase, procedure.name, procedure.id)
    } else {
      showToast({ type: 'error', title: 'Failed to restore procedure' })
    }

    setSaving(false)
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
          <ErrorBanner message={error} onDismiss={() => setError(null)} />
        <SettingsLayout
          title="Procedure Types"
          description="Manage the procedure types available at your facility."
        >
          {loading || userLoading ? (
            <div className="flex items-center justify-center py-12">
              <svg className="animate-spin h-8 w-8 text-blue-500" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
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
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                      </svg>
                      {showArchived ? 'View Active' : `Archive (${archivedCount})`}
                    </button>

                    {/* Add Button (only when viewing active) */}
                    {!showArchived && (
                      <button
                        onClick={openAddModal}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add Procedure
                      </button>
                    )}
                  </div>
                </div>

                {/* Search (show if more than 5 items) */}
                {procedures.length > 5 && (
                  <div className="relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                              </svg>
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
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => openDeleteModal(procedure)}
                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Archive"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                                </svg>
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
          {modal.isOpen && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
                <div className="px-6 py-4 border-b border-slate-200">
                  <h3 className="text-lg font-semibold text-slate-900">
                    {modal.mode === 'add' ? 'Add Procedure' : 'Edit Procedure'}
                  </h3>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Procedure Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      placeholder="e.g., Total Hip Replacement"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Body Region
                    </label>
                    <select
                      value={formData.body_region_id}
                      onChange={(e) => setFormData({ ...formData, body_region_id: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    >
                      <option value="">Select region...</option>
                      {bodyRegions.map((region) => (
                        <option key={region.id} value={region.id}>
                          {region.display_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Procedure Category
                    </label>
                    <select
                      value={formData.procedure_category_id}
                      onChange={(e) => setFormData({ ...formData, procedure_category_id: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    >
                      <option value="">Select category...</option>
                      {filteredCategories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.display_name}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-500 mt-1.5">
                      Used for analytics grouping and comparisons
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Technique
                    </label>
                    <select
                      value={formData.technique_id}
                      onChange={(e) => setFormData({ ...formData, technique_id: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    >
                      <option value="">Select technique...</option>
                      {techniques.map((technique) => (
                        <option key={technique.id} value={technique.id}>
                          {technique.display_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Implant Tracking
                    </label>
                    <select
                      value={formData.implant_category}
                      onChange={(e) => setFormData({ ...formData, implant_category: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    >
                      {IMPLANT_CATEGORIES.map((category) => (
                        <option key={category.value} value={category.value}>
                          {category.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-500 mt-1.5">
                      Enable implant size tracking for hip or knee procedures
                    </p>
                  </div>
                </div>
                <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
                  <button
                    onClick={closeModal}
                    className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || !formData.name.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : modal.mode === 'add' ? 'Add Procedure' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* =====================================================
              DELETE CONFIRMATION MODAL
              ===================================================== */}
          {deleteModal.isOpen && deleteModal.procedure && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
                <div className="px-6 py-4 border-b border-slate-200">
                  <h3 className="text-lg font-semibold text-slate-900">
                    Archive Procedure
                  </h3>
                </div>
                <div className="p-6">
                  {deleteModal.loading ? (
                    <div className="flex items-center justify-center py-8">
                      <svg className="animate-spin h-6 w-6 text-blue-500" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    </div>
                  ) : (
                    <>
                      <p className="text-slate-600 mb-4">
                        Are you sure you want to archive <span className="font-semibold text-slate-900">"{deleteModal.procedure.name}"</span>?
                      </p>

                      {/* Dependency Warning */}
                      {(deleteModal.dependencies.cases > 0 || deleteModal.dependencies.milestoneConfigs > 0) && (
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg mb-4">
                          <div className="flex gap-3">
                            <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
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
                </div>
                <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
                  <button
                    onClick={closeDeleteModal}
                    className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={saving || deleteModal.loading}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Archiving...' : 'Archive Procedure'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* =====================================================
              TOAST NOTIFICATION
              ===================================================== */}
        </SettingsLayout>
      </Container>
    </DashboardLayout>
  )
}