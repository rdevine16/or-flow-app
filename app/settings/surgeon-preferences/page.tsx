// app/settings/surgeon-preferences/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import SettingsLayout from '@/components/settings/SettingsLayout'
import { useUser } from '@/lib/UserContext'
import { useSurgeons, useProcedureTypes, useImplantCompanies } from '@/hooks'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { DeleteConfirm } from '@/components/ui/ConfirmDialog'



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
  const { showToast } = useToast()
  // Use the context - this automatically handles impersonation!
  const { effectiveFacilityId, loading: userLoading } = useUser()
  
  const [selectedSurgeon, setSelectedSurgeon] = useState<string | null>(null)
  const [preferences, setPreferences] = useState<SurgeonPreference[]>([])
  const [prefsLoading, setPrefsLoading] = useState(false)
  const { data: surgeons, loading: surgeonsLoading } = useSurgeons(effectiveFacilityId)
  const { data: procedureTypes, loading: proceduresLoading } = useProcedureTypes(effectiveFacilityId)
  const { data: implantCompanies, loading: companiesLoading } = useImplantCompanies(effectiveFacilityId)
  const loading = userLoading || surgeonsLoading || proceduresLoading || companiesLoading

  
  // Modal state
  const [modal, setModal] = useState<ModalState>({ isOpen: false, mode: 'add' })
  const [formData, setFormData] = useState({
    procedure_type_id: '',
    company_ids: [] as string[]
  })
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<SurgeonPreference | null>(null)

  // PHASE 1: Closing workflow state
  const [closingWorkflow, setClosingWorkflow] = useState<'surgeon_closes' | 'pa_closes'>('surgeon_closes')
  const [closingHandoffMinutes, setClosingHandoffMinutes] = useState(0)
  const [workflowSaving, setWorkflowSaving] = useState(false)
  const [workflowSaved, setWorkflowSaved] = useState(false)

  

  // UPDATED: fetchPreferences now also fetches workflow settings
  const fetchPreferences = async (surgeonId: string) => {
    setPrefsLoading(true)
    
    // Fetch surgeon's closing workflow settings
    const { data: surgeonData } = await supabase
      .from('users')
      .select('closing_workflow, closing_handoff_minutes')
      .eq('id', surgeonId)
      .single()
    
    if (surgeonData) {
      setClosingWorkflow(surgeonData.closing_workflow || 'surgeon_closes')
      setClosingHandoffMinutes(surgeonData.closing_handoff_minutes || 0)
    } else {
      // Reset to defaults if no data
      setClosingWorkflow('surgeon_closes')
      setClosingHandoffMinutes(0)
    }
    
    // Fetch preferences
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
        showToast({
  type: 'error',
  title: 'Error creating preference:',
  message: `Error creating preference: ${prefError}`
})
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
    setDeleteTarget(null)
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

  // PHASE 1: Save workflow settings
  const handleSaveWorkflow = async () => {
    if (!selectedSurgeon) return
    
    setWorkflowSaving(true)
    
    const { error } = await supabase
      .from('users')
      .update({
        closing_workflow: closingWorkflow,
        closing_handoff_minutes: closingWorkflow === 'pa_closes' ? closingHandoffMinutes : 0
      })
      .eq('id', selectedSurgeon)

    setWorkflowSaving(false)
    
    if (!error) {
      setWorkflowSaved(true)
      setTimeout(() => setWorkflowSaved(false), 2000)
    }
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

              {/* PHASE 1: Closing Workflow Section */}
              {selectedSurgeon && !prefsLoading && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-900">Closing Workflow</h3>
                      <p className="text-sm text-slate-500 mt-0.5">
                        Configure how surgical turnover time is calculated for flip rooms
                      </p>
                    </div>
                    {workflowSaved && (
                      <span className="text-sm text-emerald-600 flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Saved
                      </span>
                    )}
                  </div>
                  
                  <div className="p-5 space-y-4">
                    {/* Option 1: Surgeon closes */}
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <input
                        type="radio"
                        name="closing_workflow"
                        value="surgeon_closes"
                        checked={closingWorkflow === 'surgeon_closes'}
                        onChange={() => setClosingWorkflow('surgeon_closes')}
                        className="mt-1 w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                      />
                      <div>
                        <span className="text-sm font-medium text-slate-900 group-hover:text-blue-600">
                          Surgeon closes entirely
                        </span>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Surgical turnover measured from closing complete to next incision
                        </p>
                      </div>
                    </label>

                    {/* Option 2: PA closes */}
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <input
                        type="radio"
                        name="closing_workflow"
                        value="pa_closes"
                        checked={closingWorkflow === 'pa_closes'}
                        onChange={() => setClosingWorkflow('pa_closes')}
                        className="mt-1 w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <span className="text-sm font-medium text-slate-900 group-hover:text-blue-600">
                          PA closes (surgeon hands off)
                        </span>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Surgical turnover measured from when surgeon leaves to next incision
                        </p>
                        
                        {/* Handoff minutes input */}
                        {closingWorkflow === 'pa_closes' && (
                          <div className="mt-3 flex items-center gap-2">
                            <label className="text-sm text-slate-600">
                              Surgeon closes for
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="30"
                              value={closingHandoffMinutes}
                              onChange={(e) => setClosingHandoffMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                              className="w-16 px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-center"
                            />
                            <span className="text-sm text-slate-600">
                              minutes before handoff
                            </span>
                          </div>
                        )}
                      </div>
                    </label>
                    
                    {/* Info box */}
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                      <p className="text-xs text-blue-700">
                        <strong>Tip:</strong> If staff records a "Surgeon Left" milestone during a case, 
                        it will override this setting for that specific case.
                      </p>
                    </div>

                    {/* Save button */}
                    <div className="pt-2">
                      <button
                        onClick={handleSaveWorkflow}
                        disabled={workflowSaving}
                        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {workflowSaving ? 'Saving...' : 'Save Workflow Settings'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

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
                              <button
                                  onClick={() => setDeleteTarget(pref)}
                                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
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

      <DeleteConfirm
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget) await handleDelete(deleteTarget.id)
        }}
        itemName={deleteTarget?.procedure_name || ''}
        itemType="surgeon preference"
      />
    </DashboardLayout>
  )
}