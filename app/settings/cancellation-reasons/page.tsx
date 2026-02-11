// app/settings/cancellation-reasons/page.tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import SettingsLayout from '@/components/settings/SettingsLayout'
import { cancellationReasonAudit } from '@/lib/audit-logger'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { Modal } from '@/components/ui/Modal'
import { ArchiveConfirm } from '@/components/ui/ConfirmDialog'
import { PageLoader } from '@/components/ui/Loading'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Button } from '@/components/ui/Button'
import { AlertCircle, Archive, Ban, Check, Info, Pencil, Plus } from 'lucide-react'

// ============================================================================
// TYPES
// ============================================================================

interface CancellationReason {
  id: string
  facility_id: string
  source_template_id: string | null
  name: string
  display_name: string
  category: string
  display_order: number
  is_active: boolean
  deleted_at: string | null
}

// ============================================================================
// CONSTANTS
// ============================================================================

const CATEGORIES = [
  { value: 'patient', label: 'Patient', color: 'bg-blue-100 text-blue-700 border-blue-200', desc: 'Patient-related' },
  { value: 'scheduling', label: 'Scheduling', color: 'bg-purple-100 text-purple-700 border-purple-200', desc: 'Administrative' },
  { value: 'clinical', label: 'Clinical', color: 'bg-amber-100 text-amber-700 border-amber-200', desc: 'Resources & staffing' },
  { value: 'external', label: 'External', color: 'bg-slate-100 text-slate-700 border-slate-200', desc: 'External factors' },
]

// ============================================================================
// COMPONENT
// ============================================================================

export default function CancellationReasonsSettingsPage() {
  const supabase = createClient()
  const { effectiveFacilityId, isGlobalAdmin, isFacilityAdmin, loading: userLoading } = useUser()
  const { showToast } = useToast()
  
  // Data state
  const [showArchived, setShowArchived] = useState(false)

  const { data: reasons, loading, error, setData: setReasons, refetch: refetchReasons } = useSupabaseQuery<CancellationReason[]>(
    async (sb) => {
      let query = sb
        .from('cancellation_reasons')
        .select('*')
        .eq('facility_id', effectiveFacilityId!)
        .order('category')
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

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editingReason, setEditingReason] = useState<CancellationReason | null>(null)
  const [formData, setFormData] = useState({ display_name: '', category: 'patient' })
  const [archiveTarget, setArchiveTarget] = useState<CancellationReason | null>(null)

  const canEdit = isGlobalAdmin || isFacilityAdmin

  // ============================================================================
  // MODAL HANDLERS
  // ============================================================================

  const openCreateModal = () => {
    setEditingReason(null)
    setFormData({ display_name: '', category: 'patient' })
    setShowModal(true)
  }

  const openEditModal = (reason: CancellationReason) => {
    setEditingReason(reason)
    setFormData({ display_name: reason.display_name, category: reason.category })
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingReason(null)
  }

  // ============================================================================
  // FORM HANDLERS
  // ============================================================================

  const generateName = (displayName: string): string => {
    return displayName.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '_').substring(0, 50)
  }

  const handleSubmit = async () => {
    if (!formData.display_name.trim() || !effectiveFacilityId) return

    const name = generateName(formData.display_name)

    try {
      if (editingReason) {
        const { error } = await supabase
          .from('cancellation_reasons')
          .update({
            name,
            display_name: formData.display_name.trim(),
            category: formData.category,
          })
          .eq('id', editingReason.id)

        if (error) throw error

        await cancellationReasonAudit.updated(supabase, editingReason.id, editingReason.display_name, formData.display_name.trim(), effectiveFacilityId)
        showToast({ type: 'success', title: 'Cancellation reason updated' })
        closeModal()
        refetchReasons()
      } else {
        const { data, error } = await supabase
          .from('cancellation_reasons')
          .insert({
            facility_id: effectiveFacilityId,
            name,
            display_name: formData.display_name.trim(),
            category: formData.category,
            display_order: (reasons || []).length * 10,
            is_active: true,
          })
          .select()
          .single()

        if (error) {
          showToast({ type: 'error', title: error.code === '23505' ? 'This reason already exists' : error.message })
          return
        }

        await cancellationReasonAudit.created(supabase, formData.display_name.trim(), data.id, formData.category, effectiveFacilityId)
        showToast({ type: 'success', title: 'Cancellation reason created' })
        closeModal()
        refetchReasons()
      }
    } catch (err) {
      showToast({ type: 'error', title: err instanceof Error ? err.message : 'Failed to save reason' })
    }
  }

  const handleDelete = async (reason: CancellationReason) => {
    if (!effectiveFacilityId) return

    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      const { error } = await supabase
        .from('cancellation_reasons')
        .update({ is_active: false, deleted_at: new Date().toISOString(), deleted_by: user?.id })
        .eq('id', reason.id)

      if (error) throw error

      await cancellationReasonAudit.deleted(supabase, reason.display_name, reason.id, effectiveFacilityId)
      showToast({ type: 'success', title: `"${reason.display_name}" archived` })
      setArchiveTarget(null)
      refetchReasons()
    } catch (err) {
      showToast({ type: 'error', title: err instanceof Error ? err.message : 'Failed to archive reason' })
    }
  }

  const handleRestore = async (reason: CancellationReason) => {
    if (!effectiveFacilityId) return
    
    try {
      const { error } = await supabase
        .from('cancellation_reasons')
        .update({ is_active: true, deleted_at: null, deleted_by: null })
        .eq('id', reason.id)

      if (error) throw error

      await cancellationReasonAudit.restored(supabase, reason.display_name, reason.id, effectiveFacilityId)
      showToast({ type: 'success', title: `"${reason.display_name}" restored` })
      refetchReasons()
    } catch (err) {
      showToast({ type: 'error', title: err instanceof Error ? err.message : 'Failed to restore reason' })
    }
  }

  // ============================================================================
  // COMPUTED
  // ============================================================================

  const groupedReasons = (reasons || []).reduce((acc, r) => {
    if (!acc[r.category]) acc[r.category] = []
    acc[r.category].push(r)
    return acc
  }, {} as Record<string, CancellationReason[]>)

  const activeCount = (reasons || []).filter(r => r.is_active).length
  const archivedCount = (reasons || []).filter(r => !r.is_active).length

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <DashboardLayout>
      <Container className="py-8">
          <ErrorBanner message={error} />
        <SettingsLayout
          title="Cancellation Reasons"
          description="Manage the reasons staff can select when cancelling a surgical case."
        >
          {loading || userLoading ? (
            <PageLoader message="Loading cancellation reasons..." />
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
                      {showArchived ? 'Archived Reasons' : 'Cancellation Reasons'}
                    </h3>
                    <p className="text-sm text-slate-500">
                      {showArchived ? (
                        <>
                          {archivedCount} archived
                          <button onClick={() => setShowArchived(false)} className="text-blue-600 hover:underline ml-2">
                            ← Back to active
                          </button>
                        </>
                      ) : (
                        <>{activeCount} reasons across {Object.keys(groupedReasons).length} categories</>
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
                      <Button onClick={openCreateModal}>
                        <Plus className="w-4 h-4" />
                        Add Reason
                      </Button>
                    )}
                  </div>
                </div>

                {/* Content */}
                {(reasons || []).length === 0 ? (
                  <div className="px-6 py-12 text-center">
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Ban className="w-6 h-6 text-slate-400" />
                    </div>
                    <p className="text-slate-500">{showArchived ? 'No archived reasons.' : 'No cancellation reasons configured.'}</p>
                    {canEdit && !showArchived && (
                      <button onClick={openCreateModal} className="mt-2 text-blue-600 hover:underline text-sm">
                        Add your first reason
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {CATEGORIES.map(cat => {
                      const catReasons = groupedReasons[cat.value] || []
                      if (catReasons.length === 0) return null

                      return (
                        <div key={cat.value} className="px-6 py-4">
                          <div className="flex items-center gap-2 mb-3">
                            <span className={`px-2 py-0.5 text-xs font-semibold rounded border ${cat.color}`}>
                              {cat.label}
                            </span>
                            <span className="text-sm text-slate-400">{catReasons.length} reasons</span>
                          </div>

                          <div className="space-y-2">
                            {catReasons.map(reason => (
                              <div
                                key={reason.id}
                                className={`flex items-center justify-between p-3 rounded-lg border ${
                                  reason.is_active ? 'bg-white border-slate-200 hover:border-slate-300' : 'bg-slate-50 border-slate-200'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <div className={`w-2 h-2 rounded-full ${reason.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                  <div>
                                    <p className={`font-medium ${reason.is_active ? 'text-slate-900' : 'text-slate-400'}`}>
                                      {reason.display_name}
                                    </p>
                                    {reason.source_template_id && (
                                      <p className="text-xs text-slate-400">From template</p>
                                    )}
                                  </div>
                                </div>

                                {canEdit && (
                                  <div className="flex items-center gap-1">
                                    {reason.is_active ? (
                                        <>
                                          <button onClick={() => openEditModal(reason)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Edit">
                                            <Pencil className="w-4 h-4" />
                                          </button>
                                          <button onClick={() => setArchiveTarget(reason)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Archive">
                                            <Archive className="w-4 h-4" />
                                          </button>
                                        </>
                                    ) : (
                                      <button onClick={() => handleRestore(reason)} className="text-sm text-emerald-600 hover:bg-emerald-50 px-3 py-1.5 rounded-lg">
                                        Restore
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex gap-3">
                  <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-amber-900">Why Track Cancellation Reasons?</h4>
                    <p className="text-sm text-amber-700 mt-1">
                      Understanding why cases cancel helps identify patterns and improve efficiency.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </SettingsLayout>
      </Container>

      {/* Modal */}
      <Modal
        open={showModal}
        onClose={closeModal}
        title={editingReason ? 'Edit Cancellation Reason' : 'Add Cancellation Reason'}
      >
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Display Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.display_name}
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                  placeholder="e.g., Patient No-Show"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Category</label>
                <div className="space-y-2">
                  {CATEGORIES.map(cat => (
                    <label
                      key={cat.value}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer ${
                        formData.category === cat.value ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="category"
                        value={cat.value}
                        checked={formData.category === cat.value}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="sr-only"
                      />
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded border ${cat.color}`}>{cat.label}</span>
                      <span className="text-sm text-slate-600">{cat.desc}</span>
                    </label>
                  ))}
                </div>
              </div>

        <Modal.Footer>
          <Modal.Cancel onClick={closeModal} />
          <Modal.Action
            onClick={handleSubmit}
            disabled={!formData.display_name.trim()}
          >
            {editingReason ? 'Save Changes' : 'Add Reason'}
          </Modal.Action>
        </Modal.Footer>
      </Modal>
      <ArchiveConfirm
        open={!!archiveTarget}
        onClose={() => setArchiveTarget(null)}
        onConfirm={async () => {
          if (archiveTarget) await handleDelete(archiveTarget)
        }}
        itemName={archiveTarget?.display_name || ''}
        itemType="cancellation reason"
      />
    </DashboardLayout>
  )
}