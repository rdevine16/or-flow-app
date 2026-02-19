// app/settings/delay-types/page.tsx
// Facility-scoped delay types management
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import { delayTypeAudit } from '@/lib/audit-logger'
import { useToast } from '@/components/ui/Toast'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { useMutation } from '@/hooks/useAsync'
import { ArchiveConfirm } from '@/components/ui/ConfirmDialog'
import { PageLoader } from '@/components/ui/Loading'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { AlertTriangle, Archive, Info, PenLine, Plus, RotateCcw } from 'lucide-react'

// =====================================================
// TYPES
// =====================================================

interface DelayType {
  id: string
  name: string
  display_name: string
  display_order: number
  facility_id: string | null
  is_active: boolean
  deleted_at: string | null
  created_at: string
}

interface ModalState {
  isOpen: boolean
  mode: 'add' | 'edit'
  delayType: DelayType | null
}

// =====================================================
// COMPONENT
// =====================================================

export default function DelayTypesPage() {
  const supabase = createClient()
  const { effectiveFacilityId, loading: userLoading, can } = useUser()
  const { showToast } = useToast()

  const [showArchived, setShowArchived] = useState(false)

  const { data: delayTypes, loading, error, refetch } = useSupabaseQuery<DelayType[]>(
    async (sb) => {
      let query = sb
        .from('delay_types')
        .select('*')
        .eq('facility_id', effectiveFacilityId!)
        .order('display_order')

      if (!showArchived) {
        query = query.eq('is_active', true).is('deleted_at', null)
      }

      const { data, error } = await query
      if (error) throw error
      return data || []
    },
    { deps: [effectiveFacilityId, showArchived], enabled: !userLoading && !!effectiveFacilityId }
  )

  const [modal, setModal] = useState<ModalState>({ isOpen: false, mode: 'add', delayType: null })
  const [formData, setFormData] = useState({ display_name: '', display_order: 0 })
  const [archiveTarget, setArchiveTarget] = useState<DelayType | null>(null)

  const canEdit = can('settings.manage')

  // =====================================================
  // MODAL HANDLERS
  // =====================================================

  const openAddModal = () => {
    const maxOrder = Math.max(...(delayTypes || []).map(dt => dt.display_order), 0)
    setFormData({ display_name: '', display_order: maxOrder + 1 })
    setModal({ isOpen: true, mode: 'add', delayType: null })
  }

  const openEditModal = (delayType: DelayType) => {
    setFormData({
      display_name: delayType.display_name,
      display_order: delayType.display_order,
    })
    setModal({ isOpen: true, mode: 'edit', delayType })
  }

  const closeModal = () => {
    setModal({ isOpen: false, mode: 'add', delayType: null })
    setFormData({ display_name: '', display_order: 0 })
  }

  // =====================================================
  // SAVE / ARCHIVE HANDLERS
  // =====================================================

  const generateName = (displayName: string): string => {
    return displayName.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '_').substring(0, 50)
  }

  const { mutate: doSave, loading: saving } = useMutation(async () => {
    if (!formData.display_name.trim() || !effectiveFacilityId) return

    const nameValue = generateName(formData.display_name)

    if (modal.mode === 'add') {
      const { data, error } = await supabase
        .from('delay_types')
        .insert({
          name: nameValue,
          display_name: formData.display_name.trim(),
          display_order: formData.display_order,
          facility_id: effectiveFacilityId,
        })
        .select()
        .single()

      if (error) {
        if (error.code === '23505') {
          showToast({ type: 'error', title: 'A delay type with this name already exists' })
          return
        }
        throw error
      }

      await delayTypeAudit.created(supabase, data.display_name, data.id, effectiveFacilityId)
      showToast({ type: 'success', title: 'Delay type created' })
      closeModal()
      refetch()
    } else if (modal.mode === 'edit' && modal.delayType) {
      const oldName = modal.delayType.display_name

      const { error } = await supabase
        .from('delay_types')
        .update({
          name: nameValue,
          display_name: formData.display_name.trim(),
          display_order: formData.display_order,
        })
        .eq('id', modal.delayType.id)

      if (error) throw error

      await delayTypeAudit.updated(supabase, modal.delayType.id, oldName, formData.display_name.trim(), effectiveFacilityId)
      showToast({ type: 'success', title: 'Delay type updated' })
      closeModal()
      refetch()
    }
  }, {
    onError: (err) => showToast({ type: 'error', title: 'Failed to save delay type', message: err.message })
  })

  const handleArchive = async (delayType: DelayType) => {
    if (!effectiveFacilityId) return

    try {
      const { data: { user } } = await supabase.auth.getUser()

      const { error } = await supabase
        .from('delay_types')
        .update({ is_active: false, deleted_at: new Date().toISOString(), deleted_by: user?.id })
        .eq('id', delayType.id)

      if (error) throw error

      await delayTypeAudit.deleted(supabase, delayType.display_name, delayType.id, effectiveFacilityId)
      showToast({ type: 'success', title: `"${delayType.display_name}" archived` })
      setArchiveTarget(null)
      refetch()
    } catch (err) {
      showToast({ type: 'error', title: err instanceof Error ? err.message : 'Failed to archive delay type' })
    }
  }

  const handleRestore = async (delayType: DelayType) => {
    if (!effectiveFacilityId) return

    try {
      const { error } = await supabase
        .from('delay_types')
        .update({ is_active: true, deleted_at: null, deleted_by: null })
        .eq('id', delayType.id)

      if (error) throw error

      showToast({ type: 'success', title: `"${delayType.display_name}" restored` })
      refetch()
    } catch (err) {
      showToast({ type: 'error', title: err instanceof Error ? err.message : 'Failed to restore delay type' })
    }
  }

  // =====================================================
  // COMPUTED
  // =====================================================

  const activeCount = (delayTypes || []).filter(dt => dt.is_active).length
  const archivedCount = (delayTypes || []).filter(dt => !dt.is_active).length

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <>
      <h1 className="text-2xl font-semibold text-slate-900 mb-1">Delay Types</h1>
      <p className="text-slate-500 mb-6">Categorize surgical delays for tracking and reporting.</p>

      <ErrorBanner message={error} />

      {loading || userLoading ? (
        <PageLoader message="Loading delay types..." />
      ) : !effectiveFacilityId ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
          <p className="text-slate-500">No facility selected</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Main Card */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-medium text-slate-900">
                  {showArchived ? 'Archived Delay Types' : 'Delay Types'}
                </h3>
                <p className="text-sm text-slate-500">
                  {showArchived ? (
                    <>
                      {archivedCount} archived
                      <button onClick={() => setShowArchived(false)} className="text-blue-600 hover:underline ml-2">
                        &larr; Back to active
                      </button>
                    </>
                  ) : (
                    <>{activeCount} delay type{activeCount !== 1 ? 's' : ''}</>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {!showArchived && archivedCount > 0 && (
                  <button onClick={() => setShowArchived(true)} className="text-sm text-slate-500 hover:text-slate-700">
                    View Archived ({archivedCount})
                  </button>
                )}
                {canEdit && !showArchived && (
                  <Button onClick={openAddModal}>
                    <Plus className="w-4 h-4" />
                    Add Delay Type
                  </Button>
                )}
              </div>
            </div>

            {/* Content */}
            {(delayTypes || []).length === 0 ? (
              <div className="px-6 py-12 text-center">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <AlertTriangle className="w-6 h-6 text-slate-400" />
                </div>
                <p className="text-slate-500">{showArchived ? 'No archived delay types.' : 'No delay types configured.'}</p>
                {canEdit && !showArchived && (
                  <button onClick={openAddModal} className="mt-2 text-blue-600 hover:underline text-sm">
                    Add your first delay type
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {(delayTypes || []).map((delayType) => (
                  <div
                    key={delayType.id}
                    className={`flex items-center justify-between px-6 py-3.5 group ${
                      !delayType.is_active ? 'bg-slate-50/60' : 'hover:bg-slate-50'
                    } transition-colors`}
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-slate-400 font-medium w-6 text-center">
                        {delayType.display_order}
                      </span>
                      <div className={`w-2 h-2 rounded-full ${delayType.is_active ? 'bg-green-500' : 'bg-slate-300'}`} />
                      <div>
                        <span className={`text-sm font-medium ${delayType.is_active ? 'text-slate-900' : 'text-slate-400'}`}>
                          {delayType.display_name}
                        </span>
                        <code className={`ml-3 text-xs px-2 py-0.5 rounded ${
                          delayType.is_active ? 'text-slate-500 bg-slate-100' : 'text-slate-400 bg-slate-50'
                        }`}>
                          {delayType.name}
                        </code>
                      </div>
                    </div>

                    {canEdit && (
                      <div className="flex items-center gap-1">
                        {delayType.is_active ? (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => openEditModal(delayType)}
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <PenLine className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setArchiveTarget(delayType)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Archive"
                            >
                              <Archive className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleRestore(delayType)}
                            className="flex items-center gap-1.5 text-sm text-green-600 hover:bg-green-50 px-3 py-1.5 rounded-lg"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Restore
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex gap-3">
              <Info className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-slate-600">
                <p className="font-medium text-slate-700 mb-1">About delay types</p>
                <p>
                  Delay types categorize the reasons for surgical delays. Staff can tag delays
                  with these types when recording case flags, enabling pattern analysis across cases.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      <Modal open={modal.isOpen} onClose={closeModal} title={modal.mode === 'add' ? 'Add Delay Type' : 'Edit Delay Type'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Display Name <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={formData.display_name}
              onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
              placeholder="e.g., Waiting for Surgeon"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Internal Name <span className="text-slate-400 font-normal">(auto-generated)</span>
            </label>
            <input
              type="text"
              value={formData.display_name ? generateName(formData.display_name) : ''}
              disabled
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-500 font-mono text-sm"
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

        <Modal.Footer>
          <Modal.Cancel onClick={closeModal} />
          <Modal.Action onClick={() => doSave()} loading={saving} disabled={!formData.display_name.trim()}>
            {modal.mode === 'add' ? 'Add Delay Type' : 'Save Changes'}
          </Modal.Action>
        </Modal.Footer>
      </Modal>

      <ArchiveConfirm
        open={!!archiveTarget}
        onClose={() => setArchiveTarget(null)}
        onConfirm={async () => {
          if (archiveTarget) await handleArchive(archiveTarget)
        }}
        itemName={archiveTarget?.display_name || ''}
        itemType="delay type"
      />
    </>
  )
}
