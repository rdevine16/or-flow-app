'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import SettingsLayout from '@/components/settings/SettingsLayout'
import { useUser } from '@/lib/UserContext'

interface Surgeon {
  id: string
  first_name: string
  last_name: string
}

interface ProcedureType {
  id: string
  name: string
}

interface ImplantCompany {
  id: string
  name: string
  facility_id: string | null
}

interface SurgeonPreference {
  id: string
  surgeon_id: string
  procedure_type_id: string
  procedure_name: string
  companies: { id: string; name: string }[]
}

interface ModalState {
  isOpen: boolean
  mode: 'add' | 'edit'
  preferenceId?: string
}

function getFirst<T>(arr: T[] | T | null | undefined): T | null {
  if (Array.isArray(arr)) return arr[0] || null
  return arr || null
}

export default function SurgeonPreferencesPage() {
  const supabase = createClient()
  
  // Use the context - this automatically handles impersonation!
  const { effectiveFacilityId, loading: userLoading } = useUser()
  
  const [surgeons, setSurgeons] = useState<Surgeon[]>([])
  const [selectedSurgeon, setSelectedSurgeon] = useState<string | null>(null)
  const [preferences, setPreferences] = useState<SurgeonPreference[]>([])
  const [procedureTypes, setProcedureTypes] = useState<ProcedureType[]>([])
  const [implantCompanies, setImplantCompanies] = useState<ImplantCompany[]>([])
  const [loading, setLoading] = useState(true)
  const [prefsLoading, setPrefsLoading] = useState(false)
  
  // Modal state
  const [modal, setModal] = useState<ModalState>({ isOpen: false, mode: 'add' })
  const [formData, setFormData] = useState({
    procedure_type_id: '',
    company_ids: [] as string[]
  })
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  useEffect(() => {
    if (!userLoading && effectiveFacilityId) {
      fetchInitialData()
    } else if (!userLoading && !effectiveFacilityId) {
      setLoading(false)
    }
  }, [userLoading, effectiveFacilityId])

  useEffect(() => {
    if (selectedSurgeon) {
      fetchPreferences(selectedSurgeon)
    }
  }, [selectedSurgeon])

  const fetchInitialData = async () => {
    if (!effectiveFacilityId) return
    setLoading(true)

    // Fetch surgeons
    const { data: surgeonRole } = await supabase
      .from('user_roles')
      .select('id')
      .eq('name', 'surgeon')
      .single()

    if (surgeonRole) {
      const { data: surgeonsData } = await supabase
        .from('users')
        .select('id, first_name, last_name')
        .eq('facility_id', effectiveFacilityId)
        .eq('role_id', surgeonRole.id)
        .order('last_name')

      setSurgeons(surgeonsData || [])
    }

    // Fetch procedure types (global + facility)
    const { data: proceduresData } = await supabase
      .from('procedure_types')
      .select('id, name')
      .or(`facility_id.is.null,facility_id.eq.${effectiveFacilityId}`)
      .order('name')

    setProcedureTypes(proceduresData || [])

    // Fetch implant companies (global + facility)
    const { data: companiesData } = await supabase
      .from('implant_companies')
      .select('id, name, facility_id')
      .or(`facility_id.is.null,facility_id.eq.${effectiveFacilityId}`)
      .order('name')

    setImplantCompanies(companiesData || [])
    setLoading(false)
  }

  const fetchPreferences = async (surgeonId: string) => {
    setPrefsLoading(true)
    
    const { data } = await supabase
      .from('surgeon_preferences')
      .select(`
        id,
        surgeon_id,
        procedure_type_id,
        procedure_types (name),
        surgeon_preference_companies (
          implant_company_id,
          implant_companies (id, name)
        )
      `)
      .eq('surgeon_id', surgeonId)
      .order('created_at')

    const transformed: SurgeonPreference[] = (data || []).map((pref: any) => {
      const procedure = getFirst(pref.procedure_types)
      const companies = (pref.surgeon_preference_companies || []).map((spc: any) => {
        const company = getFirst(spc.implant_companies)
        return company ? { id: company.id, name: company.name } : null
      }).filter(Boolean)

      return {
        id: pref.id,
        surgeon_id: pref.surgeon_id,
        procedure_type_id: pref.procedure_type_id,
        procedure_name: procedure?.name || 'Unknown Procedure',
        companies,
      }
    })

    setPreferences(transformed)
    setPrefsLoading(false)
  }

  const openAddModal = () => {
    setFormData({ procedure_type_id: '', company_ids: [] })
    setModal({ isOpen: true, mode: 'add' })
  }

  const openEditModal = (pref: SurgeonPreference) => {
    setFormData({
      procedure_type_id: pref.procedure_type_id,
      company_ids: pref.companies.map(c => c.id)
    })
    setModal({ isOpen: true, mode: 'edit', preferenceId: pref.id })
  }

  const closeModal = () => {
    setModal({ isOpen: false, mode: 'add' })
    setFormData({ procedure_type_id: '', company_ids: [] })
  }

  const handleSave = async () => {
    if (!selectedSurgeon || !effectiveFacilityId || !formData.procedure_type_id || formData.company_ids.length === 0) return

    setSaving(true)

    if (modal.mode === 'add') {
      // Create preference
      const { data: prefData, error: prefError } = await supabase
        .from('surgeon_preferences')
        .insert({
          surgeon_id: selectedSurgeon,
          facility_id: effectiveFacilityId,
          procedure_type_id: formData.procedure_type_id,
        })
        .select('id')
        .single()

      if (prefError || !prefData) {
        console.error('Error creating preference:', prefError)
        setSaving(false)
        return
      }

      // Add companies
      const companyInserts = formData.company_ids.map(companyId => ({
        surgeon_preference_id: prefData.id,
        implant_company_id: companyId,
      }))

      await supabase.from('surgeon_preference_companies').insert(companyInserts)

    } else if (modal.mode === 'edit' && modal.preferenceId) {
      // Update preference
      await supabase
        .from('surgeon_preferences')
        .update({ procedure_type_id: formData.procedure_type_id })
        .eq('id', modal.preferenceId)

      // Delete old companies and insert new
      await supabase
        .from('surgeon_preference_companies')
        .delete()
        .eq('surgeon_preference_id', modal.preferenceId)

      const companyInserts = formData.company_ids.map(companyId => ({
        surgeon_preference_id: modal.preferenceId,
        implant_company_id: companyId,
      }))

      await supabase.from('surgeon_preference_companies').insert(companyInserts)
    }

    closeModal()
    fetchPreferences(selectedSurgeon)
    setSaving(false)
  }

  const handleDelete = async (prefId: string) => {
    // Companies will cascade delete
    await supabase.from('surgeon_preferences').delete().eq('id', prefId)
    setDeleteConfirm(null)
    if (selectedSurgeon) {
      fetchPreferences(selectedSurgeon)
    }
  }

  const toggleCompany = (companyId: string) => {
    setFormData(prev => ({
      ...prev,
      company_ids: prev.company_ids.includes(companyId)
        ? prev.company_ids.filter(id => id !== companyId)
        : [...prev.company_ids, companyId]
    }))
  }

  const selectedSurgeonData = surgeons.find(s => s.id === selectedSurgeon)

  const globalCompanies = implantCompanies.filter(c => c.facility_id === null)
  const facilityCompanies = implantCompanies.filter(c => c.facility_id !== null)

  return (
    <DashboardLayout>
      <Container className="py-8">
        <SettingsLayout
          title="Surgeon Preferences"
          description="Create quick-fill templates for surgeon + procedure combinations"
        >
          {loading || userLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Surgeon Selector */}
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Select Surgeon
                </label>
                <select
                  value={selectedSurgeon || ''}
                  onChange={(e) => setSelectedSurgeon(e.target.value || null)}
                  className="w-full max-w-md px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="">Choose a surgeon...</option>
                  {surgeons.map((surgeon) => (
                    <option key={surgeon.id} value={surgeon.id}>
                      Dr. {surgeon.first_name} {surgeon.last_name}
                    </option>
                  ))}
                </select>

                {surgeons.length === 0 && (
                  <p className="mt-3 text-sm text-slate-500">
                    No surgeons found. Add surgeons in Users & Roles first.
                  </p>
                )}
              </div>

              {/* Preferences List */}
              {selectedSurgeon && (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-slate-900">
                        Dr. {selectedSurgeonData?.first_name} {selectedSurgeonData?.last_name}'s Preferences
                      </h3>
                      <p className="text-sm text-slate-500">
                        {preferences.length} preference{preferences.length !== 1 ? 's' : ''} configured
                      </p>
                    </div>
                    <button
                      onClick={openAddModal}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add Preference
                    </button>
                  </div>

                  {prefsLoading ? (
                    <div className="p-8 text-center">
                      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                    </div>
                  ) : preferences.length === 0 ? (
                    <div className="p-8 text-center">
                      <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <p className="text-slate-500 mb-2">No preferences set up yet</p>
                      <p className="text-sm text-slate-400">
                        Add preferences to speed up case creation for this surgeon
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {preferences.map((pref) => (
                        <div key={pref.id} className="px-6 py-4 hover:bg-slate-50 transition-colors">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium text-slate-900">
                                {pref.procedure_name}
                              </p>
                              <div className="flex flex-wrap gap-2 mt-2">
                                {pref.companies.map((company) => (
                                  <span
                                    key={company.id}
                                    className="inline-flex items-center px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full"
                                  >
                                    {company.name}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => openEditModal(pref)}
                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              {deleteConfirm === pref.id ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleDelete(pref.id)}
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
                                  onClick={() => setDeleteConfirm(pref.id)}
                                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Help Text */}
              {!selectedSurgeon && surgeons.length > 0 && (
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-6">
                  <h4 className="font-medium text-slate-900 mb-2">How Surgeon Preferences Work</h4>
                  <ul className="space-y-2 text-sm text-slate-600">
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 mt-0.5">•</span>
                      Select a surgeon to view and manage their preferences
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 mt-0.5">•</span>
                      Each preference links a procedure to one or more implant companies
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 mt-0.5">•</span>
                      When creating a case, selecting a preference auto-fills the procedure and companies
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 mt-0.5">•</span>
                      Users can still modify values after selecting a preference
                    </li>
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Add/Edit Modal */}
          {modal.isOpen && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
                <div className="px-6 py-4 border-b border-slate-200">
                  <h3 className="text-lg font-semibold text-slate-900">
                    {modal.mode === 'add' ? 'Add Preference' : 'Edit Preference'}
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Link a procedure type with implant companies
                  </p>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto flex-1">
                  {/* Procedure Type */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Procedure Type
                    </label>
                    <select
                      value={formData.procedure_type_id}
                      onChange={(e) => setFormData({ ...formData, procedure_type_id: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    >
                      <option value="">Select procedure...</option>
                      {procedureTypes.map((proc) => (
                        <option key={proc.id} value={proc.id}>
                          {proc.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Implant Companies */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Implant Companies
                    </label>
                    <p className="text-sm text-slate-500 mb-3">
                      Select all companies this surgeon uses for this procedure
                    </p>

                    {globalCompanies.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Global Companies</p>
                        <div className="flex flex-wrap gap-2">
                          {globalCompanies.map((company) => (
                            <button
                              key={company.id}
                              type="button"
                              onClick={() => toggleCompany(company.id)}
                              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                                formData.company_ids.includes(company.id)
                                  ? 'bg-blue-600 text-white border-blue-600'
                                  : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300'
                              }`}
                            >
                              {company.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {facilityCompanies.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Custom Companies</p>
                        <div className="flex flex-wrap gap-2">
                          {facilityCompanies.map((company) => (
                            <button
                              key={company.id}
                              type="button"
                              onClick={() => toggleCompany(company.id)}
                              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                                formData.company_ids.includes(company.id)
                                  ? 'bg-blue-600 text-white border-blue-600'
                                  : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300'
                              }`}
                            >
                              {company.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {formData.company_ids.length > 0 && (
                      <p className="mt-3 text-sm text-blue-600">
                        {formData.company_ids.length} compan{formData.company_ids.length === 1 ? 'y' : 'ies'} selected
                      </p>
                    )}
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
                    disabled={saving || !formData.procedure_type_id || formData.company_ids.length === 0}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : modal.mode === 'add' ? 'Add Preference' : 'Save Changes'}
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
