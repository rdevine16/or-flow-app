'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import SettingsLayout from '@/components/settings/SettingsLayout'
import { delayTypeAudit } from '@/lib/audit-logger'

interface DelayType {
  id: string
  name: string
  display_name: string
  facility_id: string | null
  display_order: number
}

interface ModalState {
  isOpen: boolean
  mode: 'add' | 'edit'
  delayType: DelayType | null
}

export default function DelayTypesPage() {
  const supabase = createClient()
  const [delayTypes, setDelayTypes] = useState<DelayType[]>([])
  const [loading, setLoading] = useState(true)
  const [facilityId, setFacilityId] = useState<string | null>(null)
  const [modal, setModal] = useState<ModalState>({ isOpen: false, mode: 'add', delayType: null })
  const [formData, setFormData] = useState({ name: '', display_name: '' })
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

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

    // Fetch all delay types (global + facility-specific)
    const { data } = await supabase
      .from('delay_types')
      .select('*')
      .or(`facility_id.is.null,facility_id.eq.${userData?.facility_id}`)
      .order('display_order')

    setDelayTypes(data || [])
    setLoading(false)
  }

  const globalCount = delayTypes.filter(dt => dt.facility_id === null).length
  const customCount = delayTypes.filter(dt => dt.facility_id !== null).length

  const openAddModal = () => {
    setFormData({ name: '', display_name: '' })
    setModal({ isOpen: true, mode: 'add', delayType: null })
  }

  const openEditModal = (delayType: DelayType) => {
    setFormData({ name: delayType.name, display_name: delayType.display_name })
    setModal({ isOpen: true, mode: 'edit', delayType })
  }

  const closeModal = () => {
    setModal({ isOpen: false, mode: 'add', delayType: null })
    setFormData({ name: '', display_name: '' })
  }

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.display_name.trim() || !facilityId) return
    
    setSaving(true)

    // Convert display_name to snake_case for name field
    const nameValue = formData.name.trim().toLowerCase().replace(/\s+/g, '_')

    if (modal.mode === 'add') {
      const { data, error } = await supabase
        .from('delay_types')
        .insert({
          name: nameValue,
          display_name: formData.display_name.trim(),
          facility_id: facilityId,
          display_order: 100, // Custom ones at the end
        })
        .select()
        .single()

      if (!error && data) {
        setDelayTypes([...delayTypes, data].sort((a, b) => a.display_order - b.display_order))
        closeModal()
        
        // Audit log
        await delayTypeAudit.created(supabase, data.display_name, data.id, facilityId)
      }
    } else if (modal.mode === 'edit' && modal.delayType) {
      const oldName = modal.delayType.display_name
      
      const { data, error } = await supabase
        .from('delay_types')
        .update({
          name: nameValue,
          display_name: formData.display_name.trim(),
        })
        .eq('id', modal.delayType.id)
        .select()
        .single()

      if (!error && data) {
        setDelayTypes(delayTypes.map(dt => dt.id === data.id ? data : dt))
        closeModal()
        
        // Audit log
        await delayTypeAudit.updated(supabase, data.id, oldName, data.display_name, facilityId)
      }
    }

    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    const delayType = delayTypes.find(dt => dt.id === id)
    if (!delayType || !facilityId) return

    const { error } = await supabase
      .from('delay_types')
      .delete()
      .eq('id', id)

    if (!error) {
      setDelayTypes(delayTypes.filter(dt => dt.id !== id))
      setDeleteConfirm(null)
      
      // Audit log
      await delayTypeAudit.deleted(supabase, delayType.display_name, id, facilityId)
    }
  }

  return (
    <DashboardLayout>
      <Container className="py-8">
        <SettingsLayout
          title="Delay Types"
          description="Categorize and track reasons for surgical delays."
        >
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <svg className="animate-spin h-8 w-8 text-blue-500" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-slate-900">Delay Types</h3>
                  <p className="text-sm text-slate-500">
                    {globalCount} global · {customCount} custom
                  </p>
                </div>
                <button
                  onClick={openAddModal}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Delay Type
                </button>
              </div>

              {/* Table */}
              {delayTypes.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-slate-500">No delay types configured.</p>
                  <button
                    onClick={openAddModal}
                    className="mt-2 text-blue-600 hover:underline text-sm"
                  >
                    Add your first delay type
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  {/* Table Header */}
                  <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <div className="col-span-5">Display Name</div>
                    <div className="col-span-3">System Name</div>
                    <div className="col-span-2">Type</div>
                    <div className="col-span-2 text-right">Actions</div>
                  </div>

                  {/* Table Body */}
                  <div className="divide-y divide-slate-100">
                    {delayTypes.map((delayType) => {
                      const isGlobal = delayType.facility_id === null

                      return (
                        <div 
                          key={delayType.id} 
                          className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-slate-50 transition-colors"
                        >
                          {/* Display Name */}
                          <div className="col-span-5">
                            <p className="font-medium text-slate-900">{delayType.display_name}</p>
                          </div>

                          {/* System Name */}
                          <div className="col-span-3">
                            <span className="text-sm text-slate-500 font-mono">{delayType.name}</span>
                          </div>

                          {/* Type Badge */}
                          <div className="col-span-2">
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
                          <div className="col-span-2 flex items-center justify-end gap-1">
                            {isGlobal ? (
                              <span className="text-xs text-slate-400">Read-only</span>
                            ) : deleteConfirm === delayType.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleDelete(delayType.id)}
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
                                  onClick={() => openEditModal(delayType)}
                                  className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="Edit"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => setDeleteConfirm(delayType.id)}
                                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Delete"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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
          )}

          {/* Modal */}
          {modal.isOpen && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
                <div className="px-6 py-4 border-b border-slate-200">
                  <h3 className="text-lg font-semibold text-slate-900">
                    {modal.mode === 'add' ? 'Add Delay Type' : 'Edit Delay Type'}
                  </h3>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Display Name *
                    </label>
                    <input
                      type="text"
                      value={formData.display_name}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        display_name: e.target.value,
                        name: e.target.value.toLowerCase().replace(/\s+/g, '_')
                      })}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      placeholder="e.g., Waiting for Interpreter"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      System Name
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      readOnly
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-500 font-mono text-sm"
                      placeholder="waiting_for_interpreter"
                    />
                    <p className="mt-1.5 text-xs text-slate-500">Auto-generated from display name</p>
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
                    disabled={saving || !formData.display_name.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : modal.mode === 'add' ? 'Add Delay Type' : 'Save Changes'}
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