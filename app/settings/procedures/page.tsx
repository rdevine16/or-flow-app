'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../../lib/supabase'
import DashboardLayout from '../../../components/layouts/DashboardLayout'
import Container from '../../../components/ui/Container'
import SettingsLayout from '../../../components/settings/SettingsLayout'

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
  body_regions: BodyRegion[] | null
  procedure_techniques: ProcedureTechnique[] | null
}

interface ModalState {
  isOpen: boolean
  mode: 'add' | 'edit'
  procedure: ProcedureType | null
}

export default function ProceduresSettingsPage() {
  const supabase = createClient()
  const [procedures, setProcedures] = useState<ProcedureType[]>([])
  const [bodyRegions, setBodyRegions] = useState<BodyRegion[]>([])
  const [techniques, setTechniques] = useState<ProcedureTechnique[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<ModalState>({ isOpen: false, mode: 'add', procedure: null })
  const [formData, setFormData] = useState({ name: '', body_region_id: '', technique_id: '' })
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const facilityId = 'a1111111-1111-1111-1111-111111111111'

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    
    // Fetch procedures with joined data
    const { data: proceduresData } = await supabase
      .from('procedure_types')
      .select(`
        id, 
        name, 
        body_region_id,
        technique_id,
        body_regions (id, name, display_name),
        procedure_techniques (id, name, display_name)
      `)
      .eq('facility_id', facilityId)
      .order('name')
    
    // Fetch body regions
    const { data: regionsData } = await supabase
      .from('body_regions')
      .select('id, name, display_name')
      .order('display_order')
    
    // Fetch techniques
    const { data: techniquesData } = await supabase
      .from('procedure_techniques')
      .select('id, name, display_name')
      .order('display_order')

    setProcedures(proceduresData as ProcedureType[] || [])
    setBodyRegions(regionsData || [])
    setTechniques(techniquesData || [])
    setLoading(false)
  }

  const openAddModal = () => {
    setFormData({ name: '', body_region_id: '', technique_id: '' })
    setModal({ isOpen: true, mode: 'add', procedure: null })
  }

  const openEditModal = (procedure: ProcedureType) => {
    setFormData({
      name: procedure.name,
      body_region_id: procedure.body_region_id || '',
      technique_id: procedure.technique_id || '',
    })
    setModal({ isOpen: true, mode: 'edit', procedure })
  }

  const closeModal = () => {
    setModal({ isOpen: false, mode: 'add', procedure: null })
    setFormData({ name: '', body_region_id: '', technique_id: '' })
  }

  const handleSave = async () => {
    if (!formData.name.trim()) return
    
    setSaving(true)

    if (modal.mode === 'add') {
      const { data, error } = await supabase
        .from('procedure_types')
        .insert({
          name: formData.name.trim(),
          facility_id: facilityId,
          body_region_id: formData.body_region_id || null,
          technique_id: formData.technique_id || null,
        })
        .select(`
          id, 
          name, 
          body_region_id,
          technique_id,
          body_regions (id, name, display_name),
          procedure_techniques (id, name, display_name)
        `)
        .single()

      if (!error && data) {
        setProcedures([...procedures, data as ProcedureType].sort((a, b) => a.name.localeCompare(b.name)))
        closeModal()
      }
    } else if (modal.mode === 'edit' && modal.procedure) {
      const { data, error } = await supabase
        .from('procedure_types')
        .update({
          name: formData.name.trim(),
          body_region_id: formData.body_region_id || null,
          technique_id: formData.technique_id || null,
        })
        .eq('id', modal.procedure.id)
        .select(`
          id, 
          name, 
          body_region_id,
          technique_id,
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
      }
    }

    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('procedure_types')
      .delete()
      .eq('id', id)

    if (!error) {
      setProcedures(procedures.filter(p => p.id !== id))
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

  return (
    <DashboardLayout>
      <Container className="py-8">
        <SettingsLayout
          title="Procedure Types"
          description="Manage the surgical procedures available for case creation at your facility."
        >
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <svg className="animate-spin h-8 w-8 text-blue-500" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Add Button */}
              <div className="flex justify-end">
                <button
                  onClick={openAddModal}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Procedure
                </button>
              </div>

              {/* Table */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Body Region</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Technique</th>
                      <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {procedures.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                          No procedure types yet. Click "Add Procedure" to create one.
                        </td>
                      </tr>
                    ) : (
                      procedures.map((procedure) => (
                        <tr key={procedure.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <span className="font-medium text-slate-900">{procedure.name}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`text-sm ${getRegionName(procedure) === '—' ? 'text-slate-400' : 'text-slate-600'}`}>
                              {getRegionName(procedure)}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`text-sm ${getTechniqueName(procedure) === '—' ? 'text-slate-400' : 'text-slate-600'}`}>
                              {getTechniqueName(procedure)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => openEditModal(procedure)}
                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Edit"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              </button>
                              {deleteConfirm === procedure.id ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleDelete(procedure.id)}
                                    className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    onClick={() => setDeleteConfirm(null)}
                                    className="px-2 py-1 text-xs bg-slate-200 text-slate-600 rounded hover:bg-slate-300 transition-colors"
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
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </SettingsLayout>
      </Container>

      {/* Modal */}
      {modal.isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 transition-opacity"
            onClick={closeModal}
          />
          
          {/* Modal Content */}
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md transform transition-all">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                <h3 className="text-lg font-semibold text-slate-900">
                  {modal.mode === 'add' ? 'Add Procedure Type' : 'Edit Procedure Type'}
                </h3>
                <button
                  onClick={closeModal}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Body */}
              <div className="px-6 py-4 space-y-4">
                {/* Name Field */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Procedure Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Total Hip Arthroplasty"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                    autoFocus
                  />
                </div>

                {/* Body Region Field */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Body Region
                  </label>
                  <select
                    value={formData.body_region_id}
                    onChange={(e) => setFormData({ ...formData, body_region_id: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm bg-white"
                  >
                    <option value="">Select body region...</option>
                    {bodyRegions.map((region) => (
                      <option key={region.id} value={region.id}>
                        {region.display_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Technique Field */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Technique
                  </label>
                  <select
                    value={formData.technique_id}
                    onChange={(e) => setFormData({ ...formData, technique_id: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm bg-white"
                  >
                    <option value="">Select technique...</option>
                    {techniques.map((technique) => (
                      <option key={technique.id} value={technique.id}>
                        {technique.display_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
                <button
                  onClick={closeModal}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={!formData.name.trim() || saving}
                  className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {saving && (
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  )}
                  {modal.mode === 'add' ? 'Add Procedure' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
