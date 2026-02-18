// app/settings/delay-types/page.tsx
// app/admin/settings/delay-types/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import { delayTypeAudit } from '@/lib/audit-logger'
import { useToast } from '@/components/ui/Toast'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { useMutation } from '@/hooks/useAsync'
import { DeleteConfirm } from '@/components/ui/ConfirmDialog'
import { PageLoader } from '@/components/ui/Loading'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { AlertTriangle, Info, PenLine, Plus, Trash2 } from 'lucide-react'

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
  const { showToast } = useToast()

  const { data: delayTypes, loading, error, setData: setDelayTypes } = useSupabaseQuery<DelayType[]>(
    async (sb) => {
      const { data, error } = await sb
        .from('delay_types')
        .select('*')
        .is('facility_id', null)
        .order('display_order')
      if (error) throw error
      return data || []
    },
    { deps: [isGlobalAdmin], enabled: !!isGlobalAdmin }
  )

  const [modal, setModal] = useState<ModalState>({ isOpen: false, mode: 'add', delayType: null })
  const [formData, setFormData] = useState({ name: '', display_name: '', display_order: 0 })
  const [deleteTarget, setDeleteTarget] = useState<DelayType | null>(null)

  // Redirect non-admins
  useEffect(() => {
    if (!userLoading && !isGlobalAdmin) {
      router.push('/dashboard')
    }
  }, [userLoading, isGlobalAdmin, router])

  const openAddModal = () => {
    const maxOrder = Math.max(...(delayTypes || []).map(dt => dt.display_order), 0)
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

  const { mutate: doSave, loading: saving } = useMutation(async () => {
    if (!formData.display_name.trim()) return
    
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

      if (error) throw error

      setDelayTypes([...(delayTypes || []), data].sort((a, b) => a.display_order - b.display_order))
      closeModal()
      await delayTypeAudit.adminCreated(supabase, data.display_name, data.id)
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

      if (error) throw error

      setDelayTypes((delayTypes || []).map(dt => dt.id === data.id ? data : dt).sort((a, b) => a.display_order - b.display_order))
      closeModal()
      await delayTypeAudit.adminUpdated(supabase, data.id, oldName, data.display_name)
    }
  }, {
    onError: (err) => showToast({ type: 'error', title: 'Failed to save delay type', message: err.message })
  })

  const handleSave = () => doSave()

  const handleDelete = async (id: string) => {
    const delayType = (delayTypes || []).find(dt => dt.id === id)
    if (!delayType) return

    try {
      const { error } = await supabase
        .from('delay_types')
        .delete()
        .eq('id', id)

      if (error) throw error

      setDelayTypes((delayTypes || []).filter(dt => dt.id !== id))
      setDeleteTarget(null)
      await delayTypeAudit.adminDeleted(supabase, delayType.display_name, id)
    } catch (err) {
      showToast({ type: 'error', title: 'Failed to delete delay type', message: err instanceof Error ? err.message : 'Please try again' })
    }
  }

  if (userLoading || loading) {
    return (
      <>
        <ErrorBanner message={error} />
        <PageLoader message="Loading delay types..." />
      </>
    )
  }

  if (!isGlobalAdmin) {
    return null
  }

  return (
    <>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Global Delay Types</h1>
            <p className="text-slate-500 mt-1">
              Standard delay reasons available to all facilities as templates.
            </p>
          </div>
            <Button onClick={openAddModal}>
              <Plus className="w-4 h-4" />
              Add Delay Type
            </Button>
          </div>

          {/* Stats Bar */}
          <div className="flex items-center gap-4 mb-4">
            <span className="text-sm text-slate-500">
              {(delayTypes || []).length} delay type{(delayTypes || []).length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {(delayTypes || []).length === 0 ? (
              <div className="text-center py-16 text-slate-500">
                <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                <p>No delay types defined</p>
                <button
                  onClick={openAddModal}
                  className="mt-2 text-blue-600 hover:text-blue-700 font-medium text-sm"
                >
                  Add your first delay type
                </button>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-12">#</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Display Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Internal Name</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(delayTypes || []).map((delayType) => (
                    <tr key={delayType.id} className="group hover:bg-slate-50 transition-colors">
                      {/* Order */}
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-400 font-medium">{delayType.display_order}</span>
                      </td>

                      {/* Display Name */}
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-slate-900">{delayType.display_name}</span>
                      </td>

                      {/* Internal Name */}
                      <td className="px-4 py-3">
                        <code className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
                          {delayType.name}
                        </code>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => openEditModal(delayType)}
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <PenLine className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(delayType)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Info Box */}
          <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex gap-3">
              <Info className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-slate-600">
                <p className="font-medium text-slate-700 mb-1">About delay types</p>
                <p>
                  These are global templates copied to new facilities. Each facility can customize
                  their own delay types. Changes here don&apos;t affect existing facilities.
                </p>
              </div>
            </div>
          </div>
        </div>

      {/* Modal */}
      <Modal open={modal.isOpen} onClose={closeModal} title={modal.mode === 'add' ? 'Add Delay Type' : 'Edit Delay Type'}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Display Name <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={formData.display_name}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    display_name: e.target.value,
                    name: e.target.value.toLowerCase().replace(/\s+/g, '_')
                  })}
                  placeholder="e.g., Waiting for Surgeon"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  autoFocus
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Internal Name <span className="text-slate-400 font-normal">(auto-generated)</span>
                </label>
                <input
                  type="text"
                  value={formData.name || formData.display_name.toLowerCase().replace(/\s+/g, '_')}
                  disabled
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-500 font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Display Order
                </label>
                <input
                  type="number"
                  value={formData.display_order}
                  onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min={1}
                />
                <p className="text-xs text-slate-500 mt-1">Lower numbers appear first in lists</p>
              </div>
            </div>

            <Modal.Footer>
              <Modal.Cancel onClick={closeModal} />
              <Modal.Action onClick={handleSave} loading={saving} disabled={!formData.display_name.trim()}>
                {modal.mode === 'add' ? 'Add Delay Type' : 'Save Changes'}
              </Modal.Action>
            </Modal.Footer>
      </Modal>

      <DeleteConfirm
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget) await handleDelete(deleteTarget.id)
        }}
        itemName={deleteTarget?.display_name || ''}
        itemType="delay type"
      />
    </>
  )
}