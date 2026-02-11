// app/settings/implant-companies/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import SettingsLayout from '@/components/settings/SettingsLayout'
import { implantCompanyAudit } from '@/lib/audit-logger'
import { ArchiveConfirm } from '@/components/ui/ConfirmDialog'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { PageLoader } from '@/components/ui/Loading'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Archive, Building2, Check, Pencil, Plus, Search, X } from 'lucide-react'

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
  const [companies, setCompanies] = useState<ImplantCompany[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [facilityId, setFacilityId] = useState<string | null>(null)
  const [modal, setModal] = useState<ModalState>({ isOpen: false, mode: 'add', company: null })
  const [formData, setFormData] = useState({ name: '' })
  const [saving, setSaving] = useState(false)
  const [archiveTarget, setArchiveTarget] = useState<ImplantCompany | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
// Archive toggle
  const [showArchived, setShowArchived] = useState(false)
  const [archivedCount, setArchivedCount] = useState(0)

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Current user for deleted_by tracking
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }
  useEffect(() => {
    fetchData()
  }, [showArchived])

const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setCurrentUserId(user.id)

      const { data: userData, error: userErr } = await supabase
        .from('users')
        .select('facility_id')
        .eq('id', user.id)
        .single()

      if (userErr) throw userErr

      if (userData) {
        setFacilityId(userData.facility_id)
      }

      let query = supabase
        .from('implant_companies')
        .select('*')

      if (showArchived) {
        query = query
          .eq('facility_id', userData?.facility_id)
          .not('deleted_at', 'is', null)
      } else {
        query = query
          .or(`facility_id.is.null,facility_id.eq.${userData?.facility_id}`)
          .is('deleted_at', null)
      }

      const { data, error: fetchErr } = await query.order('name')
      if (fetchErr) throw fetchErr
      setCompanies(data || [])

      const { count } = await supabase
        .from('implant_companies')
        .select('id', { count: 'exact', head: true })
        .eq('facility_id', userData?.facility_id)
        .not('deleted_at', 'is', null)

      setArchivedCount(count || 0)
    } catch (err) {
      setError('Failed to load implant companies. Please try again.')
    } finally {
      setLoading(false)
    }
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

    try {
      if (modal.mode === 'add') {
        const { data, error } = await supabase
          .from('implant_companies')
          .insert({
            name: formData.name.trim(),
            facility_id: facilityId,
          })
          .select()
          .single()

        if (error) throw error

        setCompanies([...companies, data].sort((a, b) => a.name.localeCompare(b.name)))
        closeModal()
        await implantCompanyAudit.created(supabase, data.name, data.id, facilityId)
      } else if (modal.mode === 'edit' && modal.company) {
        const oldName = modal.company.name
        
        const { data, error } = await supabase
          .from('implant_companies')
          .update({ name: formData.name.trim() })
          .eq('id', modal.company.id)
          .select()
          .single()

        if (error) throw error

        setCompanies(companies.map(c => c.id === data.id ? data : c).sort((a, b) => a.name.localeCompare(b.name)))
        closeModal()
        await implantCompanyAudit.updated(supabase, data.id, oldName, data.name, facilityId)
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save company', 'error')
    } finally {
      setSaving(false)
    }
  }

const handleDelete = async (id: string) => {
    const company = companies.find(c => c.id === id)
    if (!company || !facilityId) return

    try {
      const { error } = await supabase
        .from('implant_companies')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: currentUserId
        })
        .eq('id', id)

      if (error) throw error

      setCompanies(companies.filter(c => c.id !== id))
      setArchivedCount(prev => prev + 1)
      setArchiveTarget(null)
      showToast(`"${company.name}" moved to archive`, 'success')
      await implantCompanyAudit.deleted(supabase, company.name, id, facilityId)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to archive company', 'error')
    }
  }

  const handleRestore = async (id: string) => {
    const company = companies.find(c => c.id === id)
    if (!company || !facilityId) return

    try {
      const { error } = await supabase
        .from('implant_companies')
        .update({
          deleted_at: null,
          deleted_by: null
        })
        .eq('id', id)

      if (error) throw error

      setCompanies(companies.filter(c => c.id !== id))
      setArchivedCount(prev => prev - 1)
      showToast(`"${company.name}" restored successfully`, 'success')
      await implantCompanyAudit.deleted(supabase, `${company.name} (restored)`, id, facilityId)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to restore company', 'error')
    }
  }

  return (
    <DashboardLayout>
      <Container className="py-8">
          <ErrorBanner message={error} onDismiss={() => setError(null)} />
        <SettingsLayout
          title="Implant Companies"
          description="Manage surgical implant vendors for case assignments."
        >
          {loading ? (
            <PageLoader message="Loading implant companies..." />
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
                      <Archive className="w-4 h-4" />
                      {showArchived ? 'View Active' : `Archive (${archivedCount})`}
                    </button>

                    {/* Add Company - hide when viewing archived */}
                    {!showArchived && (
                      <Button onClick={openAddModal}>
                        <Plus className="w-4 h-4" />
                        Add Company
                      </Button>
                    )}
                  </div>
                </div>

                {/* Search */}
                <div className="px-6 py-3 border-b border-slate-200 bg-slate-50">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
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
                      <Building2 className="w-6 h-6 text-slate-400" />
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
                              ) : (
                                <>
                                  <button
                                    onClick={() => openEditModal(company)}
                                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="Edit"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => setArchiveTarget(company)}
                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Archive"
                                  >
                                    <Archive className="w-4 h-4" />
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
          <Modal open={modal.isOpen} onClose={closeModal} title={modal.mode === 'add' ? 'Add Implant Company' : 'Edit Implant Company'}>
                <div>
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
                <Modal.Footer>
                  <Modal.Cancel onClick={closeModal} />
                  <Modal.Action onClick={handleSave} loading={saving} disabled={!formData.name.trim()}>
                    {modal.mode === 'add' ? 'Add Company' : 'Save Changes'}
                  </Modal.Action>
                </Modal.Footer>
          </Modal>
        </SettingsLayout>
      </Container>
      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-4 right-4 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50 ${
          toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {toast.type === 'success' ? (
            <Check className="w-5 h-5" />
          ) : (
            <X className="w-5 h-5" />
          )}
          {toast.message}
        </div>
      )}

      <ArchiveConfirm
        open={!!archiveTarget}
        onClose={() => setArchiveTarget(null)}
        onConfirm={async () => {
          if (archiveTarget) await handleDelete(archiveTarget.id)
        }}
        itemName={archiveTarget?.name || ''}
        itemType="implant company"
      />
    </DashboardLayout>
  )
}