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

  const globalDelayTypes = delayTypes.filter(dt => dt.facility_id === null)
  const facilityDelayTypes = delayTypes.filter(dt => dt.facility_id !== null)

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
        setDelayTypes([...delayTypes, data])
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
          description="Categorize and track reasons for surgical delays"
        >
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Global Delay Types */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-slate-200 text-slate-600 text-xs font-medium rounded">
                      Global
                    </span>
                    <h3 className="font-medium text-slate-900">Standard Delay Types</h3>
                  </div>
                  <p className="text-sm text-slate-500 mt-1">
                    These delay types are available to all facilities and cannot be edited
                  </p>
                </div>

                <div className="divide-y divide-slate-100">
                  {globalDelayTypes.map((delayType) => (
                    <div key={delayType.id} className="px-6 py-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-slate-900">{delayType.display_name}</p>
                        <p className="text-xs text-slate-400">{delayType.name}</p>
                      </div>
                      <span className="text-xs text-slate-400">Read-only</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Facility Delay Types */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                        Custom
                      </span>
                      <h3 className="font-medium text-slate-900">Facility Delay Types</h3>
                    </div>
                    <p className="text-sm text-slate-500 mt-1">
                      Custom delay types specific to your facility
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

                {facilityDelayTypes.length === 0 ? (
                  <div className="px-6 py-8 text-center">
                    <p className="text-slate-500">No custom delay types defined</p>
                    <button
                      onClick={openAddModal}
                      className="mt-2 text-blue-600 hover:underline text-sm"
                    >
                      Add your first custom delay type
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {facilityDelayTypes.map((delayType) => (
                      <div key={delayType.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                        <div>
                          <p className="font-medium text-slate-900">{delayType.display_name}</p>
                          <p className="text-xs text-slate-400">{delayType.name}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEditModal(delayType)}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          {deleteConfirm === delayType.id ? (
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
                            <button
                              onClick={() => setDeleteConfirm(delayType.id)}
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
                      Display Name
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
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-500"
                      placeholder="waiting_for_interpreter"
                    />
                    <p className="mt-1 text-xs text-slate-400">Auto-generated from display name</p>
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
