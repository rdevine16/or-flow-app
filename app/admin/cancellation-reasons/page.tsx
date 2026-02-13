// app/admin/cancellation-reasons/page.tsx
// This is the main page for managing cancellation reason templates. These templates are copied to new facilities during onboarding and can be customized by each facility without affecting others. Only accessible by global admins.
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import { cancellationReasonAudit } from '@/lib/audit-logger'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { Modal } from '@/components/ui/Modal'
import { ArchiveConfirm } from '@/components/ui/ConfirmDialog'
import { PageLoader } from '@/components/ui/Loading'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Archive, Ban, Info, Loader2, PenLine, Plus, RefreshCw } from 'lucide-react'


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
  const { showToast } = useToast()
  
  // Data state
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
  
  const [archiveTarget, setArchiveTarget] = useState<CancellationReasonTemplate | null>(null)

  const { data: reasons, loading, error, refetch: refetchReasons } = useSupabaseQuery<CancellationReasonTemplate[]>(
    async (sb) => {
      let query = sb
        .from('cancellation_reason_templates')
        .select('*')
        .order('category')
        .order('display_order')

      if (!showArchived) {
        query = query.eq('is_active', true).is('deleted_at', null)
      }

      const { data, error } = await query
      if (error) throw error
      return data || []
    },
    { deps: [showArchived], enabled: !userLoading && isGlobalAdmin }
  )

// ============================================================================
// MODAL HANDLERS
// ============================================================================

  const openCreateModal = () => {
    setEditingReason(null)
    setFormData({
      name: '',
      display_name: '',
      category: 'patient',
      display_order: (reasons || []).length * 10,
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
      showToast({ type: 'error', title: 'Display name is required' })
      return
    }

    const name = formData.name || generateName(formData.display_name)

    if (editingReason) {
      // Update
      const { error } = await supabase
        .from('cancellation_reason_templates')
        .update({
          name,
          display_name: formData.display_name.trim(),
          category: formData.category,
          display_order: formData.display_order,
        })
        .eq('id', editingReason.id)

      if (error) {
        showToast({ type: 'error', title: error.message })
      } else {
        await cancellationReasonAudit.adminUpdated(
          supabase, editingReason.id, editingReason.display_name, 
          formData.display_name.trim(), formData.category
        )
        showToast({ type: 'success', title: 'Cancellation reason updated' })
        closeModal()
        refetchReasons()
      }
    } else {
      // Create
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
        showToast({ type: 'error', title: error.code === '23505' 
          ? 'A reason with this name already exists' 
          : error.message })
      } else {
        await cancellationReasonAudit.adminCreated(
          supabase, formData.display_name.trim(), data.id, formData.category
        )
        showToast({ type: 'success', title: 'Cancellation reason created' })
        closeModal()
        refetchReasons()
      }
    }
  }

  const handleDelete = async (reason: CancellationReasonTemplate) => {
    const { data: { user } } = await supabase.auth.getUser()
    
    const { error } = await supabase
      .from('cancellation_reason_templates')
      .update({
        is_active: false,
        deleted_at: new Date().toISOString(),
        deleted_by: user?.id,
      })
      .eq('id', reason.id)

    if (error) {
      showToast({ type: 'error', title: error.message })
    } else {
      await cancellationReasonAudit.adminDeleted(supabase, reason.display_name, reason.id)
      showToast({ type: 'success', title: `"${reason.display_name}" archived` })
      setArchiveTarget(null)
      refetchReasons()
    }
  }

  const handleRestore = async (reason: CancellationReasonTemplate) => {
    const { error } = await supabase
      .from('cancellation_reason_templates')
      .update({ is_active: true, deleted_at: null, deleted_by: null })
      .eq('id', reason.id)

    if (error) {
      showToast({ type: 'error', title: error.message })
    } else {
      showToast({ type: 'success', title: `"${reason.display_name}" restored` })
      refetchReasons()
    }
  }

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const groupedReasons = (reasons || []).reduce((acc, reason) => {
    if (!acc[reason.category]) acc[reason.category] = []
    acc[reason.category].push(reason)
    return acc
  }, {} as Record<string, CancellationReasonTemplate[]>)

  const activeCount = (reasons || []).filter(r => r.is_active).length
  const archivedCount = (reasons || []).filter(r => !r.is_active).length

  // ============================================================================
  // ACCESS CHECK
  // ============================================================================

  if (!userLoading && !isGlobalAdmin) {
    return (
      <DashboardLayout>
        <Container className="py-8">
          <ErrorBanner message={error} />
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
          <h1 className="text-2xl font-semibold text-slate-900">Cancellation Reason Templates</h1>
          <p className="text-slate-500 mt-1">
            Manage default cancellation reasons copied to new facilities.
          </p>
        </div>

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
                  <Archive className="w-4 h-4" />
                  View Archived ({archivedCount})
                </button>
              )}
              {!showArchived && (
                <button
                  onClick={openCreateModal}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Reason
                </button>
              )}
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
            </div>
          ) : (reasons || []).length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Ban className="w-6 h-6 text-slate-400" />
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
                            <div className={`w-2 h-2 rounded-full ${reason.is_active ? 'bg-green-500' : 'bg-slate-300'}`} />
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
                                    <PenLine className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => setArchiveTarget(reason)}
                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Archive"
                                  >
                                    <Archive className="w-4 h-4" />
                                  </button>
                                </>
                            ) : (
                              <button
                                onClick={() => handleRestore(reason)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              >
                                <RefreshCw className="w-4 h-4" />
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
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
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
                  Display Name <span className="text-red-600">*</span>
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
                  Category <span className="text-red-600">*</span>
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