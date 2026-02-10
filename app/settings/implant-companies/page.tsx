// app/settings/implant-companies/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import SettingsLayout from '@/components/settings/SettingsLayout'
import { implantCompanyAudit } from '@/lib/audit-logger'
import { useToast } from '@/components/ui/Toast/ToastProvider'

interface ImplantCompany {
  id: string
  name: string
  facility_id: string | null
  created_at: string
  deleted_at: string | null
  deleted_by: string | null
}

interface ModalState {
  isOpen: boolean
  mode: 'add' | 'edit'
  company: ImplantCompany | null
}

export default function ImplantCompaniesPage() {
  const supabase = createClient()
  const { showToast } = useToast()
  const [companies, setCompanies] = useState<ImplantCompany[]>([])
  const [loading, setLoading] = useState(true)
  const [facilityId, setFacilityId] = useState<string | null>(null)
  const [modal, setModal] = useState<ModalState>({ isOpen: false, mode: 'add', company: null })
  const [formData, setFormData] = useState({ name: '' })
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
// Archive toggle
  const [showArchived, setShowArchived] = useState(false)
  const [archivedCount, setArchivedCount] = useState(0)

  // Current user for deleted_by tracking
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  useEffect(() => {
    fetchData()
  }, [showArchived])

const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    setCurrentUserId(user.id)

    const { data: userData } = await supabase
      .from('users')
      .select('facility_id')
      .eq('id', user.id)
      .single()

    if (userData) {
      setFacilityId(userData.facility_id)
    }

    // Fetch implant companies based on archive toggle
    let query = supabase
      .from('implant_companies')
      .select('*')

    if (showArchived) {
      // Show only archived custom companies (facility-specific)
      query = query
        .eq('facility_id', userData?.facility_id)
        .not('deleted_at', 'is', null)
    } else {
      // Show active: global (always) + facility-specific (not deleted)
      query = query
        .or(`facility_id.is.null,facility_id.eq.${userData?.facility_id}`)
        .is('deleted_at', null)
    }

    const { data } = await query.order('name')
    setCompanies(data || [])

    // Get archived count
    const { count } = await supabase
      .from('implant_companies')
      .select('id', { count: 'exact', head: true })
      .eq('facility_id', userData?.facility_id)
      .not('deleted_at', 'is', null)

    setArchivedCount(count || 0)
    setLoading(false)
  }

  // Filter companies by search
  const filteredCompanies = companies.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const globalCount = companies.filter(c => c.facility_id === null).length
  const customCount = companies.filter(c => c.facility_id !== null).length

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
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: currentUserId
      })
      .eq('id', id)

    if (!error) {
      setCompanies(companies.filter(c => c.id !== id))
      setArchivedCount(prev => prev + 1)
      setDeleteConfirm(null)
      showToast({ type: 'success', title: `"${company.name}" moved to archive` })
      
      // Audit log
      await implantCompanyAudit.deleted(supabase, company.name, id, facilityId)
    }
  }

  const handleRestore = async (id: string) => {
    const company = companies.find(c => c.id === id)
    if (!company || !facilityId) return

    const { error } = await supabase
      .from('implant_companies')
      .update({
        deleted_at: null,
        deleted_by: null
      })
      .eq('id', id)

    if (!error) {
      setCompanies(companies.filter(c => c.id !== id))
      setArchivedCount(prev => prev - 1)
      showToast({ type: 'success', title: `"${company.name}" restored successfully` })
      
      // Audit log (you may want to add a restored method)
      await implantCompanyAudit.deleted(supabase, `${company.name} (restored)`, id, facilityId)
    }
  }

  return (
    <DashboardLayout>
      <Container className="py-8">
        <SettingsLayout
          title="Implant Companies"
          description="Manage surgical implant vendors for case assignments."
        >
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <svg className="animate-spin h-8 w-8 text-blue-500" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Main Card */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {/* Header */}
<div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-slate-900">
                      {showArchived ? 'Archived Companies' : 'Implant Companies'}
                    </h3>
                    <p className="text-sm text-slate-500">
                      {showArchived 
                        ? `${companies.length} archived`
                        : `${globalCount} global · ${customCount} custom`
                      }
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Archive Toggle */}
                    <button
                      onClick={() => setShowArchived(!showArchived)}
                      className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
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

                    {/* Add Company - hide when viewing archived */}
                    {!showArchived && (
                      <button
                        onClick={openAddModal}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add Company
                      </button>
                    )}
                  </div>
                </div>

                {/* Search */}
                <div className="px-6 py-3 border-b border-slate-200 bg-slate-50">
                  <div className="relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search companies..."
                      className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                    />
                  </div>
                </div>

                {/* Table */}
                {filteredCompanies.length === 0 ? (
                  <div className="px-6 py-12 text-center">
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <p className="text-slate-500">
                      {searchQuery ? 'No companies match your search.' : 'No implant companies configured.'}
                    </p>
                    {!searchQuery && (
                      <button
                        onClick={openAddModal}
                        className="mt-2 text-blue-600 hover:underline text-sm"
                      >
                        Add your first company
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    {/* Table Header */}
                    <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <div className="col-span-6">Company Name</div>
                      <div className="col-span-3">Type</div>
                      <div className="col-span-3 text-right">Actions</div>
                    </div>

                    {/* Table Body */}
                    <div className="divide-y divide-slate-100">
                      {filteredCompanies.map((company) => {
                        const isGlobal = company.facility_id === null

                        return (
                          <div 
                            key={company.id} 
                            className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-slate-50 transition-colors"
                          >
                            {/* Company Name */}
                            <div className="col-span-6">
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                  isGlobal ? 'bg-slate-100' : 'bg-blue-100'
                                }`}>
                                  <span className={`text-sm font-semibold ${
                                    isGlobal ? 'text-slate-600' : 'text-blue-600'
                                  }`}>
                                    {company.name.charAt(0)}
                                  </span>
                                </div>
                                <p className="font-medium text-slate-900">{company.name}</p>
                              </div>
                            </div>

                            {/* Type Badge */}
                            <div className="col-span-3">
                              {isGlobal ? (
                                <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-600">
                                  Global
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                                  Custom
                                </span>
                              )}
                            </div>

                            {/* Actions */}
{/* Actions */}
                            <div className="col-span-3 flex items-center justify-end gap-1">
                              {showArchived ? (
                                <button
                                  onClick={() => handleRestore(company.id)}
                                  className="px-3 py-1.5 text-sm font-medium text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                >
                                  Restore
                                </button>
                              ) : isGlobal ? (
                                <span className="text-xs text-slate-400">Read-only</span>
                              ) : deleteConfirm === company.id ? (
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
                                <>
                                  <button
                                    onClick={() => openEditModal(company)}
                                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="Edit"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => setDeleteConfirm(company.id)}
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
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Info Box */}
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                <h4 className="font-medium text-slate-900 mb-2">About Implant Companies</h4>
                <p className="text-sm text-slate-600">
                  Implant companies are assigned to cases to track which vendors are involved. 
                  Device reps from these companies can be granted access to view relevant case information.
                </p>
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
                    Company Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ name: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && handleSave()}
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