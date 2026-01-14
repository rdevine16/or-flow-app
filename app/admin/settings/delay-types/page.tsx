'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import { useUser } from '@/lib/UserContext'
import { delayTypeAudit } from '@/lib/audit-logger-additions'

interface DelayType {
  id: string
  name: string
  display_name: string
  display_order: number
  created_at: string
}

interface ModalState {
  isOpen: boolean
  mode: 'add' | 'edit'
  delayType: DelayType | null
}

export default function AdminDelayTypesPage() {
  const router = useRouter()
  const supabase = createClient()
  const { isGlobalAdmin, loading: userLoading } = useUser()

  const [delayTypes, setDelayTypes] = useState<DelayType[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<ModalState>({ isOpen: false, mode: 'add', delayType: null })
  const [formData, setFormData] = useState({ name: '', display_name: '', display_order: 0 })
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // Redirect non-admins
  useEffect(() => {
    if (!userLoading && !isGlobalAdmin) {
      router.push('/dashboard')
    }
  }, [userLoading, isGlobalAdmin, router])

  useEffect(() => {
    if (isGlobalAdmin) {
      fetchData()
    }
  }, [isGlobalAdmin])

  const fetchData = async () => {
    const { data } = await supabase
      .from('delay_types')
      .select('*')
      .is('facility_id', null)
      .order('display_order')

    setDelayTypes(data || [])
    setLoading(false)
  }

  const openAddModal = () => {
    const maxOrder = Math.max(...delayTypes.map(dt => dt.display_order), 0)
    setFormData({ name: '', display_name: '', display_order: maxOrder + 1 })
    setModal({ isOpen: true, mode: 'add', delayType: null })
  }

  const openEditModal = (delayType: DelayType) => {
    setFormData({ 
      name: delayType.name, 
      display_name: delayType.display_name,
      display_order: delayType.display_order 
    })
    setModal({ isOpen: true, mode: 'edit', delayType })
  }

  const closeModal = () => {
    setModal({ isOpen: false, mode: 'add', delayType: null })
    setFormData({ name: '', display_name: '', display_order: 0 })
  }

  const handleSave = async () => {
    if (!formData.display_name.trim()) return
    
    setSaving(true)
    const nameValue = formData.name.trim() || formData.display_name.trim().toLowerCase().replace(/\s+/g, '_')

    if (modal.mode === 'add') {
      const { data, error } = await supabase
        .from('delay_types')
        .insert({
          name: nameValue,
          display_name: formData.display_name.trim(),
          display_order: formData.display_order,
          facility_id: null,
        })
        .select()
        .single()

      if (!error && data) {
        setDelayTypes([...delayTypes, data].sort((a, b) => a.display_order - b.display_order))
        closeModal()
        await delayTypeAudit.adminCreated(supabase, data.display_name, data.id)
      }
    } else if (modal.mode === 'edit' && modal.delayType) {
      const oldName = modal.delayType.display_name
      
      const { data, error } = await supabase
        .from('delay_types')
        .update({
          name: nameValue,
          display_name: formData.display_name.trim(),
          display_order: formData.display_order,
        })
        .eq('id', modal.delayType.id)
        .select()
        .single()

      if (!error && data) {
        setDelayTypes(delayTypes.map(dt => dt.id === data.id ? data : dt).sort((a, b) => a.display_order - b.display_order))
        closeModal()
        await delayTypeAudit.adminUpdated(supabase, data.id, oldName, data.display_name)
      }
    }

    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    const delayType = delayTypes.find(dt => dt.id === id)
    if (!delayType) return

    const { error } = await supabase
      .from('delay_types')
      .delete()
      .eq('id', id)

    if (!error) {
      setDelayTypes(delayTypes.filter(dt => dt.id !== id))
      setDeleteConfirm(null)
      await delayTypeAudit.adminDeleted(supabase, delayType.display_name, id)
    }
  }

  if (userLoading || loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    )
  }

  if (!isGlobalAdmin) {
    return null
  }

  return (
    <DashboardLayout>
      <Container className="py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <button
                onClick={() => router.push('/admin')}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h1 className="text-2xl font-semibold text-slate-900">Global Delay Types</h1>
            </div>
            <p className="text-slate-500 ml-11">
              Manage the standard delay reasons available to all facilities
            </p>
          </div>
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/25"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Delay Type
          </button>
        </div>

        {/* Delay Types List */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
            <p className="text-sm text-slate-600">
              <span className="font-medium">{delayTypes.length}</span> global delay types
            </p>
          </div>

          {delayTypes.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-slate-500 mb-2">No global delay types defined</p>
              <button
                onClick={openAddModal}
                className="text-blue-600 hover:underline text-sm"
              >
                Add your first delay type
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {delayTypes.map((delayType) => (
                <div key={delayType.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center text-sm font-medium text-amber-600">
                      {delayType.display_order}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{delayType.display_name}</p>
                      <p className="text-xs text-slate-400">{delayType.name}</p>
                    </div>
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
                          Delete
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

        {/* Modal */}
        {modal.isOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
              <div className="px-6 py-4 border-b border-slate-200">
                <h3 className="text-lg font-semibold text-slate-900">
                  {modal.mode === 'add' ? 'Add Global Delay Type' : 'Edit Delay Type'}
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
                    placeholder="e.g., Waiting for Surgeon"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Display Order
                  </label>
                  <input
                    type="number"
                    value={formData.display_order}
                    onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    min={1}
                  />
                  <p className="text-xs text-slate-500 mt-1">Lower numbers appear first in lists</p>
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
      </Container>
    </DashboardLayout>
  )
}
