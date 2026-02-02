'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import SettingsLayout from '@/components/settings/SettingsLayout'
import { cancellationReasonAudit } from '@/lib/audit-logger'

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
  
  // Data state
  const [reasons, setReasons] = useState<CancellationReason[]>([])
  const [loading, setLoading] = useState(true)
  const [showArchived, setShowArchived] = useState(false)
  
  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editingReason, setEditingReason] = useState<CancellationReason | null>(null)
  const [formData, setFormData] = useState({ display_name: '', category: 'patient' })
  
  // Feedback state
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const canEdit = isGlobalAdmin || isFacilityAdmin

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  useEffect(() => {
    if (!userLoading && effectiveFacilityId) {
      fetchReasons()
    }
  }, [userLoading, effectiveFacilityId, showArchived])

  const fetchReasons = async () => {
    if (!effectiveFacilityId) return
    setLoading(true)
    
    let query = supabase
      .from('cancellation_reasons')
      .select('*')
      .eq('facility_id', effectiveFacilityId)
      .order('category')
      .order('display_order')
    
    if (!showArchived) {
      query = query.eq('is_active', true).is('deleted_at', null)
    }
    
    const { data, error } = await query
    
    if (error) {
      setErrorMessage('Failed to load cancellation reasons')
    } else {
      setReasons(data || [])
    }
    setLoading(false)
  }

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

    if (editingReason) {
      const { error } = await supabase
        .from('cancellation_reasons')
        .update({
          name,
          display_name: formData.display_name.trim(),
          category: formData.category,
        })
        .eq('id', editingReason.id)

      if (error) {
        setErrorMessage(error.message)
      } else {
        await cancellationReasonAudit.updated(supabase, editingReason.id, editingReason.display_name, formData.display_name.trim(), effectiveFacilityId)
        setSuccessMessage('Cancellation reason updated')
        closeModal()
        fetchReasons()
      }
    } else {
      const { data, error } = await supabase
        .from('cancellation_reasons')
        .insert({
          facility_id: effectiveFacilityId,
          name,
          display_name: formData.display_name.trim(),
          category: formData.category,
          display_order: reasons.length * 10,
          is_active: true,
        })
        .select()
        .single()

      if (error) {
        setErrorMessage(error.code === '23505' ? 'This reason already exists' : error.message)
      } else {
        await cancellationReasonAudit.created(supabase, formData.display_name.trim(), data.id, formData.category, effectiveFacilityId)
        setSuccessMessage('Cancellation reason created')
        closeModal()
        fetchReasons()
      }
    }

    setTimeout(() => { setSuccessMessage(null); setErrorMessage(null) }, 5000)
  }

  const handleDelete = async (reason: CancellationReason) => {
    if (!effectiveFacilityId) return
    const { data: { user } } = await supabase.auth.getUser()
    
    const { error } = await supabase
      .from('cancellation_reasons')
      .update({ is_active: false, deleted_at: new Date().toISOString(), deleted_by: user?.id })
      .eq('id', reason.id)

    if (!error) {
      await cancellationReasonAudit.deleted(supabase, reason.display_name, reason.id, effectiveFacilityId)
      setSuccessMessage(`"${reason.display_name}" archived`)
      setDeleteConfirm(null)
      fetchReasons()
    } else {
      setErrorMessage(error.message)
    }
    setTimeout(() => { setSuccessMessage(null); setErrorMessage(null) }, 5000)
  }

  const handleRestore = async (reason: CancellationReason) => {
    if (!effectiveFacilityId) return
    
    const { error } = await supabase
      .from('cancellation_reasons')
      .update({ is_active: true, deleted_at: null, deleted_by: null })
      .eq('id', reason.id)

    if (!error) {
      await cancellationReasonAudit.restored(supabase, reason.display_name, reason.id, effectiveFacilityId)
      setSuccessMessage(`"${reason.display_name}" restored`)
      fetchReasons()
    }
    setTimeout(() => { setSuccessMessage(null); setErrorMessage(null) }, 5000)
  }

  // ============================================================================
  // COMPUTED
  // ============================================================================

  const groupedReasons = reasons.reduce((acc, r) => {
    if (!acc[r.category]) acc[r.category] = []
    acc[r.category].push(r)
    return acc
  }, {} as Record<string, CancellationReason[]>)

  const activeCount = reasons.filter(r => r.is_active).length
  const archivedCount = reasons.filter(r => !r.is_active).length

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <DashboardLayout>
      <Container className="py-8">
        <SettingsLayout
          title="Cancellation Reasons"
          description="Manage the reasons staff can select when cancelling a surgical case."
        >
          {loading || userLoading ? (
            <div className="flex justify-center py-12">
              <svg className="animate-spin h-8 w-8 text-blue-500" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : !effectiveFacilityId ? (
            <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
              <p className="text-slate-500">No facility selected</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Messages */}
              {successMessage && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
                  <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="text-sm font-medium text-green-800">{successMessage}</p>
                </div>
              )}
              {errorMessage && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
                  <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm font-medium text-red-800">{errorMessage}</p>
                </div>
              )}

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
                      <button
                        onClick={openCreateModal}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add Reason
                      </button>
                    )}
                  </div>
                </div>

                {/* Content */}
                {reasons.length === 0 ? (
                  <div className="px-6 py-12 text-center">
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
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
                                      deleteConfirm === reason.id ? (
                                        <div className="flex items-center gap-1">
                                          <button onClick={() => handleDelete(reason)} className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700">
                                            Confirm
                                          </button>
                                          <button onClick={() => setDeleteConfirm(null)} className="px-2 py-1 bg-slate-200 text-slate-700 text-xs rounded hover:bg-slate-300">
                                            Cancel
                                          </button>
                                        </div>
                                      ) : (
                                        <>
                                          <button onClick={() => openEditModal(reason)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Edit">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                          </button>
                                          <button onClick={() => setDeleteConfirm(reason.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Archive">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                                            </svg>
                                          </button>
                                        </>
                                      )
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
                  <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
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
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">
                {editingReason ? 'Edit Cancellation Reason' : 'Add Cancellation Reason'}
              </h3>
            </div>

            <div className="p-6 space-y-4">
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
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button onClick={closeModal} className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!formData.display_name.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {editingReason ? 'Save Changes' : 'Add Reason'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}