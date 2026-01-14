'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import SettingsLayout from '@/components/settings/SettingsLayout'
import { implantCompanyAudit } from '@/lib/audit-logger-additions'

interface ImplantCompany {
  id: string
  name: string
  facility_id: string | null
  created_at: string
}

interface ModalState {
  isOpen: boolean
  mode: 'add' | 'edit'
  company: ImplantCompany | null
}

export default function ImplantCompaniesPage() {
  const supabase = createClient()
  const [companies, setCompanies] = useState<ImplantCompany[]>([])
  const [loading, setLoading] = useState(true)
  const [facilityId, setFacilityId] = useState<string | null>(null)
  const [modal, setModal] = useState<ModalState>({ isOpen: false, mode: 'add', company: null })
  const [formData, setFormData] = useState({ name: '' })
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: userData } = await supabase
      .from('users')
      .select('facility_id')
      .eq('id', user.id)
      .single()

    if (userData) {
      setFacilityId(userData.facility_id)
    }

    // Fetch all implant companies (global + facility-specific)
    const { data } = await supabase
      .from('implant_companies')
      .select('*')
      .or(`facility_id.is.null,facility_id.eq.${userData?.facility_id}`)
      .order('name')

    setCompanies(data || [])
    setLoading(false)
  }

  // Filter and group companies
  const filteredCompanies = companies.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const globalCompanies = filteredCompanies.filter(c => c.facility_id === null)
  const facilityCompanies = filteredCompanies.filter(c => c.facility_id !== null)

  const openAddModal = () => {
    setFormData({ name: '' })
    setModal({ isOpen: true, mode: 'add', company: null })
  }

  const openEditModal = (company: ImplantCompany) => {
    setFormData({ name: company.name })
    setModal({ isOpen: true, mode: 'edit', company })
  }

  const closeModal = () => {
    setModal({ isOpen: false, mode: 'add', company: null })
    setFormData({ name: '' })
  }

  const handleSave = async () => {
    if (!formData.name.trim() || !facilityId) return
    
    setSaving(true)

    if (modal.mode === 'add') {
      const { data, error } = await supabase
        .from('implant_companies')
        .insert({
          name: formData.name.trim(),
          facility_id: facilityId,
        })
        .select()
        .single()

      if (!error && data) {
        setCompanies([...companies, data].sort((a, b) => a.name.localeCompare(b.name)))
        closeModal()
        
        // Audit log
        await implantCompanyAudit.created(supabase, data.name, data.id, facilityId)
      }
    } else if (modal.mode === 'edit' && modal.company) {
      const oldName = modal.company.name
      
      const { data, error } = await supabase
        .from('implant_companies')
        .update({ name: formData.name.trim() })
        .eq('id', modal.company.id)
        .select()
        .single()

      if (!error && data) {
        setCompanies(companies.map(c => c.id === data.id ? data : c).sort((a, b) => a.name.localeCompare(b.name)))
        closeModal()
        
        // Audit log
        await implantCompanyAudit.updated(supabase, data.id, oldName, data.name, facilityId)
      }
    }

    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    const company = companies.find(c => c.id === id)
    if (!company || !facilityId) return

    const { error } = await supabase
      .from('implant_companies')
      .delete()
      .eq('id', id)

    if (!error) {
      setCompanies(companies.filter(c => c.id !== id))
      setDeleteConfirm(null)
      
      // Audit log
      await implantCompanyAudit.deleted(supabase, company.name, id, facilityId)
    }
  }

  return (
    <DashboardLayout>
      <Container className="py-8">
        <SettingsLayout
          title="Implant Companies"
          description="Manage surgical implant vendors for case assignments"
        >
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Search */}
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search companies..."
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              {/* Global Companies */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-slate-200 text-slate-600 text-xs font-medium rounded">
                      Global
                    </span>
                    <h3 className="font-medium text-slate-900">Standard Implant Companies</h3>
                  </div>
                  <p className="text-sm text-slate-500 mt-1">
                    Major implant vendors available to all facilities
                  </p>
                </div>

                <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                  {globalCompanies.length === 0 ? (
                    <div className="px-6 py-4 text-center text-slate-500 text-sm">
                      {searchQuery ? 'No matching global companies' : 'No global companies defined'}
                    </div>
                  ) : (
                    globalCompanies.map((company) => (
                      <div key={company.id} className="px-6 py-3 flex items-center justify-between hover:bg-slate-50">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                            <span className="text-sm font-semibold text-slate-600">
                              {company.name.charAt(0)}
                            </span>
                          </div>
                          <p className="font-medium text-slate-900">{company.name}</p>
                        </div>
                        <span className="text-xs text-slate-400">Read-only</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Facility Companies */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                        Custom
                      </span>
                      <h3 className="font-medium text-slate-900">Facility Implant Companies</h3>
                    </div>
                    <p className="text-sm text-slate-500 mt-1">
                      Additional vendors specific to your facility
                    </p>
                  </div>
                  <button
                    onClick={openAddModal}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Company
                  </button>
                </div>

                {facilityCompanies.length === 0 ? (
                  <div className="px-6 py-8 text-center">
                    <p className="text-slate-500">
                      {searchQuery ? 'No matching custom companies' : 'No custom companies defined'}
                    </p>
                    {!searchQuery && (
                      <button
                        onClick={openAddModal}
                        className="mt-2 text-blue-600 hover:underline text-sm"
                      >
                        Add a custom implant company
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {facilityCompanies.map((company) => (
                      <div key={company.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                            <span className="text-sm font-semibold text-blue-600">
                              {company.name.charAt(0)}
                            </span>
                          </div>
                          <p className="font-medium text-slate-900">{company.name}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEditModal(company)}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          {deleteConfirm === company.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleDelete(company.id)}
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
                              onClick={() => setDeleteConfirm(company.id)}
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
                )}
              </div>

              {/* Info Box */}
              <div className="bg-blue-50 rounded-xl border border-blue-100 p-4">
                <div className="flex gap-3">
                  <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-sm text-blue-900">
                    <p className="font-medium">About Implant Companies</p>
                    <p className="text-blue-700 mt-1">
                      Implant companies are assigned to cases to track which vendors are involved. 
                      Device reps from these companies can be granted access to view relevant case information.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Modal */}
          {modal.isOpen && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
                <div className="px-6 py-4 border-b border-slate-200">
                  <h3 className="text-lg font-semibold text-slate-900">
                    {modal.mode === 'add' ? 'Add Implant Company' : 'Edit Implant Company'}
                  </h3>
                </div>
                <div className="p-6">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Company Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ name: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    placeholder="e.g., Acme Medical Devices"
                    autoFocus
                  />
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
                    {saving ? 'Saving...' : modal.mode === 'add' ? 'Add Company' : 'Save Changes'}
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
