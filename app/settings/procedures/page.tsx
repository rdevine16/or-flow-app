'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../../lib/supabase'
import DashboardLayout from '../../../components/layouts/DashboardLayout'
import Container from '../../../components/ui/Container'
import SettingsLayout from '../../../components/settings/SettingsLayout'
import { procedureAudit } from '../../../lib/audit-logger'

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

interface ProcedureType {
  id: string
  name: string
  body_region_id: string | null
  technique_id: string | null
  implant_category: string | null
  body_regions: BodyRegion[] | null
  procedure_techniques: ProcedureTechnique[] | null
}

interface Facility {
  id: string
  name: string
}

interface ModalState {
  isOpen: boolean
  mode: 'add' | 'edit'
  procedure: ProcedureType | null
}

const IMPLANT_CATEGORIES = [
  { value: '', label: 'None' },
  { value: 'total_hip', label: 'Total Hip' },
  { value: 'total_knee', label: 'Total Knee' },
]

export default function ProceduresSettingsPage() {
  const supabase = createClient()
  const [procedures, setProcedures] = useState<ProcedureType[]>([])
  const [bodyRegions, setBodyRegions] = useState<BodyRegion[]>([])
  const [techniques, setTechniques] = useState<ProcedureTechnique[]>([])
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<ModalState>({ isOpen: false, mode: 'add', procedure: null })
  const [formData, setFormData] = useState({ name: '', body_region_id: '', technique_id: '', implant_category: '' })
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null)
  const [isGlobalAdmin, setIsGlobalAdmin] = useState(false)

  useEffect(() => {
    fetchCurrentUser()
  }, [])

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: userData } = await supabase
        .from('users')
        .select('facility_id, access_level')
        .eq('id', user.id)
        .single()

      if (userData) {
        const isGlobal = userData.access_level === 'global_admin'
        setIsGlobalAdmin(isGlobal)

        if (isGlobal) {
          // Fetch all facilities for global admin
          const { data: facilitiesData } = await supabase
            .from('facilities')
            .select('id, name')
            .order('name')

          if (facilitiesData && facilitiesData.length > 0) {
            setFacilities(facilitiesData)
            setSelectedFacilityId(facilitiesData[0].id)
            fetchData(facilitiesData[0].id)
          } else {
            setLoading(false)
          }
        } else {
          // Regular user - use their facility
          setSelectedFacilityId(userData.facility_id)
          fetchData(userData.facility_id)
        }
      }
    }
  }

  const fetchData = async (facilityId: string) => {
    setLoading(true)

    const [proceduresResult, regionsResult, techniquesResult] = await Promise.all([
      supabase
        .from('procedure_types')
        .select(`
          id, 
          name, 
          body_region_id,
          technique_id,
          implant_category,
          body_regions (id, name, display_name),
          procedure_techniques (id, name, display_name)
        `)
        .eq('facility_id', facilityId)
        .order('name'),
      supabase.from('body_regions').select('id, name, display_name').order('display_name'),
      supabase.from('procedure_techniques').select('id, name, display_name').order('display_name'),
    ])

    setProcedures(proceduresResult.data as ProcedureType[] || [])
    setBodyRegions(regionsResult.data || [])
    setTechniques(techniquesResult.data || [])
    setLoading(false)
  }

  const handleFacilityChange = (facilityId: string) => {
    setSelectedFacilityId(facilityId)
    fetchData(facilityId)
  }

  const openAddModal = () => {
    setFormData({ name: '', body_region_id: '', technique_id: '', implant_category: '' })
    setModal({ isOpen: true, mode: 'add', procedure: null })
  }

  const openEditModal = (procedure: ProcedureType) => {
    setFormData({
      name: procedure.name,
      body_region_id: procedure.body_region_id || '',
      technique_id: procedure.technique_id || '',
      implant_category: procedure.implant_category || '',
    })
    setModal({ isOpen: true, mode: 'edit', procedure })
  }

  const closeModal = () => {
    setModal({ isOpen: false, mode: 'add', procedure: null })
    setFormData({ name: '', body_region_id: '', technique_id: '', implant_category: '' })
  }

  const handleSave = async () => {
    if (!formData.name.trim() || !selectedFacilityId) return
    
    setSaving(true)

    if (modal.mode === 'add') {
      const { data, error } = await supabase
        .from('procedure_types')
        .insert({
          name: formData.name.trim(),
          facility_id: selectedFacilityId,
          body_region_id: formData.body_region_id || null,
          technique_id: formData.technique_id || null,
          implant_category: formData.implant_category || null,
        })
        .select(`
          id, 
          name, 
          body_region_id,
          technique_id,
          implant_category,
          body_regions (id, name, display_name),
          procedure_techniques (id, name, display_name)
        `)
        .single()

      if (!error && data) {
        setProcedures([...procedures, data as ProcedureType].sort((a, b) => a.name.localeCompare(b.name)))
        closeModal()
        
        // Audit log
        await procedureAudit.created(supabase, formData.name.trim(), data.id)
      }
    } else if (modal.mode === 'edit' && modal.procedure) {
      const oldName = modal.procedure.name
      
      const { data, error } = await supabase
        .from('procedure_types')
        .update({
          name: formData.name.trim(),
          body_region_id: formData.body_region_id || null,
          technique_id: formData.technique_id || null,
          implant_category: formData.implant_category || null,
        })
        .eq('id', modal.procedure.id)
        .select(`
          id, 
          name, 
          body_region_id,
          technique_id,
          implant_category,
          body_regions (id, name, display_name),
          procedure_techniques (id, name, display_name)
        `)
        .single()

      if (!error && data) {
        setProcedures(
          procedures
            .map(p => p.id === modal.procedure!.id ? data as ProcedureType : p)
            .sort((a, b) => a.name.localeCompare(b.name))
        )
        closeModal()
        
        // Audit log if name changed
        if (oldName !== formData.name.trim()) {
          await procedureAudit.updated(supabase, modal.procedure.id, oldName, formData.name.trim())
        }
      }
    }

    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    // Get procedure name for audit log
    const procedure = procedures.find(p => p.id === id)
    const procedureName = procedure?.name || ''

    const { error } = await supabase
      .from('procedure_types')
      .delete()
      .eq('id', id)

    if (!error) {
      setProcedures(procedures.filter(p => p.id !== id))
      
      // Audit log
      await procedureAudit.deleted(supabase, procedureName, id)
    } else {
      alert('Cannot delete this procedure type. It may be in use by existing cases.')
    }
    setDeleteConfirm(null)
  }

  // Helper to safely get nested data
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

  const getImplantCategoryLabel = (category: string | null): string => {
    if (!category) return '—'
    const found = IMPLANT_CATEGORIES.find(c => c.value === category)
    return found?.label || '—'
  }

  const selectedFacility = facilities.find(f => f.id === selectedFacilityId)

  return (
    <DashboardLayout>
      <Container className="py-8">
        <SettingsLayout
          title="Procedure Types"
          description={isGlobalAdmin 
            ? "Manage procedure types across all facilities." 
            : "Manage the procedure types available at your facility."
          }
        >
          {/* Facility Selector (Global Admin Only) */}
          {isGlobalAdmin && facilities.length > 0 && (
            <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Select Facility
              </label>
              <select
                value={selectedFacilityId || ''}
                onChange={(e) => handleFacilityChange(e.target.value)}
                className="w-full md:w-80 px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
              >
                {facilities.map((facility) => (
                  <option key={facility.id} value={facility.id}>
                    {facility.name}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-slate-500">
                Managing procedures for: <span className="font-medium text-slate-700">{selectedFacility?.name}</span>
              </p>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <svg className="animate-spin h-8 w-8 text-blue-500" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          ) : !selectedFacilityId ? (
            <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
              <p className="text-slate-500">No facility selected</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-slate-900">Procedures</h3>
                  <p className="text-sm text-slate-500">{procedures.length} procedure types</p>
                </div>
                <button
                  onClick={openAddModal}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Procedure
                </button>
              </div>

              {/* Table */}
              {procedures.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <p className="text-slate-500">No procedures defined yet.</p>
                  <button
                    onClick={openAddModal}
                    className="mt-2 text-blue-600 hover:underline text-sm"
                  >
                    Add your first procedure
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  {/* Table Header */}
                  <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <div className="col-span-4">Procedure Name</div>
                    <div className="col-span-2">Body Region</div>
                    <div className="col-span-2">Technique</div>
                    <div className="col-span-2">Implant Tracking</div>
                    <div className="col-span-2 text-right">Actions</div>
                  </div>

                  {/* Table Body */}
                  <div className="divide-y divide-slate-100">
                    {procedures.map((procedure) => (
                      <div 
                        key={procedure.id} 
                        className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-slate-50 transition-colors"
                      >
                        {/* Procedure Name */}
                        <div className="col-span-4">
                          <p className="font-medium text-slate-900">{procedure.name}</p>
                        </div>

                        {/* Body Region */}
                        <div className="col-span-2">
                          <span className="text-sm text-slate-600">{getRegionName(procedure)}</span>
                        </div>

                        {/* Technique */}
                        <div className="col-span-2">
                          <span className="text-sm text-slate-600">{getTechniqueName(procedure)}</span>
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

                        {/* Actions */}
                        <div className="col-span-2 flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditModal(procedure)}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          {deleteConfirm === procedure.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleDelete(procedure.id)}
                                className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(null)}
                                className="px-2 py-1 bg-slate-200 text-slate-700 text-xs rounded hover:bg-slate-300"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirm(procedure.id)}
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Modal */}
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
        </SettingsLayout>
      </Container>
    </DashboardLayout>
  )
}
