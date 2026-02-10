// This is the main page for managing cancellation reason templates. These templates are copied to new facilities during onboarding and can be customized by each facility without affecting others. Only accessible by global admins.
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import { cancellationReasonAudit } from '@/lib/audit-logger'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { Modal } from '@/components/ui/Modal'
import { ArchiveConfirm } from '@/components/ui/ConfirmDialog'
import { PageLoader } from '@/components/ui/Loading'
import { ErrorBanner } from '@/components/ui/ErrorBanner'


// ============================================================================
// TYPES
// ============================================================================

interface CancellationReasonTemplate {
  id: string
  name: string
  display_name: string
  category: string
  display_order: number
  is_active: boolean
  deleted_at: string | null
  created_at: string
}

// ============================================================================
// CONSTANTS
// ============================================================================

const CATEGORIES = [
  { value: 'patient', label: 'Patient', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'scheduling', label: 'Scheduling', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { value: 'clinical', label: 'Clinical', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'external', label: 'External', color: 'bg-slate-100 text-slate-700 border-slate-200' },
]

// ============================================================================
// COMPONENT
// ============================================================================

export default function AdminCancellationReasonsPage() {
  const supabase = createClient()
  const { isGlobalAdmin, loading: userLoading } = useUser()
  
  // Data state
  const [reasons, setReasons] = useState<CancellationReasonTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  
  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editingReason, setEditingReason] = useState<CancellationReasonTemplate | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    display_name: '',
    category: 'patient',
    display_order: 0,
  })
  
  // Feedback state
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<CancellationReasonTemplate | null>(null)
  // Toast
  const { showToast } = useToast()

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  useEffect(() => {
    if (!userLoading && isGlobalAdmin) {
      fetchReasons()
    }
  }, [userLoading, isGlobalAdmin, showArchived])

const fetchReasons = async () => {
  setLoading(true)
  setError(null)
  
  try {
    let query = supabase
      .from('cancellation_reason_templates')
      .select('*')
      .order('category')
      .order('display_order')
    
    if (!showArchived) {
      query = query.eq('is_active', true).is('deleted_at', null)
    }
    
    const { data, error: fetchErr } = await query
    if (fetchErr) throw fetchErr
    setReasons(data || [])
  } catch (err) {
    setError('Failed to load cancellation reasons. Please try again.')
  } finally {
    setLoading(false)
  }
}

// ============================================================================
// MODAL HANDLERS
// ============================================================================

  const openCreateModal = () => {
    setEditingReason(null)
    setFormData({
      name: '',
      display_name: '',
      category: 'patient',
      display_order: reasons.length * 10,
    })
    setShowModal(true)
  }

  const openEditModal = (reason: CancellationReasonTemplate) => {
    setEditingReason(reason)
    setFormData({
      name: reason.name,
      display_name: reason.display_name,
      category: reason.category,
      display_order: reason.display_order,
    })
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingReason(null)
    setFormData({ name: '', display_name: '', category: 'patient', display_order: 0 })
  }

  // ============================================================================
  // FORM HANDLERS
  // ============================================================================

  const generateName = (displayName: string): string => {
    return displayName
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50)
  }

  const handleSubmit = async () => {
    if (!formData.display_name.trim()) {
      setErrorMessage('Display name is required')
      return
    }

    const name = formData.name || generateName(formData.display_name)

    try {
      if (editingReason) {
        const { error } = await supabase
          .from('cancellation_reason_templates')
          .update({
            name,
            display_name: formData.display_name.trim(),
            category: formData.category,
            display_order: formData.display_order,
          })
          .eq('id', editingReason.id)

        if (error) throw error

        await cancellationReasonAudit.adminUpdated(
          supabase, editingReason.id, editingReason.display_name, 
          formData.display_name.trim(), formData.category
        )
        setSuccessMessage('Cancellation reason updated')
        closeModal()
        fetchReasons()
      } else {
        const { data, error } = await supabase
          .from('cancellation_reason_templates')
          .insert({
            name,
            display_name: formData.display_name.trim(),
            category: formData.category,
            display_order: formData.display_order,
            is_active: true,
          })
          .select()
          .single()

        if (error) {
          setErrorMessage(error.code === '23505' 
            ? 'A reason with this name already exists' 
            : error.message
          )
          return
        }

        await cancellationReasonAudit.adminCreated(
          supabase, formData.display_name.trim(), data.id, formData.category
        )
        setSuccessMessage('Cancellation reason created')
        closeModal()
        fetchReasons()
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save cancellation reason')
    }

    setTimeout(() => { setSuccessMessage(null); setErrorMessage(null) }, 5000)
  }

  const handleDelete = async (reason: CancellationReasonTemplate) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      const { error } = await supabase
        .from('cancellation_reason_templates')
        .update({
          is_active: false,
          deleted_at: new Date().toISOString(),
          deleted_by: user?.id,
        })
        .eq('id', reason.id)

      if (error) throw error

      await cancellationReasonAudit.adminDeleted(supabase, reason.display_name, reason.id)
      setSuccessMessage(`"${reason.display_name}" archived`)
      setArchiveTarget(null)
      fetchReasons()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to archive reason')
    }

    setTimeout(() => { setSuccessMessage(null); setErrorMessage(null) }, 5000)
  }

  const handleRestore = async (reason: CancellationReasonTemplate) => {
    try {
      const { error } = await supabase
        .from('cancellation_reason_templates')
        .update({ is_active: true, deleted_at: null, deleted_by: null })
        .eq('id', reason.id)

      if (error) throw error

      setSuccessMessage(`"${reason.display_name}" restored`)
      fetchReasons()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to restore reason')
    }

    setTimeout(() => { setSuccessMessage(null); setErrorMessage(null) }, 5000)
  }

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const groupedReasons = reasons.reduce((acc, reason) => {
    if (!acc[reason.category]) acc[reason.category] = []
    acc[reason.category].push(reason)
    return acc
  }, {} as Record<string, CancellationReasonTemplate[]>)

  const activeCount = reasons.filter(r => r.is_active).length
  const archivedCount = reasons.filter(r => !r.is_active).length

  // ============================================================================
  // ACCESS CHECK
  // ============================================================================

  if (!userLoading && !isGlobalAdmin) {
    return (
      <DashboardLayout>
        <Container className="py-8">
          <ErrorBanner message={error} onDismiss={() => setError(null)} />
          <div className="text-center py-12">
            <h2 className="text-xl font-semibold text-slate-900">Access Denied</h2>
            <p className="text-slate-500 mt-2">You need global admin privileges to access this page.</p>
          </div>
        </Container>
      </DashboardLayout>
    )
  }

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <DashboardLayout>
      <Container className="py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
            <a href="/admin" className="hover:text-blue-600">Admin</a>
            <span>/</span>
            <span className="text-slate-900">Cancellation Reasons</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Cancellation Reason Templates</h1>
          <p className="text-slate-500 mt-1">
            Manage default cancellation reasons copied to new facilities.
          </p>
        </div>

        {/* Messages */}
        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-start gap-3">
            <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-sm font-medium text-green-800">{successMessage}</p>
          </div>
        )}

        {errorMessage && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
            <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-medium text-red-800">{errorMessage}</p>
          </div>
        )}

        {/* Main Card */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {/* Card Header */}
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="font-medium text-slate-900">
                {showArchived ? 'Archived Templates' : 'Active Templates'}
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
                  <>{activeCount} templates across {Object.keys(groupedReasons).length} categories</>
                )}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {!showArchived && archivedCount > 0 && (
                <button
                  onClick={() => setShowArchived(true)}
                  className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                  </svg>
                  View Archived ({archivedCount})
                </button>
              )}
              {!showArchived && (
                <button
                  onClick={openCreateModal}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
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
          {loading ? (
            <PageLoader message="Loading cancellation reasons..." />
          ) : reasons.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
              <p className="text-slate-500">
                {showArchived ? 'No archived templates.' : 'No templates yet.'}
              </p>
              {!showArchived && (
                <button onClick={openCreateModal} className="mt-2 text-blue-600 hover:underline text-sm">
                  Add your first cancellation reason
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {CATEGORIES.map(category => {
                const categoryReasons = groupedReasons[category.value] || []
                if (categoryReasons.length === 0) return null

                return (
                  <div key={category.value} className="px-6 py-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded border ${category.color}`}>
                        {category.label}
                      </span>
                      <span className="text-sm text-slate-400">
                        {categoryReasons.length} {categoryReasons.length === 1 ? 'reason' : 'reasons'}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {categoryReasons.map(reason => (
                        <div 
                          key={reason.id}
                          className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                            reason.is_active 
                              ? 'bg-white border-slate-200 hover:border-slate-300' 
                              : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${reason.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                            <div>
                              <p className={`font-medium ${reason.is_active ? 'text-slate-900' : 'text-slate-400'}`}>
                                {reason.display_name}
                              </p>
                              <p className="text-xs text-slate-400 font-mono">{reason.name}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            {reason.is_active ? (
                              <>
                                  <button
                                    onClick={() => openEditModal(reason)}
                                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="Edit"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => setArchiveTarget(reason)}
                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Archive"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                                    </svg>
                                  </button>
                                </>
                            ) : (
                              <button
                                onClick={() => handleRestore(reason)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Restore
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Info Card */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="flex gap-3">
            <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h4 className="font-medium text-blue-900">How Templates Work</h4>
              <p className="text-sm text-blue-700 mt-1">
                These templates are copied to new facilities during onboarding. Facilities can then customize 
                their own list without affecting other facilities.
              </p>
            </div>
          </div>
        </div>
      </Container>

      {/* Create/Edit Modal */}
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
                <label className="block text-sm font-medium text-slate-700 mb-1.5">System Name</label>
                <input
                  type="text"
                  value={formData.name || generateName(formData.display_name)}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Auto-generated"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono text-sm"
                />
                <p className="text-xs text-slate-500 mt-1">Used internally. Auto-generated if blank.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Display Order</label>
                <input
                  type="number"
                  value={formData.display_order}
                  onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
                <p className="text-xs text-slate-500 mt-1">Lower numbers appear first within each category.</p>
              </div>

        <Modal.Footer>
          <Modal.Cancel onClick={closeModal} />
          <Modal.Action
            onClick={handleSubmit}
            disabled={!formData.display_name.trim()}
          >
            {editingReason ? 'Save Changes' : 'Create Reason'}
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